import React, { useState, useRef } from 'react';
import { useAuth } from 'react-oidc-context'; // to get user sub if needed
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Snackbar, Alert } from '@mui/material';
import { motion } from 'framer-motion';
import { PDFDocument } from 'pdf-lib';
import imgFileQuestion from '../assets/pdf-question.svg';
import imgFileText from '../assets/pdf-icon.svg';
import imgCodeXml from '../assets/pdf-html.svg';
import './UploadSection.css';

import { region, PDFBucket, HTMLBucket, CheckAndIncrementQuota, JobHistoryAPI, validateBucketConfiguration, validateFormatBucket } from '../utilities/constants';

function sanitizeFilename(filename, format = 'pdf') {
  // Normalize the filename to decompose accented characters
  const normalized = filename.normalize('NFD');
  // Remove combining diacritical marks
  const withoutDiacritics = normalized.replace(/[\u0300-\u036f]/g, '');
  // Remove any characters outside of the ISO-8859-1 range.
  // eslint-disable-next-line
  let sanitized = withoutDiacritics.replace(/[^\u0000-\u00FF]/g, '');
  
  // For PDF2HTML, apply comprehensive sanitization to match Bedrock Data Automation constraints
  if (format === 'html') {
    // Replace spaces with underscores
    sanitized = sanitized.replace(/\s/g, '_');
    
    // Replace characters that violate Bedrock Data Automation S3 URI constraints
    // Pattern disallows: \x00-\x1F (control chars), \x7F (DEL), { ^ } % ` ] " > [ ~ < # |
    // Also replace other problematic characters: & \ * ? / $ ! ' : @ + =
    // eslint-disable-next-line no-control-regex
    const problematicChars = /[\x00-\x1F\x7F{^}%`\]">[~<#|&\\*?/$!'":@+=]/g;
    sanitized = sanitized.replace(problematicChars, '_');
    
    // Replace multiple consecutive underscores with a single one
    while (sanitized.includes('__')) {
      sanitized = sanitized.replace(/__/g, '_');
    }
    
    // Remove leading/trailing underscores
    sanitized = sanitized.replace(/^_+|_+$/g, '');
  }
  
  // If the sanitized filename is empty, return a default value.
  return sanitized.trim() ? sanitized : 'default.pdf';
}


function UploadSection({ onUploadComplete, awsCredentials, currentUsage, maxFilesAllowed, maxPagesAllowed, maxSizeAllowedMB, onUsageRefresh, setUsageCount, isFileUploaded, onShowDeploymentPopup}) {
  const auth = useAuth();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [fileSizeMB, setFileSizeMB] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [formatAvailability, setFormatAvailability] = useState({ pdf: false, html: false });

  // Check format availability on component mount
  React.useEffect(() => {
    const pdfValidation = validateFormatBucket('pdf');
    const htmlValidation = validateFormatBucket('html');

    setFormatAvailability({
      pdf: pdfValidation.isConfigured,
      html: htmlValidation.isConfigured
    });
  }, []);

  const resetFileInput = () => {
    setSelectedFile(null);
    setSelectedFormat(null);
    setFileSizeMB(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  const handleFormatSelect = (format) => {
    // Check bucket configuration for the specific format
    const formatValidation = validateFormatBucket(format);
    const fullValidation = validateBucketConfiguration();

    // If both buckets are missing, show deployment popup
    if (fullValidation.needsFullDeployment) {
      setErrorMessage('Backend infrastructure not deployed. Please deploy the backend first.');
      setOpenSnackbar(true);

      if (onShowDeploymentPopup) {
        onShowDeploymentPopup(fullValidation);
      }
      return;
    }

    // If specific format bucket is missing, show deployment guidance but don't proceed
    if (formatValidation.needsDeployment) {
      // Show deployment popup with specific format guidance
      if (onShowDeploymentPopup) {
        const formatSpecificValidation = {
          ...fullValidation,
          needsFullDeployment: false,
          specificFormat: format,
          specificBucket: formatValidation.bucketType
        };
        onShowDeploymentPopup(formatSpecificValidation);
      }
      return;
    }

    setSelectedFormat(format);
    setErrorMessage('');
  };

  const handleFileInput = async (e) => {
    const file = e.target.files[0];
    if (!file) return;


    // Reset any existing error messages
    setErrorMessage('');

    // **1. Basic PDF Checks**
    if (file.type !== 'application/pdf') {
      setErrorMessage('Only PDF files are allowed.');
      setOpenSnackbar(true);
      resetFileInput();
      return;
    }

    if (file.size > maxSizeAllowedMB * 1024 * 1024) {
      setErrorMessage(`File size exceeds the ${maxSizeAllowedMB} MB limit.`);
      setOpenSnackbar(true);
      resetFileInput();
      return;
    }

    // **2. Page Count Check with pdf-lib**
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const numPages = pdfDoc.getPageCount();

      if (numPages > maxPagesAllowed) {
        setErrorMessage(`PDF file cannot exceed ${maxPagesAllowed} pages.`);
        setOpenSnackbar(true);
        resetFileInput();
        return;
      }

      setSelectedFile(file);
      setPageCount(numPages);
      console.log('File object details:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
      const sizeInBytes = file.size || 0;
      const sizeInMB = sizeInBytes / (1024 * 1024);
      const displaySize = sizeInMB >= 0.1 ? parseFloat(sizeInMB.toFixed(1)) : parseFloat(sizeInMB.toFixed(2));
      setFileSizeMB(displaySize);
      console.log('File size set to:', sizeInMB, 'MB for file:', file.name, '(raw size:', file.size, 'bytes)');
      // Pass the file directly to handleUpload
      handleUpload(file);

    } catch (error) {
      setErrorMessage('Unable to read the PDF file.');
      setOpenSnackbar(true);
      resetFileInput();
    }
  };

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = (e) => {
      handleFileInput(e);
    };
    input.click();
  };

  const handleUpload = async (file = selectedFile) => {

    // **1. Check if the bucket for selected format is configured**
    const formatValidation = validateFormatBucket(selectedFormat);
    if (formatValidation.needsDeployment) {
      setErrorMessage(`${formatValidation.bucketType} not configured. Please install the required infrastructure first.`);
      setOpenSnackbar(true);
      return;
    }

    // **2. Check if user has reached the upload limit**
    if (currentUsage >= maxFilesAllowed) {
      setErrorMessage('You have reached your upload limit. Please contact support for further assistance.');
      setOpenSnackbar(true);
      return;
    }

    // **3. Basic Guards**
    if (!file) {
      setErrorMessage('Please select a PDF file before uploading.');
      setOpenSnackbar(true);
      return;
    }
    if (!awsCredentials) {
      setErrorMessage('AWS credentials not available yet. Please wait...');
      setOpenSnackbar(true);
      return;
    }

    // **3. Attempt to Increment Usage First**
    const userSub = auth.user?.profile?.sub;
    if (!userSub) {
      setErrorMessage('User identifier not found. Are you logged in?');
      setOpenSnackbar(true);
      return;
    }
    const idToken = auth.user?.id_token;
    setIsUploading(true);

    try {
      // **4. Call the Usage API to Increment**
      const usageRes = await fetch(CheckAndIncrementQuota, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          sub: userSub,
          mode: 'increment',
          conversionType: selectedFormat
        }),
      });

      if (!usageRes.ok) {
        // e.g., 403 if user at limit, or other error
        const errData = await usageRes.json();

        // **Dynamic Error Message Based on Status Code**
        const quotaExceeded = usageRes.status === 403; // Assuming 403 indicates quota limit
        const message = quotaExceeded
          ? 'You have reached the upload limit. Please contact support for further assistance.'
          : errData.message || 'An error occurred while checking your upload quota. Please try again later.';

        setErrorMessage(message);
        setOpenSnackbar(true);
        setIsUploading(false);
        return;
      }
      
      const usageData = await usageRes.json();
      const updatedUsage = usageData.newCount; // Updated usage count from the backend
      setUsageCount(updatedUsage);
      
      // **5. Proceed with S3 Upload**
      const client = new S3Client({
        region,
        credentials: {
          accessKeyId: awsCredentials.accessKeyId,
          secretAccessKey: awsCredentials.secretAccessKey,
          sessionToken: awsCredentials.sessionToken,
        },
      });

      const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, ''); // YYYYMMDDTHHMMSS format
      const userEmail = auth.user?.profile?.email || 'user'; // Use email for unique filename, fallback to 'user'
      const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9]/g, '_'); // Replace non-alphanumerics with underscores
      const sanitizedFileName = sanitizeFilename(file.name, selectedFormat) || 'default.pdf'; // Fallback to 'default.pdf' if sanitization fails
      const uniqueFilename = `${sanitizedEmail}_${timestamp}_${sanitizedFileName}`; // Combined unique filename

      // Select bucket and directory based on format
      const selectedBucket = selectedFormat === 'html' ? HTMLBucket : PDFBucket;
      const keyPrefix = selectedFormat === 'html' ? 'uploads/' : 'pdf/';


      const params = {
        Bucket: selectedBucket,
        Key: `${keyPrefix}${uniqueFilename}`,
        Body: file,
      };

      const command = new PutObjectCommand(params);
      await client.send(command);

      console.log('Upload complete, new file name:', uniqueFilename);

      // **6. Create job history record**
      let jobCreatedAt = null;
      if (JobHistoryAPI) {
        try {
          const jobRes = await fetch(JobHistoryAPI, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`
            },
            body: JSON.stringify({
              filename: file.name,
              format: selectedFormat || 'pdf',
              s3_bucket: selectedBucket,
              s3_upload_key: `${keyPrefix}${uniqueFilename}`,
              page_count: pageCount,
            }),
          });
          if (jobRes.ok) {
            const jobData = await jobRes.json();
            jobCreatedAt = jobData.created_at;
          }
        } catch (err) {
          console.error('Failed to create job record:', err);
        }
      }

      // **7. Notify Parent of Completion with format**
      onUploadComplete(uniqueFilename, sanitizedFileName, selectedFormat || 'pdf', selectedBucket, `${keyPrefix}${uniqueFilename}`, jobCreatedAt);

      // **7. Refresh Usage**
      if (onUsageRefresh) {
        onUsageRefresh();
      }

      // **8. Don't reset automatically - let parent component handle flow**
    } catch (error) {
      console.error('Error uploading file:', error);
      setErrorMessage('Error uploading file. Please try again.');
      setOpenSnackbar(true);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCloseSnackbar = (_, reason) => {
    if (reason === 'clickaway') return;
    setOpenSnackbar(false);
  };


  if (selectedFormat === 'pdf' || selectedFormat === 'html') {
    const formatTitle = selectedFormat === 'pdf' ? 'PDF to PDF' : 'PDF to HTML';
    const formatIcon = selectedFormat === 'pdf' ? imgFileText : imgCodeXml;

    if (selectedFile) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="upload-container-selected">
            <div className="upload-content">
              <div className="upload-header">
                <div className="file-icon">
                  <img src={formatIcon} alt="" />
                </div>
                <div className="upload-title">
                  <h2>{formatTitle}</h2>
                </div>
              </div>

              <div className="upload-progress">
                <div className="file-info">
                  <span className="file-name">{selectedFile.name} • {fileSizeMB > 0 ? fileSizeMB : (selectedFile?.size ? (() => {
                    const size = selectedFile.size / (1024 * 1024);
                    return size >= 0.1 ? size.toFixed(1) : size.toFixed(2);
                  })() : '0.0')} MB</span>
                  <span className="progress-percent">{isUploading ? 'Uploading...' : 'Ready'}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: isUploading ? '50%' : '100%' }}></div>
                </div>
              </div>

              {errorMessage && (
                <div className="upload-error">
                  <p>Upload failed: {errorMessage}</p>
                </div>
              )}

              <div className="upload-buttons">
                <button
                  className="change-file-btn"
                  onClick={() => {
                    setSelectedFile(null);
                    setErrorMessage('');
                    setIsUploading(false);
                  }}
                  disabled={isUploading}
                >
                  Choose New PDF
                </button>
              </div>
            </div>

            <div className="disclaimer">
              <p>This solution does not remediate for fillable forms and color selection/ contrast for people with color blindness</p>
            </div>
          </div>

          {/* Snackbar for error messages */}
          <Snackbar
            open={openSnackbar}
            autoHideDuration={6000}
            onClose={handleCloseSnackbar}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          >
            <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }} elevation={6} variant="filled">
              {errorMessage}
            </Alert>
          </Snackbar>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="upload-container-selected">
          <div className="upload-content">
            <div className="upload-header">
              <div className="file-icon">
                <img src={formatIcon} alt="" />
              </div>
              <div className="upload-title">
                <h2>{formatTitle}</h2>
              </div>
            </div>

            <div className="upload-instructions">
              <p className="upload-main-text">Drop your PDF here or click to browse</p>
              <p className="upload-sub-text">Maximum file size: {maxSizeAllowedMB}MB • Maximum pages: {maxPagesAllowed}</p>
            </div>

            {errorMessage && (
              <div className="upload-error">
                <p>{errorMessage}</p>
              </div>
            )}

            <div className="upload-buttons">
              <button className="change-format-btn" onClick={() => setSelectedFormat(null)}>
                Change Output Format
              </button>
              <button className="upload-btn" onClick={handleFileSelect} disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Upload PDF'}
              </button>
            </div>
          </div>

          <div className="disclaimer">
            <p>This solution does not remediate for fillable forms and color selection/ contrast for people with color blindness</p>
          </div>
        </div>

        {/* Snackbar for error messages */}
        <Snackbar
          open={openSnackbar}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }} elevation={6} variant="filled">
            {errorMessage}
          </Alert>
        </Snackbar>
      </motion.div>
    );
  }

  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="upload-container">
        <div className="upload-content">
          <div className="upload-header">
            <div className="file-icon">
              <img src={imgFileQuestion} alt="" />
            </div>
            <div className="upload-title">
              <h2>Choose Output Format</h2>
            </div>
          </div>

          <div className="format-options">
            <div
              className={`format-option ${selectedFormat === 'pdf' ? 'selected' : ''}`}
              onClick={() => handleFormatSelect('pdf')}
            >
              <div className="format-header">
                <div className="format-icon">
                  <img src={imgFileText} alt="" />
                </div>
                <div className="format-info">
                  <span className="format-name">PDF to PDF</span>
                  <span className={`format-status ${formatAvailability.pdf ? 'available' : 'unavailable'}`}>
                    {formatAvailability.pdf ? '✓ Available' : '⚠ Install Required'}
                  </span>
                </div>
              </div>
              <p className="format-description">
                Improve accessibility and maintain document structure
              </p>
            </div>

            <div
              className={`format-option ${selectedFormat === 'html' ? 'selected' : ''}`}
              onClick={() => handleFormatSelect('html')}
            >
              <div className="format-header">
                <div className="format-icon">
                  <img src={imgCodeXml} alt="" />
                </div>
                <div className="format-info">
                  <span className="format-name">PDF to HTML</span>
                  <span className={`format-status ${formatAvailability.html ? 'available' : 'unavailable'}`}>
                    {formatAvailability.html ? '✓ Available' : '⚠ Install Required'}
                  </span>
                </div>
              </div>
              <p className="format-description">
                Convert document to accessible HTML version
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Snackbar for error messages */}
      <Snackbar
        open={openSnackbar}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }} elevation={6} variant="filled">
          {errorMessage}
        </Alert>
      </Snackbar>
    </motion.div>
  );
}

export default UploadSection;
