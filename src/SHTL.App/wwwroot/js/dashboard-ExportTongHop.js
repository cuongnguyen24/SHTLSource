// Dashboard ExportTongHop — SCR-KPI-003 — IIFE Pattern
(function () {
    'use strict';

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : '';
    }

    function getFilterParams() {
        const params = new URLSearchParams();
        const nam = $('#exportNam').val();
        const ky  = $('#exportKy').val();
        const kcn = $('#exportKCN').val();
        const loi = $('#exportLoai').val();
        if (nam) params.set('nam', nam);
        if (ky)  params.set('kyBaoCaoId', ky);
        if (kcn) params.set('industrialZoneId', kcn);
        if (loi) params.set('loai', loi);
        return params;
    }

    function loadFilters() {
        // Năm
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y >= currentYear - 5; y--) {
            $('#exportNam').append('<option value="' + y + '">' + y + '</option>');
        }
        // Kỳ báo cáo
        $.ajax({
            url: '/KyBaoCaoQCDCVaDT/GetAll?page=1&pageSize=100',
            type: 'GET',
            success: function (r) {
                if (r.success && r.data) {
                    const items = r.data.items || r.data;
                    (Array.isArray(items) ? items : []).forEach(function (item) {
                        $('#exportKy').append('<option value="' + item.id + '">' + escapeHtml(item.tenKy) + ' - ' + item.nam + '</option>');
                    });
                }
            }
        });
        // KCN
        $.ajax({
            url: '/Enterprise/GetKCNList',
            type: 'GET',
            success: function (r) {
                if (r.success && r.data) {
                    (Array.isArray(r.data) ? r.data : []).forEach(function (k) {
                        $('#exportKCN').append('<option value="' + k.id + '">' + escapeHtml(k.name || k.ten) + '</option>');
                    });
                }
            }
        });
    }

    function loadPreview() {
        const params = getFilterParams();
        if (!params.get('nam') && !params.get('kyBaoCaoId')) {
            toastr.warning('Vui lòng chọn ít nhất Năm hoặc Kỳ báo cáo.');
            return;
        }
        $.ajax({
            url: '/DashboardQuyCheDanChu/GetKPI?' + params.toString(),
            type: 'GET',
            success: function (r) {
                if (r.success && r.data) {
                    const d = r.data;
                    $('#prevTongDN').text(d.tongDN || d.tongQCDC || 0);
                    $('#prevDaNop').text(d.daNop || d.qcdc_DaXN || 0);
                    $('#prevChuaNop').text(d.chuaNop || 0);
                    $('#prevQuaHan').text(d.quaHan || d.qcdc_QuaHan || 0);
                }
                $('#previewFrame').show();
                $('#exportActionsFrame').show();
            },
            error: function () {
                toastr.error('Không thể tải dữ liệu xem trước');
            }
        });
    }

    function bindEvents() {
        $('#btnPreview').on('click', loadPreview);

        $('#btnExportPDF').on('click', function () {
            const params = getFilterParams();
            params.set('format', 'pdf');
            window.location.href = '/DashboardQuyCheDanChu/ExportTongHop?' + params.toString();
        });

        $('#btnExportExcel').on('click', function () {
            const params = getFilterParams();
            params.set('format', 'excel');
            window.location.href = '/DashboardQuyCheDanChu/ExportTongHop?' + params.toString();
        });

        $('#btnExportTT28').on('click', function () {
            const params = getFilterParams();
            params.set('mau', 'TT28');
            window.location.href = '/DashboardQuyCheDanChu/ExportTongHop?' + params.toString();
        });
    }

    $(document).ready(function () {
        loadFilters();
        bindEvents();
    });

})();
