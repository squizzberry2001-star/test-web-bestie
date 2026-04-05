/**
 * Regional Bestie Apps Script backend
 *
 * Script Properties yang wajib diisi untuk mode upload:
 * - ROOT_FOLDER_ID
 * - SPREADSHEET_ID
 *
 * Properti opsional:
 * - SHEET_NAME (default: Sheet1)
 * - TIMEZONE (default: GMT+7)
 * - USAGE_DASHBOARD_CODE
 * - ADMIN_PANEL_CODE (default mengikuti USAGE_DASHBOARD_CODE / 607090)
 * - USAGE_LOG_SHEET_NAME (default: UsageLog)
 * - USAGE_STATE_SHEET_NAME (default: UsageState)
 * - ADMIN_CONFIG_SHEET_NAME (default: AdminConfig)
 */

var AUDITOR_MASTER_LIST = [
  'Aan Bagus Permana',
  'Anggi Novita',
  'Aulia Fauziah',
  'Aulia Puspita Dewi',
  'Bagus Pradika',
  'Cindy Silvia Sahyu',
  'Didin Sarudin',
  'Edi Sukarno',
  'Fadliani Rizky Fidiaz',
  'Fajar Saputra',
  'Fendi Setiawan',
  'Fiqri Amatul Firdaus',
  'Karlina Endah Puji Astuti',
  'Malik Ibrahim',
  'Muhammad Fikri',
  'Novilya Dwi Rahman',
  'Rani Ismawati',
  'Rido Yuhanda',
  'Riki Prasetyawan',
  'Rully Alfandi',
  'Seftiana Putri Rahmawati',
  'Tia Fitri',
  'Yuyun Yuliyanti',
  'Andika Ryan Achmada',
  'Dhea Almahdiansyah',
  'Ilyas Fajar Arisena',
  'Nia Tri Rahayu'
];

var REPORT_HEADERS = [
  'report_id',
  'uploaded_at',
  'visit_date',
  'auditor',
  'store',
  'store_leader',
  'shift_leader',
  'crew_count',
  'opi_findings',
  'qsc_findings',
  'total_findings',
  'pdf_filename',
  'pdf_url',
  'pdf_file_id',
  'status',
  'auditor_nik',
  'store_code',
  'store_label'
];

var USAGE_LOG_HEADERS = [
  'logged_at',
  'session_id',
  'event_type',
  'detail',
  'auditor',
  'store',
  'page',
  'append_history',
  'user_agent',
  'url',
  'meta_json'
];

var USAGE_STATE_HEADERS = [
  'session_id',
  'auditor',
  'store',
  'page',
  'event_type',
  'detail',
  'last_seen_at',
  'user_agent',
  'url',
  'meta_json'
];

var ADMIN_CONFIG_HEADERS = [
  'config_key',
  'json_value',
  'updated_at',
  'updated_by'
];

var DEFAULT_ADMIN_CONFIG = {
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
    auditors: AUDITOR_MASTER_LIST.map(function(name) { return { name: name, nik: '' }; }),
    stores: [],
    levels: ['1A', 'NS3', 'NS1', 'MG3', 'MG1']
  },
  meta: {
    updatedAt: '',
    updatedBy: 'System',
    source: 'default'
  }
};

function doGet(e) {
  try {
    var action = normalizeAction_((e && e.parameter && e.parameter.action) || 'analytics');

    if (action === 'analytics' || action === 'reports') {
      return jsonResponse_(buildAnalyticsPayload_());
    }

    if (action === 'health') {
      return jsonResponse_(buildHealthPayload_());
    }

    if (action === 'config') {
      return jsonResponse_(buildConfigPayload_());
    }

    if (action === 'usage_dashboard') {
      return jsonResponse_(buildUsageDashboard_({
        code: e && e.parameter ? e.parameter.code : '',
        activeWindowMs: e && e.parameter ? e.parameter.activeWindowMs : ''
      }));
    }

    if (action === 'admin_config') {
      return jsonResponse_(buildAdminConfigPayload_());
    }

    if (action === 'verify_admin') {
      return jsonResponse_(verifyAdminAccessPayload_(e && e.parameter ? e.parameter.code : ''));
    }

    return jsonResponse_({
      status: 'error',
      message: 'Unsupported action'
    });
  } catch (error) {
    return jsonResponse_({
      status: 'error',
      message: error.message
    });
  }
}

