import { formatDatePretty, formatGradeLevelShort } from '../utils/date-utils.js';
import { ensureStudentDetails } from './students-utils.js'; // Ensure to import ensureStudentDetails

export const applyGroupColorToStudentsPage = (group, pageBody, pageH1) => {
    // Helper: hex -> rgb
    const hexToRgb = (hex) => {
        hex = (hex || '').replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const v = parseInt(hex, 16);
        return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
    };
    // Helper: rgb -> hsl
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
    // Helper: hsl -> hex
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

    // Apply background color
    if (pageBody) pageBody.style.backgroundColor = group?.color || '';

    // Title styling with adaptive contrast: if background is very light, compute a darker same-hue color.
    if (pageH1) {
        const color = group?.color || '';
        pageH1.style.borderBottom = color ? `2px solid ${color}` : '';
        pageH1.style.paddingBottom = '10px';
        pageH1.style.marginBottom = '20px';

        if (!color) {
            pageH1.style.color = '';
            return;
        }

        const rgb = hexToRgb(color);
        const { h, s, l } = rgbToHsl(rgb);

        // Ensure title color contrasts with white: pick a darker lightness preserving hue/saturation
        const desiredL = Math.max(0.12, Math.min(0.35, l * 0.5)); // target a dark-enough tone
        const adjustedS = Math.min(1, Math.max(0.15, s)); // keep a reasonable saturation
        pageH1.style.color = hslToHex({ h, s: adjustedS, l: desiredL });
    }
};

export const updateGroupTitleDisplay = (group, groupTitleElement) => {
    if (groupTitleElement) {
        // Preserve the group's original casing and spacing as stored (do not force uppercasing)
        groupTitleElement.textContent = `${group.subjectName} (${formatGradeLevelShort(group.gradeLevel)} ${group.groupLetter})`;
    }
};

/**
 * Renders the list of students with controls.
 * @param {Array<object>} students - The array of student objects (already sorted and filtered).
 * @param {string} currentGroupKey - The key of the current group.
 * @param {HTMLElement} studentsListElement - The UL element to render students into.
 * @param {string} currentSortOrder - The currently active sort order ('manual', 'lastName', 'firstName').
 */
export const renderStudentsList = (students, currentGroupKey, studentsListElement, currentSortOrder) => {
    studentsListElement.innerHTML = ''; // Clear existing list items

    if (!students || students.length === 0) {
        renderNoStudentsMessage(studentsListElement);
        return;
    }

    // Determine if drag-and-drop should be enabled (only for 'manual' sort order)
    const draggableEnabled = (currentSortOrder === 'manual');

    students.forEach((student, index) => {
        const listItem = document.createElement('li');
        listItem.dataset.studentName = student.name;
        // Use the index from the *rendered* list for D&D operations on the DOM
        // The logic.js reorderStudents function will then correctly adjust based on this index in the current view.
        listItem.dataset.index = index;
        listItem.draggable = draggableEnabled; // Conditionally enable drag

        // Add a class for non-draggable items to visually indicate it
        if (!draggableEnabled) {
            listItem.classList.add('not-draggable');
        }

        listItem.innerHTML = `
            <span class="student-name">${student.name}</span>
            <div class="student-controls">
                <button class="edit-student-name-button" data-student-name="${student.name}">Editar</button>
                <button class="delete-button" data-student-index="${index}">Eliminar</button>
            </div>
        `;
        studentsListElement.appendChild(listItem);
    });
};

export const renderNoStudentsMessage = (studentsListElement) => {
    studentsListElement.innerHTML = '';
    const noStudentsMessage = document.createElement('li');
    noStudentsMessage.className = 'no-students-message';
    noStudentsMessage.textContent = 'No hay alumnos en este grupo aún.';
    // Ensure non-draggable for no-students message
    noStudentsMessage.draggable = false;
    noStudentsMessage.classList.add('not-draggable');
    studentsListElement.appendChild(noStudentsMessage);
};

/**
 * Populates the student information modal with data.
 * @param {object} student - The student object.
 * @param {HTMLElement} currentGroup - The current group object.
 * @param {HTMLElement} modalStudentInfoName - Element for student name.
 * @param {HTMLElement} modalStudentObservations - Textarea for observations.
 * @param {HTMLElement} charACNEE - Checkbox for ACNEE.
 * @param {HTMLElement} charCOMPE - Checkbox for COMPE.
 * @param {HTMLElement} charREPET - Checkbox for REPET.
 * @param {HTMLElement} charADAPT - Checkbox for ADAPT.
 * @param {HTMLElement} totalFaltasElement - Element to display total absence count.
 * @param {Function} calculateAbsencesCountFn - Function to calculate absences/expulsions.
 * @param {HTMLElement} viewStudentDetailsSection - The section containing observations/characteristics/attendance summary.
 * @param {HTMLElement} editStudentNameSection - The section for editing name.
 */
