import { saveGroups, saveAttendanceRecords, saveStudentsSortOrder, saveAgendaTasks, saveAgendaMeetings, saveAgendaNotes, saveTeacherSchedule, saveHighlightedAgendaItems, clearAllAppData, getAllAppData, getWebBackups, saveWebBackup, deleteWebBackup, saveCustomGradingTypes, saveCustomActivityCategories, updateWebBackupName } from './storage.js';

// Create a lightweight modal used for backup interactions
const createModal = (title, contentEl) => {
    const overlay = document.createElement('div');
    overlay.className = 'backup-modal-overlay';
    const box = document.createElement('div');
    box.className = 'backup-modal-box';
    const header = document.createElement('div');
    header.className = 'backup-modal-header';
    const h = document.createElement('h3'); h.textContent = title;
    const close = document.createElement('button'); close.textContent = '×'; close.className = 'backup-modal-close';
    close.addEventListener('click', () => document.body.removeChild(overlay));
    header.appendChild(h);
    header.appendChild(close);
    box.appendChild(header);
    const body = document.createElement('div'); body.className = 'backup-modal-body';
    body.appendChild(contentEl);

    const footer = document.createElement('div');
    footer.className = 'backup-modal-footer';

    box.appendChild(body);
    box.appendChild(footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    return { overlay, box, footer };
};

// NEW: Robust download helper that attempts multiple strategies so downloads work in more webview/apk wrappers
export const forceDownload = (blob, filename) => {
    try {
        // Prefer native msSaveBlob (IE / old Edge)
        if (navigator.msSaveBlob) {
            navigator.msSaveBlob(blob, filename);
            return;
        }
        const url = URL.createObjectURL(blob);
        // Try using an anchor first (most browsers). This avoids creating an iframe which could trigger a second download.
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        a.target = '_blank'; // help some webviews honor the filename by opening a new navigation context
        // Append to DOM to increase chance of working in embedded webviews
        document.body.appendChild(a);
        // Use a synthesized mouse event which works better in some embedded webviews/APK wrappers
        const evt = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
        a.dispatchEvent(evt);
        document.body.removeChild(a);
        // Revoke the object URL after a short delay to allow the download to start.
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
        console.warn('forceDownload failed with anchor approach, attempting location.href fallback', err);
        try {
            // Try msSaveOrOpenBlob if available (Edge/IE)
            if (navigator.msSaveOrOpenBlob) {
                navigator.msSaveOrOpenBlob(blob, filename);
                return;
            }
            const url = URL.createObjectURL(blob);
            // As a last-resort fallback, open blob in a new window/tab which some wrappers treat as a download and preserve filename better when triggered from a separate context
            const newWin = window.open(url, '_blank');
            if (!newWin) {
                // If popup blocked or not allowed, try location.href fallback
                window.location.href = url;
            }
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch (e) {
            console.error('All download strategies failed', e);
            modalAlert('No se pudo iniciar la descarga automáticamente. Intenta en una versión de navegador completa.');
        }
    }
};

// Save backup: ask user whether to download, save in web (up to 5) or cancel
export const handleSaveBackup = () => {
    const content = document.createElement('div');
    content.className = 'backup-modal-content';
    const info = document.createElement('p');
    info.textContent = '¿Deseas descargar la copia de seguridad como archivo o almacenarla en esta web? (máx. 10 copias almacenadas)';
    content.appendChild(info);

    const btnDownload = document.createElement('button'); btnDownload.textContent = 'Descargar'; btnDownload.className = 'btn';
    const btnView = document.createElement('button'); btnView.textContent = 'Ver contenido'; btnView.className = 'btn info'; // NEW: preview button
    const btnSaveWeb = document.createElement('button'); btnSaveWeb.textContent = 'Guardar en la web'; btnSaveWeb.className = 'btn primary';
    const btnCancel = document.createElement('button'); btnCancel.textContent = 'Cancelar'; btnCancel.className = 'btn ghost';
    content.appendChild(btnDownload); content.appendChild(btnView); content.appendChild(btnSaveWeb); content.appendChild(btnCancel);

    const modal = createModal('Guardar copia de seguridad', content);

    btnCancel.addEventListener('click', () => document.body.removeChild(modal.overlay));

    btnDownload.addEventListener('click', () => {
        let appData = getAllAppData();
        // Ensure full raw cookies are explicitly present (as a defensive measure)
        appData.fullCookies = document.cookie || '';
        // The fullLocalStorage and fullSessionStorage are already captured and included by getAllAppData().
        // The redundant loops previously here have been removed for cleaner code.
        
        // Normalize to a clear, stable top-level structure so downloads always include all restoration data
        const fullBackupPayload = {
            metadata: appData.metadata || {},
            structured: appData.structured || {},
            fullLocalStorage: appData.fullLocalStorage || {},
            fullSessionStorage: appData.fullSessionStorage || {},
            fullCookies: appData.fullCookies || '',
            domState: appData.domState || {}
        };
        const jsonString = JSON.stringify(fullBackupPayload, null, 2);
        // Filename format: "Cuaderno del Profesor - Fecha - Hora"
        // Fecha: aaaa-mmm-dd (mmm = short month name, lowercased, no trailing dot)
        const now = new Date();
        const monthShort = now.toLocaleString('es-ES', { month: 'short' }).replace('.', '').toLowerCase();
        const pad = (n) => String(n).padStart(2, '0');
        const datePart = `${now.getFullYear()}-${monthShort}-${pad(now.getDate())}`;
        const timePart = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        const suggested = `Cuaderno del Profesor - ${datePart} - ${timePart}.json`;
        (async () => {
            let res = await modalPrompt('Nombre del archivo de copia (puedes editarlo):', suggested, 'Editar nombre de archivo');
            if (res === null) return; // Cancelled: do not download
            let name = res.trim() ? res.trim() : suggested;
            name = name.replace(/[^a-z0-9\-_. ()]/gi, '_');
            if (!/\.json$/i.test(name)) name += '.json';
            const blob = new Blob([jsonString], { type: 'application/json' });
            forceDownload(blob, name);
            await modalAlert('Copia de seguridad descargada correctamente.');
            document.body.removeChild(modal.overlay);
        })();
    });

    btnView.addEventListener('click', () => {
        // Build the full payload same as for download so preview matches file content
        const appData = getAllAppData();
        appData.fullCookies = document.cookie || '';
        const fullBackupPayload = {
            metadata: appData.metadata || {},
            structured: appData.structured || {},
            fullLocalStorage: appData.fullLocalStorage || {},
            fullSessionStorage: appData.fullSessionStorage || {},
            fullCookies: appData.fullCookies || '',
            domState: appData.domState || {}
        };
        const jsonString = JSON.stringify(fullBackupPayload, null, 2);
        // Create simple preview modal with copy button
        const pre = document.createElement('textarea');
        pre.value = jsonString;
        pre.readOnly = true;
        pre.style.width = '100%';
        pre.style.height = '50vh';
        const copyBtn = document.createElement('button'); copyBtn.textContent = 'Copiar al portapapeles'; copyBtn.className = 'btn primary';
        const previewModal = createModal('Previsualizar copia de seguridad (JSON)', pre);
        previewModal.footer.appendChild(copyBtn);
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(jsonString);
                modalAlert('Texto copiado al portapapeles.');
            } catch (err) {
                // fallback: select and execCommand
                pre.select();
                document.execCommand && document.execCommand('copy');
                modalAlert('Copiado (fallback).');
            }
        });
    });

    btnSaveWeb.addEventListener('click', () => {
        // Prepare full backup payload and suggested friendly name, allow editing before saving
        const rawAppData = getAllAppData();
        rawAppData.fullCookies = document.cookie || '';
        const now = new Date();
        const monthShort = now.toLocaleString('es-ES', { month: 'short' }).replace('.', '').toLowerCase();
        const pad = (n) => String(n).padStart(2, '0');
        const datePart = `${now.getFullYear()}-${monthShort}-${pad(now.getDate())}`;
        const timePart = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        const suggestedName = `Cuaderno del Profesor - ${datePart} - ${timePart}`;

        // Build a normalized full payload (same shape as downloaded file) so web-saved backups contain everything needed
        const fullBackupPayload = {
            metadata: rawAppData.metadata || {},
            structured: rawAppData.structured || {},
            fullLocalStorage: rawAppData.fullLocalStorage || {},
            fullSessionStorage: rawAppData.fullSessionStorage || {},
            fullCookies: rawAppData.fullCookies || '',
            domState: rawAppData.domState || {}
        };

        // Ensure metadata has a creation timestamp and default name
        if (!fullBackupPayload.metadata) fullBackupPayload.metadata = {};
        fullBackupPayload.metadata.createdAt = fullBackupPayload.metadata.createdAt || new Date().toISOString();
        fullBackupPayload.metadata.name = fullBackupPayload.metadata.name || suggestedName;

        // Show small form to edit the name before saving
        const nameForm = document.createElement('div');
        nameForm.style.display = 'flex';
        nameForm.style.flexDirection = 'column';
        nameForm.style.gap = '8px';
        const label = document.createElement('label');
        label.textContent = 'Nombre para la copia (puedes editarlo):';
        label.style.fontWeight = '600';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = fullBackupPayload.metadata.name;
        input.style.padding = '8px';
        input.style.borderRadius = '8px';
        input.style.border = '1px solid rgba(0,0,0,0.12)';
        nameForm.appendChild(label);
        nameForm.appendChild(input);

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Guardar con este nombre';
        confirmBtn.className = 'btn primary';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.className = 'btn ghost';
        nameForm.appendChild(confirmBtn);
        nameForm.appendChild(cancelBtn);

        const nameModal = createModal('Guardar copia en la web', nameForm);

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(nameModal.overlay);
        });

        confirmBtn.addEventListener('click', () => {
            const finalName = input.value.trim() || fullBackupPayload.metadata.name;
            fullBackupPayload.metadata.name = finalName;
            fullBackupPayload.metadata.createdAt = fullBackupPayload.metadata.createdAt || new Date().toISOString();
            const id = saveWebBackup(fullBackupPayload);
            modalAlert('Copia de seguridad guardada en la web con id: ' + id);
            document.body.removeChild(nameModal.overlay);
            document.body.removeChild(modal.overlay);
        });
    });
};

