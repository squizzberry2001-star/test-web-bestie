// ==========================================================
    // [RB-JS-TAG-LIST]
    // Cari cepat: RB-JS-INIT, RB-JS-FORM-DYNAMIC, RB-JS-PDF,
    // RB-JS-AUTOSAVE, RB-JS-SECRET-PANEL, RB-JS-REALTIME-USAGE
    // ==========================================================
    const APP = {
        API_URL: (window.RB_CONFIG && window.RB_CONFIG.API_URL) || '',
        DEFAULT_FINDING_PHOTO_ROWS: 1,
        DEFAULT_CORRECTIVE_PHOTO_ROWS: 1,
        PHOTO_CELLS_PER_ROW: 4,
        MAX_TABLE_ROWS: 50,
        MAX_CREW: 10,
        DB_NAME: 'regional_bestie_visit_report_db',
        DB_VERSION: 2,
        DB_STORE: 'kv',
        DB_KEY: 'report-state',
        BULLET_PREFIX: '• '
    };

    const state = {
        autosaveTimer: null,
        suppressAutosave: false,
        dbPromise: null,
        activeDownload: false,
        usageHeartbeatTimer: null,
        usageSessionId: null,
        lastPresenceName: '',
        remoteUsageMode: false,
        secretLastFocus: null
    };


    const SECRET_ACTIVITY = {
        DASHBOARD_CODE_KEY: 'rbvr-usage-dashboard-code',
        STORAGE_KEY: 'rbvr-usage-activity-v1',
        SESSION_KEY: 'rbvr-usage-activity-auth',
        SESSION_ID_KEY: 'rbvr-usage-session-id',
        MAX_LOGS: 250,
        HEARTBEAT_MS: 25000,
        ACTIVE_WINDOW_MS: 120000
    };

    document.addEventListener('DOMContentLoaded', initializeApp);

    // === [RB-JS-INIT] boot aplikasi utama ===
    function initializeApp() {
        bindStaticEvents();
        updateSecretPanelState();
        setDefaultVisitDate();
        bootstrapDynamicSections();
        hydrateFromLocalDB();
        initializeRealtimeUsageTracking();
        checkApiConnection();
        logActivity('open_app', 'Membuka halaman report audit.');
    }

    function setApiConnectionStatus(message, tone = 'pending') {
        const text = document.getElementById('apiStatusText');
        const dot = document.getElementById('apiStatusDot');
        if (text) text.textContent = message;
        if (dot) dot.className = `system-status-dot ${tone}`;
    }

    async function checkApiConnection() {
        setApiConnectionStatus('Memeriksa koneksi Google Apps Script...', 'pending');
        try {
            const response = await fetch(`${APP.API_URL}?action=health&ts=${Date.now()}`, {
                method: 'GET',
                cache: 'no-store'
            });

            const raw = await response.text();
            let payload = {};
            try {
                payload = raw ? JSON.parse(raw) : {};
            } catch (parseError) {
                payload = {};
            }

            const okStatuses = ['success', 'Success', 'ok', 'OK'];
            if (response.ok && okStatuses.includes(String(payload.status || '').trim())) {
                setApiConnectionStatus('Terhubung ke Google Apps Script, Drive, dan Spreadsheet.', 'success');
                logActivity('backend_check', 'Health check backend sukses.');
                return;
            }

            if (response.ok) {
                setApiConnectionStatus('Endpoint backend terjangkau, tetapi belum punya health check standar. Upload akan diverifikasi saat download PDF.', 'pending');
                logActivity('backend_check', 'Endpoint backend terjangkau tetapi belum punya health check standar.');
                return;
            }

            throw new Error(payload.message || `Health check gagal (HTTP ${response.status})`);
        } catch (error) {
            console.error('API health check gagal', error);
            setApiConnectionStatus('Koneksi backend belum valid. Update dan deploy ulang Apps Script agar PDF bisa sinkron ke Drive dan Spreadsheet.', 'error');
            logActivity('backend_check_error', error.message || 'Health check gagal.');
        }
    }

    function bindStaticEvents() {
        document.getElementById('namaDropdown').addEventListener('change', handleNamaChange);
        document.getElementById('downloadPdfBtn').addEventListener('click', downloadPDF);
        document.getElementById('tutorialBtn').addEventListener('click', goToTutorial);
        document.getElementById('clearDataBtn').addEventListener('click', confirmClearData);
        document.getElementById('addCrewBtn').addEventListener('click', addCrewItem);

        document.querySelectorAll('[data-add-row]').forEach(button => {
            button.addEventListener('click', () => addTableRow(button.dataset.addRow));
        });

        document.querySelectorAll('[data-add-photo-row]').forEach(button => {
            button.addEventListener('click', () => addPhotoGridRow(button.dataset.addPhotoRow));
        });

        document.getElementById('toggleQSCResult').addEventListener('change', () => toggleSection('qscResultSection'));
        document.getElementById('toggleOPITable').addEventListener('change', () => toggleSection('opiTableSection'));
        document.getElementById('toggleQSCTable').addEventListener('change', () => toggleSection('qscTableSection'));
        document.getElementById('toggleFindingEvidence').addEventListener('change', () => toggleSection('findingEvidenceSection'));
        document.getElementById('toggleCorrectiveAction').addEventListener('change', () => toggleSection('correctiveActionSection'));

        document.getElementById('qscResultPhoto').addEventListener('change', event => handlePhotoUpload(event.target, 'qscResultPreview'));
        document.querySelectorAll('[data-trigger-file]').forEach(box => {
            box.addEventListener('click', () => {
                const input = document.getElementById(box.dataset.triggerFile);
                if (input) input.click();
            });
        });

        bindSecretActivityEvents();
        document.addEventListener('input', handleGlobalInput, true);
        document.addEventListener('change', handleGlobalChange, true);
        document.addEventListener('keydown', handleBulletKeydown, true);
        window.addEventListener('beforeunload', flushAutosaveBeforeLeave);
    }

    function handleGlobalInput(event) {
        const target = event.target;
        if (target.matches('textarea')) {
            autoResizeTextarea(target);
        }
        if (target.matches('input, textarea, select')) {
            scheduleAutosave();
        }
    }

    function handleGlobalChange(event) {
        if (event.target.matches('input, textarea, select')) {
            scheduleAutosave();
        }
        if (['namaDropdown', 'namaManual', 'store'].includes(event.target.id)) {
            syncRealtimeUsage('identity_update', 'Identitas user diperbarui.', true);
        }
    }

    function setDefaultVisitDate() {
        const dateInput = document.getElementById('tanggal');
        if (!dateInput.value) {
            dateInput.value = getTodayInputValue();
        }
    }

    function getTodayInputValue() {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        const local = new Date(now.getTime() - offset * 60000);
        return local.toISOString().slice(0, 10);
    }

    function bootstrapDynamicSections() {
        if (!document.querySelector('#crewItems .list-item')) {
            addCrewItem(false, { name: '', level: '' });
        }

        if (!document.querySelector('#opiTableBody tr')) {
            addTableRow('opiTableBody', false, {});
        }

        if (!document.querySelector('#qscTableBody tr')) {
            addTableRow('qscTableBody', false, {});
        }

        if (!document.querySelector('#findingEvidenceGrid .photo-row')) {
            for (let i = 0; i < APP.DEFAULT_FINDING_PHOTO_ROWS; i += 1) {
                addPhotoGridRow('findingEvidenceGrid', false, []);
            }
        }

        if (!document.querySelector('#correctiveActionGrid .photo-row')) {
            for (let i = 0; i < APP.DEFAULT_CORRECTIVE_PHOTO_ROWS; i += 1) {
                addPhotoGridRow('correctiveActionGrid', false, []);
            }
        }

        initializeAllTextareas();
        handleNamaChange();
        toggleSection('qscResultSection', false);
        toggleSection('opiTableSection', false);
        toggleSection('qscTableSection', false);
        toggleSection('findingEvidenceSection', false);
        toggleSection('correctiveActionSection', false);
    }

    function initializeAllTextareas() {
        document.querySelectorAll('textarea').forEach(autoResizeTextarea);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function handleNamaChange() {
        const dropdown = document.getElementById('namaDropdown');
        const manual = document.getElementById('namaManual');
        const isManual = dropdown.value === '__MANUAL__';
        manual.style.display = isManual ? 'block' : 'none';
        manual.required = isManual;
        if (!isManual) manual.value = '';
        syncRealtimeUsage('identity_update', 'Nama auditor diperbarui.', true);
    }

    function getNamaAuditor() {
        const dropdownValue = document.getElementById('namaDropdown').value || '';
        const manualValue = document.getElementById('namaManual').value.trim();
        if (dropdownValue === '__MANUAL__') return manualValue;
        return dropdownValue;
    }

    function goToTutorial() {
        window.location.href = 'tutorial.html';
    }

    function normalizeText(value) {
        return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function sanitizeFileName(value) {
        return String(value || '')
            .replace(/[\\/:*?"<>|]/g, ' ')
            .replace(/\s+/g, '_')
            .trim();
    }

    function autoResizeTextarea(element) {
        if (!element) return;
        element.style.height = 'auto';
        element.style.height = `${Math.max(element.scrollHeight, 54)}px`;
    }

    function insertBulletIntoTextarea(textarea) {
        if (!textarea) return;
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const needsBreak = textarea.value && start > 0 && textarea.value[start - 1] !== '\n';
        const insertion = `${needsBreak ? '\n' : ''}${APP.BULLET_PREFIX}`;
        textarea.setRangeText(insertion, start, end, 'end');
        textarea.focus();
        autoResizeTextarea(textarea);
        scheduleAutosave();
    }

    function handleBulletKeydown(event) {
        const textarea = event.target;
        if (!textarea.matches('.bullet-textarea')) return;
        if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.slice(0, start);
        const lineStart = before.lastIndexOf('\n') + 1;
        const currentLine = textarea.value.slice(lineStart, start);

        if (!/^\s*[•\-*]\s/.test(currentLine)) return;

        event.preventDefault();
        const indent = (currentLine.match(/^\s*/) || [''])[0];
        const insertion = `\n${indent}${APP.BULLET_PREFIX}`;
        textarea.setRangeText(insertion, start, end, 'end');
        autoResizeTextarea(textarea);
        scheduleAutosave();
    }

    function insertBulletForTarget(targetId) {
        const container = document.getElementById(targetId);
        if (!container) return;
        let textarea = document.activeElement;
        if (!textarea || textarea.tagName !== 'TEXTAREA' || !container.contains(textarea)) {
            textarea = container.querySelector('textarea');
        }
        if (!textarea) return;

        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const needsBreak = textarea.value && start > 0 && textarea.value[start - 1] !== '\n';
        const insertion = `${needsBreak ? '\n' : ''}${APP.BULLET_PREFIX}`;
        textarea.setRangeText(insertion, start, end, 'end');
        textarea.focus();
        autoResizeTextarea(textarea);
        scheduleAutosave();
    }

    function createCrewRow(data = {}) {
        const wrapper = document.createElement('div');
        wrapper.className = 'list-item';
        wrapper.innerHTML = `
            <span class="row-number">1.</span>
            <input type="text" class="crew-name" placeholder="Nama crew" value="${escapeHtml(data.name || '')}">
            <select class="crew-level-select">
                <option value="">Pilih</option>
                <option value="1A">1A</option>
                <option value="NS3">NS3</option>
                <option value="NS1">NS1</option>
                <option value="MG3">MG3</option>
                <option value="MG1">MG1</option>
            </select>
            <button type="button" class="btn-remove" aria-label="Hapus crew">×</button>
        `;
        wrapper.querySelector('.crew-level-select').value = data.level || '';
        wrapper.querySelector('.btn-remove').addEventListener('click', () => removeCrewItem(wrapper));
        return wrapper;
    }

    function addCrewItem(animate = true, data = {}) {
        const crewItems = document.getElementById('crewItems');
        const currentCount = crewItems.querySelectorAll('.list-item').length;
        if (currentCount >= APP.MAX_CREW) {
            showToast(`Maksimal ${APP.MAX_CREW} crew members.`, 'warning');
            return;
        }
        crewItems.appendChild(createCrewRow(data));
        updateCrewNumbers();
        logActivity('crew_add', `Menambah crew store. Total crew sekarang ${currentCount + 1}.`);
        scheduleAutosave();
    }

    function removeCrewItem(element) {
        const crewItems = document.getElementById('crewItems');
        const rows = crewItems.querySelectorAll('.list-item');
        if (rows.length <= 1) {
            showToast('Minimal harus ada 1 baris crew.', 'warning');
            return;
        }
        element.remove();
        updateCrewNumbers();
        logActivity('crew_remove', 'Menghapus satu baris crew store.');
        scheduleAutosave();
    }

    function updateCrewNumbers() {
        document.querySelectorAll('#crewItems .list-item').forEach((item, index) => {
            item.querySelector('.row-number').textContent = `${index + 1}.`;
        });
    }

    function createObservationRow(tableBodyId, data = {}) {
        const bulletField = (label, value, placeholder, extraClass = '') => `
            <td data-label="${label}">
                <div class="textarea-bullet-wrap">
                    <textarea class="bullet-textarea ${extraClass}" placeholder="${placeholder}">${escapeHtml(value || '')}</textarea>
                    <button type="button" class="btn-inline-bullet" aria-label="Tambah bullet point">• Bullet Point</button>
                </div>
            </td>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            ${bulletField('Temuan', data.temuan, 'Masukkan temuan...')}
            ${bulletField('Dampak', data.dampak, 'Masukkan dampak...')}
            ${bulletField('Penyebab', data.penyebab, 'Masukkan penyebab...')}
            ${bulletField('Tindakan Perbaikan', data.tindakan, 'Masukkan tindakan perbaikan...')}
            <td data-label="Tanggal Perbaikan / Deadline"><input type="date" value="${escapeHtml(data.deadline || '')}"></td>
            ${bulletField('Hasil', data.hasil, 'Masukkan hasil...')}
            <td data-label="Aksi"><button type="button" class="btn-remove" aria-label="Hapus baris">×</button></td>
        `;
        tr.querySelector('.btn-remove').addEventListener('click', () => removeTableRow(tr, tableBodyId));
        tr.querySelectorAll('.btn-inline-bullet').forEach(button => {
            button.addEventListener('click', () => {
                const textarea = button.closest('.textarea-bullet-wrap')?.querySelector('textarea');
                insertBulletIntoTextarea(textarea);
            });
        });
        tr.querySelectorAll('textarea').forEach(autoResizeTextarea);
        return tr;
    }

    function addTableRow(tableBodyId, schedule = true, data = {}) {
        const tbody = document.getElementById(tableBodyId);
        const rowCount = tbody.querySelectorAll('tr').length;
        if (rowCount >= APP.MAX_TABLE_ROWS) {
            showToast(`Maksimal ${APP.MAX_TABLE_ROWS} row per tabel.`, 'warning');
            return;
        }
        tbody.appendChild(createObservationRow(tableBodyId, data));
        const sectionName = tableBodyId === 'opiTableBody' ? 'OPI Observation' : 'QSC Observation';
        logActivity('row_add', `Menambah row pada ${sectionName}. Total row sekarang ${rowCount + 1}.`);
        if (schedule) scheduleAutosave();
    }

    function removeTableRow(row, tableBodyId) {
        const rows = document.querySelectorAll(`#${tableBodyId} tr`);
        if (rows.length <= 1) {
            showToast('Minimal harus ada 1 row agar tabel tetap aktif.', 'warning');
            return;
        }
        row.remove();
        const sectionName = tableBodyId === 'opiTableBody' ? 'OPI Observation' : 'QSC Observation';
        logActivity('row_remove', `Menghapus row pada ${sectionName}.`);
        scheduleAutosave();
    }

    async function compressImageFile(file, maxDimension = 1600, quality = 0.82) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;
                    const scale = Math.min(1, maxDimension / Math.max(width, height));
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    try {
                        resolve(canvas.toDataURL('image/jpeg', quality));
                    } catch (error) {
                        resolve(event.target.result);
                    }
                };
                img.onerror = () => resolve(event.target.result);
                img.src = event.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function handlePhotoUpload(input, previewId) {
        const file = input.files && input.files[0];
        if (!file) return;
        const preview = document.getElementById(previewId);
        const dataUrl = await compressImageFile(file);
        preview.innerHTML = `<img src="${dataUrl}" alt="Uploaded photo">`;
        preview.classList.add('has-image');
        logActivity('photo_upload', 'Upload foto QSC / Famitrack.');
        scheduleAutosave();
    }

    async function handlePhotoCellUpload(input, previewId) {
        const file = input.files && input.files[0];
        if (!file) return;
        const preview = document.getElementById(previewId);
        const dataUrl = await compressImageFile(file);
        preview.innerHTML = `<img src="${dataUrl}" alt="Uploaded photo">`;
        preview.classList.add('has-image');
        const gridId = input.closest('.photo-grid')?.id || 'photoGrid';
        const sectionLabel = gridId === 'findingEvidenceGrid' ? 'Finding Evidence' : (gridId === 'correctiveActionGrid' ? 'Corrective Action' : 'Photo Grid');
        logActivity('photo_upload', `Upload foto pada section ${sectionLabel}.`);
        scheduleAutosave();
    }

    function createPhotoCell(data = {}, uniqueId = '') {
        const hasImage = Boolean(data.image);
        return `
            <div class="photo-cell">
                <div class="photo-upload-box" data-photo-trigger="photo${uniqueId}">
                    <input type="file" id="photo${uniqueId}" accept="image/*" hidden>
                    <div id="preview${uniqueId}" class="photo-preview ${hasImage ? 'has-image' : ''}">
                        ${hasImage ? `<img src="${data.image}" alt="photo">` : '<span class="upload-icon">📷</span><span class="upload-text">Klik untuk upload foto</span>'}
                    </div>
                </div>
                <textarea id="desc${uniqueId}" class="photo-description auto-grow" rows="2" placeholder="Deskripsi foto...">${escapeHtml(data.description || '')}</textarea>
            </div>
        `;
    }

    function bindPhotoRowEvents(row) {
        row.querySelectorAll('[data-photo-trigger]').forEach(box => {
            const fileId = box.dataset.photoTrigger;
            const input = row.querySelector(`#${CSS.escape(fileId)}`);
            if (input) {
                box.addEventListener('click', () => input.click());
                input.addEventListener('change', event => handlePhotoCellUpload(event.target, `preview${fileId.replace('photo', '')}`));
            }
        });
        row.querySelectorAll('textarea').forEach(autoResizeTextarea);
    }

    function createPhotoRow(photos = [], rowIndex = 0) {
        const row = document.createElement('div');
        row.className = 'photo-row';
        let cells = '';
        for (let i = 0; i < APP.PHOTO_CELLS_PER_ROW; i += 1) {
            const photoData = photos[i] || {};
            const uniqueId = `${Date.now()}_${rowIndex}_${i}_${Math.random().toString(36).slice(2, 7)}`;
            cells += createPhotoCell(photoData, uniqueId);
        }
        row.innerHTML = cells;
        bindPhotoRowEvents(row);
        return row;
    }

    function addPhotoGridRow(gridId, schedule = true, photos = []) {
        const grid = document.getElementById(gridId);
        const currentRows = grid.querySelectorAll('.photo-row').length;
        if (currentRows >= APP.MAX_TABLE_ROWS) {
            showToast(`Maksimal ${APP.MAX_TABLE_ROWS} baris foto.`, 'warning');
            return;
        }
        grid.appendChild(createPhotoRow(photos, currentRows));
        const sectionName = gridId === 'findingEvidenceGrid' ? 'Finding Evidence' : (gridId === 'correctiveActionGrid' ? 'Corrective Action' : 'Photo Grid');
        logActivity('photo_row_add', `Menambah 1 row foto pada ${sectionName}. Total row sekarang ${currentRows + 1}.`);
        if (schedule) scheduleAutosave();
    }

    function toggleSection(sectionId, saveAfter = true) {
        const section = document.getElementById(sectionId);
        const toggleId = {
            qscResultSection: 'toggleQSCResult',
            opiTableSection: 'toggleOPITable',
            qscTableSection: 'toggleQSCTable',
            findingEvidenceSection: 'toggleFindingEvidence',
            correctiveActionSection: 'toggleCorrectiveAction'
        }[sectionId];
        const toggle = document.getElementById(toggleId);
        if (!section || !toggle) return;
        section.style.display = toggle.checked ? 'block' : 'none';
        const sectionMap = {
            qscResultSection: 'QSC / Famitrack Result',
            opiTableSection: 'OPI Observation',
            qscTableSection: 'QSC Observation',
            findingEvidenceSection: 'Finding Evidence',
            correctiveActionSection: 'Corrective Action'
        };
        logActivity('toggle_section', `${sectionMap[sectionId] || sectionId} diubah ke ${toggle.checked ? 'ON' : 'OFF'}.`);
        if (saveAfter) scheduleAutosave();
    }

    function normalizeMultilineText(value, forPdf = false) {
        const raw = String(value || '')
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map(line => line.replace(/\s+$/g, ''))
            .join('\n')
            .trim();
        if (!raw) return '-';
        if (!forPdf) return raw;
        return raw.replace(/^[•]/gm, '-');
    }

    function getObservationRows(tableBodyId) {
        return Array.from(document.querySelectorAll(`#${tableBodyId} tr`)).map(row => {
            const cells = row.querySelectorAll('td');
            return {
                temuan: normalizeMultilineText(cells[0]?.querySelector('textarea')?.value),
                dampak: normalizeMultilineText(cells[1]?.querySelector('textarea')?.value),
                penyebab: normalizeMultilineText(cells[2]?.querySelector('textarea')?.value),
                tindakan: normalizeMultilineText(cells[3]?.querySelector('textarea')?.value),
                deadline: cells[4]?.querySelector('input')?.value || '-',
                hasil: normalizeMultilineText(cells[5]?.querySelector('textarea')?.value)
            };
        }).filter(row => Object.values(row).some(value => value && value !== '-'));
    }

    function getPhotoGridData(gridId) {
        return Array.from(document.querySelectorAll(`#${gridId} .photo-cell`)).map(cell => ({
            image: cell.querySelector('img')?.src || '',
            description: normalizeMultilineText(cell.querySelector('.photo-description')?.value)
        })).filter(item => item.image || item.description !== '-');
    }

    function getFormData() {
        const crewList = Array.from(document.querySelectorAll('#crewItems .list-item')).map(item => ({
            name: item.querySelector('.crew-name')?.value.trim() || '-',
            level: item.querySelector('.crew-level-select')?.value || '-'
        })).filter(item => item.name !== '-' || item.level !== '-');

        const opiData = getObservationRows('opiTableBody');
        const qscData = getObservationRows('qscTableBody');
        const findingEvidencePhotos = getPhotoGridData('findingEvidenceGrid');
        const correctiveActionPhotos = getPhotoGridData('correctiveActionGrid');

        return {
            nama: getNamaAuditor().trim() || '-',
            namaDropdown: document.getElementById('namaDropdown').value || '',
            namaManual: document.getElementById('namaManual').value.trim() || '',
            store: document.getElementById('store').value.trim() || '-',
            tanggal: document.getElementById('tanggal').value || '-',
            storeLeader: document.getElementById('storeLeader').value.trim() || '-',
            storeLeaderLevel: document.getElementById('storeLeaderLevel').value || '-',
            shiftLeader: document.getElementById('shiftLeader').value.trim() || '-',
            shiftLeaderLevel: document.getElementById('shiftLeaderLevel').value || '-',
            crewList,
            qscResultPhoto: {
                image: document.querySelector('#qscResultPreview img')?.src || '',
                description: normalizeMultilineText(document.getElementById('qscResultDesc').value)
            },
            opiData,
            qscData,
            findingEvidencePhotos,
            correctiveActionPhotos,
            storeAssignmentLink: document.getElementById('storeAssignmentLink').value.trim() || '-',
            showQSCResult: document.getElementById('toggleQSCResult').checked,
            showOPITable: document.getElementById('toggleOPITable').checked,
            showQSCTable: document.getElementById('toggleQSCTable').checked,
            showFindingEvidence: document.getElementById('toggleFindingEvidence').checked,
            showCorrectiveAction: document.getElementById('toggleCorrectiveAction').checked
        };
    }

    function collectSaveData() {
        return getFormData();
    }

    function showLoading(title, text, progress = 0) {
        document.getElementById('loadingTitle').textContent = title;
        document.getElementById('loadingText').textContent = text;
        document.getElementById('loadingProgressBar').style.width = `${Math.max(0, Math.min(progress, 100))}%`;
        document.getElementById('loadingOverlay').classList.add('active');
        document.getElementById('loadingOverlay').setAttribute('aria-hidden', 'false');
    }

    function updateLoading(text, progress) {
        if (typeof text === 'string') {
            document.getElementById('loadingText').textContent = text;
        }
        if (typeof progress === 'number') {
            document.getElementById('loadingProgressBar').style.width = `${Math.max(0, Math.min(progress, 100))}%`;
        }
    }

    function hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('active');
        document.getElementById('loadingOverlay').setAttribute('aria-hidden', 'true');
    }

    let toastTimer;
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
    }

    function buildReportId(data) {
        return normalizeText([data.tanggal, data.store, data.nama].join('|')).replace(/\s+/g, '_');
    }

    async function imgToDataUrl(imageSrc) {
        if (!imageSrc) return null;
        return new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.onerror = () => resolve(null);
            img.src = imageSrc;
        });
    }

    async function addImageContain(doc, imageSrc, x, y, width, height) {
        if (!imageSrc) return false;
        const dataUrl = await imgToDataUrl(imageSrc);
        if (!dataUrl) return false;
        const props = doc.getImageProperties(dataUrl);
        const ratio = Math.min(width / props.width, height / props.height);
        const drawWidth = props.width * ratio;
        const drawHeight = props.height * ratio;
        const drawX = x + (width - drawWidth) / 2;
        const drawY = y + (height - drawHeight) / 2;
        doc.addImage(dataUrl, 'JPEG', drawX, drawY, drawWidth, drawHeight);
        return true;
    }

    function drawPdfFooter(doc, pageNumber, totalPages) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setDrawColor(217, 226, 236);
        doc.line(12, pageHeight - 10, pageWidth - 12, pageHeight - 10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(82, 96, 109);
        doc.text(`Generated from Regional Bestie Visit Report`, 12, pageHeight - 5.5);
        doc.text(`Page ${pageNumber} / ${totalPages}`, pageWidth - 12, pageHeight - 5.5, { align: 'right' });
    }

    function drawSectionHeader(doc, title, subtitle = '') {
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.setFillColor(30, 58, 95);
        doc.rect(0, 0, pageWidth, 24, 'F');
        doc.setFillColor(15, 118, 110);
        doc.rect(0, 24, pageWidth, 6, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(title, 14, 15);
        if (subtitle) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(subtitle, 14, 22);
        }
        doc.setTextColor(16, 42, 67);
    }

    function formatDateShort(dateStr) {
        if (!dateStr || dateStr === '-') return '-';
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return dateStr;
        return new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(date);
    }

    async function addCoverPage(doc, data) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFillColor(244, 249, 251);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        doc.setFillColor(30, 58, 95);
        doc.rect(0, 0, pageWidth, 58, 'F');
        doc.setFillColor(15, 118, 110);
        doc.rect(0, 58, pageWidth, 14, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(28);
        doc.setTextColor(255, 255, 255);
        doc.text('Regional Bestie Visit Report', 16, 28);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Laporan audit kunjungan store', 16, 40);

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(16, 82, pageWidth - 32, 94, 8, 8, 'F');
        doc.setDrawColor(217, 226, 236);
        doc.setLineWidth(0.8);
        doc.roundedRect(16, 82, pageWidth - 32, 94, 8, 8, 'S');

        const coverFields = [
            ['Nama Auditor', data.nama],
            ['Store', data.store],
            ['Tanggal Visit', formatDateShort(data.tanggal)],
            ['Total Temuan', String((data.opiData?.length || 0) + (data.qscData?.length || 0))]
        ];

        let fieldY = 100;
        coverFields.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(82, 96, 109);
            doc.text(label, 28, fieldY);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(15);
            doc.setTextColor(16, 42, 67);
            doc.text(String(value || '-'), 28, fieldY + 10);
            fieldY += 17;
        });

        doc.setFillColor(20, 184, 166);
        doc.roundedRect(pageWidth - 102, 104, 68, 38, 8, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Audit', pageWidth - 68, 127, { align: 'center' });
        doc.setTextColor(16, 42, 67);
    }

    function addGeneralInformationPage(doc, data) {
        doc.addPage();
        drawSectionHeader(doc, 'GENERAL INFORMATION', 'Crew in charge dan informasi kunjungan');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(82, 96, 109);
        doc.text(`Hari, Tanggal Visit: ${formatDateShort(data.tanggal)}`, 14, 40);

        const crewTable = [
            ['Store Leader', data.storeLeader || '-', data.storeLeaderLevel || '-'],
            ['Shift Leader', data.shiftLeader || '-', data.shiftLeaderLevel || '-'],
            ...(data.crewList || []).map((crew, index) => [`Crew ${index + 1}`, crew.name || '-', crew.level || '-'])
        ];

        doc.autoTable({
            startY: 48,
            head: [['Role', 'Name', 'Job Level']],
            body: crewTable,
            theme: 'grid',
            margin: { left: 14, right: 14 },
            styles: {
                font: 'helvetica',
                fontSize: 10.5,
                cellPadding: 4,
                lineColor: [217, 226, 236],
                lineWidth: 0.4,
                textColor: [16, 42, 67]
            },
            headStyles: {
                fillColor: [15, 118, 110],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 10.5
            },
            alternateRowStyles: {
                fillColor: [247, 250, 252]
            },
            columnStyles: {
                0: { cellWidth: 62 },
                1: { cellWidth: 148 },
                2: { cellWidth: 48, halign: 'center' }
            }
        });
    }

    async function addSinglePhotoPage(doc, sectionTitle, subtitle, photo) {
        doc.addPage();
        drawSectionHeader(doc, sectionTitle, subtitle);

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const contentX = 14;
        const contentY = 38;
        const contentW = pageWidth - 28;
        const imageBoxH = 125;
        const descY = contentY + imageBoxH + 10;

        doc.setDrawColor(188, 204, 220);
        doc.setFillColor(249, 252, 252);
        doc.roundedRect(contentX, contentY, contentW, imageBoxH, 6, 6, 'FD');

        const photoAdded = await addImageContain(doc, photo.image, contentX + 6, contentY + 6, contentW - 12, imageBoxH - 12);
        if (!photoAdded) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.setTextColor(139, 152, 166);
            doc.text('No Photo Uploaded', pageWidth / 2, contentY + imageBoxH / 2, { align: 'center' });
            doc.setTextColor(16, 42, 67);
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Deskripsi Foto', contentX, descY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        const descLines = doc.splitTextToSize(normalizeMultilineText(photo.description, true), contentW - 4);
        doc.text(descLines, contentX, descY + 8);
    }

    function buildObservationTableBody(rows) {
        if (!rows.length) {
            return [[
                'Belum ada data temuan.',
                '-',
                '-',
                '-',
                '-',
                '-'
            ]];
        }
        return rows.map(row => [
            normalizeMultilineText(row.temuan, true),
            normalizeMultilineText(row.dampak, true),
            normalizeMultilineText(row.penyebab, true),
            normalizeMultilineText(row.tindakan, true),
            row.deadline && row.deadline !== '-' ? formatDateShort(row.deadline) : '-',
            normalizeMultilineText(row.hasil, true)
        ]);
    }

    function addObservationSection(doc, title, rows) {
        doc.addPage();
        doc.autoTable({
            startY: 36,
            head: [['Temuan', 'Dampak', 'Penyebab', 'Tindakan Perbaikan', 'Deadline', 'Hasil']],
            body: buildObservationTableBody(rows),
            theme: 'grid',
            margin: { top: 36, left: 12, right: 12, bottom: 16 },
            pageBreak: 'auto',
            rowPageBreak: 'avoid',
            styles: {
                font: 'helvetica',
                fontSize: 9.2,
                cellPadding: 3.2,
                valign: 'top',
                overflow: 'linebreak',
                lineColor: [217, 226, 236],
                lineWidth: 0.35,
                textColor: [16, 42, 67]
            },
            headStyles: {
                fillColor: [15, 118, 110],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9.4,
                cellPadding: 3.4
            },
            alternateRowStyles: {
                fillColor: [247, 250, 252]
            },
            columnStyles: {
                0: { cellWidth: 44 },
                1: { cellWidth: 42 },
                2: { cellWidth: 42 },
                3: { cellWidth: 62 },
                4: { cellWidth: 30, halign: 'center' },
                5: { cellWidth: 50 }
            },
            didDrawPage: () => {
                drawSectionHeader(doc, title, 'Findings & Root Cause Analysis');
            }
        });
    }

    async function addPhotoGridSection(doc, title, subtitle, photos) {
        const usablePhotos = photos.length ? photos : [{ image: '', description: 'Belum ada foto yang diunggah.' }];
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginX = 12;
        const gap = 4;
        const columns = 4;
        const rowsPerPage = 2;
        const itemsPerPage = columns * rowsPerPage;
        const availableHeight = pageHeight - 42 - 14;
        const cellWidth = (pageWidth - (marginX * 2) - (gap * (columns - 1))) / columns;
        const cellHeight = (availableHeight - gap) / rowsPerPage;
        const photoBoxHeight = cellHeight - 24;

        for (let start = 0; start < usablePhotos.length; start += itemsPerPage) {
            doc.addPage();
            drawSectionHeader(doc, title, subtitle);
            const chunk = usablePhotos.slice(start, start + itemsPerPage);

            for (let row = 0; row < rowsPerPage; row += 1) {
                for (let col = 0; col < columns; col += 1) {
                    const index = row * columns + col;
                    const item = chunk[index];
                    const x = marginX + (cellWidth + gap) * col;
                    const y = 36 + (cellHeight + gap) * row;

                    doc.setFillColor(255, 255, 255);
                    doc.setDrawColor(217, 226, 236);
                    doc.roundedRect(x, y, cellWidth, cellHeight, 3, 3, 'FD');

                    doc.setFillColor(249, 252, 252);
                    doc.roundedRect(x + 2, y + 2, cellWidth - 4, photoBoxHeight - 4, 3, 3, 'F');

                    const added = item ? await addImageContain(doc, item.image, x + 4, y + 4, cellWidth - 8, photoBoxHeight - 8) : false;
                    if (!added) {
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(12);
                        doc.setTextColor(139, 152, 166);
                        doc.text('No Photo', x + (cellWidth / 2), y + (photoBoxHeight / 2), { align: 'center' });
                    }

                    const description = item ? normalizeMultilineText(item.description, true) : '-';
                    const descLines = doc.splitTextToSize(description, cellWidth - 8).slice(0, 3);
                    doc.setTextColor(16, 42, 67);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8.4);
                    doc.text(descLines, x + 4, y + photoBoxHeight + 7);
                }
            }
        }
    }

    function addAssignmentPage(doc, data) {
        doc.addPage();
        drawSectionHeader(doc, 'STORE ASSIGNMENT', 'Corrective Action Purpose');

        const pageWidth = doc.internal.pageSize.getWidth();
        doc.setFillColor(239, 246, 255);
        doc.setDrawColor(147, 197, 253);
        doc.roundedRect(14, 38, pageWidth - 28, 18, 4, 4, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(30, 58, 95);
        const linkText = doc.splitTextToSize(data.storeAssignmentLink || '-', pageWidth - 40).slice(0, 2);
        doc.text(linkText, 20, 46);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(16, 42, 67);
        doc.text('Mekanisme Pelaporan', 14, 70);

        const instructions = [
            '1. Unduh file pada link di atas.',
            '2. Tim store mengisi form berdasarkan temuan pada laporan audit ini.',
            '3. Tindakan perbaikan wajib dilakukan sebelum deadline yang diberikan oleh Regional Bestie.',
            '4. Form tindakan perbaikan yang telah dibuat wajib dikirimkan kembali via email dengan terusan berikut:',
            '   a. Regional Manager',
            '   b. Area Manager',
            '   c. Regional Bestie',
            '   d. FMCU (Bu Sari, Pak Ami, Pak Aufar)'
        ];

        let currentY = 80;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        instructions.forEach(item => {
            const lines = doc.splitTextToSize(item, pageWidth - 32);
            doc.text(lines, 18, currentY);
            currentY += (lines.length * 6) + 2;
        });
    }

    function buildUploadPayload(data, fileName, pdfBase64) {
        const opiCount = data.opiData.length;
        const qscCount = data.qscData.length;
        return {
            auditor: data.nama,
            toko: data.store,
            visitDate: data.tanggal,
            storeLeader: data.storeLeader,
            shiftLeader: data.shiftLeader,
            crewCount: data.crewList.length,
            opiFindings: opiCount,
            qscFindings: qscCount,
            totalFindings: opiCount + qscCount,
            fileName,
            reportId: buildReportId(data),
            pdf: pdfBase64
        };
    }

    async function uploadPDF(payload) {
        const formBody = new URLSearchParams();
        Object.entries(payload).forEach(([key, value]) => {
            formBody.append(key, value == null ? '' : String(value));
        });

        const response = await fetch(APP.API_URL, {
            method: 'POST',
            cache: 'no-store',
            body: formBody
        });

        const raw = await response.text();
        let result = null;

        try {
            result = raw ? JSON.parse(raw) : {};
        } catch (error) {
            throw new Error(raw || 'Response backend bukan JSON yang valid.');
        }

        const normalizedStatus = String(result.status || '').trim().toLowerCase();
        if (!response.ok || !['success', 'ok'].includes(normalizedStatus)) {
            throw new Error(result.message || `Upload gagal (HTTP ${response.status})`);
        }

        return result;
    }

    async function downloadPDF() {
        if (state.activeDownload) return;
        const form = document.getElementById('reportForm');
        const auditorName = getNamaAuditor().trim();
        if (!form.reportValidity() || !auditorName) {
            if (!auditorName) {
                showToast('Nama auditor wajib diisi.', 'warning');
            }
            form.reportValidity();
            return;
        }

        state.activeDownload = true;
        logActivity('download_pdf', 'Memulai proses generate PDF.');
        const downloadButton = document.getElementById('downloadPdfBtn');
        downloadButton.disabled = true;
        showLoading('Menyiapkan PDF', 'Mengumpulkan data form dan memvalidasi input...', 10);

        try {
            const data = getFormData();
            updateLoading('Membuat layout cover dan halaman informasi...', 25);

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4',
                compress: true
            });

            await addCoverPage(doc, data);
            addGeneralInformationPage(doc, data);

            updateLoading('Menyusun section observasi dan evidence...', 45);

            if (data.showQSCResult) {
                await addSinglePhotoPage(doc, 'QSC / FAMITRACK RESULT', 'Foto hasil QSC / Famitrack', data.qscResultPhoto);
            }

            if (data.showOPITable) {
                addObservationSection(doc, 'OPI PROJECT OBSERVATION', data.opiData);
            }

            if (data.showQSCTable) {
                addObservationSection(doc, 'QSC OBSERVATION', data.qscData);
            }

            updateLoading('Mengatur galeri foto agar halaman terisi penuh sebelum pindah page...', 65);

            if (data.showFindingEvidence) {
                await addPhotoGridSection(doc, 'FINDING EVIDENCE', 'OPI & QSC Observation', data.findingEvidencePhotos);
            }

            if (data.showCorrectiveAction) {
                await addPhotoGridSection(doc, 'CORRECTIVE ACTION EVIDENCE', 'Result by Regional Bestie', data.correctiveActionPhotos);
            }

            addAssignmentPage(doc, data);

            updateLoading('Merapikan footer, nomor halaman, dan ukuran tipografi PDF...', 82);

            const totalPages = doc.getNumberOfPages();
            for (let page = 1; page <= totalPages; page += 1) {
                doc.setPage(page);
                drawPdfFooter(doc, page, totalPages);
            }

            const fileName = `Regional_Bestie_Visit_Report_${sanitizeFileName(data.store)}_${sanitizeFileName(data.tanggal)}.pdf`;
            const pdfBase64 = doc.output('datauristring');
            const payload = buildUploadPayload(data, fileName, pdfBase64);

            updateLoading('Sinkronisasi metadata dan file PDF ke Google Spreadsheet / Drive...', 92);

            try {
                const uploadResult = await uploadPDF(payload);
                const successMessage = uploadResult.fileUrl
                    ? 'PDF berhasil dibuat, tersimpan ke Google Drive, dan metadata masuk ke Spreadsheet.'
                    : 'PDF berhasil dibuat dan sinkronisasi backend selesai.';
                showToast(successMessage, 'success');
                setApiConnectionStatus('Sinkronisasi backend aktif dan berhasil menulis data terbaru.', 'success');
                logActivity('upload_success', successMessage, { fileUrl: uploadResult.fileUrl || '' });
            } catch (uploadError) {
                console.error('Upload gagal', uploadError);
                setApiConnectionStatus(`Upload backend gagal: ${uploadError.message}`, 'error');
                showToast(`PDF berhasil dibuat, tetapi sinkron backend gagal: ${uploadError.message}`, 'warning');
                logActivity('upload_error', uploadError.message || 'Sinkron backend gagal.');
            }

            updateLoading('Memulai download file PDF...', 100);
            doc.save(fileName);
            logActivity('download_saved', `File PDF disimpan: ${fileName}`);
        } catch (error) {
            console.error(error);
            showToast('Terjadi error saat membuat PDF. Cek console untuk detail.', 'error');
            logActivity('download_error', error.message || 'Generate PDF gagal.');
        } finally {
            setTimeout(hideLoading, 320);
            downloadButton.disabled = false;
            state.activeDownload = false;
        }
    }

    function openReportDB() {
        if (!('indexedDB' in window)) {
            return Promise.reject(new Error('IndexedDB not supported'));
        }
        if (state.dbPromise) return state.dbPromise;
        state.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(APP.DB_NAME, APP.DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(APP.DB_STORE)) {
                    db.createObjectStore(APP.DB_STORE, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return state.dbPromise;
    }

    async function saveReportState(payload) {
        try {
            const db = await openReportDB();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(APP.DB_STORE, 'readwrite');
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error);
                tx.objectStore(APP.DB_STORE).put({
                    id: APP.DB_KEY,
                    updatedAt: Date.now(),
                    data: payload
                });
            });
        } catch (error) {
            try {
                localStorage.setItem(APP.DB_KEY, JSON.stringify({ updatedAt: Date.now(), data: payload }));
                return true;
            } catch (fallbackError) {
                console.error('Autosave gagal', fallbackError);
                return false;
            }
        }
    }

    async function loadReportState() {
        try {
            const db = await openReportDB();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(APP.DB_STORE, 'readonly');
                const request = tx.objectStore(APP.DB_STORE).get(APP.DB_KEY);
                request.onsuccess = () => resolve(request.result?.data || null);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            try {
                const raw = localStorage.getItem(APP.DB_KEY);
                return raw ? JSON.parse(raw).data || null : null;
            } catch (fallbackError) {
                console.error('Gagal memuat autosave', fallbackError);
                return null;
            }
        }
    }

    async function clearReportState() {
        try {
            const db = await openReportDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(APP.DB_STORE, 'readwrite');
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error);
                tx.objectStore(APP.DB_STORE).delete(APP.DB_KEY);
            });
        } catch (error) {
            localStorage.removeItem(APP.DB_KEY);
        }
        localStorage.removeItem(APP.DB_KEY);
    }

    function scheduleAutosave() {
        if (state.suppressAutosave) return;
        clearTimeout(state.autosaveTimer);
        state.autosaveTimer = setTimeout(() => {
            saveReportState(collectSaveData());
        }, 250);
    }

    function flushAutosaveBeforeLeave() {
        if (state.suppressAutosave) return;
        saveReportState(collectSaveData());
    }

    function renderCrewList(list = []) {
        const crewItems = document.getElementById('crewItems');
        crewItems.innerHTML = '';
        const rows = list.length ? list : [{ name: '', level: '' }];
        rows.forEach(item => crewItems.appendChild(createCrewRow(item)));
        updateCrewNumbers();
    }

    function renderObservationTable(tableBodyId, rows = []) {
        const tbody = document.getElementById(tableBodyId);
        tbody.innerHTML = '';
        const dataRows = rows.length ? rows : [{}];
        dataRows.forEach(row => tbody.appendChild(createObservationRow(tableBodyId, row)));
    }

    function getDefaultPhotoRows(gridId) {
        if (gridId === 'correctiveActionGrid') return APP.DEFAULT_CORRECTIVE_PHOTO_ROWS;
        return APP.DEFAULT_FINDING_PHOTO_ROWS;
    }

    function renderPhotoGrid(gridId, photos = []) {
        const grid = document.getElementById(gridId);
        grid.innerHTML = '';
        if (!photos.length) {
            for (let i = 0; i < getDefaultPhotoRows(gridId); i += 1) {
                grid.appendChild(createPhotoRow([], i));
            }
            return;
        }
        for (let i = 0; i < photos.length; i += APP.PHOTO_CELLS_PER_ROW) {
            grid.appendChild(createPhotoRow(photos.slice(i, i + APP.PHOTO_CELLS_PER_ROW), i));
        }
    }

    function applySavedState(saved) {
        document.getElementById('namaDropdown').value = saved.namaDropdown || '';
        document.getElementById('namaManual').value = saved.namaManual || '';
        handleNamaChange();
        document.getElementById('store').value = saved.store || '';
        document.getElementById('tanggal').value = saved.tanggal || getTodayInputValue();
        document.getElementById('storeLeader').value = saved.storeLeader || '';
        document.getElementById('storeLeaderLevel').value = saved.storeLeaderLevel || '';
        document.getElementById('shiftLeader').value = saved.shiftLeader || '';
        document.getElementById('shiftLeaderLevel').value = saved.shiftLeaderLevel || '';
        document.getElementById('storeAssignmentLink').value = saved.storeAssignmentLink || 'https://tinyurl.com/store-caassignment';

        document.getElementById('toggleQSCResult').checked = saved.showQSCResult ?? false;
        document.getElementById('toggleOPITable').checked = saved.showOPITable ?? false;
        document.getElementById('toggleQSCTable').checked = saved.showQSCTable ?? false;
        document.getElementById('toggleFindingEvidence').checked = saved.showFindingEvidence ?? false;
        document.getElementById('toggleCorrectiveAction').checked = saved.showCorrectiveAction ?? false;

        toggleSection('qscResultSection', false);
        toggleSection('opiTableSection', false);
        toggleSection('qscTableSection', false);
        toggleSection('findingEvidenceSection', false);
        toggleSection('correctiveActionSection', false);

        renderCrewList(saved.crewList || []);
        renderObservationTable('opiTableBody', saved.opiData || []);
        renderObservationTable('qscTableBody', saved.qscData || []);
        renderPhotoGrid('findingEvidenceGrid', saved.findingEvidencePhotos || []);
        renderPhotoGrid('correctiveActionGrid', saved.correctiveActionPhotos || []);

        const qscPreview = document.getElementById('qscResultPreview');
        if (saved.qscResultPhoto?.image) {
            qscPreview.innerHTML = `<img src="${saved.qscResultPhoto.image}" alt="Uploaded photo">`;
            qscPreview.classList.add('has-image');
        } else {
            qscPreview.innerHTML = '<span class="upload-icon">📷</span><span class="upload-text">Klik untuk upload foto QSC / Famitrack</span>';
            qscPreview.classList.remove('has-image');
        }
        document.getElementById('qscResultDesc').value = saved.qscResultPhoto?.description && saved.qscResultPhoto.description !== '-' ? saved.qscResultPhoto.description : '';
        initializeAllTextareas();
    }

    async function hydrateFromLocalDB() {
        state.suppressAutosave = true;
        const saved = await loadReportState();
        if (saved) {
            applySavedState(saved);
        } else {
            initializeAllTextareas();
        }
        state.suppressAutosave = false;
    }

    async function confirmClearData() {
        const confirmed = window.confirm('Yakin mau hapus semua data tersimpan? Data form dan autosave lokal akan dibersihkan.');
        if (!confirmed) return;
        logActivity('clear_form', 'Menghapus seluruh data form lokal.');
        state.suppressAutosave = true;
        await clearReportState();
        window.location.reload();
    }

    // === [RB-JS-SECRET-PANEL] helper panel rahasia responsif ===
    function rememberSecretTrigger() {
        state.secretLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }

    function restoreSecretFocus() {
        if (state.secretLastFocus && typeof state.secretLastFocus.focus === 'function') {
            state.secretLastFocus.focus();
        }
        state.secretLastFocus = null;
    }

    function updateSecretPanelState() {
        const isModalOpen = document.getElementById('secretAuthModal')?.classList.contains('active');
        const isDrawerOpen = document.getElementById('secretActivityDrawer')?.classList.contains('active');
        document.body.classList.toggle('secret-panel-open', Boolean(isModalOpen || isDrawerOpen));
        const accessButton = document.getElementById('secretAccessBtn');
        if (accessButton) {
            accessButton.setAttribute('aria-expanded', isDrawerOpen ? 'true' : 'false');
        }
    }

    function bindSecretActivityEvents() {
        document.getElementById('secretAccessBtn')?.addEventListener('click', openSecretPanel);
        document.getElementById('secretAuthCancelBtn')?.addEventListener('click', () => closeSecretAuthModal());
        document.getElementById('secretAuthSubmitBtn')?.addEventListener('click', submitSecretAuth);
        document.getElementById('closeSecretDrawerBtn')?.addEventListener('click', closeSecretActivityDrawer);
        document.getElementById('refreshActivityLogBtn')?.addEventListener('click', renderSecretActivityPanel);
        document.getElementById('secretAuthModal')?.addEventListener('click', event => {
            if (event.target.id === 'secretAuthModal') closeSecretAuthModal();
        });
        document.getElementById('secretAuthInput')?.addEventListener('keydown', event => {
            if (event.key === 'Enter') submitSecretAuth();
            if (event.key === 'Escape') closeSecretAuthModal();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                closeSecretAuthModal();
                closeSecretActivityDrawer();
            }
        });
        window.addEventListener('resize', updateSecretPanelState);
    }

    function getUsageSessionId() {
        if (state.usageSessionId) return state.usageSessionId;
        let sessionId = sessionStorage.getItem(SECRET_ACTIVITY.SESSION_ID_KEY);
        if (!sessionId) {
            sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            sessionStorage.setItem(SECRET_ACTIVITY.SESSION_ID_KEY, sessionId);
        }
        state.usageSessionId = sessionId;
        return sessionId;
    }

    function getTrackedUserName() {
        const name = getNamaAuditor().trim();
        return name && name !== '__MANUAL__' ? name : '';
    }

    function getTrackedStoreName() {
        return document.getElementById('store')?.value.trim() || '';
    }

    function readActivityLogs() {
        try {
            const raw = localStorage.getItem(SECRET_ACTIVITY.STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function writeActivityLogs(logs) {
        try {
            localStorage.setItem(SECRET_ACTIVITY.STORAGE_KEY, JSON.stringify(logs));
        } catch (error) {
            console.error('Gagal menyimpan activity log', error);
        }
    }

    function buildRealtimeUsageBody(eventType, detail, meta = {}, appendHistory = true) {
        const params = new URLSearchParams();
        params.append('action', 'track_usage');
        params.append('eventType', eventType || 'heartbeat');
        params.append('detail', detail || 'Aktivitas web');
        params.append('auditor', getTrackedUserName());
        params.append('store', getTrackedStoreName());
        params.append('page', 'report');
        params.append('sessionId', getUsageSessionId());
        params.append('appendHistory', appendHistory ? '1' : '0');
        params.append('userAgent', navigator.userAgent || '');
        params.append('url', window.location.href || '');
        Object.entries(meta || {}).forEach(([key, value]) => {
            params.append(`meta_${key}`, value == null ? '' : String(value));
        });
        return params;
    }

    async function sendRealtimeUsage(eventType, detail, meta = {}, appendHistory = true) {
        const currentName = getTrackedUserName();
        if (!currentName) return false;
        try {
            const response = await fetch(APP.API_URL, {
                method: 'POST',
                cache: 'no-store',
                body: buildRealtimeUsageBody(eventType, detail, meta, appendHistory)
            });
            const raw = await response.text();
            let payload = {};
            try {
                payload = raw ? JSON.parse(raw) : {};
            } catch (parseError) {
                payload = {};
            }
            const okStatuses = ['success', 'Success', 'ok', 'OK'];
            if (response.ok && okStatuses.includes(String(payload.status || '').trim())) {
                state.remoteUsageMode = true;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Realtime usage sync gagal', error);
            return false;
        }
    }

    function syncRealtimeUsage(eventType = 'heartbeat', detail = 'Ping aktivitas user.', appendHistory = false, meta = {}) {
        const currentName = getTrackedUserName();
        if (!currentName) return;
        state.lastPresenceName = currentName;
        sendRealtimeUsage(eventType, detail, meta, appendHistory).then(success => {
            if (success && document.getElementById('secretActivityDrawer')?.classList.contains('active')) {
                renderSecretActivityPanel();
            }
        });
    }

    function initializeRealtimeUsageTracking() {
        getUsageSessionId();
        syncRealtimeUsage('session_start', 'User membuka web report.', true);
        clearInterval(state.usageHeartbeatTimer);
        state.usageHeartbeatTimer = setInterval(() => {
            syncRealtimeUsage('heartbeat', 'Heartbeat aktivitas user.', false);
        }, SECRET_ACTIVITY.HEARTBEAT_MS);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                syncRealtimeUsage('tab_focus', 'User kembali aktif di tab report.', false);
            }
        });

        window.addEventListener('beforeunload', () => {
            const name = getTrackedUserName();
            if (!name) return;
            const body = buildRealtimeUsageBody('leave_page', 'User meninggalkan halaman report.', {}, true);
            if (navigator.sendBeacon) {
                navigator.sendBeacon(APP.API_URL, body);
            }
        });
    }

    function logActivity(type, detail, meta = {}) {
        try {
            const logs = readActivityLogs();
            logs.unshift({
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                type,
                detail,
                meta,
                time: new Date().toISOString()
            });
            writeActivityLogs(logs.slice(0, SECRET_ACTIVITY.MAX_LOGS));
            const currentName = getTrackedUserName();
            if (currentName) {
                sendRealtimeUsage(type, detail, meta, true);
            }
            if (document.getElementById('secretActivityDrawer')?.classList.contains('active')) {
                renderSecretActivityPanel();
            }
        } catch (error) {
            console.error('Gagal menulis activity log', error);
        }
    }

    function openSecretPanel() {
        rememberSecretTrigger();
        const isAuthed = sessionStorage.getItem(SECRET_ACTIVITY.SESSION_KEY) === '1';
        if (isAuthed) {
            openSecretActivityDrawer();
            return;
        }
        document.getElementById('secretAuthModal')?.classList.add('active');
        document.getElementById('secretAuthModal')?.setAttribute('aria-hidden', 'false');
        document.getElementById('secretAuthError').textContent = '';
        updateSecretPanelState();
        const input = document.getElementById('secretAuthInput');
        if (input) {
            input.value = '';
            setTimeout(() => input.focus(), 30);
        }
    }

    function closeSecretAuthModal(options = {}) {
        const { restoreFocus = true } = options;
        document.getElementById('secretAuthModal')?.classList.remove('active');
        document.getElementById('secretAuthModal')?.setAttribute('aria-hidden', 'true');
        updateSecretPanelState();
        if (restoreFocus && !document.getElementById('secretActivityDrawer')?.classList.contains('active')) {
            restoreSecretFocus();
        }
    }

    function submitSecretAuth() {
        const input = document.getElementById('secretAuthInput');
        const errorEl = document.getElementById('secretAuthError');
        const code = String(input?.value || '').trim();
        if (code === SECRET_ACTIVITY.AUTH_CODE) {
            sessionStorage.setItem(SECRET_ACTIVITY.SESSION_KEY, '1');
            closeSecretAuthModal({ restoreFocus: false });
            openSecretActivityDrawer();
            logActivity('secret_access', 'Panel aktivitas dibuka dengan kode akses yang valid.');
            return;
        }
        if (errorEl) errorEl.textContent = 'Kode akses tidak valid.';
        logActivity('secret_access_failed', 'Percobaan membuka panel aktivitas gagal.');
    }

    function openSecretActivityDrawer() {
        document.getElementById('secretActivityDrawer')?.classList.add('active');
        document.getElementById('secretActivityDrawer')?.setAttribute('aria-hidden', 'false');
        updateSecretPanelState();
        renderSecretActivityPanel();
        setTimeout(() => document.getElementById('closeSecretDrawerBtn')?.focus(), 30);
    }

    function closeSecretActivityDrawer() {
        document.getElementById('secretActivityDrawer')?.classList.remove('active');
        document.getElementById('secretActivityDrawer')?.setAttribute('aria-hidden', 'true');
        updateSecretPanelState();
        restoreSecretFocus();
    }

    function getActivitySummary(logs) {
        const today = new Date().toISOString().slice(0, 10);
        return {
            total: logs.length,
            today: logs.filter(item => String(item.time || '').slice(0, 10) === today).length,
            downloads: logs.filter(item => ['download_pdf', 'download_saved', 'upload_success'].includes(item.type)).length,
            backendErrors: logs.filter(item => ['backend_check_error', 'upload_error', 'download_error'].includes(item.type)).length
        };
    }

    function formatActivityTime(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(date);
    }

    function prettifyActivityType(type) {
        const labels = {
            session_start: 'Masuk Web',
            identity_update: 'Update Nama',
            heartbeat: 'Heartbeat',
            tab_focus: 'Tab Aktif',
            leave_page: 'Tutup Halaman',
            open_app: 'Buka Web',
            backend_check: 'Backend Check',
            backend_check_error: 'Backend Error',
            crew_add: 'Tambah Crew',
            crew_remove: 'Hapus Crew',
            row_add: 'Tambah Row',
            row_remove: 'Hapus Row',
            photo_row_add: 'Tambah Row Foto',
            photo_upload: 'Upload Foto',
            toggle_section: 'Toggle Section',
            download_pdf: 'Generate PDF',
            upload_success: 'Backend Sync',
            upload_error: 'Backend Sync Error',
            download_saved: 'Download Selesai',
            download_error: 'PDF Error',
            clear_form: 'Clear Form',
            secret_access: 'Panel Dibuka',
            secret_access_failed: 'Akses Ditolak'
        };
        return labels[type] || type;
    }

    async function fetchRemoteUsageDashboard() {
        const response = await fetch(`${APP.API_URL}?action=usage_dashboard&code=${encodeURIComponent(SECRET_ACTIVITY.AUTH_CODE)}&ts=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store'
        });
        const payload = await response.json();
        if (!response.ok || String(payload.status || '').trim().toLowerCase() !== 'success') {
            throw new Error(payload.message || `Dashboard usage gagal (HTTP ${response.status})`);
        }
        return payload;
    }

    function renderUserCards(targetId, users, emptyText) {
        const container = document.getElementById(targetId);
        if (!container) return;
        container.innerHTML = '';
        if (!users.length) {
            container.innerHTML = `<div class="secret-empty"><strong>Belum ada data</strong><p>${escapeHtml(emptyText)}</p></div>`;
            return;
        }
        users.forEach(item => {
            const card = document.createElement('article');
            card.className = 'secret-log-item';
            card.innerHTML = `
                <div class="secret-log-meta">
                    <span>${escapeHtml(item.auditor || 'Tanpa Nama')}</span>
                    <span>${formatActivityTime(item.lastSeen || item.time)}</span>
                </div>
                <strong>${escapeHtml(item.detail || item.store || 'Aktivitas user')}</strong>
                <p>${escapeHtml(item.store ? `Store: ${item.store}` : 'Aktivitas tersimpan di server.')}</p>
            `;
            container.appendChild(card);
        });
    }

    async function renderSecretActivityPanel() {
        const badge = document.getElementById('remoteUsageBadge');
        const activeMeta = document.getElementById('activeUsersMeta');
        const eventsMeta = document.getElementById('recentEventsMeta');
        try {
            const payload = await fetchRemoteUsageDashboard();
            state.remoteUsageMode = true;
            if (badge) badge.textContent = `Real time server • update ${formatActivityTime(payload.generatedAt)}`;
            document.getElementById('activityTotalCount').textContent = Number(payload.summary?.eventsToday || 0);
            document.getElementById('activityTodayCount').textContent = Number(payload.summary?.activeNow || 0);
            document.getElementById('activityDownloadCount').textContent = Number(payload.summary?.uniqueUsersToday || 0);
            document.getElementById('activityErrorCount').textContent = Number(payload.summary?.downloadsToday || 0);
            if (activeMeta) activeMeta.textContent = `${Number(payload.summary?.activeNow || 0)} user sedang aktif pada 2 menit terakhir.`;
            if (eventsMeta) eventsMeta.textContent = `${(payload.recentEvents || []).length} event terbaru dari seluruh user.`;
            renderUserCards('activeUsersList', payload.activeUsers || [], 'Belum ada user aktif saat ini.');
            const eventList = (payload.recentEvents || []).map(item => ({
                auditor: item.auditor,
                time: item.time,
                detail: `${prettifyActivityType(item.eventType)} • ${item.detail || '-'}`,
                store: item.store || '-'
            }));
            renderUserCards('secretLogList', eventList, 'Belum ada riwayat aktivitas di server.');
            return;
        } catch (error) {
            console.error('Gagal memuat dashboard usage real time', error);
            if (badge) badge.textContent = 'Fallback browser lokal';
            const logs = readActivityLogs();
            const summary = getActivitySummary(logs);
            document.getElementById('activityTotalCount').textContent = summary.today;
            document.getElementById('activityTodayCount').textContent = 1;
            document.getElementById('activityDownloadCount').textContent = summary.total;
            document.getElementById('activityErrorCount').textContent = summary.downloads;
            if (activeMeta) activeMeta.textContent = 'Mode lokal. Dashboard server usage belum tersedia.';
            if (eventsMeta) eventsMeta.textContent = 'Menampilkan log browser ini sebagai fallback.';
            renderUserCards('activeUsersList', [{auditor: getTrackedUserName() || 'User lokal', lastSeen: new Date().toISOString(), detail: 'Browser aktif', store: getTrackedStoreName() || '-'}], 'Belum ada user lokal.');
            const fallbackEvents = logs.map(item => ({
                auditor: getTrackedUserName() || 'User lokal',
                time: item.time,
                detail: `${prettifyActivityType(item.type)} • ${item.detail || '-'}`,
                store: getTrackedStoreName() || '-'
            }));
            renderUserCards('secretLogList', fallbackEvents, 'Interaksi utama web akan tampil di panel ini.');
        }
    }


// ==========================================================
// [RB-UPGRADE-PATCH]
// Reliability, security, autosave split, UX upgrades, local PPT export
// ==========================================================
Object.assign(APP, {
    API_URL: (window.RB_CONFIG && window.RB_CONFIG.API_URL) || APP.API_URL || '',
    DB_VERSION: Number((window.RB_CONFIG && window.RB_CONFIG.DB_VERSION) || 3),
    DB_CORE_KEY: (window.RB_CONFIG && window.RB_CONFIG.DB_CORE_KEY) || 'report-state-core',
    DB_MEDIA_KEY: (window.RB_CONFIG && window.RB_CONFIG.DB_MEDIA_KEY) || 'report-state-media',
    AUTOSAVE_DEBOUNCE_MS: Number((window.RB_CONFIG && window.RB_CONFIG.AUTOSAVE_DEBOUNCE_MS) || 450),
    MEDIA_SAVE_DEBOUNCE_MS: Number((window.RB_CONFIG && window.RB_CONFIG.MEDIA_SAVE_DEBOUNCE_MS) || 800)
});
state.mediaSaveTimer = null;
state.lastHealth = null;
state.activePptDownload = false;
SECRET_ACTIVITY.DASHBOARD_CODE_KEY = SECRET_ACTIVITY.DASHBOARD_CODE_KEY || 'rbvr-usage-dashboard-code';
SECRET_ACTIVITY.HEARTBEAT_MS = Number((window.RB_CONFIG && window.RB_CONFIG.HEARTBEAT_MS) || SECRET_ACTIVITY.HEARTBEAT_MS || 25000);
SECRET_ACTIVITY.ACTIVE_WINDOW_MS = Number((window.RB_CONFIG && window.RB_CONFIG.ACTIVE_WINDOW_MS) || SECRET_ACTIVITY.ACTIVE_WINDOW_MS || 120000);

const REPORT_PROGRESS_SECTIONS = [
    {
        key: 'identity',
        label: 'Identitas',
        isDone: () => Boolean(getNamaAuditor().trim() && document.getElementById('store')?.value.trim() && document.getElementById('tanggal')?.value)
    },
    {
        key: 'crew',
        label: 'PIC & Crew',
        isDone: () => {
            const crewCount = Array.from(document.querySelectorAll('#crewItems .crew-name')).filter(input => input.value.trim()).length;
            return Boolean(document.getElementById('storeLeader')?.value.trim() || document.getElementById('shiftLeader')?.value.trim() || crewCount > 0);
        }
    },
    {
        key: 'qscresult',
        label: 'QSC Result',
        isDone: () => {
            const enabled = document.getElementById('toggleQSCResult')?.checked;
            if (!enabled) return true;
            return Boolean(document.querySelector('#qscResultPreview img') || document.getElementById('qscResultDesc')?.value.trim());
        }
    },
    {
        key: 'opi',
        label: 'OPI',
        isDone: () => {
            const enabled = document.getElementById('toggleOPITable')?.checked;
            if (!enabled) return true;
            return getObservationRows('opiTableBody').length > 0;
        }
    },
    {
        key: 'qsc',
        label: 'QSC',
        isDone: () => {
            const enabled = document.getElementById('toggleQSCTable')?.checked;
            if (!enabled) return true;
            return getObservationRows('qscTableBody').length > 0;
        }
    },
    {
        key: 'evidence',
        label: 'Evidence',
        isDone: () => {
            const enabled = document.getElementById('toggleFindingEvidence')?.checked;
            if (!enabled) return true;
            return getPhotoGridData('findingEvidenceGrid').length > 0;
        }
    },
    {
        key: 'corrective',
        label: 'Corrective Action',
        isDone: () => {
            const enabled = document.getElementById('toggleCorrectiveAction')?.checked;
            if (!enabled) return true;
            return getPhotoGridData('correctiveActionGrid').length > 0;
        }
    },
    {
        key: 'assignment',
        label: 'Assignment',
        isDone: () => Boolean(document.getElementById('storeAssignmentLink')?.value.trim())
    }
];

function buildApiUrl(action, params = {}) {
    if (!APP.API_URL) return '';
    const url = new URL(APP.API_URL, window.location.href);
    if (action) url.searchParams.set('action', action);
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
}

async function parseApiResponse(response) {
    const raw = await response.text();
    let payload = {};
    try {
        payload = raw ? JSON.parse(raw) : {};
    } catch (error) {
        payload = {};
    }
    return { raw, payload };
}

async function apiGet(action, params = {}) {
    if (!APP.API_URL) {
        throw new Error('API_URL belum diatur di app-config.js');
    }
    const response = await fetch(buildApiUrl(action, { ...params, ts: Date.now() }), {
        method: 'GET',
        cache: 'no-store'
    });
    const parsed = await parseApiResponse(response);
    return { response, ...parsed };
}

async function apiPost(action, payload = {}, format = 'json') {
    if (!APP.API_URL) {
        throw new Error('API_URL belum diatur di app-config.js');
    }
    const options = {
        method: 'POST',
        cache: 'no-store'
    };

    if (format === 'form') {
        const body = new URLSearchParams();
        body.append('action', action);
        Object.entries(payload || {}).forEach(([key, value]) => {
            body.append(key, value == null ? '' : String(value));
        });
        options.body = body;
    } else {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify({ action, ...payload });
    }

    const response = await fetch(APP.API_URL, options);
    const { raw, payload: parsed } = await parseApiResponse(response);
    const status = String(parsed.status || '').trim().toLowerCase();
    if (!response.ok || !['success', 'ok'].includes(status)) {
        throw new Error(parsed.message || raw || `Request gagal (HTTP ${response.status})`);
    }
    return parsed;
}

function stripMediaFromState(data) {
    const base = { ...(data || {}) };
    delete base.qscResultPhoto;
    delete base.findingEvidencePhotos;
    delete base.correctiveActionPhotos;
    return base;
}

function collectSaveData() {
    return stripMediaFromState(getFormData());
}

function collectMediaState() {
    const data = getFormData();
    return {
        qscResultPhoto: data.qscResultPhoto,
        findingEvidencePhotos: data.findingEvidencePhotos,
        correctiveActionPhotos: data.correctiveActionPhotos
    };
}

function getDraftStorageKeys() {
    return [APP.DB_CORE_KEY, APP.DB_MEDIA_KEY].filter(Boolean);
}

async function saveReportState(payload, storageKey = APP.DB_CORE_KEY) {
    try {
        const db = await openReportDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(APP.DB_STORE, 'readwrite');
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
            tx.objectStore(APP.DB_STORE).put({
                id: storageKey,
                updatedAt: Date.now(),
                data: payload
            });
        });
    } catch (error) {
        try {
            localStorage.setItem(storageKey, JSON.stringify({ updatedAt: Date.now(), data: payload }));
            return true;
        } catch (fallbackError) {
            console.error('Autosave gagal', fallbackError);
            return false;
        }
    }
}

async function loadReportState(storageKey = APP.DB_CORE_KEY) {
    try {
        const db = await openReportDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(APP.DB_STORE, 'readonly');
            const request = tx.objectStore(APP.DB_STORE).get(storageKey);
            request.onsuccess = () => resolve(request.result?.data || null);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        try {
            const raw = localStorage.getItem(storageKey);
            return raw ? JSON.parse(raw).data || null : null;
        } catch (fallbackError) {
            console.error('Gagal memuat autosave', fallbackError);
            return null;
        }
    }
}

async function clearReportState() {
    const keys = getDraftStorageKeys();
    try {
        const db = await openReportDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(APP.DB_STORE, 'readwrite');
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
            const store = tx.objectStore(APP.DB_STORE);
            keys.forEach(key => store.delete(key));
        });
    } catch (error) {
        // noop fallback below
    }
    keys.forEach(key => localStorage.removeItem(key));
}

function scheduleAutosave() {
    if (state.suppressAutosave) return;
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = setTimeout(() => {
        saveReportState(collectSaveData(), APP.DB_CORE_KEY);
    }, APP.AUTOSAVE_DEBOUNCE_MS);
}

function scheduleMediaSave() {
    if (state.suppressAutosave) return;
    clearTimeout(state.mediaSaveTimer);
    state.mediaSaveTimer = setTimeout(() => {
        saveReportState(collectMediaState(), APP.DB_MEDIA_KEY);
    }, APP.MEDIA_SAVE_DEBOUNCE_MS);
}

function flushAutosaveBeforeLeave() {
    if (state.suppressAutosave) return;
    saveReportState(collectSaveData(), APP.DB_CORE_KEY);
    saveReportState(collectMediaState(), APP.DB_MEDIA_KEY);
}

function isMediaField(target) {
    if (!target) return false;
    if (target.id === 'qscResultDesc' || target.id === 'qscResultPhoto') return true;
    if (target.classList?.contains('photo-description')) return true;
    return Boolean(target.closest('.photo-grid'));
}

function getUsageDashboardCode() {
    return sessionStorage.getItem(SECRET_ACTIVITY.DASHBOARD_CODE_KEY) || '';
}

function clearUsageDashboardSession() {
    sessionStorage.removeItem(SECRET_ACTIVITY.SESSION_KEY);
    sessionStorage.removeItem(SECRET_ACTIVITY.DASHBOARD_CODE_KEY);
}

function injectReportEnhancements() {
    injectAuditorSearch();
    injectProgressPanel();
    enhanceUploadAccessibility();

    const pptButton = document.getElementById('tutorialBtn');
    if (pptButton) {
        pptButton.textContent = '📊 Download PPT';
        pptButton.title = 'Ekspor presentasi PPT langsung dari browser tanpa pihak ketiga';
    }

    const buttonGroup = document.querySelector('.button-group');
    if (buttonGroup && !document.getElementById('buttonHelperText')) {
        const note = document.createElement('p');
        note.id = 'buttonHelperText';
        note.className = 'section-helper-note';
        note.textContent = 'Tip: PDF dan PPT sekarang dibuat langsung di browser. Tombol hapus data hanya membersihkan draft lokal.';
        buttonGroup.insertAdjacentElement('afterend', note);
    }
}

function injectAuditorSearch() {
    const select = document.getElementById('namaDropdown');
    if (!select || document.getElementById('auditorSearchInput')) return;

    const search = document.createElement('input');
    search.type = 'search';
    search.id = 'auditorSearchInput';
    search.className = 'auditor-search-input';
    search.placeholder = 'Cari nama auditor...';
    search.autocomplete = 'off';
    search.setAttribute('aria-label', 'Cari auditor');

    select.parentNode.insertBefore(search, select);

    search.addEventListener('input', () => {
        filterAuditorOptions(search.value);
    });
}

function filterAuditorOptions(query = '') {
    const select = document.getElementById('namaDropdown');
    if (!select) return;
    const normalized = normalizeText(query);
    Array.from(select.options).forEach(option => {
        if (!option.value) return;
        if (option.value === '__MANUAL__') {
            option.hidden = false;
            return;
        }
        option.hidden = Boolean(normalized) && !normalizeText(option.textContent).includes(normalized);
    });
}

function syncAuditorSearchValue() {
    const search = document.getElementById('auditorSearchInput');
    const select = document.getElementById('namaDropdown');
    if (!search || !select) return;
    if (select.value && select.value !== '__MANUAL__') {
        search.value = select.value;
    } else if (!document.getElementById('namaManual')?.value.trim()) {
        search.value = '';
    }
}

function injectProgressPanel() {
    if (document.getElementById('reportProgressCard')) return;
    const statusBar = document.getElementById('systemStatusBar');
    if (!statusBar) return;

    const wrapper = document.createElement('section');
    wrapper.id = 'reportProgressCard';
    wrapper.className = 'progress-card';
    wrapper.innerHTML = `
        <div class="progress-card-head">
            <div>
                <h3>Progress Pengisian Report</h3>
                <p>Pantau section yang sudah lengkap sebelum export PDF atau PPT.</p>
            </div>
            <span class="toolbar-badge" id="progressSummaryText">0/0 section siap</span>
        </div>
        <div class="progress-bar-shell" aria-hidden="true">
            <div class="progress-bar-value" id="reportProgressBar"></div>
        </div>
        <div class="progress-chip-grid" id="progressChipGrid"></div>
    `;
    statusBar.insertAdjacentElement('afterend', wrapper);
}

function updateProgressTracker() {
    const grid = document.getElementById('progressChipGrid');
    const summaryText = document.getElementById('progressSummaryText');
    const progressBar = document.getElementById('reportProgressBar');
    if (!grid || !summaryText || !progressBar) return;

    const states = REPORT_PROGRESS_SECTIONS.map(section => ({
        ...section,
        done: Boolean(section.isDone())
    }));
    const completed = states.filter(section => section.done).length;
    const percent = states.length ? Math.round((completed / states.length) * 100) : 0;

    summaryText.textContent = `${completed}/${states.length} section siap`;
    progressBar.style.width = `${percent}%`;
    grid.innerHTML = states.map(section => `
        <span class="progress-chip ${section.done ? 'done' : 'pending'}">
            <strong>${section.done ? '✓' : '•'}</strong>
            <span>${escapeHtml(section.label)}</span>
        </span>
    `).join('');
}

function enhanceUploadTrigger(box, input, label = 'Upload foto') {
    if (!box || !input || box.dataset.accessibilityBound === '1') return;
    box.dataset.accessibilityBound = '1';
    box.setAttribute('role', 'button');
    box.setAttribute('tabindex', '0');
    box.setAttribute('aria-label', label);
    box.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            input.click();
        }
    });
}

function enhanceUploadAccessibility() {
    document.querySelectorAll('[data-trigger-file]').forEach(box => {
        const input = document.getElementById(box.dataset.triggerFile);
        enhanceUploadTrigger(box, input, 'Upload foto QSC atau Famitrack');
    });
    document.querySelectorAll('[data-photo-trigger]').forEach(box => {
        const input = document.getElementById(box.dataset.photoTrigger);
        enhanceUploadTrigger(box, input, 'Upload foto evidence');
    });
}

async function checkApiConnection() {
    if (!APP.API_URL) {
        setApiConnectionStatus('API belum dikonfigurasi. Update app-config.js sebelum sinkronisasi backend dipakai.', 'error');
        return;
    }

    setApiConnectionStatus('Memeriksa koneksi Google Apps Script...', 'pending');
    try {
        const { response, payload } = await apiGet('health');
        state.lastHealth = payload;
        const normalizedStatus = String(payload.status || '').trim().toLowerCase();
        if (!response.ok || !['success', 'ok'].includes(normalizedStatus)) {
            throw new Error(payload.message || `Health check gagal (HTTP ${response.status})`);
        }

        if (payload.readyForUpload === false) {
            setApiConnectionStatus('Backend terhubung, tetapi Script Properties untuk Drive/Spreadsheet belum lengkap.', 'pending');
        } else {
            setApiConnectionStatus('Backend siap. Sinkronisasi Google Drive dan Spreadsheet aktif.', 'success');
        }
        logActivity('backend_check', 'Health check backend sukses.');
    } catch (error) {
        console.error('API health check gagal', error);
        setApiConnectionStatus(`Koneksi backend bermasalah: ${error.message}`, 'error');
        logActivity('backend_check_error', error.message || 'Health check gagal.');
    }
}

function bindStaticEvents() {
    document.getElementById('namaDropdown').addEventListener('change', handleNamaChange);
    document.getElementById('downloadPdfBtn').addEventListener('click', downloadPDF);
    document.getElementById('tutorialBtn').addEventListener('click', goToTutorial);
    document.getElementById('clearDataBtn').addEventListener('click', confirmClearData);
    document.getElementById('addCrewBtn').addEventListener('click', addCrewItem);

    document.querySelectorAll('[data-add-row]').forEach(button => {
        button.addEventListener('click', () => addTableRow(button.dataset.addRow));
    });

    document.querySelectorAll('[data-add-photo-row]').forEach(button => {
        button.addEventListener('click', () => addPhotoGridRow(button.dataset.addPhotoRow));
    });

    document.getElementById('toggleQSCResult').addEventListener('change', () => toggleSection('qscResultSection'));
    document.getElementById('toggleOPITable').addEventListener('change', () => toggleSection('opiTableSection'));
    document.getElementById('toggleQSCTable').addEventListener('change', () => toggleSection('qscTableSection'));
    document.getElementById('toggleFindingEvidence').addEventListener('change', () => toggleSection('findingEvidenceSection'));
    document.getElementById('toggleCorrectiveAction').addEventListener('change', () => toggleSection('correctiveActionSection'));

    document.getElementById('qscResultPhoto').addEventListener('change', event => handlePhotoUpload(event.target, 'qscResultPreview'));
    document.querySelectorAll('[data-trigger-file]').forEach(box => {
        box.addEventListener('click', () => {
            const input = document.getElementById(box.dataset.triggerFile);
            if (input) input.click();
        });
    });

    bindSecretActivityEvents();
    document.addEventListener('input', handleGlobalInput, true);
    document.addEventListener('change', handleGlobalChange, true);
    document.addEventListener('keydown', handleBulletKeydown, true);
    window.addEventListener('beforeunload', flushAutosaveBeforeLeave);
}

function handleGlobalInput(event) {
    const target = event.target;
    if (target.matches('textarea')) {
        autoResizeTextarea(target);
    }
    if (target.matches('input, textarea, select')) {
        if (isMediaField(target)) {
            scheduleMediaSave();
        } else {
            scheduleAutosave();
        }
        updateProgressTracker();
    }
}

function handleGlobalChange(event) {
    if (event.target.matches('input, textarea, select')) {
        if (isMediaField(event.target)) {
            scheduleMediaSave();
        } else {
            scheduleAutosave();
        }
        updateProgressTracker();
    }
    if (['namaDropdown', 'namaManual', 'store'].includes(event.target.id)) {
        syncRealtimeUsage('identity_update', 'Identitas user diperbarui.', true);
    }
}

function handleNamaChange() {
    const dropdown = document.getElementById('namaDropdown');
    const manual = document.getElementById('namaManual');
    const isManual = dropdown.value === '__MANUAL__';
    manual.style.display = isManual ? 'block' : 'none';
    manual.required = isManual;
    if (!isManual) manual.value = '';
    syncAuditorSearchValue();
    updateProgressTracker();
    syncRealtimeUsage('identity_update', 'Nama auditor diperbarui.', true);
}

function goToTutorial(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    downloadPPT();
}

async function handlePhotoUpload(input, previewId) {
    const file = input.files && input.files[0];
    if (!file) return;
    const preview = document.getElementById(previewId);
    const dataUrl = await compressImageFile(file);
    preview.innerHTML = `<img src="${dataUrl}" alt="Uploaded photo">`;
    preview.classList.add('has-image');
    logActivity('photo_upload', 'Upload foto QSC / Famitrack.');
    scheduleMediaSave();
    updateProgressTracker();
}

async function handlePhotoCellUpload(input, previewId) {
    const file = input.files && input.files[0];
    if (!file) return;
    const preview = document.getElementById(previewId);
    const dataUrl = await compressImageFile(file);
    preview.innerHTML = `<img src="${dataUrl}" alt="Uploaded photo">`;
    preview.classList.add('has-image');
    const gridId = input.closest('.photo-grid')?.id || 'photoGrid';
    const sectionLabel = gridId === 'findingEvidenceGrid' ? 'Finding Evidence' : (gridId === 'correctiveActionGrid' ? 'Corrective Action' : 'Photo Grid');
    logActivity('photo_upload', `Upload foto pada section ${sectionLabel}.`);
    scheduleMediaSave();
    updateProgressTracker();
}

function createPhotoCell(data = {}, uniqueId = '') {
    const hasImage = Boolean(data.image);
    return `
        <div class="photo-cell">
            <div class="photo-upload-box" data-photo-trigger="photo${uniqueId}">
                <input type="file" id="photo${uniqueId}" accept="image/*" hidden>
                <div id="preview${uniqueId}" class="photo-preview ${hasImage ? 'has-image' : ''}">
                    ${hasImage ? `<img src="${data.image}" alt="photo">` : '<span class="upload-icon">📷</span><span class="upload-text">Klik untuk upload foto</span>'}
                </div>
            </div>
            <textarea id="desc${uniqueId}" class="photo-description auto-grow" rows="2" placeholder="Deskripsi foto...">${escapeHtml(data.description || '')}</textarea>
        </div>
    `;
}

function bindPhotoRowEvents(row) {
    row.querySelectorAll('[data-photo-trigger]').forEach(box => {
        const fileId = box.dataset.photoTrigger;
        const input = row.querySelector(`#${CSS.escape(fileId)}`);
        if (input) {
            box.addEventListener('click', () => input.click());
            input.addEventListener('change', event => handlePhotoCellUpload(event.target, `preview${fileId.replace('photo', '')}`));
            enhanceUploadTrigger(box, input, 'Upload foto evidence');
        }
    });
    row.querySelectorAll('textarea').forEach(autoResizeTextarea);
}

