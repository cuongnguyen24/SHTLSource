/**
 * FilePreview — Reusable global file preview module
 * ==================================================
 *
 * Khai báo 1 modal <partial name="_FilePreviewModal" /> trong _Layout.cshtml.
 * Sau đó gọi từ bất kỳ trang nào:
 *
 *   FilePreview.open(fileId, fileName, fileExtension);
 *
 *   // Tuỳ chỉnh URL (dùng cho các controller khác ngoài FileManager):
 *   FilePreview.open(fileId, fileName, fileExtension, {
 *       previewUrl:  '/CustomController/Preview?id=' + fileId,
 *       downloadUrl: '/CustomController/Download?id=' + fileId
 *   });
 *
 * Các định dạng hỗ trợ xem trực tiếp:
 *   - Hình ảnh : jpg, jpeg, png, gif, webp, bmp, svg, tiff, tif
 *   - PDF      : pdf
 *   - Video    : mp4, webm, ogg, ogv
 */
var FilePreview = (function () {
    'use strict';

    // ── IDs of elements in _FilePreviewModal.cshtml ──────────────────
    var MODAL_ID   = 'filePreviewModal';
    var TITLE_ID   = 'filePreviewTitle';
    var ICON_ID    = 'filePreviewIcon';
    var META_ID    = 'filePreviewMeta';
    var CONTENT_ID = 'filePreviewContent';
    var INFO_ID    = 'filePreviewInfo';
    var DL_BTN_ID  = 'filePreviewDownloadBtn';

    // ── Extension sets ────────────────────────────────────────────────
    var IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tiff', '.tif'];
    var VIDEO_EXTS = ['.mp4', '.webm', '.ogg', '.ogv'];
    var VIDEO_MIME = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.ogg': 'video/ogg',
        '.ogv': 'video/ogg'
    };

    var FILE_ICONS = {
        '.pdf':  { cls: 'fas fa-file-pdf',        color: '#ef4444' },
        '.doc':  { cls: 'fas fa-file-word',        color: '#3b82f6' },
        '.docx': { cls: 'fas fa-file-word',        color: '#3b82f6' },
        '.xls':  { cls: 'fas fa-file-excel',       color: '#22c55e' },
        '.xlsx': { cls: 'fas fa-file-excel',       color: '#22c55e' },
        '.ppt':  { cls: 'fas fa-file-powerpoint',  color: '#f97316' },
        '.pptx': { cls: 'fas fa-file-powerpoint',  color: '#f97316' },
        '.jpg':  { cls: 'fas fa-file-image',       color: '#06b6d4' },
        '.jpeg': { cls: 'fas fa-file-image',       color: '#06b6d4' },
        '.png':  { cls: 'fas fa-file-image',       color: '#06b6d4' },
        '.gif':  { cls: 'fas fa-file-image',       color: '#06b6d4' },
        '.webp': { cls: 'fas fa-file-image',       color: '#06b6d4' },
        '.svg':  { cls: 'fas fa-file-image',       color: '#06b6d4' },
        '.mp4':  { cls: 'fas fa-file-video',       color: '#a855f7' },
        '.webm': { cls: 'fas fa-file-video',       color: '#a855f7' },
        '.avi':  { cls: 'fas fa-file-video',       color: '#a855f7' },
        '.mov':  { cls: 'fas fa-file-video',       color: '#a855f7' },
        '.mp3':  { cls: 'fas fa-file-audio',       color: '#ec4899' },
        '.wav':  { cls: 'fas fa-file-audio',       color: '#ec4899' },
        '.zip':  { cls: 'fas fa-file-archive',     color: '#94a3b8' },
        '.rar':  { cls: 'fas fa-file-archive',     color: '#94a3b8' },
        '.txt':  { cls: 'fas fa-file-alt',         color: '#94a3b8' }
    };

    // ── Helpers ───────────────────────────────────────────────────────
    function _escape(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text)));
        return div.innerHTML;
    }

    function _normalizeExt(extension, name) {
        if (!extension && name) {
            var parts = name.split('.');
            extension = parts.length > 1 ? '.' + parts.pop() : '';
        }
        if (extension && extension.charAt(0) !== '.') {
            extension = '.' + extension;
        }
        return (extension || '').toLowerCase();
    }

    function _iconInfo(ext) {
        return FILE_ICONS[ext] || { cls: 'fas fa-file', color: '#94a3b8' };
    }

    // ── Content builders ──────────────────────────────────────────────
    function _buildContent(proxyUrl, name, ext, downloadUrl) {
        if (IMAGE_EXTS.indexOf(ext) !== -1) {
            return '<div class="preview-image-wrapper">' +
                '<img src="' + proxyUrl + '" alt="' + _escape(name) + '" class="preview-image"' +
                ' onerror="FilePreview._onError(\'Không thể tải hình ảnh\')" />' +
                '</div>';
        }

        if (ext === '.pdf') {
            return '<iframe src="' + proxyUrl + '" class="preview-pdf" title="' + _escape(name) + '" style="height: 500px;width: 100%;"></iframe>';
        }

        if (VIDEO_EXTS.indexOf(ext) !== -1) {
            var mime = VIDEO_MIME[ext] || 'video/mp4';
            return '<div class="preview-video-wrapper">' +
                '<video class="preview-video" controls autoplay preload="metadata"' +
                ' onerror="FilePreview._onError(\'Không thể phát video\')">' +
                '<source src="' + proxyUrl + '" type="' + mime + '" />' +
                'Trình duyệt không hỗ trợ phát video.' +
                '</video></div>';
        }

        // Unsupported video containers — offer download
        if (['.mov', '.avi', '.mkv', '.wmv', '.flv', '.m4v'].indexOf(ext) !== -1) {
            return '<div class="preview-fallback">' +
                '<i class="fas fa-film" style="font-size:80px;color:#a855f7;opacity:0.7;"></i>' +
                '<h5 class="mt-3 text-light">Định dạng video không hỗ trợ xem trực tiếp</h5>' +
                '<p class="text-muted">Loại file: ' + _escape(ext) + '</p>' +
                '<a href="' + _escape(downloadUrl) + '" class="btn-figma btn-figma-primary mt-2">' +
                '<i class="fas fa-download mr-1"></i> Tải về để xem</a>' +
                '</div>';
        }

        return _fallbackHtml(name, ext, downloadUrl);
    }

    function _fallbackHtml(name, ext, downloadUrl) {
        var info = _iconInfo(ext);
        return '<div class="preview-fallback">' +
            '<i class="' + info.cls + '" style="font-size:80px;color:' + info.color + ';opacity:0.5;"></i>' +
            '<h4 class="text-muted mt-3">Không thể xem trước file này</h4>' +
            '<p class="text-muted" style="font-size:13px;">Loại file: ' + _escape(ext || 'không xác định') + '</p>' +
            (downloadUrl
                ? '<a href="' + _escape(downloadUrl) + '" class="btn-figma btn-figma-secondary mt-2">' +
                  '<i class="fas fa-download mr-1"></i> Tải về</a>'
                : '') +
            '</div>';
    }

    // ── Public API ────────────────────────────────────────────────────

    /**
     * Mở modal xem trước file.
     *
     * @param {string|Guid} id          - ID của file (dùng để build URL mặc định)
     * @param {string}      name        - Tên file hiển thị
     * @param {string}      [extension] - Đuôi file (có hoặc không có dấu chấm). Nếu bỏ qua, tự đoán từ name.
     * @param {object}      [options]   - Tuỳ chọn ghi đè URL
     *   @param {string} options.previewUrl  - URL proxy trả về nội dung file inline
     *   @param {string} options.downloadUrl - URL tải về (Content-Disposition: attachment)
     */
    function open(id, name, extension, options) {
        options = options || {};

        var ext         = _normalizeExt(extension, name);
        var proxyUrl    = options.previewUrl  || '/FileManager/Preview?id='  + id;
        var downloadUrl = options.downloadUrl || '/FileManager/Download?id=' + id;

        var info = _iconInfo(ext);

        // Cập nhật header
        var $titleEl = document.getElementById(TITLE_ID);
        var $iconEl  = document.getElementById(ICON_ID);
        var $metaEl  = document.getElementById(META_ID);
        var $dlBtn   = document.getElementById(DL_BTN_ID);
        var $content = document.getElementById(CONTENT_ID);

        if ($titleEl) $titleEl.textContent = name || 'Xem trước tài liệu';
        if ($iconEl)  { $iconEl.className = info.cls; $iconEl.style.color = info.color; }
        if ($metaEl)  $metaEl.textContent = ext ? ext.replace('.', '').toUpperCase() : '';
        if ($dlBtn)   $dlBtn.setAttribute('href', downloadUrl);

        if ($content) $content.innerHTML = _buildContent(proxyUrl, name, ext, downloadUrl);

        var $modal = typeof $ !== 'undefined' ? $('#' + MODAL_ID) : null;
        if ($modal) {
            $modal.modal('show');

            // Dừng video khi đóng modal
            $modal.one('hidden.bs.modal', function () {
                $content.querySelectorAll('video').forEach(function (v) {
                    v.pause();
                    v.src = '';
                    v.load();
                });
                $content.innerHTML = '';
            });
        }
    }

    /** Hiển thị lỗi bên trong modal (gọi từ onerror attributes) */
    function _onError(msg) {
        var el = document.getElementById(CONTENT_ID);
        if (el) {
            el.innerHTML =
                '<div class="preview-fallback">' +
                '<i class="fas fa-exclamation-triangle text-warning" style="font-size:60px;"></i>' +
                '<h5 class="mt-3 text-light">' + _escape(msg) + '</h5>' +
                '</div>';
        }
    }

    return {
        open:    open,
        _onError: _onError
    };
}());
