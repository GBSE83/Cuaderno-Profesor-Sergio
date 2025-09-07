export const formatDate = (date) => {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
};

export const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

export const formatDatePretty = (dateString) => {
    const date = new Date(dateString + 'T00:00:00'); // Add T00:00:00 to ensure UTC interpretation and avoid timezone issues
    
    // Custom weekday mapping (Sunday is 0, Monday is 1, ..., Saturday is 6)
    const weekdays = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const weekdayAbbr = weekdays[date.getDay()];

    // Get the date part (day, month, year)
    const options = { day: '2-digit', month: '2-digit', year: '2-digit' };
    const datePart = new Intl.DateTimeFormat('es-ES', options).format(date);

    // Combine weekday abbreviation and date part
    return `${weekdayAbbr}, ${datePart}`;
};

export const formatDateTimeForFilename = (date) => {
    const d = new Date(date);
    let year = d.getFullYear();
    let month = String(d.getMonth() + 1).padStart(2, '0');
    let day = String(d.getDate()).padStart(2, '0');
    let hours = String(d.getHours()).padStart(2, '0');
    let minutes = String(d.getMinutes()).padStart(2, '0');
    let seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
};

export const formatDateForReportFilename = (dateString) => {
    const date = new Date(dateString + 'T00:00:00'); // Ensure consistent date interpretation
    let day = String(date.getDate()).padStart(2, '0');
    let month = String(date.getMonth() + 1).padStart(2, '0');
    let year = String(date.getFullYear()).slice(-2); // Get last two digits of the year
    return `${day}-${month}-${year}`;
};

/**
 * Gets the start of the week (Monday) for a given date.
 * @param {Date} date - The date to start from.
 * @returns {Date} A new Date object representing the Monday of that week.
 */
export const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0); // Normalize to start of day
    return d;
};

/**
 * Gets the end of the week (Sunday) for a given date.
 * @param {Date} date - The date to start from.
 * @returns {Date} A new Date object representing the Sunday of that week.
 */
export const getEndOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
    const diff = d.getDate() - day + 7; // Sunday is 7 days from last Sunday (or 0 for current Sunday)
    d.setDate(diff);
    d.setHours(23, 59, 59, 999); // Normalize to end of day
    return d;
};

/**
 * Formats a date to 'DD/MM'.
 * @param {Date} date - The Date object.
 * @returns {string} Formatted date string.
 */
export const formatDateShort = (date) => {
    const d = new Date(date);
    let day = '' + d.getDate();
    let month = '' + (d.getMonth() + 1);

    if (day.length < 2) day = '0' + day;
    if (month.length < 2) month = '0' + month;

    return `${day}/${month}`;
};

/**
 * Formats a date to 'DD/MM/YYYY'.
 * @param {Date} date - The Date object.
 * @returns {string} Formatted date string.
 */
export const formatDateDayMonthYear = (date) => {
    const d = new Date(date);
    let day = String(d.getDate()).padStart(2, '0');
    let month = String(d.getMonth() + 1).padStart(2, '0');
    let year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

/**
 * Formats a grade level string to its abbreviated version.
 * @param {string} gradeLevel - The original grade level string (e.g., '1º ESO').
 * @returns {string} The abbreviated grade level (e.g., '1ESO').
 */
export const formatGradeLevelShort = (gradeLevel) => {
    switch (gradeLevel) {
        case '1º ESO': return '1ESO';
        case '2º ESO': return '2ESO';
        case '3º ESO': return '3ESO';
        case '4º ESO': return '4ESO';
        case '1º Bachillerato': return '1BTO';
        case '2º Bachillerato': return '2BTO';
        case 'F.P.B. 1': return '1FPB';
        case 'F.P.B. 2': return '2FPB';
        default: return gradeLevel; // Return original if no match
    }
};