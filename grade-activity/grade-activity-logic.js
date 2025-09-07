import { modalAlert, modalConfirm } from '../utils/backup-utils.js';
import { getCustomGradingTypes } from '../utils/storage.js'; // NEW: for custom grading type details

export const saveGradesAndObservations = (studentGradesList, selectedActivity, saveAllGroupsCallback, clearUnsavedChangesFlagCallback) => {
    // This function's primary role is to take current DOM values and update the selectedActivity object,
    // then trigger the actual save and flag reset.
    const customTypes = getCustomGradingTypes();

    Array.from(studentGradesList.children).forEach(listItem => {
        if (listItem.classList.contains('no-students-message')) return;
        const studentName = listItem.dataset.studentName;

        if (!selectedActivity.grades[studentName]) {
            selectedActivity.grades[studentName] = { grade: '', observation: '', isNP: false };
        }

        const npCheckbox = listItem.querySelector('.np-checkbox');
        const isNP = npCheckbox ? npCheckbox.checked : false;
        selectedActivity.grades[studentName].isNP = isNP;

        if (isNP) {
            selectedActivity.grades[studentName].grade = 'NP';
            // Clear rubric details or other complex grade details if NP is checked
            if (selectedActivity.grades[studentName].details) {
                delete selectedActivity.grades[studentName].details;
            }
            // Ensure observation is kept when NP is set
            // selectedActivity.grades[studentName].observation is already set by modal and will be preserved.
            return; // Skip other grade processing for this student
        }

        const type = selectedActivity.type || 'numeric_decimal';
        if (type && type.startsWith('custom:')) {
            const ct = customTypes.find(t => `custom:${t.id}` === type);
            if (ct && ct.template === 'rubric') {
                const rubricGrid = listItem.querySelector('.rubric-grid');
                if (rubricGrid) {
                    const inputs = Array.from(rubricGrid.querySelectorAll('.rubric-input'));
                    const weights = Array.from(rubricGrid.querySelectorAll('.rubric-weight')).map(w => parseInt(w.textContent.replace('%','','')||'0',10));

                    // Validate each rubric item: must be an integer/number between 0 and 10
                    for (let i = 0; i < inputs.length; i++) {
                        const raw = (inputs[i].value || '').toString().trim();
                        // Treat empty as 0 for calculation but still enforce numeric range when provided
                        if (raw === '') continue;
                        const val = Number(raw);
                        const titleEl = inputs[i].closest('.rubric-row') ? inputs[i].closest('.rubric-row').querySelector('.rubric-title') : null;
                        const itemTitle = titleEl ? titleEl.textContent : `Ítem ${i + 1}`;
                        if (!Number.isFinite(val) || val < 0 || val > 10) {
                            // Use modalAlert to warn and abort saving
                            modalAlert(`Valor inválido en la rúbrica para \"${studentName}\" - \"${itemTitle}\" debe ser un número entre 0 y 10.`);
                            // Highlight invalid input
                            inputs[i].classList.add('invalid-grade');
                            throw new Error('Rubric validation failed'); // abort flow (caller should handle)
                        } else {
                            inputs[i].classList.remove('invalid-grade');
                        }
                    }

                    const scores = inputs.map(inp => {
                        const raw = (inp.value || '').toString().trim();
                        return raw === '' ? 0 : Number(raw);
                    });
                    const total = weights.reduce((sum,w,idx)=> sum + (w/100)*(scores[idx]||0), 0);
                    selectedActivity.grades[studentName].grade = isNaN(total) ? '' : String(total.toFixed(2));
                    selectedActivity.grades[studentName].details = { rubricScores: scores };
                    return;
                }
            } else if (ct && ct.template === 'number_range') { // NEW: Number Range type
                const gradeInput = listItem.querySelector('.grade-input');
                const val = gradeInput ? String(gradeInput.value).trim() : '';
                // Validation: numeric and within range
                if (val !== '') {
                    const num = Number(val);
                    const min = parseFloat(ct.min || 0);
                    const max = parseFloat(ct.max || 10);
                    const decimals = parseInt(ct.decimals || 0, 10);
                    if (!Number.isFinite(num) || num < min || num > max) {
                        if (gradeInput) gradeInput.classList.add('invalid-grade');
                        modalAlert(`Calificación inválida para \"${studentName}\". Debe ser un número entre ${min} y ${max}${decimals>0?` (hasta ${decimals} decimales)`:''}.`);
                        throw new Error('Number range validation failed');
                    } else {
                        if (gradeInput) gradeInput.classList.remove('invalid-grade');
                    }
                }
                selectedActivity.grades[studentName].grade = val === '' ? '-' : val;
                return;
            } else if (ct && ct.template === 'mixed') {
                // Read icon select and numeric input for mixed template
                const iconSelect = listItem.querySelector('.mixed-icon-select');
                const numberInput = listItem.querySelector('.mixed-number-input');
                const iconVal = iconSelect ? String(iconSelect.value).trim() : '';
                const numVal = numberInput ? String(numberInput.value).trim() : '';
                // Validate numeric part if present
                if (numVal !== '') {
                    const num = Number(numVal);
                    const min = parseFloat(ct.min || 0);
                    const max = parseFloat(ct.max || 10);
                    if (!Number.isFinite(num) || num < min || num > max) {
                        if (numberInput) numberInput.classList.add('invalid-grade');
                        modalAlert(`Número inválido para \"${studentName}\" en tipo Mixta. Debe estar entre ${min} y ${max}.`);
                        throw new Error('Mixed number validation failed');
                    } else {
                        if (numberInput) numberInput.classList.remove('invalid-grade');
                    }
                }
                // store as structured details
                selectedActivity.grades[studentName].grade = numVal === '' ? '-' : numVal;
                selectedActivity.grades[studentName].details = selectedActivity.grades[studentName].details || {};
                selectedActivity.grades[studentName].details.mixed = { icon: iconVal || '', number: numVal === '' ? null : numVal };
                return;
            }
            // For other custom types (value_list, emoji_faces, letter_scale, binary, attendance3, points_total)
            const genericSelectOrInput = listItem.querySelector('.grade-input');
            const val = genericSelectOrInput ? String(genericSelectOrInput.value).trim() : '';
            selectedActivity.grades[studentName].grade = val === '' ? '-' : val;
            return;
        }

        // Built-in types
        const gradeInput = listItem.querySelector('.grade-input');
        const newGrade = gradeInput ? String(gradeInput.value).trim() : '';
        // Validation for built-in numeric types
        if (selectedActivity.type === 'numeric_integer') {
            if (newGrade !== '' && newGrade !== '-' && newGrade !== 'NP') {
                const num = Number(newGrade);
                if (!Number.isInteger(num) || num < 0 || num > 10) {
                    if (gradeInput) gradeInput.classList.add('invalid-grade');
                    modalAlert(`Calificación inválida para \"${studentName}\". Debe ser un entero entre 0 y 10, 'NP' o '-'.`);
                    throw new Error('Numeric integer validation failed');
                } else {
                    if (gradeInput) gradeInput.classList.remove('invalid-grade');
                }
            }
        } else if (selectedActivity.type === 'numeric_decimal' || !selectedActivity.type) {
            if (newGrade !== '' && newGrade !== '-' && newGrade !== 'NP') {
                const num = Number(newGrade);
                if (!Number.isFinite(num) || num < 0 || num > 10) {
                    if (gradeInput) gradeInput.classList.add('invalid-grade');
                    modalAlert(`Calificación inválida para \"${studentName}\". Debe ser un número entre 0 y 10.`);
                    throw new Error('Numeric decimal validation failed');
                } else {
                    if (gradeInput) gradeInput.classList.remove('invalid-grade');
                }
            }
        }

        selectedActivity.grades[studentName].grade = newGrade;
        // The observation field in the modal already updates the selectedActivity.grades[studentName].observation
        // when saveObservationButton is clicked, which also triggers a save.
        // So, no need to update observation here.
    });

    saveAllGroupsCallback(); // Actual save to localStorage
    clearUnsavedChangesFlagCallback(); // Reset the unsaved changes flag
};

