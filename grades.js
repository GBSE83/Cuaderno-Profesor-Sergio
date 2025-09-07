import { getGroups, saveGroups, getSessionItem, setSessionItem, removeSessionItem, getAllAppData, getCustomGradingTypes, saveCustomGradingTypes, getCustomActivityCategories, saveCustomActivityCategories } from './utils/storage.js';
import { formatDate, formatDateTimeForFilename } from './utils/date-utils.js';
import { handleLoadBackup, handleSaveBackup, modalConfirm, modalAlert } from './utils/backup-utils.js'; // NEW: Import backup utility
import {
    renderGroupsDropdown,
    renderActivitiesList,
    resetActivityForm,
    fillActivityFormForEdit,
    showDuplicateSection,
    hideDuplicateSection,
    displayGroupInfo
} from './grades/grades-dom.js';
import {
    handleCreateOrUpdateActivity,
    handleDeleteActivity,
    handleDuplicateActivity,
    handleActivitiesListClick
} from './grades/grades-logic.js';

document.addEventListener('DOMContentLoaded', () => {
    const groupSelect = document.getElementById('groupSelect');
    const groupInfoDisplay = document.getElementById('groupInfoDisplay');
    const activitiesList = document.getElementById('activitiesList');
    const createActivitySection = document.getElementById('createActivitySection');
    const createActivityForm = document.getElementById('createActivityForm');
    const activityNameInput = document.getElementById('activityName');
    const activityDescriptionInput = document.getElementById('activityDescription');
    const activityCategorySelect = document.getElementById('activityCategory'); // NEW
    const activityCategoryOtherInput = document.getElementById('activityCategoryOther'); // NEW
    const activityDateInput = document.getElementById('activityDate');
    const activityTypeSelect = document.getElementById('activityType'); // New element
    const submitActivityButton = document.getElementById('submitActivityButton');
    const cancelEditButton = document.getElementById('cancelEditButton');
    const globalHomeButton = document.getElementById('globalHomeButton'); // New: Global Home Button
    const globalSaveButton = document.getElementById('globalSaveButton'); // NEW
    const globalLoadButton = document.getElementById('globalLoadButton'); // NEW: Global Load Button
    const globalAgendaButton = document.getElementById('globalAgendaButton'); // NEW: Global Agenda Button
    const globalDailyLogButton = document.getElementById('globalDailyLogButton'); // NEW: Global Daily Log Button

    const duplicateActivitySection = document.getElementById('duplicateActivitySection');
    const activityToDuplicateName = document.getElementById('activityToDuplicateName');
    const duplicateTargetGroupSelect = document.getElementById('duplicateTargetGroupSelect');
    const keepGradesCheckbox = document.getElementById('keepGradesCheckbox');
    const confirmDuplicateButton = document.getElementById('confirmDuplicateButton');
    const cancelDuplicateButton = document.getElementById('cancelDuplicateButton');

    // NEW: Filter and Sort elements
    const activitiesControlsContainer = document.getElementById('activitiesControlsContainer');
    const activitySearchInput = document.getElementById('activitySearchInput');
    const startDateFilter = document.getElementById('startDateFilter');
    const endDateFilter = document.getElementById('endDateFilter');
    const clearDateFilterButton = document.getElementById('clearDateFilterButton'); // NEW: Clear date filter button
    const activityCategoryFilter = document.getElementById('activityCategoryFilter'); // NEW: Activity category filter
    const sortSelect = document.getElementById('sortSelect'); // NEW: single selector for four ordering options

    // Custom grading types UI refs
    const customTypeForm = document.getElementById('customTypeForm');
    const customTypeName = document.getElementById('customTypeName');
    const customTypeTemplate = document.getElementById('customTypeTemplate');
    const valueListConfig = document.getElementById('valueListConfig');
    const valueListInput = document.getElementById('valueListInput');
    const rubricConfig = document.getElementById('rubricConfig');
    const addRubricItemButton = document.getElementById('addRubricItemButton');
    const rubricItemsList = document.getElementById('rubricItemsList');
    const rubricTotalWeightEl = document.getElementById('rubricTotalWeight');
    const emojiFacesConfig = document.getElementById('emojiFacesConfig');
    const letterScaleConfig = document.getElementById('letterScaleConfig');
    const letterScalePreset = document.getElementById('letterScalePreset');
    const binaryConfig = document.getElementById('binaryConfig');
    const binaryYes = document.getElementById('binaryYes');
    const binaryNo = document.getElementById('binaryNo');
    const attendance3Config = document.getElementById('attendance3Config');
    const attPresent = document.getElementById('attPresent');
    const attLate = document.getElementById('attLate');
    const attAbsent = document.getElementById('attAbsent');
    const pointsTotalConfig = document.getElementById('pointsTotalConfig');
    const pointsMax = document.getElementById('pointsMax');
    const customTypesList = document.getElementById('customTypesList'); // NEW
    const customActivityCategoriesList = document.getElementById('customActivityCategoriesList'); // NEW
    const cancelCustomTypeEditButton = document.getElementById('cancelCustomTypeEditButton'); // NEW
    const downloadCustomTypesBtn = document.getElementById('downloadCustomTypesBtn'); // NEW
    const uploadCustomTypesFile = document.getElementById('uploadCustomTypesFile'); // NEW
    const mixedConfig = document.getElementById('mixedConfig'); // NEW
    const mixedIconsList = document.getElementById('mixedIconsList'); // NEW
    const mixedMin = document.getElementById('mixedMin'); // NEW
    const mixedMax = document.getElementById('mixedMax'); // NEW
    const mixedDecimals = document.getElementById('mixedDecimals'); // NEW

    // NEW: Number Range config elements
    const numberRangeConfig = document.getElementById('numberRangeConfig');
    const numberRangeMin = document.getElementById('numberRangeMin');
    const numberRangeMax = document.getElementById('numberRangeMax');
    const numberRangeDecimals = document.getElementById('numberRangeDecimals');
    const numberRangeStart = document.getElementById('numberRangeStart'); // NEW
    const numberRangeStep = document.getElementById('numberRangeStep'); // NEW: Step input

    // Get references for dynamic styling
    const pageBody = document.body;
    const pageH1 = document.querySelector('h1'); // Generic h1 for grades.html

    let allGroups = getGroups(); // Load groups initially
    let currentGroupKey = '';
    let currentGroup = null;
    let editingActivityIndex = -1; // -1 means no activity is being edited
    let activityToDuplicate = null; // Stores the activity object being duplicated
    let editingCustomTypeId = null; // NEW: currently edited custom grading type id (null = create mode)

    // NEW: State for filters and sorting
    let filterSearchTerm = '';
    let filterStartDate = '';
    let filterEndDate = '';
    let filterActivityCategory = 'all'; // NEW: Default to show all categories
    // sortMode supports: date_desc, date_asc, created_asc, created_desc
    let sortMode = 'date_desc';

    // Helper to update currentGroup based on currentGroupKey
    const updateCurrentGroup = () => {
        currentGroup = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === currentGroupKey);
    };
    
    // Helper function to apply group color to page H1 and body background
    const applyGroupColorToPage = (group) => {
        if (group && group.color) {
            if (pageBody) pageBody.style.backgroundColor = group.color;
            if (pageH1) {
                const color = group.color;
                pageH1.style.borderBottom = `2px solid ${color}`;
                // compute readable title color depending on lightness (preserve hue)
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
                const rgb = hexToRgb(color);
                const { h, s, l } = rgbToHsl(rgb);
                if (l > 0.78) {
                    const darker = { h, s: Math.min(1, s * 1.05), l: Math.max(0.14, l * 0.28) };
                    pageH1.style.color = hslToHex(darker);
                } else if (l < 0.25) {
                    // Use a lighter variant of the group's color for the H1 text so it keeps the same tonal family
                    const lighter = { h, s: Math.max(0.05, s * 0.9), l: Math.min(0.92, l + 0.6) };
                    pageH1.style.color = hslToHex(lighter);
                } else {
                    pageH1.style.color = color;
                }
                pageH1.style.paddingBottom = '10px';
                pageH1.style.marginBottom = '20px'; // Adjusted from 40px in style.css for border
            }
        } else {
            // Reset to default colors
            if (pageBody) pageBody.style.backgroundColor = '';
            if (pageH1) {
                pageH1.style.color = '';
                pageH1.style.borderBottom = '';
                pageH1.style.paddingBottom = '';
                pageH1.style.marginBottom = '';
            }
        }
    };

    // Helper functions to manage state for `grades-logic.js`
    const setEditingActivityIndex = (index) => { editingActivityIndex = index; };
    const setActivityToDuplicate = (activity) => { activityToDuplicate = activity; };

    // NEW: Function to populate the activity category filter dropdown
    const populateActivityCategoryFilter = () => {
        const categories = new Set();
        // Add predefined categories from the create form, ensuring no "otro"
        Array.from(activityCategorySelect.options).forEach(option => {
            if (option.value !== 'otro') {
                categories.add(option.value);
            }
        });

        if (currentGroup && currentGroup.activities) {
            currentGroup.activities.forEach(activity => {
                if (activity.category) {
                    categories.add(activity.category);
                }
            });
        }

        const sortedCategories = Array.from(categories).sort();

        activityCategoryFilter.innerHTML = '<option value="all">Todas las categorías</option>';
        sortedCategories.forEach(category => {
            const opt = document.createElement('option');
            opt.value = category;
            opt.textContent = category;
            activityCategoryFilter.appendChild(opt);
        });

        // Restore previous selection or default to 'all'
        activityCategoryFilter.value = filterActivityCategory;
    };

    // NEW: Master function to apply filters and sorting, then render
    const updateAndRenderActivities = () => {
        if (!currentGroup || !currentGroup.activities) {
            renderActivitiesList(null, [], activitiesList); // Pass empty array if no activities
            return;
        }

        let processedActivities = [...currentGroup.activities];

        // 1. Filter by search term
        if (filterSearchTerm) {
            const lowerCaseSearchTerm = filterSearchTerm.toLowerCase();
            processedActivities = processedActivities.filter(activity =>
                activity.name.toLowerCase().includes(lowerCaseSearchTerm) ||
                (activity.description && activity.description.toLowerCase().includes(lowerCaseSearchTerm))
            );
        }

        // 2. Filter by date range
        if (filterStartDate) {
            processedActivities = processedActivities.filter(activity => activity.date >= filterStartDate);
        }
        if (filterEndDate) {
            processedActivities = processedActivities.filter(activity => activity.date <= filterEndDate);
        }

        // 3. Filter by activity category
        if (filterActivityCategory !== 'all') {
            processedActivities = processedActivities.filter(activity => activity.category === filterActivityCategory);
        }

        // 4. Sort (support by date or by creation order)
        processedActivities.sort((a, b) => {
            switch (sortMode) {
                case 'date_asc': {
                    return new Date(a.date) - new Date(b.date);
                }
                case 'date_desc': {
                    return new Date(b.date) - new Date(a.date);
                }
                case 'created_asc': {
                    // assume activities array original order is creation order; use original indices
                    const idxA = currentGroup.activities.indexOf(a);
                    const idxB = currentGroup.activities.indexOf(b);
                    return idxA - idxB;
                }
                case 'created_desc': {
                    const idxA = currentGroup.activities.indexOf(a);
                    const idxB = currentGroup.activities.indexOf(b);
                    return idxB - idxA;
                }
                default:
                    return new Date(b.date) - new Date(a.date);
            }
        });

        renderActivitiesList(currentGroup, processedActivities, activitiesList);
    };

    // NEW: populate activity type select with custom grading types
    const populateActivityTypeSelect = () => {
        const builtins = [
            { v: 'numeric_integer', t: 'Numérica (0-10 enteras o NP)' },
            { v: 'qualitative', t: 'Cualitativa (NP, Mal, Regular, Bien, Muy bien)' },
            { v: 'numeric_decimal', t: 'Numérica exacta (0-10, con 2 decimales)' }
        ];
        activityTypeSelect.innerHTML = builtins.map(o => `<option value="${o.v}">${o.t}</option>`).join('');
        const customs = getCustomGradingTypes();
        if (customs.length) {
            const og = document.createElement('optgroup');
            og.label = 'Personalizados';
            customs.forEach(ct => {
                const opt = document.createElement('option');
                opt.value = `custom:${ct.id}`;
                opt.textContent = `Personalizado: ${ct.name}`;
                og.appendChild(opt);
            });
            activityTypeSelect.appendChild(og);
        }
    };

    // NEW: Populate the activityCategory <select> with predefined + stored custom categories
    const populateActivityCategorySelect = () => {
        const predefined = ['Examen', 'Deberes para casa', 'Tarea ordinaria', 'Tarea extra', 'Práctica', 'Proyecto'];
        const customs = getCustomActivityCategories(); // persisted user-created categories
        const previousValue = activityCategorySelect.value;

        // Build options: predefined first, then custom optgroup, then 'otro'
        activityCategorySelect.innerHTML = '';
        predefined.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v; opt.textContent = v;
            activityCategorySelect.appendChild(opt);
        });

        if (customs && customs.length) {
            const og = document.createElement('optgroup');
            og.label = 'Personalizados';
            customs.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                og.appendChild(opt);
            });
            activityCategorySelect.appendChild(og);
        }

        // 'otro' option remains last
        const otherOpt = document.createElement('option');
        otherOpt.value = 'otro';
        otherOpt.textContent = 'Otro (especificar)';
        activityCategorySelect.appendChild(otherOpt);

        // Try to restore previous selection if possible
        if (previousValue) {
            if (Array.from(activityCategorySelect.options).some(o => o.value === previousValue)) {
                activityCategorySelect.value = previousValue;
                activityCategoryOtherInput.style.display = previousValue === 'otro' ? 'block' : 'none';
            } else {
                activityCategorySelect.value = 'otro';
                activityCategoryOtherInput.style.display = 'block';
            }
        }
    };

    // NEW: Render the custom activity categories list with delete and double-click-to-delete
    const renderCustomActivityCategories = () => {
        const list = customActivityCategoriesList;
        const customs = getCustomActivityCategories();
        list.innerHTML = '';
        if (!customs.length) {
            list.innerHTML = '<li class="no-activities-message">Aún no hay tipos personalizados de actividad.</li>';
            return;
        }
        customs.forEach(cat => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '6px 8px';
            li.style.border = '1px solid #e9ecef';
            li.style.marginBottom = '6px';
            li.style.borderRadius = '6px';
            li.innerHTML = `<span class="custom-cat-name">${cat}</span><div><button type="button" class="delete-custom-cat" data-cat="${cat}">Eliminar</button></div>`;
            // Double-click to delete
            li.querySelector('.custom-cat-name').addEventListener('dblclick', async () => { // Made async
                if (!await modalConfirm(`¿Eliminar el tipo personalizado de actividad \"${cat}\"?`)) return; // Used modalConfirm
                const updated = getCustomActivityCategories().filter(c => c !== cat);
                saveCustomActivityCategories(updated);
                populateActivityCategorySelect();
                populateActivityCategoryFilter();
                renderCustomActivityCategories();
            });
            // Delete button
            li.querySelector('button.delete-custom-cat').addEventListener('click', async () => { // Made async
                if (!await modalConfirm(`¿Eliminar el tipo personalizado de actividad \"${cat}\"?`)) return; // Used modalConfirm
                const updated = getCustomActivityCategories().filter(c => c !== cat);
                saveCustomActivityCategories(updated);
                populateActivityCategorySelect();
                populateActivityCategoryFilter();
                renderCustomActivityCategories();
            });
            list.appendChild(li);
        });
    };

    // Define the common logic for when a group is selected/changed
    const handleGroupSelectionUpdate = () => {
        currentGroupKey = groupSelect.value;
        setSessionItem('selectedGroupKey', currentGroupKey); // Ensure session storage is updated
        updateCurrentGroup();
        applyGroupColorToPage(currentGroup); // Apply color
        displayGroupInfo(currentGroup, groupInfoDisplay);
        activitiesControlsContainer.style.display = currentGroup ? 'flex' : 'none'; // Show controls
        populateActivityCategoryFilter(); // Populate the category filter
        updateAndRenderActivities(); // Render with filters
        createActivitySection.style.display = currentGroupKey ? 'block' : 'none';
        resetActivityForm(activityNameInput, activityDescriptionInput, activityDateInput, activityTypeSelect, submitActivityButton, cancelEditButton, formatDate, false, activityCategorySelect, activityCategoryOtherInput); // Updated call with shouldFocus: false
        hideDuplicateSection(duplicateActivitySection, createActivitySection, duplicateTargetGroupSelect, keepGradesCheckbox);
    };

    // Function to initialize/reload the groups dropdown and activities list
    const initializeGradesPage = () => {
        renderGroupsDropdown(
            allGroups,
            getSessionItem('selectedGroupKey'),
            groupSelect,
            groupInfoDisplay,
            activitiesList,
            createActivitySection,
            duplicateActivitySection,
            handleGroupSelectionUpdate // Pass the named function as callback
        );
        // Set initial date for activity form
        activityDateInput.value = formatDate(new Date());

        // Populate activity category select and render custom categories list
        populateActivityCategorySelect();
        renderCustomActivityCategories();
    };

    // Attach explicit change listener for user interactions
    groupSelect.addEventListener('change', handleGroupSelectionUpdate);

    // NEW: Event listener to show/hide the custom activity category input
    activityCategorySelect.addEventListener('change', () => {
        if (activityCategorySelect.value === 'otro') {
            activityCategoryOtherInput.style.display = 'block';
            activityCategoryOtherInput.required = true;
        } else {
            activityCategoryOtherInput.style.display = 'none';
            activityCategoryOtherInput.required = false;
            activityCategoryOtherInput.value = '';
        }
    });

    const showTemplateConfig = () => {
        [valueListConfig, rubricConfig, emojiFacesConfig, letterScaleConfig, binaryConfig, attendance3Config, pointsTotalConfig, numberRangeConfig, mixedConfig]
            .forEach(el => el.style.display = 'none');
        switch (customTypeTemplate.value) {
            case 'value_list': valueListConfig.style.display = 'block'; break;
            case 'rubric': rubricConfig.style.display = 'block'; break;
            case 'emoji_faces': emojiFacesConfig.style.display = 'block'; break;
            case 'letter_scale': letterScaleConfig.style.display = 'block'; break;
            case 'binary': binaryConfig.style.display = 'block'; break;
            case 'attendance3': attendance3Config.style.display = 'block'; break;
            case 'points_total': pointsTotalConfig.style.display = 'block'; break;
            case 'number_range': numberRangeConfig.style.display = 'block'; break;
            case 'mixed': mixedConfig.style.display = 'block'; break; // NEW: mixed template
        }
    };
    customTypeTemplate.addEventListener('change', showTemplateConfig);
    showTemplateConfig();
    const updateRubricTotal = () => {
        const weights = Array.from(rubricItemsList.querySelectorAll('input[data-role="weight"]'))
            .map(i => parseInt(i.value || '0', 10));
        const total = weights.reduce((a, b) => a + b, 0);
        rubricTotalWeightEl.textContent = String(total);
    };
    const addRubricItem = (title = 'Nuevo ítem', description = '', weight = 0) => { // MODIFIED: Added description
        const li = document.createElement('li');
        li.classList.add('rubric-item-row'); // NEW: Add class for styling
        li.innerHTML = `
            <div class="rubric-inputs-wrapper">
                <input type="text" data-role="title" placeholder="Título del ítem" value="${title}">
                <textarea data-role="desc" placeholder="Descripción (opcional)" rows="1">${description}</textarea>
            </div>
            <div class="rubric-weight-controls">
                <input type="number" data-role="weight" min="0" max="100" step="1" value="${weight}" title="Peso (%)">
                <button type="button" class="remove-item-rubric" title="Eliminar ítem">✖</button>
            </div>
        `;
        rubricItemsList.appendChild(li);
        li.querySelector('.remove-item-rubric').addEventListener('click', () => { li.remove(); updateRubricTotal(); }); // MODIFIED class
        li.querySelector('input[data-role="weight"]').addEventListener('input', updateRubricTotal);
        updateRubricTotal();
    };
    addRubricItemButton.addEventListener('click', () => addRubricItem());
    const renderCustomTypes = () => {
        const types = getCustomGradingTypes();
        customTypesList.innerHTML = '';
        if (!types.length) {
            customTypesList.innerHTML = '<li class="no-activities-message">Aún no hay tipos personalizados.</li>';
            return;
        }
        types.forEach(t => {
            const li = document.createElement('li');
            li.style.display = 'grid';
            li.style.gridTemplateColumns = '1fr auto';
            li.style.alignItems = 'center';
            li.style.border = '1px solid #e9ecef';
            li.style.borderRadius = '8px';
            li.style.padding = '10px 12px';
            li.style.marginBottom = '8px';
            const summary = (() => {
                switch (t.template) {
                    case 'value_list': return `Valores: ${t.values.join(', ')}`;
                    case 'rubric': return `${t.items.length} ítems, peso total ${t.items.reduce((a, b) => a + b.weight, 0)}%`;
                    case 'emoji_faces': return `Caritas (${t.presetCount})`;
                    case 'letter_scale': return `Escala: ${t.scale.join(', ')}`;
                    case 'binary': return `Binaria: ${t.yesLabel}/${t.noLabel}`;
                    case 'attendance3': return `Asistencia: ${t.present}/${t.late}/${t.absent}`;
                    case 'points_total': return `0 a ${t.maxPoints} puntos`;
                    case 'number_range': return `De ${t.min} a ${t.max}, ${t.decimals} decimales` + (t.start !== undefined && t.start !== null ? `, inicio ${t.start}` : '');
                    case 'mixed': return `Mixta: iconos(${(t.icons||[]).join(', ')}), número ${t.min}-${t.max}`;
                    default: return '';
                }
            })();
            li.innerHTML = `
                <div>
                    <div style="font-weight:600;">${t.name}</div>
                    <div style="color:#6c757d; font-size:0.9em;">${summary}</div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="custom-options-button" data-id="${t.id}" data-name="${encodeURIComponent(t.name)}">Opciones ▾</button>
                </div>
            `;
            // Add unified Options button behavior
            const optsBtn = li.querySelector('.custom-options-button');
            optsBtn.addEventListener('click', () => {
                const modal = document.createElement('div');
                modal.className = 'activity-options-modal';
                modal.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true">
                    <div style="display:flex;flex-direction:column;gap:8px;padding:6px;">
                        <button class="opt-edit">Editar</button>
                        <button class="opt-duplicate">Duplicar</button>
                        <button class="opt-download">Descargar</button>
                        <button class="opt-delete">Eliminar</button>
                        <button class="opt-cancel">Cancelar</button>
                    </div>
                </div>`;
                document.body.appendChild(modal);
                modal.querySelector('.opt-edit').addEventListener('click', async () => {
                    // reuse existing edit logic
                    editingCustomTypeId = t.id;
                    customTypeName.value = t.name;
                    customTypeTemplate.value = t.template;
                    showTemplateConfig();
                    // populate template fields (same as previous logic)
                    if (t.template === 'value_list') valueListInput.value = (t.values || []).join(', ');
                    if (t.template === 'rubric') { rubricItemsList.innerHTML = ''; (t.items || []).forEach(it => addRubricItem(it.title, it.description, it.weight)); }
                    if (t.template === 'number_range') { numberRangeMin.value = t.min || 0; numberRangeMax.value = t.max || 10; numberRangeDecimals.value = t.decimals || 0; numberRangeStart.value = t.start || ''; numberRangeStep.value = t.step || 1; }
                    if (t.template === 'mixed') { mixedIconsList.value = (t.icons || []).join(', '); mixedMin.value = t.min || 0; mixedMax.value = t.max || 10; mixedDecimals.value = t.decimals || 0; }
                    customTypeForm.querySelector('button[type="submit"]').textContent = 'Actualizar tipo';
                    if (cancelCustomTypeEditButton) cancelCustomTypeEditButton.style.display = 'inline-block';
                    modal.remove();
                });
                modal.querySelector('.opt-duplicate').addEventListener('click', async () => {
                    const current = getCustomGradingTypes();
                    const base = JSON.parse(JSON.stringify(t)); base.id = `ct_${Date.now()}`;
                    let newName = `${t.name} (Copia)`;
                    let suffix = 1;
                    while (current.some(x => x.name.toLowerCase() === newName.toLowerCase())) { suffix++; newName = `${t.name} (Copia ${suffix})`; }
                    base.name = newName; current.push(base); saveCustomGradingTypes(current); renderCustomTypes(); populateActivityTypeSelect(); modal.remove(); await modalAlert(`Tipo duplicado como "${base.name}".`);
                });
                modal.querySelector('.opt-download').addEventListener('click', async () => {
                    const confirmDownload = await modalConfirm(`¿Descargar el tipo "${t.name}" como archivo?`);
                    if (!confirmDownload) return;
                    const payload = JSON.stringify(t, null, 2);
                    const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `${t.name.replace(/[^a-z0-9_\- ]/gi,'_')}.txt`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                    await modalAlert('Descargado.'); modal.remove();
                });
                modal.querySelector('.opt-delete').addEventListener('click', async () => {
                    if (!await modalConfirm(`¿Eliminar el tipo "${t.name}"?`)) return;
                    const updated = getCustomGradingTypes().filter(x => x.id !== t.id); saveCustomGradingTypes(updated);
                    populateActivityTypeSelect(); renderCustomTypes(); populateActivityCategorySelect(); renderCustomActivityCategories(); modal.remove();
                });
                modal.querySelector('.opt-cancel').addEventListener('click', () => modal.remove());
                modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.remove(); });
            });
            customTypesList.appendChild(li);
        });
    };
    renderCustomTypes();

    // Ensure newly created/updated custom grading types are persisted and UI refreshed
    customTypeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = customTypeName.value.trim();
        const template = customTypeTemplate.value;
        if (!name) { await modalAlert('El nombre del tipo personalizado no puede estar vacío.'); return; }

        // Build minimal type object (detailed validation omitted for brevity)
        const newType = { id: editingCustomTypeId || `ct_${Date.now()}`, name, template };

        // Populate template-specific fields (handle a few common templates)
        if (template === 'value_list') newType.values = (valueListInput.value || '').split(',').map(s => s.trim()).filter(Boolean);
        if (template === 'rubric') newType.items = Array.from(rubricItemsList.querySelectorAll('li')).map(li => ({
            title: li.querySelector('input[data-role="title"]').value || '',
            description: li.querySelector('textarea[data-role="desc"]').value || '',
            weight: parseInt(li.querySelector('input[data-role="weight"]').value || '0', 10)
        }));
        if (template === 'number_range') {
            newType.min = parseFloat(numberRangeMin.value || '0');
            newType.max = parseFloat(numberRangeMax.value || '10');
            newType.decimals = parseInt(numberRangeDecimals.value || '0', 10);
            if (numberRangeStart && numberRangeStart.value) newType.start = numberRangeStart.value;
            newType.step = parseFloat(numberRangeStep.value || '1');
        }
        if (template === 'mixed') {
            newType.icons = (mixedIconsList.value || '').split(',').map(s => s.trim()).filter(Boolean);
            newType.min = parseFloat(mixedMin.value || '0');
            newType.max = parseFloat(mixedMax.value || '10');
            newType.decimals = parseInt(mixedDecimals.value || '0', 10);
        }

        // Merge into storage (create or update)
        const existing = getCustomGradingTypes();
        if (editingCustomTypeId) {
            const idx = existing.findIndex(t => t.id === editingCustomTypeId);
            if (idx !== -1) existing[idx] = { ...existing[idx], ...newType };
            else existing.push(newType);
            editingCustomTypeId = null;
        } else {
            existing.push(newType);
        }
        saveCustomGradingTypes(existing);

        // Refresh UI and reset form
        populateActivityTypeSelect();
        renderCustomTypes();
        populateActivityCategorySelect();
        renderCustomActivityCategories();
        customTypeForm.reset();
        if (cancelCustomTypeEditButton) cancelCustomTypeEditButton.style.display = 'none';
        await modalAlert(`Tipo personalizado \"${name}\" guardado correctamente.`);
    });

    // NEW: Export custom grading types as .txt (JSON) file
    downloadCustomTypesBtn?.addEventListener('click', async () => {
        const types = getCustomGradingTypes();
        if (!types || types.length === 0) {
            await modalAlert('No hay tipos personalizados para descargar.');
            return;
        }

        // NEW: Add confirmation message before downloading all types
        const confirmDownload = await modalConfirm(`Se descargará un archivo de texto con TODOS los tipos de calificación personalizados.\n\nPara descargar tipos individualmente, usa el botón "Descargar" junto a cada tipo.\n\n¿Deseas continuar con la descarga de todos los tipos?`, 'Descargar todos los tipos personalizados');
        
        if (!confirmDownload) {
            return; // User cancelled download
        }

        const content = JSON.stringify(types, null, 2);
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const nameSafe = `custom_types_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.txt`;
        a.download = nameSafe;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        await modalAlert('Tipos personalizados descargados como archivo .txt');
    });

    // NEW: Import custom grading types from a .txt/.json file (expects JSON object or array)
    uploadCustomTypesFile?.addEventListener('change', async (e) => { // Made the event listener async
        const file = e.target.files[0];
        if (!file) return;

        // NEW: Show confirmation modal before proceeding
        const confirmUpload = await modalConfirm(
            'Se va a cargar un archivo de tipos de calificación personalizados. ' +
            'Los tipos se añadirán individualmente y NO se borrarán los existentes. ' +
            'Si un tipo con el mismo nombre ya existe, se ignorará. ' +
            '¿Deseas continuar con la carga?',
            'Cargar tipos personalizados'
        );

        if (!confirmUpload) {
            uploadCustomTypesFile.value = ''; // Clear the file input if cancelled
            return;
        }

        if (file.type && !file.type.startsWith('text') && file.type !== 'application/json') {
            modalAlert('Solo se permiten archivos de texto (.txt) o JSON (.json).');
            uploadCustomTypesFile.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const text = ev.target.result.trim();
                if (!text) { await modalAlert('Archivo vacío.'); uploadCustomTypesFile.value = ''; return; }
                const parsed = JSON.parse(text);
                let incoming = [];
                if (Array.isArray(parsed)) incoming = parsed;
                else if (typeof parsed === 'object') incoming = [parsed];
                else { await modalAlert('Formato de archivo no válido. Debe contener JSON con un objeto o un array de objetos.'); uploadCustomTypesFile.value = ''; return; }

                // Validate minimal shape (id optional — we'll assign if missing)
                const valid = incoming.every(it => it && typeof it.name === 'string' && typeof it.template === 'string');
                if (!valid) { await modalAlert('Cada tipo debe ser un objeto con al menos "name" y "template".'); uploadCustomTypesFile.value = ''; return; }

                // Merge: keep existing, add non-duplicate names (case-insensitive), assign ids if missing
                const existing = getCustomGradingTypes();
                const existingNames = new Set(existing.map(x => x.name.toLowerCase()));
                let added = 0;
                incoming.forEach(it => {
                    if (!existingNames.has(it.name.toLowerCase())) {
                        const newItem = JSON.parse(JSON.stringify(it));
                        if (!newItem.id) newItem.id = `ct_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
                        existing.push(newItem);
                        existingNames.add(newItem.name.toLowerCase());
                        added++;
                    }
                });
                if (added === 0) {
                    await modalAlert('No se añadieron tipos: los nombres ya existen en los tipos personalizados.');
                } else {
                    saveCustomGradingTypes(existing);
                    populateActivityTypeSelect();
                    renderCustomTypes();
                    await modalAlert(`${added} tipo(s) personalizado(s) importado(s) correctamente.`);
                }
            } catch (err) {
                console.error(err);
                await modalAlert('Error al leer o parsear el archivo. Asegúrate de que sea JSON válido.');
            } finally {
                uploadCustomTypesFile.value = '';
            }
        };
        reader.onerror = async () => { await modalAlert('Error leyendo el archivo.'); uploadCustomTypesFile.value = ''; };
        reader.readAsText(file);
    });

    // Handle cancel edit button click
    cancelEditButton.addEventListener('click', () => {
        resetActivityForm(activityNameInput, activityDescriptionInput, activityDateInput, activityTypeSelect, submitActivityButton, cancelEditButton, formatDate, false, activityCategorySelect, activityCategoryOtherInput); // Set shouldFocus to false
        setEditingActivityIndex(-1); // Reset editing index
    });

    // NEW: Handle cancel custom type edit button click
    if (cancelCustomTypeEditButton) {
        cancelCustomTypeEditButton.addEventListener('click', () => {
            editingCustomTypeId = null; // Exit edit mode
            customTypeName.value = ''; // Clear name
            customTypeTemplate.value = 'value_list'; // Reset template to default
            showTemplateConfig(); // Hide specific template configs

            // Clear all template-specific fields
            valueListInput.value = '';
            rubricItemsList.innerHTML = '';
            updateRubricTotal(); // Reset total
            emojiPreset.value = '3';
            letterScalePreset.value = 'A-F';
            binaryYes.value = 'Sí';
            binaryNo.value = 'No';
            attPresent.value = 'Presente';
            attLate.value = 'Tarde';
            attAbsent.value = 'Ausente';
            pointsMax.value = '10';
            numberRangeMin.value = '0';
            numberRangeMax.value = '10';
            numberRangeDecimals.value = '2';
            numberRangeStart.value = '';
            numberRangeStep.value = '1';
            mixedIconsList.value = '';
            mixedMin.value = '0';
            mixedMax.value = '10';
            mixedDecimals.value = '0';

            customTypeForm.querySelector('button[type="submit"]').textContent = 'Guardar tipo'; // Revert button text
            cancelCustomTypeEditButton.style.display = 'none'; // Hide cancel button
            modalAlert('Edición de tipo personalizado cancelada. El formulario ha sido vaciado.');
        });
    }

    // Event delegation for activity items and their controls
    activitiesList.addEventListener('click', (event) => {
        const optBtn = event.target.closest('.options-button');
        if (optBtn) {
            const listItem = optBtn.closest('li.activity-item-clickable');
            if (!listItem) return;
            const editBtn = listItem.querySelector('.edit-button');
            const deleteBtn = listItem.querySelector('.delete-activity-button');
            const dupBtn = listItem.querySelector('.duplicate-activity-button');

            // Build modal
            const modal = document.createElement('div');
            modal.className = 'activity-options-modal';
            modal.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true">
                <button class="opt-edit">Editar</button>
                <button class="opt-delete">Eliminar</button>
                <button class="opt-duplicate">Duplicar</button>
                <div style="margin:8px 0;border-top:1px solid #eee;padding-top:8px; display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="opt-mark" data-mark="tick-green">✅</button>
                    <button class="opt-mark" data-mark="triangle-yellow">⚠️</button>
                    <button class="opt-mark" data-mark="x-red">❌</button>
                    <button class="opt-mark" data-mark="none">🚫</button>
                </div>
                <button class="opt-cancel">Cancelar</button>
            </div>`;
            document.body.appendChild(modal);

            // Wire mark buttons to trigger inline mark behavior (reuse existing mark buttons in the list item)
            Array.from(modal.querySelectorAll('.opt-mark')).forEach(mbtn => {
                mbtn.addEventListener('click', () => {
                    const mark = mbtn.dataset.mark;
                    // simulate clicking the corresponding inline mark-button inside the list item if present, otherwise call handler directly
                    const inlineMarkBtn = listItem.querySelector(`.mark-button[data-mark="${mark}"]`);
                    if (inlineMarkBtn) inlineMarkBtn.click();
                    else {
                        // fallback: dispatch custom event to let other handlers perform mark logic
                        listItem.dispatchEvent(new CustomEvent('activity-mark', { detail: { mark }, bubbles: true }));
                    }
                    modal.remove();
                });
            });

            // Wire actions to trigger underlying hidden controls (or fallback to click simulation)
            modal.querySelector('.opt-edit').addEventListener('click', () => {
                if (editBtn) editBtn.click(); else listItem.querySelector('.edit-button')?.click();
                modal.remove();
            });
            modal.querySelector('.opt-delete').addEventListener('click', async () => {
                if (deleteBtn) deleteBtn.click(); else listItem.querySelector('.delete-activity-button')?.click();
                modal.remove();
            });
            modal.querySelector('.opt-duplicate').addEventListener('click', () => {
                if (dupBtn) dupBtn.click(); else listItem.querySelector('.duplicate-activity-button')?.click();
                modal.remove();
            });
            modal.querySelector('.opt-cancel').addEventListener('click', () => modal.remove());

            // Close modal when clicking outside
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
            return;
        }
        handleActivitiesListClick(
            event,
            currentGroupKey,
            currentGroup,
            activitiesList,
            { setItem: setSessionItem, removeItem: removeSessionItem }, // sessionStorage-like object
            activityNameInput,
            activityDescriptionInput,
            activityDateInput,
            activityTypeSelect, // New argument
            submitActivityButton,
            cancelEditButton,
            createActivitySection,
            duplicateActivitySection,
            activityToDuplicateName,
            duplicateTargetGroupSelect,
            allGroups,
            () => { // saveAllGroups callback
                saveGroups(allGroups);
            },
            () => { // loadActivitiesForGroup callback
                populateActivityCategoryFilter(); // NEW: Update category filter after activity change
                updateAndRenderActivities();
            },
            () => { // resetActivityForm callback
                resetActivityForm(activityNameInput, activityDescriptionInput, activityDateInput, activityTypeSelect, submitActivityButton, cancelEditButton, formatDate, true, activityCategorySelect, activityCategoryOtherInput); // Updated call
                setEditingActivityIndex(-1); // Reset editing index
            },
            setEditingActivityIndex, // state setter/getter wrapper
            setActivityToDuplicate,  // state setter for duplication
            fillActivityFormForEdit, // DOM helper to fill form when editing
            showDuplicateSection,    // DOM helper to show duplicate UI
            hideDuplicateSection,    // DOM helper to hide duplicate UI
            activityCategorySelect,  // pass category select for possible resets
            activityCategoryOtherInput // pass other input as well
        );
    });

    // ensure external mark clicks can be handled when modal triggers a custom event fallback
    activitiesList.addEventListener('activity-mark', (ev) => {
        const li = ev.target.closest('li.activity-item-clickable');
        if (!li) return;
        const mark = ev.detail.mark;
        const markBtn = li.querySelector(`.mark-button[data-mark="${mark}"]`);
        if (markBtn) markBtn.click();
    });

    // Handle confirming duplication
    confirmDuplicateButton.addEventListener('click', () => {
        const targetGroupKey = duplicateTargetGroupSelect.value;
        const shouldKeepGrades = keepGradesCheckbox.checked;

        handleDuplicateActivity(
            activityToDuplicate,
            targetGroupKey,
            shouldKeepGrades,
            allGroups,
            currentGroupKey,
            () => { saveGroups(allGroups); }, // saveAllGroups callback
            () => { hideDuplicateSection(duplicateActivitySection, createActivitySection, duplicateTargetGroupSelect, keepGradesCheckbox); }, // hideDuplicateSection callback
            () => { updateAndRenderActivities(); } // loadActivitiesForGroup callback
        );
        setActivityToDuplicate(null); // Clear duplicated activity context
    });

    // Handle cancel duplication button click
    cancelDuplicateButton.addEventListener('click', () => {
        hideDuplicateSection(duplicateActivitySection, createActivitySection, duplicateTargetGroupSelect, keepGradesCheckbox);
        setActivityToDuplicate(null); // Clear duplicated activity context
    });

    // NEW: Event Listeners for Sorting and Filtering
    activitySearchInput.addEventListener('input', (e) => {
        filterSearchTerm = e.target.value;
        updateAndRenderActivities();
    });

    startDateFilter.addEventListener('change', (e) => {
        filterStartDate = e.target.value;
        updateAndRenderActivities();
    });

    endDateFilter.addEventListener('change', (e) => {
        filterEndDate = e.target.value;
        updateAndRenderActivities();
    });

    clearDateFilterButton.addEventListener('click', () => { // NEW: Clear date filter button listener
        startDateFilter.value = '';
        endDateFilter.value = '';
        filterStartDate = '';
        filterEndDate = '';
        updateAndRenderActivities();
    });

    activityCategoryFilter.addEventListener('change', (e) => { // NEW: Activity category filter listener
        filterActivityCategory = e.target.value;
        updateAndRenderActivities();
    });

    // NEW: single selector for four ordering options
    if (sortSelect) {
        // initialize select value from variable
        sortSelect.value = sortMode;
        sortSelect.addEventListener('change', (e) => {
            sortMode = e.target.value;
            updateAndRenderActivities();
        });
    }

    // NEW: Handle "Nueva Actividad" shortcut button click
    goToCreateActivityButton.addEventListener('click', () => {
        createActivitySection.scrollIntoView({ behavior: 'smooth' });
        activityNameInput.focus(); // Focus the input when the user explicitly clicks the button
    });

    // New: Handle global home button click
    globalHomeButton.addEventListener('click', () => {
        removeSessionItem('selectedGroupKey'); // Clear selected group when going back to home
        removeSessionItem('selectedActivityIndex'); // Also clear activity index
        window.location.href = 'index.html';
    });

    // NEW: Handle global save button click
    globalSaveButton.addEventListener('click', handleSaveBackup);

    // NEW: Handle global load button click
    globalLoadButton.addEventListener('click', handleLoadBackup);

    // NEW: Handle global Agenda button click
    globalAgendaButton.addEventListener('click', () => {
        window.location.href = 'agenda.html';
    });

    // NEW: Handle global Daily Log button click
    globalDailyLogButton.addEventListener('click', () => {
        window.location.href = 'daily_log.html';
    });

    // Initial load
    initializeGradesPage();
    populateActivityTypeSelect(); // NEW

    // NEW: Ensure create activity form actually uses the shared handler and refreshes UI
    createActivityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const categoryValue = (activityCategorySelect.value === 'otro') ? (activityCategoryOtherInput.value.trim() || 'Otro') : activityCategorySelect.value;
        await handleCreateOrUpdateActivity(
            e,
            currentGroup,
            editingActivityIndex,
            activityNameInput,
            activityDescriptionInput,
            activityDateInput,
            activityTypeSelect,
            categoryValue,
            () => { saveGroups(allGroups); allGroups = getGroups(); updateCurrentGroup(); updateAndRenderActivities(); }, // saveAllGroups
            () => { updateAndRenderActivities(); }, // loadActivitiesForGroup
            () => { resetActivityForm(activityNameInput, activityDescriptionInput, activityDateInput, activityTypeSelect, submitActivityButton, cancelEditButton, formatDate, true, activityCategorySelect, activityCategoryOtherInput); } // resetActivityForm
        );
    });
});