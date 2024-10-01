// src/App.js
// src/App.js
import React, { useEffect, useState } from 'react';
import './App.css'

const App = () => {
    const [activities, setActivities] = useState([]);
    const [activeTab, setActiveTab] = useState('default'); 

    useEffect(() => {
        // Fetch data from FastAPI backend
        const fetchActivities = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/training'); // Update this endpoint as necessary
                const data = await response.json();
                const sortedActivities = data.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
                setActivities(data);
            } catch (error) {
                console.error("Error fetching activities:", error);
            }
        };

        fetchActivities();
    }, []);
    
    // Function to convert meters to miles
    const meters_to_miles= (meters) => (meters/1609.34).toFixed(2);

    // Function to create per mile pace
    const convert_mile_pace = (moving_time, distance) => {
        const miles = distance / 1609.34;
        const mile_pace_seconds = moving_time/miles;
        
        const minutes = Math.floor(mile_pace_seconds / 60);
        const seconds = Math.floor(mile_pace_seconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')} `;
    };

    // Trim Date
    const formatDate = (isoString) => {
        const date = new Date(isoString);
        const month = String(date.getMonth() + 1).padStart(2, '0'); 
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    };    

    return (
        <div className="app-container">
            <h1>StrideSmart</h1>
            <div>
                {/* Tabs */}
                <button onClick={() => setActiveTab('all')}>Activities</button>
                <button onClick={() => setActiveTab('graphs')}>Performance Tracking</button>
                <button onClick={() => setActiveTab('trainingPlan')}>AI Training Plan</button>
            </div>
            {/* Tab Content */}
            {activeTab === 'Default' && (
                <div>
                    <h2>Welcome! Click any tab to get started</h2>
                    {/* Placeholder for future graph components */}
                </div>
            )}
            {activeTab === 'all' && (
                <div className="tab-content">
                    <h2>Activities</h2>
                    <ul>
                        {activities.map(activity => (
                            <li key={activity.id}>
                                <h2>{formatDate(activity.start_date_local)}</h2>
                                <p>Distance: {meters_to_miles(activity.distance)} miles</p>
                                <p>Pace: {convert_mile_pace(activity.moving_time,activity.distance)} per mile</p>
                                <p>Time: {activity.moving_time} seconds</p>
                                <p>Date: {new Date(activity.start_date).toLocaleString()}</p>
                            </li>
                        ))}
                 </ul>
                </div>
            )}
            {activeTab === 'graphs' && (
                <div>
                    <h2>Performance Tracking</h2>
                    {/* Placeholder for future graph components */}
                </div>
            )}
            {activeTab === 'trainingPlan' && (
                <div>
                    <h2>AI Training Plan</h2>
                    {/* Placeholder for AI training plan component */}
                </div>
            )}
        </div>
    );
}

export default App;



