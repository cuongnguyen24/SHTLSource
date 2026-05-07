/**
 * Enterprise Account Management JavaScript
 */
(function () {
    'use strict';

    let deleteId = null;
    let deleteName = '';

    $(document).ready(function () {
        initializeEventHandlers();
    });

    /**
     * Reload the list by submitting the search form (if exists)
     * Or redirect to Index (if on details page)
     */
    function reloadList() {
        const form = $('#frmEnterpriseAccount');
        if (form.length > 0) {
            form.trigger('submit');
        } else {
            // If on details page, go back to list
            window.location.href = '/EnterpriseAccount/Index';
        }
    }

    /**
     * Initialize event handlers
     */
    function initializeEventHandlers() {
        // Delete button confirmation
        $(document).on('click', '.btn-delete-account', function (e) {
            e.preventDefault();
            const btn = $(this);
            deleteId = btn.data('id');
            deleteName = btn.data('name');
            
            $('#deleteItemName').text(deleteName);
            $('#deleteModal').modal('show');
        });

        // Specific handler for details page trash button
        $(document).on('click', '[data-target="#deleteModal"]', function() {
             // deleteId already set via data-id on the confirm button in details page
             // or we can set it here if needed
        });

        // Confirm delete
        $(document).on('click', '#btnConfirmDelete', function () {
            // Try to get ID from data attribute (set in Details page) or local variable (set in List page)
            const id = $(this).data('id') || deleteId;
            if (!id) return;

            const $btn = $(this);
            const originalHtml = $btn.html();
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');

            const token = $('input[name="__RequestVerificationToken"]').val();

            $.ajax({
                url: `/EnterpriseAccount/Delete?enterpriseId=${id}`,
                type: 'POST',
                headers: { 'RequestVerificationToken': token },
                success: function (response) {
                    $('#deleteModal').modal('hide');
                    if (response && response.isSuccess) {
                        toastr.success(response.message || 'Xóa thành công', 'Thành công');
                        reloadList();
                    } else {
                        toastr.error(response.message || 'Có lỗi xảy ra', 'Lỗi');
                    }
                },
                error: function (xhr) {
                    $('#deleteModal').modal('hide');
                    toastr.error('Có lỗi xảy ra khi xóa tài khoản. Vui lòng thử lại.', 'Lỗi');
                },
                complete: function() {
                    $btn.prop('disabled', false).html(originalHtml);
                }
            });
        });
    }

})();
