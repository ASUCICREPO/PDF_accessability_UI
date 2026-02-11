# PDF Accessibility Solutions - Frontend UI

This repository provides the **web-based user interface** for the PDF Accessibility Solutions, enabling users to easily upload, process, and download accessibility-compliant PDF documents through an intuitive web application.

> **⚠️ Important:** This is the frontend UI component. You must first deploy the [PDF Accessibility Backend](https://github.com/ASUCICREPO/PDF_Accessibility) before deploying this UI.

## Disclaimers

Customers are responsible for making their own independent assessment of the information in this document.

This document:

(a) is for informational purposes only,

(b) represents current AWS product offerings and practices, which are subject to change without notice, and

(c) does not create any commitments or assurances from AWS and its affiliates, suppliers or licensors. AWS products or services are provided "as is" without warranties, representations, or conditions of any kind, whether express or implied. The responsibilities and liabilities of AWS to its customers are controlled by AWS agreements, and this document is not part of, nor does it modify, any agreement between AWS and its customers.

(d) is not to be considered a recommendation or viewpoint of AWS

Additionally, all prototype code and associated assets should be considered:

(a) as-is and without warranties

(b) not suitable for production environments

(d) to include shortcuts in order to support rapid prototyping such as, but not limited to, relaxed authentication and authorization and a lack of strict adherence to security best practices

All work produced is open source. More information can be found in the GitHub repo.

## Overview

The PDF Accessibility UI connects to both PDF remediation solutions:

1. **PDF-to-PDF Remediation**: Upload PDFs and receive accessibility-improved PDFs
2. **PDF-to-HTML Remediation**: Upload PDFs and receive accessible HTML versions

The application features user authentication, quota management, real-time processing status, and secure file handling, all powered by AWS services.

## Table of Contents

| Index                                                             | Description                      |
| ----------------------------------------------------------------- | -------------------------------- |
| [Prerequisites](#prerequisites)                                   | Requirements before deployment   |
| [Automated One-Click Deployment](#automated-one-click-deployment) | How to deploy the UI             |
| [Using the Application](#using-the-application)                   | User guide for the web interface |
| [Infrastructure Components](#infrastructure-components)           | AWS resources created            |
| [Monitoring](#monitoring)                                         | System monitoring and logs       |
| [Contributing](#contributing)                                     | How to contribute to the project |

## Prerequisites

### Required: Backend Deployment

**You must deploy the backend solutions first!** The UI requires at least one of the following:

- **PDF-to-PDF Backend**: Deployed from [PDF_Accessibility repository](https://github.com/ASUCICREPO/PDF_Accessibility)
- **PDF-to-HTML Backend**: Deployed from [PDF_Accessibility repository](https://github.com/ASUCICREPO/PDF_Accessibility)

After deploying the backend, you'll need the **S3 bucket name(s)** created during deployment.

### System Requirements

1. **AWS Account** with appropriate permissions

   - Amplify, Cognito, Lambda, API Gateway, S3, IAM, CloudFormation
   - See [IAM Permissions Guide](docs/IAM_PERMISSIONS.md) for detailed requirements

2. **AWS CloudShell access** (recommended) or AWS CLI configured locally

   - Sign in to the AWS Management Console
   - Click the CloudShell icon in the top navigation bar
   - Wait for CloudShell to initialize

3. **Backend S3 Bucket Names**
   - PDF-to-PDF bucket name (starts with `pdfaccessibility-`)
   - PDF-to-HTML bucket name (starts with `pdf2html-bucket-`)
   - At least one bucket name is required

## Automated One-Click Deployment

### Step 1: Open AWS CloudShell and Clone the Repository

```bash
git clone https://github.com/ASUCICREPO/PDF_accessability_UI.git
cd PDF_accessability_UI
```

### Step 2: Run the Deployment Script

```bash
chmod +x deploy.sh
./deploy.sh
```

### Step 3: Follow the Interactive Prompts

The script will guide you through:

1. **Bucket Configuration**: Enter your backend S3 bucket names

   - PDF-to-PDF bucket name (or leave empty if not using)
   - PDF-to-HTML bucket name (or leave empty if not using)
   - At least one bucket is required

2. **Automated Deployment**: The script will:

   - Create IAM roles with necessary permissions
   - Deploy backend infrastructure (Cognito, Lambda, API Gateway)
   - Build and deploy the React frontend to Amplify
   - Configure all integrations automatically

3. **Deployment Progress**: Monitor real-time deployment status
   - Backend deployment: ~3-5 minutes
   - Frontend deployment: ~5-10 minutes

### Step 4: Access Your Application

After successful deployment, the script will display:

```
✅ Frontend deployment completed successfully!
🌐 Frontend URL: https://main.{app-id}.amplifyapp.com
```

Visit the URL to access your PDF Accessibility UI!

## Using the Application

### First-Time User Registration

1. **Navigate to the Application URL**

   - Open the Amplify URL provided after deployment

2. **Create an Account**

   - Click "Sign Up"
   - Enter your email, name, and password
   - Verify your email address

3. **Complete Your Profile**
   - On first sign-in, you'll be prompted to enter:
     - Organization name
     - Country, State, and City (optional)
   - This information helps us understand our user base

### Uploading and Processing PDFs

1. **Choose Output Format**

   - Select **PDF-to-PDF** to maintain PDF format with accessibility improvements
   - Select **PDF-to-HTML** to convert to accessible HTML format

2. **Upload Your PDF**

   - Click "Upload PDF" or drag and drop
   - File must meet your quota limits:
     - Maximum file size (default: 25 MB)
     - Maximum pages (default: 10 pages)
   - The system validates your file before upload

3. **Monitor Processing**

   - Real-time status updates
   - Processing time varies by file size and complexity
   - Typical processing: 2-5 minutes per document

4. **Download Results**
   - Once complete, download your remediated file
   - PDF-to-PDF: Accessibility-improved PDF
   - PDF-to-HTML: ZIP file containing HTML, images, and reports

### Understanding Your Quota

Your upload quota is displayed in the header:

- **Current Usage**: Number of files uploaded
- **Maximum Allowed**: Your upload limit

### Group Management

Administrators can change user groups through the AWS Cognito console:

1. Navigate to Amazon Cognito in AWS Console
2. Select the `PDF-Accessability-User-Pool`
3. Go to "Users and groups"
4. Select a user and add them to a group
5. User quotas update automatically via EventBridge

## Infrastructure Components

### AWS Resources Created

**Authentication & Authorization:**

- Amazon Cognito User Pool with custom attributes
- Cognito Identity Pool for S3 access
- Three user groups (Default, Amazon, Admin)
- Hosted UI for sign-in/sign-up

**Backend APIs:**

- API Gateway REST API with Cognito authorizer
- Lambda functions for quota management
- Lambda functions for user profile updates
- EventBridge rules for automatic quota updates

**Frontend Hosting:**

- AWS Amplify application
- Automatic HTTPS and custom domain support
- SPA routing configuration

**Monitoring:**

- CloudWatch Logs for all Lambda functions
- CloudTrail for Cognito group changes
- API Gateway access logs

### Custom Cognito Attributes

The system tracks the following user attributes:

```
custom:first_sign_in          - Boolean: First login flag
custom:total_files_uploaded   - Number: Total uploads
custom:max_files_allowed      - Number: Upload limit
custom:max_pages_allowed      - Number: Page limit per PDF
custom:max_size_allowed_MB    - Number: File size limit
custom:organization           - String: User's organization
custom:country                - String: User's country
custom:state                  - String: User's state
custom:city                   - String: User's city
custom:pdf2pdf                - Number: PDF-to-PDF conversions
custom:pdf2html               - Number: PDF-to-HTML conversions
```

## Monitoring

### CloudWatch Logs

Monitor application activity through CloudWatch:

**Lambda Functions:**

- `/aws/lambda/PostConfirmationLambda` - User registration events
- `/aws/lambda/UpdateAttributesFn` - Profile updates
- `/aws/lambda/checkOrIncrementQuotaFn` - Quota checks and increments
- `/aws/lambda/UpdateAttributesGroupsFn` - Group membership changes

#### Upload Failures

**Error: "You have reached your upload limit"**

- **Cause**: Quota exceeded
- **Solution**:
  - Contact administrator to increase quota
  - Wait for quota reset (if applicable)
  - Check your current usage in the header

**Error: "File size exceeds limit"**

- **Cause**: File too large for your quota
- **Solution**:
  - Reduce PDF file size
  - Split large PDFs into smaller documents
  - Request quota increase from administrator

**Error: "PDF file cannot exceed X pages"**

- **Cause**: PDF has too many pages
- **Solution**:
  - Split PDF into smaller documents
  - Request quota increase from administrator

#### Deployment Issues

**Error: "At least one bucket name is required"**

- **Cause**: No backend buckets configured
- **Solution**: Deploy the backend first and provide bucket names

**Error: "Failed to create IAM role"**

- **Cause**: Insufficient permissions
- **Solution**: Ensure your AWS user has IAM creation permissions

**Error: "CDK deployment failed"**

- **Cause**: Various CDK-related issues
- **Solution**:
  - Check CloudFormation console for detailed errors
  - Ensure CDK is bootstrapped: `cdk bootstrap`
  - Verify all prerequisites are met

### Getting Help

- **Check CloudWatch Logs**: Most issues are logged in CloudWatch
- **Review CloudFormation Events**: Deployment issues show in CloudFormation
- **Verify Backend Deployment**: Ensure backend is deployed and accessible
- **Contact Support**: ai-cic@amazon.com

## Contributing

Contributions to this project are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

For major changes, please open an issue first to discuss proposed changes.

## License

This project is licensed under the terms specified in the LICENSE file.

## Support

For questions, issues, or support:

- **Email**: ai-cic@amazon.com
- **Issues**: [GitHub Issues](https://github.com/ASUCICREPO/PDF_accessability_UI/issues)

---

**Built by Arizona State University's AI Cloud Innovation Center (AI CIC)**  
**Powered by AWS**
