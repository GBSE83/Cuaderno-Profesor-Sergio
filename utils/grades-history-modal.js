import { getGroups, setSessionItem, saveGroups } from './storage.js';
import { formatDatePretty } from './date-utils.js';
import { getCustomGradingTypes } from './storage.js'; // NEW: to detect custom/rubric types
import { modalAlert } from './backup-utils.js'; // NEW: Import modalAlert

let _allStudentsInGradesHistoryContext = [];
let _currentStudentInGradesHistoryModal = '';
let _currentGroupKeyInGradesHistoryModal = '';
let _currentActivityContextOnOpeningPage = null; // NEW: To store activity context of the opening page

/**
 * Helper to get localized activity type names for display in modals.
 */
export const getLocalizedActivityType = (type) => {
    switch(type) {
        case 'numeric_integer': return 'Numérica (Entera)';
        case 'qualitative': return 'Cualitativa';
        case 'numeric_decimal': return 'Numérica (Decimal)';
        default: return 'Desconocido';
    }
};

/**
 * Helper to get grade history data for a specific student in a specific group.
 * @param {string} studentName
 * @param {string} groupKey
 * @returns {Array<object>} All activities for the student in the group.
 */
const getStudentActivitiesForGroup = (studentName, groupKey) => {
    const allGroups = getGroups();
    const group = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === groupKey);
    if (!group || !group.activities) return [];

    const rows = [];
    group.activities.forEach((activity, idx) => {
        const gradeEntry = activity.grades ? activity.grades[studentName] : null;
        const grade = gradeEntry ? (gradeEntry.grade || '-') : '-';
        const observation = gradeEntry ? (gradeEntry.observation || '') : '';
        const isNP = gradeEntry ? gradeEntry.isNP : false;
        rows.push({
            activityName: activity.name,
            date: activity.date,
            grade,
            observation,
            activityIndex: idx, // Original index in the group's activities array
            type: activity.type || 'numeric_decimal',
            category: activity.category || '',
            isNP: isNP
        });
    });
    return rows;
};

/**
 * Renders the filter controls and table for the current student in the modal.
 * This function will be called initially and whenever filters or student changes.
 */
