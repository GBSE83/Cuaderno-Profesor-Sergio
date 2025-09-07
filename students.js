import { getGroups, saveGroups, getAllAppData, getStudentsSortOrder, saveStudentsSortOrder, getAttendanceRecords, saveAttendanceRecords, setSessionItem, removeSessionItem } from './utils/storage.js';
import { formatDateTimeForFilename, formatDate, formatDatePretty, addDays } from './utils/date-utils.js';
import { handleLoadBackup, handleSaveBackup } from './utils/backup-utils.js';
import {
    applyGroupColorToStudentsPage,
    updateGroupTitleDisplay,
    renderStudentsList,
    renderNoStudentsMessage,
    populateStudentInfoModal,
    populateStudentNameEditSection,
    showStudentInfoModal,
    hideStudentInfoModal,
    clearDragDropClasses
} from './students/students-dom.js';
import {
    ensureStudentDetails, // Now from utils
    splitFullName,        // Now from utils
    sortStudents,         // Now from utils
    filterStudents,       // Now from utils
    calculateAbsencesCount // Now from utils
} from './students/students-utils.js';
import {
    addStudent as apiAddStudent,
    loadStudentsFromText as apiLoadStudentsFromText,
    deleteStudent as apiDeleteStudent,
    moveStudentToGroup as apiMoveStudentToGroup,
    saveStudentDetails as apiSaveStudentDetails,
    updateStudentName as apiUpdateStudentName,
    reorderStudents as apiReorderStudents
} from './students/students-api.js';
import {
    showStudentGradesHistoryModal, // NEW: Import from grades-history-modal.js
    hideStudentGradesHistoryModal  // NEW: Import from grades-history-modal.js
} from './utils/grades-history-modal.js';
// NEW IMPORTS for attendance history modal
import { ATTENDANCE_STATUSES, STATUS_COLORS, cycleAttendanceStatus, getStudentAttendanceHistoryData } from './attendance/attendance-logic.js';
import { showStudentAttendanceHistoryModal, hideStudentAttendanceHistoryModal } from './attendance/attendance-dom.js';

