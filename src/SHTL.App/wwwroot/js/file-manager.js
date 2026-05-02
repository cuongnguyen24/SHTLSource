/**
 * File Manager JavaScript
 * Handles file uploads, drag-drop, previews, and folder operations
 */

$(document).ready(function() {
    initFileManager();
    
    // Page Size Change Handler
    $(document).on('change', '.pageSize-selector-figma', function () {
        const pageSize = $(this).val();
        const url = new URL(window.location.href);
        url.searchParams.set('pageSize', pageSize);
        url.searchParams.set('pageNumber', 1); // Reset to first page
        window.location.href = url.toString();
    });
});

function initFileManager() {
    initDropZone();
    initFileInput();
    initNewFolderForm();
    initUploadForm();
    initRenameForm();
}

// ============================================
// Drop Zone
// ============================================

function initDropZone() {
    var dropZone = $('#dropZone');
    
    if (!dropZone.length) return;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone[0].addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone[0].addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone[0].addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    dropZone[0].addEventListener('drop', handleDrop, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(e) {
        dropZone.addClass('dragover');
    }

    function unhighlight(e) {
        dropZone.removeClass('dragover');
    }

    function handleDrop(e) {
        var dt = e.dataTransfer;
        var files = dt.files;
        handleFiles(files);
    }
}

// ============================================
// File Input
// ============================================

function initFileInput() {
    $('#fileInput').on('change', function(e) {
        handleFiles(this.files);
    });
}

var selectedFiles = [];

function handleFiles(files) {
    files = [...files];
    files.forEach(file => {
        // Check for duplicates
        if (!selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
        }
    });
    updateFileList();
}

function updateFileList() {
    var fileList = $('#fileList');
    var selectedFilesDiv = $('#selectedFiles');
    var uploadBtn = $('#uploadBtn');
    
    fileList.empty();
    
    if (selectedFiles.length > 0) {
        selectedFilesDiv.show();
        uploadBtn.prop('disabled', false);
        
        selectedFiles.forEach((file, index) => {
            var icon = getFileIcon(file.name);
            var size = formatFileSize(file.size);
            
            var item = $(`
                <li class="list-group-item">
                    <div class="file-info">
                        <i class="${icon}"></i>
                        <span>${escapeHtml(file.name)}</span>
                        <span class="file-size">(${size})</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-link text-danger" onclick="removeFile(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </li>
            `);
            fileList.append(item);
        });
    } else {
        selectedFilesDiv.hide();
        uploadBtn.prop('disabled', true);
    }
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
}

// ============================================
// Upload Form
// ============================================

function initUploadForm() {
    $('#uploadForm').on('submit', function(e) {
        e.preventDefault();
        uploadFiles();
    });
    
    // Reset when modal closes
    $('#uploadModal').on('hidden.bs.modal', function() {
        selectedFiles = [];
        updateFileList();
        $('#uploadProgress').hide();
        $('#uploadBtn').prop('disabled', true);
        $('#fileInput').val('');
    });
}

function uploadFiles() {
    if (selectedFiles.length === 0) return;
    
    var formData = new FormData();
    var folderId = $('input[name="folderId"]').val();
    var enterpriseCode = $('input[name="enterpriseCode"]').val();
    
    if (folderId) formData.append('folderId', folderId);
    formData.append('enterpriseCode', enterpriseCode);
    formData.append('__RequestVerificationToken', $('input[name="__RequestVerificationToken"]').val());
    
    selectedFiles.forEach(file => {
        formData.append('files', file);
    });
    
    $('#uploadProgress').show();
    $('#uploadBtn').prop('disabled', true);
    
    $.ajax({
        url: '/FileManager/Upload',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        xhr: function() {
            var xhr = new window.XMLHttpRequest();
            xhr.upload.addEventListener('progress', function(e) {
                if (e.lengthComputable) {
                    var percent = Math.round((e.loaded / e.total) * 100);
                    $('.progress-bar').css('width', percent + '%');
                    $('#uploadProgressText').text('Đang tải lên... ' + percent + '%');
                }
            }, false);
            return xhr;
        },
        success: function(response) {
            if (response.success) {
                $('#uploadProgressText').text('Tải lên thành công!');
                setTimeout(function() {
                    $('#uploadModal').modal('hide');
                    location.reload();
                }, 1000);
            } else {
                $('#uploadProgressText').text('Có lỗi xảy ra: ' + (response.message || 'Unknown error'));
                $('#uploadBtn').prop('disabled', false);
            }
        },
        error: function() {
            $('#uploadProgressText').text('Có lỗi xảy ra khi tải lên');
            $('#uploadBtn').prop('disabled', false);
        }
    });
}

// ============================================
// New Folder Form
// ============================================

function initNewFolderForm() {
    $('#newFolderForm').on('submit', function(e) {
        e.preventDefault();
        
        var name = $('#folderName').val().trim();
        if (!name) {
            alert('Vui lòng nhập tên thư mục');
            return;
        }
        
        var formData = {
            name: name,
            description: $('#folderDescription').val(),
            parentFolderId: $('input[name="parentFolderId"]').val() || null,
            enterpriseCode: $('input[name="enterpriseCode"]').val(),
            __RequestVerificationToken: $('input[name="__RequestVerificationToken"]').val()
        };
        
        $.ajax({
            url: '/FileManager/CreateFolder',
            type: 'POST',
            data: formData,
            success: function(response) {
                if (response.success) {
                    $('#newFolderModal').modal('hide');
                    location.reload();
                } else {
                    alert(response.message || 'Có lỗi xảy ra');
                }
            },
            error: function() {
                alert('Có lỗi xảy ra khi tạo thư mục');
            }
        });
    });
    
    // Reset form when modal closes
    $('#newFolderModal').on('hidden.bs.modal', function() {
        $('#folderName').val('');
        $('#folderDescription').val('');
    });
}

// ============================================
// Rename Form
// ============================================

function initRenameForm() {
    $('#renameForm').on('submit', function(e) {
        e.preventDefault();
        
        var id = $('#renameItemId').val();
        var type = $('#renameItemType').val();
        var newName = $('#newName').val().trim();
        
        if (!newName) {
            alert('Vui lòng nhập tên mới');
            return;
        }
        
        var url = type === 'folder' ? '/FileManager/RenameFolder' : '/FileManager/RenameFile';
        
        $.ajax({
            url: url,
            type: 'POST',
            data: {
                id: id,
                newName: newName,
                __RequestVerificationToken: $('input[name="__RequestVerificationToken"]').val()
            },
            success: function(response) {
                if (response.success) {
                    $('#renameModal').modal('hide');
                    location.reload();
                } else {
                    alert(response.message || 'Có lỗi xảy ra');
                }
            },
            error: function() {
                alert('Có lỗi xảy ra khi đổi tên');
            }
        });
    });
}

// ============================================
// Folder Operations
// ============================================

function renameFolder(id, name) {
    $('#renameItemId').val(id);
    $('#renameItemType').val('folder');
    $('#newName').val(name);
    $('#renameModal').modal('show');
}

function shareFolder(id, name) {
    // TODO: Implement share dialog
    alert('Tính năng chia sẻ thư mục đang được phát triển');
}

function deleteFolder(id, name) {
    if (confirm('Bạn có chắc chắn muốn xóa thư mục "' + name + '"?\nTất cả file và thư mục con cũng sẽ bị xóa.')) {
        $.ajax({
            url: '/FileManager/DeleteFolder',
            type: 'POST',
            data: {
                id: id,
                __RequestVerificationToken: $('input[name="__RequestVerificationToken"]').val()
            },
            success: function(response) {
                if (response.success) {
                    location.reload();
                } else {
                    alert(response.message || 'Có lỗi xảy ra');
                }
            },
            error: function() {
                alert('Có lỗi xảy ra khi xóa thư mục');
            }
        });
    }
}

// ============================================
// File Operations
// ============================================

function viewSharedFile(id) {
    previewFile(id);
}

/**
 * previewFile — wrapper gọi FilePreview module (khai báo toàn cục trong _Layout.cshtml)
 * Giữ lại tên hàm để tương thích ngược với các view gọi onclick="previewFile(...)"
 */
function previewFile(id, name, extension) {
    FilePreview.open(id, name, extension);
}

function viewSharedFile(id) {
    FilePreview.open(id);
}

function shareFile(id, name) {
    // TODO: Implement share dialog
    alert('Tính năng chia sẻ file đang được phát triển');
}

function deleteFile(id, name) {
    if (confirm('Bạn có chắc chắn muốn xóa file "' + name + '"?')) {
        $.ajax({
            url: '/FileManager/DeleteFile',
            type: 'POST',
            data: {
                id: id,
                __RequestVerificationToken: $('input[name="__RequestVerificationToken"]').val()
            },
            success: function(response) {
                if (response.success) {
                    location.reload();
                } else {
                    alert(response.message || 'Có lỗi xảy ra');
                }
            },
            error: function() {
                alert('Có lỗi xảy ra khi xóa file');
            }
        });
    }
}

// ============================================
// Utility Functions
// ============================================

function getFileIcon(filename) {
    var ext = filename.split('.').pop().toLowerCase();
    var icons = {
        'pdf': 'fas fa-file-pdf text-danger',
        'doc': 'fas fa-file-word text-primary',
        'docx': 'fas fa-file-word text-primary',
        'xls': 'fas fa-file-excel text-success',
        'xlsx': 'fas fa-file-excel text-success',
        'ppt': 'fas fa-file-powerpoint text-warning',
        'pptx': 'fas fa-file-powerpoint text-warning',
        'jpg': 'fas fa-file-image text-info',
        'jpeg': 'fas fa-file-image text-info',
        'png': 'fas fa-file-image text-info',
        'gif': 'fas fa-file-image text-info',
        'mp4': 'fas fa-file-video text-purple',
        'avi': 'fas fa-file-video text-purple',
        'mov': 'fas fa-file-video text-purple',
        'mp3': 'fas fa-file-audio text-pink',
        'wav': 'fas fa-file-audio text-pink',
        'zip': 'fas fa-file-archive text-secondary',
        'rar': 'fas fa-file-archive text-secondary',
        'txt': 'fas fa-file-alt text-muted'
    };
    return icons[ext] || 'fas fa-file text-muted';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}
