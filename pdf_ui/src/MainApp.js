// src/MainApp.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';
import { Container, Box, Tabs, Tab } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import Header from './components/Header';
import UploadSection from './components/UploadSection';
import ProcessingContainer from './components/ProcessingContainer';
import ResultsContainer from './components/ResultsContainer';
import JobHistory from './components/JobHistory';
import LeftNav from './components/LeftNav';
import theme from './theme';
import FirstSignInDialog from './components/FirstSignInDialog';
import HeroSection from './components/HeroSection';
import InformationBlurb from './components/InformationBlurb';

import { Authority, CheckAndIncrementQuota } from './utilities/constants';
import CustomCredentialsProvider from './utilities/CustomCredentialsProvider';
import DeploymentPopup from './components/DeploymentPopup';

function MainApp({ isLoggingOut, setIsLoggingOut }) {
  const auth = useAuth();
  const navigate = useNavigate();

  // AWS & file states
  const [awsCredentials, setAwsCredentials] = useState(null);
  const [currentPage, setCurrentPage] = useState('upload');
  const [activeTab, setActiveTab] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [processedResult, setProcessedResult] = useState(null);
  const [processingStartTime, setProcessingStartTime] = useState(null);
 

  // Centralized Usage State
  const [usageCount, setUsageCount] = useState(0);
  const [pdf2pdfCount, setPdf2pdfCount] = useState(0);
  const [pdf2htmlCount, setPdf2htmlCount] = useState(0);
  const [maxFilesAllowed, setMaxFilesAllowed] = useState(3); // Default value
  const [maxPagesAllowed, setMaxPagesAllowed] = useState(10); // Default value
  const [maxSizeAllowedMB, setMaxSizeAllowedMB] = useState(25); // Default value
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [usageError, setUsageError] = useState('');

  // Deployment validation state
  const [showDeploymentPopup, setShowDeploymentPopup] = useState(false);
  const [bucketValidation, setBucketValidation] = useState(null);

  // Left navigation state
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);


  // Fetch credentials once user is authenticated
  useEffect(() => {
    if (auth.isAuthenticated) {
      (async () => {
        try {
          const token = auth.user?.id_token;
          const domain = Authority;

          const customCredentialsProvider = new CustomCredentialsProvider();
          customCredentialsProvider.loadFederatedLogin({ domain, token });

          const { credentials: c } =
            await customCredentialsProvider.getCredentialsAndIdentityId();

          setAwsCredentials({
            accessKeyId: c.accessKeyId,
            secretAccessKey: c.secretAccessKey,
            sessionToken: c.sessionToken,
          });
        } catch (error) {
          console.error('Error fetching Cognito credentials:', error);
        }
      })();
    }
  }, [auth.isAuthenticated, auth.user]);

  // Monitor authentication status within MainApp
  useEffect(() => {
    if (!auth.isAuthenticated && !isLoggingOut) {
      // If user is not authenticated, redirect to /home
      navigate('/home', { replace: true });
    }
  }, [auth.isAuthenticated, isLoggingOut, navigate]);

  // FUNCTION: Fetch current usage from the backend (mode="check")
  const refreshUsage = useCallback(async () => {
    if (!auth.isAuthenticated) return; // not logged in yet
    setLoadingUsage(true);
    setUsageError('');

    const userSub = auth.user?.profile?.sub;
    if (!userSub) {
      setUsageError('User identifier not found.');
      setLoadingUsage(false);
      return;
    }

    try {
      const res = await fetch(CheckAndIncrementQuota, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.user?.id_token}`
        },
        body: JSON.stringify({ sub: userSub, mode: 'check' }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setUsageError(errData.message || 'Error fetching usage');
        setLoadingUsage(false);
        return;
      }

      const data = await res.json();
      setUsageCount(data.currentUsage ?? 0);
      setPdf2pdfCount(data.pdf2pdfCount ?? 0);
      setPdf2htmlCount(data.pdf2htmlCount ?? 0);
      setMaxFilesAllowed(data.maxFilesAllowed ?? 3);
      setMaxPagesAllowed(data.maxPagesAllowed ?? 10);
      setMaxSizeAllowedMB(data.maxSizeAllowedMB ?? 25);

    } catch (err) {
      setUsageError(`Failed to fetch usage: ${err.message}`);
    } finally {
      setLoadingUsage(false);
    }
  }, [auth.isAuthenticated, auth.user]);

  // FUNCTION: Initialize limits from ID token
  const initializeLimitsFromProfile = useCallback(() => {
    if (auth.isAuthenticated && auth.user?.profile) {
      const profile = auth.user.profile;

      const customMaxFiles = profile['custom:max_files_allowed'];
      const customMaxPages = profile['custom:max_pages_allowed'];
      const customMaxSizeMB = profile['custom:max_size_allowed_MB'];
      // console.log('Custom limits:', customMaxFiles, customMaxPages, customMaxSizeMB);
      if (customMaxFiles) setMaxFilesAllowed(parseInt(customMaxFiles, 10));
      if (customMaxPages) setMaxPagesAllowed(parseInt(customMaxPages, 10));
      if (customMaxSizeMB) setMaxSizeAllowedMB(parseInt(customMaxSizeMB, 10));
    }
  }, [auth.isAuthenticated, auth.user]);

  // Call refreshUsage whenever the user becomes authenticated
  useEffect(() => {
    if (auth.isAuthenticated) {
      initializeLimitsFromProfile();
      refreshUsage();
    }
  }, [auth.isAuthenticated, initializeLimitsFromProfile, refreshUsage]);

  // Bucket validation is now only checked when users select format options

  // Handler for showing deployment popup from child components
  const handleShowDeploymentPopup = (validation) => {
    setBucketValidation(validation);
    setShowDeploymentPopup(true);
  };

  // Handle events from child components
  const handleUploadComplete = (updated_filename, original_fileName, format = 'pdf', s3Bucket = null, s3UploadKey = null, jobCreatedAt = null) => {
    console.log('Upload completed, new file name:', updated_filename);

    const fileData = {
      name: original_fileName,
      updatedName: updated_filename,
      format: format,
      size: 0,
      s3Bucket: s3Bucket,
      s3UploadKey: s3UploadKey,
      jobCreatedAt: jobCreatedAt,
    };

    setUploadedFile(fileData);
    setProcessingStartTime(Date.now()); // Track when processing starts
    setCurrentPage('processing');

    // After a successful upload (and increment usage),
    // refresh usage so the new count shows up
    refreshUsage();
  };

  const handleProcessingComplete = (result) => {
    // Calculate processing time
    const processingTime = processingStartTime
      ? Math.round((Date.now() - processingStartTime) / 1000) // Convert to seconds
      : null;

    setProcessedResult({ ...result, processingTime });
    setCurrentPage('results');
  };

  const handleNewUpload = () => {
    setCurrentPage('upload');
    setUploadedFile(null);
    setProcessedResult(null);
    setProcessingStartTime(null);
  };

  // Handle authentication loading and errors
  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    // Example: handle "No matching state found" error
    if (auth.error.message.includes('No matching state found')) {
      console.log('Detected invalid or mismatched OIDC state. Redirecting to login...');
      auth.removeUser().then(() => {
        auth.signinRedirect();
      });
      return null;
    }
    return <div>Encountered error: {auth.error.message}</div>;
  }

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', backgroundColor: '#f4f6f8' }}>
        <LeftNav 
          isCollapsed={isNavCollapsed} 
          setIsCollapsed={setIsNavCollapsed}
          mobileOpen={mobileNavOpen}
          setMobileOpen={setMobileNavOpen}
        />

        <Box sx={{ 
          padding: { xs: 2, sm: 3 }, 
          paddingLeft: { xs: 2, md: isNavCollapsed ? '90px' : '390px' }, 
          transition: 'padding-left 0.3s ease',
          minHeight: '100vh'
        }}>
          <Header
            handleSignOut={() => auth.removeUser()}
            usageCount={usageCount}
            refreshUsage={refreshUsage}
            usageError={usageError}
            loadingUsage={loadingUsage}
            maxFilesAllowed={maxFilesAllowed}
            onMenuClick={() => setMobileNavOpen(true)}
          />

          <FirstSignInDialog />

          {/* Deployment popup for bucket configuration - only shown when triggered */}
          {showDeploymentPopup && bucketValidation && (
            <DeploymentPopup
              open={showDeploymentPopup}
              onClose={() => setShowDeploymentPopup(false)}
              validation={bucketValidation}
            />
          )}

          <HeroSection />

          <Container maxWidth="lg" sx={{ marginTop: 0, padding: { xs: 0, sm: 1 } }}>

            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="New Remediation" />
              <Tab label="My Documents" />
            </Tabs>

            {activeTab === 0 && (
              <>
                {currentPage === 'upload' && (
                  <UploadSection
                    onUploadComplete={handleUploadComplete}
                    awsCredentials={awsCredentials}
                    currentUsage={usageCount}
                    maxFilesAllowed={maxFilesAllowed}
                    maxPagesAllowed={maxPagesAllowed}
                    maxSizeAllowedMB={maxSizeAllowedMB}
                    onUsageRefresh={refreshUsage}
                    setUsageCount={setUsageCount}
                    isFileUploaded={!!uploadedFile}
                    onShowDeploymentPopup={handleShowDeploymentPopup}
                  />
                )}

                {currentPage === 'processing' && uploadedFile && (
                  <ProcessingContainer
                    originalFileName={uploadedFile.name}
                    updatedFilename={uploadedFile.updatedName}
                    onFileReady={(downloadUrl) => handleProcessingComplete({ url: downloadUrl })}
                    awsCredentials={awsCredentials}
                    selectedFormat={uploadedFile.format}
                    onNewUpload={handleNewUpload}
                    jobCreatedAt={uploadedFile.jobCreatedAt}
                    s3Bucket={uploadedFile.s3Bucket}
                  />
                )}

                {currentPage === 'processing' && !uploadedFile && (
                  <div style={{ padding: '40px', textAlign: 'center' }}>
                    <p>Loading processing page...</p>
                  </div>
                )}

                {currentPage === 'results' && (
                  <ResultsContainer
                    fileName={uploadedFile?.name}
                    processedResult={processedResult}
                    format={uploadedFile?.format}
                    processingTime={processedResult?.processingTime}
                    originalFileName={uploadedFile?.name}
                    updatedFilename={uploadedFile?.updatedName}
                    awsCredentials={awsCredentials}
                    onNewUpload={handleNewUpload}
                  />
                )}
              </>
            )}

            {activeTab === 1 && (
              <JobHistory awsCredentials={awsCredentials} />
            )}


          </Container>

          <Box sx={{ marginTop: 8 }}>
            <InformationBlurb />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default MainApp;
