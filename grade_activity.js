import { getGroups, saveGroups, getSessionItem, setSessionItem, removeSessionItem, getAllAppData, getCustomGradingTypes } from './utils/storage.js';
import { showStudentGradesHistoryModal, hideStudentGradesHistoryModal } from './utils/grades-history-modal.js';
import { formatDateTimeForFilename } from './utils/date-utils.js';
import { handleLoadBackup, handleSaveBackup, modalAlert, modalConfirm, modalOptions } from './utils/backup-utils.js'; // NEW: Import backup utility
import {
    updateActivityHeaderInfo,
    renderStudentGrades,
    showObservationModal,
    hideObservationModal,
    updateActivityGradingTypeDisplay,
    attachGradeInputListeners,
    applyGroupColorToActivityPage,
    fillActivityEditForm,
    updateActivityAnnotationBadge,
    showActivityAnnotationModal,
    hideActivityAnnotationModal,
    updateObservationButtonState // NEW: Import to update button state
} from './grade-activity/grade-activity-dom.js';
import {
    saveGradesAndObservations,
    clearAllGradesForActivity,
    handleGradeInputControls,
    handleStudentListItemClick,
    handleMarkActivityInline,
    handleSaveActivityInlineEdits,
    handleSaveActivityAnnotation
} from './grade-activity/grade-activity-logic.js';

