import { getGroups, saveAttendanceRecords, getAttendanceRecords } from '../utils/storage.js';
import { modalAlert } from '../utils/backup-utils.js'; // NEW: Import modalAlert

// Added 'N' (No indicado) as the default and first status
// MODIFIED: Added 'I' (Incidencia) status
export const ATTENDANCE_STATUSES = ['N', 'P', 'A', 'R', 'E', 'I']; // No indicado, Presente, Ausente, Retraso, Expulsado, Incidencia
export const STATUS_COLORS = {
    'N': 'status-N', // Grey for 'No indicado'
    'P': 'status-P',
    'A': 'status-A',
    'R': 'status-R',
    'E': 'status-E',
    'I': 'status-I' // NEW: Brown for 'Incidencia'
};

/**
 * Checks if a specific date for a given group should be considered a "recorded day".
 * A date is recorded if at least one student in that group has an attendance status different from 'N'.
 * @param {string} groupKey - The key of the group.
 * @param {string} date - The date in YYYY-MM-DD format.
 * @param {Array<object>} allGroups - All group objects.
 * @param {object} allAttendanceRecords - All attendance records.
 * @returns {boolean} True if the date for the group is recorded, false otherwise.
 */
export const isGroupDateRecorded = (groupKey, date, allGroups, allAttendanceRecords) => {
    const group = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === groupKey);
    if (!group || !group.students) return false;

    const dailyGroupAttendance = allAttendanceRecords[groupKey]?.[date];
    if (!dailyGroupAttendance) return false;

    // A date is recorded if at least one student has a status other than 'N'
    return group.students.some(student => {
        const studentRecord = dailyGroupAttendance[student.name];
        return studentRecord && studentRecord.status !== 'N';
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
 * Retrieves the students for a specific group.
 * @param {string} groupKey - The key of the group.
 * @param {Array} allGroups - An array of all group objects.
 * @returns {Array} An array of student objects.
 */
export const getGroupStudentsLogic = (groupKey, allGroups) => {
    const group = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === groupKey);
    return group ? group.students : [];
};

/**
 * Processes attendance data for the current group and date, returning students and their current attendance.
 * Now also accepts a searchTerm for filtering.
 * @param {string} currentGroupKey - The key of the currently selected group.
 * @param {string} currentDate - The currently selected date in YYYY-MM-DD format.
 * @param {Array} allGroups - An array of all group objects.
 * @param {string} searchTerm - Optional search term to filter students.
 * @returns {object} An object containing the current group, its students (filtered), and daily attendance records.
 */
export const processAttendanceDataForDisplay = (currentGroupKey, currentDate, allGroups, searchTerm = '') => {
    const currentGroup = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === currentGroupKey);
    if (!currentGroup) {
        return { currentGroup: null, students: [], dailyAttendance: {} };
    }

    const allStudents = getGroupStudentsLogic(currentGroupKey, allGroups);
    const filteredStudents = filterStudents(allStudents, searchTerm); // Apply filter here

    const attendanceRecords = getAttendanceRecords();
    const dailyAttendance = (attendanceRecords[currentGroupKey] && attendanceRecords[currentGroupKey][currentDate]) || {};

    return { currentGroup, students: filteredStudents, dailyAttendance };
};

/**
 * Handles the logic for cycling through attendance statuses and updating justified checkbox state.
 * @param {string} currentStatus - The current status of the student.
 * @returns {object} An object containing `newStatus`, `isJustifiedCheckboxEnabled`, and `justifiedCheckboxChecked`.
 */
export const cycleAttendanceStatus = (currentStatus) => {
    let nextIndex = (ATTENDANCE_STATUSES.indexOf(currentStatus) + 1) % ATTENDANCE_STATUSES.length;
    let newStatus = ATTENDANCE_STATUSES[nextIndex];

    // MODIFIED: Enable justification checkbox for Ausente (A), Retraso (R), Expulsado (E), and Incidencia (I)
    const isJustifiedCheckboxEnabled = (newStatus === 'A' || newStatus === 'R' || newStatus === 'E' || newStatus === 'I');
    let justifiedCheckboxChecked = false; // By default, uncheck when status changes

    return { newStatus, isJustifiedCheckboxEnabled, justifiedCheckboxChecked };
};

/**
 * Handles saving the attendance records for the current date and group.
 * @param {string} currentGroupKey - The key of the current group.
 * @param {string} currentDate - The current date.
 * @param {HTMLElement} attendanceStudentsList - The UL element containing student attendance items.
 * @param {Function} clearUnsavedChangesFlagCallback - Callback to clear the unsaved changes flag.
 * @returns {boolean} True if attendance was saved successfully, false otherwise.
 */