function addPhotoGridRow(gridId, schedule = true, photos = []) {
    const grid = document.getElementById(gridId);
    const currentRows = grid.querySelectorAll('.photo-row').length;
    if (currentRows >= APP.MAX_TABLE_ROWS) {
        showToast(`Maksimal ${APP.MAX_TABLE_ROWS} baris foto.`, 'warning');
        return;
    }
    grid.appendChild(createPhotoRow(photos, currentRows));
    const sectionName = gridId === 'findingEvidenceGrid' ? 'Finding Evidence' : (gridId === 'correctiveActionGrid' ? 'Corrective Action' : 'Photo Grid');
    logActivity('photo_row_add', `Menambah 1 row foto pada ${sectionName}. Total row sekarang ${currentRows + 1}.`);
    if (schedule) scheduleMediaSave();
    updateProgressTracker();
}

function toggleSection(sectionId, saveAfter = true) {
    const section = document.getElementById(sectionId);
    const toggleId = {
        qscResultSection: 'toggleQSCResult',
        opiTableSection: 'toggleOPITable',
        qscTableSection: 'toggleQSCTable',
        findingEvidenceSection: 'toggleFindingEvidence',
        correctiveActionSection: 'toggleCorrectiveAction'
    }[sectionId];
    const toggle = document.getElementById(toggleId);
    if (!section || !toggle) return;
    section.style.display = toggle.checked ? 'block' : 'none';
    const sectionMap = {
        qscResultSection: 'QSC / Famitrack Result',
        opiTableSection: 'OPI Observation',
        qscTableSection: 'QSC Observation',
        findingEvidenceSection: 'Finding Evidence',
        correctiveActionSection: 'Corrective Action'
    };
    logActivity('toggle_section', `${sectionMap[sectionId] || sectionId} diubah ke ${toggle.checked ? 'ON' : 'OFF'}.`);
    if (saveAfter) scheduleAutosave();
    updateProgressTracker();
}

