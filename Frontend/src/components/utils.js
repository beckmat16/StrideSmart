// src/utils.js

export const meters_to_miles = (meters) => {
    if (!meters) return '0.00';
    return (meters / 1609.34).toFixed(2);
};

export const paceSecondsPerMile = (movingTime, distance) => {
    if (!distance || !movingTime || distance <= 0) return null;
    const miles = distance / 1609.34;
    return movingTime / miles;
};

export const convert_mile_pace = (movingTime, distance) => {
    const paceSeconds = paceSecondsPerMile(movingTime, distance);
    if (paceSeconds == null || !Number.isFinite(paceSeconds)) return '—';
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.floor(paceSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const formatDuration = (seconds) => {
    if (!seconds) return '—';
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const formatHeartRate = (average, maximum) => {
    if (!average && !maximum) return '—';
    if (average && maximum) return `${Math.round(average)} / ${Math.round(maximum)} avg/max`;
    if (average) return `${Math.round(average)} avg`;
    return `${Math.round(maximum)} max`;
};

export const formatDate = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '—';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
};

export const stravaActivityUrl = (activityId) =>
    `https://www.strava.com/activities/${activityId}`;