// Load backup: allow uploading external file OR managing stored web backups (load/delete)
export const handleLoadBackup = () => {
    const content = document.createElement('div');
    const uploadBtn = document.createElement('button'); uploadBtn.textContent = 'Cargar archivo externo'; uploadBtn.className = 'btn';
    const manageBtn = document.createElement('button'); manageBtn.textContent = 'Ver copias guardadas en esta web'; manageBtn.className = 'btn primary';
    content.appendChild(uploadBtn); content.appendChild(manageBtn);

    const modal = createModal('Cargar copia de seguridad', content);

    uploadBtn.addEventListener('click', () => {
        // reuse previous file input approach
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/json';
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) { modalAlert('No se seleccionó ningún archivo.'); return; }
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const loadedData = JSON.parse(e.target.result);
                    // If fullLocalStorage/fullSessionStorage present, perform full restore
                    if (loadedData.fullLocalStorage || loadedData.fullSessionStorage) {
                        const proceedFull = await modalConfirm('Esta copia reemplazará todos los datos locales. ¿Deseas continuar?');
                        if (!proceedFull) return;
                        clearAllAppData(true);
                        if (loadedData.fullLocalStorage) {
                            Object.entries(loadedData.fullLocalStorage).forEach(([key, val]) => {
                                const toStore = (typeof val === 'string') ? val : JSON.stringify(val);
                                localStorage.setItem(key, toStore);
                            });
                        }
                        if (loadedData.fullSessionStorage) {
                            Object.entries(loadedData.fullSessionStorage).forEach(([key, val]) => {
                                const toStore = (typeof val === 'string') ? val : JSON.stringify(val);
                                sessionStorage.setItem(key, toStore);
                            });
                        }
                        // Restore cookies if present (best-effort; HttpOnly cookies cannot be restored from JS)
                        if (loadedData.fullCookies) {
                            try { document.cookie = loadedData.fullCookies; } catch (err) { console.warn('No se pudieron restaurar las cookies completas:', err); }
                        }
                        await modalAlert('Copia completa cargada. La página se recargará.'); window.location.reload();
                        return;
                    }
                    // Partial/structured restore (fallback)
                    const structured = (loadedData.structured) ? loadedData.structured : loadedData;
                    if (structured.groups && structured.attendanceRecords) {
                        const proceedPartial = await modalConfirm('Esta copia reemplazará los datos actuales. ¿Continuar?');
                        if (!proceedPartial) return;
                        saveGroups(structured.groups);
                        saveAttendanceRecords(structured.attendanceRecords);
                        if (structured.studentsSortOrder) saveStudentsSortOrder(structured.studentsSortOrder);
                        if (structured.agenda_tasks) saveAgendaTasks(structured.agenda_tasks);
                        if (structured.agenda_meetings) saveAgendaMeetings(structured.agenda_meetings);
                        if (structured.agenda_notes) saveAgendaNotes(structured.agenda_notes);
                        if (structured.highlightedAgendaItems) saveHighlightedAgendaItems(structured.highlightedAgendaItems);
                        if (structured.teacher_schedule) saveTeacherSchedule(structured.teacher_schedule);
                        // NEW: restore custom grading/activity configuration if present
                        if (structured.customGradingTypes) saveCustomGradingTypes(structured.customGradingTypes);
                        if (structured.customActivityCategories) saveCustomActivityCategories(structured.customActivityCategories);
                        await modalAlert('Copia cargada. La página se recargará.'); window.location.reload();
                    } else {
                        modalAlert('El archivo no parece contener una copia de seguridad válida.');
                    }
                } catch (err) {
                    console.error(err); alert('Error leyendo el archivo. Asegúrate que sea JSON válido.');
                }
            };
            reader.readAsText(file);
        });
        fileInput.click();
        document.body.removeChild(modal.overlay);
    });

    manageBtn.addEventListener('click', () => {
        const list = getWebBackups();
        const manageEl = document.createElement('div');
        manageEl.style.maxHeight = '40vh'; manageEl.style.overflow = 'auto';
        if (!list.length) {
            const p = document.createElement('p'); p.textContent = 'No hay copias almacenadas en esta web.';
            manageEl.appendChild(p);
        } else {
            list.slice().reverse().forEach(entry => { // show newest first
                const row = document.createElement('div'); row.className = 'backup-row';
                const title = document.createElement('div'); title.textContent = `${entry.name} — ${new Date(entry.createdAt).toLocaleString()}`; title.className = 'backup-title';
                const btnLoad = document.createElement('button'); btnLoad.textContent = 'Cargar'; btnLoad.className = 'btn primary';
                const btnEdit = document.createElement('button'); btnEdit.textContent = 'Editar Nombre'; btnEdit.className = 'btn ghost';
                const btnDelete = document.createElement('button'); btnDelete.textContent = 'Eliminar'; btnDelete.className = 'btn danger';
                // NEW: Download button
                const btnDownloadFile = document.createElement('button'); btnDownloadFile.textContent = 'Descargar'; btnDownloadFile.className = 'btn info';
                const btnViewEntry = document.createElement('button'); btnViewEntry.textContent = 'Ver contenido'; btnViewEntry.className = 'btn'; // NEW: preview stored entry
                row.appendChild(title); row.appendChild(btnLoad); row.appendChild(btnEdit); row.appendChild(btnDelete);
                row.appendChild(btnDownloadFile); // Append new button
                row.appendChild(btnViewEntry); // Append view button
                manageEl.appendChild(row);

                btnEdit.addEventListener('click', () => {
                    (async () => {
                        const newName = await modalPrompt('Introduce el nuevo nombre para esta copia:', entry.name, 'Editar Nombre de Copia');
                        if (newName !== null && newName.trim() !== '') {
                            if (newName.trim() !== entry.name) {
                                updateWebBackupName(entry.id, newName.trim());
                                await modalAlert('Nombre de copia actualizado.');
                                document.body.removeChild(document.querySelector('.backup-modal-overlay'));
                                handleLoadBackup();
                            }
                        } else if (newName !== null && newName.trim() === '') {
                            await modalAlert('El nombre no puede estar vacío.');
                        }
                    })();
                });

                btnDelete.addEventListener('click', () => {
                    (async () => {
                        const okDel = await modalConfirm('¿Eliminar esta copia? Acción irreversible.');
                        if (!okDel) return;
                        deleteWebBackup(entry.id);
                        await modalAlert('Copia eliminada.');
                        document.body.removeChild(document.querySelector('.backup-modal-overlay'));
                        handleLoadBackup(); // reopen to refresh list
                    })();
                });

                btnLoad.addEventListener('click', () => {
                    (async () => {
                        const okLoad = await modalConfirm('Esta acción reemplazará los datos actuales. ¿Continuar?');
                        if (!okLoad) return;
                        const data = entry.data;
                        if (data.fullLocalStorage || data.fullSessionStorage) {
                            clearAllAppData(true);
                            if (data.fullLocalStorage) {
                                Object.entries(data.fullLocalStorage).forEach(([key, val]) => {
                                    const toStore = (typeof val === 'string') ? val : JSON.stringify(val);
                                    localStorage.setItem(key, toStore);
                                });
                            }
                            if (data.fullSessionStorage) {
                                Object.entries(data.fullSessionStorage).forEach(([key, val]) => {
                                    const toStore = (typeof val === 'string') ? val : JSON.stringify(val);
                                    sessionStorage.setItem(key, toStore);
                                });
                            }
                            // Restore cookies from the backup if provided (best-effort)
                            if (data.fullCookies) {
                                try { document.cookie = data.fullCookies; } catch (err) { console.warn('No se pudieron restaurar las cookies completas:', err); }
                            }
                            await modalAlert('Copia completa cargada. La página se recargará.'); window.location.reload();
                            return;
                        }
                        const partial = data.structured || data;
                        saveGroups(partial.groups || []); saveAttendanceRecords(partial.attendanceRecords || {});
                        if (partial.studentsSortOrder) saveStudentsSortOrder(partial.studentsSortOrder);
                        if (partial.agenda_tasks) saveAgendaTasks(partial.agenda_tasks);
                        if (partial.agenda_meetings) saveAgendaMeetings(partial.agenda_meetings);
                        if (partial.agenda_notes) saveAgendaNotes(partial.agenda_notes);
                        if (partial.highlightedAgendaItems) saveHighlightedAgendaItems(partial.highlightedAgendaItems);
                        if (partial.teacher_schedule) saveTeacherSchedule(partial.teacher_schedule);
                        // NEW: restore custom grading/activity configuration when loading a partial structured backup
                        if (partial.customGradingTypes) saveCustomGradingTypes(partial.customGradingTypes);
                        if (partial.customActivityCategories) saveCustomActivityCategories(partial.customActivityCategories);
                        await modalAlert('Copia cargada. La página se recargará.'); window.location.reload();
                    })();
                });

                // NEW: Event listener for viewing stored entry content
                btnViewEntry.addEventListener('click', () => {
                    const jsonString = JSON.stringify(entry.data, null, 2);
                    const pre = document.createElement('textarea');
                    pre.value = jsonString;
                    pre.readOnly = true;
                    pre.style.width = '100%';
                    pre.style.height = '50vh';
                    const copyBtn = document.createElement('button'); copyBtn.textContent = 'Copiar al portapapeles'; copyBtn.className = 'btn primary';
                    const previewModal = createModal(`Previsualizar copia: ${entry.name}`, pre);
                    previewModal.footer.appendChild(copyBtn);
                    copyBtn.addEventListener('click', async () => {
                        try {
                            await navigator.clipboard.writeText(jsonString);
                            modalAlert('Texto copiado al portapapeles.');
                        } catch (err) {
                            pre.select();
                            document.execCommand && document.execCommand('copy');
                            modalAlert('Copiado (fallback).');
                        }
                    });
                });

                // NEW: Event listener for btnDownloadFile
                btnDownloadFile.addEventListener('click', () => {
                    const jsonString = JSON.stringify(entry.data, null, 2);
                    const filenameDate = new Date(entry.createdAt);
                    const filenameMonthShort = filenameDate.toLocaleString('es-ES', { month: 'short' }).replace('.', '').toLowerCase();
                    const pad = (n) => String(n).padStart(2, '0');
                    const filenameDatePart = `${filenameDate.getFullYear()}-${filenameMonthShort}-${pad(filenameDate.getDate())}`;
                    const filenameTimePart = `${pad(filenameDate.getHours())}-${pad(filenameDate.getMinutes())}-${pad(filenameDate.getSeconds())}`;
                    
                    // Sanitize entry.name for use in filename
                    const sanitizedName = (entry.name || 'Copia de Seguridad').replace(/[^a-z0-9\-\_ ]/gi, '_');
                    
                    const defaultName = `${sanitizedName} - ${filenameDatePart} - ${filenameTimePart}.json`;
                    (async () => {
                        let res = await modalPrompt('Nombre del archivo de copia (puedes editarlo):', defaultName, 'Editar nombre de archivo');
                        if (res === null) return; // Cancelled: do not download
                        let name = res.trim() ? res.trim() : defaultName;
                        name = name.replace(/[^a-z0-9\-_. ()]/gi, '_');
                        if (!/\.json$/i.test(name)) name += '.json';
                        const blob = new Blob([jsonString], { type: 'application/json' });
                        forceDownload(blob, name);
                        await modalAlert('Archivo de copia de seguridad descargado.');
                    })();
                });
            });
        }
        // replace modal content with management view
        document.body.removeChild(modal.overlay);
        createModal('Copias almacenadas en esta web', manageEl);
    });

};

