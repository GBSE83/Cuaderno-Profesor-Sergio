import { modalConfirm, modalAlert } from '../utils/backup-utils.js'; // <-- new import (used by logic functions)
import { getCustomGradingTypes } from '../utils/storage.js'; // NEW: import custom grading types

// Helper function to get localized activity type names for display
const getLocalizedActivityType = (type) => {
    switch(type) {
        case 'numeric_integer': return 'Numérica (0-10 enteras o NP)';
        case 'qualitative': return 'Cualitativa (NP, Mal, Regular, Bien, Muy bien)';
        case 'numeric_decimal': return 'Numérica exacta (0-10, con 2 decimales)';
        default:
            if (type && type.startsWith('custom:')) {
                const customTypes = getCustomGradingTypes();
                const customTypeId = type.substring(7); // remove "custom:"
                const customType = customTypes.find(t => t.id === customTypeId);
                if (customType) {
                    return `Personalizado: ${customType.name}`;
                }
            }
            return 'Desconocido'; // Fallback
    }
};

export const handleCreateOrUpdateActivity = async (
    event,
    currentGroup,
    editingActivityIndex,
    activityNameInput,
    activityDescriptionInput,
    activityDateInput,
    activityTypeSelect, // New parameter
    activityCategory, // NEW: activity category
    saveAllGroups, // Callback to save groups
    loadActivitiesForGroup, // Callback to reload list
    resetActivityForm // Callback to reset form
) => {
    event.preventDefault();

    if (!currentGroup) {
        await modalAlert('Por favor, selecciona un grupo primero.');
        return;
    }

    const activityName = activityNameInput.value.trim();
    const activityDescription = activityDescriptionInput.value.trim();
    const activityDate = activityDateInput.value;
    const newActivityType = activityTypeSelect.value; // Get the selected type

    if (!activityName || !activityDate) {
        await modalAlert('Por favor, completa el nombre de la actividad y la fecha.');
        return;
    }

    if (editingActivityIndex !== -1) {
        // Update existing activity
        const originalActivity = currentGroup.activities[editingActivityIndex];
        const originalActivityType = originalActivity.type || 'numeric_integer'; // Get the original type, with default

        // Check for duplicate name if name is changed
        const isDuplicate = (currentGroup.activities || []).some((activity, idx) =>
            idx !== editingActivityIndex && activity.name.toLowerCase() === activityName.toLowerCase()
        );

        if (isDuplicate) {
            await modalAlert(`Ya existe otra actividad con el nombre "${activityName}" en este grupo.`);
            return;
        }

        // WARNING: If activity type changes, clear existing grades
        if (originalActivityType !== newActivityType) {
            const confirmationMessage = `Advertencia: Si cambias el tipo de calificación de la actividad "${originalActivity.name}" de "${getLocalizedActivityType(originalActivityType)}" a "${getLocalizedActivityType(newActivityType)}", se borrarán todas las calificaciones registradas para esta actividad. ¿Deseas continuar?`;
            const ok = await modalConfirm(confirmationMessage);
            if (!ok) {
                activityTypeSelect.value = originalActivityType;
                await modalAlert('Cambio de tipo de calificación cancelado. La actividad no fue actualizada con el nuevo tipo.');
                return;
            } else {
                // User confirmed, clear grades for this activity
                originalActivity.grades = {};
                // NEW: Also clear rubric-specific details if changing away from rubric
                if (originalActivity.type && originalActivity.type.startsWith('custom:')) {
                    const ct = getCustomGradingTypes().find(t => `custom:${t.id}` === originalActivity.type);
                    if (ct && ct.template === 'rubric') {
                        // If it was a rubric, ensure rubricDetails are cleared
                        delete originalActivity.rubricDetails;
                    }
                }
                console.log(`Calificaciones borradas para la actividad "${originalActivity.name}" debido al cambio de tipo.`);
            }
        }

        originalActivity.name = activityName;
        originalActivity.description = activityDescription;
        originalActivity.date = activityDate;
        originalActivity.type = newActivityType; // Save the new type
        originalActivity.category = activityCategory; // NEW: Save the category
        // Note: activity 'mark' is preserved on update

        await modalAlert('Actividad actualizada correctamente.');

    } else {
        // Create new activity
        // Check for duplicate activity name within the current group
        const isDuplicate = (currentGroup.activities || []).some(activity =>
            activity.name.toLowerCase() === activityName.toLowerCase()
        );

        if (isDuplicate) {
            await modalAlert(`Ya existe una actividad con el nombre "${activityName}" en este grupo.`);
            return;
        }

        const newActivity = {
            name: activityName,
            description: activityDescription,
            date: activityDate,
            type: newActivityType, // Save the selected type
            category: activityCategory, // NEW: Save the category
            mark: null, // NEW: Initialize mark property
            grades: {} // Initialize with an empty grades object for new activities
        };

        if (!currentGroup.activities) {
            currentGroup.activities = [];
        }
        currentGroup.activities.push(newActivity);
        await modalAlert('Actividad creada correctamente.');
    }

    saveAllGroups();
    loadActivitiesForGroup(); // Reload list
    resetActivityForm(); // Reset form to default state
};