async function uploadPDF(payload) {
    return apiPost('upload_report', payload, 'json');
}

function applySavedState(saved) {
    document.getElementById('namaDropdown').value = saved.namaDropdown || '';
    document.getElementById('namaManual').value = saved.namaManual || '';
    handleNamaChange();
    document.getElementById('store').value = saved.store || '';
    document.getElementById('tanggal').value = saved.tanggal || getTodayInputValue();
    document.getElementById('storeLeader').value = saved.storeLeader || '';
    document.getElementById('storeLeaderLevel').value = saved.storeLeaderLevel || '';
    document.getElementById('shiftLeader').value = saved.shiftLeader || '';
    document.getElementById('shiftLeaderLevel').value = saved.shiftLeaderLevel || '';
    document.getElementById('storeAssignmentLink').value = saved.storeAssignmentLink || 'https://tinyurl.com/store-caassignment';

    document.getElementById('toggleQSCResult').checked = saved.showQSCResult ?? false;
    document.getElementById('toggleOPITable').checked = saved.showOPITable ?? false;
    document.getElementById('toggleQSCTable').checked = saved.showQSCTable ?? false;
    document.getElementById('toggleFindingEvidence').checked = saved.showFindingEvidence ?? false;
    document.getElementById('toggleCorrectiveAction').checked = saved.showCorrectiveAction ?? false;

    toggleSection('qscResultSection', false);
    toggleSection('opiTableSection', false);
    toggleSection('qscTableSection', false);
    toggleSection('findingEvidenceSection', false);
    toggleSection('correctiveActionSection', false);

    renderCrewList(saved.crewList || []);
    renderObservationTable('opiTableBody', saved.opiData || []);
    renderObservationTable('qscTableBody', saved.qscData || []);
    renderPhotoGrid('findingEvidenceGrid', saved.findingEvidencePhotos || []);
    renderPhotoGrid('correctiveActionGrid', saved.correctiveActionPhotos || []);

    const qscPreview = document.getElementById('qscResultPreview');
    if (saved.qscResultPhoto?.image) {
        qscPreview.innerHTML = `<img src="${saved.qscResultPhoto.image}" alt="Uploaded photo">`;
        qscPreview.classList.add('has-image');
    } else {
        qscPreview.innerHTML = '<span class="upload-icon">📷</span><span class="upload-text">Klik untuk upload foto QSC / Famitrack</span>';
        qscPreview.classList.remove('has-image');
    }
    document.getElementById('qscResultDesc').value = saved.qscResultPhoto?.description && saved.qscResultPhoto.description !== '-' ? saved.qscResultPhoto.description : '';
    initializeAllTextareas();
    enhanceUploadAccessibility();
    syncAuditorSearchValue();
    updateProgressTracker();
}

