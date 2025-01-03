// MainApp.js
import React, { useState, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';
import { Container, Box, Typography, Button } from '@mui/material';
import LoadingIndicator from './components/LoadingIndicator';
import { ThemeProvider } from '@mui/material/styles';
import Header from './components/Header';
import UploadSection from './components/UploadSection';
import DownloadSection from './components/DownloadSection';
import LeftNav from './components/LeftNav';
import ElapsedTimer from './components/ElapsedTimer';
import theme from './theme';
import AccessibilityChecker from './components/AccessibilityChecker';

import { Authority } from './utilities/constants';
import CustomCredentialsProvider from './utilities/CustomCredentialsProvider';

function MainApp({ isLoggingOut, setIsLoggingOut }) {
  const auth = useAuth();
  const navigate = useNavigate();

  // AWS & file states
  const [awsCredentials, setAwsCredentials] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedAt, setUploadedAt] = useState(null);
  const [isFileReady, setIsFileReady] = useState(false);

  // Control whether AccessibilityReport is open
  const [reportOpen, setReportOpen] = useState(false);

  // Fetch credentials once user is authenticated
  useEffect(() => {
    if (auth.isAuthenticated) {
      (async () => {
        try {
          const token = auth.user?.id_token;
          const domain = Authority;

          const customCredentialsProvider = new CustomCredentialsProvider();
          customCredentialsProvider.loadFederatedLogin({ domain, token });

          const { credentials: c, identityId } =
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
    if (auth.isLoading) {
      return; // Wait while loading
    }

    if (!auth.isAuthenticated && !isLoggingOut) {
      // If user is not authenticated and not actively logging out, redirect to home
      navigate('/home', { replace: true });
      return; // Exit early to prevent render
    }
  }, [auth.isLoading, auth.isAuthenticated, isLoggingOut, navigate]);

  // Handle events from child components
  const handleUploadComplete = (fileName) => {
    console.log('Upload completed, file name:', fileName);
    setUploadedFileName(fileName);
    setUploadedAt(Date.now());
    setIsFileReady(false);
  };

  const handleFileReady = () => {
    setIsFileReady(true);
  };

  const handleNewUpload = () => {
    setUploadedFileName('');
    setUploadedAt(null);
    setIsFileReady(false);
  };

  // const handleSignOut = async () => {
  //   try {
  //     await auth.removeUser();
  //     setIsLoggingOut(true);
  //     navigate('/logout');
  //   } catch (error) {
  //     console.error('Error during sign out:', error);
  //     setIsLoggingOut(false);
  //   }
  // };

  // Handle authentication loading and errors
  if (auth.isLoading) {
    return <LoadingIndicator message="Loading application..." />;
  }

  if (auth.error) {
    console.error('Authentication error in MainApp:', auth.error);
    return <LoadingIndicator message="Redirecting to login..." />;
  }

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <LeftNav />

        <Box sx={{ flexGrow: 1, padding: 3, backgroundColor: '#f4f6f8' }}>
          <Header />

          <Container maxWidth="lg" sx={{ marginTop: 4 }}>
            <Box
              sx={{
                textAlign: 'center',
                padding: 4,
                border: '1px dashed gray',
                borderRadius: '12px',
                marginBottom: 4,
                backgroundColor: '#fff',
                boxShadow: '0px 2px 10px rgba(0,0,0,0.1)',
              }}
            >
              <Typography variant="h5" gutterBottom>
                Remediate a PDF document
              </Typography>
              <Typography
                variant="body1"
                color="textSecondary"
                sx={{ marginBottom: 2 }}
              >
                Drag & drop your PDF file below, or click to select it.
              </Typography>

              <UploadSection
                onUploadComplete={handleUploadComplete}
                awsCredentials={awsCredentials}
              />

              {uploadedFileName && (
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleNewUpload}
                  sx={{ marginTop: 2 }}
                >
                  Upload a New PDF
                </Button>
              )}
            </Box>

            <Box
              sx={{
                textAlign: 'center',
                padding: 4,
                borderRadius: '12px',
                backgroundColor: '#fff',
                boxShadow: '0px 2px 10px rgba(0,0,0,0.1)',
                marginBottom: 4,
              }}
            >
              <ElapsedTimer uploadedAt={uploadedAt} isFileReady={isFileReady} />
            </Box>

            {uploadedFileName && (
              <Box
                sx={{
                  textAlign: 'center',
                  padding: 4,
                  borderRadius: '12px',
                  backgroundColor: '#fff',
                  boxShadow: '0px 2px 10px rgba(0,0,0,0.1)',
                  marginTop: 4,
                }}
              >
                <DownloadSection
                  filename={uploadedFileName}
                  onFileReady={handleFileReady}
                  awsCredentials={awsCredentials}
                />
                <AccessibilityChecker
                  open={reportOpen}
                  onClose={() => setReportOpen(false)}
                  filename={uploadedFileName}
                  awsCredentials={awsCredentials}
                />
              </Box>
            )}
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default MainApp;
