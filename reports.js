import { formatDateTimeForFilename, formatDate, formatDateForReportFilename, formatGradeLevelShort, addDays } from './utils/date-utils.js';
import { getGroups, getAllAppData, getSessionItem, setSessionItem, removeSessionItem, getAttendanceRecords, getCustomGradingTypes } from './utils/storage.js';
import { handleLoadBackup, handleSaveBackup, modalConfirm, modalAlert, modalOptions, forceDownload } from './utils/backup-utils.js';
import * as XLSX from 'xlsx'; 
import { splitFullName, sortStudents } from './students/students-utils.js'; 
import { getLocalizedActivityTypeName } from './grade-activity/grade-activity-logic.js';
// NEW: import helper to know if a group/date is a "recorded day"
import { isGroupDateRecorded } from './attendance/attendance-logic.js';

// Add key for full UI state snapshot
const REPORTS_UI_STATE_KEY = 'reports_ui_state';

document.addEventListener('DOMContentLoaded', () => {
    const globalHomeButton = document.getElementById('globalHomeButton');
    const globalSaveButton = document.getElementById('globalSaveButton');
    const globalLoadButton = document.getElementById('globalLoadButton');
    const globalAgendaButton = document.getElementById('globalAgendaButton');
    const globalDailyLogButton = document.getElementById('globalDailyLogButton');
    const goToGroupsButton = document.getElementById('goToGroupsButton');
    const goToAttendanceButton = document.getElementById('goToAttendanceButton');
    const goToGradesButton = document.getElementById('goToGradesButton');

    const groupSelect = document.getElementById('groupSelect');
    const selectAllGroupsBtn = document.getElementById('selectAllGroupsBtn');
    const deselectAllGroupsBtn = document.getElementById('deselectAllGroupsBtn'); 
    const reportFiltersSection = document.querySelector('.report-filters');
    const reportMessage = document.getElementById('reportMessage');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const activitiesList = document.getElementById('activitiesList'); 
    const studentsList = document.getElementById('studentsList'); 
    const selectAllActivitiesBtn = document.getElementById('selectAllActivitiesBtn'); 
    const deselectAllActivitiesBtn = document.getElementById('deselectAllActivitiesBtn'); 
    const selectAllStudentsBtn = document.getElementById('selectAllStudentsBtn'); 
    const deselectAllStudentsBtn = document.getElementById('deselectAllStudentsBtn'); 
    const generateReportButton = document.getElementById('generateReportButton');
    const studentSortSelect = document.getElementById('studentSortSelect'); 
    const includeAttendanceCheckbox = document.getElementById('includeAttendanceCheckbox'); 
    const activitySortSelect = document.getElementById('activitySortSelect'); // NEW

    const activityCategoryFilterSection = document.getElementById('activityCategoryFilterSection');
    const activityCategoryFilterSelect = document.getElementById('activityCategoryFilterSelect');
    const selectAllCategoriesBtn = document.getElementById('selectAllCategoriesBtn');
    const deselectAllCategoriesBtn = document.getElementById('deselectAllCategoriesBtn');

    const downloadActivitiesTxtButton = document.getElementById('downloadActivitiesTxtButton');
    const downloadStudentsTxtButton = document.getElementById('downloadStudentsTxtButton');
    const uploadTxtFile = document.getElementById('uploadTxtFile');
    const previewTxtReportButton = document.getElementById('previewTxtReportButton');
    const txtReportPreview = document.getElementById('txtReportPreview');

    const SAVED_REPORT_CONFIGS_KEY = 'savedReportConfigurations';
    const MAX_SAVED_CONFIGURATIONS = 10;

    const saveConfigNameInput = document.getElementById('saveConfigName');
    const saveConfigurationButton = document.getElementById('saveConfigurationButton');
    const savedConfigurationsList = document.getElementById('savedConfigurationsList');

    let allGroups = getGroups();
    let selectedGroupKeys = [];
    let studentSortOrder = 'lastName'; 
    let activitySortOrder = 'date_desc'; // NEW: default sort

    const REPORT_STUDENT_MANUAL_ORDER_KEY_PREFIX = 'reportStudentManualOrder_';
    const REPORT_ACTIVITY_MANUAL_ORDER_KEY_PREFIX = 'reportActivityManualOrder_';

    let selectedActivityCategoryFilterValues = [];

    let savedReportConfigurations = loadSavedReportConfigurations();

    // Add helper functions to persist selected activity indices across filtering while on the reports page
    const SELECTED_ACTIVITIES_KEY = 'reports_selectedActivities';

    const getPersistedSelectedActivityIndices = () => {
        try {
            return new Set(JSON.parse(sessionStorage.getItem(SELECTED_ACTIVITIES_KEY) || '[]'));
        } catch { return new Set(); }
    };

    const persistSelectedActivityIndices = (set) => {
        sessionStorage.setItem(SELECTED_ACTIVITIES_KEY, JSON.stringify(Array.from(set)));
    };

    const togglePersistedActivityIndex = (idx, checked) => {
        const s = getPersistedSelectedActivityIndices();
        if (checked) s.add(idx);
        else s.delete(idx);
        persistSelectedActivityIndices(s);
    };

    // startDateInput.value = '';
    // endDateInput.value = '';
    // const today = new Date();
    // const thirtyDaysAgo = new Date(today);
    // thirtyDaysAgo.setDate(today.getDate() - 30);
    // startDateInput.value = formatDate(thirtyDaysAgo);
    // endDateInput.value = formatDate(today);

    function loadSavedReportConfigurations() {
        return JSON.parse(localStorage.getItem(SAVED_REPORT_CONFIGS_KEY)) || [];
    };

    const saveAllReportConfigurations = () => {
        localStorage.setItem(SAVED_REPORT_CONFIGS_KEY, JSON.stringify(savedReportConfigurations));
        renderSavedConfigurationsList(); 
    };

    const renderSavedConfigurationsList = () => {
        savedConfigurationsList.innerHTML = '';
        if (savedReportConfigurations.length === 0) {
            savedConfigurationsList.innerHTML = '<li class="no-configurations-message">No hay configuraciones guardadas.</li>';
            return;
        }

        const sortedConfigs = [...savedReportConfigurations].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        sortedConfigs.forEach(config => {
            const li = document.createElement('li');
            li.classList.add('saved-config-item');
            li.dataset.id = config.id;

            const configDetails = document.createElement('div');
            configDetails.classList.add('config-details');
            configDetails.innerHTML = `
                <span class="config-name">${config.name}</span>
                <span class="config-date">Guardado: ${new Date(config.createdAt).toLocaleString()}</span>
            `;
            li.appendChild(configDetails);

            const configActions = document.createElement('div');
            configActions.classList.add('config-actions');

            const loadButton = document.createElement('button');
            loadButton.textContent = 'Cargar';
            loadButton.classList.add('action-button-small', 'load-config-button');
            loadButton.addEventListener('click', async () => {
                applyReportConfiguration(config);
                await modalAlert('Configuración cargada. Se han aplicado los filtros y selecciones guardadas para este informe.');
            });
            configActions.appendChild(loadButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Eliminar';
            deleteButton.classList.add('action-button-small', 'delete-config-button');
            deleteButton.addEventListener('click', async () => {
                const ok = await modalConfirm(`¿Eliminar la configuración "${config.name}"? Esta acción no se puede deshacer.`);
                if (!ok) return;
                deleteReportConfiguration(config.id);
            });
            configActions.appendChild(deleteButton);

            li.appendChild(configActions);
            savedConfigurationsList.appendChild(li);
        });
    };

    const deleteReportConfiguration = (id) => {
        savedReportConfigurations = savedReportConfigurations.filter(c => c.id !== id);
        saveAllReportConfigurations();
    };

    const loadGroupsDropdown = () => {
        groupSelect.innerHTML = '';
        if (allGroups.length === 0) {
            reportMessage.textContent = 'No hay grupos creados aún. Ve a "Gestión de Grupos y Alumnos" para añadir.';
            groupSelect.disabled = true;
            reportFiltersSection.style.display = 'none';
            activityCategoryFilterSection.style.display = 'none'; 
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

        reportMessage.textContent = 'Selecciona uno o varios grupos para empezar.';
        reportFiltersSection.style.display = 'none';
        activityCategoryFilterSection.style.display = 'none'; 
        generateReportButton.disabled = true;
        studentSortSelect.value = studentSortOrder;
        // NEW: Set initial activity sort dropdown value
        if (activitySortSelect) activitySortSelect.value = activitySortOrder;

        const storedReportGroupKey = getSessionItem('reportGroupKey');
        if (storedReportGroupKey) {
            groupSelect.value = storedReportGroupKey;
            groupSelect.dispatchEvent(new Event('change'));
            removeSessionItem('reportGroupKey');
        }
    };

    const populateActivityCategoryFilterOptions = (activities) => {
        const uniqueCategories = new Set();
        uniqueCategories.add('Todas las categorías'); 

        activities.forEach(activity => {
            if (activity.category) {
                uniqueCategories.add(activity.category);
            } else {
                uniqueCategories.add('Sin Categoría'); 
            }
        });

        const sortedCategories = Array.from(uniqueCategories).sort((a, b) => {
            if (a === 'Todas las categorías') return -1;
            if (b === 'Todas las categorías') return 1;
            if (a === 'Sin Categoría') return -1; 
            if (b === 'Sin Categoría') return 1;
            return a.localeCompare(b);
        });

        activityCategoryFilterSelect.innerHTML = '';
        sortedCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            activityCategoryFilterSelect.appendChild(option);
        });

        Array.from(activityCategoryFilterSelect.options).forEach(option => {
            option.selected = selectedActivityCategoryFilterValues.includes(option.value);
        });
    };

    const checkGenerateButtonState = () => {
        const selectedGroups = Array.from(groupSelect.selectedOptions).map(opt => opt.value);
        
        if (selectedGroups.length === 0) {
            generateReportButton.disabled = true;
            downloadActivitiesTxtButton.disabled = true;
            downloadStudentsTxtButton.disabled = true;
            return;
        }

        downloadActivitiesTxtButton.disabled = false;
        downloadStudentsTxtButton.disabled = false;

        if (selectedGroups.length > 1) {
            generateReportButton.disabled = false; 
            return;
        }
        
        const hasSelectedActivity = activitiesList.querySelector('input[type="checkbox"]:checked');
        const hasSelectedStudent = studentsList.querySelector('input[type="checkbox"]:checked');
        const includeAttendanceChecked = includeAttendanceCheckbox.checked;

        const enableButton = (hasSelectedActivity && hasSelectedStudent) || (hasSelectedStudent && includeAttendanceChecked);
        
        generateReportButton.disabled = !enableButton;
    };

    const populateCheckboxList = (container, items, itemType, preSelectionData = null) => {
        container.innerHTML = '';
        if (items.length === 0) {
            const li = document.createElement('li');
            li.textContent = `No hay ${itemType === 'activity' ? 'actividades' : 'alumnos'} en el rango de fechas.`;
            li.classList.add('disabled');
            container.appendChild(li);
            return;
        }

        const todayFormatted = formatDate(new Date());
        const fourDaysFromNowFormatted = formatDate(addDays(new Date(), 4));

        items.forEach((item, index) => {
            const li = document.createElement('li');
            li.dataset.index = item.originalIndex !== undefined ? item.originalIndex : index;

            if (itemType === 'activity') {
                if (item.date < todayFormatted) {
                    li.classList.add('past-activity');
                } else if (item.date === todayFormatted) {
                    li.classList.add('today-activity');
                } else if (item.date <= fourDaysFromNowFormatted) {
                    li.classList.add('upcoming-activity');
                }
            }
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `${itemType}-${index}`;
            if (itemType === 'student') {
                checkbox.value = item.name;
            } else { 
                checkbox.value = li.dataset.index;
            }

            // NEW: preserve activity selection across filter changes using sessionStorage
            if (itemType === 'activity') {
                const persisted = getPersistedSelectedActivityIndices();
                const origIdx = parseInt(li.dataset.index, 10);
                if (persisted.has(origIdx)) checkbox.checked = true;
                // When user toggles a checkbox, update persisted set
                checkbox.addEventListener('change', (ev) => {
                    togglePersistedActivityIndex(origIdx, ev.target.checked);
                    checkGenerateButtonState();
                });
            }

            // For students use previous behavior (preSelectionData)
            if (itemType === 'student') {
                if (Array.isArray(preSelectionData)) {
                    checkbox.checked = preSelectionData.includes(item.name);
                } else {
                    checkbox.checked = false;
                }
            }

            const label = document.createElement('label');
            label.htmlFor = `${itemType}-${index}`;

            const itemDetailsContent = document.createElement('div');
            itemDetailsContent.classList.add('item-details-content');

            if (itemType === 'activity' && item.mark) {
                // Use the same mark icons as the activities page (emoji) and place them immediately left of the name
                let markEmoji = '';
                switch (item.mark) {
                    case 'tick-green': markEmoji = '✅'; break;
                    case 'triangle-yellow': markEmoji = '⚠️'; break;
                    case 'x-red': markEmoji = '❌'; break;
                }
                if (markEmoji) {
                    const iconSpan = document.createElement('span');
                    iconSpan.textContent = markEmoji;
                    iconSpan.classList.add('activity-mark-icon');
                    // insert icon before the name by appending now so it appears left in the item-details-content flow
                    itemDetailsContent.appendChild(iconSpan);
                }
            }

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('item-name');
            nameSpan.textContent = item.name;
            itemDetailsContent.appendChild(nameSpan);

            if (itemType === 'activity') {
                const subtextSpan = document.createElement('span');
                subtextSpan.classList.add('item-subtext');
                subtextSpan.textContent = `Fecha: ${formatDateForReportFilename(item.date)} - Tipo: ${item.category || 'Actividad'}`;
                itemDetailsContent.appendChild(subtextSpan);

                if (item.description && item.description.trim() !== '') {
                    const descriptionSpan = document.createElement('span');
                    descriptionSpan.classList.add('item-description');
                    descriptionSpan.textContent = item.description;
                    itemDetailsContent.appendChild(descriptionSpan);
                }
            }
            
            label.appendChild(itemDetailsContent); 
            li.appendChild(checkbox);
            li.appendChild(label); 

            if (itemType === 'activity') {
                const openButton = document.createElement('button');
                openButton.textContent = 'Abrir';
                openButton.classList.add('action-button-small', 'open-activity-button');
                openButton.dataset.activityIndex = item.originalIndex; 
                openButton.dataset.groupKey = selectedGroupKeys[0]; 
                li.appendChild(openButton);
            }

            container.appendChild(li);
            // Enable drag only where applicable
            const isActivityItem = itemType === 'activity';
            const isStudentItem = itemType === 'student';
            // Make students draggable by default so manual reordering is available immediately.
            // If the user performs a manual reorder we will switch the student sort selector to 'manual'.
            li.draggable = isActivityItem || isStudentItem;
            // If not draggable, add a class for styling
            if (!li.draggable) li.classList.add('not-draggable');

            li.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox' && !e.target.closest('label') && !e.target.closest('.open-activity-button')) { 
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });

        container.addEventListener('change', checkGenerateButtonState);
        enableDragSort(container);
    };

    const updateActivityAndStudentFilters = (preSelectedStudentName = null) => {
        const currentCheckedActivityIndices = Array.from(activitiesList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value, 10));
        const currentCheckedStudentNames = Array.from(studentsList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => {
            const listItem = cb.closest('li');
            return listItem ? listItem.querySelector('.item-name').textContent : null;
        }).filter(Boolean);

        const tempRestoredActivityIndices = JSON.parse(getSessionItem('temp_restoredActivityIndices') || '[]');
        const tempRestoredStudentNames = JSON.parse(getSessionItem('temp_restoredStudentNames') || '[]');

        removeSessionItem('temp_restoredActivityIndices');
        removeSessionItem('temp_restoredStudentNames');

        // Ensure that when a stored single-configuration was applied earlier (temp_restoredActivityIndices), we seed persisted state so it survives further filter changes
        const tempRestored = JSON.parse(sessionStorage.getItem('temp_restoredActivityIndices') || '[]');
        if (Array.isArray(tempRestored) && tempRestored.length) {
            sessionStorage.setItem(SELECTED_ACTIVITIES_KEY, JSON.stringify(tempRestored));
            sessionStorage.removeItem('temp_restoredActivityIndices');
        }

        const actualActivityPreselection = tempRestoredActivityIndices.length > 0 ? tempRestoredActivityIndices : (currentCheckedActivityIndices.length > 0 ? currentCheckedActivityIndices : null);
        const actualStudentPreselection = preSelectedStudentName ? [preSelectedStudentName] : (tempRestoredStudentNames.length > 0 ? tempRestoredStudentNames : (currentCheckedStudentNames.length > 0 ? currentCheckedStudentNames : null));
        
        activitiesList.innerHTML = '';
        studentsList.innerHTML = '';

        selectedActivityCategoryFilterValues = Array.from(activityCategoryFilterSelect.selectedOptions).map(opt => opt.value);

        if (selectedGroupKeys.length === 0) {
            reportMessage.textContent = 'Selecciona uno o varios grupos para empezar.';
            reportFiltersSection.style.display = 'none';
            activityCategoryFilterSection.style.display = 'none';
            activitiesList.parentElement.style.display = 'none';
            studentsList.parentElement.style.display = 'none';
            checkGenerateButtonState();
            return;
        }

        reportFiltersSection.style.display = 'block';
        reportMessage.textContent = '';

        if (selectedGroupKeys.length > 1) {
            reportMessage.textContent = 'Múltiples grupos seleccionados: se incluirán todos los alumnos y actividades dentro del rango de fechas.';
            activityCategoryFilterSection.style.display = 'none';
            activitiesList.parentElement.style.display = 'none';
            studentsList.parentElement.style.display = 'none';
            checkGenerateButtonState();
            return;
        }

        activitiesList.parentElement.style.display = 'block';
        studentsList.parentElement.style.display = 'block';
        activityCategoryFilterSection.style.display = 'block';
        
        const currentGroup = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === selectedGroupKeys[0]);
        if (!currentGroup) {
            reportMessage.textContent = 'Grupo seleccionado no encontrado.';
            activityCategoryFilterSection.style.display = 'none';
            activitiesList.parentElement.style.display = 'none';
            studentsList.parentElement.style.display = 'none';
            checkGenerateButtonState();
            return;
        }

        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        const dateFilteredActivities = (currentGroup.activities || [])
            .filter(activity => {
                if (startDate && activity.date < startDate) return false;
                if (endDate && activity.date > endDate) return false;
                return true;
            });
        
        populateActivityCategoryFilterOptions(dateFilteredActivities);

        let finalFilteredActivities = dateFilteredActivities.filter(activity => {
            if (selectedActivityCategoryFilterValues.includes('Todas las categorías') || selectedActivityCategoryFilterValues.length === 0) {
                return true;
            }
            const activityCategory = activity.category || 'Sin Categoría';
            return selectedActivityCategoryFilterValues.includes(activityCategory);
        })
        .map((activity) => {
            const trueOriginalIndex = (currentGroup.activities || []).indexOf(activity);
            return { ...activity, originalIndex: trueOriginalIndex };
        });

        // NEW: Apply sorting based on activitySortOrder, respecting 'manual' option
        if (activitySortOrder === 'manual') {
            const activityManualKey = `${REPORT_ACTIVITY_MANUAL_ORDER_KEY_PREFIX}${selectedGroupKeys[0]}`;
            const storedOrder = getSessionItem(activityManualKey);
            if (storedOrder) {
                const orderArray = JSON.parse(storedOrder);
                const byOriginalIndex = new Map(finalFilteredActivities.map(a => [a.originalIndex, a]));
                const ordered = orderArray.map(idx => byOriginalIndex.get(idx)).filter(Boolean);
                // Ensure all activities are present, even if not in manual order (e.g., new activities)
                const remaining = finalFilteredActivities.filter(a => !orderArray.includes(a.originalIndex));
                finalFilteredActivities = [...ordered, ...remaining];
            } else {
                // If 'manual' is selected but no manual order is saved, default to date_desc
                finalFilteredActivities.sort((a,b)=> new Date(b.date) - new Date(a.date));
            }
        } else { // Apply selected date/creation sort (which implies manual order was cleared if previously set)
            if (activitySortOrder === 'date_asc') {
                finalFilteredActivities.sort((a,b)=> new Date(a.date) - new Date(b.date));
            } else if (activitySortOrder === 'date_desc') {
                finalFilteredActivities.sort((a,b)=> new Date(b.date) - new Date(a.date));
            } else if (activitySortOrder === 'created_asc') {
                finalFilteredActivities.sort((a,b) => (a.originalIndex || 0) - (b.originalIndex || 0));
            } else if (activitySortOrder === 'created_desc') {
                finalFilteredActivities.sort((a,b) => (b.originalIndex || 0) - (a.originalIndex || 0));
            }
        }

        // After building and rendering activity list, ensure checkGenerateButtonState wired correctly
        populateCheckboxList(activitiesList, finalFilteredActivities, 'activity', actualActivityPreselection);
        // NEW: adjust activities list to show up to 5 items fully; if more items, enable scrollbar
        adjustActivitiesListHeight();
        // Ensure persisted selections remain (no clearing) — handled inside populateCheckboxList by using sessionStorage

        const studentsWithIndex = (currentGroup.students || []).map((s, originalIndex) => ({ ...s, originalIndex }));
        let sortedStudents = sortStudents(studentsWithIndex, studentSortOrder);

        if (studentSortOrder === 'manual') {
            const manualKey = `${REPORT_STUDENT_MANUAL_ORDER_KEY_PREFIX}${selectedGroupKeys[0] || ''}`;
            const storedOrder = getSessionItem(manualKey);
            if (storedOrder) {
                const orderArray = JSON.parse(storedOrder); 
                const byIndex = new Map(studentsWithIndex.map(s => [s.originalIndex, s]));
                sortedStudents = orderArray.map(idx => byIndex.get(idx)).filter(Boolean);
            }
        }
        
        populateCheckboxList(studentsList, sortedStudents, 'student', actualStudentPreselection);

        if (preSelectedStudentName) {
            removeSessionItem('reportStudentName');
        }

        checkGenerateButtonState();
    };

    // NEW: adjust activities list to show up to 5 items fully; if more items, enable scrollbar
    function adjustActivitiesListHeight() {
        try {
            const lis = Array.from(activitiesList.querySelectorAll('li'));
            if (!lis.length) {
                activitiesList.style.maxHeight = '';
                activitiesList.style.overflowY = '';
                return;
            }
            // Count only actual activity items (skip disabled message items)
            const activityLis = lis.filter(li => !li.classList.contains('disabled'));
            const count = activityLis.length;
            if (count <= 5) {
                // compute total height of up to 5 items to fit them exactly
                let total = 0;
                for (let i = 0; i < Math.min(5, activityLis.length); i++) {
                    total += activityLis[i].offsetHeight;
                }
                // add small padding for container padding/margins
                activitiesList.style.maxHeight = (total + 8) + 'px';
                activitiesList.style.overflowY = 'hidden';
            } else {
                // allow scrolling and cap height to the height of 5 items
                let total = 0;
                for (let i = 0; i < 5; i++) {
                    total += activityLis[i].offsetHeight;
                }
                activitiesList.style.maxHeight = (total + 8) + 'px';
                activitiesList.style.overflowY = 'auto';
            }
        } catch (e) {
            // fallback: do nothing
        }
    };

    // NEW: capture selections and manual order when a único grupo está seleccionado
    const saveCurrentReportConfiguration = async () => {
        const configName = saveConfigNameInput.value.trim();
        if (!configName) {
            await modalAlert('Por favor, introduce un nombre para la configuración.');
            return false;
        }

        const config = {
            id: Date.now(),
            name: configName,
            createdAt: new Date().toISOString(),
            groupKeys: selectedGroupKeys,
            activityCategoryFilterValues: selectedActivityCategoryFilterValues,
            startDate: startDateInput.value,
            endDate: endDateInput.value,
            includeAttendance: includeAttendanceCheckbox.checked,
            studentSortOrder: studentSortOrder,
            activitySortOrder: activitySortOrder // NEW: Save activity sort order
        };

        // NEW: capture selections and manual order when a único grupo está seleccionado
        if (selectedGroupKeys.length === 1) {
            const gk = selectedGroupKeys[0];
            config.selectedActivityIndices = Array.from(activitiesList.querySelectorAll('input[type="checkbox"]:checked'))
                .map(cb => parseInt(cb.value, 10))
                .filter(n => !isNaN(n));
            config.selectedStudentNames = Array.from(studentsList.querySelectorAll('input[type="checkbox"]:checked'))
                .map(cb => cb.value)
                .filter(Boolean);
            try {
                config.activityManualOrder = JSON.parse(getSessionItem(REPORT_ACTIVITY_MANUAL_ORDER_KEY_PREFIX + gk) || '[]');
            } catch { config.activityManualOrder = []; }
            try {
                config.studentManualOrder = JSON.parse(getSessionItem(REPORT_STUDENT_MANUAL_ORDER_KEY_PREFIX + gk) || '[]');
            } catch { config.studentManualOrder = []; }
        }

        if (savedReportConfigurations.length >= MAX_SAVED_CONFIGURATIONS) {
            const ok = await modalConfirm('¿Quieres eliminar la configuración más antigua para guardar esta nueva?');
            if (!ok) return false;
            savedReportConfigurations.shift();
        }

        savedReportConfigurations.push(config);
        saveAllReportConfigurations();
        return true;
    };
    
    // NEW: Apply a saved configuration to the UI
    const applyReportConfiguration = (config) => {
        try {
            // Groups
            Array.from(groupSelect.options).forEach(o => o.selected = (config.groupKeys || []).includes(o.value));
            selectedGroupKeys = config.groupKeys ? [...config.groupKeys] : [];
            // Dates
            startDateInput.value = config.startDate || '';
            endDateInput.value = config.endDate || '';
            // Attendance
            includeAttendanceCheckbox.checked = !!config.includeAttendance;
            // Sorters
            studentSortOrder = config.studentSortOrder || 'lastName';
            studentSortSelect.value = studentSortOrder;
            activitySortOrder = config.activitySortOrder || 'date_desc';
            if (activitySortSelect) activitySortSelect.value = activitySortOrder;
            // Category filters
            selectedActivityCategoryFilterValues = Array.isArray(config.activityCategoryFilterValues) ? [...config.activityCategoryFilterValues] : [];
            // Restore manual orders if present (store in session so updateActivityAndStudentFilters picks them up)
            if (selectedGroupKeys.length === 1) {
                const gk = selectedGroupKeys[0];
                if (Array.isArray(config.activityManualOrder)) {
                    setSessionItem(REPORT_ACTIVITY_MANUAL_ORDER_KEY_PREFIX + gk, JSON.stringify(config.activityManualOrder));
                } else {
                    removeSessionItem(REPORT_ACTIVITY_MANUAL_ORDER_KEY_PREFIX + gk);
                }
                if (Array.isArray(config.studentManualOrder)) {
                    setSessionItem(REPORT_STUDENT_MANUAL_ORDER_KEY_PREFIX + gk, JSON.stringify(config.studentManualOrder));
                } else {
                    removeSessionItem(REPORT_STUDENT_MANUAL_ORDER_KEY_PREFIX + gk);
                }
                // Persist selected activities and students temporarily so they are applied after rendering
                if (Array.isArray(config.selectedActivityIndices)) {
                    sessionStorage.setItem(SELECTED_ACTIVITIES_KEY, JSON.stringify(config.selectedActivityIndices));
                } else {
                    sessionStorage.removeItem(SELECTED_ACTIVITIES_KEY);
                }
                if (Array.isArray(config.selectedStudentNames)) {
                    setSessionItem('temp_restoredStudentNames', JSON.stringify(config.selectedStudentNames));
                } else {
                    removeSessionItem('temp_restoredStudentNames');
                }
            } else {
                // clear any group-specific manual orders when multiple groups selected
                if (Array.isArray(selectedGroupKeys)) {
                    selectedGroupKeys.forEach(gk => {
                        removeSessionItem(REPORT_ACTIVITY_MANUAL_ORDER_KEY_PREFIX + gk);
                        removeSessionItem(REPORT_STUDENT_MANUAL_ORDER_KEY_PREFIX + gk);
                    });
                }
                sessionStorage.removeItem(SELECTED_ACTIVITIES_KEY);
                removeSessionItem('temp_restoredStudentNames');
            }
            // Re-render lists with restored state
            updateActivityAndStudentFilters();
        } catch (e) {
            console.warn('Error aplicando configuración guardada:', e);
        }
    };

    // NEW: helpers to compute min/max activity dates for a group
    const getGroupActivityDateBounds = (group) => {
        const acts = Array.isArray(group.activities) ? group.activities : [];
        if (acts.length === 0) return null;
        let min = acts[0].date, max = acts[0].date;
        acts.forEach(a => {
            if (!a || !a.date) return;
            if (a.date < min) min = a.date;
            if (a.date > max) max = a.date;
        });
        return { min, max };
    };

    // NEW: Enable drag-and-drop sorting and persist order per list
    const enableDragSort = (container) => {
        // Ensure listeners are only added once
        if (container.dataset.dragListenersAttached === 'true') return;

        const isActivities = container.id === 'activitiesList';
        const isStudents = container.id === 'studentsList';

        // Event listeners are attached to the container, but actual drag behavior relies on `draggable` attribute
        // set on individual list items (managed by populateCheckboxList).
        // This function sets up the event handlers that respond to `draggable` items.
        
        let dragged = null;
        container.addEventListener('dragstart', e => { 
            dragged = e.target.closest('li'); 
            if (dragged && dragged.draggable) { // Only start drag if item is actually draggable
                e.dataTransfer.effectAllowed = 'move'; 
                e.dataTransfer.setData('text/plain', dragged.dataset.index); 
                setTimeout(() => dragged.classList.add('dragging'), 0); 
            } else {
                dragged = null; // Reset if not draggable
                e.preventDefault(); // Prevent default drag behavior if not draggable
            }
        });
        container.addEventListener('dragover', e => { 
            e.preventDefault(); 
            const over = e.target.closest('li'); 
            if (dragged && over && over !== dragged && over.draggable) { // Only allow drag-over on draggable items
                // Clear all drag-over classes on items that are no longer hovered.
                Array.from(container.children).forEach(li => li.classList.remove('drag-over'));
                over.classList.add('drag-over'); 
            }
        });
        container.addEventListener('dragleave', e => { 
            const li = e.target.closest('li'); 
            if (li) li.classList.remove('drag-over'); 
        });
        container.addEventListener('drop', e => {
            e.preventDefault();
            const over = e.target.closest('li'); 
            if (dragged && over && over !== dragged && over.draggable) { // Only allow drop if target is draggable
                over.classList.remove('drag-over');
                const after = (e.clientY - over.getBoundingClientRect().top) > (over.offsetHeight/2);
                over.parentNode.insertBefore(dragged, after ? over.nextSibling : over);
                dragged.classList.remove('dragging'); 
                dragged = null;
                const order = Array.from(container.querySelectorAll('li')).map(li => parseInt(li.dataset.index,10));
                const key = (isActivities ? REPORT_ACTIVITY_MANUAL_ORDER_KEY_PREFIX : REPORT_STUDENT_MANUAL_ORDER_KEY_PREFIX) + (selectedGroupKeys[0] || '');
                setSessionItem(key, JSON.stringify(order));
                // When activities were reordered by drag, switch the activity sort selector to 'manual'
                if (isActivities) {
                    activitySortOrder = 'manual';
                    if (activitySortSelect) activitySortSelect.value = 'manual';
                }
                // When students were reordered by drag, switch the student sort selector to 'manual'
                if (isStudents) {
                    studentSortOrder = 'manual';
                    if (studentSortSelect) studentSortSelect.value = 'manual';
                }
                updateActivityAndStudentFilters(); // re-render preserving selecciones
            } else {
                if (dragged) dragged.classList.remove('dragging'); // In case drop wasn't on a valid target
            }
            dragged = null;
        });
        container.addEventListener('dragend', () => { 
            if (dragged) dragged.classList.remove('dragging'); 
            dragged = null; 
            // Clear all drag-over classes from all items in the container
            Array.from(container.children).forEach(li => li.classList.remove('drag-over'));
        });

        container.dataset.dragListenersAttached = 'true'; // Mark listeners as attached
    };

    // NEW: helper function to build and download .txt files
    const buildAndDownloadTxt = (filename, content) => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        forceDownload(blob, filename);
    };

    // NEW: function to generate activities.txt
    const generateActivitiesTxt = async () => {
        if (selectedGroupKeys.length === 0) { await modalAlert('Selecciona al menos un grupo.'); return; }
        const lines = [];
        lines.push('INFORME DE ACTIVIDADES');
        lines.push('');

        const startDate = startDateInput.value || null;
        const endDate = endDateInput.value || null;

        for (const gk of selectedGroupKeys) {
            const group = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === gk);
            if (!group) continue;
            lines.push(`=== Grupo: ${group.subjectName} (${formatGradeLevelShort(group.gradeLevel)} ${group.groupLetter}) ===`);
            lines.push('Actividades:');
            lines.push('| Fecha | Nombre | Tipo | Calificación | Marca | Observaciones |');
            lines.push('|------|--------|------|---------------|-------|----------------|');

            let actIndices = [];
            let orderedActs = [];

            if (selectedGroupKeys.length === 1) {
                const checked = new Set(Array.from(activitiesList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value,10)));
                const orderedLis = Array.from(activitiesList.querySelectorAll('li'));
                orderedActs = orderedLis
                    .map(li => parseInt(li.dataset.index,10))
                    .filter(idx => checked.has(idx))
                    .map(idx => ({ idx, a: group.activities[idx] }))
                    .filter(x => x.a);
            } else {
                // Multiple groups: include all activities, sort by date
                const all = (group.activities || []).map((a, idx) => ({ idx, a }));
                orderedActs = all.filter(x => {
                    if (startDate && x.a.date < startDate) return false;
                    if (endDate && x.a.date > endDate) return false;
                    return true;
                }).sort((x,y)=> new Date(x.a.date) - new Date(y.a.date));
            }

            if (orderedActs.length === 0) {
                lines.push('- (sin actividades)');
                lines.push('');
                continue;
            }

            orderedActs.forEach(({ a }) => {
                const mark = a.mark === 'tick-green' ? '✅' : (a.mark === 'triangle-yellow' ? '⚠️' : (a.mark === 'x-red' ? '❌' : ''));
                const obs = (a.description || '').trim().replace(/\s+/g,' ');
                const typeText = getLocalizedActivityTypeName(a.type || 'numeric_integer');
                lines.push(`- Fecha: ${formatDateForReportFilename(a.date)}`);
                lines.push(`  Nombre: ${a.name}`);
                lines.push(`  Categoría: ${a.category || 'Actividad'}`);
                lines.push(`  Tipo/Calificación: ${typeText}`);
                lines.push(`  Marca: ${mark || '-'}`);
                lines.push(`  Observaciones: ${obs || '-'}`);
                lines.push(''); // blank line between activities
            });
        }

        const base = selectedGroupKeys.length === 1 ? selectedGroupKeys[0].replace(/[^a-z0-9_\- ]/gi,'_') : 'Multiples_Grupos';
        buildAndDownloadTxt(`Actividades_${base}_${formatDate(new Date())}.txt`, lines.join('\n'));
        // Auto-load generated content into preview area
        if (typeof txtReportPreview !== 'undefined' && txtReportPreview) txtReportPreview.value = lines.join('\n');
    };

    // NEW: function to generate students.txt
    const generateStudentsTxt = async () => {
        if (selectedGroupKeys.length === 0) { await modalAlert('Selecciona al menos un grupo.'); return; }
        const lines = [];
        lines.push('INFORME DE ALUMNOS');
        lines.push('');

        const getStudentDetailsSafe = (s) => {
            const d = s.details || {};
            const ch = d.characteristics || {};
            return {
                observations: (d.observations || '').trim(),
                characteristics: { ACNEE: !!ch.ACNEE, COMPE: !!ch.COMPE, REPET: !!ch.REPET, ADAPT: !!ch.ADAPT },
                classifications: Array.isArray(d.classifications) ? d.classifications : []
            };
        };

        for (const gk of selectedGroupKeys) {
            const group = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === gk);
            if (!group) continue;
            lines.push(`=== Grupo: ${group.subjectName} (${formatGradeLevelShort(group.gradeLevel)} ${group.groupLetter}) ===`);
            lines.push('Alumnos:');

            let studentEntries = [];

            if (selectedGroupKeys.length === 1) {
                const selectedNames = new Set(Array.from(studentsList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value));
                // Preserve current order as shown in the UI
                const orderedLis = Array.from(studentsList.querySelectorAll('li'));
                studentEntries = orderedLis
                    .map(li => { const nameEl = li.querySelector('.item-name'); const name = nameEl ? nameEl.textContent : null; return name && selectedNames.has(name) ? name : null; })
                    .filter(Boolean)
                    .map(name => group.students.find(s => s.name === name))
                    .filter(Boolean);
            } else {
                // Multiple groups: include all students, sort by last name
                const withIndex = (group.students || []).map((s, originalIndex) => ({ ...s, originalIndex }));
                studentEntries = sortStudents(withIndex, 'lastName');
            }

            if (studentEntries.length === 0) { lines.push('- (sin alumnos)'); lines.push(''); continue; }
            studentEntries.forEach(s => {
                const det = getStudentDetailsSafe(s);
                const activeChars = Object.entries(det.characteristics).filter(([,v]) => v).map(([k]) => k);
                lines.push(`- Nombre: ${s.name}`);
                lines.push(`  Observaciones: ${det.observations || '-'}`);
                lines.push(`  Características: ${activeChars.length ? activeChars.join(', ') : '-'}`);
                if (det.classifications.length) {
                    lines.push('  Clasificación:');
                    det.classifications.forEach(c => {
                        const t = (c.type || '').trim();
                        const d = (c.description || '').trim();
                        lines.push(`    • ${t}${d ? `: ${d}` : ''}`);
                    });
                } else {
                    lines.push('  Clasificación: -');
                }
            });
            lines.push('');
        }

        const base = selectedGroupKeys.length === 1 ? selectedGroupKeys[0].replace(/[^a-z0-9_\- ]/gi,'_') : 'Multiples_Grupos';
        buildAndDownloadTxt(`Alumnos_${base}_${formatDate(new Date())}.txt`, lines.join('\n'));
        // Auto-load generated content into preview area
        if (typeof txtReportPreview !== 'undefined' && txtReportPreview) txtReportPreview.value = lines.join('\n');
    };

    // Add preview and upload handling & content-generation helpers
    const generateActivitiesTxtContent = (groupsKeys) => {
        const lines = [];
        lines.push('INFORME DE ACTIVIDADES');
        lines.push('');
        const startDate = startDateInput.value || null;
        const endDate = endDateInput.value || null;
        for (const gk of groupsKeys) {
            const group = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === gk);
            if (!group) continue;
            lines.push(`=== Grupo: ${group.subjectName} (${formatGradeLevelShort(group.gradeLevel)} ${group.groupLetter}) ===`);
            lines.push('Actividades:');
            lines.push('| Fecha | Nombre | Tipo | Calificación | Marca | Observaciones |');
            lines.push('|------|--------|------|---------------|-------|----------------|');

            let actIndices = [];
            let orderedActs = [];

            if (selectedGroupKeys.length === 1) {
                const checked = new Set(Array.from(activitiesList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value,10)));
                const orderedLis = Array.from(activitiesList.querySelectorAll('li'));
                orderedActs = orderedLis
                    .map(li => parseInt(li.dataset.index,10))
                    .filter(idx => checked.has(idx))
                    .map(idx => ({ idx, a: group.activities[idx] }))
                    .filter(x => x.a);
            } else {
                // Multiple groups: include all activities, sort by date
                const all = (group.activities || []).map((a, idx) => ({ idx, a }));
                orderedActs = all.filter(x => {
                    if (startDate && x.a.date < startDate) return false;
                    if (endDate && x.a.date > endDate) return false;
                    return true;
                }).sort((x,y)=> new Date(x.a.date) - new Date(y.a.date));
            }

            if (orderedActs.length === 0) { lines.push('- (sin actividades)'); lines.push(''); continue; }
            orderedActs.forEach(({ a }) => {
                const mark = a.mark === 'tick-green' ? '✅' : (a.mark === 'triangle-yellow' ? '⚠️' : (a.mark === 'x-red' ? '❌' : ''));
                const obs = (a.description || '').trim().replace(/\s+/g,' ');
                const typeText = getLocalizedActivityTypeName(a.type || 'numeric_integer');
                lines.push(`- Fecha: ${formatDateForReportFilename(a.date)}`);
                lines.push(`  Nombre: ${a.name}`);
                lines.push(`  Categoría: ${a.category || 'Actividad'}`);
                lines.push(`  Tipo/Calificación: ${typeText}`);
                lines.push(`  Marca: ${mark || '-'}`);
                lines.push(`  Observaciones: ${obs || '-'}`);
                lines.push(''); // blank line between activities
            });
        }
        return lines.join('\n');
    };

    const generateStudentsTxtContent = (groupsKeys) => {
        const lines = [];
        lines.push('INFORME DE ALUMNOS');
        lines.push('');
        const getStudentDetailsSafe = (s) => {
            const d = s.details || {};
            const ch = d.characteristics || {};
            return {
                observations: (d.observations || '').trim(),
                characteristics: { ACNEE: !!ch.ACNEE, COMPE: !!ch.COMPE, REPET: !!ch.REPET, ADAPT: !!ch.ADAPT },
                classifications: Array.isArray(d.classifications) ? d.classifications : []
            };
        };
        for (const gk of groupsKeys) {
            const group = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === gk);
            if (!group) continue;
            lines.push(`=== Grupo: ${group.subjectName} (${formatGradeLevelShort(group.gradeLevel)} ${group.groupLetter}) ===`);
            lines.push('Alumnos:');
            let studentEntries = [];

            if (groupsKeys.length === 1) {
                const selectedNames = new Set(Array.from(studentsList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value));
                // Preserve current order as shown in the UI
                const orderedLis = Array.from(studentsList.querySelectorAll('li'));
                studentEntries = orderedLis
                    .map(li => { const nameEl = li.querySelector('.item-name'); const name = nameEl ? nameEl.textContent : null; return name && selectedNames.has(name) ? name : null; })
                    .filter(Boolean)
                    .map(name => group.students.find(s => s.name === name))
                    .filter(Boolean);
            } else {
                // Multiple groups: include all students, sort by last name
                const withIndex = (group.students || []).map((s, originalIndex) => ({ ...s, originalIndex }));
                studentEntries = sortStudents(withIndex, 'lastName');
            }

            if (studentEntries.length === 0) { lines.push('- (sin alumnos)'); lines.push(''); continue; }
            studentEntries.forEach(s => {
                const det = getStudentDetailsSafe(s);
                const activeChars = Object.entries(det.characteristics).filter(([,v]) => v).map(([k]) => k);
                lines.push(`- Nombre: ${s.name}`);
                lines.push(`  Observaciones: ${det.observations || '-'}`);
                lines.push(`  Características: ${activeChars.length ? activeChars.join(', ') : '-'}`);
                if (det.classifications.length) {
                    lines.push('  Clasificación:');
                    det.classifications.forEach(c => {
                        const t = (c.type || '').trim();
                        const d = (c.description || '').trim();
                        lines.push(`    • ${t}${d ? `: ${d}` : ''}`);
                    });
                } else {
                    lines.push('  Clasificación: -');
                }
            });
            lines.push('');
        }
        return lines.join('\n');
    };

    // Preview button: if a file is selected, show its contents; otherwise generate previews from current selection
    previewTxtReportButton.addEventListener('click', async () => {
        if (uploadTxtFile && uploadTxtFile.files && uploadTxtFile.files.length > 0) {
            const file = uploadTxtFile.files[0];
            const text = await file.text();
            txtReportPreview.value = text;
            return;
        }
        if (selectedGroupKeys.length === 0) {
            txtReportPreview.value = 'Selecciona al menos un grupo para previsualizar un informe.';
            return;
        }
        // Build combined preview: Activities then Students
        const actContent = generateActivitiesTxtContent(selectedGroupKeys);
        const stuContent = generateStudentsTxtContent(selectedGroupKeys);
        txtReportPreview.value = actContent + '\n\n' + stuContent;
    });

    // If user chooses a .txt file, load and show immediately in preview area
    if (uploadTxtFile) {
        uploadTxtFile.addEventListener('change', async () => {
            if (uploadTxtFile.files && uploadTxtFile.files.length > 0) {
                try {
                    const text = await uploadTxtFile.files[0].text();
                    txtReportPreview.value = text;
                } catch (err) {
                    txtReportPreview.value = 'Error al leer el archivo seleccionado.';
                }
            }
        });
    }

    // When leaving the reports page, clear the persisted activity selections so they are not kept when returning
    const clearPersistedSelectionsOnExit = () => {
        const dest = sessionStorage.getItem('reports_navigation_target');
        if (dest === 'grade_activity') return; // keep selections for back-navigation
        sessionStorage.removeItem(SELECTED_ACTIVITIES_KEY);
        sessionStorage.removeItem(REPORTS_UI_STATE_KEY);
        sessionStorage.removeItem('reports_navigation_target');
    };
    window.addEventListener('beforeunload', clearPersistedSelectionsOnExit);
    window.addEventListener('pagehide', clearPersistedSelectionsOnExit);

    // Helper: snapshot current UI state
    const snapshotReportsUIState = () => {
        const state = {
            selectedGroupKeys,
            startDate: startDateInput.value || '',
            endDate: endDateInput.value || '',
            activitySortOrder,
            studentSortOrder,
            categoryValues: Array.from(activityCategoryFilterSelect.selectedOptions).map(o => o.value),
            selectedActivityIndices: Array.from(getPersistedSelectedActivityIndices()),
            selectedStudentNames: Array.from(studentsList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value)
        };
        sessionStorage.setItem(REPORTS_UI_STATE_KEY, JSON.stringify(state));
    };

    // Apply snapshot if returning from activity
    const restoreReportsUIStateIfAny = () => {
        try {
            const flag = getSessionItem('report_isComingFromActivityPage');
            const raw = sessionStorage.getItem(REPORTS_UI_STATE_KEY);
            if (!flag || !raw) return;
            const st = JSON.parse(raw);
            // restore groups (multiple support)
            Array.from(groupSelect.options).forEach(o => o.selected = (st.selectedGroupKeys || []).includes(o.value));
            selectedGroupKeys = st.selectedGroupKeys || [];
            // restore basics
            startDateInput.value = st.startDate || '';
            endDateInput.value = st.endDate || '';
            studentSortOrder = st.studentSortOrder || 'lastName';
            studentSortSelect.value = studentSortOrder;
            activitySortOrder = st.activitySortOrder || 'date_desc';
            if (activitySortSelect) activitySortSelect.value = activitySortOrder;
            // restore categories (applied after options are rebuilt inside updateActivityAndStudentFilters)
            selectedActivityCategoryFilterValues = st.categoryValues || [];
            // persist activities and students for re-check after render
            sessionStorage.setItem(SELECTED_ACTIVITIES_KEY, JSON.stringify(st.selectedActivityIndices || []));
            setSessionItem('temp_restoredStudentNames', JSON.stringify(st.selectedStudentNames || []));
            updateActivityAndStudentFilters();
        } catch { /* silent */ }
    };

    // Prevent page scroll when selecting an activity (checkbox/label) in the list
    activitiesList.addEventListener('click', (e) => {
        const label = e.target.closest('label');
        if (label) {
            const y = window.scrollY;
            const cb = document.getElementById(label.htmlFor);
            if (cb) {
                e.preventDefault();
                cb.checked = !cb.checked;
                cb.dispatchEvent(new Event('change', { bubbles: true }));
                window.scrollTo(0, y);
            }
        } else if (e.target.matches('input[type="checkbox"]')) {
            const y = window.scrollY;
            // Restore scroll after native checkbox toggle
            setTimeout(() => window.scrollTo(0, y), 0);
        }
    });

    // INITIALIZE PAGE
    renderSavedConfigurationsList();
    loadGroupsDropdown();
    restoreReportsUIStateIfAny();

    // Global actions
    globalHomeButton.addEventListener('click', () => { window.location.href = 'index.html'; });
    globalSaveButton.addEventListener('click', handleSaveBackup);
    globalLoadButton.addEventListener('click', handleLoadBackup);
    globalAgendaButton.addEventListener('click', () => { window.location.href = 'agenda.html'; });
    globalDailyLogButton.addEventListener('click', () => { window.location.href = 'daily_log.html'; });
    goToGroupsButton?.addEventListener('click', () => { window.location.href = 'groups.html'; });
    goToAttendanceButton?.addEventListener('click', () => { window.location.href = 'attendance.html'; });
    goToGradesButton?.addEventListener('click', () => { window.location.href = 'grades.html'; });
    const resetReportButton = document.getElementById('resetReportButton');
    resetReportButton?.addEventListener('click', async () => {
        // Clear group selection
        Array.from(groupSelect.options).forEach(o => o.selected = false);
        selectedGroupKeys = [];
        // Reset filters
        startDateInput.value = '';
        endDateInput.value = '';
        includeAttendanceCheckbox.checked = false;
        // Reset category filter selections
        Array.from(activityCategoryFilterSelect.options).forEach(o => o.selected = false);
        selectedActivityCategoryFilterValues = [];
        // Reset sorters to defaults
        studentSortOrder = 'lastName';
        studentSortSelect.value = 'lastName';
        activitySortOrder = 'date_desc';
        if (activitySortSelect) activitySortSelect.value = 'date_desc';
        // Clear persisted selections/state
        sessionStorage.removeItem(SELECTED_ACTIVITIES_KEY);
        sessionStorage.removeItem(REPORTS_UI_STATE_KEY);
        removeSessionItem('temp_restoredActivityIndices');
        removeSessionItem('temp_restoredStudentNames');
        // Clear manual orders for current group (if any was selected)
        const currentGk = (selectedGroupKeys && selectedGroupKeys[0]) || '';
        removeSessionItem(REPORT_ACTIVITY_MANUAL_ORDER_KEY_PREFIX + currentGk);
        removeSessionItem(REPORT_STUDENT_MANUAL_ORDER_KEY_PREFIX + currentGk);
        // Reset UI lists and messaging
        activitiesList.innerHTML = '';
        studentsList.innerHTML = '';
        reportFiltersSection.style.display = 'none';
        activityCategoryFilterSection.style.display = 'none';
        reportMessage.textContent = 'Selecciona un grupo para empezar.';
        checkGenerateButtonState();
        await modalAlert('Se ha reiniciado el informe actual. Esto no afecta a las configuraciones guardadas.');
    });

    // Groups selection
    const refreshAfterGroupSelection = () => {
        const values = Array.from(groupSelect.selectedOptions).map(o => o.value);
        selectedGroupKeys = values;
        updateActivityAndStudentFilters();
    };

    groupSelect.addEventListener('change', refreshAfterGroupSelection);

    selectAllGroupsBtn.addEventListener('click', () => {
        Array.from(groupSelect.options).forEach(o => o.selected = true);
        refreshAfterGroupSelection();
    });
    deselectAllGroupsBtn.addEventListener('click', () => {
        Array.from(groupSelect.options).forEach(o => o.selected = false);
        refreshAfterGroupSelection();
    });

    // Date filters
    startDateInput.addEventListener('change', () => updateActivityAndStudentFilters());
    endDateInput.addEventListener('change', () => updateActivityAndStudentFilters());

    // Category filters
    activityCategoryFilterSelect.addEventListener('change', () => updateActivityAndStudentFilters());
    selectAllCategoriesBtn.addEventListener('click', () => {
        Array.from(activityCategoryFilterSelect.options).forEach(o => o.selected = true);
        updateActivityAndStudentFilters();
    });
    deselectAllCategoriesBtn.addEventListener('click', () => {
        Array.from(activityCategoryFilterSelect.options).forEach(o => o.selected = false);
        updateActivityAndStudentFilters();
    });

    // Activities select all/none
    selectAllActivitiesBtn.addEventListener('click', () => {
        const boxes = Array.from(activitiesList.querySelectorAll('input[type="checkbox"]'));
        const persisted = getPersistedSelectedActivityIndices();
        boxes.forEach(cb => {
            cb.checked = true;
            const idx = parseInt(cb.value, 10);
            if (!isNaN(idx)) persisted.add(idx);
            cb.dispatchEvent(new Event('change', { bubbles: true }));
        });
        persistSelectedActivityIndices(persisted);
        checkGenerateButtonState();
    });
    deselectAllActivitiesBtn.addEventListener('click', () => {
        const boxes = Array.from(activitiesList.querySelectorAll('input[type="checkbox"]'));
        const persisted = getPersistedSelectedActivityIndices();
        boxes.forEach(cb => {
            cb.checked = false;
            const idx = parseInt(cb.value, 10);
            if (!isNaN(idx)) persisted.delete(idx);
            cb.dispatchEvent(new Event('change', { bubbles: true }));
        });
        persistSelectedActivityIndices(persisted);
        checkGenerateButtonState();
    });

    // Students select all/none
    selectAllStudentsBtn.addEventListener('click', () => {
        Array.from(studentsList.querySelectorAll('input[type="checkbox"]')).forEach(cb => cb.checked = true);
        checkGenerateButtonState();
    });
    deselectAllStudentsBtn.addEventListener('click', () => {
        Array.from(studentsList.querySelectorAll('input[type="checkbox"]')).forEach(cb => cb.checked = false);
        checkGenerateButtonState();
    });

    // Student sort
    studentSortSelect.addEventListener('change', (e) => {
        studentSortOrder = e.target.value || 'lastName';
        updateActivityAndStudentFilters();
    });
    // NEW: If a non-manual student sort is selected, clear any stored manual order for the current group
    studentSortSelect.addEventListener('change', (e) => {
        const val = e.target.value || 'lastName';
        if (val !== 'manual') {
            const manualKey = `${REPORT_STUDENT_MANUAL_ORDER_KEY_PREFIX}${selectedGroupKeys[0] || ''}`;
            removeSessionItem(manualKey);
        }
    });

    // Activity sort (fix: update activitySortOrder and clear manual order when non-manual selected)
    if (activitySortSelect) {
        activitySortSelect.addEventListener('change', (e) => {
            activitySortOrder = e.target.value || 'date_desc';
            if (activitySortOrder !== 'manual') {
                const activityManualKey = `${REPORT_ACTIVITY_MANUAL_ORDER_KEY_PREFIX}${selectedGroupKeys[0] || ''}`;
                removeSessionItem(activityManualKey);
            }
            updateActivityAndStudentFilters();
        });
    }

    // Open activity buttons (event delegation)
    activitiesList.addEventListener('click', (e) => {
        const btn = e.target.closest('.open-activity-button');
        if (!btn) return;
        const groupKey = btn.dataset.groupKey;
        const activityIndex = parseInt(btn.dataset.activityIndex, 10);
        if (!groupKey || isNaN(activityIndex)) return;
        // Save full UI state before navigating
        snapshotReportsUIState();
        sessionStorage.setItem('reports_navigation_target', 'grade_activity');
        setSessionItem('selectedGroupKey', groupKey);
        setSessionItem('selectedActivityIndex', String(activityIndex));
        setSessionItem('report_isComingFromActivityPage', 'true');
        setSessionItem('reportGroupKey', groupKey); // ensure group is restored
        window.location.href = 'grade_activity.html';
    });

    // If we came back from activity page, restore last selected group
    const storedReportGroupKey = getSessionItem('reportGroupKey');
    if (storedReportGroupKey) {
        Array.from(groupSelect.options).forEach(o => { o.selected = (o.value === storedReportGroupKey); });
        refreshAfterGroupSelection();
        removeSessionItem('reportGroupKey');
    }

    // Attach listener to download buttons
    if (downloadActivitiesTxtButton) downloadActivitiesTxtButton.addEventListener('click', async () => {
        const choice = await modalOptions(
            '¿Deseas descargar el informe de actividades o solo previsualizarlo en pantalla?',
            [
                { text: 'Descargar', value: 'download', class: 'primary' },
                { text: 'Previsualizar', value: 'preview' }
            ],
            'Informe de Actividades'
        );
        if (choice === 'download') {
            await generateActivitiesTxt();
        } else if (choice === 'preview') {
            if (selectedGroupKeys.length === 0) {
                await modalAlert('Selecciona al menos un grupo para previsualizar.');
                return;
            }
            const preview = generateActivitiesTxtContent(selectedGroupKeys);
            if (txtReportPreview) txtReportPreview.value = preview;
        }
    });

    if (downloadStudentsTxtButton) downloadStudentsTxtButton.addEventListener('click', async () => {
        const choice = await modalOptions(
            '¿Deseas descargar el informe de alumnos o solo previsualizarlo en pantalla?',
            [
                { text: 'Descargar', value: 'download', class: 'primary' },
                { text: 'Previsualizar', value: 'preview' }
            ],
            'Informe de Alumnos'
        );
        if (choice === 'download') {
            await generateStudentsTxt();
        } else if (choice === 'preview') {
            if (selectedGroupKeys.length === 0) {
                await modalAlert('Selecciona al menos un grupo para previsualizar.');
                return;
            }
            const preview = generateStudentsTxtContent(selectedGroupKeys);
            if (txtReportPreview) txtReportPreview.value = preview;
        }
    });

    // Saved configuration: save current
    if (saveConfigurationButton) {
        saveConfigurationButton.addEventListener('click', async () => {
            const saved = await saveCurrentReportConfiguration();
            if (saved) await modalAlert('Configuración guardada correctamente.');
        });
    }

    // Attach listener to generateReportButton
    if (generateReportButton) generateReportButton.addEventListener('click', async () => {
        // Validate minimal selection for single group:
        // - If attendance is included, allow generating with students selected even if no activities are checked.
        // - Otherwise require at least one activity and at least one student.
        if (selectedGroupKeys.length === 1) {
            const hasAct = activitiesList.querySelector('input[type="checkbox"]:checked');
            const hasStu = studentsList.querySelector('input[type="checkbox"]:checked');
            if (!includeAttendanceCheckbox.checked) {
                if (!hasAct) { await modalAlert('Selecciona al menos una actividad para generar el informe de calificaciones.'); return; }
                if (!hasStu) { await modalAlert('Selecciona al menos un alumno para generar el informe de calificaciones.'); return; }
            } else {
                if (!hasStu) { await modalAlert('Selecciona al menos un alumno para generar el informe (o desactiva \"Incluir asistencia\").'); return; }
            }
        }
        // NEW: show informational modal before generating the Excel report
        const proceed = await modalConfirm('Se va a generar el informe de Excel. ¿Deseas continuar?', 'Generar Informe');
        if (!proceed) return;
        generateGradesXlsx();
    });

    async function generateGradesXlsx() {
        if (selectedGroupKeys.length === 0) { await modalAlert('Selecciona al menos un grupo.'); return; }

        const wb = XLSX.utils.book_new();

        for (const gk of selectedGroupKeys) {
            const group = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === gk);
            if (!group) continue;

            // Determine activity order and which activities to include
            let activityIndices = [];
            if (selectedGroupKeys.length === 1) {
                // Use the order shown in the activitiesList DOM and only include checked ones
                const lis = Array.from(activitiesList.querySelectorAll('li')).filter(li => !li.classList.contains('disabled'));
                lis.forEach(li => {
                    const cb = li.querySelector('input[type="checkbox"]');
                    if (!cb) return;
                    const idx = parseInt(cb.value, 10);
                    if (!isNaN(idx) && cb.checked) activityIndices.push(idx);
                });
            } else {
                // Multiple groups: include all activities for the group ordered by date_desc (most recent first)
                activityIndices = (group.activities || []).map((a, i) => ({ i, d: a.date || '' }))
                    .sort((a,b) => (b.d || '').localeCompare(a.d || ''))
                    .map(x => x.i);
            }

            // Determine students order and selection
            let studentsOrdered = [];
            if (selectedGroupKeys.length === 1) {
                // Use the order shown in the studentsList DOM and only include checked ones
                const lis = Array.from(studentsList.querySelectorAll('li'));
                const selectedNames = new Set(Array.from(studentsList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value));
                lis.forEach(li => {
                    const nameEl = li.querySelector('.item-name');
                    if (!nameEl) return;
                    const name = nameEl.textContent;
                    if (selectedNames.has(name)) {
                        const s = group.students.find(st => st.name === name);
                        if (s) studentsOrdered.push(s);
                    }
                });
            } else {
                // Multiple groups: include all students sorted by lastName
                const withIndex = (group.students || []).map((s, idx) => ({ ...s, originalIndex: idx }));
                studentsOrdered = sortStudents(withIndex, 'lastName');
            }

            // If no activities selected and attendance is included, omit the grade sheet
            if (includeAttendanceCheckbox.checked && activityIndices.length === 0 && selectedGroupKeys.length === 1) {
                // continue to create only the attendance sheet below
            } else {
                // Build sheet data: header row then each student row
                const header = ['Nombre', 'Apellido'];
                activityIndices.forEach(ai => {
                    const act = group.activities[ai];
                    if (act && act.date) {
                        // Format as dd-mmm in Spanish, e.g. "05-ene" (remove any trailing dot from month)
                        const d = new Date(act.date + 'T00:00:00');
                        const dayMonth = d.toLocaleString('es-ES', { day: '2-digit', month: 'short' }).replace('.', '');
                        header.push(`${act.name} (${dayMonth})`);
                    } else {
                        header.push(`${act ? act.name : 'Actividad'}`);
                    }
                });
                // NOTE: omit attendance column from the grade sheets (attendance is exported as separate sheets)

                const rows = [header];

                studentsOrdered.forEach(student => {
                    const { firstName, lastName } = splitFullName(student.name || '');
                    const row = [firstName, lastName];
                    activityIndices.forEach(ai => {
                        const act = group.activities[ai];
                        let cell = '-';
                        if (act && act.grades && typeof student.name === 'string') {
                            const g = act.grades[student.name];
                            const val = g ? (g.grade ?? '') : '';
                            // If grade is empty or only whitespace, treat as not edited -> '-'
                            cell = (val !== null && String(val).trim() !== '') ? val : '-';
                        }
                        row.push(cell);
                    });
                    // Attendance column intentionally omitted from grade sheets.
                    rows.push(row);
                });

                const ws = XLSX.utils.aoa_to_sheet(rows);
                
                // --- NEW: attach observations as hidden comments to grade cells ---
                // rows: 0..N where row 0 = header, row r (r>=1) -> student row
                try {
                    for (let r = 1; r < rows.length; r++) {
                        const studentName = (rows[r][0] || '') + (rows[r][1] ? ' ' + rows[r][1] : '');
                        for (let j = 0; j < activityIndices.length; j++) {
                            const col = 2 + j; // first activity column is 2 (Nombre, Apellido occupy 0,1)
                            const actIdx = activityIndices[j];
                            const act = group.activities[actIdx];
                            if (!act || !act.grades) continue;
                            const gradeEntry = act.grades[studentName];
                            const obs = gradeEntry && gradeEntry.observation ? String(gradeEntry.observation).trim() : '';
                            if (!obs) continue;
                            const cellAddress = XLSX.utils.encode_cell({ c: col, r: r });
                            if (!ws[cellAddress]) {
                                ws[cellAddress] = { t: 's', v: '' };
                            }
                            // Attach comment (array of comment objects)
                            ws[cellAddress].c = ws[cellAddress].c || [];
                            ws[cellAddress].c.push({ t: obs, a: 'Profesor' });
                        }
                    }
                } catch (e) {
                    console.warn('No se pudieron añadir observaciones como comentarios en la hoja de calificaciones:', e);
                }
                // --- end NEW ---

                // --- NEW: convert grade cells to numeric where appropriate and apply decimal formatting ---
                try {
                    const customTypes = getCustomGradingTypes ? getCustomGradingTypes() : [];
                    for (let r = 1; r < rows.length; r++) {
                        const studentName = (rows[r][0] || '') + (rows[r][1] ? ' ' + rows[r][1] : '');
                        for (let j = 0; j < activityIndices.length; j++) {
                            const col = 2 + j;
                            const cellAddr = XLSX.utils.encode_cell({ c: col, r: r });
                            const raw = rows[r][col];
                            if (raw === null || raw === undefined) continue;
                            const rawStr = String(raw).trim();
                            // Treat empty, '-' or 'NP' as non-numeric (leave as text)
                            if (rawStr === '' || rawStr === '-' || rawStr.toUpperCase() === 'NP') {
                                // ensure it's a string cell (replace if XLSX inferred number)
                                if (ws[cellAddr]) ws[cellAddr].t = 's';
                                continue;
                            }
                            // Try to parse as number (accept comma or dot as decimal separator)
                            const normalized = rawStr.replace(',', '.');
                            const num = Number(normalized);
                            if (!Number.isFinite(num)) {
                                if (ws[cellAddr]) ws[cellAddr].t = 's';
                                continue;
                            }
                            // Determine decimal places based on activity type / custom type
                            const actIdx = activityIndices[j];
                            const act = group.activities[actIdx];
                            let decimals = 1; // default for numeric_decimal
                            if (!act) decimals = 1;
                            else if ((act.type || '') === 'numeric_integer') decimals = 0;
                            else if ((act.type || '') === 'numeric_decimal') decimals = 1;
                            else if ((act.type || '').startsWith('custom:')) {
                                const ctId = (act.type || '').substring(7);
                                const ct = customTypes.find(t => t.id === ctId);
                                if (ct && typeof ct.decimals === 'number') decimals = Math.max(0, Math.min(2, ct.decimals));
                                else if (ct && ct.template === 'points_total') decimals = 0;
                                else if (ct && ct.template === 'number_range') decimals = (typeof ct.decimals === 'number') ? Math.max(0, Math.min(2, ct.decimals)) : 1;
                                else decimals = 1;
                            } else {
                                decimals = 1;
                            }
                            // Apply numeric cell with format: 0 / 0.0 / 0.00
                            if (!ws[cellAddr]) ws[cellAddr] = {};
                            ws[cellAddr].t = 'n';
                            ws[cellAddr].v = num;
                            if (decimals === 0) ws[cellAddr].z = '0';
                            else if (decimals === 1) ws[cellAddr].z = '0.0';
                            else ws[cellAddr].z = '0.00';
                        }
                    }
                } catch (e) {
                    console.warn('Error aplicando formato numérico a celdas de calificaciones:', e);
                }
                // --- end NEW ---

                const groupDisplay = `${group.subjectName} ${formatGradeLevelShort(group.gradeLevel)} - ${group.groupLetter}`;
                const sheetName = `Eval. ${groupDisplay}`.substr(0,31); // sheet name limit
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            }

            // If attendance included, build a separate sheet per group with one column per date in the selected range
            if (includeAttendanceCheckbox.checked) {
                try {
                    const attendanceAll = getAttendanceRecords(); // returns map { groupKey: { date: { studentName: {status, justified} } } }
                    // Determine date range to include: prefer explicit start/end inputs, otherwise use group's activity bounds
                    let rangeStart = startDateInput.value;
                    let rangeEnd = endDateInput.value;
                    if (!rangeStart || !rangeEnd) {
                        const bounds = getGroupActivityDateBounds(group);
                        if (bounds) {
                            rangeStart = rangeStart || bounds.min;
                            rangeEnd = rangeEnd || bounds.max;
                        }
                    }
                    // If still no range, skip building attendance sheet for this group
                    if (rangeStart && rangeEnd) {
                        // Build array of dates inclusive between rangeStart and rangeEnd
                        const dates = [];
                        let cur = new Date(rangeStart + 'T00:00:00');
                        const last = new Date(rangeEnd + 'T00:00:00');
                        // Only include dates that are "recorded" for the group (i.e., not all 'N')
                        while (cur <= last) {
                            const y = cur.getFullYear();
                            const m = String(cur.getMonth() + 1).padStart(2,'0');
                            const d = String(cur.getDate()).padStart(2,'0');
                            const dt = `${y}-${m}-${d}`;
                            if (isGroupDateRecorded(gk, dt, allGroups, attendanceAll)) {
                                dates.push(dt);
                            }
                            cur.setDate(cur.getDate() + 1);
                        }
                        // Build attendance sheet header: Alumno, then formatted dates (DD-MM-YY)
                        const attHeader = ['Nombre', 'Apellido', ...dates.map(dt => formatDateForReportFilename(dt))];
                        const attRows = [attHeader];
                        const groupAttendance = attendanceAll[gk] || {};
                        studentsOrdered.forEach(student => {
                            const { firstName, lastName } = splitFullName(student.name || '');
                            const r = [firstName, lastName];
                            dates.forEach(dt => {
                                const recForDate = groupAttendance[dt] && groupAttendance[dt][student.name];
                                if (!recForDate) {
                                    r.push('');
                                } else {
                                    const letter = recForDate.status || '';
                                    const justified = recForDate.justified ? ' (J)' : '';
                                    r.push(letter ? (letter + justified) : '');
                                }
                            });
                            attRows.push(r);
                        });
                        const attWs = XLSX.utils.aoa_to_sheet(attRows);
                        const groupDisplay = `${group.subjectName} ${formatGradeLevelShort(group.gradeLevel)} - ${group.groupLetter}`;
                        const attSheetName = `Asist. ${groupDisplay}`.substr(0,31);
                        XLSX.utils.book_append_sheet(wb, attWs, attSheetName);
                    }
                } catch (e) {
                    // ignore attendance sheet errors to avoid blocking XLSX generation
                    console.warn('Error building attendance sheet', e);
                }
            }
        }

        // Ensure we produce a proper XLSX Blob with the official MIME type so APK/webview wrappers
        // recognize the file as a real Excel workbook.
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const uint8 = wbout instanceof ArrayBuffer ? new Uint8Array(wbout) : new Uint8Array(wbout.buffer || wbout);
        const blob = new Blob([uint8], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        // Build a more descriptive filename: include group(s) and formatted date/time
        const fileGroupPart = selectedGroupKeys.length === 1
            ? (() => { const g = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === selectedGroupKeys[0]); return g ? `${g.subjectName} ${formatGradeLevelShort(g.gradeLevel)} ${g.groupLetter}` : selectedGroupKeys[0]; })()
            : 'varios grupos';
        const filenameBase = `Informe de Evaluación (${fileGroupPart}) - ${formatDateTimeForFilename(new Date())}.xlsx`;
        // Use robust forceDownload helper to improve compatibility with embedded webviews/APK wrappers
        forceDownload(blob, filenameBase);
    }
});