export const handleDeleteActivity = async (
    index,
    currentGroup,
    saveAllGroups,
    loadActivitiesForGroup,
    setEditingActivityIndex, // Current editing index in the main component
    resetActivityForm // Callback to reset form if deleted activity was being edited
) => {
    const activityToDelete = currentGroup.activities[index];
    const ok = await modalConfirm(`¿Estás seguro de que quieres eliminar la actividad "${activityToDelete.name}"?`);
    if (!ok) return;
    currentGroup.activities.splice(index, 1);
    saveAllGroups();
    loadActivitiesForGroup();
    await modalAlert('Actividad eliminada correctamente.');

    // If the deleted activity was being edited, reset the form
    if (setEditingActivityIndex() === index) { // Call setter to get current value
        resetActivityForm();
        setEditingActivityIndex(-1); // Reset editing index via setter
    }
};

export const handleDuplicateActivity = async (
    activityToDuplicate,
    targetGroupKey,
    shouldKeepGrades,
    allGroups,
    currentGroupKey,
    saveAllGroups,
    hideDuplicateSection,
    loadActivitiesForGroup
) => {
    if (!activityToDuplicate) {
        await modalAlert('No se ha seleccionado ninguna actividad para duplicar.');
        return;
    }

    if (!targetGroupKey) {
        await modalAlert('Por favor, selecciona un grupo de destino.');
        return;
    }

    const targetGroup = allGroups.find(group =>
        `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}` === targetGroupKey
    );

    if (targetGroup) {
        let newActivityName = activityToDuplicate.name;
        let finalActivity = {
            name: newActivityName,
            description: activityToDuplicate.description,
            date: activityToDuplicate.date,
            type: activityToDuplicate.type, // Duplicate the activity type
            category: activityToDuplicate.category, // NEW: Duplicate the category
            mark: activityToDuplicate.mark, // NEW: Duplicate the mark
            grades: shouldKeepGrades ? JSON.parse(JSON.stringify(activityToDuplicate.grades)) : {} // Deep copy or empty
        };

        if (targetGroupKey === currentGroupKey) {
            // Duplicating within the same group, need to generate a unique name
            let copyCount = 0;
            let originalName = activityToDuplicate.name;
            do {
                copyCount++;
                newActivityName = `${originalName} (Copia${copyCount > 1 ? ' ' + copyCount : ''})`;
                // Check if this generated name already exists in the current group
                const existsInCurrentGroup = (targetGroup.activities || []).some(activity =>
                    activity.name.toLowerCase() === newActivityName.toLowerCase()
                );
                if (!existsInCurrentGroup) {
                    break; // Found a unique name
                }
            } while (true); // Loop until a unique name is found
            finalActivity.name = newActivityName; // Assign the unique name to the copy
        } else {
            // Duplicating to a different group, check for exact name match
            const isDuplicateInTarget = (targetGroup.activities || []).some(activity =>
                activity.name.toLowerCase() === activityToDuplicate.name.toLowerCase()
            );
            if (isDuplicateInTarget) {
                await modalAlert(`Ya existe una actividad con el nombre "${activityToDuplicate.name}" en el grupo de destino.`);
                return;
            }
        }

        // Add the (potentially renamed) copy of the activity to the target group
        if (!targetGroup.activities) {
            targetGroup.activities = [];
        }
        targetGroup.activities.push(finalActivity);
        saveAllGroups();
        await modalAlert(`Actividad "${finalActivity.name}" duplicada en el grupo: ${targetGroup.subjectName} (${targetGroup.gradeLevel} ${targetGroup.groupLetter}).`);
        hideDuplicateSection();
        if (targetGroupKey === currentGroupKey) {
            loadActivitiesForGroup(); // Reload current group's activities to show the new one
        }
    } else {
        await modalAlert('Error: Grupo de destino no encontrado.');
    }
};

