(function () {
  const shared = window.RBAdminShared;
  if (!shared) return;

  const REPORT_FEATURES = {
    qscResult: { sectionId: 'qscResultSection', toggleId: 'toggleQSCResult' },
    opiTable: { sectionId: 'opiTableSection', toggleId: 'toggleOPITable' },
    qscTable: { sectionId: 'qscTableSection', toggleId: 'toggleQSCTable' },
    findingEvidence: { sectionId: 'findingEvidenceSection', toggleId: 'toggleFindingEvidence' },
    correctiveAction: { sectionId: 'correctiveActionSection', toggleId: 'toggleCorrectiveAction' },
    assignmentSection: { inputId: 'storeAssignmentLink' }
  };

  const state = {
    config: shared.buildDefaultConfig(),
    source: 'default',
    statusBadge: null,
    secretModalReady: false
  };

  function safeEscape(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getCurrentConfig() {
    return state.config || shared.buildDefaultConfig();
  }

  function getCurrentStores() {
    return shared.normalizeStoreList(((getCurrentConfig().masters || {}).stores || []));
  }

  function getCurrentAuditors() {
    return shared.normalizeAuditorList(((getCurrentConfig().masters || {}).auditors || []));
  }

  function getCurrentLevels() {
    return shared.normalizeLevelList(((getCurrentConfig().masters || {}).levels || []));
  }

  const originalCreateCrewRow = window.createCrewRow;
  window.createCrewRow = function createCrewRowPro(data = {}) {
    const levels = getCurrentLevels();
    const wrapper = document.createElement('div');
    wrapper.className = 'list-item';
    wrapper.innerHTML = `
      <span class="row-number">1.</span>
      <input type="text" class="crew-name" placeholder="Nama crew" value="${window.escapeHtml ? window.escapeHtml(data.name || '') : safeEscape(data.name || '')}">
      <select class="crew-level-select"></select>
      <button type="button" class="btn-remove" aria-label="Hapus crew">×</button>
    `;
    populateSingleLevelSelect(wrapper.querySelector('.crew-level-select'), levels, data.level || '');
    wrapper.querySelector('.btn-remove').addEventListener('click', () => window.removeCrewItem && window.removeCrewItem(wrapper));
    return wrapper;
  };

  const baseConfirmClearData = window.confirmClearData;
  if (typeof baseConfirmClearData === 'function') {
    window.confirmClearData = async function confirmClearDataPro() {
      const result = await baseConfirmClearData.apply(this, arguments);
      setTimeout(() => applyReportConfig(getCurrentConfig()), 0);
      return result;
    };
  }

  function populateSingleLevelSelect(select, levels, selectedValue = '') {
    if (!select) return;
    const current = selectedValue || select.value || '';
    select.innerHTML = '<option value="">Pilih</option>' + levels.map(level => `<option value="${safeEscape(level)}">${safeEscape(level)}</option>`).join('');
    if (current) {
      if (!levels.some(level => shared.normalizeText(level) === shared.normalizeText(current))) {
        const option = document.createElement('option');
        option.value = current;
        option.textContent = current;
        select.appendChild(option);
      }
      select.value = current;
    }
  }

  function refreshAllLevelSelects(levels) {
    populateSingleLevelSelect(document.getElementById('storeLeaderLevel'), levels, document.getElementById('storeLeaderLevel')?.value || '');
    populateSingleLevelSelect(document.getElementById('shiftLeaderLevel'), levels, document.getElementById('shiftLeaderLevel')?.value || '');
    document.querySelectorAll('.crew-level-select').forEach(select => populateSingleLevelSelect(select, levels, select.value));
  }

  function ensureStatusBadge() {
    const statusBar = document.getElementById('systemStatusBar');
    if (!statusBar) return null;
    let badge = document.getElementById('configSourceBadge');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'configSourceBadge';
      badge.className = 'system-status-badge';
      statusBar.appendChild(badge);
    }
    return badge;
  }

  function setStatusBadge(source) {
    state.statusBadge = state.statusBadge || ensureStatusBadge();
    if (!state.statusBadge) return;
    const copy = {
      server: 'Master Server',
      local: 'Master Browser',
      default: 'Master Default'
    };
    state.statusBadge.textContent = copy[source] || 'Master Config';
  }

  function getSectionElement(map) {
    if (!map) return null;
    if (map.sectionId) {
      const content = document.getElementById(map.sectionId);
      return content ? content.closest('.section') : null;
    }
    if (map.inputId) {
      const input = document.getElementById(map.inputId);
      return input ? input.closest('.section') : null;
    }
    return null;
  }

  function applyFeatureVisibility(features) {
    Object.keys(REPORT_FEATURES).forEach(key => {
      const map = REPORT_FEATURES[key];
      const section = getSectionElement(map);
      if (!section) return;
      const enabled = Boolean(features[key]);
      section.style.display = enabled ? '' : 'none';
      section.classList.toggle('admin-section-disabled', !enabled);
      if (!enabled && map.toggleId && typeof window.toggleSection === 'function') {
        const toggle = document.getElementById(map.toggleId);
        if (toggle) {
          toggle.checked = false;
          window.toggleSection(map.sectionId, false);
        }
      }
    });

    const dock = document.getElementById('reportProgressDock');
    const dockEnabled = Boolean(features.progressDock);
    if (dock) {
      dock.style.display = dockEnabled ? '' : 'none';
    }
    document.body.classList.toggle('progress-dock-disabled', !dockEnabled);
    if (!dockEnabled) {
      document.body.classList.remove('has-progress-dock');
    } else if (dock && dock.id === 'reportProgressDock') {
      document.body.classList.add('has-progress-dock');
    }
  }

  function applyLinks(config) {
    const opiLink = document.getElementById('opiReferenceLink');
    if (opiLink) {
      opiLink.href = config.links.opiReport;
      opiLink.textContent = 'Klik untuk buka link OPI';
    }

    const assignmentInput = document.getElementById('storeAssignmentLink');
    if (assignmentInput) {
      if (!assignmentInput.dataset.adminDirtyBound) {
        assignmentInput.dataset.adminDirtyBound = '1';
        assignmentInput.addEventListener('input', () => {
          assignmentInput.dataset.userDirty = '1';
        });
      }
      const previousAdminValue = assignmentInput.dataset.adminAppliedValue || '';
      const currentValue = String(assignmentInput.value || '').trim();
      const canOverride = !assignmentInput.dataset.userDirty || !currentValue || currentValue === previousAdminValue || currentValue === 'https://tinyurl.com/store-caassignment';
      if (canOverride) {
        assignmentInput.value = config.links.assignment;
      }
      assignmentInput.dataset.adminAppliedValue = config.links.assignment;

      if (!document.getElementById('assignmentAdminHint')) {
        const hint = document.createElement('p');
        hint.id = 'assignmentAdminHint';
        hint.className = 'section-helper-note admin-inline-hint';
        hint.textContent = 'Default link assignment mengikuti pengaturan Admin Console, namun masih bisa disesuaikan per report bila diperlukan.';
        assignmentInput.insertAdjacentElement('afterend', hint);
      }
    }
  }

  function removeVisibleAdminLinks() {
    document.querySelectorAll('[data-admin-console-link="1"]').forEach(link => link.remove());
    document.querySelectorAll('.page-switcher a[href="admin.html"]').forEach(link => link.remove());
  }

  function ensureSearchInput(select, inputId, placeholder, onFilter) {
    if (!select) return null;
    let input = document.getElementById(inputId);
    if (!input) {
      input = document.createElement('input');
      input.type = 'search';
      input.id = inputId;
      input.className = 'auditor-search-input strict-select-search';
      input.placeholder = placeholder;
      select.parentNode.insertBefore(input, select);
    }
    if (!input.dataset.filterBound) {
      input.dataset.filterBound = '1';
      input.addEventListener('input', () => onFilter(input.value || ''));
      input.addEventListener('search', () => onFilter(input.value || ''));
    }
    return input;
  }

  function filterSelectOptions(select, searchValue) {
    if (!select) return;
    const query = shared.normalizeText(searchValue);
    Array.from(select.options).forEach((option, index) => {
      if (index === 0) {
        option.hidden = false;
        return;
      }
      const haystack = shared.normalizeText(`${option.textContent || ''} ${option.dataset.search || ''}`);
      option.hidden = Boolean(query) && !haystack.includes(query);
    });
  }

  function ensureAuditorSelectUI() {
    const select = document.getElementById('namaDropdown');
    if (!select) return null;

    const autocompleteInput = document.getElementById('auditorAutocompleteInput');
    const autocompleteWrap = autocompleteInput ? autocompleteInput.closest('.auditor-autocomplete-wrap') : null;
    if (autocompleteWrap) {
      autocompleteWrap.remove();
    }

    select.classList.remove('auditor-hidden-select');
    select.style.display = '';
    select.removeAttribute('aria-hidden');
    select.tabIndex = 0;

    const manual = document.getElementById('namaManual');
    if (manual) {
      manual.value = '';
      manual.required = false;
      manual.style.display = 'none';
      manual.setAttribute('aria-hidden', 'true');
      manual.tabIndex = -1;
    }

    ensureSearchInput(select, 'auditorSearchInputStrict', 'Cari auditor (nama / NIK), lalu pilih dari dropdown...', value => filterSelectOptions(select, value));

    if (!select.dataset.strictChangeBound) {
      select.dataset.strictChangeBound = '1';
      select.addEventListener('change', () => {
        if (typeof window.handleNamaChange === 'function') window.handleNamaChange();
        if (typeof window.updateProgressTracker === 'function') window.updateProgressTracker();
      });
    }

    return select;
  }

  function ensureStoreSelectUI() {
    let current = document.getElementById('store');
    if (!current) return null;

    if (current.tagName !== 'SELECT') {
      const previousValue = String(current.value || '').trim();
      const select = document.createElement('select');
      select.id = current.id;
      select.name = current.name || 'store';
      select.required = true;
      select.className = current.className || '';
      current.parentNode.replaceChild(select, current);
      current = select;
      current.dataset.pendingValue = previousValue;
    }

    ensureSearchInput(current, 'storeSearchInputStrict', 'Cari store (kode / nama), lalu pilih dari dropdown...', value => filterSelectOptions(current, value));

    if (!current.dataset.strictChangeBound) {
      current.dataset.strictChangeBound = '1';
      current.addEventListener('change', () => {
        if (typeof window.updateProgressTracker === 'function') window.updateProgressTracker();
      });
    }

    return current;
  }

  function renderAuditorOptions(auditors) {
    const select = ensureAuditorSelectUI();
    if (!select) return;

    const currentValue = String(select.value || '').trim();
    const pendingValue = select.dataset.pendingValue || '';
    const resolvedCurrent = currentValue || pendingValue;
    const options = shared.normalizeAuditorList(auditors || []);

    select.innerHTML = '<option value="">-- Pilih Auditor --</option>' + options.map(item => {
      const label = shared.formatAuditorLabel(item);
      return `<option value="${safeEscape(item.name)}" data-nik="${safeEscape(item.nik)}" data-search="${safeEscape(`${item.name} ${item.nik}`)}">${safeEscape(label)}</option>`;
    }).join('');

    if (resolvedCurrent) {
      const matched = options.find(item => shared.normalizeText(item.name) === shared.normalizeText(resolvedCurrent) || shared.normalizeText(shared.formatAuditorLabel(item)) === shared.normalizeText(resolvedCurrent));
      if (matched) {
        select.value = matched.name;
      }
    }
    delete select.dataset.pendingValue;
    filterSelectOptions(select, document.getElementById('auditorSearchInputStrict')?.value || '');
  }

  function renderStoreOptions(stores) {
    const select = ensureStoreSelectUI();
    if (!select) return;

    const currentValue = String(select.value || '').trim();
    const pendingValue = select.dataset.pendingValue || '';
    const resolvedCurrent = currentValue || pendingValue;
    const options = shared.normalizeStoreList(stores || []);

    select.innerHTML = '<option value="">-- Pilih Store --</option>' + options.map(item => {
      const label = shared.formatStoreLabel(item);
      const search = `${item.code} ${item.name} ${item.city || ''} ${item.type || ''} ${item.province || ''}`;
      return `<option value="${safeEscape(label)}" data-code="${safeEscape(item.code)}" data-name="${safeEscape(item.name)}" data-type="${safeEscape(item.type)}" data-city="${safeEscape(item.city)}" data-province="${safeEscape(item.province)}" data-search="${safeEscape(search)}">${safeEscape(label)}</option>`;
    }).join('');

    if (resolvedCurrent) {
      const matched = options.find(item => shared.normalizeText(shared.formatStoreLabel(item)) === shared.normalizeText(resolvedCurrent) || shared.normalizeText(item.name) === shared.normalizeText(resolvedCurrent) || shared.normalizeCode(item.code) === shared.normalizeCode(resolvedCurrent));
      if (matched) {
        select.value = shared.formatStoreLabel(matched);
      }
    }
    delete select.dataset.pendingValue;
    filterSelectOptions(select, document.getElementById('storeSearchInputStrict')?.value || '');
  }

  function getSelectedStoreMeta() {
    const select = document.getElementById('store');
    if (!select || !select.value) return { code: '', name: '', label: '' };
    const option = select.options[select.selectedIndex];
    return {
      code: String(option?.dataset.code || '').trim(),
      name: String(option?.dataset.name || '').trim() || String(select.value || '').trim(),
      label: String(select.value || '').trim()
    };
  }

  function getSelectedAuditorMeta() {
    const select = document.getElementById('namaDropdown');
    if (!select || !select.value) return { name: '', nik: '', label: '' };
    const option = select.options[select.selectedIndex];
    return {
      name: String(select.value || '').trim(),
      nik: String(option?.dataset.nik || '').trim(),
      label: String(option?.textContent || select.value || '').trim()
    };
  }

  function applyReportConfig(config, source = state.source) {
    state.config = shared.mergeConfig(config, source || 'default');
    state.source = state.config.meta.source || source || 'default';

    renderAuditorOptions(state.config.masters.auditors || []);
    renderStoreOptions(state.config.masters.stores || []);
    refreshAllLevelSelects(state.config.masters.levels || []);
    applyFeatureVisibility(state.config.features || {});
    applyLinks(state.config);
    setStatusBadge(state.source);
  }

  function buildSecretAdminModal() {
    if (state.secretModalReady) return;
    state.secretModalReady = true;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'secretAdminBtn';
    button.className = 'secret-admin-btn';
    button.setAttribute('aria-label', 'Buka admin console tersembunyi');
    button.innerHTML = '<span aria-hidden="true">✦</span>';
    document.body.appendChild(button);

    const modal = document.createElement('div');
    modal.id = 'secretAdminModal';
    modal.className = 'secret-admin-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="secret-admin-card" role="dialog" aria-modal="true" aria-labelledby="secretAdminTitle">
        <h3 id="secretAdminTitle">Admin Console</h3>
        <p>Tombol ini khusus untuk membuka halaman admin tersembunyi. Masukkan kode admin untuk lanjut.</p>
        <input type="password" id="secretAdminCodeInput" inputmode="numeric" autocomplete="off" placeholder="Masukkan kode admin">
        <div class="secret-admin-error" id="secretAdminError"></div>
        <div class="secret-admin-actions">
          <button type="button" class="btn btn-ghost" id="secretAdminCancelBtn">Batal</button>
          <button type="button" class="btn btn-primary" id="secretAdminSubmitBtn">Buka Admin</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    function openModal() {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.getElementById('secretAdminError').textContent = '';
      const input = document.getElementById('secretAdminCodeInput');
      input.value = shared.getSessionCode() || '';
      setTimeout(() => input.focus(), 20);
    }

    function closeModal() {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }

    async function submitModal() {
      const input = document.getElementById('secretAdminCodeInput');
      const error = document.getElementById('secretAdminError');
      const code = String(input.value || '').trim();
      error.textContent = 'Memverifikasi akses admin...';
      const verify = await shared.verifyAdminCode(code);
      if (!verify.ok) {
        error.textContent = verify.message || 'Kode admin tidak valid.';
        input.focus();
        return;
      }
      shared.setSessionCode(code);
      error.textContent = '';
      window.location.href = 'admin.html#console';
    }

    button.addEventListener('click', openModal);
    document.getElementById('secretAdminCancelBtn').addEventListener('click', closeModal);
    document.getElementById('secretAdminSubmitBtn').addEventListener('click', submitModal);
    document.getElementById('secretAdminCodeInput').addEventListener('keydown', event => {
      if (event.key === 'Enter') submitModal();
      if (event.key === 'Escape') closeModal();
    });
    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal();
    });
  }

  async function bootReportUpgrade() {
    removeVisibleAdminLinks();
    state.statusBadge = ensureStatusBadge();
    buildSecretAdminModal();
    const loaded = await shared.loadAdminConfig();
    applyReportConfig(loaded.config, loaded.source);
  }

  window.RBReportAdminEnhancer = {
    getCurrentConfig,
    getCurrentStores,
    getCurrentAuditors,
    getSelectedStoreMeta,
    getSelectedAuditorMeta,
    applyReportConfig
  };

  window.addEventListener('storage', event => {
    if (event.key !== shared.STORAGE_KEY) return;
    const local = shared.readLocalConfig();
    if (!local) return;
    applyReportConfig(local, 'local');
  });

  document.addEventListener('DOMContentLoaded', () => {
    bootReportUpgrade();
  });
})();