const renderGradesHistoryTableContent = () => {
    const studentName = _currentStudentInGradesHistoryModal;
    const groupKey = _currentGroupKeyInGradesHistoryModal;
    const studentGradesHistoryTableBody = document.getElementById('studentGradesHistoryTableBody');
    const noGradesMessage = document.getElementById('noGradesMessage');
    const modalContent = document.getElementById('studentGradesHistoryModal').querySelector('.modal-content');
    const saveBtn = document.getElementById('studentGradesHistorySaveButton');

    const allActivityRowsForCurrentStudent = getStudentActivitiesForGroup(studentName, groupKey);

    // Get filter elements (assume they are already rendered and present in the DOM)
    const dateFromEl = modalContent.querySelector('#ghm-date-from');
    const dateToEl = modalContent.querySelector('#ghm-date-to');
    const typeSelect = modalContent.querySelector('#ghm-type-select'); // Activity category type
    const searchInput = modalContent.querySelector('#ghm-text-search');

    // Apply current filters
    const df = dateFromEl ? dateFromEl.value : '';
    const dt = dateToEl ? dateToEl.value : '';
    const selType = typeSelect ? typeSelect.value : 'all';
    const text = searchInput ? (searchInput.value || '').trim().toLowerCase() : '';

    const filtered = allActivityRowsForCurrentStudent.filter(r => {
        if (df && r.date < df) return false;
        if (dt && r.date > dt) return false;
        if (selType !== 'all' && r.category !== selType) return false;
        if (text) {
            const hay = (r.activityName + ' ' + (r.observation || '') + ' ' + (r.category || '')).toLowerCase();
            if (!hay.includes(text)) return false;
        }
        return true;
    });

    studentGradesHistoryTableBody.innerHTML = '';
    if (filtered.length === 0) {
        noGradesMessage.style.display = 'block';
        studentGradesHistoryTableBody.style.display = 'none';
        if (saveBtn) saveBtn.disabled = true;
        return;
    } else {
        noGradesMessage.style.display = 'none';
        studentGradesHistoryTableBody.style.display = '';
        // Save button is disabled on hide and re-enabled only if an interaction occurs.
        // For now, keep it disabled until a change.
    }

    // Apply sorting based on sort control (default: date_desc)
    try {
        const modalContent = document.getElementById('studentGradesHistoryModal').querySelector('.modal-content');
        const sortEl = modalContent ? modalContent.querySelector('#ghm-sort-select') : null;
        const sortVal = sortEl ? sortEl.value : 'date_desc';
        switch (sortVal) {
            case 'date_asc':
                filtered.sort((a,b) => (a.date || '').localeCompare(b.date || ''));
                break;
            case 'date_desc':
                filtered.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
                break;
            case 'created_asc':
                // activityIndex reflects original creation order: lower = earlier
                filtered.sort((a,b) => (a.activityIndex - b.activityIndex));
                break;
            case 'created_desc':
                filtered.sort((a,b) => (b.activityIndex - a.activityIndex));
                break;
            default:
                filtered.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
        }
    } catch (e) {
        console.warn('Error applying sort in grades history modal', e);
    }

    const customTypes = getCustomGradingTypes();
    filtered.forEach(r => {
        const row = document.createElement('tr');
        row.dataset.activityIndex = r.activityIndex;
        // Construct activity name cell with link
        const tdActivity = document.createElement('td');
        tdActivity.innerHTML = `<a href="#" class="view-activity-link" data-group-key="${groupKey}" data-activity-index="${r.activityIndex}" data-student-name="${studentName}" title="Ver actividad: ${r.activityName}">${r.activityName}</a>${r.category ? `<div style="font-size:0.85em;color:#6c757d;margin-top:4px;">Tipo: ${r.category}</div>` : ''}`;
        
        const tdDate = document.createElement('td');
        tdDate.textContent = formatDatePretty(r.date);
        
        const tdGrade = document.createElement('td'); tdGrade.style.textAlign = 'center';
        let gradeInputEl;

        // Determine input based on activity type
        if ((r.type || '').startsWith('custom:')) {
            const ctId = (r.type || '').substring(7);
            const ct = customTypes.find(t => t.id === ctId);
            if (ct && ct.template === 'rubric') {
                gradeInputEl = document.createElement('span');
                gradeInputEl.textContent = r.grade === '-' ? '-' : r.grade;
                gradeInputEl.style.fontStyle = 'italic';
            } else if (ct && (ct.template === 'value_list' || ct.template === 'letter_scale' || ct.template === 'emoji_faces' || ct.template === 'binary' || ct.template === 'attendance3')) {
                const values = (ct.template === 'value_list' || ct.template === 'letter_scale') ? (ct.values || ct.scale || []) : (ct.faces || []);
                if (ct.template === 'binary') values.push(ct.yesLabel, ct.noLabel);
                if (ct.template === 'attendance3') values.push(ct.present, ct.late, ct.absent);

                gradeInputEl = document.createElement('select');
                gradeInputEl.className = 'ghm-grade-input';
                gradeInputEl.innerHTML = `<option value="-" ${r.grade === '-' ? 'selected' : ''}>-</option>` + values.filter(Boolean).map(v => `<option value="${v}" ${r.grade === v ? 'selected' : ''}>${v}</option>`).join('');
            } else if (ct && ct.template === 'points_total') {
                const max = parseInt(ct.maxPoints || 10, 10);
                gradeInputEl = document.createElement('input');
                gradeInputEl.type = 'number';
                gradeInputEl.step = '1';
                gradeInputEl.min = '0';
                gradeInputEl.max = String(max);
                gradeInputEl.className = 'ghm-grade-input';
                gradeInputEl.value = r.grade === '-' ? '' : r.grade;
                gradeInputEl.style.textAlign = 'center';
                gradeInputEl.style.width = '80px';
            } else if (ct && ct.template === 'number_range') { // NEW: Number Range type
                const min = parseFloat(ct.min || 0);
                const max = parseFloat(ct.max || 10);
                const decimals = parseInt(ct.decimals || 0, 10);
                const step = (decimals > 0) ? `0.${'0'.repeat(decimals - 1)}1` : '1';
                gradeInputEl = document.createElement('input');
                gradeInputEl.type = 'number';
                gradeInputEl.step = step;
                gradeInputEl.min = String(min);
                gradeInputEl.max = String(max);
                gradeInputEl.className = 'ghm-grade-input';
                gradeInputEl.value = r.grade === '-' ? '' : r.grade;
                gradeInputEl.style.textAlign = 'center';
                gradeInputEl.style.width = '80px';
            } else if (ct && ct.template === 'mixed') { // NEW: Mixed type - show only numeric part in history
                const min = parseFloat(ct.min || 0);
                const max = parseFloat(ct.max || 10);
                const decimals = parseInt(ct.decimals || 0, 10);
                const step = (decimals > 0) ? `0.${'0'.repeat(decimals - 1)}1` : '1';
                gradeInputEl = document.createElement('input');
                gradeInputEl.type = 'number';
                gradeInputEl.step = step;
                gradeInputEl.min = String(min);
                gradeInputEl.max = String(max);
                gradeInputEl.className = 'ghm-grade-input';
                gradeInputEl.value = r.grade === '-' ? '' : r.grade; // only number shown/edited
                gradeInputEl.style.textAlign = 'center';
                gradeInputEl.style.width = '80px';
            }
            else {
                // Fallback for unknown custom types
                gradeInputEl = document.createElement('input');
                gradeInputEl.type = 'text';
                gradeInputEl.className = 'ghm-grade-input';
                gradeInputEl.value = r.grade;
                gradeInputEl.style.textAlign = 'center';
                gradeInputEl.style.width = '80px';
            }
        } else {
            switch (r.type) {
                case 'numeric_integer':
                    gradeInputEl = document.createElement('select');
                    gradeInputEl.className = 'ghm-grade-input';
                    gradeInputEl.innerHTML = `<option value="-" ${r.grade==='-'?'selected':''}>-</option><option value="NP" ${r.grade==='NP'?'selected':''}>NP</option>${Array.from({length:11},(_,i)=>`<option value="${i}" ${String(i)===r.grade?'selected':''}>${i}</option>`).join('')}`;
                    break;
                case 'qualitative':
                    gradeInputEl = document.createElement('select');
                    gradeInputEl.className = 'ghm-grade-input';
                    const qualitativeOptions = ['NP','Mal','Regular','Bien','Muy bien'];
                    gradeInputEl.innerHTML = `<option value="-" ${r.grade==='-'?'selected':''}>-</option>` + qualitativeOptions.map(o=>`<option value="${o}" ${r.grade===o?'selected':''}>${o}</option>`).join('');
                    break;
                case 'numeric_decimal':
                default:
                    gradeInputEl = document.createElement('input');
                    gradeInputEl.type = 'number';
                    gradeInputEl.step = '0.1';
                    gradeInputEl.min = '0';
                    gradeInputEl.max = '10';
                    gradeInputEl.className = 'ghm-grade-input';
                    gradeInputEl.value = r.grade === '-' ? '' : r.grade;
                    gradeInputEl.style.textAlign = 'center';
                    gradeInputEl.style.width = '80px';
                    break;
            }
        }
        tdGrade.appendChild(gradeInputEl);

        // Combine NP checkbox and Observation input into one <td>
        const tdObservations = document.createElement('td');
        
        const isNP = !!r.isNP || r.grade.toUpperCase() === 'NP';
        const npCheckboxContainer = document.createElement('label');
        npCheckboxContainer.className = 'ghm-np-checkbox-container';
        npCheckboxContainer.innerHTML = `<input type="checkbox" class="ghm-np-checkbox" ${isNP ? 'checked' : ''}>NP`;
        tdObservations.appendChild(npCheckboxContainer);

        const obsInput = document.createElement('input');
        obsInput.type = 'text';
        obsInput.className = 'ghm-observation-input';
        obsInput.value = r.observation || '';
        tdObservations.appendChild(obsInput);

        row.appendChild(tdActivity);
        row.appendChild(tdDate);
        row.appendChild(tdGrade);
        row.appendChild(tdObservations); // Append the single combined TD
        studentGradesHistoryTableBody.appendChild(row);

        // Add event listeners to inputs to enable save button
        if (gradeInputEl) gradeInputEl.addEventListener('change', () => { if (saveBtn) saveBtn.disabled = false; });
        if (obsInput) obsInput.addEventListener('change', () => { if (saveBtn) saveBtn.disabled = false; });
        // Add listener for NP checkbox
        const npCheckbox = npCheckboxContainer.querySelector('.ghm-np-checkbox');
        if (npCheckbox) {
            npCheckbox.addEventListener('change', () => {
                if (saveBtn) saveBtn.disabled = false;
                if (gradeInputEl) gradeInputEl.disabled = npCheckbox.checked;
                // If NP is checked, clear grade input. If unchecked, restore previous grade (or empty).
                if (npCheckbox.checked) {
                    if (gradeInputEl.tagName === 'SELECT') {
                        gradeInputEl.value = 'NP'; // Set select to NP directly if it's an option
                    } else if (gradeInputEl.type === 'number' || gradeInputEl.type === 'text') {
                        gradeInputEl.value = '';
                    }
                } else {
                    // When unchecking NP, restore the actual grade if it was 'NP', or just re-enable.
                    // If the stored grade was 'NP', it should revert to empty or '-'
                    const currentGradeValue = r.grade; // Original grade before opening modal
                    if (currentGradeValue === 'NP' && gradeInputEl.tagName === 'SELECT') {
                        gradeInputEl.value = '-'; // Revert to empty/default if was NP
                    } else if (currentGradeValue === 'NP' && (gradeInputEl.type === 'number' || gradeInputEl.type === 'text')) {
                        gradeInputEl.value = ''; // Revert to empty if was NP
                    } else {
                        // Else, just re-enable and keep current value
                        gradeInputEl.value = r.grade === '-' ? '' : r.grade;
                    }
                }
            });
            // Initial state for grade input based on NP checkbox
            if (gradeInputEl) gradeInputEl.disabled = npCheckbox.checked;
        }
    });
};

