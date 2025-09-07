import { getGroups, getSessionItem, removeSessionItem, getAllAppData, setSessionItem } from './utils/storage.js';
import { formatDate, formatDateTimeForFilename, addDays } from './utils/date-utils.js';
import { handleLoadBackup, handleSaveBackup } from './utils/backup-utils.js';
import {
    applyGroupColorToAttendancePage,
    renderGroupsDropdown,
    updateGroupInfoDisplay,
    renderStudentsForAttendance,
    updateAttendanceControlsDOM,
    showStudentAttendanceHistoryModal,     // added
    hideStudentAttendanceHistoryModal      // added
} from './attendance/attendance-dom.js';
import {
    ATTENDANCE_STATUSES,
    STATUS_COLORS,
    processAttendanceDataForDisplay,
    cycleAttendanceStatus,
    saveCurrentAttendance,
    getStudentAttendanceHistoryData,
    filterStudents
} from './attendance/attendance-logic.js';
import { modalAlert, modalConfirm } from './utils/backup-utils.js'; // NEW: use in-page modals

document.addEventListener('DOMContentLoaded', () => {
    const groupSelect = document.getElementById('groupSelect');
    const attendanceDateInput = document.getElementById('attendanceDate');
    const attendancePrevDayBtn = document.getElementById('attendancePrevDayBtn');
    const attendanceNextDayBtn = document.getElementById('attendanceNextDayBtn');
    const groupInfoDisplay = document.getElementById('groupInfoDisplay');
    const attendanceStudentsList = document.getElementById('attendanceStudentsList');
    const saveAttendanceButton = document.getElementById('saveAttendanceButton');
    const globalHomeButton = document.getElementById('globalHomeButton');
    const globalSaveButton = document.getElementById('globalSaveButton');
    const globalLoadButton = document.getElementById('globalLoadButton');
    const globalAgendaButton = document.getElementById('globalAgendaButton'); // NEW: Global Agenda Button
    const globalDailyLogButton = document.getElementById('globalDailyLogButton'); // NEW: Global Daily Log Button

    // NEW: Search and Mark All Present elements
    const searchStudentInput = document.getElementById('searchStudentInput');
    const markAllPresentButton = document.getElementById('markAllPresentButton');
    const markAllAbsentButton = document.getElementById('markAllAbsentButton'); // NEW: Mark All Absent button
    const markAllNotIndicatedButton = document.getElementById('markAllNotIndicatedButton'); // NEW: Mark All Not Indicated button

    // NEW: Attendance Status Filter elements
    const attendanceStatusFilterContainer = document.getElementById('attendanceStatusFilter');

    // NEW: Student Attendance History Modal Elements (moved into attendance.html)
    const studentAttendanceHistoryModal = document.getElementById('studentAttendanceHistoryModal');
    const closeStudentAttendanceHistoryModal = document.getElementById('closeStudentAttendanceHistoryModal');
    const modalStudentAttendanceName = document.getElementById('modalStudentAttendanceName');
    const studentAttendanceHistoryTableBody = document.getElementById('studentAttendanceHistoryTableBody');
    const noAttendanceHistoryMessage = document.getElementById('noAttendanceMessage');
    const attendanceHistoryPrevButton = document.getElementById('attendanceHistoryPrevButton'); // NEW
    const attendanceHistoryNextButton = document.getElementById('attendanceHistoryNextButton'); // NEW

    const pageBody = document.body;
    const pageH1 = document.querySelector('h1');

    // Apply group color but choose readable title color when the group color is very light/dark.
    const applyGroupColorSmart = (group, pageBodyEl, pageH1El) => {
        const hexToRgb = (hex) => {
            hex = (hex || '').replace('#', '');
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            const v = parseInt(hex, 16);
            return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
        };
        const rgbToHsl = ({ r, g, b }) => {
            r /= 255; g /= 255; b /= 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h = 0, s = 0, l = (max + min) / 2;
            if (max !== min) {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }
            return { h, s, l };
        };
        const hslToHex = ({ h, s, l }) => {
            let r, g, b;
            if (s === 0) { r = g = b = l; }
            else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }
            const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        };

        if (group && group.color) {
            if (pageBodyEl) pageBodyEl.style.backgroundColor = group.color;
            if (pageH1El) {
                const color = group.color;
                pageH1El.style.borderBottom = `2px solid ${color}`;
                // decide readable text color: if very light, pick darker variant with same hue;
                const rgb = hexToRgb(color);
                const { h, s, l } = rgbToHsl(rgb);
                if (l > 0.78) {
                    const darker = { h, s: Math.min(1, s * 1.05), l: Math.max(0.14, l * 0.28) };
                    pageH1El.style.color = hslToHex(darker);
                } else if (l < 0.25) {
                    // Use a lighter tone that preserves the group's hue/saturation instead of plain white
                    const lighter = { h, s: Math.max(0.05, s * 0.9), l: Math.min(0.92, l + 0.6) };
                    pageH1El.style.color = hslToHex(lighter);
                } else {
                    pageH1El.style.color = color;
                }
                pageH1El.style.paddingBottom = '10px';
                pageH1El.style.marginBottom = '20px';
            }
        } else {
            if (pageBodyEl) pageBodyEl.style.backgroundColor = '';
            if (pageH1El) {
                pageH1El.style.color = '';
                pageH1El.style.borderBottom = '';
                pageH1El.style.paddingBottom = '';
                pageH1El.style.marginBottom = '';
            }
        }
    };

    let allGroups = getGroups();
    let currentGroupKey = '';
    let currentDate = '';
    let currentSearchTerm = ''; // NEW: State for search term
    let currentStatusFilters = [...ATTENDANCE_STATUSES, 'all']; // NEW: State for status filters, initially all selected
    let hasUnsavedChanges = false; // NEW: Flag for unsaved changes

    // NEW: Store previous group/date for reverting if changes are cancelled
    let previousGroupKey = getSessionItem('selectedGroupKey');
    let previousDate = formatDate(new Date()); // Initialize with current date

    let currentHistoryStudentName = null; // NEW: track student for history modal navigation

    currentDate = formatDate(new Date());
    attendanceDateInput.value = currentDate;

    // NEW: Functions to manage the unsaved changes flag
    const setUnsavedChangesFlag = () => {
        hasUnsavedChanges = true;
    };
    const clearUnsavedChangesFlag = () => {
        hasUnsavedChanges = false;
    };

    /**
     * Filters an array of students by selected attendance statuses.
     * @param {Array<object>} students - The array of student objects.
     * @param {object} dailyAttendance - The attendance records for the current day.
     * @param {Array<string>} selectedStatuses - Array of status codes to filter by.
     * @returns {Array<object>} A new array with filtered students.
     */
    const filterStudentsByStatus = (students, dailyAttendance, selectedStatuses) => {
        if (selectedStatuses.includes('all')) {
            return students;
        }
        return students.filter(student => {
            const status = dailyAttendance[student.name] ? dailyAttendance[student.name].status : 'N';
            return selectedStatuses.includes(status);
        });
    };

    /**
     * Loads and displays students with their attendance status for the selected group and date,
     * applying the current search and status filters.
     */
    const loadStudentsForAttendance = () => {
        if (!currentGroupKey) {
            attendanceStudentsList.innerHTML = '<li class="no-students-message">Selecciona un grupo y una fecha para ver los alumnos.</li>';
            groupInfoDisplay.textContent = 'Selecciona un grupo para gestionar la asistencia.';
            saveAttendanceButton.disabled = true;
            markAllPresentButton.disabled = true; // NEW: Disable mark all button
            markAllAbsentButton.disabled = true; // NEW: Disable mark all absent button
            markAllNotIndicatedButton.disabled = true; // NEW: Disable mark all not indicated button
            return;
        }

        // Get all students for the group and their attendance for the day (before applying any filters)
        const { currentGroup, students: allGroupStudents, dailyAttendance } = processAttendanceDataForDisplay(currentGroupKey, currentDate, allGroups);

        if (!currentGroup) {
            attendanceStudentsList.innerHTML = '<li class="no-students-message">Grupo no encontrado.</li>';
            groupInfoDisplay.textContent = 'Grupo no encontrado.';
            saveAttendanceButton.disabled = true;
            markAllPresentButton.disabled = true; // NEW: Disable mark all button
            markAllAbsentButton.disabled = true; // NEW: Disable mark all absent button
            markAllNotIndicatedButton.disabled = true; // NEW: Disable mark all not indicated button
            return;
        }

        // 1. Apply search filter
        const searchedStudents = filterStudents(allGroupStudents, currentSearchTerm);

        // 2. Apply status filter
        const filteredStudents = filterStudentsByStatus(searchedStudents, dailyAttendance, currentStatusFilters);

        updateGroupInfoDisplay(currentGroup, currentDate, groupInfoDisplay);
        // renderStudentsForAttendance now receives already filtered students
        renderStudentsForAttendance(filteredStudents, dailyAttendance, attendanceStudentsList, saveAttendanceButton, STATUS_COLORS, setUnsavedChangesFlag);
        
        // NEW: Enable markAllPresentButton and markAllAbsentButton only if there are students to mark
        markAllPresentButton.disabled = filteredStudents.length === 0;
        markAllAbsentButton.disabled = filteredStudents.length === 0; // NEW: Enable/disable mark all absent button
        markAllNotIndicatedButton.disabled = filteredStudents.length === 0; // NEW: Enable/disable mark all not indicated button
    };

    /**
     * Initializes the groups dropdown and handles initial group selection.
     */
    const initializeAttendancePage = () => {
        // Check for student history request from another page
        const studentNameForHistory = getSessionItem('selectedStudentNameForHistory');
        const groupKeyForHistory = getSessionItem('selectedGroupKeyForHistory'); // Check for specific history group key

        if (studentNameForHistory && groupKeyForHistory) {
            currentGroupKey = groupKeyForHistory;
            // IMPORTANT: DO NOT clear history session items here. They are cleared after modal opens.
            // Re-set selectedGroupKey so group select dropdown shows the correct group
            setSessionItem('selectedGroupKey', currentGroupKey); 
        } else {
            currentGroupKey = getSessionItem('selectedGroupKey');
        }

        renderGroupsDropdown(
            allGroups,
            currentGroupKey, // Use potentially updated currentGroupKey
            groupSelect,
            groupInfoDisplay,
            attendanceStudentsList,
            saveAttendanceButton,
            () => { // Callback for when group is selected in dropdown or from session
                currentGroupKey = groupSelect.value;
                previousGroupKey = currentGroupKey; // Set initial previous key
                const selectedGroup = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === currentGroupKey);
                applyGroupColorSmart(selectedGroup, pageBody, pageH1);
                populateAttendanceStatusFilter(); // Populate status filters
                loadStudentsForAttendance();
            }
        );
        // If a group was pre-selected, apply its color and load students
        if (groupSelect.value) {
            currentGroupKey = groupSelect.value;
            previousGroupKey = currentGroupKey; // Set initial previous key
            const selectedGroup = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === currentGroupKey);
            applyGroupColorSmart(selectedGroup, pageBody, pageH1);
            populateAttendanceStatusFilter(); // Populate status filters
            loadStudentsForAttendance();
        } else {
            applyGroupColorSmart(null, pageBody, pageH1); // No group selected initially
            populateAttendanceStatusFilter(); // Populate filters even with no group selected
        }
    };

    // NEW: Function to populate the attendance status filter checkboxes
    const populateAttendanceStatusFilter = () => {
        attendanceStatusFilterContainer.innerHTML = '';

        // "Todas" option
        const allCheckboxId = 'status-all';
        const allInput = document.createElement('input');
        allInput.type = 'checkbox';
        allInput.id = allCheckboxId;
        allInput.value = 'all';
        allInput.checked = currentStatusFilters.includes('all'); // Initialize checked state
        const allLabel = document.createElement('label');
        allLabel.htmlFor = allCheckboxId;
        allLabel.textContent = 'Todas';
        attendanceStatusFilterContainer.appendChild(allInput);
        attendanceStatusFilterContainer.appendChild(allLabel);

        // Individual status options
        ATTENDANCE_STATUSES.forEach(status => {
            const statusId = `status-${status}`;
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = statusId;
            input.value = status;
            input.checked = currentStatusFilters.includes(status); // Initialize checked state
            const label = document.createElement('label');
            label.htmlFor = statusId;
            label.textContent = status;
            attendanceStatusFilterContainer.appendChild(input);
            attendanceStatusFilterContainer.appendChild(label);
        });

        // Add change listener to the container for delegation
        attendanceStatusFilterContainer.addEventListener('change', (event) => {
            const changedCheckbox = event.target;
            if (changedCheckbox.type !== 'checkbox') return;

            const isAllCheckbox = changedCheckbox.value === 'all';
            currentStatusFilters = Array.from(attendanceStatusFilterContainer.querySelectorAll('input[type="checkbox"]'))
                .filter(cb => cb.checked)
                .map(cb => cb.value);

            if (isAllCheckbox) {
                // If "Todas" is checked, uncheck all others and set currentStatusFilters to ['all']
                if (changedCheckbox.checked) {
                    Array.from(attendanceStatusFilterContainer.querySelectorAll('input[type="checkbox"]')).forEach(cb => {
                        if (cb !== changedCheckbox) cb.checked = false;
                    });
                    currentStatusFilters = ['all'];
                } else {
                    // If "Todas" is unchecked, but it was the only one checked, check all others by default
                    if (currentStatusFilters.length === 0) {
                        Array.from(attendanceStatusFilterContainer.querySelectorAll('input[type="checkbox"]')).forEach(cb => {
                            if (cb.value !== 'all') cb.checked = true;
                        });
                        currentStatusFilters = [...ATTENDANCE_STATUSES]; // All except 'all'
                    }
                }
            } else {
                // If an individual status is checked/unchecked
                const allCheckbox = attendanceStatusFilterContainer.querySelector('input[value="all"]');
                if (changedCheckbox.checked && allCheckbox.checked) {
                    // If individual is checked and 'all' was checked, uncheck 'all'
                    allCheckbox.checked = false;
                    currentStatusFilters = currentStatusFilters.filter(s => s !== 'all');
                } else if (!changedCheckbox.checked && currentStatusFilters.length === 0) {
                    // If all individual statuses are unchecked, check 'all'
                    allCheckbox.checked = true;
                    currentStatusFilters = ['all'];
                }
                
                // If 'all' is currently selected but another individual checkbox is clicked, switch to individual
                if (allCheckbox.checked && !isAllCheckbox && changedCheckbox.checked) {
                    allCheckbox.checked = false;
                    currentStatusFilters = currentStatusFilters.filter(s => s !== 'all');
                    currentStatusFilters.push(changedCheckbox.value);
                } else if (currentStatusFilters.length === ATTENDANCE_STATUSES.length && !allCheckbox.checked) {
                    // If all individual statuses are checked, ensure 'all' is selected and others are deselected.
                    allCheckbox.checked = true;
                    Array.from(attendanceStatusFilterContainer.querySelectorAll('input[type="checkbox"]')).forEach(cb => {
                        if (cb.value !== 'all') cb.checked = false;
                    });
                    currentStatusFilters = ['all'];
                } else if (currentStatusFilters.length === 0 && !allCheckbox.checked) {
                    // if all checkboxes (incl. 'all') are unchecked, fall back to 'all' being checked
                    allCheckbox.checked = true;
                    currentStatusFilters = ['all'];
                }
            }
            loadStudentsForAttendance();
        });
    };

    groupSelect.addEventListener('change', async (event) => {
        const newGroupKey = event.target.value;
        if (hasUnsavedChanges) {
            const proceed = await modalConfirm('Tienes cambios sin guardar para la asistencia de este día. ¿Estás seguro de que quieres cambiar de grupo sin guardar?');
            if (!proceed) {
                event.target.value = previousGroupKey; // Revert selection
                return;
            }
        }
        currentGroupKey = newGroupKey;
        previousGroupKey = newGroupKey; // Update previous key for next change
        setSessionItem('selectedGroupKey', currentGroupKey); // Persist selection
        const selectedGroup = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === currentGroupKey);
        applyGroupColorSmart(selectedGroup, pageBody, pageH1);
        clearUnsavedChangesFlag(); // Changes are effectively discarded if user confirms, or saved if they click the button before changing group.
        loadStudentsForAttendance();
    });

    attendanceDateInput.addEventListener('change', async (event) => {
        const newDate = event.target.value;
        if (hasUnsavedChanges) {
            const proceed = await modalConfirm('Tienes cambios sin guardar para la asistencia de este día. ¿Estás seguro de que quieres cambiar de fecha sin guardar?');
            if (!proceed) {
                event.target.value = currentDate; // Revert date input
                return;
            }
        }
        currentDate = newDate;
        previousDate = newDate; // Update previous date
        clearUnsavedChangesFlag(); // Clear flag if user confirms discarding or saving prior to changing date
        loadStudentsForAttendance();
    });

    // Prev / Next day buttons for the date selector
    if (attendancePrevDayBtn) attendancePrevDayBtn.addEventListener('click', async () => {
        const target = formatDate(addDays(attendanceDateInput.value, -1));
        if (hasUnsavedChanges) {
            const proceed = await modalConfirm('Tienes cambios sin guardar para la asistencia de este día. ¿Estás seguro de que quieres cambiar de fecha sin guardar?');
            if (!proceed) return;
        }
        attendanceDateInput.value = target; currentDate = target; previousDate = target; clearUnsavedChangesFlag(); loadStudentsForAttendance();
    });
    if (attendanceNextDayBtn) attendanceNextDayBtn.addEventListener('click', async () => {
        const target = formatDate(addDays(attendanceDateInput.value, 1));
        if (hasUnsavedChanges) {
            const proceed = await modalConfirm('Tienes cambios sin guardar para la asistencia de este día. ¿Estás seguro de que quieres cambiar de fecha sin guardar?');
            if (!proceed) return;
        }
        attendanceDateInput.value = target; currentDate = target; previousDate = target; clearUnsavedChangesFlag(); loadStudentsForAttendance();
    });

    // NEW: Search input event listener
    searchStudentInput.addEventListener('input', (event) => {
        // Search filter changes don't discard attendance data, so no warning needed.
        currentSearchTerm = event.target.value.trim();
        loadStudentsForAttendance(); // Reload students with the new filter
    });

    attendanceStudentsList.addEventListener('click', (event) => {
        const button = event.target.closest('.attendance-status-button');
        const studentNameSpan = event.target.closest('.student-name');

        if (button) {
            let currentStatus = button.dataset.status;
            const { newStatus, isJustifiedCheckboxEnabled, justifiedCheckboxChecked } = cycleAttendanceStatus(currentStatus);
            updateAttendanceControlsDOM(button, newStatus, isJustifiedCheckboxEnabled, justifiedCheckboxChecked, STATUS_COLORS, setUnsavedChangesFlag);
        } else if (studentNameSpan) {
            // Open attendance history modal for this student (works from Attendance page)
            const studentName = studentNameSpan.textContent.trim();
            // Use the DOM helper to render and show the modal
            if (studentAttendanceHistoryModal && modalStudentAttendanceName && studentAttendanceHistoryTableBody && noAttendanceHistoryMessage) {
                currentHistoryStudentName = studentName; // NEW: Set context for navigation
                const historyData = getStudentAttendanceHistoryData(studentName);
                showStudentAttendanceHistoryModal(
                    studentName,
                    historyData,
                    studentAttendanceHistoryModal,
                    modalStudentAttendanceName,
                    studentAttendanceHistoryTableBody,
                    noAttendanceHistoryMessage
                );
            } else {
                // Fallback: alert the user if modal elements not present
                alert('No se pudo abrir el historial de asistencia (elementos modal ausentes).');
            }
        }
    });

    // NEW: Add event listener for justified checkboxes using delegation
    attendanceStudentsList.addEventListener('change', (event) => {
        const checkbox = event.target.closest('.justified-checkbox-container input[type="checkbox"]');
        if (checkbox) {
            setUnsavedChangesFlag();
        }
    });

    saveAttendanceButton.addEventListener('click', async () => {
        if (hasUnsavedChanges) {
            saveCurrentAttendance(currentGroupKey, currentDate, attendanceStudentsList, clearUnsavedChangesFlag); // NEW: Pass clearUnsavedChangesFlag
        } else {
            await modalAlert('No se detectaron cambios pendientes para registrar.');
        }
    });

    // NEW: Mark all as Present button event listener
    markAllPresentButton.addEventListener('click', async () => {
        if (!currentGroupKey || !currentDate) {
            await modalAlert('Por favor, selecciona un grupo y una fecha primero.');
            return;
        }

        const proceed = await modalConfirm('¿Estás seguro de que quieres marcar a todos los alumnos visibles como Presentes (P) para esta fecha? Los cambios se aplicarán en la lista pero no se guardarán permanentemente hasta que pulses "Registrar Asistencia".');
        if (!proceed) return;

        Array.from(attendanceStudentsList.children).forEach(listItem => {
            if (listItem.classList.contains('no-students-message')) return;

            const statusButton = listItem.querySelector('.attendance-status-button');
            if (statusButton) {
                // Force status to 'P', which disables and unchecks justified checkbox
                // NEW: Pass setUnsavedChangesFlag
                updateAttendanceControlsDOM(statusButton, 'P', false, false, STATUS_COLORS, setUnsavedChangesFlag);
            }
        });
        // Removed direct call to saveCurrentAttendance. User must click saveAttendanceButton explicitly.
    });

    // NEW: Mark all as Absent button event listener
    markAllAbsentButton.addEventListener('click', async () => {
        if (!currentGroupKey || !currentDate) {
            await modalAlert('Por favor, selecciona un grupo y una fecha primero.');
            return;
        }

        const proceed = await modalConfirm('¿Estás seguro de que quieres marcar a todos los alumnos visibles como Ausentes (A) para esta fecha? Los cambios se aplicarán en la lista pero no se guardarán permanentemente hasta que pulses "Registrar Asistencia".');
        if (!proceed) return;

        Array.from(attendanceStudentsList.children).forEach(listItem => {
            if (listItem.classList.contains('no-students-message')) return;

            const statusButton = listItem.querySelector('.attendance-status-button');
            if (statusButton) {
                // Force status to 'A', which enables justified checkbox (unchecked by default)
                // NEW: Pass setUnsavedChangesFlag
                updateAttendanceControlsDOM(statusButton, 'A', true, false, STATUS_COLORS, setUnsavedChangesFlag);
            }
        });
        // Removed direct call to saveCurrentAttendance. User must click saveAttendanceButton explicitly.
    });

    // NEW: Mark all as Not Indicated button event listener
    markAllNotIndicatedButton.addEventListener('click', async () => {
        if (!currentGroupKey || !currentDate) {
            await modalAlert('Por favor, selecciona un grupo y una fecha primero.');
            return;
        }

        const proceed = await modalConfirm('¿Estás seguro de que quieres marcar a todos los alumnos visibles como No Indicados (N) para esta fecha? Los cambios se aplicarán en la lista pero no se guardarán permanentemente hasta que pulses "Guardar".');
        if (!proceed) return;

        Array.from(attendanceStudentsList.children).forEach(listItem => {
            if (listItem.classList.contains('no-students-message')) return;

            const statusButton = listItem.querySelector('.attendance-status-button');
            if (statusButton) {
                // Force status to 'N', which disables and unchecks justified checkbox
                updateAttendanceControlsDOM(statusButton, 'N', false, false, STATUS_COLORS, setUnsavedChangesFlag);
            }
        });
    });

    // NEW: Add a general navigation handler to check for unsaved changes
    const handleNavigation = async (event, url) => {
        if (hasUnsavedChanges) {
            const proceed = await modalConfirm('Tienes cambios sin guardar en la asistencia. ¿Estás seguro de que quieres salir sin guardar?', 'Advertencia de cambios');
            if (!proceed) {
                event.preventDefault(); // Stop navigation
                return false;
            }
        }
        clearUnsavedChangesFlag(); // Clear flag if proceeding with navigation (or if no changes)
        if (url) window.location.href = url;
        return true;
    };

    // Replace browser beforeunload prompt with custom modal logic for page navigation.
    // For `beforeunload`, `event.preventDefault()` and `event.returnValue` can't display custom UI.
    // So, we wrap direct navigation events with `handleNavigation`.
    // The `beforeunload` listener is removed to avoid native dialog.
    window.addEventListener('beforeunload', (event) => {
        if (hasUnsavedChanges) {
            // This will trigger the native browser warning dialog.
            // We cannot display a custom modal during `beforeunload`.
            // The modalConfirm logic is for *internal* navigation within the app.
            event.preventDefault(); // For Chrome and Firefox
            event.returnValue = ''; // For older browsers
        }
    });

    // Close handler for the attendance history modal
    if (closeStudentAttendanceHistoryModal) {
        closeStudentAttendanceHistoryModal.addEventListener('click', () => {
            hideStudentAttendanceHistoryModal(studentAttendanceHistoryModal);
            currentHistoryStudentName = null; // NEW: Clear context on close
            // If history modal saved changes, refresh visible attendance immediately
            if (window._attendanceHistorySaved) { loadStudentsForAttendance(); window._attendanceHistorySaved = false; }
        });
    }
    // Click outside to close the modal
    window.addEventListener('click', (event) => {
        if (event.target === studentAttendanceHistoryModal) {
            hideStudentAttendanceHistoryModal(studentAttendanceHistoryModal);
            currentHistoryStudentName = null; // NEW: Clear context on close
            if (window._attendanceHistorySaved) { loadStudentsForAttendance(); window._attendanceHistorySaved = false; }
        }
    });

    // Listen for saves coming from the history modal and mark a flag so close handlers will refresh
    window.addEventListener('attendanceHistorySaved', (e) => {
        // Set a short-lived flag indicating the modal made changes; the modal-close logic will refresh.
        window._attendanceHistorySaved = true;
    });

    // NEW: Navigation for attendance history modal
    const navigateToAdjacentStudentHistory = (direction) => {
        if (!currentHistoryStudentName) return;

        const currentViewStudents = attendanceStudentsList.querySelectorAll('li:not(.no-students-message)');
        const viewStudentsNames = Array.from(currentViewStudents).map(li => li.dataset.studentName);

        const currentIndex = viewStudentsNames.findIndex(name => name === currentHistoryStudentName);
        if (currentIndex === -1) return;

        const newIndex = currentIndex + direction;
        if (newIndex < 0 || newIndex >= viewStudentsNames.length) return; // No wrap-around

        const newStudentName = viewStudentsNames[newIndex];
        currentHistoryStudentName = newStudentName; // Update context

        const historyData = getStudentAttendanceHistoryData(newStudentName);
        showStudentAttendanceHistoryModal(
            newStudentName,
            historyData,
            studentAttendanceHistoryModal,
            modalStudentAttendanceName,
            studentAttendanceHistoryTableBody,
            noAttendanceHistoryMessage
        );
    };

    if (attendanceHistoryPrevButton) {
        attendanceHistoryPrevButton.addEventListener('click', () => navigateToAdjacentStudentHistory(-1));
    }
    if (attendanceHistoryNextButton) {
        attendanceHistoryNextButton.addEventListener('click', () => navigateToAdjacentStudentHistory(1));
    }

    // Ensure global shortcut buttons navigate / trigger backups (fix for non-working round buttons)
    if (globalHomeButton) {
        globalHomeButton.style.cursor = 'pointer';
        globalHomeButton.addEventListener('click', async (event) => { await handleNavigation(event, 'index.html'); });
    }
    if (globalAgendaButton) {
        globalAgendaButton.addEventListener('click', async (event) => { await handleNavigation(event, 'agenda.html'); });
    }
    if (globalDailyLogButton) {
        globalDailyLogButton.addEventListener('click', async (event) => { await handleNavigation(event, 'daily_log.html'); });
    }
    if (globalSaveButton) {
        // support both <button> and <div> elements used in templates
        globalSaveButton.addEventListener('click', () => { handleSaveBackup(); });
    }
    if (globalLoadButton) {
        globalLoadButton.addEventListener('click', () => { handleLoadBackup(); });
    }

    initializeAttendancePage();

    // If a student was passed from another page (e.g., students.html) to show attendance history
    const studentNameFromSession = getSessionItem('selectedStudentNameForHistory');
    if (studentNameFromSession) {
        removeSessionItem('selectedStudentNameForHistory'); // Clear after reading
        removeSessionItem('selectedGroupKeyForHistory'); // Clear after reading
        // Ensure currentHistoryStudentName is set for modal navigation
        currentHistoryStudentName = studentNameFromSession;
        // The modal should open
        const historyData = getStudentAttendanceHistoryData(studentNameFromSession);
        showStudentAttendanceHistoryModal(
            studentNameFromSession,
            historyData,
            studentAttendanceHistoryModal,
            modalStudentAttendanceName,
            studentAttendanceHistoryTableBody,
            noAttendanceHistoryMessage
        );
    }
});