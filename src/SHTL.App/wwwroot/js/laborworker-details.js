/**
 * LaborWorker Details Page (v1.0)
 * Handles: Tab navigation, movements history DataTable, resignation modal.
 */
(function ($) {
    'use strict';

    var API_BASE = '/LaborWorker';
    var movementsTable = null;
    var workerId = null;

    // ================================================
    // ANTI-FORGERY
    // ================================================
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

    // ================================================
    // BADGE RENDERERS
    // ================================================
    function renderMovementTypeBadge(data) {
        var map = {
            'TuyenMoi':      { cls: 'badge-figma-success', text: 'Tuyển mới' },
            'NghiViec':      { cls: 'badge-figma-danger',  text: 'Nghỉ việc' },
            'ChuyenViTri':   { cls: 'badge-figma-info',    text: 'Chuyển vị trí' },
            'GiaHanGpld':    { cls: 'badge-figma-warning', text: 'Gia hạn GPLĐ' },
            'GiaHanHdld':    { cls: 'badge-figma-primary', text: 'Gia hạn HĐLĐ' }
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

    // ================================================
    // MOVEMENTS DATATABLE (in Details tab 5)
    // ================================================
    function initMovementsTable(wId) {
        if ($('#movementsTable').length === 0) return;

        movementsTable = $('#movementsTable').dataTableFigma({
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
                        workerId: wId
                    };
                }
            },
            columns: [
                {
                    data: null,
                    className: 'text-center',
                    render: function (data, type, row, meta) {
                        return meta.row + meta.settings._iDisplayStart + 1;
                    }
                },
                {
                    data: 'loaiBienDong',
                    className: 'text-center',
                    render: function (data) {
                        return renderMovementTypeBadge(data);
                    }
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
                        return data ? '<span class="text-muted" style="font-size:12px;">' + escapeHtml(data) + '</span>' : '—';
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
                if ($pagination.length && $('#movementsPaginationFrame').length) {
                    $pagination.appendTo('#movementsPaginationFrame');
                }
            }
        });
    }

    // ================================================
    // RESIGNATION MODAL
    // ================================================
    function initResignationModal() {
        var $modal = $('#resignationModal');
        if ($modal.length === 0) return;

        $('#btnResignation').on('click', function () {
            $modal.modal('show');
        });

        $('#resignationForm').on('submit', function (e) {
            e.preventDefault();

            var ngayNghi = $('#resNgayNghiViec').val();
            var lyDo = $('#resLyDoNghiViec').val();

            if (!ngayNghi) {
                if (typeof toastr !== 'undefined') toastr.warning('Vui lòng nhập ngày nghỉ việc.');
                return;
            }

            var wData = window.workerData || {};
            var id = wData.id || workerId;

            $.ajax({
                url: API_BASE + '/RecordResignation/' + id,
                type: 'POST',
                contentType: 'application/x-www-form-urlencoded',
                data: {
                    NgayNghiViec: ngayNghi,
                    LyDoNghiViec: lyDo
                },
                success: function (result) {
                    if (result && result.success) {
                        $modal.modal('hide');
                        if (typeof toastr !== 'undefined') toastr.success(result.message || 'Đã ghi nhận nghỉ việc.');
                        setTimeout(function () { window.location.reload(); }, 1200);
                    } else {
                        if (typeof toastr !== 'undefined') toastr.error(result && result.message ? result.message : 'Không thể ghi nhận nghỉ việc.');
                    }
                },
                error: function () {
                    if (typeof toastr !== 'undefined') toastr.error('Không thể kết nối đến máy chủ.');
                }
            });
        });
    }

    // ================================================
    // INIT
    // ================================================
    $(document).ready(function () {
        var wData = window.workerData || {};
        workerId = wData.id;

        // Load movements tab lazily — triggered by switchNldTab inline function
        $(document).on('nld.movements.show', function () {
            if (!movementsTable && workerId) {
                initMovementsTable(workerId);
            } else if (movementsTable) {
                movementsTable.ajax.reload(null, false);
            }
        });

        // If movements tab is active on load (edge case)
        if ($('#nld-tab-movements').hasClass('active') && workerId) {
            initMovementsTable(workerId);
        }

        initResignationModal();
    });

})(jQuery);
