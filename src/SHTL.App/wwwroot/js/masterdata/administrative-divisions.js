/**
 * Administrative Divisions Management JavaScript
 * Pattern: Server-side rendering with Partial View + Hierarchical Drill-down
 */
(function () {
    'use strict';

    let deleteId = null;
    let deleteLevel = 'province';
    let isBulkDelete = false;
    let selectedIds = [];
    let isSubmitting = false;

    // State object to keep track of current navigation
    const NavState = {
        level: 'province',
        provinceId: null,
        provinceName: '',
        districtId: null,
        districtName: ''
    };

    // --- Reload list helper ---
    function reloadList() {
        $('#frmAdministrativeDivision').trigger('submit');
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

    // --- Navigation Logic ---
    function updateBreadcrumb() {
        const lvl = NavState.level;
        $('#navToProvince').css('font-weight', lvl === 'province' ? '700' : '400');
        $('#navArrow1').toggle(lvl !== 'province');
        
        if (lvl === 'district') {
            $('#navToDistrict').show();
            $('#navDistrictLabel').text(NavState.provinceName);
            $('#navToDistrict').css('font-weight', '700');
        } else {
            $('#navToDistrict').hide();
        }
    }

    function navigateTo(level, parentId, parentName) {
        NavState.level = level;
        if (level === 'province') {
            NavState.provinceId = null;
            NavState.provinceName = '';
        } else if (level === 'district') {
            NavState.provinceId = parentId;
            NavState.provinceName = parentName;
        }

        $('#currentLevel').val(level);
        $('#currentParentId').val(parentId || '');
        updateBreadcrumb();
        reloadList();
    }

    // Drill-down click
    $(document).on('click', '.drill-link', function (e) {
        e.preventDefault();
        const id = $(this).data('id'), name = $(this).data('name'), level = $(this).data('level');
        if (level === 'province') {
            navigateTo('district', id, name);
        }
    });

    // Breadcrumb clicks
    $('#navToProvince').on('click', function () {
        if (NavState.level !== 'province') navigateTo('province');
    });

    // --- CRUD Actions ---

    // Add button
    $(document).on('click', '#btnAddDivision', function () {
        resetForm();
        const isProvince = NavState.level === 'province';
        $('#divisionType').val(isProvince ? 'province' : 'district');
        $('#divisionModalLabel').html(isProvince ? '<i class="fas fa-city mr-2"></i>Thêm mới Tỉnh/Thành phố' : '<i class="fas fa-map-pin mr-2"></i>Thêm mới Quận/Huyện');
        $('#regionRow').toggle(isProvince);
        if (!isProvince && NavState.provinceId) {
            $('#divisionProvinceId').val(NavState.provinceId);
        }
        $('#divisionModal').modal('show');
    });

    // Edit button
    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id'), level = $(this).data('level');
        const url = level === 'province' ? '/AdministrativeDivisions/GetProvince/' + id : '/AdministrativeDivisions/GetDistrict/' + id;

        $.ajax({
            url: url, type: 'GET',
            success: function (data) {
                resetForm();
                $('#divisionId').val(data.id);
                $('#divisionType').val(level);
                $('#divisionCode').val(data.code);
                $('#divisionName').val(data.name);
                $('#divisionRegion').val(data.region || '');
                $('#divisionDisplayOrder').val(data.displayOrder || 1);
                $('#regionRow').toggle(level === 'province');
                $('#divisionModalLabel').html(level === 'province' ? '<i class="fas fa-city mr-2"></i>Chỉnh sửa Tỉnh/Thành phố' : '<i class="fas fa-map-pin mr-2"></i>Chỉnh sửa Quận/Huyện');
                $('#divisionModal').modal('show');
            },
            error: function () { toastr.error('Không thể tải thông tin'); }
        });
    });

    // Save button
    $(document).on('click', '#btnSaveDivision', function () {
        if (isSubmitting) return;
        if (!validateForm()) return;

        const id = $('#divisionId').val();
        const type = $('#divisionType').val();
        const data = {
            code: $('#divisionCode').val().trim(),
            name: $('#divisionName').val().trim(),
            displayOrder: parseInt($('#divisionDisplayOrder').val()) || 1,
            region: $('#divisionRegion').val() ? $('#divisionRegion').val().trim() : ""
        };

        let url, method;
        if (type === 'province') {
            url = id ? '/AdministrativeDivisions/UpdateProvince/' + id : '/AdministrativeDivisions/CreateProvince';
            method = id ? 'PUT' : 'POST';
        } else {
            if (id) {
                url = '/AdministrativeDivisions/UpdateDistrict/' + id;
                method = 'PUT';
            } else {
                url = '/AdministrativeDivisions/CreateDistrict';
                method = 'POST';
                data.provinceId = $('#divisionProvinceId').val();
            }
        }

        isSubmitting = true;
        $('#btnSaveDivision').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        $.ajax({
            url: url, type: method, contentType: 'application/json', data: JSON.stringify(data),
            success: function (res) {
                if (res.isSuccess) {
                    toastr.success(res.message || 'Lưu thành công');
                    $('#divisionModal').modal('hide');
                    reloadList();
                } else { toastr.error(res.message || 'Có lỗi xảy ra'); }
            },
            complete: function () {
                isSubmitting = false;
                $('#btnSaveDivision').prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu');
            }
        });
    });

    // Delete single
    $(document).on('click', '.btn-delete', function () {
        isBulkDelete = false;
        deleteId = $(this).data('id');
        deleteLevel = $(this).data('level');
        $('#deleteItemName').text($(this).data('name'));
        $('#deleteModal').modal('show');
    });

    // Bulk delete callback
    $(document).on('click', '#btnBulkDelete', function () {
        if (selectedIds.length === 0) return;
        isBulkDelete = true;
        deleteId = selectedIds;
        deleteLevel = NavState.level;
        const typeName = deleteLevel === 'province' ? 'tỉnh/thành phố' : 'quận/huyện';
        $('#deleteItemName').text(selectedIds.length + ' ' + typeName + ' đã chọn');
        $('#deleteModal').modal('show');
    });

    // Confirm delete
    $(document).on('click', '#btnConfirmDelete', function () {
        let url;
        if (isBulkDelete) {
            url = deleteLevel === 'province' ? '/AdministrativeDivisions/DeleteProvinces' : '/AdministrativeDivisions/DeleteDistricts';
        } else {
            url = deleteLevel === 'province' ? '/AdministrativeDivisions/DeleteProvince/' + deleteId : '/AdministrativeDivisions/DeleteDistrict/' + deleteId;
        }

        $(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>');

        $.ajax({
            url: url, type: 'DELETE', contentType: isBulkDelete ? 'application/json' : undefined,
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
                $('#btnConfirmDelete').prop('disabled', false).html('<i class="fas fa-trash-alt mr-1"></i> Xóa');
            }
        });
    });

    // --- Helpers ---
    function resetForm() {
        $('#divisionForm')[0].reset();
        $('#divisionId').val('');
        $('#divisionProvinceId').val('');
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
    }

    function validateForm() {
        let isValid = true;
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
        if (!$('#divisionCode').val().trim()) { showError('#divisionCode', 'Mã là bắt buộc'); isValid = false; }
        if (!$('#divisionName').val().trim()) { showError('#divisionName', 'Tên là bắt buộc'); isValid = false; }
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
        // Handle quick search complete
        $(document).on('quickSearchComplete', function () {
            selectedIds = [];
            updateBulkDeleteBtn();
            bindCheckboxEvents();
        });
    });

})();
