#!/usr/bin/env bash
set -euo pipefail

# --------------------------------------------------
# Full Stack Local Deployment Script
# Deploys both CDK backend and React frontend locally
# Usage: ./deploy-full-stack-local.sh [PDF_BUCKET] [HTML_BUCKET]
# --------------------------------------------------

echo "🚀 Starting Full Stack Local Deployment..."
echo "📋 This script will:"
echo "  1. Deploy CDK backend infrastructure"
echo "  2. Build and deploy React frontend to Amplify"
echo ""

# Parse optional arguments
PDF_TO_PDF_BUCKET="${1:-}"
PDF_TO_HTML_BUCKET="${2:-}"

# --------------------------------------------------
# Validate Prerequisites
# --------------------------------------------------

echo "🔍 Validating prerequisites..."

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "❌ node is required but not installed"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed"; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "❌ jq is required but not installed"; exit 1; }

# Check AWS credentials
aws sts get-caller-identity --no-cli-pager >/dev/null 2>&1 || { echo "❌ AWS credentials not configured"; exit 1; }

echo "✅ Prerequisites validated"
echo ""

# --------------------------------------------------
# Prompt for Bucket Names
# --------------------------------------------------

if [ -z "$PDF_TO_PDF_BUCKET" ]; then
  read -rp "Enter PDF-to-PDF bucket name (leave empty if not using): " PDF_TO_PDF_BUCKET
fi

if [ -z "$PDF_TO_HTML_BUCKET" ]; then
  read -rp "Enter PDF-to-HTML bucket name (leave empty if not using): " PDF_TO_HTML_BUCKET
fi

# Validate at least one bucket
if [ -z "$PDF_TO_PDF_BUCKET" ] && [ -z "$PDF_TO_HTML_BUCKET" ]; then
  echo "❌ Error: At least one bucket name is required"
  exit 1
fi

echo ""
echo "📦 Configuration:"
echo "  - PDF-to-PDF Bucket: ${PDF_TO_PDF_BUCKET:-Not specified}"
echo "  - PDF-to-HTML Bucket: ${PDF_TO_HTML_BUCKET:-Not specified}"
echo ""

# --------------------------------------------------
# Deploy CDK Backend
# --------------------------------------------------

echo "🏗️  Deploying CDK Backend..."
echo ""

cd cdk_backend

# Install dependencies
if [ ! -d "node_modules" ]; then
  echo "📦 Installing CDK dependencies..."
  npm install
fi

# Build TypeScript
echo "🔨 Building CDK stack..."
npm run build

# Bootstrap CDK (if needed)
echo "🔧 Ensuring CDK is bootstrapped..."
npx cdk bootstrap --no-cli-pager 2>/dev/null || true

# Build CDK context arguments
CDK_CONTEXT_ARGS=""
if [ -n "$PDF_TO_PDF_BUCKET" ]; then
  CDK_CONTEXT_ARGS="$CDK_CONTEXT_ARGS -c PDF_TO_PDF_BUCKET=$PDF_TO_PDF_BUCKET"
fi
if [ -n "$PDF_TO_HTML_BUCKET" ]; then
  CDK_CONTEXT_ARGS="$CDK_CONTEXT_ARGS -c PDF_TO_HTML_BUCKET=$PDF_TO_HTML_BUCKET"
fi

# Deploy CDK stack
echo "🚀 Deploying CDK stack..."
npx cdk deploy --require-approval never --no-cli-pager $CDK_CONTEXT_ARGS

if [ $? -ne 0 ]; then
  echo "❌ CDK deployment failed"
  exit 1
fi

echo "✅ CDK backend deployed successfully"
echo ""

cd ..

# --------------------------------------------------
# Configure S3 CORS for Browser Uploads
# --------------------------------------------------

echo "🔧 Configuring S3 CORS for browser uploads..."

CORS_CONFIG='{"CORSRules":[{"AllowedHeaders":["*"],"AllowedMethods":["GET","HEAD","PUT","POST","DELETE"],"AllowedOrigins":["*"],"ExposeHeaders":["ETag","x-amz-request-id"]}]}'