async function hydrateFromLocalDB() {
    state.suppressAutosave = true;
    const [savedCore, savedMedia] = await Promise.all([
        loadReportState(APP.DB_CORE_KEY),
        loadReportState(APP.DB_MEDIA_KEY)
    ]);
    const saved = { ...(savedCore || {}), ...(savedMedia || {}) };
    if (Object.keys(saved).length) {
        applySavedState(saved);
    } else {
        initializeAllTextareas();
        enhanceUploadAccessibility();
        updateProgressTracker();
    }
    state.suppressAutosave = false;
}

async function confirmClearData() {
    const confirmed = window.confirm('Yakin mau hapus semua data tersimpan? Data form dan autosave lokal akan dibersihkan.');
    if (!confirmed) return;
    logActivity('clear_form', 'Menghapus seluruh data form lokal.');
    state.suppressAutosave = true;
    await clearReportState();
    document.getElementById('reportForm').reset();
    setDefaultVisitDate();
    bootstrapDynamicSections();
    renderCrewList([]);
    renderObservationTable('opiTableBody', []);
    renderObservationTable('qscTableBody', []);
    renderPhotoGrid('findingEvidenceGrid', []);
    renderPhotoGrid('correctiveActionGrid', []);
    document.getElementById('qscResultPreview').innerHTML = '<span class="upload-icon">📷</span><span class="upload-text">Klik untuk upload foto QSC / Famitrack</span>';
    document.getElementById('qscResultPreview').classList.remove('has-image');
    document.getElementById('qscResultDesc').value = '';
    state.suppressAutosave = false;
    syncAuditorSearchValue();
    enhanceUploadAccessibility();
    updateProgressTracker();
    showToast('Semua data lokal berhasil dibersihkan.', 'success');
}

