/**
 * Operational Statuses Management JavaScript
 * Pattern: Server-side rendering with Partial View
 */
(function () {
    'use strict';

    let deleteId = null;
    let isBulkDelete = false;
    let selectedIds = [];
    let isSubmitting = false;

    // --- Reload list helper ---
    function reloadList() {
        $('#frmOperationalStatus').trigger('submit');
    }

    // --- Checkbox & Bulk Delete ---
    function updateBulkDeleteBtn() {
        const $btn = $('#btnBulkDelete');
        if ($btn.length === 0) return;
        const count = selectedIds.length;
        $('#selectedCount').text(count);
        if (count > 0) {
            $btn.fadeIn(200);
        } else {
            $btn.fadeOut(200);
        }
    }

    function bindCheckboxEvents() {
        $(document).off('change', '#selectAllCheckbox').on('change', '#selectAllCheckbox', function () {
            const isChecked = $(this).prop('checked');
            $('.row-checkbox').prop('checked', isChecked);
            selectedIds = [];
            if (isChecked) {
                $('.row-checkbox').each(function () {
                    selectedIds.push($(this).val());
                });
            }
            updateBulkDeleteBtn();
        });

        $(document).off('change', '.row-checkbox').on('change', '.row-checkbox', function () {
            const id = $(this).val();
            if ($(this).prop('checked')) {
                if (!selectedIds.includes(id)) selectedIds.push(id);
            } else {
                selectedIds = selectedIds.filter(x => x !== id);
            }
            const allChecked = $('.row-checkbox').length === selectedIds.length && selectedIds.length > 0;
            $('#selectAllCheckbox').prop('checked', allChecked);
            updateBulkDeleteBtn();
        });
    }

    // --- CRUD Actions ---

    // Add button
    $(document).on('click', '#btnAddOperationalStatus', function () {
        resetForm();
        $('#modalTitle').html('<i class="fas fa-toggle-on mr-2"></i>Thêm mới Trạng thái Hoạt động');
        $('#operationalStatusModal').modal('show');
    });

    // Edit button
    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        $.ajax({
            url: '/OperationalStatuses/Get/' + id,
            type: 'GET',
            success: function (data) {
                resetForm();
                $('#operationalStatusId').val(data.id);
                $('#code').val(data.code);
                $('#name').val(data.name);
                $('#displayOrder').val(data.displayOrder);
                $('#description').val(data.description);

                $('#modalTitle').html('<i class="fas fa-toggle-on mr-2"></i>Chỉnh sửa Trạng thái Hoạt động');
                $('#operationalStatusModal').modal('show');
            },
            error: function () {
                toastr.error('Không thể tải thông tin trạng thái');
            }
        });
    });

    // Save button
    $(document).on('click', '#btnSaveOperationalStatus', function () {
        if (isSubmitting) return;
        if (!validateForm()) return;

        const id = $('#operationalStatusId').val();
        const data = {
            code: $('#code').val().trim(),
            name: $('#name').val().trim(),
            displayOrder: parseInt($('#displayOrder').val()) || 1,
            description: $('#description').val() || null
        };

        const url = id ? '/OperationalStatuses/Update/' + id : '/OperationalStatuses/Create';
        const method = id ? 'PUT' : 'POST';

        isSubmitting = true;
        $('#btnSaveOperationalStatus').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        $.ajax({
            url: url,
            type: method,
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(response.message || 'Lưu thành công');
                    $('#operationalStatusModal').modal('hide');
                    reloadList();
                } else {
                    toastr.error(response.message || 'Có lỗi xảy ra');
                }
            },
            complete: function () {
                isSubmitting = false;
                $('#btnSaveOperationalStatus').prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu');
            }
        });
    });

    // Delete single
    $(document).on('click', '.btn-delete', function () {
        isBulkDelete = false;
        deleteId = $(this).data('id');
        $('#deleteItemName').text($(this).data('name'));
        $('#deleteModal').modal('show');
    });

    // Bulk delete callback
    $(document).on('click', '#btnBulkDelete', function () {
        if (selectedIds.length === 0) return;
        isBulkDelete = true;
        deleteId = selectedIds;
        $('#deleteItemName').text(selectedIds.length + ' trạng thái đã chọn');
        $('#deleteModal').modal('show');
    });

    // Confirm delete
    $(document).on('click', '#btnConfirmDelete', function () {
        const url = isBulkDelete ? '/OperationalStatuses/DeleteMultiple' : '/OperationalStatuses/Delete/' + deleteId;
        const method = 'DELETE';
        const data = isBulkDelete ? JSON.stringify(deleteId) : null;

        $(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Xóa');

        $.ajax({
            url: url,
            type: method,
            contentType: isBulkDelete ? 'application/json' : undefined,
            data: data,
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success('Xóa thành công');
                    $('#deleteModal').modal('hide');
                    selectedIds = [];
                    updateBulkDeleteBtn();
                    reloadList();
                } else {
                    toastr.error(response.message || 'Không thể xóa');
                }
            },
            complete: function () {
                $('#btnConfirmDelete').prop('disabled', false).html('<i class="fas fa-trash mr-1"></i> Xóa');
            }
        });
    });

    // --- Helpers ---
    function resetForm() {
        $('#operationalStatusForm')[0].reset();
        $('#operationalStatusId').val('');
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
    }

    function validateForm() {
        let isValid = true;
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();

        if (!$('#code').val().trim()) { showError('#code', 'Mã trạng thái là bắt buộc'); isValid = false; }
        if (!$('#name').val().trim()) { showError('#name', 'Tên trạng thái là bắt buộc'); isValid = false; }
        
        return isValid;
    }

    function showError(selector, message) {
        const $el = $(selector);
        $el.addClass('is-invalid');
        $el.after(`<div class="invalid-feedback">${message}</div>`);
    }

    // --- Initialization ---
    $(document).ready(function () {
        bindCheckboxEvents();

        // Handle quick search complete
        $(document).on('quickSearchComplete', function () {
            selectedIds = [];
            updateBulkDeleteBtn();
            bindCheckboxEvents();
        });
    });

})();
