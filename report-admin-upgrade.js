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

  window.injectAuditorAutocompleteV3 = function injectAuditorAutocompleteV3Disabled() {};
  window.syncAuditorAutocompleteInputV3 = function syncAuditorAutocompleteInputV3Disabled() {};
  window.syncAuditorAutocompleteSelectionV3 = function syncAuditorAutocompleteSelectionV3Disabled() {};

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

  const STRICT_FIELDS = {
    auditor: {
      kind: 'auditor',
      inputId: 'auditorSearchInputStrict',
      placeholder: 'Cari auditor (nama / NIK), lalu klik pilihannya...',
      helperText: 'Nama auditor wajib dipilih dari daftar hasil pencarian.',
      placeholderOption: '-- Pilih Auditor --',
      requiredMessage: 'Nama auditor wajib dipilih dari dropdown.',
      invalidMessage: 'Klik salah satu auditor dari hasil pencarian.',
      emptyResults: 'Tidak ada auditor yang cocok dengan pencarian Anda.'
    },
    store: {
      kind: 'store',
      inputId: 'storeSearchInputStrict',
      placeholder: 'Cari store (kode / nama), lalu klik pilihannya...',
      helperText: 'Store wajib dipilih dari daftar hasil pencarian.',
      placeholderOption: '-- Pilih Store --',
      requiredMessage: 'Store wajib dipilih dari dropdown.',
      invalidMessage: 'Klik salah satu store dari hasil pencarian.',
      emptyResults: 'Tidak ada store yang cocok dengan pencarian Anda.'
    }
  };

  function getStrictField(kind) {
    state.strictFields = state.strictFields || {};
    return state.strictFields[kind] || null;
  }

  function setStrictField(kind, field) {
    state.strictFields = state.strictFields || {};
    state.strictFields[kind] = field;
    return field;
  }

  function buildAuditorDescriptors(auditors) {
    return shared.normalizeAuditorList(auditors || []).map(item => ({
      value: item.name,
      label: shared.formatAuditorLabel(item),
      search: `${item.name || ''} ${item.nik || ''}`.trim(),
      secondary: item.nik ? `NIK ${item.nik}` : 'Auditor',
      data: {
        nik: item.nik || ''
      }
    }));
  }

  function buildStoreDescriptors(stores) {
    return shared.normalizeStoreList(stores || []).map(item => ({
      value: shared.formatStoreLabel(item),
      label: shared.formatStoreLabel(item),
      search: `${item.code || ''} ${item.name || ''} ${item.city || ''} ${item.type || ''} ${item.province || ''}`.trim(),
      secondary: item.code ? `Kode ${item.code}` : (item.type || 'Store'),
      data: {
        code: item.code || '',
        name: item.name || '',
        type: item.type || '',
        city: item.city || '',
        province: item.province || ''
      }
    }));
  }

  function setStrictFieldMeta(field, text, isError = false) {
    if (!field?.meta) return;
    field.meta.textContent = text;
    field.meta.classList.toggle('is-error', Boolean(isError));
  }

  function rebuildNativeSelectOptions(field, descriptors) {
    const { select, config } = field;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = config.placeholderOption;

    select.innerHTML = '';
    select.appendChild(placeholder);

    descriptors.forEach(descriptor => {
      const option = document.createElement('option');
      option.value = descriptor.value;
      option.textContent = descriptor.label;
      option.dataset.label = descriptor.label;
      option.dataset.search = descriptor.search || descriptor.label;
      Object.entries(descriptor.data || {}).forEach(([key, value]) => {
        option.dataset[key] = String(value || '');
      });
      select.appendChild(option);
    });
  }

  function getDescriptorByValue(field, value) {
    const candidate = String(value || '').trim();
    if (!candidate) return null;
    return (field.descriptors || []).find(descriptor => descriptor.value === candidate) || null;
  }

  function getFilteredDescriptors(field, searchValue) {
    const query = shared.normalizeText(searchValue);
    const descriptors = field.descriptors || [];
    if (!query) return descriptors;
    return descriptors.filter(descriptor => {
      const haystack = shared.normalizeText(`${descriptor.label || ''} ${descriptor.search || ''}`);
      return haystack.includes(query);
    });
  }

  function openStrictPanel(field) {
    if (!field?.panel) return;
    field.panel.hidden = false;
    field.input.setAttribute('aria-expanded', 'true');
  }

  function closeStrictPanel(field) {
    if (!field?.panel) return;
    field.panel.hidden = true;
    field.input.setAttribute('aria-expanded', 'false');
  }

  function syncStrictValidity(field, force = false) {
    if (!field?.input || !field?.select) return true;

    const typedValue = String(field.input.value || '').trim();
    const selectedValue = String(field.select.value || '').trim();
    const descriptor = getDescriptorByValue(field, selectedValue);
    const selectedLabel = descriptor ? descriptor.label : '';

    let message = '';
    if (!selectedValue) {
      message = typedValue ? field.config.invalidMessage : field.config.requiredMessage;
    } else if (shared.normalizeText(typedValue) !== shared.normalizeText(selectedLabel)) {
      message = field.config.invalidMessage;
    }

    field.input.setCustomValidity(message);

    const showError = Boolean(message) && (force || Boolean(typedValue));
    field.input.classList.toggle('is-invalid', showError);
    field.shell.classList.toggle('is-invalid', showError);

    if (showError) {
      setStrictFieldMeta(field, message, true);
    } else if (descriptor) {
      setStrictFieldMeta(field, `Dipilih: ${descriptor.label}`, false);
    } else {
      setStrictFieldMeta(field, field.config.helperText, false);
    }

    return !message;
  }

  function clearStrictSelection(field, options = {}) {
    const { preserveInput = false, dispatchChange = false } = options;
    field.select.value = '';
    field.input.dataset.selectedValue = '';
    field.input.dataset.selectedLabel = '';
    if (!preserveInput) field.input.value = '';
    syncStrictValidity(field, false);
    if (dispatchChange) {
      field.select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function selectStrictDescriptor(field, descriptor) {
    field.select.value = descriptor.value;
    field.input.value = descriptor.label;
    field.input.dataset.selectedValue = descriptor.value;
    field.input.dataset.selectedLabel = descriptor.label;
    closeStrictPanel(field);
    syncStrictValidity(field, true);
    field.select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function renderStrictPanel(field) {
    if (!field?.panel) return;

    const matches = getFilteredDescriptors(field, field.input.value || '');
    field.filteredDescriptors = matches;

    if (!matches.length) {
      field.panel.innerHTML = `<div class="smart-dropdown-empty">${safeEscape(field.config.emptyResults)}</div>`;
      return;
    }

    const selectedValue = String(field.select.value || '').trim();
    field.panel.innerHTML = matches.map((descriptor, index) => {
      const active = descriptor.value === selectedValue ? ' active' : '';
      return `
        <button type="button" class="smart-dropdown-option strict-select-option${active}" data-option-index="${index}">
          <span>${safeEscape(descriptor.label)}</span>
          <small>${safeEscape(descriptor.secondary || '')}</small>
        </button>
      `;
    }).join('');

    Array.from(field.panel.querySelectorAll('.strict-select-option')).forEach((button, index) => {
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => {
        const descriptor = matches[index];
        if (!descriptor) return;
        selectStrictDescriptor(field, descriptor);
      });
    });
  }

  function ensureStrictFieldUI(select, config) {
    if (!select) return null;

    let shell = select.closest('.strict-select-shell');
    if (!shell) {
      shell = document.createElement('div');
      shell.className = 'strict-select-shell';
      shell.dataset.strictKind = config.kind;
      shell.innerHTML = `
        <div class="smart-dropdown strict-smart-dropdown">
          <input type="search" id="${config.inputId}" class="auditor-search-input strict-select-search" placeholder="${safeEscape(config.placeholder)}" autocomplete="off" spellcheck="false">
          <button type="button" class="smart-dropdown-trigger strict-select-trigger" aria-label="Buka daftar ${config.kind === 'auditor' ? 'auditor' : 'store'}">▾</button>
          <div class="smart-dropdown-panel strict-select-panel" id="${config.inputId}Panel" hidden></div>
        </div>
        <div class="strict-select-meta" id="${config.inputId}Meta"></div>
      `;
      select.parentNode.insertBefore(shell, select);
      shell.insertBefore(select, shell.querySelector('.strict-select-meta'));
    }

    const input = shell.querySelector(`#${config.inputId}`);
    const trigger = shell.querySelector('.strict-select-trigger');
    const panel = shell.querySelector(`#${config.inputId}Panel`);
    const meta = shell.querySelector(`#${config.inputId}Meta`);

    input.required = true;
    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
    input.setAttribute('aria-controls', panel.id);
    input.placeholder = config.placeholder;
    input.dataset.helperText = config.helperText;

    select.classList.add('strict-select-native');
    select.required = false;
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const label = document.querySelector(`label[for="${select.id}"]`);
    if (label) {
      label.setAttribute('for', config.inputId);
    }

    const existingField = getStrictField(config.kind) || {};
    const field = setStrictField(config.kind, Object.assign(existingField, {
      config,
      kind: config.kind,
      shell,
      input,
      trigger,
      panel,
      meta,
      select,
      descriptors: existingField.descriptors || [],
      filteredDescriptors: existingField.filteredDescriptors || []
    }));

    setStrictFieldMeta(field, config.helperText, false);

    if (!shell.dataset.strictBound) {
      shell.dataset.strictBound = '1';

      input.addEventListener('focus', () => {
        renderStrictPanel(field);
        openStrictPanel(field);
      });

      input.addEventListener('click', () => {
        renderStrictPanel(field);
        openStrictPanel(field);
      });

      input.addEventListener('input', () => {
        const selectedLabel = String(field.input.dataset.selectedLabel || '').trim();
        if (!selectedLabel || shared.normalizeText(field.input.value || '') !== shared.normalizeText(selectedLabel)) {
          clearStrictSelection(field, { preserveInput: true, dispatchChange: false });
        }
        renderStrictPanel(field);
        openStrictPanel(field);
        syncStrictValidity(field, false);
        if (typeof window.updateProgressTracker === 'function') window.updateProgressTracker();
      });

      input.addEventListener('search', () => {
        renderStrictPanel(field);
        openStrictPanel(field);
        syncStrictValidity(field, false);
      });

      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          renderStrictPanel(field);
          openStrictPanel(field);
        }
        if (event.key === 'Escape') {
          closeStrictPanel(field);
        }
      });

      input.addEventListener('blur', () => {
        setTimeout(() => {
          if (!shell.contains(document.activeElement)) {
            closeStrictPanel(field);
            syncStrictValidity(field, Boolean(field.input.value));
          }
        }, 120);
      });

      trigger.addEventListener('click', event => {
        event.preventDefault();
        if (field.panel.hidden) {
          renderStrictPanel(field);
          openStrictPanel(field);
          input.focus();
        } else {
          closeStrictPanel(field);
        }
      });

      document.addEventListener('click', event => {
        if (!shell.contains(event.target)) {
          closeStrictPanel(field);
        }
      });
    }

    return field;
  }

  function ensureAuditorSelectUI() {
    const select = document.getElementById('namaDropdown');
    if (!select) return null;

    const autocompleteInput = document.getElementById('auditorAutocompleteInput');
    const autocompleteWrap = autocompleteInput ? autocompleteInput.closest('.auditor-autocomplete-wrap') : null;
    if (autocompleteWrap) {
      autocompleteWrap.remove();
    }

    const manual = document.getElementById('namaManual');
    if (manual) {
      manual.value = '';
      manual.required = false;
      manual.style.display = 'none';
      manual.setAttribute('aria-hidden', 'true');
      manual.tabIndex = -1;
    }

    const field = ensureStrictFieldUI(select, STRICT_FIELDS.auditor);

    if (!select.dataset.strictChangeBound) {
      select.dataset.strictChangeBound = '1';
      select.addEventListener('change', () => {
        syncStrictValidity(field, false);
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
      select.className = current.className || '';
      current.parentNode.replaceChild(select, current);
      current = select;
      current.dataset.pendingValue = previousValue;
    }

    const field = ensureStrictFieldUI(current, STRICT_FIELDS.store);

    if (!current.dataset.strictChangeBound) {
      current.dataset.strictChangeBound = '1';
      current.addEventListener('change', () => {
        syncStrictValidity(field, false);
        if (typeof window.updateProgressTracker === 'function') window.updateProgressTracker();
      });
    }

    return current;
  }

  function syncFieldAfterRender(field, resolvedCurrent) {
    const selected = getDescriptorByValue(field, resolvedCurrent);
    if (selected) {
      field.select.value = selected.value;
      field.input.value = selected.label;
      field.input.dataset.selectedValue = selected.value;
      field.input.dataset.selectedLabel = selected.label;
    } else {
      field.select.value = '';
      field.input.value = '';
      field.input.dataset.selectedValue = '';
      field.input.dataset.selectedLabel = '';
    }
    renderStrictPanel(field);
    syncStrictValidity(field, false);
  }

  function renderAuditorOptions(auditors) {
    const select = ensureAuditorSelectUI();
    if (!select) return;

    const field = getStrictField('auditor');
    const currentValue = String(select.value || '').trim();
    const pendingValue = select.dataset.pendingValue || '';
    const resolvedCurrent = currentValue || pendingValue;
    field.descriptors = buildAuditorDescriptors(auditors || []);

    rebuildNativeSelectOptions(field, field.descriptors);

    if (resolvedCurrent) {
      const matched = field.descriptors.find(item => shared.normalizeText(item.value) === shared.normalizeText(resolvedCurrent) || shared.normalizeText(item.label) === shared.normalizeText(resolvedCurrent));
      syncFieldAfterRender(field, matched ? matched.value : '');
    } else {
      syncFieldAfterRender(field, '');
    }

    delete select.dataset.pendingValue;
  }

  function renderStoreOptions(stores) {
    const select = ensureStoreSelectUI();
    if (!select) return;

    const field = getStrictField('store');
    const currentValue = String(select.value || '').trim();
    const pendingValue = select.dataset.pendingValue || '';
    const resolvedCurrent = currentValue || pendingValue;
    field.descriptors = buildStoreDescriptors(stores || []);

    rebuildNativeSelectOptions(field, field.descriptors);

    if (resolvedCurrent) {
      const matched = field.descriptors.find(item => shared.normalizeText(item.value) === shared.normalizeText(resolvedCurrent) || shared.normalizeText(item.data.name) === shared.normalizeText(resolvedCurrent) || shared.normalizeCode(item.data.code) === shared.normalizeCode(resolvedCurrent));
      syncFieldAfterRender(field, matched ? matched.value : '');
    } else {
      syncFieldAfterRender(field, '');
    }

    delete select.dataset.pendingValue;
  }
  window.syncAuditorSearchValue = function syncAuditorSearchValueStrict() {
    const field = getStrictField('auditor');
    if (!field) return;
    const descriptor = getDescriptorByValue(field, field.select.value || '');
    if (descriptor) {
      field.input.value = descriptor.label;
      field.input.dataset.selectedValue = descriptor.value;
      field.input.dataset.selectedLabel = descriptor.label;
    }
    syncStrictValidity(field, false);
  };

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
