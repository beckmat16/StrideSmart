// src/loginComponent.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Determine the API URL based on the environment
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

console.log('Current API_URL:', API_URL); // Debug log

const StravaAuthButton = ({ onAuthSuccess }) => {
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      console.log("Auth callback triggered. Code:", code); // Debug log

      if (code) {
        try {
          const response = await fetch(`${API_URL}/exchange_token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code }),
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log("Token exchange successful. Data:", data); // Debug log
            localStorage.setItem('access_token', data.access_token);
            window.history.replaceState({}, document.title, window.location.pathname);
            onAuthSuccess(data.access_token);
            navigate('/dashboard');
          } else {
            const errorData = await response.json();
            setError(errorData.message || 'Failed to exchange token');
          }
        } catch (error) {
          console.error("Error during token exchange:", error); // Debug log
          setError('Error during token exchange: ' + error.message);
        }
      }
    };

    handleAuthCallback();
  }, [onAuthSuccess, navigate]);

  const handleAuth = () => {
    const loginUrl = `${API_URL.replace(/\/$/, '')}/login`;
    console.log('Redirecting to:', loginUrl); // Debug log
    window.location.href = loginUrl;
  };

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <button className="strava-button" onClick={handleAuth}>
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.846 15.1h4.172" />
      </svg>
      Connect with Strava
    </button>
  );
};

export default StravaAuthButton;
