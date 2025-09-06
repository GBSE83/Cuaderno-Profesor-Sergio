import { formatDateTimeForFilename, formatDate, getStartOfWeek, getEndOfWeek, formatDateDayMonthYear, addDays, formatDateShort, formatGradeLevelShort } from './utils/date-utils.js';
import { getAllAppData, getGroups, removeSessionItem, getAgendaTasks, saveAgendaTasks, getAgendaMeetings, saveAgendaMeetings, getAgendaNotes, saveAgendaNotes, setSessionItem, getHighlightedAgendaItems, saveHighlightedAgendaItems } from './utils/storage.js';
import { handleLoadBackup, handleSaveBackup, modalConfirm, modalAlert } from './utils/backup-utils.js';
import { getCustomGradingTypes } from './utils/storage.js';
import { getCustomHighlightedDateTypes, saveCustomHighlightedDateTypes } from './utils/storage.js';

document.addEventListener('DOMContentLoaded', () => {
    const globalHomeButton = document.getElementById('globalHomeButton');
    const globalSaveButton = document.getElementById('globalSaveButton');
    const globalLoadButton = document.getElementById('globalLoadButton');
    const globalDailyLogButton = document.getElementById('globalDailyLogButton'); // NEW: Global Daily Log Button

    const prevWeekButton = document.getElementById('prevWeekButton');
    const nextWeekButton = document.getElementById('nextWeekButton');
    const weekDisplay = document.getElementById('weekDisplay');
    const currentWeekButton = document.getElementById('currentWeekButton'); // NEW: Current Week button
    const datePicker = document.getElementById('datePicker'); // NEW: Date picker
    const calendarGrid = document.getElementById('calendarGrid');

    // NEW: Hide Weekend Checkbox
    const hideWeekendCheckbox = document.getElementById('hideWeekendCheckbox'); // Get element reference

    // NEW: Planning Mode Checkbox
    const planningModeCheckbox = document.getElementById('planningModeCheckbox'); // Get element reference

    // NEW: Planning Mode Days Count Selector
    const planningDaysSelect = document.getElementById('planningDaysSelect'); // Get element reference
    const planningDaysCountGroup = document.querySelector('.planning-days-count-group'); // Get container

    // NEW: Calendar filter elements
    const calendarFilterType = document.getElementById('calendarFilterType');
    const calendarGroupFilterContainer = document.getElementById('calendarGroupFilterContainer');
    const calendarFilterGroup = document.getElementById('calendarFilterGroup');
    const calendarFilterHighlight = document.getElementById('calendarFilterHighlight');

    const taskInput = document.getElementById('taskInput');
    const taskDescriptionInput = document.getElementById('taskDescriptionInput'); // NEW
    const taskDateInput = document.getElementById('taskDateInput'); // NEW
    const taskTimeInput = document.getElementById('taskTimeInput'); // NEW: Task Time Input
    const addTaskButton = document.getElementById('addTaskButton');

    const meetingNameInput = document.getElementById('meetingNameInput');
    const meetingDateInput = document.getElementById('meetingDateInput');
    const meetingTimeInput = document.getElementById('meetingTimeInput');
    const meetingDescriptionInput = document.getElementById('meetingDescriptionInput'); // NEW
    const addMeetingButton = document.getElementById('addMeetingButton');

    const noteInput = document.getElementById('noteInput');
    const noteMoreInfoInput = document.getElementById('noteMoreInfoInput'); // NEW: More info for notes
    const noteColorOptions = document.querySelectorAll('input[name="noteColor"]'); // NEW: Color options for new notes
    const noteColorPicker = document.getElementById('noteColorPicker');
    const addNoteButton = document.getElementById('addNoteButton');
    const notesList = document.getElementById('notesList');
    let notePickerUsed = false; // flag when user used the custom color picker

    // NEW: Edit Task Modal elements
    const editTaskModal = document.getElementById('editTaskModal');
    const closeEditTaskModal = document.getElementById('closeEditTaskModal');
    const modalTaskName = document.getElementById('modalTaskName'); // optional element (may be absent in DOM)
    const modalTaskEditText = document.getElementById('modalTaskEditText');
    const modalTaskEditDescription = document.getElementById('modalTaskEditDescription');
    const modalTaskEditDate = document.getElementById('modalTaskEditDate');
    const modalTaskEditTime = document.getElementById('modalTaskEditTime'); // NEW: Modal Task Time
    const saveTaskEditButton = document.getElementById('saveTaskEditButton');
    const deleteTaskButtonModal = document.getElementById('deleteTaskButtonModal'); // NEW: Delete button for task modal

    // NEW: Edit Meeting Modal elements
    const editMeetingModal = document.getElementById('editMeetingModal');
    const closeEditMeetingModal = document.getElementById('closeEditMeetingModal');
    const modalMeetingName = document.getElementById('modalMeetingName');
    const modalMeetingEditName = document.getElementById('modalMeetingEditName');
    const modalMeetingEditDate = document.getElementById('modalMeetingEditDate');
    const modalMeetingEditTime = document.getElementById('modalMeetingEditTime');
    const modalMeetingEditDescription = document.getElementById('modalMeetingEditDescription');
    const saveMeetingEditButton = document.getElementById('saveMeetingEditButton');
    const deleteMeetingButtonModal = document.getElementById('deleteMeetingButtonModal'); // NEW: Delete button for meeting modal

    // NEW: Edit Note Modal elements
    const editNoteModal = document.getElementById('editNoteModal');
    const closeEditNoteModal = document.getElementById('closeEditNoteModal');
    const modalNoteEditText = document.getElementById('modalNoteEditText');
    const modalNoteEditMoreInfo = document.getElementById('modalNoteEditMoreInfo');
    const modalNoteEditColorRadios = document.querySelectorAll('input[name="modalNoteEditColor"]');
    const modalCustomColor = document.getElementById('modalCustomColor');
    let modalCustomUsed = false; // track when custom color input used

    // Initialize modal custom color visibility and value
    if (modalCustomColor) {
        // hide/show based on radio selection (if custom selected show input)
        const initModalRadio = document.querySelector('input[name="modalNoteEditColor"]:checked') || document.querySelector('input[name="modalNoteEditColor"]');
        if (initModalRadio && initModalRadio.value === 'custom') {
            modalCustomColor.style.display = 'inline-block';
        } else if (modalCustomColor) {
            modalCustomColor.style.display = 'none';
        }

        modalCustomColor.addEventListener('input', () => {
            const customRadio = document.getElementById('modal-color-custom');
            if (customRadio) customRadio.checked = true;
            modalCustomColor.style.display = 'inline-block';
            modalCustomUsed = true;
        });
    }

    // When modal radios change, toggle custom input visibility
    modalNoteEditColorRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (modalCustomColor) {
                if (e.target.value === 'custom' && e.target.checked) {
                    modalCustomColor.style.display = 'inline-block';
                } else {
                    modalCustomColor.style.display = 'none';
                }
            }
            // reset custom-used flag if choosing a palette
            if (e.target.value !== 'custom') modalCustomUsed = false;
        });
    });

    const saveNoteEditButton = document.getElementById('saveNoteEditButton');
    const deleteNoteButtonModal = document.getElementById('deleteNoteButtonModal');

    // NEW: Activity Details Modal elements
    const activityDetailsModal = document.getElementById('activityDetailsModal');
    const closeActivityDetailsModal = document.getElementById('closeActivityDetailsModal');
    const modalActivityNameDisplay = document.getElementById('modalActivityNameDisplay');
    const modalGroupDisplayInfo = document.getElementById('modalGroupDisplayInfo');
    const modalActivityDateDisplay = document.getElementById('modalActivityDateDisplay');
    const modalActivityCategoryDisplay = document.getElementById('modalActivityCategoryDisplay');
    const modalActivityGradingTypeDisplay = document.getElementById('modalActivityGradingTypeDisplay');
    const modalActivityDescriptionDisplay = document.getElementById('modalActivityDescriptionDisplay');
    const goToActivityPageButton = document.getElementById('goToActivityPageButton');

    // NEW: Highlighted items list
    const highlightedItemsList = document.getElementById('highlightedItemsList');

    // NEW: Highlighted dates state and UI handlers
    let highlightedDates = JSON.parse(localStorage.getItem('highlightedDates') || '[]'); // [{id,title,dates:[yyyy-mm-dd],desc,color}]
    let editingHighlightedId = null;

    // NEW: Highlighted date icons state (basic shapes + custom icons)
    let highlightedDateIcons = JSON.parse(localStorage.getItem('highlightedDateIcons') || '[]'); // array of { id, label, kind } where kind: 'shape'|'text'

    // Provide some default basic colored shapes if none exist
    const ensureDefaultIcons = () => {
        if (highlightedDateIcons.length === 0) {
            highlightedDateIcons = [
                { id: 'dot-red', label: '● Rojo', kind: 'shape', value: 'red' },
                { id: 'dot-green', label: '● Verde', kind: 'shape', value: 'green' },
                { id: 'dot-blue', label: '● Azul', kind: 'shape', value: 'blue' },
                { id: 'dot-yellow', label: '● Amarillo', kind: 'shape', value: '#FFD54F' },
                { id: 'dot-pink', label: '● Rosa', kind: 'shape', value: '#FFC0CB' },
                { id: 'dot-purple', label: '● Morado', kind: 'shape', value: '#D8BFD8' },
                { id: 'dot-black', label: '● Negro', kind: 'shape', value: '#000000' }
            ];
            localStorage.setItem('highlightedDateIcons', JSON.stringify(highlightedDateIcons));
        }
    };
    ensureDefaultIcons();

    const renderHighlightedIcons = () => {
        const hdIconSelect = document.getElementById('hdIconSelect');
        const hdIconCarousel = document.getElementById('hdIconCarousel');
        const hdIconsList = document.getElementById('hdIconsList'); // Keep reference but it's hidden
        if (!hdIconSelect || !hdIconCarousel) return; // Removed hdIconsList from this check as it's hidden

        hdIconCarousel.innerHTML = ''; // Clear carousel
        // hdIconsList.innerHTML = ''; // No longer populate the list

        const createCarouselItem = (id, title, innerHtml, isDeletable = false) => { // Added isDeletable param
            const item = document.createElement('div');
            item.className = 'icon-carousel-item';
            item.dataset.iconId = id;
            item.title = title;
            item.innerHTML = innerHtml;
            if (hdIconSelect.value === id) {
                item.classList.add('selected');
            }
            item.addEventListener('click', () => {
                // Remove 'selected' from all other items
                hdIconCarousel.querySelectorAll('.icon-carousel-item').forEach(el => el.classList.remove('selected'));
                // Add 'selected' to the clicked item
                item.classList.add('selected');
                // Update the hidden input value
                hdIconSelect.value = id;
            });

            // NEW: Add double-click listener for deletion
            if (isDeletable) {
                item.addEventListener('dblclick', async () => {
                    if (!await modalConfirm(`¿Eliminar el icono "${title}"?`)) return;
                    highlightedDateIcons = highlightedDateIcons.filter(i => i.id !== id);
                    localStorage.setItem('highlightedDateIcons', JSON.stringify(highlightedDateIcons));
                    if (hdIconSelect.value === id) { // If the deleted icon was selected, reset selection
                        hdIconSelect.value = 'none';
                    }
                    renderHighlightedIcons(); // Re-render the carousel and reset selection if needed
                });
            }

            hdIconCarousel.appendChild(item);
        };
        
        // Add "None" option to carousel (not deletable)
        createCarouselItem('none', 'Ninguno', '🚫', false);

        highlightedDateIcons.forEach(ic => {
            // Populate carousel, marking them as deletable
            createCarouselItem(ic.id, ic.label, renderIconPreviewForCarousel(ic), true);
            
            // No longer populate hdIconsList for management
            // const li = document.createElement('li');
            // li.style.display = 'flex'; li.style.justifyContent='space-between'; li.style.alignItems='center';
            // li.style.padding='6px 8px'; li.style.border='1px solid #e9ecef'; li.style.marginBottom='6px'; li.style.borderRadius='6px';
            // li.innerHTML = `<span>${renderIconPreviewInline(ic)} ${ic.label}</span><div><button class="delete-hd-icon" data-id="${ic.id}">Eliminar</button></div>`;
            // hdIconsList.appendChild(li);
        });
    };

    const renderIconPreviewForCarousel = (ic) => {
        if (ic.kind === 'text') return escapeHtml(ic.value);
        // Render a simple colored circle preview for shape icons
        return `<div class="icon-shape" style="background:${escapeHtml(ic.value)}; border-radius:50%; width:70%; height:70%;"></div>`;
    };

    const renderIconPreviewInline = (ic) => {
        if (ic.kind === 'text') return `<span style="display:inline-block;width:18px;text-align:center;margin-right:6px;">${escapeHtml(ic.value)}</span>`;
        return `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${escapeHtml(ic.value)};margin-right:8px;vertical-align:middle;"></span>`;
    };
    const escapeHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    renderHighlightedIcons(); // initial render

    // NEW: Add icon via UI
    document.getElementById('hdAddIconButton')?.addEventListener('click', () => {
        const v = (document.getElementById('hdNewIconInput').value || '').trim();
        if (!v) { modalAlert('Introduce un icono (texto o emoji).'); return; }
        // Check for duplicate icon value
        if (highlightedDateIcons.some(ic => ic.value === v)) {
            modalAlert('Este icono ya existe.');
            return;
        }
        const id = `icon_${Date.now()}`;
        const kind = v.length === 1 || /[\u{1F300}-\u{1F6FF}]/u.test(v) ? 'text' : 'text'; // treat as text (emoji or char)
        highlightedDateIcons.push({ id, label: v, kind, value: v });
        localStorage.setItem('highlightedDateIcons', JSON.stringify(highlightedDateIcons));
        document.getElementById('hdNewIconInput').value = '';
        renderHighlightedIcons();
    });

    // Delete icon (delegation) - THIS IS NO LONGER USED AS LIST IS HIDDEN
    // document.getElementById('hdIconsList')?.addEventListener('click', async (e) => {
    //     const btn = e.target.closest('.delete-hd-icon');
    //     if (!btn) return;
    //     const id = btn.dataset.id;
    //     if (!id) return;
    //     if (!await modalConfirm('¿Eliminar este icono personalizado?')) return;
    //     highlightedDateIcons = highlightedDateIcons.filter(i => i.id !== id);
    //     localStorage.setItem('highlightedDateIcons', JSON.stringify(highlightedDateIcons));
    //     renderHighlightedIcons();
    // });

    const saveHighlightedDates = () => {
        localStorage.setItem('highlightedDates', JSON.stringify(highlightedDates));
    };

    // NEW: Load/save helpers for highlighted date types using storage utils
    let highlightedDateTypes = getCustomHighlightedDateTypes(); // NEW: persisted types array, default []

    // NEW: Saved highlighted dates filters
    const hdSortSelect = document.getElementById('hdSortSelect');
    const hdTypeFilterSelect = document.getElementById('hdTypeFilterSelect');

    // Ensure filter controls trigger re-render when changed
    hdSortSelect?.addEventListener('change', () => renderHighlightedDatesList());
    hdTypeFilterSelect?.addEventListener('change', () => renderHighlightedDatesList());

    const getHdMinDate = (hd) => {
        const nums = (hd.dates || []).map(d => new Date(d + 'T00:00:00').getTime()).filter(n => !isNaN(n));
        return nums.length ? Math.min(...nums) : Number.POSITIVE_INFINITY;
    };
    const getHdCreationTime = (hd) => {
        const m = String(hd.id || '').match(/hd_(\d{10,})/);
        return m ? Number(m[1]) : 0;
    };
    const renderHdTypeFilterOptions = () => {
        if (!hdTypeFilterSelect) return;
        const inUse = new Set(['General', ...highlightedDateTypes, ...highlightedDates.map(h => h.type || 'General')]);
        const prev = hdTypeFilterSelect.value || 'all';
        hdTypeFilterSelect.innerHTML = '<option value="all">Todos los tipos</option>' +
            Array.from(inUse).sort().map(t => `<option value="${t}">${t}</option>`).join('');
        hdTypeFilterSelect.value = prev === 'all' || inUse.has(prev) ? prev : 'all';
    };

    const renderHighlightedDateTypes = () => {
        // populate select
        const hdTypeSelect = document.getElementById('hdTypeSelect'); // NEW: type selector
        const hdNewTypeInput = document.getElementById('hdNewTypeInput'); // NEW
        const hdAddTypeButton = document.getElementById('hdAddTypeButton'); // NEW
        const hdTypesList = document.getElementById('hdTypesList'); // NEW

        hdTypeSelect.innerHTML = '<option value="General">General</option>';
        highlightedDateTypes.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            hdTypeSelect.appendChild(opt);
        });
        // render list for management
        hdTypesList.innerHTML = '';
        if (!highlightedDateTypes.length) {
            hdTypesList.innerHTML = '<li class="no-activities-message">No hay tipos personalizados.</li>';
            return;
        }
        highlightedDateTypes.forEach(t => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.gap = '8px';
            li.style.padding = '6px 8px';
            li.style.border = '1px solid #e9ecef';
            li.style.marginBottom = '6px';
            li.style.borderRadius = '6px';
            li.innerHTML = `<span class="custom-hd-type">${t}</span><div><button class="delete-hd-type" data-type="${t}">Eliminar</button></div>`;
            hdTypesList.appendChild(li);
        });
    };

    // NEW: Add new type handler
    hdAddTypeButton.addEventListener('click', async () => {
        const v = (hdNewTypeInput.value || '').trim();
        if (!v) { await modalAlert('Introduce un nombre para el nuevo tipo.'); return; }
        if (highlightedDateTypes.includes(v)) { await modalAlert('Ese tipo ya existe.'); hdNewTypeInput.value = ''; return; }
        highlightedDateTypes.push(v);
        saveCustomHighlightedDateTypes(highlightedDateTypes);
        renderHighlightedDateTypes();
        hdNewTypeInput.value = '';
    });

    // Delete type from list (delegation)
    hdTypesList.addEventListener('click', async (e) => {
        const btn = e.target.closest('.delete-hd-type');
        if (!btn) return;
        const type = btn.dataset.type;
        if (!type) return;
        const ok = await modalConfirm(`¿Eliminar el tipo "${type}"? Esto no eliminará fechas ya creadas, solo quitará el tipo de la lista.`); // confirm
        if (!ok) return;
        highlightedDateTypes = highlightedDateTypes.filter(t => t !== type);
        saveCustomHighlightedDateTypes(highlightedDateTypes);
        renderHighlightedDateTypes();
    });

    // Render list of highlighted dates panel
    const renderHighlightedDatesList = () => {
        const list = document.getElementById('savedHighlightedDatesList');
        if (!list) return;
        list.innerHTML = '';
        if (!highlightedDates.length) {
            list.innerHTML = '<li class="no-highlighted-dates-message">No hay fechas destacadas.</li>';
            return;
        }
        // Apply filters/sort
        const typeFilter = hdTypeFilterSelect ? hdTypeFilterSelect.value : 'all';
        const sortMode = hdSortSelect ? hdSortSelect.value : 'date_asc';
        let items = highlightedDates.slice();
        if (typeFilter !== 'all') items = items.filter(h => (h.type || 'General') === typeFilter);
        items.sort((a,b) => {
            if (sortMode === 'date_asc') return getHdMinDate(a) - getHdMinDate(b);
            if (sortMode === 'date_desc') return getHdMinDate(b) - getHdMinDate(a);
            if (sortMode === 'creation_asc') return getHdCreationTime(a) - getHdCreationTime(b);
            if (sortMode === 'creation_desc') return getHdCreationTime(b) - getHdCreationTime(a);
            return 0;
        });
        renderHdTypeFilterOptions(); // keep options in sync
        items.forEach(hd => {
            const iconHtml = (hd.icon && highlightedDateIcons.find(ic => ic.id === hd.icon)) ? renderIconPreviewInline(highlightedDateIcons.find(ic => ic.id === hd.icon)) : '';
            const li = document.createElement('li');
            li.className = 'agenda-list-item';
            li.style.display = 'flex'; li.style.justifyContent='space-between'; li.style.alignItems='center'; li.style.gap='8px';
            li.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;">
                    <span class="hd-swatch" style="width:14px;height:14px;border-radius:3px;background:${hd.color};display:inline-block;"></span>
                    <div>
                        <div style="font-weight:600;">${iconHtml}${hd.title} <small style="color:#6c757d;margin-left:8px;">[${hd.type || 'General'}]</small></div>
                        <div style="font-size:0.9em;color:#666;">${hd.dates.slice(0,3).map(d => formatDateDayMonthYear(new Date(d + 'T00:00:00'))).join(', ')}${hd.dates.length>3?' (…)':''}</div>
                    </div>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="view-in-calendar-button" data-id="${hd.id}" data-date="${hd.dates[0] || ''}">Ver en calendario</button>
                    <button class="edit-hd-button" data-id="${hd.id}">Editar</button>
                    <button class="duplicate-hd-button" data-id="${hd.id}">Duplicar</button> <!-- NEW: Duplicar button -->
                    <button class="delete-hd-button" data-id="${hd.id}">Eliminar</button>
                </div>
            `;
            list.appendChild(li);
        });
    };

    // Hook form UI
    const hdForm = document.getElementById('highlightedDateForm');
    const hdTitle = document.getElementById('hdTitle');
    const hdDateInput = document.getElementById('hdDateInput');
    const hdAddDateButton = document.getElementById('hdAddDateButton');
    const hdDatesList = document.getElementById('hdDatesList');
    const hdDescription = document.getElementById('hdDescription');
    const hdColor = document.getElementById('hdColor');
    const hdCancelEditButton = document.getElementById('hdCancelEditButton');

    let hdWorkingDates = []; // for form

    const renderHdWorkingDates = () => {
        hdDatesList.innerHTML = '';
        hdWorkingDates.forEach((d, idx) => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.gap = '8px';
            li.innerHTML = `<span>${formatDateDayMonthYear(new Date(d + 'T00:00:00'))}</span><button type="button" class="remove-hd-date" data-idx="${idx}">✖</button>`;
            hdDatesList.appendChild(li);
        });
    };

    hdAddDateButton.addEventListener('click', () => {
        const v = hdDateInput.value;
        if (!v) return;
        if (!hdWorkingDates.includes(v)) hdWorkingDates.push(v);
        renderHdWorkingDates();
        hdDateInput.value = '';
    });

    hdDatesList.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-hd-date');
        if (!btn) return;
        const idx = parseInt(btn.dataset.idx,10);
        hdWorkingDates.splice(idx,1);
        renderHdWorkingDates();
    });

    hdForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = hdTitle.value.trim();
        if (!title || hdWorkingDates.length === 0) {
            alert('Introduce un título y al menos una fecha.');
            return;
        }
        const desc = hdDescription.value.trim();
        const color = hdColor.value || '#FFD54F';
        const type = hdTypeSelect.value || 'General'; // NEW: capture type
        const icon = (document.getElementById('hdIconSelect')?.value) || 'none';

        if (editingHighlightedId) {
            const idx = highlightedDates.findIndex(h=>h.id===editingHighlightedId);
            if (idx!==-1) {
                // If editing and multiple dates supplied, replace the single edited entry with separate entries per date
                if (hdWorkingDates.length > 1) {
                    // remove original
                    highlightedDates.splice(idx, 1);
                    // insert new entries for each date (preserve insertion order)
                    hdWorkingDates.forEach((d, i) => {
                        highlightedDates.push({ id: `hd_${Date.now()}_${i}_${Math.random().toString(36).substr(2,5)}`, title, dates:[d], description: desc, color, type, icon });
                    });
                } else {
                    // single-date edit: update in place
                    highlightedDates[idx].title = title;
                    highlightedDates[idx].dates = [...hdWorkingDates];
                    highlightedDates[idx].description = desc;
                    highlightedDates[idx].color = color;
                    highlightedDates[idx].type = type; // NEW
                    highlightedDates[idx].icon = icon;
                }
            }
        } else {
            // CREATE: for multiple dates create one highlightedDates entry per date
            hdWorkingDates.forEach((d, i) => {
                highlightedDates.push({ id: `hd_${Date.now()}_${i}_${Math.random().toString(36).substr(2,5)}`, title, dates:[d], description: desc, color, type, icon });
            });
        }
        saveHighlightedDates();
        renderHdTypeFilterOptions(); // NEW: sync filter options
        renderHighlightedDatesList();
        // reset form
        hdTitle.value=''; hdDescription.value=''; hdColor.value='#FFD54F'; hdWorkingDates=[]; renderHdWorkingDates();
        editingHighlightedId = null; hdCancelEditButton.style.display='none';
        renderCalendar(); // update calendar visuals
    });

    document.getElementById('savedHighlightedDatesList')?.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-hd-button');
        const delBtn = e.target.closest('.delete-hd-button');
        const viewBtn = e.target.closest('.view-in-calendar-button');
        const duplicateBtn = e.target.closest('.duplicate-hd-button'); // NEW: Duplicar button
        if (editBtn) {
            const id = editBtn.dataset.id;
            const hd = highlightedDates.find(h=>h.id===id);
            if (!hd) return;
            editingHighlightedId = id;
            hdTitle.value = hd.title;
            hdDescription.value = hd.description || '';
            hdColor.value = hd.color || '#FFD54F';
            hdWorkingDates = [...hd.dates];
            renderHdWorkingDates();
            // Restore type selection
            renderHighlightedDateTypes(); // ensure select is populated
            hdTypeSelect.value = hd.type || 'General';
            
            // NEW: Restore icon selection in carousel
            hdIconSelect.value = hd.icon || 'none';
            hdIconCarousel.querySelectorAll('.icon-carousel-item').forEach(item => {
                item.classList.toggle('selected', item.dataset.iconId === hdIconSelect.value);
            });

            hdCancelEditButton.style.display = 'inline-block';
            hdTitle.focus();
        } else if (delBtn) {
            const id = delBtn.dataset.id;
            if (!confirm('Eliminar fecha destacada?')) return;
            highlightedDates = highlightedDates.filter(h=>h.id!==id);
            saveHighlightedDates();
            renderHdTypeFilterOptions(); // NEW: sync filter options
            renderHighlightedDatesList();
            renderCalendar();
        } else if (viewBtn) {
            // Show calendar focused on the highlighted date (do not open description modal)
            const targetDateStr = viewBtn.dataset.date;
            if (!targetDateStr) return;
            // NEW: Uncheck hide weekend and persist
            hideWeekend = false;
            localStorage.setItem('hideWeekend', hideWeekend);
            hideWeekendCheckbox.checked = false;
            // NEW: Set date picker to the highlighted date and focus calendar on that date
            datePicker.value = targetDateStr;
            currentWeekStart = new Date(targetDateStr);
            renderCalendar();
            // NEW: Ensure calendar section is visible to the user
            document.querySelector('.calendar-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // After render, try to scroll the day header/item into view by targeting an event on that date if present.
            // Prefer to focus a calendar cell for that date (no modal).
            const formatted = formatDate(new Date(targetDateStr));
            // Use the internal scroll variable to locate any event item for that date; if none, scroll the day cell.
            // Find a calendar-day that contains the formatted date text
            setTimeout(() => {
                const calendarGrid = document.getElementById('calendarGrid');
                // Try to find any element that has a child with the date string in its .calendar-day-date
                const dayCell = Array.from(calendarGrid.querySelectorAll('.calendar-day')).find(dc => {
                    const dd = dc.querySelector('.calendar-day-date');
                    return dd && dd.textContent && dd.textContent.includes(formatDateShort(new Date(targetDateStr)));
                });
                if (dayCell) {
                    dayCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    dayCell.classList.add('calendar-item-focused');
                    setTimeout(()=>dayCell.classList.remove('calendar-item-focused'), 2500);
                }
            }, 120); // small delay to allow DOM updates
        } else if (duplicateBtn) { // NEW: Handle duplicate button click
            const id = duplicateBtn.dataset.id;
            const hd = highlightedDates.find(h => h.id === id);
            if (!hd) return;

            // Reset editing state and fill form with details of the item to duplicate
            editingHighlightedId = null; // Important: to create a new entry
            hdTitle.value = hd.title;
            hdDescription.value = hd.description || '';
            hdColor.value = hd.color || '#FFD54F';
            hdWorkingDates = []; // Clear dates so user can add new ones
            renderHdWorkingDates();

            // Restore type selection
            renderHighlightedDateTypes();
            hdTypeSelect.value = hd.type || 'General';

            // Restore icon selection
            hdIconSelect.value = hd.icon || 'none';
            hdIconCarousel.querySelectorAll('.icon-carousel-item').forEach(item => {
                item.classList.toggle('selected', item.dataset.iconId === hdIconSelect.value);
            });
            
            // Adjust form UI for new creation
            hdCancelEditButton.style.display = 'none';
            hdForm.querySelector('button[type="submit"]').textContent = 'Guardar Fecha Destacada';
            
            hdForm.scrollIntoView({ behavior: 'smooth' });
            hdTitle.focus();
            modalAlert('Edita el título, la descripción, el tipo o el icono (si es necesario) y añade una nueva fecha para la fecha destacada duplicada.');
        }
    });

    hdCancelEditButton.addEventListener('click', () => {
        editingHighlightedId = null;
        hdTitle.value=''; hdDescription.value=''; hdColor.value='#FFD54F'; hdWorkingDates=[]; renderHdWorkingDates();
        hdCancelEditButton.style.display='none';
        hdIconSelect.value = 'none'; // Reset icon
        renderHighlightedIcons(); // Re-render icons to reset selection
    });

    // NEW: Modal for viewing highlighted date details
    const highlightedDateModal = document.getElementById('highlightedDateModal');
    const hdModalTitle = document.getElementById('hdModalTitle');
    const hdModalDates = document.getElementById('hdModalDates');
    const hdModalDescription = document.getElementById('hdModalDescription');
    const closeHighlightedDateModal = document.getElementById('closeHighlightedDateModal');
    closeHighlightedDateModal?.addEventListener('click', () => { highlightedDateModal.style.display='none'; });
    // Also handle the 'Cerrar' button inside the modal actions
    const closeHighlightedDateModalBtn = document.getElementById('closeHighlightedDateModalBtn');
    closeHighlightedDateModalBtn?.addEventListener('click', () => { highlightedDateModal.style.display = 'none'; });

    let currentWeekStart = getStartOfWeek(new Date()); // Initialize to the Monday of the current week
    const allGroups = getGroups(); // Load groups for student activities

    let currentEditingTaskId = null; // To store the ID of the task being edited in the modal
    let currentEditingMeetingId = null; // NEW: To store the ID of the meeting being edited in the modal
    let currentEditingNoteId = null; // NEW: To store the ID of the note being edited in the modal

    // NEW: State for long press and highlighted items
    let longPressTimer = null;
    const LONG_PRESS_THRESHOLD = 500; // milliseconds
    let longPressActive = false; // Flag to indicate if a long press has been successfully triggered
    let currentPressedItem = null; // Store the item currently being pressed
    let highlightedItems = getHighlightedAgendaItems(); // Use utility function
    let touchStartX, touchStartY; // NEW: For touch move detection

    // NEW: Variable to store the ID of the item to scroll to in the calendar
    let _scrollToCalendarItemId = null;

    // NEW: Drag and Drop variables for notes
    let draggedNoteItem = null;

    // NEW: Calendar filter state variables
    let currentFilterType = 'all'; // 'all', 'activity', 'task', 'meeting'
    let currentFilterGroupKey = 'all_groups'; // 'all_groups' or specific groupKey
    let currentFilterHighlight = 'all'; // 'all', 'highlighted', 'non_highlighted'
    // NEW: State for hiding weekend columns
    let hideWeekend = localStorage.getItem('hideWeekend') === 'true'; // Load from localStorage
    // NEW: State for planning mode
    let planningMode = localStorage.getItem('planningMode') === 'true'; // Load from localStorage
    // NEW: State for number of days in planning mode
    let planningDaysCount = parseInt(localStorage.getItem('planningDaysCount') || '5', 10); // Load from localStorage, default to 5

    // NEW: Highlight header color cycling intervals for days with multiple highlighted dates
    let headerCycleIntervals = new Map();

    // --- Helper Functions for Agenda Items ---
    const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

    // Helper to get text color based on background luminance
    const getTextColor = (bgColor) => {
        if (!bgColor || bgColor === 'transparent' || bgColor.startsWith('rgba(0, 0, 0, 0)')) return '#333';
        
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

    // Helper to get localized activity type names for display in modals.
    const getLocalizedActivityType = (type) => {
        switch(type) {
            case 'numeric_integer': return 'Numérica (0-10 enteras o NP)';
            case 'qualitative': return 'Cualitativa (NP, Mal, Regular, Bien, Muy bien)';
            case 'numeric_decimal': return 'Numérica exacta (0-10, con 2 decimales)';
            default: return 'No especificado';
        }
    };

    // Function to handle highlighting logic
    const toggleHighlight = (itemElement) => {
        const highlightId = itemElement.dataset.highlightId;
        const type = itemElement.dataset.eventType;

        const existingIndex = highlightedItems.findIndex(h => h.id === highlightId && h.type === type);

        if (existingIndex !== -1) {
            highlightedItems.splice(existingIndex, 1); // Remove if already highlighted
            itemElement.classList.remove('highlighted-halo');
        } else {
            highlightedItems.push({ id: highlightId, type: type }); // Add if not highlighted
            itemElement.classList.add('highlighted-halo');
        }
        saveHighlightedAgendaItems(highlightedItems); // Use utility function
        renderHighlightedItemsList(); // NEW: Update the list when highlight changes
        renderCalendar(); // NEW: Re-render the calendar to update highlight indicators
    };

    const startPressTimer = (event) => {
        currentPressedItem = event.target.closest('.event-item');
        if (!currentPressedItem) return;

        longPressActive = false; // Reset for each new press
        longPressTimer = setTimeout(() => {
            longPressActive = true; // Long press threshold met, activate flag
            toggleHighlight(currentPressedItem);
            currentPressedItem = null; // Clear pressed item after handling long press
        }, LONG_PRESS_THRESHOLD);
    };

    const clearPressTimer = () => {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        // Don't reset longPressActive here, it should be checked by the click handler
        currentPressedItem = null; // Clear pressed item
    };

    // NEW: Render function for the highlighted items list
    const renderHighlightedItemsList = () => {
        highlightedItemsList.innerHTML = ''; // Clear existing list

        if (highlightedItems.length === 0) {
            highlightedItemsList.innerHTML = '<li class="no-highlighted-items-message">No hay elementos destacados.</li>';
            return;
        }

        const tasks = loadTasks();
        const meetings = loadMeetings();
        const groups = getGroups(); // All groups for activities

        const detailedHighlightedItems = highlightedItems.map(highlighted => {
            let itemDetails = null;
            if (highlighted.type === 'task') {
                itemDetails = tasks.find(t => t.id === highlighted.id.replace('task-', ''));
            } else if (highlighted.type === 'meeting') {
                itemDetails = meetings.find(m => m.id === highlighted.id.replace('meeting-', ''));
            } else if (highlighted.type === 'activity') {
                const parts = highlighted.id.split('-');
                if (parts.length >= 4) {
                    const activityIndex = parseInt(parts[parts.length - 1]);
                    // Reconstruct groupKey using all parts between 'activity-' and activityIndex
                    const groupKeyParts = parts.slice(1, parts.length - 1);
                    const groupKey = groupKeyParts.join('-');

                    const group = groups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === groupKey);
                    if (group && group.activities && group.activities[activityIndex]) {
                        itemDetails = { ...group.activities[activityIndex], group: group }; // Add group info to the item
                    }
                }
            }

            if (itemDetails) {
                return {
                    ...highlighted, // Contains id and type
                    details: itemDetails,
                    // Use a far future date for items without a date so they appear last when sorting.
                    sortDate: itemDetails.date ? new Date(itemDetails.date) : new Date('9999-12-31')
                };
            }
            return null;
        }).filter(item => item !== null); // Remove any items that couldn't be found

        // Sort the array by date (earliest first)
        detailedHighlightedItems.sort((a, b) => a.sortDate - b.sortDate);

        detailedHighlightedItems.forEach(item => {
            const listItem = document.createElement('li');
            listItem.dataset.highlightId = item.id;
            listItem.dataset.eventType = item.type;
            listItem.classList.add('highlighted-list-item'); // Add a class for styling

            let displayHtml = '';
            const itemDetails = item.details;
            const highlightListIcon = `<img src="warning_icon.png" alt="Advertencia" class="highlighted-item-inline-icon" />`;

            if (item.type === 'task') {
                displayHtml = `
                    <span class="highlighted-item-date">${itemDetails.date ? `${formatDateDayMonthYear(new Date(itemDetails.date))}${itemDetails.time ? `, ${itemDetails.time}` : ''}` : 'Sin fecha'}</span>
                    <span class="highlighted-item-type">Tarea:</span>
                    <span class="highlighted-item-name">${itemDetails.text}</span>
                    ${itemDetails.description ? `<span class="highlighted-item-description" title="${itemDetails.description}">(descripción)</span>` : ''}
                `;
            } else if (item.type === 'meeting') {
                displayHtml = `
                    <span class="highlighted-item-date">${itemDetails.date ? `${formatDateDayMonthYear(new Date(itemDetails.date))}${itemDetails.time ? `, ${itemDetails.time}` : ''}` : 'Sin fecha'}</span>
                    <span class="highlighted-item-type">Reunión:</span>
                    <span class="highlighted-item-name">${itemDetails.name}</span>
                    ${itemDetails.description ? `<span class="highlighted-item-description" title="${itemDetails.description}">(descripción)</span>` : ''}
                `;
            } else if (item.type === 'activity') {
                const group = itemDetails.group;
                displayHtml = `
                    <span class="highlighted-item-date">${itemDetails.date ? formatDateDayMonthYear(new Date(itemDetails.date)) : 'Sin fecha'}</span>
                    <span class="highlighted-item-type">Actividad:</span>
                    <span class="highlighted-item-name">${itemDetails.name}</span>
                    <span class="highlighted-item-group">(${group.subjectName} ${formatGradeLevelShort(group.gradeLevel)} ${group.groupLetter})</span>
                    ${itemDetails.description ? `<span class="highlighted-item-description" title="${itemDetails.description}">(descripción)</span>` : ''}
                `;
            }

            if (itemDetails) {
                listItem.innerHTML = `
                    <div class="highlighted-item-content">
                        ${highlightListIcon}
                        ${displayHtml}
                    </div>
                    <button class="remove-highlight-button delete-button" title="Eliminar destacado">🗑</button>
                `;
                highlightedItemsList.appendChild(listItem);
            }
        });
    };

    // NEW: Event listener for removing highlight from the list
    highlightedItemsList.addEventListener('click', async (event) => {
        const removeButton = event.target.closest('.remove-highlight-button');
        const listItem = event.target.closest('li.highlighted-list-item');

        if (!listItem) return;

        // If click is on the remove button, handle removal
        if (removeButton) {
            const highlightId = listItem.dataset.highlightId;
            const eventType = listItem.dataset.eventType;

            // Remove from highlightedItems array
            highlightedItems = highlightedItems.filter(h => !(h.id === highlightId && h.type === eventType));
            saveHighlightedAgendaItems(highlightedItems); // Use utility function

            // Re-render everything affected
            renderCalendar();
            renderHighlightedItemsList(); // Update the highlighted list itself
        } else {
            // Click on the list item itself -> locate in calendar
            const highlightId = listItem.dataset.highlightId;
            const eventType = listItem.dataset.eventType;

            let itemDetails = null;
            const tasks = loadTasks();
            const meetings = loadMeetings();
            const groups = getGroups(); 

            // Retrieve full item details to get the date
            if (eventType === 'task') {
                itemDetails = tasks.find(t => t.id === highlightId.replace('task-', ''));
            } else if (eventType === 'meeting') {
                itemDetails = meetings.find(m => m.id === highlightId.replace('meeting-', ''));
            } else if (eventType === 'activity') {
                const parts = highlightId.split('-'); // e.g., "activity-subject-grade-letter-index"
                if (parts.length >= 4) { 
                    const activityIndex = parseInt(parts[parts.length - 1]);
                    // Reconstruct groupKey
                    const groupKeyParts = parts.slice(1, parts.length - 1);
                    const groupKey = groupKeyParts.join('-');

                    const group = groups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === groupKey);
                    if (group && group.activities && group.activities[activityIndex]) {
                        itemDetails = group.activities[activityIndex];
                    }
                }
            }

            if (itemDetails && itemDetails.date) {
                currentWeekStart = getStartOfWeek(new Date(itemDetails.date));
                _scrollToCalendarItemId = highlightId; // Set the global variable for scrolling
                renderCalendar();
                // Ensure calendar section is visible and focused after render
                document.querySelector('.calendar-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Also update date picker to reflect the focused week
                if (datePicker) datePicker.value = formatDate(new Date(itemDetails.date));
                // Small deferred attempt to ensure the target element receives the focus animation
                setTimeout(() => {
                    const calendarGridEl = document.getElementById('calendarGrid');
                    const targetEl = calendarGridEl && calendarGridEl.querySelector(`[data-highlight-id="${CSS.escape(highlightId)}"]`);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        targetEl.classList.add('calendar-item-focused');
                        setTimeout(() => targetEl.classList.remove('calendar-item-focused'), 3000);
                    }
                }, 180);
            }
        }
    });

    // --- Tasks ---
    const loadTasks = () => {
        return getAgendaTasks();
    };

    const saveTasks = (tasks) => {
        saveAgendaTasks(tasks);
        renderCalendar(); // Re-render calendar when tasks change
        // NEW: Clean up highlighted items if a task was deleted/edited and it was highlighted
        highlightedItems = highlightedItems.filter(h => !(h.type === 'task' && !tasks.some(t => t.id === h.id.replace('task-', ''))));
        saveHighlightedAgendaItems(highlightedItems); // Use utility function
        renderHighlightedItemsList(); // Re-render highlighted list
    };

    const showEditTaskModal = (task) => {
        currentEditingTaskId = task.id;
        modalTaskEditText.value = task.text;
        modalTaskEditDescription.value = task.description || '';
        modalTaskEditDate.value = task.date || '';
        modalTaskEditTime.value = task.time || ''; // NEW: Populate task time
        editTaskModal.style.display = 'flex';
        // If there's a header element to show the task name, set it safely
        if (modalTaskName) modalTaskName.textContent = task.text;
    };

    const hideEditTaskModal = () => {
        editTaskModal.style.display = 'none';
        currentEditingTaskId = null;
        modalTaskEditText.value = '';
        modalTaskEditDescription.value = ''; // NEW: Clear description input
        taskDateInput.value = ''; // Clear date input
        modalTaskEditTime.value = ''; // NEW: Clear time input
    };

    // --- Meetings ---
    const loadMeetings = () => {
        return getAgendaMeetings();
    };

    const saveMeetings = (meetings) => {
        saveAgendaMeetings(meetings);
        renderCalendar(); // Re-render calendar when meetings change
        // NEW: Clean up highlighted items if a meeting was deleted/edited and it was highlighted
        highlightedItems = highlightedItems.filter(h => !(h.type === 'meeting' && !meetings.some(m => m.id === h.id.replace('meeting-', ''))));
        saveHighlightedAgendaItems(highlightedItems); // Use utility function
        renderHighlightedItemsList();
    };

    // NEW: Functions for editing meetings
    const showEditMeetingModal = (meeting) => {
        currentEditingMeetingId = meeting.id;
        if (modalMeetingName) modalMeetingName.textContent = meeting.name;
        modalMeetingEditName.value = meeting.name;
        modalMeetingEditDate.value = meeting.date;
        modalMeetingEditTime.value = meeting.time || ''; // Ensure it can be empty
        modalMeetingEditDescription.value = meeting.description || '';
        editMeetingModal.style.display = 'flex';
    };

    const hideEditMeetingModal = () => {
        editMeetingModal.style.display = 'none';
        currentEditingMeetingId = null;
        modalMeetingEditName.value = '';
        modalMeetingEditDate.value = '';
        modalMeetingEditTime.value = '';
        modalMeetingEditDescription.value = '';
    };

    // --- Notes ---
    const loadNotes = () => {
        return getAgendaNotes();
    };

    const saveNotes = (notes) => {
        saveAgendaNotes(notes);
        renderNotesList(); // Re-render notes list
    };

    // NEW: Helper to clear drag-and-drop classes for notes
    const clearNotesDragDropClasses = () => {
        Array.from(notesList.children).forEach(child => {
            child.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
        });
    };

    const renderNotesList = () => {
        const notes = loadNotes();
        notesList.innerHTML = '';
        if (notes.length === 0) {
            notesList.innerHTML = '<li class="no-notes-message">No hay notas personales.</li>';
            return;
        }

        notes.forEach((note, index) => {
            const listItem = document.createElement('li');
            listItem.dataset.id = note.id;
            listItem.dataset.index = index; // For drag and drop
            listItem.draggable = true; // Enable drag
            listItem.classList.add('draggable'); // Add class for styling

            const hasMoreInfo = note.moreInfo && note.moreInfo.trim() !== '';
            const infoIndicatorHtml = hasMoreInfo ? 
                `<span class="note-list-info-indicator" title="Más información disponible"><img src="plus_icon.png" alt="Más info" /></span>` : '';
            
            // Apply custom color if available
            if (note.color) {
                listItem.style.setProperty('--note-color', note.color);
                listItem.style.setProperty('--text-color', getTextColor(note.color)); // Set text color based on luminance
                listItem.classList.add('colored');
            } else {
                listItem.classList.remove('colored');
                listItem.style.removeProperty('--note-color');
                listItem.style.removeProperty('--text-color');
            }

            listItem.innerHTML = `
                <div class="note-item-content">
                    <span class="note-text">${note.text}</span>
                    ${infoIndicatorHtml}
                </div>
                <button class="delete-note-button" title="Eliminar nota">🗑</button>
            `;
            notesList.appendChild(listItem);
        });
    };

    // NEW: Functions for editing notes
    const showEditNoteModal = (note) => {
        currentEditingNoteId = note.id;
        modalNoteEditText.value = note.text;
        modalNoteEditMoreInfo.value = note.moreInfo || '';

        // Select matching radio or custom
        let matched = false;
        modalNoteEditColorRadios.forEach(radio => {
            if (radio.value !== 'custom' && radio.value === note.color) {
                radio.checked = true;
                matched = true;
            } else {
                radio.checked = false;
            }
        });
        if (!matched && modalCustomColor) {
            const customRadio = document.getElementById('modal-color-custom');
            if (customRadio) customRadio.checked = true;
            modalCustomColor.value = note.color || '#FFB399';
            modalCustomColor.style.display = 'inline-block';
        } else if (modalCustomColor) {
            modalCustomColor.style.display = 'none';
        }

        modalCustomUsed = false;
        editNoteModal.style.display = 'flex';
    };

    const hideEditNoteModal = () => {
        editNoteModal.style.display = 'none';
        currentEditingNoteId = null;
        modalNoteEditText.value = '';
        modalNoteEditMoreInfo.value = '';
        modalNoteEditColorRadios.forEach(radio => radio.checked = false); // Clear selected color
        // Reset modal picker state
        if (modalCustomColor) { modalCustomUsed = false; modalCustomColor.value = (document.querySelector('#modal-note-color-pastel1') ? document.querySelector('#modal-note-color-pastel1').value : '#FFC0CB'); }
    };

    // Sync create-note radios <-> picker
    if (noteColorPicker) {
        // initialize picker from the checked radio
        const initialRadio = document.querySelector('input[name="noteColor"]:checked');
        if (initialRadio) noteColorPicker.value = initialRadio.value;
        noteColorPicker.addEventListener('input', () => {
            // when user chooses custom color, uncheck radios and mark picker used
            document.querySelectorAll('input[name="noteColor"]').forEach(r => r.checked = false);
            notePickerUsed = true;
        });
        noteColorOptions.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    noteColorPicker.value = e.target.value; // reflect selected palette color in picker
                    notePickerUsed = false;
                }
            });
        });
    }

    // Sync modal radios <-> modal picker
    if (modalCustomColor) {
        // initialize to first modal radio if present
        const initialModalRadio = document.querySelector('input[name="modalNoteEditColor"]:checked') || document.querySelector('input[name="modalNoteEditColor"]');
        if (initialModalRadio && initialModalRadio.value !== 'custom') modalCustomColor.value = initialModalRadio.value;
        // When user types in the custom picker, ensure the 'custom' radio becomes checked (don't uncheck radios)
        modalCustomColor.addEventListener('input', () => {
            const customRadio = document.getElementById('modal-color-custom');
            if (customRadio) customRadio.checked = true;
            modalCustomUsed = true;
        });
        modalNoteEditColorRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked && e.target.value !== 'custom' && modalCustomColor) {
                    modalCustomColor.value = e.target.value;
                    modalCustomUsed = false;
                }
            });
        });
    }

    // NEW: Function to populate the calendar group filter dropdown
    const populateCalendarGroupFilter = () => {
        calendarFilterGroup.innerHTML = '<option value="all_groups">Todos los grupos</option>';
        allGroups.forEach(group => {
            const option = document.createElement('option');
            const groupKey = `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}`;
            option.value = groupKey;
            // Display group name with abbreviated course form
            option.textContent = `${group.subjectName} (${formatGradeLevelShort(group.gradeLevel)} ${group.groupLetter})`;
            calendarFilterGroup.appendChild(option);
        });
        calendarFilterGroup.value = currentFilterGroupKey; // Set default/current
    };

    // NEW: Function to get filtered calendar items based on current filter state
    const getFilteredCalendarItems = (startOfWeek, endOfWeek) => {
        const items = [];
        const tasks = loadTasks();
        const meetings = loadMeetings();

        // 1. Add Activities
        if (currentFilterType === 'all' || currentFilterType === 'activity') {
            allGroups.forEach(group => {
                const groupKey = `${group.subjectName}-${group.gradeLevel}-${group.groupLetter}`;
                if (currentFilterGroupKey === 'all_groups' || currentFilterGroupKey === groupKey) {
                    (group.activities || []).forEach((activity, originalIndex) => { // Added originalIndex here
                        const activityDate = new Date(activity.date + 'T00:00:00'); // Ensure UTC interpretation
                        if (activityDate >= startOfWeek && activityDate <= endOfWeek) {
                            items.push({
                                type: 'activity',
                                date: activity.date,
                                data: activity,
                                id: `activity-${groupKey}-${originalIndex}`, // Unique ID for activity item
                                group: group,
                                originalIndex: originalIndex // Store original index for navigation
                            });
                        }
                    });
                }
            });
        }

        // 2. Add Tasks
        if (currentFilterType === 'all' || currentFilterType === 'task') {
            tasks.forEach(task => {
                if (!task.completed) { // Only show incomplete tasks in calendar
                    const taskDate = new Date(task.date + 'T00:00:00');
                    if (taskDate >= startOfWeek && taskDate <= endOfWeek) {
                        items.push({
                            type: 'task',
                            date: task.date,
                            data: task,
                            id: `task-${task.id}` // Unique ID for task item
                        });
                    }
                }
            });
        }

        // 3. Add Meetings
        if (currentFilterType === 'all' || currentFilterType === 'meeting') {
            meetings.forEach(meeting => {
                const meetingDate = new Date(meeting.date + 'T00:00:00');
                if (meetingDate >= startOfWeek && meetingDate <= endOfWeek) {
                    items.push({
                        type: 'meeting',
                        date: meeting.date,
                        data: meeting,
                        id: `meeting-${meeting.id}` // Unique ID for meeting item
                    });
                }
            });
        }

        // 4. Apply Highlight Filter
        return items.filter(item => {
            const isHighlighted = highlightedItems.some(h => h.id === item.id && h.type === item.type);
            if (currentFilterHighlight === 'highlighted' && !isHighlighted) return false;
            if (currentFilterHighlight === 'non_highlighted' && isHighlighted) return false;
            return true;
        });
    };

    // --- Calendar Rendering ---
    const renderCalendar = () => {
        calendarGrid.innerHTML = ''; // Clear existing calendar

        // Clear any previous header color cycling intervals
        headerCycleIntervals.forEach(id => clearInterval(id));
        headerCycleIntervals.clear();

        const fullWeekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const daysToDisplayData = []; // [{ name: 'Lunes', date: Date, isWeekend: false }, ...]
        let displayStartDate = null;
        let displayEndDate = null;

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day

        if (planningMode) {
            // Use the date picker as the planning-mode start date when set, otherwise default to today
            const startFrom = (datePicker && datePicker.value) ? new Date(datePicker.value) : new Date(today);
            let daysAdded = 0;
            let currentDayIterator = new Date(startFrom); // Start from selected date or today
            currentDayIterator.setHours(0,0,0,0);

            while (daysAdded < planningDaysCount) {
                const dayOfWeekIndex = currentDayIterator.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
                const isCurrentDayWeekend = (dayOfWeekIndex === 0 || dayOfWeekIndex === 6);

                if (hideWeekend && isCurrentDayWeekend) {
                    // If hiding weekend, skip this day but don't count it towards planningDaysCount
                    currentDayIterator = addDays(currentDayIterator, 1);
                    continue;
                }

                daysToDisplayData.push({
                    name: fullWeekDays[dayOfWeekIndex === 0 ? 6 : dayOfWeekIndex - 1], // Map to 0-indexed Mon-Sun
                    date: new Date(currentDayIterator), // Add a copy of the date
                    isWeekend: isCurrentDayWeekend
                });
                
                if (displayStartDate === null) displayStartDate = new Date(currentDayIterator);
                displayEndDate = new Date(currentDayIterator);

                daysAdded++;
                currentDayIterator = addDays(currentDayIterator, 1);
            }
            // Update currentWeekStart for navigation, pointing to the actual first day displayed
            if (daysToDisplayData.length > 0) {
                 currentWeekStart = daysToDisplayData[0].date;
            } else {
                 currentWeekStart = today; // Fallback if no days could be added (e.g., planningDaysCount=0, or all days are filtered out)
            }

            // Show/hide planning days count selector
            if (planningDaysCountGroup) planningDaysCountGroup.style.display = 'block';
            if (planningDaysSelect) planningDaysSelect.value = planningDaysCount;

        } else {
            // Non-planning mode (standard week view)
            const startOfCurrentDisplayWeek = getStartOfWeek(currentWeekStart); // Always Monday
            displayStartDate = new Date(startOfCurrentDisplayWeek);
            displayEndDate = new Date(addDays(startOfCurrentDisplayWeek, 6));

            if (planningDaysCountGroup) planningDaysCountGroup.style.display = 'none';

            for (let i = 0; i < 7; i++) {
                const dayDate = addDays(startOfCurrentDisplayWeek, i);
                const dayOfWeekIndex = dayDate.getDay();
                const isCurrentDayWeekend = (dayOfWeekIndex === 0 || dayOfWeekIndex === 6);

                if (hideWeekend && isCurrentDayWeekend) {
                    continue;
                }
                daysToDisplayData.push({
                    name: fullWeekDays[dayOfWeekIndex === 0 ? 6 : dayOfWeekIndex - 1],
                    date: new Date(dayDate),
                    isWeekend: isCurrentDayWeekend
                });
            }
        }
        
        // Ensure display dates are set even if no days are added (edge case: planningDaysCount=0 and hideWeekend is true)
        if (daysToDisplayData.length === 0) {
            displayStartDate = today;
            displayEndDate = today;
        }

        const numColumnsToRender = daysToDisplayData.length;
        calendarGrid.style.gridTemplateColumns = `repeat(${numColumnsToRender}, 1fr)`;

        // Update week display
        if (planningMode) {
            weekDisplay.textContent = `Próximos ${numColumnsToRender} días desde ${formatDateDayMonthYear(displayStartDate)}`;
        } else {
            // If hiding weekend, adjust displayEndDate for the text
            let displayEndOfWeekText = '';
            if (hideWeekend) {
                // Find the last weekday in the week (Friday)
                let lastWeekday = new Date(displayStartDate);
                for (let i = 0; i < 7; i++) {
                    const tempDay = addDays(displayStartDate, i);
                    if (tempDay.getDay() !== 0 && tempDay.getDay() !== 6) { // Not Sunday or Saturday
                        lastWeekday = tempDay;
                    }
                }
                displayEndOfWeekText = formatDateDayMonthYear(lastWeekday);
            } else {
                displayEndOfWeekText = formatDateDayMonthYear(displayEndDate);
            }
            weekDisplay.textContent = `Semana del ${formatDateDayMonthYear(displayStartDate)} al ${displayEndOfWeekText}`;
        }
        
        datePicker.value = formatDate(currentWeekStart); // Date picker still reflects week start / actual today

        const itemsByDate = {};
        // Use the actual displayed date range for filtering
        const allFilteredItems = getFilteredCalendarItems(displayStartDate, displayEndDate); 
        allFilteredItems.forEach(item => {
            const itemDateFormatted = formatDate(new Date(item.date)); // Ensure consistent date format for grouping
            if (!itemsByDate[itemDateFormatted]) {
                itemsByDate[itemDateFormatted] = [];
            }
            itemsByDate[itemDateFormatted].push(item);
        });

        // Add header row
        daysToDisplayData.forEach(dayInfo => {
            const headerCell = document.createElement('div');
            headerCell.classList.add('calendar-header');
            // Put day name inside a span so we can animate it when there are highlighted dates
            headerCell.innerHTML = `<span class="calendar-day-name">${dayInfo.name}</span>`;
             // Check highlighted dates matching this day
             const dayStr = formatDate(dayInfo.date);
             const matchedArray = highlightedDates.filter(h => h.dates.includes(dayStr));
             if (matchedArray.length > 0) {
                 // if only one highlight, use its color; if many, start cycling every 2s (no icon shown when multiple)
                 if (matchedArray.length === 1) {
                     headerCell.style.backgroundColor = matchedArray[0].color;
                     // NEW: open highlighted-date modal on long-press (desktop/mobile)
                     attachHeaderLongPress(headerCell, () => {
                         openHighlightedDateModal(matchedArray, dayInfo);
                     });
                     // Make the day text blink red/black
                     headerCell.querySelector('.calendar-day-name')?.classList.add('blink-red-black');
                 } else {
                     // start with first color and cycle header background every 2s (no icon shown when multiple)
                     let idx = 0;
                     headerCell.style.backgroundColor = matchedArray[0].color;
                     const intervalId = setInterval(() => {
                         idx = (idx + 1) % matchedArray.length;
                         headerCell.style.backgroundColor = matchedArray[idx].color;
                     }, 2000);
                     // store interval so it can be cleared on next render
                     headerCycleIntervals.set(dayStr, intervalId);
                     // Also allow long-press to open the modal showing all matched highlights for that day
                     attachHeaderLongPress(headerCell, () => {
                         openHighlightedDateModal(matchedArray, dayInfo);
                     });
                     // For multiple highlights also make the day text blink red/black
                     headerCell.querySelector('.calendar-day-name')?.classList.add('blink-red-black');
                 }
             } else {
                 // No highlights for this header — still attach long-press to inform the user
                 attachHeaderLongPress(headerCell, () => {
                     modalAlert('No hay fechas destacadas para este día.');
                 });
             }
            calendarGrid.appendChild(headerCell);
        });

        daysToDisplayData.forEach(dayInfo => {
            const dayDate = dayInfo.date;
            const dayDateFormatted = formatDate(dayDate);

            const dayCell = document.createElement('div');
            dayCell.classList.add('calendar-day');
            
            if (dayDateFormatted === formatDate(today)) { // Compare against `today`
                dayCell.classList.add('current-day');
            }

            // Use 'X' as the abbreviation for Miércoles, otherwise first letter uppercased
            const dayAbbrev = dayInfo.name.toLowerCase().startsWith('miér') || dayInfo.name.toLowerCase().startsWith('mié') ? 'X' : dayInfo.name.substring(0,1).toUpperCase();
            dayCell.innerHTML = `<div class="calendar-day-date">${dayAbbrev}, ${formatDateShort(dayDate)}</div>`;
            
            // Sort items for this day: meetings/tasks first by time, then activities
            const itemsForThisDay = (itemsByDate[dayDateFormatted] || []).sort((a, b) => {
                // Prioritize items with time, then by type
                let timeA = null;
                if (a.type === 'meeting' && a.data.time) timeA = a.data.time;
                else if (a.type === 'task' && a.data.time) timeA = a.data.time;
                
                let timeB = null;
                if (b.type === 'meeting' && b.data.time) timeB = b.data.time;
                else if (b.type === 'task' && b.data.time) timeB = b.data.time;

                if (timeA && timeB) return timeA.localeCompare(timeB);
                if (timeA) return -1; // Item A has time, B doesn't (or B has it but is later)
                if (timeB) return 1;  // Item B has time, A doesn't (or A has it but is later)

                // If no time, sort activities before tasks/meetings
                if (a.type === 'activity' && b.type !== 'activity') return -1;
                if (a.type !== 'activity' && b.type === 'activity') return 1;

                // Fallback: sort by name if all else equal
                return (a.data.name || a.data.text || '').localeCompare(b.data.name || b.data.text || '');
            });

            itemsForThisDay.forEach(item => {
                const eventItem = document.createElement('div');
                eventItem.classList.add('event-item');
                eventItem.dataset.highlightId = item.id;
                eventItem.dataset.eventType = item.type;

                // Apply highlight class if stored
                let isHighlighted = highlightedItems.some(h => h.id === item.id && h.type === item.type);
                if (isHighlighted) {
                    eventItem.classList.add('highlighted-halo');
                }
                const highlightIndicator = isHighlighted ? `<span class="highlight-indicator" title="Elemento destacado"><img src="warning_icon.png" alt="Advertencia" /></span>` : '';
                
                // Render based on item type
                if (item.type === 'activity') {
                    eventItem.classList.add('student-activity');
                    // Dataset attributes for navigation to grade_activity.html
                    eventItem.dataset.groupKey = `${item.group.subjectName}-${item.group.gradeLevel}-${item.group.groupLetter}`;
                    eventItem.dataset.activityIndex = item.originalIndex; // Use the stored originalIndex from filtered item

                    eventItem.innerHTML = `
                        ${highlightIndicator}
                        <span class="activity-name"><strong>Actividad:</strong> <span class="activity-title">${item.data.name}</span></span>
                        <span class="activity-subject"><strong>Materia:</strong> <span class="activity-sub">${item.group.subjectName}</span></span>
                        <span class="activity-group"><strong>Grupo:</strong> <span class="activity-group-text">${formatGradeLevelShort(item.group.gradeLevel)} ${item.group.groupLetter}</span></span>
                    `;
                    // Apply group's color to this activity (inline styles override the default CSS)
                    if (item.group.color) {
                        // Set the visible background and the left stripe color
                        eventItem.style.backgroundColor = item.group.color;
                        eventItem.style.borderLeftColor = item.group.color;

                        // Compute simple luminance to pick readable text color
                        try {
                            const hex = item.group.color.replace('#', '');
                            const r = parseInt(hex.substring(0, 2), 16);
                            const g = parseInt(hex.substring(2, 4), 16);
                            const b = parseInt(hex.substring(4, 6), 16);
                            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                            const textColor = luminance > 0.7 ? '#000' : '#fff';
                            eventItem.style.color = textColor;
                            if (luminance < 0.25) {
                                eventItem.classList.add('dark-bg');
                                eventItem.style.setProperty('--activity-title-color', '#ffffff');
                                eventItem.style.setProperty('--activity-subject-color', 'rgba(255,255,255,0.95)');
                                eventItem.style.setProperty('--activity-group-color', 'rgba(255,255,255,0.85)');
                            } else {
                                eventItem.classList.remove('dark-bg');
                            }
                        } catch (e) {
                            eventItem.style.color = '#000';
                            eventItem.classList.remove('dark-bg');
                        }
                    }

                } else if (item.type === 'meeting') {
                    eventItem.classList.add('meeting');
                    eventItem.dataset.meetingId = item.data.id;
                    const descriptionIndicator = item.data.description ? `<span class="meeting-description-indicator" title="Esta reunión tiene una descripción."><img src="pencil_icon.png" alt="Descripción" /></span>` : '';
                    eventItem.innerHTML = `
                        ${highlightIndicator}
                        <span><strong>Reunión:</strong> <span class="meeting-title">${item.data.name}</span></span>
                        ${item.data.time ? `<span class="event-time"><strong>Hora:</strong> ${item.data.time}</span>` : ''}
                        ${descriptionIndicator}
                    `;
                } else if (item.type === 'task') {
                    eventItem.classList.add('task');
                    eventItem.dataset.taskId = item.data.id;
                    const descriptionIndicator = item.data.description ? `<span class="task-description-indicator" title="Esta tarea tiene una descripción."><img src="pencil_icon.png" alt="Descripción" /></span>` : '';
                    eventItem.innerHTML = `
                        ${highlightIndicator}
                        <span><strong>Tarea:</strong> <span class="task-title">${item.data.text}</span></span>
                        ${item.data.time ? `<span class="event-time"><strong>Hora:</strong> ${item.data.time}</span>` : ''}
                        ${descriptionIndicator}
                    `;
                }
                dayCell.appendChild(eventItem);
            });
            // Mark weekend cells so CSS can style them
            if (dayInfo.isWeekend) dayCell.classList.add('weekend');
            calendarGrid.appendChild(dayCell);
        });
        // NEW: Scroll to specific item if requested
        if (_scrollToCalendarItemId) {
            const targetElement = calendarGrid.querySelector(`[data-highlight-id="${CSS.escape(_scrollToCalendarItemId)}"]`); // Use CSS.escape for potential special characters
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetElement.classList.add('calendar-item-focused');
                setTimeout(() => {
                    targetElement.classList.remove('calendar-item-focused');
                }, 3000); // Remove focus class after 3 seconds
            }
            _scrollToCalendarItemId = null; // Clear the variable after use
        }
    };

    // Helper to open modal given matchedArray and dayInfo
    const openHighlightedDateModal = (matchedArray, dayInfo) => {
        const modal = document.getElementById('highlightedDateModal');
        const titleEl = document.getElementById('hdModalTitle');
        const datesEl = document.getElementById('hdModalDates');
        const descEl = document.getElementById('hdModalDescription');
 
        titleEl.textContent = `Fechas Destacadas - ${formatDateDayMonthYear(dayInfo.date)}`;
        // render dates with data-hd-id so they are clickable and map back to saved list entries
        datesEl.innerHTML = matchedArray.map(h => {
            const ic = (h.icon && highlightedDateIcons.find(i => i.id === h.icon));
            const iconHtml = ic ? renderIconPreviewInline(ic) : '';
            return `<span class="hd-modal-list-item" data-hd-id="${escapeHtml(h.id)}" style="display:inline-block;padding:4px 8px;border-radius:6px;background:${h.color};color:${getTextColor(h.color)};margin-right:6px;font-weight:600;cursor:pointer;">${iconHtml}${escapeHtml(h.title)}</span>`;
        }).join(' ');
        descEl.innerHTML = matchedArray.map(h => {
            const ic = (h.icon && highlightedDateIcons.find(i => i.id === h.icon));
            const iconHtml = ic ? renderIconPreviewInline(ic) : '';
            return `<strong style="color:${h.color};">${iconHtml}${escapeHtml(h.title)}${h.type?` [${escapeHtml(h.type)}]`:''}</strong><div style="margin-top:4px;margin-bottom:8px;">${h.description?escapeHtml(h.description):'<em>Sin descripción.</em>'}</div>`;
        }).join('<hr style="border:none;border-top:1px solid #e9ecef;margin:8px 0;">');
 
        modal.style.display = 'flex';

        // Make each span clickable: close modal, expand highlightedDates section if collapsed, show and scroll to the saved item
        datesEl.querySelectorAll('.hd-modal-list-item').forEach(span => {
            span.addEventListener('click', () => {
                const hdId = span.dataset.hdId;
                modal.style.display = 'none';
                // ensure highlightedDatesContent is expanded
                const highlightedSection = document.querySelector('#highlightedDatesContent');
                const toggleBtn = document.querySelector('.collapsible-toggle[data-target="#highlightedDatesContent"]');
                if (highlightedSection && highlightedSection.classList.contains('collapsed')) {
                    highlightedSection.classList.remove('collapsed');
                    if (toggleBtn) toggleBtn.textContent = toggleBtn.textContent.replace(/▾|▸/g, '') + ' ▾';
                }
                // re-render saved list to ensure items exist
                renderHighlightedDatesList();
                // find the saved list item and scroll to it
                setTimeout(() => {
                    const savedList = document.getElementById('savedHighlightedDatesList');
                    const targetBtn = savedList && savedList.querySelector(`.view-in-calendar-button[data-id="${CSS.escape(hdId)}"]`);
                    const li = targetBtn ? targetBtn.closest('li') : null;
                    if (li) {
                        li.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        li.classList.add('calendar-item-focused');
                        setTimeout(() => li.classList.remove('calendar-item-focused'), 2500);
                    }
                }, 120);
            });
        });
    };

    // Attach long-press behavior to header elements (500ms threshold)
    const attachHeaderLongPress = (el, callback) => {
        let timer = null;
        let moved = false;
        const THRESH = 500;

        const start = (e) => {
            moved = false;
            timer = setTimeout(() => { timer = null; callback(); }, THRESH);
        };
        const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };

        el.addEventListener('mousedown', (e) => { if (e.button !== 0) return; start(e); });
        el.addEventListener('mouseup', cancel);
        el.addEventListener('mouseleave', cancel);

        el.addEventListener('touchstart', (e) => { start(e); }, { passive: true });
        el.addEventListener('touchend', cancel);
        el.addEventListener('touchmove', (e) => { moved = true; cancel(); }, { passive: true });
    };

    // NEW: Functions for Activity Details Modal
    const showActivityDetailsModal = (groupKey, activityIndex) => {
        const group = allGroups.find(g => `${g.subjectName}-${g.gradeLevel}-${g.groupLetter}` === groupKey);
        if (!group || !group.activities || !group.activities[activityIndex]) {
            modalAlert('Error: Actividad no encontrada.');
            return;
        }
        const activity = group.activities[activityIndex];

        modalActivityNameDisplay.textContent = activity.name;
        modalGroupDisplayInfo.textContent = `Grupo: ${group.subjectName} (${formatGradeLevelShort(group.gradeLevel)} ${group.groupLetter})`;
        modalActivityDateDisplay.textContent = `Fecha: ${formatDateDayMonthYear(new Date(activity.date))}`;
        modalActivityCategoryDisplay.textContent = `Tipo: ${activity.category || 'Actividad'}`;

        // NEW: detect custom grading types and display their name
        let gradingText = '';
        if (activity.type && activity.type.startsWith('custom:')) {
            const ctId = activity.type.substring(7);
            const ct = getCustomGradingTypes().find(t => t.id === ctId);
            gradingText = ct ? `Personalizado: ${ct.name}` : 'Personalizado';
        } else {
            gradingText = getLocalizedActivityType(activity.type);
        }
        modalActivityGradingTypeDisplay.textContent = `Calificación: ${gradingText}`;

        modalActivityDescriptionDisplay.textContent = activity.description || 'No hay descripción.';
        
        // Set dataset for navigation button
        goToActivityPageButton.dataset.groupKey = groupKey;
        goToActivityPageButton.dataset.activityIndex = activityIndex;

        activityDetailsModal.style.display = 'flex';
    };

    const hideActivityDetailsModal = () => {
        activityDetailsModal.style.display = 'none';
    };

    // --- Global Actions Event Listeners (consistent with other pages) ---
    globalHomeButton.addEventListener('click', () => {
        removeSessionItem('selectedAgendaItem'); 
        window.location.href = 'index.html';
    });

    globalSaveButton.addEventListener('click', handleSaveBackup);

    globalLoadButton.addEventListener('click', handleLoadBackup);

    // NEW: Handle global Daily Log button click
    globalDailyLogButton.addEventListener('click', () => {
        window.location.href = 'daily_log.html';
    });

    // --- Calendar Navigation Event Listeners ---
    prevWeekButton.addEventListener('click', () => {
        if (planningMode) {
            // Move back to the previous visible day. If weekends are hidden, skip Sat/Sun.
            do {
                currentWeekStart = addDays(currentWeekStart, -1);
            } while (hideWeekend && (currentWeekStart.getDay() === 0 || currentWeekStart.getDay() === 6));
        } else {
            currentWeekStart = addDays(currentWeekStart, -7);
        }
        datePicker.value = formatDate(currentWeekStart); // Keep datePicker in sync
        renderCalendar();
    });

    nextWeekButton.addEventListener('click', () => {
        if (planningMode) {
            // Move forward to the next visible day. If weekends are hidden, skip Sat/Sun.
            do {
                currentWeekStart = addDays(currentWeekStart, 1);
            } while (hideWeekend && (currentWeekStart.getDay() === 0 || currentWeekStart.getDay() === 6));
        } else {
            currentWeekStart = addDays(currentWeekStart, 7);
        }
        datePicker.value = formatDate(currentWeekStart); // Keep datePicker in sync
        renderCalendar();
    });

    // NEW: Handle current week button click
    currentWeekButton.addEventListener('click', () => {
        currentWeekStart = new Date(); // Go to today's date (will be adjusted by renderCalendar based on planningMode)
        datePicker.value = formatDate(currentWeekStart); // Keep datePicker in sync
        renderCalendar();
    });

    // NEW: Handle date picker change
    datePicker.addEventListener('change', (event) => {
        const selectedDate = new Date(event.target.value);
        if (!isNaN(selectedDate.getTime())) { // Check if date is valid
            // When datePicker changes, it always sets the `currentWeekStart` as the chosen date.
            // `renderCalendar` then interprets this based on `planningMode` (either directly as the first day,
            // or by finding the start-of-week for that date.
            currentWeekStart = new Date(selectedDate);
            renderCalendar();
        }
    });

    // NEW: Hide Weekend Checkbox Event Listener
    hideWeekendCheckbox.addEventListener('change', () => {
        hideWeekend = hideWeekendCheckbox.checked;
        localStorage.setItem('hideWeekend', hideWeekend); // Persist state
        renderCalendar(); // Re-render calendar with new column count
    });
    // Set initial checkbox state on load
    hideWeekendCheckbox.checked = hideWeekend;

    // NEW: Planning Mode Checkbox Event Listener
    planningModeCheckbox.addEventListener('change', () => {
        planningMode = planningModeCheckbox.checked;
        localStorage.setItem('planningMode', planningMode); // Persist state
        
        if (planningMode) {
            // When planning mode is activated, ensure the UI reflects `today` as the start
            currentWeekStart = new Date(); // Reset currentWeekStart to today when entering planning mode
            if (planningDaysCountGroup) planningDaysCountGroup.style.display = 'block'; // Show days count selector
        } else {
            // When planning mode is deactivated, hide its specific selector
            if (planningDaysCountGroup) planningDaysCountGroup.style.display = 'none';
        }
        renderCalendar(); // Re-render calendar
    });
    // Set initial checkbox state on load
    planningModeCheckbox.checked = planningMode;
    // Set initial visibility for the planning days count selector
    if (planningMode) {
        if (planningDaysCountGroup) planningDaysCountGroup.style.display = 'block';
        if (planningDaysSelect) planningDaysSelect.value = planningDaysCount; // Set its value on load
    } else {
        if (planningDaysCountGroup) planningDaysCountGroup.style.display = 'none';
    }

    // NEW: Planning Days Select Event Listener
    planningDaysSelect.addEventListener('change', (event) => {
        planningDaysCount = parseInt(event.target.value, 10);
        localStorage.setItem('planningDaysCount', planningDaysCount); // Persist state
        renderCalendar(); // Re-render calendar
    });

    // NEW: Auto-enable planning mode on narrow screens and cap to max 3 days
    const _narrowMQ = window.matchMedia('(max-width: 768px)');
    function _applyNarrowPlanningMode(e) {
        const isNarrow = e?.matches ?? _narrowMQ.matches;
        if (isNarrow) {
            planningMode = true; localStorage.setItem('planningMode', 'true');
            planningModeCheckbox.checked = true; planningModeCheckbox.disabled = true;
            Array.from(planningDaysSelect.options).forEach(opt => { const v = parseInt(opt.value,10); opt.disabled = v > 3; opt.hidden = v > 3; });
            if (planningDaysCount > 3) { planningDaysCount = 3; planningDaysSelect.value = '3'; localStorage.setItem('planningDaysCount', '3'); }
        } else {
            planningModeCheckbox.disabled = false;
            Array.from(planningDaysSelect.options).forEach(opt => { opt.disabled = false; opt.hidden = false; });
        }
        renderCalendar();
    }
    _narrowMQ.addEventListener('change', _applyNarrowPlanningMode);
    _applyNarrowPlanningMode(_narrowMQ);

    // NEW: Long press event listeners for calendarGrid
    calendarGrid.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return; // Only left mouse button
        startPressTimer(event);
    });

    calendarGrid.addEventListener('mouseup', () => {
        clearPressTimer();
        // The click event handler will check 'longPressActive'
    });

    calendarGrid.addEventListener('mouseleave', (event) => {
        // If mouse leaves the item while pressing down, cancel long press
        if (longPressTimer && currentPressedItem && !currentPressedItem.contains(event.relatedTarget)) {
            clearPressTimer();
            longPressActive = false; // Also reset flag if press interrupted
        }
    });

    calendarGrid.addEventListener('touchstart', (event) => {
        // event.preventDefault(); // REMOVED to allow click events to fire correctly on mobile
        touchStartX = event.touches[0].clientX; // NEW: Store start X coordinate
        touchStartY = event.touches[0].clientY; // NEW: Store start Y coordinate
        startPressTimer(event);
    }, { passive: true }); // Use passive: true as we are not preventing default scroll

    calendarGrid.addEventListener('touchend', () => {
        clearPressTimer();
        // The click event handler will check 'longPressActive'
    });

    // NEW: Add touchmove listener to cancel long press if user is scrolling
    calendarGrid.addEventListener('touchmove', (event) => {
        if (!longPressTimer) return;

        const touchX = event.touches[0].clientX;
        const touchY = event.touches[0].clientY;

        // If finger moves more than a few pixels, cancel the long press timer
        if (Math.abs(touchX - touchStartX) > 10 || Math.abs(touchY - touchStartY) > 10) {
            clearPressTimer();
        }
    });

    calendarGrid.addEventListener('touchcancel', () => {
        clearPressTimer();
        longPressActive = false; // Also reset flag if press interrupted
    });

    // NEW: Event listener for clicking on an activity/task/meeting in the calendar
    calendarGrid.addEventListener('click', (event) => {
        // If a long press was just detected, prevent the click event from firing its logic
        if (longPressActive) {
            longPressActive = false; // Reset the flag immediately after handling
            event.preventDefault(); // Crucial: prevent the browser's default click action
            event.stopImmediatePropagation(); // Stop propagation to ensure no other click handlers fire on this event.
            return;
        }

        const studentActivityItem = event.target.closest('.event-item.student-activity');
        const taskItem = event.target.closest('.event-item.task'); 
        const meetingItem = event.target.closest('.event-item.meeting'); // NEW

        if (studentActivityItem) {
            const groupKey = studentActivityItem.dataset.groupKey;
            const activityIndex = parseInt(studentActivityItem.dataset.activityIndex);

            if (groupKey && activityIndex !== undefined) {
                // NEW: Open activity details modal instead of navigating directly
                showActivityDetailsModal(groupKey, activityIndex);
            }
        } else if (taskItem) { 
            const taskId = taskItem.dataset.taskId;
            const tasks = loadTasks();
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                showEditTaskModal(task);
            }
        } else if (meetingItem) { // NEW: Handle click on a meeting in the calendar
            const meetingId = meetingItem.dataset.meetingId;
            const meetings = loadMeetings();
            const meeting = meetings.find(m => m.id === meetingId);
            if (meeting) {
                showEditMeetingModal(meeting);
            }
        }
    });

    // NEW: Event listeners for calendar filters
    calendarFilterType.addEventListener('change', (e) => {
        currentFilterType = e.target.value;
        if (currentFilterType === 'activity') {
            calendarGroupFilterContainer.style.display = 'block';
            calendarFilterGroup.disabled = false;
        } else {
            calendarGroupFilterContainer.style.display = 'none';
            calendarFilterGroup.disabled = true;
            currentFilterGroupKey = 'all_groups'; // Reset group filter if not showing activities
            calendarFilterGroup.value = 'all_groups';
        }
        renderCalendar();
    });

    calendarFilterGroup.addEventListener('change', (e) => {
        currentFilterGroupKey = e.target.value;
        renderCalendar();
    });

    calendarFilterHighlight.addEventListener('change', (e) => {
        currentFilterHighlight = e.target.value;
        renderCalendar();
    });

    // NEW: Collapsible sections toggle logic
    document.querySelectorAll('.collapsible-toggle').forEach(btn => {
        const targetSel = btn.dataset.target;
        const target = document.querySelector(targetSel);
        if (!target) return;
        // Initialize as collapsed by default
        target.classList.add('collapsed');
        // Ensure button reflects collapsed state
        btn.textContent = btn.textContent.replace(/▾|▸/g, '') + ' ▾';
        btn.addEventListener('click', () => {
            const isCollapsed = target.classList.toggle('collapsed');
            // Update caret symbol
            btn.textContent = btn.textContent.replace(/▾|▸/g, '') + (isCollapsed ? ' ▾' : ' ▸');
        });
    });

    // --- Task Event Listeners ---
    addTaskButton.addEventListener('click', async () => {
        const taskText = taskInput.value.trim();
        const taskDescription = taskDescriptionInput.value.trim(); // NEW
        const taskDate = taskDateInput.value; // YYYY-MM-DD format
        const taskTime = taskTimeInput.value; // NEW: Optional time for tasks
        if (taskText && taskDate) { // Changed to require taskDate
            const tasks = loadTasks();
            tasks.push({ id: generateUniqueId(), text: taskText, description: taskDescription, date: taskDate, time: taskTime, completed: false }); // NEW: Add time
            saveTasks(tasks);
            taskInput.value = '';
            taskDescriptionInput.value = ''; // NEW: Clear description input
            taskDateInput.value = ''; // Clear date input
            taskTimeInput.value = ''; // NEW: Clear time input
        } else {
            await modalAlert('Por favor, escribe una tarea y selecciona una fecha límite.'); // Updated alert message, used modalAlert
        }
    });

    // NEW: Edit Task Modal Event Listeners
    closeEditTaskModal.addEventListener('click', hideEditTaskModal);
    
    saveTaskEditButton.addEventListener('click', async () => {
        if (!currentEditingTaskId) {
            await modalAlert('Error: No se ha seleccionado ninguna tarea para editar.'); // Used modalAlert
            return;
        }

        const tasks = loadTasks();
        const taskIndex = tasks.findIndex(t => t.id === currentEditingTaskId);

        if (taskIndex === -1) {
            await modalAlert('Error: Tarea no encontrada.'); // Used modalAlert
            return;
        }

        const newText = modalTaskEditText.value.trim();
        const newDescription = modalTaskEditDescription.value.trim();
        const newDate = modalTaskEditDate.value;
        const newTime = modalTaskEditTime.value; // NEW: Get new time

        if (!newText || !newDate) { // Changed to require newDate
            await modalAlert('El nombre de la tarea y la fecha límite no pueden estar vacíos.'); // Updated alert message, used modalAlert
            return;
        }

        tasks[taskIndex].text = newText;
        tasks[taskIndex].description = newDescription;
        tasks[taskIndex].date = newDate;
        tasks[taskIndex].time = newTime; // NEW: Update task time

        saveTasks(tasks);
        hideEditTaskModal();
        await modalAlert('Tarea actualizada correctamente.'); // Used modalAlert
    });

    deleteTaskButtonModal.addEventListener('click', async () => {
        if (!currentEditingTaskId) {
            await modalAlert('Error: No se ha seleccionado ninguna tarea para eliminar.'); // Used modalAlert
            return;
        }
        if (await modalConfirm('¿Estás seguro de que quieres eliminar esta tarea?')) { // Used modalConfirm
            let tasks = loadTasks();
            tasks = tasks.filter(t => t.id !== currentEditingTaskId);
            // Remove from highlighted items if it was highlighted
            highlightedItems = highlightedItems.filter(h => !(h.id === `task-${currentEditingTaskId}` && h.type === 'task'));
            saveHighlightedAgendaItems(highlightedItems); // Use utility function
            saveTasks(tasks);
            hideEditTaskModal();
            await modalAlert('Tarea eliminada correctamente.'); // Used modalAlert
        }
    });

    // --- Meeting Event Listeners ---
    addMeetingButton.addEventListener('click', async () => {
        const name = meetingNameInput.value.trim();
        const date = meetingDateInput.value;
        const time = meetingTimeInput.value; // Time is now optional
        const description = meetingDescriptionInput.value.trim();
        if (name && date) { // Only name and date are required
            const meetings = loadMeetings();
            meetings.push({ id: generateUniqueId(), name, date, time, description });
            saveMeetings(meetings);
            meetingNameInput.value = '';
            meetingDateInput.value = '';
            meetingTimeInput.value = '';
            meetingDescriptionInput.value = '';
        } else {
            await modalAlert('Por favor, completa los campos obligatorios de la reunión (Título, Fecha).'); // Used modalAlert
        }
    });

    // NEW: Edit Meeting Modal Event Listeners
    closeEditMeetingModal.addEventListener('click', hideEditMeetingModal);
    
    saveMeetingEditButton.addEventListener('click', async () => {
        if (!currentEditingMeetingId) {
            await modalAlert('Error: No se ha seleccionado ninguna reunión para editar.'); // Used modalAlert
            return;
        }

        const meetings = loadMeetings();
        const meetingIndex = meetings.findIndex(m => m.id === currentEditingMeetingId);

        if (meetingIndex === -1) {
            await modalAlert('Error: Reunión no encontrada.'); // Used modalAlert
            return;
        }

        const newName = modalMeetingEditName.value.trim();
        const newDate = modalMeetingEditDate.value;
        const newTime = modalMeetingEditTime.value; // Time is now optional
        const newDescription = modalMeetingEditDescription.value.trim();

        if (!newName || !newDate) { // Only name and date are required
            await modalAlert('Los campos de Título y Fecha de la reunión no pueden estar vacíos.'); // Used modalAlert
            return;
        }

        meetings[meetingIndex].name = newName;
        meetings[meetingIndex].date = newDate;
        meetings[meetingIndex].time = newTime;
        meetings[meetingIndex].description = newDescription;

        saveMeetings(meetings);
        hideEditMeetingModal();
        await modalAlert('Reunión actualizada correctamente.'); // Used modalAlert
    });

    deleteMeetingButtonModal.addEventListener('click', async () => {
        if (!currentEditingMeetingId) {
            await modalAlert('Error: No se ha seleccionado ninguna reunión para eliminar.'); // Used modalAlert
            return;
        }
        if (await modalConfirm('¿Estás seguro de que quieres eliminar esta reunión?')) { // Used modalConfirm
            let meetings = loadMeetings();
            meetings = meetings.filter(m => m.id !== currentEditingMeetingId);
            // Remove from highlighted items if it was highlighted
            highlightedItems = highlightedItems.filter(h => !(h.id === `meeting-${currentEditingMeetingId}` && h.type === 'meeting'));
            saveHighlightedAgendaItems(highlightedItems); // Use utility function
            saveMeetings(meetings);
            hideEditMeetingModal();
            await modalAlert('Reunión eliminada correctamente.'); // Used modalAlert
        }
    });

    // --- Note Event Listeners ---
    addNoteButton.addEventListener('click', async () => {
        const noteText = noteInput.value.trim();
        const noteMoreInfo = noteMoreInfoInput.value.trim(); // NEW
        const selectedColorInput = document.querySelector('input[name="noteColor"]:checked');
        // Use picker if user interacted with it; otherwise prefer selected radio; fallback to a light grey
        const color = (notePickerUsed ? (noteColorPicker ? noteColorPicker.value : (selectedColorInput ? selectedColorInput.value : '#f8f9fa')) : (selectedColorInput ? selectedColorInput.value : (noteColorPicker ? noteColorPicker.value : '#f8f9fa')));

        if (noteText) {
            const notes = loadNotes();
            notes.push({ id: generateUniqueId(), text: noteText, moreInfo: noteMoreInfo, color: color }); // NEW: Add moreInfo and color
            saveNotes(notes);
            noteInput.value = '';
            noteMoreInfoInput.value = ''; // Clear more info input
            document.querySelector('#note-color-pastel1').checked = true; // Reset to default color
            // Reset picker sync state and value
            if (noteColorPicker) { noteColorPicker.value = document.querySelector('#note-color-pastel1').value; notePickerUsed = false; }
        } else {
            await modalAlert('Por favor, escribe una nota.'); // Used modalAlert
        }
    });

    notesList.addEventListener('click', async (event) => {
        const deleteButton = event.target.closest('.delete-note-button');
        const listItem = event.target.closest('li');

        if (!listItem || listItem.classList.contains('no-notes-message')) return; // Ignore if no list item or no-notes message

        const noteId = listItem.dataset.id;
        if (deleteButton) {
            if (await modalConfirm('¿Estás seguro de que quieres eliminar esta nota?')) { // Used modalConfirm
                let notes = loadNotes();
                notes = notes.filter(n => n.id !== noteId);
                saveNotes(notes);
            }
        } else {
            // Click on the list item itself -> open edit modal
            const notes = loadNotes();
            const note = notes.find(n => n.id === noteId);
            if (note) {
                showEditNoteModal(note);
            }
        }
    });

    // NEW: Edit Note Modal Event Listeners
    closeEditNoteModal.addEventListener('click', hideEditNoteModal);
    
    saveNoteEditButton.addEventListener('click', async () => {
        if (!currentEditingNoteId) {
            await modalAlert('Error: No se ha seleccionado ninguna nota para editar.');
            return;
        }

        const notes = loadNotes();
        const noteIndex = notes.findIndex(n => n.id === currentEditingNoteId);

        if (noteIndex === -1) {
            await modalAlert('Error: Nota no encontrada.');
            return;
        }

        const newText = modalNoteEditText.value.trim();
        const newMoreInfo = modalNoteEditMoreInfo.value.trim();
        const selectedModalRadio = document.querySelector('input[name="modalNoteEditColor"]:checked');
        let newColor = '#f8f9fa';
        if (selectedModalRadio) {
            if (selectedModalRadio.value === 'custom' && modalCustomColor) {
                newColor = modalCustomColor.value || '#f8f9fa';
            } else {
                newColor = selectedModalRadio.value || '#f8f9fa';
            }
        }

        if (!newText) {
            await modalAlert('El texto de la nota no puede estar vacío.');
            return;
        }

        notes[noteIndex].text = newText;
        notes[noteIndex].moreInfo = newMoreInfo;
        notes[noteIndex].color = newColor;

        saveNotes(notes);
        hideEditNoteModal();
        await modalAlert('Nota actualizada correctamente.');
    });

    deleteNoteButtonModal.addEventListener('click', async () => {
        if (!currentEditingNoteId) {
            await modalAlert('Error: No se ha seleccionado ninguna nota para eliminar.'); // Used modalAlert
            return;
        }
        if (await modalConfirm('¿Estás seguro de que quieres eliminar esta nota?')) { // Used modalConfirm
            let notes = loadNotes();
            notes = notes.filter(n => n.id !== currentEditingNoteId);
            saveNotes(notes);
            hideEditNoteModal();
            await modalAlert('Nota eliminada correctamente.'); // Used modalAlert
        }
    });

    // NEW: Drag and Drop event listeners for notesList
    notesList.addEventListener('dragstart', (e) => {
        draggedNoteItem = e.target.closest('li');
        if (draggedNoteItem && !draggedNoteItem.classList.contains('no-notes-message')) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedNoteItem.dataset.index); // Store the original index
            setTimeout(() => draggedNoteItem.classList.add('dragging'), 0);
        }
    });

    notesList.addEventListener('dragover', (e) => {
        e.preventDefault(); // Allow drop
        if (draggedNoteItem && e.target.closest('li') !== draggedNoteItem) {
            const targetItem = e.target.closest('li');
            if (targetItem && !targetItem.classList.contains('no-notes-message')) {
                clearNotesDragDropClasses(); // Clear all highlights first

                const bounding = targetItem.getBoundingClientRect();
                const offset = e.clientY - bounding.top;

                if (offset < bounding.height / 2) {
                    targetItem.classList.add('drag-over-top');
                } else {
                    targetItem.classList.add('drag-over-bottom');
                }
            }
        }
    });

    notesList.addEventListener('dragleave', (e) => {
        const targetItem = e.target.closest('li');
        if (targetItem) {
            targetItem.classList.remove('drag-over-top', 'drag-over-bottom');
        }
    });

    notesList.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedNoteItem) {
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const targetItem = e.target.closest('li');

            if (targetItem && targetItem !== draggedNoteItem && !targetItem.classList.contains('no-notes-message')) {
                let toIndex = parseInt(targetItem.dataset.index);

                const bounding = targetItem.getBoundingClientRect();
                const offset = e.clientY - bounding.top;

                // Adjust toIndex if dropping below the middle of the target item
                if (offset > bounding.height / 2) {
                    toIndex++;
                }
                    
                let notes = loadNotes();
                const [movedNote] = notes.splice(fromIndex, 1);
                notes.splice(toIndex, 0, movedNote);

                saveNotes(notes); // Save the reordered notes
            }
        }
        clearNotesDragDropClasses();
    });

    notesList.addEventListener('dragend', () => {
        if (draggedNoteItem) {
            draggedNoteItem.classList.remove('dragging');
            draggedNoteItem = null;
        }
        clearNotesDragDropClasses();
    });

    // NEW: Activity Details Modal Event Listeners
    closeActivityDetailsModal.addEventListener('click', hideActivityDetailsModal);

    goToActivityPageButton.addEventListener('click', () => {
        const groupKey = goToActivityPageButton.dataset.groupKey;
        const activityIndex = parseInt(goToActivityPageButton.dataset.activityIndex);

        if (groupKey && activityIndex !== undefined) {
            setSessionItem('selectedGroupKey', groupKey);
            setSessionItem('selectedActivityIndex', activityIndex);
            hideActivityDetailsModal(); // Close the modal before navigating
            // Ensure we don't retain a flag indicating we came from reports.
            // This makes the activity page show "Volver a Actividades" when opened from the agenda.
            removeSessionItem('report_isComingFromActivityPage');
            window.location.href = 'grade_activity.html';
        }
    });

    // --- Global Modal Close Listener ---
    window.addEventListener('click', (event) => {
        if (event.target === editTaskModal) {
            hideEditTaskModal();
        }
        if (event.target === editMeetingModal) { // NEW: Close meeting modal
            hideEditMeetingModal();
        }
        if (event.target === editNoteModal) { // NEW: Close note modal
            hideEditNoteModal();
        }
        if (event.target === activityDetailsModal) { // NEW: Close activity details modal
            hideActivityDetailsModal();
        }
    });

    // --- Initial Loads ---
    populateCalendarGroupFilter(); // Populate group filter dropdown
    // Set initial visibility of group filter container
    calendarGroupFilterContainer.style.display = currentFilterType === 'activity' ? 'block' : 'none';
    calendarFilterGroup.disabled = currentFilterType !== 'activity';

    renderHighlightedDateTypes(); // NEW: populate hdTypeSelect and types list
    renderHdTypeFilterOptions(); // NEW: populate type filter select
    renderCalendar();
    renderNotesList();
    renderHighlightedItemsList(); // NEW: Initial render of highlighted items
    renderHighlightedDatesList(); // NEW: Initial render of highlighted dates
});