function buildRealtimeUsageBody(eventType, detail, meta = {}, appendHistory = true) {
    const params = new URLSearchParams();
    params.append('action', 'track_usage');
    params.append('eventType', eventType || 'heartbeat');
    params.append('detail', detail || 'Aktivitas web');
    params.append('auditor', getTrackedUserName());
    params.append('store', getTrackedStoreName());
    params.append('page', 'report');
    params.append('sessionId', getUsageSessionId());
    params.append('appendHistory', appendHistory ? '1' : '0');
    params.append('userAgent', navigator.userAgent || '');
    params.append('url', window.location.href || '');
    Object.entries(meta || {}).forEach(([key, value]) => {
        params.append(`meta_${key}`, value == null ? '' : String(value));
    });
    return params;
}

async function sendRealtimeUsage(eventType, detail, meta = {}, appendHistory = true) {
    const currentName = getTrackedUserName();
    if (!currentName || !APP.API_URL) return false;
    try {
        const payload = {};
        buildRealtimeUsageBody(eventType, detail, meta, appendHistory).forEach((value, key) => {
            payload[key] = value;
        });
        await apiPost('track_usage', payload, 'form');
        state.remoteUsageMode = true;
        return true;
    } catch (error) {
        console.error('Realtime usage sync gagal', error);
        return false;
    }
}