/* Add modal-style alert / confirm utilities that reuse the same modal look-and-feel
   These return Promises so callers can await the user's decision. */
export const modalAlert = (message, title = 'Aviso') => {
    return new Promise((resolve) => {
        const content = document.createElement('div');
        const p = document.createElement('p');
        p.textContent = message;
        content.appendChild(p);
        const btnOk = document.createElement('button');
        btnOk.textContent = 'OK';
        btnOk.className = 'btn primary modal-action';
        content.appendChild(btnOk);
        const modal = createModal(title, content);
        // move the button to footer for consistent layout if footer exists
        if (modal.footer) {
            modal.footer.appendChild(btnOk);
            modal.box.querySelector('.backup-modal-body').removeChild(content); // prevent duplicate in body
            modal.box.querySelector('.backup-modal-body').appendChild(content); // keep content in body
        }
        btnOk.addEventListener('click', () => {
            document.body.removeChild(modal.overlay);
            resolve();
        });
    });
};

export const modalConfirm = (message, title = 'Confirmar') => {
    return new Promise((resolve) => {
        const content = document.createElement('div');
        const p = document.createElement('p');
        p.textContent = message;
        content.appendChild(p);
        const btnYes = document.createElement('button');
        btnYes.textContent = 'Sí';
        btnYes.className = 'btn primary modal-action';
        const btnNo = document.createElement('button');
        btnNo.textContent = 'Cancelar';
        btnNo.className = 'btn ghost modal-cancel';
        content.appendChild(btnYes);
        content.appendChild(btnNo);
        const modal = createModal(title, content);
        // move action buttons into footer if present for consistent visual placement
        if (modal.footer) {
            modal.footer.appendChild(btnNo);
            modal.footer.appendChild(btnYes);
            // ensure content only in body
            modal.box.querySelector('.backup-modal-body').removeChild(content);
            modal.box.querySelector('.backup-modal-body').appendChild(content);
        }
        btnNo.addEventListener('click', () => {
            document.body.removeChild(modal.overlay);
            resolve(false);
        });
        btnYes.addEventListener('click', () => {
            document.body.removeChild(modal.overlay);
            resolve(true);
        });
    });
};

