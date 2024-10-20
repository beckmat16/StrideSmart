import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import StravaAuthButton from './components/loginComponent';
import Dashboard from './components/Dashboard';

const API_URL = process.env.REACT_APP_API_URL;

if (!API_URL) {
  throw new Error('REACT_APP_API_URL is not defined in the environment');
}

const AppContent = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [activities, setActivities] = useState([]);
    const [athleteId, setAthleteId] = useState(null);
    const [error, setError] = useState(null);
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const success = params.get('success');
        const newAthleteId = params.get('athlete_id');
        
        if (success === 'true' && newAthleteId) {
            console.log("Authentication successful for athlete:", newAthleteId);
            setIsAuthenticated(true);
            setAthleteId(newAthleteId);
            fetchActivities(newAthleteId);
        } else {
            const storedAuthState = localStorage.getItem('isAuthenticated');
            const storedAthleteId = localStorage.getItem('athleteId');
            if (storedAuthState === 'true' && storedAthleteId) {
                console.log("Using stored authentication state");
                setIsAuthenticated(true);
                setAthleteId(storedAthleteId);
                fetchActivities(storedAthleteId);
            }
        }
    }, [location]);

    const fetchActivities = async (id) => {
        try {
            const response = await fetch(`${API_URL}/training?athlete_id=${id}`);
            if (response.ok) {
                const data = await response.json();
                setActivities(data);
            } else {
                throw new Error("Failed to fetch activities");
            }
        } catch (error) {
            console.error('Error fetching activities:', error);
            setError("Unable to load activities. Please try again later.");
            setIsAuthenticated(false);
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('athleteId');
        }
    };

    const handleAuthSuccess = (id) => {
        setIsAuthenticated(true);
        setAthleteId(id);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('athleteId', id);
        fetchActivities(id);
    };

    return (
        <div className="app-container">
            <h1 className="app-title">StrideSmart</h1>
            
            {error && <div className="error-message">{error}</div>}
            
            <Routes>
                <Route path="/" element={
                    !isAuthenticated ? (
                        <div className="auth-container">
                            <h2>Sync my Strava data!</h2>
                            <StravaAuthButton />
                        </div>
                    ) : (
                        <Navigate to="/dashboard" />
                    )
                } />
                <Route path="/dashboard" element={
                    isAuthenticated ? (
                        <Dashboard activities={activities} isAuthenticated={isAuthenticated} athleteId={athleteId} />
                    ) : (
                        <Navigate to="/" />
                    )
                } />
            </Routes>
        </div>
    );
}

const App = () => {
    return (
        <Router>
            <AppContent />
        </Router>
    );
}

export default App;
