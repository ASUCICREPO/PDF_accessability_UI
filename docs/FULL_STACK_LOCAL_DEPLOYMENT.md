# Full Stack Local Deployment Guide

This guide covers deploying the entire PDF Accessibility UI stack (backend + frontend) from your local repository without requiring GitHub integration or CodeBuild.

## Overview

The `deploy-full-stack-local.sh` script provides a complete end-to-end deployment solution that:

1. **Deploys CDK Backend** - Creates all AWS infrastructure (Cognito, Lambda, API Gateway, Amplify app)
2. **Builds React Frontend** - Compiles the React application locally
3. **Deploys to Amplify** - Uploads and deploys the built frontend directly to Amplify

This is ideal for:
- Local development and testing
- Private forks or branches
- Deployments without pushing to public GitHub
- Rapid iteration during development

## Prerequisites

### Required Tools

- **Node.js** (v18 or later) and npm
- **AWS CLI** (v2) configured with credentials
- **jq** - JSON processor for parsing AWS responses
- **curl** - For uploading deployment packages
- **zip** - For creating deployment archives

### AWS Permissions

Your AWS credentials must have permissions for:
- CloudFormation (create/update stacks)
- CDK (bootstrap, deploy)
- Cognito (create user pools, identity pools)
- Lambda (create functions, update code)
- API Gateway (create APIs, resources, methods)
- Amplify (create apps, deployments)
- IAM (create roles, policies)
- S3 (read bucket names)
- EventBridge (create rules)

See [IAM_PERMISSIONS.md](IAM_PERMISSIONS.md) for detailed requirements.

### Backend S3 Buckets

You must have at least one backend bucket deployed:
- **PDF-to-PDF bucket** (from PDF_Accessibility backend)
- **PDF-to-HTML bucket** (from PDF_Accessibility backend)

## Usage

### Basic Usage

```bash
./deploy-full-stack-local.sh
```

The script will prompt you for bucket names interactively.

### With Bucket Arguments

```bash
./deploy-full-stack-local.sh <PDF_BUCKET> <HTML_BUCKET>
```

**Examples:**

```bash
# Both formats
./deploy-full-stack-local.sh pdfaccessibility-bucket-abc123 pdf2html-bucket-xyz789

# PDF-to-PDF only
./deploy-full-stack-local.sh pdfaccessibility-bucket-abc123 ""

# PDF-to-HTML only
./deploy-full-stack-local.sh "" pdf2html-bucket-xyz789
```

## Deployment Process

### Step 1: Prerequisites Validation

The script checks for:
- Required command-line tools (node, npm, aws, jq, curl, zip)
- AWS credentials configuration
- AWS account access

### Step 2: Bucket Configuration

If not provided as arguments, you'll be prompted:

```
Enter PDF-to-PDF bucket name (leave empty if not using): pdfaccessibility-bucket-abc123
Enter PDF-to-HTML bucket name (leave empty if not using): pdf2html-bucket-xyz789
```

At least one bucket is required.

### Step 3: CDK Backend Deployment

The script:
1. Installs CDK dependencies (`npm install` in `cdk_backend/`)
2. Builds TypeScript code (`npm run build`)
3. Bootstraps CDK (if needed)
4. Deploys the CDK stack with bucket context

**Expected time:** 3-5 minutes

**Output:**
```
🏗️  Deploying CDK Backend...
📦 Installing CDK dependencies...
🔨 Building CDK stack...
🔧 Ensuring CDK is bootstrapped...
🚀 Deploying CDK stack...
✅ CDK backend deployed successfully
```

### Step 4: Configuration Retrieval

Retrieves CloudFormation outputs:
- Amplify App ID
- Cognito User Pool ID and Client ID
- Identity Pool ID
- API Gateway endpoints
- User Pool Domain

### Step 5: Frontend Build

The script:
1. Generates `.env.production` with all configuration
2. Installs frontend dependencies (`npm install` in `pdf_ui/`)
3. Builds the React app (`npm run build`)
4. Creates a deployment ZIP archive

**Expected time:** 2-3 minutes

### Step 6: Amplify Deployment

The script:
1. Creates an Amplify deployment
2. Uploads the build ZIP to S3
3. Starts the deployment
4. Monitors deployment status (polls every 5 seconds)

**Expected time:** 2-5 minutes

### Step 7: Completion

```
🎉 Full Stack Deployment Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Backend:
  - Stack: CdkBackendStack
  - User Pool: us-east-1_ABC123
  - Identity Pool: us-east-1:abc-123-def

📊 Frontend:
  - Amplify App: d1a2b3c4d5e6f7
  - URL: https://main.d1a2b3c4d5e6f7.amplifyapp.com
  - Job ID: 123

🌐 Your application is live at:
   https://main.d1a2b3c4d5e6f7.amplifyapp.com
```