// NEW: Function for a modal prompt with text input
export const modalPrompt = (message, defaultValue = '', title = 'Introducir Valor') => {
    return new Promise((resolve) => {
        const content = document.createElement('div');
        content.style.display = 'flex'; // Use flexbox for vertical alignment
        content.style.flexDirection = 'column';
        content.style.gap = '8px'; // Space between elements

        const p = document.createElement('p');
        p.textContent = message;
        content.appendChild(p);

        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue;
        content.appendChild(input);

        const modal = createModal(title, content);

        const btnOk = document.createElement('button');
        btnOk.textContent = 'Guardar';
        btnOk.className = 'btn primary modal-action';
        const btnCancel = document.createElement('button');
        btnCancel.textContent = 'Cancelar';
        btnCancel.className = 'btn ghost modal-cancel';
        
        // Move buttons to footer for consistent styling
        if (modal.footer) {
            modal.footer.appendChild(btnCancel);
            modal.footer.appendChild(btnOk);
            // Content is already in the body initially from createModal
        }

        const closeAndResolve = (value) => {
            document.body.removeChild(modal.overlay);
            resolve(value);
        };

        btnOk.addEventListener('click', () => closeAndResolve(input.value.trim()));
        btnCancel.addEventListener('click', () => closeAndResolve(null));
        // Also close on background click or 'x' button
        modal.overlay.addEventListener('click', (e) => {
            if (e.target === modal.overlay || e.target.classList.contains('backup-modal-close')) {
                closeAndResolve(null);
            }
        });
        input.focus();
    });
};