document.addEventListener('DOMContentLoaded', () => {
    const groupDisplayInfo = document.getElementById('groupDisplayInfo');
    const activityNameDisplay = document.getElementById('activityNameDisplay');
    const activityDescriptionDisplay = document.getElementById('activityDescriptionDisplay');
    const activityDateDisplay = document.getElementById('activityDateDisplay');
    const activityCategoryDisplay = document.getElementById('activityCategoryDisplay'); // NEW
    const gradingTypeDisplay = document.getElementById('gradingTypeDisplay');
    const studentListHeading = document.getElementById('studentListHeading');
    const studentGradesList = document.getElementById('studentGradesList');
    const saveGradesButton = document.getElementById('saveGradesButton');
    const clearAllGradesButton = document.getElementById('clearAllGradesButton');
    const backToGradesButton = document.getElementById('backToGradesButton');
    const backToReportsButton = document.getElementById('backToReportsButton'); // NEW
    const globalHomeButton = document.getElementById('globalHomeButton');
    const globalSaveButton = document.getElementById('globalSaveButton'); // NEW
    const globalLoadButton = document.getElementById('globalLoadButton'); // NEW
    const globalAgendaButton = document.getElementById('globalAgendaButton'); // NEW: Global Agenda Button
    const globalDailyLogButton = document.getElementById('globalDailyLogButton'); // NEW: Global Daily Log Button
    const editActivityButton = document.getElementById('editActivityButton');
    const editActivityForm = document.getElementById('editActivityForm');

    const pageBody = document.body;

    const observationModal = document.getElementById('observationModal');
    const closeObservationModal = document.getElementById('closeObservationModal');
    const modalStudentName = document.getElementById('modalStudentName');
    const modalObservationTextarea = document.getElementById('modalObservationTextarea');
    const saveObservationButton = document.getElementById('saveObservationButton');

    // Activity annotation elements
    const activityAnnotationModal = document.getElementById('activityAnnotationModal');
    const closeActivityAnnotationModal = document.getElementById('closeActivityAnnotationModal');
    const activityAnnotationButton = document.getElementById('activityAnnotationButton');
    const activityAnnotationTextarea = document.getElementById('activityAnnotationTextarea');
    const saveActivityAnnotationButton = document.getElementById('saveActivityAnnotationButton');

    const studentGradesHistoryModal = document.getElementById('studentGradesHistoryModal');
    const closeStudentGradesHistoryModal = document.getElementById('closeStudentGradesHistoryModal');
    const modalStudentGradesName = document.getElementById('modalStudentGradesName');
    const studentGradesHistoryTableBody = document.getElementById('studentGradesHistoryTableBody');
    const noGradesMessage = document.getElementById('noGradesMessage');

    let allGroups = getGroups();
    let currentGroupKey = getSessionItem('selectedGroupKey');
    let selectedActivityIndex = parseInt(getSessionItem('selectedActivityIndex'));
    let selectedStudentName = getSessionItem('selectedStudentName'); // Optional student to focus after load

    let currentGroup = null;
    let selectedActivity = null;
    let currentModalStudent = '';
    let hasUnsavedChanges = false; // Initial state to track changes in grade inputs
    let hasUnsavedObservationChangesInModal = false; // NEW: Flag for observation changes in modal

    if (currentGroupKey && !isNaN(selectedActivityIndex) && selectedActivityIndex >= 0) {
        currentGroup = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === currentGroupKey);
        if (currentGroup && currentGroup.activities && currentGroup.activities[selectedActivityIndex]) {
            selectedActivity = currentGroup.activities[selectedActivityIndex];
        }
    }

    if (!currentGroup || !selectedActivity) {
        // Changed alert to modalAlert
        modalAlert('No se pudo cargar la actividad o el grupo. Volviendo a la gestión de calificaciones.').then(() => {
            window.location.href = 'grades.html';
        });
        return;
    }

    applyGroupColorToActivityPage(currentGroup, pageBody, studentListHeading);

    updateActivityHeaderInfo(selectedActivity, currentGroup, groupDisplayInfo, activityNameDisplay, activityDescriptionDisplay, activityDateDisplay, activityCategoryDisplay, gradingTypeDisplay);
    // show/hide annotation badge if activity has annotation
    updateActivityAnnotationBadge(selectedActivity);

    const setUnsavedChangesFlag = () => { hasUnsavedChanges = true; };
    const clearUnsavedChangesFlag = () => { hasUnsavedChanges = false; };

    let filterTerm = '';
    const getFilteredStudents = () => {
        const term = filterTerm.trim().toLowerCase();
        if (!term) return currentGroup.students;
        return currentGroup.students.filter(s => (s.name || '').toLowerCase().includes(term));
    };

    const loadStudentGrades = () => {
        renderStudentGrades(getFilteredStudents(), selectedActivity, studentGradesList, saveGradesButton);
        attachGradeInputListeners(studentGradesList, setUnsavedChangesFlag);
        // Do NOT reset hasUnsavedChanges here. It should only be cleared upon saving.
    };

    saveGradesButton.addEventListener('click', async () => { // Made async
        if (hasUnsavedChanges) {
            saveGradesAndObservations(studentGradesList, selectedActivity, () => {
                saveGroups(allGroups); // The actual save to localStorage
            }, clearUnsavedChangesFlag); // Callback to clear the flag
            await modalAlert('Calificaciones y observaciones guardadas correctamente.'); // Changed alert to modalAlert
        } else {
            await modalAlert('No se detectaron cambios pendientes para guardar.'); // Changed alert to modalAlert
        }
    });

    clearAllGradesButton.addEventListener('click', async () => { // Made async
        const selected = Array.from(studentGradesList.querySelectorAll('.select-grade-checkbox:checked'))
            .map(cb => cb.dataset.studentName);
        
        if (selected.length === 0) {
            await modalAlert('No hay alumnos seleccionados para borrar calificaciones.');
            return;
        }

        const clearOption = await modalOptions(
            '¿Qué deseas borrar para los alumnos seleccionados?',
            [
                { text: 'Solo calificaciones', value: 'grades' },
                { text: 'Solo observaciones', value: 'observations' },
                { text: 'Ambas (calificaciones y observaciones)', value: 'both', class: 'danger' } // Red button for 'both'
            ],
            'Borrar Calificaciones/Observaciones'
        );

        if (clearOption === null) { // User cancelled the options modal
            return;
        }

        clearAllGradesForActivity(selectedActivity, setUnsavedChangesFlag, loadStudentGrades, selected, clearOption);
    });

    backToGradesButton.addEventListener('click', async (event) => { // Made async
        if (hasUnsavedChanges) {
            const confirmDiscard = await modalConfirm('Tienes cambios sin guardar. ¿Estás seguro de que quieres salir sin guardar?'); // Changed confirm to modalConfirm
            if (!confirmDiscard) {
                event.preventDefault();
                return;
            }
        }
        removeSessionItem('selectedActivityIndex');
        window.location.href = 'grades.html';
    });

    // NEW: Back to Reports button logic
    backToReportsButton.addEventListener('click', async (event) => { // Made async
        if (hasUnsavedChanges) {
            const confirmDiscard = await modalConfirm('Tienes cambios sin guardar. ¿Estás seguro de que quieres salir sin guardar?'); // Changed confirm to modalConfirm
            if (!confirmDiscard) {
                event.preventDefault();
                return;
            }
        }
        removeSessionItem('selectedActivityIndex'); // Clear activity index, but keep group for reports context
        // Ensure reports page knows which group and preserves state
        setSessionItem('report_isComingFromActivityPage', 'true');
        setSessionItem('reportGroupKey', currentGroupKey);
        window.location.href = 'reports.html';
    });

    globalHomeButton.addEventListener('click', async () => { // Made async
        if (hasUnsavedChanges) {
            const confirmDiscard = await modalConfirm('Tienes cambios sin guardar. ¿Estás seguro de que quieres ir al inicio sin guardar?'); // Changed confirm to modalConfirm
            if (!confirmDiscard) {
                return;
            }
        }
        removeSessionItem('selectedGroupKey');
        removeSessionItem('selectedActivityIndex');
        window.location.href = 'index.html';
    });

    // NEW: Handle global save button click
    globalSaveButton.addEventListener('click', handleSaveBackup);

    // NEW: Handle global load button click
    globalLoadButton.addEventListener('click', handleLoadBackup);

    // NEW: Handle global Agenda button click
    globalAgendaButton.addEventListener('click', async () => { // Made async
        if (hasUnsavedChanges) {
            const confirmDiscard = await modalConfirm('Tienes cambios sin guardar. ¿Estás seguro de que quieres ir a la agenda sin guardar?'); // Changed confirm to modalConfirm
            if (!confirmDiscard) {
                return;
            }
        }
        window.location.href = 'agenda.html';
    });

    // NEW: Handle global Daily Log button click
    globalDailyLogButton.addEventListener('click', async () => { // Made async
        if (hasUnsavedChanges) {
            const confirmDiscard = await modalConfirm('Tienes cambios sin guardar. ¿Estás seguro de que quieres ir al horario y anotaciones diarias sin guardar?'); // Changed confirm to modalConfirm
            if (!confirmDiscard) {
                return;
            }
        }
        window.location.href = 'daily_log.html';
    });

    // Populate edit type select with built-ins + custom
    const populateEditTypeSelect = () => {
        const sel = document.getElementById('editActivityType');
        const builtins = [
            { v: 'numeric_integer', t: 'Numérica (0-10 enteras o NP)' },
            { v: 'qualitative', t: 'Cualitativa (NP, Mal, Regular, Bien, Muy bien)' },
            { v: 'numeric_decimal', t: 'Numérica exacta (0-10, con 2 decimales)' }
        ];
        sel.innerHTML = builtins.map(o => `<option value="${o.v}">${o.t}</option>`).join('');
        const customs = getCustomGradingTypes();
        if (customs.length) {
            const og = document.createElement('optgroup');
            og.label = 'Personalizados';
            customs.forEach(ct => {
                // All custom types should be selectable as options in the dropdown.
                // The detailed rendering of their specific input fields (e.g., rubric grid)
                // happens in renderStudentGrades in grade-activity-dom.js based on the selected type.
                const opt = document.createElement('option');
                opt.value = `custom:${ct.id}`;
                opt.textContent = `Personalizado: ${ct.name}`;
                og.appendChild(opt);
            });
            sel.appendChild(og);
        }
    };

    // Inline edit: toggle form and populate
    editActivityButton.addEventListener('click', () => {
        const isHidden = editActivityForm.style.display === 'none';
        if (isHidden) { populateEditTypeSelect(); fillActivityEditForm(selectedActivity); }
        editActivityForm.style.display = isHidden ? 'grid' : 'none';
    });

    // Category other toggle
    document.getElementById('editActivityCategory').addEventListener('change', (e) => {
        const other = document.getElementById('editActivityCategoryOther');
        if (e.target.value === 'otro') {
            other.style.display = 'block';
            other.required = true;
        } else {
            other.style.display = 'none';
            other.required = false;
            other.value = '';
        }
    });

    editActivityForm.addEventListener('submit', async (e) => { // Made async
        e.preventDefault();
        const getFormValues = () => {
            const name = document.getElementById('editActivityName').value.trim();
            const date = document.getElementById('editActivityDate').value;
            const catSel = document.getElementById('editActivityCategory').value;
            const catOther = document.getElementById('editActivityCategoryOther').value.trim();
            const type = document.getElementById('editActivityType').value;
            const description = document.getElementById('editActivityDescription').value.trim();
            return { name, date, category: (catSel === 'otro' ? catOther : catSel), type, description };
        };
        await handleSaveActivityInlineEdits( // Await this call
            currentGroup,
            selectedActivity,
            getFormValues,
            () => { saveGroups(allGroups); },
            () => {
                updateActivityHeaderInfo(selectedActivity, currentGroup, groupDisplayInfo, activityNameDisplay, activityDescriptionDisplay, activityDateDisplay, activityCategoryDisplay, gradingTypeDisplay);
                updateActivityAnnotationBadge(selectedActivity);
                renderStudentGrades(getFilteredStudents(), selectedActivity, studentGradesList, saveGradesButton);
                attachGradeInputListeners(studentGradesList, setUnsavedChangesFlag);
                editActivityForm.style.display = 'none';
            }
        );
    });

    document.getElementById('cancelEditActivityButton').addEventListener('click', () => {
        editActivityForm.style.display = 'none';
    });

    // Mark selector (dropdown)
    const activityMarkSelect = document.getElementById('activityMarkSelect');
    if (activityMarkSelect) {
        // Initialize select to current value
        activityMarkSelect.value = selectedActivity.mark || 'none';
        activityMarkSelect.addEventListener('change', (e) => {
            const mark = e.target.value;
            handleMarkActivityInline(
                selectedActivity,
                mark,
                () => { saveGroups(allGroups); },
                () => updateActivityHeaderInfo(selectedActivity, currentGroup, groupDisplayInfo, activityNameDisplay, activityDescriptionDisplay, activityDateDisplay, activityCategoryDisplay, gradingTypeDisplay)
            );
        });
    }

    studentGradesList.addEventListener('click', (event) => {
        // Handle increment/decrement buttons first
        const gradeControlsHandled = handleGradeInputControls(event, selectedActivity, setUnsavedChangesFlag);
        if (gradeControlsHandled) {
            return;
        }

        // Handle observation button or student name click for history
        handleStudentListItemClick(
            event,
            selectedActivity,
            studentGradesList,
            (name, obs) => {
                // Reset flag when opening modal to reflect state of *saved* observation
                hasUnsavedObservationChangesInModal = false;
                showObservationModal(name, obs, modalStudentName, modalObservationTextarea, observationModal);
                // Store initial observation value to detect changes if "Save" button is not pressed
                modalObservationTextarea.dataset.initialValue = obs;
            },
            (name) => {
                const studentsInView = (() => {
                    // If there are checked students in the activity list, limit to those; otherwise use the full filtered list
                    const checkedNames = Array.from(studentGradesList.querySelectorAll('.select-grade-checkbox:checked'))
                        .map(cb => cb.dataset.studentName);
                    const allFiltered = getFilteredStudents();
                    return (checkedNames.length > 0)
                        ? allFiltered.filter(s => checkedNames.includes(s.name))
                        : allFiltered;
                })();

                showStudentGradesHistoryModal(
                    name,
                    currentGroupKey,
                    modalStudentGradesName,
                    studentGradesHistoryTableBody,
                    noGradesMessage,
                    studentGradesHistoryModal,
                    studentsInView,
                    { groupKey: currentGroupKey, activityIndex: selectedActivityIndex } // Pass current activity context
                );
            },
            (name) => { currentModalStudent = name; } // Set currentModalStudent
        );
    });

    const confirmDiscardObservationChanges = async () => { // NEW: Helper to confirm discarding observation changes
        if (hasUnsavedObservationChangesInModal) {
            const confirm = await modalConfirm('Tienes cambios sin guardar en las observaciones. ¿Deseas descartarlos?', 'Descartar Cambios');
            return confirm; // true if user confirms discard, false if cancels
        }
        return true; // No unsaved changes, proceed
    };

    closeObservationModal.addEventListener('click', async () => { // NEW: Modified
        if (await confirmDiscardObservationChanges()) {
            hideObservationModal(observationModal);
            currentModalStudent = '';
            hasUnsavedObservationChangesInModal = false; // Reset flag after discard or successful close
        }
        // If user cancelled, modal remains open, no changes.
    });

    // NEW: Modify modalObservationTextarea.addEventListener to update `hasUnsavedObservationChangesInModal`
    modalObservationTextarea.addEventListener('input', () => {
        hasUnsavedObservationChangesInModal = true;
        setUnsavedChangesFlag(); // This flags general page changes.
    });

    saveObservationButton.addEventListener('click', async () => { // NEW: Modified
        if (!currentModalStudent) {
            await modalAlert('Error: No se ha seleccionado ningún alumno para guardar la observación.');
            return;
        }

        const newObservation = modalObservationTextarea.value.trim();
        // Update the activity object directly. Persistence will happen via main save button.
        if (!selectedActivity.grades[currentModalStudent]) {
            selectedActivity.grades[currentModalStudent] = { grade: '', observation: newObservation, isNP: false };
        } else {
            selectedActivity.grades[currentModalStudent].observation = newObservation;
        }
        
        // Update the corresponding observation button style
        updateObservationButtonState(currentModalStudent, !!newObservation, studentGradesList);
        
        hasUnsavedObservationChangesInModal = false; // Observation changes are now "staged" to selectedActivity.
        hideObservationModal(observationModal);
        currentModalStudent = '';
        await modalAlert('Observación guardada y pendiente de guardar con las calificaciones generales.');
    });

    // Open activity annotation modal
    if (activityAnnotationButton) {
        activityAnnotationButton.addEventListener('click', () => {
            const currentText = (selectedActivity && selectedActivity.annotation) ? selectedActivity.annotation : '';
            showActivityAnnotationModal(selectedActivity.name, activityAnnotationTextarea, activityAnnotationModal, currentText);
        });
    }

    // Close annotation modal
    if (closeActivityAnnotationModal) {
        closeActivityAnnotationModal.addEventListener('click', () => {
            hideActivityAnnotationModal(activityAnnotationModal);
        });
    }

    // Save annotation
    if (saveActivityAnnotationButton) {
        saveActivityAnnotationButton.addEventListener('click', async () => { // Made async
            await handleSaveActivityAnnotation( // Await this call
                activityAnnotationTextarea,
                selectedActivity,
                () => { saveGroups(allGroups); },
                () => hideActivityAnnotationModal(activityAnnotationModal),
                (act) => updateActivityAnnotationBadge(act)
            );
        });
    }

    window.addEventListener('click', async (event) => { // Modified to be async and handle observation modal
        if (event.target === observationModal) {
            if (await confirmDiscardObservationChanges()) {
                hideObservationModal(observationModal);
                currentModalStudent = '';
                hasUnsavedObservationChangesInModal = false; // Reset flag after discard or successful close
            }
        }
        if (event.target === activityAnnotationModal) {
            hideActivityAnnotationModal(activityAnnotationModal);
        }
    });

    closeStudentGradesHistoryModal.addEventListener('click', () => {
        hideStudentGradesHistoryModal(studentGradesHistoryModal);
    });
    
    // Button in history modal: open student info in the students page (store context then navigate)
    const openStudentInfoFromHistoryButton = document.getElementById('openStudentInfoFromHistoryButton');
    if (openStudentInfoFromHistoryButton) {
        openStudentInfoFromHistoryButton.addEventListener('click', () => {
            const studentName = modalStudentGradesName.textContent;
            if (studentName) {
                setSessionItem('selectedStudentName', studentName);
                if (currentGroupKey) setSessionItem('selectedGroupKey', currentGroupKey);
                hideStudentGradesHistoryModal(studentGradesHistoryModal);
                window.location.href = 'students.html';
            }
        });
    }

    // NEW: Event listener for clicking on an activity link in the grades history modal
    // This listener is now managed by utils/grades-history-modal.js
    // studentGradesHistoryTableBody.addEventListener('click', (event) => { ... });

    const studentFilterInput = document.getElementById('studentFilterInput');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');

    studentFilterInput.addEventListener('input', (e) => {
        filterTerm = e.target.value;
        loadStudentGrades();
        selectAllCheckbox.checked = false;
    });

    selectAllCheckbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        Array.from(studentGradesList.querySelectorAll('.select-grade-checkbox')).forEach(cb => {
            cb.checked = checked;
        });
    });

    loadStudentGrades();

    // If we arrived here with a student to focus (from history on another page), scroll and highlight
    if (selectedStudentName) {
        // Remove the session key so it doesn't persist
        removeSessionItem('selectedStudentName');
        const li = studentGradesList.querySelector(`li[data-student-name="${CSS.escape(selectedStudentName)}"]`);
        if (li) {
            // Slight delay so that rendering/layout settles before scrolling
            setTimeout(() => {
                li.scrollIntoView({ behavior: 'smooth', block: 'center' });
                li.classList.add('highlighted-student');
                setTimeout(() => li.classList.remove('highlighted-student'), 2500);
            }, 120);
        }
    }

    // NEW: Check if the page was navigated from reports.html
    const isComingFromReports = getSessionItem('report_isComingFromActivityPage');
    // Prefer showing "Volver a Actividades" when arriving from the activities page (grades.html).
    const ref = document.referrer || '';
    const cameFromGradesPage = ref.includes('grades.html') || ref.endsWith('/grades.html');
    if (cameFromGradesPage) {
        backToGradesButton.style.display = 'inline-block';
        backToReportsButton.style.display = 'none';
    } else if (isComingFromReports) {
        backToGradesButton.style.display = 'none';
        backToReportsButton.style.display = 'inline-block';
    } else {
        backToGradesButton.style.display = 'inline-block';
        backToReportsButton.style.display = 'none';
    }
});