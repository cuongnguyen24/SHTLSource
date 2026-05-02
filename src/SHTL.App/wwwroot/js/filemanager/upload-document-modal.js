/**
 * upload-document-modal.js - Shared Multi-File Document Upload Modal Logic
 * Requires: _UploadDocumentModal.cshtml partial view
 * Usage: Include this script AFTER jQuery, Bootstrap Modal
 * 
 * Public API:
 *   window.openUploadDocumentModal(parentId, options)
 *   window.submitUploadDocuments(onProgress, onComplete)
 */

(function () {
    'use strict';

    // Module state
    let selectedFiles = [];
    let useCommonType = false;
    let documentTypesCache = [];
    const MAX_FILES = 50;
    const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

    // ===== PUBLIC API =====

    /**
     * Open Upload Document Modal
     * @param {string} parentId - Parent node ID (folder, profile, or root)
     * @param {object} options - Optional configuration { onSuccess: function, onError: function }
     */
    window.openUploadDocumentModal = function (parentId, options) {
        options = options || {};

        // Auto-replace '#' with rootNodeId if available (defensive programming)
        if (parentId === '#' && window.storageContext && window.storageContext.rootNodeId) {
            console.log('[UploadModal] Replacing "#" with rootNodeId:', window.storageContext.rootNodeId);
            parentId = window.storageContext.rootNodeId;
        }

        // Validate parentId
        if (!parentId || parentId === '#' || parentId.trim() === '') {
            console.error('[UploadModal] Invalid parentId after normalization:', parentId);
            toastr.error('Không xác định được vị trí lưu tài liệu. Vui lòng chọn thư mục hoặc hồ sơ.');
            return;
        }

        console.log('[UploadModal] Opening modal with parentId:', parentId);

        // Reset all fields
        $('#documentParentId').val(parentId);
        $('#documentFiles').val('');
        $('#useCommonDocumentType').prop('checked', false);
        $('#commonDocumentType').val('');
        $('#commonDocumentTypeSection').hide();
        $('#fileListSection').hide();
        $('#btnConfirmMultiUpload').hide();

        // Reset state
        selectedFiles = [];
        useCommonType = false;
        $('#fileCount').text('0');
        $('#fileListBody').empty();

        // Load DocumentTypes dropdown
        loadDocumentTypes($('#commonDocumentType'));

        // Store callbacks
        $('#uploadDocumentModal').data('callbacks', options);

        $('#uploadDocumentModal').modal('show');
    };

    /**
     * Submit Upload Documents (for external triggering)
     * @param {function} onProgress - Progress callback(fileIndex, percent, status)
     * @param {function} onComplete - Completion callback(successCount, failCount)
     */
    window.submitUploadDocuments = async function (onProgress, onComplete) {
        const validFiles = selectedFiles.filter(f => !f.error);
        if (validFiles.length === 0) {
            toastr.warning('Không có file hợp lệ để upload');
            return;
        }

        const token = $('input[name="__RequestVerificationToken"]').val();
        let formParentId = $('#documentParentId').val();

        // Validate parentId
        if (!formParentId || formParentId.trim() === '') {
            console.error('[UploadDocument] ParentId is empty or null');
            toastr.error('Không xác định được vị trí lưu tài liệu. Vui lòng thử lại.');
            return;
        }

        console.log(`[UploadDocument] Starting upload ${validFiles.length} files to ParentId: ${formParentId}`);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < selectedFiles.length; i++) {
            const fileData = selectedFiles[i];

            if (fileData.error) continue;

            $(`#rowProgress_${i}`).show();
            updateFileStatus(i, 'Đang upload', 'badge-info');
            if (onProgress) onProgress(i, 0, 'uploading');

            const formData = new FormData();
            // Use PascalCase to match backend model (ASP.NET Core is case-insensitive but better to be consistent)
            formData.append('File', fileData.file);
            formData.append('ParentId', formParentId);
            if (fileData.documentTypeId) formData.append('DocumentTypeId', fileData.documentTypeId);
            formData.append('DocumentCode', fileData.code);
            formData.append('DocumentTitle', fileData.title);

            console.log(`[UploadDocument] File ${i}: ${fileData.file.name}, ParentId=${formParentId}, DocumentTypeId=${fileData.documentTypeId || 'null'}`);

            try {
                await uploadSingleFile(formData, i, token, onProgress);
                updateFileStatus(i, '✓ Xong', 'badge-success');
                $(`#rowProgress_${i}`).hide();
                if (onProgress) onProgress(i, 100, 'success');
                successCount++;
            } catch (error) {
                updateFileStatus(i, '✗ Lỗi', 'badge-danger');
                $(`#rowProgress_${i}`).hide();
                if (onProgress) onProgress(i, 0, 'error');
                console.error(`[UploadDocument] Error uploading file ${i}:`, error);
                failCount++;
            }
        }

        if (onComplete) onComplete(successCount, failCount);

        if (failCount === 0) {
            toastr.success(`Upload thành công ${successCount} file`);
            setTimeout(() => {
                $('#uploadDocumentModal').modal('hide');
            }, 1500);
        } else {
            toastr.warning(`Hoàn tất: ${successCount} thành công, ${failCount} lỗi`);
        }
    };

    // ===== INTERNAL HELPERS =====

    function loadDocumentTypes(dropdown, selectedId) {
        dropdown.empty().append('<option value="">-- Chọn loại tài liệu --</option>');
        $.ajax({
            url: '/FileManager/Storage/GetDocumentTypes',
            type: 'GET',
            success: function (data) {
                if (data && Array.isArray(data)) {
                    documentTypesCache = data.map(item => ({
                        id: item.id || item.Id,
                        name: item.name || item.Name,
                        code: item.code || item.Code
                    }));
                    documentTypesCache.forEach(item => {
                        const selected = selectedId && item.id === selectedId ? 'selected' : '';
                        dropdown.append(`<option value="${item.id}" ${selected}>${item.name}</option>`);
                    });
                    if (selectedId) dropdown.trigger('change');
                    if (selectedFiles.length > 0) renderFileList();
                }
            }
        });
    }

    function generateDocumentCode() {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `TL-${dateStr}-${randomStr}`;
    }

    function getFileNameWithoutExtension(fileName) {
        return fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    }

    function renderFileList() {
        const tbody = $('#fileListBody');
        tbody.empty();

        const validFiles = selectedFiles.filter(f => !f.error);

        if (selectedFiles.length === 0) {
            $('#fileListSection').hide();
            $('#btnConfirmMultiUpload').hide();
            return;
        }

        $('#fileListSection').show();
        if (validFiles.length > 0) {
            $('#btnConfirmMultiUpload').show();
        } else {
            $('#btnConfirmMultiUpload').hide();
        }
        $('#fileCount').text(`${validFiles.length} hợp lệ / ${selectedFiles.length} tổng`);

        selectedFiles.forEach((file, index) => {
            const typeDropdownId = `docType_${index}`;

            if (file.error) {
                const errRow = `
                    <tr data-file-index="${index}" style="background:#fff5f5;">
                        <td class="text-center text-muted">${index + 1}</td>
                        <td><small class="text-danger" title="${file.file.name}"><i class="fas fa-exclamation-circle mr-1"></i>${file.file.name}</small></td>
                        <td colspan="3"><small class="text-danger">${file.error}</small></td>
                        <td class="text-center"><span class="badge badge-danger">Lỗi</span></td>
                        <td class="text-center">
                            <button type="button" class="btn btn-sm btn-danger btn-remove-file" data-file-index="${index}" title="Xóa"><i class="fas fa-times"></i></button>
                        </td>
                    </tr>`;
                tbody.append(errRow);
                return;
            }

            const typeOptionsHtml = documentTypesCache
                .map(t => `<option value="${t.id}" ${t.id === file.documentTypeId ? 'selected' : ''}>${t.name}</option>`)
                .join('');

            const fileSizeMB = (file.file.size / 1024 / 1024).toFixed(2);
            const row = `
                <tr data-file-index="${index}">
                    <td class="text-center">${index + 1}</td>
                    <td>
                        <small title="${file.file.name}">${file.file.name}</small>
                        <br><small class="text-muted">${fileSizeMB} MB</small>
                    </td>
                    <td>
                        <input type="text" class="form-control form-control-sm document-code-input" 
                               value="${file.code}" 
                               data-file-index="${index}" 
                               placeholder="Mã TL..." 
                               maxlength="100" />
                    </td>
                    <td>
                        <input type="text" class="form-control form-control-sm document-title-input" 
                               value="${file.title}" 
                               data-file-index="${index}" 
                               placeholder="Tiêu đề..." 
                               maxlength="500" />
                    </td>
                    <td>
                        <select class="form-control form-control-sm individual-type-dropdown" 
                                id="${typeDropdownId}" 
                                data-file-index="${index}" 
                                ${useCommonType ? 'disabled' : ''}>
                            <option value="">-- Chọn loại --</option>
                            ${typeOptionsHtml}
                        </select>
                    </td>
                    <td style="min-width:90px;">
                        <span class="badge badge-secondary file-status-badge" data-file-index="${index}">Chờ</span>
                        <div class="progress mt-1" id="rowProgress_${index}" style="height:4px; display:none;">
                            <div class="progress-bar progress-bar-striped progress-bar-animated"
                                 id="rowProgressBar_${index}" style="width:0%"></div>
                        </div>
                    </td>
                    <td class="text-center">
                        <button type="button" class="btn btn-sm btn-danger btn-remove-file" 
                                data-file-index="${index}" 
                                title="Xóa">
                            <i class="fas fa-times"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.append(row);
        });
    }

    function updateFileStatus(fileIndex, status, badgeClass) {
        const badge = $(`.file-status-badge[data-file-index="${fileIndex}"]`);
        badge.removeClass('badge-secondary badge-info badge-success badge-danger badge-warning');
        badge.addClass(badgeClass);
        badge.text(status);
    }

    function uploadSingleFile(formData, fileIndex, token, onProgress) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: '/FileManager/Storage/UploadDocument',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: { 'RequestVerificationToken': token },
                xhr: function () {
                    const xhr = new window.XMLHttpRequest();
                    xhr.upload.addEventListener('progress', function (e) {
                        if (e.lengthComputable) {
                            const pct = Math.round((e.loaded / e.total) * 100);
                            $(`#rowProgressBar_${fileIndex}`).css('width', pct + '%');
                            if (onProgress) onProgress(fileIndex, pct, 'uploading');
                        }
                    }, false);
                    return xhr;
                },
                success: function (response) {
                    if (response.isSuccess) {
                        resolve(response);
                    } else {
                        reject(response.message || 'Upload failed');
                    }
                },
                error: function (xhr, status, error) {
                    reject(error || 'Network error');
                }
            });
        });
    }

    // ===== EVENT BINDINGS (Auto-init on document ready) =====
    $(document).ready(function () {
        // File selection changed
        $(document).on('change', '#documentFiles', function () {
            const files = this.files;

            if (files.length === 0) {
                selectedFiles = [];
                renderFileList();
                return;
            }

            if (files.length > MAX_FILES) {
                toastr.error(`Chỉ được chọn tối đa ${MAX_FILES} file`);
                this.value = '';
                return;
            }

            selectedFiles = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                let fileError = null;

                if (file.size > MAX_FILE_SIZE) {
                    const sizeGB = file.size / 1024 / 1024 / 1024;
                    const maxGB = MAX_FILE_SIZE / 1024 / 1024 / 1024;

                    fileError = `Vượt quá (${sizeGB.toFixed(2)}GB / tối đa ${maxGB}GB)`;
                }

                selectedFiles.push({
                    file: file,
                    code: fileError ? '' : generateDocumentCode(),
                    title: fileError ? file.name : getFileNameWithoutExtension(file.name),
                    documentTypeId: '',
                    error: fileError
                });
            }

            if (selectedFiles.length > 0) {
                renderFileList();
            } else {
                this.value = '';
            }
        });

        // Common type checkbox
        $(document).on('change', '#useCommonDocumentType', function () {
            useCommonType = $(this).is(':checked');
            if (useCommonType) {
                $('#commonDocumentTypeSection').show();
            } else {
                $('#commonDocumentTypeSection').hide();
                $('#commonDocumentType').val('');
            }
            renderFileList();
        });

        // Common type dropdown
        $(document).on('change', '#commonDocumentType', function () {
            const commonTypeId = $(this).val();
            if (useCommonType) {
                selectedFiles.forEach(file => {
                    if (!file.error) file.documentTypeId = commonTypeId || '';
                });
                renderFileList();
            }
        });

        // Document code input
        $(document).on('input', '.document-code-input', function () {
            const index = $(this).data('file-index');
            const value = $(this).val();
            if (selectedFiles[index]) {
                selectedFiles[index].code = value;
            }
        });

        // Document title input
        $(document).on('input', '.document-title-input', function () {
            const index = $(this).data('file-index');
            const value = $(this).val();
            if (selectedFiles[index]) {
                selectedFiles[index].title = value;
            }
        });

        // Individual type dropdown
        $(document).on('change', '.individual-type-dropdown', function () {
            const index = $(this).data('file-index');
            const value = $(this).val();
            if (selectedFiles[index]) {
                selectedFiles[index].documentTypeId = value;
            }
        });

        // Remove file button
        $(document).on('click', '.btn-remove-file', function () {
            const index = $(this).data('file-index');
            selectedFiles.splice(index, 1);
            renderFileList();
        });

        // Confirm upload button
        $(document).on('click', '#btnConfirmMultiUpload', async function () {
            const callbacks = $('#uploadDocumentModal').data('callbacks') || {};
            
            // Validation: Document Type is now optional
            // If using common type, we check if one is selected but don't block upload if it's not
            const commonTypeId = $('#commonDocumentType').val();
            if (useCommonType && !commonTypeId) {
                // Optional: Provide a hint or just continue
            }

            
            $(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Đang upload...');

            await window.submitUploadDocuments(
                callbacks.onProgress,
                function (successCount, failCount) {
                    if (callbacks.onSuccess) callbacks.onSuccess(successCount, failCount);
                }
            );

            $(this).prop('disabled', false).html('<i class="fas fa-upload mr-2"></i>Upload');
        });

        // Modal cleanup
        $('#uploadDocumentModal').on('hidden.bs.modal', function () {
            selectedFiles = [];
            useCommonType = false;
            $('#documentFiles').val('');
            $('#fileListBody').empty();
        });
    });

})();
