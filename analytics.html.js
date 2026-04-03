
    const API_URL = 'https://script.google.com/macros/s/AKfycbybqCTpezmJ-C59oO9u7k3LDae2WZ4I8OnjmYNCXSEwWTn7IZI-gXW7_7QMW5aM9FZn/exec';
    const charts = {
        auditor: null,
        mix: null,
        trend: null
    };
    let allRows = [];

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('refreshAnalyticsBtn').addEventListener('click', loadAnalytics);
        document.getElementById('searchInput').addEventListener('input', () => renderTable(filterRows(allRows)));
        loadAnalytics();
    });

    function setSyncStatus(message, isError = false) {
        const status = document.getElementById('syncStatus');
        const text = document.getElementById('syncStatusText');
        text.textContent = message;
        status.classList.toggle('error', isError);
    }

    function parseNumber(value) {
        const number = Number(value || 0);
        return Number.isFinite(number) ? number : 0;
    }

    function formatDateLabel(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(date);
    }

    function formatDateTimeLabel(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    async function loadAnalytics() {
        setSyncStatus('Memuat data analytics dari spreadsheet...');

        try {
            const response = await fetch(`${API_URL}?action=analytics&ts=${Date.now()}`);
            const payload = await response.json();
            if (!payload || payload.status !== 'success') {
                throw new Error(payload?.message || 'Response analytics tidak valid');
            }

            allRows = Array.isArray(payload.rows) ? payload.rows : [];
            const filtered = filterRows(allRows);
            renderSummary(allRows);
            renderCharts(allRows);
            renderTable(filtered);
            renderEmptyState(allRows.length === 0);
            setSyncStatus(`Tersinkron ${formatDateTimeLabel(payload.generatedAt)} • ${allRows.length} report`, false);
        } catch (error) {
            console.error(error);
            allRows = [];
            renderSummary([]);
            renderCharts([]);
            renderTable([]);
            renderEmptyState(true);
            setSyncStatus('Gagal sinkron. Periksa deployment Apps Script dan koneksi spreadsheet.', true);
        }
    }

    function filterRows(rows) {
        const query = document.getElementById('searchInput').value.trim().toLowerCase();
        if (!query) return sortRows(rows);
        return sortRows(rows.filter(row => {
            return `${row.store || ''} ${row.auditor || ''}`.toLowerCase().includes(query);
        }));
    }

    function sortRows(rows) {
        return [...rows].sort((a, b) => {
            const dateA = new Date(a.visitDate || a.uploadedAt || 0).getTime();
            const dateB = new Date(b.visitDate || b.uploadedAt || 0).getTime();
            return dateB - dateA;
        });
    }

    function renderSummary(rows) {
        const totalReports = rows.length;
        const uniqueStores = new Set(rows.map(row => row.store).filter(Boolean)).size;
        const uniqueAuditors = new Set(rows.map(row => row.auditor).filter(Boolean)).size;
        const totalFindings = rows.reduce((total, row) => total + parseNumber(row.totalFindings), 0);
        const averageFindings = totalReports ? (totalFindings / totalReports).toFixed(1) : '0.0';

        document.getElementById('totalReports').textContent = totalReports;
        document.getElementById('uniqueStores').textContent = uniqueStores;
        document.getElementById('uniqueAuditors').textContent = uniqueAuditors;
        document.getElementById('totalFindings').textContent = totalFindings;

        document.getElementById('totalReportsMeta').textContent = totalReports ? `Rata-rata ${averageFindings} temuan per report` : 'Belum ada laporan';
        document.getElementById('uniqueStoresMeta').textContent = uniqueStores ? `${uniqueStores} store unik pada data` : 'Store unik dari seluruh laporan';
        document.getElementById('uniqueAuditorsMeta').textContent = uniqueAuditors ? `${uniqueAuditors} auditor aktif` : 'Jumlah auditor yang sudah submit';
        document.getElementById('totalFindingsMeta').textContent = totalFindings ? `Rata-rata ${averageFindings} temuan per report` : 'Gabungan OPI dan QSC';
    }

    function destroyChart(instance) {
        if (instance) instance.destroy();
    }

    function getAuditorChartData(rows) {
        const map = new Map();
        rows.forEach(row => {
            const auditor = row.auditor || 'Tanpa Nama';
            map.set(auditor, (map.get(auditor) || 0) + 1);
        });
        return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    }

    function getTrendData(rows) {
        const map = new Map();
        rows.forEach(row => {
            const key = row.visitDate || row.uploadedAt || 'Tanpa Tanggal';
            map.set(key, (map.get(key) || 0) + parseNumber(row.totalFindings));
        });
        return [...map.entries()].sort((a, b) => new Date(a[0]) - new Date(b[0]));
    }

    function renderCharts(rows) {
        const auditorEntries = getAuditorChartData(rows);
        const totalOPI = rows.reduce((sum, row) => sum + parseNumber(row.opiFindings), 0);
        const totalQSC = rows.reduce((sum, row) => sum + parseNumber(row.qscFindings), 0);
        const trendEntries = getTrendData(rows);

        destroyChart(charts.auditor);
        destroyChart(charts.mix);
        destroyChart(charts.trend);

        charts.auditor = new Chart(document.getElementById('auditorChart'), {
            type: 'bar',
            data: {
                labels: auditorEntries.map(entry => entry[0]),
                datasets: [{
                    label: 'Jumlah Report',
                    data: auditorEntries.map(entry => entry[1]),
                    backgroundColor: 'rgba(15, 118, 110, 0.85)',
                    borderRadius: 10,
                    maxBarThickness: 42
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } },
                    x: { ticks: { maxRotation: 0, minRotation: 0 } }
                }
            }
        });

        charts.mix = new Chart(document.getElementById('findingMixChart'), {
            type: 'doughnut',
            data: {
                labels: ['OPI Findings', 'QSC Findings'],
                datasets: [{
                    data: [totalOPI, totalQSC],
                    backgroundColor: ['rgba(30, 58, 95, 0.88)', 'rgba(20, 184, 166, 0.88)'],
                    borderWidth: 0
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                },
                cutout: '62%'
            }
        });

        charts.trend = new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                labels: trendEntries.map(entry => formatDateLabel(entry[0])),
                datasets: [{
                    label: 'Total Temuan',
                    data: trendEntries.map(entry => entry[1]),
                    borderColor: 'rgba(30, 58, 95, 1)',
                    backgroundColor: 'rgba(30, 58, 95, 0.12)',
                    tension: 0.28,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
    }

    function renderTable(rows) {
        const tbody = document.getElementById('reportsTableBody');
        tbody.innerHTML = '';
        rows.forEach(row => {
            const tr = document.createElement('tr');
            const pdfLink = row.pdfUrl
                ? `<div class="table-actions"><span class="status-pill success">Ready</span><a class="link-btn" href="${row.pdfUrl}" target="_blank" rel="noopener noreferrer">Open PDF</a></div>`
                : '<span class="status-pill neutral">No File</span>';
            tr.innerHTML = `
                <td>${formatDateLabel(row.visitDate || row.uploadedAt)}</td>
                <td>${escapeHtml(row.auditor || '-')}</td>
                <td>${escapeHtml(row.store || '-')}</td>
                <td>${parseNumber(row.crewCount)}</td>
                <td>${parseNumber(row.opiFindings)}</td>
                <td>${parseNumber(row.qscFindings)}</td>
                <td><strong>${parseNumber(row.totalFindings)}</strong></td>
                <td>${pdfLink}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderEmptyState(isEmpty) {
        document.getElementById('emptyState').classList.toggle('hidden', !isEmpty);
        document.getElementById('tableWrapper').classList.toggle('hidden', isEmpty);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    