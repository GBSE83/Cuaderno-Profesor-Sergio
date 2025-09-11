import { formatDatePretty, formatDate } from '../utils/date-utils.js';
import { STATUS_COLORS, cycleAttendanceStatus, isGroupDateRecorded, ATTENDANCE_STATUSES } from './attendance-logic.js'; // MODIFIED: Import ATTENDANCE_STATUSES
import { getAttendanceRecords, saveAttendanceRecords, getGroups } from '../utils/storage.js';
import { formatGradeLevelShort } from '../utils/date-utils.js'; // NEW: use abbreviated grade level
import { modalAlert } from '../utils/backup-utils.js'; // NEW: Import modalAlert
import { getStudentAttendanceHistoryData } from './attendance-logic.js'; // NEW: to refresh modal after external saves

/**
 * Applies the group's color to the page body and main heading.
 * @param {object|null} group - The currently selected group object or null.
 * @param {HTMLElement} pageBody - The document body element.
 * @param {HTMLElement} pageH1 - The main H1 heading element.
 */
export const applyGroupColorToAttendancePage = (group, pageBody, pageH1) => {
    if (group && group.color) {
        if (pageBody) pageBody.style.backgroundColor = group.color;
        if (pageH1) {
            pageH1.style.color = group.color;
            pageH1.style.borderBottom = `2px solid ${group.color}`;
            pageH1.style.paddingBottom = '10px';
            pageH1.style.marginBottom = '20px';
        }
    } else {
        if (pageBody) pageBody.style.backgroundColor = '';
        if (pageH1) {
            pageH1.style.color = '';
            pageH1.style.borderBottom = '';
            pageH1.style.paddingBottom = '';
            pageH1.style.marginBottom = '';
        }
    };
};

/**
 * Renders the groups into the dropdown select element.
 * @param {Array} allGroups - An array of all group objects.
 * @param {string|null} storedGroupKey - The key of the group selected in the previous session.
 * @param {HTMLElement} groupSelect - The select element for groups.
 * @param {HTMLElement} groupInfoDisplay - Element to display group information.
 * @param {HTMLElement} attendanceStudentsList - The UL element for students.
 * @param {HTMLElement} saveAttendanceButton - The button to save attendance.
 * @param {Function} onGroupSelectedCallback - Callback to execute when a group is selected or pre-selected.
 */
export const renderGroupsDropdown = (
    allGroups,
    storedGroupKey,
    groupSelect,
    groupInfoDisplay,
    attendanceStudentsList,
    saveAttendanceButton,
    onGroupSelectedCallback
) => {
    groupSelect.innerHTML = '<option value="">Selecciona un grupo</option>';
    if (allGroups.length === 0) {
        groupInfoDisplay.textContent = 'No hay grupos creados aún. Ve a "Creación y Selección de Grupos" para añadir.';
        groupSelect.disabled = true;
        attendanceStudentsList.innerHTML = '<li class="no-students-message">No hay grupos creados.</li>';
        saveAttendanceButton.disabled = true;
        return;
    }

    groupSelect.disabled = false;
    allGroups.forEach(group => {
        const option = document.createElement('option');
        const groupKey = `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}`;
        option.value = groupKey;
        option.textContent = `${group.subjectName} (${formatGradeLevelShort(group.gradeLevel)} ${group.groupLetter})`;
        groupSelect.appendChild(option);
    });

    if (storedGroupKey && allGroups.some(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === storedGroupKey)) {
        groupSelect.value = storedGroupKey;
        if (onGroupSelectedCallback) {
            onGroupSelectedCallback();
        }
    } else {
        groupInfoDisplay.textContent = 'Selecciona un grupo para gestionar la asistencia.';
        attendanceStudentsList.innerHTML = '<li class="no-students-message">Selecciona un grupo y una fecha para ver los alumnos.</li>';
        saveAttendanceButton.disabled = true;
    }
};

/**
 * Updates the display showing the current group and date.
 * @param {object} currentGroup - The currently selected group object.
 * @param {string} currentDate - The currently selected date in YYYY-MM-DD format.
 * @param {HTMLElement} groupInfoDisplay - The element to update.
 */
