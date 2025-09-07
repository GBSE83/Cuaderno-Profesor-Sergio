import { formatDatePretty } from '../utils/date-utils.js'; // Import formatDatePretty
import { getCustomGradingTypes } from '../utils/storage.js';
import { modalAlert } from '../utils/backup-utils.js'; // NEW: Import modalAlert

export const updateActivityHeaderInfo = (selectedActivity, currentGroup, groupDisplayInfo, activityNameDisplay, activityDescriptionDisplay, activityDateDisplay, activityCategoryDisplay, gradingTypeDisplay) => {
    // Populate the new, more attractive header
    activityNameDisplay.textContent = selectedActivity.name;
    
    groupDisplayInfo.innerHTML = `<strong>Grupo:</strong> ${currentGroup.subjectName} (${currentGroup.gradeLevel} ${currentGroup.groupLetter})`;
    
    activityDateDisplay.innerHTML = `<strong>Fecha:</strong> ${formatDatePretty(selectedActivity.date)}`;

    if (activityCategoryDisplay) {
        activityCategoryDisplay.innerHTML = `<strong>Tipo:</strong> ${selectedActivity.category || 'Actividad'}`;
    }
    
    if (selectedActivity.description) {
        activityDescriptionDisplay.textContent = selectedActivity.description;
        activityDescriptionDisplay.style.display = 'block';
    } else {
        activityDescriptionDisplay.style.display = 'none';
    }
    
    // Also update the grading type in the new meta section
    let typeText = '';
    switch (selectedActivity.type) {
        case 'numeric_integer':
            typeText = 'Numérica (Entera)';
            break;
        case 'qualitative':
            typeText = 'Cualitativa';
            break;
        case 'numeric_decimal':
            typeText = 'Numérica (Decimal)';
            break;
        default:
            if ((selectedActivity.type || '').startsWith('custom:')) {
                const ct = getCustomGradingTypes().find(t => `custom:${t.id}` === selectedActivity.type);
                typeText = ct ? `Personalizado: ${ct.name}` : 'Personalizado';
            } else {
                typeText = 'No especificado';
            }
            break;
    }
    gradingTypeDisplay.innerHTML = `<strong>Calificación:</strong> ${typeText}`;
    const markDisplay = document.getElementById('activityMarkDisplay');
    if (markDisplay) {
        let icon = '';
        if (selectedActivity.mark === 'tick-green') icon = '✅';
        else if (selectedActivity.mark === 'triangle-yellow') icon = '⚠️';
        else if (selectedActivity.mark === 'x-red') icon = '❌';
        markDisplay.textContent = icon;
    }
    // Keep the select (if present) synchronized with current mark as well
    const markSelect = document.getElementById('activityMarkSelect');
    if (markSelect) {
        markSelect.value = selectedActivity.mark || 'none';
    }
};

export const updateActivityGradingTypeDisplay = (activityType, gradingTypeDisplayElement) => {
    let typeText = '';
    switch (activityType) {
        case 'numeric_integer':
            typeText = 'Numérica (0-10 enteras o NP)';
            break;
        case 'qualitative':
            typeText = 'Cualitativa (NP, Mal, Regular, Bien, Muy bien)';
            break;
        case 'numeric_decimal':
            typeText = 'Numérica exacta (0-10, con 2 decimales)';
            break;
        default:
            typeText = 'No especificado (por defecto: Numérica exacta)';
            break;
    }
    gradingTypeDisplayElement.textContent = `(${typeText})`;
};