function doPost(e) {
  try {
    var request = parseRequest_(e);
    var action = normalizeAction_(request.action || 'upload_report');

    if (action === 'track_usage') {
      return jsonResponse_(trackUsage_(request));
    }

    if (action === 'usage_dashboard') {
      return jsonResponse_(buildUsageDashboard_(request));
    }

    if (action === 'save_admin_config') {
      return jsonResponse_(saveAdminConfig_(request));
    }

    var result = saveReport_(request);
    return jsonResponse_({
      status: 'success',
      message: 'Report saved successfully',
      reportId: result.reportId,
      folder: result.folder,
      fileUrl: result.fileUrl,
      fileName: result.fileName
    });
  } catch (error) {
    return jsonResponse_({
      status: 'error',
      message: error.message
    });
  }
}

function buildHealthPayload_() {
  var settings = getSettings_();
  return {
    status: 'success',
    message: 'Regional Bestie API ready',
    readyForUpload: Boolean(settings.rootFolderId && settings.spreadsheetId),
    configured: {
      driveFolder: Boolean(settings.rootFolderId),
      spreadsheet: Boolean(settings.spreadsheetId),
      usageDashboardCode: Boolean(settings.usageDashboardCode),
      adminPanelCode: Boolean(resolveAdminPanelCode_(settings)),
      adminConfigSheet: Boolean(settings.spreadsheetId)
    },
    features: {
      usageDashboard: Boolean(settings.usageDashboardCode),
      reportUpload: Boolean(settings.rootFolderId && settings.spreadsheetId),
      adminConfig: Boolean(settings.spreadsheetId)
    },
    generatedAt: new Date().toISOString()
  };
}

function buildConfigPayload_() {
  var settings = getSettings_();
  return {
    status: 'success',
    apiConfigured: Boolean(settings.rootFolderId && settings.spreadsheetId),
    usageDashboardEnabled: Boolean(settings.usageDashboardCode),
    adminConfigEnabled: Boolean(settings.spreadsheetId),
    sheetName: settings.sheetName,
    adminConfigSheetName: settings.adminConfigSheetName,
    timezone: settings.timezone,
    generatedAt: new Date().toISOString()
  };
}

