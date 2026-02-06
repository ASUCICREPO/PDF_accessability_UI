import React, { useState, useEffect, useCallback } from 'react';
import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import ResultsContainer from './ResultsContainer';
import './ProcessingContainer.css';
import { PDFBucket, HTMLBucket, region, JobHistoryAPI } from '../utilities/constants';
import { useAuth } from 'react-oidc-context';

const ProcessingContainer = ({
  originalFileName,
  updatedFilename,
  onFileReady,
  awsCredentials,
  selectedFormat,
  onNewUpload,
  jobCreatedAt,
  s3Bucket,
}) => {
  const auth = useAuth();
  const [downloadUrl, setDownloadUrl] = useState('');
  const [isFileReady, setIsFileReady] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pollingAttempts, setPollingAttempts] = useState(0);

  const updateJobStatus = useCallback(async (status, resultKey) => {
    if (!JobHistoryAPI || !jobCreatedAt) return;
    try {
      await fetch(JobHistoryAPI, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.user?.id_token}`,
        },
        body: JSON.stringify({
          created_at: jobCreatedAt,
          status,
          ...(resultKey && { s3_result_key: resultKey }),
        }),
      });
    } catch (err) {
      console.error('Failed to update job status:', err);
    }
  }, [jobCreatedAt, auth.user?.id_token]);

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

    const checkFileAvailability = async () => {
      // Maximum polling time: 30 minutes (120 attempts * 15 seconds = 30 minutes)
      const MAX_POLLING_ATTEMPTS = 120;

      try {
        // Increment polling attempts
        setPollingAttempts(prev => {
          const newAttempts = prev + 1;

          // Stop polling after maximum attempts
          if (newAttempts >= MAX_POLLING_ATTEMPTS) {
            console.warn('⚠️ Maximum polling attempts reached. Stopping file check.');
            clearInterval(intervalId);
            clearInterval(timeIntervalId);
            clearInterval(stepIntervalId);
            return newAttempts;
          }

          return newAttempts;
        });

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
        updateJobStatus('complete', objectKey);

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
          updateJobStatus('failed');
        }
      }
    };

    if (updatedFilename && !isFileReady) {
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
  }, [updatedFilename, isFileReady, onFileReady, awsCredentials, originalFileName, selectedFormat, generatePresignedUrl, processingSteps.length, pollingAttempts, updateJobStatus]);


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
            {isFileReady
              ? 'Remediation complete! Your file is ready for download.'
              : 'Remediation process typically takes a few minutes to complete depending on the document complexity'
            }
          </p>
        </div>

        {!isFileReady ? (
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