function openSecretPanel() {
    rememberSecretTrigger();
    const isAuthed = sessionStorage.getItem(SECRET_ACTIVITY.SESSION_KEY) === '1';
    const hasCode = Boolean(getUsageDashboardCode());
    if (isAuthed && hasCode) {
        openSecretActivityDrawer();
        return;
    }
    document.getElementById('secretAuthModal')?.classList.add('active');
    document.getElementById('secretAuthModal')?.setAttribute('aria-hidden', 'false');
    document.getElementById('secretAuthError').textContent = '';
    updateSecretPanelState();
    const input = document.getElementById('secretAuthInput');
    if (input) {
        input.value = '';
        input.placeholder = 'Masukkan kode dashboard';
        setTimeout(() => input.focus(), 30);
    }
}

async function submitSecretAuth() {
    const input = document.getElementById('secretAuthInput');
    const errorEl = document.getElementById('secretAuthError');
    const code = String(input?.value || '').trim();
    if (!code) {
        if (errorEl) errorEl.textContent = 'Kode dashboard wajib diisi.';
        return;
    }
    if (errorEl) errorEl.textContent = 'Memverifikasi akses dashboard...';

    try {
        await fetchRemoteUsageDashboard(code);
        sessionStorage.setItem(SECRET_ACTIVITY.SESSION_KEY, '1');
        sessionStorage.setItem(SECRET_ACTIVITY.DASHBOARD_CODE_KEY, code);
        closeSecretAuthModal({ restoreFocus: false });
        openSecretActivityDrawer();
        logActivity('secret_access', 'Panel aktivitas dibuka dengan kredensial dashboard yang valid.');
        if (errorEl) errorEl.textContent = '';
    } catch (error) {
        clearUsageDashboardSession();
        if (errorEl) errorEl.textContent = error.message || 'Kode dashboard tidak valid.';
        logActivity('secret_access_failed', 'Percobaan membuka panel aktivitas gagal.');
    }
}