document.addEventListener('DOMContentLoaded', () => {
    const groupTitle = document.getElementById('groupTitle');
    const studentsList = document.getElementById('studentsList');
    const addStudentForm = document.getElementById('addStudentForm');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const loadStudentsForm = document.getElementById('loadStudentsForm');
    const studentsTextList = document.getElementById('studentsTextList');
    const backToGroupsButton = document.getElementById('backToGroupsButton');
    const globalHomeButton = document.getElementById('globalHomeButton');
    const globalSaveButton = document.getElementById('globalSaveButton');
    const globalLoadButton = document.getElementById('globalLoadButton');
    const globalAgendaButton = document.getElementById('globalAgendaButton'); // NEW: Global Agenda Button
    const globalDailyLogButton = document.getElementById('globalDailyLogButton'); // NEW: Global Daily Log Button

    const sortSelect = document.getElementById('sortSelect');
    const searchInput = document.getElementById('searchInput');
    // NEW: Characteristics filter elements
    const filterACNEE = document.getElementById('filterACNEE');
    const filterCOMPE = document.getElementById('filterCOMPE');
    const filterREPET = document.getElementById('filterREPET');
    const filterADAPT = document.getElementById('filterADAPT');

    // NEW: Add click listeners for new characteristic buttons
    const charButtons = [
        document.getElementById('charACNEE'),
        document.getElementById('charCOMPE'),
        document.getElementById('charREPET'),
        document.getElementById('charADAPT')
    ];
    charButtons.forEach(button => {
        if (button) {
            button.addEventListener('click', () => {
                button.classList.toggle('active');
            });
        }
    });

    // NEW: Classification filter elements
    const classificationTypeFilterSelect = document.getElementById('classificationTypeFilterSelect');
    const classificationDescriptionFilterInput = document.getElementById('classificationDescriptionFilterInput');
    const clearClassificationFilterButton = document.getElementById('clearClassificationFilterButton');

    // Add search input listener so the student filter works in the group management page
    searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.trim();
        loadStudents();
    });
    // Listen characteristic filters and reload list
    [filterACNEE, filterCOMPE, filterREPET, filterADAPT].forEach(chk => {
        if (chk) chk.addEventListener('change', () => loadStudents());
    });

    const pageBody = document.body;
    const pageH1 = document.getElementById('groupTitle');

    const studentInfoModal = document.getElementById('studentInfoModal');
    const closeStudentInfoModal = document.getElementById('closeStudentInfoModal');
    const modalStudentInfoName = document.getElementById('modalStudentInfoName');

    // NEW: Elements for editing student name
    const editStudentNameSection = document.getElementById('editStudentNameSection');
    const modalEditFirstName = document.getElementById('modalEditFirstName');
    const modalEditLastName = document.getElementById('modalEditLastName');
    const saveStudentNameButton = document.getElementById('saveStudentNameButton');
    const cancelEditNameButton = document.getElementById('cancelEditNameButton');

    // NEW: Elements for changing student group within the modal
    const modalChangeGroupSelect = document.getElementById('modalChangeGroupSelect');
    const confirmMoveStudentButton = document.getElementById('confirmMoveStudentButton');

    // Existing elements for viewing/editing student details
    const viewStudentDetailsSection = document.getElementById('viewStudentDetailsSection');
    const modalStudentObservations = document.getElementById('modalStudentObservations');
    const charACNEE = document.getElementById('charACNEE');
    const charCOMPE = document.getElementById('charCOMPE');
    const charREPET = document.getElementById('charREPET');
    const charADAPT = document.getElementById('charADAPT');
    const totalFaltasDisplay = document.getElementById('totalFaltasCount');
    const saveStudentDetailsButton = document.getElementById('saveStudentDetailsButton');
    const viewAttendanceHistoryButton = document.getElementById('viewAttendanceHistoryButton'); // NEW: View Attendance History Button
    const viewGradesHistoryButton = document.getElementById('viewGradesHistoryButton'); // NEW: View Grades History Button

    // NEW: Classification elements
    const classificationList = document.getElementById('classificationList'); // New reference for classification list

    // NEW: Move student warning modal elements
    const moveStudentWarningModal = document.getElementById('moveStudentWarningModal');
    const moveWarningMessage = document.getElementById('moveWarningMessage');
    const continueMoveButton = document.getElementById('continueMoveButton');
    const createReportButton = document.getElementById('createReportButton');
    const cancelMoveButton = document.getElementById('cancelMoveButton');
    const closeMoveStudentWarningModal = document.getElementById('closeMoveStudentWarningModal');

    // NEW: Student Grades History Modal Elements (duplicated from grade_activity.html)
    const studentGradesHistoryModal = document.getElementById('studentGradesHistoryModal');
    const closeStudentGradesHistoryModal = document.getElementById('closeStudentGradesHistoryModal');
    const modalStudentGradesName = document.getElementById('modalStudentGradesName');
    const studentGradesHistoryTableBody = document.getElementById('studentGradesHistoryTableBody');
    const noGradesMessage = document.getElementById('noGradesMessage');

    const studentPrevButton = document.getElementById('studentPrevButton');
    const studentNextButton = document.getElementById('studentNextButton');

    const selectedGroupKey = sessionStorage.getItem('selectedGroupKey');
    let currentGroup = null;
    let allGroups = getGroups(); // Load groups initially

    let currentSortOrder = getStudentsSortOrder();
    let currentSearchTerm = '';
    // NEW: State for classification filter
    let currentClassificationTypeFilter = 'all';
    let currentClassificationDescriptionFilter = '';

    if (selectedGroupKey) {
        currentGroup = allGroups.find(group => {
            const groupKey = `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}`;
            return groupKey === selectedGroupKey;
        });
    }

    if (!currentGroup) {
        alert('No se ha seleccionado ningún grupo o el grupo no existe.');
        window.location.href = 'groups.html';
        return;
    }

    applyGroupColorToStudentsPage(currentGroup, pageBody, pageH1);
    updateGroupTitleDisplay(currentGroup, groupTitle);

    let draggedStudentItem = null;
    let currentModalStudentName = null; // Stores the student name for the studentInfoModal
    let studentToMoveName = null; // Stores the student name for the move warning modal
    let targetGroupKeyForMove = null; // Stores the target group key for the move warning modal

    // Refactored to use saveGroups from storage directly or pass as callback where needed
    const saveAllGroupsLocal = () => {
        saveGroups(allGroups);
    };

    // NEW: Function to populate the classification type filter dropdown
    const populateClassificationTypeFilter = () => {
        classificationTypeFilterSelect.innerHTML = '<option value="all">Todos los tipos</option>';
        if (currentGroup && currentGroup.classificationTypes) {
            // Sort classification types alphabetically
            const sortedTypes = [...currentGroup.classificationTypes].sort();
            sortedTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                classificationTypeFilterSelect.appendChild(option);
            });
        }
        classificationTypeFilterSelect.value = currentClassificationTypeFilter;
    };

    const loadStudents = () => {
        // Ensure all students have the necessary 'details' structure
        currentGroup.students.forEach(ensureStudentDetails);

        const sortedStudents = sortStudents(currentGroup.students, currentSortOrder);
        let finalFilteredStudents = filterStudents(sortedStudents, currentSearchTerm);
        
        // Apply characteristics filters (if any checked, require student to have ALL selected characteristics)
        const activeChars = [];
        if (filterACNEE && filterACNEE.checked) activeChars.push('ACNEE');
        if (filterCOMPE && filterCOMPE.checked) activeChars.push('COMPE');
        if (filterREPET && filterREPET.checked) activeChars.push('REPET');
        if (filterADAPT && filterADAPT.checked) activeChars.push('ADAPT');
        finalFilteredStudents = activeChars.length ? finalFilteredStudents.filter(s => {
            const ch = (s.details && s.details.characteristics) || {};
            return activeChars.every(c => !!ch[c]);
        }) : finalFilteredStudents;

        // NEW: Apply classification filter
        if (currentClassificationTypeFilter !== 'all' || currentClassificationDescriptionFilter !== '') {
            finalFilteredStudents = finalFilteredStudents.filter(s => {
                const classifications = (s.details && s.details.classifications) || [];
                // Case 1: Filter by specific type and (optional) description
                if (currentClassificationTypeFilter !== 'all') {
                    const matchedClassification = classifications.find(c => c.type === currentClassificationTypeFilter);
                    if (matchedClassification) {
                        if (currentClassificationDescriptionFilter) {
                            return (matchedClassification.description || '').toLowerCase().includes(currentClassificationDescriptionFilter.toLowerCase());
                        }
                        return true; // Match by type only
                    }
                    return false;
                }
                // Case 2: Filter by description across all types (if type filter is 'all')
                else if (currentClassificationDescriptionFilter !== '') {
                    return classifications.some(c => (c.description || '').toLowerCase().includes(currentClassificationDescriptionFilter.toLowerCase()));
                }
                return true; // No classification filters applied
            });
        }

        if (!finalFilteredStudents || finalFilteredStudents.length === 0) {
            renderNoStudentsMessage(studentsList);
        } else {
            renderStudentsList(finalFilteredStudents, selectedGroupKey, studentsList, currentSortOrder);
        }

        sortSelect.value = currentSortOrder;
        populateClassificationTypeFilter(); // <-- NEW: Update classification filter options
    };

    // Helper to hide both sections of the studentInfoModal when closing
    const hideStudentInfoModalSections = () => {
        editStudentNameSection.style.display = 'none';
        viewStudentDetailsSection.style.display = 'none';
        currentModalStudentName = null; // Clear context
    };

    // Helper to hide the moveStudentWarningModal
    const hideMoveStudentWarningModal = () => {
        moveStudentWarningModal.style.display = 'none';
        studentToMoveName = null; // Clear context
        targetGroupKeyForMove = null; // Clear context
    };

    // General hide function for all modals
    const hideAllModals = () => {
        hideStudentInfoModal(studentInfoModal);
        hideStudentInfoModalSections(); // Also reset sections
        hideMoveStudentWarningModal();
        hideStudentGradesHistoryModal(studentGradesHistoryModal); // NEW: Hide grades history modal
    };

    addStudentForm.addEventListener('submit', (event) => {
        event.preventDefault();
        apiAddStudent(
            firstNameInput.value,
            lastNameInput.value,
            currentGroup,
            saveAllGroupsLocal,
            loadStudents,
            firstNameInput,
            lastNameInput
        );
    });

    loadStudentsForm.addEventListener('submit', (event) => {
        event.preventDefault();
        apiLoadStudentsFromText(studentsTextList.value.trim(), currentGroup, saveAllGroupsLocal, loadStudents, studentsTextList);
    });

    studentsList.addEventListener('click', (event) => {
        const target = event.target;

        if (target.classList.contains('delete-button')) {
            const studentIndex = parseInt(target.dataset.studentIndex);
            // Get student name from the filtered/sorted list being displayed
            const studentName = (filterStudents(sortStudents(currentGroup.students, currentSortOrder), currentSearchTerm))[studentIndex].name;
            // Find the original index in the actual (unsorted, unfiltered) currentGroup.students array
            const originalIndex = currentGroup.students.findIndex(s => s.name === studentName);
            if (originalIndex !== -1) {
                apiDeleteStudent(originalIndex, currentGroup, saveAllGroupsLocal, loadStudents, studentName);
            }
        } else if (target.classList.contains('student-name')) {
            currentModalStudentName = target.textContent;
            const student = currentGroup.students.find(s => s.name === currentModalStudentName);
            if (student) {
                populateStudentInfoModal(
                    student,
                    currentGroup, // Pass currentGroup
                    modalStudentInfoName,
                    modalStudentObservations,
                    charACNEE,
                    charCOMPE,
                    charREPET,
                    charADAPT,
                    totalFaltasDisplay,
                    calculateAbsencesCount, // From utils
                    viewStudentDetailsSection,
                    editStudentNameSection
                );
                showStudentInfoModal(studentInfoModal);
            }
        } else if (target.classList.contains('edit-student-name-button')) {
            currentModalStudentName = target.dataset.studentName;
            const student = currentGroup.students.find(s => s.name === currentModalStudentName);
            if (student) {
                populateStudentNameEditSection(
                    student,
                    modalStudentInfoName,
                    modalEditFirstName,
                    modalEditLastName,
                    viewStudentDetailsSection,
                    editStudentNameSection,
                    splitFullName, // From utils
                    modalChangeGroupSelect,
                    allGroups,
                    selectedGroupKey
                );
                showStudentInfoModal(studentInfoModal);
            }
        }
    });

    studentsList.addEventListener('dragstart', (e) => {
        if (currentSortOrder !== 'manual') {
            e.preventDefault();
            return;
        }

        draggedStudentItem = e.target.closest('li');
        if (draggedStudentItem && !draggedStudentItem.classList.contains('no-students-message')) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedStudentItem.dataset.index);
            setTimeout(() => draggedStudentItem.classList.add('dragging'), 0);
        }
    });

    studentsList.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (currentSortOrder !== 'manual') return;

        if (draggedStudentItem && e.target.closest('li') !== draggedStudentItem) {
            const targetItem = e.target.closest('li');
            if (targetItem && !targetItem.classList.contains('no-students-message')) {
                const bounding = targetItem.getBoundingClientRect();
                const offset = e.clientY - bounding.top;

                clearDragDropClasses(studentsList);

                if (offset < bounding.height / 2) {
                    targetItem.classList.add('drag-over-top');
                } else {
                    targetItem.classList.add('drag-over-bottom');
                }
            }
        }
    });

    studentsList.addEventListener('dragleave', (e) => {
        if (currentSortOrder !== 'manual') return;
        const targetItem = e.target.closest('li');
        if (targetItem) {
            targetItem.classList.remove('drag-over-top');
            targetItem.classList.remove('drag-over-bottom');
        }
    });

    studentsList.addEventListener('drop', (e) => {
        e.preventDefault();
        if (currentSortOrder !== 'manual') return;

        const fromIndexInView = parseInt(e.dataTransfer.getData('text/plain'));
        const targetItem = e.target.closest('li');

        if (targetItem && draggedStudentItem && targetItem !== draggedStudentItem) {
            const toIndexInView = parseInt(targetItem.dataset.index);
            
            const currentViewStudents = filterStudents(sortStudents(currentGroup.students, currentSortOrder), currentSearchTerm);
            
            const studentToMoveName = currentViewStudents[fromIndexInView].name;
            const studentTargetName = currentViewStudents[toIndexInView].name;

            const originalFromIndex = currentGroup.students.findIndex(s => s.name === studentToMoveName);
            let originalToIndex = currentGroup.students.findIndex(s => s.name === studentTargetName);

            if (targetItem.classList.contains('drag-over-bottom')) {
                originalToIndex++;
            }

            apiReorderStudents(originalFromIndex, originalToIndex, currentGroup, saveAllGroupsLocal, loadStudents);
        }
        clearDragDropClasses(studentsList);
    });

    studentsList.addEventListener('dragend', () => {
        if (currentSortOrder !== 'manual') return;
        if (draggedStudentItem) {
            draggedStudentItem.classList.remove('dragging');
            draggedStudentItem = null;
        }
        clearDragDropClasses(studentsList);
    });

    backToGroupsButton.addEventListener('click', () => {
        removeSessionItem('selectedGroupKey');
        window.location.href = 'groups.html';
    });

    globalHomeButton.addEventListener('click', () => {
        removeSessionItem('selectedGroupKey');
        removeSessionItem('selectedActivityIndex');
        removeSessionItem('selectedStudentNameForHistory'); // Ensure this is cleared
        removeSessionItem('selectedGroupKeyForHistory'); // Ensure this is cleared
        window.location.href = 'index.html';
    });

    globalSaveButton.addEventListener('click', handleSaveBackup);

    globalLoadButton.addEventListener('click', handleLoadBackup);

    // NEW: Handle global Agenda button click
    globalAgendaButton.addEventListener('click', () => {
        window.location.href = 'agenda.html';
    });

    // NEW: Handle global Daily Log button click
    globalDailyLogButton.addEventListener('click', () => {
        window.location.href = 'daily_log.html';
    });

    closeStudentInfoModal.addEventListener('click', () => hideAllModals());

    saveStudentDetailsButton.addEventListener('click', async () => { // Made async
        if (!currentModalStudentName) {
            await modalAlert('Error: No se ha seleccionado ningún alumno para guardar los detalles.');
            return;
        }
        await apiSaveStudentDetails(currentModalStudentName, currentGroup, modalStudentObservations, charACNEE, charCOMPE, charREPET, charADAPT, classificationList, saveAllGroupsLocal, () => hideStudentInfoModal(studentInfoModal), loadStudents);
        // After saving, re-populate the modal to reflect propagated changes (empty descriptions for other students).
        // This will also re-render the classification list with updated group-level types.
        const student = currentGroup.students.find(s => s.name === currentModalStudentName);
        if (student) {
            populateStudentInfoModal(
                student,
                currentGroup, // Pass currentGroup
                modalStudentInfoName,
                modalStudentObservations,
                charACNEE,
                charCOMPE,
                charREPET,
                charADAPT,
                totalFaltasDisplay,
                calculateAbsencesCount,
                viewStudentDetailsSection,
                editStudentNameSection
            );
        }
    });

    // NEW: Save Student Name button listener
    saveStudentNameButton.addEventListener('click', async () => { // Made async
        if (!currentModalStudentName) {
            await modalAlert('Error: No se ha seleccionado ningún alumno para guardar el nombre.');
            return;
        }
        await apiUpdateStudentName( // Await this call
            currentModalStudentName,
            modalEditFirstName.value,
            modalEditLastName.value.trim(), // Ensure trim is applied to last name
            currentGroup,
            allGroups,
            saveAllGroupsLocal,
            loadStudents,
            hideStudentInfoModalSections, // Pass function to hide sections
            getAttendanceRecords,
            saveAttendanceRecords
        );
        hideStudentInfoModal(studentInfoModal); // Hide the main modal
    });

    // NEW: Cancel Edit Name button listener
    cancelEditNameButton.addEventListener('click', () => {
        hideStudentInfoModal(studentInfoModal);
        hideStudentInfoModalSections();
    });

    // NEW: Confirm Move Student button listener (triggers the warning modal)
    confirmMoveStudentButton.addEventListener('click', () => {
        if (!currentModalStudentName) {
            modalAlert('Error: No se ha seleccionado ningún alumno para mover.');
            return;
        }
        const newGroupKey = modalChangeGroupSelect.value;
        if (!newGroupKey) {
            modalAlert('Por favor, selecciona un grupo de destino.');
            return;
        }

        studentToMoveName = currentModalStudentName; // Store for warning modal context
        targetGroupKeyForMove = newGroupKey; // Store for warning modal context

        const currentGroupName = `${currentGroup.subjectName} (${currentGroup.gradeLevel} ${currentGroup.groupLetter.toUpperCase()})`;
        const newGroup = allGroups.find(group => `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}` === newGroupKey);
        const newGroupName = newGroup ? `${newGroup.subjectName} (${newGroup.gradeLevel} ${newGroup.groupLetter})` : 'grupo desconocido';

        // Updated warning message for clarity and simplicity
        moveWarningMessage.innerHTML = `
            <p>Vas a mover a <strong>"${studentToMoveName}"</strong> del grupo <strong>"${currentGroupName}"</strong> a <strong>"${newGroupName}"</strong>.</p>
            <p>Esta acción tendrá las siguientes consecuencias:</p>
            <ul>
                <li>Las calificaciones de <strong>"${studentToMoveName}"</strong> en <strong>"${currentGroupName}"</strong> se eliminarán de forma <strong>PERMANENTE</strong>.</li>
                <li>Los registros de asistencia de <strong>"${studentToMoveName}"</strong> permanecerán en <strong>"${currentGroupName}"</strong>.</li>
            </ul>
            <p class="attention-text">¡ATENCIÓN! Se recomienda encarecidamente hacer una copia de seguridad general o un informe con las calificaciones del alumno antes de continuar.</p>
        `;
        
        moveStudentWarningModal.style.display = 'flex';
        // Keep studentInfoModal visible behind it, but maybe disable interactions?
        // Or simply close studentInfoModal if that's the desired UX. For now, keep it simple.
    });

    // NEW: Continue Move button in the warning modal
    continueMoveButton.addEventListener('click', async () => {
        if (studentToMoveName && targetGroupKeyForMove) {
            const moveSuccessful = await apiMoveStudentToGroup(
                studentToMoveName,
                targetGroupKeyForMove,
                currentGroup,
                allGroups,
                saveAllGroupsLocal,
                loadStudents, // Pass loadStudents to refresh the list if successful
                getAttendanceRecords,
                saveAttendanceRecords
            );
            if (moveSuccessful) {
                hideAllModals(); // Close all modals if the move was successful
            }
        }
    });

    // NEW: Create Report button in the warning modal
    createReportButton.addEventListener('click', () => {
        if (studentToMoveName) {
            setSessionItem('reportStudentName', studentToMoveName);
            setSessionItem('reportGroupKey', selectedGroupKey); // Pass current group key
            window.location.href = 'reports.html';
            hideAllModals(); // Close modals before navigating
        }
    });

    // NEW: Cancel Move button in the warning modal
    cancelMoveButton.addEventListener('click', () => {
        hideMoveStudentWarningModal();
        // If the user cancels the move, and the student info modal was originally open, re-open it.
        if (studentInfoModal.style.display === 'none' && currentModalStudentName) {
            showStudentInfoModal(studentInfoModal);
        }
    });

    closeMoveStudentWarningModal.addEventListener('click', () => hideMoveStudentWarningModal());

    // NEW: Event listener for "Ver Historial de Asistencia" button
    viewAttendanceHistoryButton.addEventListener('click', () => {
        if (currentModalStudentName && selectedGroupKey) {
            // Obtain attendance history data (scoped to recorded days) and show modal overlayed
            const historyData = getStudentAttendanceHistoryData(currentModalStudentName);
            showStudentAttendanceHistoryModal(
                currentModalStudentName,
                historyData,
                document.getElementById('studentAttendanceHistoryModal'),
                document.getElementById('modalStudentAttendanceName'),
                document.getElementById('studentAttendanceHistoryTableBody'),
                document.getElementById('noAttendanceMessage')
            );
        } else {
            modalAlert('No se pudo determinar el alumno o el grupo para ver el historial de asistencia.');
        }
    });

    // NEW: Close Attendance History Modal listener (so modal opened here can be closed)
    const closeStudentAttendanceHistoryModalBtn = document.getElementById('closeStudentAttendanceHistoryModal');
    if (closeStudentAttendanceHistoryModalBtn) {
        closeStudentAttendanceHistoryModalBtn.addEventListener('click', () => {
            hideStudentAttendanceHistoryModal(document.getElementById('studentAttendanceHistoryModal'));
            // If attendance was modified while the history modal was open, refresh student info modal now
            if (attendanceHistoryModified && currentModalStudentName) {
                const student = currentGroup.students.find(s => s.name === currentModalStudentName);
                if (student) {
                    populateStudentInfoModal(
                        student,
                        currentGroup,
                        modalStudentInfoName,
                        modalStudentObservations,
                        charACNEE,
                        charCOMPE,
                        charREPET,
                        charADAPT,
                        totalFaltasDisplay,
                        calculateAbsencesCount,
                        viewStudentDetailsSection,
                        editStudentNameSection
                    );
                }
                attendanceHistoryModified = false;
            }
        });
    }

    // NEW: Track if attendance history saved changes so we can refresh the student info modal after the history modal closes
    let attendanceHistoryModified = false;
    window.addEventListener('attendanceHistorySaved', (e) => {
        // Mark that attendance history was modified; we'll refresh the student info modal after the history modal closes
        attendanceHistoryModified = true;
    });

    // Close by clicking outside
    window.addEventListener('click', (event) => {
        const attModal = document.getElementById('studentAttendanceHistoryModal');
        if (attModal && event.target === attModal) {
            hideStudentAttendanceHistoryModal(attModal);
            // If attendance was modified while the history modal was open, refresh student info modal now
            if (attendanceHistoryModified && currentModalStudentName) {
                const student = currentGroup.students.find(s => s.name === currentModalStudentName);
                if (student) {
                    populateStudentInfoModal(
                        student,
                        currentGroup,
                        modalStudentInfoName,
                        modalStudentObservations,
                        charACNEE,
                        charCOMPE,
                        charREPET,
                        charADAPT,
                        totalFaltasDisplay,
                        calculateAbsencesCount,
                        viewStudentDetailsSection,
                        editStudentNameSection
                    );
                }
                attendanceHistoryModified = false;
            }
        }
    });

    // NEW: Event listener for "Ver Historial de Calificaciones" button
    if (viewGradesHistoryButton) {
        viewGradesHistoryButton.addEventListener('click', () => {
            if (currentModalStudentName && selectedGroupKey) {
                // Get the list of students currently rendered on the page, respecting filters and sort.
                // This is the `finalFilteredStudents` after all filtering/sorting in `loadStudents()`.
                const currentViewStudentElements = studentsList.querySelectorAll('li:not(.no-students-message)');
                const studentsInView = Array.from(currentViewStudentElements).map(li => {
                    const studentName = li.dataset.studentName;
                    return currentGroup.students.find(s => s.name === studentName);
                }).filter(Boolean); // Filter out any null/undefined if a student wasn't found (shouldn't happen)

                showStudentGradesHistoryModal(
                    currentModalStudentName,
                    selectedGroupKey,
                    modalStudentGradesName,
                    studentGradesHistoryTableBody,
                    noGradesMessage,
                    studentGradesHistoryModal,
                    studentsInView // Pass the array of students currently in view
                );
            } else {
                modalAlert('No se pudo determinar el alumno o el grupo para ver el historial de calificaciones.');
            }
        });
    }

    // NEW: Close Grades History Modal event listener
    if (closeStudentGradesHistoryModal) {
        closeStudentGradesHistoryModal.addEventListener('click', () => {
            hideStudentGradesHistoryModal(studentGradesHistoryModal);
            // If the student info modal was open, re-open it
            if (studentInfoModal.style.display === 'none' && currentModalStudentName) {
                showStudentInfoModal(studentInfoModal);
            }
        });
    }

    // NEW: Prev/Next handlers for attendance history modal (when opened from students page)
    const attendanceHistoryPrevButton = document.getElementById('attendanceHistoryPrevButton');
    const attendanceHistoryNextButton = document.getElementById('attendanceHistoryNextButton');
    const modalStudentAttendanceName = document.getElementById('modalStudentAttendanceName');

    const navigateAttendanceHistory = (direction) => {
        const currentName = modalStudentAttendanceName ? modalStudentAttendanceName.textContent : null;
        if (!currentName) return;
        const currentViewStudents = studentsList.querySelectorAll('li:not(.no-students-message)');
        const viewNames = Array.from(currentViewStudents).map(li => li.dataset.studentName);
        const idx = viewNames.indexOf(currentName);
        if (idx === -1) return;
        const newIndex = idx + direction;
        if (newIndex < 0 || newIndex >= viewNames.length) return;
        const newName = viewNames[newIndex];
        const historyData = getStudentAttendanceHistoryData(newName);
        showStudentAttendanceHistoryModal(
            newName,
            historyData,
            document.getElementById('studentAttendanceHistoryModal'),
            modalStudentAttendanceName,
            document.getElementById('studentAttendanceHistoryTableBody'),
            document.getElementById('noAttendanceMessage')
        );
    };

    if (attendanceHistoryPrevButton) attendanceHistoryPrevButton.addEventListener('click', () => navigateAttendanceHistory(-1));
    if (attendanceHistoryNextButton) attendanceHistoryNextButton.addEventListener('click', () => navigateAttendanceHistory(1));

    // Add navigation helper (insert near other helper functions)
    const navigateToAdjacentStudent = (direction) => {
        // direction: -1 for previous, +1 for next
        if (!currentModalStudentName) return;
        // The list for navigation should be the fully filtered and sorted list currently displayed
        const currentViewStudents = studentsList.querySelectorAll('li:not(.no-students-message)');
        const viewStudentsNames = Array.from(currentViewStudents).map(li => li.dataset.studentName);

        const idx = viewStudentsNames.findIndex(name => name === currentModalStudentName);
        if (idx === -1) return;
        const newIndex = idx + direction;
        if (newIndex < 0 || newIndex >= viewStudentsNames.length) return; // no wrap-around
        
        const newStudentName = viewStudentsNames[newIndex];
        const newStudent = currentGroup.students.find(s => s.name === newStudentName);
        if (!newStudent) return;
        
        currentModalStudentName = newStudent.name;
        // Re-populate modal for the new student
        populateStudentInfoModal(newStudent, currentGroup, modalStudentInfoName, modalStudentObservations, charACNEE, charCOMPE, charREPET, charADAPT, totalFaltasDisplay, calculateAbsencesCount, viewStudentDetailsSection, editStudentNameSection);
        showStudentInfoModal(studentInfoModal);
    };

    // Add event listeners for the nav buttons (place near other modal button listeners)
    if (studentPrevButton) {
        studentPrevButton.addEventListener('click', () => navigateToAdjacentStudent(-1));
    }
    if (studentNextButton) {
        studentNextButton.addEventListener('click', () => navigateToAdjacentStudent(1));
    }

    // NEW: Listen for sort selection changes and persist them
    sortSelect.addEventListener('change', (e) => {
        currentSortOrder = e.target.value;
        saveStudentsSortOrder(currentSortOrder);
        loadStudents();
    });

    // NEW: Classification Filter Event Listeners
    classificationTypeFilterSelect.addEventListener('change', (e) => {
        currentClassificationTypeFilter = e.target.value;
        loadStudents();
    });

    classificationDescriptionFilterInput.addEventListener('input', (e) => {
        currentClassificationDescriptionFilter = e.target.value.trim();
        loadStudents();
    });

    clearClassificationFilterButton.addEventListener('click', () => {
        currentClassificationTypeFilter = 'all';
        classificationTypeFilterSelect.value = 'all';
        currentClassificationDescriptionFilter = '';
        classificationDescriptionFilterInput.value = '';
        loadStudents();
    });

    // Initial setup
    populateClassificationTypeFilter(); // Populate classification type filter on load
    loadStudents();

    // The logic to handle 'selectedStudentNameForHistory' when coming from attendance page will be in attendance.js
    // and is no longer relevant for students.js.
    // The previous prompt's change was to make students.js directly handle opening attendance history modal.

    // If another page requested to open a specific student's info (via session), handle it now
    const pendingStudentToOpen = sessionStorage.getItem('selectedStudentName');
    if (pendingStudentToOpen) {
        removeSessionItem('selectedStudentName');
        const student = currentGroup.students.find(s => s.name === pendingStudentToOpen);
        if (student) {
            currentModalStudentName = pendingStudentToOpen;
            populateStudentInfoModal(student, currentGroup, modalStudentInfoName, modalStudentObservations, charACNEE, charCOMPE, charREPET, charADAPT, totalFaltasDisplay, calculateAbsencesCount, viewStudentDetailsSection, editStudentNameSection);
            showStudentInfoModal(studentInfoModal);
        }
    }

    // NEW: Event listener to highlight a student when returning from activity page
    window.addEventListener('highlightStudentInActivity', (event) => {
        const studentName = event.detail.studentName;
        if (studentName) {
            const studentListItem = studentsList.querySelector(`li[data-student-name="${CSS.escape(studentName)}"]`);
            if (studentListItem) {
                studentListItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                studentListItem.classList.add('highlighted-student');
                setTimeout(() => studentListItem.classList.remove('highlighted-student'), 2500);
            }
        }
    });
});