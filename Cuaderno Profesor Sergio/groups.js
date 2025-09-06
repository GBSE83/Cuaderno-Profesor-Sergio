// groups.js
import { formatDateTimeForFilename, getStartOfWeek, getEndOfWeek, formatDateDayMonthYear, addDays, formatDateShort, formatDate } from './utils/date-utils.js';
import { getGroups, saveGroups, getAllAppData, setSessionItem, removeSessionItem, getAttendanceRecords, saveAttendanceRecords, getTeacherSchedule, saveTeacherSchedule } from './utils/storage.js';
import { handleLoadBackup, handleSaveBackup, modalConfirm, modalAlert } from './utils/backup-utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // Ensure the page shows the top when opened (don't jump to the create form)
    window.scrollTo(0, 0);
    
    const globalHomeButton = document.getElementById('globalHomeButton');
    const globalSaveButton = document.getElementById('globalSaveButton');
    const globalLoadButton = document.getElementById('globalLoadButton');
    const globalAgendaButton = document.getElementById('globalAgendaButton'); // Global Agenda Button
    const globalDailyLogButton = document.getElementById('globalDailyLogButton'); // NEW: Global Daily Log Button

    const groupsList = document.getElementById('groupsList');
    const createGroupForm = document.getElementById('createGroupForm');
    const subjectNameInput = document.getElementById('subjectName');
    const gradeLevelSelect = document.getElementById('gradeLevel');
    const groupLetterInput = document.getElementById('groupLetter');
    const colorOptions = document.querySelectorAll('.color-option');
    const customColorInput = document.getElementById('customColor');
    const submitGroupButton = document.getElementById('submitGroupButton');
    const cancelEditGroupButton = document.getElementById('cancelEditGroupButton');

    let allGroups = getGroups();
    let editingGroupIndex = -1; // -1 means no group is being edited

    // Helper: convert hex to RGB and detect dark colors for contrast
    const hexToRgb = (hex) => {
        hex = (hex || '').replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const v = parseInt(hex, 16);
        return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
    };
    const isDarkColor = (hex) => {
        const { r, g, b } = hexToRgb(hex);
        // Perceived brightness formula
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness < 128;
    };

    // NEW: Drag and Drop variables
    let draggedGroupItem = null;

    // Helper to clear drag-and-drop classes
    const clearDragDropClasses = () => {
        Array.from(groupsList.children).forEach(child => {
            child.classList.remove('dragging', 'drag-over');
        });
    };

    // Helper to render groups list
    const renderGroupsList = () => {
        groupsList.innerHTML = ''; // Clear existing list

        if (!allGroups || allGroups.length === 0) {
            const noGroupsMessage = document.createElement('li');
            noGroupsMessage.className = 'no-groups-message';
            noGroupsMessage.textContent = 'No hay grupos creados aún. Añade uno a continuación.';
            // Make non-draggable
            noGroupsMessage.draggable = false;
            groupsList.appendChild(noGroupsMessage);
            return;
        }

        allGroups.forEach((group, index) => {
            const listItem = document.createElement('li');
            listItem.classList.add('group-item-clickable');
            listItem.dataset.index = index;
            const groupKey = `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}`;
            listItem.dataset.groupKey = groupKey; // Add groupKey to dataset for easy retrieval
            listItem.draggable = true; // Make group items draggable

            listItem.innerHTML = `
                <div class="group-details">
                    <span class="group-name">${group.subjectName}</span>
                    <span>Curso: ${group.gradeLevel}</span>
                    <span>Grupo: ${group.groupLetter}</span>
                </div>
                <div class="group-controls">
                    <button class="edit-group-button" data-index="${index}">Editar</button>
                    <button class="delete-group-button" data-index="${index}">Eliminar</button>
                </div>
            `;

            if (group.color) {
                listItem.style.setProperty('--group-color', group.color);
                listItem.classList.add('colored'); // Add class to apply color styles

                // Ensure text contrasts with very dark colors: change group details text color when needed
                const details = listItem.querySelector('.group-details');
                if (details) {
                    if (isDarkColor(group.color)) {
                        details.style.color = '#ffffff';
                    } else {
                        details.style.color = ''; // use default CSS color
                    }
                }
            }

            groupsList.appendChild(listItem);
        });
    };

    // Helper to reset the form to 'create new group' state
    const resetGroupForm = () => {
        subjectNameInput.value = '';
        gradeLevelSelect.value = '';
        groupLetterInput.value = '';
        colorOptions.forEach(radio => radio.checked = false); // Uncheck all color options
        if (customColorInput) {
            customColorInput.style.display = 'none';
            customColorInput.value = '#FFB399';
        }
        // Optionally, select a default color if no color is chosen
        // Example: if (!document.querySelector('input[name="groupColor"]:checked')) {
        //     document.getElementById('color-pastel1').checked = true;
        // }
        submitGroupButton.textContent = 'Crear Grupo';
        cancelEditGroupButton.style.display = 'none';
        editingGroupIndex = -1;
    };

    // Helper to fill the form with existing group data for editing
    const fillGroupFormForEdit = (group) => {
        subjectNameInput.value = group.subjectName;
        gradeLevelSelect.value = group.gradeLevel;
        groupLetterInput.value = group.groupLetter;
        // If the group's color matches one of the predefined options, select it.
        let matched = false;
        colorOptions.forEach(radio => {
            if (radio.value !== 'custom' && radio.value === group.color) {
                radio.checked = true;
                matched = true;
            } else {
                radio.checked = false;
            }
        });
        if (!matched && customColorInput) {
            // Use custom color
            const customRadio = document.getElementById('color-custom');
            if (customRadio) customRadio.checked = true;
            customColorInput.value = group.color || '#FFB399';
            customColorInput.style.display = 'inline-block';
        } else if (customColorInput) {
            customColorInput.style.display = 'none';
        }
        submitGroupButton.textContent = 'Actualizar Grupo';
        cancelEditGroupButton.style.display = 'inline-block';
        subjectNameInput.focus();
    };

    // Handle form submission (create or update group)
    createGroupForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const subjectName = subjectNameInput.value.trim();
        const gradeLevel = gradeLevelSelect.value;
        const groupLetter = groupLetterInput.value.trim();
        const selectedColorInput = document.querySelector('input[name="groupColor"]:checked');
        let color = '';
        if (selectedColorInput) {
            if (selectedColorInput.value === 'custom' && customColorInput) {
                color = customColorInput.value;
            } else {
                color = selectedColorInput.value;
            }
        }

        if (!subjectName || !gradeLevel || !groupLetter) {
            await modalAlert('Por favor, completa todos los campos del grupo.');
            return;
        }

        const newGroupKey = `${subjectName}-${gradeLevel}-${groupLetter}`;

        // Check for duplicate group name/identifier
        const isDuplicate = allGroups.some((group, index) => {
            const groupKey = `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}`;
            return groupKey === newGroupKey && index !== editingGroupIndex;
        });

        if (isDuplicate) {
            await modalAlert('Ya existe un grupo con la misma Materia, Curso y Letra. Por favor, elige una combinación diferente.');
            return;
        }

        if (editingGroupIndex !== -1) {
            // Update existing group
            const oldGroupKey = `${allGroups[editingGroupIndex].subjectName}-${allGroups[editingGroupIndex].gradeLevel}-${allGroups[editingGroupIndex].groupLetter}`;
            
            // Check if groupKey has changed. If so, update references in attendance and schedule.
            if (oldGroupKey !== newGroupKey) {
                // Update attendance records
                const attendanceRecords = getAttendanceRecords();
                if (attendanceRecords[oldGroupKey]) {
                    attendanceRecords[newGroupKey] = attendanceRecords[oldGroupKey];
                    delete attendanceRecords[oldGroupKey];
                    saveAttendanceRecords(attendanceRecords);
                }

                // Update teacher schedule entries
                let teacherSchedule = getTeacherSchedule();
                teacherSchedule.forEach(entry => {
                    if (entry.type === 'class' && entry.groupKey === oldGroupKey) {
                        entry.groupKey = newGroupKey;
                    }
                });
                saveTeacherSchedule(teacherSchedule);
            }

            allGroups[editingGroupIndex] = { 
                subjectName, 
                gradeLevel, 
                groupLetter, 
                color, 
                students: allGroups[editingGroupIndex].students || [], 
                activities: allGroups[editingGroupIndex].activities || [],
                classificationTypes: allGroups[editingGroupIndex].classificationTypes || [] // NEW: Preserve classificationTypes
            };
            await modalAlert('Grupo actualizado correctamente.');
        } else {
            // Create new group
            const newGroup = {
                subjectName,
                gradeLevel,
                groupLetter,
                color,
                students: [],
                activities: [],
                classificationTypes: [] // NEW: Initialize classificationTypes for a new group
            };
            allGroups.push(newGroup);
            await modalAlert('Grupo creado correctamente.');
        }

        saveGroups(allGroups);
        renderGroupsList();
        resetGroupForm();
    });

    // Handle cancel edit button click
    cancelEditGroupButton.addEventListener('click', () => {
        resetGroupForm();
    });

    // Event delegation for group items and control buttons
    groupsList.addEventListener('click', async (event) => {
        const target = event.target;
        const listItem = target.closest('li.group-item-clickable');

        if (!listItem || listItem.classList.contains('no-groups-message')) return;

        const index = parseInt(listItem.dataset.index);
        const group = allGroups[index];
        const groupKey = listItem.dataset.groupKey; // Get groupKey from dataset

        if (target.classList.contains('edit-group-button')) {
            editingGroupIndex = index;
            fillGroupFormForEdit(group);
            createGroupForm.scrollIntoView({ behavior: 'smooth' }); // Scroll to form
        } else if (target.classList.contains('delete-group-button')) {
            const ok = await modalConfirm(`¿Estás seguro de que quieres eliminar el grupo \"${group.subjectName} ${group.gradeLevel} ${group.groupLetter}\"?\n\n¡Advertencia! Esto eliminará permanentemente todos los alumnos, actividades y registros de asistencia asociados a este grupo, así como las sesiones de clase de este grupo en el horario diario.`);
            if (!ok) return;
            // 1. Remove group from allGroups
            allGroups.splice(index, 1);

            // 2. Remove associated attendance records
            const attendanceRecords = getAttendanceRecords();
            delete attendanceRecords[groupKey];
            saveAttendanceRecords(attendanceRecords);

            // 3. Remove associated teacher schedule entries for this group
            let teacherSchedule = getTeacherSchedule();
            teacherSchedule = teacherSchedule.filter(entry => !(entry.type === 'class' && entry.groupKey === groupKey));
            saveTeacherSchedule(teacherSchedule);

            saveGroups(allGroups); // Save updated groups list
            renderGroupsList(); // Re-render the list
            await modalAlert('Grupo y todos los datos asociados eliminados correctamente.');

            // If the deleted group was being edited, reset the form
            if (editingGroupIndex === index) {
                resetGroupForm();
            }
        } else {
            // Click on the group item itself (not edit/delete button) -> go to students page
            setSessionItem('selectedGroupKey', groupKey);
            window.location.href = 'students.html';
        }
    });

    // NEW: Drag and drop event listeners for groupsList
    groupsList.addEventListener('dragstart', (e) => {
        draggedGroupItem = e.target.closest('li');
        if (draggedGroupItem && !draggedGroupItem.classList.contains('no-groups-message')) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedGroupItem.dataset.index); // Store the original index
            setTimeout(() => draggedGroupItem.classList.add('dragging'), 0);
        }
    });

    groupsList.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedGroupItem && e.target.closest('li') !== draggedGroupItem) {
            const targetItem = e.target.closest('li');
            if (targetItem && !targetItem.classList.contains('no-groups-message')) {
                // Clear all drag-over classes first
                clearDragDropClasses();

                const bounding = targetItem.getBoundingClientRect();
                const offset = e.clientY - bounding.top;

                if (offset < bounding.height / 2) {
                    targetItem.classList.add('drag-over');
                    // For reordering, we just need to know *which* item is being hovered over
                    // The 'drag-over' class indicates the insertion point.
                } else {
                    targetItem.classList.add('drag-over');
                    // If dropping below, the 'drag-over' class on the target item means insert after.
                    // No need for 'drag-over-bottom' just 'drag-over' is sufficient for the target.
                }
            }
        }
    });

    groupsList.addEventListener('dragleave', (e) => {
        const targetItem = e.target.closest('li');
        if (targetItem) {
            targetItem.classList.remove('drag-over');
        }
    });

    groupsList.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedGroupItem) {
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const targetItem = e.target.closest('li');

            if (targetItem && targetItem !== draggedGroupItem && !targetItem.classList.contains('no-groups-message')) {
                let toIndex = parseInt(targetItem.dataset.index);

                const bounding = targetItem.getBoundingClientRect();
                const offset = e.clientY - bounding.top;

                // Adjust toIndex if dropping below the middle of the target item
                if (offset > bounding.height / 2) {
                    toIndex++;
                }

                // Ensure toIndex is within bounds after potential increment
                toIndex = Math.min(allGroups.length, toIndex);
                
                const [movedGroup] = allGroups.splice(fromIndex, 1);
                allGroups.splice(toIndex, 0, movedGroup);

                saveGroups(allGroups);
                renderGroupsList();
            }
        }
        clearDragDropClasses();
    });

    groupsList.addEventListener('dragend', () => {
        if (draggedGroupItem) {
            draggedGroupItem.classList.remove('dragging');
            draggedGroupItem = null;
        }
        clearDragDropClasses();
    });

    // Global action buttons (save, load, home, agenda)
    globalHomeButton.addEventListener('click', () => {
        removeSessionItem('selectedGroupKey');
        removeSessionItem('selectedActivityIndex');
        window.location.href = 'index.html';
    });

    globalSaveButton.addEventListener('click', handleSaveBackup);

    globalLoadButton.addEventListener('click', handleLoadBackup);

    globalAgendaButton.addEventListener('click', () => {
        window.location.href = 'agenda.html';
    });

    // NEW: Handle global Daily Log button click
    globalDailyLogButton.addEventListener('click', () => {
        window.location.href = 'daily_log.html';
    });

    // Show/hide the color picker when 'custom' is selected and make clicking the color input select the custom radio
    colorOptions.forEach(radio => {
        radio.addEventListener('change', () => {
            if (customColorInput) {
                if (radio.value === 'custom' && radio.checked) {
                    customColorInput.style.display = 'inline-block';
                } else if (radio.checked) {
                    customColorInput.style.display = 'none';
                }
            }
        });
    });
    if (customColorInput) {
        customColorInput.addEventListener('input', () => {
            const customRadio = document.getElementById('color-custom');
            if (customRadio) customRadio.checked = true;
            customColorInput.style.display = 'inline-block';
        });
    }

    // Initial render and form reset
    renderGroupsList();
    resetGroupForm();
});