if [ -n "$PDF_TO_PDF_BUCKET" ]; then
  aws s3api put-bucket-cors --bucket "$PDF_TO_PDF_BUCKET" --cors-configuration "$CORS_CONFIG" --no-cli-pager && \
    echo "  ✅ CORS configured for PDF-to-PDF bucket" || \
    echo "  ⚠️  Failed to set CORS on PDF-to-PDF bucket"
fi

if [ -n "$PDF_TO_HTML_BUCKET" ]; then
  aws s3api put-bucket-cors --bucket "$PDF_TO_HTML_BUCKET" --cors-configuration "$CORS_CONFIG" --no-cli-pager && \
    echo "  ✅ CORS configured for PDF-to-HTML bucket" || \
    echo "  ⚠️  Failed to set CORS on PDF-to-HTML bucket"
fi

echo ""

echo "🔍 Retrieving backend configuration..."

STACK_NAME="CdkBackendStack"

# Function to get CDK output value
get_output() {
  local output_key="$1"
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
    --output text \
    --no-cli-pager 2>/dev/null || echo ""
}

# Get all required outputs
AMPLIFY_APP_ID=$(get_output "AmplifyAppId")
REACT_APP_AMPLIFY_APP_URL=$(get_output "AmplifyAppURL")
REACT_APP_USER_POOL_ID=$(get_output "UserPoolId")
REACT_APP_USER_POOL_CLIENT_ID=$(get_output "UserPoolClientId")
REACT_APP_USER_POOL_DOMAIN=$(get_output "UserPoolDomain")
REACT_APP_IDENTITY_POOL_ID=$(get_output "IdentityPoolId")
REACT_APP_UPDATE_FIRST_SIGN_IN_ENDPOINT=$(get_output "UpdateFirstSignInEndpoint")
REACT_APP_CHECK_UPLOAD_QUOTA_ENDPOINT=$(get_output "CheckUploadQuotaEndpoint")
REACT_APP_JOB_HISTORY_ENDPOINT=$(get_output "JobHistoryEndpoint")
REACT_APP_UPDATE_ATTRIBUTES_API_ENDPOINT=$(get_output "UpdateAttributesApiEndpoint377B5108")

AWS_REGION=us-east-1

# Validate required outputs
if [ -z "$AMPLIFY_APP_ID" ] || [ "$AMPLIFY_APP_ID" = "None" ]; then
  echo "❌ Error: Could not retrieve AmplifyAppId from stack outputs"
  exit 1
fi

AMPLIFY_APP_ID=$(echo "$AMPLIFY_APP_ID" | tr -d '[:space:]')

echo "✅ Retrieved configuration:"
echo "  - Amplify App ID: $AMPLIFY_APP_ID"
echo "  - User Pool ID: $REACT_APP_USER_POOL_ID"
echo ""

# --------------------------------------------------
# Deploy Frontend
# --------------------------------------------------

echo "🎨 Deploying Frontend..."
echo ""

cd pdf_ui

# Create .env.production
echo "📝 Creating .env.production..."

cat > .env.production << EOF
# Auto-generated by deploy-full-stack-local.sh
# Generated: $(date)

REACT_APP_AWS_REGION=$AWS_REGION
REACT_APP_BUCKET_REGION=$AWS_REGION
REACT_APP_USER_POOL_ID=$REACT_APP_USER_POOL_ID
REACT_APP_USER_POOL_CLIENT_ID=$REACT_APP_USER_POOL_CLIENT_ID
REACT_APP_IDENTITY_POOL_ID=$REACT_APP_IDENTITY_POOL_ID
REACT_APP_USER_POOL_DOMAIN=$REACT_APP_USER_POOL_DOMAIN
REACT_APP_HOSTED_UI_URL=$REACT_APP_AMPLIFY_APP_URL
REACT_APP_AUTHORITY=cognito-idp.$AWS_REGION.amazonaws.com/$REACT_APP_USER_POOL_ID
REACT_APP_PDF_BUCKET_NAME=${PDF_TO_PDF_BUCKET:-}
REACT_APP_HTML_BUCKET_NAME=${PDF_TO_HTML_BUCKET:-}
REACT_APP_UPDATE_FIRST_SIGN_IN=$REACT_APP_UPDATE_FIRST_SIGN_IN_ENDPOINT
REACT_APP_UPLOAD_QUOTA_API=$REACT_APP_CHECK_UPLOAD_QUOTA_ENDPOINT
REACT_APP_JOB_HISTORY_API=$REACT_APP_JOB_HISTORY_ENDPOINT
REACT_APP_UPDATE_ATTRIBUTES_API=$REACT_APP_UPDATE_ATTRIBUTES_API_ENDPOINT
REACT_APP_DOMAIN_PREFIX=$(echo $REACT_APP_USER_POOL_DOMAIN | cut -d'.' -f1)
EOF

