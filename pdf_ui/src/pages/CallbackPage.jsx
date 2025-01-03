// src/pages/CallbackPage.jsx
import React, { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';
import LoadingIndicator from '../components/LoadingIndicator';

function CallbackPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.isLoading) {
      return; // Wait while loading
    }
    
    if (auth.isAuthenticated) {
      // After successful authentication, navigate to /app
      navigate('/app', { replace: true });
    } else if (auth.error) {
      console.error('Authentication error:', auth.error);
      navigate('/home', { replace: true });
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.error, navigate]);

  return <LoadingIndicator message="Processing authentication..." />;
}

export default CallbackPage;
