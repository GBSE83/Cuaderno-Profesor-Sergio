// NEW FILE: students/students-utils.js
import { getGroups, getAttendanceRecords } from '../utils/storage.js';

export const ensureStudentDetails = (student) => {
    if (!student.details) {
        student.details = {
            observations: '',
            characteristics: {
                ACNEE: false,
                COMPE: false,
                REPET: false,
                ADAPT: false
            },
            classifications: [] // NEW: array of { type: '', description: '' }
        };
    }
    if (!student.details.characteristics) {
        student.details.characteristics = { ACNEE: false, COMPE: false, REPET: false, ADAPT: false };
    } else {
        if (typeof student.details.characteristics.ACNEE === 'undefined') student.details.characteristics.ACNEE = false;
        if (typeof student.details.characteristics.COMPE === 'undefined') student.details.characteristics.COMPE = false;
        if (typeof student.details.characteristics.REPET === 'undefined') student.details.characteristics.REPET = false;
        if (typeof student.details.characteristics.ADAPT === 'undefined') student.details.characteristics.ADAPT = false;
    }
    if (!Array.isArray(student.details.classifications)) {
        student.details.classifications = []; // ensure it's an array
    }
};

/**
 * Helper to split a full name into a 'first name' and 'last name' component.
 * It tries to detect "LastName, FirstName" format first, then falls back to "FirstName LastName".
 * @param {string} fullName - The full name of the student.
 * @returns {object} An object with firstName and lastName properties.
 */
export const splitFullName = (fullName) => {
    const trimmedFullName = fullName.trim();
    const commaIndex = trimmedFullName.indexOf(',');
    if (commaIndex !== -1) {
        // Assume "LastName, FirstName" format
        const lastName = trimmedFullName.substring(0, commaIndex).trim();
        const firstName = trimmedFullName.substring(commaIndex + 1).trim();
        return { firstName, lastName };
    } else {
        // Assume "FirstName LastName" format (or just FirstName if only one word)
        const parts = trimmedFullName.split(/\s+/); // Split by one or more spaces
        if (parts.length === 0) {
            return { firstName: '', lastName: '' };
        }
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' '); // Join the rest as last name
        return { firstName, lastName };
    }
};

// Helper to extract first and last name parts for sorting
export const parseNameForSorting = (fullName) => {
    const { firstName, lastName } = splitFullName(fullName); // Use the new helper
    // Normalize to avoid empty strings causing unstable comparisons
    const fn = (firstName || '').trim();
    const ln = (lastName || '').trim();
    // If last name is empty, use firstName as lastName for sorting consistency
    return {
        firstName: fn || ln,
        lastName: ln || fn
    };
};

/**
 * Sorts an array of students based on the specified order.
 * @param {Array<object>} students - The array of student objects.
 * @param {string} sortOrder - 'lastName' or 'firstName' or 'manual'.
 * @returns {Array<object>} A new array with sorted students.
 */
export const sortStudents = (students, sortOrder) => {
    if (sortOrder === 'manual') {
        return [...students]; // Return a shallow copy, preserving original order
    }

    return [...students].sort((a, b) => {
        const nameA = parseNameForSorting(a.name);
        const nameB = parseNameForSorting(b.name);

        let comparison = 0;
        if (sortOrder === 'lastName') {
            comparison = nameA.lastName.localeCompare(nameB.lastName, 'es', { sensitivity: 'base' });
            if (comparison === 0) {
                comparison = nameA.firstName.localeCompare(nameB.firstName, 'es', { sensitivity: 'base' });
            }
        } else if (sortOrder === 'firstName') {
            comparison = nameA.firstName.localeCompare(nameB.firstName, 'es', { sensitivity: 'base' });
            if (comparison === 0) {
                comparison = nameA.lastName.localeCompare(nameB.lastName, 'es', { sensitivity: 'base' });
            }
        }
        return comparison;
    });
};

/**
 * Filters an array of students based on a search term.
 * @param {Array<object>} students - The array of student objects.
 * @param {string} searchTerm - The search term.
 * @returns {Array<object>} A new array with filtered students.
 */
export const filterStudents = (students, searchTerm) => {
    if (!searchTerm) {
        return [...students]; // Return a shallow copy if no search term
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return students.filter(student =>
        student.name.toLowerCase().includes(lowerCaseSearchTerm)
    );
};

/**
 * Calculates the number of absences (A), expulsions (E), delays (R), and incidences (I) for a student
 * in the last N recorded days (unique dates across all groups).
 *
 * MODIFIED: Now accepts optional filters: typeFilter ('all' | 'A' | 'E' | 'R' | 'I') and justificationFilter ('all' | 'justified' | 'not_justified').
 *
 * @param {string} studentName - The name of the student.
 * @param {object} options - Optional filters.
 * @returns {object} An object with counts for 'absences' (A), 'expulsions' (E), 'delays' (R), and 'incidences' (I).
 */
export const calculateAbsencesCount = (studentName, options = {}) => {
    const { typeFilter = 'all', justificationFilter = 'all', lastNDays = 30 } = options;
    const allGroups = getGroups();
    const attendanceRecords = getAttendanceRecords();

    let allStudentAttendanceRecords = [];

    allGroups.forEach(group => {
        const groupKey = `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}`;
        const groupAttendance = attendanceRecords[groupKey] || {};

        Object.keys(groupAttendance).forEach(date => {
            const studentEntry = groupAttendance[date] && groupAttendance[date][studentName];
            if (studentEntry) {
                allStudentAttendanceRecords.push({
                    date: date,
                    status: studentEntry.status,
                    justified: !!studentEntry.justified
                });
            }
        });
    });

    // Sort by date (most recent first)
    allStudentAttendanceRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Get the latest N unique dates for the student
    const uniqueDates = new Set();
    const lastNDaysRecords = [];
    for (const record of allStudentAttendanceRecords) {
        if (!uniqueDates.has(record.date)) {
            uniqueDates.add(record.date);
            lastNDaysRecords.push(record);
            if (lastNDaysRecords.length >= lastNDays) {
                break; // Found requested number of unique latest days
            }
        }
    }

    let absences = 0;
    let expulsions = 0;
    let delays = 0;
    let incidences = 0; // NEW: Count for incidences
    // Apply filters: typeFilter and justificationFilter
    lastNDaysRecords.forEach(record => {
        // Justification filter
        if (justificationFilter === 'justified' && !record.justified) return;
        if (justificationFilter === 'not_justified' && record.justified) return;

        // Type filter and counting
        if ((typeFilter === 'all' || typeFilter === 'A') && record.status === 'A') {
            absences++;
        }
        if ((typeFilter === 'all' || typeFilter === 'E') && record.status === 'E') {
            expulsions++;
        }
        if ((typeFilter === 'all' || typeFilter === 'R') && record.status === 'R') {
            delays++;
        }
        // NEW: Count 'I' (Incidencia)
        if ((typeFilter === 'all' || typeFilter === 'I') && record.status === 'I') {
            incidences++;
        }
    });
    return { absences, expulsions, delays, incidences }; // MODIFIED: Include incidences
};