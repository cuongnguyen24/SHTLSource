/**
 * Shelves Management JavaScript
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
        $('#frmShelf').trigger('submit');
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

    // --- Load Warehouses for Select2 ---
    function initSelect2() {
        $.ajax({
            url: '/Shelves/GetWarehouses',
            type: 'GET',
            success: function (data) {
                let options = '<option value="">-- Chọn kho hàng --</option>';
                data.forEach(item => {
                    options += `<option value="${item.id}">${item.name}</option>`;
                });
                $('#warehouseId').html(options).select2({
                    theme: 'bootstrap4',
                    dropdownParent: $('#shelfModal')
                });
            }
        });
    }

    // --- CRUD Actions ---

    // Add button
    $(document).on('click', '#btnAddShelf', function () {
        resetForm();
        $('#modalTitle').html('<i class="fas fa-layer-group mr-2"></i>Thêm mới Giá kệ');
        $('#shelfModal').modal('show');
    });

    // Edit button
    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        $.ajax({
            url: '/Shelves/Get/' + id,
            type: 'GET',
            success: function (data) {
                resetForm();
                $('#shelfId').val(data.id);
                $('#code').val(data.code);
                $('#name').val(data.name);
                $('#description').val(data.description);
                if (data.warehouseId) {
                    $('#warehouseId').val(data.warehouseId).trigger('change');
                }

                $('#modalTitle').html('<i class="fas fa-layer-group mr-2"></i>Chỉnh sửa Giá kệ');
                $('#shelfModal').modal('show');
            },
            error: function () { toastr.error('Không thể tải thông tin kệ'); }
        });
    });

    // Save button
    $(document).on('click', '#btnSaveShelf', function () {
        if (isSubmitting) return;
        if (!validateForm()) return;

        const id = $('#shelfId').val();
        const data = {
            code: $('#code').val().trim(),
            name: $('#name').val().trim(),
            warehouseId: $('#warehouseId').val(),
            description: $('#description').val() || "",
            isActive: true
        };

        const url = id ? '/Shelves/Update/' + id : '/Shelves/Create';
        const method = id ? 'PUT' : 'POST';

        isSubmitting = true;
        $('#btnSaveShelf').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        $.ajax({
            url: url, type: method, contentType: 'application/json', data: JSON.stringify(data),
            success: function (res) {
                if (res.isSuccess) {
                    toastr.success(res.message || 'Lưu thành công');
                    $('#shelfModal').modal('hide');
                    reloadList();
                } else { toastr.error(res.message || 'Có lỗi xảy ra'); }
            },
            complete: function () {
                isSubmitting = false;
                $('#btnSaveShelf').prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu');
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
        $('#deleteItemName').text(selectedIds.length + ' kệ đã chọn');
        $('#deleteModal').modal('show');
    });

    // Confirm delete
    $(document).on('click', '#btnConfirmDelete', function () {
        const url = isBulkDelete ? '/Shelves/DeleteMultiple' : '/Shelves/Delete/' + deleteId;
        const method = 'DELETE';

        $(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>');

        $.ajax({
            url: url, type: method, contentType: isBulkDelete ? 'application/json' : undefined,
            data: isBulkDelete ? JSON.stringify(deleteId) : null,
            success: function (res) {
                if (res.isSuccess) {
                    toastr.success('Xóa thành công');
                    $('#deleteModal').modal('hide');
                    selectedIds = [];
                    updateBulkDeleteBtn();
                    reloadList();
                } else { toastr.error(res.message || 'Không thể xóa'); }
            },
            complete: function () {
                $('#btnConfirmDelete').prop('disabled', false).html('<i class="fas fa-trash mr-1"></i> Xóa');
            }
        });
    });

    // --- Helpers ---
    function resetForm() {
        $('#shelfForm')[0].reset();
        $('#shelfId').val('');
        $('#warehouseId').val('').trigger('change');
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
    }

    function validateForm() {
        let isValid = true;
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
        if (!$('#code').val().trim()) { showError('#code', 'Mã kệ là bắt buộc'); isValid = false; }
        if (!$('#name').val().trim()) { showError('#name', 'Tên kệ là bắt buộc'); isValid = false; }
        if (!$('#warehouseId').val()) { 
            toastr.warning('Vui lòng chọn kho hàng');
            isValid = false; 
        }
        return isValid;
    }

    function showError(selector, message) {
        const $el = $(selector);
        $el.addClass('is-invalid');
        $el.after(`<div class="invalid-feedback">${message}</div>`);
    }

    // --- Initialization ---
    $(document).ready(function () {
        initSelect2();
        bindCheckboxEvents();
        $(document).on('quickSearchComplete', function () {
            selectedIds = [];
            updateBulkDeleteBtn();
            bindCheckboxEvents();
        });
    });

})();
