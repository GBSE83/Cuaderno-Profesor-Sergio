export const getGroups = () => {
    const groups = JSON.parse(localStorage.getItem('groups')) || [];
    // Ensure all groups have a 'classificationTypes' array for student classifications
    return groups.map(group => ({
        ...group,
        classificationTypes: group.classificationTypes || []
    }));
};

export const saveGroups = (groups) => {
    localStorage.setItem('groups', JSON.stringify(groups));
};

export const getSessionItem = (key) => {
    return sessionStorage.getItem(key);
};

export const setSessionItem = (key, value) => {
    sessionStorage.setItem(key, value);
};

export const removeSessionItem = (key) => {
    sessionStorage.removeItem(key);
};

// Moved from attendance.js
export const getAttendanceRecords = () => {
    return JSON.parse(localStorage.getItem('attendanceRecords')) || {};
};

// Moved from attendance.js
export const saveAttendanceRecords = (records) => {
    localStorage.setItem('attendanceRecords', JSON.stringify(records));
};

// NEW: Functions for studentsSortOrder
export const getStudentsSortOrder = () => {
    return localStorage.getItem('studentsSortOrder') || 'manual'; // Default value
};

export const saveStudentsSortOrder = (order) => {
    localStorage.setItem('studentsSortOrder', order);
};

// NEW: Agenda specific storage functions
export const getAgendaTasks = () => {
    return JSON.parse(localStorage.getItem('agenda_tasks')) || [];
};

export const saveAgendaTasks = (tasks) => {
    localStorage.setItem('agenda_tasks', JSON.stringify(tasks));
};

export const getAgendaMeetings = () => {
    return JSON.parse(localStorage.getItem('agenda_meetings')) || [];
};

export const saveAgendaMeetings = (meetings) => {
    localStorage.setItem('agenda_meetings', JSON.stringify(meetings));
};

export const getAgendaNotes = () => {
    const notes = JSON.parse(localStorage.getItem('agenda_notes')) || [];
    // Ensure 'moreInfo' and 'color' fields exist for older notes
    return notes.map(note => ({
        ...note,
        moreInfo: note.moreInfo || '',
        color: note.color || '#f8f9fa' // Default light grey if not set
    }));
};

export const saveAgendaNotes = (notes) => {
    localStorage.setItem('agenda_notes', JSON.stringify(notes));
};

// NEW: Highlighted Agenda Items storage functions
export const getHighlightedAgendaItems = () => {
    return JSON.parse(localStorage.getItem('highlightedAgendaItems')) || [];
};

export const saveHighlightedAgendaItems = (items) => {
    localStorage.setItem('highlightedAgendaItems', JSON.stringify(items));
};

// NEW: Teacher Schedule storage functions
export const getTeacherSchedule = () => {
    const schedule = JSON.parse(localStorage.getItem('teacher_schedule')) || [];
    // Migrate old schedule entries (without 'type') to 'class' type
    return schedule.map(entry => {
        if (!entry.type) {
            return { ...entry, type: 'class' };
        }
        return entry;
    });
};

export const saveTeacherSchedule = (schedule) => {
    localStorage.setItem('teacher_schedule', JSON.stringify(schedule));
};

export const getCustomGradingTypes = () => {
    return JSON.parse(localStorage.getItem('customGradingTypes')) || [];
};

export const saveCustomGradingTypes = (types) => {
    localStorage.setItem('customGradingTypes', JSON.stringify(types));
};

// NEW: Custom activity categories (tipos de actividad personalizados)
export const getCustomActivityCategories = () => {
    return JSON.parse(localStorage.getItem('customActivityCategories')) || [];
};

export const saveCustomActivityCategories = (categories) => {
    localStorage.setItem('customActivityCategories', JSON.stringify(categories));
};

// NEW: Custom highlighted date types
export const getCustomHighlightedDateTypes = () => {
    return JSON.parse(localStorage.getItem('customHighlightedDateTypes')) || [];
};