function saveReport_(payload) {
  var settings = getSettings_();
  assertUploadConfigured_(settings);

  var adminConfig = mergeAdminConfig_(readAdminConfig_() || {});
  var auditorInput = String(payload.auditor || payload.nama || '').trim();
  var parsedStore = parseStoreValue_(payload.toko || payload.store || '');
  var matchedStore = findStoreFromConfig_(parsedStore.label || parsedStore.name || parsedStore.code, adminConfig);
  var storeName = String(payload.storeName || (matchedStore && matchedStore.name) || parsedStore.name || '').trim();
  var storeCode = normalizeCode_(payload.storeCode || (matchedStore && matchedStore.code) || parsedStore.code || '');
  var storeLabel = String(payload.storeLabel || (matchedStore && formatStoreLabel_(matchedStore)) || parsedStore.label || formatStoreLabel_({ code: storeCode, name: storeName }) || storeName).trim();
  var visitDate = String(payload.visitDate || payload.tanggal || '').trim() || Utilities.formatDate(new Date(), settings.timezone, 'yyyy-MM-dd');
  var pdfBase64 = extractPdfBase64_(payload.pdf);
  var storeLeader = String(payload.storeLeader || '').trim();
  var shiftLeader = String(payload.shiftLeader || '').trim();
  var crewCount = toNumber_(payload.crewCount);
  var opiFindings = toNumber_(payload.opiFindings);
  var qscFindings = toNumber_(payload.qscFindings);
  var totalFindings = toNumber_(payload.totalFindings) || (opiFindings + qscFindings);

  if (!storeLabel && !storeName) {
    throw new Error('Store wajib diisi.');
  }
  if (!auditorInput) {
    throw new Error('Auditor wajib diisi.');
  }
  if (!pdfBase64) {
    throw new Error('PDF base64 tidak ditemukan di payload.');
  }

  var matchedAuditor = findAuditorFromConfig_(auditorInput, adminConfig);
  var auditorFolderName = (matchedAuditor && matchedAuditor.name) || auditorInput || 'Auditor Lainnya';
  var auditorNik = String(payload.auditorNik || (matchedAuditor && matchedAuditor.nik) || '').trim();
  var effectiveStoreName = storeName || storeLabel;
  var reportId = buildReportId_(visitDate, auditorFolderName, effectiveStoreName);
  var fileName = String(payload.fileName || ('VisitReport_' + sanitizeFileName_(storeLabel || effectiveStoreName) + '_' + sanitizeFileName_(auditorFolderName) + '_' + visitDate + '.pdf'));
  var generatedTimestamp = new Date().toISOString();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  var newFile = null;
  try {
    var sheet = getReportSheet_(settings);
    ensureHeaders_(sheet, REPORT_HEADERS);

    var existingRow = findRowByKey_(sheet, reportId, 1);
    var existingRowValues = existingRow > 1
      ? sheet.getRange(existingRow, 1, 1, Math.max(REPORT_HEADERS.length, sheet.getLastColumn())).getValues()[0]
      : [];

    var existingFileId = String(existingRowValues[13] || '').trim();
    var existingFileUrl = String(existingRowValues[12] || '').trim();
    if (!existingFileId && existingFileUrl) {
      existingFileId = extractDriveFileIdFromUrl_(existingFileUrl);
    }

    var rootFolder = DriveApp.getFolderById(settings.rootFolderId);
    var yearFolder = ensureFolder_(rootFolder, resolveFolderYear_(visitDate));
    var auditorFolder = ensureFolder_(yearFolder, auditorFolderName);

    var blob = Utilities.newBlob(Utilities.base64Decode(pdfBase64), 'application/pdf', fileName);
    newFile = auditorFolder.createFile(blob);

    var rowValues = [
      reportId,
      generatedTimestamp,
      visitDate,
      auditorFolderName,
      effectiveStoreName,
      storeLeader,
      shiftLeader,
      crewCount,
      opiFindings,
      qscFindings,
      totalFindings,
      fileName,
      newFile.getUrl(),
      newFile.getId(),
      'Uploaded',
      auditorNik,
      storeCode,
      storeLabel || effectiveStoreName
    ];

    if (existingRow > 1) {
      sheet.getRange(existingRow, 1, 1, REPORT_HEADERS.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    if (existingFileId && existingFileId !== newFile.getId()) {
      trashDriveFileById_(existingFileId);
    }

    return {
      reportId: reportId,
      folder: auditorFolderName,
      fileUrl: newFile.getUrl(),
      fileName: fileName
    };
  } catch (error) {
    if (newFile) {
      try {
        newFile.setTrashed(true);
      } catch (cleanupError) {}
    }
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function buildAnalyticsPayload_() {
  var settings = getSettings_();
  assertSpreadsheetConfigured_(settings);

  var sheet = getReportSheet_(settings);
  ensureHeaders_(sheet, REPORT_HEADERS);

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return {
      status: 'success',
      generatedAt: new Date().toISOString(),
      rows: [],
      summary: {
        totalReports: 0,
        uniqueStores: 0,
        uniqueAuditors: 0,
        totalFindings: 0
      }
    };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, Math.max(REPORT_HEADERS.length, sheet.getLastColumn())).getValues();
  var rows = values
    .map(mapSheetRow_)
    .filter(function(row) {
      return row.store || row.auditor || row.pdfUrl;
    });

  return {
    status: 'success',
    generatedAt: new Date().toISOString(),
    rows: rows,
    summary: {
      totalReports: rows.length,
      uniqueStores: uniqueCount_(rows.map(function(row) { return row.store; })),
      uniqueAuditors: uniqueCount_(rows.map(function(row) { return row.auditor; })),
      totalFindings: rows.reduce(function(sum, row) { return sum + toNumber_(row.totalFindings); }, 0)
    }
  };
}

function trackUsage_(payload) {
  var settings = getSettings_();
  assertSpreadsheetConfigured_(settings);

  var spreadsheet = SpreadsheetApp.openById(settings.spreadsheetId);
  var logSheet = getOrCreateSheet_(spreadsheet, settings.usageLogSheetName, USAGE_LOG_HEADERS);
  var stateSheet = getOrCreateSheet_(spreadsheet, settings.usageStateSheetName, USAGE_STATE_HEADERS);

  var sessionId = String(payload.sessionId || ('sess_' + Utilities.getUuid())).trim();
  var eventType = String(payload.eventType || 'heartbeat').trim();
  var detail = String(payload.detail || '').trim();
  var auditor = String(payload.auditor || '').trim();
  var store = String(payload.store || '').trim();
  var page = String(payload.page || '').trim();
  var appendHistory = toBoolean_(payload.appendHistory);
  var userAgent = String(payload.userAgent || '').trim();
  var url = String(payload.url || '').trim();
  var meta = collectMetaPayload_(payload);
  var nowIso = new Date().toISOString();

  var stateRow = [
    sessionId,
    auditor,
    store,
    page,
    eventType,
    detail,
    nowIso,
    userAgent,
    url,
    JSON.stringify(meta)
  ];

  upsertRowByKey_(stateSheet, sessionId, stateRow, 1, USAGE_STATE_HEADERS.length);

  if (appendHistory) {
    logSheet.appendRow([
      nowIso,
      sessionId,
      eventType,
      detail,
      auditor,
      store,
      page,
      appendHistory ? '1' : '0',
      userAgent,
      url,
      JSON.stringify(meta)
    ]);
  }

  return {
    status: 'success',
    sessionId: sessionId,
    loggedAt: nowIso
  };
}

function buildUsageDashboard_(payload) {
  var settings = getSettings_();
  assertSpreadsheetConfigured_(settings);

  if (!settings.usageDashboardCode) {
    throw new Error('USAGE_DASHBOARD_CODE belum diatur di Script Properties.');
  }

  var suppliedCode = String(payload.code || '').trim();
  if (!suppliedCode || suppliedCode !== settings.usageDashboardCode) {
    throw new Error('Kode dashboard tidak valid.');
  }

  var spreadsheet = SpreadsheetApp.openById(settings.spreadsheetId);
  var logSheet = getOrCreateSheet_(spreadsheet, settings.usageLogSheetName, USAGE_LOG_HEADERS);
  var stateSheet = getOrCreateSheet_(spreadsheet, settings.usageStateSheetName, USAGE_STATE_HEADERS);

  var logRows = readSheetRows_(logSheet, USAGE_LOG_HEADERS.length, 500).map(mapUsageLogRow_);
  var stateRows = readSheetRows_(stateSheet, USAGE_STATE_HEADERS.length, 500).map(mapUsageStateRow_);
  var activeWindowMs = toNumber_(payload.activeWindowMs) || 120000;
  var now = new Date();
  var activeUsers = stateRows
    .filter(function(row) {
      var seenAt = safeDate_(row.lastSeenAt);
      return seenAt && ((now.getTime() - seenAt.getTime()) <= activeWindowMs);
    })
    .sort(function(a, b) {
      return (safeDate_(b.lastSeenAt).getTime() || 0) - (safeDate_(a.lastSeenAt).getTime() || 0);
    });

  var todayKey = Utilities.formatDate(now, settings.timezone, 'yyyy-MM-dd');
  var todaysLogs = logRows.filter(function(row) {
    return String(row.time || '').slice(0, 10) === todayKey;
  });

  var downloadTypes = {
    download_pdf: true,
    download_saved: true,
    download_ppt: true,
    upload_success: true
  };

  return {
    status: 'success',
    generatedAt: now.toISOString(),
    summary: {
      eventsToday: todaysLogs.length,
      activeNow: activeUsers.length,
      uniqueUsersToday: uniqueCount_(todaysLogs.map(function(row) { return row.auditor || row.sessionId; })),
      downloadsToday: todaysLogs.filter(function(row) { return Boolean(downloadTypes[row.eventType]); }).length
    },
    activeUsers: activeUsers.slice(0, 20),
    recentEvents: logRows.slice(0, 30)
  };
}

function getSettings_() {
  var props = PropertiesService.getScriptProperties();
  return {
    rootFolderId: String(props.getProperty('ROOT_FOLDER_ID') || '').trim(),
    spreadsheetId: String(props.getProperty('SPREADSHEET_ID') || '').trim(),
    sheetName: String(props.getProperty('SHEET_NAME') || 'Sheet1').trim(),
    timezone: String(props.getProperty('TIMEZONE') || Session.getScriptTimeZone() || 'GMT+7').trim(),
    usageDashboardCode: String(props.getProperty('USAGE_DASHBOARD_CODE') || '607090').trim(),
    adminPanelCode: String(props.getProperty('ADMIN_PANEL_CODE') || '').trim(),
    usageLogSheetName: String(props.getProperty('USAGE_LOG_SHEET_NAME') || 'UsageLog').trim(),
    usageStateSheetName: String(props.getProperty('USAGE_STATE_SHEET_NAME') || 'UsageState').trim(),
    adminConfigSheetName: String(props.getProperty('ADMIN_CONFIG_SHEET_NAME') || 'AdminConfig').trim()
  };
}

function assertSpreadsheetConfigured_(settings) {
  if (!settings.spreadsheetId) {
    throw new Error('SPREADSHEET_ID belum diatur di Script Properties.');
  }
}

function assertUploadConfigured_(settings) {
  assertSpreadsheetConfigured_(settings);
  if (!settings.rootFolderId) {
    throw new Error('ROOT_FOLDER_ID belum diatur di Script Properties.');
  }
}

function getReportSheet_(settings) {
  var spreadsheet = SpreadsheetApp.openById(settings.spreadsheetId);
  return getOrCreateSheet_(spreadsheet, settings.sheetName, REPORT_HEADERS);
}

function getOrCreateSheet_(spreadsheet, sheetName, headers) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  ensureHeaders_(sheet, headers);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  var width = headers.length;
  if (sheet.getMaxColumns() < width) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
  }
  var existing = sheet.getRange(1, 1, 1, width).getValues()[0];
  var current = existing.map(normalizeText_);
  var required = headers.map(normalizeText_);
  var needsHeader = required.some(function(header, index) {
    return current[index] !== header;
  });
  if (needsHeader) {
    sheet.getRange(1, 1, 1, width).setValues([headers]);
  }
}

function readSheetRows_(sheet, expectedColumns, limit) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var rowCount = Math.min(lastRow - 1, limit || (lastRow - 1));
  var startRow = lastRow - rowCount + 1;
  return sheet.getRange(startRow, 1, rowCount, Math.max(expectedColumns, sheet.getLastColumn())).getValues().reverse();
}