// NEW: Function for a modal with multiple options (buttons)
export const modalOptions = (message, options, title = 'Seleccionar Opción') => {
    return new Promise((resolve) => {
        const content = document.createElement('div');
        const p = document.createElement('p');
        p.textContent = message;
        content.appendChild(p);
        
        const actionsContainer = document.createElement('div');
        actionsContainer.style.display = 'flex';
        actionsContainer.style.flexDirection = 'column';
        actionsContainer.style.gap = '10px';
        actionsContainer.style.marginTop = '15px';

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.textContent = opt.text;
            btn.className = `btn ${opt.class || 'ghost'} modal-action`; // Allow custom classes for buttons
            btn.addEventListener('click', () => {
                document.body.removeChild(modal.overlay);
                resolve(opt.value);
            });
            actionsContainer.appendChild(btn);
        });

        const btnCancel = document.createElement('button');
        btnCancel.textContent = 'Cancelar';
        btnCancel.className = 'btn ghost modal-cancel';
        btnCancel.addEventListener('click', () => {
            document.body.removeChild(modal.overlay);
            resolve(null); // Resolve with null if cancelled
        });
        actionsContainer.appendChild(btnCancel);


        content.appendChild(actionsContainer);

        const modal = createModal(title, content);

        // move action buttons into footer if present for consistent visual placement
        if (modal.footer) {
            // Remove previous content from the body and add actions from actionsContainer to footer
            modal.box.querySelector('.backup-modal-body').innerHTML = ''; // Clear body content
            modal.box.querySelector('.backup-modal-body').appendChild(p); // Keep message in body
            Array.from(actionsContainer.children).forEach(btn => modal.footer.appendChild(btn));
        }
    });
};