export const saveCustomHighlightedDateTypes = (types) => {
    localStorage.setItem('customHighlightedDateTypes', JSON.stringify(types));
};

export const getAllAppData = () => {
    // Gather structured fields (backwards compatible)
    const structured = {
        groups: getGroups(),
        attendanceRecords: getAttendanceRecords(),
        studentsSortOrder: getStudentsSortOrder(),
        agenda_tasks: getAgendaTasks(),
        agenda_meetings: getAgendaMeetings(),
        agenda_notes: getAgendaNotes(),
        highlightedAgendaItems: getHighlightedAgendaItems(),
        teacher_schedule: getTeacherSchedule(),
        customGradingTypes: getCustomGradingTypes(),
        customActivityCategories: getCustomActivityCategories(),
        customHighlightedDateTypes: getCustomHighlightedDateTypes(),
        savedReportConfigurations: JSON.parse(localStorage.getItem('savedReportConfigurations') || '[]'), // NEW
        highlightedDates: JSON.parse(localStorage.getItem('highlightedDates') || '[]'),                 // NEW
        highlightedDateIcons: JSON.parse(localStorage.getItem('highlightedDateIcons') || '[]')          // NEW
    };

    // Capture full localStorage and sessionStorage as raw strings so a full restore is possible
    const fullLocalStorage = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        fullLocalStorage[key] = localStorage.getItem(key);
    }

    const fullSessionStorage = {};
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        fullSessionStorage[key] = sessionStorage.getItem(key);
    }

    // NEW: capture cookies so backups include cookie-based data (if any)
    const fullCookies = document.cookie || '';

    // NEW: capture simple DOM form state (inputs, textareas, selects) so UI state can be restored if needed
    // We store elements by a key (id or name plus tag) to minimize ambiguity.
    const domState = {};
    try {
        const elements = document.querySelectorAll('input, textarea, select');
        elements.forEach(el => {
            const key = (el.id && `#${el.id}`) || (el.name && `name:${el.name}`) || `${el.tagName.toLowerCase()}:${Array.from(el.classList || []).join('.')}`;
            if (!key) return;
            if (el.tagName.toLowerCase() === 'select') {
                domState[key] = { type: 'select', value: el.value, selectedIndex: el.selectedIndex };
            } else if (el.type === 'checkbox' || el.type === 'radio') {
                domState[key] = { type: el.type, checked: el.checked, value: el.value };
            } else {
                domState[key] = { type: el.type || el.tagName.toLowerCase(), value: el.value };
            }
        });
    } catch (e) {
        // If any error occurs capturing DOM state, don't block backup creation
        console.warn('No se pudo capturar el estado del DOM para la copia:', e);
    }

    // Include a small metadata block to help with restores and debugging
    const metadata = {
        appVersion: '1.0',
        createdAt: new Date().toISOString(),
        sourceUrl: window.location.href,
        userAgent: navigator.userAgent || '',            // NEW: include browser user agent
        language: navigator.language || navigator.userLanguage || '' // NEW: include browser language
    };

    // Include document title and favicon (helpful for restoring UI/context)
    try {
        metadata.documentTitle = document.title || '';
        const linkIcon = document.querySelector('link[rel~="icon"]') || document.querySelector('link[rel="shortcut icon"]');
        metadata.favicon = linkIcon ? (linkIcon.href || '') : '';
    } catch (e) {
        metadata.documentTitle = metadata.documentTitle || '';
        metadata.favicon = metadata.favicon || '';
    }

    // Compute a lightweight summary so backups are self-describing
    const groupsCount = (structured.groups || []).length;
    const studentsCount = (structured.groups || []).reduce((acc, g) => acc + ((g.students && g.students.length) ? g.students.length : 0), 0);
    const activitiesCount = (structured.groups || []).reduce((acc, g) => acc + ((g.activities && g.activities.length) ? g.activities.length : 0), 0);
    const attendanceEntriesCount = Object.keys(structured.attendanceRecords || {}).reduce((acc, groupKey) => {
        const dates = Object.keys(structured.attendanceRecords[groupKey] || {});
        return acc + dates.length;
    }, 0);
    const webBackupsRaw = localStorage.getItem('web_backups');
    const webBackupsCount = webBackupsRaw ? (JSON.parse(webBackupsRaw) || []).length : 0;

    const summary = { groupsCount, studentsCount, activitiesCount, attendanceEntriesCount, webBackupsCount };

    return {
        metadata,
        summary,
        structured,
        fullLocalStorage,
        fullSessionStorage,
        fullCookies,
        domState
    };
};

