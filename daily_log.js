import { formatDateTimeForFilename, getStartOfWeek, getEndOfWeek, formatDateDayMonthYear, addDays, formatDateShort, formatDate, formatGradeLevelShort } from './utils/date-utils.js';
import { getAllAppData, removeSessionItem, getGroups, getTeacherSchedule, saveTeacherSchedule } from './utils/storage.js';
import { handleLoadBackup, handleSaveBackup, modalConfirm, modalAlert } from './utils/backup-utils.js';
import * as XLSX from 'xlsx';

document.addEventListener('DOMContentLoaded', () => {
    const globalHomeButton = document.getElementById('globalHomeButton');
    const globalSaveButton = document.getElementById('globalSaveButton');
    const globalLoadButton = document.getElementById('globalLoadButton');
    const globalAgendaButton = document.getElementById('globalAgendaButton'); 

    // NEW: Schedule navigation elements
    const prevWeekButton = document.getElementById('prevWeekButton');
    const nextWeekButton = document.getElementById('nextWeekButton');
    const weekDisplay = document.getElementById('weekDisplay');
    const currentWeekButton = document.getElementById('currentWeekButton'); // NEW
    const datePicker = document.getElementById('datePicker'); // NEW

    // NEW: Schedule filter elements
    const scheduleTypeFilter = document.getElementById('scheduleTypeFilter');
    const scheduleNotesFilter = document.getElementById('scheduleNotesFilter');

    // NEW: Time range filter elements
    const displayStartHourInput = document.getElementById('displayStartHour');
    const displayEndHourInput = document.getElementById('displayEndHour');

    // NEW: Schedule section elements
    const scheduleGrid = document.getElementById('scheduleGrid');
    const noScheduleMessage = document.getElementById('noScheduleMessage');
    const scheduleEntryForm = document.getElementById('scheduleEntryForm');
    const scheduleEntryType = document.getElementById('scheduleEntryType'); // NEW
    const classFields = document.getElementById('classFields'); // NEW
    const genericFields = document.getElementById('genericFields'); // NEW
    const scheduleGroupSelect = document.getElementById('scheduleGroupSelect');
    const customEntryName = document.getElementById('customEntryName'); // NEW
    const customEntryColorRadios = document.querySelectorAll('input[name="scheduleEntryColor"]'); // NEW
    const scheduleDayOfWeekCheckboxes = document.querySelectorAll('input[name="scheduleDayOfWeek"]'); // MODIFIED: Get all checkboxes
    const scheduleStartTime = document.getElementById('scheduleStartTime');
    const scheduleEndTime = document.getElementById('scheduleEndTime');
    const submitScheduleEntryButton = document.getElementById('submitScheduleEntryButton');
    const cancelEditScheduleButton = document.getElementById('cancelEditScheduleButton');

    // NEW: Excel import/export buttons
    const exportScheduleButton = document.getElementById('exportScheduleButton');
    const importScheduleInput = document.getElementById('importScheduleInput');

    // NEW: Daily Notes Modal elements
    const dailyNotesModal = document.getElementById('dailyNotesModal');
    const closeDailyNotesModal = document.getElementById('closeDailyNotesModal');
    const modalDailyNotesTitle = document.getElementById('modalDailyNotesTitle');
    const modalDailyNotesSub = document.getElementById('modalDailyNotesSub'); // NEW: Subtitle for session context
    
    // Notes sections
    const notesClassSpecific = document.getElementById('notesClassSpecific'); // For class notes
    const notesDutySpecific = document.getElementById('notesDutySpecific');   // For duty notes
    const notesGeneric = document.getElementById('notesGeneric');             // For all non-class notes (summary)
    const notesCommon = document.getElementById('notesCommon');               // Common fields for all non-class notes

    // Textareas for notes
    const notesContents = document.getElementById('notesContents'); // Class-specific
    const notesTasks = document.getElementById('notesTasks');       // Class-specific
    const notesDutyGroup = document.getElementById('notesDutyGroup'); // Duty-specific
    const notesAbsentTeacher = document.getElementById('notesAbsentTeacher'); // Duty-specific
    const notesSummary = document.getElementById('notesSummary');   // Generic (non-class)
    const notesPending = document.getElementById('notesPending');   // Common (all non-class)
    const notesIncidents = document.getElementById('notesIncidents'); // Common (all non-class)

    const saveDailyNotesButton = document.getElementById('saveDailyNotesButton');
    const cancelDailyNotesButton = document.getElementById('cancelDailyNotesButton'); // NEW: Cancel button for daily notes modal

    let allGroups = getGroups();
    let teacherSchedule = getTeacherSchedule(); // Data includes a 'type' property after migration
    let editingScheduleEntryId = null; // Stores the ID of the entry being edited

    let currentWeekStart = getStartOfWeek(new Date()); // Initialize to the Monday of the current week

    let currentDailyNotesEntryId = null; // Stores the ID of the schedule entry for the opened daily notes modal
    let currentDailyNotesDate = null; // Stores the specific date for the opened daily notes modal
    let currentDailyNotesType = null; // NEW: Stores the type of the session for the opened daily notes modal

    // NEW: Filter state variables
    let currentTypeFilter = 'all'; // Default to show all types
    let currentNotesFilter = 'all_notes'; // Default to show all notes statuses

    // NEW: Time range display variables
    let scheduleDisplayStartHour = localStorage.getItem('scheduleDisplayStartHour') || '08:00';
    let scheduleDisplayEndHour = localStorage.getItem('scheduleDisplayEndHour') || '16:00';

    const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    
    // Dynamic constants for schedule grid rendering
    const SLOT_HEIGHT_PX = 40; // Pixel height for a 30-minute interval, must match CSS
    let MINUTE_PIXEL_HEIGHT; // Dynamically calculated
    let TOTAL_VISIBLE_MINUTES; // Dynamically calculated
    let TIME_LABELS = []; // Dynamically generated

    const generateTimeLabelsAndConstants = () => {
        TIME_LABELS = [];
        const startMinutesTotal = parseInt(scheduleDisplayStartHour.split(':')[0]) * 60 + parseInt(scheduleDisplayStartHour.split(':')[1]);
        const endMinutesTotal = parseInt(scheduleDisplayEndHour.split(':')[0]) * 60 + parseInt(scheduleDisplayEndHour.split(':')[1]);

        for (let m = startMinutesTotal; m < endMinutesTotal; m += 30) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            TIME_LABELS.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
        }
        
        TOTAL_VISIBLE_MINUTES = endMinutesTotal - startMinutesTotal;
        MINUTE_PIXEL_HEIGHT = SLOT_HEIGHT_PX / 30; // Still 40px per 30 minutes
    };

    // Helper to convert 'HH:MM' time to total minutes from the schedule's *displayed* start hour (e.g., 08:00 or user-defined)
    const timeToMinutesFromDisplayedStart = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        const [startHours, startMinutes] = scheduleDisplayStartHour.split(':').map(Number);
        return (hours * 60 + minutes) - (startHours * 60 + startMinutes);
    };

    const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

    const saveTeacherScheduleToStorage = () => {
        saveTeacherSchedule(teacherSchedule);
        renderScheduleGrid();
    };

    const toggleScheduleFormFields = () => {
        const selectedType = scheduleEntryType.value;
        if (selectedType === 'class') {
            classFields.style.display = 'block';
            genericFields.style.display = 'none';
            scheduleGroupSelect.required = true;
            customEntryName.required = false;
            customEntryColorRadios.forEach(radio => radio.required = false);
        } else {
            classFields.style.display = 'none';
            genericFields.style.display = 'block';
            scheduleGroupSelect.required = false;
            customEntryName.required = true;
            // For custom colors, make it required only if 'other' is selected and no default is chosen.
            // For simplicity, make a default selected if none is.
            customEntryColorRadios.forEach(radio => radio.required = false); // No explicit required, ensure one is checked later
        }
        populateGroupDropdownForForm(); // Re-populate or enable/disable as needed

        // MODIFIED: Manage day checkboxes based on editing state
        if (editingScheduleEntryId) {
            // If editing, keep only the relevant day enabled
            const entryToEdit = teacherSchedule.find(entry => entry.id === editingScheduleEntryId);
            scheduleDayOfWeekCheckboxes.forEach(checkbox => {
                checkbox.disabled = (checkbox.value !== entryToEdit.dayOfWeek);
            });
        } else {
            // If adding new, enable all day checkboxes
            scheduleDayOfWeekCheckboxes.forEach(checkbox => {
                checkbox.disabled = false;
            });
        }
    };

    const populateGroupDropdownForForm = () => {
        scheduleGroupSelect.innerHTML = '<option value="">Selecciona un grupo</option>';
        if (allGroups.length === 0) {
            scheduleGroupSelect.disabled = true;
        } else {
            scheduleGroupSelect.disabled = false;
            allGroups.forEach(group => {
                const option = document.createElement('option');
                const groupKey = `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}`;
                option.value = groupKey;
                option.textContent = `Clase: ${group.subjectName} (${formatGradeLevelShort(group.gradeLevel)} ${group.groupLetter})`;
                option.dataset.groupColor = group.color || ''; // Store color for later use
                scheduleGroupSelect.appendChild(option);
            });
        }
        // Always re-enable other fields, as they are now dynamically controlled by toggleScheduleFormFields
        scheduleStartTime.disabled = false;
        scheduleEndTime.disabled = false;
        submitScheduleEntryButton.disabled = false;
    };

    // NEW: Function to populate the schedule type filter dropdown
    const populateScheduleTypeFilter = () => {
        // Store current value to restore after re-populating
        const selectedValue = scheduleTypeFilter.value;
    
        // Clear existing dynamic options, preserve static ones
        const staticOptionsHtml = `
            <option value="all">Todos los tipos</option>
            <option value="class_all">Clases (todos los grupos)</option>
            <option value="recess">Recreo</option>
            <option value="duty">Guardias</option>
            <option value="meeting">Reuniones</option>
            <option value="free">Tiempo Libre</option>
            <option value="other">Otros tipos</option>
        `;
        scheduleTypeFilter.innerHTML = staticOptionsHtml; // Reset with static options
    
        // Add dynamic group options
        if (allGroups.length > 0) {
            const optGroup = document.createElement('optgroup');
            optGroup.label = 'Clases por Grupo';
            allGroups.forEach(group => {
                const option = document.createElement('option');
                const groupKey = `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}`;
                option.value = `class_${groupKey}`;
                // MODIFIED: Display group name with original casing and spaces
                option.textContent = `Clase: ${group.subjectName} (${formatGradeLevelShort(group.gradeLevel)} ${group.groupLetter})`;
                optGroup.appendChild(option);
            });
            scheduleTypeFilter.appendChild(optGroup);
        }
        
        // Restore previous selection, or default to 'all' if not found
        scheduleTypeFilter.value = selectedValue || 'all';
        currentTypeFilter = scheduleTypeFilter.value; // Update the state variable
    };

    // Helper to get text color based on background luminance
    const getTextColor = (bgColor) => {
        if (!bgColor || bgColor === 'transparent' || bgColor.startsWith('rgba(0, 0, 0, 0)')) return '#333'; // Default for transparent
        
        let r, g, b;
        if (bgColor.startsWith('#')) {
            const hex = bgColor.slice(1);
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else if (bgColor.startsWith('rgb')) {
            const parts = bgColor.match(/\d+/g).map(Number);
            [r, g, b] = parts;
        } else {
            return '#333'; // Fallback
        }
        
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.7 ? '#000' : '#fff';
    };

    // Helper to check if a notes object for a specific date has any content
    const hasAnyDailyNotes = (entry, dayDate) => {
        if (!entry || !dayDate) return false;

        switch (entry.type) {
            case 'class':
                const classNotes = entry.dailyNotes?.[dayDate];
                return classNotes && (classNotes.contents?.trim() || classNotes.tasks?.trim() || classNotes.pending?.trim() || classNotes.incidents?.trim());
            case 'duty':
                const dutyNotes = entry.dutyNotes?.[dayDate];
                return dutyNotes && (dutyNotes.group?.trim() || dutyNotes.absentTeacher?.trim() || dutyNotes.summary?.trim() || dutyNotes.pending?.trim() || dutyNotes.incidents?.trim());
            default: // Generic notes for recess, meeting, free, other
                const genericNotes = entry.genericNotes?.[dayDate];
                return genericNotes && (genericNotes.summary?.trim() || genericNotes.pending?.trim() || genericNotes.incidents?.trim());
        }
    };

    const renderScheduleGrid = () => {
        generateTimeLabelsAndConstants(); // Re-generate constants based on current display range
        scheduleGrid.innerHTML = ''; // Clear existing grid

        // Update week display
        const startOfWeekForDisplay = getStartOfWeek(currentWeekStart); // Monday of the displayed week
        const endOfWeekForDisplay = addDays(startOfWeekForDisplay, 4); // Friday of the displayed week
        weekDisplay.textContent = `Semana del ${formatDateDayMonthYear(startOfWeekForDisplay)} al ${formatDateDayMonthYear(endOfWeekForDisplay)}`;

        // Set datePicker value to the Monday of the current week
        datePicker.value = formatDate(startOfWeekForDisplay);

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize today's date to start of day
        const todayDayIndex = today.getDay(); // 0-Sunday, 1-Monday, ..., 6-Saturday. Monday is 1, Friday is 5.
        const isTodayInCurrentWeek = today >= startOfWeekForDisplay && today <= addDays(startOfWeekForDisplay, 4); // Check against Mon-Fri

        // 1. Add top-left "Horas" header cell, spanning two rows
        const topLeftTimeHeader = document.createElement('div');
        topLeftTimeHeader.classList.add('top-left-time-header');
        topLeftTimeHeader.textContent = 'Horas';
        scheduleGrid.appendChild(topLeftTimeHeader);

        // 2. Create and append the Day Names row
        const scheduleDayNameRow = document.createElement('div');
        scheduleDayNameRow.classList.add('schedule-day-name-row');
        scheduleGrid.appendChild(scheduleDayNameRow);

        // 3. Create and append the Dates row
        const scheduleDateRow = document.createElement('div');
        scheduleDateRow.classList.add('schedule-date-row');
        scheduleGrid.appendChild(scheduleDateRow);
        
        // Populate Day Names and Dates rows
        DAYS_OF_WEEK.forEach((day, index) => {
            // Day Name Cell
            const dayNameCell = document.createElement('div');
            dayNameCell.classList.add('schedule-day-name-cell');
            dayNameCell.textContent = day;
            
            // Highlight current day name
            // The day of week index for DAYS_OF_WEEK (Lunes=0, Martes=1...) aligns with getDay() results if getDay() is adjusted for Monday start.
            // getDay() gives 1 for Monday, 2 for Tuesday, ..., 5 for Friday.
            if (isTodayInCurrentWeek && (index + 1) === todayDayIndex) { 
                dayNameCell.classList.add('current-day-name');
            }
            scheduleDayNameRow.appendChild(dayNameCell);

            // Date Cell
            const dayDate = addDays(startOfWeekForDisplay, index);
            const dateCell = document.createElement('div');
            dateCell.classList.add('schedule-date-cell');
            dateCell.textContent = formatDateShort(dayDate); // "DD/MM"

            // Highlight current day date
            if (isTodayInCurrentWeek && (index + 1) === todayDayIndex) { 
                dateCell.classList.add('current-day-date');
            }
            scheduleDateRow.appendChild(dateCell);
        });

        // 4. Create a container for time labels that spans all time slots vertically
        const timeLabelColumnContainer = document.createElement('div');
        timeLabelColumnContainer.classList.add('time-label-column-container');
        timeLabelColumnContainer.style.height = `${TOTAL_VISIBLE_MINUTES * MINUTE_PIXEL_HEIGHT}px`; // Explicit height
        scheduleGrid.appendChild(timeLabelColumnContainer); // Add to the grid right away

        // Populate time labels and append to timeLabelColumnContainer
        TIME_LABELS.forEach(time => {
            const timeCell = document.createElement('div');
            timeCell.classList.add('time-label-cell');
            timeCell.textContent = time;
            timeLabelColumnContainer.appendChild(timeCell);
        });
        
        // 5. Create a single dayColumnContainer that will itself be a grid for the 5 days' content
        const dayColumnContainer = document.createElement('div');
        dayColumnContainer.classList.add('day-column-container');
        dayColumnContainer.style.minHeight = `${TOTAL_VISIBLE_MINUTES * MINUTE_PIXEL_HEIGHT}px`; // Ensure container height matches total time
        scheduleGrid.appendChild(dayColumnContainer);

        // Create individual day-content-wrapper for each day within the dayColumnContainer
        const dayContentWrappers = {};
        DAYS_OF_WEEK.forEach((day, index) => {
            const dayContentWrapper = document.createElement('div');
            dayContentWrapper.classList.add('day-content-wrapper');
            dayContentWrapper.dataset.day = day; // To easily identify the day

            const actualDateForColumn = addDays(startOfWeekForDisplay, index); // Get actual date for this column
            dayContentWrapper.dataset.date = formatDate(actualDateForColumn); // Store as YYYY-MM-DD

            // NEW: Add a mobile-only header inside each day wrapper
            const mobileHeader = document.createElement('div');
            mobileHeader.classList.add('mobile-day-header');
            mobileHeader.innerHTML = `<span class="mobile-day-name">${day}</span><span class="mobile-day-date">${formatDateShort(actualDateForColumn)}</span>`;
            if (isTodayInCurrentWeek && (index + 1) === todayDayIndex) {
                mobileHeader.classList.add('current-day');
            }
            dayContentWrapper.appendChild(mobileHeader);

            dayColumnContainer.appendChild(dayContentWrapper);
            dayContentWrappers[day] = dayContentWrapper;
        });

        // Render schedule entries onto the grid
        let visibleEntriesCount = 0; // Track how many entries are actually rendered

        // Group entries per day first, so we can sort them by start time (earliest -> latest) before appending.
        const entriesByDay = {};
        teacherSchedule.forEach(entry => {
            if (!DAYS_OF_WEEK.includes(entry.dayOfWeek)) return;
            // Apply Type Filter early to avoid grouping filtered-out entries
            if (currentTypeFilter !== 'all') {
                if (currentTypeFilter === 'class_all') {
                    if (entry.type !== 'class') return;
                } else if (currentTypeFilter.startsWith('class_')) {
                    const filterGroupKey = currentTypeFilter.substring(6);
                    if (entry.type !== 'class' || entry.groupKey !== filterGroupKey) return;
                } else {
                    if (entry.type !== currentTypeFilter) return;
                }
            }
            const day = entry.dayOfWeek;
            entriesByDay[day] = entriesByDay[day] || [];
            entriesByDay[day].push(entry);
        });

        // For each day wrapper, sort entries by startTime ascending and then render with existing logic
        Object.keys(dayContentWrappers).forEach(day => {
            const dayEntries = entriesByDay[day] || [];
            // Sort by startTime string 'HH:MM' -> numeric compare
            dayEntries.sort((a, b) => {
                if (!a.startTime) return 1;
                if (!b.startTime) return -1;
                return a.startTime.localeCompare(b.startTime);
            });
            dayEntries.forEach(entry => {
                // Reuse the original rendering block by pushing the entry back into a small render helper
                // (We duplicate minimal parts here to respect filters already applied)
                // Apply Notes Filter per-entry
                const actualDateForEntryColumn = dayContentWrappers[entry.dayOfWeek].dataset.date;
                const hasNotesForDate = hasAnyDailyNotes(entry, actualDateForEntryColumn);
                if (currentNotesFilter === 'has_notes' && !hasNotesForDate) return;
                if (currentNotesFilter === 'no_notes' && hasNotesForDate) return;

                // Determine display name/color and skip if group missing for class sessions
                let sessionDisplayName = '';
                let sessionColor = '';
                const isClassSession = entry.type === 'class';
                if (isClassSession) {
                    const group = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === entry.groupKey);
                    if (!group) return;
                    sessionDisplayName = `${group.subjectName} (${formatGradeLevelShort(group.gradeLevel)} ${group.groupLetter})`;
                    sessionColor = group.color || '#e9f5ff'; // Default light blue if no group color
                } else {
                    sessionDisplayName = entry.name || entry.type; // Fallback to type if no custom name
                    sessionColor = entry.color || '#CED4DA'; // Default grey for generic entries
                }

                // Positioning calculation for timeline layout
                const startMinutesFromDisplayedStart = timeToMinutesFromDisplayedStart(entry.startTime);
                const endMinutesFromDisplayedStart = timeToMinutesFromDisplayedStart(entry.endTime);
                if (endMinutesFromDisplayedStart <= 0 || startMinutesFromDisplayedStart >= TOTAL_VISIBLE_MINUTES) return;
                const itemTop = Math.max(0, startMinutesFromDisplayedStart) * MINUTE_PIXEL_HEIGHT;
                const itemBottom = Math.min(TOTAL_VISIBLE_MINUTES, endMinutesFromDisplayedStart) * MINUTE_PIXEL_HEIGHT;
                const itemHeight = itemBottom - itemTop;
                if (itemHeight <= 0) return;

                const scheduleItem = document.createElement('div');
                scheduleItem.classList.add('schedule-item');
                scheduleItem.dataset.id = entry.id;
                scheduleItem.dataset.type = entry.type; // NEW: Store type in dataset
                scheduleItem.dataset.date = actualDateForEntryColumn;
                // For stacked mobile view the top/height are ignored (position: static), but keep them for desktop grid.
                scheduleItem.style.top = `${itemTop}px`;
                scheduleItem.style.height = `${itemHeight}px`;
                scheduleItem.style.setProperty('--session-color', sessionColor);
                scheduleItem.style.setProperty('--session-color-dark', sessionColor);
                scheduleItem.style.setProperty('--text-color', getTextColor(sessionColor));
                if (!isClassSession) scheduleItem.classList.add('non-class-session');
                const notesIndicatorHtml = hasNotesForDate ? `<span class="daily-notes-indicator" title="Anotaciones diarias"><img src="pencil_icon.png" alt="Notes" /></span>` : '';
                scheduleItem.innerHTML = `
                    <span class="session-display-name">${sessionDisplayName}</span>
                    <span class="time-range">${entry.startTime} - ${entry.endTime}</span>
                    <div class="schedule-item-controls">
                        <button class="edit-schedule-entry-button" data-id="${entry.id}">✏️</button>
                        <button class="delete-schedule-entry-button" data-id="${entry.id}">🗑</button>
                    </div>
                    ${notesIndicatorHtml}
                `;
                dayContentWrappers[entry.dayOfWeek].appendChild(scheduleItem);
                visibleEntriesCount++;
            });
        });

        // Show/hide noScheduleMessage based on rendered entries
        if (visibleEntriesCount === 0) {
            noScheduleMessage.style.display = 'block';
        } else {
            noScheduleMessage.style.display = 'none';
        }
    };

    const resetScheduleForm = () => {
        scheduleEntryForm.reset();
        submitScheduleEntryButton.textContent = 'Añadir Sesión';
        cancelEditScheduleButton.style.display = 'none';
        editingScheduleEntryId = null;
        scheduleEntryType.value = 'class'; // Reset to default 'class'
        customEntryColorRadios.forEach(radio => radio.checked = false); // Deselect custom colors
        
        // NEW: Select the first color option as default for non-class items, if available
        const firstColorOption = document.querySelector('.color-palette .color-option');
        if (firstColorOption) {
            firstColorOption.checked = true;
        }

        // MODIFIED: Reset day checkboxes
        scheduleDayOfWeekCheckboxes.forEach(checkbox => {
            checkbox.checked = false; // Uncheck all
            checkbox.disabled = false; // Enable all
        });

        toggleScheduleFormFields(); // Adjust fields visibility
        scheduleEntryType.focus();
    };

    const fillScheduleFormForEdit = (entry) => {
        scheduleEntryType.value = entry.type;
        
        if (entry.type === 'class') {
            scheduleGroupSelect.value = entry.groupKey;
        } else {
            customEntryName.value = entry.name || '';
            const selectedColorRadio = document.querySelector(`input[name="scheduleEntryColor"][value="${entry.color}"]`);
            if (selectedColorRadio) {
                selectedColorRadio.checked = true;
            } else {
                // If existing color is not in the new palette, clear all selections.
                // Or, if a default is desired, select the first one. For now, clear.
                customEntryColorRadios.forEach(radio => radio.checked = false); 
            }
        }

        // MODIFIED: Only check the specific day of the entry and disable others
        scheduleDayOfWeekCheckboxes.forEach(checkbox => {
            checkbox.checked = (checkbox.value === entry.dayOfWeek);
            checkbox.disabled = (checkbox.value !== entry.dayOfWeek); // Disable other days
        });

        scheduleStartTime.value = entry.startTime;
        scheduleEndTime.value = entry.endTime;
        submitScheduleEntryButton.textContent = 'Actualizar Sesión';
        cancelEditScheduleButton.style.display = 'inline-block';
        editingScheduleEntryId = entry.id;
        toggleScheduleFormFields(); // Adjust fields visibility (will also manage day checkboxes)
    };

    // NEW: Function to export the current schedule to an Excel file
    const exportScheduleToExcel = async () => {
        if (!teacherSchedule || teacherSchedule.length === 0) {
            await modalAlert('No hay un horario que exportar. Añade al menos una sesión.');
            return;
        }

        const uniqueSubjectNames = Array.from(new Set(allGroups.map(g => g.subjectName))).sort();
        const uniqueGradeLevels = Array.from(new Set(allGroups.map(g => g.gradeLevel))).sort();
        const uniqueGroupLetters = Array.from(new Set(allGroups.map(g => g.groupLetter))).sort();
        const uniqueSessionTypes = Array.from(new Set(teacherSchedule.map(e => e.type))).filter(t => t !== 'class').sort();
        const allSessionTypesForDropdown = ['class', ...uniqueSessionTypes]; // Include 'class' explicitly

        const dataForSheet = teacherSchedule.map(entry => {
            let subjectName = '';
            let gradeLevel = '';
            let groupLetter = '';
            let sessionName = '';
            let color = '';

            if (entry.type === 'class') {
                const group = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === entry.groupKey);
                if (!group) return null; 
                subjectName = group.subjectName;
                gradeLevel = group.gradeLevel;
                groupLetter = group.groupLetter;
            } else {
                sessionName = entry.name || '';
                color = entry.color || '';
            }

            // Map internal type to Spanish label for export
            const typeMap = {
                'class': 'Clase con Grupo',
                'recess': 'Recreo',
                'duty': 'Guardia',
                'meeting': 'Reunión',
                'free': 'Tiempo Libre',
                'other': 'Otro'
            };
            const tipoSesion = typeMap[entry.type] || String(entry.type);

            return {
                "Día de la semana": entry.dayOfWeek,
                "Tipo de sesión": tipoSesion,
                "Materia": subjectName,
                "Curso": gradeLevel,
                "Grupo": groupLetter,
                "Nombre de la Sesión (Otros)": sessionName,
                "Hora de inicio": entry.startTime,
                "Hora de fin": entry.endTime,
                "Color": color
            };
        }).filter(Boolean); // Filter out any null entries (e.g., classes with missing groups)

        // NEW: Check if dataForSheet is empty after filtering
        if (dataForSheet.length === 0) {
            await modalAlert('No hay datos válidos en el horario para exportar. Asegúrate de que los grupos de las clases existen.');
            return;
        }

        const headers = [
            "Día de la semana", "Tipo de sesión", "Materia", "Curso", "Grupo",
            "Nombre de la Sesión (Otros)", "Hora de inicio", "Hora de fin", "Color"
        ];
        const worksheet = XLSX.utils.json_to_sheet(dataForSheet, { header: headers });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Horario");

        // Auto-size columns
        const colWidths = headers.map(key => ({
            wch: dataForSheet.reduce((w, r) => Math.max(w, String(r[key] || '').length), key.length) + 2
        }));
        worksheet["!cols"] = colWidths;

        // Apply Data Validation
        if (!worksheet['!dataValidations']) worksheet['!dataValidations'] = {};
        const maxRow = XLSX.utils.decode_range(worksheet['!ref'] || 'A1').e.r;
        
        // Helper to create data validation rules
        const addDataValidation = (colIdx, valuesArray) => {
            if (valuesArray.length === 0) return; // No validation if no values
            const colLetter = XLSX.utils.encode_col(colIdx);
            const range = `${colLetter}2:${colLetter}${maxRow + 1}`; // From second row (data rows)
            const listFormula = `"${valuesArray.join(',')}"`;
            worksheet['!dataValidations'][range] = {
                type: 'list',
                sqref: range,
                values: [listFormula],
                showDropDown: true,
                error: 'Valor no válido',
                errorTitle: 'Entrada no válida',
                prompt: `Selecciona de la lista: ${valuesArray.join(', ')}`
            };
        };
        
        addDataValidation(0, DAYS_OF_WEEK); // "Día de la semana" (Column A, index 0)
        addDataValidation(1, allSessionTypesForDropdown); // "Tipo de sesión" (Column B, index 1)
        addDataValidation(2, uniqueSubjectNames); // "Materia" (Column C, index 2)
        addDataValidation(3, uniqueGradeLevels); // "Curso" (Column D, index 3)
        addDataValidation(4, uniqueGroupLetters); // "Grupo" (Column E, index 4)

        XLSX.writeFile(workbook, `Horario_Profesor_${formatDateTimeForFilename(new Date())}.xlsx`);
        await modalAlert('Horario exportado a Excel correctamente.');
    };

    // NEW: Function to import a schedule from an Excel file
    const importScheduleFromExcel = async (file) => {
        if (!file) return;

        const proceed = await modalConfirm('Esto reemplazará tu horario actual con el contenido del archivo Excel. ¿Estás seguro de que quieres continuar?');
        if (!proceed) {
            importScheduleInput.value = ''; // Reset file input
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const importedRows = XLSX.utils.sheet_to_json(worksheet);

                if (importedRows.length === 0) {
                    await modalAlert('El archivo Excel está vacío o no tiene el formato correcto.');
                    return;
                }

                const newSchedule = [];
                const validTypes = ['class', 'recess', 'duty', 'meeting', 'free', 'other'];

                for (const row of importedRows) {
                    const dayOfWeek = row["Día de la semana"];
                    const type = row["Tipo de sesión"];
                    // Extract new columns for class information
                    const subjectName = row["Materia"] || '';
                    const gradeLevel = row["Curso"] || '';
                    const groupLetter = row["Grupo"] || '';
                    // Extract new column for non-class session name
                    const sessionNameOther = row["Nombre de la Sesión (Otros)"] || '';
                    const startTime = String(row["Hora de inicio"]);
                    const endTime = String(row["Hora de fin"]);
                    const color = row["Color"] || ''; // Optional color for non-class types

                    // Basic validation
                    if (!dayOfWeek || !type || !startTime || !endTime) {
                        throw new Error(`Fila inválida. Faltan datos necesarios: ${JSON.stringify(row)}`);
                    }
                    if (!DAYS_OF_WEEK.includes(dayOfWeek)) {
                        throw new Error(`Día de la semana no válido: "${dayOfWeek}"`);
                    }
                    if (!validTypes.includes(type)) {
                        throw new Error(`Tipo de sesión no válido: "${type}"`);
                    }

                    const entry = {
                        id: generateUniqueId(),
                        dayOfWeek,
                        startTime,
                        endTime,
                        type
                    };

                    if (type === 'class') {
                        if (!subjectName || !gradeLevel || !groupLetter) {
                            throw new Error(`Fila inválida para tipo "class". Faltan Materia, Curso o Grupo: ${JSON.stringify(row)}`);
                        }
                        const groupKey = `${subjectName}-${gradeLevel}-${groupLetter}`;
                        const groupExists = allGroups.some(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === groupKey);
                        if (!groupExists) {
                            throw new Error(`El grupo "${groupKey}" no existe en la aplicación. Por favor, créalo primero.`);
                        }
                        entry.groupKey = groupKey;
                        entry.dailyNotes = {};
                    } else {
                        // For non-class types, use 'Nombre de la Sesión (Otros)' for name
                        if (!sessionNameOther) {
                            throw new Error(`Fila inválida para tipo "${type}". Falta el "Nombre de la Sesión (Otros)": ${JSON.stringify(row)}`);
                        }
                        entry.name = sessionNameOther;
                        entry.color = color || '#CED4DA'; // Default color
                        entry.genericNotes = {}; // Initialize generic notes for new entry
                        // Special handling for duty notes if type is 'duty' (old data might not have 'dutyNotes')
                        if (type === 'duty') {
                            entry.dutyNotes = {};
                        }
                    }
                    newSchedule.push(entry);
                }
                
                // Overlap check for the entire new schedule
                for (const entry of newSchedule) {
                    for (const other of newSchedule) {
                        if (entry === other) continue; // Skip self-comparison
                        const newStartMinutes = parseInt(entry.startTime.split(':')[0]) * 60 + parseInt(entry.startTime.split(':')[1]);
                        const newEndMinutes = parseInt(entry.endTime.split(':')[0]) * 60 + parseInt(entry.endTime.split(':')[1]);
                        if (entry.dayOfWeek === other.dayOfWeek) {
                            const existingStartMinutes = parseInt(other.startTime.split(':')[0]) * 60 + parseInt(other.startTime.split(':')[1]);
                            const existingEndMinutes = parseInt(other.endTime.split(':')[0]) * 60 + parseInt(other.endTime.split(':')[1]);
                            if (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes) {
                                throw new Error(`El horario importado contiene sesiones solapadas. Por ejemplo, en ${entry.dayOfWeek}: ${entry.startTime}-${entry.endTime} y ${other.startTime}-${other.endTime}.`);
                            }
                        }
                    }
                }

                teacherSchedule = newSchedule;
                saveTeacherScheduleToStorage();
                await modalAlert('Horario importado correctamente.');
                
            } catch (error) {
                console.error("Error al importar el horario:", error);
                await modalAlert(`Error al importar: ${error.message}`);
            } finally {
                importScheduleInput.value = ''; // Reset file input
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // Validate if the new entry overlaps with existing entries for the same day
    const checkOverlap = async (newDay, newStart, newEnd, currentEntryId = null) => {
        const newStartMinutes = parseInt(newStart.split(':')[0]) * 60 + parseInt(newStart.split(':')[1]);
        const newEndMinutes = parseInt(newEnd.split(':')[0]) * 60 + parseInt(newEnd.split(':')[1]);

        if (newStartMinutes >= newEndMinutes) {
            await modalAlert('La hora de inicio debe ser anterior a la hora de fin.');
            return true; // Indicates overlap/invalid time
        }
        // Validate against the fixed schedule boundaries (00:00 to 23:59 for validity, not just display)
        const minScheduleTime = 0; // 00:00
        const maxScheduleTime = (23 * 60) + 59; // 23:59

        if (newStartMinutes < minScheduleTime || newEndMinutes > maxScheduleTime) {
            await modalAlert(`Las sesiones deben estar dentro del horario de 00:00 a 23:59.`);
            return true;
        }

        for (const entry of teacherSchedule) {
            // Exclude the current entry if we are editing
            if (currentEntryId && entry.id === currentEntryId) continue;

            if (entry.dayOfWeek === newDay) {
                const existingStartMinutes = parseInt(entry.startTime.split(':')[0]) * 60 + parseInt(entry.startTime.split(':')[1]);
                const existingEndMinutes = parseInt(entry.endTime.split(':')[0]) * 60 + parseInt(entry.endTime.split(':')[1]);

                // Check for overlap: [start1, end1) and [start2, end2)
                // Overlap occurs if (start1 < end2) and (end1 > start2)
                if (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes) {
                    let entryDisplayName;
                    if (entry.type === 'class') {
                        const groupInfo = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === entry.groupKey);
                        entryDisplayName = groupInfo ? `clase del grupo ${groupInfo.subjectName} (${formatGradeLevelShort(groupInfo.gradeLevel)} ${groupInfo.groupLetter})` : 'clase desconocida';
                    } else {
                        entryDisplayName = entry.name || entry.type; // Fallback to type
                    }
                    await modalAlert(`¡Error! La sesión se solapa con una sesión existente (${newDay}): ${entry.startTime}-${entry.endTime} de ${entryDisplayName}`);
                    return true; // Overlap detected
                }
            }
        }
        return false; // No overlap
    };

    // NEW: Function to show daily notes modal
    const showDailyNotesModal = (entryId, dayDate, sessionType, sessionDisplayName, timeRange) => {
        currentDailyNotesEntryId = entryId;
        currentDailyNotesDate = dayDate;
        currentDailyNotesType = sessionType;

        // NEW: Populate modal title and subtitle
        modalDailyNotesTitle.textContent = 'Anotaciones diarias';
        modalDailyNotesSub.textContent = `${sessionDisplayName} (${timeRange}) - ${formatDateDayMonthYear(new Date(dayDate))}`;

        // Reset all notes sections and fields
        notesClassSpecific.style.display = 'none';
        notesDutySpecific.style.display = 'none';
        notesGeneric.style.display = 'none';
        notesCommon.style.display = 'none';
        notesContents.value = '';
        notesTasks.value = '';
        notesDutyGroup.value = '';
        notesAbsentTeacher.value = '';
        notesSummary.value = '';
        notesPending.value = '';
        notesIncidents.value = '';

        const entry = teacherSchedule.find(e => e.id === entryId);
        if (!entry) return;

        switch (sessionType) {
            case 'class':
                notesClassSpecific.style.display = 'block';
                notesCommon.style.display = 'block'; // Classes also use pending/incidents now
                const classNotes = entry.dailyNotes?.[dayDate] || {};
                notesContents.value = classNotes.contents || '';
                notesTasks.value = classNotes.tasks || '';
                notesPending.value = classNotes.pending || '';
                notesIncidents.value = classNotes.incidents || '';
                break;
            case 'duty':
                notesDutySpecific.style.display = 'block';
                notesGeneric.style.display = 'block';
                notesCommon.style.display = 'block';
                const dutyNotes = entry.dutyNotes?.[dayDate] || {};
                notesDutyGroup.value = dutyNotes.group || '';
                notesAbsentTeacher.value = dutyNotes.absentTeacher || '';
                notesSummary.value = dutyNotes.summary || '';
                notesPending.value = dutyNotes.pending || '';
                notesIncidents.value = dutyNotes.incidents || '';
                break;
            default: // All other types (recess, meeting, free, other)
                notesGeneric.style.display = 'block';
                notesCommon.style.display = 'block';
                const genericNotes = entry.genericNotes?.[dayDate] || {};
                notesSummary.value = genericNotes.summary || '';
                notesPending.value = genericNotes.pending || '';
                notesIncidents.value = genericNotes.incidents || '';
                break;
        }

        dailyNotesModal.style.display = 'flex';
        // Do not autofocus any textarea when opening the modal to avoid stealing the user's cursor
    };

    // NEW: Function to hide daily notes modal
    const hideDailyNotesModal = () => {
        dailyNotesModal.style.display = 'none';
        currentDailyNotesEntryId = null;
        currentDailyNotesDate = null;
        currentDailyNotesType = null;
        // Reset textareas and visibility of sections
        notesClassSpecific.style.display = 'none';
        notesDutySpecific.style.display = 'none';
        notesGeneric.style.display = 'none';
        notesCommon.style.display = 'none';
        notesContents.value = '';
        notesTasks.value = '';
        notesDutyGroup.value = '';
        notesAbsentTeacher.value = '';
        notesSummary.value = '';
        notesPending.value = '';
        notesIncidents.value = '';
        modalDailyNotesSub.textContent = ''; // NEW: Clear subtitle
    };

    // --- Event Listeners ---
    globalHomeButton.addEventListener('click', () => {
        removeSessionItem('selectedAgendaItem'); 
        window.location.href = 'index.html';
    });

    // Replace page-specific save/download implementation with the shared backup modal
    globalSaveButton.addEventListener('click', handleSaveBackup);

    globalLoadButton.addEventListener('click', handleLoadBackup);

    globalAgendaButton.addEventListener('click', () => {
        window.location.href = 'agenda.html';
    });

    // NEW: Schedule Type selection listener (for form)
    scheduleEntryType.addEventListener('change', toggleScheduleFormFields);

    // NEW: Schedule Type Filter (for display) listener
    scheduleTypeFilter.addEventListener('change', (event) => {
        currentTypeFilter = event.target.value;
        renderScheduleGrid();
    });

    // NEW: Schedule Notes Filter (for display) listener
    scheduleNotesFilter.addEventListener('change', (event) => {
        currentNotesFilter = event.target.value;
        renderScheduleGrid();
    });

    // NEW: Calendar navigation event listeners
    prevWeekButton.addEventListener('click', () => {
        currentWeekStart = addDays(currentWeekStart, -7);
        renderScheduleGrid();
    });

    nextWeekButton.addEventListener('click', () => {
        currentWeekStart = addDays(currentWeekStart, 7);
        renderScheduleGrid();
    });

    currentWeekButton.addEventListener('click', () => {
        currentWeekStart = getStartOfWeek(new Date()); // Go to current week
        renderScheduleGrid();
    });

    datePicker.addEventListener('change', (event) => {
        const selectedDate = new Date(event.target.value);
        if (!isNaN(selectedDate.getTime())) { // Check if date is valid
            currentWeekStart = getStartOfWeek(selectedDate);
            renderScheduleGrid();
        }
    });

    // NEW: Time range selector event listeners
    [displayStartHourInput, displayEndHourInput].forEach(input => {
        input.addEventListener('change', async () => {
            const newStart = displayStartHourInput.value;
            const newEnd = displayEndHourInput.value;

            // Basic validation
            if (newStart >= newEnd) {
                await modalAlert('La hora de inicio debe ser anterior a la hora de fin.');
                // Revert to previous valid values
                displayStartHourInput.value = scheduleDisplayStartHour;
                displayEndHourInput.value = scheduleDisplayEndHour;
                return;
            }

            scheduleDisplayStartHour = newStart;
            scheduleDisplayEndHour = newEnd;
            localStorage.setItem('scheduleDisplayStartHour', scheduleDisplayStartHour);
            localStorage.setItem('scheduleDisplayEndHour', scheduleDisplayEndHour);
            renderScheduleGrid();
        });
    });

    // NEW: Schedule Entry Form handling
    scheduleEntryForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const type = scheduleEntryType.value;
        const startTime = scheduleStartTime.value;
        const endTime = scheduleEndTime.value;

        // MODIFIED: Get all selected days
        const selectedDays = Array.from(scheduleDayOfWeekCheckboxes)
                                .filter(checkbox => checkbox.checked)
                                .map(checkbox => checkbox.value);

        if (selectedDays.length === 0) {
            await modalAlert('Por favor, selecciona al menos un día de la semana.');
            return;
        }

        let baseEntryData = { type, startTime, endTime };

        if (type === 'class') {
            const groupKey = scheduleGroupSelect.value;
            if (!groupKey) {
                await modalAlert('Por favor, selecciona un grupo para la clase.');
                return;
            }
            baseEntryData.groupKey = groupKey;
        } else {
            const name = customEntryName.value.trim();
            const selectedColorInput = document.querySelector('input[name="scheduleEntryColor"]:checked');
            const color = selectedColorInput ? selectedColorInput.value : ''; // Default to empty if no color selected

            if (!name) {
                await modalAlert('Por favor, introduce un nombre para la sesión.');
                return;
            }
            if (!color && type !== 'free') { // Free time can be transparent, others need a color
                 await modalAlert('Por favor, selecciona un color para la sesión.');
                 return;
            }
            baseEntryData.name = name;
            baseEntryData.color = color;
        }

        // Validate all days first for overlaps
        for (const dayOfWeek of selectedDays) {
            if (await checkOverlap(dayOfWeek, startTime, endTime, editingScheduleEntryId)) { // Await checkOverlap
                return; // Overlap detected, stop submission
            }
        }

        if (editingScheduleEntryId) {
            // Update existing entry (only one dayOfWeek is relevant here)
            const index = teacherSchedule.findIndex(entry => entry.id === editingScheduleEntryId);
            if (index !== -1) {
                // Preserve existing notes if they exist for the entry type
                const existingNotes = teacherSchedule[index].dailyNotes || teacherSchedule[index].dutyNotes || teacherSchedule[index].genericNotes;
                
                teacherSchedule[index] = { 
                    ...baseEntryData, 
                    id: editingScheduleEntryId, 
                    dayOfWeek: teacherSchedule[index].dayOfWeek, // Crucial: retain original dayOfWeek for single-entry edit
                };
                
                // Reassign specific notes property based on type
                if (teacherSchedule[index].type === 'class') {
                    teacherSchedule[index].dailyNotes = existingNotes || {};
                } else if (teacherSchedule[index].type === 'duty') {
                    teacherSchedule[index].dutyNotes = existingNotes || {};
                } else {
                    teacherSchedule[index].genericNotes = existingNotes || {};
                }

                await modalAlert('Sesión actualizada correctamente en el horario.');
            }
        } else {
            // Add new entries for all selected days
            selectedDays.forEach(dayOfWeek => {
                const newEntry = { ...baseEntryData, id: generateUniqueId(), dayOfWeek: dayOfWeek };
                // Ensure dailyNotes/dutyNotes/genericNotes are initialized for new entries
                if (newEntry.type === 'class') {
                    newEntry.dailyNotes = {};
                } else if (newEntry.type === 'duty') {
                    newEntry.dutyNotes = {};
                } else { // recess, meeting, free, other
                    newEntry.genericNotes = {};
                }
                teacherSchedule.push(newEntry);
            });
            await modalAlert('Sesión(es) añadida(s) correctamente al horario.');
        }
        saveTeacherScheduleToStorage();
        resetScheduleForm();
    });

    cancelEditScheduleButton.addEventListener('click', () => {
        resetScheduleForm();
    });

    // Event delegation for schedule item controls (edit/delete) AND click to open daily notes
    scheduleGrid.addEventListener('click', async (event) => {
        const target = event.target;
        const scheduleItem = event.target.closest('.schedule-item');

        if (!scheduleItem) return; // Clicked outside a schedule item

        const entryId = scheduleItem.dataset.id;
        const sessionType = scheduleItem.dataset.type; // Get session type
        const dayDate = scheduleItem.dataset.date; // The actual date (YYYY-MM-DD) for this specific class instance

        if (target.classList.contains('edit-schedule-entry-button')) {
            const entryToEdit = teacherSchedule.find(entry => entry.id === entryId);
            if (entryToEdit) {
                fillScheduleFormForEdit(entryToEdit);
                scheduleEntryForm.scrollIntoView({ behavior: 'smooth' });
            }
        } else if (target.classList.contains('delete-schedule-entry-button')) {
            const entryToDelete = teacherSchedule.find(entry => entry.id === entryId);
            let sessionDisplayName;
            if (entryToDelete.type === 'class') {
                const groupInfo = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === entryToDelete.groupKey);
                // MODIFIED: Display group name with abbreviated course form
                sessionDisplayName = groupInfo ? `${groupInfo.subjectName} (${formatGradeLevelShort(groupInfo.gradeLevel)} ${groupInfo.groupLetter})` : 'Clase';
            } else {
                sessionDisplayName = entryToDelete.name || entryToDelete.type; // Fallback to type
            }

            if (entryToDelete && await modalConfirm(`¿Estás seguro de que quieres eliminar la sesión de ${entryToDelete.dayOfWeek} de ${entryToDelete.startTime} a ${entryToDelete.endTime} de ${sessionDisplayName}?`)) { // Used modalConfirm
                teacherSchedule = teacherSchedule.filter(entry => entry.id !== entryId);
                saveTeacherScheduleToStorage();
                if (editingScheduleEntryId === entryId) {
                    resetScheduleForm(); // If deleting the one being edited, reset form
                }
                await modalAlert('Sesión eliminada del horario.');
            }
        } else {
            // Click on the schedule item itself (not edit/delete button) -> open daily notes modal
            const entry = teacherSchedule.find(e => e.id === entryId);
            if (entry) { 
                let sessionDisplayName;
                if (entry.type === 'class') {
                    const group = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === entry.groupKey);
                    // MODIFIED: Display group name with abbreviated course form
                    sessionDisplayName = group ? `${group.subjectName} (${formatGradeLevelShort(group.gradeLevel)} ${group.groupLetter})` : 'Clase Desconocida';
                } else {
                    sessionDisplayName = entry.name || entry.type;
                }
                const timeRange = `${entry.startTime} - ${entry.endTime}`;
                showDailyNotesModal(entryId, dayDate, entry.type, sessionDisplayName, timeRange);
            }
        }
    });

    // NEW: Daily Notes Modal event listeners
    closeDailyNotesModal.addEventListener('click', hideDailyNotesModal);
    cancelDailyNotesButton.addEventListener('click', hideDailyNotesModal); // NEW: Cancel button event listener
    window.addEventListener('click', (event) => {
        if (event.target === dailyNotesModal) {
            hideDailyNotesModal();
        }
    });

    saveDailyNotesButton.addEventListener('click', async () => {
        if (!currentDailyNotesEntryId || !currentDailyNotesDate || !currentDailyNotesType) {
            await modalAlert('Error: No se puede guardar la nota sin contexto de clase/fecha/tipo.');
            return;
        }

        const entryIndex = teacherSchedule.findIndex(e => e.id === currentDailyNotesEntryId);
        if (entryIndex === -1) {
            await modalAlert('Error: Sesión no encontrada para guardar las anotaciones.');
            return;
        }

        const currentEntry = teacherSchedule[entryIndex];
        let notesData = {}; // Object to hold the notes for the specific date

        switch (currentDailyNotesType) {
            case 'class':
                if (!currentEntry.dailyNotes) currentEntry.dailyNotes = {};
                notesData = {
                    contents: notesContents.value.trim(),
                    tasks: notesTasks.value.trim(),
                    pending: notesPending.value.trim(),
                    incidents: notesIncidents.value.trim()
                };
                // Check if all class-specific fields are empty
                if (!notesData.contents && !notesData.tasks && !notesData.pending && !notesData.incidents) {
                    delete currentEntry.dailyNotes[currentDailyNotesDate];
                } else {
                    currentEntry.dailyNotes[currentDailyNotesDate] = notesData;
                }
                break;
            case 'duty':
                if (!currentEntry.dutyNotes) currentEntry.dutyNotes = {};
                notesData = {
                    group: notesDutyGroup.value.trim(),
                    absentTeacher: notesAbsentTeacher.value.trim(),
                    summary: notesSummary.value.trim(),
                    pending: notesPending.value.trim(),
                    incidents: notesIncidents.value.trim()
                };
                // Check if all duty-specific fields are empty
                if (!notesData.group && !notesData.absentTeacher && !notesData.summary && !notesData.pending && !notesData.incidents) {
                    delete currentEntry.dutyNotes[currentDailyNotesDate];
                } else {
                    currentEntry.dutyNotes[currentDailyNotesDate] = notesData;
                }
                break;
            default: // Generic notes for recess, meeting, free, other
                if (!currentEntry.genericNotes) currentEntry.genericNotes = {};
                notesData = {
                    summary: notesSummary.value.trim(),
                    pending: notesPending.value.trim(),
                    incidents: notesIncidents.value.trim()
                };
                // Check if all generic fields are empty
                if (!notesData.summary && !notesData.pending && !notesData.incidents) {
                    delete currentEntry.genericNotes[currentDailyNotesDate];
                } else {
                    currentEntry.genericNotes[currentDailyNotesDate] = notesData;
                }
                break;
        }

        saveTeacherScheduleToStorage(); // Save and re-render grid
        hideDailyNotesModal();
        await modalAlert('Anotaciones diarias guardadas correctamente.');
    });

    // NEW: Add event listener for export schedule button
    exportScheduleButton.addEventListener('click', exportScheduleToExcel);

    // NEW: Add event listener for import schedule input file change
    importScheduleInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            importScheduleFromExcel(file);
        }
    });

    // --- Initial setup ---
    // Set initial values for time range inputs
    displayStartHourInput.value = scheduleDisplayStartHour;
    displayEndHourInput.value = scheduleDisplayEndHour;

    populateGroupDropdownForForm();
    populateScheduleTypeFilter(); // NEW: Populate the filter dropdown
    toggleScheduleFormFields(); // Call initially to set correct form state
    renderScheduleGrid();
});