import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import StravaAuthButton from './components/loginComponent';
import Dashboard from './components/Dashboard';

const AppContent = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [activities, setActivities] = useState([]);
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const success = params.get('success');
        const athleteId = params.get('athlete_id');
        
        if (success === 'true' && athleteId) {
            console.log("Authentication successful for athlete:", athleteId);
            setIsAuthenticated(true);
            fetchActivities();
        } else {
            const storedAuthState = localStorage.getItem('isAuthenticated');
            if (storedAuthState === 'true') {
                console.log("Using stored authentication state");
                setIsAuthenticated(true);
                fetchActivities();
            }
        }
    }, [location]);

    const fetchActivities = async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/training');
            if (response.ok) {
                const data = await response.json();
                setActivities(data);
            } else {
                console.error("Failed to fetch activities");
                setIsAuthenticated(false);
                localStorage.removeItem('isAuthenticated');
            }
        } catch (error) {
            console.error('Error fetching activities:', error);
            setIsAuthenticated(false);
            localStorage.removeItem('isAuthenticated');
        }
    };

    const handleAuthSuccess = () => {
        setIsAuthenticated(true);
        localStorage.setItem('isAuthenticated', 'true');
        fetchActivities();
    };

    return (
        <div className="app-container">
            <h1 className="app-title">StrideSmart</h1>
            
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
                        <Dashboard activities={activities} isAuthenticated={isAuthenticated} />
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