const attachGradesHistorySaveListener = () => {
    const saveBtn = document.getElementById('studentGradesHistorySaveButton');
    if (!saveBtn || saveBtn.dataset.listenerAttached) return;

    saveBtn.addEventListener('click', async () => {
        const studentName = _currentStudentInGradesHistoryModal;
        const groupKey = _currentGroupKeyInGradesHistoryModal;
        const studentGradesHistoryTableBody = document.getElementById('studentGradesHistoryTableBody');

        try {
            const allGroups = getGroups();
            const group = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === groupKey);
            if (!group) { await modalAlert('Grupo no encontrado, no se pudieron guardar los cambios.'); return; }

            const rows = Array.from(studentGradesHistoryTableBody.querySelectorAll('tr'));

            // First pass: validate all inputs. If any invalid, show alert and highlight offending input.
            for (const tr of rows) {
                const activityIndex = parseInt(tr.dataset.activityIndex, 10);
                if (!group.activities || !group.activities[activityIndex]) continue;
                const activity = group.activities[activityIndex];
                const gradeInput = tr.querySelector('.ghm-grade-input');
                const npCheckbox = tr.querySelector('.ghm-np-checkbox');

                // Clear previous invalid markers
                if (gradeInput) gradeInput.classList.remove('ghm-invalid');

                const isNP = npCheckbox ? npCheckbox.checked : false;
                const newGradeRaw = gradeInput ? String(gradeInput.value).trim() : '-';

                if (isNP) continue; // NP is always valid

                if ((activity.type || '').startsWith('custom:')) {
                    const ctId = (activity.type || '').substring(7);
                    const ct = getCustomGradingTypes().find(t => t.id === ctId);
                    if (ct && ct.template === 'points_total') {
                        if (newGradeRaw !== '') {
                            const num = Number(newGradeRaw);
                            const max = parseInt(ct.maxPoints || 10, 10);
                            if (!Number.isFinite(num) || num < 0 || num > max) {
                                if (gradeInput) gradeInput.classList.add('ghm-invalid');
                                await modalAlert(`Calificación inválida para la actividad \"${activity.name}\". Debe ser un número entre 0 y ${max}.`);
                                return;
                            }
                        }
                    } else if (ct && ct.template === 'number_range') {
                        if (newGradeRaw !== '') {
                            const num = Number(newGradeRaw);
                            const min = parseFloat(ct.min || 0);
                            const max = parseFloat(ct.max || 10);
                            if (!Number.isFinite(num) || num < min || num > max) {
                                if (gradeInput) gradeInput.classList.add('ghm-invalid');
                                await modalAlert(`Calificación inválida para la actividad \"${activity.name}\". Debe ser un número entre ${min} y ${max}.`);
                                return;
                            }
                        }
                    } else if (ct && ct.template === 'mixed') { // NEW: validate mixed numeric part
                        if (newGradeRaw !== '') {
                            const num = Number(newGradeRaw);
                            const min = parseFloat(ct.min || 0);
                            const max = parseFloat(ct.max || 10);
                            if (!Number.isFinite(num) || num < min || num > max) {
                                if (gradeInput) gradeInput.classList.add('ghm-invalid');
                                await modalAlert(`Calificación numérica inválida para la actividad \"${activity.name}\". Debe ser un número entre ${min} y ${max}.`);
                                return;
                            }
                        }
                    } else {
                        // For other custom templates (selects, etc.) no numeric validation needed here
                    }
                } else {
                    // Built-in types
                    switch (activity.type) {
                        case 'numeric_integer':
                            if (newGradeRaw !== '' && newGradeRaw !== '-' && newGradeRaw !== 'NP') {
                                const num = Number(newGradeRaw);
                                if (!Number.isInteger(num) || num < 0 || num > 10) {
                                    if (gradeInput) gradeInput.classList.add('ghm-invalid');
                                    await modalAlert(`Calificación inválida para la actividad \"${activity.name}\". Debe ser un entero entre 0 y 10, 'NP' o '-'.`);
                                    return;
                                }
                            }
                            break;
                        case 'numeric_decimal':
                        default:
                            if (newGradeRaw !== '' && newGradeRaw !== '-' && newGradeRaw !== 'NP') {
                                const num = Number(newGradeRaw);
                                if (!Number.isFinite(num) || num < 0 || num > 10) {
                                    if (gradeInput) gradeInput.classList.add('ghm-invalid');
                                    await modalAlert(`Calificación inválida para la actividad \"${activity.name}\". Debe ser un número entre 0 y 10.`);
                                    return;
                                }
                            }
                            break;
                    }
                }
            }

            // If validation passed, proceed to save
            rows.forEach(tr => {
                const activityIndex = parseInt(tr.dataset.activityIndex, 10);
                const gradeInput = tr.querySelector('.ghm-grade-input');
                const obsInput = tr.querySelector('.ghm-observation-input');
                const npCheckbox = tr.querySelector('.ghm-np-checkbox');
                
                const isNP = npCheckbox ? npCheckbox.checked : false;
                const newGrade = gradeInput ? String(gradeInput.value).trim() : '-';
                const newObs = obsInput ? String(obsInput.value).trim() : '';

                if (!group.activities || !group.activities[activityIndex]) return;
                if (!group.activities[activityIndex].grades) group.activities[activityIndex].grades = {};
                
                let finalGrade;
                if (isNP) {
                    finalGrade = 'NP';
                } else {
                    finalGrade = (newGrade === '' ? '-' : newGrade); // Ensure empty is saved as '-'
                }
                
                group.activities[activityIndex].grades[studentName] = { grade: finalGrade, observation: newObs, isNP: isNP };
            });

            saveGroups(allGroups);
            await modalAlert('Cambios guardados correctamente.');
            // If the user is viewing the same activity page, update its student list inputs live
            try {
                if (window.location.pathname.endsWith('grade_activity.html')) {
                    const studentGradesList = document.getElementById('studentGradesList');
                    if (studentGradesList) {
                        rows.forEach(tr => {
                            const activityIndex = parseInt(tr.dataset.activityIndex, 10);
                            if (activityIndex !== _currentActivityContextOnOpeningPage?.activityIndex) return;
                            const studentName = _currentStudentInGradesHistoryModal; // current modal student
                            const listItem = studentGradesList.querySelector(`li[data-student-name=\"${CSS.escape(studentName)}\"]`);
                            if (!listItem) return;
                            const gradeInput = tr.querySelector('.ghm-grade-input');
                            const obsInput = tr.querySelector('.ghm-observation-input');
                            const npCheckbox = tr.querySelector('.ghm-np-checkbox');
                            // Update grade input in activity page
                            const targetGradeInput = listItem.querySelector(`#grade-${CSS.escape(studentName)}`);
                            if (targetGradeInput) {
                                if (gradeInput.tagName === 'SELECT' || gradeInput.tagName === 'INPUT') {
                                    targetGradeInput.value = gradeInput.value === '' ? (gradeInput.tagName === 'SELECT' ? '-' : '') : gradeInput.value;
                                }
                                const disabled = !!npCheckbox && npCheckbox.checked;
                                // Toggle all related inputs/buttons to mirror NP state
                                listItem.querySelectorAll('.grade-input, .rubric-input, .mixed-icon-select, .mixed-number-input').forEach(el => { el.disabled = disabled; });
                                listItem.querySelectorAll('.increment-grade-button, .decrement-grade-button').forEach(btn => { btn.disabled = disabled; });
                            }
                            // Update NP checkbox state
                            const targetNp = listItem.querySelector('.np-checkbox');
                            if (targetNp) targetNp.checked = !!npCheckbox && npCheckbox.checked;
                            // Update observation and visual state
                            const targetObsBtn = listItem.querySelector('.observation-button');
                            if (targetObsBtn) {
                                const newObs = obsInput ? obsInput.value.trim() : '';
                                if (newObs) targetObsBtn.classList.add('has-observation'); else targetObsBtn.classList.remove('has-observation');
                            }
                        });
                    }
                }
            } catch (err) {
                console.warn('No se pudo actualizar la vista de actividad en vivo:', err);
            }
            saveBtn.disabled = true; // Disable after saving
        } catch (err) {
            console.error(err);
            await modalAlert('Error al guardar los cambios. Mira la consola para más detalles.');
        }
    });
    saveBtn.dataset.listenerAttached = 'true';
};