## Total Deployment Time

**First deployment:** 10-15 minutes
**Subsequent deployments:** 5-8 minutes (dependencies cached)

## Comparison with Other Deployment Methods

| Method | Backend | Frontend | GitHub Required | Use Case |
|--------|---------|----------|-----------------|----------|
| `deploy.sh` | CodeBuild | CodeBuild | Yes | Production, main branch |
| `deploy-frontend-ub.sh` | Manual | CodeBuild | Yes | Frontend-only updates |
| `deploy-amplify-direct.sh` | Manual | Local build | No | Frontend-only, local dev |
| **`deploy-full-stack-local.sh`** | **Local CDK** | **Local build** | **No** | **Full stack, local dev** |

## Troubleshooting

### CDK Bootstrap Error

**Error:** `This stack uses assets, so the toolkit stack must be deployed`

**Solution:**
```bash
cd cdk_backend
npx cdk bootstrap
cd ..
./deploy-full-stack-local.sh
```

### CDK Deployment Fails

**Error:** Various CloudFormation errors

**Solution:**
1. Check CloudFormation console for detailed error messages
2. Verify IAM permissions
3. Check if stack already exists: `aws cloudformation describe-stacks --stack-name CdkBackendStack`
4. If updating existing stack, ensure no breaking changes

### Frontend Build Fails

**Error:** `npm run build` fails

**Solution:**
1. Check Node.js version: `node --version` (should be v18+)
2. Clear cache: `cd pdf_ui && rm -rf node_modules package-lock.json && npm install`
3. Check for TypeScript errors in console output

### Amplify Deployment Timeout

**Error:** Deployment takes longer than 5 minutes

**Solution:**
- The script will notify you and provide the Amplify console URL
- Check deployment status manually in the AWS Console
- Deployment may still succeed after script timeout

### "No matching state found" Auth Error

**Error:** Users see authentication error after deployment

**Solution:**
1. Verify redirect URIs in Cognito User Pool Client match Amplify URL
2. Clear browser cache and cookies
3. Try incognito/private browsing mode

## Updating an Existing Deployment

To update an existing deployment:

```bash
# Make your code changes
git add .
git commit -m "feat: your changes"

# Redeploy
./deploy-full-stack-local.sh <PDF_BUCKET> <HTML_BUCKET>
```

The script will:
- Update the CDK stack (only changed resources)
- Rebuild and redeploy the frontend
- Preserve existing user data and configuration

## Cleaning Up

To delete the entire stack:

```bash
cd cdk_backend
npx cdk destroy
```

This will remove:
- Cognito User Pool and Identity Pool
- Lambda functions
- API Gateway
- Amplify app
- IAM roles
- EventBridge rules

**Note:** User data in Cognito will be permanently deleted.

## Environment Variables

The script generates `.env.production` with:

```bash
REACT_APP_AWS_REGION=us-east-1
REACT_APP_USER_POOL_ID=us-east-1_ABC123
REACT_APP_USER_POOL_CLIENT_ID=abc123def456
REACT_APP_IDENTITY_POOL_ID=us-east-1:abc-123-def
REACT_APP_USER_POOL_DOMAIN=pdf-ui-abc123.auth.us-east-1.amazoncognito.com
REACT_APP_HOSTED_UI_URL=https://main.d1a2b3c4d5e6f7.amplifyapp.com
REACT_APP_PDF_BUCKET_NAME=pdfaccessibility-bucket-abc123
REACT_APP_HTML_BUCKET_NAME=pdf2html-bucket-xyz789
REACT_APP_UPDATE_FIRST_SIGN_IN=https://api.example.com/updateFirstSignIn
REACT_APP_UPLOAD_QUOTA_API=https://api.example.com/checkQuota
# ... additional endpoints
```

## Best Practices

1. **Test locally first** - Use this script for development and testing
2. **Commit before deploying** - Ensure your changes are committed
3. **Use consistent bucket names** - Store bucket names in a config file
4. **Monitor CloudWatch** - Check logs after deployment
5. **Verify functionality** - Test auth, upload, and download flows

## Integration with Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes
# ... edit files ...

# Test locally
./deploy-full-stack-local.sh <PDF_BUCKET> <HTML_BUCKET>

# Verify deployment
# ... test in browser ...

# Commit and push
git add .
git commit -m "feat: implement my feature"
git push origin feature/my-feature
```

## Support

For issues or questions:
- Check CloudWatch Logs for Lambda errors
- Review CloudFormation events for infrastructure issues
- Check Amplify console for frontend deployment logs
- See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for verification steps

---

**Built for local development and rapid iteration**
