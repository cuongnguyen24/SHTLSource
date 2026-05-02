/**
 * documents-list.js
 * Specialized management for S5 screen (Documents within a Profile)
 * Redesigned for Server-side pagination and AJAX Partial View updates
 */

// Global function for onclick handlers if needed
window.viewDocument = function(id) {
    if (!id || id === 'undefined') {
        toastr.warning('Không tìm thấy ID tài liệu');
        return;
    }
    window.open(`/FileManager/Storage/DocumentView/${id}`, '_blank');
};

$(document).ready(function () {
    const token = $('input[name="__RequestVerificationToken"]').val();
    const profileId = window.profileContext.profileId;

    // ===== INITIALIZATION =====
    
    function init() {
        initAjaxSearch();
        initPagination();
        initPermissions();
        bindTableActions();
    }

    /**
     * Initial permission check for Header buttons
     */
    function initPermissions() {
        $.ajax({
            url: `/FileManager/Storage/GetNodeDetail/${profileId}`,
            type: 'GET',
            success: function (res) {
                if (res && res.isSuccess && res.data) {
                    const perm = res.data.myPermission || {};
                    const isSuperAdmin = perm.isSuperAdmin || false;
                    
                    if (isSuperAdmin || perm.canCreate) {
                        $('#btnUploadDoc').fadeIn(200).css('display', 'inline-flex');
                    }
                }
            }
        });
    }

    /**
     * AJAX Search Form Handling
     */
    function initAjaxSearch() {
        $('#frmDocuments').on('submit', function (e) {
            e.preventDefault();
            searchWithParams(1);
        });

        $(document).on('change', 'select[name="' + (window.dataTableSizeName || 'pageSize') + '"]', function () {
            searchWithParams(1);
        });
    }

    /**
     * Pagination Handling
     */
    function initPagination() {
        $(document).off('click', '.onSetPageIndex').on('click', '.onSetPageIndex', function (e) {
            e.preventDefault();
            const page = $(this).data('page');
            const targetForm = $(this).data('target');
            
            if (targetForm === '#frmDocuments' || $(this).closest('form').attr('id') === 'frmDocuments') {
                searchWithParams(page);
            }
        });
    }

    /**
     * Helper to trigger search with specific page
     */
    function searchWithParams(page) {
        const $form = $('#frmDocuments');
        const $container = $($form.data('target') || '#divDocuments');
        const pageSize = $('select[name="' + (window.dataTableSizeName || 'pageSize') + '"]').val() || 20;

        // Populate hidden fields
        $form.find('input[name="pageNumber"]').val(page);
        $form.find('input[name="pageSize"]').val(pageSize);

        const formData = $form.serialize();

        $container.addClass('loading-opacity').css('opacity', '0.5');

        $.ajax({
            url: $form.attr('action'),
            type: $form.attr('method'),
            data: formData,
            success: function (res) {
                $container.html(res).css('opacity', '1');
                updateTotalCount();
            },
            error: function () {
                toastr.error('Lỗi khi tải dữ liệu');
                $container.css('opacity', '1');
            },
            complete: function () {
                $container.removeClass('loading-opacity');
            }
        });
    }

    /**
     * Update total count label on header
     */
    function updateTotalCount() {
        const actualCount = $('#divDocuments [data-total-count]').data('total-count');
        if (actualCount !== undefined) {
            $('#totalItems').text(actualCount);
        } else {
            const text = $('.pagination-info').text();
            const match = text.match(/\/ ([\d,]+)/);
            if (match && match[1]) {
                $('#totalItems').text(match[1]);
            }
        }
    }

    // ===== ROW EVENT HANDLERS (Delegated) =====

    function bindTableActions() {
        // View
        $(document).on('click', '.btn-view-doc', function() {
            const id = $(this).data('id');
            window.viewDocument(id);
        });

        // Edit Metadata (Specialized full-page editor)
        $(document).on('click', '.btn-edit-doc', function () {
            const id = $(this).data('id');
            window.open('/FileManager/Storage/DocumentView/' + id + '?mode=edit', '_blank');
        });

        // Download
        $(document).on('click', '.btn-download-doc', function() {
            const id = $(this).data('id');
            const $btn = $(this);
            $btn.find('i').removeClass('fa-download').addClass('fa-spinner fa-spin');
            
            $.get(`/FileManager/Storage/View/${id}`, function(res) {
                $btn.find('i').removeClass('fa-spinner fa-spin').addClass('fa-download');
                if (res.isSuccess && res.downloadUrl) {
                    window.open(res.downloadUrl, '_blank');
                } else {
                    toastr.error(res.message || 'Không tìm thấy tệp để tải xuống');
                }
            }).fail(function() {
                $btn.find('i').removeClass('fa-spinner fa-spin').addClass('fa-download');
                toastr.error('Lỗi hệ thống khi tải tệp');
            });
        });

        // Permission
        $(document).on('click', '.btn-permission-doc', function() {
            const id = $(this).data('id');
            const name = $(this).data('name');
            if (typeof window.openPermissionModal === 'function') {
                window.openPermissionModal(id, name, 'TAI_LIEU');
            }
        });

        // Delete
        $(document).on('click', '.btn-delete-doc', function() {
            const id = $(this).data('id');
            const name = $(this).data('name');
            
            $('#deleteDocTypeName').text('tài liệu');
            $('#deleteDocName').text(name);
            
            $('#btnConfirmDeleteDoc').off('click').on('click', function() {
                const $btn = $(this);
                $btn.prop('disabled', true).text('Đang xóa...');
                
                $.ajax({
                    url: `/FileManager/Storage/Delete/${id}`,
                    type: 'DELETE',
                    headers: { 'RequestVerificationToken': token },
                    success: function(res) {
                        if (res && res.isSuccess) {
                            toastr.success('Xóa tài liệu thành công');
                            $('#deleteDocModal').modal('hide');
                            $('#frmDocuments').submit(); // Refresh current page
                        } else {
                            toastr.error(res.message || 'Lỗi khi xóa tài liệu');
                        }
                    },
                    complete: function() {
                        $btn.prop('disabled', false).text('Xóa vĩnh viễn');
                    }
                });
            });

            $('#deleteDocModal').modal('show');
        });
    }

    // ===== RIBBON EVENT HANDLERS =====

    $('#btnUploadDoc').on('click', function () {
        if (typeof window.openUploadDocumentModal === 'function') {
            window.openUploadDocumentModal(profileId, {
                onSuccess: function () {
                    $('#frmDocuments').submit();
                }
            });
        }
    });

    init();
});
