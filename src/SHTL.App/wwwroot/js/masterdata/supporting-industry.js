/**
 * Supporting Industry Management JavaScript
 * Pattern: server-side search/pagination via quickSearch form → _SupportingIndustries partial
 */
(function () {
    'use strict';

    let deleteId = null;
    let isBulkDelete = false;
    let selectedIds = [];
    let isSubmitting = false;

    // ── Reload helpers ────────────────────────────────────────────────────

    function reloadList() {
        $('#frmSupportingIndustry').trigger('submit');
    }

    // ── Checkbox & Bulk Delete ────────────────────────────────────────────

    function updateBulkDeleteBtn() {
        const $btn = $('#btnBulkDelete');
        if ($btn.length === 0) return;
        const count = selectedIds.length;
        $('#selectedCount').text(count);
        count > 0 ? $btn.fadeIn(200) : $btn.fadeOut(200);
    }

    function bindCheckboxEvents() {
        // Select-all (re-bind because partial is replaced on every search)
        $(document).off('change', '#selectAllCheckbox').on('change', '#selectAllCheckbox', function () {
            const isChecked = $(this).prop('checked');
            $('.row-checkbox').prop('checked', isChecked);
            selectedIds = [];
            if (isChecked) {
                $('.row-checkbox').each(function () { selectedIds.push($(this).val()); });
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

    // ── Add button ────────────────────────────────────────────────────────

    $(document).on('click', '#btnAddSupportingIndustry', function () {
        resetForm();
        $('#modalTitle').html('<i class="fas fa-cogs mr-2"></i>Thêm mới Danh mục Công nghiệp Hỗ trợ');
        $('#code').prop('readonly', false);
        $('#supportingIndustryCategoryModal').modal('show');
    });

    // ── Edit button ───────────────────────────────────────────────────────

    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        $.ajax({
            url: '/SupportingIndustry/Details/' + id,
            type: 'GET',
            success: function (data) {
                $('.is-invalid').removeClass('is-invalid');
                $('.invalid-feedback').remove();

                $('#supportingIndustryCategoryId').val(data.id);
                $('#code').val(data.code).prop('readonly', false);
                $('#name').val(data.name);
                $('#description').val(data.description || '');
                $('#displayOrder').val(data.displayOrder);

                $('#modalTitle').html('<i class="fas fa-cogs mr-2"></i>Chỉnh sửa Danh mục Công nghiệp Hỗ trợ');
                $('#supportingIndustryCategoryModal').modal('show');
            },
            error: function (xhr) {
                console.error('Error loading supporting industry details:', xhr);
                toastr.error('Không thể tải thông tin danh mục', 'Lỗi');
            }
        });
    });

    // ── Save button ───────────────────────────────────────────────────────

    $(document).on('click', '#btnSaveSupportingIndustryCategory', function () {
        if (isSubmitting) return;
        if (!validateForm()) return;

        const id = $('#supportingIndustryCategoryId').val();
        const data = {
            code: $('#code').val().trim(),
            name: $('#name').val().trim(),
            description: $('#description').val().trim() || null,
            displayOrder: parseInt($('#displayOrder').val())
        };

        const url = id
            ? '/SupportingIndustry/Update/' + id
            : '/SupportingIndustry/Create';

        isSubmitting = true;
        $('#btnSaveSupportingIndustryCategory').prop('disabled', true)
            .html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        const token = $('input[name="__RequestVerificationToken"]').val();

        $.ajax({
            url: url,
            type: 'POST',
            contentType: 'application/json',
            headers: { 'RequestVerificationToken': token },
            data: JSON.stringify(data),
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(response.message || 'Lưu thành công', 'Thành công');
                    $('#supportingIndustryCategoryModal').modal('hide');
                    selectedIds = [];
                    reloadList();
                } else {
                    if (response.errors && response.errors.length > 0) {
                        response.errors.forEach(function (err) { toastr.error(err, 'Lỗi'); });
                    } else {
                        toastr.error(response.message || 'Có lỗi xảy ra', 'Lỗi');
                    }
                }
            },
            error: function (xhr) {
                console.error('Error saving supporting industry:', xhr);
                if (xhr.responseJSON) {
                    if (xhr.responseJSON.errors && Array.isArray(xhr.responseJSON.errors) && xhr.responseJSON.errors.length > 0) {
                        xhr.responseJSON.errors.forEach(function (err) {
                            toastr.error(err, 'Lỗi', { timeOut: 5000, closeButton: true, progressBar: true });
                        });
                        return;
                    }
                    if (xhr.status === 400 && xhr.responseJSON.errors && !Array.isArray(xhr.responseJSON.errors)) {
                        const errors = xhr.responseJSON.errors;
                        const msgs = [];
                        for (const key in errors) { msgs.push(...errors[key]); }
                        toastr.error(msgs.join('<br>'), 'Lỗi nhập liệu');
                        return;
                    }
                    if (xhr.responseJSON.message) { toastr.error(xhr.responseJSON.message, 'Lỗi'); return; }
                }
                toastr.error('Có lỗi xảy ra khi lưu danh mục công nghiệp hỗ trợ', 'Lỗi');
            },
            complete: function () {
                isSubmitting = false;
                $('#btnSaveSupportingIndustryCategory').prop('disabled', false)
                    .html('<i class="fas fa-save mr-1"></i> Lưu');
            }
        });
    });

    // ── Delete single ─────────────────────────────────────────────────────

    $(document).on('click', '.btn-delete', function () {
        isBulkDelete = false;
        deleteId = $(this).data('id');
        $('#deleteItemName').text($(this).data('name'));
        $('#deleteModal').modal('show');
    });

    // ── Bulk delete ───────────────────────────────────────────────────────

    $(document).on('click', '#btnBulkDelete', function () {
        if (selectedIds.length === 0) return;
        isBulkDelete = true;
        deleteId = selectedIds;
        $('#deleteItemName').text(selectedIds.length + ' danh mục công nghiệp hỗ trợ đã chọn');
        $('#deleteModal').modal('show');
    });

    // ── Confirm delete ────────────────────────────────────────────────────

    $(document).on('click', '#btnConfirmDelete', function () {
        if (!deleteId || (isBulkDelete && deleteId.length === 0)) return;

        $('#btnConfirmDelete').prop('disabled', true)
            .html('<i class="fas fa-spinner fa-spin mr-1"></i> Xóa');

        const url = isBulkDelete
            ? '/SupportingIndustry/DeleteMultiple'
            : '/SupportingIndustry/Delete/' + deleteId;
        const method = 'DELETE';
        const body = isBulkDelete ? JSON.stringify(deleteId) : null;
        const token = $('input[name="__RequestVerificationToken"]').val();

        $.ajax({
            url: url,
            type: method,
            contentType: isBulkDelete ? 'application/json' : undefined,
            headers: { 'RequestVerificationToken': token },
            data: body,
            success: function (response) {
                if (response && response.isSuccess) {
                    toastr.success(
                        isBulkDelete
                            ? 'Xóa nhiều danh mục công nghiệp hỗ trợ thành công'
                            : (response.message || 'Xóa thành công'),
                        'Thành công'
                    );
                    $('#deleteModal').modal('hide');
                    selectedIds = [];
                    reloadList();
                } else {
                    if (response?.errors && response.errors.length > 0) {
                        response.errors.forEach(function (err) { toastr.error(err, 'Lỗi'); });
                    } else {
                        toastr.error(response?.message || 'Có lỗi xảy ra', 'Lỗi');
                    }
                }
            },
            error: function (xhr) {
                console.error('Error deleting supporting industry:', xhr);
                let msg = 'Có lỗi xảy ra khi xóa';
                if (xhr.responseJSON?.message) msg = xhr.responseJSON.message;
                toastr.error(msg, 'Lỗi');
            },
            complete: function () {
                $('#btnConfirmDelete').prop('disabled', false)
                    .html('<i class="fas fa-trash mr-1"></i> Xóa');
                isBulkDelete = false;
                deleteId = null;
            }
        });
    });

    // ── Form helpers ──────────────────────────────────────────────────────

    function resetForm() {
        $('#supportingIndustryCategoryForm')[0].reset();
        $('#supportingIndustryCategoryId').val('');
        $('#displayOrder').val(1);
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
    }

    function validateForm() {
        let isValid = true;
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();

        const code = $('#code').val().trim();
        if (!code) { showError('#code', 'Mã danh mục là bắt buộc'); isValid = false; }

        const name = $('#name').val().trim();
        if (!name) { showError('#name', 'Tên danh mục là bắt buộc'); isValid = false; }

        const displayOrder = $('#displayOrder').val();
        if (!displayOrder || displayOrder < 1) {
            showError('#displayOrder', 'Thứ tự hiển thị phải lớn hơn 0');
            isValid = false;
        }

        return isValid;
    }

    function showError(selector, message) {
        const $field = $(selector);
        $field.addClass('is-invalid');
        $field.after('<div class="invalid-feedback" style="display: block;">' + message + '</div>');
    }

    // ── Init ──────────────────────────────────────────────────────────────

    $(document).ready(function () {
        bindCheckboxEvents();

        // Re-bind after each partial reload triggered by quickSearch
        $(document).on('quickSearchComplete', function () {
            selectedIds = [];
            updateBulkDeleteBtn();
            bindCheckboxEvents();
        });
    });
}());
