#!/usr/bin/env bash
set -euo pipefail

# --------------------------------------------------
# Frontend Deployment Script
# Usage: ./deploy-frontend.sh <PROJECT_NAME> <PDF_TO_PDF_BUCKET> <PDF_TO_HTML_BUCKET> <ROLE_ARN>
# --------------------------------------------------

# Parse arguments
PROJECT_NAME="$1"
PDF_TO_PDF_BUCKET="$2"
PDF_TO_HTML_BUCKET="$3"
ROLE_ARN="$4"

echo "🚀 Starting Frontend Deployment..."
echo "📋 Parameters:"
echo "  - PROJECT_NAME: $PROJECT_NAME"
echo "  - PDF_TO_PDF_BUCKET: $PDF_TO_PDF_BUCKET"
echo "  - PDF_TO_HTML_BUCKET: $PDF_TO_HTML_BUCKET"
echo "  - ROLE_ARN: $ROLE_ARN"

# --------------------------------------------------
# Retrieve All CDK Outputs
# --------------------------------------------------

echo "🔍 Retrieving CDK deployment information..."

STACK_NAME="CdkBackendStack"
echo "CDK Stack Name: $STACK_NAME"

# Function to get all CDK outputs
get_cdk_outputs() {
  aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs' \
    --output json \
    --no-cli-pager
}

# Get all outputs
echo "Fetching all CDK outputs..."
CDK_OUTPUTS=$(get_cdk_outputs)

if [ $? -ne 0 ] || [ -z "$CDK_OUTPUTS" ] || [ "$CDK_OUTPUTS" = "null" ]; then
  echo "❌ Error: Could not retrieve CDK stack outputs"
  echo "Debug: CDK_OUTPUTS = '$CDK_OUTPUTS'"
  echo "Available stacks:"
  aws cloudformation list-stacks --query 'StackSummaries[?StackStatus==`CREATE_COMPLETE` || StackStatus==`UPDATE_COMPLETE`].StackName' --no-cli-pager
  exit 1
fi

echo "✅ Retrieved CDK outputs successfully"
echo "Debug: Raw CDK outputs: $CDK_OUTPUTS"

# Extract individual outputs
AMPLIFY_APP_ID=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "AmplifyAppId") | .OutputValue')
REACT_APP_AMPLIFY_APP_URL=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "AmplifyAppURL") | .OutputValue')
REACT_APP_USER_POOL_ID=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "UserPoolId") | .OutputValue')
REACT_APP_USER_POOL_CLIENT_ID=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "UserPoolClientId") | .OutputValue')
REACT_APP_USER_POOL_DOMAIN=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "UserPoolDomain") | .OutputValue')
REACT_APP_IDENTITY_POOL_ID=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "IdentityPoolId") | .OutputValue')
REACT_APP_UPDATE_FIRST_SIGN_IN_ENDPOINT=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "UpdateFirstSignInEndpoint") | .OutputValue')
REACT_APP_CHECK_UPLOAD_QUOTA_ENDPOINT=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "CheckUploadQuotaEndpoint") | .OutputValue')
REACT_APP_UPDATE_ATTRIBUTES_API_ENDPOINT=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "UpdateAttributesApiEndpoint377B5108") | .OutputValue')

# Validate required outputs
if [ -z "$AMPLIFY_APP_ID" ] || [ "$AMPLIFY_APP_ID" = "null" ]; then
  echo "❌ Error: Could not find AmplifyAppId in CDK stack outputs"
  echo "Available outputs:"
  echo "$CDK_OUTPUTS" | jq .
  exit 1
fi

if [ -z "$REACT_APP_AMPLIFY_APP_URL" ] || [ "$REACT_APP_AMPLIFY_APP_URL" = "null" ]; then
  echo "❌ Error: Could not find AmplifyAppURL in CDK stack outputs"
  echo "Available outputs:"
  echo "$CDK_OUTPUTS" | jq .
  exit 1
