// ==========================================================
    // [RB-JS-TAG-LIST]
    // Cari cepat: RB-BOOT, RB-HELPERS, RB-STORE-NORMALIZE, RB-FILTERS,
    // RB-SUMMARY, RB-CHARTS, RB-RANKING, RB-TABLE
    // ==========================================================
    const API_URL = (window.RB_CONFIG && window.RB_CONFIG.API_URL) || '';
    const charts = { auditor: null, mix: null, trend: null, store: null };
    let allRows = [];
    let lastGeneratedAt = '';

    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('refreshBtn').addEventListener('click', loadAnalytics);
      document.getElementById('searchInput').addEventListener('input', applyFilters);
      document.getElementById('auditorFilter').addEventListener('change', applyFilters);
      document.getElementById('dateFrom').addEventListener('change', applyFilters);
      document.getElementById('dateTo').addEventListener('change', applyFilters);
      loadAnalytics();
    });

    function setSync(message, tone = 'pending') {
      document.getElementById('syncText').textContent = message;
      const dot = document.getElementById('syncDot');
      dot.className = `dot ${tone}`;
    }

    function toNumber(value) {
      const n = Number(value || 0);
      return Number.isFinite(n) ? n : 0;
    }

    function safeDate(value) {
      if (!value) return null;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    function formatDate(value) {
      const d = safeDate(value);
      if (!d) return value || '-';
      return new Intl.DateTimeFormat('id-ID', { day:'2-digit', month:'short', year:'numeric' }).format(d);
    }

    function formatDateTime(value) {
      const d = safeDate(value);
      if (!d) return value || '-';
      return new Intl.DateTimeFormat('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(d);
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // === [RB-STORE-NORMALIZE] menghitung store case-insensitive ===
    function normalizeStoreKey(value) {
      return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function normalizeStoreLabel(value) {
      return String(value || '').replace(/\s+/g, ' ').trim() || 'Tanpa Store';
    }

    function buildStoreCoverageMap(rows) {
      const storeMap = new Map();
      rows.forEach(row => {
        const label = normalizeStoreLabel(row.store);
        const key = normalizeStoreKey(label) || 'tanpa store';
        if (!storeMap.has(key)) {
          storeMap.set(key, { label, count: 0 });
        }
        storeMap.get(key).count += 1;
      });
      return storeMap;
    }

    // === [RB-BOOT] load data analytics dari Apps Script ===
    async function loadAnalytics() {
      setSync('Memuat data analytics dari spreadsheet...', 'pending');
      try {
        const response = await fetch(`${API_URL}?action=analytics&ts=${Date.now()}`, { cache: 'no-store' });
        const payload = await response.json();
        if (!payload || payload.status !== 'success') {
          throw new Error(payload?.message || 'Response analytics tidak valid');
        }
        allRows = Array.isArray(payload.rows) ? payload.rows : [];
        lastGeneratedAt = payload.generatedAt || '';
        hydrateAuditorFilter(allRows);
        applyFilters();
        document.getElementById('kpiLatest').textContent = lastGeneratedAt ? formatDateTime(lastGeneratedAt) : '-';
        setSync(`Sinkron berhasil • ${allRows.length} report terbaca`, 'success');
      } catch (error) {
        console.error(error);
        allRows = [];
        lastGeneratedAt = '';
        hydrateAuditorFilter([]);
        renderDashboard([]);
        setSync('Gagal sinkron. Cek endpoint Apps Script action=analytics.', 'error');
      }
    }

    function hydrateAuditorFilter(rows) {
      const select = document.getElementById('auditorFilter');
      const current = select.value;
      const auditors = [...new Set(rows.map(r => r.auditor).filter(Boolean))].sort((a,b) => a.localeCompare(b));
      select.innerHTML = '<option value="">Semua Auditor</option>' + auditors.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
      if (auditors.includes(current)) select.value = current;
    }

    function applyFilters() {
      const query = document.getElementById('searchInput').value.trim().toLowerCase();
      const auditor = document.getElementById('auditorFilter').value;
      const dateFrom = document.getElementById('dateFrom').value;
      const dateTo = document.getElementById('dateTo').value;

      const filtered = allRows.filter(row => {
        const haystack = `${row.store || ''} ${row.auditor || ''}`.toLowerCase();
        if (query && !haystack.includes(query)) return false;
        if (auditor && row.auditor !== auditor) return false;

        const rowDate = row.visitDate || row.uploadedAt || '';
        if (dateFrom && rowDate && rowDate < dateFrom) return false;
        if (dateTo && rowDate && rowDate > dateTo) return false;
        return true;
      }).sort((a,b) => {
        const da = safeDate(a.visitDate || a.uploadedAt)?.getTime() || 0;
        const db = safeDate(b.visitDate || b.uploadedAt)?.getTime() || 0;
        return db - da;
      });

      renderDashboard(filtered);
    }

    function renderDashboard(rows) {
      renderSummary(rows);
      renderCharts(rows);
      renderRanking(rows);
      renderTable(rows);
      document.getElementById('emptyState').style.display = rows.length ? 'none' : 'block';
      document.getElementById('tableScroll').style.display = rows.length ? 'block' : 'none';
    }

    // === [RB-SUMMARY] KPI dashboard ===
    function renderSummary(rows) {
      const totalReports = rows.length;
      const uniqueStores = buildStoreCoverageMap(rows).size;
      const uniqueAuditors = new Set(rows.map(r => r.auditor).filter(Boolean)).size;
      const totalFindings = rows.reduce((sum, row) => sum + toNumber(row.totalFindings), 0);
      const avgFindings = totalReports ? (totalFindings / totalReports).toFixed(1) : '0.0';
      const latestRow = rows[0];

      document.getElementById('kpiReports').textContent = totalReports;
      document.getElementById('kpiStores').textContent = uniqueStores;
      document.getElementById('kpiAuditors').textContent = uniqueAuditors;
      document.getElementById('kpiFindings').textContent = totalFindings;
      document.getElementById('kpiAvg').textContent = avgFindings;
      document.getElementById('kpiLatest').textContent = lastGeneratedAt
        ? formatDateTime(lastGeneratedAt)
        : (latestRow ? formatDate(latestRow.visitDate || latestRow.uploadedAt) : '-');
      document.getElementById('kpiReportsMeta').textContent = totalReports ? `Rata-rata ${avgFindings} temuan per report` : 'Belum ada report';
      document.getElementById('kpiFindingsMeta').textContent = totalFindings ? `OPI ${rows.reduce((s,r)=>s+toNumber(r.opiFindings),0)} • QSC ${rows.reduce((s,r)=>s+toNumber(r.qscFindings),0)}` : 'Gabungan OPI + QSC';
      document.getElementById('tableCountPill').textContent = `${totalReports} data`;
      document.getElementById('tableCountPill').className = `pill ${totalReports ? 'good' : 'mid'}`;
    }

    function destroyChart(chart) { if (chart) chart.destroy(); }

    // === [RB-CHARTS] chart analytics utama ===
    function renderCharts(rows) {
      const auditorMap = new Map();
      const storeMap = buildStoreCoverageMap(rows);
      const trendMap = new Map();
      let totalOPI = 0;
      let totalQSC = 0;

      rows.forEach(row => {
        const auditor = row.auditor || 'Tanpa Nama';
        auditorMap.set(auditor, (auditorMap.get(auditor) || 0) + 1);
        totalOPI += toNumber(row.opiFindings);
        totalQSC += toNumber(row.qscFindings);
        const key = row.visitDate || row.uploadedAt || 'Tanpa Tanggal';
        trendMap.set(key, (trendMap.get(key) || 0) + toNumber(row.totalFindings));
      });

      const auditorEntries = [...auditorMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
      const storeEntries = [...storeMap.values()]
        .sort((a,b)=>b.count-a.count)
        .slice(0,8)
        .map(item => [item.label, item.count]);
      const trendEntries = [...trendMap.entries()].sort((a,b)=> (safeDate(a[0])?.getTime() || 0) - (safeDate(b[0])?.getTime() || 0));

      destroyChart(charts.auditor);
      destroyChart(charts.mix);
      destroyChart(charts.trend);
      destroyChart(charts.store);

      charts.auditor = new Chart(document.getElementById('auditorChart'), {
        type: 'bar',
        data: {
          labels: auditorEntries.map(e => e[0]),
          datasets: [{ label: 'Jumlah Report', data: auditorEntries.map(e => e[1]), backgroundColor: 'rgba(15,118,110,.88)', borderRadius: 12, maxBarThickness: 42 }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { maxRotation: 0, minRotation: 0 } } } }
      });

      charts.mix = new Chart(document.getElementById('mixChart'), {
        type: 'doughnut',
        data: { labels: ['OPI', 'QSC'], datasets: [{ data: [totalOPI, totalQSC], backgroundColor: ['rgba(30,58,95,.9)','rgba(20,184,166,.9)'], borderWidth: 0 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '65%' }
      });

      charts.trend = new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
          labels: trendEntries.map(e => formatDate(e[0])),
          datasets: [{ label: 'Total Temuan', data: trendEntries.map(e => e[1]), borderColor: 'rgba(30,58,95,1)', backgroundColor: 'rgba(30,58,95,.10)', fill: true, tension: .28, pointRadius: 3, pointHoverRadius: 5 }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
      });

      charts.store = new Chart(document.getElementById('storeChart'), {
        type: 'bar',
        data: {
          labels: storeEntries.map(e => e[0]),
          datasets: [{ label: 'Jumlah Report', data: storeEntries.map(e => e[1]), backgroundColor: 'rgba(30,58,95,.85)', borderRadius: 12, maxBarThickness: 42 }]
        },
        options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
    }

    // === [RB-RANKING] ranking auditor full list + scroll ===
    function renderRanking(rows) {
      const rankList = document.getElementById('rankList');
      const map = new Map();
      rows.forEach(row => {
        const auditor = row.auditor || 'Tanpa Nama';
        if (!map.has(auditor)) map.set(auditor, { reports: 0, findings: 0 });
        const item = map.get(auditor);
        item.reports += 1;
        item.findings += toNumber(row.totalFindings);
      });

      const ranking = [...map.entries()]
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a,b) => (b.reports - a.reports) || (b.findings - a.findings) || a.name.localeCompare(b.name));

      rankList.scrollTop = 0;

      if (!ranking.length) {
        rankList.innerHTML = '<div class="footer-note">Belum ada data auditor.</div>';
        return;
      }

      rankList.innerHTML = ranking.map((item, idx) => `
        <div class="rank-item">
          <div class="rank-number">${idx + 1}</div>
          <div>
            <div class="rank-name">${escapeHtml(item.name)}</div>
            <div class="rank-sub">${item.reports} report • ${item.findings} total temuan</div>
          </div>
          <div class="rank-score">
            <strong>${item.reports}</strong>
            <span>report</span>
          </div>
        </div>
      `).join('');
    }

    function getStatusPill(total) {
      if (total >= 10) return '<span class="pill low">Temuan Tinggi</span>';
      if (total >= 4) return '<span class="pill mid">Temuan Sedang</span>';
      return '<span class="pill good">Temuan Rendah</span>';
    }

    function renderTable(rows) {
      const tbody = document.getElementById('tableBody');
      tbody.innerHTML = rows.map(row => {
        const total = toNumber(row.totalFindings);
        const link = row.pdfUrl ? `<a class="link-btn" href="${row.pdfUrl}" target="_blank" rel="noopener noreferrer">Open PDF</a>` : '-';
        return `
          <tr>
            <td>${formatDate(row.visitDate || row.uploadedAt)}</td>
            <td>${escapeHtml(row.auditor || '-')}</td>
            <td>${escapeHtml(row.store || '-')}</td>
            <td>${toNumber(row.crewCount)}</td>
            <td>${toNumber(row.opiFindings)}</td>
            <td>${toNumber(row.qscFindings)}</td>
            <td><strong>${total}</strong></td>
            <td>${getStatusPill(total)}</td>
            <td>${link}</td>
          </tr>
        `;
      }).join('');
    }


// ==========================================================
// [RB-UPGRADE-PATCH]
// Shared config, CSV export, richer filter summary, safer loading
// ==========================================================
var filteredRowsCache = [];

function buildAnalyticsApiUrl(action, params = {}) {
  if (!API_URL) return '';
  const url = new URL(API_URL, window.location.href);
  if (action) url.searchParams.set('action', action);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function readAnalyticsResponse(response) {
  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (error) {
    payload = {};
  }
  return { raw, payload };
}

function ensureAnalyticsEnhancements() {
  injectAnalyticsEnhancementStyles();

  const toolbarActions = document.querySelector('.toolbar-actions');
  if (toolbarActions && !document.getElementById('exportCsvBtn')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-secondary';
    button.id = 'exportCsvBtn';
    button.textContent = '⬇ Export CSV';
    toolbarActions.insertBefore(button, toolbarActions.firstChild);
    button.addEventListener('click', downloadAnalyticsCsv);
  }

  const controlsGrid = document.querySelector('.controls-grid');
  if (controlsGrid && !document.getElementById('analyticsFilterSummary')) {
    const summary = document.createElement('section');
    summary.id = 'analyticsFilterSummary';
    summary.className = 'analytics-filter-summary';
    summary.innerHTML = `
      <div class="filter-summary-card">
        <span>Report Terfilter</span>
        <strong id="filterSummaryReports">0</strong>
        <small id="filterSummaryMeta">Belum ada data</small>
      </div>
      <div class="filter-summary-card">
        <span>Store dalam Filter</span>
        <strong id="filterSummaryStores">0</strong>
        <small id="filterSummaryStoresMeta">Coverage aktif</small>
      </div>
      <div class="filter-summary-card">
        <span>Latest Visit</span>
        <strong id="filterSummaryLatest">-</strong>
        <small id="filterSummaryLatestMeta">Tanggal visit terbaru</small>
      </div>
    `;
    controlsGrid.insertAdjacentElement('afterend', summary);
  }
}

function injectAnalyticsEnhancementStyles() {
  if (document.getElementById('analyticsEnhancementStyles')) return;
  const style = document.createElement('style');
  style.id = 'analyticsEnhancementStyles';
  style.textContent = `
    .analytics-filter-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 18px;
    }
    .filter-summary-card {
      background: var(--card);
      border-radius: 18px;
      box-shadow: var(--shadow);
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 112px;
    }
    .filter-summary-card span {
      font-size: 12px;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 700;
    }
    .filter-summary-card strong {
      font-size: 26px;
      color: var(--navy);
      font-family: 'Poppins', sans-serif;
      line-height: 1.1;
    }
    .filter-summary-card small {
      color: var(--muted);
      line-height: 1.45;
    }
    @media (max-width: 980px) {
      .analytics-filter-summary {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildAnalyticsCsv(rows) {
  const headers = [
    'Visit Date',
    'Uploaded At',
    'Auditor',
    'Store',
    'Store Leader',
    'Shift Leader',
    'Crew Count',
    'OPI Findings',
    'QSC Findings',
    'Total Findings',
    'Status',
    'PDF URL'
  ];
  const lines = [headers.map(escapeCsv).join(',')];
  rows.forEach(row => {
    lines.push([
      row.visitDate || '',
      row.uploadedAt || '',
      row.auditor || '',
      row.store || '',
      row.storeLeader || '',
      row.shiftLeader || '',
      toNumber(row.crewCount),
      toNumber(row.opiFindings),
      toNumber(row.qscFindings),
      toNumber(row.totalFindings),
      row.status || '',
      row.pdfUrl || ''
    ].map(escapeCsv).join(','));
  });
  return lines.join('\n');
}

function downloadAnalyticsCsv() {
  const rows = filteredRowsCache.length ? filteredRowsCache : allRows;
  const csv = buildAnalyticsCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `regional-bestie-analytics-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderFilterInsights(rows, filterState = {}) {
  ensureAnalyticsEnhancements();
  const reportsEl = document.getElementById('filterSummaryReports');
  const reportsMetaEl = document.getElementById('filterSummaryMeta');
  const storesEl = document.getElementById('filterSummaryStores');
  const storesMetaEl = document.getElementById('filterSummaryStoresMeta');
  const latestEl = document.getElementById('filterSummaryLatest');
  const latestMetaEl = document.getElementById('filterSummaryLatestMeta');
  if (!reportsEl || !reportsMetaEl || !storesEl || !storesMetaEl || !latestEl || !latestMetaEl) return;

  const storeCoverage = buildStoreCoverageMap(rows);
  const latestRow = rows[0] || null;
  const filtersUsed = [
    filterState.query ? `query “${filterState.query}”` : '',
    filterState.auditor ? `auditor ${filterState.auditor}` : '',
    filterState.dateFrom ? `mulai ${formatDate(filterState.dateFrom)}` : '',
    filterState.dateTo ? `sampai ${formatDate(filterState.dateTo)}` : ''
  ].filter(Boolean);

  reportsEl.textContent = rows.length;
  reportsMetaEl.textContent = rows.length
    ? (filtersUsed.length ? `Filter aktif: ${filtersUsed.join(' • ')}` : 'Menampilkan seluruh report')
    : 'Tidak ada report yang cocok dengan filter saat ini';

  storesEl.textContent = storeCoverage.size;
  storesMetaEl.textContent = storeCoverage.size
    ? `${[...storeCoverage.values()].sort((a,b) => b.count - a.count).slice(0, 2).map(item => `${item.label} (${item.count})`).join(' • ')}`
    : 'Belum ada coverage store';

  latestEl.textContent = latestRow ? formatDate(latestRow.visitDate || latestRow.uploadedAt) : '-';
  latestMetaEl.textContent = latestRow
    ? `${latestRow.auditor || '-'} • ${latestRow.store || '-'}`
    : 'Belum ada data visit';
}

async function loadAnalytics() {
  ensureAnalyticsEnhancements();

  if (!API_URL) {
    setSync('API belum dikonfigurasi. Update app-config.js sebelum analytics digunakan.', 'error');
    allRows = [];
    filteredRowsCache = [];
    hydrateAuditorFilter([]);
    renderDashboard([]);
    renderFilterInsights([], {});
    return;
  }

  setSync('Memuat data analytics dari spreadsheet...', 'pending');
  try {
    const response = await fetch(buildAnalyticsApiUrl('analytics', { ts: Date.now() }), { cache: 'no-store' });
    const { payload } = await readAnalyticsResponse(response);
    if (!response.ok || !payload || String(payload.status || '').toLowerCase() !== 'success') {
      throw new Error(payload?.message || `Response analytics tidak valid (HTTP ${response.status})`);
    }
    allRows = Array.isArray(payload.rows) ? payload.rows : [];
    lastGeneratedAt = payload.generatedAt || '';
    hydrateAuditorFilter(allRows);
    applyFilters();
    document.getElementById('kpiLatest').textContent = lastGeneratedAt ? formatDateTime(lastGeneratedAt) : '-';
    setSync(`Sinkron berhasil • ${allRows.length} report terbaca`, 'success');
  } catch (error) {
    console.error(error);
    allRows = [];
    filteredRowsCache = [];
    lastGeneratedAt = '';
    hydrateAuditorFilter([]);
    renderDashboard([]);
    renderFilterInsights([], {});
    setSync(`Gagal sinkron: ${error.message}`, 'error');
  }
}

function applyFilters() {
  ensureAnalyticsEnhancements();

  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  const auditor = document.getElementById('auditorFilter').value;
  const dateFrom = document.getElementById('dateFrom').value;
  const dateTo = document.getElementById('dateTo').value;

  const filtered = allRows.filter(row => {
    const haystack = `${row.store || ''} ${row.auditor || ''}`.toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (auditor && row.auditor !== auditor) return false;

    const rowDate = row.visitDate || row.uploadedAt || '';
    if (dateFrom && rowDate && rowDate < dateFrom) return false;
    if (dateTo && rowDate && rowDate > dateTo) return false;
    return true;
  }).sort((a, b) => {
    const da = safeDate(a.visitDate || a.uploadedAt)?.getTime() || 0;
    const db = safeDate(b.visitDate || b.uploadedAt)?.getTime() || 0;
    return db - da;
  });

  filteredRowsCache = filtered.slice();
  renderDashboard(filtered);
  renderFilterInsights(filtered, { query, auditor, dateFrom, dateTo });
}

document.addEventListener('DOMContentLoaded', () => {
  ensureAnalyticsEnhancements();
});
