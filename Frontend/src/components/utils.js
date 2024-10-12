// src/utils.js

export const meters_to_miles = (meters) => (meters / 1609.34).toFixed(2);

export const convert_mile_pace = (moving_time, distance) => {
    const miles = distance / 1609.34;
    const mile_pace_seconds = moving_time / miles;
    const minutes = Math.floor(mile_pace_seconds / 60);
    const seconds = Math.floor(mile_pace_seconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} `;
};

export const formatDate = (isoString) => {
    const date = new Date(isoString);
    const month = String(date.getMonth() + 1).padStart(2, '0'); 
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
};
