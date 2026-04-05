(function () {
  const RB_ADMIN_STORAGE_KEY = 'rbvr-admin-config-v2';
  const RB_ADMIN_SESSION_KEY = 'rbvr-admin-session-code';
  const FALLBACK_ADMIN_CODE = String((window.RB_CONFIG && (window.RB_CONFIG.ADMIN_PANEL_CODE || window.RB_CONFIG.USAGE_DASHBOARD_CODE)) || '607090').trim();
  const MASTER_DEFAULTS = window.RB_MASTER_DEFAULTS || {};

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeText(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeCode(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return raw;
    if (digits.length >= 3) return digits;
    return digits.padStart(3, '0');
  }

  function uniqueSorted(items) {
    const seen = new Map();
    (items || []).forEach(item => {
      const raw = String(item == null ? '' : item).replace(/\s+/g, ' ').trim();
      const key = normalizeText(raw);
      if (!raw || seen.has(key)) return;
      seen.set(key, raw);
    });
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }));
  }

  function storeMatchesQuery(store, query) {
    const candidate = normalizeText(query);
    if (!candidate) return false;
    return [
      store.code,
      store.name,
      formatStoreLabel(store),
      store.type,
      store.city,
      store.province
    ].some(part => normalizeText(part).includes(candidate));
  }

  function formatStoreLabel(store) {
    const normalized = normalizeStoreItem(store);
    if (!normalized.name) return normalized.code || '';
    return normalized.code ? `${normalized.code} - ${normalized.name}` : normalized.name;
  }

  function formatAuditorLabel(auditor) {
    const normalized = normalizeAuditorItem(auditor);
    if (!normalized.name) return '';
    return normalized.nik ? `${normalized.name} • NIK ${normalized.nik}` : normalized.name;
  }

  function makeDefaultStoreMaps() {
    const list = normalizeStoreList(MASTER_DEFAULTS.stores || []);
    const byCode = new Map();
    const byName = new Map();
    list.forEach(item => {
      if (item.code) byCode.set(normalizeCode(item.code), item);
      if (item.name) byName.set(normalizeText(item.name), item);
      if (item.name || item.code) {
        byName.set(normalizeText(formatStoreLabel(item)), item);
      }
    });
    return { list, byCode, byName };
  }

  const DEFAULT_STORE_MAPS = makeDefaultStoreMaps();
  const DEFAULT_STORE_MASTER = DEFAULT_STORE_MAPS.list;

  function normalizeStoreItem(item) {
    if (item == null) return { code: '', name: '', type: '', city: '', province: '' };

    let raw = item;
    if (typeof raw === 'string') {
      const value = raw.replace(/\s+/g, ' ').trim();
      const pattern = value.match(/^([0-9]{1,6})\s*[-–•]\s*(.+)$/);
      if (pattern) {
        raw = { code: pattern[1], name: pattern[2] };
      } else {
        const matchedDefault = DEFAULT_STORE_MAPS.byName.get(normalizeText(value)) || DEFAULT_STORE_MAPS.byCode.get(normalizeCode(value));
        if (matchedDefault) {
          raw = matchedDefault;
        } else {
          raw = { code: '', name: value };
        }
      }
    }

    const code = normalizeCode(raw.code || raw.site || raw.storeCode || raw.id || '');
    const name = String(raw.name || raw.store || raw.siteDescr || raw.SiteDescr || raw.label || '').replace(/\s+/g, ' ').trim();
    const type = String(raw.type || raw.storeType || '').replace(/\s+/g, ' ').trim();
    const city = String(raw.city || '').replace(/\s+/g, ' ').trim();
    const province = String(raw.province || '').replace(/\s+/g, ' ').trim();

    let resolved = { code, name, type, city, province };

    if ((!resolved.name || !resolved.code) && resolved.name) {
      const matchedDefault = DEFAULT_STORE_MAPS.byName.get(normalizeText(resolved.name));
      if (matchedDefault) {
        resolved = {
          code: resolved.code || matchedDefault.code,
          name: resolved.name || matchedDefault.name,
          type: resolved.type || matchedDefault.type,
          city: resolved.city || matchedDefault.city,
          province: resolved.province || matchedDefault.province
        };
      }
    }

    if ((!resolved.name || !resolved.code) && resolved.code) {
      const matchedDefault = DEFAULT_STORE_MAPS.byCode.get(normalizeCode(resolved.code));
      if (matchedDefault) {
        resolved = {
          code: resolved.code || matchedDefault.code,
          name: resolved.name || matchedDefault.name,
          type: resolved.type || matchedDefault.type,
          city: resolved.city || matchedDefault.city,
          province: resolved.province || matchedDefault.province
        };
      }
    }

    return resolved;
  }

  function normalizeStoreList(items) {
    const seen = new Map();
    (items || []).forEach(item => {
      const normalized = normalizeStoreItem(item);
      if (!normalized.name && !normalized.code) return;
      const key = normalized.code ? `code:${normalizeCode(normalized.code)}` : `name:${normalizeText(normalized.name)}`;
      if (!seen.has(key)) {
        seen.set(key, normalized);
      }
    });

    return Array.from(seen.values()).sort((a, b) => {
      const codeA = normalizeCode(a.code);
      const codeB = normalizeCode(b.code);
      if (codeA && codeB && codeA !== codeB) {
        return codeA.localeCompare(codeB, 'id', { numeric: true, sensitivity: 'base' });
      }
      return String(a.name || '').localeCompare(String(b.name || ''), 'id', { sensitivity: 'base' });
    });
  }

  const DEFAULT_AUDITOR_MASTER = normalizeAuditorList(MASTER_DEFAULTS.auditors || []);

  function normalizeAuditorItem(item) {
    if (item == null) return { name: '', nik: '' };

    let raw = item;
    if (typeof raw === 'string') {
      raw = { name: raw, nik: '' };
    }

    const name = String(raw.name || raw.auditor || raw.auditorName || raw.Nama || raw['Nama Auditor'] || '').replace(/\s+/g, ' ').trim();
    const nik = String(raw.nik || raw.NIK || raw.employeeId || raw.employee_id || '').replace(/\s+/g, ' ').trim();

    return { name, nik };
  }

  function normalizeAuditorList(items) {
    const seen = new Map();
    (items || []).forEach(item => {
      const normalized = normalizeAuditorItem(item);
      const key = normalizeText(normalized.name);
      if (!key) return;
      if (!seen.has(key)) {
        seen.set(key, normalized);
      } else if (normalized.nik && !seen.get(key).nik) {
        seen.set(key, normalized);
      }
    });
    return Array.from(seen.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id', { sensitivity: 'base' }));
  }

  function normalizeLevelList(items) {
    return uniqueSorted(items || []);
  }

  function findStoreItem(query, stores) {
    const list = normalizeStoreList(stores || DEFAULT_STORE_MASTER);
    const candidate = normalizeText(query);
    if (!candidate) return null;
    return list.find(store => storeMatchesQuery(store, candidate)) || null;
  }

  function findAuditorItem(query, auditors) {
    const list = normalizeAuditorList(auditors || DEFAULT_AUDITOR_MASTER);
    const candidate = normalizeText(query);
    if (!candidate) return null;
    return list.find(item => {
      return normalizeText(item.name) === candidate || normalizeText(formatAuditorLabel(item)) === candidate || normalizeText(item.nik) === candidate;
    }) || null;
  }

  const DEFAULT_ADMIN_CONFIG = Object.freeze({
    version: 2,
    features: {
      qscResult: true,
      opiTable: true,
      qscTable: true,
      findingEvidence: true,
      correctiveAction: true,
      assignmentSection: true,
      progressDock: true
    },
    links: {
      opiReport: 'https://tinyurl.com/opi-report',
      assignment: 'https://tinyurl.com/store-caassignment'
    },
    masters: {
      auditors: DEFAULT_AUDITOR_MASTER,
      stores: DEFAULT_STORE_MASTER,
      levels: normalizeLevelList(MASTER_DEFAULTS.levels || ['1A', 'NS3', 'NS1', 'MG3', 'MG1'])
    },
    meta: {
      updatedAt: '',
      updatedBy: 'System',
      source: 'default'
    }
  });

  function coerceFeatures(raw, fallback) {
    const target = { ...fallback };
    Object.keys(fallback || {}).forEach(key => {
      if (raw && Object.prototype.hasOwnProperty.call(raw, key)) {
        target[key] = Boolean(raw[key]);
      }
    });
    return target;
  }

  function buildDefaultConfig() {
    return clone(DEFAULT_ADMIN_CONFIG);
  }

  function mergeConfig(rawConfig = {}, source = 'default') {
    const defaults = buildDefaultConfig();
    const raw = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};

    defaults.features = coerceFeatures(raw.features, defaults.features);

    if (raw.links && typeof raw.links === 'object') {
      defaults.links.opiReport = String(raw.links.opiReport || defaults.links.opiReport).trim() || defaults.links.opiReport;
      defaults.links.assignment = String(raw.links.assignment || defaults.links.assignment).trim() || defaults.links.assignment;
    }

    if (raw.masters && typeof raw.masters === 'object') {
      if (Array.isArray(raw.masters.auditors) && raw.masters.auditors.length) {
        defaults.masters.auditors = normalizeAuditorList(raw.masters.auditors);
      }
      if (Array.isArray(raw.masters.stores) && raw.masters.stores.length) {
        defaults.masters.stores = normalizeStoreList(raw.masters.stores);
      }
      if (Array.isArray(raw.masters.levels) && raw.masters.levels.length) {
        defaults.masters.levels = normalizeLevelList(raw.masters.levels);
      }
    }

    defaults.meta = {
      updatedAt: raw.meta && raw.meta.updatedAt ? String(raw.meta.updatedAt) : '',
      updatedBy: raw.meta && raw.meta.updatedBy ? String(raw.meta.updatedBy) : '',
      source: source || (raw.meta && raw.meta.source) || 'default'
    };

    return defaults;
  }

  function readLocalConfig() {
    try {
      const raw = localStorage.getItem(RB_ADMIN_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.error('Gagal membaca admin config lokal', error);
      return null;
    }
  }

  function saveLocalConfig(config) {
    const merged = mergeConfig(config, 'local');
    merged.meta.updatedAt = new Date().toISOString();
    if (!merged.meta.updatedBy) merged.meta.updatedBy = 'Admin Console';
    try {
      localStorage.setItem(RB_ADMIN_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    } catch (error) {
      console.error('Gagal menyimpan admin config lokal', error);
      return merged;
    }
  }

  async function parseJsonSafe(response) {
    const raw = await response.text();
    try {
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return { status: 'error', message: raw || 'Response bukan JSON valid.' };
    }
  }

  async function fetchRemoteConfig() {
    if (!window.RB_CONFIG || !window.RB_CONFIG.API_URL) return null;
    const url = new URL(window.RB_CONFIG.API_URL, window.location.href);
    url.searchParams.set('action', 'admin_config');
    url.searchParams.set('ts', String(Date.now()));
    const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
    const payload = await parseJsonSafe(response);
    const status = String(payload.status || '').toLowerCase();
    if (!response.ok || !['success', 'ok'].includes(status)) {
      throw new Error(payload.message || 'Gagal memuat admin config dari server.');
    }
    return payload;
  }

  async function loadAdminConfig() {
    const local = readLocalConfig();
    try {
      const remotePayload = await fetchRemoteConfig();
      const merged = mergeConfig(remotePayload.config || {}, 'server');
      if (remotePayload.config && remotePayload.config.meta && remotePayload.config.meta.updatedAt) {
        merged.meta.updatedAt = String(remotePayload.config.meta.updatedAt);
      }
      if (remotePayload.config && remotePayload.config.meta && remotePayload.config.meta.updatedBy) {
        merged.meta.updatedBy = String(remotePayload.config.meta.updatedBy);
      }
      saveLocalConfig(merged);
      return {
        config: merged,
        source: 'server',
        remoteAvailable: true,
        message: 'Admin config dibaca dari server.'
      };
    } catch (error) {
      const merged = mergeConfig(local || {}, local ? 'local' : 'default');
      return {
        config: merged,
        source: local ? 'local' : 'default',
        remoteAvailable: false,
        message: local ? 'Memakai admin config lokal browser.' : 'Memakai admin config default.'
      };
    }
  }

  function getSessionCode() {
    return String(sessionStorage.getItem(RB_ADMIN_SESSION_KEY) || '').trim();
  }

  function setSessionCode(code) {
    sessionStorage.setItem(RB_ADMIN_SESSION_KEY, String(code || '').trim());
  }

  function clearSessionCode() {
    sessionStorage.removeItem(RB_ADMIN_SESSION_KEY);
  }

  async function verifyAdminCode(code) {
    const candidate = String(code || '').trim();
    if (!candidate) {
      return { ok: false, source: 'client', message: 'Kode admin wajib diisi.' };
    }

    if (window.RB_CONFIG && window.RB_CONFIG.API_URL) {
      try {
        const url = new URL(window.RB_CONFIG.API_URL, window.location.href);
        url.searchParams.set('action', 'verify_admin');
        url.searchParams.set('code', candidate);
        url.searchParams.set('ts', String(Date.now()));
        const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
        const payload = await parseJsonSafe(response);
        const status = String(payload.status || '').toLowerCase();
        if (response.ok && ['success', 'ok'].includes(status)) {
          return { ok: true, source: 'server', message: payload.message || 'Kode admin valid.' };
        }
      } catch (error) {
        // fallback client side below
      }
    }

    if (candidate === FALLBACK_ADMIN_CODE) {
      return { ok: true, source: 'client', message: 'Kode admin valid (fallback browser).' };
    }

    return { ok: false, source: 'client', message: 'Kode admin tidak valid.' };
  }

  async function saveAdminConfig(config, code, updatedBy = 'Admin Console') {
    const merged = mergeConfig(config, 'local');
    merged.meta.updatedAt = new Date().toISOString();
    merged.meta.updatedBy = String(updatedBy || 'Admin Console');
    const localSaved = saveLocalConfig(merged);

    if (!window.RB_CONFIG || !window.RB_CONFIG.API_URL) {
      return {
        ok: true,
        localSaved: true,
        remoteSaved: false,
        config: localSaved,
        message: 'Tersimpan di browser lokal. API belum tersedia untuk publish global.'
      };
    }

    try {
      const response = await fetch(window.RB_CONFIG.API_URL, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_admin_config',
          code: String(code || '').trim(),
          updatedBy: merged.meta.updatedBy,
          config: merged
        })
      });
      const payload = await parseJsonSafe(response);
      const status = String(payload.status || '').toLowerCase();
      if (!response.ok || !['success', 'ok'].includes(status)) {
        throw new Error(payload.message || 'Publish config gagal.');
      }
      const resolved = mergeConfig(payload.config || merged, 'server');
      resolved.meta.updatedAt = payload.updatedAt || resolved.meta.updatedAt || new Date().toISOString();
      resolved.meta.updatedBy = payload.updatedBy || resolved.meta.updatedBy || merged.meta.updatedBy;
      saveLocalConfig(resolved);
      return {
        ok: true,
        localSaved: true,
        remoteSaved: true,
        config: resolved,
        message: payload.message || 'Admin config berhasil dipublish ke server.'
      };
    } catch (error) {
      return {
        ok: true,
        localSaved: true,
        remoteSaved: false,
        config: localSaved,
        message: error.message || 'Publish global gagal. Config tetap aman di browser lokal.'
      };
    }
  }

  window.RBAdminShared = {
    STORAGE_KEY: RB_ADMIN_STORAGE_KEY,
    SESSION_KEY: RB_ADMIN_SESSION_KEY,
    buildDefaultConfig,
    mergeConfig,
    readLocalConfig,
    saveLocalConfig,
    loadAdminConfig,
    getSessionCode,
    setSessionCode,
    clearSessionCode,
    verifyAdminCode,
    saveAdminConfig,
    normalizeText,
    normalizeCode,
    uniqueSorted,
    normalizeStoreItem,
    normalizeStoreList,
    normalizeAuditorItem,
    normalizeAuditorList,
    normalizeLevelList,
    formatStoreLabel,
    formatAuditorLabel,
    findStoreItem,
    findAuditorItem,
    defaultStores: DEFAULT_STORE_MASTER,
    defaultAuditors: DEFAULT_AUDITOR_MASTER
  };
})();
