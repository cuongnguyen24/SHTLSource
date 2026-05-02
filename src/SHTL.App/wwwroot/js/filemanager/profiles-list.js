/**
 * Profiles List Management - Refactored Version
 * - Standardized actions with Node-level permissions
 * - "View Documents" → Navigate to dedicated Documents screen
 * - "Edit Profile" → Open inline edit modal (consistent with storage Index)
 */
(function () {
    'use strict';

    let deleteId = null;
    let deleteName = '';

    $(document).ready(function () {
        initializeEventHandlers();
    });

    /**
     * Initialize all event handlers
     */
    function initializeEventHandlers() {
        // Refresh button
        $('#btnRefreshProfiles').on('click', function () {
            $('#frmProfiles').submit();
        });

        // Search on Enter / debounce input
        var searchTimer;
        $('input[name="searchTerm"]').on('input', function () {
            clearTimeout(searchTimer);
            var $form = $('#frmProfiles');
            searchTimer = setTimeout(function () {
                $form.submit();
            }, 400);
        });

        $('input[name="searchTerm"]').on('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(searchTimer);
                $('#frmProfiles').submit();
            }
        });
        
        // Handle Action Buttons (Delegated)
        $(document).on('click', '.btn-view-docs', handleViewDocs);
        $(document).on('click', '.btn-edit-profile', handleEditProfile);
        $(document).on('click', '.btn-delete', handleDeleteClick);
        $(document).on('click', '.btn-permission', handlePermissionClick);

        // Create Profile button
        $('#btnCreateProfile').on('click', function () {
            if (window.openCreateProfileStandaloneModal) {
                window.openCreateProfileStandaloneModal({
                    onSuccess: function (response) {
                        $('#frmProfiles').submit();
                    }
                });
            } else {
                toastr.error('Chức năng chưa được tải. Vui lòng tải lại trang.');
            }
        });

        // Confirm delete button
        $('#btnConfirmDelete').on('click', handleConfirmDelete);
    }

    /**
     * Handle View Documents
     * Redirects to the dedicated screen S5
     */
    function handleViewDocs(e) {
        e.preventDefault();
        e.stopPropagation();
        const profileId = $(this).data('id');
        
        if (!profileId) {
            toastr.error('Không xác định được ID hồ sơ');
            return;
        }

        window.location.href = `/FileManager/Storage/Documents?profileId=${profileId}`;
    }

    /**
     * Handle Edit Profile
     * Opens the shared edit-node-modal (consistent with storage Index)
     */
    function handleEditProfile(e) {
        e.preventDefault();
        e.stopPropagation();
        const profileId = $(this).data('id');
        
        if (typeof window.openEditNodeModal === 'function') {
            window.openEditNodeModal({ id: profileId, nodeType: 'HO_SO' }, {
                onSuccess: function () {
                    $('#frmProfiles').submit();
                }
            });
        } else {
            toastr.error('Tính năng chỉnh sửa chưa được tải. Vui lòng tải lại trang.');
        }
    }

    /**
     * Handle Permission button click
     */
    function handlePermissionClick(e) {
        e.preventDefault();
        e.stopPropagation();
        const profileId = $(this).data('id');
        const profileName = $(this).data('name');
        
        if (typeof window.openPermissionModal === 'function') {
            window.openPermissionModal(profileId, profileName, 'HO_SO');
        } else {
            toastr.error('Chức năng phân quyền chưa được tải.');
        }
    }

    /**
     * Handle Delete button click
     */
    function handleDeleteClick(e) {
        e.preventDefault();
        e.stopPropagation();
        deleteId = $(this).data('id');
        deleteName = $(this).data('name');
        
        $('#deleteProfileName').text(deleteName);
        $('#deleteModal').modal('show');
    }

    /**
     * Handle Confirm Delete
     */
    function handleConfirmDelete() {
        if (!deleteId) return;

        const $btn = $('#btnConfirmDelete');
        const originalHtml = $btn.html();
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xóa...');

        const token = $('input[name="__RequestVerificationToken"]').val();

        $.ajax({
            url: `/FileManager/Storage/DeleteProfile/${deleteId}`,
            type: 'DELETE',
            headers: { 'RequestVerificationToken': token },
            success: function (response) {
                if (response && response.isSuccess) {
                    toastr.success(response.message || 'Xóa hồ sơ thành công');
                    $('#deleteModal').modal('hide');
                    $('#frmProfiles').submit();
                } else {
                    toastr.error(response.message || 'Không thể xóa hồ sơ');
                }
            },
            error: function (xhr) {
                toastr.error('Lỗi khi xóa hồ sơ');
            },
            complete: function () {
                $btn.prop('disabled', false).html(originalHtml);
            }
        });
    }

})();
