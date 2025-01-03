// LandingPage.jsx
import React, { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.isLoading) return; // Do nothing while loading

    if (auth.isAuthenticated) {
      // If user is authenticated, redirect to /app
      navigate('/app', { replace: true });
    }
  }, [auth.isAuthenticated, auth.isLoading, navigate]);

  const signOutRedirect = () => {
    const clientId = "1k5187g7kmc08ahoms38pr4rm1";
    const logoutUri = "https://main.d25gib1ddei1ii.amplifyapp.com/home";
    const cognitoDomain = "https://pdf-ui-auth.auth.us-east-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  const handleSignIn = () => {
    // This will redirect to the Cognito Hosted UI for login
    auth.signinRedirect();
  };

  // While checking authentication, you might want to show a loading indicator
  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h1>Welcome to My PDF Accessibility App</h1>
      <p>Please sign in to continue.</p>
      <button onClick={handleSignIn}>Sign In</button>
      <button onClick={() => signOutRedirect()}>Sign Out</button>
    </div>
  );
}

export default LandingPage;
