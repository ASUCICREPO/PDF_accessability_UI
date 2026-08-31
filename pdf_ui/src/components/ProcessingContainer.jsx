import React, { useState, useEffect, useCallback } from 'react';
import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import ResultsContainer from './ResultsContainer';
import './ProcessingContainer.css';
import { PDFBucket, HTMLBucket, region } from '../utilities/constants';

const ProcessingContainer = ({
  originalFileName,
  updatedFilename,
  onFileReady,
  awsCredentials,
  selectedFormat,
  onNewUpload
}) => {
  const [downloadUrl, setDownloadUrl] = useState('');
  const [isFileReady, setIsFileReady] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  // Set when the backend reports a processing failure via result/FAILED_<name>.json.
  // When present, polling stops and a failure message (with reason) is shown instead
  // of leaving the user waiting until the polling timeout.
  const [failureInfo, setFailureInfo] = useState(null);

  const processingSteps = [
    { title: "Analyzing Document Structure", description: "Scanning PDF for accessibility issues" },
    { title: "Adding Accessibility Tags", description: "Implementing WCAG 2.1 compliance" },
    { title: "Adding Metadata", description: "Final accessibility enhancements" },
    { title: "Generating Accessible PDF", description: "Creating your accessible PDF document" }
  ];

  const generatePresignedUrl = useCallback(async (bucket, key, filename) => {
    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: awsCredentials?.accessKeyId,
        secretAccessKey: awsCredentials?.secretAccessKey,
        sessionToken: awsCredentials?.sessionToken,
      },
    });

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    });

    try {
      const url = await getSignedUrl(s3, command, { expiresIn: 30000 }); // 8.33 hours expiration
      return url;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw error;
    }
  }, [awsCredentials]);

  // Function to truncate the filename if it exceeds the threshold
  const truncateFilename = (filename) => {
    const FILENAME_THRESHOLD = 30;
    if (filename.length > FILENAME_THRESHOLD) {
      const extensionIndex = filename.lastIndexOf('.');
      const extension = filename.substring(extensionIndex);
      const truncatedName = filename.substring(0, FILENAME_THRESHOLD - extension.length) + '...';
      return truncatedName + extension;
    }
    return filename;
  };

  // Function to format elapsed time
  const formatElapsedTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let intervalId;
    let timeIntervalId;
    let stepIntervalId;
    let attemptCount = 0;

    const checkFileAvailability = async () => {
      // Maximum polling time: 30 minutes (120 attempts * 15 seconds = 30 minutes)
      const MAX_POLLING_ATTEMPTS = 120;

      try {
        // Increment polling attempts
        attemptCount += 1;
        setPollingAttempts(attemptCount);

        // Stop polling after maximum attempts and show a timeout message to the user.
        if (attemptCount >= MAX_POLLING_ATTEMPTS) {
          console.warn('⚠️ Maximum polling attempts reached. Stopping file check.');
          clearInterval(intervalId);
          clearInterval(timeIntervalId);
          clearInterval(stepIntervalId);
          setFailureInfo({
            summary: 'Processing timed out after 30 minutes. Please try uploading again or contact support if the issue persists.',
            reasonCategory: 'TIMEOUT',
            pages: '',
          });
          return;
        }

        // Select the correct bucket based on format (same logic as UploadSection)
        const selectedBucket = selectedFormat === 'html' ? HTMLBucket : PDFBucket;

        // Check if Bucket is available
        if (!selectedBucket) {
          console.error('❌ Bucket is not defined! Check environment variables.');
          clearInterval(intervalId);
          clearInterval(timeIntervalId);
          clearInterval(stepIntervalId);
          return;
        }

        // Check if AWS credentials are available
        if (!awsCredentials?.accessKeyId) {
          console.warn('⚠️ AWS credentials not available. Stopping polling.');
          clearInterval(intervalId);
          clearInterval(timeIntervalId);
          clearInterval(stepIntervalId);
          return;
        }

        const s3 = new S3Client({
          region,
          credentials: {
            accessKeyId: awsCredentials.accessKeyId,
            secretAccessKey: awsCredentials.secretAccessKey,
            sessionToken: awsCredentials.sessionToken,
          },
        });

        // Use different paths based on format - apply comprehensive sanitization for HTML only
        let objectKey;
        if (selectedFormat === 'html') {
          // Sanitize filename for HTML format to match Bedrock Data Automation constraints
          const sanitizeForS3 = (filename) => {
            let sanitized = filename;
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
            return sanitized;
          };
          objectKey = `remediated/final_${sanitizeForS3(updatedFilename.replace('.pdf', '.zip'))}`;
        } else {
          // PDF format uses original filename without extra sanitization
          objectKey = `result/COMPLIANT_${updatedFilename}`;
        }

        console.log(`🔍 Polling attempt ${pollingAttempts + 1}/${MAX_POLLING_ATTEMPTS} for object key:`, objectKey);

        // Before checking for success, check whether the backend reported a failure.
        // The PDF pipeline writes result/FAILED_<name>.json (name without extension)
        // on any failure. If present, stop polling and surface the reason to the user
        // instead of spinning until the polling timeout. (PDF format only; the HTML
        // pipeline does not emit this marker.)
        if (selectedFormat !== 'html') {
          const failedKey = `result/FAILED_${updatedFilename.replace(/\.pdf$/i, '')}.json`;
          try {
            const failedObject = await s3.send(
              new GetObjectCommand({
                Bucket: selectedBucket,
                Key: failedKey,
              })
            );
            const failedBody = await failedObject.Body.transformToString();
            let parsed = {};
            try {
              parsed = JSON.parse(failedBody);
            } catch (parseErr) {
              console.warn('Could not parse failure marker JSON:', parseErr);
            }

            console.error('❌ Backend reported a processing failure:', parsed);

            // Build a user-facing list of failed pages, if available.
            const pages = (parsed.failed_chunks || [])
              .filter(c => c.page_start && c.page_end)
              .map(c => `pages ${c.page_start}-${c.page_end}`)
              .join(', ');

            setFailureInfo({
              summary: parsed.summary || 'Processing failed. Please try again or contact support.',
              reasonCategory: parsed.reason_category || 'UNKNOWN',
              pages,
            });

            // Stop all polling/animation; a failure is terminal.
            clearInterval(intervalId);
            clearInterval(timeIntervalId);
            clearInterval(stepIntervalId);
            return;
          } catch (failedCheckErr) {
            // No failure marker yet (404) — this is the normal case; continue to
            // the success check below.
          }
        }

        // Check if the processed file exists
        await s3.send(
          new HeadObjectCommand({
            Bucket: selectedBucket,
            Key: objectKey,
          })
        );
        const desiredFilename = selectedFormat === 'html'
          ? `final_${originalFileName.replace('.pdf', '.zip')}`
          : `COMPLIANT_${originalFileName}`;

        const url = await generatePresignedUrl(selectedBucket, objectKey, desiredFilename);

        setDownloadUrl(url);
        setIsFileReady(true);
        setCurrentStep(processingSteps.length - 1); // Set to final step
        onFileReady(url);

        // Clear all intervals on success
        clearInterval(intervalId);
        clearInterval(timeIntervalId);
        clearInterval(stepIntervalId);

        console.log('✅ File processing completed successfully!');
      } catch (error) {
        // Log error for debugging but continue polling (file not ready yet)
        console.log(`⏳ File not ready yet (attempt ${pollingAttempts + 1}). Retrying in 15 seconds...`);

        // If this is the last attempt, show an error
        if (pollingAttempts + 1 >= MAX_POLLING_ATTEMPTS) {
          console.error('❌ File processing timed out after maximum attempts');
        }
      }
    };

    // Do not (re)start polling once the file is ready or a failure was reported.
    if (updatedFilename && !isFileReady && !failureInfo) {
      // Reset polling attempts for new file
      setPollingAttempts(0);

      // Start time tracking
      timeIntervalId = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);

      // Microanimation: cycling through steps with cumulative highlighting
      stepIntervalId = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % processingSteps.length);
      }, 1200);

      // File checking with maximum retry limit
      intervalId = setInterval(checkFileAvailability, 15000);
    }

    return () => {
      clearInterval(intervalId);
      clearInterval(timeIntervalId);
      clearInterval(stepIntervalId);
    };
  }, [updatedFilename, isFileReady, onFileReady, awsCredentials, originalFileName, selectedFormat, generatePresignedUrl, processingSteps.length, pollingAttempts, failureInfo]);


  return (
    <div className="processing-container">
      <div className="processing-content">
        <div className="processing-header">
          <div className="header-content">
            <h2>{isFileReady ? `File Ready: ${truncateFilename(originalFileName)}` : `Processing: ${truncateFilename(originalFileName)}`}</h2>
            <div className="flow-indicator">
              {selectedFormat === 'html' ? 'PDF → HTML' : 'PDF → PDF'}
            </div>
          </div>
        </div>

        <div className="processing-info">
          <div className="time-info">
            <span>⏱️ Time elapsed: {formatElapsedTime(elapsedTime)}</span>
          </div>
          <p className="processing-description">
            {failureInfo
              ? 'We were unable to remediate this document.'
              : isFileReady
                ? 'Remediation complete! Your file is ready for download.'
                : 'Remediation process typically takes a few minutes to complete depending on the document complexity'
            }
          </p>
        </div>

        {failureInfo ? (
          <div className="failure-section" role="alert">
            <div className="failure-icon">⚠️</div>
            <h3 className="failure-title">Remediation Failed</h3>
            <p className="failure-summary">{failureInfo.summary}</p>
            {failureInfo.pages && (
              <p className="failure-pages">Affected: {failureInfo.pages}</p>
            )}
            <p className="failure-reason">Reason code: {failureInfo.reasonCategory}</p>
            {onNewUpload && (
              <button className="failure-retry-btn" onClick={onNewUpload}>
                Try another document
              </button>
            )}
          </div>
        ) : !isFileReady ? (
          <div className="progress-section">
            <div className="steps-list">
              {processingSteps.map((step, index) => (
                <div key={index} className="step-item">
                  <div className={`step-number ${index <= currentStep ? 'active' : ''}`}>
                    {index + 1}
                  </div>
                  <div className="step-content">
                    <div className="step-title">{step.title}</div>
                    <div className="step-description">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <ResultsContainer
            fileName={originalFileName}
            processedResult={{ url: downloadUrl }}
            format={selectedFormat}
            fileSize="File processed successfully"
            processingTime="Processing completed"
          />
        )}

      </div>

    </div>
  );
};

export default ProcessingContainer;
