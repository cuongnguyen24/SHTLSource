/**
 * Enterprise Detail Page — Tab Switching, Delete Confirmation, Document Handlers
 * Pattern: IIFE + window-exposed global functions (for inline onclick in Razor)
 * Reference: complaint-details.js
 */
(function () {
    'use strict';

    // ══════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════
    var docUploader = null;

    // ══════════════════════════════════════════════════════════════
    // DOM READY
    // ══════════════════════════════════════════════════════════════
    $(document).ready(function () {
        initDocUploader();
        initUploadDocFormHandler();
        initEditDocFormHandler();
        initDeleteDocHandler();
    });

    // ══════════════════════════════════════════════════════════════
    // TAB SWITCHING
    // Called via inline onclick: switchEntTab('documents', this)
    // ══════════════════════════════════════════════════════════════
    window.switchEntTab = function (tabName, btnEl) {
        // Deactivate all tab buttons and panes
        $('.ent-tab-btn').removeClass('active');
        $('.ent-tab-pane').removeClass('active');

        // Activate the clicked button and matching pane
        $(btnEl).addClass('active');
        $('#ent-tab-' + tabName).addClass('active');
    };

    // ══════════════════════════════════════════════════════════════
    // DELETE ENTERPRISE CONFIRMATION
    // Called via inline onclick: confirmDelete(id, name)
    // ══════════════════════════════════════════════════════════════
    window.confirmDelete = function (id, name) {
        // Use .text() — safe from XSS (no Html.Raw needed)
        $('#enterpriseName').text(name);
        $('#deleteForm').attr('action', '/Enterprise/Delete/' + id);
        $('#deleteModal').modal('show');
    };

    // ══════════════════════════════════════════════════════════════
    // DOCUMENT UPLOAD
    // ══════════════════════════════════════════════════════════════
    function initDocUploader() {
        if (typeof FileUploadComponent === 'undefined') return;
        if (!document.getElementById('uploadZone_doc')) return;

        docUploader = new FileUploadComponent({
            dropZoneId:  'uploadZone_doc',
            fileInputId: 'docFiles',
            fileQueueId: 'fileQueue_doc',
            maxFiles:    5,
            maxSizeMB:   10,
            simple:      true
        });

        // Reset uploader and form when modal closes
        $('#uploadDocumentModal').on('hidden.bs.modal', function () {
            if (docUploader) docUploader.clear();
            document.getElementById('uploadDocForm').reset();
            $('#docDocumentTypeId').val(null).trigger('change');
        });
    }

    function initUploadDocFormHandler() {
        $('#uploadDocForm').on('submit', function (e) {
            e.preventDefault();

            var files = docUploader ? docUploader.getFiles() : [];
            if (files.length === 0) {
                toastr.warning('Vui lòng chọn ít nhất 1 file tài liệu.');
                return;
            }

            // ENT_ID is declared in the Details.cshtml inline script block
            if (typeof ENT_ID === 'undefined' || !ENT_ID) {
                toastr.error('Không tìm thấy thông tin doanh nghiệp.');
                return;
            }

            var formData = new FormData();
            formData.append('enterpriseId', ENT_ID);

            var documentTypeId = $('#docDocumentTypeId').val();
            if (documentTypeId) formData.append('documentTypeId', documentTypeId);

            var documentTitle = $('#docDocumentTitle').val().trim();
            if (documentTitle) formData.append('documentTitle', documentTitle);

            var ngayBanHanh = $('#docNgayBanHanh').val();
            if (ngayBanHanh) formData.append('ngayBanHanh', ngayBanHanh);

            var ngayHetHan = $('#docNgayHetHan').val();
            if (ngayHetHan) formData.append('ngayHetHan', ngayHetHan);

            var notes = $('#docNotes').val().trim();
            if (notes) formData.append('notes', notes);

            files.forEach(function (file) {
                formData.append('files', file);
            });

            var $btn = $('#btnUploadDoc');
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Đang tải...');

            $.ajax({
                url: '/Enterprise/UploadEnterpriseDocuments',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function (resp) {
                    if (resp && resp.isSuccess) {
                        toastr.success(resp.message || 'Tải lên thành công.');
                        if (resp.errors && resp.errors.length > 0) {
                            resp.errors.forEach(function (err) { toastr.warning(err); });
                        }
                        $('#uploadDocumentModal').modal('hide');
                        $('#frmDocuments').submit(); // Refresh documents tab
                    } else {
                        toastr.error((resp && resp.message) || 'Tải lên thất bại.');
                        if (resp && resp.errors) {
                            resp.errors.forEach(function (err) { toastr.warning(err); });
                        }
                    }
                },
                error: function () {
                    toastr.error('Lỗi kết nối server. Vui lòng thử lại.');
                },
                complete: function () {
                    $btn.prop('disabled', false).html('<i class="fas fa-upload mr-1"></i>Tải lên');
                }
            });
        });
    }

    // ══════════════════════════════════════════════════════════════
    // EDIT DOCUMENT
    // Called via inline onclick from _DocumentsForEnterprise partial
    // ══════════════════════════════════════════════════════════════
    window.openEditDocModal = function (docId, name, docTypeId, docTypeName, ngayBanHanh, ngayHetHan) {
        $('#editDocId').val(docId);
        $('#editDocName').val(name);
        $('#editDocNgayBanHanh').val(ngayBanHanh || '');
        $('#editDocNgayHetHan').val(ngayHetHan || '');
        $('#editDocDescription').val('');

        // Populate the document type select2 option without an AJAX call
        var $sel = $('#editDocTypeId');
        $sel.find('option').not('[value=""]').remove();
        if (docTypeId && docTypeName) {
            $sel.append(new Option(docTypeName, docTypeId, true, true)).trigger('change');
        } else {
            $sel.val(null).trigger('change');
        }

        $('#editDocumentModal').modal('show');
    };

    function initEditDocFormHandler() {
        $('#editDocForm').on('submit', function (e) {
            e.preventDefault();

            var name = $('#editDocName').val().trim();
            if (!name) {
                toastr.warning('Tên tài liệu không được để trống.');
                return;
            }

            var data = {
                docId:          $('#editDocId').val(),
                enterpriseId:   $('#editEnterpriseId').val(),
                documentTypeId: $('#editDocTypeId').val() || '',
                name:           name,
                ngayBanHanh:    $('#editDocNgayBanHanh').val(),
                ngayHetHan:     $('#editDocNgayHetHan').val(),
                description:    $('#editDocDescription').val()
            };

            var $btn = $('#btnSaveDoc');
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Đang lưu...');

            $.ajax({
                url: '/Enterprise/UpdateEnterpriseDocument',
                type: 'POST',
                data: data,
                success: function (resp) {
                    if (resp && resp.isSuccess) {
                        toastr.success(resp.message || 'Cập nhật thành công.');
                        $('#editDocumentModal').modal('hide');
                        $('#frmDocuments').submit(); // Refresh documents tab
                    } else {
                        toastr.error((resp && resp.message) || 'Cập nhật thất bại.');
                    }
                },
                error: function () {
                    toastr.error('Lỗi kết nối server. Vui lòng thử lại.');
                },
                complete: function () {
                    $btn.prop('disabled', false).html('<i class="fas fa-save mr-1"></i>Lưu');
                }
            });
        });
    }

    // ══════════════════════════════════════════════════════════════
    // DELETE DOCUMENT
    // .delete-doc[data-url] buttons inside _DocumentsForEnterprise
    // ══════════════════════════════════════════════════════════════
    function initDeleteDocHandler() {
        $(document).on('click', '.delete-doc', function () {
            var $btn = $(this);
            var url  = $btn.data('url');
            if (!url) return;

            if (!confirm('Bạn có chắc chắn muốn xóa tài liệu này?')) return;

            var originalHtml = $btn.html();
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin" style="color:#fff;"></i>');

            $.ajax({
                url:  url,
                type: 'POST',
                success: function (resp) {
                    // Check both CustJSonResult (Type) and plain Json (isSuccess) shapes
                    var ok = (resp && resp.Type === 'Success') || (resp && resp.isSuccess);
                    if (ok) {
                        toastr.success((resp.Message || resp.message) || 'Xóa thành công.');
                        $('#frmDocuments').submit(); // Refresh documents tab
                    } else {
                        toastr.error((resp && (resp.Message || resp.message)) || 'Xóa thất bại.');
                    }
                },
                error: function () {
                    toastr.error('Lỗi kết nối server. Vui lòng thử lại.');
                },
                complete: function () {
                    $btn.prop('disabled', false).html(originalHtml);
                }
            });
        });
    }

})();
