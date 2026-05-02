/**
 * Warehouses Management JavaScript
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
        $('#frmWarehouse').trigger('submit');
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

    // --- Load Departments for Select2 ---
    function initSelect2() {
        $.ajax({
            url: '/Warehouses/GetDepartments',
            type: 'GET',
            success: function (data) {
                let options = '<option value="">-- Chọn phòng ban --</option>';
                data.forEach(item => {
                    options += `<option value="${item.id}">${item.name}</option>`;
                });
                $('#departmentId').html(options).select2({
                    theme: 'bootstrap4',
                    dropdownParent: $('#warehouseModal')
                });
            }
        });
    }

    // --- CRUD Actions ---

    // Add button
    $(document).on('click', '#btnAddWarehouse', function () {
        resetForm();
        $('#modalTitle').html('<i class="fas fa-warehouse mr-2"></i>Thêm mới Kho');
        $('#warehouseModal').modal('show');
    });

    // Edit button
    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        $.ajax({
            url: '/Warehouses/Get/' + id,
            type: 'GET',
            success: function (data) {
                resetForm();
                $('#warehouseId').val(data.id);
                $('#code').val(data.code);
                $('#name').val(data.name);
                $('#description').val(data.description);
                if (data.departmentId) {
                    $('#departmentId').val(data.departmentId).trigger('change');
                }

                $('#modalTitle').html('<i class="fas fa-warehouse mr-2"></i>Chỉnh sửa Kho');
                $('#warehouseModal').modal('show');
            },
            error: function () { toastr.error('Không thể tải thông tin kho'); }
        });
    });

    // Save button
    $(document).on('click', '#btnSaveWarehouse', function () {
        if (isSubmitting) return;
        if (!validateForm()) return;

        const id = $('#warehouseId').val();
        const data = {
            code: $('#code').val().trim(),
            name: $('#name').val().trim(),
            description: $('#description').val() || "",
            departmentId: $('#departmentId').val() || null,
            isActive: true
        };

        const url = id ? '/Warehouses/Update/' + id : '/Warehouses/Create';
        const method = id ? 'PUT' : 'POST';

        isSubmitting = true;
        $('#btnSaveWarehouse').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        $.ajax({
            url: url, type: method, contentType: 'application/json', data: JSON.stringify(data),
            success: function (res) {
                if (res.isSuccess) {
                    toastr.success(res.message || 'Lưu thành công');
                    $('#warehouseModal').modal('hide');
                    reloadList();
                } else { toastr.error(res.message || 'Có lỗi xảy ra'); }
            },
            complete: function () {
                isSubmitting = false;
                $('#btnSaveWarehouse').prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu');
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
        $('#deleteItemName').text(selectedIds.length + ' kho đã chọn');
        $('#deleteModal').modal('show');
    });

    // Confirm delete
    $(document).on('click', '#btnConfirmDelete', function () {
        const url = isBulkDelete ? '/Warehouses/DeleteMultiple' : '/Warehouses/Delete/' + deleteId;
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
        $('#warehouseForm')[0].reset();
        $('#warehouseId').val('');
        $('#departmentId').val('').trigger('change');
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
    }

    function validateForm() {
        let isValid = true;
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
        if (!$('#code').val().trim()) { showError('#code', 'Mã kho là bắt buộc'); isValid = false; }
        if (!$('#name').val().trim()) { showError('#name', 'Tên kho là bắt buộc'); isValid = false; }
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
