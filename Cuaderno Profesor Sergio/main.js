import { formatDateTimeForFilename } from './utils/date-utils.js';
import { getAllAppData, clearAllAppData } from './utils/storage.js';
import { handleLoadBackup, handleSaveBackup, modalConfirm, modalAlert } from './utils/backup-utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const groupsButton = document.getElementById('groupsButton');
    const attendanceButton = document.getElementById('attendanceButton');
    const gradesButton = document.getElementById('gradesButton'); 
    const reportsButton = document.getElementById('reportsButton'); 
    const globalSaveButton = document.getElementById('globalSaveButton'); 
    const globalLoadButton = document.getElementById('globalLoadButton');
    const agendaButton = document.getElementById('agendaButton'); 
    const dailyLogButton = document.getElementById('dailyLogButton'); 
    const clearAllDataButton = document.getElementById('clearAllDataButton'); 

    groupsButton.addEventListener('click', () => {
        window.location.href = 'groups.html';
    });

    attendanceButton.addEventListener('click', () => {
        window.location.href = 'attendance.html';
    });

    gradesButton.addEventListener('click', () => {
        window.location.href = 'grades.html';
    });

    reportsButton.addEventListener('click', () => {
        window.location.href = 'reports.html';
    });

    agendaButton.addEventListener('click', () => {
        window.location.href = 'agenda.html'; 
    });

    dailyLogButton.addEventListener('click', () => {
        window.location.href = 'daily_log.html'; 
    });

    globalSaveButton.addEventListener('click', () => {
        handleSaveBackup();
    });

    const deleteBackupsButton = document.getElementById('deleteBackupsButton');
    if (deleteBackupsButton) {
        deleteBackupsButton.addEventListener('click', async () => {
            const first = await modalConfirm('¿Eliminar TODAS las copias de seguridad almacenadas en esta web? Esta acción no se puede deshacer.');
            if (!first) return;
            const second = await modalConfirm('Confirmar de nuevo: ¿Seguro que quieres eliminar todas las copias?');
            if (!second) return;
            clearAllAppData(true); 
            localStorage.removeItem('web_backups');
            await modalAlert('Todas las copias almacenadas han sido eliminadas.');
            window.location.reload();
        });
    }

    globalLoadButton.addEventListener('click', handleLoadBackup);

    // Settings access button navigates to settings page (if present)
    const openSettingsButton = document.getElementById('openSettingsButton');
    if (openSettingsButton) {
        openSettingsButton.addEventListener('click', () => {
            window.location.href = 'settings.html';
        });
    }
});