/**
 * Countries Management JavaScript
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
        $('#frmCountry').trigger('submit');
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
    $(document).on('click', '#btnAddCountry', function () {
        resetForm();
        $('#modalTitle').html('<i class="fas fa-flag mr-2"></i>Thêm mới Quốc gia');
        $('#code').prop('readonly', false);
        $('#countryModal').modal('show');
    });

    // Edit button
    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        $.ajax({
            url: '/Countries/Get/' + id,
            type: 'GET',
            success: function (data) {
                resetForm();
                $('#countryId').val(data.id);
                $('#code').val(data.code).prop('readonly', false);
                $('#name').val(data.name);
                $('#description').val(data.description);
                $('#displayOrder').val(data.displayOrder);
                $('#isActive').prop('checked', data.isActive);

                $('#modalTitle').html('<i class="fas fa-flag mr-2"></i>Chỉnh sửa Quốc gia');
                $('#countryModal').modal('show');
            },
            error: function () {
                toastr.error('Không thể tải thông tin quốc gia');
            }
        });
    });

    // Save button
    $(document).on('click', '#btnSaveCountry', function () {
        if (isSubmitting) return;
        if (!validateForm()) return;

        const id = $('#countryId').val();
        const data = {
            code: $('#code').val().trim().toUpperCase(),
            name: $('#name').val().trim(),
            description: $('#description').val() || null,
            displayOrder: parseInt($('#displayOrder').val()),
            isActive: $('#isActive').is(':checked')
        };

        const url = id ? '/Countries/Update/' + id : '/Countries/Create';
        const method = id ? 'PUT' : 'POST';

        isSubmitting = true;
        $('#btnSaveCountry').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        $.ajax({
            url: url,
            type: method,
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(response.message || 'Lưu thành công');
                    $('#countryModal').modal('hide');
                    reloadList();
                } else {
                    toastr.error(response.message || 'Có lỗi xảy ra');
                }
            },
            complete: function () {
                isSubmitting = false;
                $('#btnSaveCountry').prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu');
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
        $('#deleteItemName').text(selectedIds.length + ' quốc gia đã chọn');
        $('#deleteModal').modal('show');
    });

    // Confirm delete
    $(document).on('click', '#btnConfirmDelete', function () {
        const url = isBulkDelete ? '/Countries/DeleteMultiple' : '/Countries/Delete/' + deleteId;
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
        $('#countryForm')[0].reset();
        $('#countryId').val('');
        $('#isActive').prop('checked', true);
        $('#displayOrder').val(1);
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
    }

    function validateForm() {
        let isValid = true;
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();

        const codeVal = $('#code').val().trim();
        if (!codeVal) { 
            showError('#code', 'Mã ISO là bắt buộc'); 
            isValid = false; 
        } else if (codeVal.length !== 2) {
            showError('#code', 'Mã ISO phải có đúng 2 ký tự'); 
            isValid = false;
        }

        if (!$('#name').val().trim()) { showError('#name', 'Tên quốc gia là bắt buộc'); isValid = false; }
        
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

        // Auto uppercase for ISO code
        $(document).on('input', '#code', function() {
            this.value = this.value.toUpperCase();
        });

        // Handle quick search complete
        $(document).on('quickSearchComplete', function () {
            selectedIds = [];
            updateBulkDeleteBtn();
            bindCheckboxEvents();
        });
    });

})();
