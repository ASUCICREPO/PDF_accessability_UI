# Requirements: Job History & Re-Download

## Introduction

Users need visibility into their past PDF remediation jobs and the ability to re-download processed documents. The feature is scoped to the current user only — no cross-user access.

## Glossary

- **Job**: A single PDF remediation workflow from upload through completion
- **User**: An authenticated Cognito user identified by `sub`
- **Job Record**: A DynamoDB item tracking one job's metadata and status

## Requirements

### Requirement 1: Job Record Creation

**User Story:** As a user, I want my remediation jobs to be tracked so I can see them later.

#### Acceptance Criteria

1. WHEN a user uploads a PDF, THE System SHALL create a job record with status `processing`
2. THE job record SHALL include: user_sub, filename, format (pdf/html), s3_upload_key, created_at, status
3. WHEN processing completes (result detected in S3), THE System SHALL update the job record to status `complete` with s3_result_key
4. WHEN processing fails or times out, THE System SHALL update the job record to status `failed`

### Requirement 2: Job History Retrieval

**User Story:** As a user, I want to see a list of my past remediation jobs.

#### Acceptance Criteria

1. THE System SHALL provide an API to list jobs for the authenticated user
2. THE API SHALL return jobs sorted by created_at descending (newest first)
3. THE API SHALL only return jobs belonging to the requesting user (user_sub from JWT)
4. THE response SHALL include: job_id, filename, format, status, created_at

### Requirement 3: Re-Download

**User Story:** As a user, I want to re-download documents I previously processed.

#### Acceptance Criteria

1. WHEN a user requests re-download of a completed job, THE System SHALL generate a fresh presigned URL for the result file
2. THE System SHALL verify the requesting user owns the job before generating the URL
3. IF the result file no longer exists in S3, THE System SHALL return an appropriate error

### Requirement 4: Access Control

**User Story:** As a user, I want assurance that only I can see my job history.

#### Acceptance Criteria

1. THE System SHALL extract user_sub from the Cognito JWT for all job history operations
2. THE System SHALL use user_sub as the DynamoDB partition key to enforce per-user isolation
3. THE System SHALL NOT allow any API to query jobs for a different user

### Requirement 5: UI Integration

**User Story:** As a user, I want an intuitive way to access my job history within the app.

#### Acceptance Criteria

1. THE System SHALL provide a "My Documents" tab alongside the existing upload flow
2. THE tab SHALL display a table of past jobs with filename, format, status, date, and a download action
3. WHEN a job has status `complete`, THE System SHALL show a download button
4. WHEN a job has status `processing`, THE System SHALL show a processing indicator
5. WHEN a job has status `failed`, THE System SHALL show a failure indicator