function mapSheetRow_(row) {
  var legacyRow = isLegacyRow_(row);

  if (legacyRow) {
    var legacyUploadedAt = formatSheetDateValue_(row[1]);
    return {
      reportId: String(row[0] || buildReportId_(legacyUploadedAt, row[2], row[3])),
      uploadedAt: legacyUploadedAt,
      visitDate: legacyUploadedAt,
      auditor: String(row[2] || ''),
      auditorNik: '',
      store: String(row[3] || ''),
      storeCode: '',
      storeLabel: String(row[3] || ''),
      storeLeader: '',
      shiftLeader: '',
      crewCount: 0,
      opiFindings: 0,
      qscFindings: 0,
      totalFindings: 0,
      pdfFilename: String(row[4] || ''),
      pdfUrl: String(row[5] || ''),
      pdfFileId: extractDriveFileIdFromUrl_(row[5]),
      status: row[5] ? 'Uploaded' : 'Draft'
    };
  }

  return {
    reportId: String(row[0] || ''),
    uploadedAt: formatSheetDateValue_(row[1]),
    visitDate: formatSheetDateValue_(row[2]),
    auditor: String(row[3] || ''),
    auditorNik: String(row[15] || ''),
    store: String(row[17] || row[4] || ''),
    storeCode: String(row[16] || ''),
    storeLabel: String(row[17] || row[4] || ''),
    storeLeader: String(row[5] || ''),
    shiftLeader: String(row[6] || ''),
    crewCount: toNumber_(row[7]),
    opiFindings: toNumber_(row[8]),
    qscFindings: toNumber_(row[9]),
    totalFindings: toNumber_(row[10]) || (toNumber_(row[8]) + toNumber_(row[9])),
    pdfFilename: String(row[11] || ''),
    pdfUrl: String(row[12] || ''),
    pdfFileId: String(row[13] || extractDriveFileIdFromUrl_(row[12]) || ''),
    status: String(row[14] || (row[12] ? 'Uploaded' : 'Draft'))
  };
}

