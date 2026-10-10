# IAM Permissions Required for PDF Accessibility UI

This document outlines the specific IAM permissions required to deploy and operate the PDF Accessibility Frontend UI.

> **Note:** This UI requires the backend PDF Accessibility solutions to be deployed first.

> **Regions:** Commercial AWS regions only. AWS Amplify Hosting is not offered in AWS GovCloud (US), so the UI cannot be deployed there.

## Overview

The PDF Accessibility UI deployment creates a complete web application with user authentication, quota management, and secure file handling. The deployment process uses AWS CodeBuild to automate infrastructure provisioning and frontend deployment.

## Required AWS Services

The UI deployment requires access to the following AWS services:

- **AWS Amplify** - Frontend hosting and deployment
- **Amazon Cognito** - User authentication and authorization
- **AWS Lambda** - Backend logic for user management
- **Amazon API Gateway** - RESTful APIs for quota and profile management
- **AWS IAM** - Role and policy management
- **Amazon S3** - Access to backend processing buckets
- **AWS Secrets Manager** - Secure credential storage (optional)
- **AWS CloudFormation** - Infrastructure as code deployment
- **AWS CloudTrail** - Event tracking for user group changes
- **Amazon EventBridge** - Event-driven automation
- **Amazon CloudWatch Logs** - Application logging and monitoring
- **AWS STS** - Temporary credential generation
- **AWS CodeBuild** - Automated deployment pipeline

---

## Deployment IAM Permissions

These permissions are required for the IAM role used by CodeBuild during deployment.

### Amplify Permissions

```json
{
    "Sid": "AmplifyFullAccess",
    "Effect": "Allow",
    "Action": ["amplify:*"],
    "Resource": "*"
}
```

**Why needed:** Create and manage Amplify applications, branches, and deployments for frontend hosting.

### Cognito Permissions

```json
{
    "Sid": "CognitoFullAccess",
    "Effect": "Allow",
    "Action": [
        "cognito-idp:*",
        "cognito-identity:*"
    ],
    "Resource": "*"
}
```

**Why needed:** 
- Create User Pools for authentication
- Configure Identity Pools for AWS service access
- Manage user groups and custom attributes
- Configure hosted UI and OAuth settings

### Lambda Permissions

```json
{
    "Sid": "LambdaFullAccess",
    "Effect": "Allow",
    "Action": ["lambda:*"],
    "Resource": "*"
}
```

**Why needed:** Deploy Lambda functions for:
- Post-confirmation user setup
- Quota management
- User attribute updates
- Group-based quota enforcement

### API Gateway Permissions

```json
{
    "Sid": "APIGatewayFullAccess",
    "Effect": "Allow",
    "Action": ["apigateway:*"],
    "Resource": "*"
}
```

**Why needed:** Create REST APIs with Cognito authorization for:
- Upload quota checking and incrementing
- User profile updates
- First sign-in data collection

### IAM Permissions

```json
{
    "Sid": "IAMFullAccess",
    "Effect": "Allow",
    "Action": ["iam:*"],
    "Resource": "*"
}
```

**Why needed:** 
- Create execution roles for Lambda functions
- Create authenticated roles for Cognito Identity Pool
- Attach policies for S3 access
- Manage service-linked roles

### S3 Permissions

```json
{
    "Sid": "S3FullAccess",
    "Effect": "Allow",
    "Action": ["s3:*"],
    "Resource": "*"
}
```

**Why needed:** 
- Grant Cognito Identity Pool access to backend buckets
- Configure CORS for file uploads
- Manage bucket policies for authenticated users

### Secrets Manager Permissions

```json
{
    "Sid": "SecretsManagerFullAccess",
    "Effect": "Allow",
    "Action": ["secretsmanager:*"],
    "Resource": "*"
}
```

**Why needed:** Store and retrieve sensitive configuration (optional, for future use).

### CloudFormation Permissions

```json
{
    "Sid": "CloudFormationFullAccess",
    "Effect": "Allow",
    "Action": ["cloudformation:*"],
    "Resource": "*"
}
```

**Why needed:** CDK synthesizes and deploys CloudFormation stacks for all infrastructure.

### CloudTrail Permissions

```json
{
    "Sid": "CloudTrailFullAccess",
    "Effect": "Allow",
    "Action": ["cloudtrail:*"],
    "Resource": "*"
}
```

**Why needed:** Create trails to track Cognito group membership changes for automatic quota updates.

