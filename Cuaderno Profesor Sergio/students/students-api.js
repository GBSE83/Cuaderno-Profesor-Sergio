import { getGroups, saveGroups, getAttendanceRecords, saveAttendanceRecords } from '../utils/storage.js';
import { ensureStudentDetails } from './students-utils.js';
import { modalConfirm, modalAlert } from '../utils/backup-utils.js';

export const addStudent = async (firstName, lastName, currentGroup, saveAllGroupsCallback, loadStudentsCallback, firstNameInput, lastNameInput) => {
    const studentName = `${firstName.trim()} ${lastName.trim()}`;
    if (firstName && lastName) {
        const isDuplicate = (currentGroup.students || []).some(student => student.name.toLowerCase() === studentName.toLowerCase());
        if (isDuplicate) {
            await modalAlert(`Ya existe un alumno con el nombre completo "${studentName}" en este grupo.`);
            return;
        }

        if (!currentGroup.students) {
            currentGroup.students = [];
        }
        const newStudent = { name: studentName };
        ensureStudentDetails(newStudent);
        currentGroup.students.push(newStudent);
        saveAllGroupsCallback();
        loadStudentsCallback(); // Re-load to apply sorting and filtering
        firstNameInput.value = '';
        lastNameInput.value = '';
        firstNameInput.focus();
    } else {
        await modalAlert('Por favor, introduce el nombre y los apellidos del alumno.');
    }
};

export const loadStudentsFromText = async (textList, currentGroup, saveAllGroupsCallback, loadStudentsCallback, studentsTextList) => {
    if (textList) {
        const rawStudentLines = textList.split('\n')
                                        .map(line => line.trim())
                                        .filter(line => line !== '');
        let studentsAdded = 0;

        for (const line of rawStudentLines) {
            let studentFullName;
            if (line.includes(',')) {
                // Format: Apellidos, Nombre
                const parts = line.split(',');
                const lastName = parts[0].trim();
                const firstName = parts.slice(1).join(',').trim(); // Handle cases like "Doe, Jr., John"
                studentFullName = `${firstName} ${lastName}`;
            } else {
                // Assume it's a full name without a specific order
                studentFullName = line;
            }

            const isDuplicate = (currentGroup.students || []).some(student => student.name.toLowerCase() === studentFullName.toLowerCase());
            if (!isDuplicate) {
                if (!currentGroup.students) {
                    currentGroup.students = [];
                }
                const newStudent = { name: studentFullName };
                ensureStudentDetails(newStudent);
                currentGroup.students.push(newStudent);
                studentsAdded++;
            } else {
                console.warn(`Alumno "${studentFullName}" ya existe en el grupo y no fue añadido.`);
            }
        }

        if (studentsAdded > 0) {
            saveAllGroupsCallback();
            loadStudentsCallback(); // Re-load to apply sorting and filtering
            studentsTextList.value = '';
            await modalAlert(`${studentsAdded} alumno(s) añadido(s) al grupo.`);
        } else {
            await modalAlert('No se añadieron nuevos alumnos (quizás ya existían).');
        }
    } else {
        await modalAlert('Por favor, introduce un listado de alumnos.');
    }
};

export const deleteStudent = async (studentIndex, currentGroup, saveAllGroupsCallback, loadStudentsCallback, studentName) => {
    const ok = await modalConfirm(`¿Estás seguro de que quieres eliminar a ${studentName}?`);
    if (!ok) return;
    currentGroup.students.splice(studentIndex, 1);
    saveAllGroupsCallback();
    loadStudentsCallback(); // Re-load to update list after deletion
    await modalAlert('Alumno eliminado correctamente.');
};

/**
 * Moves a student from the current group to a new specified group.
 * This function *executes* the move assuming confirmation has already been handled by the UI.
 * @param {string} studentName - The name of the student to move.
 * @param {string} newGroupKey - The key of the target group.
 * @param {object} currentGroup - The currently active group.
 * @param {Array<object>} allGroups - All groups data.
 * @param {Function} saveAllGroups - Callback to save all groups data.
 * @param {Function} loadStudents - Callback to reload the student list for the current group.
 * @param {Function} getAttendanceRecordsFn - Function to get attendance records.
 * @param {Function} saveAttendanceRecordsFn - Function to save attendance records.
 * @returns {boolean} True if the student was moved successfully, false otherwise.
 */