function mapUsageLogRow_(row) {
  return {
    time: String(row[0] || ''),
    sessionId: String(row[1] || ''),
    eventType: String(row[2] || ''),
    detail: String(row[3] || ''),
    auditor: String(row[4] || ''),
    store: String(row[5] || ''),
    page: String(row[6] || '')
  };
}

function mapUsageStateRow_(row) {
  return {
    sessionId: String(row[0] || ''),
    auditor: String(row[1] || ''),
    store: String(row[2] || ''),
    page: String(row[3] || ''),
    eventType: String(row[4] || ''),
    detail: String(row[5] || ''),
    lastSeenAt: String(row[6] || '')
  };
}

function isLegacyRow_(row) {
  var hasPdfUrlInLegacyPosition = String(row[5] || '').indexOf('http') === 0;
  var hasModernPdfUrl = String(row[12] || '').indexOf('http') === 0;
  var visitDateLooksValid = isDateLike_(row[2]);
  return hasPdfUrlInLegacyPosition && !hasModernPdfUrl && !visitDateLooksValid;
}

function findRowByKey_(sheet, key, columnIndex) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  var values = sheet.getRange(2, columnIndex, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][0] || '') === String(key || '')) {
      return i + 2;
    }
  }
  return -1;
}

function upsertRowByKey_(sheet, key, rowValues, columnIndex, width) {
  var row = findRowByKey_(sheet, key, columnIndex);
  if (row > 1) {
    sheet.getRange(row, 1, 1, width).setValues([rowValues]);
    return row;
  }
  sheet.appendRow(rowValues);
  return sheet.getLastRow();
}