fi

echo "✅ Found Amplify App ID: $AMPLIFY_APP_ID"
echo "✅ Found Amplify App URL: $REACT_APP_AMPLIFY_APP_URL"
echo "✅ Found User Pool ID: $REACT_APP_USER_POOL_ID"
echo "✅ Found User Pool Client ID: $REACT_APP_USER_POOL_CLIENT_ID"

# Debug: Check AMPLIFY_APP_ID before adding to env vars
echo "🔍 Debug: AMPLIFY_APP_ID = '$AMPLIFY_APP_ID'"
echo "🔍 Debug: AMPLIFY_APP_ID length = ${#AMPLIFY_APP_ID}"

# --------------------------------------------------
# Create Frontend CodeBuild Project
# --------------------------------------------------

FRONTEND_PROJECT_NAME="${PROJECT_NAME}-frontend"
echo "Creating Frontend CodeBuild project: $FRONTEND_PROJECT_NAME"

# Build frontend environment variables array
FRONTEND_ENV_VARS_ARRAY=""

# Add bucket variables if provided
if [ -n "${PDF_TO_PDF_BUCKET:-}" ] && [ "${PDF_TO_PDF_BUCKET}" != "Null" ]; then
  FRONTEND_ENV_VARS_ARRAY='{
      "name":  "PDF_TO_PDF_BUCKET",
      "value": "'"$PDF_TO_PDF_BUCKET"'",
      "type":  "PLAINTEXT"
    }'
fi

if [ -n "${PDF_TO_HTML_BUCKET:-}" ] && [ "${PDF_TO_HTML_BUCKET}" != "Null" ]; then
  if [ -n "$FRONTEND_ENV_VARS_ARRAY" ]; then
    FRONTEND_ENV_VARS_ARRAY="$FRONTEND_ENV_VARS_ARRAY,"
  fi
  FRONTEND_ENV_VARS_ARRAY="$FRONTEND_ENV_VARS_ARRAY"'{
      "name":  "PDF_TO_HTML_BUCKET",
      "value": "'"$PDF_TO_HTML_BUCKET"'",
      "type":  "PLAINTEXT"
    }'
fi

# Add CDK outputs as environment variables for frontend
add_frontend_env_var() {
  local name="$1"
  local value="$2"
  if [ -n "$value" ] && [ "$value" != "null" ]; then
    if [ -n "$FRONTEND_ENV_VARS_ARRAY" ]; then
      FRONTEND_ENV_VARS_ARRAY="$FRONTEND_ENV_VARS_ARRAY,"
    fi
    FRONTEND_ENV_VARS_ARRAY="$FRONTEND_ENV_VARS_ARRAY"'{
        "name":  "'"$name"'",
        "value": "'"$value"'",
        "type":  "PLAINTEXT"
      }'
  fi
}

add_frontend_env_var "AMPLIFY_APP_ID" "$AMPLIFY_APP_ID"
add_frontend_env_var "REACT_APP_AMPLIFY_APP_URL" "$REACT_APP_AMPLIFY_APP_URL"
add_frontend_env_var "REACT_APP_USER_POOL_ID" "$REACT_APP_USER_POOL_ID"
add_frontend_env_var "REACT_APP_USER_POOL_CLIENT_ID" "$REACT_APP_USER_POOL_CLIENT_ID"
add_frontend_env_var "REACT_APP_USER_POOL_DOMAIN" "$REACT_APP_USER_POOL_DOMAIN"
add_frontend_env_var "REACT_APP_IDENTITY_POOL_ID" "$REACT_APP_IDENTITY_POOL_ID"
add_frontend_env_var "REACT_APP_UPDATE_FIRST_SIGN_IN_ENDPOINT" "$REACT_APP_UPDATE_FIRST_SIGN_IN_ENDPOINT"
add_frontend_env_var "REACT_APP_CHECK_UPLOAD_QUOTA_ENDPOINT" "$REACT_APP_CHECK_UPLOAD_QUOTA_ENDPOINT"
add_frontend_env_var "REACT_APP_UPDATE_ATTRIBUTES_API_ENDPOINT" "$REACT_APP_UPDATE_ATTRIBUTES_API_ENDPOINT"