// NEW: Function to clear all application data from localStorage
export const clearAllAppData = (preserveBackups = true) => {
    // If backups should be preserved, extract them first, clear storages, then restore them.
    const backupsKey = 'web_backups';
    const backups = preserveBackups ? localStorage.getItem(backupsKey) : null;

    localStorage.clear();
    sessionStorage.clear();

    if (preserveBackups && backups) {
        localStorage.setItem(backupsKey, backups);
    }
};

// Web-stored backups (allow the user to keep up to MAX_WEB_BACKUPS backups in the app)
const WEB_BACKUPS_KEY = 'web_backups';
const MAX_WEB_BACKUPS = 10; // Changed from 15 to 10

export const getWebBackups = () => {
    return JSON.parse(localStorage.getItem(WEB_BACKUPS_KEY)) || [];
};

export const saveWebBackup = (backup) => {
    const list = getWebBackups();
    // Add id and timestamp if missing
    const entry = {
        id: backup.id || `bkp_${Date.now()}`,
        createdAt: (backup.metadata && backup.metadata.createdAt) || new Date().toISOString(),
        name: (backup.metadata && backup.metadata.name) || `Copia ${new Date().toLocaleString()}`,
        data: backup // store full structured backup (including fullLocalStorage/fullSessionStorage)
    };

    // Attach a small summary to the saved entry (useful when listing backups)
    try {
        const structured = backup.structured || {};
        const groupsCount = (structured.groups || []).length;
        const studentsCount = (structured.groups || []).reduce((acc, g) => acc + ((g.students && g.students.length) ? g.students.length : 0), 0);
        const activitiesCount = (structured.groups || []).reduce((acc, g) => acc + ((g.activities && g.activities.length) ? g.activities.length : 0), 0);
        const attendanceEntriesCount = Object.keys(structured.attendanceRecords || {}).reduce((acc, groupKey) => {
            const dates = Object.keys(structured.attendanceRecords[groupKey] || {});
            return acc + dates.length;
        }, 0);
        entry.summary = { groupsCount, studentsCount, activitiesCount, attendanceEntriesCount };
    } catch (e) {
        entry.summary = {};
    }

    list.push(entry);
    // Keep only the most recent MAX_WEB_BACKUPS
    while (list.length > MAX_WEB_BACKUPS) {
        list.shift();
    }
    localStorage.setItem(WEB_BACKUPS_KEY, JSON.stringify(list));
    return entry.id;
};

export const deleteWebBackup = (id) => {
    const list = getWebBackups().filter(e => e.id !== id);
    localStorage.setItem(WEB_BACKUPS_KEY, JSON.stringify(list));
};

export const clearWebBackups = () => {
    localStorage.removeItem(WEB_BACKUPS_KEY);
};

// NEW: Function to update the name of an existing web backup
export const updateWebBackupName = (id, newName) => {
    const list = getWebBackups();
    const backupIndex = list.findIndex(e => e.id === id);
    if (backupIndex !== -1) {
        list[backupIndex].name = newName;
        localStorage.setItem(WEB_BACKUPS_KEY, JSON.stringify(list));
    }
};