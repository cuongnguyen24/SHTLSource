/**
 * LaborWorker Alerts (v1.0)
 * Module M0080 — Cảnh báo GPLĐ/Hộ chiếu hết hạn.
 */
(function ($) {
    'use strict';

    var API_BASE = '/LaborWorker';
    var DEBOUNCE_DELAY = 400;
    var table = null;
    var searchTimer = null;

    function getAntiForgeryToken() {
        return $('input[name="__RequestVerificationToken"]').val() || '';
    }

    $.ajaxSetup({
        beforeSend: function (xhr, settings) {
            if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type)) {
                xhr.setRequestHeader('RequestVerificationToken', getAntiForgeryToken());
            }
        }
    });

    function renderAlertTypeBadge(data) {
        var map = {
            'GpldSapHetHan':     { cls: 'badge-figma-warning', text: 'GPLĐ sắp HH' },
            'GpldDaHetHan':      { cls: 'badge-figma-danger',  text: 'GPLĐ đã HH' },
            'HoChieuSapHetHan':  { cls: 'badge-figma-warning', text: 'Hộ chiếu sắp HH' },
            'HoChieuDaHetHan':   { cls: 'badge-figma-danger',  text: 'Hộ chiếu đã HH' }
        };
        var m = map[data];
        if (!m) return '<span class="badge-figma badge-figma-secondary">' + (data || '—') + '</span>';
        return '<span class="badge-figma ' + m.cls + '">' + m.text + '</span>';
    }

    function renderAlertStatusBadge(isResolved) {
        if (isResolved === true || isResolved === 'true') {
            return '<span class="badge-figma badge-figma-success">Đã xử lý</span>';
        }
        return '<span class="badge-figma badge-figma-danger">Chưa xử lý</span>';
    }

    function renderSoNgayConLai(data) {
        if (data === null || data === undefined) return '—';
        var days = parseInt(data, 10);
        if (isNaN(days)) return '—';
        if (days < 0) return '<span style="color:#ef4444;font-weight:700;">Hết hạn ' + Math.abs(days) + ' ngày</span>';
        if (days <= 30) return '<span style="color:#d97706;font-weight:700;">' + days + ' ngày</span>';
        return '<span style="color:#16a34a;font-weight:600;">' + days + ' ngày</span>';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        try { return new Date(dateStr).toLocaleDateString('vi-VN'); } catch (e) { return dateStr; }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function initDataTable() {
        if ($('#alertsTable').length === 0) return;

        table = $('#alertsTable').dataTableFigma({
            serverSide: true,
            ordering: false,
            ajax: {
                url: API_BASE + '/GetAlerts',
                type: 'GET',
                data: function (d) {
                    var pageSize = d.length === -1 ? 50 : d.length;
                    var pageNumber = d.length === -1 ? 1 : Math.floor(d.start / pageSize) + 1;
                    var statusVal = $('#filterAlertStatus').val();
                    return {
                        draw: d.draw,
                        page: pageNumber,
                        pageSize: pageSize,
                        alertType: $('#filterAlertType').val(),
                        isResolved: statusVal === 'DaXuLy' ? 'true' : statusVal === 'ChuaXuLy' ? 'false' : ''
                    };
                }
            },
            columns: [
                {
                    data: null,
                    className: 'text-center',
                    render: function (data, type, row, meta) { return meta.row + meta.settings._iDisplayStart + 1; }
                },
                {
                    data: null,
                    render: function (data, type, row) {
                        var hoTen = escapeHtml(row.hoTenNld || row.HoTenNld || '—');
                        var id = row.laborWorkerId || row.LaborWorkerId;
                        if (id) {
                            return '<a href="' + API_BASE + '/Details/' + id + '" class="font-weight-bold" style="color:var(--primary);" title="Xem chi tiết NLĐ">' + hoTen + '</a>';
                        }
                        return hoTen;
                    }
                },
                {
                    data: 'tenDoanhNghiep',
                    render: function (data) {
                        return data ? '<span class="text-truncate d-block" style="max-width:200px;" title="' + escapeHtml(data) + '">' + escapeHtml(data) + '</span>' : '—';
                    }
                },
                {
                    data: 'loaiCanhBao',
                    className: 'text-center',
                    render: function (data) { return renderAlertTypeBadge(data); }
                },
                {
                    data: 'ngayHetHan',
                    className: 'text-center',
                    render: function (data) { return formatDate(data); }
                },
                {
                    data: 'soNgayConLai',
                    className: 'text-center',
                    render: function (data) { return renderSoNgayConLai(data); }
                },
                {
                    data: 'isResolved',
                    className: 'text-center',
                    render: function (data) { return renderAlertStatusBadge(data); }
                },
                {
                    data: null,
                    className: 'text-center',
                    render: function (data, type, row) {
                        var permissions = window.userPermissions || {};
                        var canUpdate = permissions.canUpdate === true;
                        var id = row.id || row.Id;
                        var isResolved = row.isResolved === true;

                        if (!canUpdate || isResolved) {
                            return '<span class="text-muted" style="font-size:12px;">—</span>';
                        }
                        return '<button type="button" class="btn-figma btn-figma-outline btn-resolve-alert" style="height:28px;padding:0 10px;font-size:12px;" data-id="' + id + '">'
                             + '<i class="fas fa-check mr-1"></i>Xử lý</button>';
                    }
                }
            ],
            drawCallback: function (settings) {
                if (typeof FigmaDataTables !== 'undefined' && FigmaDataTables.defaultConfig) {
                    FigmaDataTables.defaultConfig.drawCallback(settings);
                }
                var $wrapper = $(settings.nTable).closest('.dataTables_wrapper');
                var $pagination = $wrapper.find('.pagination-figma-container');
                if ($pagination.length && $('#alertPaginationFrame').length) {
                    $pagination.appendTo('#alertPaginationFrame');
                }
            }
        });
    }

    function initEvents() {
        $('#searchAlertWorker').on('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () { if (table) table.ajax.reload(); }, DEBOUNCE_DELAY);
        });

        $('#filterAlertType, #filterAlertStatus').on('change', function () { if (table) table.ajax.reload(); });

        $('#btnRefreshAlerts').on('click', function () {
            $('#searchAlertWorker').val('');
            $('#filterAlertType, #filterAlertStatus').val('');
            if (table) table.ajax.reload();
        });

        // Resolve alert
        $(document).on('click', '.btn-resolve-alert', function () {
            var id = $(this).data('id');
            if (!confirm('Đánh dấu đã xử lý cảnh báo này?')) return;

            $.ajax({
                url: API_BASE + '/ResolveAlert/' + id,
                type: 'POST',
                success: function (result) {
                    if (result && result.success) {
                        if (typeof toastr !== 'undefined') toastr.success(result.message || 'Đã xử lý cảnh báo.');
                        if (table) table.ajax.reload(null, false);
                    } else {
                        if (typeof toastr !== 'undefined') toastr.error(result && result.message ? result.message : 'Không thể xử lý cảnh báo.');
                    }
                },
                error: function () {
                    if (typeof toastr !== 'undefined') toastr.error('Không thể kết nối đến máy chủ.');
                }
            });
        });
    }

    $(document).ready(function () {
        initDataTable();
        initEvents();
    });

})(jQuery);
