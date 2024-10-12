import React from 'react';
import { useTable, useSortBy } from 'react-table';
import { meters_to_miles, convert_mile_pace, formatDate } from './utils.js';

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
                                    <span className="sort-indicator">
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

export default ActivityTable;
