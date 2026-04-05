(function () {
  const shared = window.RBAdminShared;
  if (!shared) return;

  const FEATURE_DEFS = [
    { key: 'qscResult', title: 'QSC / Famitrack Result', desc: 'Tampilkan atau matikan section upload hasil QSC / Famitrack.' },
    { key: 'opiTable', title: 'OPI Observation', desc: 'Kontrol section tabel OPI Findings & Root Cause Analysis.' },
    { key: 'qscTable', title: 'QSC Observation', desc: 'Kontrol section tabel QSC Findings & Root Cause Analysis.' },
    { key: 'findingEvidence', title: 'Bukti Temuan', desc: 'Aktifkan / nonaktifkan section foto bukti temuan.' },
    { key: 'correctiveAction', title: 'Corrective Action Evidence', desc: 'Atur tampil/tidaknya section corrective action evidence.' },
    { key: 'assignmentSection', title: 'Store Assignment', desc: 'Kontrol section assignment link dan reminder corrective action.' },
    { key: 'progressDock', title: 'Bar Status Progress', desc: 'Bar status bawah dibuat compact dan bisa dimatikan total bila perlu.' }
  ];

  const state = {
    code: '',
    dirty: false,
    config: shared.buildDefaultConfig(),
    source: 'default',
    remoteAvailable: false
  };

  function $(id) {
    return document.getElementById(id);
  }

  function showToast(message, tone = 'success') {
    const toast = $('adminToast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${tone}`;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.className = 'toast';
    }, 2600);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  function markDirty(flag = true) {
    state.dirty = flag;
    const badge = $('adminDirtyBadge');
    if (badge) {
      badge.textContent = flag ? 'Belum dipublish' : 'Sudah sinkron';
      badge.classList.toggle('warn', flag);
    }
  }

  function syncPageMeta() {
    const sourceChip = $('adminSourceChip');
    if (sourceChip) {
      sourceChip.textContent = state.source === 'server' ? 'Source: Server' : (state.source === 'local' ? 'Source: Browser' : 'Source: Default');
    }
    const status = $('adminSaveStatus');
    if (status) {
      const lastUpdated = state.config.meta && state.config.meta.updatedAt ? formatDate(state.config.meta.updatedAt) : '-';
      const updatedBy = state.config.meta && state.config.meta.updatedBy ? state.config.meta.updatedBy : 'System';
      status.textContent = `Terakhir update: ${lastUpdated} • Oleh: ${updatedBy}`;
    }
  }

  function renderSummary() {
    const config = state.config;
    const summary = [
      { label: 'Store Master', value: (config.masters.stores || []).length, meta: 'Dropdown store + kode toko' },
      { label: 'Auditor Master', value: (config.masters.auditors || []).length, meta: 'Nama auditor dan NIK' },
      { label: 'Level Master', value: (config.masters.levels || []).length, meta: 'Job level tersedia' },
      { label: 'Fitur Aktif', value: Object.values(config.features || {}).filter(Boolean).length, meta: 'Section web yang sedang ON' }
    ];
    $('adminSummaryGrid').innerHTML = summary.map(item => `
      <article class="admin-stat-card">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
        <small>${escapeHtml(item.meta)}</small>
      </article>
    `).join('');
  }

  function renderFeatureCards() {
    $('adminFeatureGrid').innerHTML = FEATURE_DEFS.map(item => `
      <article class="admin-feature-card">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.desc)}</p>
        </div>
        <label class="toggle-container admin-toggle-wrap">
          <input type="checkbox" data-feature-toggle="${escapeHtml(item.key)}" ${state.config.features[item.key] ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </article>
    `).join('');
  }

  function renderLinkInputs() {
    $('adminOpiLink').value = state.config.links.opiReport || '';
    $('adminAssignmentLink').value = state.config.links.assignment || '';
  }

  function buildStoreListMarkup(items, query) {
    const normalizedQuery = shared.normalizeText(query);
    const filtered = (items || []).filter(item => {
      const store = shared.normalizeStoreItem(item);
      const haystack = shared.normalizeText(`${store.code} ${store.name} ${store.type} ${store.city} ${store.province}`);
      return !normalizedQuery || haystack.includes(normalizedQuery);
    });
    const visible = filtered.slice(0, 160);
    if (!visible.length) {
      return '<div class="admin-empty-state">Belum ada store yang cocok.</div>';
    }
    const markup = visible.map(item => {
      const store = shared.normalizeStoreItem(item);
      const meta = [store.type, store.city, store.province].filter(Boolean).join(' • ') || 'Tanpa metadata lokasi';
      const key = store.code || store.name;
      return `
        <div class="admin-list-item">
          <span><strong>${escapeHtml(shared.formatStoreLabel(store))}</strong><small>${escapeHtml(meta)}</small></span>
          <button type="button" class="btn btn-ghost btn-mini" data-remove-type="stores" data-remove-key="${escapeHtml(key)}">Hapus</button>
        </div>
      `;
    }).join('');
    if (filtered.length > visible.length) {
      return markup + `<div class="admin-list-footnote">Menampilkan ${visible.length} dari ${filtered.length} store.</div>`;
    }
    return markup;
  }

  function buildAuditorListMarkup(items, query) {
    const normalizedQuery = shared.normalizeText(query);
    const filtered = (items || []).filter(item => {
      const auditor = shared.normalizeAuditorItem(item);
      const haystack = shared.normalizeText(`${auditor.name} ${auditor.nik}`);
      return !normalizedQuery || haystack.includes(normalizedQuery);
    });
    const visible = filtered.slice(0, 160);
    if (!visible.length) {
      return '<div class="admin-empty-state">Belum ada auditor yang cocok.</div>';
    }
    const markup = visible.map(item => {
      const auditor = shared.normalizeAuditorItem(item);
      const meta = auditor.nik ? `NIK: ${auditor.nik}` : 'NIK belum diisi';
      return `
        <div class="admin-list-item">
          <span><strong>${escapeHtml(auditor.name)}</strong><small>${escapeHtml(meta)}</small></span>
          <button type="button" class="btn btn-ghost btn-mini" data-remove-type="auditors" data-remove-key="${escapeHtml(auditor.name)}">Hapus</button>
        </div>
      `;
    }).join('');
    if (filtered.length > visible.length) {
      return markup + `<div class="admin-list-footnote">Menampilkan ${visible.length} dari ${filtered.length} auditor.</div>`;
    }
    return markup;
  }

  function buildLevelListMarkup(items, query) {
    const normalizedQuery = shared.normalizeText(query);
    const filtered = (items || []).filter(item => !normalizedQuery || shared.normalizeText(item).includes(normalizedQuery));
    const visible = filtered.slice(0, 150);
    if (!visible.length) {
      return '<div class="admin-empty-state">Belum ada level yang cocok.</div>';
    }
    const markup = visible.map(item => `
      <div class="admin-list-item">
        <span><strong>${escapeHtml(item)}</strong><small>Dipakai untuk Store Leader, Shift Leader, dan Crew</small></span>
        <button type="button" class="btn btn-ghost btn-mini" data-remove-type="levels" data-remove-key="${escapeHtml(item)}">Hapus</button>
      </div>
    `).join('');
    if (filtered.length > visible.length) {
      return markup + `<div class="admin-list-footnote">Menampilkan ${visible.length} dari ${filtered.length} level.</div>`;
    }
    return markup;
  }

  function renderMasterLists() {
    const masters = state.config.masters || {};
    $('adminStoreCount').textContent = `${(masters.stores || []).length} store`;
    $('adminAuditorCount').textContent = `${(masters.auditors || []).length} auditor`;
    $('adminLevelCount').textContent = `${(masters.levels || []).length} level`;

    $('adminStoreList').innerHTML = buildStoreListMarkup(masters.stores || [], $('adminStoreSearch').value || '');
    $('adminAuditorList').innerHTML = buildAuditorListMarkup(masters.auditors || [], $('adminAuditorSearch').value || '');
    $('adminLevelList').innerHTML = buildLevelListMarkup(masters.levels || [], $('adminLevelSearch').value || '');
  }

  function renderEverything() {
    renderSummary();
    renderFeatureCards();
    renderLinkInputs();
    renderMasterLists();
    syncPageMeta();
  }

  function attachNavLinks() {
    const switcher = $('adminPageSwitcher');
    if (!switcher) return;
    if (switcher.querySelector('[data-admin-nav-ready]')) return;
    switcher.innerHTML = `
      <a href="index.html" class="page-btn">REPORT</a>
      <a href="analytics.html" class="page-btn">REAL ANALYTICS</a>
      <button type="button" class="page-btn active" data-admin-nav-ready="1">ADMIN CONSOLE</button>
    `;
  }

  async function fetchUsageDashboard() {
    const target = $('adminActivityGrid');
    if (!target || !window.RB_CONFIG || !window.RB_CONFIG.API_URL || !state.code) return;
    target.innerHTML = '<div class="admin-empty-state">Memuat aktivitas usage terbaru...</div>';
    try {
      const url = new URL(window.RB_CONFIG.API_URL, window.location.href);
      url.searchParams.set('action', 'usage_dashboard');
      url.searchParams.set('code', state.code);
      url.searchParams.set('ts', String(Date.now()));
      const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
      const raw = await response.text();
      const payload = raw ? JSON.parse(raw) : {};
      const status = String(payload.status || '').toLowerCase();
      if (!response.ok || !['success', 'ok'].includes(status)) {
        throw new Error(payload.message || 'Gagal memuat activity dashboard.');
      }
      const activeUsers = (payload.activeUsers || []).slice(0, 8).map(item => `
        <div class="admin-list-item compact">
          <span><strong>${escapeHtml(item.auditor || 'Tanpa Nama')}</strong><small>${escapeHtml(item.store || '-')}</small></span>
          <button type="button" class="btn btn-ghost btn-mini" disabled>${escapeHtml(formatDate(item.lastSeenAt))}</button>
        </div>
      `).join('') || '<div class="admin-empty-state">Belum ada user aktif saat ini.</div>';

      const recentEvents = (payload.recentEvents || []).slice(0, 10).map(item => `
        <div class="admin-list-item compact">
          <span><strong>${escapeHtml(item.auditor || 'Tanpa Nama')}</strong><small>${escapeHtml(item.eventType || '-')} • ${escapeHtml(item.detail || '-')}</small></span>
          <button type="button" class="btn btn-ghost btn-mini" disabled>${escapeHtml(formatDate(item.time))}</button>
        </div>
      `).join('') || '<div class="admin-empty-state">Belum ada event terbaru.</div>';

      target.innerHTML = `
        <article class="admin-activity-card">
          <div class="admin-card-head">
            <div>
              <h3>User Aktif</h3>
              <p>${escapeHtml(String((payload.summary && payload.summary.activeNow) || 0))} user aktif pada 2 menit terakhir</p>
            </div>
            <span class="admin-pill">Live</span>
          </div>
          <div class="admin-list">${activeUsers}</div>
        </article>
        <article class="admin-activity-card">
          <div class="admin-card-head">
            <div>
              <h3>Recent Events</h3>
              <p>${escapeHtml(String((payload.summary && payload.summary.eventsToday) || 0))} event tercatat hari ini</p>
            </div>
            <span class="admin-pill">Realtime</span>
          </div>
          <div class="admin-list">${recentEvents}</div>
        </article>
      `;
    } catch (error) {
      target.innerHTML = `<div class="admin-empty-state">${escapeHtml(error.message || 'Activity dashboard belum tersedia.')}</div>`;
    }
  }

  function addStoreItem() {
    const code = String($('addStoreCodeInput').value || '').trim();
    const name = String($('addStoreInput').value || '').trim();
    const type = String($('addStoreTypeInput').value || '').trim();
    const city = String($('addStoreCityInput').value || '').trim();
    if (!name) {
      showToast('Nama store wajib diisi.', 'danger');
      return false;
    }
    const store = shared.normalizeStoreItem({ code, name, type, city });
    const next = shared.normalizeStoreList([...(state.config.masters.stores || []), store]);
    const exists = next.length === (state.config.masters.stores || []).length;
    if (exists) {
      showToast('Store tersebut sudah ada.', 'warning');
      return false;
    }
    state.config.masters.stores = next;
    $('addStoreCodeInput').value = '';
    $('addStoreInput').value = '';
    $('addStoreTypeInput').value = '';
    $('addStoreCityInput').value = '';
    renderMasterLists();
    renderSummary();
    markDirty(true);
    return true;
  }

  function addAuditorItem() {
    const name = String($('addAuditorInput').value || '').trim();
    const nik = String($('addAuditorNikInput').value || '').trim();
    if (!name) {
      showToast('Nama auditor wajib diisi.', 'danger');
      return false;
    }
    const next = shared.normalizeAuditorList([...(state.config.masters.auditors || []), { name, nik }]);
    const exists = next.length === (state.config.masters.auditors || []).length;
    if (exists) {
      const replaced = next.map(item => shared.normalizeText(item.name) === shared.normalizeText(name) ? { name: item.name, nik: nik || item.nik } : item);
      state.config.masters.auditors = shared.normalizeAuditorList(replaced);
      renderMasterLists();
      markDirty(true);
      showToast('Auditor sudah ada. NIK diperbarui bila diisi.', 'warning');
      return true;
    }
    state.config.masters.auditors = next;
    $('addAuditorInput').value = '';
    $('addAuditorNikInput').value = '';
    renderMasterLists();
    renderSummary();
    markDirty(true);
    return true;
  }

  function addLevelItem() {
    const level = String($('addLevelInput').value || '').trim();
    if (!level) {
      showToast('Nama level wajib diisi.', 'danger');
      return false;
    }
    const next = shared.normalizeLevelList([...(state.config.masters.levels || []), level]);
    if (next.length === (state.config.masters.levels || []).length) {
      showToast('Level tersebut sudah ada.', 'warning');
      return false;
    }
    state.config.masters.levels = next;
    $('addLevelInput').value = '';
    renderMasterLists();
    renderSummary();
    markDirty(true);
    return true;
  }

  function removeItem(type, rawKey) {
    const key = String(rawKey || '').trim();
    if (!key) return;
    if (type === 'stores') {
      state.config.masters.stores = (state.config.masters.stores || []).filter(item => {
        const store = shared.normalizeStoreItem(item);
        return shared.normalizeText(store.code || store.name) !== shared.normalizeText(key);
      });
    }
    if (type === 'auditors') {
      state.config.masters.auditors = (state.config.masters.auditors || []).filter(item => shared.normalizeText(shared.normalizeAuditorItem(item).name) !== shared.normalizeText(key));
    }
    if (type === 'levels') {
      state.config.masters.levels = (state.config.masters.levels || []).filter(item => shared.normalizeText(item) !== shared.normalizeText(key));
    }
    renderMasterLists();
    renderSummary();
    markDirty(true);
  }

  function getRowsFromWorkbook(workbook, sheetName) {
    const sheet = workbook.Sheets[sheetName];
    return window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  }

  function findHeaderRow(rows, requiredHeaders) {
    const normalizedRequired = requiredHeaders.map(shared.normalizeText);
    for (let rowIndex = 0; rowIndex < Math.min(rows.length, 12); rowIndex += 1) {
      const headers = (rows[rowIndex] || []).map(cell => shared.normalizeText(cell));
      const matches = normalizedRequired.every(header => headers.includes(header));
      if (matches) return rowIndex;
    }
    return -1;
  }

  async function readWorkbookFromInput(inputId) {
    const input = $(inputId);
    const file = input && input.files && input.files[0];
    if (!file) {
      throw new Error('Pilih file Excel terlebih dahulu.');
    }
    if (!window.XLSX) {
      throw new Error('Library Excel belum termuat. Refresh halaman lalu coba lagi.');
    }
    const arrayBuffer = await file.arrayBuffer();
    return window.XLSX.read(arrayBuffer, { type: 'array' });
  }

  function importStoresFromWorkbook(workbook) {
    const targetSheetName = workbook.SheetNames.find(name => {
      const rows = getRowsFromWorkbook(workbook, name);
      return findHeaderRow(rows, ['Site', 'SiteDescr']) >= 0;
    }) || workbook.SheetNames[0];
    const rows = getRowsFromWorkbook(workbook, targetSheetName);
    const headerRowIndex = findHeaderRow(rows, ['Site', 'SiteDescr']);
    if (headerRowIndex < 0) {
      throw new Error('Format store master tidak cocok. Gunakan file yang punya kolom Site dan SiteDescr.');
    }
    const header = rows[headerRowIndex].map(cell => String(cell || '').trim());
    const indexOf = name => header.findIndex(item => shared.normalizeText(item) === shared.normalizeText(name));
    const siteIndex = indexOf('Site');
    const siteDescrIndex = indexOf('SiteDescr');
    const typeIndex = indexOf('Type');
    const cityIndex = indexOf('City');
    const provinceIndex = indexOf('Province');

    const imported = rows.slice(headerRowIndex + 1).map(row => {
      return shared.normalizeStoreItem({
        code: row[siteIndex],
        name: row[siteDescrIndex],
        type: typeIndex >= 0 ? row[typeIndex] : '',
        city: cityIndex >= 0 ? row[cityIndex] : '',
        province: provinceIndex >= 0 ? row[provinceIndex] : ''
      });
    }).filter(item => item.name);

    return shared.normalizeStoreList(imported);
  }

  function importAuditorsFromWorkbook(workbook) {
    const candidates = [
      ['NIK', 'Nama Auditor'],
      ['NIK', 'AuditorName'],
      ['NIK', 'Name']
    ];

    let targetSheetName = workbook.SheetNames[0];
    let headerRowIndex = -1;
    let required = candidates[0];

    workbook.SheetNames.some(name => {
      const rows = getRowsFromWorkbook(workbook, name);
      return candidates.some(req => {
        const idx = findHeaderRow(rows, req);
        if (idx >= 0) {
          targetSheetName = name;
          headerRowIndex = idx;
          required = req;
          return true;
        }
        return false;
      });
    });

    const rows = getRowsFromWorkbook(workbook, targetSheetName);
    if (headerRowIndex < 0) {
      headerRowIndex = 0;
    }
    const header = (rows[headerRowIndex] || []).map(cell => String(cell || '').trim());
    const headerNorm = header.map(shared.normalizeText);
    const nikIndex = headerNorm.findIndex(item => item === 'nik');
    let nameIndex = headerNorm.findIndex(item => ['nama auditor', 'auditorname', 'name', 'nama'].includes(item));
    if (nameIndex < 0) nameIndex = nikIndex === 0 ? 1 : 0;

    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    const imported = rows.slice(startRow).map(row => {
      const name = row[nameIndex];
      const nik = nikIndex >= 0 ? row[nikIndex] : '';
      return shared.normalizeAuditorItem({ name, nik });
    }).filter(item => item.name);

    if (!imported.length) {
      throw new Error('File auditor kosong atau format kolom belum sesuai.');
    }
    return shared.normalizeAuditorList(imported);
  }

  function importLevelsFromWorkbook(workbook) {
    const rows = getRowsFromWorkbook(workbook, workbook.SheetNames[0]);
    const headerRowIndex = findHeaderRow(rows, ['Level']);
    const start = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    let columnIndex = 0;
    if (headerRowIndex >= 0) {
      const header = (rows[headerRowIndex] || []).map(cell => shared.normalizeText(cell));
      columnIndex = header.findIndex(item => ['level', 'job level', 'level name'].includes(item));
      if (columnIndex < 0) columnIndex = 0;
    }
    const imported = rows.slice(start)
      .map(row => String((row && row[columnIndex]) || '').trim())
      .filter(Boolean);
    if (!imported.length) {
      throw new Error('File level kosong atau kolom level tidak ditemukan.');
    }
    return shared.normalizeLevelList(imported);
  }

  async function handleImport(type) {
    try {
      if (type === 'stores') {
        const workbook = await readWorkbookFromInput('storeMasterUploadInput');
        const imported = importStoresFromWorkbook(workbook);
        state.config.masters.stores = imported;
        renderMasterLists();
        renderSummary();
        markDirty(true);
        showToast(`Import store berhasil: ${imported.length} item`, 'success');
      }
      if (type === 'auditors') {
        const workbook = await readWorkbookFromInput('auditorMasterUploadInput');
        const imported = importAuditorsFromWorkbook(workbook);
        state.config.masters.auditors = imported;
        renderMasterLists();
        renderSummary();
        markDirty(true);
        showToast(`Import auditor berhasil: ${imported.length} item`, 'success');
      }
      if (type === 'levels') {
        const workbook = await readWorkbookFromInput('levelMasterUploadInput');
        const imported = importLevelsFromWorkbook(workbook);
        state.config.masters.levels = imported;
        renderMasterLists();
        renderSummary();
        markDirty(true);
        showToast(`Import level berhasil: ${imported.length} item`, 'success');
      }
    } catch (error) {
      showToast(error.message || 'Import master gagal.', 'danger');
    }
  }

  async function publishConfig() {
    $('adminPublishBtn').disabled = true;
    try {
      const updatedBy = 'Admin Console';
      const result = await shared.saveAdminConfig(state.config, state.code, updatedBy);
      state.config = shared.mergeConfig(result.config || state.config, result.remoteSaved ? 'server' : 'local');
      state.source = result.remoteSaved ? 'server' : 'local';
      renderEverything();
      markDirty(false);
      showToast(result.message || 'Konfigurasi berhasil dipublish.', result.remoteSaved ? 'success' : 'warning');
      fetchUsageDashboard();
    } catch (error) {
      showToast(error.message || 'Gagal menyimpan admin config.', 'danger');
    } finally {
      $('adminPublishBtn').disabled = false;
    }
  }

  function resetDefaults() {
    if (!window.confirm('Reset semua master, link, dan feature ke default?')) return;
    state.config = shared.buildDefaultConfig();
    state.source = 'default';
    renderEverything();
    markDirty(true);
    showToast('Config direset ke default. Publish bila ingin menyebarkan perubahan.', 'warning');
  }

  async function submitUnlock() {
    const code = String($('adminCodeInput').value || '').trim();
    $('adminUnlockBtn').disabled = true;
    $('adminCodeError').textContent = 'Memverifikasi akses admin...';
    try {
      const verify = await shared.verifyAdminCode(code);
      if (!verify.ok) {
        $('adminCodeError').textContent = verify.message || 'Kode admin tidak valid.';
        return;
      }
      state.code = code;
      shared.setSessionCode(code);
      $('adminLockGate').hidden = true;
      $('adminConsoleApp').hidden = false;
      $('adminCodeError').textContent = '';
      showToast(verify.message || 'Akses admin terbuka.', 'success');
      fetchUsageDashboard();
    } finally {
      $('adminUnlockBtn').disabled = false;
    }
  }

  async function initializeConsole() {
    attachNavLinks();
    const loaded = await shared.loadAdminConfig();
    state.config = loaded.config;
    state.source = loaded.source;
    state.remoteAvailable = loaded.remoteAvailable;
    renderEverything();
    markDirty(false);

    $('adminUnlockBtn').addEventListener('click', submitUnlock);
    $('adminCodeInput').addEventListener('keydown', event => {
      if (event.key === 'Enter') submitUnlock();
    });
    $('adminLogoutBtn').addEventListener('click', () => {
      shared.clearSessionCode();
      state.code = '';
      $('adminConsoleApp').hidden = true;
      $('adminLockGate').hidden = false;
      $('adminCodeInput').value = '';
      $('adminCodeError').textContent = '';
      showToast('Session admin ditutup.', 'success');
    });

    $('adminFeatureGrid').addEventListener('change', event => {
      const target = event.target;
      if (!target.matches('[data-feature-toggle]')) return;
      state.config.features[target.dataset.featureToggle] = Boolean(target.checked);
      renderSummary();
      markDirty(true);
    });

    $('adminOpiLink').addEventListener('input', event => {
      state.config.links.opiReport = String(event.target.value || '').trim();
      markDirty(true);
    });
    $('adminAssignmentLink').addEventListener('input', event => {
      state.config.links.assignment = String(event.target.value || '').trim();
      markDirty(true);
    });

    $('addStoreBtn').addEventListener('click', addStoreItem);
    $('addAuditorBtn').addEventListener('click', addAuditorItem);
    $('addLevelBtn').addEventListener('click', addLevelItem);

    ['Store', 'Auditor', 'Level'].forEach(label => {
      const search = $(`admin${label}Search`);
      if (search) search.addEventListener('input', renderMasterLists);
    });

    ['adminStoreList', 'adminAuditorList', 'adminLevelList'].forEach(id => {
      const element = $(id);
      element.addEventListener('click', event => {
        const button = event.target.closest('[data-remove-type]');
        if (!button) return;
        removeItem(button.dataset.removeType, button.dataset.removeKey);
      });
    });

    $('storeMasterUploadBtn').addEventListener('click', () => handleImport('stores'));
    $('auditorMasterUploadBtn').addEventListener('click', () => handleImport('auditors'));
    $('levelMasterUploadBtn').addEventListener('click', () => handleImport('levels'));

    $('adminPublishBtn').addEventListener('click', publishConfig);
    $('adminResetBtn').addEventListener('click', resetDefaults);
    $('adminRefreshActivityBtn').addEventListener('click', fetchUsageDashboard);

    const code = shared.getSessionCode();
    if (code) {
      $('adminCodeInput').value = code;
      submitUnlock();
    }
  }

  document.addEventListener('DOMContentLoaded', initializeConsole);
})();
