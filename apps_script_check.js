const ROOT_FOLDER_ID = '1U7dEbXG1za__BeYPSjG6jaYAdsaL68zD';
const SPREADSHEET_ID = '1In1XvWEHcxzXzwY-9prdF-rR96e8eaGuS-LDOcd67P8';
const SHEET_NAME = 'Sheet1';
const TIMEZONE = 'GMT+7';

const AUDITOR_MASTER_LIST = [
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

const HEADERS = [
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
  'status'
];

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'analytics').toLowerCase();

    if (action === 'analytics' || action === 'reports') {
      return jsonResponse_(buildAnalyticsPayload_());
    }

    if (action === 'config') {
      return jsonResponse_({
        status: 'success',
        rootFolderId: ROOT_FOLDER_ID,
        spreadsheetId: SPREADSHEET_ID,
        sheetName: SHEET_NAME,
        generatedAt: new Date().toISOString()
      });
    }

    if (action === 'health') {
      return jsonResponse_({
        status: 'success',
        message: 'Regional Bestie API ready',
        generatedAt: new Date().toISOString()
      });
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
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const result = saveReport_(payload);

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

function saveReport_(payload) {
  const auditorInput = String(payload.auditor || '').trim();
  const store = String(payload.toko || '').trim();
  const visitDate = String(payload.visitDate || '').trim() || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const pdfBase64 = String(payload.pdf || '').split(',')[1] || '';

  if (!store) {
    throw new Error('Store wajib diisi.');
  }

  if (!auditorInput) {
    throw new Error('Auditor wajib diisi.');
  }

  if (!pdfBase64) {
    throw new Error('PDF base64 tidak ditemukan di payload.');
  }

  const matchedAuditor = AUDITOR_MASTER_LIST.find(name => normalizeText_(name) === normalizeText_(auditorInput));
  const auditorFolderName = matchedAuditor || auditorInput || 'Auditor Lainnya';
  const generatedDate = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const generatedTimestamp = new Date().toISOString();
  const folderYear = resolveFolderYear_(visitDate);
  const reportId = String(payload.reportId || buildReportId_(visitDate, auditorFolderName, store));
  const fileName = String(payload.fileName || `VisitReport_${sanitizeFileName_(store)}_${sanitizeFileName_(auditorFolderName)}_${visitDate}.pdf`);

  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const yearFolder = ensureFolder_(rootFolder, folderYear);
  const auditorFolder = ensureFolder_(yearFolder, auditorFolderName);

  const blob = Utilities.newBlob(Utilities.base64Decode(pdfBase64), 'application/pdf', fileName);
  const file = auditorFolder.createFile(blob);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  const sheet = getSheet_();
  ensureHeaders_(sheet);

  const rowValues = [
    reportId,
    generatedTimestamp,
    visitDate,
    auditorFolderName,
    store,
    String(payload.storeLeader || '').trim(),
    String(payload.shiftLeader || '').trim(),
    toNumber_(payload.crewCount),
    toNumber_(payload.opiFindings),
    toNumber_(payload.qscFindings),
    toNumber_(payload.totalFindings),
    fileName,
    file.getUrl(),
    'Uploaded'
  ];

  try {
    const existingRow = findRowByReportId_(sheet, reportId);
    if (existingRow > 1) {
      sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
  } finally {
    lock.releaseLock();
  }

  return {
    reportId: reportId,
    folder: auditorFolderName,
    fileUrl: file.getUrl(),
    fileName: fileName,
    generatedDate: generatedDate
  };
}

function buildAnalyticsPayload_() {
  const sheet = getSheet_();
  ensureHeaders_(sheet);

  const lastRow = sheet.getLastRow();
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

  const values = sheet.getRange(2, 1, lastRow - 1, Math.max(HEADERS.length, sheet.getLastColumn())).getValues();
  const rows = values
    .map(mapSheetRow_)
    .filter(row => row.store || row.auditor || row.pdfUrl);

  return {
    status: 'success',
    generatedAt: new Date().toISOString(),
    rows: rows,
    summary: {
      totalReports: rows.length,
      uniqueStores: uniqueCount_(rows.map(row => row.store)),
      uniqueAuditors: uniqueCount_(rows.map(row => row.auditor)),
      totalFindings: rows.reduce((sum, row) => sum + toNumber_(row.totalFindings), 0)
    }
  };
}

function mapSheetRow_(row) {
  const legacyRow = isLegacyRow_(row);

  if (legacyRow) {
    const legacyUploadedAt = formatSheetDateValue_(row[1]);
    return {
      reportId: String(row[0] || buildReportId_(legacyUploadedAt, row[2], row[3])),
      uploadedAt: legacyUploadedAt,
      visitDate: legacyUploadedAt,
      auditor: String(row[2] || ''),
      store: String(row[3] || ''),
      storeLeader: '',
      shiftLeader: '',
      crewCount: 0,
      opiFindings: 0,
      qscFindings: 0,
      totalFindings: 0,
      pdfFilename: String(row[4] || ''),
      pdfUrl: String(row[5] || ''),
      status: row[5] ? 'Uploaded' : 'Draft'
    };
  }

  return {
    reportId: String(row[0] || ''),
    uploadedAt: formatSheetDateValue_(row[1]),
    visitDate: formatSheetDateValue_(row[2]),
    auditor: String(row[3] || ''),
    store: String(row[4] || ''),
    storeLeader: String(row[5] || ''),
    shiftLeader: String(row[6] || ''),
    crewCount: toNumber_(row[7]),
    opiFindings: toNumber_(row[8]),
    qscFindings: toNumber_(row[9]),
    totalFindings: toNumber_(row[10]) || (toNumber_(row[8]) + toNumber_(row[9])),
    pdfFilename: String(row[11] || ''),
    pdfUrl: String(row[12] || ''),
    status: String(row[13] || (row[12] ? 'Uploaded' : 'Draft'))
  };
}

function isLegacyRow_(row) {
  const hasPdfUrlInLegacyPosition = String(row[5] || '').indexOf('http') === 0;
  const hasModernPdfUrl = String(row[12] || '').indexOf('http') === 0;
  const visitDateLooksValid = isDateLike_(row[2]);
  return hasPdfUrlInLegacyPosition && !hasModernPdfUrl && !visitDateLooksValid;
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function ensureHeaders_(sheet) {
  const existingHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const normalizedExisting = existingHeaders.map(item => normalizeText_(item));
  const normalizedRequired = HEADERS.map(item => normalizeText_(item));
  const needsHeader = normalizedRequired.some((header, index) => normalizedExisting[index] !== header);

  if (needsHeader) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function findRowByReportId_(sheet, reportId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '') === String(reportId || '')) {
      return i + 2;
    }
  }
  return -1;
}

function ensureFolder_(parent, name) {
  const iterator = parent.getFoldersByName(name);
  return iterator.hasNext() ? iterator.next() : parent.createFolder(name);
}

function resolveFolderYear_(visitDate) {
  const match = String(visitDate || '').match(/^(\d{4})-/);
  return match ? match[1] : new Date().getFullYear().toString();
}

function buildReportId_(visitDate, auditor, store) {
  return normalizeText_([visitDate, auditor, store].join('|')).replace(/\s+/g, '_');
}

function normalizeText_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeFileName_(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, '_')
    .trim();
}

function toNumber_(value) {
  const num = Number(value || 0);
  return isFinite(num) ? num : 0;
}

function uniqueCount_(items) {
  const cleaned = items.filter(item => String(item || '').trim() !== '');
  return new Set(cleaned).size;
}

function isDateLike_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return !isNaN(value.getTime());
  }
  return /^\d{4}-\d{2}-\d{2}/.test(String(value || ''));
}

function formatSheetDateValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, TIMEZONE, 'yyyy-MM-dd');
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value;
  }
  return String(value || '');
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
