# Deployment Methods Comparison

This document helps you choose the right deployment method for your use case.

## Quick Decision Guide

**Choose `deploy-full-stack-local.sh` if:**
- You're developing locally and want to test changes quickly
- You're working on a private fork or branch
- You don't want to push to GitHub for every test
- You want full control over the deployment process

**Choose `deploy.sh` if:**
- You're deploying to production
- You want GitHub integration for CI/CD
- You're deploying the main branch
- You want CodeBuild to handle the build process

**Choose `deploy-amplify-direct.sh` if:**
- Backend is already deployed
- You only need to update the frontend
- You're testing frontend-only changes

**Choose `deploy-frontend-ub.sh` if:**
- You're deploying the UB-branded branch
- You want CodeBuild integration
- Backend is already deployed

## Detailed Comparison

| Feature | deploy-full-stack-local.sh | deploy.sh | deploy-amplify-direct.sh | deploy-frontend-ub.sh |
|---------|---------------------------|-----------|-------------------------|----------------------|
| **Deploys Backend** | ✅ Yes (CDK) | ✅ Yes (CodeBuild) | ❌ No | ❌ No |
| **Deploys Frontend** | ✅ Yes (Local) | ✅ Yes (CodeBuild) | ✅ Yes (Local) | ✅ Yes (CodeBuild) |
| **GitHub Required** | ❌ No | ✅ Yes | ❌ No | ✅ Yes |
| **Build Location** | Local | CodeBuild | Local | CodeBuild |
| **Branch** | Any (local) | main | Any (local) | fpenland/demo/UB |
| **Use Case** | Development | Production | Frontend updates | UB branch deploy |
| **Speed** | Fast (cached) | Slower | Fastest | Slower |
| **Prerequisites** | Node, npm, CDK | AWS CLI | Backend deployed | Backend deployed |
| **IAM Permissions** | Full CDK + Amplify | Full + CodeBuild | Amplify only | Amplify + CodeBuild |

## Deployment Time Comparison

### First Deployment

| Method | Backend | Frontend | Total |
|--------|---------|----------|-------|
| `deploy-full-stack-local.sh` | 3-5 min | 2-5 min | **5-10 min** |
| `deploy.sh` | 3-5 min | 5-10 min | **8-15 min** |
| `deploy-amplify-direct.sh` | N/A | 2-5 min | **2-5 min** |
| `deploy-frontend-ub.sh` | N/A | 5-10 min | **5-10 min** |

### Subsequent Deployments

| Method | Backend | Frontend | Total |
|--------|---------|----------|-------|
| `deploy-full-stack-local.sh` | 2-3 min | 2-3 min | **4-6 min** |
| `deploy.sh` | 2-3 min | 5-8 min | **7-11 min** |
| `deploy-amplify-direct.sh` | N/A | 2-3 min | **2-3 min** |
| `deploy-frontend-ub.sh` | N/A | 5-8 min | **5-8 min** |

## Command Examples

### Full Stack Local Deployment

```bash
# Interactive (prompts for buckets)
./deploy-full-stack-local.sh

# With arguments
./deploy-full-stack-local.sh pdfaccessibility-bucket-abc123 pdf2html-bucket-xyz789

# PDF-to-PDF only
./deploy-full-stack-local.sh pdfaccessibility-bucket-abc123 ""

# PDF-to-HTML only
./deploy-full-stack-local.sh "" pdf2html-bucket-xyz789
```

### GitHub-Integrated Deployment

```bash
# Interactive
./deploy.sh

# Deploys from GitHub main branch via CodeBuild
```

### Frontend-Only Direct Deployment

```bash
# Interactive
./deploy-amplify-direct.sh

# With arguments
./deploy-amplify-direct.sh pdfaccessibility-bucket-abc123 pdf2html-bucket-xyz789
```

### UB Branch Deployment

