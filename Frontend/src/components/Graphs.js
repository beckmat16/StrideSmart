import React, { useMemo } from 'react';
import { Line, Bar, Pie, Scatter } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { meters_to_miles, formatDate, paceSecondsPerMile, convert_mile_pace } from './utils';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

const getActivityTimestamp = (activity) => {
    const raw = activity.start_date || activity.start_date_local;
    const ts = new Date(raw).getTime();
    return Number.isNaN(ts) ? 0 : ts;
};

const Graphs = (props) => {
    const activities = props?.activities;

    const sortedActivities = useMemo(() => {
        if (!Array.isArray(activities)) return [];
        return [...activities].sort(
            (a, b) => getActivityTimestamp(a) - getActivityTimestamp(b)
        );
    }, [activities]);

    const runsWithPace = useMemo(() => {
        return sortedActivities
            .filter((a) => a.type === 'Run')
            .map((a) => ({
                activity: a,
                timestamp: getActivityTimestamp(a),
                paceSeconds: paceSecondsPerMile(a.moving_time, a.distance),
            }))
            .filter((entry) => entry.paceSeconds != null && entry.paceSeconds > 0);
    }, [sortedActivities]);

    if (!props || typeof props !== 'object') {
        return <div>Error: Invalid props passed to Graphs component</div>;
    }

    if (!Array.isArray(activities)) {
        return <div>Error: Activities is not an array.</div>;
    }

    if (activities.length === 0) {
        return <div>No activities found</div>;
    }

    const lineChartData = {
        labels: sortedActivities.map((a) => formatDate(a.start_date || a.start_date_local)),
        datasets: [
            {
                label: 'Distance Over Time (miles)',
                data: sortedActivities.map((a) => Number(meters_to_miles(a.distance))),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
            },
        ],
    };

    const paceChartData = {
        labels: runsWithPace.map((entry) =>
            formatDate(entry.activity.start_date || entry.activity.start_date_local)
        ),
        datasets: [
            {
                label: 'Pace (min/mile)',
                data: runsWithPace.map((entry) =>
                    Number((entry.paceSeconds / 60).toFixed(2))
                ),
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1,
            },
        ],
    };

    const paceChartOptions = {
        responsive: true,
        plugins: {
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const entry = runsWithPace[context.dataIndex];
                        const paceLabel = convert_mile_pace(
                            entry.activity.moving_time,
                            entry.activity.distance
                        );
                        return `Pace: ${paceLabel}/mi`;
                    },
                },
            },
        },
        scales: {
            y: {
                reverse: true,
                title: { display: true, text: 'Minutes per mile (lower is faster)' },
            },
        },
    };

    const activityTypes = [...new Set(activities.map((a) => a.type))];
    const barChartData = {
        labels: activityTypes,
        datasets: [
            {
                label: 'Activity Type Distribution',
                data: activityTypes.map(
                    (type) => activities.filter((a) => a.type === type).length
                ),
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
            },
        ],
    };

    const pieChartData = {
        labels: ['Easy', 'Moderate', 'Hard'],
        datasets: [
            {
                label: 'Effort Distribution',
                data: [
                    activities.filter((a) => (a.average_heartrate || 0) < 140).length,
                    activities.filter(
                        (a) =>
                            (a.average_heartrate || 0) >= 140 &&
                            (a.average_heartrate || 0) < 170
                    ).length,
                    activities.filter((a) => (a.average_heartrate || 0) >= 170).length,
                ],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                ],
            },
        ],
    };

    const scatterChartData = {
        datasets: [
            {
                label: 'Distance (miles) vs. Elevation Gain (m)',
                data: activities.map((a) => ({
                    x: Number(meters_to_miles(a.distance)),
                    y: a.total_elevation_gain,
                })),
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
            },
        ],
    };

    return (
        <div className="graphs-container">
            <div className="chart">
                <h3>Distance Over Time</h3>
                <Line data={lineChartData} />
            </div>
            <div className="chart">
                <h3>Pace Over Time (Runs)</h3>
                {runsWithPace.length === 0 ? (
                    <p>No run pace data available.</p>
                ) : (
                    <Line data={paceChartData} options={paceChartOptions} />
                )}
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