function ensureFolder_(parent, name) {
  var iterator = parent.getFoldersByName(name);
  return iterator.hasNext() ? iterator.next() : parent.createFolder(name);
}

function resolveFolderYear_(visitDate) {
  var match = String(visitDate || '').match(/^(\d{4})-/);
  return match ? match[1] : String(new Date().getFullYear());
}

function extractPdfBase64_(value) {
  var raw = String(value || '');
  if (!raw) return '';
  if (raw.indexOf('base64,') >= 0) {
    return raw.split('base64,')[1] || '';
  }
  return raw;
}

function extractDriveFileIdFromUrl_(value) {
  var text = String(value || '');
  var match = text.match(/[-\w]{25,}/);
  return match ? match[0] : '';
}

function trashDriveFileById_(fileId) {
  if (!fileId) return;
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (error) {
    // ignore cleanup failure
  }
}

function buildReportId_(visitDate, auditor, store) {
  return normalizeText_([visitDate, auditor, store].join('|')).replace(/\s+/g, '_');
}

function sanitizeFileName_(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, '_')
    .trim();
}

function normalizeText_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAction_(value) {
  return normalizeText_(value).replace(/\s+/g, '_');
}

function uniqueCount_(items) {
  var cleaned = items.filter(function(item) {
    return String(item || '').trim() !== '';
  });
  return Object.keys(cleaned.reduce(function(acc, item) {
    acc[String(item)] = true;
    return acc;
  }, {})).length;
}

function toNumber_(value) {
  var num = Number(value || 0);
  return isFinite(num) ? num : 0;
}

function toBoolean_(value) {
  if (typeof value === 'boolean') return value;
  var text = normalizeText_(value);
  return ['1', 'true', 'yes', 'ya'].indexOf(text) >= 0;
}

function isDateLike_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return !isNaN(value.getTime());
  }
  return /^\d{4}-\d{2}-\d{2}/.test(String(value || ''));
}

function safeDate_(value) {
  var date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function formatSheetDateValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, getSettings_().timezone, 'yyyy-MM-dd');
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value;
  }
  return String(value || '');
}

function collectMetaPayload_(payload) {
  return Object.keys(payload || {}).reduce(function(meta, key) {
    if (String(key || '').indexOf('meta_') === 0) {
      meta[key.replace(/^meta_/, '')] = payload[key];
    }
    return meta;
  }, {});
}

function parseRequest_(e) {
  var combined = {};
  var raw = String((e && e.postData && e.postData.contents) || '');
  var contentType = String((e && e.postData && e.postData.type) || '').toLowerCase();

  if (raw) {
    if (contentType.indexOf('application/json') >= 0 || raw.charAt(0) === '{') {
      try {
        combined = JSON.parse(raw);
      } catch (jsonError) {
        throw new Error('Body JSON tidak valid.');
      }
    } else if (contentType.indexOf('application/x-www-form-urlencoded') >= 0 || raw.indexOf('=') >= 0) {
      combined = parseQueryString_(raw);
    }
  }

  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function(key) {
      combined[key] = e.parameter[key];
    });
  }

  return combined;
}

function parseQueryString_(query) {
  return String(query || '').split('&').reduce(function(result, pair) {
    if (!pair) return result;
    var parts = pair.split('=');
    var key = decodeURIComponent(String(parts[0] || '').replace(/\+/g, ' '));
    var value = decodeURIComponent(String(parts.slice(1).join('=') || '').replace(/\+/g, ' '));
    result[key] = value;
    return result;
  }, {});
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}


function buildAdminConfigPayload_() {
  var stored = readAdminConfig_();
  return {
    status: 'success',
    config: mergeAdminConfig_(stored),
    generatedAt: new Date().toISOString(),
    remoteConfigAvailable: Boolean(stored)
  };
}

function verifyAdminAccessPayload_(code) {
  verifyAdminCode_(code);
  return {
    status: 'success',
    message: 'Akses admin valid.'
  };
}

