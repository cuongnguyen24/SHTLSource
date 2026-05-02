/**
 * Industry Codes Management JavaScript
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
        $('#frmIndustryCode').trigger('submit');
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
    $(document).on('click', '#btnAddIndustryCode', function () {
        resetForm();
        $('#modalTitle').html('<i class="fas fa-chart-line mr-2"></i>Thêm mới Ngành kinh tế');
        $('#industryCodeModal').modal('show');
    });

    // Edit button
    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        $.ajax({
            url: '/IndustryCodes/Get/' + id,
            type: 'GET',
            success: function (data) {
                resetForm();
                $('#industryCodeId').val(data.id);
                $('#code').val(data.code);
                $('#name').val(data.name);
                $('#level').val(data.level).trigger('change.select2');
                $('#displayOrder').val(data.displayOrder);
                $('#description').val(data.description);
                $('#isActive').prop('checked', data.isActive);

                $('#modalTitle').html('<i class="fas fa-chart-line mr-2"></i>Chỉnh sửa Ngành kinh tế');
                $('#industryCodeModal').modal('show');
            },
            error: function () {
                toastr.error('Không thể tải thông tin ngành kinh tế');
            }
        });
    });

    // Save button
    $(document).on('click', '#btnSaveIndustryCode', function () {
        if (isSubmitting) return;
        if (!validateForm()) return;

        const id = $('#industryCodeId').val();
        const data = {
            code: $('#code').val().trim(),
            name: $('#name').val().trim(),
            level: parseInt($('#level').val()),
            displayOrder: parseInt($('#displayOrder').val()) || 1,
            description: $('#description').val() || null,
            isActive: $('#isActive').prop('checked')
        };

        const url = id ? '/IndustryCodes/Update/' + id : '/IndustryCodes/Create';
        const method = id ? 'PUT' : 'POST';

        isSubmitting = true;
        $('#btnSaveIndustryCode').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        $.ajax({
            url: url,
            type: method,
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(response.message || 'Lưu thành công');
                    $('#industryCodeModal').modal('hide');
                    reloadList();
                } else {
                    toastr.error(response.message || 'Có lỗi xảy ra');
                }
            },
            complete: function () {
                isSubmitting = false;
                $('#btnSaveIndustryCode').prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu');
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
        $('#deleteItemName').text(selectedIds.length + ' ngành kinh tế đã chọn');
        $('#deleteModal').modal('show');
    });

    // Confirm delete
    $(document).on('click', '#btnConfirmDelete', function () {
        const url = isBulkDelete ? '/IndustryCodes/DeleteMultiple' : '/IndustryCodes/Delete/' + deleteId;
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
        $('#industryCodeForm')[0].reset();
        $('#industryCodeId').val('');
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
        if ($.fn.select2) {
            $('.select2-modern').val('').trigger('change.select2');
        }
    }

    function validateForm() {
        let isValid = true;
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();

        if (!$('#code').val().trim()) { showError('#code', 'Mã ngành là bắt buộc'); isValid = false; }
        if (!$('#name').val().trim()) { showError('#name', 'Tên ngành là bắt buộc'); isValid = false; }
        if (!$('#level').val()) { showError('#level', 'Vui lòng chọn cấp'); isValid = false; }
        
        return isValid;
    }

    function showError(selector, message) {
        const $el = $(selector);
        $el.addClass('is-invalid');
        if ($el.next('.select2-container').length) {
            $el.next('.select2-container').after(`<div class="invalid-feedback d-block">${message}</div>`);
        } else {
            $el.after(`<div class="invalid-feedback">${message}</div>`);
        }
    }

    // --- Initialization ---
    $(document).ready(function () {
        bindCheckboxEvents();

        if ($.fn.select2) {
            $('.select2-modern').select2({
                theme: 'bootstrap4',
                width: '100%',
                dropdownParent: $('#industryCodeModal')
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
