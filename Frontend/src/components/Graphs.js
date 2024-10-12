// Graph.js
import React from 'react';
import { Line, Bar, Pie, Scatter } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { meters_to_miles, formatDate } from './utils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

const Graphs = (props) => {
    if (!props || typeof props !== 'object') {
        return <div>Error: Invalid props passed to Graphs component</div>;
    }

    const { activities } = props;

    console.log('Activities in Graphs:', activities);

    if (activities === undefined) {
        return <div>Error: Activities is undefined</div>;
    }

    if (activities === null) {
        return <div>Error: Activities is null</div>;
    }

    if (!Array.isArray(activities)) {
        return <div>Error: Activities is not an array. Type: {typeof activities}</div>;
    }

    if (activities.length === 0) {
        return <div>No activities found</div>;
    }

    // If we've made it this far, we should have a valid activities array
    console.log('Number of activities:', activities.length);
    console.log('First activity:', activities[0]);

    const sortedActivities = [...activities].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    const lineChartData = {
        labels: sortedActivities.map(a => formatDate(a.start_date)),
        datasets: [{
            label: 'Distance Over Time (miles)',
            data: sortedActivities.map(a => meters_to_miles(a.distance)),
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
        }]
    };

    const activityTypes = [...new Set(activities.map(a => a.type))];
    const barChartData = {
        labels: activityTypes,
        datasets: [{
            label: 'Activity Type Distribution',
            data: activityTypes.map(type => activities.filter(a => a.type === type).length),
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
        }]
    };

    const pieChartData = {
        labels: ['Easy', 'Moderate', 'Hard'],
        datasets: [{
            label: 'Effort Distribution',
            data: [
                activities.filter(a => a.average_heartrate < 140).length,
                activities.filter(a => a.average_heartrate >= 140 && a.average_heartrate < 170).length,
                activities.filter(a => a.average_heartrate >= 170).length,
            ],
            backgroundColor: [
                'rgba(255, 99, 132, 0.5)',
                'rgba(54, 162, 235, 0.5)',
                'rgba(255, 206, 86, 0.5)',
            ],
        }]
    };

    const scatterChartData = {
        datasets: [{
            label: 'Distance (miles) vs. Elevation Gain (m)',
            data: activities.map(a => ({
                x: meters_to_miles(a.distance),
                y: a.total_elevation_gain
            })),
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
        }]
    };

    return (
        <div className="graphs-container">
            <div className="chart">
                <h3>Distance Over Time</h3>
                <Line data={lineChartData} />
            </div>
            <div className="chart">
                <h3>Activity Type Distribution</h3>
                <Bar data={barChartData} />
            </div>
            <div className="chart">
                <h3>Effort Distribution</h3>
                <Pie data={pieChartData} />
            </div>
            <div className="chart">
                <h3>Distance vs. Elevation Gain</h3>
                <Scatter data={scatterChartData} />
            </div>
        </div>
    );
};

export default Graphs;