function saveAdminConfig_(payload) {
  var settings = getSettings_();
  assertSpreadsheetConfigured_(settings);
  verifyAdminCode_(payload.code);

  var rawConfig = payload.config;
  if (typeof rawConfig === 'string') {
    try {
      rawConfig = JSON.parse(rawConfig);
    } catch (error) {
      throw new Error('Payload config admin tidak valid.');
    }
  }

  var merged = mergeAdminConfig_(rawConfig || {});
  merged.meta.updatedAt = new Date().toISOString();
  merged.meta.updatedBy = String(payload.updatedBy || (rawConfig && rawConfig.meta && rawConfig.meta.updatedBy) || 'Admin Console').trim() || 'Admin Console';
  merged.meta.source = 'server';

  var sheet = getAdminConfigSheet_(settings);
  upsertAdminConfigRow_(sheet, 'config', JSON.stringify(merged), merged.meta.updatedAt, merged.meta.updatedBy);

  return {
    status: 'success',
    message: 'Admin config berhasil disimpan ke server.',
    config: merged,
    updatedAt: merged.meta.updatedAt,
    updatedBy: merged.meta.updatedBy
  };
}

function resolveAdminPanelCode_(settings) {
  return String((settings && settings.adminPanelCode) || (settings && settings.usageDashboardCode) || '607090').trim() || '607090';
}

function verifyAdminCode_(code) {
  var settings = getSettings_();
  var expectedCode = resolveAdminPanelCode_(settings);
  var suppliedCode = String(code || '').trim();
  if (!suppliedCode || suppliedCode !== expectedCode) {
    throw new Error('Kode admin tidak valid.');
  }
}

function readAdminConfig_() {
  var settings = getSettings_();
  if (!settings.spreadsheetId) return null;
  var sheet = getAdminConfigSheet_(settings);
  var row = findRowByKey_(sheet, 'config', 1);
  if (row <= 1) return null;
  var jsonValue = String(sheet.getRange(row, 2).getValue() || '').trim();
  if (!jsonValue) return null;
  try {
    return JSON.parse(jsonValue);
  } catch (error) {
    return null;
  }
}

function getAdminConfigSheet_(settings) {
  var spreadsheet = SpreadsheetApp.openById(settings.spreadsheetId);
  return getOrCreateSheet_(spreadsheet, settings.adminConfigSheetName, ADMIN_CONFIG_HEADERS);
}

function upsertAdminConfigRow_(sheet, key, jsonValue, updatedAt, updatedBy) {
  var rowValues = [
    key,
    jsonValue,
    updatedAt,
    updatedBy
  ];
  upsertRowByKey_(sheet, key, rowValues, 1, ADMIN_CONFIG_HEADERS.length);
}

function mergeAdminConfig_(rawConfig) {
  var merged = JSON.parse(JSON.stringify(DEFAULT_ADMIN_CONFIG));
  var raw = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};

  Object.keys(merged.features).forEach(function(key) {
    if (raw.features && Object.prototype.hasOwnProperty.call(raw.features, key)) {
      merged.features[key] = toBoolean_(raw.features[key]);
    }
  });

  if (raw.links) {
    if (raw.links.opiReport) merged.links.opiReport = String(raw.links.opiReport).trim() || merged.links.opiReport;
    if (raw.links.assignment) merged.links.assignment = String(raw.links.assignment).trim() || merged.links.assignment;
  }

  if (raw.masters) {
    if (Array.isArray(raw.masters.auditors) && raw.masters.auditors.length) {
      merged.masters.auditors = normalizeAuditorList_(raw.masters.auditors);
    }
    if (Array.isArray(raw.masters.stores) && raw.masters.stores.length) {
      merged.masters.stores = normalizeStoreList_(raw.masters.stores);
    }
    if (Array.isArray(raw.masters.levels) && raw.masters.levels.length) {
      merged.masters.levels = uniqueNormalizedList_(raw.masters.levels);
    }
  }

  merged.meta = {
    updatedAt: raw.meta && raw.meta.updatedAt ? String(raw.meta.updatedAt) : '',
    updatedBy: raw.meta && raw.meta.updatedBy ? String(raw.meta.updatedBy) : 'System',
    source: raw.meta && raw.meta.source ? String(raw.meta.source) : 'default'
  };
  return merged;
}

