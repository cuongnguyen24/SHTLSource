/**
 * LaborWorker Movements List (v1.0)
 * Module M0080 — All movements across all workers (full list page).
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

    function renderMovementTypeBadge(data) {
        var map = {
            'TuyenMoi':    { cls: 'badge-figma-success', text: 'Tuyển mới' },
            'NghiViec':    { cls: 'badge-figma-danger',  text: 'Nghỉ việc' },
            'ChuyenViTri': { cls: 'badge-figma-info',    text: 'Chuyển vị trí' },
            'GiaHanGpld':  { cls: 'badge-figma-warning', text: 'Gia hạn GPLĐ' },
            'GiaHanHdld':  { cls: 'badge-figma-primary', text: 'Gia hạn HĐLĐ' }
        };
        var m = map[data];
        if (!m) return '<span class="badge-figma badge-figma-secondary">' + (data || '—') + '</span>';
        return '<span class="badge-figma ' + m.cls + '">' + m.text + '</span>';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        try { return new Date(dateStr).toLocaleDateString('vi-VN'); } catch (e) { return dateStr; }
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '—';
        try { return new Date(dateStr).toLocaleString('vi-VN'); } catch (e) { return dateStr; }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function initDataTable() {
        if ($('#movementsListTable').length === 0) return;

        table = $('#movementsListTable').dataTableFigma({
            serverSide: true,
            ordering: false,
            ajax: {
                url: API_BASE + '/GetMovements',
                type: 'GET',
                data: function (d) {
                    var pageSize = d.length === -1 ? 50 : d.length;
                    var pageNumber = d.length === -1 ? 1 : Math.floor(d.start / pageSize) + 1;
                    return {
                        draw: d.draw,
                        page: pageNumber,
                        pageSize: pageSize,
                        search: $('#searchWorkerName').val(),
                        movementType: $('#filterMovementType').val()
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
                        var hoTen = escapeHtml(row.hoTen || row.HoTen || '—');
                        var id = row.laborWorkerId || row.LaborWorkerId;
                        if (id) {
                            return '<a href="' + API_BASE + '/Details/' + id + '" class="font-weight-bold" style="color:var(--primary);" title="Xem chi tiết NLĐ">' + hoTen + '</a>';
                        }
                        return hoTen;
                    }
                },
                {
                    data: 'loaiBienDong',
                    className: 'text-center',
                    render: function (data) { return renderMovementTypeBadge(data); }
                },
                {
                    data: 'ngayBienDong',
                    className: 'text-center',
                    render: function (data) { return formatDate(data); }
                },
                {
                    data: 'viTriCu',
                    render: function (data) { return data ? escapeHtml(data) : '—'; }
                },
                {
                    data: 'viTriMoi',
                    render: function (data) { return data ? escapeHtml(data) : '—'; }
                },
                {
                    data: 'ghiChu',
                    render: function (data) {
                        return data ? '<span style="font-size:12px; color:#64748b;">' + escapeHtml(data) + '</span>' : '—';
                    }
                },
                {
                    data: 'createdAt',
                    className: 'text-center',
                    render: function (data) { return formatDateTime(data); }
                }
            ],
            drawCallback: function (settings) {
                if (typeof FigmaDataTables !== 'undefined' && FigmaDataTables.defaultConfig) {
                    FigmaDataTables.defaultConfig.drawCallback(settings);
                }
                var $wrapper = $(settings.nTable).closest('.dataTables_wrapper');
                var $pagination = $wrapper.find('.pagination-figma-container');
                if ($pagination.length && $('#paginationFrame').length) {
                    $pagination.appendTo('#paginationFrame');
                }
            }
        });
    }

    function initEvents() {
        $('#searchWorkerName').on('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () { if (table) table.ajax.reload(); }, DEBOUNCE_DELAY);
        });

        $('#filterMovementType').on('change', function () { if (table) table.ajax.reload(); });

        $('#btnRefresh').on('click', function () {
            $('#searchWorkerName').val('');
            $('#filterMovementType').val('');
            if (table) table.ajax.reload();
        });
    }

    $(document).ready(function () {
        initDataTable();
        initEvents();
    });

})(jQuery);
