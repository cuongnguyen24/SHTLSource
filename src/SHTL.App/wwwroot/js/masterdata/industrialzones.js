/**
 * Industrial Zones Management JavaScript
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
        $('#frmIndustrialZone').trigger('submit');
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

    // --- Data Loading Helpers ---
    function loadProvinces(callback) {
        $.get('/IndustrialZones/GetProvinces', function (data) {
            const $province = $('#provinceId');
            $province.empty().append('<option value="">-- Chọn tỉnh/thành phố --</option>');
            data.forEach(item => {
                $province.append(`<option value="${item.id}">${item.name}</option>`);
            });
            if (callback) callback();
        });
    }

    function loadDistricts(provinceId, callback) {
        if (!provinceId) {
            $('#districtId').empty().append('<option value="">-- Chọn quận/huyện/xã --</option>').trigger('change.select2');
            if (callback) callback();
            return;
        }
        $.get('/IndustrialZones/GetDistricts?provinceId=' + provinceId, function (data) {
            const $district = $('#districtId');
            $district.empty().append('<option value="">-- Chọn quận/huyện/xã --</option>');
            data.forEach(item => {
                $district.append(`<option value="${item.id}">${item.name}</option>`);
            });
            if (callback) callback();
        });
    }

    // --- CRUD Actions ---

    // Add button
    $(document).on('click', '#btnAddIndustrialZone', function () {
        resetForm();
        $('#modalTitle').html('<i class="fas fa-industry mr-2"></i>Thêm mới Khu công nghiệp');
        loadProvinces();
        $('#industrialZoneModal').modal('show');
    });

    // Edit button
    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        $.ajax({
            url: '/IndustrialZones/Get/' + id,
            type: 'GET',
            success: function (data) {
                resetForm();
                $('#industrialZoneId').val(data.id);
                $('#code').val(data.code);
                $('#name').val(data.name);
                $('#area').val(data.area);
                $('#status').val(data.status).trigger('change.select2');
                $('#establishedDate').val(data.establishedDate ? data.establishedDate.split('T')[0] : '');
                $('#managementUnit').val(data.managementUnit);
                $('#description').val(data.description);

                loadProvinces(function() {
                    $('#provinceId').val(data.provinceId).trigger('change.select2');
                    loadDistricts(data.provinceId, function() {
                        $('#districtId').val(data.districtId).trigger('change.select2');
                    });
                });

                $('#modalTitle').html('<i class="fas fa-industry mr-2"></i>Chỉnh sửa Khu công nghiệp');
                $('#industrialZoneModal').modal('show');
            },
            error: function () {
                toastr.error('Không thể tải thông tin khu công nghiệp');
            }
        });
    });

    // Save button
    $(document).on('click', '#btnSaveIndustrialZone', function () {
        if (isSubmitting) return;
        if (!validateForm()) return;

        const id = $('#industrialZoneId').val();
        const data = {
            code: $('#code').val().trim(),
            name: $('#name').val().trim(),
            provinceId: $('#provinceId').val(),
            districtId: $('#districtId').val() || null,
            area: parseFloat($('#area').val()),
            status: $('#status').val(),
            establishedDate: $('#establishedDate').val() || null,
            managementUnit: $('#managementUnit').val() || null,
            description: $('#description').val() || null
        };

        const url = id ? '/IndustrialZones/Update/' + id : '/IndustrialZones/Create';
        const method = id ? 'PUT' : 'POST';

        isSubmitting = true;
        $('#btnSaveIndustrialZone').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        $.ajax({
            url: url,
            type: method,
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(response.message || 'Lưu thành công');
                    $('#industrialZoneModal').modal('hide');
                    reloadList();
                } else {
                    toastr.error(response.message || 'Có lỗi xảy ra');
                }
            },
            complete: function () {
                isSubmitting = false;
                $('#btnSaveIndustrialZone').prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu');
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
        $('#deleteItemName').text(selectedIds.length + ' khu công nghiệp đã chọn');
        $('#deleteModal').modal('show');
    });

    // Confirm delete
    $(document).on('click', '#btnConfirmDelete', function () {
        const url = isBulkDelete ? '/IndustrialZones/DeleteMultiple' : '/IndustrialZones/Delete/' + deleteId;
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

    // Cascading dropdown
    $(document).on('change', '#provinceId', function () {
        loadDistricts($(this).val());
    });

    // --- Helpers ---
    function resetForm() {
        $('#industrialZoneForm')[0].reset();
        $('#industrialZoneId').val('');
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

        if (!$('#code').val().trim()) { showError('#code', 'Mã KCN là bắt buộc'); isValid = false; }
        if (!$('#name').val().trim()) { showError('#name', 'Tên KCN là bắt buộc'); isValid = false; }
        if (!$('#provinceId').val()) { showError('#provinceId', 'Vui lòng chọn Tỉnh/Thành phố'); isValid = false; }
        if (!$('#area').val() || parseFloat($('#area').val()) <= 0) { showError('#area', 'Diện tích phải lớn hơn 0'); isValid = false; }
        if (!$('#status').val()) { showError('#status', 'Vui lòng chọn Trạng thái'); isValid = false; }
        
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

        // Select2 Initialization
        if ($.fn.select2) {
            $('.select2-modern').select2({
                theme: 'bootstrap4',
                width: '100%',
                dropdownParent: $('#industrialZoneModal')
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
