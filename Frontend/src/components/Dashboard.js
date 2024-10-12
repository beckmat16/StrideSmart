import React, { useState, useEffect } from 'react';
import ActivityTable from './ActivityTable.js'; // Assuming you have this component
import Graphs from './Graphs.js';
import AITrainingPlan from './AITrainingPlan.js'; // Placeholder for your future AI plan
import { meters_to_miles, convert_mile_pace, formatDate } from './utils';

const Dashboard = ({ activities, isAuthenticated }) => {
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        if (isAuthenticated) {
            setActiveTab('all');
        }
    }, [isAuthenticated]);

    if (!isAuthenticated) {
        return null; // Or you could render a loading spinner here
    }

    return (
        <div className="dashboard-container">
            <div className="tab-container">
                <button 
                    className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                >
                    Activities
                </button>
                <button 
                    className={`tab-button ${activeTab === 'graphs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('graphs')}
                >
                    Performance Tracking
                </button>
                <button 
                    className={`tab-button ${activeTab === 'trainingPlan' ? 'active' : ''}`}
                    onClick={() => setActiveTab('trainingPlan')}
                >
                    AI Training Plan
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'all' && (
                    <>
                        <h2>Activities</h2>
                        <ActivityTable data={activities} />
                    </>
                )}
                {activeTab === 'graphs' && (
                    <div className="graphs-container">
                        <h2>Performance Tracking</h2>
                        <Graphs />
                    </div>
                )}
                {activeTab === 'trainingPlan' && (
                    <div className="training-plan-container">
                        <h2>AI Training Plan</h2>
                        <AITrainingPlan />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
