// Colors for your theme
export const PRIMARY_MAIN = '#1976d2';  // Your primary color (blue)
export const SECONDARY_MAIN = '#ff4081';  // Your secondary color (pink)
export const CHAT_LEFT_PANEL_BACKGROUND = '#2c3e50';  // Background color for left panel
export const HEADER_BACKGROUND = '#34495e';  // Background color for header
export const primary_50 = '#e3f2fd';  // Lighter shade of primary color

export const isMaintenanceMode = process.env.REACT_APP_MAINTENANCE_MODE === 'true';

export const Authority = process.env.REACT_APP_AUTHORITY;
export const region = process.env.REACT_APP_AWS_REGION;
export const Bucket = process.env.REACT_APP_BUCKET_NAME;
export const Bucket_Region = process.env.REACT_APP_BUCKET_REGION;

// Separate buckets for different formats
export const PDFBucket = process.env.REACT_APP_PDF_BUCKET_NAME || 'Null';
export const HTMLBucket = process.env.REACT_APP_HTML_BUCKET_NAME || 'Null';

/**
 * Validate bucket configuration and return deployment status
 * @returns {Object} Validation result with deployment status and missing buckets
 */
export const validateBucketConfiguration = () => {
  const pdfBucketConfigured = process.env.REACT_APP_PDF_BUCKET_NAME && process.env.REACT_APP_PDF_BUCKET_NAME !== 'Null';
  const htmlBucketConfigured = process.env.REACT_APP_HTML_BUCKET_NAME && process.env.REACT_APP_HTML_BUCKET_NAME !== 'Null';

  const needsFullDeployment = !pdfBucketConfigured && !htmlBucketConfigured;
  const missingBuckets = [];

  if (!pdfBucketConfigured) missingBuckets.push('PDF Bucket');
  if (!htmlBucketConfigured) missingBuckets.push('HTML Bucket');

  return {
    needsFullDeployment,
    needsDeployment: missingBuckets.length > 0,
    missingBuckets,
    pdfBucketConfigured,
    htmlBucketConfigured,
    deploymentUrl: 'https://github.com/ASUCICREPO/PDF_Accessibility'
  };
};

/**
 * Validate bucket configuration for a specific format
 * @param {string} format - 'pdf' or 'html'
 * @returns {Object} Validation result for the specific format
 */
export const validateFormatBucket = (format) => {
  const isPdfFormat = format === 'pdf';
  const bucketConfigured = isPdfFormat
    ? (process.env.REACT_APP_PDF_BUCKET_NAME && process.env.REACT_APP_PDF_BUCKET_NAME !== 'Null')
    : (process.env.REACT_APP_HTML_BUCKET_NAME && process.env.REACT_APP_HTML_BUCKET_NAME !== 'Null');

  return {
    isConfigured: bucketConfigured,
    needsDeployment: !bucketConfigured,
    format: format,
    bucketType: isPdfFormat ? 'PDF Bucket' : 'HTML Bucket',
    deploymentUrl: 'https://github.com/ASUCICREPO/PDF_Accessibility'
  };
};

export const DomainPrefix = process.env.REACT_APP_DOMAIN_PREFIX;
export const HostedUIUrl = process.env.REACT_APP_HOSTED_UI_URL;
export const IndentityPoolId = process.env.REACT_APP_IDENTITY_POOL_ID;

export const FirstSignInAPI = process.env.REACT_APP_UPDATE_FIRST_SIGN_IN;
export const CheckAndIncrementQuota = process.env.REACT_APP_UPLOAD_QUOTA_API;
export const JobHistoryAPI = process.env.REACT_APP_JOB_HISTORY_API;

export const UserPoolClientId = process.env.REACT_APP_USER_POOL_CLIENT_ID;
export const UserPoolId = process.env.REACT_APP_USER_POOL_ID;





// Preferably not use
// export const HostedUserPoolDomain = process.env.REACT_APP_USER_POOL_DOMAIN;

