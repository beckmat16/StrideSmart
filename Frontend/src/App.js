// src/App.js
// src/App.js
import React, { useEffect, useState } from 'react';
import { useTable, useSortBy } from 'react-table';
import './App.css';

//Utility Functions

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

//Initialize Activity Table
const ActivityTable = ({ data }) => {
    const columns = React.useMemo(
        () => [
            {
                Header: 'Date',
                accessor: 'start_date_local', 
                Cell: ({ value }) => formatDate(value)
            },
            {
                Header: 'Distance',
                accessor: 'distance',
                Cell: ({ value }) => `${meters_to_miles(value)} miles`,
            },
            {
                Header: 'Pace',
                accessor: 'moving_time',
                Cell: ({ row }) => `${convert_mile_pace(row.original.moving_time, row.original.distance)} per mile`,
            },
        ],
        []
    );
    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = useTable(
        {
            columns,
            data: React.useMemo(() => data, [data])
        }, 
        useSortBy
    );

    return (
        <div className="table-container">
            <table {...getTableProps()} className="activity-table">
                <thead>
                    {headerGroups.map(headerGroup => (
                        <tr {...headerGroup.getHeaderGroupProps()}>
                            {headerGroup.headers.map(column => (
                                <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                                    {column.render('Header')}
                                    <span>
                                        {column.isSorted
                                            ? column.isSortedDesc
                                                ? ' 🔽'
                                                : ' 🔼'
                                            : ''}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody {...getTableBodyProps()}>
                    {rows.map(row => {
                        prepareRow(row);
                        return (
                            <tr {...row.getRowProps()}>
                                {row.cells.map(cell => (
                                    <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};


const App = () => {
    const [activities, setActivities] = useState([]);
    const [activeTab, setActiveTab] = useState('default'); 

    useEffect(() => {
        // Fetch data from FastAPI backend
        const fetchActivities = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/training');
                const data = await response.json();
                setActivities(data);
            } catch (error) {
                console.error("Error fetching activities:", error);
            }
        };

        fetchActivities();
    },[]);
    
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
                </div>
            )}
            {activeTab === 'all' && (
                <div className="tab-content">
                    <h2>Activities</h2>
                    <ActivityTable
                        data={activities}
                    />
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