export const clearAllGradesForActivity = async (
    selectedActivity,
    setUnsavedChangesFlagCallback,
    loadStudentGradesCallback,
    selectedStudentNames,
    clearOption // 'grades', 'observations', 'both'
) => {
    if (!selectedStudentNames || selectedStudentNames.length === 0) {
        await modalAlert('No hay alumnos seleccionados.');
        return;
    }
    
    // Changed confirm to custom options modal for clear types
    // The prompt for deletion and user choice is now handled in grade_activity.js by `modalOptions`
    // This function assumes the user has already confirmed what to clear.

    selectedStudentNames.forEach(name => {
        if (selectedActivity.grades && selectedActivity.grades[name]) {
            if (clearOption === 'grades' || clearOption === 'both') {
                selectedActivity.grades[name].grade = '-'; // Set grade to '-'
                selectedActivity.grades[name].isNP = false; // Uncheck NP
                // If rubric details exist, clear them
                if (selectedActivity.grades[name].details) {
                    delete selectedActivity.grades[name].details;
                }
            }
            if (clearOption === 'observations' || clearOption === 'both') {
                selectedActivity.grades[name].observation = ''; // Clear observation
            }
        }
    });
    setUnsavedChangesFlagCallback();
    loadStudentGradesCallback();
    await modalAlert('Se han borrado las calificaciones/observaciones seleccionadas. Pulsa "Guardar Calificaciones" para registrar los cambios permanentemente.');
};

