/**
 * Module Management JavaScript
 * Pattern: server-side search/pagination via quickSearch form → _Modules partial
 */
(function () {
    'use strict';

    let deleteId = null;
    let deleteName = '';
    let isSubmitting = false;

    // ── Reload helpers ────────────────────────────────────────────────────

    function reloadList() {
        $('#frmModule').trigger('submit');
    }

    // ── Event Handlers ────────────────────────────────────────────────────

    function bindEvents() {
        // Delete module
        $(document).off('click', '.btn-delete-module').on('click', '.btn-delete-module', function () {
            deleteId = $(this).data('id');
            deleteName = $(this).data('name');
            $('#deleteModuleName').text(deleteName);
            $('#deleteModal').modal('show');
        });

        // Confirm delete
        $(document).off('click', '#btnConfirmDelete').on('click', '#btnConfirmDelete', function () {
            if (!deleteId || isSubmitting) return;

            const $btn = $(this);
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xóa...');
            isSubmitting = true;

            const token = $('input[name="__RequestVerificationToken"]').val();

            $.ajax({
                url: '/Module/Delete/' + deleteId,
                type: 'POST',
                headers: { 'RequestVerificationToken': token },
                success: function (response) {
                    if (response.success) { // Note: original API used 'success' property
                        toastr.success(response.message || 'Xóa module thành công', 'Thành công');
                        $('#deleteModal').modal('hide');
                        reloadList();
                    } else {
                        toastr.error(response.message || 'Không thể xóa module', 'Lỗi');
                    }
                },
                error: function (xhr) {
                    console.error('Error deleting module:', xhr);
                    toastr.error('Có lỗi xảy ra khi xóa module', 'Lỗi');
                },
                complete: function () {
                    isSubmitting = false;
                    $btn.prop('disabled', false).text('Xóa chức năng');
                    deleteId = null;
                }
            });
        });
    }

    // ── Init ──────────────────────────────────────────────────────────────

    $(document).ready(function () {
        bindEvents();

        // Re-bind after partial search
        $(document).on('quickSearchComplete', function () {
            // Re-binding is handled by $(document).on approach above
        });
    });

}());