FRONTEND_ENVIRONMENT='{
  "type": "LINUX_CONTAINER",
  "image": "aws/codebuild/amazonlinux-x86_64-standard:5.0",
  "computeType": "BUILD_GENERAL1_MEDIUM"'

# Add environment variables if any exist
if [ -n "$FRONTEND_ENV_VARS_ARRAY" ]; then
  FRONTEND_ENVIRONMENT="$FRONTEND_ENVIRONMENT"',
  "environmentVariables": ['"$FRONTEND_ENV_VARS_ARRAY"']'
fi

FRONTEND_ENVIRONMENT="$FRONTEND_ENVIRONMENT"'}'

# Debug: Show the environment variables being passed
echo "🔍 Debug: Environment variables JSON:"
echo "$FRONTEND_ENVIRONMENT" | jq .

# Frontend buildspec
FRONTEND_SOURCE='{
  "type":"GITHUB",
  "location":"https://github.com/ASUCICREPO/PDF_accessability_UI.git",
  "buildspec":"buildspec-frontend.yml"
}'

ARTIFACTS='{"type":"NO_ARTIFACTS"}'
SOURCE_VERSION="main"

echo "Creating Frontend CodeBuild project '$FRONTEND_PROJECT_NAME'..."
aws codebuild create-project \
  --name "$FRONTEND_PROJECT_NAME" \
  --source "$FRONTEND_SOURCE" \
  --source-version "$SOURCE_VERSION" \
  --artifacts "$ARTIFACTS" \
  --environment "$FRONTEND_ENVIRONMENT" \
  --service-role "$ROLE_ARN" \
  --output json \
  --no-cli-pager

if [ $? -ne 0 ]; then
  echo "✗ Failed to create frontend CodeBuild project"
  exit 1
fi

# --------------------------------------------------
# Start Frontend Build and Wait for Completion
# --------------------------------------------------

echo "Starting frontend build for project '$FRONTEND_PROJECT_NAME'..."
FRONTEND_BUILD_ID=$(aws codebuild start-build \
  --project-name "$FRONTEND_PROJECT_NAME" \
  --query 'build.id' \
  --output text \
  --no-cli-pager)

if [ $? -ne 0 ]; then
  echo "✗ Failed to start the frontend build"
  exit 1
fi

echo "✓ Frontend build started successfully. Build ID: $FRONTEND_BUILD_ID"

# Wait for frontend build to complete
echo "Waiting for frontend build to complete..."
BUILD_STATUS="IN_PROGRESS"

while [ "$BUILD_STATUS" = "IN_PROGRESS" ]; do
  sleep 15
  BUILD_STATUS=$(aws codebuild batch-get-builds --ids "$FRONTEND_BUILD_ID" --query 'builds[0].buildStatus' --output text --no-cli-pager)
  echo "Frontend build status: $BUILD_STATUS"
done

if [ "$BUILD_STATUS" != "SUCCEEDED" ]; then
  echo "❌ Frontend build failed with status: $BUILD_STATUS"
  echo "Check CodeBuild logs for details: https://console.aws.amazon.com/codesuite/codebuild/projects/$FRONTEND_PROJECT_NAME/build/$FRONTEND_BUILD_ID/"
  exit 1
fi

echo "✅ Frontend build completed successfully!"

# --------------------------------------------------
# Final Summary
# --------------------------------------------------

echo ""
echo "🎉 Frontend Deployment Complete!"
echo "📊 Summary:"
echo "  - Frontend Project: $FRONTEND_PROJECT_NAME"
echo "  - Frontend URL: $REACT_APP_AMPLIFY_APP_URL"

exit 0
