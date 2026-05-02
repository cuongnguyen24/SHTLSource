/**
 * Team Management JavaScript
 * Handles Team list and deletion with Figma styling
 */

$(document).ready(function () {
    initializeEventHandlers();
});

/**
 * Reload the team list by submitting the search form
 */
function reloadList() {
    $('#frmTeam').trigger('submit');
}

/**
 * Initialize event handlers for Team management
 */
function initializeEventHandlers() {
    // Delete confirmation
    let teamToDelete = null;

    // Use delegated events to survive partial reloads
    $(document).on('click', '.btn-delete-team', function () {
        teamToDelete = $(this).data('id');
        $('#deleteTeamName').text($(this).data('name'));
        $('#deleteModal').modal('show');
    });

    // Confirm delete
    $('#btnConfirmDelete').on('click', function () {
        if (!teamToDelete) return;

        const $btn = $(this);
        const originalHtml = $btn.html();
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xóa...');

        $.ajax({
            url: '/Team/Delete/' + teamToDelete,
            type: 'POST',
            headers: {
                'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
            },
            success: function (result) {
                $('#deleteModal').modal('hide');
                if (result.success) {
                    toastr.success(result.message || 'Xóa nhóm thành công');
                    reloadList();
                } else {
                    toastr.error(result.message || 'Không thể xóa nhóm');
                }
            },
            error: function (xhr) {
                $('#deleteModal').modal('hide');
                toastr.error('Đã xảy ra lỗi khi kết nối máy chủ');
            },
            complete: function () {
                $btn.prop('disabled', false).html(originalHtml);
                teamToDelete = null;
            }
        });
    });

    // Reset State
    $('#deleteModal').on('hidden.bs.modal', function () {
        teamToDelete = null;
    });
}
