/**
 * BaoCaoTHSDLD — Index Management Module
 * M0086 — IIFE pattern with quickSearch partial-reload + CRUD + Workflow actions
 */
(function ($) {
    'use strict';

    var Module = {
        token: null,
        currentId: null,

        init: function () {
            this.token = $('input[name="__RequestVerificationToken"]').val();
            this.initFilters();
            this.initModals();
        },

        // ─── Filters ─────────────────────────────────────────────────────────

        initFilters: function () {
            // Init Select2 for filter dropdowns inside the quickSearch form
            if ($.fn.select2) {
                $('#frmBaoCao .ent-select2').select2({
                    theme: 'bootstrap4',
                    width: 'resolve',
                    allowClear: true,
                    language: { noResults: function () { return 'Không tìm thấy'; } }
                });
            }

            // Search on Enter key
            $(document).on('keypress', 'input[name="searchTerm"]', function (e) {
                if (e.which === 13) {
                    e.preventDefault();
                    $('#frmBaoCao').trigger('submit');
                }
            });

            // Clear filter button (inside dropdown)
            $('#btnClearFilter').on('click', function (e) {
                e.preventDefault();
                $('input[name="searchTerm"]').val('');
                var $form = $('#frmBaoCao');
                $form.find('select[name="kyBaoCaoId"]').val('').trigger('change');
                $form.find('select[name="trangThai"]').val('').trigger('change');
                $form.find('select[name="dungHan"]').val('').trigger('change');
                $form.trigger('submit');
            });
        },

        // ─── Reload list (trigger quickSearch form submit) ────────────────────

        reloadList: function () {
            var $form = $('#frmBaoCao');
            if ($form.length) $form.trigger('submit');
        },

        // ─── Modals ───────────────────────────────────────────────────────────

        initModals: function () {
            var self = this;

            // Delete
            $(document).on('click', '.btn-delete', function () {
                self.currentId = $(this).data('id');
                $('#deleteName').text($(this).data('name'));
                $('#deleteModal').modal('show');
            });

            $('#btnConfirmDelete').on('click', function () {
                self.doDelete();
            });

            // Xác nhận
            $(document).on('click', '.btn-xacnhan', function () {
                self.currentId = $(this).data('id');
                $('#xacNhanName').text($(this).data('name'));
                $('#xacNhanGhiChu').val('');
                $('#xacNhanModal').modal('show');
            });

            $('#btnConfirmXacNhan').on('click', function () {
                self.doXacNhan();
            });

            // Yêu cầu bổ sung
            $(document).on('click', '.btn-yeucaubosung', function () {
                self.currentId = $(this).data('id');
                $('#yeuCauBSNoiDung').val('');
                $('#yeuCauBSModal').modal('show');
            });

            $('#btnConfirmYeuCauBS').on('click', function () {
                self.doYeuCauBoSung();
            });

            // Từ chối
            $(document).on('click', '.btn-tuchoi', function () {
                self.currentId = $(this).data('id');
                $('#tuChoiLyDo').val('');
                $('#tuChoiModal').modal('show');
            });

            $('#btnConfirmTuChoi').on('click', function () {
                self.doTuChoi();
            });
        },

        // ─── Actions ─────────────────────────────────────────────────────────

        doDelete: function () {
            var self = this;
            $.ajax({
                url: '/BaoCaoTHSDLD/Delete/' + self.currentId,
                method: 'POST',
                headers: { 'RequestVerificationToken': self.token },
                success: function (resp) {
                    $('#deleteModal').modal('hide');
                    if (resp.success) {
                        toastr.success(resp.message);
                        self.reloadList();
                    } else {
                        toastr.error(resp.message);
                    }
                },
                error: function () {
                    toastr.error('Lỗi không xác định khi xóa báo cáo.');
                }
            });
        },

        doXacNhan: function () {
            var self = this;
            $.ajax({
                url: '/BaoCaoTHSDLD/XacNhan/' + self.currentId,
                method: 'POST',
                headers: { 'RequestVerificationToken': self.token },
                data: { id: self.currentId, ghiChuNoiBo: $('#xacNhanGhiChu').val() },
                success: function (resp) {
                    $('#xacNhanModal').modal('hide');
                    if (resp.success) {
                        toastr.success(resp.message);
                        self.reloadList();
                    } else {
                        toastr.error(resp.message);
                    }
                },
                error: function () { toastr.error('Lỗi khi xác nhận báo cáo.'); }
            });
        },

        doYeuCauBoSung: function () {
            var self = this;
            var noiDung = $('#yeuCauBSNoiDung').val().trim();
            if (!noiDung) { toastr.error('Vui lòng nhập nội dung yêu cầu bổ sung.'); return; }

            $.ajax({
                url: '/BaoCaoTHSDLD/YeuCauBoSung/' + self.currentId,
                method: 'POST',
                headers: { 'RequestVerificationToken': self.token },
                data: { id: self.currentId, noiDung: noiDung },
                success: function (resp) {
                    $('#yeuCauBSModal').modal('hide');
                    if (resp.success) {
                        toastr.success(resp.message);
                        self.reloadList();
                    } else {
                        toastr.error(resp.message);
                    }
                },
                error: function () { toastr.error('Lỗi khi gửi yêu cầu bổ sung.'); }
            });
        },

        doTuChoi: function () {
            var self = this;
            var lyDo = $('#tuChoiLyDo').val().trim();
            if (!lyDo) { toastr.error('Vui lòng nhập lý do từ chối.'); return; }

            $.ajax({
                url: '/BaoCaoTHSDLD/TuChoi/' + self.currentId,
                method: 'POST',
                headers: { 'RequestVerificationToken': self.token },
                data: { id: self.currentId, lyDo: lyDo },
                success: function (resp) {
                    $('#tuChoiModal').modal('hide');
                    if (resp.success) {
                        toastr.success(resp.message);
                        self.reloadList();
                    } else {
                        toastr.error(resp.message);
                    }
                },
                error: function () { toastr.error('Lỗi khi từ chối báo cáo.'); }
            });
        }
    };

    $(document).ready(function () {
        Module.init();
    });

})(jQuery);
