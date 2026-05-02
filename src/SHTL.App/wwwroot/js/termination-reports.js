/**
 * Termination Reports — SCR-NV-REPORT-001
 * Module: M0075 — Báo cáo & Thống kê chấm dứt HĐLĐ
 * Pattern: IIFE
 */
(function () {
    'use strict';

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function getFilterParams() {
        var p = new URLSearchParams();
        p.append('period',      document.getElementById('filterPeriod').value || 'month');
        p.append('kcn',         document.getElementById('filterKcn').value || '');
        p.append('nationality', document.getElementById('filterNationality').value || '');
        p.append('reasonCode',  document.getElementById('filterReason').value || '');
        return p;
    }

    function setText(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    // ── Fetch and render data ─────────────────────────────────────────
    function fetchReport() {
        var params = getFilterParams();
        fetch('/TerminationReports/GetData?' + params.toString())
            .then(function (r) { return r.json(); })
            .then(function (json) {
                var d = json.data || json || {};
                var kpi = d.kpiStats || {};
                setText('rptTotal',   kpi.total   !== undefined ? kpi.total   : '0');
                setText('rptWorkers', kpi.workers !== undefined ? kpi.workers : '0');
                setText('rptOnTime',  kpi.onTimeRate !== undefined ? (kpi.onTimeRate + '%') : '—');

                var breakdown = d.reasonBreakdown || [];
                var tbody = document.getElementById('reasonBody');
                if (breakdown.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">Không có dữ liệu trong kỳ báo cáo này.</td></tr>';
                    return;
                }
                var total = kpi.total || 1;
                var html = breakdown.map(function (row) {
                    var pct = total > 0 ? Math.round(row.count / total * 100) : 0;
                    return '<tr>' +
                           '<td>' + escapeHtml(row.reasonName) + '</td>' +
                           '<td class="text-center" style="font-weight:700;">' + row.count + '</td>' +
                           '<td class="text-center">' + pct + '%</td>' +
                           '</tr>';
                }).join('');
                tbody.innerHTML = html;
            })
            .catch(function () {
                document.getElementById('reasonBody').innerHTML =
                    '<tr><td colspan="3" class="text-center text-danger py-3">Lỗi tải dữ liệu báo cáo.</td></tr>';
            });
    }

    // ── Export ────────────────────────────────────────────────────────
    function initExport() {
        document.getElementById('btnExportExcel').addEventListener('click', function () {
            window.location.href = '/TerminationReports/ExportExcel?' + getFilterParams().toString();
        });
        document.getElementById('btnExportPdf').addEventListener('click', function () {
            window.location.href = '/TerminationReports/ExportPdf?' + getFilterParams().toString();
        });
    }

    // ── Init ─────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        document.getElementById('btnFilter').addEventListener('click', fetchReport);
        initExport();
        fetchReport(); // load on page load
    });

})();