export const saveCurrentAttendance = async (currentGroupKey, currentDate, attendanceStudentsList, clearUnsavedChangesFlagCallback) => {
    if (!currentGroupKey || !currentDate) {
        await modalAlert('Por favor, selecciona un grupo y una fecha.');
        return false;
    }

    const attendanceRecords = getAttendanceRecords();
    if (!attendanceRecords[currentGroupKey]) {
        attendanceRecords[currentGroupKey] = {};
    }

    const dailyAttendanceUpdates = {}; // Only store updates for visible students

    Array.from(attendanceStudentsList.children).forEach(listItem => {
        if (listItem.classList.contains('no-students-message')) return;

        const studentName = listItem.dataset.studentName;
        const statusButton = listItem.querySelector('.attendance-status-button');
        const justifiedCheckboxInput = listItem.querySelector('.justified-checkbox-container input[type="checkbox"]');

        let justifiedStatus = false;
        if (justifiedCheckboxInput && !justifiedCheckboxInput.disabled) {
            justifiedStatus = justifiedCheckboxInput.checked;
        }

        if (statusButton) {
            dailyAttendanceUpdates[studentName] = {
                status: statusButton.dataset.status,
                justified: justifiedStatus
            };
        }
    });

    // IMPORTANT: Merge with existing attendance for the day, to preserve records of filtered-out students.
    // This ensures that students not currently visible (due to search filter) retain their attendance status.
    const existingDailyAttendance = (attendanceRecords[currentGroupKey] && attendanceRecords[currentGroupKey][currentDate]) || {};
    attendanceRecords[currentGroupKey][currentDate] = { ...existingDailyAttendance, ...dailyAttendanceUpdates };

    saveAttendanceRecords(attendanceRecords);
    clearUnsavedChangesFlagCallback(); // NEW: Call the callback to clear the flag
    await modalAlert('Asistencia registrada correctamente.');
    return true;
};

/**
 * Retrieves and formats attendance history for a specific student.
 * Scans all groups for the student's records and returns records for every unique date
 * where there is an entry for that student, sorted most recent first.
 *
 * MODIFIED: Now only includes records for dates that are considered "recorded days" for their respective groups.
 * A day is recorded for a group if at least one student has a status other than 'N'.
 *
 * @param {string} studentName - The name of the student.
 * @returns {Array<object>} An array of attendance history records (most recent first),
 *                          each with { date, status, justifiedDisplay, groupName, groupKey }.
 */
export const getStudentAttendanceHistoryData = (studentName) => {
    const allGroups = getGroups();
    const attendanceRecords = getAttendanceRecords();

    let allStudentAttendanceRecords = [];

    allGroups.forEach(group => {
        const groupKey = `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}`;
        const groupAttendance = attendanceRecords[groupKey] || {};

        Object.keys(groupAttendance).forEach(date => {
            // NEW: Only consider this date if it's recorded for the group
            if (isGroupDateRecorded(groupKey, date, allGroups, attendanceRecords)) {
                const studentDailyAttendance = groupAttendance[date] && groupAttendance[date][studentName];
                if (studentDailyAttendance) {
                    allStudentAttendanceRecords.push({
                        date: date,
                        status: studentDailyAttendance.status,
                        justified: studentDailyAttendance.justified,
                        groupName: `${group.subjectName} (${group.gradeLevel} ${group.groupLetter.toUpperCase()})`,
                        groupKey: groupKey // NEW: needed to save edits from history modal
                    });
                }
            }
        });
    });

    // Sort all gathered records by date (most recent first)
    allStudentAttendanceRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Keep only one record per unique date (the first encountered for that date, which is the most recent by sort)
    // This step is important to ensure each unique date is represented only once,
    // especially if a student moved between groups and has records for the same date in different groups.
    const uniqueDates = new Set();
    const uniqueDateRecords = [];
    for (const record of allStudentAttendanceRecords) {
        if (!uniqueDates.has(record.date)) {
            uniqueDates.add(record.date);
            uniqueDateRecords.push(record);
        }
    }

    // Format justified status for display in the modal
    return uniqueDateRecords.map(record => {
        let justifiedDisplay = '';
        // MODIFIED: Include 'I' in justification-relevant statuses
        if (record.status === 'A' || record.status === 'R' || record.status === 'E' || record.status === 'I') {
            justifiedDisplay = record.justified ? 'Sí' : 'No';
        }
        return {
            date: record.date,
            status: record.status,
            justifiedDisplay: justifiedDisplay,
            justified: !!record.justified,
            groupName: record.groupName,
            groupKey: record.groupKey // NEW
        };
    });
};