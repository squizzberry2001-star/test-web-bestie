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
      { label: 'Store Master', value: (config.masters.stores || []).length, meta: 'Dropdown store siap pakai' },
      { label: 'Auditor Master', value: (config.masters.auditors || []).length, meta: 'Nama auditor aktif' },
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

  function buildListMarkup(items, type, query) {
    const normalizedQuery = shared.normalizeText(query);
    const filtered = (items || []).filter(item => !normalizedQuery || shared.normalizeText(item).indexOf(normalizedQuery) >= 0);
    const visible = filtered.slice(0, 150);
    if (!visible.length) {
      return '<div class="admin-empty-state">Belum ada item yang cocok.</div>';
    }
    const markup = visible.map(item => `
      <div class="admin-list-item">
        <span>${escapeHtml(item)}</span>
        <button type="button" class="btn btn-ghost btn-mini" data-remove-type="${escapeHtml(type)}" data-remove-value="${escapeHtml(item)}">Hapus</button>
      </div>
    `).join('');
    if (filtered.length > visible.length) {
      return markup + `<div class="admin-list-footnote">Menampilkan ${visible.length} dari ${filtered.length} item. Ketik kata kunci yang lebih spesifik untuk mempersempit daftar.</div>`;
    }
    return markup;
  }

  function renderMasterLists() {
    const masters = state.config.masters || {};
    $('adminStoreCount').textContent = `${(masters.stores || []).length} store`;
    $('adminAuditorCount').textContent = `${(masters.auditors || []).length} auditor`;
    $('adminLevelCount').textContent = `${(masters.levels || []).length} level`;

    $('adminStoreList').innerHTML = buildListMarkup(masters.stores || [], 'stores', $('adminStoreSearch').value || '');
    $('adminAuditorList').innerHTML = buildListMarkup(masters.auditors || [], 'auditors', $('adminAuditorSearch').value || '');
    $('adminLevelList').innerHTML = buildListMarkup(masters.levels || [], 'levels', $('adminLevelSearch').value || '');
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
              <p>${escapeHtml(String((payload.summary && payload.summary.eventsToday) || 0))} event hari ini</p>
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

  function addItem(type, value) {
    const clean = String(value || '').replace(/\s+/g, ' ').trim();
    if (!clean) {
      showToast('Input masih kosong.', 'warning');
      return false;
    }
    const list = state.config.masters[type] || [];
    if (list.some(item => shared.normalizeText(item) === shared.normalizeText(clean))) {
      showToast('Item yang sama sudah ada.', 'warning');
      return false;
    }
    state.config.masters[type] = shared.uniqueSorted([...(list || []), clean]);
    markDirty(true);
    renderEverything();
    return true;
  }

  function removeItem(type, value) {
    state.config.masters[type] = (state.config.masters[type] || []).filter(item => shared.normalizeText(item) !== shared.normalizeText(value));
    markDirty(true);
    renderEverything();
  }

  function bindEvents() {
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
      const toggle = event.target.closest('[data-feature-toggle]');
      if (!toggle) return;
      state.config.features[toggle.dataset.featureToggle] = Boolean(toggle.checked);
      markDirty(true);
      renderSummary();
    });

    $('adminOpiLink').addEventListener('input', event => {
      state.config.links.opiReport = event.target.value.trim();
      markDirty(true);
    });
    $('adminAssignmentLink').addEventListener('input', event => {
      state.config.links.assignment = event.target.value.trim();
      markDirty(true);
    });

    $('addStoreBtn').addEventListener('click', () => {
      if (addItem('stores', $('addStoreInput').value)) $('addStoreInput').value = '';
    });
    $('addAuditorBtn').addEventListener('click', () => {
      if (addItem('auditors', $('addAuditorInput').value)) $('addAuditorInput').value = '';
    });
    $('addLevelBtn').addEventListener('click', () => {
      if (addItem('levels', $('addLevelInput').value)) $('addLevelInput').value = '';
    });

    ['Store', 'Auditor', 'Level'].forEach(label => {
      const input = $(`add${label}Input`);
      if (input) {
        input.addEventListener('keydown', event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            $(`add${label}Btn`).click();
          }
        });
      }
      const search = $(`admin${label}Search`);
      if (search) search.addEventListener('input', renderMasterLists);
    });

    ['adminStoreList', 'adminAuditorList', 'adminLevelList'].forEach(id => {
      $(id).addEventListener('click', event => {
        const button = event.target.closest('[data-remove-type]');
        if (!button) return;
        removeItem(button.dataset.removeType, button.dataset.removeValue);
      });
    });

    $('adminPublishBtn').addEventListener('click', publishConfig);
    $('adminResetBtn').addEventListener('click', resetDefaults);
    $('adminRefreshActivityBtn').addEventListener('click', fetchUsageDashboard);
  }

  async function publishConfig() {
    $('adminPublishBtn').disabled = true;
    const updatedBy = 'Admin Console';
    try {
      const result = await shared.saveAdminConfig(state.config, state.code, updatedBy);
      state.config = result.config;
      state.source = result.remoteSaved ? 'server' : 'local';
      state.remoteAvailable = Boolean(result.remoteSaved);
      markDirty(false);
      renderEverything();
      showToast(result.message || 'Admin config berhasil disimpan.', result.remoteSaved ? 'success' : 'warning');
    } catch (error) {
      showToast(error.message || 'Gagal menyimpan admin config.', 'danger');
    } finally {
      $('adminPublishBtn').disabled = false;
    }
  }

  function resetDefaults() {
    const confirmed = window.confirm('Reset semua master data, link, dan fitur ke default bawaan?');
    if (!confirmed) return;
    state.config = shared.buildDefaultConfig();
    state.source = 'default';
    markDirty(true);
    renderEverything();
    showToast('Config berhasil dikembalikan ke default. Klik Publish untuk menerapkan ke semua device.', 'success');
  }

  async function loadConsole() {
    const loaded = await shared.loadAdminConfig();
    state.config = loaded.config;
    state.source = loaded.source;
    state.remoteAvailable = loaded.remoteAvailable;
    renderEverything();
    markDirty(false);
    await fetchUsageDashboard();
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
      await loadConsole();
      showToast(verify.message || 'Admin console berhasil dibuka.', 'success');
    } finally {
      $('adminUnlockBtn').disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    attachNavLinks();
    bindEvents();
    const code = shared.getSessionCode();
    if (code) {
      $('adminCodeInput').value = code;
      await submitUnlock();
    }
  });
})();