function prettifyActivityType(type) {
    const labels = {
        session_start: 'Masuk Web',
        identity_update: 'Update Nama',
        heartbeat: 'Heartbeat',
        tab_focus: 'Tab Aktif',
        leave_page: 'Tutup Halaman',
        open_app: 'Buka Web',
        backend_check: 'Backend Check',
        backend_check_error: 'Backend Error',
        crew_add: 'Tambah Crew',
        crew_remove: 'Hapus Crew',
        row_add: 'Tambah Row',
        row_remove: 'Hapus Row',
        photo_row_add: 'Tambah Row Foto',
        photo_upload: 'Upload Foto',
        toggle_section: 'Toggle Section',
        download_pdf: 'Generate PDF',
        download_ppt: 'Download PPT',
        upload_success: 'Backend Sync',
        upload_error: 'Backend Sync Error',
        download_saved: 'Download Selesai',
        download_error: 'PDF Error',
        clear_form: 'Clear Form',
        secret_access: 'Panel Dibuka',
        secret_access_failed: 'Akses Ditolak'
    };
    return labels[type] || type;
}

async function fetchRemoteUsageDashboard(code = getUsageDashboardCode()) {
    if (!code) {
        throw new Error('Kode dashboard belum tersedia.');
    }
    return apiPost('usage_dashboard', {
        code,
        activeWindowMs: SECRET_ACTIVITY.ACTIVE_WINDOW_MS
    }, 'json');
}

