/**
 * User Management JavaScript
 * Pattern: server-side search/pagination via quickSearch form → _Users partial
 */
(function () {
    'use strict';

    let deleteId = null;
    let deleteName = '';
    let isSubmitting = false;

    // ── Reload helpers ────────────────────────────────────────────────────

    function reloadList() {
        $('#frmUser').trigger('submit');
    }

    // ── Init Select2 ──────────────────────────────────────────────────────

    function initFilters() {
        $('.select2-modern').each(function() {
            $(this).select2({
                theme: 'bootstrap4',
                width: '100%',
                placeholder: $(this).data('placeholder'),
                allowClear: true,
                dropdownParent: $(this).closest('.form-group')
            });
        });

        // Load dynamic data for filters
        if ($('#filterDeptId').children('option').length <= 1) {
            $.get('/Departments/GetActive', function (data) {
                const $select = $('#filterDeptId');
                const items = data.$values || data || [];
                items.forEach(dept => {
                    $select.append(new Option(dept.name, dept.id));
                });
            });
        }

        if ($('#filterRoleName').children('option').length <= 1) {
            $.get('/Role/GetAll', function (data) {
                const $select = $('#filterRoleName');
                const items = data.$values || data || [];
                items.forEach(role => {
                    $select.append(new Option(role.name, role.name));
                });
            });
        }
    }

    // ── Event Handlers ────────────────────────────────────────────────────

    function bindEvents() {
        // Toggle advanced filter
        $(document).off('click', '#btnToggleFilter').on('click', '#btnToggleFilter', function () {
            const $area = $('#advancedFilterArea');
            const $btn = $(this);
            $area.slideToggle(200);
            $btn.toggleClass('active');
            
            if ($btn.hasClass('active')) {
                $btn.css('background-color', '#eff6ff').css('border-color', '#bfdbfe').css('color', '#3b82f6');
            } else {
                $btn.css('background-color', '#f8fafc').css('border-color', '#e2e8f0').css('color', 'inherit');
            }
        });

        // Sync advanced filters to hidden inputs
        $(document).on('change', '#filterDeptId', function() {
            $('#hdnDeptId').val($(this).val());
            reloadList();
        });

        $(document).on('change', '#filterRoleName', function() {
            $('#hdnRoleName').val($(this).val());
            reloadList();
        });

        $(document).on('change', '#filterStatus', function() {
            $('#hdnIsActive').val($(this).val());
            reloadList();
        });

        // Delete user
        $(document).off('click', '.btn-delete-user').on('click', '.btn-delete-user', function () {
            deleteId = $(this).data('id');
            deleteName = $(this).data('name');
            $('#deleteUserName').text(deleteName);
            $('#deleteModal').modal('show');
        });

        // Confirm delete
        $(document).off('click', '#btnConfirmDelete').on('click', '#btnConfirmDelete', function () {
            if (!deleteId || isSubmitting) return;

            const $btn = $(this);
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xóa...');
            isSubmitting = true;

            const token = $('input[name="__RequestVerificationToken"]').val();

            $.ajax({
                url: '/User/Delete/' + deleteId,
                type: 'POST',
                headers: { 'RequestVerificationToken': token },
                success: function (response) {
                    if (response.isSuccess) {
                        toastr.success(response.message || 'Xóa người dùng thành công', 'Thành công');
                        $('#deleteModal').modal('hide');
                        reloadList();
                    } else {
                        toastr.error(response.message || 'Không thể xóa người dùng', 'Lỗi');
                    }
                },
                error: function (xhr) {
                    console.error('Error deleting user:', xhr);
                    toastr.error('Có lỗi xảy ra khi xóa người dùng', 'Lỗi');
                },
                complete: function () {
                    isSubmitting = false;
                    $btn.prop('disabled', false).html('<i class="fas fa-trash mr-2"></i>Xác nhận xóa');
                    deleteId = null;
                }
            });
        });
    }

    // ── Init ──────────────────────────────────────────────────────────────

    $(document).ready(function () {
        initFilters();
        bindEvents();

        // Re-bind after partial search
        $(document).on('quickSearchComplete', function () {
            // Keep filter state if needed, or just re-bind
            // Selected values in hidden inputs are already synced
        });
    });

}());