export const handleGradeInputControls = (event, selectedActivity, setUnsavedChangesFlag) => {
    const incrementButton = event.target.closest('.increment-grade-button');
    const decrementButton = event.target.closest('.decrement-grade-button');

    if (incrementButton || decrementButton) {
        const studentName = event.target.dataset.studentName;
        const listItem = event.target.closest('li');
        const gradeInput = listItem.querySelector('.grade-input');
        
        // Skip if input is disabled (e.g. by NP checkbox)
        if (gradeInput && gradeInput.disabled) {
            return true;
        }

        let currentValue = parseFloat(gradeInput.value);
        const step = parseFloat(gradeInput.step || '1'); // Get step from input, default to 1
        const minVal = parseFloat(gradeInput.min || -Infinity);
        const maxVal = parseFloat(gradeInput.max || Infinity);

        if (isNaN(currentValue)) {
            // Determine initial value when input is empty
            if (selectedActivity.type && selectedActivity.type.startsWith('custom:')) {
                const customTypes = getCustomGradingTypes();
                const ct = customTypes.find(t => `custom:${t.id}` === selectedActivity.type);
                if (ct && ct.template === 'number_range') {
                    // For number_range, start with ct.start value if available, otherwise minVal
                    const startVal = parseFloat(gradeInput.dataset.initialStart); // Get initial start value from data attribute
                    currentValue = !isNaN(startVal) ? startVal : minVal;
                } else {
                    currentValue = minVal !== -Infinity ? minVal : 0;
                }
            } else { // Built-in numeric types
                currentValue = minVal !== -Infinity ? minVal : 0;
            }
        }
        
        if (incrementButton) {
            currentValue = Math.min(maxVal, currentValue + step);
        } else if (decrementButton) {
            currentValue = Math.max(minVal, currentValue - step);
        }
        
        // Determine the number of decimals for display based on the step, or custom type decimals
        let displayDecimals = 0;
        if (selectedActivity.type && selectedActivity.type.startsWith('custom:')) {
            const customTypes = getCustomGradingTypes();
            const ct = customTypes.find(t => `custom:${t.id}` === selectedActivity.type);
            if (ct && ct.template === 'number_range') {
                displayDecimals = parseInt(ct.decimals || 0, 10);
            }
        } else if (selectedActivity.type === 'numeric_decimal') {
            displayDecimals = 1; // Default for numeric_decimal if no custom type
        } else {
            displayDecimals = (step.toString().split('.')[1] || '').length;
        }
        
        gradeInput.value = currentValue.toFixed(displayDecimals);
        setUnsavedChangesFlag();
        return true; // Indicates a control button was handled
    }
    return false; // No control button was handled
};