/**
 * Main function to show the student grades history modal with extended filters.
 * @param {string} studentName - Name of the student.
 * @param {string} groupKey - Key of the group the student belongs to.
 * @param {HTMLElement} modalStudentGradesName - DOM element for student name in modal header.
 * @param {HTMLElement} studentGradesHistoryTableBody - DOM element for table body.
 * @param {HTMLElement} noGradesMessage - DOM element for no grades message.
 * @param {HTMLElement} studentGradesHistoryModal - The modal root element.
 * @param {Array<object>} studentsInContext - List of students currently visible on the calling page (for navigation).
 * @param {object|null} currentActivityContext - Optional context of the current activity if opened from grade_activity.html.
 *                                                Format: `{ groupKey: '...', activityIndex: N }`.
 */
export const showStudentGradesHistoryModal = (
    studentName,
    groupKey,
    modalStudentGradesName,
    studentGradesHistoryTableBody,
    noGradesMessage,
    studentGradesHistoryModal,
    studentsInContext, // NEW parameter
    currentActivityContext = null // NEW parameter
) => {
    // Set global context for navigation
    _currentStudentInGradesHistoryModal = studentName;
    _currentGroupKeyInGradesHistoryModal = groupKey;
    _allStudentsInGradesHistoryContext = studentsInContext || []; // Store the full list
    _currentActivityContextOnOpeningPage = currentActivityContext; // NEW: Store current activity context

    modalStudentGradesName.textContent = studentName;

    const modalContent = studentGradesHistoryModal.querySelector('.modal-content');
    modalContent.style.maxWidth = '820px';
    modalContent.style.width = '92%';
    modalContent.style.overflowX = 'hidden';

    // Ensure filter controls are rendered only once and then updated via callbacks
    let filtersContainer = modalContent.querySelector('.ghm-filters-container');
    if (!filtersContainer) {
        filtersContainer = document.createElement('div');
        filtersContainer.className = 'ghm-filters-container';
        filtersContainer.style.padding = '12px 18px';
        filtersContainer.style.borderBottom = '1px solid #e9ecef';
        // Insert after the h2
        modalContent.insertBefore(filtersContainer, modalContent.querySelector('h2').nextSibling); // After h2
        
        // --- Render filters and attach listeners ---
        const dateFromGroup = document.createElement('div');
        dateFromGroup.innerHTML = `<label style="font-weight:600;margin-right:6px;">Desde:</label><input type="date" id="ghm-date-from">`;
        const dateToGroup = document.createElement('div');
        dateToGroup.innerHTML = `<label style="font-weight:600;margin-right:6px;">Hasta:</label><input type="date" id="ghm-date-to">`;

        const typeGroup = document.createElement('div');
        typeGroup.innerHTML = `<label style="font-weight:600;margin-right:6px;">Tipo actividad:</label>`;
        const typeSelect = document.createElement('select');
        typeSelect.id = 'ghm-type-select';
        typeGroup.appendChild(typeSelect);

        const searchGroup = document.createElement('div');
        searchGroup.style.flex = '1 1 200px';
        searchGroup.innerHTML = `<label style="font-weight:600;margin-right:6px;">Buscar:</label><input type="search" id="ghm-text-search" placeholder="Buscar por nombre de actividad u observación...">`;

        // Sort control: by date or by creation order
        const sortGroup = document.createElement('div');
        sortGroup.innerHTML = `<label style="font-weight:600;margin-right:6px;">Ordenar:</label>`;
        const sortSelect = document.createElement('select');
        sortSelect.id = 'ghm-sort-select';
        sortSelect.innerHTML = `<option value="date_desc">Fecha (futuras primero)</option>
                                <option value="date_asc">Fecha (pasadas primero)</option>
                                <option value="created_asc">Creación (antes)</option>
                                <option value="created_desc">Creación (después)</option>`;
        sortGroup.appendChild(sortSelect);

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.textContent = 'Limpiar filtros';
        clearBtn.className = 'btn ghost';
        clearBtn.style.marginLeft = '8px';
        clearBtn.style.padding = '6px 10px';
        clearBtn.style.minWidth = 'unset';

        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexWrap = 'wrap';
        wrapper.style.gap = '10px';
        wrapper.style.marginBottom = '12px';
        wrapper.style.alignItems = 'center';
        wrapper.appendChild(dateFromGroup);
        wrapper.appendChild(dateToGroup);
        wrapper.appendChild(sortGroup);
        wrapper.appendChild(typeGroup);
        wrapper.appendChild(searchGroup);
        wrapper.appendChild(clearBtn);
        filtersContainer.appendChild(wrapper);

        // Get live references to the newly created elements
        const dateFromEl = filtersContainer.querySelector('#ghm-date-from');
        const dateToEl = filtersContainer.querySelector('#ghm-date-to');
        const searchInput = filtersContainer.querySelector('#ghm-text-search');
        const sortSelectEl = filtersContainer.querySelector('#ghm-sort-select');

        // Wire filter change listeners
        [dateFromEl, dateToEl, typeSelect, searchInput, sortSelectEl].forEach(el => {
            if (!el) return;
            el.addEventListener('change', renderGradesHistoryTableContent);
            el.addEventListener('input', renderGradesHistoryTableContent);
        });
        clearBtn.addEventListener('click', () => {
            if (dateFromEl) dateFromEl.value = '';
            if (dateToEl) dateToEl.value = '';
            if (typeSelect) typeSelect.value = 'all';
            if (searchInput) searchInput.value = '';
            if (sortSelectEl) sortSelectEl.value = 'date_desc';
            renderGradesHistoryTableContent();
        });

    } 

    // Always re-populate activity categories based on the current student's activities in the current group
    const typeSelectEl = filtersContainer.querySelector('#ghm-type-select');
    if (typeSelectEl) {
        // Store current selected value before clearing and repopulating
        const currentSelectedType = typeSelectEl.value;

        const activitiesForCategories = getStudentActivitiesForGroup(studentName, groupKey);
        const categories = Array.from(new Set(activitiesForCategories.map(a => a.category || '').filter(Boolean)));
        typeSelectEl.innerHTML = `<option value="all">Todas</option>`;
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            typeSelectEl.appendChild(opt);
        });
        // Try to restore previous selection, or default to 'all'
        if (Array.from(typeSelectEl.options).some(opt => opt.value === currentSelectedType)) {
            typeSelectEl.value = currentSelectedType;
        } else {
            typeSelectEl.value = 'all'; // Fallback if the category is no longer available for the new student
        }
    }

    renderGradesHistoryTableContent(); // Initial render of the table for the new student
    attachGradesHistorySaveListener(); // Ensure save button listener is attached
    
    // NEW: Attach the activity link listener to the specific tbody if not already attached
    if (!studentGradesHistoryTableBody.dataset.activityLinkListenerAttached) {
        studentGradesHistoryTableBody.addEventListener('click', (event) => {
            const link = event.target.closest('.view-activity-link');
            if (!link) return;
            event.preventDefault(); // Prevent default link behavior
            
            const linkGroupKey = link.dataset.groupKey;
            const linkActivityIndex = parseInt(link.dataset.activityIndex);
            const studentNameFromLink = link.dataset.studentName;

            // Check if the current page is grade_activity.html and if the link points to the same activity
            const isCurrentPageGradeActivity = window.location.pathname.endsWith('grade_activity.html');
            const isSameActivity = isCurrentPageGradeActivity &&
                                   _currentActivityContextOnOpeningPage &&
                                   _currentActivityContextOnOpeningPage.groupKey === linkGroupKey &&
                                   _currentActivityContextOnOpeningPage.activityIndex === linkActivityIndex;

            if (isSameActivity) {
                // If it's the same activity on grade_activity.html, just close the modal and highlight the student.
                hideStudentGradesHistoryModal(studentGradesHistoryModal);
                // Trigger a custom event to tell grade_activity.js to highlight the student
                window.dispatchEvent(new CustomEvent('highlightStudentInActivity', {
                    detail: { studentName: studentNameFromLink }
                }));
            } else {
                // Otherwise store target group/activity/student in session and navigate to activity page
                if (linkGroupKey && linkActivityIndex !== undefined) {
                    setSessionItem('selectedGroupKey', linkGroupKey);
                    setSessionItem('selectedActivityIndex', linkActivityIndex);
                    if (studentNameFromLink) setSessionItem('selectedStudentName', studentNameFromLink);
                    window.location.href = 'grade_activity.html';
                }
            }
        });
        studentGradesHistoryTableBody.dataset.activityLinkListenerAttached = 'true';
    }

    // NEW: Attach listeners for navigation buttons if they exist
    const prevButton = studentGradesHistoryModal.querySelector('#gradesHistoryPrevButton');
    const nextButton = studentGradesHistoryModal.querySelector('#gradesHistoryNextButton');

    if (prevButton && !prevButton.dataset.listenerAttached) {
        prevButton.addEventListener('click', () => navigateToAdjacentStudentGradesHistory(-1));
        prevButton.dataset.listenerAttached = 'true';
    }
    if (nextButton && !nextButton.dataset.listenerAttached) {
        nextButton.addEventListener('click', () => navigateToAdjacentStudentGradesHistory(1));
        nextButton.dataset.listenerAttached = 'true';
    }

    updateGradesHistoryNavButtonsState(); // Update button disabled state

    studentGradesHistoryModal.style.display = 'flex'; // Show the modal
    // Limit visible rows by constraining the table container height and enabling vertical scroll
    const tableContainer = studentGradesHistoryModal.querySelector('.grades-history-table-container');
    if (tableContainer) {
        tableContainer.style.maxHeight = '340px'; // approx 5 rows plus header
        tableContainer.style.overflowY = 'auto';
        tableContainer.style.overflowX = 'hidden';
        tableContainer.style.overflowX = 'auto'; // enable horizontal scroll if needed
        // NEW: enable drag-to-scroll horizontally (mouse + touch) on the table container
        if (!tableContainer.dataset.dragScrollAttached) {
            tableContainer.dataset.dragScrollAttached = 'true';
            let isDown = false, startX = 0, scrollLeft = 0;
            const isInteractiveElement = (el) => !!el.closest && !!el.closest('input, select, textarea, button, a, label');
            tableContainer.addEventListener('mousedown', (e) => {
                // If user started the pointer on an interactive control, let the control handle the event.
                if (isInteractiveElement(e.target)) return;
                isDown = true;
                tableContainer.classList.add('drag-scrolling');
                startX = e.pageX - tableContainer.offsetLeft;
                scrollLeft = tableContainer.scrollLeft;
                e.preventDefault();
            });
            tableContainer.addEventListener('mouseleave', () => { isDown = false; tableContainer.classList.remove('drag-scrolling'); });
            tableContainer.addEventListener('mouseup', () => { isDown = false; tableContainer.classList.remove('drag-scrolling'); });
            tableContainer.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                const x = e.pageX - tableContainer.offsetLeft;
                const walk = (x - startX) * 1; // scroll-fast multiplier
                tableContainer.scrollLeft = scrollLeft - walk;
            });
            // touch support
            tableContainer.addEventListener('touchstart', (e) => {
                // Ignore touchstart on interactive controls to allow form interactions (tap to focus)
                if (isInteractiveElement(e.target)) return;
                startX = e.touches[0].pageX - tableContainer.offsetLeft;
                scrollLeft = tableContainer.scrollLeft;
            }, { passive: true });
            tableContainer.addEventListener('touchmove', (e) => {
                const x = e.touches[0].pageX - tableContainer.offsetLeft;
                const walk = (x - startX) * 1;
                tableContainer.scrollLeft = scrollLeft - walk;
            }, { passive: true });
        }
    }
};