### EventBridge Permissions

```json
{
    "Sid": "EventsFullAccess",
    "Effect": "Allow",
    "Action": ["events:*"],
    "Resource": "*"
}
```

**Why needed:** Create rules to trigger Lambda functions when users are added/removed from groups.

### CloudWatch Logs Permissions

```json
{
    "Sid": "CloudWatchLogsFullAccess",
    "Effect": "Allow",
    "Action": ["logs:*"],
    "Resource": "*"
}
```

**Why needed:** 
- Create log groups for Lambda functions
- Store application logs
- Enable debugging and monitoring

### STS Permissions

```json
{
    "Sid": "STSAccess",
    "Effect": "Allow",
    "Action": [
        "sts:GetCallerIdentity",
        "sts:AssumeRole"
    ],
    "Resource": "*"
}
```

**Why needed:** 
- Verify AWS account identity
- Assume roles for cross-service access
- Generate temporary credentials

---

## Runtime IAM Permissions

These permissions are granted to resources created during deployment for runtime operations.

### Lambda Execution Role Permissions

#### Post-Confirmation Lambda
```json
{
    "Effect": "Allow",
    "Action": [
        "cognito-idp:AdminUpdateUserAttributes",
        "cognito-idp:AdminAddUserToGroup",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
    ],
    "Resources": ["*"]
}
```

**Purpose:** Initialize new users with default attributes and assign them to appropriate groups.

#### Update Attributes Lambda
```json
{
    "Effect": "Allow",
    "Action": [
        "cognito-idp:AdminUpdateUserAttributes",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
    ],
    "Resources": ["*"]
}
```

**Purpose:** Update user profile information on first sign-in.

#### Check/Increment Quota Lambda
```json
{
    "Effect": "Allow",
    "Action": [
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminUpdateUserAttributes",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
    ],
    "Resources": ["*"]
}
```

**Purpose:** Check current usage and increment quota counters when users upload files.

#### Update Attributes Groups Lambda
```json
{
    "Effect": "Allow",
    "Action": [
        "cognito-idp:ListUsersInGroup",
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminUpdateUserAttributes",
        "cognito-idp:AdminListGroupsForUser",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
    ],
    "Resources": ["*"]
}
```

**Purpose:** Automatically update user quotas when group membership changes.

### Cognito Identity Pool Authenticated Role

```json
{
    "Effect": "Allow",
    "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject"
    ],
    "Resources": [
        "arn:aws:s3:::pdf-to-pdf-bucket/*",
        "arn:aws:s3:::pdf-to-html-bucket/*"
    ]
}
```

**Purpose:** Allow authenticated users to upload PDFs to backend buckets and download results.

## Security Best Practices

### Principle of Least Privilege

1. **Use Specific Resources**: Where possible, restrict permissions to specific resources rather than using `"*"`
2. **Separate Deployment and Runtime Roles**: Use different IAM roles for deployment vs. runtime operations
3. **Regular Audits**: Periodically review and remove unused permissions

### Credential Management

1. **No Hardcoded Credentials**: Never hardcode AWS credentials in code
2. **Use IAM Roles**: Prefer IAM roles over access keys
3. **Rotate Credentials**: Regularly rotate any access keys used
4. **Enable MFA**: Require multi-factor authentication for sensitive operations

### Monitoring and Compliance

1. **Enable CloudTrail**: Track all API calls for audit purposes
2. **CloudWatch Alarms**: Set up alarms for suspicious activity
3. **Regular Reviews**: Review IAM policies and user permissions quarterly

### Debugging Permission Issues

1. **Check CloudFormation Events**: Most detailed error messages appear here
2. **Review CloudWatch Logs**: Lambda execution errors are logged
3. **Enable CloudTrail**: See exactly which API calls are failing
4. **Use IAM Policy Simulator**: Test permissions before deployment

---

## Additional Resources

- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Cognito Security Best Practices](https://docs.aws.amazon.com/cognito/latest/developerguide/security-best-practices.html)
- [Amplify Security](https://docs.aws.amazon.com/amplify/latest/userguide/security.html)
- [Lambda Security](https://docs.aws.amazon.com/lambda/latest/dg/lambda-security.html)

---

## Support

For questions about IAM permissions or deployment issues:
- **Email**: ai-cic@amazon.com
- **Backend Repository**: [PDF_Accessibility](https://github.com/ASUCICREPO/PDF_Accessibility)
