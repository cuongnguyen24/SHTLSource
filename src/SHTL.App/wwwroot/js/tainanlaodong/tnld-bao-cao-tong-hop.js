/**
 * TNLD Báo cáo tổng hợp JavaScript (M0145 - Filter + preview + Excel export)
 * Pattern: IIFE + Chart.js + Excel file download
 */
(function () {
    'use strict';

    const permissions = window.userPermissions || {};
    let chartTopDN;

    $(document).ready(function () {
        initFilters();
        initActions();
    });

    function initFilters() {
        $.get('/TaiNanLaoDong/GetKyBaoCao', function (data) {
            const $select = $('#filterKyBaoCaoId');
            data.items.forEach(ky => {
                $select.append(`<option value="${ky.id}">${ky.tenKy}</option>`);
            });
        });

        const currentYear = new Date().getFullYear();
        const $nam = $('#filterNam');
        for (let y = currentYear; y >= currentYear - 5; y--) {
            $nam.append(`<option value="${y}">${y}</option>`);
        }

        $.get('/IndustrialZone/GetAll', function (data) {
            const $select = $('#filterIndustrialZoneId');
            data.items.forEach(kcn => {
                $select.append(`<option value="${kcn.id}">${kcn.name}</option>`);
            });
        });

        $.get('/TaiNanLaoDong/GetCategoryByScope?scope=TNLD_LOAI', function (data) {
            const $select = $('#filterLoaiTNLD');
            data.items.forEach(item => {
                $select.append(`<option value="${item.id}">${item.name}</option>`);
            });
        });
    }

    function initActions() {
        $('#btnPreview').on('click', function () {
            const kyBaoCaoId = $('#filterKyBaoCaoId').val();
            const nam = $('#filterNam').val();

            if (!kyBaoCaoId || !nam) {
                toastr.error('Vui lòng chọn Kỳ báo cáo và Năm');
                return;
            }

            loadPreview();
        });

        $('#btnReset').on('click', function () {
            $('#formFilter')[0].reset();
            $('#previewSection').hide();
            $('#btnExportExcel').prop('disabled', true);
        });

        $('#btnExportExcel').on('click', function () {
            exportExcel();
        });
    }

    function loadPreview() {
        const params = {
            kyBaoCaoId: $('#filterKyBaoCaoId').val(),
            nam: $('#filterNam').val(),
            industrialZoneId: $('#filterIndustrialZoneId').val(),
            loaiTNLD: $('#filterLoaiTNLD').val()
        };

        $.ajax({
            url: '/TaiNanLaoDongBaoCaoTongHop/Preview',
            type: 'GET',
            data: params,
            success: function (data) {
                renderSummary(data.summary);
                renderDetailTable(data.details);
                renderTopDNChart(data.topDN);
                
                $('#previewSection').show();
                $('#btnExportExcel').prop('disabled', false);
            },
            error: function () {
                toastr.error('Lỗi khi tải báo cáo');
            }
        });
    }

    function renderSummary(summary) {
        $('#summaryTongSoVu').text(summary.tongSoVu || 0);
        $('#summaryNguoiBiNan').text(summary.nguoiBiNan || 0);
        $('#summaryNguoiChet').text(summary.nguoiChet || 0);
        $('#summaryDNBaoCao').text(summary.soDoanhNghiepBaoCao || 0);
    }

    function renderDetailTable(details) {
        const $tbody = $('#previewTable tbody');
        $tbody.empty();
        
        let totals = {
            soVu: 0,
            nguoiBiNan: 0,
            nguoiChet: 0,
            thuongNang: 0,
            thuongNhe: 0,
            ngayNghi: 0
        };

        details.forEach((row, index) => {
            const tr = `
                <tr>
                    <td>${index + 1}</td>
                    <td>${row.enterpriseName}</td>
                    <td>${row.industrialZoneName}</td>
                    <td class="text-center">${row.soVuTNLD}</td>
                    <td class="text-center">${row.soNguoiBiNan}</td>
                    <td class="text-center">${row.soNguoiChet}</td>
                    <td class="text-center">${row.soNguoiBiThuongNang}</td>
                    <td class="text-center">${row.soNguoiBiThuongNhe}</td>
                    <td class="text-center">${row.tongSoNgayNghiViec}</td>
                </tr>
            `;
            $tbody.append(tr);

            totals.soVu += row.soVuTNLD;
            totals.nguoiBiNan += row.soNguoiBiNan;
            totals.nguoiChet += row.soNguoiChet;
            totals.thuongNang += row.soNguoiBiThuongNang;
            totals.thuongNhe += row.soNguoiBiThuongNhe;
            totals.ngayNghi += row.tongSoNgayNghiViec;
        });

        $('#footerSoVu').text(totals.soVu);
        $('#footerNguoiBiNan').text(totals.nguoiBiNan);
        $('#footerNguoiChet').text(totals.nguoiChet);
        $('#footerThuongNang').text(totals.thuongNang);
        $('#footerThuongNhe').text(totals.thuongNhe);
        $('#footerNgayNghi').text(totals.ngayNghi);
    }

    function renderTopDNChart(topDNData) {
        const ctx = document.getElementById('chartTopDN').getContext('2d');
        
        if (chartTopDN) chartTopDN.destroy();
        
        chartTopDN = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topDNData.labels,
                datasets: [{
                    label: 'Số vụ TNLĐ',
                    data: topDNData.values,
                    backgroundColor: 'rgba(220, 53, 69, 0.6)',
                    borderColor: 'rgba(220, 53, 69, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: { beginAtZero: true }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    function exportExcel() {
        const params = {
            kyBaoCaoId: $('#filterKyBaoCaoId').val(),
            nam: $('#filterNam').val(),
            industrialZoneId: $('#filterIndustrialZoneId').val(),
            loaiTNLD: $('#filterLoaiTNLD').val()
        };

        const queryString = $.param(params);
        const form = $(`<form method="POST" action="/TaiNanLaoDongBaoCaoTongHop/ExportExcel">
            <input type="hidden" name="kyBaoCaoId" value="${params.kyBaoCaoId}">
            <input type="hidden" name="nam" value="${params.nam}">
            <input type="hidden" name="industrialZoneId" value="${params.industrialZoneId || ''}">
            <input type="hidden" name="loaiTNLD" value="${params.loaiTNLD || ''}">
            <input type="hidden" name="__RequestVerificationToken" value="${$('input[name="__RequestVerificationToken"]').val()}">
        </form>`);

        $('body').append(form);
        form.submit();
        form.remove();

        toastr.success('Đang xuất file Excel...');
    }

})();