export const populateStudentInfoModal = (
    student,
    currentGroup, // NEW: Pass currentGroup for classification types
    modalStudentInfoName,
    modalStudentObservations,
    charACNEE,
    charCOMPE,
    charREPET,
    charADAPT,
    totalFaltasElement,
    calculateAbsencesCountFn,
    viewStudentDetailsSection,
    editStudentNameSection
) => {
    modalStudentInfoName.textContent = student.name;
    modalStudentObservations.value = student.details.observations || '';
    
    // Set active state for characteristic buttons
    charACNEE.classList.toggle('active', student.details.characteristics.ACNEE || false);
    charCOMPE.classList.toggle('active', student.details.characteristics.COMPE || false);
    charREPET.classList.toggle('active', student.details.characteristics.REPET || false);
    charADAPT.classList.toggle('active', student.details.characteristics.ADAPT || false);

    // NEW: Populate classifications UI
    const classificationList = document.getElementById('classificationList');
    const addClassificationButton = document.getElementById('addClassificationButton');
    let showEmptyClassificationRow = false; // <-- hide empty inputs until button pressed
    const renderClassifications = () => {
        if (!classificationList) return;
        classificationList.innerHTML = '';

        // Get all classification types defined for the group
        const groupClassificationTypes = new Set(currentGroup.classificationTypes || []);

        // Get the current student's classifications
        const studentClassificationsMap = new Map((student.details.classifications || []).map(c => [c.type, c.description]));

        // Create a combined list of all unique classification types
        // This includes group-level types and any student-specific types (for backward compatibility if a student has a type not in group.classificationTypes)
        const allUniqueClassificationTypes = new Set([...groupClassificationTypes, ...Array.from(studentClassificationsMap.keys())]);
        
        // Sort types alphabetically for consistent display
        const sortedTypes = Array.from(allUniqueClassificationTypes).sort();

        // Render each classification row
        sortedTypes.forEach((type, idx) => {
            const description = studentClassificationsMap.get(type) || ''; // Get student's description, or empty
            const isGroupType = groupClassificationTypes.has(type); // Is this a type defined at the group level?

            const row = document.createElement('div');
            row.className = 'classification-row';
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.alignItems = 'flex-start';
            row.dataset.type = type; // Store the type for easy lookup later

            row.innerHTML = `
                <div style="width:100%;">
                    <input class="classification-type" placeholder="Tipo" value="${type || ''}" style="width:100%; padding:8px; box-sizing:border-box;">
                    <input class="classification-desc" placeholder="Descripción breve" value="${description}" style="width:100%; margin-top:8px; padding:8px; box-sizing:border-box;">
                    <button class="remove-classification" title="Eliminar este tipo de clasificación para el grupo" aria-label="Eliminar tipo" style="position:absolute; right:6px; top:8px; padding:0; width:24px; height:24px; border-radius:4px; border:none; background:#dc3545; color:#fff; font-size:13px;">✖</button>
                </div>
            `;
            classificationList.appendChild(row);
        });

        // Only show the empty inputs if the user has pressed "Añadir tipo"
        if (showEmptyClassificationRow) {
            const newRow = document.createElement('div');
            newRow.className = 'classification-row new-classification-row';
            newRow.style.display = 'flex';
            newRow.style.gap = '8px';
            newRow.style.alignItems = 'flex-start';
            newRow.innerHTML = `
                <div style="width:100%;">
                    <input class="classification-type" placeholder="Nuevo tipo" value="" style="width:100%; padding:8px; box-sizing:border-box;">
                    <input class="classification-desc" placeholder="Descripción breve" value="" style="width:100%; margin-top:8px; padding:8px; box-sizing:border-box;">
                    <button class="remove-classification" title="Eliminar este tipo de clasificación para el grupo" aria-label="Eliminar tipo" style="position:absolute; right:6px; top:8px; padding:0; width:24px; height:24px; border-radius:4px; border:none; background:#dc3545; color:#fff; font-size:13px;">✖</button>
                </div>
            `;
            classificationList.appendChild(newRow);
        }

        // Attach listeners for remove buttons.
        // On click, it effectively marks the type for deletion in the *group-level list* (handled by saveStudentDetails).
        classificationList.querySelectorAll('.remove-classification').forEach(btn => {
            btn.onclick = (e) => {
                const rowToRemove = e.target.closest('.classification-row');
                rowToRemove.remove(); // Remove from DOM immediately
                // The actual logic of updating `group.classificationTypes` and propagating to other students
                // will happen in `saveStudentDetails` by comparing the DOM state with the `currentGroup.classificationTypes`.
            };
        });
    };
    if (addClassificationButton) {
        addClassificationButton.onclick = () => {
            // Reveal the empty inputs for adding a new classification type
            showEmptyClassificationRow = true;
            renderClassifications();
            // Scroll to the new empty row for better UX
            classificationList.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
            classificationList.lastElementChild.querySelector('.classification-type').focus();
        };
    }
    renderClassifications(); // Initial render for current student

    // Setup filter controls (type of absence, justification) and update counts accordingly
    const absenceDaysSelect = document.getElementById('absenceDaysSelect');
    const absenceTypeSelect = document.getElementById('absenceTypeSelect');
    const justificationFilterSelect = document.getElementById('justificationFilterSelect');

    const updateCounts = () => {
        const typeFilter = absenceTypeSelect ? absenceTypeSelect.value : 'all';
        const justificationFilter = justificationFilterSelect ? justificationFilterSelect.value : 'all';
        const lastNDays = absenceDaysSelect ? (absenceDaysSelect.value === 'all' ? Infinity : parseInt(absenceDaysSelect.value, 10)) : 30;
        const { absences, expulsions, delays, incidences } = calculateAbsencesCountFn(student.name, { typeFilter, justificationFilter, lastNDays });
        // Include delays and incidencias both in their dedicated counts and in the total faltas
        const total = (absences || 0) + (expulsions || 0) + (delays || 0) + (incidences || 0);
        if (totalFaltasElement) {
            totalFaltasElement.textContent = total;
            totalFaltasElement.title = `Ausencias: ${absences} · Retrasos: ${delays} · Expulsiones: ${expulsions} · Incidencias: ${incidences}`; // breakdown on hover
        }
    };

    // Initialize selects and listeners (defensive: only if present in DOM)
    if (absenceDaysSelect) { absenceDaysSelect.value = '30'; absenceDaysSelect.addEventListener('change', updateCounts); }
    if (absenceTypeSelect) { absenceTypeSelect.value = 'all'; absenceTypeSelect.addEventListener('change', updateCounts); }
    if (justificationFilterSelect) { justificationFilterSelect.value = 'all'; justificationFilterSelect.addEventListener('change', updateCounts); }

    // Initial counts render
    updateCounts();

    // Show details section, hide name edit section
    viewStudentDetailsSection.style.display = 'block';
    editStudentNameSection.style.display = 'none';
};

