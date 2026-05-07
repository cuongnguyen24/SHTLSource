/**
 * Economic Sector Management JavaScript
 * Pattern: server-side search/pagination via quickSearch form → _EconomicSectors partial
 */
(function () {
    'use strict';

    let deleteId = null;
    let isBulkDelete = false;
    let selectedIds = [];
    let isSubmitting = false;

    // ── Reload helpers ────────────────────────────────────────────────────

    function reloadList() {
        $('#frmEconomicSector').trigger('submit');
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

    $(document).on('click', '#btnAddItem', function () {
        resetForm();
        $('#modalTitle').html('<i class="fas fa-chart-pie mr-2"></i>Thêm mới Thành phần Kinh tế');
        $('#code').prop('readonly', false);
        $('#itemModal').modal('show');
    });

    // ── Edit button ───────────────────────────────────────────────────────

    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        $.ajax({
            url: '/EconomicSectors/Details/' + id,
            type: 'GET',
            success: function (data) {
                $('.is-invalid').removeClass('is-invalid');
                $('.invalid-feedback').remove();

                $('#itemId').val(data.id);
                $('#code').val(data.code).prop('readonly', true);
                $('#name').val(data.name);
                $('#description').val(data.description || '');
                $('#displayOrder').val(data.displayOrder);

                $('#modalTitle').html('<i class="fas fa-chart-pie mr-2"></i>Chỉnh sửa Thành phần Kinh tế');
                $('#itemModal').modal('show');
            },
            error: function (xhr) {
                console.error('Error loading item details:', xhr);
                toastr.error('Không thể tải thông tin thành phần kinh tế', 'Lỗi');
            }
        });
    });

    // ── Save button ───────────────────────────────────────────────────────

    $(document).on('click', '#btnSaveItem', function () {
        if (isSubmitting) return;
        if (!validateForm()) return;

        const id = $('#itemId').val();
        const data = {
            code: $('#code').val().trim(),
            name: $('#name').val().trim(),
            description: $('#description').val().trim() || null,
            displayOrder: parseInt($('#displayOrder').val())
        };

        const url = id
            ? '/EconomicSectors/Update/' + id
            : '/EconomicSectors/Create';

        isSubmitting = true;
        $('#btnSaveItem').prop('disabled', true)
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
                    $('#itemModal').modal('hide');
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
                console.error('Error saving item:', xhr);
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
                toastr.error('Có lỗi xảy ra khi lưu thành phần kinh tế', 'Lỗi');
            },
            complete: function () {
                isSubmitting = false;
                $('#btnSaveItem').prop('disabled', false)
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
        $('#deleteItemName').text(selectedIds.length + ' mục đã chọn');
        $('#deleteModal').modal('show');
    });

    // ── Confirm delete ────────────────────────────────────────────────────

    $(document).on('click', '#btnConfirmDelete', function () {
        if (!deleteId || (isBulkDelete && deleteId.length === 0)) return;

        $('#btnConfirmDelete').prop('disabled', true)
            .html('<i class="fas fa-spinner fa-spin mr-1"></i> Xóa');

        const url = isBulkDelete
            ? '/EconomicSectors/DeleteMultiple'
            : '/EconomicSectors/Delete/' + deleteId;
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
                        response.message || 'Xóa thành công',
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
                console.error('Error deleting item:', xhr);
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
        $('#itemForm')[0].reset();
        $('#itemId').val('');
        $('#displayOrder').val(1);
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
    }

    function validateForm() {
        let isValid = true;
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();

        const code = $('#code').val().trim();
        if (!code) { showError('#code', 'Mã thành phần là bắt buộc'); isValid = false; }

        const name = $('#name').val().trim();
        if (!name) { showError('#name', 'Tên thành phần là bắt buộc'); isValid = false; }

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