export const moveStudentToGroup = async (studentName, newGroupKey, currentGroup, allGroups, saveAllGroups, loadStudents, getAttendanceRecordsFn, saveAttendanceRecordsFn) => {
    if (!newGroupKey) {
        await modalAlert('Error: Grupo de destino no especificado.');
        return false;
    }

    const studentIndex = currentGroup.students.findIndex(s => s.name === studentName);
    if (studentIndex === -1) {
        await modalAlert('Error: Alumno no encontrado en el grupo actual.');
        return false;
    }
    const studentToMove = currentGroup.students[studentIndex];
    
    const newGroup = allGroups.find(group =>
        `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}` === newGroupKey
    );

    if (!newGroup) {
        await modalAlert('Error: Grupo de destino no encontrado.');
        return false;
    }

    const isDuplicateInNewGroup = (newGroup.students || []).some(s => s.name.toLowerCase() === studentToMove.name.toLowerCase());
    if (isDuplicateInNewGroup) {
        await modalAlert(`El alumno "${studentToMove.name}" ya existe en el grupo de destino.`);
        return false;
    }

    // Delete student's grades from activities in the current group
    if (currentGroup.activities) {
        currentGroup.activities.forEach(activity => {
            if (activity.grades && activity.grades[studentName]) {
                delete activity.grades[studentName];
            }
        });
    }

    // Remove student from currentGroup's students array
    currentGroup.students.splice(studentIndex, 1);

    // Add student to newGroup
    if (!newGroup.students) {
        newGroup.students = [];
    }
    ensureStudentDetails(studentToMove); 
    newGroup.students.push(studentToMove);

    saveAllGroups(); // Save groups (which contains activities and student names)
    await modalAlert(`Alumno "${studentToMove.name}" movido correctamente.`);
    
    loadStudents(); // Reload the student list for the current group (which will now exclude the moved student)
    return true; // Indicate success for the calling context
};

/**
 * Saves the observation and characteristics for a student.
 * @param {string} currentModalStudentName - The name of the student whose details are being saved.
 * @param {object} currentGroup - The currently active group.
 * @param {HTMLElement} modalStudentObservations - The textarea for observations.
 * @param {HTMLElement} charACNEE - Checkbox for ACNEE.
 * @param {HTMLElement} charCOMPE - Checkbox for COMPE.
 * @param {HTMLElement} charREPET - Checkbox for REPET.
 * @param {HTMLElement} charADAPT - Checkbox for ADAPT.
 * @param {HTMLElement} classificationListEl - The DOM element containing classification inputs.
 * @param {Function} saveAllGroups - Callback to save all groups data.
 * @param {Function} hideStudentInfoModalCallback - Callback to hide the student info modal.
 * @param {Function} loadStudents - Callback to reload the student list.
 */
export const saveStudentDetails = async (currentModalStudentName, currentGroup, modalStudentObservations, charACNEE, charCOMPE, charREPET, charADAPT, classificationListEl, saveAllGroups, hideStudentInfoModalCallback, loadStudents) => {
    const student = currentGroup.students.find(s => s.name === currentModalStudentName);
    if (!student) {
        await modalAlert('Error: Alumno no encontrado.');
        return;
    }

    ensureStudentDetails(student);

    student.details.observations = modalStudentObservations.value.trim();
    student.details.characteristics.ACNEE = charACNEE.classList.contains('active');
    student.details.characteristics.COMPE = charCOMPE.classList.contains('active');
    student.details.characteristics.REPET = charREPET.classList.contains('active');
    student.details.characteristics.ADAPT = charADAPT.classList.contains('active');

    // --- Classification Types Handling ---
    const currentGroupClassificationTypes = new Set(currentGroup.classificationTypes || []); // Canonical types for the group
    const studentClassificationsInModal = Array.from(classificationListEl.querySelectorAll('.classification-row')).map(row => {
        const typeInput = row.querySelector('.classification-type');
        const descInput = row.querySelector('.classification-desc');
        return {
            type: (typeInput.value || '').trim(),
            description: (descInput.value || '').trim()
        };
    }).filter(c => c.type !== ''); // Only consider rows with a type defined

    const newGroupClassificationTypes = new Set(studentClassificationsInModal.map(c => c.type));
    
    // 1. Identify types to add to group.classificationTypes
    const typesToAdd = Array.from(newGroupClassificationTypes).filter(type => !currentGroupClassificationTypes.has(type));

    // 2. Identify types to remove from group.classificationTypes
    const typesToRemove = Array.from(currentGroupClassificationTypes).filter(type => !newGroupClassificationTypes.has(type));

    // Handle deletions first, with user confirmation
    if (typesToRemove.length > 0) {
        const confirmDelete = await modalConfirm(`Advertencia: Si eliminas el tipo de clasificación "${typesToRemove.join(', ')}" para ${currentModalStudentName}, se borrará para TODOS los alumnos del grupo "${currentGroup.subjectName} (${currentGroup.gradeLevel} ${currentGroup.groupLetter.toUpperCase()})" y no se podrá deshacer. ¿Deseas continuar?`);
        if (!confirmDelete) {
            await modalAlert('Eliminación de tipos de clasificación cancelada.');
            return; // Cancel the entire save operation
        }
        
        // If confirmed, proceed with deletion across all students in the group
        typesToRemove.forEach(typeToDelete => {
            currentGroup.classificationTypes = currentGroup.classificationTypes.filter(t => t !== typeToDelete);
            currentGroup.students.forEach(s => {
                ensureStudentDetails(s);
                s.details.classifications = s.details.classifications.filter(c => c.type !== typeToDelete);
            });
        });
    }

    // Handle additions to group.classificationTypes and propagation
    typesToAdd.forEach(typeToAdd => {
        currentGroup.classificationTypes.push(typeToAdd);
        currentGroup.students.forEach(s => {
            ensureStudentDetails(s);
            // Add to student's classifications only if not already present, with empty description
            if (!s.details.classifications.some(c => c.type === typeToAdd)) {
                s.details.classifications.push({ type: typeToAdd, description: '' });
            }
        });
    });

    // Update the current student's specific classifications with descriptions
    student.details.classifications = studentClassificationsInModal;

    saveAllGroups();
    await modalAlert('Información del alumno guardada correctamente. La ventana permanecerá abierta.');
    // The modal should now remain open after saving, as per user request.
    // hideStudentInfoModalCallback(); // <-- REMOVED
    loadStudents(); // Re-load in case name changed or for visual consistency (though name not editable here)
};

