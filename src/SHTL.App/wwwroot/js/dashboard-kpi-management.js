// Dashboard KPI QCDC & ĐTĐK — IIFE Pattern (SCR-NV-KPI-001)
(function () {
    'use strict';

    const API = {
        getKPIData: '/Dashboard/GetKPIData'
    };

    let chart;

    // ===== INIT YEAR FILTER =====
    function initYearFilter() {
        const currentYear = new Date().getFullYear();
        const $sel = $('#filterYear');
        for (let y = currentYear; y >= currentYear - 4; y--) {
            $sel.append(`<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`);
        }
    }

    // ===== LOAD KPI =====
    function loadKPIData() {
        const year = $('#filterYear').val();
        const loaiBC = $('#filterLoaiBC').val();

        $.ajax({
            url: API.getKPIData,
            type: 'GET',
            data: { year, loaiBC },
            success: function (res) {
                if (res.success && res.data) {
                    renderMetrics(res.data);
                    renderChart(res.data);
                } else {
                    toastr.error(res.message || 'Không thể tải dữ liệu KPI');
                }
            },
            error: function () {
                toastr.error('Không thể kết nối đến máy chủ');
            }
        });
    }

    // ===== RENDER METRICS =====
    function renderMetrics(data) {
        $('#metricSoDN').text(data.soDNNopBC ?? '—');
        $('#metricSoDNSub').text(`Tổng ${data.tongSoBC} BC (QCDC: ${data.tongSoBC_QCDC}, ĐTĐK: ${data.tongSoBC_DTDK})`);

        $('#metricTuanThu').text(data.tyLeTuanThu != null ? data.tyLeTuanThu + '%' : '—');
        $('#metricDungHan').text(data.tyLeDungHan != null ? data.tyLeDungHan + '%' : '—');

        $('#metricDaXN').text(data.soBCDaXN ?? '—');
        const pctXN = data.tongSoBC > 0 ? Math.round(data.soBCDaXN / data.tongSoBC * 100) : 0;
        $('#metricDaXNSub').text(`${pctXN}% trong tổng số BC`);
    }

    // ===== RENDER CHART =====
    function renderChart(data) {
        const chartData = data.chartByKCN || [];
        const categories = chartData.map(x => x.kcnName || x.KCNName || 'Khác');
        const seriesQCDC = chartData.map(x => x.soBCQCDC ?? 0);
        const seriesDTDK = chartData.map(x => x.soBCDTDK ?? 0);

        const options = {
            series: [
                { name: 'BC QCDC', data: seriesQCDC },
                { name: 'BC ĐTĐK', data: seriesDTDK }
            ],
            chart: {
                type: 'bar',
                stacked: true,
                height: 280,
                toolbar: { show: false },
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            },
            plotOptions: {
                bar: { borderRadius: 4, columnWidth: '55%' }
            },
            colors: ['#3b82f6', '#8b5cf6'],
            dataLabels: { enabled: false },
            legend: { position: 'top' },
            xaxis: {
                categories: categories.length > 0 ? categories : ['(Không có dữ liệu)'],
                labels: { style: { fontSize: '12px' } }
            },
            yaxis: { title: { text: 'Số BC', style: { fontSize: '12px' } } },
            fill: { opacity: 1 },
            tooltip: { y: { formatter: val => val + ' BC' } },
            noData: { text: 'Không có dữ liệu cho bộ lọc đã chọn' }
        };

        if (chart) {
            chart.updateOptions(options);
        } else {
            chart = new ApexCharts(document.querySelector('#chartBCTheoKy'), options);
            chart.render();
        }
    }

    // ===== FILTER EVENTS =====
    function initFilters() {
        $('#btnSearch').on('click', loadKPIData);
        $('#btnReset').on('click', function () {
            const currentYear = new Date().getFullYear();
            $('#filterYear').val(currentYear);
            $('#filterLoaiBC').val('');
            loadKPIData();
        });
    }

    // ===== INIT =====
    $(document).ready(function () {
        initYearFilter();
        initFilters();
        loadKPIData(); // load on page init
    });

})();
