# Full Stack Local Deployment - Quick Start

## What's New

A new deployment script `deploy-full-stack-local.sh` that deploys both the CDK backend and React frontend entirely from your local repository, without requiring GitHub integration or CodeBuild.

## Why Use This?

- **Faster Development**: No need to push to GitHub for every test
- **Local Control**: Full visibility into the deployment process
- **Private Development**: Work on private branches or forks
- **Cost Effective**: No CodeBuild charges

## Quick Start

```bash
# Clone the repository
git clone https://github.com/ASUCICREPO/PDF_accessability_UI.git
cd PDF_accessability_UI

# Run the deployment script
./deploy-full-stack-local.sh

# Or with bucket arguments
./deploy-full-stack-local.sh pdfaccessibility-bucket-abc123 pdf2html-bucket-xyz789
```

## What It Does

1. ✅ Validates prerequisites (Node.js, npm, AWS CLI, jq)
2. ✅ Deploys CDK backend infrastructure (Cognito, Lambda, API Gateway, Amplify)
3. ✅ Retrieves CloudFormation outputs
4. ✅ Generates `.env.production` with all configuration
5. ✅ Builds React application locally
6. ✅ Creates deployment package
7. ✅ Deploys directly to Amplify
8. ✅ Monitors deployment status

## Deployment Time

- **First deployment**: 10-15 minutes
- **Subsequent deployments**: 5-8 minutes

## Prerequisites

- Node.js 18+ and npm
- AWS CLI v2 configured with credentials
- jq (JSON processor)
- Backend S3 bucket(s) from PDF_Accessibility deployment

## Documentation

- **Full Guide**: [docs/FULL_STACK_LOCAL_DEPLOYMENT.md](docs/FULL_STACK_LOCAL_DEPLOYMENT.md)
- **Comparison**: [docs/DEPLOYMENT_COMPARISON.md](docs/DEPLOYMENT_COMPARISON.md)
- **Main README**: [README.md](README.md)

## Comparison with Other Methods

| Method | Backend | Frontend | GitHub | Use Case |
|--------|---------|----------|--------|----------|
| **deploy-full-stack-local.sh** | ✅ Local CDK | ✅ Local build | ❌ No | **Development** |
| deploy.sh | ✅ CodeBuild | ✅ CodeBuild | ✅ Yes | Production |
| deploy-amplify-direct.sh | ❌ No | ✅ Local build | ❌ No | Frontend updates |

## Example Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes
# ... edit files ...

# 3. Test locally
./deploy-full-stack-local.sh pdfaccessibility-bucket-abc123 pdf2html-bucket-xyz789

# 4. Verify in browser
# ... test functionality ...

# 5. Iterate quickly
# ... make more changes ...
./deploy-full-stack-local.sh pdfaccessibility-bucket-abc123 pdf2html-bucket-xyz789

# 6. Commit when ready
git add .
git commit -m "feat: my feature"
git push origin feature/my-feature
```

## Troubleshooting

### CDK Bootstrap Error

```bash
cd cdk_backend
npx cdk bootstrap
cd ..
./deploy-full-stack-local.sh
```

### Node Version Error

```bash
node --version  # Should be v18+
nvm install 18  # If using nvm
nvm use 18
```

### AWS Credentials Error

```bash
aws sts get-caller-identity  # Verify credentials
aws configure  # If needed
```

## Support

- Check [docs/FULL_STACK_LOCAL_DEPLOYMENT.md](docs/FULL_STACK_LOCAL_DEPLOYMENT.md) for detailed troubleshooting
- Review CloudWatch logs for Lambda errors
- Check CloudFormation console for infrastructure issues
- See Amplify console for frontend deployment logs

---

**Happy deploying! 🚀**
