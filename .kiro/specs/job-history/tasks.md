# Implementation Tasks: Job History & Re-Download

## Tasks

- [ ] 1. Add DynamoDB table and jobHistory Lambda to CDK stack
  - [ ] 1.1 Add DynamoDB table `PDFAccessibility-JobHistory` with PK=user_sub, SK=created_at
  - [ ] 1.2 Create jobHistory Lambda function (Python 3.12) with DynamoDB read/write permissions
  - [ ] 1.3 Add `/jobs` resource to existing API Gateway with GET, POST, PUT methods behind Cognito authorizer
  - [ ] 1.4 Add `REACT_APP_JOB_HISTORY_API` env var to Amplify branch
  - [ ] 1.5 Add CfnOutput for the jobs API endpoint

- [ ] 2. Implement jobHistory Lambda
  - [ ] 2.1 POST handler: create job record (user_sub from JWT, body has filename, format, s3_bucket, s3_upload_key, page_count)
  - [ ] 2.2 GET handler: query jobs by user_sub, return sorted descending by created_at
  - [ ] 2.3 PUT handler: update job status and s3_result_key (user_sub from JWT, body has created_at, status, s3_result_key)

- [ ] 3. Integrate job tracking into frontend upload flow
  - [ ] 3.1 Add `JobHistoryAPI` constant to constants.jsx
  - [ ] 3.2 Update UploadSection.jsx: call POST /jobs after successful S3 upload
  - [ ] 3.3 Update ProcessingContainer.jsx: call PUT /jobs when result detected or timeout/failure

- [ ] 4. Build Job History UI
  - [ ] 4.1 Create JobHistory.jsx component with MUI Table (filename, format, status, date, download)
  - [ ] 4.2 Add tab navigation to MainApp.js ("New Remediation" / "My Documents")
  - [ ] 4.3 Implement re-download using client-side presigned URL generation

- [ ] 5. Update deploy scripts
  - [ ] 5.1 Add REACT_APP_JOB_HISTORY_API to deploy-amplify-direct.sh
  - [ ] 5.2 Add REACT_APP_JOB_HISTORY_API to deploy-frontend-ub.sh
  - [ ] 5.3 Add REACT_APP_JOB_HISTORY_API to deploy.sh

- [ ] 6. Test and verify
  - [ ] 6.1 Verify CDK synth succeeds
  - [ ] 6.2 Test upload → job creation → status update → history display flow
  - [ ] 6.3 Test re-download from job history
  - [ ] 6.4 Verify existing upload/processing flow is unaffected