/**
 * Populates the name editing section of the student info modal.
 * @param {object} student - The student object.
 * @param {HTMLElement} modalStudentInfoName - Element for student name in the title.
 * @param {HTMLElement} modalEditFirstName - Input for editing first name.
 * @param {HTMLElement} modalEditLastName - Input for editing last name.
 * @param {HTMLElement} viewStudentDetailsSection - The section containing observations/characteristics/attendance summary.
 * @param {HTMLElement} editStudentNameSection - The section for editing name.
 * @param {Function} splitFullNameFn - Utility function to split full name.
 * @param {HTMLElement} modalChangeGroupSelect - The select element for changing groups.
 * @param {Array<object>} allGroups - All groups data for populating the dropdown.
 * @param {string} currentGroupKey - The key of the current group to exclude from options.
 */
export const populateStudentNameEditSection = (
    student,
    modalStudentInfoName,
    modalEditFirstName,
    modalEditLastName,
    viewStudentDetailsSection,
    editStudentNameSection,
    splitFullNameFn,
    modalChangeGroupSelect,
    allGroups,
    currentGroupKey
) => {
    modalStudentInfoName.textContent = student.name; // Still display full name in title
    const { firstName, lastName } = splitFullNameFn(student.name);
    modalEditFirstName.value = firstName;
    modalEditLastName.value = lastName;

    // Show name edit section, hide details section
    viewStudentDetailsSection.style.display = 'none';
    editStudentNameSection.style.display = 'block';

    // Populate the 'Cambiar Grupo' dropdown
    modalChangeGroupSelect.innerHTML = '<option value="">Selecciona un grupo</option>';
    allGroups.filter(group => `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}` !== currentGroupKey).forEach(group => {
        const option = document.createElement('option');
        option.value = `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}`;
        option.textContent = `${group.subjectName} (${group.gradeLevel} ${group.groupLetter})`;
        modalChangeGroupSelect.appendChild(option);
    });
    modalChangeGroupSelect.value = ''; // Ensure it's reset
};

export const showStudentInfoModal = (modalElement) => {
    modalElement.style.display = 'flex';
    // Focus logic moved to individual populate functions or event listeners
};

export const hideStudentInfoModal = (modalElement) => {
    modalElement.style.display = 'none';
};

export const clearDragDropClasses = (studentsListElement) => {
    Array.from(studentsListElement.children).forEach(child => {
        child.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
    });
};