/**
 * Departments Management JavaScript
 * Pattern: Server-side rendering with Partial View
 */
(function () {
    'use strict';

    let deleteId = null;
    let isBulkDelete = false;
    let selectedIds = [];
    let isSubmitting = false;
    let activeDepartments = [];

    // --- Reload list helper ---
    function reloadList() {
        $('#frmDepartment').trigger('submit');
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

    // --- Select2 & Dropdown Logic ---
    function loadActiveDepartments(callback) {
        $.ajax({
            url: '/Departments/GetActive',
            type: 'GET',
            success: function (data) {
                activeDepartments = data.$values || data || [];
                populateParentDropdown();
                if (callback) callback();
            }
        });
    }

    function populateParentDropdown(excludeId = null) {
        const $select = $('#parentId');
        $select.empty();
        $select.append('<option value="">-- Không có (Gốc) --</option>');

        activeDepartments.forEach(function (dept) {
            if (excludeId && dept.id === excludeId) return;
            if (dept.level >= 10) return;
            $select.append(`<option value="${dept.id}" data-level="${dept.level}">${dept.name} (Cấp ${dept.level})</option>`);
        });
        
        // Refresh Select2 if initialized
        if ($select.hasClass('select2-hidden-accessible')) {
            $select.trigger('change.select2');
        }
    }

    // Auto calculate level based on parent
    $(document).on('change', '#parentId', function () {
        const $option = $(this).find('option:selected');
        const parentLevel = $option.data('level');
        if (parentLevel !== undefined && $(this).val() !== "") {
            $('#level').val(parseInt(parentLevel) + 1);
        } else {
            $('#level').val(1);
        }
    });

    // --- CRUD Actions ---

    // Add button
    $(document).on('click', '#btnAddDepartment', function () {
        resetForm();
        $('#modalTitle').html('<i class="fas fa-sitemap mr-2"></i>Thêm mới Phòng ban');
        $('#code').prop('readonly', false);
        loadActiveDepartments(() => {
            $('#departmentModal').modal('show');
        });
    });

    // Edit button
    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        $.ajax({
            url: '/Departments/Get/' + id,
            type: 'GET',
            success: function (data) {
                resetForm();
                $('#departmentId').val(data.id);
                $('#code').val(data.code).prop('readonly', false);
                $('#name').val(data.name);
                $('#head').val(data.head);
                $('#phone').val(data.phone);
                $('#email').val(data.email);
                $('#description').val(data.description);
                $('#displayOrder').val(data.displayOrder);
                $('#isActive').prop('checked', data.isActive);

                loadActiveDepartments(() => {
                    $('#parentId').val(data.parentId || '').trigger('change.select2');
                    $('#level').val(data.level);
                    $('#modalTitle').html('<i class="fas fa-sitemap mr-2"></i>Chỉnh sửa Phòng ban');
                    $('#departmentModal').modal('show');
                });
            }
        });
    });

    // Save button
    $(document).on('click', '#btnSaveDepartment', function () {
        if (isSubmitting) return;
        if (!validateForm()) return;

        const id = $('#departmentId').val();
        const data = {
            id: id || null,
            code: $('#code').val().trim(),
            name: $('#name').val().trim(),
            parentId: $('#parentId').val() || null,
            level: parseInt($('#level').val()),
            head: $('#head').val() || null,
            phone: $('#phone').val() || null,
            email: $('#email').val() || null,
            description: $('#description').val() || null,
            displayOrder: parseInt($('#displayOrder').val()),
            isActive: $('#isActive').is(':checked')
        };

        const url = id ? '/Departments/Update/' + id : '/Departments/Create';
        const method = id ? 'PUT' : 'POST';

        isSubmitting = true;
        $('#btnSaveDepartment').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        $.ajax({
            url: url,
            type: method,
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(response.message || 'Lưu thành công');
                    $('#departmentModal').modal('hide');
                    reloadList();
                } else {
                    toastr.error(response.message || 'Có lỗi xảy ra');
                }
            },
            complete: function () {
                isSubmitting = false;
                $('#btnSaveDepartment').prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu');
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
        $('#deleteItemName').text(selectedIds.length + ' phòng ban đã chọn');
        $('#deleteModal').modal('show');
    });

    // Confirm delete
    $(document).on('click', '#btnConfirmDelete', function () {
        const url = isBulkDelete ? '/Departments/DeleteMultiple' : '/Departments/Delete/' + deleteId;
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
        $('#departmentForm')[0].reset();
        $('#departmentId').val('');
        $('#isActive').prop('checked', true);
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
        $('#parentId').val('').trigger('change.select2');
    }

    function validateForm() {
        let isValid = true;
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();

        if (!$('#code').val().trim()) { showError('#code', 'Mã phòng ban là bắt buộc'); isValid = false; }
        if (!$('#name').val().trim()) { showError('#name', 'Tên phòng ban là bắt buộc'); isValid = false; }
        
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

        // Advanced filter Select2
        if ($.fn.select2) {
            $('.select2-filter').select2({
                theme: 'bootstrap4',
                width: '100%',
                allowClear: true
            });
        }

        // Handle quick search complete
        $(document).on('quickSearchComplete', function () {
            selectedIds = [];
            updateBulkDeleteBtn();
            bindCheckboxEvents();
        });
    });

})();
