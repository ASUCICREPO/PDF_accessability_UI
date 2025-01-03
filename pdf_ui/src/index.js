// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/root';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Clear any stale auth state on fresh load
if (window.performance && window.performance.navigation.type === window.performance.navigation.TYPE_RELOAD) {
  sessionStorage.clear();
}

// Handle browser back/forward navigation
window.addEventListener('popstate', () => {
  if (!sessionStorage.getItem('oidc.user:https://' + window.location.host + ':auth')) {
    sessionStorage.clear();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App />
);

reportWebVitals();
