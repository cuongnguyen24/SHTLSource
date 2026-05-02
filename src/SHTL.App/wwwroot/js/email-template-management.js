/**
 * Email Template Management JavaScript
 */
(function () {
    'use strict';

    let deleteId = null;
    let deleteName = '';
    let emailEditor;

    $(document).ready(function () {
        if ($('#BodyTemplate').length) {
            initializeCKEditor();
        }
        
        initializeEventHandlers();
    });

    /**
     * Reload the list by submitting the search form
     */
    function reloadList() {
        $('#frmEmailTemplate').trigger('submit');
    }

    /**
     * Initialize CKEditor for email content
     */
    function initializeCKEditor() {
        if (typeof ClassicEditor !== 'undefined') {
            ClassicEditor
                .create(document.querySelector('#BodyTemplate'), {
                    toolbar: [
                        'heading', '|', 
                        'bold', 'italic', 'underline', 'strikethrough', '|',
                        'link', 'bulletedList', 'numberedList', '|',
                        'outdent', 'indent', '|',
                        'blockQuote', 'insertTable', 'mediaEmbed', 'undo', 'redo'
                    ],
                    language: 'vi'
                })
                .then(editor => {
                    emailEditor = editor;
                    console.log('CKEditor 5 initialized successfully.');
                })
                .catch(error => {
                    console.error('CKEditor initialization failed:', error);
                });
        }
    }

    /**
     * Initialize event handlers
     */
    function initializeEventHandlers() {
        // Delete button (using delegation)
        $(document).on('click', '.btn-delete-template', function (e) {
            e.preventDefault();
            const btn = $(this);
            deleteId = btn.data('id');
            deleteName = btn.data('name');
            
            // Note: The UI seems to use a general delete modal, ensuring ID matches
            if ($('#deleteTeamName').length) {
                $('#deleteTeamName').text(deleteName);
            } else if ($('#deleteItemName').length) {
                $('#deleteItemName').text(deleteName);
            }
            
            $('#deleteModal').modal('show');
        });

        // Confirm delete
        $('#btnConfirmDelete').on('click', function () {
            if (!deleteId) return;

            const $btn = $(this);
            const originalHtml = $btn.html();
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xóa...');

            const token = $('input[name="__RequestVerificationToken"]').val();

            $.ajax({
                url: `/Settings/EmailTemplates/Delete/${deleteId}`,
                type: 'POST',
                headers: { 'RequestVerificationToken': token },
                success: function (response) {
                    $('#deleteModal').modal('hide');
                    if (response.isSuccess) {
                        toastr.success(response.message || 'Xóa mẫu email thành công!', 'Thành công');
                        reloadList();
                    } else {
                        toastr.error(response.message || 'Có lỗi xảy ra khi xóa mẫu email', 'Lỗi');
                    }
                },
                error: function (xhr) {
                    $('#deleteModal').modal('hide');
                    toastr.error('Có lỗi xảy ra khi kết nối máy chủ', 'Lỗi');
                },
                complete: function() {
                    $btn.prop('disabled', false).html(originalHtml);
                    deleteId = null;
                }
            });
        });

        // Form submission sync for CKEditor
        $(document).on('submit', 'form', function () {
            if (emailEditor) {
                // CKEditor 5 auto-fills the textarea on submit, but sometimes manual sync is safer
                const editorData = emailEditor.getData();
                $('#BodyTemplate').val(editorData);
            }
        });
    }

})();