/**
 * Navigates to the previous or next student's grades history within the current context.
 * @param {number} direction - -1 for previous, 1 for next.
 */
const navigateToAdjacentStudentGradesHistory = (direction) => {
    if (!_currentStudentInGradesHistoryModal || _allStudentsInGradesHistoryContext.length === 0) return;

    const currentNames = _allStudentsInGradesHistoryContext.map(s => s.name);
    const currentIndex = currentNames.indexOf(_currentStudentInGradesHistoryModal);

    if (currentIndex === -1) return;

    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= currentNames.length) return; // No wrap-around

    const newStudentName = currentNames[newIndex];
    // Re-call show function with new student name (reusing the same groupKey, etc.)
    showStudentGradesHistoryModal(
        newStudentName,
        _currentGroupKeyInGradesHistoryModal,
        document.getElementById('modalStudentGradesName'),
        document.getElementById('studentGradesHistoryTableBody'),
        document.getElementById('noGradesMessage'),
        document.getElementById('studentGradesHistoryModal'),
        _allStudentsInGradesHistoryContext, // Pass the same context list
        _currentActivityContextOnOpeningPage // Pass the same activity context
    );
};

const updateGradesHistoryNavButtonsState = () => {
    const prevButton = document.getElementById('gradesHistoryPrevButton');
    const nextButton = document.getElementById('gradesHistoryNextButton');

    if (!prevButton || !nextButton || _allStudentsInGradesHistoryContext.length === 0) {
        if (prevButton) prevButton.disabled = true;
        if (nextButton) nextButton.disabled = true;
        return;
    }

    const currentNames = _allStudentsInGradesHistoryContext.map(s => s.name);
    const currentIndex = currentNames.indexOf(_currentStudentInGradesHistoryModal);

    prevButton.disabled = (currentIndex <= 0);
    nextButton.disabled = (currentIndex >= currentNames.length - 1);
};

