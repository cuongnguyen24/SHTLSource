/**
 * LaborWorker Management - Quản lý Danh sách Người Lao Động (v2.0)
 * Module M0079 — Refactored to server-side partial rendering (Enterprise pattern).
 * Handles: QuickSearch pagination, Modal Delete, Export.
 */
(function ($) {
    'use strict';

    var API_BASE = '/LaborWorker';
    var pendingDeleteId = null;

    // ================================================
    // ANTI-FORGERY SETUP
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
    function renderBadgeLoaiNld(data) {
        if (!data) return '<span class="badge-figma badge-figma-secondary">—</span>';
        if (data === 'TrongNuoc') return '<span class="badge-figma badge-figma-primary">Trong nước</span>';
        if (data === 'NuocNgoai') return '<span class="badge-figma badge-figma-info">Nước ngoài</span>';
        return '<span class="badge-figma badge-figma-secondary">' + data + '</span>';
    }

    function renderBadgeTrangThaiLv(data) {
        var map = {
            'DangLamViec':    { cls: 'badge-figma-success',   text: 'Đang làm việc' },
            'ThuViec':        { cls: 'badge-figma-info',      text: 'Thử việc' },
            'TamNghi':        { cls: 'badge-figma-warning',   text: 'Tạm nghỉ' },
            'NghiPhep':       { cls: 'badge-figma-warning',   text: 'Nghỉ phép' },
            'NghiThaiSan':    { cls: 'badge-figma-warning',   text: 'Nghỉ thai sản' },
            'NghiOmDau':      { cls: 'badge-figma-warning',   text: 'Nghỉ ốm đau' },
            'NghiViPhepKhac': { cls: 'badge-figma-secondary', text: 'Nghỉ vì phép khác' },
            'DaNghiViec':     { cls: 'badge-figma-danger',    text: 'Đã nghỉ việc' }
        };
        var m = map[data];
        if (!m) return '<span class="badge-figma badge-figma-secondary">' + (data || '—') + '</span>';
        return '<span class="badge-figma ' + m.cls + '">' + m.text + '</span>';
    }

    function renderBadgeTrangThaiGpld(data) {
        var map = {
            'ChuaCap':    { cls: 'badge-figma-secondary', text: 'Chưa có GPLĐ' },
            'DangHieuLuc':{ cls: 'badge-figma-success',   text: 'Đang hiệu lực' },
            'SapHetHan':  { cls: 'badge-figma-warning',   text: 'Sắp hết hạn' },
            'DaHetHan':   { cls: 'badge-figma-danger',    text: 'Đã hết hạn' },
            'DaCapLai':   { cls: 'badge-figma-info',      text: 'Đã cấp lại' },
            'BiThuHoi':   { cls: 'badge-figma-danger',    text: 'Bị thu hồi' },
            'DuocMienGpld':{ cls: 'badge-figma-primary',  text: 'Được miễn GPLĐ' }
        };
        var m = map[data];
        if (!m) return data ? '<span class="badge-figma badge-figma-secondary">' + data + '</span>' : '';
        return '<span class="badge-figma ' + m.cls + '">' + m.text + '</span>';
    }

    function renderSoNgayConLai(data) {
        if (data === null || data === undefined) return '—';
        var days = parseInt(data, 10);
        if (isNaN(days)) return '—';
        if (days < 0) {
            return '<span style="color: #ef4444; font-weight: 700;">Hết hạn ' + Math.abs(days) + ' ngày</span>';
        }
        if (days <= 30) {
            return '<span style="color: #d97706; font-weight: 700;">' + days + ' ngày</span>';
        }
        return '<span style="color: #16a34a; font-weight: 600;">' + days + ' ngày</span>';
    }

    // ================================================
    // DATE FORMATTING
    // ================================================
    function formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            var d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            var dd = String(d.getDate()).padStart(2, '0');
            var mm = String(d.getMonth() + 1).padStart(2, '0');
            var yyyy = d.getFullYear();
            return dd + '/' + mm + '/' + yyyy;
        } catch (e) {
            return dateStr;
        }
    }

    // ================================================
    // EVENTS
    // ================================================
    function initEvents() {
        // Clear all filters and reload
        $('#btnClearFilters').on('click', function () {
            var $form = $('#frmLaborWorker');
            $form.find('[name="SearchTerm"]').val('');
            $form.find('[name="LoaiLaoDong"]').val('');
            $form.find('[name="KcnId"]').val('').trigger('change');
            $form.find('[name="TrangThaiLamViec"]').val('');
            $form.find('[name="NgayBatDauFrom"]').val('');
            $form.find('[name="NgayBatDauTo"]').val('');
            $form.submit();
        });

        // Delete button → show modal
        $(document).on('click', '.btn-delete-nld', function () {
            pendingDeleteId = $(this).data('id');
            $('#deleteNldName').text($(this).data('name') || '');
            $('#deleteNldModal').modal('show');
        });

        // Confirm delete in modal
        $('#btnConfirmDeleteNld').on('click', function () {
            if (!pendingDeleteId) return;
            var $btn = $(this);
            $btn.prop('disabled', true);
            $.ajax({
                url: API_BASE + '/Delete/' + pendingDeleteId,
                type: 'POST',
                success: function (result) {
                    $('#deleteNldModal').modal('hide');
                    if (result && result.success) {
                        if (typeof toastr !== 'undefined') toastr.success(result.message || 'Đã xóa thành công.');
                        $('#frmLaborWorker').submit();
                    } else {
                        if (typeof toastr !== 'undefined') toastr.error(result && result.message ? result.message : 'Không thể xóa người lao động.');
                    }
                },
                error: function () {
                    $('#deleteNldModal').modal('hide');
                    if (typeof toastr !== 'undefined') toastr.error('Không thể kết nối đến máy chủ.');
                },
                complete: function () {
                    $btn.prop('disabled', false);
                    pendingDeleteId = null;
                }
            });
        });

        // Reset pending ID when modal dismissed
        $('#deleteNldModal').on('hidden.bs.modal', function () {
            pendingDeleteId = null;
        });
    }

    // ================================================
    // XSS GUARD
    // ================================================
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ================================================
    // INIT
    // ================================================
    $(document).ready(function () {
        initEvents();
    });

})(jQuery);
