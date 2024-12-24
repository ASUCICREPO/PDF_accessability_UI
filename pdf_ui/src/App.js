import React, { useState, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { Container, Box, Typography } from '@mui/material';
import Header from './components/Header';
import UploadSection from './components/UploadSection';
import DownloadSection from './components/DownloadSection';
import LeftNav from './components/LeftNav';
import ElapsedTimer from './components/ElapsedTimer';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';

// 1) Import the CustomCredentialsProvider
import CustomCredentialsProvider from './utilities/CustomCredentialsProvider';

function App() {
  const auth = useAuth();

  // Store AWS credentials & upload states
  const [awsCredentials, setAwsCredentials] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedAt, setUploadedAt] = useState(null);
  const [isFileReady, setIsFileReady] = useState(false);

  // 2) Fetch credentials once user is authenticated
  useEffect(() => {
    if (auth.isAuthenticated) {
      (async () => {
        try {
          // For OIDC, 'auth.user' typically has id_token, access_token, etc.
          const token = auth.user?.id_token; 
          // Construct the domain for your Cognito user pool 
          const domain = 'cognito-idp.us-east-1.amazonaws.com/us-east-1_3uP3RsAjc';
          
          const customCredentialsProvider = new CustomCredentialsProvider();
          customCredentialsProvider.loadFederatedLogin({ domain, token });

          // Extract the nested credentials object
          const { credentials: c, identityId } =
            await customCredentialsProvider.getCredentialsAndIdentityId();

          setAwsCredentials({
            accessKeyId: c.accessKeyId,
            secretAccessKey: c.secretAccessKey,
            sessionToken: c.sessionToken,
          });

          // Debug logs
          console.log('[DEBUG] Access Key:', c.accessKeyId);
          console.log('[DEBUG] Secret Key:', c.secretAccessKey);
          console.log('[DEBUG] Session Token:', c.sessionToken);
          console.log('[DEBUG] Identity ID:', identityId);

        } catch (error) {
          console.error('Error fetching Cognito credentials:', error);
        }
      })();
    }
  }, [auth.isAuthenticated, auth.user]);

  // 3) Gating/conditional returns
  if (auth.isLoading) {
    return <div>Loading...</div>;
  }
  if (auth.error) {
    // If you want to specifically check if error.message includes 'No matching state found in storage'
    if (auth.error.message.includes('No matching state found')) {
      console.log('Detected invalid or mismatched OIDC state. Redirecting to login...');
      auth.removeUser().then(() => {
        auth.signinRedirect(); // Force re-auth
      });
      return null; // Avoid rendering the main app
    }
    // If it's some other error, you can display or handle it
    return <div>Encountered error: {auth.error.message}</div>;
  }
  if (!auth.isAuthenticated) {
    auth.signinRedirect();
    return null;
  }

  // Handle events from child components
  const handleUploadComplete = (fileName) => {
    console.log('Upload completed, file name:', fileName);
    setUploadedFileName(fileName);
    setUploadedAt(Date.now());
    setIsFileReady(false);
  };

  const handleFileReady = () => {
    // When the DownloadSection confirms file is ready
    setIsFileReady(true);
  };

  const signOutRedirect = () => {
    const clientId = '2r4vl1l7nmkn0u7bmne4c3tve5'; 
    const logoutUri = 'https://main.d3tdsepn39r5l1.amplifyapp.com';
    const cognitoDomain = 'https://pdf-ui-auth.auth.us-east-1.amazoncognito.com';
    
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`
    
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <LeftNav />

        <Box sx={{ flexGrow: 1, padding: 3, backgroundColor: '#f4f6f8' }}>
          <Header />

          <Container maxWidth="lg" sx={{ marginTop: 4 }}>
            {/* Upload Section */}
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
                Upload PDF
              </Typography>
              <Typography
                variant="body1"
                color="textSecondary"
                sx={{ marginBottom: 2 }}
              >
                Drag & drop your PDF file below, or click to select it.
              </Typography>

              {/* Pass down awsCredentials to our custom UploadSection */}
              <UploadSection
                onUploadComplete={handleUploadComplete}
                awsCredentials={awsCredentials}
              />
            </Box>

            {/* Elapsed Timer */}
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
              <ElapsedTimer
                uploadedAt={uploadedAt}
                isFileReady={isFileReady}
              />
            </Box>

            {/* Download Section */}
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
                {/* Pass awsCredentials here too if needed for the new approach */}
                <DownloadSection
                  filename={uploadedFileName}
                  onFileReady={handleFileReady}
                  awsCredentials={awsCredentials}
                />
              </Box>
            )}

            {/* Sign Out Buttons */}
            <Box sx={{ marginTop: 4, textAlign: 'center' }}>
              <button onClick={() => auth.removeUser()

              }>Sign Out (Local)</button>
              &nbsp;&nbsp;
              <button onClick={signOutRedirect}>Sign Out (Redirect)</button>
              <button onClick={() => auth.signoutRedirect()}>Sign Out (2)</button>
            </Box>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