export const handleStudentListItemClick = (
    event,
    selectedActivity,
    studentGradesList,
    showObservationModalCallback,
    showStudentGradesHistoryModalCallback,
    setModalStudentCallback
) => {
    const observationButton = event.target.closest('.observation-button');
    const studentListItem = event.target.closest('li[data-student-name]');

    // If an observation button was clicked
    if (observationButton) {
        const studentName = observationButton.dataset.studentName;
        setModalStudentCallback(studentName); // Set currentModalStudent
        let currentObservation = (selectedActivity.grades[studentName] && selectedActivity.grades[studentName].observation) || '';
        showObservationModalCallback(studentName, currentObservation);
        return; // Handled, prevent other handlers
    }

    // If click is on the checkbox, let default checkbox handling happen and do not open history
    const checkbox = event.target.closest('.select-grade-checkbox');
    if (checkbox) {
        return; // don't open history when toggling checkbox
    }

    // Only open history when the user clicks the student's name (not anywhere on the list item)
    if (studentListItem && event.target.closest('.student-grade-item-name')) {
        if (studentGradesList && studentGradesList.dataset.suppressNextNameClick === '1') {
            delete studentGradesList.dataset.suppressNextNameClick;
            return; // suppress click after long-press modal
        }
        const studentName = studentListItem.dataset.studentName;
        showStudentGradesHistoryModalCallback(studentName);
        return; // Handled, prevent other handlers
    }
};

export const handleMarkActivityInline = (selectedActivity, mark, saveAllGroupsCallback, refreshHeaderCallback) => {
    if (mark === 'none') {
        delete selectedActivity.mark;
    } else {
        selectedActivity.mark = mark;
    }
    saveAllGroupsCallback();
    refreshHeaderCallback();
};

export const handleSaveActivityInlineEdits = async (currentGroup, selectedActivity, getFormValues, saveAllGroupsCallback, afterSaveCallbacks) => {
    const { name, date, category, type, description } = getFormValues();
    if (!name || !date) {
        await modalAlert('Por favor, completa el nombre y la fecha.');
        return false;
    }
    const originalType = selectedActivity.type || 'numeric_integer';
    if (originalType !== type) {
        // MODIFIED: Use helper function for readable type names
        const originalTypeName = getLocalizedActivityTypeName(originalType);
        const newTypeName = getLocalizedActivityTypeName(type);
        const confirmMsg = `Cambiar el tipo de calificación borrará todas las calificaciones registradas.\n\nDe: ${originalTypeName}\nA: ${newTypeName}\n\n¿Deseas continuar?`;
        const confirmChange = await modalConfirm(confirmMsg);
        if (!confirmChange) return false;
        selectedActivity.grades = {};
    }
    // Duplicate name check within group (ignore same activity object)
    const isDuplicate = (currentGroup.activities || []).some(a => a !== selectedActivity && a.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
        await modalAlert(`Ya existe otra actividad con el nombre "${name}" en este grupo.`);
        return false;
    }
    selectedActivity.name = name;
    selectedActivity.date = date;
    selectedActivity.category = category;
    selectedActivity.type = type;
    selectedActivity.description = description;
    saveAllGroupsCallback();
    if (afterSaveCallbacks) afterSaveCallbacks();
    await modalAlert('Actividad actualizada correctamente.');
    return true;
};

export const handleSaveActivityAnnotation = async (
    modalAnnotationTextarea,
    selectedActivity,
    saveAllGroupsCallback,
    hideModalCallback,
    updateBadgeCallback
) => {
    const newAnnotation = modalAnnotationTextarea.value.trim();
    if (!selectedActivity) return;
    if (newAnnotation === '') {
        // Remove annotation if empty
        delete selectedActivity.annotation;
    } else {
        selectedActivity.annotation = newAnnotation;
    }
    // Persist immediately
    saveAllGroupsCallback();
    // Update badge in UI
    if (updateBadgeCallback) updateBadgeCallback(selectedActivity);
    // Close modal
    if (hideModalCallback) hideModalCallback();
    await modalAlert('Anotación guardada correctamente.');
};

// NEW HELPER: Get localized activity type name for display
export const getLocalizedActivityTypeName = (type) => {
    switch (type) {
        case 'numeric_integer': return 'Numérica (0-10 enteras o NP)';
        case 'qualitative': return 'Cualitativa (NP, Mal, Regular, Bien, Muy bien)';
        case 'numeric_decimal': return 'Numérica exacta (0-10, con 2 decimales)';
        default:
            if (type && type.startsWith('custom:')) {
                const customTypes = getCustomGradingTypes();
                const customTypeId = type.substring(7);
                const customType = customTypes.find(t => t.id === customTypeId);
                if (customType) {
                    return `Personalizado: ${customType.name}`;
                }
            }
            return type; // Fallback to raw type if not found
    }
};