// NEW: Function to handle marking an activity
export const handleMarkActivity = (
    originalIndex,
    mark,
    currentGroup,
    saveAllGroups,
    loadActivitiesForGroup
) => {
    const activity = currentGroup.activities[originalIndex];
    if (!activity) return;

    // If the new mark is 'none', remove the mark. Otherwise, set it.
    if (mark === 'none') {
        delete activity.mark;
    } else {
        activity.mark = mark;
    }

    saveAllGroups();
    loadActivitiesForGroup();
};

export const handleActivitiesListClick = (
    event,
    currentGroupKey,
    currentGroup,
    activitiesList,
    sessionStorageProxy, // Use a proxy object for sessionStorage to allow dependency injection
    activityNameInput,
    activityDescriptionInput,
    activityDateInput,
    activityTypeSelect, // New parameter
    submitActivityButton,
    cancelEditButton,
    createActivitySection,
    duplicateActivitySection,
    activityToDuplicateName,
    duplicateTargetGroupSelect,
    allGroups,
    saveAllGroups, // Callback
    loadActivitiesForGroup, // Callback
    resetActivityForm, // Callback
    setEditingActivityIndex, // State setter
    setActivityToDuplicate, // State setter
    fillActivityFormForEdit, // DOM helper
    showDuplicateSection, // DOM helper
    hideDuplicateSection, // DOM helper
    activityCategorySelect, // NEW: Added for reset form
    activityCategoryOtherInput // NEW: Added for reset form
) => {
    const clickedItem = event.target.closest('.activity-item-clickable');
    if (!clickedItem || clickedItem.classList.contains('no-activities-message')) {
        return;
    }

    const targetButton = event.target;
    const originalIndex = parseInt(clickedItem.dataset.activityIndex); // This is always the original index now

    if (targetButton.classList.contains('edit-button')) {
        setEditingActivityIndex(originalIndex);
        const activityToEdit = currentGroup.activities[originalIndex];
        fillActivityFormForEdit(activityToEdit, activityNameInput, activityDescriptionInput, activityDateInput, activityTypeSelect, submitActivityButton, cancelEditButton, activityCategorySelect, activityCategoryOtherInput); // Updated call
        createActivitySection.scrollIntoView({ behavior: 'smooth' });

    } else if (targetButton.classList.contains('delete-activity-button')) {
        handleDeleteActivity(
            originalIndex,
            currentGroup,
            saveAllGroups,
            loadActivitiesForGroup,
            () => setEditingActivityIndex(), // Pass a getter for current editing index
            resetActivityForm
        );

    } else if (targetButton.classList.contains('duplicate-activity-button')) {
        const activity = currentGroup.activities[originalIndex];
        setActivityToDuplicate(activity); // Update state in parent
        showDuplicateSection(activity, duplicateActivitySection, activityToDuplicateName, duplicateTargetGroupSelect, allGroups, createActivitySection);
        duplicateActivitySection.scrollIntoView({ behavior: 'smooth' });

    } else if (targetButton.classList.contains('mark-button')) {
        const mark = targetButton.dataset.mark;
        handleMarkActivity(
            originalIndex,
            mark,
            currentGroup,
            saveAllGroups,
            loadActivitiesForGroup
        );
    } else {
        // If no specific button was clicked, assume click on the activity item itself
        sessionStorageProxy.setItem('selectedGroupKey', currentGroupKey);
        sessionStorageProxy.setItem('selectedActivityIndex', originalIndex);
        window.location.href = 'grade_activity.html';
    }
};