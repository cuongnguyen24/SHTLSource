/**
 * TNLD Dashboard KPI JavaScript (M0143 - KPI cards + 4 ChartJS charts)
 * Pattern: IIFE + Chart.js + AJAX data loading
 */
(function () {
    'use strict';

    const permissions = window.userPermissions || {};
    let chart12Thang, chartNguyenNhan, chartKCN, chartHinhThuc;

    $(document).ready(function () {
        initFilters();
        loadDashboardData();
    });

    function initFilters() {
        $.get('/TaiNanLaoDong/GetKyBaoCao', function (data) {
            const $select = $('#filterKyBaoCao');
            data.items.forEach(ky => {
                $select.append(`<option value="${ky.id}">${ky.tenKy}</option>`);
            });
        });

        const currentYear = new Date().getFullYear();
        const $nam = $('#filterNam');
        for (let y = currentYear; y >= currentYear - 5; y--) {
            $nam.append(`<option value="${y}"${y === currentYear ? ' selected' : ''}>${y}</option>`);
        }

        $('#btnRefresh').on('click', loadDashboardData);
    }

    function loadDashboardData() {
        const kyBaoCaoId = $('#filterKyBaoCao').val();
        const nam = $('#filterNam').val();

        $.ajax({
            url: '/TaiNanLaoDongDashboard/GetKPI',
            type: 'GET',
            data: { kyBaoCaoId: kyBaoCaoId, nam: nam },
            success: function (data) {
                updateKPICards(data);
                loadCharts(kyBaoCaoId, nam);
            },
            error: function () {
                toastr.error('Lỗi khi tải dữ liệu KPI');
            }
        });
    }

    function updateKPICards(data) {
        $('#kpiTongSoVu').text(data.tongSoVuTNLD || 0);
        $('#kpiNguoiBiNan').text(data.soNguoiBiNan || 0);
        $('#kpiNguoiChet').text(data.soNguoiChet || 0);
        
        const tyLe = data.tyLeGiamSoVoiKyTruoc || 0;
        const $kpiTyLe = $('#kpiTyLeGiamSoVoiKyTruoc');
        $kpiTyLe.text(tyLe > 0 ? `+${tyLe}%` : `${tyLe}%`);
        $kpiTyLe.parent().removeClass('kpi-success kpi-danger');
        $kpiTyLe.parent().addClass(tyLe < 0 ? 'kpi-success' : 'kpi-danger');

        $('#kpiTNLDTapThe').text(`${data.soVuTNLDTapThe || 0} vụ`);
        $('#kpiNgayNghiViec').text(`${data.tongNgayNghiViec || 0} ngày`);
        $('#kpiTanSuat').text(`${data.tanSuatTNLD || 0}/100.000`);
    }

    function loadCharts(kyBaoCaoId, nam) {
        loadChart12Thang(nam);
        loadChartNguyenNhan(kyBaoCaoId, nam);
        loadChartKCN(kyBaoCaoId, nam);
        loadChartHinhThuc(kyBaoCaoId, nam);
    }

    function loadChart12Thang(nam) {
        $.ajax({
            url: '/TaiNanLaoDongDashboard/GetChart12Thang',
            type: 'GET',
            data: { nam: nam },
            success: function (data) {
                const ctx = document.getElementById('chart12Thang').getContext('2d');
                
                if (chart12Thang) chart12Thang.destroy();
                
                chart12Thang = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: data.labels,
                        datasets: [
                            {
                                label: 'Số vụ TNLĐ',
                                data: data.soVuTNLD,
                                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                                borderColor: 'rgba(54, 162, 235, 1)',
                                borderWidth: 1
                            },
                            {
                                label: 'Số người bị nạn',
                                data: data.soNguoiBiNan,
                                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                                borderColor: 'rgba(255, 99, 132, 1)',
                                borderWidth: 1
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        scales: {
                            y: { beginAtZero: true }
                        }
                    }
                });
            },
            error: function () {
                toastr.error('Lỗi khi tải biểu đồ 12 tháng');
            }
        });
    }

    function loadChartNguyenNhan(kyBaoCaoId, nam) {
        $.ajax({
            url: '/TaiNanLaoDongDashboard/GetChartNguyenNhan',
            type: 'GET',
            data: { kyBaoCaoId: kyBaoCaoId, nam: nam },
            success: function (data) {
                const ctx = document.getElementById('chartNguyenNhan').getContext('2d');
                
                if (chartNguyenNhan) chartNguyenNhan.destroy();
                
                chartNguyenNhan = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: data.labels,
                        datasets: [{
                            data: data.values,
                            backgroundColor: [
                                'rgba(255, 99, 132, 0.7)',
                                'rgba(54, 162, 235, 0.7)',
                                'rgba(255, 206, 86, 0.7)',
                                'rgba(75, 192, 192, 0.7)',
                                'rgba(153, 102, 255, 0.7)',
                                'rgba(255, 159, 64, 0.7)'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'right'
                            }
                        }
                    }
                });
            },
            error: function () {
                toastr.error('Lỗi khi tải biểu đồ nguyên nhân');
            }
        });
    }

    function loadChartKCN(kyBaoCaoId, nam) {
        $.ajax({
            url: '/TaiNanLaoDongDashboard/GetChartKCN',
            type: 'GET',
            data: { kyBaoCaoId: kyBaoCaoId, nam: nam },
            success: function (data) {
                const ctx = document.getElementById('chartKCN').getContext('2d');
                
                if (chartKCN) chartKCN.destroy();
                
                chartKCN = new Chart(ctx, {
                    type: 'horizontalBar',
                    data: {
                        labels: data.labels,
                        datasets: [{
                            label: 'Số vụ TNLĐ',
                            data: data.values,
                            backgroundColor: 'rgba(255, 99, 132, 0.6)',
                            borderColor: 'rgba(255, 99, 132, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            x: { beginAtZero: true }
                        }
                    }
                });
            },
            error: function () {
                toastr.error('Lỗi khi tải biểu đồ KCN');
            }
        });
    }

    function loadChartHinhThuc(kyBaoCaoId, nam) {
        $.ajax({
            url: '/TaiNanLaoDongDashboard/GetChartHinhThuc',
            type: 'GET',
            data: { kyBaoCaoId: kyBaoCaoId, nam: nam },
            success: function (data) {
                const ctx = document.getElementById('chartHinhThuc').getContext('2d');
                
                if (chartHinhThuc) chartHinhThuc.destroy();
                
                chartHinhThuc = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: data.labels,
                        datasets: [{
                            data: data.values,
                            backgroundColor: [
                                'rgba(75, 192, 192, 0.7)',
                                'rgba(153, 102, 255, 0.7)',
                                'rgba(255, 159, 64, 0.7)',
                                'rgba(255, 206, 86, 0.7)'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
            },
            error: function () {
                toastr.error('Lỗi khi tải biểu đồ hình thức');
            }
        });
    }

})();
