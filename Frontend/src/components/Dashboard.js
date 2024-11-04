import React, { useState, useEffect } from 'react';
import ActivityTable from './ActivityTable.js'; 
import Graphs from './Graphs.js';
import AITrainingPlan from './AITrainingPlan.js';
import { meters_to_miles, convert_mile_pace, formatDate } from './utils';

const Dashboard = ({ activities, isAuthenticated }) => {
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        console.log('Dashboard received activities:', activities);
        console.log('Dashboard isAuthenticated:', isAuthenticated);
    }, [activities, isAuthenticated]);

    if (!isAuthenticated) {
        return <div>Please authenticate to view the dashboard.</div>;
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
                    className={`tab-button ${activeTab === 'charts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('charts')}
                >
                    Performance Charts
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
                        <ActivityTable data={activities || []} />
                    </>
                )}
                {activeTab === 'charts' && (
                    <div className="charts-container">
                        <h2>Performance Charts</h2>
                        <Graphs activities={activities} />
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