/**
 * Hides the student grades history modal.
 */
export const hideStudentGradesHistoryModal = (studentGradesHistoryModal) => {
    studentGradesHistoryModal.style.display = 'none';
    // Clear filter values when hiding the modal, but leave the DOM elements for next time.
    const modalContent = studentGradesHistoryModal.querySelector('.modal-content');
    const filtersContainer = modalContent.querySelector('.ghm-filters-container');
    if (filtersContainer) {
        const dateFromEl = filtersContainer.querySelector('#ghm-date-from');
        const dateToEl = filtersContainer.querySelector('#ghm-date-to');
        const typeSelect = filtersContainer.querySelector('#ghm-type-select');
        const searchInput = filtersContainer.querySelector('#ghm-text-search');
        const sortSelectEl = filtersContainer.querySelector('#ghm-sort-select'); // NEW: Get sort select

        if (dateFromEl) dateFromEl.value = '';
        if (dateToEl) dateToEl.value = '';
        if (typeSelect) typeSelect.value = 'all'; // Reset category filter
        if (searchInput) searchInput.value = '';
        if (sortSelectEl) sortSelectEl.value = 'date_desc'; // NEW: Reset sort to default
    }

    // Clear global state
    _allStudentsInGradesHistoryContext = [];
    _currentStudentInGradesHistoryModal = '';
    _currentGroupKeyInGradesHistoryModal = '';
    _currentActivityContextOnOpeningPage = null; // NEW: Clear current activity context
    updateGradesHistoryNavButtonsState(); // Disable buttons when modal is hidden
    
    // Disable save button explicitly when hiding
    const saveBtn = document.getElementById('studentGradesHistorySaveButton');
    if (saveBtn) saveBtn.disabled = true;
};