# Design: Job History & Re-Download

## Overview

Add a DynamoDB-backed job history system that tracks PDF remediation jobs per user and enables re-downloading of completed results. All changes are within this repo (`PDF_accessability_UI`) — no modifications to the PDF processing backend.

## Architecture

### Data Flow

```
Upload Flow (write path):
  React UI → handleUpload() → S3 PutObject (existing)
                             → POST /jobs (new) → createJob Lambda → DynamoDB

Result Detection (update path):
  React UI → ProcessingContainer polls S3 (existing)
           → result found → POST /jobs/{id} (new) → updateJob Lambda → DynamoDB

History View (read path):
  React UI → "My Documents" tab → GET /jobs → listJobs Lambda → DynamoDB

Re-Download:
  React UI → click download → frontend generates presigned URL using s3_result_key from job record
```

### DynamoDB Table Design

**Table Name**: `PDFAccessibility-JobHistory`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| user_sub | String | PK | Cognito user sub |
| created_at | String | SK | ISO 8601 timestamp (enables sort by date) |
| job_id | String | — | UUID, also stored for direct lookups |
| filename | String | — | Original filename |
| format | String | — | `pdf` or `html` |
| status | String | — | `processing`, `complete`, `failed` |
| s3_bucket | String | — | Bucket name |
| s3_upload_key | String | — | S3 key of uploaded file |
| s3_result_key | String | — | S3 key of result file (set on completion) |
| page_count | Number | — | Number of pages in the PDF |
| completed_at | String | — | ISO 8601 timestamp (set on completion) |

**Access Patterns**:
- List jobs by user, sorted by date: Query PK=user_sub, ScanIndexForward=false
- Update job status: Query PK=user_sub, SK=created_at

**GSI** (optional, for future admin queries):
- GSI1: PK=status, SK=created_at — find all processing/failed jobs

### API Endpoints

All endpoints use the existing API Gateway with Cognito authorizer.

| Method | Path | Lambda | Description |
|--------|------|--------|-------------|
| POST | /jobs | jobHistory | Create job record |
| GET | /jobs | jobHistory | List user's jobs |
| PUT | /jobs | jobHistory | Update job status |

Using a single Lambda with action routing via HTTP method to minimize infrastructure.

### Lambda: jobHistory

Single Python Lambda handling all three operations:

```python
def handler(event, context):
    method = event['httpMethod']
    user_sub = extract_user_sub(event)  # from Cognito JWT claims
    
    if method == 'POST':
        return create_job(user_sub, json.loads(event['body']))
    elif method == 'GET':
        return list_jobs(user_sub)
    elif method == 'PUT':
        return update_job(user_sub, json.loads(event['body']))
```

### Frontend Changes

**MainApp.js**: Add tab state (`activeTab`) to switch between "New Remediation" and "My Documents".

**New component: JobHistory.jsx**: MUI Table showing past jobs with:
- Filename, format badge, status chip, date, download button
- Uses MUI `sx` prop (no CSS files) per branding guidelines
- UB Blue color scheme

**UploadSection.jsx**: After successful upload, call POST /jobs to create record.

**ProcessingContainer.jsx**: On result detection, call PUT /jobs to update status.

### Re-Download Approach

The frontend already has S3 credentials via Cognito Identity Pool. Re-download generates a presigned URL client-side using the `s3_result_key` stored in the job record — same pattern as the existing `ProcessingContainer.jsx`. No server-side presigned URL generation needed.

### Access Control

- DynamoDB PK is `user_sub` — queries are inherently scoped to the authenticated user
- Lambda extracts `user_sub` from the Cognito JWT authorizer claims (not from request body)
- No API accepts a user_sub parameter — it's always derived from the token

## Components Modified

| File | Change |
|------|--------|
| `cdk_backend/lib/cdk_backend-stack.ts` | Add DynamoDB table, jobHistory Lambda, API Gateway resource |
| `cdk_backend/lambda/jobHistory/index.py` | New Lambda function |
| `pdf_ui/src/MainApp.js` | Add tab navigation |
| `pdf_ui/src/components/JobHistory.jsx` | New component |
| `pdf_ui/src/components/UploadSection.jsx` | Call create job API after upload |
| `pdf_ui/src/components/ProcessingContainer.jsx` | Call update job API on completion/failure |
| `pdf_ui/src/utilities/constants.jsx` | Add `JobHistoryAPI` constant |
| Deploy scripts | Add `REACT_APP_JOB_HISTORY_API` env var |
