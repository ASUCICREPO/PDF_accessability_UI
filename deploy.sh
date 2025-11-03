#!/usr/bin/env bash
set -euo pipefail

# --------------------------------------------------
# 1. Configure S3 buckets for PDF processing
# --------------------------------------------------

TIMESTAMP=$(date +%Y%m%d%H%M%S)
PROJECT_NAME="pdf-ui-${TIMESTAMP}"
echo "Auto-generated project name: $PROJECT_NAME"

# Configure S3 buckets (at least one required)
echo ""
echo "🔧 UI Configuration:"

# Show detected buckets if available
if [ -n "${PDF_TO_PDF_BUCKET:-}" ] && [ "${PDF_TO_PDF_BUCKET}" != "Null" ]; then
  echo "   PDF-to-PDF Bucket: ${PDF_TO_PDF_BUCKET}"
fi

if [ -n "${PDF_TO_HTML_BUCKET:-}" ] && [ "${PDF_TO_HTML_BUCKET}" != "Null" ]; then
  echo "   PDF-to-HTML Bucket: ${PDF_TO_HTML_BUCKET}"
fi

echo ""

# Prompt for PDF-to-PDF bucket with default
if [ -n "${PDF_TO_PDF_BUCKET:-}" ] && [ "${PDF_TO_PDF_BUCKET}" != "Null" ]; then
  read -rp "Enter PDF-to-PDF bucket name (or press Enter to use default: ${PDF_TO_PDF_BUCKET}): " USER_PDF_TO_PDF_BUCKET
  PDF_TO_PDF_BUCKET="${USER_PDF_TO_PDF_BUCKET:-$PDF_TO_PDF_BUCKET}"
else
  read -rp "Enter PDF-to-PDF bucket name (leave empty if not using PDF-to-PDF processing): " PDF_TO_PDF_BUCKET
fi

# Prompt for PDF-to-HTML bucket with default
if [ -n "${PDF_TO_HTML_BUCKET:-}" ] && [ "${PDF_TO_HTML_BUCKET}" != "Null" ]; then
  read -rp "Enter PDF-to-HTML bucket name (or press Enter to use default: ${PDF_TO_HTML_BUCKET}): " USER_PDF_TO_HTML_BUCKET
  PDF_TO_HTML_BUCKET="${USER_PDF_TO_HTML_BUCKET:-$PDF_TO_HTML_BUCKET}"
else
  read -rp "Enter PDF-to-HTML bucket name (leave empty if not using PDF-to-HTML processing): " PDF_TO_HTML_BUCKET
fi

# Validate that at least one bucket is provided
if ([ -z "${PDF_TO_PDF_BUCKET:-}" ] || [ "${PDF_TO_PDF_BUCKET}" = "Null" ]) && ([ -z "${PDF_TO_HTML_BUCKET:-}" ] || [ "${PDF_TO_HTML_BUCKET}" = "Null" ]); then
  echo "❌ Error: At least one bucket name is required"
  echo "   Please provide either PDF_TO_PDF_BUCKET or PDF_TO_HTML_BUCKET"
  exit 1
fi

# --------------------------------------------------
# 2. Ensure IAM service role exists
# --------------------------------------------------

ROLE_NAME="${PROJECT_NAME}-service-role"
echo "Checking for IAM role: $ROLE_NAME"

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "✓ IAM role exists"
  ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
else
  echo "✱ Creating IAM role: $ROLE_NAME"
  TRUST_DOC='{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Principal":{"Service":"codebuild.amazonaws.com"},
      "Action":"sts:AssumeRole"
    }]
  }'

  ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_DOC" \
    --query 'Role.Arn' --output text)

  echo "Attaching custom deployment policy..."
  CUSTOM_POLICY='{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AmplifyFullAccess",
            "Effect": "Allow",
            "Action": ["amplify:*"],
            "Resource": "*"
        },
        {
            "Sid": "CognitoFullAccess",
            "Effect": "Allow",
            "Action": ["cognito-idp:*", "cognito-identity:*"],
            "Resource": "*"
        },
        {
            "Sid": "LambdaFullAccess",
            "Effect": "Allow",
            "Action": ["lambda:*"],
            "Resource": "*"
        },
        {
            "Sid": "APIGatewayFullAccess",
            "Effect": "Allow",
            "Action": ["apigateway:*"],
            "Resource": "*"
        },
        {
            "Sid": "IAMFullAccess",
            "Effect": "Allow",
            "Action": ["iam:*"],
            "Resource": "*"
        },
        {
            "Sid": "S3FullAccess",
            "Effect": "Allow",
            "Action": ["s3:*"],
            "Resource": "*"
        },
        {
            "Sid": "SecretsManagerFullAccess",
            "Effect": "Allow",
            "Action": ["secretsmanager:*"],
            "Resource": "*"
        },
        {
            "Sid": "CloudFormationFullAccess",
            "Effect": "Allow",
            "Action": ["cloudformation:*"],
            "Resource": "*"
        },
        {
            "Sid": "CloudTrailFullAccess",
            "Effect": "Allow",
            "Action": ["cloudtrail:*"],
            "Resource": "*"
        },
        {
            "Sid": "EventsFullAccess",
            "Effect": "Allow",
            "Action": ["events:*"],
            "Resource": "*"
        },
        {
            "Sid": "CloudWatchLogsFullAccess",
            "Effect": "Allow",
            "Action": ["logs:*"],
            "Resource": "*"
        },
        {
            "Sid": "STSAccess",
            "Effect": "Allow",
            "Action": ["sts:GetCallerIdentity", "sts:AssumeRole"],
            "Resource": "*"
        }
    ]
}'

  aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name "DeploymentPolicy" \
    --policy-document "$CUSTOM_POLICY"

  echo "✓ IAM role created"
  echo "Waiting for IAM role to propagate for 10 seconds..."
  sleep 10
