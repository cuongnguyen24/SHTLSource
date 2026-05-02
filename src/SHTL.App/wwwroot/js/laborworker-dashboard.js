/**
 * LaborWorker Dashboard (v1.0)
 * Module M0081 — KPI cards + Chart.js charts + KCN breakdown table.
 */
(function ($) {
    'use strict';

    var API_BASE = '/LaborWorker';
    var chartTrangThai = null;
    var chartMonthly = null;

    // ================================================
    // LOAD DASHBOARD DATA
    // ================================================
    function loadDashboard() {
        var kcnId = $('#filterKcnDashboard').val() || '';

        $.ajax({
            url: API_BASE + '/GetDashboardData',
            type: 'GET',
            data: { kcnId: kcnId },
            success: function (result) {
                if (result && result.success !== false) {
                    renderKpi(result.kpi || result);
                    renderCharts(result.charts || result);
                    renderKcnTable(result.kcnStats || result.charts && result.charts.kcnStats || []);
                } else {
                    if (typeof toastr !== 'undefined') toastr.warning('Không thể tải dữ liệu dashboard.');
                }
            },
            error: function () {
                if (typeof toastr !== 'undefined') toastr.error('Lỗi kết nối khi tải dashboard.');
            }
        });
    }

    // ================================================
    // RENDER KPI
    // ================================================
    function renderKpi(kpi) {
        if (!kpi) return;
        setText('#kpiTongSoNld',     kpi.tongSoNld     !== undefined ? kpi.tongSoNld     : kpi.TongSoNld     || '—');
        setText('#kpiDangLamViec',   kpi.dangLamViec   !== undefined ? kpi.dangLamViec   : kpi.DangLamViec   || '—');
        setText('#kpiTrongNuoc',     kpi.nldTrongNuoc  !== undefined ? kpi.nldTrongNuoc  : kpi.NldTrongNuoc  || '—');
        setText('#kpiNuocNgoai',     kpi.nldNuocNgoai  !== undefined ? kpi.nldNuocNgoai  : kpi.NldNuocNgoai  || '—');
        setText('#kpiGpldSapHetHan', kpi.gpldSapHetHan !== undefined ? kpi.gpldSapHetHan : kpi.GpldSapHetHan || '—');
        setText('#kpiTuyenMoiThang', kpi.tuyenMoiThangNay !== undefined ? kpi.tuyenMoiThangNay : kpi.TuyenMoiThangNay || '—');
    }

    function setText(selector, value) {
        var $el = $(selector);
        if ($el.length) $el.text(value);
    }

    // ================================================
    // RENDER CHARTS (Chart.js v4)
    // ================================================
    function renderCharts(charts) {
        if (!charts) return;

        // Pie: Trạng thái lao động
        var trangThaiLabels = charts.trangThaiLabels || charts.TrangThaiLabels || ['Đang làm việc', 'Nghỉ phép', 'Nghỉ thai sản', 'Đã nghỉ việc'];
        var trangThaiData   = charts.trangThaiData   || charts.TrangThaiData   || [];

        var ctxPie = document.getElementById('chartTrangThai');
        if (ctxPie && trangThaiData.length > 0) {
            if (chartTrangThai) chartTrangThai.destroy();
            chartTrangThai = new Chart(ctxPie.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: trangThaiLabels,
                    datasets: [{
                        data: trangThaiData,
                        backgroundColor: ['#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b', '#22c55e'],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { font: { size: 12 }, boxWidth: 14 } }
                    }
                }
            });
        }

        // Bar: Monthly trend
        var monthLabels     = charts.monthLabels    || charts.MonthLabels    || [];
        var tuyenMoiData    = charts.tuyenMoiData   || charts.TuyenMoiData   || [];
        var nghiViecData    = charts.nghiViecData    || charts.NghiViecData   || [];

        var ctxBar = document.getElementById('chartMonthlyTrend');
        if (ctxBar && monthLabels.length > 0) {
            if (chartMonthly) chartMonthly.destroy();
            chartMonthly = new Chart(ctxBar.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: monthLabels,
                    datasets: [
                        {
                            label: 'Tuyển mới',
                            data: tuyenMoiData,
                            backgroundColor: 'rgba(14, 165, 233, 0.75)',
                            borderColor: '#0ea5e9',
                            borderWidth: 1,
                            borderRadius: 4
                        },
                        {
                            label: 'Nghỉ việc',
                            data: nghiViecData,
                            backgroundColor: 'rgba(239, 68, 68, 0.65)',
                            borderColor: '#ef4444',
                            borderWidth: 1,
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', labels: { font: { size: 12 }, boxWidth: 14 } }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                        y: { beginAtZero: true, ticks: { font: { size: 11 }, precision: 0 } }
                    }
                }
            });
        }
    }

    // ================================================
    // KCN BREAKDOWN TABLE
    // ================================================
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderKcnTable(kcnStats) {
        var $tbody = $('#kcnStatsBody');
        if ($tbody.length === 0) return;

        if (!kcnStats || kcnStats.length === 0) {
            $tbody.html('<tr><td colspan="7" class="text-center py-3" style="font-size:13px;color:#64748b;">Không có dữ liệu</td></tr>');
            return;
        }

        var html = '';
        $.each(kcnStats, function (i, row) {
            var kcn         = row.tenKcn        || row.TenKcn        || '—';
            var tongNld     = row.tongNld        || row.TongNld       || 0;
            var trongNuoc   = row.nldTrongNuoc   || row.NldTrongNuoc  || 0;
            var nuocNgoai   = row.nldNuocNgoai   || row.NldNuocNgoai  || 0;
            var dangLv      = row.dangLamViec    || row.DangLamViec   || 0;
            var gpldSapHH   = row.gpldSapHetHan  || row.GpldSapHetHan || 0;

            var gpldClass = gpldSapHH > 0 ? 'style="font-weight:700; color:#ef4444;"' : '';

            html += '<tr>';
            html += '<td class="text-center">' + (i + 1) + '</td>';
            html += '<td class="font-weight-medium">' + escapeHtml(kcn) + '</td>';
            html += '<td class="text-center font-weight-bold">' + tongNld + '</td>';
            html += '<td class="text-center">' + trongNuoc + '</td>';
            html += '<td class="text-center" style="color:#6366f1;">' + nuocNgoai + '</td>';
            html += '<td class="text-center" style="color:#0ea5e9;">' + dangLv + '</td>';
            html += '<td class="text-center" ' + gpldClass + '>' + gpldSapHH + '</td>';
            html += '</tr>';
        });
        $tbody.html(html);
    }

    // ================================================
    // INIT
    // ================================================
    $(document).ready(function () {
        loadDashboard();

        $('#filterKcnDashboard').on('change', function () { loadDashboard(); });
        $('#btnReloadDashboard').on('click', function () { loadDashboard(); });
    });

})(jQuery);
