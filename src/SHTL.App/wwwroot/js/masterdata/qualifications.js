/**
 * Qualifications Management JavaScript
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
        $('#frmQualification').trigger('submit');
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
    $(document).on('click', '#btnAddQualification', function () {
        resetForm();
        $('#modalTitle').html('<i class="fas fa-graduation-cap mr-2"></i>Thêm mới Trình độ');
        $('#code').prop('readonly', false);
        $('#qualificationModal').modal('show');
    });

    // Edit button
    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        $.ajax({
            url: '/Qualifications/Get/' + id,
            type: 'GET',
            success: function (data) {
                resetForm();
                $('#qualificationId').val(data.id);
                $('#code').val(data.code).prop('readonly', false);
                $('#name').val(data.name);
                $('#type').val(data.type).trigger('change.select2');
                $('#level').val(data.level);
                $('#description').val(data.description);
                $('#displayOrder').val(data.displayOrder);
                $('#isActive').prop('checked', data.isActive);

                $('#modalTitle').html('<i class="fas fa-graduation-cap mr-2"></i>Chỉnh sửa Trình độ');
                $('#qualificationModal').modal('show');
            },
            error: function () {
                toastr.error('Không thể tải thông tin trình độ');
            }
        });
    });

    // Save button
    $(document).on('click', '#btnSaveQualification', function () {
        if (isSubmitting) return;
        if (!validateForm()) return;

        const id = $('#qualificationId').val();
        const data = {
            code: $('#code').val().trim(),
            name: $('#name').val().trim(),
            type: $('#type').val(),
            level: parseInt($('#level').val()),
            description: $('#description').val() || null,
            displayOrder: parseInt($('#displayOrder').val()),
            isActive: $('#isActive').is(':checked')
        };

        const url = id ? '/Qualifications/Update/' + id : '/Qualifications/Create';
        const method = id ? 'PUT' : 'POST';

        isSubmitting = true;
        $('#btnSaveQualification').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        $.ajax({
            url: url,
            type: method,
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(response.message || 'Lưu thành công');
                    $('#qualificationModal').modal('hide');
                    reloadList();
                } else {
                    toastr.error(response.message || 'Có lỗi xảy ra');
                }
            },
            complete: function () {
                isSubmitting = false;
                $('#btnSaveQualification').prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu');
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
        $('#deleteItemName').text(selectedIds.length + ' trình độ đã chọn');
        $('#deleteModal').modal('show');
    });

    // Confirm delete
    $(document).on('click', '#btnConfirmDelete', function () {
        const url = isBulkDelete ? '/Qualifications/DeleteMultiple' : '/Qualifications/Delete/' + deleteId;
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
        $('#qualificationForm')[0].reset();
        $('#qualificationId').val('');
        $('#isActive').prop('checked', true);
        $('#displayOrder').val(1);
        $('#level').val(1);
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
        if ($.fn.select2) {
            $('#type').val('').trigger('change.select2');
        }
    }

    function validateForm() {
        let isValid = true;
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();

        if (!$('#code').val().trim()) { showError('#code', 'Mã trình độ là bắt buộc'); isValid = false; }
        if (!$('#name').val().trim()) { showError('#name', 'Tên trình độ là bắt buộc'); isValid = false; }
        if (!$('#type').val()) { showError('#type', 'Vui lòng chọn loại trình độ'); isValid = false; }
        
        return isValid;
    }

    function showError(selector, message) {
        const $el = $(selector);
        $el.addClass('is-invalid');
        // If Select2
        if ($el.next('.select2-container').length) {
            $el.next('.select2-container').after(`<div class="invalid-feedback d-block">${message}</div>`);
        } else {
            $el.after(`<div class="invalid-feedback">${message}</div>`);
        }
    }

    // --- Initialization ---
    $(document).ready(function () {
        bindCheckboxEvents();

        // Select2 Initialization
        if ($.fn.select2) {
            $('.select2-modern').select2({
                theme: 'bootstrap4',
                width: '100%',
                dropdownParent: $('#qualificationModal')
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
