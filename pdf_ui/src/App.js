// App.jsx
import React, { useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { AuthProvider, useAuth } from 'react-oidc-context';

import theme from './theme';
import { UserPoolClientId, HostedUIUrl, Authority } from './utilities/constants';

import LandingPage from './pages/LandingPage';
import LogoutPage from './components/LogoutPage';
import MainApp from './MainApp';
import CallbackPage from './pages/CallbackPage';
import LoadingIndicator from './components/LoadingIndicator';
import { Box, Typography, Button } from '@mui/material';

// Use memory storage in development for easier testing
const storage = process.env.NODE_ENV === 'development' ? 
  {
    set: (key, value) => window.sessionStorage.setItem(key, value),
    get: (key) => window.sessionStorage.getItem(key),
    remove: (key) => window.sessionStorage.removeItem(key),
  } :
  {
    set: (key, value) => sessionStorage.setItem(key, value),
    get: (key) => sessionStorage.getItem(key),
    remove: (key) => sessionStorage.removeItem(key),
  };

const cognitoAuthConfig = {
  stateStore: {
    set: (key, value) => sessionStorage.setItem(key, value),
    get: (key) => sessionStorage.getItem(key),
    remove: (key) => sessionStorage.removeItem(key),
  },
  authority: `https://${Authority}`,
  client_id: UserPoolClientId,
  redirect_uri: `${HostedUIUrl}/app/callback`, // Updated redirect_uri
  post_logout_redirect_uri: `${HostedUIUrl}/home`,
  response_type: 'code',
  scope: 'email openid phone profile',
};

function AppRoutes() {
  const auth = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Handle initial loading state
  if (auth.isLoading) {
    return <LoadingIndicator message="Loading authentication status..." />;
  }

  // Handle authentication errors
  if (auth.error) {
    // Ignore harmless state errors that might occur during normal auth flow
    if (auth.error.message.includes('No matching state found')) {
      console.log('State mismatch detected, clearing session...');
      sessionStorage.clear();
      window.location.href = '/home';
      return <LoadingIndicator message="Redirecting..." />;
    }

    console.error('Authentication error:', auth.error);
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        gap={2}
      >
        <Typography variant="h5" color="error">
          Authentication Error
        </Typography>
        <Typography variant="body1" color="textSecondary">
          {auth.error.message}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            sessionStorage.clear();
            window.location.href = '/home';
          }}
        >
          Return to Home
        </Button>
      </Box>
    );
  }

  return (
    <Routes>
      {/* Landing / Public Routes */}
      <Route path="/home" element={<LandingPage />} />

      {/* Callback Route */}
      <Route path="/app/callback" element={<CallbackPage />} />

      {/* Logout Route */}
      <Route
        path="/logout"
        element={<LogoutPage setIsLoggingOut={setIsLoggingOut} />}
      />

      {/* Protected App Routes */}
      <Route
        path="/app/*"
        element={
          auth.isAuthenticated ? (
            <MainApp
              isLoggingOut={isLoggingOut}
              setIsLoggingOut={setIsLoggingOut}
            />
          ) : (
            <Navigate to="/home" replace />
          )
        }
      />

      {/* Fallback: redirect unknown paths to /home */}
      {/* Root path redirect */}
      <Route path="/" element={<Navigate to="/home" replace />} />
      {/* Catch all unknown routes */}
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider {...cognitoAuthConfig}>
      <ThemeProvider theme={theme}>
        <Router>
          <AppRoutes />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