fi

# --------------------------------------------------
# 3. Create Backend CodeBuild project
# --------------------------------------------------

BACKEND_PROJECT_NAME="${PROJECT_NAME}-backend"
echo "Creating Backend CodeBuild project: $BACKEND_PROJECT_NAME"

# Build environment variables array for backend
ENV_VARS_ARRAY=""

# Add PDF_TO_PDF_BUCKET if provided
if [ -n "${PDF_TO_PDF_BUCKET:-}" ] && [ "${PDF_TO_PDF_BUCKET}" != "Null" ]; then
  ENV_VARS_ARRAY='{
      "name":  "PDF_TO_PDF_BUCKET",
      "value": "'"$PDF_TO_PDF_BUCKET"'",
      "type":  "PLAINTEXT"
    }'
fi

# Add PDF_TO_HTML_BUCKET if provided
if [ -n "${PDF_TO_HTML_BUCKET:-}" ] && [ "${PDF_TO_HTML_BUCKET}" != "Null" ]; then
  if [ -n "$ENV_VARS_ARRAY" ]; then
    ENV_VARS_ARRAY="$ENV_VARS_ARRAY,"
  fi
  ENV_VARS_ARRAY="$ENV_VARS_ARRAY"'{
      "name":  "PDF_TO_HTML_BUCKET",
      "value": "'"$PDF_TO_HTML_BUCKET"'",
      "type":  "PLAINTEXT"
    }'
fi

BACKEND_ENVIRONMENT='{
  "type": "LINUX_CONTAINER",
  "image": "aws/codebuild/amazonlinux-x86_64-standard:5.0",
  "computeType": "BUILD_GENERAL1_SMALL"'

# Add environment variables if any exist
if [ -n "$ENV_VARS_ARRAY" ]; then
  BACKEND_ENVIRONMENT="$BACKEND_ENVIRONMENT"',
  "environmentVariables": ['"$ENV_VARS_ARRAY"']'
fi

BACKEND_ENVIRONMENT="$BACKEND_ENVIRONMENT"'}'

# Backend buildspec
BACKEND_SOURCE='{
  "type":"GITHUB",
  "location":"https://github.com/ASUCICREPO/PDF_accessability_UI.git",
  "buildspec":"buildspec.yml"
}'

ARTIFACTS='{"type":"NO_ARTIFACTS"}'
SOURCE_VERSION="main"

echo "Creating Backend CodeBuild project '$BACKEND_PROJECT_NAME'..."
aws codebuild create-project \
  --name "$BACKEND_PROJECT_NAME" \
  --source "$BACKEND_SOURCE" \
  --source-version "$SOURCE_VERSION" \
  --artifacts "$ARTIFACTS" \
  --environment "$BACKEND_ENVIRONMENT" \
  --service-role "$ROLE_ARN" \
  --output json \
  # --no-cli-pager

if [ $? -ne 0 ]; then
  echo "✗ Failed to create backend CodeBuild project"
  exit 1
fi

# --------------------------------------------------
# 4. Start Backend Build and Wait for Completion
# --------------------------------------------------

echo "Starting backend build for project '$BACKEND_PROJECT_NAME'..."
BACKEND_BUILD_ID=$(aws codebuild start-build \
  --project-name "$BACKEND_PROJECT_NAME" \
  --query 'build.id' \
  --output text )

if [ $? -ne 0 ]; then
  echo "✗ Failed to start the backend build"
  exit 1
fi

echo "✓ Backend build started successfully. Build ID: $BACKEND_BUILD_ID"

# Wait for backend build to complete
echo "Waiting for backend build to complete..."
BUILD_STATUS="IN_PROGRESS"

while [ "$BUILD_STATUS" = "IN_PROGRESS" ]; do
  sleep 15
  BUILD_STATUS=$(aws codebuild batch-get-builds --ids "$BACKEND_BUILD_ID" --query 'builds[0].buildStatus' --output text )
  echo "Backend build status: $BUILD_STATUS"
done

if [ "$BUILD_STATUS" != "SUCCEEDED" ]; then
  echo "❌ Backend build failed with status: $BUILD_STATUS"
  echo "Check CodeBuild logs for details: https://console.aws.amazon.com/codesuite/codebuild/projects/$BACKEND_PROJECT_NAME/build/$BACKEND_BUILD_ID/"
  exit 1
fi

echo "✅ Backend build completed successfully!"


# --------------------------------------------------
# 5. Deploy Frontend
# --------------------------------------------------

echo "🚀 Starting frontend deployment..."
./deploy-frontend.sh "$PROJECT_NAME" "$PDF_TO_PDF_BUCKET" "$PDF_TO_HTML_BUCKET" "$ROLE_ARN"

if [ $? -eq 0 ]; then
  echo "✅ Frontend deployment completed successfully!"
else
  echo "❌ Frontend deployment failed!"
  exit 1
fi

# --------------------------------------------------
# 6. Final Summary
# --------------------------------------------------

echo ""
echo "🎉 Deployment Complete!"
echo "📊 Summary:"
echo "  - Backend Project: $BACKEND_PROJECT_NAME"
echo "  - Frontend Project: ${PROJECT_NAME}-frontend"
echo "  - CDK Stack: CdkBackendStack"
echo ""

exit 0
