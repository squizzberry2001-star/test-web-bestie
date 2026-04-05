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
    dropdowns: new Map(),
    statusBadge: null
  };

  function getCurrentConfig() {
    return state.config || shared.buildDefaultConfig();
  }

  function getCurrentLevels() {
    return ((getCurrentConfig().masters || {}).levels || []).slice();
  }

  const originalCreateCrewRow = window.createCrewRow;
  window.createCrewRow = function createCrewRowPro(data = {}) {
    const levels = getCurrentLevels();
    const wrapper = document.createElement('div');
    wrapper.className = 'list-item';
    wrapper.innerHTML = `
      <span class="row-number">1.</span>
      <input type="text" class="crew-name" placeholder="Nama crew" value="${window.escapeHtml ? window.escapeHtml(data.name || '') : String(data.name || '').replace(/[&<>"']/g, '')}">
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

  function safeEscape(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
    populateSingleLevelSelect(document.getElementById('storeLeaderLevel'), levels);
    populateSingleLevelSelect(document.getElementById('shiftLeaderLevel'), levels);
    document.querySelectorAll('.crew-level-select').forEach(select => populateSingleLevelSelect(select, levels, select.value));
  }

  function updateAuditorMaster(auditors) {
    const select = document.getElementById('namaDropdown');
    if (!select) return;
    const currentInput = document.getElementById('auditorAutocompleteInput');
    const current = currentInput ? currentInput.value.trim() : (select.value || '');
    select.innerHTML = '<option value="">-- Pilih Nama --</option>'
      + auditors.map(name => `<option value="${safeEscape(name)}">${safeEscape(name)}</option>`).join('')
      + '<option value="__MANUAL__">Lainnya...</option>';

    if (typeof window.populateAuditorAutocompleteV3 === 'function') {
      window.populateAuditorAutocompleteV3();
    }
    if (currentInput && current) {
      currentInput.value = current;
      if (typeof window.syncAuditorAutocompleteSelectionV3 === 'function') {
        window.syncAuditorAutocompleteSelectionV3();
      }
    }
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

  function addAdminNavLink() {
    const switcher = document.querySelector('.page-switcher');
    if (!switcher || switcher.querySelector('[data-admin-console-link]')) return;
    const link = document.createElement('a');
    link.href = 'admin.html';
    link.className = 'page-btn';
    link.dataset.adminConsoleLink = '1';
    link.textContent = 'ADMIN CONSOLE';
    switcher.appendChild(link);
  }

  function normalizeOptionList(options) {
    return shared.uniqueSorted(options || []);
  }

  function attachSmartDropdown(input, optionsProvider, options = {}) {
    if (!input) return null;
    if (input.dataset.smartDropdownBound === '1') {
      return state.dropdowns.get(input.id || options.fieldKey) || null;
    }
    input.dataset.smartDropdownBound = '1';
    input.autocomplete = 'off';
    input.removeAttribute('list');

    let wrapper = input.parentElement;
    if (!wrapper.classList.contains('smart-dropdown')) {
      wrapper = document.createElement('div');
      wrapper.className = 'smart-dropdown';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
    }

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'smart-dropdown-trigger';
    trigger.setAttribute('aria-label', options.triggerLabel || 'Buka daftar pilihan');
    trigger.innerHTML = '<span aria-hidden="true">▾</span>';

    const panel = document.createElement('div');
    panel.className = 'smart-dropdown-panel';
    panel.hidden = true;

    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);

    let visibleItems = [];
    let activeIndex = -1;
    let closeTimer = null;

    function getOptions() {
      return normalizeOptionList(typeof optionsProvider === 'function' ? optionsProvider() : []);
    }

    function buildFiltered(term, showAll) {
      const raw = getOptions();
      const query = shared.normalizeText(term);
      let filtered = raw;
      if (query && !showAll) {
        filtered = raw.filter(item => shared.normalizeText(item).indexOf(query) >= 0);
      }
      if (!query && !showAll) {
        filtered = raw.slice(0, options.compactPreviewLimit || 12);
      }
      if (showAll && !query) {
        filtered = raw.slice(0, options.showAllLimit || 40);
      }
      if (!filtered.length && query && options.allowCustom !== false) {
        return [{ label: `Gunakan "${term}"`, value: term, custom: true }];
      }
      return filtered.slice(0, options.maxItems || 40).map(item => ({ label: item, value: item, custom: false }));
    }

    function render(showAll = false) {
      const query = String(input.value || '').trim();
      visibleItems = buildFiltered(query, showAll);
      activeIndex = visibleItems.length ? 0 : -1;

      if (!visibleItems.length) {
        panel.innerHTML = `<div class="smart-dropdown-empty">${safeEscape(options.emptyText || 'Tidak ada hasil yang cocok.')}</div>`;
      } else {
        panel.innerHTML = visibleItems.map((item, index) => `
          <button type="button" class="smart-dropdown-option ${index === activeIndex ? 'active' : ''}" data-option-index="${index}" data-option-value="${safeEscape(item.value)}">
            <span>${safeEscape(item.label)}</span>
            ${item.custom ? '<small>Custom</small>' : ''}
          </button>
        `).join('');
      }
    }

    function open(showAll = false) {
      clearTimeout(closeTimer);
      wrapper.classList.add('open');
      panel.hidden = false;
      render(showAll);
    }

    function close() {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        wrapper.classList.remove('open');
        panel.hidden = true;
      }, 120);
    }

    function commit(value) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      close();
    }

    function move(delta) {
      if (panel.hidden) open(false);
      if (!visibleItems.length) return;
      activeIndex = (activeIndex + delta + visibleItems.length) % visibleItems.length;
      panel.querySelectorAll('.smart-dropdown-option').forEach((optionEl, index) => {
        optionEl.classList.toggle('active', index === activeIndex);
      });
    }

    input.addEventListener('focus', () => open(false));
    input.addEventListener('input', () => open(false));
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        move(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        move(-1);
      } else if (event.key === 'Enter') {
        if (!panel.hidden && activeIndex >= 0 && visibleItems[activeIndex]) {
          event.preventDefault();
          commit(visibleItems[activeIndex].value);
        }
      } else if (event.key === 'Escape') {
        close();
      }
    });
    input.addEventListener('blur', close);
    trigger.addEventListener('click', event => {
      event.preventDefault();
      if (panel.hidden) {
        input.focus();
        open(true);
      } else {
        close();
      }
    });
    panel.addEventListener('mousedown', event => {
      const optionButton = event.target.closest('.smart-dropdown-option');
      if (!optionButton) return;
      event.preventDefault();
      commit(optionButton.dataset.optionValue || '');
    });
    document.addEventListener('click', event => {
      if (!wrapper.contains(event.target)) close();
    });

    const api = { update: () => render(false) };
    state.dropdowns.set(input.id || options.fieldKey || Math.random().toString(36), api);
    return api;
  }

  function applyReportConfig(config, source = state.source) {
    state.config = shared.mergeConfig(config, source || 'default');
    state.source = state.config.meta.source || source || 'default';
    updateAuditorMaster(state.config.masters.auditors || []);
    refreshAllLevelSelects(state.config.masters.levels || []);
    applyFeatureVisibility(state.config.features || {});
    applyLinks(state.config);
    setStatusBadge(state.source);

    const auditorInput = document.getElementById('auditorAutocompleteInput');
    if (auditorInput) {
      const dropdown = attachSmartDropdown(auditorInput, () => (getCurrentConfig().masters || {}).auditors || [], {
        fieldKey: 'auditor',
        triggerLabel: 'Buka daftar auditor',
        emptyText: 'Nama auditor tidak ditemukan. Tekan Enter untuk memakai nama custom.'
      });
      dropdown && dropdown.update();
    }

    const storeInput = document.getElementById('store');
    if (storeInput) {
      const dropdown = attachSmartDropdown(storeInput, () => (getCurrentConfig().masters || {}).stores || [], {
        fieldKey: 'store',
        triggerLabel: 'Buka daftar store',
        emptyText: 'Store tidak ditemukan. Ketik manual untuk store baru bila belum ada.',
        compactPreviewLimit: 14,
        showAllLimit: 60,
        maxItems: 60
      });
      dropdown && dropdown.update();
      storeInput.placeholder = 'Cari atau pilih store dari daftar';
    }
  }

  async function bootReportUpgrade() {
    addAdminNavLink();
    state.statusBadge = ensureStatusBadge();
    const loaded = await shared.loadAdminConfig();
    applyReportConfig(loaded.config, loaded.source);
  }

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
