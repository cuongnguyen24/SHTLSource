/**
 * Boxes Management JavaScript
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
        $('#frmBox').trigger('submit');
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

    // --- Load Data for Select2 (Hierarchical) ---
    function initSelect2() {
        // Load Warehouses
        $.ajax({
            url: '/Boxes/GetWarehouses',
            type: 'GET',
            success: function (data) {
                let options = '<option value="">-- Chọn kho hàng --</option>';
                data.forEach(item => {
                    options += `<option value="${item.id}">${item.name}</option>`;
                });
                $('#warehouseId').html(options).select2({
                    theme: 'bootstrap4',
                    dropdownParent: $('#boxModal')
                });
            }
        });

        $('#shelfId').select2({ theme: 'bootstrap4', dropdownParent: $('#boxModal'), placeholder: '-- Chọn giá --' });
        $('#rackId').select2({ theme: 'bootstrap4', dropdownParent: $('#boxModal'), placeholder: '-- Chọn kệ --' });

        // Warehouse -> Shelf
        $('#warehouseId').on('change', function () {
            const warehouseId = $(this).val();
            loadShelves(warehouseId);
        });

        // Shelf -> Rack
        $('#shelfId').on('change', function () {
            const shelfId = $(this).val();
            loadRacks(shelfId);
        });
    }

    function loadShelves(warehouseId, currentShelfId = null) {
        if (!warehouseId) {
            $('#shelfId').html('<option value="">-- Chọn giá --</option>').trigger('change');
            return;
        }
        $.ajax({
            url: '/Boxes/GetShelves?warehouseId=' + warehouseId,
            type: 'GET',
            success: function (data) {
                let options = '<option value="">-- Chọn giá --</option>';
                data.forEach(item => { options += `<option value="${item.id}">${item.name}</option>`; });
                $('#shelfId').html(options).trigger('change');
                if (currentShelfId) { $('#shelfId').val(currentShelfId).trigger('change'); }
            }
        });
    }

    function loadRacks(shelfId, currentRackId = null) {
        if (!shelfId) {
            $('#rackId').html('<option value="">-- Chọn kệ --</option>').trigger('change');
            return;
        }
        $.ajax({
            url: '/Boxes/GetRacks?shelfId=' + shelfId,
            type: 'GET',
            success: function (data) {
                let options = '<option value="">-- Chọn kệ --</option>';
                data.forEach(item => { options += `<option value="${item.id}">${item.name}</option>`; });
                $('#rackId').html(options).trigger('change');
                if (currentRackId) { $('#rackId').val(currentRackId).trigger('change'); }
            }
        });
    }

    // --- CRUD Actions ---

    $(document).on('click', '#btnAddBox', function () {
        resetForm();
        $('#modalTitle').html('<i class="fas fa-box-open mr-2"></i>Thêm mới Hộp/Cặp');
        $('#boxModal').modal('show');
    });

    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        $.ajax({
            url: '/Boxes/Get/' + id,
            type: 'GET',
            success: function (data) {
                resetForm();
                $('#boxId').val(data.id);
                $('#code').val(data.code);
                $('#name').val(data.name);
                $('#position').val(data.position || '');
                $('#description').val(data.description || '');
                
                if (data.warehouseId) {
                    $('#warehouseId').val(data.warehouseId).trigger('change');
                    // Shelf and Rack will be loaded via chained events
                    loadShelves(data.warehouseId, data.shelfId);
                    setTimeout(() => {
                        loadRacks(data.shelfId, data.rackId);
                    }, 300);
                }

                $('#modalTitle').html('<i class="fas fa-box-open mr-2"></i>Chỉnh sửa Hộp/Cặp');
                $('#boxModal').modal('show');
            },
            error: function () { toastr.error('Không thể tải thông tin hộp/cặp'); }
        });
    });

    $(document).on('click', '#btnSaveBox', function () {
        if (isSubmitting) return;
        if (!validateForm()) return;

        const id = $('#boxId').val();
        const data = {
            code: $('#code').val().trim(),
            name: $('#name').val().trim(),
            warehouseId: $('#warehouseId').val(),
            shelfId: $('#shelfId').val(),
            rackId: $('#rackId').val(),
            position: $('#position').val() || "",
            description: $('#description').val() || "",
            isActive: true
        };

        const url = id ? '/Boxes/Update/' + id : '/Boxes/Create';
        const method = id ? 'PUT' : 'POST';

        isSubmitting = true;
        $('#btnSaveBox').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        $.ajax({
            url: url, type: method, contentType: 'application/json', data: JSON.stringify(data),
            success: function (res) {
                if (res.isSuccess) {
                    toastr.success(res.message || 'Lưu thành công');
                    $('#boxModal').modal('hide');
                    reloadList();
                } else { toastr.error(res.message || 'Có lỗi xảy ra'); }
            },
            complete: function () {
                isSubmitting = false;
                $('#btnSaveBox').prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu');
            }
        });
    });

    $(document).on('click', '.btn-delete', function () {
        isBulkDelete = false;
        deleteId = $(this).data('id');
        $('#deleteItemName').text($(this).data('name'));
        $('#deleteModal').modal('show');
    });

    $(document).on('click', '#btnBulkDelete', function () {
        if (selectedIds.length === 0) return;
        isBulkDelete = true;
        deleteId = selectedIds;
        $('#deleteItemName').text(selectedIds.length + ' hộp đã chọn');
        $('#deleteModal').modal('show');
    });

    $(document).on('click', '#btnConfirmDelete', function () {
        const url = isBulkDelete ? '/Boxes/DeleteMultiple' : '/Boxes/Delete/' + deleteId;
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
        $('#boxForm')[0].reset();
        $('#boxId').val('');
        $('#warehouseId').val('').trigger('change');
        $('#shelfId').val('').trigger('change');
        $('#rackId').val('').trigger('change');
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
    }

    function validateForm() {
        let isValid = true;
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
        if (!$('#code').val().trim()) { showError('#code', 'Mã hộp là bắt buộc'); isValid = false; }
        if (!$('#name').val().trim()) { showError('#name', 'Tên hộp là bắt buộc'); isValid = false; }
        if (!$('#warehouseId').val()) { toastr.warning('Vui lòng chọn kho hàng'); isValid = false; }
        if (!$('#shelfId').val()) { toastr.warning('Vui lòng chọn giá hàng'); isValid = false; }
        if (!$('#rackId').val()) { toastr.warning('Vui lòng chọn kệ hàng'); isValid = false; }
        return isValid;
    }

    function showError(selector, message) {
        const $el = $(selector);
        $el.addClass('is-invalid');
        $el.after(`<div class="invalid-feedback">${message}</div>`);
    }

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