export const updateGroupInfoDisplay = (currentGroup, currentDate, groupInfoDisplay) => {
    // Use formatGradeLevelShort for grade level and display groupLetter as is (allowing lowercase)
    groupInfoDisplay.textContent = `Grupo: ${currentGroup.subjectName} (${formatGradeLevelShort(currentGroup.gradeLevel)} ${currentGroup.groupLetter}) - Fecha: ${formatDatePretty(currentDate)}`;
};

/**
 * Renders the list of students with their attendance status controls.
 * @param {Array} students - Array of student objects for the current group (already filtered).
 * @param {object} dailyAttendance - Object containing attendance records for the current date.
 * @param {HTMLElement} attendanceStudentsList - The UL element to render students into.
 * @param {HTMLElement} saveAttendanceButton - The button to save attendance.
 * @param {object} STATUS_COLORS - Mapping of status codes to CSS class names.
 * @param {Function} setUnsavedChangesFlag - Callback to set the unsaved changes flag.
 */
export const renderStudentsForAttendance = (
    students,
    dailyAttendance,
    attendanceStudentsList,
    saveAttendanceButton,
    STATUS_COLORS,
    setUnsavedChangesFlag
) => {
    attendanceStudentsList.innerHTML = '';
    saveAttendanceButton.disabled = true;

    if (!students || students.length === 0) {
        // Updated message to reflect filtering
        attendanceStudentsList.innerHTML = '<li class="no-students-message">No hay alumnos en este grupo que coincidan con la búsqueda.</li>';
        return;
    }

    saveAttendanceButton.disabled = false;

    students.forEach(student => {
        const studentName = student.name;
        // Use the saved status, or 'N' if not found.
        const savedStatus = dailyAttendance[studentName] ? dailyAttendance[studentName].status : 'N';
        // Use the saved justified status, or false if not found.
        const savedJustified = dailyAttendance[studentName] ? dailyAttendance[studentName].justified : false;

        // Determine initial checkbox state based on saved status and justification.
        // MODIFIED: A, R, E, I statuses enable the checkbox. For other statuses, it's disabled.
        const isJustifiedCheckboxEnabled = (savedStatus === 'A' || savedStatus === 'R' || savedStatus === 'E' || savedStatus === 'I');
        const justifiedCheckboxChecked = (isJustifiedCheckboxEnabled && savedJustified) ? 'checked' : '';
        const justifiedCheckboxDisabled = isJustifiedCheckboxEnabled ? '' : 'disabled';
        const justifiedContainerClass = isJustifiedCheckboxEnabled ? '' : 'disabled-checkbox';

        const listItem = document.createElement('li');
        listItem.dataset.studentName = studentName;
        listItem.innerHTML = `
            <span class="student-name">${studentName}</span>
            <div class="attendance-controls">
                <label class="justified-checkbox-container ${justifiedContainerClass}">
                    <input type="checkbox" data-student-name="${studentName}" ${justifiedCheckboxChecked} ${justifiedCheckboxDisabled}>
                    Justificado
                </label>
                <button class="attendance-status-button ${STATUS_COLORS[savedStatus]}" data-status="${savedStatus}" data-student-name="${studentName}">${savedStatus}</button>
            </div>
        `;
        attendanceStudentsList.appendChild(listItem);
    });
};

/**
 * Updates the attendance status button and justified checkbox.
 * @param {HTMLElement} button - The clicked status button.
 * @param {string} newStatus - The new attendance status.
 * @param {boolean} isJustifiedCheckboxEnabled - Whether the justified checkbox should be enabled.
 * @param {boolean} justifiedCheckboxChecked - Whether the justified checkbox should be checked.
 * @param {object} STATUS_COLORS - Mapping of status codes to CSS class names.
 * @param {Function} setUnsavedChangesFlag - Callback to set the unsaved changes flag.
 */
export const updateAttendanceControlsDOM = (button, newStatus, isJustifiedCheckboxEnabled, justifiedCheckboxChecked, STATUS_COLORS, setUnsavedChangesFlag) => {
    button.dataset.status = newStatus;
    button.textContent = newStatus;

    Object.values(STATUS_COLORS).forEach(cls => button.classList.remove(cls));
    button.classList.add(STATUS_COLORS[newStatus]);

    const listItem = button.closest('li');
    const justifiedCheckboxInput = listItem.querySelector('.justified-checkbox-container input[type="checkbox"]');
    const justifiedContainerLabel = listItem.querySelector('.justified-checkbox-container');

    if (justifiedCheckboxInput && justifiedContainerLabel) {
        justifiedCheckboxInput.disabled = !isJustifiedCheckboxEnabled;
        justifiedCheckboxInput.checked = justifiedCheckboxChecked; // Set checked state based on logic
        
        if (!isJustifiedCheckboxEnabled) {
            justifiedContainerLabel.classList.add('disabled-checkbox');
        } else {
            justifiedContainerLabel.classList.remove('disabled-checkbox');
        }
    }
    setUnsavedChangesFlag();
};