function chunkItems(items, size) {
    const result = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
}

function buildObservationNarratives(rows = []) {
    return rows.map((row, index) => {
        const parts = [
            `Temuan: ${normalizeMultilineText(row.temuan)}`,
            `Dampak: ${normalizeMultilineText(row.dampak)}`,
            `Penyebab: ${normalizeMultilineText(row.penyebab)}`,
            `Tindakan: ${normalizeMultilineText(row.tindakan)}`,
            `Deadline: ${row.deadline || '-'}`,
            `Hasil: ${normalizeMultilineText(row.hasil)}`
        ];
        return `${index + 1}. ${parts.join(' | ')}`;
    });
}

function buildPhotoEntries(data) {
    const photos = [];
    if (data.qscResultPhoto?.image) {
        photos.push({
            title: 'QSC / Famitrack Result',
            image: data.qscResultPhoto.image,
            description: normalizeMultilineText(data.qscResultPhoto.description)
        });
    }
    (data.findingEvidencePhotos || []).forEach((item, index) => {
        if (item.image) {
            photos.push({
                title: `Evidence ${index + 1}`,
                image: item.image,
                description: normalizeMultilineText(item.description)
            });
        }
    });
    (data.correctiveActionPhotos || []).forEach((item, index) => {
        if (item.image) {
            photos.push({
                title: `Corrective Action ${index + 1}`,
                image: item.image,
                description: normalizeMultilineText(item.description)
            });
        }
    });
    return photos;
}

function addPptHeader(slide, title, subtitle = '') {
    slide.addText(title, {
        x: 0.45,
        y: 0.32,
        w: 11.8,
        h: 0.42,
        fontFace: 'Poppins',
        fontSize: 24,
        bold: true,
        color: '1E3A5F'
    });
    if (subtitle) {
        slide.addText(subtitle, {
            x: 0.45,
            y: 0.78,
            w: 11.8,
            h: 0.28,
            fontFace: 'Inter',
            fontSize: 10,
            color: '475569'
        });
    }
    slide.addShape('rect', {
        x: 0.45,
        y: 1.05,
        w: 12.1,
        h: 0.06,
        line: { color: '14B8A6', transparency: 100 },
        fill: { color: '14B8A6' }
    });
}

function addPptFooter(slide, note = 'Regional Bestie Visit Report') {
    slide.addText(note, {
        x: 0.45,
        y: 6.95,
        w: 6.5,
        h: 0.18,
        fontFace: 'Inter',
        fontSize: 8,
        color: '64748B'
    });
}

function addPptSummaryCard(slide, x, y, label, value) {
    slide.addShape('roundRect', {
        x,
        y,
        w: 2.85,
        h: 1.05,
        rectRadius: 0.08,
        line: { color: 'D7E2EC', transparency: 0 },
        fill: { color: 'F8FAFC' }
    });
    slide.addText(label, {
        x: x + 0.18,
        y: y + 0.18,
        w: 2.45,
        h: 0.18,
        fontSize: 10,
        color: '64748B',
        fontFace: 'Inter'
    });
    slide.addText(String(value), {
        x: x + 0.18,
        y: y + 0.44,
        w: 2.45,
        h: 0.3,
        fontSize: 20,
        bold: true,
        color: '1E3A5F',
        fontFace: 'Poppins'
    });
}

function addPptBulletSlides(pptx, title, subtitle, items) {
    chunkItems(items, 5).forEach((chunk, index) => {
        const slide = pptx.addSlide();
        addPptHeader(slide, `${title}${index ? ` (${index + 1})` : ''}`, subtitle);
        let y = 1.28;
        chunk.forEach(item => {
            slide.addShape('roundRect', {
                x: 0.52,
                y,
                w: 12.0,
                h: 0.92,
                rectRadius: 0.05,
                line: { color: 'D7E2EC', transparency: 0 },
                fill: { color: 'FFFFFF' }
            });
            slide.addText(item, {
                x: 0.7,
                y: y + 0.16,
                w: 11.55,
                h: 0.62,
                fontFace: 'Inter',
                fontSize: 11,
                color: '18324B',
                valign: 'mid',
                fit: 'shrink'
            });
            y += 1.02;
        });
        addPptFooter(slide);
    });
}

function addPptPhotoSlides(pptx, photos) {
    chunkItems(photos, 2).forEach((chunk, index) => {
        const slide = pptx.addSlide();
        addPptHeader(slide, `Lampiran Foto${index ? ` (${index + 1})` : ''}`, 'Foto hasil audit yang diambil langsung dari form.');
        chunk.forEach((item, photoIndex) => {
            const x = photoIndex === 0 ? 0.58 : 6.55;
            slide.addShape('roundRect', {
                x,
                y: 1.3,
                w: 5.35,
                h: 4.55,
                rectRadius: 0.08,
                line: { color: 'D7E2EC', transparency: 0 },
                fill: { color: 'FFFFFF' }
            });
            slide.addText(item.title, {
                x: x + 0.18,
                y: 1.48,
                w: 4.8,
                h: 0.24,
                fontSize: 12,
                bold: true,
                color: '1E3A5F',
                fontFace: 'Poppins'
            });
            slide.addImage({
                data: item.image,
                x: x + 0.18,
                y: 1.82,
                w: 4.95,
                h: 3.0
            });
            slide.addText(item.description && item.description !== '-' ? item.description : 'Tanpa deskripsi tambahan.', {
                x: x + 0.18,
                y: 4.98,
                w: 4.95,
                h: 0.58,
                fontSize: 10,
                color: '475569',
                fontFace: 'Inter',
                fit: 'shrink'
            });
        });
        addPptFooter(slide);
    });
}

async function downloadPPT() {
    if (state.activePptDownload) return;
    const form = document.getElementById('reportForm');
    const auditorName = getNamaAuditor().trim();
    if (!form.reportValidity() || !auditorName) {
        if (!auditorName) showToast('Nama auditor wajib diisi.', 'warning');
        form.reportValidity();
        return;
    }

    const PptxConstructor = window.PptxGenJS;
    if (!PptxConstructor) {
        showToast('Library PPT belum termuat. Refresh halaman lalu coba lagi.', 'error');
        return;
    }

    const button = document.getElementById('tutorialBtn');
    state.activePptDownload = true;
    if (button) button.disabled = true;
    showLoading('Menyiapkan PPT', 'Menyusun ringkasan presentasi dari data report...', 12);

    try {
        const data = getFormData();
        const pptx = new PptxConstructor();
        const visitDate = data.tanggal || getTodayInputValue();
        const fileName = `VisitReport_${sanitizeFileName(data.store)}_${sanitizeFileName(auditorName)}_${visitDate}.pptx`;

        pptx.layout = 'LAYOUT_WIDE';
        pptx.author = 'OpenAI';
        pptx.company = 'Regional Bestie';
        pptx.subject = 'Regional Bestie Visit Report';
        pptx.title = `Visit Report ${data.store}`;
        pptx.lang = 'id-ID';

        updateLoading('Membuat slide ringkasan utama...', 28);
        const titleSlide = pptx.addSlide();
        addPptHeader(titleSlide, 'Regional Bestie Visit Report', 'Deck presentasi otomatis yang dihasilkan langsung dari form report.');
        titleSlide.addText(`${data.store} • ${visitDate}`, {
            x: 0.5,
            y: 1.45,
            w: 8.4,
            h: 0.42,
            fontFace: 'Poppins',
            fontSize: 21,
            bold: true,
            color: '0F766E'
        });
        titleSlide.addText(`Auditor: ${auditorName}\nStore Leader: ${data.storeLeader || '-'}\nShift Leader: ${data.shiftLeader || '-'}`, {
            x: 0.5,
            y: 2.1,
            w: 5.0,
            h: 1.2,
            fontFace: 'Inter',
            fontSize: 14,
            color: '18324B'
        });
        addPptSummaryCard(titleSlide, 0.55, 3.85, 'Crew', data.crewList.length);
        addPptSummaryCard(titleSlide, 3.55, 3.85, 'OPI Findings', data.opiData.length);
        addPptSummaryCard(titleSlide, 6.55, 3.85, 'QSC Findings', data.qscData.length);
        addPptSummaryCard(titleSlide, 9.55, 3.85, 'Total Findings', data.opiData.length + data.qscData.length);
        titleSlide.addText('Export PPT ini menggantikan alur convert PDF ke layanan pihak ketiga, sehingga file audit tetap diproses secara lokal di browser.', {
            x: 0.55,
            y: 5.35,
            w: 11.8,
            h: 0.8,
            fontFace: 'Inter',
            fontSize: 12,
            color: '475569'
        });
        addPptFooter(titleSlide);

        updateLoading('Menyusun slide observasi dan temuan...', 52);
        const overviewSlide = pptx.addSlide();
        addPptHeader(overviewSlide, 'Ringkasan Audit', 'Highlight cepat untuk presentasi manajemen.');
        overviewSlide.addText(`Store Assignment Link:\n${data.storeAssignmentLink || '-'}`, {
            x: 0.58,
            y: 1.35,
            w: 5.5,
            h: 0.8,
            fontSize: 13,
            color: '18324B',
            fontFace: 'Inter'
        });
        overviewSlide.addText(`Section aktif:\n• QSC Result: ${data.showQSCResult ? 'Ya' : 'Tidak'}\n• OPI Observation: ${data.showOPITable ? 'Ya' : 'Tidak'}\n• QSC Observation: ${data.showQSCTable ? 'Ya' : 'Tidak'}\n• Evidence: ${data.showFindingEvidence ? 'Ya' : 'Tidak'}\n• Corrective Action: ${data.showCorrectiveAction ? 'Ya' : 'Tidak'}`, {
            x: 6.45,
            y: 1.35,
            w: 5.4,
            h: 1.2,
            fontSize: 13,
            color: '18324B',
            fontFace: 'Inter'
        });
        overviewSlide.addText(`Crew In Charge:\n${(data.crewList || []).map(item => `• ${item.name || '-'} (${item.level || '-'})`).join('\n') || '• Belum diisi'}`, {
            x: 0.58,
            y: 2.55,
            w: 11.2,
            h: 2.2,
            fontSize: 12,
            color: '18324B',
            fontFace: 'Inter',
            fit: 'shrink'
        });
        addPptFooter(overviewSlide);

        const opiNarratives = buildObservationNarratives(data.opiData);
        const qscNarratives = buildObservationNarratives(data.qscData);
        if (opiNarratives.length) {
            addPptBulletSlides(pptx, 'OPI Observation', 'Daftar temuan OPI yang terisi di form.', opiNarratives);
        }
        if (qscNarratives.length) {
            addPptBulletSlides(pptx, 'QSC Observation', 'Daftar temuan QSC yang terisi di form.', qscNarratives);
        }

        updateLoading('Menambahkan lampiran foto ke presentasi...', 76);
        const photoEntries = buildPhotoEntries(data);
        if (photoEntries.length) {
            addPptPhotoSlides(pptx, photoEntries);
        }

        updateLoading('Menyimpan file PPTX...', 92);
        await pptx.writeFile({ fileName });
        showToast('PPT berhasil dibuat dan diunduh.', 'success');
        logActivity('download_ppt', `File PPT disimpan: ${fileName}`);
    } catch (error) {
        console.error(error);
        showToast(`Gagal membuat PPT: ${error.message}`, 'error');
    } finally {
        setTimeout(hideLoading, 320);
        if (button) button.disabled = false;
        state.activePptDownload = false;
    }
}

async function initializeApp() {
    injectReportEnhancements();
    bindStaticEvents();
    updateSecretPanelState();
    setDefaultVisitDate();
    bootstrapDynamicSections();
    await hydrateFromLocalDB();
    initializeRealtimeUsageTracking();
    checkApiConnection();
    updateProgressTracker();
    logActivity('open_app', 'Membuka halaman report audit.');
}
