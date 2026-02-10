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

  # Get the current AWS account ID and region for resource scoping
  AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
  AWS_REGION=$(aws configure get region || echo "us-east-1")

  CUSTOM_POLICY='{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AmplifyAccess",
            "Effect": "Allow",
            "Action": [
                "amplify:CreateApp",
                "amplify:CreateBranch",
                "amplify:CreateDeployment",
                "amplify:DeleteApp",
                "amplify:DeleteBranch",
                "amplify:GetApp",
                "amplify:GetBranch",
                "amplify:ListApps",
                "amplify:ListBranches",
                "amplify:StartDeployment",
                "amplify:StopJob",
                "amplify:UpdateApp",
                "amplify:UpdateBranch"
            ],
            "Resource": "arn:aws:amplify:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':apps/*"
        },
        {
            "Sid": "CognitoAccess",
            "Effect": "Allow",
            "Action": [
                "cognito-idp:CreateUserPool",
                "cognito-idp:DeleteUserPool",
                "cognito-idp:DescribeUserPool",
                "cognito-idp:UpdateUserPool",
                "cognito-idp:CreateUserPoolClient",
                "cognito-idp:DeleteUserPoolClient",
                "cognito-idp:DescribeUserPoolClient",
                "cognito-idp:CreateUserPoolDomain",
                "cognito-idp:DeleteUserPoolDomain",
                "cognito-idp:DescribeUserPoolDomain",
                "cognito-idp:CreateGroup",
                "cognito-idp:DeleteGroup",
                "cognito-idp:GetGroup",
                "cognito-idp:SetUICustomization",
                "cognito-idp:SetUserPoolMfaConfig",
                "cognito-idp:CreateManagedLoginBranding",
                "cognito-idp:UpdateManagedLoginBranding",
                "cognito-idp:DeleteManagedLoginBranding",
                "cognito-idp:DescribeManagedLoginBranding",
                "cognito-idp:DescribeManagedLoginBrandingByClient",
                "cognito-idp:TagResource",
                "cognito-idp:UntagResource",
                "cognito-idp:ListTagsForResource"
            ],
            "Resource": "arn:aws:cognito-idp:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':userpool/*"
        },
        {
            "Sid": "CognitoIdentityAccess",
            "Effect": "Allow",
            "Action": [
                "cognito-identity:CreateIdentityPool",
                "cognito-identity:DeleteIdentityPool",
                "cognito-identity:DescribeIdentityPool",
                "cognito-identity:UpdateIdentityPool",
                "cognito-identity:SetIdentityPoolRoles",
                "cognito-identity:GetIdentityPoolRoles",
                "cognito-identity:TagResource"
            ],
            "Resource": "arn:aws:cognito-identity:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':identitypool/*"
        },
        {
            "Sid": "LambdaAccess",
            "Effect": "Allow",
            "Action": [
                "lambda:CreateFunction",
                "lambda:DeleteFunction",
                "lambda:GetFunction",
                "lambda:GetFunctionConfiguration",
                "lambda:UpdateFunctionCode",
                "lambda:UpdateFunctionConfiguration",
                "lambda:AddPermission",
                "lambda:RemovePermission",
                "lambda:InvokeFunction",
                "lambda:ListTags",
                "lambda:TagResource",
                "lambda:UntagResource",
                "lambda:PublishVersion",
                "lambda:ListVersionsByFunction"
            ],
            "Resource": "arn:aws:lambda:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':function:*"
        },
        {
            "Sid": "APIGatewayAccess",
            "Effect": "Allow",
            "Action": [
                "apigateway:GET",
                "apigateway:POST",
                "apigateway:PUT",
                "apigateway:DELETE",
                "apigateway:PATCH",
                "apigateway:TagResource"
            ],
            "Resource": "arn:aws:apigateway:'"$AWS_REGION"'::/*"
        },
        {
            "Sid": "IAMRoleAccess",
            "Effect": "Allow",
            "Action": [
                "iam:CreateRole",
                "iam:DeleteRole",
                "iam:GetRole",
                "iam:PassRole",
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
                "iam:PutRolePolicy",
                "iam:DeleteRolePolicy",
                "iam:GetRolePolicy",
                "iam:TagRole",
                "iam:UntagRole",
                "iam:ListRolePolicies",
                "iam:ListAttachedRolePolicies",
                "iam:CreatePolicy",
                "iam:DeletePolicy",
                "iam:GetPolicy",
                "iam:GetPolicyVersion",
                "iam:ListPolicyVersions"
            ],
            "Resource": [
                "arn:aws:iam::'"$AWS_ACCOUNT_ID"':role/pdf-ui-*",
                "arn:aws:iam::'"$AWS_ACCOUNT_ID"':role/CdkBackendStack-*",
                "arn:aws:iam::'"$AWS_ACCOUNT_ID"':role/cdk-*",
                "arn:aws:iam::'"$AWS_ACCOUNT_ID"':policy/CdkBackendStack-*"
            ]
        },
        {
            "Sid": "IAMPassRoleForServices",
            "Effect": "Allow",
            "Action": "iam:PassRole",
            "Resource": "arn:aws:iam::'"$AWS_ACCOUNT_ID"':role/*",
            "Condition": {
                "StringEquals": {
                    "iam:PassedToService": [
                        "lambda.amazonaws.com",
                        "cognito-idp.amazonaws.com",
                        "apigateway.amazonaws.com",
                        "events.amazonaws.com"
                    ]
                }
            }
        },
        {
            "Sid": "S3CDKAccess",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:GetBucketLocation",
                "s3:ListBucket",
                "s3:CreateBucket",
                "s3:GetEncryptionConfiguration",
                "s3:PutEncryptionConfiguration",
                "s3:GetBucketVersioning",
                "s3:PutBucketVersioning",
                "s3:PutBucketPublicAccessBlock",
                "s3:GetBucketPublicAccessBlock",
                "s3:PutBucketPolicy",
                "s3:GetBucketPolicy",
                "s3:DeleteBucketPolicy"
            ],
            "Resource": [
                "arn:aws:s3:::cdk-*",
                "arn:aws:s3:::cdk-*/*"
            ]
        },
        {
            "Sid": "S3BucketCorsAccess",
            "Effect": "Allow",
            "Action": [
                "s3:PutBucketCORS",
                "s3:GetBucketCORS"
            ],
            "Resource": [
                "arn:aws:s3:::*"
            ]
        },
        {
            "Sid": "SecretsManagerAccess",
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret"
            ],
            "Resource": "arn:aws:secretsmanager:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':secret:*"
        },
        {
            "Sid": "CloudFormationAccess",
            "Effect": "Allow",
            "Action": [
                "cloudformation:CreateStack",
                "cloudformation:DeleteStack",
                "cloudformation:DescribeStacks",
                "cloudformation:DescribeStackEvents",
                "cloudformation:GetTemplate",
                "cloudformation:UpdateStack",
                "cloudformation:CreateChangeSet",
                "cloudformation:DeleteChangeSet",
                "cloudformation:DescribeChangeSet",
                "cloudformation:ExecuteChangeSet",
                "cloudformation:GetTemplateSummary",
                "cloudformation:ListStackResources"
            ],
            "Resource": [
                "arn:aws:cloudformation:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':stack/CdkBackendStack/*",
                "arn:aws:cloudformation:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':stack/CDKToolkit/*"
            ]
        },
        {
            "Sid": "CloudFormationGlobal",
            "Effect": "Allow",
            "Action": [
                "cloudformation:ListStacks",
                "cloudformation:GetTemplateSummary"
            ],
            "Resource": "*"
        },
        {
            "Sid": "CloudTrailAccess",
            "Effect": "Allow",
            "Action": [
                "cloudtrail:CreateTrail",
                "cloudtrail:DeleteTrail",
                "cloudtrail:DescribeTrails",
                "cloudtrail:GetTrailStatus",
                "cloudtrail:StartLogging",
                "cloudtrail:StopLogging",
                "cloudtrail:PutEventSelectors",
                "cloudtrail:AddTags"
            ],
            "Resource": "arn:aws:cloudtrail:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':trail/*"
        },
        {
            "Sid": "EventsAccess",
            "Effect": "Allow",
            "Action": [
                "events:PutRule",
                "events:DeleteRule",
                "events:DescribeRule",
                "events:PutTargets",
                "events:RemoveTargets",
                "events:EnableRule",
                "events:DisableRule",
                "events:TagResource"
            ],
            "Resource": "arn:aws:events:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':rule/*"
        },
        {
            "Sid": "CloudWatchLogsAccess",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DeleteLogGroup",
                "logs:DescribeLogGroups",
                "logs:PutRetentionPolicy",
                "logs:TagResource"
            ],
            "Resource": [
                "arn:aws:logs:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':log-group:*",
                "arn:aws:logs:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':log-group:*:*"
            ]
        },
        {
            "Sid": "STSAccess",
            "Effect": "Allow",
            "Action": ["sts:GetCallerIdentity", "sts:AssumeRole"],
            "Resource": "*"
        },
        {
            "Sid": "SSMBootstrap",
            "Effect": "Allow",
            "Action": "ssm:GetParameter",
            "Resource": "arn:aws:ssm:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':parameter/cdk-bootstrap/*"
        },
        {
            "Sid": "CodeBuildAccess",
            "Effect": "Allow",
            "Action": [
                "codebuild:CreateProject",
                "codebuild:DeleteProject",
                "codebuild:StartBuild",
                "codebuild:BatchGetBuilds",
                "codebuild:BatchGetProjects"
            ],
            "Resource": "arn:aws:codebuild:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':project/pdf-ui-*"
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
  --no-cli-pager

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
  --output text \
  --no-cli-pager)

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
  BUILD_STATUS=$(aws codebuild batch-get-builds --ids "$BACKEND_BUILD_ID" --query 'builds[0].buildStatus' --output text --no-cli-pager)
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