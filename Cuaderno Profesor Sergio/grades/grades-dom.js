import { formatDate, addDays, formatDatePretty } from '../utils/date-utils.js';
import { getCustomGradingTypes } from '../utils/storage.js';
import { formatGradeLevelShort } from '../utils/date-utils.js'; // NEW: abbreviated grade level

export const renderGroupsDropdown = (
    allGroups,
    storedGroupKey,
    groupSelect,
    groupInfoDisplay,
    activitiesList,
    createActivitySection,
    duplicateActivitySection,
    onGroupSelectedCallback
) => {
    // Explicitly clear existing options to ensure full re-render
    while (groupSelect.firstChild) {
        groupSelect.removeChild(groupSelect.firstChild);
    }
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Selecciona un grupo';
    groupSelect.appendChild(defaultOption);

    if (allGroups.length === 0) {
        groupInfoDisplay.textContent = 'No hay grupos creados aún. Ve a "Creación y Selección de Grupos" para añadir.';
        groupSelect.disabled = true;
        activitiesList.innerHTML = '<li class="no-activities-message">No hay grupos creados.</li>';
        createActivitySection.style.display = 'none';
        duplicateActivitySection.style.display = 'none';
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

    let groupSelectedInDropdown = false;
    if (storedGroupKey) {
        // Check if storedGroupKey matches an existing group
        const isValidStoredGroup = allGroups.some(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === storedGroupKey);
        if (isValidStoredGroup) {
            groupSelect.value = storedGroupKey;
            groupSelectedInDropdown = true;
            // When setting value programmatically, the 'change' event does not fire automatically.
            // So, call the callback directly if setting value from storage.
            if (onGroupSelectedCallback) {
                onGroupSelectedCallback();
            }
        }
    }
    
    // If no group was selected by storedGroupKey (either not present or invalid),
    // and there are actual groups, default to selecting the first real group.
    if (!groupSelectedInDropdown && allGroups.length > 0) {
        const firstRealGroupKey = `${allGroups[0].subjectName}-${allGroups[0].gradeLevel}-${allGroups[0].groupLetter}`;
        groupSelect.value = firstRealGroupKey;
        // Also trigger the callback for this default selection
        if (onGroupSelectedCallback) {
            onGroupSelectedCallback();
        }
    } else if (!groupSelectedInDropdown) {
        // If no groups at all, or no valid selection was made, ensure UI reflects "no selection" state properly
        groupInfoDisplay.textContent = 'Selecciona un grupo para gestionar sus calificaciones.';
        activitiesList.innerHTML = '<li class="no-activities-message">Selecciona un grupo para ver las actividades.</li>';
        createActivitySection.style.display = 'none';
        duplicateActivitySection.style.display = 'none';
    }
};

export const renderActivitiesList = (currentGroup, sortedAndFilteredActivities, activitiesList) => {
    activitiesList.innerHTML = ''; // Clear existing list items

    if (!currentGroup) {
        activitiesList.innerHTML = '<li class="no-activities-message">Selecciona un grupo para ver las actividades.</li>';
        return;
    }

    // Use the pre-processed list passed to the function
    const activitiesToRender = sortedAndFilteredActivities;

    if (!activitiesToRender || activitiesToRender.length === 0) {
        const noActivitiesMessage = document.createElement('li');
        noActivitiesMessage.className = 'no-activities-message';
        noActivitiesMessage.textContent = 'No hay actividades que coincidan con los filtros seleccionados.';
        activitiesList.appendChild(noActivitiesMessage);
        return;
    }

    const today = formatDate(new Date()); // Get today's date in YYYY-MM-DD format for comparison
    const fourDaysFromNow = formatDate(addDays(new Date(), 4)); // Get date 4 days from now

    activitiesToRender.forEach((activity) => {
        // Find the original index of this activity in the unsorted, unfiltered array
        const originalIndex = currentGroup.activities.findIndex(a => a === activity);
        if (originalIndex === -1) return; // Should not happen, but as a safeguard

        // Provide a default type for existing activities if not set
        const displayType = activity.type || 'numeric_integer';
        let typeLabel = '';
        switch(displayType) {
            case 'numeric_integer': typeLabel = 'Numérica (Entera)'; break;
            case 'qualitative': typeLabel = 'Cualitativa'; break;
            case 'numeric_decimal': typeLabel = 'Numérica (Decimal)'; break;
            default:
                if (displayType.startsWith('custom:')) {
                    const ct = getCustomGradingTypes().find(t => `custom:${t.id}` === displayType);
                    typeLabel = ct ? `Personalizado: ${ct.name}` : 'Personalizado';
                } else {
                    typeLabel = 'Desconocido';
                }
        }

        // NEW: Get the display icon for the mark
        let markIcon = '';
        switch (activity.mark) {
            case 'tick-green': markIcon = '✅'; break;
            case 'triangle-yellow': markIcon = '⚠️'; break; // Changed from 'circle-red': '🔴'
            case 'x-red': markIcon = '❌'; break;
        }

        const listItem = document.createElement('li');
        listItem.className = 'activity-item-clickable';
        listItem.dataset.activityIndex = originalIndex; // Use the original index here

        // Add date-based classes
        if (activity.date < today) {
            listItem.classList.add('past-activity');
        } else if (activity.date === today) {
            listItem.classList.add('today-activity');
        } else if (activity.date <= fourDaysFromNow) {
            listItem.classList.add('upcoming-activity');
        }

        // NEW: Restructured HTML for a more attractive layout, including marks
        // place the activity type to the right of the date (small label)
        listItem.innerHTML = `<div class="activity-main-info"><div class="activity-mark-display">${markIcon}</div><div class="activity-name-and-date"><span class="activity-name">${activity.name}</span><div class="activity-date-row"><span class="activity-date">Fecha: ${formatDatePretty(activity.date)}</span><span class="activity-type-label">${activity.category || 'Actividad'}</span></div></div></div>${activity.description ? `<div class="activity-extra-info"><p class="activity-description">${activity.description}</p></div>` : '<div class="activity-extra-info" style="display:none;"></div>'}<div class="activity-grading-info"><span>Calificación: ${typeLabel}</span></div><div class="activity-controls"><div class="activity-actions"><button type="button" class="edit-button" data-activity-index="${originalIndex}">Editar</button><button type="button" class="delete-activity-button" data-activity-index="${originalIndex}">Eliminar</button><button type="button" class="duplicate-activity-button" data-activity-index="${originalIndex}">Duplicar</button></div><div class="activity-marks"><button class="mark-button" data-mark="tick-green" title="Marcar con tick verde">✅</button><button class="mark-button" data-mark="triangle-yellow" title="Marcar con triángulo amarillo">⚠️</button><button class="mark-button" data-mark="x-red" title="Marcar con X roja">❌</button><button class="mark-button" data-mark="none" title="Quitar marca">🚫</button></div></div>`;
        activitiesList.appendChild(listItem);

        // Add a compact options button (visible on narrow screens via CSS) alongside existing controls
        listItem.querySelector('.activity-controls').insertAdjacentHTML('afterbegin', '<button type="button" class="options-button" aria-label="Opciones">⚙️</button>');
    });
};

export const resetActivityForm = (activityNameInput, activityDescriptionInput, activityDateInput, activityTypeSelect, submitActivityButton, cancelEditButton, formatDateFn, shouldFocus = false, activityCategorySelect, activityCategoryOtherInput) => {
    activityNameInput.value = '';
    activityDescriptionInput.value = '';
    activityDateInput.value = formatDateFn(new Date()); // Reset date to current
    activityTypeSelect.value = 'numeric_integer'; // Reset type to default
    if (activityCategorySelect) {
        activityCategorySelect.value = 'Examen'; // Default category
    }
    if (activityCategoryOtherInput) {
        activityCategoryOtherInput.style.display = 'none';
        activityCategoryOtherInput.value = '';
        activityCategoryOtherInput.required = false;
    }
    submitActivityButton.textContent = 'Crear Actividad';
    cancelEditButton.style.display = 'none';
    if (shouldFocus) {
        activityNameInput.focus();
    }
};

export const fillActivityFormForEdit = (activity, activityNameInput, activityDescriptionInput, activityDateInput, activityTypeSelect, submitActivityButton, cancelEditButton, activityCategorySelect, activityCategoryOtherInput) => {
    activityNameInput.value = activity.name;
    activityDescriptionInput.value = activity.description;
    activityDateInput.value = activity.date;
    activityTypeSelect.value = activity.type || 'numeric_integer'; // Set type, default if not found

    if (activityCategorySelect && activityCategoryOtherInput) {
        const category = activity.category || 'Examen';
        const isPredefined = Array.from(activityCategorySelect.options).some(opt => opt.value === category);
        
        if (isPredefined) {
            activityCategorySelect.value = category;
            activityCategoryOtherInput.style.display = 'none';
            activityCategoryOtherInput.value = '';
            activityCategoryOtherInput.required = false;
        } else {
            activityCategorySelect.value = 'otro';
            activityCategoryOtherInput.style.display = 'block';
            activityCategoryOtherInput.value = category;
            activityCategoryOtherInput.required = true;
        }
    }

    submitActivityButton.textContent = 'Actualizar Actividad';
    cancelEditButton.style.display = 'inline-block';
    activityNameInput.focus();
};

export const showDuplicateSection = (activity, duplicateActivitySection, activityToDuplicateName, duplicateTargetGroupSelect, allGroups, createActivitySection) => {
    activityToDuplicateName.textContent = activity.name;
    createActivitySection.style.display = 'none'; // Hide create section
    duplicateActivitySection.style.display = 'block'; // Show duplicate section

    duplicateTargetGroupSelect.innerHTML = '<option value="">Selecciona un grupo</option>';
    allGroups.forEach(group => {
        const option = document.createElement('option');
        const groupKey = `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}`;
        option.value = groupKey;
        option.textContent = `${group.subjectName} (${formatGradeLevelShort(group.gradeLevel)} ${group.groupLetter})`;
        duplicateTargetGroupSelect.appendChild(option);
    });
};

export const hideDuplicateSection = (duplicateActivitySection, createActivitySection, duplicateTargetGroupSelect, keepGradesCheckbox) => {
    duplicateActivitySection.style.display = 'none';
    createActivitySection.style.display = 'block'; // Show create section again
    duplicateTargetGroupSelect.innerHTML = '<option value="">Selecciona un grupo</option>';
    keepGradesCheckbox.checked = true; // Reset checkbox to checked
};

export const displayGroupInfo = (currentGroup, groupInfoDisplay) => {
    if (currentGroup) {
        // Preserve the group's original casing for the group letter (do not force uppercase)
        groupInfoDisplay.textContent = `Grupo: ${currentGroup.subjectName} (${currentGroup.gradeLevel} ${currentGroup.groupLetter})`;
    } else {
        groupInfoDisplay.textContent = ''; // Clear if no group is selected
    }
};