import React from 'react';
import { useTable, useSortBy, usePagination } from 'react-table';
import {
    meters_to_miles,
    convert_mile_pace,
    formatDate,
    formatDuration,
    formatHeartRate,
    paceSecondsPerMile,
    stravaActivityUrl,
} from './utils.js';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const ActivityTable = ({ data }) => {
    const columns = React.useMemo(
        () => [
            {
                Header: 'Date',
                accessor: 'start_date_local',
                sortType: (rowA, rowB, columnId) => {
                    const a = new Date(rowA.values[columnId]).getTime();
                    const b = new Date(rowB.values[columnId]).getTime();
                    return a === b ? 0 : a > b ? 1 : -1;
                },
                Cell: ({ value }) => formatDate(value),
            },
            {
                Header: 'Name',
                accessor: 'name',
                Cell: ({ value }) => value || '—',
            },
            {
                Header: 'Type',
                accessor: 'type',
                Cell: ({ value }) => value || '—',
            },
            {
                Header: 'Distance',
                accessor: 'distance',
                sortType: 'number',
                Cell: ({ value }) => `${meters_to_miles(value)} mi`,
            },
            {
                Header: 'Moving Time',
                accessor: 'moving_time',
                sortType: 'number',
                Cell: ({ value }) => formatDuration(value),
            },
            {
                Header: 'Elapsed Time',
                accessor: 'elapsed_time',
                sortType: 'number',
                Cell: ({ value }) => formatDuration(value),
            },
            {
                Header: 'Pace',
                id: 'pace',
                accessor: (row) => paceSecondsPerMile(row.moving_time, row.distance),
                sortType: 'number',
                Cell: ({ row }) => {
                    const pace = convert_mile_pace(row.original.moving_time, row.original.distance);
                    return pace === '—' ? '—' : `${pace}/mi`;
                },
            },
            {
                Header: 'Heart Rate',
                id: 'heart_rate',
                accessor: (row) => row.average_heartrate || 0,
                sortType: 'number',
                Cell: ({ row }) =>
                    formatHeartRate(
                        row.original.average_heartrate,
                        row.original.max_heartrate
                    ),
            },
            {
                Header: 'Strava',
                id: 'strava_link',
                disableSortBy: true,
                Cell: ({ row }) => (
                    <a
                        href={stravaActivityUrl(row.original.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="strava-activity-link"
                    >
                        View
                    </a>
                ),
            },
        ],
        []
    );

    const tableData = React.useMemo(() => data || [], [data]);

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        page,
        prepareRow,
        canPreviousPage,
        canNextPage,
        pageOptions,
        pageCount,
        gotoPage,
        nextPage,
        previousPage,
        setPageSize,
        state: { pageIndex, pageSize },
    } = useTable(
        {
            columns,
            data: tableData,
            initialState: { pageIndex: 0, pageSize: 25 },
            autoResetPage: false,
        },
        useSortBy,
        usePagination
    );

    return (
        <div className="table-container">
            <div className="table-scroll-area">
            <table {...getTableProps()} className="activity-table">
                <thead>
                    {headerGroups.map((headerGroup) => (
                        <tr {...headerGroup.getHeaderGroupProps()} key={headerGroup.id}>
                            {headerGroup.headers.map((column) => (
                                <th
                                    {...column.getHeaderProps(
                                        column.getSortByToggleProps()
                                    )}
                                    key={column.id}
                                >
                                    {column.render('Header')}
                                    {column.canSort !== false && (
                                        <span className="sort-indicator">
                                            {column.isSorted
                                                ? column.isSortedDesc
                                                    ? ' ▼'
                                                    : ' ▲'
                                                : ''}
                                        </span>
                                    )}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody {...getTableBodyProps()}>
                    {page.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="empty-table-message">
                                No activities to display.
                            </td>
                        </tr>
                    ) : (
                        page.map((row) => {
                            prepareRow(row);
                            return (
                                <tr {...row.getRowProps()} key={row.id}>
                                    {row.cells.map((cell) => (
                                        <td {...cell.getCellProps()} key={cell.column.id}>
                                            {cell.render('Cell')}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
            </div>

            <div className="table-pagination">
                <div className="pagination-controls">
                    <button
                        type="button"
                        onClick={() => gotoPage(0)}
                        disabled={!canPreviousPage}
                    >
                        First
                    </button>
                    <button
                        type="button"
                        onClick={() => previousPage()}
                        disabled={!canPreviousPage}
                    >
                        Previous
                    </button>
                    <span className="pagination-status">
                        Page {pageIndex + 1} of {pageCount || 1}
                    </span>
                    <button
                        type="button"
                        onClick={() => nextPage()}
                        disabled={!canNextPage}
                    >
                        Next
                    </button>
                    <button
                        type="button"
                        onClick={() => gotoPage(pageCount - 1)}
                        disabled={!canNextPage}
                    >
                        Last
                    </button>
                </div>
                <div className="pagination-size">
                    <label htmlFor="page-size">Rows per page:</label>
                    <select
                        id="page-size"
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                    >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                    <span className="pagination-total">
                        Showing {page.length} of {tableData.length} activities
                    </span>
                </div>
            </div>

            <p className="strava-attribution">
                Activity data provided by{' '}
                <a
                    href="https://www.strava.com"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Strava
                </a>
                . When shared publicly, activity data must comply with the{' '}
                <a
                    href="https://www.strava.com/legal/api"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Strava API Agreement
                </a>
                .
            </p>
        </div>
    );
};

export default ActivityTable;