// Enhanced modal styles for nicer, more visual buttons and layout
const style = document.createElement('style');
style.textContent = `
.backup-modal-overlay { position:fixed; inset:0; background: rgba(0,0,0,0.42); display:flex; align-items:center; justify-content:center; z-index:9999; }
.backup-modal-box { position: relative; background:var(--card-bg,#fff); padding:0; border-radius:10px; width:min(640px,94%); box-shadow:0 14px 40px rgba(2,6,23,0.25); overflow:hidden; font-family: inherit; color: #222; }
/* Header */
.backup-modal-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 18px; background: rgba(11,105,255,0.04); border-bottom: 1px solid rgba(0,0,0,0.06); }
.backup-modal-header h3 { margin:0; font-size:16px; font-weight:600; color:#073c9a; }
/* Close */
.backup-modal-close { background:transparent; border:none; font-size:20px; cursor:pointer; color:#666; padding:6px 8px; border-radius:6px; transition:background .15s ease, transform .12s ease; }
.backup-modal-close:hover { background:rgba(0,0,0,0.04); transform:scale(1.05); }
/* Body */
.backup-modal-body { padding:18px; font-size:14px; line-height:1.45; color:#333; max-height:60vh; overflow:auto; }
/* Footer with actions */
.backup-modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:12px 16px; background: #fafafa; border-top:1px solid rgba(0,0,0,0.04); }
/* Buttons */
.btn { display:inline-flex; align-items:center; gap:8px; padding:8px 14px; border-radius:10px; font-weight:600; cursor:pointer; border:1px solid transparent; transition: transform .12s ease, box-shadow .12s ease, background .12s ease; min-width:92px; justify-content:center;
    background: transparent; /* Make base button background transparent */
    color: #333; /* Default text color */
    border: 1px solid #d0d6dc; /* Default border */
    box-shadow: none;
}
.btn:focus { outline:3px solid rgba(11,105,255,0.12); outline-offset:2px; }
.btn.primary { background:#28a745; color:#fff; border-color:#28a745; box-shadow:0 6px 18px rgba(40,167,69,0.18); }
.btn.primary:hover { background:#218838; transform:translateY(-2px); }

.btn.info { background:#007bff; color:#fff; border-color:#007bff; box-shadow:0 6px 18px rgba(0,123,255,0.18); } /* Blue for info */
.btn.info:hover { background:#0056b3; transform:translateY(-2px); }

.btn.ghost { background:transparent; color:#333; border:1px solid #d0d6dc; box-shadow:none; }
.btn.ghost:hover { background:#f6f8fa; transform:translateY(-1px); }

.btn.danger { background:#ff4d4f; color:#fff; border-color:#ff4d4f; box-shadow:0 6px 18px rgba(255,77,79,0.14); }
.btn.danger:hover { background:#e03b3f; transform:translateY(-2px); }
.modal-action { padding-left:12px; padding-right:12px; }
.modal-cancel { opacity:0.95; }
.backup-modal-body p { margin:0 0 8px 0; }
/* Small icon inside button (optional) */
.btn .btn-emoji { font-size:16px; line-height:1; }

/* NEW: Styles for backup list rows */
.backup-row {
    display: flex;
    flex-wrap: wrap; /* Allow items to wrap on smaller screens */
    align-items: center;
    gap: 8px; /* Space between items */
    padding: 10px 0;
    border-bottom: 1px solid #eee;
    justify-content: flex-start; /* Align items to the start */
}
.backup-row:last-child { border-bottom: none; }
.backup-row .backup-title {
    flex-grow: 1; /* Allow title to take available space */
    min-width: 150px; /* Ensure title doesn't get too small */
    font-weight: 500;
    color: #333;
}
.backup-row .btn {
    flex-shrink: 0; /* Prevent buttons from shrinking */
    padding: 6px 10px; /* Make buttons slightly smaller */
    font-size: 0.85em;
    min-width: 80px; /* Adjusted min-width for smaller buttons */
}

/* NEW: Styles for input in modalPrompt */
.backup-modal-body input[type="text"] {
    width: 100%;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid #ced4da;
    box-sizing: border-box; /* Include padding/border in width */
}
.backup-modal-body label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #555;
    text-align: left; /* Align label text to left */
}
`;
document.head.appendChild(style);