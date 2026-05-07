/**
 * GXN Statistics - Charts & Filter logic
 * Pattern: IIFE matching hosogiayphep-statistics.js reference
 */
var gxnStatisticsModule = (function () {
    'use strict';

    var charts = {
        statusPie: null,
        issueTypeBar: null
    };

    var STATUS_COLORS = {
        'Nháp': '#94a3b8',
        'Chờ thẩm định': '#a855f7',
        'Đang xử lý': '#6366f1',
        'Chờ ký số': '#f59e0b',
        'Đang xử lý OCR': '#3b82f6',
        'Có hiệu lực': '#10b981',
        'Từ chối': '#ef4444'
    };

    function init() {
        updatePeriodOptions();
        initEventListeners();
        loadStatisticsData();
    }

    function initEventListeners() {
        $('#periodType').on('change', updatePeriodOptions);
        $('#btnFilter').on('click', loadStatisticsData);
        $('#btnExportExcel').on('click', function () {
            if (typeof gxnStatsConfig !== 'undefined' && gxnStatsConfig.exportExcelUrl) {
                window.location.href = gxnStatsConfig.exportExcelUrl;
            }
        });
    }

    function updatePeriodOptions() {
        var type = $('#periodType').val();
        var sel = $('#periodValue');
        sel.empty();

        if (type === 'thang') {
            for (var i = 1; i <= 12; i++) {
                var selected = i === new Date().getMonth() + 1 ? ' selected' : '';
                sel.append('<option value="' + i + '"' + selected + '>Tháng ' + i + '</option>');
            }
        } else if (type === 'quy') {
            var currentQuarter = Math.floor((new Date().getMonth() + 3) / 3);
            for (var q = 1; q <= 4; q++) {
                var qSel = q === currentQuarter ? ' selected' : '';
                sel.append('<option value="' + q + '"' + qSel + '>Quý ' + q + '</option>');
            }
        } else {
            sel.append('<option value="1" selected>Cả năm</option>');
        }
    }

    function getDateRange() {
        var type = $('#periodType').val();
        var value = parseInt($('#periodValue').val()) || 1;
        var year = parseInt($('#reportYear').val()) || new Date().getFullYear();
        var fromDate, toDate;

        if (type === 'thang') {
            fromDate = new Date(year, value - 1, 1);
            toDate = new Date(year, value, 0);
        } else if (type === 'quy') {
            var startMonth = (value - 1) * 3;
            fromDate = new Date(year, startMonth, 1);
            toDate = new Date(year, startMonth + 3, 0);
        } else {
            fromDate = new Date(year, 0, 1);
            toDate = new Date(year, 11, 31);
        }

        function fmt(d) {
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }

        return { fromDate: fmt(fromDate), toDate: fmt(toDate) };
    }

    function loadStatisticsData() {
        var dateRange = getDateRange();
        var url = (typeof gxnStatsConfig !== 'undefined' && gxnStatsConfig.summaryUrl)
            ? gxnStatsConfig.summaryUrl
            : '/gxn/dashboard/summary';

        $('#btnFilter').prop('disabled', true);
        $('#btnFilter i').addClass('fa-spin');

        $.ajax({
            url: url,
            type: 'GET',
            data: {
                fromDate: dateRange.fromDate,
                toDate: dateRange.toDate
            },
            success: function (res) {
                if (res.success && res.data) {
                    var d = res.data;
                    $('#statTotalDossiers').text((d.totalDossiers || 0).toLocaleString());
                    $('#statActiveIssued').text((d.activeIssued || 0).toLocaleString());
                    $('#statExpiring').text((d.expiringSoon || 0).toLocaleString());
                    $('#statOverdue').text((d.overdueDossiers || 0).toLocaleString());

                    renderStatusPie(d.statusStats || {});
                    renderIssueTypeBar(d.statusStats || {});
                } else {
                    toastr.error(res.message || 'Không thể tải dữ liệu thống kê');
                }
            },
            error: function () {
                toastr.error('Lỗi hệ thống khi tải dữ liệu thống kê');
            },
            complete: function () {
                $('#btnFilter').prop('disabled', false);
                $('#btnFilter i').removeClass('fa-spin');
            }
        });
    }

    function destroyCharts() {
        if (charts.statusPie) { charts.statusPie.destroy(); charts.statusPie = null; }
        if (charts.issueTypeBar) { charts.issueTypeBar.destroy(); charts.issueTypeBar = null; }
    }

    function renderStatusPie(stats) {
        var labels = Object.keys(stats).filter(function (l) { return stats[l] > 0; });
        var dataValues = labels.map(function (l) { return stats[l]; });
        var dataColors = labels.map(function (l) { return STATUS_COLORS[l] || '#64748b'; });

        if (charts.statusPie) charts.statusPie.destroy();

        var ctx = document.getElementById('statusPieChart');
        if (!ctx) return;

        charts.statusPie = new Chart(ctx.getContext('2d'), {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: dataColors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 11 }, padding: 12, usePointStyle: true }
                    }
                }
            }
        });
    }

    function renderIssueTypeBar(stats) {
        var processingCount = (stats['Nháp'] || 0) + (stats['Chờ thẩm định'] || 0)
            + (stats['Đang xử lý'] || 0) + (stats['Chờ ký số'] || 0) + (stats['Đang xử lý OCR'] || 0);
        var completedCount = stats['Có hiệu lực'] || 0;
        var rejectedCount = stats['Từ chối'] || 0;

        if (charts.issueTypeBar) charts.issueTypeBar.destroy();

        var ctx = document.getElementById('issueTypeChart');
        if (!ctx) return;

        charts.issueTypeBar = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Đang xử lý', 'Có hiệu lực', 'Từ chối'],
                datasets: [{
                    label: 'Số hồ sơ',
                    data: [processingCount, completedCount, rejectedCount],
                    backgroundColor: ['#6366f1', '#10b981', '#ef4444'],
                    borderRadius: 8,
                    maxBarThickness: 60
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, font: { size: 11 } },
                        grid: { color: '#f1f5f9' }
                    },
                    x: {
                        ticks: { font: { size: 12, weight: '600' } },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // Public API
    return { init: init };
})();

$(document).ready(function () {
    gxnStatisticsModule.init();
});