```bash
# Requires project name, buckets, and role ARN
./deploy-frontend-ub.sh my-project pdfaccessibility-bucket-abc123 pdf2html-bucket-xyz789 arn:aws:iam::123456789012:role/MyRole
```

## Workflow Recommendations

### Local Development Workflow

```bash
# 1. Make changes
git checkout -b feature/my-feature
# ... edit files ...

# 2. Test locally
./deploy-full-stack-local.sh <PDF_BUCKET> <HTML_BUCKET>

# 3. Verify in browser
# ... test functionality ...

# 4. Commit and push
git add .
git commit -m "feat: my feature"
git push origin feature/my-feature

# 5. Create PR for review
```

### Production Deployment Workflow

```bash
# 1. Merge PR to main
git checkout main
git pull origin main

# 2. Deploy to production
./deploy.sh

# 3. Verify deployment
# ... test in production ...

# 4. Monitor CloudWatch logs
```

### Hotfix Workflow

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-fix

# 2. Make fix
# ... edit files ...

# 3. Test immediately
./deploy-full-stack-local.sh <PDF_BUCKET> <HTML_BUCKET>

# 4. Verify fix works
# ... test in browser ...

# 5. Merge to main and deploy
git checkout main
git merge hotfix/critical-fix
./deploy.sh
```

## Cost Considerations

### Local Deployment (`deploy-full-stack-local.sh`)

**Costs:**
- AWS resources (Cognito, Lambda, API Gateway, Amplify, S3)
- No CodeBuild costs
- Local compute is free

**Estimated:** $5-20/month depending on usage

### CodeBuild Deployment (`deploy.sh`, `deploy-frontend-ub.sh`)

**Costs:**
- AWS resources (same as above)
- CodeBuild: ~$0.005/minute (BUILD_GENERAL1_SMALL)
- ~$0.05-0.10 per deployment

**Estimated:** $5-25/month depending on usage

## Troubleshooting by Method

### deploy-full-stack-local.sh

**Common Issues:**
- CDK not bootstrapped → Run `cdk bootstrap`
- Node version mismatch → Use Node 18+
- Missing dependencies → Run `npm install` in both directories

**Logs:**
- CloudFormation console for backend errors
- Terminal output for build errors
- Amplify console for deployment errors

### deploy.sh

**Common Issues:**
- GitHub connection fails → Check repository access
- CodeBuild timeout → Increase timeout in buildspec
- IAM permissions → Check role policies

**Logs:**
- CodeBuild console for build logs
- CloudFormation console for backend errors
- Amplify console for deployment errors

### deploy-amplify-direct.sh

**Common Issues:**
- Backend not deployed → Deploy backend first
- Amplify app not found → Check app ID
- Upload fails → Check network/credentials

**Logs:**
- Terminal output for build errors
- Amplify console for deployment errors

## Best Practices

1. **Use local deployment for development** - Faster iteration, no GitHub dependency
2. **Use CodeBuild for production** - Better audit trail, CI/CD integration
3. **Test locally before pushing** - Catch issues early
4. **Keep bucket names in config** - Store in `.env.local` or similar
5. **Monitor CloudWatch** - Check logs after every deployment
6. **Use git tags for releases** - Track production deployments

## Migration Between Methods

### From CodeBuild to Local

```bash
# 1. Clone repository
git clone https://github.com/ASUCICREPO/PDF_accessability_UI.git
cd PDF_accessability_UI

# 2. Get bucket names from existing deployment
aws cloudformation describe-stacks --stack-name CdkBackendStack \
  --query 'Stacks[0].Parameters' --output table

# 3. Deploy locally
./deploy-full-stack-local.sh <PDF_BUCKET> <HTML_BUCKET>
```

### From Local to CodeBuild

```bash
# 1. Push changes to GitHub
git push origin main

# 2. Deploy via CodeBuild
./deploy.sh
```

## Support

For deployment issues:
- Check the specific deployment guide in `docs/`
- Review CloudWatch logs
- Check CloudFormation events
- See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)

---

**Choose the right tool for the job!**
