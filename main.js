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

    // NEW: Simple auth - admin user "Sergio" with password "adminSer"
    const AUTH_USER = 'Sergio';
    const AUTH_PASS = 'adminSer';
    const AUTH_FLAG = 'app_admin_authenticated';

    const adminModal = document.getElementById('adminLoginModal');
    const adminUserInput = document.getElementById('adminUserInput');
    const adminPassInput = document.getElementById('adminPassInput');
    const adminLoginSubmit = document.getElementById('adminLoginSubmit');
    const adminLoginCancel = document.getElementById('adminLoginCancel');
    const adminLoginClose = document.getElementById('adminLoginClose');
    const adminLoginError = document.getElementById('adminLoginError');

    const interactiveSelectors = 'button.main-button, .action-button, .global-save-button, .global-load-button, .settings-gear, .global-home-button, .action-button-small, .create-button, .back-button';
    const setAppLocked = (locked) => {
        document.querySelectorAll(interactiveSelectors).forEach(el => {
            try { el.disabled = locked; } catch(e){ el.setAttribute(locked ? 'disabled' : ''); }
        });
        // visually ensure modal shows when locked
        if (locked && adminModal) {
            adminUserInput.value = '';
            adminPassInput.value = '';
            adminLoginError.style.display = 'none';
            adminModal.style.display = 'flex';
            adminUserInput.focus();
        } else if (adminModal) {
            adminModal.style.display = 'none';
        }
    };

    const isAuthenticated = () => sessionStorage.getItem(AUTH_FLAG) === '1';

    const tryAuthenticate = (user, pass) => {
        if (user === AUTH_USER && pass === AUTH_PASS) {
            sessionStorage.setItem(AUTH_FLAG, '1');
            setAppLocked(false);
            return true;
        }
        return false;
    };

    // Initialize locked state: block navigation until logged in
    if (!isAuthenticated()) setAppLocked(true);

    // Modal handlers
    adminLoginSubmit.addEventListener('click', () => {
        const u = adminUserInput.value.trim();
        const p = adminPassInput.value;
        if (tryAuthenticate(u, p)) {
            adminLoginError.style.display = 'none';
            modalAlert('Acceso correcto. Bienvenido, ' + AUTH_USER + '.').then(()=>{});
        } else {
            adminLoginError.textContent = 'Credenciales incorrectas.';
            adminLoginError.style.display = 'block';
            adminPassInput.value = '';
            adminPassInput.focus();
        }
    });
    const closeAdminModal = () => {
        // Cancel leaves app locked; optionally redirect to a safe page
        adminUserInput.value = ''; adminPassInput.value = '';
        adminLoginError.style.display = 'none';
        if (!isAuthenticated()) {
            // keep modal visible to enforce login
            setAppLocked(true);
        } else {
            setAppLocked(false);
        }
    };
    adminLoginCancel.addEventListener('click', closeAdminModal);
    adminLoginClose.addEventListener('click', closeAdminModal);

    // Ensure all navigation actions check auth: wrap existing handlers where necessary (examples below)
    // Rewire index buttons to require authentication before navigation
    groupsButton.addEventListener('click', () => { if (!isAuthenticated()) { setAppLocked(true); modalAlert('Acceso restringido. Inicia sesión como administrador.'); return; } window.location.href = 'groups.html'; });
    attendanceButton.addEventListener('click', () => { if (!isAuthenticated()) { setAppLocked(true); modalAlert('Acceso restringido. Inicia sesión como administrador.'); return; } window.location.href = 'attendance.html'; });
    gradesButton.addEventListener('click', () => { if (!isAuthenticated()) { setAppLocked(true); modalAlert('Acceso restringido. Inicia sesión como administrador.'); return; } window.location.href = 'grades.html'; });
    reportsButton.addEventListener('click', () => { if (!isAuthenticated()) { setAppLocked(true); modalAlert('Acceso restringido. Inicia sesión como administrador.'); return; } window.location.href = 'reports.html'; });

    agendaButton.addEventListener('click', () => { if (!isAuthenticated()) { setAppLocked(true); modalAlert('Acceso restringido. Inicia sesión como administrador.'); return; } window.location.href = 'agenda.html'; });
    dailyLogButton.addEventListener('click', () => { if (!isAuthenticated()) { setAppLocked(true); modalAlert('Acceso restringido. Inicia sesión como administrador.'); return; } window.location.href = 'daily_log.html'; });

    globalSaveButton.addEventListener('click', () => { if (!isAuthenticated()) { setAppLocked(true); modalAlert('Acceso restringido. Inicia sesión como administrador.'); return; } handleSaveBackup(); });

    const deleteBackupsButton = document.getElementById('deleteBackupsButton');
    if (deleteBackupsButton) {
        deleteBackupsButton.addEventListener('click', async () => {
            if (!isAuthenticated()) { setAppLocked(true); modalAlert('Acceso restringido. Inicia sesión como administrador.'); return; }
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

    globalLoadButton.addEventListener('click', () => { if (!isAuthenticated()) { setAppLocked(true); modalAlert('Acceso restringido. Inicia sesión como administrador.'); return; } handleLoadBackup(); });

    // Settings gear opens settings only if authenticated
    const openSettings = document.getElementById('openSettingsButton');
    const logoutButton = document.getElementById('logoutButton');
    if (openSettings) {
        openSettings.addEventListener('click', () => {
            if (!isAuthenticated()) { setAppLocked(true); modalAlert('Acceso restringido. Inicia sesión como administrador.'); return; }
            window.location.href = 'settings.html';
        });
    }

    // Show / hide logout button based on auth state
    const updateAuthUI = () => {
        if (isAuthenticated()) {
            logoutButton.style.display = 'inline-block';
        } else {
            logoutButton.style.display = 'none';
        }
    };
    updateAuthUI();

    logoutButton.addEventListener('click', async () => {
        const ok = await modalConfirm('¿Cerrar sesión?');
        if (!ok) return;
        sessionStorage.removeItem(AUTH_FLAG);
        setAppLocked(true);
        updateAuthUI();
        modalAlert('Sesión cerrada.');
    });
});