/**
 * Updates the name of a student (first name and last name).
 * @param {string} currentStudentName - The original full name of the student.
 * @param {string} newFirstName - The new first name.
 * @param {string} newLastName - The new last name.
 * @param {object} currentGroup - The currently active group.
 * @param {Array<object>} allGroups - All groups data (needed for updating attendance/grades if name changes).
 * @param {Function} saveAllGroups - Callback to save all groups data.
 * @param {Function} loadStudents - Callback to reload the student list.
 * @param {Function} hideModalSectionCallback - Callback to hide the relevant modal section (e.g., name edit form).
 * @param {Function} getAttendanceRecordsFn - Function to get attendance records.
 * @param {Function} saveAttendanceRecordsFn - Function to save attendance records.
 */
export const updateStudentName = async (
    currentStudentName,
    newFirstName,
    newLastName,
    currentGroup,
    allGroups, // Pass allGroups to update other sections
    saveAllGroups,
    loadStudents,
    hideModalSectionCallback,
    getAttendanceRecordsFn,
    saveAttendanceRecordsFn
) => {
    const student = currentGroup.students.find(s => s.name === currentStudentName);
    if (!student) {
        await modalAlert('Error: Alumno no encontrado.');
        return;
    }

    const trimmedFirstName = newFirstName.trim();
    const trimmedLastName = newLastName.trim();
    const newFullName = `${trimmedFirstName} ${trimmedLastName}`.trim();

    if (!trimmedFirstName || !trimmedLastName) {
        await modalAlert('Por favor, introduce tanto el nombre como los apellidos.');
        return;
    }
    
    // Check for duplicate name (excluding the current student being edited)
    const isDuplicate = (currentGroup.students || []).some(s =>
        s.name.toLowerCase() === newFullName.toLowerCase() && s.name !== currentStudentName
    );

    if (isDuplicate) {
        await modalAlert(`Ya existe un alumno con el nombre "${newFullName}" en este grupo.`);
        return;
    }

    if (newFullName === currentStudentName) {
        await modalAlert('El nombre y apellidos son los mismos. No se han realizado cambios.');
        hideModalSectionCallback();
        return;
    }

    // Update grades and attendance records if the name has actually changed
    if (newFullName !== currentStudentName) {
        // 1. Update grades across all activities in the current group
        if (currentGroup.activities) {
            currentGroup.activities.forEach(activity => {
                if (activity.grades && activity.grades[currentStudentName]) {
                    activity.grades[newFullName] = activity.grades[currentStudentName];
                    delete activity.grades[currentStudentName];
                }
            });
        }

        // 2. Update attendance records for ALL groups
        const attendanceRecords = getAttendanceRecordsFn();
        allGroups.forEach(group => { // Iterate through all groups
            const groupKey = `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}`;
            const groupAttendance = attendanceRecords[groupKey] || {};
            for (const date in groupAttendance) {
                if (groupAttendance[date][currentStudentName]) {
                    groupAttendance[date][newFullName] = groupAttendance[date][currentStudentName];
                    delete groupAttendance[date][currentStudentName];
                }
            }
            attendanceRecords[groupKey] = groupAttendance; // Update the group's attendance
        });
        saveAttendanceRecordsFn(attendanceRecords);

        // 3. Update student name in the group itself
        student.name = newFullName;

        saveAllGroups(); // Save groups (which contains activities and student name)
        await modalAlert('Nombre del alumno actualizado correctamente.');
        hideModalSectionCallback();
        loadStudents(); // Re-render the student list
    }
};

export const reorderStudents = (fromIndex, toIndex, currentGroup, saveAllGroupsCallback, loadStudentsCallback) => {
    let students = currentGroup.students;
    const [movedStudent] = students.splice(fromIndex, 1);

    // Adjust insertIndex for splice
    let insertIndex = toIndex;
    // If moving an item up, and the target index is after the original position,
    // the target index effectively shifts down by one because an item was removed before it.
    if (fromIndex < toIndex) {
         insertIndex--;
    }
    students.splice(insertIndex, 0, movedStudent);

    saveAllGroupsCallback();
    loadStudentsCallback(); // Re-load to update display based on new manual order
};