export const renderStudentGrades = (students, selectedActivity, studentGradesList, saveGradesButton) => {
    studentGradesList.innerHTML = ''; // Clear existing list items

    if (!students || students.length === 0) {
        studentGradesList.innerHTML = '<li class="no-students-message">No hay alumnos en este grupo.</li>';
        saveGradesButton.disabled = true;
        return;
    }

    // Initialize grades object if it doesn't exist for the activity
    if (!selectedActivity.grades) {
        selectedActivity.grades = {};
    }

    // Default to 'numeric_decimal' if type is not set for existing activities
    const gradingType = selectedActivity.type || 'numeric_decimal';
    const customTypes = getCustomGradingTypes();

    students.forEach(student => {
        const studentName = student.name;
        let displayGrade = '';
        let savedObservation = '';
        let isNP = false; // NEW: NP state flag

        // Handle existing data which might be just a string grade or the new object format
        if (selectedActivity.grades[studentName]) {
            if (typeof selectedActivity.grades[studentName] === 'string') {
                // Legacy format: convert to new object format for consistency
                selectedActivity.grades[studentName] = { grade: selectedActivity.grades[studentName], observation: '' };
            }
            displayGrade = selectedActivity.grades[studentName].grade || ''; // Ensure it's a string, default to ''
            savedObservation = selectedActivity.grades[studentName].observation || '';
            isNP = !!selectedActivity.grades[studentName].isNP || displayGrade.toUpperCase() === 'NP'; // NEW: Check for NP
        } else {
            // Initialize if student has no grade/observation saved yet
            selectedActivity.grades[studentName] = { grade: '', observation: '' };
            displayGrade = '';
        }

        // Determine what to show in the input/select: '-' if grade is empty or already '-', otherwise the actual grade.
        const gradeToShow = (displayGrade === '' || displayGrade === '-') ? '-' : displayGrade;

        let gradeInputHtml = '';
        if (gradingType.startsWith('custom:')) {
            const ct = customTypes.find(t => `custom:${t.id}` === gradingType);
            if (ct) {
                if (ct.template === 'value_list') {
                    const values = ct.values || [];
                    gradeInputHtml = `
                        <select class="grade-input" id="grade-${studentName}" ${isNP ? 'disabled' : ''}>
                            <option value="-" ${gradeToShow === '-' ? 'selected' : ''}>-</option>
                            ${values.map(v => `<option value="${v}" ${gradeToShow === v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                    `;
                } else if (ct.template === 'emoji_faces') {
                    const values = (ct.faces || []).map(f => f);
                    gradeInputHtml = `
                        <select class="grade-input" id="grade-${studentName}" ${isNP ? 'disabled' : ''}>
                            <option value="-" ${gradeToShow === '-' ? 'selected' : ''}>-</option>
                            ${values.map(v => `<option value="${v}" ${gradeToShow === v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                    `;
                } else if (ct.template === 'letter_scale') {
                    const values = ct.scale || [];
                    gradeInputHtml = `
                        <select class="grade-input" id="grade-${studentName}" ${isNP ? 'disabled' : ''}>
                            <option value="-" ${gradeToShow === '-' ? 'selected' : ''}>-</option>
                            ${values.map(v => `<option value="${v}" ${gradeToShow === v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                    `;
                } else if (ct.template === 'binary') {
                    const yes = ct.yesLabel || 'Sí'; const no = ct.noLabel || 'No';
                    const opts = ['-', yes, no];
                    gradeInputHtml = `
                        <select class="grade-input" id="grade-${studentName}" ${isNP ? 'disabled' : ''}>
                            ${opts.map(v => `<option value="${v}" ${gradeToShow === v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                    `;
                } else if (ct.template === 'attendance3') {
                    const opts = ['-', ct.present || 'Presente', ct.late || 'Tarde', ct.absent || 'Ausente'];
                    gradeInputHtml = `
                        <select class="grade-input" id="grade-${studentName}" ${isNP ? 'disabled' : ''}>
                            ${opts.map(v => `<option value="${v}" ${gradeToShow === v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                    `;
                } else if (ct.template === 'points_total') {
                    const max = parseInt(ct.maxPoints || 10, 10);
                    const valueForInput = gradeToShow === '-' ? '' : displayGrade;
                    gradeInputHtml = `
                        <input type="number" step="1" min="0" max="${max}" class="grade-input" id="grade-${studentName}" value="${valueForInput}" placeholder="0 - ${max}" ${isNP ? 'disabled' : ''}>
                    `;
                } else if (ct.template === 'number_range') {
                    const min = parseFloat(ct.min || 0);
                    const max = parseFloat(ct.max || 10);
                    const decimals = parseInt(ct.decimals || 0, 10);
                    const step = parseFloat(ct.step || 1); // NEW: Get step from custom type
                    
                    // NEW: Default to empty string if no grade, otherwise use the grade.
                    // The 'start' value should *not* pre-fill the input, but be the starting point for buttons.
                    let initialValue = gradeToShow === '-' ? '' : displayGrade;
                    
                    gradeInputHtml = `
                        <div class="numeric-exact-controls">
                            <button class="decrement-grade-button" data-student-name="${studentName}" ${isNP ? 'disabled' : ''}>-</button>
                            <input type="number" step="${step}" min="${min}" max="${max}" class="grade-input" id="grade-${studentName}" value="${initialValue}" placeholder="${min.toFixed(decimals)} - ${max.toFixed(decimals)}" data-initial-start="${ct.start !== undefined && ct.start !== null && ct.start !== '' ? ct.start : min}" ${isNP ? 'disabled' : ''}>
                            <button class="increment-grade-button" data-student-name="${studentName}" ${isNP ? 'disabled' : ''}>+</button>
                        </div>
                    `;
                } else if (ct.template === 'mixed') {
                    // Mixed: icon + number
                    const icons = ct.icons || [];
                    const valueForNumber = gradeToShow === '-' ? '' : displayGrade;
                    gradeInputHtml = `
                        <div class="mixed-controls" data-student="${studentName}">
                            <select class="grade-input mixed-icon-select" id="grade-icon-${studentName}" ${isNP ? 'disabled' : ''}>
                                <option value="">--</option>
                                ${icons.map(ic => `<option value="${ic}" ${gradeToShow && selectedActivity.grades[studentName] && selectedActivity.grades[studentName].details && selectedActivity.grades[studentName].details.mixed && selectedActivity.grades[studentName].details.mixed.icon === ic ? 'selected' : ''}>${ic}</option>`).join('')}
                            </select>
                            <input type="number" step="${ct.step || 1}" min="${ct.min || 0}" max="${ct.max || 10}" class="grade-input mixed-number-input" id="grade-number-${studentName}" value="${valueForNumber}" placeholder="${ct.min || 0} - ${ct.max || 10}" ${isNP ? 'disabled' : ''}>
                        </div>
                    `;
                } else if (ct.template === 'rubric') {
                    const items = ct.items || [];
                    const saved = (selectedActivity.grades[studentName] && selectedActivity.grades[studentName].details && selectedActivity.grades[studentName].details.rubricScores) || [];
                    gradeInputHtml = `
                        <div class="rubric-grid" data-student="${studentName}">
                            ${items.map((it, idx) => {
                                const val = (typeof saved[idx] !== 'undefined') ? saved[idx] : '';
                                // Include description as title attribute so it shows on hover/press
                                // Also add an info icon if description exists
                                const descAttr = it.description ? `title="${(it.description).replace(/"/g, '&quot;')}"` : '';
                                const infoIconHtml = it.description ? `<img src="info_icon.png" alt="Info" class="rubric-info-icon" data-description="${(it.description).replace(/"/g, '&quot;')}" />` : '';
                                return `
                                <div class="rubric-row">
                                    <div class="rubric-title-with-icon" ${descAttr}>
                                        <span class="rubric-title-text">${it.title}</span>
                                        ${infoIconHtml}
                                    </div>
                                    <input type="number" class="rubric-input" data-item-index="${idx}" min="0" max="10" step="1" value="${val}" placeholder="0-10" ${isNP ? 'disabled' : ''}>
                                    <span class="rubric-weight">${it.weight}%</span>
                                </div>`;
                            }).join('')}
                            <div class="rubric-total-line"><span>Total (0-10): </span><strong class="rubric-total" id="rubric-total-${studentName}">${gradeToShow === '-' ? '0.00' : (isNaN(parseFloat(displayGrade)) ? '0.00' : parseFloat(displayGrade).toFixed(2))}</strong></div>
                        </div>
                    `;
                } else {
                    // Fallback if custom type definition missing
                    gradeInputHtml = `<select class="grade-input" id="grade-${studentName}"><option value="-" selected>-</option></select>`;
                }
            } else {
                // Fallback if custom type definition missing
                gradeInputHtml = `<select class="grade-input" id="grade-${studentName}"><option value="-" selected>-</option></select>`;
            }
        } else {
            switch (gradingType) {
                case 'numeric_integer':
                    gradeInputHtml = `
                        <select class="grade-input" id="grade-${studentName}" ${isNP ? 'disabled' : ''}>
                            <option value="-" ${gradeToShow === '-' ? 'selected' : ''}>-</option>
                            <option value="NP" ${gradeToShow === 'NP' ? 'selected' : ''}>NP</option>
                            ${Array.from({ length: 11 }, (_, i) => `<option value="${i}" ${gradeToShow === String(i) ? 'selected' : ''}>${i}</option>`).join('')}
                        </select>
                    `;
                    break;
                case 'qualitative':
                    const qualitativeOptions = ['NP', 'Mal', 'Regular', 'Bien', 'Muy bien'];
                    gradeInputHtml = `
                        <select class="grade-input" id="grade-${studentName}" ${isNP ? 'disabled' : ''}>
                            <option value="-" ${gradeToShow === '-' ? 'selected' : ''}>-</option>
                            ${qualitativeOptions.map(option => `<option value="${option}" ${gradeToShow === option ? 'selected' : ''}>${option}</option>`).join('')}
                        </select>
                    `;
                    break;
                case 'numeric_decimal':
                default: // Default to numeric_decimal if type is undefined or unknown
                    // For numeric_decimal, if gradeToShow is '-', display it. Otherwise, display the actual number.
                    // The input type="number" will handle '-' as an initial non-numeric value gracefully.
                    const valueForInput = gradeToShow === '-' ? '' : displayGrade;
                    gradeInputHtml = `
                        <div class="numeric-exact-controls">
                            <button class="decrement-grade-button" data-student-name="${studentName}" ${isNP ? 'disabled' : ''}>-</button>
                            <input type="number" step="0.1" min="0" max="10" class="grade-input" id="grade-${studentName}" value="${valueForInput}" placeholder="0.00 - 10.00" ${isNP ? 'disabled' : ''}>
                            <button class="increment-grade-button" data-student-name="${studentName}" ${isNP ? 'disabled' : ''}>+</button>
                        </div>
                    `;
                    break;
            }
        }

        // Truncate long names to 15 chars and add a small round '+' button to reveal full name
        const truncated = (studentName && studentName.length > 15) ? (studentName.slice(0,15) + '…') : studentName;
        const listItem = document.createElement('li');
        listItem.dataset.studentName = studentName;
        listItem.innerHTML = `
            <input type="checkbox" class="select-grade-checkbox" data-student-name="${studentName}">
            <span class="student-grade-item-name">${truncated}</span>
            <div class="grade-input-container">
                ${gradeInputHtml}
            </div>
            <div class="grade-actions-container">
                <label class="np-checkbox-container">
                    <input type="checkbox" class="np-checkbox" data-student-name="${studentName}" ${isNP ? 'checked' : ''}> NP
                </label>
                <button class="observation-button ${savedObservation ? 'has-observation' : ''}" data-student-name="${studentName}">Obs.</button>
            </div>
        `;
        studentGradesList.appendChild(listItem);
    });
    saveGradesButton.disabled = false;
};

// NEW: Function to attach event listeners to grade inputs
export const attachGradeInputListeners = (studentGradesList, setUnsavedChangesFlag) => {
    studentGradesList.addEventListener('change', (event) => {
        const target = event.target;
        if (target.matches('.grade-input, .np-checkbox')) {
            setUnsavedChangesFlag();
            if (target.matches('.np-checkbox')) {
                const li = target.closest('li');
                const disabled = target.checked;
                li.querySelectorAll('.grade-input, .rubric-input, .mixed-icon-select, .mixed-number-input').forEach(el => { el.disabled = disabled; });
                li.querySelectorAll('.increment-grade-button, .decrement-grade-button').forEach(btn => { btn.disabled = disabled; });
            }
        }
    });

    studentGradesList.addEventListener('input', (event) => {
        const target = event.target;
        if (target.matches('.grade-input, .rubric-input')) {
            setUnsavedChangesFlag();
            
            const listItem = target.closest('li');
            if (listItem) {
                const npCheckbox = listItem.querySelector('.np-checkbox');
                if (npCheckbox && npCheckbox.checked) {
                    npCheckbox.checked = false; // Uncheck NP if a grade is being entered
                    // Also re-enable grade input if it was disabled by NP
                    const gradeInput = listItem.querySelector('.grade-input');
                    const rubricInputs = listItem.querySelectorAll('.rubric-input');
                    if (gradeInput) gradeInput.disabled = false;
                    rubricInputs.forEach(input => input.disabled = false);
                }
            }
        }
    });

    // NEW: Handle click on rubric info icon to show description in a modal
    studentGradesList.addEventListener('click', async (event) => {
        const infoIcon = event.target.closest('.rubric-info-icon');
        if (infoIcon) {
            const description = infoIcon.dataset.description;
            if (description) {
                await modalAlert(description, 'Descripción del Ítem');
            }
        }
    });

    // Long-press on truncated student name to show full name
    let longPressTimer = null;
    const LONG_PRESS_MS = 600;
    const clearLongPress = () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } };

    studentGradesList.addEventListener('mousedown', (event) => {
        const nameEl = event.target.closest('.student-grade-item-name');
        if (!nameEl) return;
        clearLongPress();
        longPressTimer = setTimeout(async () => {
            const li = nameEl.closest('li[data-student-name]');
            if (!li) return;
            studentGradesList.dataset.suppressNextNameClick = '1';
            await modalAlert(li.dataset.studentName || '', 'Nombre completo');
        }, LONG_PRESS_MS);
    });
    studentGradesList.addEventListener('mouseup', clearLongPress);
    studentGradesList.addEventListener('mouseleave', clearLongPress);
    studentGradesList.addEventListener('mousemove', (e) => { if (e.buttons === 0) clearLongPress(); });
};

export const updateObservationButtonState = (studentName, hasObservation, studentGradesList) => {
    const studentListItem = studentGradesList.querySelector(`li[data-student-name="${studentName}"]`);
    if (studentListItem) {
        const obsButton = studentListItem.querySelector('.observation-button');
        if (obsButton) {
            if (hasObservation) {
                obsButton.classList.add('has-observation');
            } else {
                obsButton.classList.remove('has-observation');
            }
        }
    }
};

export const showObservationModal = (studentName, observation, modalStudentName, modalObservationTextarea, observationModal) => {
    modalStudentName.textContent = studentName;
    modalObservationTextarea.value = observation;
    observationModal.style.display = 'flex'; // Show the modal
};

export const hideObservationModal = (observationModal) => {
    observationModal.style.display = 'none';
};

export const applyGroupColorToActivityPage = (currentGroup, pageBody, studentListHeading) => {
    // Small, local helpers for color math (keeps the behaviour consistent with students page)
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

    if (currentGroup && currentGroup.color) {
        if (pageBody) pageBody.style.backgroundColor = currentGroup.color;

        if (studentListHeading) {
            const color = currentGroup.color;
            studentListHeading.style.borderBottom = `2px solid ${color}`;

            const rgb = hexToRgb(color);
            const { h, s, l } = rgbToHsl(rgb);

            if (l > 0.78) {
                const darker = { h, s: Math.min(1, s * 1.05), l: Math.max(0.14, l * 0.28) };
                studentListHeading.style.color = hslToHex(darker);
            } else if (l < 0.25) {
                // Prefer a lighter tone in the same hue (better contrast and consistent look)
                const lighter = { h, s: Math.max(0.05, s * 0.9), l: Math.min(0.92, l + 0.6) };
                studentListHeading.style.color = hslToHex(lighter);
            } else {
                studentListHeading.style.color = color;
            }
        }
    } else {
        if (pageBody) pageBody.style.backgroundColor = '';
        if (studentListHeading) {
            studentListHeading.style.color = '';
            studentListHeading.style.borderBottom = '';
        }
    }
};

export const fillActivityEditForm = (activity) => {
    const name = document.getElementById('editActivityName');
    const date = document.getElementById('editActivityDate');
    const cat = document.getElementById('editActivityCategory');
    const catOther = document.getElementById('editActivityCategoryOther');
    const type = document.getElementById('editActivityType');
    const desc = document.getElementById('editActivityDescription');
    if (!name || !date || !cat || !type || !desc) return;
    name.value = activity.name || '';
    date.value = activity.date || '';
    const category = activity.category || 'Examen';
    const predefined = Array.from(cat.options).some(o => o.value === category);
    if (predefined) {
        cat.value = category;
        catOther.style.display = 'none';
        catOther.value = '';
    } else {
        cat.value = 'otro';
        catOther.style.display = 'block';
        catOther.value = category;
    }
    type.value = activity.type || 'numeric_integer';
    desc.value = activity.description || '';
};

/* NEW: Manage activity-level annotation UI */
export const updateActivityAnnotationBadge = (selectedActivity) => {
    const badge = document.getElementById('activityAnnotationBadge');
    if (!badge) return;
    const hasAnnotation = !!(selectedActivity && selectedActivity.annotation && String(selectedActivity.annotation).trim().length > 0);
    badge.style.display = hasAnnotation ? 'inline-flex' : 'none';
};

export const showActivityAnnotationModal = (activityName, annotationTextarea, modalElement, currentAnnotation) => {
    const mName = document.getElementById('modalActivityName');
    if (mName) mName.textContent = activityName || '';
    if (annotationTextarea) annotationTextarea.value = currentAnnotation || '';
    if (modalElement) {
        modalElement.style.display = 'flex';
        modalElement.setAttribute('aria-hidden', 'false');
    }
};

export const hideActivityAnnotationModal = (modalElement) => {
    if (modalElement) {
        modalElement.style.display = 'none';
        modalElement.setAttribute('aria-hidden', 'true');
    }
};