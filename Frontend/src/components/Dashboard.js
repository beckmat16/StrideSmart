import React, { useState, useEffect } from 'react';
import ActivityTable from './ActivityTable.js'; 
import Graphs from './Graphs.js';
import UnifiedAITrainingPlan from './UnifiedAITrainingPlan.js';
import { meters_to_miles, convert_mile_pace, formatDate } from './utils';

const Dashboard = ({ activities, isAuthenticated, athleteId, isSyncing }) => {
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        console.log('Dashboard received activities:', activities);
        console.log('Dashboard isAuthenticated:', isAuthenticated);
        console.log('Dashboard athleteId:', athleteId);
    }, [activities, isAuthenticated, athleteId]);

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
                    className={`tab-button ${activeTab === 'aiTraining' ? 'active' : ''}`}
                    onClick={() => setActiveTab('aiTraining')}
                >
                    AI Training Plan & Calendar
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'all' && (
                    <>
                        <h2>Activities {isSyncing ? '(syncing...)' : `(${activities?.length || 0})`}</h2>
                        <ActivityTable data={activities || []} />
                    </>
                )}
                {activeTab === 'charts' && (
                    <div className="charts-container">
                        <h2>Performance Charts</h2>
                        <Graphs activities={activities} />
                    </div>
                )}
                {activeTab === 'aiTraining' && (
                    <div className="ai-training-container">
                        <UnifiedAITrainingPlan athleteId={athleteId} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;