/**
 * FILE UPLOAD COMPONENT — Reusable Drop Zone & File Queue
 *
 * Usage:
 *   // Mode 1: Drop Zone (drag-drop + button)
 *   var uploader = new FileUploadComponent({
 *       dropZoneId:  'dropZone',        // id of the drop zone container
 *       fileInputId: 'attachmentFiles', // id of the <input type="file">
 *       fileQueueId: 'fileQueue',       // id of the queue container
 *       maxFiles:    10,                // max number of files (default 10)
 *       maxSizeMB:   10                 // max size per file in MB (default 10)
 *   });
 *
 *   // Mode 2: Simple (button only, no drag-drop)
 *   var uploader = new FileUploadComponent({
 *       dropZoneId:  'uploadZone',
 *       fileInputId: 'attachmentFiles',
 *       fileQueueId: 'fileQueue',
 *       maxFiles:    5,
 *       maxSizeMB:   10,
 *       simple:      true               // enables button-only mode
 *   });
 */

(function (window) {
    'use strict';

    function FileUploadComponent(options) {
        var self = this;
        self.dropZone = document.getElementById(options.dropZoneId || 'dropZone');
        self.fileInput = document.getElementById(options.fileInputId || 'attachmentFiles');
        self.fileQueue = document.getElementById(options.fileQueueId || 'fileQueue');
        self.maxFiles = options.maxFiles || 10;
        self.maxSize = (options.maxSizeMB || 10) * 1024 * 1024;
        self.simple = options.simple === true;
        self.files = [];

        if (!self.fileInput || !self.fileQueue) return;

        self._bindEvents();
    }

    // ── Event binding ──────────────────────────────────────────────
    FileUploadComponent.prototype._bindEvents = function () {
        var self = this;

        // File input change (shared by both modes)
        self.fileInput.addEventListener('change', function () {
            self.addFiles(Array.from(self.fileInput.files));
            self.fileInput.value = '';
        });

        // Simple mode: no drag-drop events needed
        if (self.simple || !self.dropZone) return;

        // Prevent browser defaults for drag events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (evt) {
            self.dropZone.addEventListener(evt, prevent, false);
            document.body.addEventListener(evt, prevent, false);
        });

        // Visual feedback
        ['dragenter', 'dragover'].forEach(function (evt) {
            self.dropZone.addEventListener(evt, function () { self.dropZone.classList.add('drag-over'); });
        });
        ['dragleave', 'drop'].forEach(function (evt) {
            self.dropZone.addEventListener(evt, function () { self.dropZone.classList.remove('drag-over'); });
        });

        // Click on zone opens file picker (ignore label/button clicks already handled)
        self.dropZone.addEventListener('click', function (e) {
            if (e.target !== self.fileInput && !e.target.closest('label') && !e.target.closest('button')) {
                self.fileInput.click();
            }
        });

        // Dropped files
        self.dropZone.addEventListener('drop', function (e) {
            self.addFiles(Array.from(e.dataTransfer.files));
        });

        function prevent(e) { e.preventDefault(); e.stopPropagation(); }
    };

    // ── Public API ─────────────────────────────────────────────────
    FileUploadComponent.prototype.addFiles = function (newFiles) {
        var self = this;
        newFiles.forEach(function (file) {
            if (self.files.length >= self.maxFiles) {
                if (self.maxFiles === 1) {
                    // If max is 1, replace the existing file automatically
                    self.files = [];
                } else {
                    toastr ? toastr.warning('Chỉ được đính kèm tối đa ' + self.maxFiles + ' file.')
                        : alert('Chỉ được đính kèm tối đa ' + self.maxFiles + ' file.');
                    return;
                }
            }
            if (file.size > self.maxSize) {
                var label = (self.maxSize / 1024 / 1024) + 'MB';
                toastr ? toastr.warning('File "' + file.name + '" vượt quá ' + label + '.')
                    : alert('File "' + file.name + '" vượt quá ' + label + '.');
                return;
            }
            if (!self.files.some(function (f) { return f.name === file.name && f.size === file.size; })) {
                self.files.push(file);
            }
        });
        self._sync();
        self._render();
    };

    FileUploadComponent.prototype.removeFile = function (idx) {
        this.files.splice(idx, 1);
        this._sync();
        this._render();
    };

    FileUploadComponent.prototype.clear = function () {
        this.files = [];
        this._sync();
        this._render();
    };

    FileUploadComponent.prototype.getFiles = function () {
        return this.files;
    };

    // ── Internal helpers ───────────────────────────────────────────
    FileUploadComponent.prototype._sync = function () {
        var dt = new DataTransfer();
        this.files.forEach(function (f) { dt.items.add(f); });
        this.fileInput.files = dt.files;
    };

    FileUploadComponent.prototype._render = function () {
        var self = this;
        var q = self.fileQueue;
        q.innerHTML = '';
        if (self.files.length === 0) return;

        // Header
        var header = document.createElement('div');
        header.className = 'file-queue-header mb-2';
        header.innerHTML = '<h6 class="text-muted mb-0"><span class="badge badge-primary mr-2">'
            + self.files.length + '</span>file đã chọn</h6>';
        q.appendChild(header);

        // List
        var ul = document.createElement('ul');
        ul.className = 'list-group';

        self.files.forEach(function (file, idx) {
            var li = document.createElement('li');
            li.className = 'list-group-item file-queue-item';
            li.innerHTML =
                '<i class="' + _getIcon(file.name) + ' fa-lg flex-shrink-0"></i>' +
                '<div class="flex-grow-1 d-flex align-items-center justify-content-between">' +
                '<span class="file-name" title="' + _esc(file.name) + '">' + _esc(file.name) + '</span>' +
                '<span class="file-size text-muted ml-3">' + _fmtSize(file.size) + '</span>' +
                '</div>' +
                '<button type="button" class="btn btn-sm btn-link text-danger flex-shrink-0 remove-btn" data-idx="' + idx + '" title="Xóa">' +
                '<i class="fas fa-times"></i>' +
                '</button>';
            ul.appendChild(li);
        });

        q.appendChild(ul);

        q.querySelectorAll('.remove-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                self.removeFile(parseInt(this.dataset.idx));
            });
        });
    };

    // ── Static utilities ───────────────────────────────────────────
    var _iconMap = {
        pdf: 'fas fa-file-pdf text-danger',
        doc: 'fas fa-file-word text-primary',
        docx: 'fas fa-file-word text-primary',
        xls: 'fas fa-file-excel text-success',
        xlsx: 'fas fa-file-excel text-success',
        ppt: 'fas fa-file-powerpoint text-warning',
        pptx: 'fas fa-file-powerpoint text-warning',
        jpg: 'fas fa-file-image text-info',
        jpeg: 'fas fa-file-image text-info',
        png: 'fas fa-file-image text-info',
        gif: 'fas fa-file-image text-info',
        zip: 'fas fa-file-archive text-secondary',
        rar: 'fas fa-file-archive text-secondary'
    };

    function _getIcon(name) {
        var ext = name.split('.').pop().toLowerCase();
        return _iconMap[ext] || 'fas fa-file text-muted';
    }

    function _fmtSize(b) {
        if (b < 1024) return b + ' B';
        if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
        return (b / 1048576).toFixed(2) + ' MB';
    }

    function _esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    window.FileUploadComponent = FileUploadComponent;
})(window);