function uniqueNormalizedList_(items) {
  var map = {};
  var result = [];
  (items || []).forEach(function(item) {
    var value = String(item || '').replace(/\s+/g, ' ').trim();
    var key = normalizeText_(value);
    if (!value || map[key]) return;
    map[key] = true;
    result.push(value);
  });
  result.sort(function(a, b) {
    return String(a).localeCompare(String(b));
  });
  return result;
}

function normalizeCode_(value) {
  var raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  var digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return raw;
  if (digits.length >= 3) return digits;
  while (digits.length < 3) digits = '0' + digits;
  return digits;
}

function parseStoreValue_(value) {
  var raw = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!raw) return { code: '', name: '', label: '' };
  var match = raw.match(/^([0-9]{1,6})\s*[-–•]\s*(.+)$/);
  if (match) {
    var code = normalizeCode_(match[1]);
    var name = String(match[2] || '').replace(/\s+/g, ' ').trim();
    return { code: code, name: name, label: formatStoreLabel_({ code: code, name: name }) };
  }
  return { code: '', name: raw, label: raw };
}

function formatStoreLabel_(store) {
  var normalized = normalizeStoreItem_(store);
  if (!normalized.name) return normalized.code || '';
  return normalized.code ? (normalized.code + ' - ' + normalized.name) : normalized.name;
}

function normalizeStoreItem_(item) {
  if (item == null) return { code: '', name: '', type: '', city: '', province: '' };
  if (typeof item === 'string') {
    item = parseStoreValue_(item);
  }
  var code = normalizeCode_(item.code || item.site || item.storeCode || item.id || '');
  var name = String(item.name || item.store || item.siteDescr || item.SiteDescr || item.label || '').replace(/\s+/g, ' ').trim();
  var type = String(item.type || item.storeType || '').replace(/\s+/g, ' ').trim();
  var city = String(item.city || '').replace(/\s+/g, ' ').trim();
  var province = String(item.province || '').replace(/\s+/g, ' ').trim();
  return { code: code, name: name, type: type, city: city, province: province };
}

function normalizeStoreList_(items) {
  var seen = {};
  var result = [];
  (items || []).forEach(function(item) {
    var normalized = normalizeStoreItem_(item);
    if (!normalized.name && !normalized.code) return;
    var key = normalized.code ? ('code:' + normalized.code) : ('name:' + normalizeText_(normalized.name));
    if (seen[key]) return;
    seen[key] = true;
    result.push(normalized);
  });
  result.sort(function(a, b) {
    if (a.code && b.code && a.code !== b.code) {
      return String(a.code).localeCompare(String(b.code), 'id', { numeric: true, sensitivity: 'base' });
    }
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  return result;
}

function normalizeAuditorItem_(item) {
  if (item == null) return { name: '', nik: '' };
  if (typeof item === 'string') {
    item = { name: item, nik: '' };
  }
  var name = String(item.name || item.auditor || item.auditorName || item['Nama Auditor'] || '').replace(/\s+/g, ' ').trim();
  var nik = String(item.nik || item.NIK || item.employeeId || '').replace(/\s+/g, ' ').trim();
  return { name: name, nik: nik };
}

function normalizeAuditorList_(items) {
  var seen = {};
  var result = [];
  (items || []).forEach(function(item) {
    var normalized = normalizeAuditorItem_(item);
    var key = normalizeText_(normalized.name);
    if (!key) return;
    if (!seen[key]) {
      seen[key] = result.push(normalized) - 1;
    } else if (normalized.nik && !result[seen[key]].nik) {
      result[seen[key]] = normalized;
    }
  });
  result.sort(function(a, b) {
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  return result;
}

function findStoreFromConfig_(query, config) {
  var candidate = normalizeText_(query);
  if (!candidate) return null;
  var stores = normalizeStoreList_((config && config.masters && config.masters.stores) || []);
  for (var i = 0; i < stores.length; i += 1) {
    var store = stores[i];
    if (normalizeText_(store.name) === candidate || normalizeText_(formatStoreLabel_(store)) === candidate || normalizeCode_(store.code) === normalizeCode_(query)) {
      return store;
    }
  }
  return null;
}

function findAuditorFromConfig_(query, config) {
  var candidate = normalizeText_(query);
  if (!candidate) return null;
  var auditors = normalizeAuditorList_((config && config.masters && config.masters.auditors) || []);
  for (var i = 0; i < auditors.length; i += 1) {
    var auditor = auditors[i];
    if (normalizeText_(auditor.name) === candidate || normalizeText_(auditor.nik) === candidate) {
      return auditor;
    }
  }
  return null;
}