# Install dependencies
if [ ! -d "node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  npm install
fi

# Build React app
echo "🔨 Building React application..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Frontend build failed"
  exit 1
fi

# Create deployment package
echo "📦 Creating deployment package..."
cd build
zip -r ../deployment.zip . > /dev/null 2>&1
cd ..

# Deploy to Amplify
echo "🚀 Deploying to Amplify..."

DEPLOYMENT_RESPONSE=$(aws amplify create-deployment \
  --app-id "$AMPLIFY_APP_ID" \
  --branch-name main \
  --output json \
  --no-cli-pager)

UPLOAD_URL=$(echo "$DEPLOYMENT_RESPONSE" | jq -r '.zipUploadUrl')
JOB_ID=$(echo "$DEPLOYMENT_RESPONSE" | jq -r '.jobId')

echo "Uploading build artifacts..."
curl -X PUT \
  -H "Content-Type: application/zip" \
  --data-binary @deployment.zip \
  "$UPLOAD_URL" \
  --silent \
  --show-error

aws amplify start-deployment \
  --app-id "$AMPLIFY_APP_ID" \
  --branch-name main \
  --job-id "$JOB_ID" \
  --source-url "$UPLOAD_URL" \
  --no-cli-pager > /dev/null

echo "✅ Deployment started (Job ID: $JOB_ID)"

# Monitor deployment
echo "⏳ Monitoring deployment..."
DEPLOYMENT_STATUS="PENDING"
RETRY_COUNT=0
MAX_RETRIES=60

while [ "$DEPLOYMENT_STATUS" != "SUCCEED" ] && [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  sleep 5
  
  DEPLOYMENT_STATUS=$(aws amplify get-job \
    --app-id "$AMPLIFY_APP_ID" \
    --branch-name main \
    --job-id "$JOB_ID" \
    --query 'job.summary.status' \
    --output text \
    --no-cli-pager 2>/dev/null || echo "PENDING")
  
  case "$DEPLOYMENT_STATUS" in
    "SUCCEED")
      echo "✅ Deployment succeeded!"
      break
      ;;
    "FAILED"|"CANCELLED")
      echo "❌ Deployment $DEPLOYMENT_STATUS"
      exit 1
      ;;
    *)
      echo "Status: $DEPLOYMENT_STATUS ($(($RETRY_COUNT * 5))s elapsed)"
      ;;
  esac
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
done

# Cleanup
rm -f deployment.zip

cd ..

# --------------------------------------------------
# Final Summary
# --------------------------------------------------

echo ""
echo "🎉 Full Stack Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Backend:"
echo "  - Stack: $STACK_NAME"
echo "  - User Pool: $REACT_APP_USER_POOL_ID"
echo "  - Identity Pool: $REACT_APP_IDENTITY_POOL_ID"
echo ""
echo "📊 Frontend:"
echo "  - Amplify App: $AMPLIFY_APP_ID"
echo "  - URL: $REACT_APP_AMPLIFY_APP_URL"
echo "  - Job ID: $JOB_ID"
echo ""
echo "🌐 Your application is live at:"
echo "   $REACT_APP_AMPLIFY_APP_URL"
echo ""
echo "💡 Next deployment:"
echo "   ./deploy-full-stack-local.sh [PDF_BUCKET] [HTML_BUCKET]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit 0