/**
 * Displays the student attendance history modal.
 * @param {string} studentName - The name of the student.
 * @param {Array<object>} historyData - Array of attendance records for the student (all unique dates, sorted most recent first).
 *                                     This data is pre-filtered to only include "recorded days" at the group level.
 * @param {HTMLElement} studentAttendanceHistoryModal - The modal element.
 * @param {HTMLElement} modalStudentAttendanceName - Element to display student's name in modal.
 * @param {HTMLElement} studentAttendanceHistoryTableBody - The tbody element of the history table.
 * @param {HTMLElement} noAttendanceMessage - Element to display if no records exist.
 */
export const showStudentAttendanceHistoryModal = (
    studentName,
    historyData,
    studentAttendanceHistoryModal,
    modalStudentAttendanceName,
    studentAttendanceHistoryTableBody,
    noAttendanceMessage
) => {
    modalStudentAttendanceName.textContent = studentName;
    // Add info button next to student name (once)
    const headerEl = modalStudentAttendanceName.closest('h2');
    if (headerEl && !headerEl.querySelector('.ahm-open-student-info')) {
        const btn = document.createElement('button');
        btn.className = 'ahm-open-student-info';
        btn.title = 'Información del alumno';
        btn.style.marginLeft = '8px';
        btn.style.border = 'none';
        btn.style.background = 'transparent';
        btn.style.cursor = 'pointer';
        btn.innerHTML = `<img src="info_icon.png" alt="Info" style="width:18px;height:18px;vertical-align:middle;">`;
        btn.addEventListener('click', () => {
            // Prefer the most recent record's groupKey; fallback to first available
            const chosen = Array.isArray(historyData) && historyData.length ? (historyData[0].groupKey || '') : '';
            if (chosen) sessionStorage.setItem('selectedGroupKey', chosen);
            sessionStorage.setItem('selectedStudentName', studentName);
            window.location.href = 'students.html';
        });
        headerEl.appendChild(btn);
    }
    studentAttendanceHistoryTableBody.innerHTML = '';

    const filterByLastDaysRadio = document.getElementById('filterByLastDays');
    const filterByDateRangeRadio = document.getElementById('filterByDateRange');
    const lastDaysFilterControls = document.getElementById('lastDaysFilterControls');
    const dateRangeFilterControls = document.getElementById('dateRangeFilterControls');

    const historyDaysSelect = document.getElementById('historyDaysSelect');
    const historyStatusSelect = document.getElementById('historyStatusSelect');
    const historyJustificationSelect = document.getElementById('historyJustificationSelect');
    const historyCountInfo = document.getElementById('historyCountInfo');
    const historyCountInfoDateRange = document.getElementById('historyCountInfoDateRange');
    const historyStartDateInput = document.getElementById('historyStartDate');
    const historyEndDateInput = document.getElementById('historyEndDate');
    const clearDateRangeFilterButton = document.getElementById('clearDateRangeFilterButton');

    const saveBtn = document.getElementById('studentAttendanceHistorySaveButton');
    let hasUnsaved = false;
    const setUnsaved = () => { hasUnsaved = true; if (saveBtn) saveBtn.disabled = false; };

    // Helper to toggle visibility/disabled state of filter controls
    const toggleFilterControls = () => {
        if (filterByLastDaysRadio.checked) {
            lastDaysFilterControls.style.display = 'flex';
            dateRangeFilterControls.style.display = 'none';
            historyDaysSelect.disabled = false;
            historyStartDateInput.disabled = true;
            historyEndDateInput.disabled = true;
            clearDateRangeFilterButton.disabled = true;

            // Show relevant count info, hide the other
            historyCountInfo.style.display = 'block';
            historyCountInfoDateRange.style.display = 'none';
        } else {
            lastDaysFilterControls.style.display = 'none';
            dateRangeFilterControls.style.display = 'flex';
            historyDaysSelect.disabled = true;
            historyStartDateInput.disabled = false;
            historyEndDateInput.disabled = false;
            clearDateRangeFilterButton.disabled = false;

            // Show relevant count info, hide the other
            historyCountInfo.style.display = 'none';
            historyCountInfoDateRange.style.display = 'block';
        }
        // Always enable/disable status/justification selects based on if any filter mode is active
        historyStatusSelect.disabled = false;
        historyJustificationSelect.disabled = false;
    };

    // Helper to render table rows based on selected filters and number of days/date range
    const renderTableForSelection = () => {
        studentAttendanceHistoryTableBody.innerHTML = '';

        let recordsAfterStatusAndJustificationFilter = historyData.slice(); // Start with a shallow copy of all student records

        // Apply global status and justification filters
        const statusFilter = historyStatusSelect ? historyStatusSelect.value : 'all';
        const justificationFilter = historyJustificationSelect ? historyJustificationSelect.value : 'all';

        if (statusFilter !== 'all') recordsAfterStatusAndJustificationFilter = recordsAfterStatusAndJustificationFilter.filter(r => r.status === statusFilter);
        if (justificationFilter === 'justified') recordsAfterStatusAndJustificationFilter = recordsAfterStatusAndJustificationFilter.filter(r => !!r.justified);
        // "Unjustified" only applies to 'A', 'R' or 'I' statuses
        // MODIFIED: Added 'I' to statuses
        if (justificationFilter === 'unjustified') recordsAfterStatusAndJustificationFilter = recordsAfterStatusAndJustificationFilter.filter(r => (r.status === 'A' || r.status === 'R' || r.status === 'E' || r.status === 'I') && !r.justified);

        let finalRecordsToShow = [];
        let showingCount = 0;
        let totalCountForDisplay = 0; // This will be our 'Y' value

        if (filterByLastDaysRadio.checked) {
            // Apply "Last N Days" filter
            const selectionValue = historyDaysSelect ? historyDaysSelect.value : '15';
            if (selectionValue === 'all') {
                finalRecordsToShow = recordsAfterStatusAndJustificationFilter;
            } else {
                const n = parseInt(selectionValue, 10);
                finalRecordsToShow = recordsAfterStatusAndJustificationFilter.slice(0, n);
            }

            showingCount = finalRecordsToShow.length;
            // Compute Y = total recorded days for the group(s) involved (days where at least one student != 'N')
            // We sum recorded days per group referenced in the student's historyData so Y reflects group-level recorded days,
            // not the count after applying the student's status/justification filters.
            const attendanceRecordsAll = getAttendanceRecords();
            const allGroupsList = getGroups();
            const uniqueGroupKeys = Array.from(new Set(historyData.map(r => r.groupKey)));
            let totalRecordedDaysSum = 0;
            uniqueGroupKeys.forEach(gk => {
                const groupAttendance = attendanceRecordsAll[gk] || {};
                const recordedDates = Object.keys(groupAttendance).filter(d => isGroupDateRecorded(gk, d, allGroupsList, attendanceRecordsAll));
                totalRecordedDaysSum += recordedDates.length;
            });
            totalCountForDisplay = totalRecordedDaysSum;
            historyCountInfo.textContent = `Mostrando ${showingCount} de ${totalCountForDisplay} días registrados`;
            historyCountInfoDateRange.textContent = ''; // Clear other count info
        } else { // filterByDateRangeRadio.checked
            // Apply "Date Range" filter
            const startDate = historyStartDateInput.value;
            const endDate = historyEndDateInput.value;

            // First, determine the total count (Y) for this date range from the original (non-status/justification filtered) historyData
            let recordsWithinDateRange = historyData.slice();
            if (startDate && endDate) {
                recordsWithinDateRange = recordsWithinDateRange.filter(record => record.date >= startDate && record.date <= endDate);
            } else if (startDate) {
                recordsWithinDateRange = recordsWithinDateRange.filter(record => record.date >= startDate);
            } else if (endDate) {
                recordsWithinDateRange = recordsWithinDateRange.filter(record => record.date <= endDate);
            }
            totalCountForDisplay = recordsWithinDateRange.length; // This is the new 'Y'

            // Now, apply date range filter to the status/justification filtered records to get 'X'
            let statusAndJustificationFilteredAndDateFilteredRecords = recordsAfterStatusAndJustificationFilter.slice();
            if (startDate && endDate) {
                statusAndJustificationFilteredAndDateFilteredRecords = statusAndJustificationFilteredAndDateFilteredRecords.filter(record => record.date >= startDate && record.date <= endDate);
            } else if (startDate) {
                statusAndJustificationFilteredAndDateFilteredRecords = statusAndJustificationFilteredAndDateFilteredRecords.filter(record => record.date >= startDate);
            } else if (endDate) {
                statusAndJustificationFilteredAndDateFilteredRecords = statusAndJustificationFilteredAndDateFilteredRecords.filter(record => record.date <= endDate);
            }
            finalRecordsToShow = statusAndJustificationFilteredAndDateFilteredRecords;
            
            showingCount = finalRecordsToShow.length; // This is the 'X'
            historyCountInfoDateRange.textContent = `Mostrando ${showingCount} de ${totalCountForDisplay} días registrados`;
            historyCountInfo.textContent = ''; // Clear other count info
        }

        if (finalRecordsToShow.length === 0) {
            noAttendanceMessage.style.display = 'block';
        } else {
            noAttendanceMessage.style.display = 'none';
            finalRecordsToShow.forEach(record => {
                const row = document.createElement('tr');
                // MODIFIED: Treat 'E' (Expulsado) and 'I' (Incidencia) as justification-relevant as well
                const isJR = (record.status === 'A' || record.status === 'R' || record.status === 'E' || record.status === 'I'); // Justified-relevant statuses (A, R, E, I)
                row.innerHTML = `
                    <td>${formatDatePretty(record.date)}</td>
                    <td>
                        <button class="attendance-status-button ${STATUS_COLORS[record.status]}"
                                data-status="${record.status}"
                                data-date="${record.date}"
                                data-group-key="${record.groupKey}"
                                data-student-name="${studentName}">${record.status}</button>
                    </td>
                    <td>
                        <label class="justified-checkbox-container ${isJR ? '' : 'disabled-checkbox'}">
                            <input type="checkbox"
                                   ${isJR ? '' : 'disabled'}
                                   ${record.justified ? 'checked' : ''}
                                   data-date="${record.date}"
                                   data-group-key="${record.groupKey}"
                                   data-student-name="${studentName}">
                            Justificado
                        </label>
                    </td>
                `;
                studentAttendanceHistoryTableBody.appendChild(row);
                // NEW: Long-press on date to open that day's attendance for the group
                const dateTd = row.querySelector('td:first-child');
                let lpTimer;
                const startLP = () => { lpTimer = setTimeout(() => {
                    try {
                        sessionStorage.setItem('selectedGroupKey', record.groupKey);
                        sessionStorage.setItem('selectedAttendanceDate', record.date);
                        window.location.href = 'attendance.html';
                    } catch(e) {}
                }, 600); };
                const cancelLP = () => { if (lpTimer) clearTimeout(lpTimer); };
                dateTd.addEventListener('mousedown', startLP);
                dateTd.addEventListener('touchstart', startLP, { passive: true });
                dateTd.addEventListener('mouseup', cancelLP);
                dateTd.addEventListener('mouseleave', cancelLP);
                dateTd.addEventListener('touchend', cancelLP);
            });
        }
        // Attach listeners for cycling statuses within the rendered rows
        studentAttendanceHistoryTableBody.querySelectorAll('.attendance-status-button').forEach(btn => {
            btn.onclick = () => {
                const { newStatus, isJustifiedCheckboxEnabled, justifiedCheckboxChecked } = cycleAttendanceStatus(btn.dataset.status);
                const listItem = btn.closest('tr');
                const chk = listItem.querySelector('input[type="checkbox"]');
                btn.dataset.status = newStatus;
                btn.textContent = newStatus;
                Object.values(STATUS_COLORS).forEach(cls => btn.classList.remove(cls));
                btn.classList.add(STATUS_COLORS[newStatus]);
                if (chk) {
                    chk.disabled = !isJustifiedCheckboxEnabled;
                    chk.checked = !!justifiedCheckboxChecked;
                    const label = chk.closest('.justified-checkbox-container');
                    if (label) {
                        if (!isJustifiedCheckboxEnabled) label.classList.add('disabled-checkbox');
                        else label.classList.remove('disabled-checkbox');
                    }
                }
                setUnsaved();
            };
        });
        studentAttendanceHistoryTableBody.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.onchange = () => setUnsaved();
        });
    };

    // Initialize: set select to default value (already set in HTML to 15). Render accordingly.
    const initialSelection = historyDaysSelect ? historyDaysSelect.value : '15';
    renderTableForSelection(initialSelection); // Call render with initial state

    // Attach change handler to update table when the user selects another option.
    if (historyDaysSelect) {
        // Remove any previous listener (defensive) by replacing the element's onchange
        historyDaysSelect.onchange = (e) => {
            renderTableForSelection();
        };
    }
    if (historyStatusSelect) {
        // MODIFIED: Ensure 'I' is an option
        historyStatusSelect.innerHTML = `
            <option value="all">Todas</option>
            <option value="A">Ausente (A)</option>
            <option value="R">Retraso (R)</option>
            <option value="P">Presente (P)</option>
            <option value="E">Expulsado (E)</option>
            <option value="I">Incidencia (I)</option>
            <option value="N">No indicado (N)</option>
        `;
        historyStatusSelect.onchange = () => renderTableForSelection();
    }
    if (historyJustificationSelect) {
        historyJustificationSelect.onchange = () => renderTableForSelection();
    }
    // NEW: Event listeners for filter mode radio buttons
    filterByLastDaysRadio.onchange = () => { toggleFilterControls(); renderTableForSelection(); };
    filterByDateRangeRadio.onchange = () => { toggleFilterControls(); renderTableForSelection(); };
    // NEW: Event listeners for date range inputs
    historyStartDateInput.onchange = () => renderTableForSelection();
    historyEndDateInput.onchange = () => renderTableForSelection();
    // NEW: Event listener for clear date range button
    clearDateRangeFilterButton.onclick = () => {
        historyStartDateInput.value = '';
        historyEndDateInput.value = '';
        renderTableForSelection();
    };

    // Initial toggle state
    toggleFilterControls();

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.onclick = () => {
            if (!hasUnsaved) return;
            const attendanceRecords = getAttendanceRecords();
            // Track which group/date combinations were modified so callers can refresh
            const modifiedKeys = new Set();
            studentAttendanceHistoryTableBody.querySelectorAll('tr').forEach(tr => {
                const btn = tr.querySelector('.attendance-status-button');
                const chk = tr.querySelector('input[type="checkbox"]');
                if (!btn) return;
                const groupKey = btn.dataset.groupKey;
                const date = btn.dataset.date;
                const sName = btn.dataset.studentName;
                const status = btn.dataset.status;
                const justified = chk && !chk.disabled ? chk.checked : false;
                if (!attendanceRecords[groupKey]) attendanceRecords[groupKey] = {};
                if (!attendanceRecords[groupKey][date]) attendanceRecords[groupKey][date] = {};
                attendanceRecords[groupKey][date][sName] = { status, justified };
                modifiedKeys.add(`${groupKey}::${date}`);
            });
            saveAttendanceRecords(attendanceRecords);
            hasUnsaved = false;
            saveBtn.disabled = true;
            modalAlert('Cambios de historial de asistencia guardados.');
            // Notify other parts of the app which group/date combos changed
            window.dispatchEvent(new CustomEvent('attendanceHistorySaved', { detail: { modified: Array.from(modifiedKeys) } }));
        };
    }

    // Listen for external saves and refresh this modal's data & rendering while it's open
    const attendanceHistorySavedHandler = (ev) => {
        // Rebuild historyData from storage to respect any external changes and keep filters
        historyData = getStudentAttendanceHistoryData(studentName);
        renderTableForSelection();
    };
    window.addEventListener('attendanceHistorySaved', attendanceHistorySavedHandler);

    studentAttendanceHistoryModal.style.display = 'flex';
};

/**
 * Hides the student attendance history modal.
 * @param {HTMLElement} studentAttendanceHistoryModal - The modal element.
 */
export const hideStudentAttendanceHistoryModal = (studentAttendanceHistoryModal) => {
    studentAttendanceHistoryModal.style.display = 'none';
    // Remove the listener added when showing the modal to avoid leaks
    try { window.removeEventListener('attendanceHistorySaved', attendanceHistorySavedHandler); } catch(e) { /* ignore */ }
};