// ============================================================
// FilePreview — Global File Preview Utility
// Mở modal #filePreviewModal với nội dung file từ signed URL.
// Sử dụng: FilePreview.open(signedUrl, fileName, fileSize, mimeType)
// ============================================================
var FilePreview = {
    _extIconMap: {
        pdf: 'fa-file-pdf text-danger',
        doc: 'fa-file-word text-primary', docx: 'fa-file-word text-primary',
        xls: 'fa-file-excel text-success', xlsx: 'fa-file-excel text-success',
        ppt: 'fa-file-powerpoint text-warning', pptx: 'fa-file-powerpoint text-warning',
        jpg: 'fa-file-image text-info', jpeg: 'fa-file-image text-info',
        png: 'fa-file-image text-info', gif: 'fa-file-image text-info',
        bmp: 'fa-file-image text-info', webp: 'fa-file-image text-info',
        svg: 'fa-file-image text-info',
        mp4: 'fa-file-video text-purple', webm: 'fa-file-video text-purple',
        zip: 'fa-file-archive text-secondary', rar: 'fa-file-archive text-secondary',
        txt: 'fa-file-alt text-secondary', csv: 'fa-file-csv text-success'
    },
    _imageExts: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'],
    _pdfExts: ['pdf'],
    _videoExts: ['mp4', 'webm', 'ogg'],

    _formatSize: function (bytes) {
        if (!bytes || bytes <= 0) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    },

    _getIcon: function (ext) {
        return 'fas ' + (FilePreview._extIconMap[ext] || 'fa-file text-muted');
    },

    _buildContent: function (url, ext, fileName) {
        if (FilePreview._pdfExts.indexOf(ext) >= 0) {
            return '<iframe src="' + url + '" style="width:100%;height:75vh;border:none;" allowfullscreen></iframe>';
        }
        if (FilePreview._imageExts.indexOf(ext) >= 0) {
            return '<div style="text-align:center;padding:16px;background:#0f172a;min-height:400px;display:flex;align-items:center;justify-content:center;">'
                + '<img src="' + url + '" alt="' + $('<div>').text(fileName).html() + '" style="max-width:100%;max-height:75vh;object-fit:contain;border-radius:4px;">'
                + '</div>';
        }
        if (FilePreview._videoExts.indexOf(ext) >= 0) {
            return '<video controls style="width:100%;max-height:75vh;background:#000;">'
                + '<source src="' + url + '"><p style="color:#fff;padding:16px;">Trình duyệt không hỗ trợ phát video.</p>'
                + '</video>';
        }
        return '<div style="padding:48px 24px;text-align:center;color:#94a3b8;">'
            + '<i class="fas fa-eye-slash" style="font-size:48px;margin-bottom:16px;display:block;"></i>'
            + '<p style="font-size:15px;margin-bottom:8px;">Định dạng <strong>.' + ext + '</strong> không hỗ trợ xem trực tiếp.</p>'
            + '<p style="font-size:13px;">Bạn có thể tải file về để mở bằng ứng dụng phù hợp.</p>'
            + '</div>';
    },

    open: function (signedUrl, fileName, fileSize, mimeType) {
        var ext = (fileName.split('.').pop() || '').toLowerCase();
        var sizeStr = FilePreview._formatSize(fileSize);
        var metaParts = [];
        if (ext) metaParts.push(ext.toUpperCase());
        if (sizeStr) metaParts.push(sizeStr);

        $('#filePreviewIcon').attr('class', FilePreview._getIcon(ext));
        $('#filePreviewTitle').text(fileName);
        $('#filePreviewMeta').text(metaParts.join(' · '));
        $('#filePreviewContent').html(FilePreview._buildContent(signedUrl, ext, fileName));
        $('#filePreviewInfo').text(sizeStr ? 'Kích thước: ' + sizeStr : '');
        $('#filePreviewDownloadBtn').attr('href', signedUrl).attr('target', '_blank');
        $('#filePreviewModal').modal('show');
    }
};

var Main = {
    init: function () {
        this.upEvent();
        this.onEvent();
    },

    upEvent: function (container) {
        if (Utils.isEmpty(container))
            container = jQuery(document);

        Utils.initDatePickerFlat(container);
        Utils.renderSelect2Ajax(container);
    },

    onEvent: function () {

        jQuery(document).on("submit", ".quickSearch", function () {
            let form = $(this);
            let url = form.attr("action");
            let method = form.attr("method");
            let target = form.attr("data-target");
            let data = Utils.getSerialize(form);

            jQuery.ajax({
                type: method,
                async: true,
                url: url,
                data: data,
                beforeSend: function () {
                    Utils.toggleLoading(true, $(target));
                },
                success: function (rs) {
                    try {
                        if (form.attr("data-state") != "0") {
                            window.history.pushState(null, rs.title, Utils.formBuilderQString(form));
                        }
                    } catch (e) {
                        console.log(e);
                    }

                    $(target).html(rs);
                },
                complete: function () {
                    Utils.toggleLoading(false, $(target));
                }
            });
            return false;
        });

        jQuery(document).on("submit", ".quickSubmit", function (e) {
            e.preventDefault();
            const form = $(this);
            if (form.valid && !form.valid()) {
                return false;
            }

            let url = form.attr("action");
            let method = form.attr("method");
            let isReload = form.attr("success-on-refresh") !== "false";
            let isMultipart = (form.attr("enctype") || "").toLowerCase() === "multipart/form-data";

            debugger;
            let ajaxData = isMultipart ? new FormData(form[0]) : Utils.getSerialize(form);

            jQuery.ajax({
                type: method,
                async: true,
                url: url,
                data: ajaxData,
                processData: !isMultipart,
                contentType: isMultipart ? false : undefined,
                beforeSend: function () {
                    Utils.toggleLoading(true);
                },
                error: function () {
                    Utils.toggleLoading(false);
                },
                success: function (rs) {
                    if (typeof rs === "object" && typeof rs.type !== undefined) {
                        if (rs.type === "Success") {
                            if (isReload) {
                                if (!Utils.isEmpty(rs.redirectUrl)) {
                                    setTimeout(function () {
                                        window.location.href = rs.redirectUrl;
                                    }, 1500);
                                } else {
                                    setTimeout(function () {
                                        window.location.reload();
                                    }, 1500);
                                }
                            }
                        }

                        FigmaUI.toast(rs.message, rs.type.toLowerCase());
                    }
                },
                complete: function () {
                    Utils.toggleLoading(false);
                }
            });
            return false;
        });

        jQuery(document).on("click", ".onSetPageIndex", function (e) {
            let btn = $(this);
            let form = jQuery(btn.attr("data-form"));
            let data = Utils.getSerialize(form);
            let url = form.attr("action");
            let target = form.attr("data-target");
            data.pageNumber = btn.attr("data-page");
            data.pageSize = btn.attr("data-page-size");

            if (btn.parent().hasClass('active')) {
                btn.blur();
                return false;
            }

            jQuery.ajax({
                type: "POST",
                async: false,
                url: url,
                data: data,
                beforeSend: function () {
                    Utils.toggleLoading(true, $(target));
                },
                success: function (rs) {
                    try {
                        if (form.attr("data-state") != "0") {
                            window.history.pushState(null, rs.title, Utils.formBuilderQString(form, data));
                        }
                    } catch (e) {
                        console.log(e);
                    }

                    $(target).html(rs);
                },
                complete: function () {
                    Utils.toggleLoading(false, $(target));
                }
            });
            return false;
        });

        jQuery(document).on("change", ".onChangePageSize", function () {
            let select = $(this);
            let form = jQuery(select.attr("data-form"));
            let data = Utils.getSerialize(form);
            let url = form.attr("action");
            let target = form.attr("data-target");
            data.pageNumber = 1;
            data.pageSize = select.val();
            jQuery.ajax({
                type: "POST",
                async: false,
                url: url,
                data: data,
                beforeSend: function () {
                    Utils.toggleLoading(true, $(target));
                },
                success: function (rs) {
                    try {
                        if (form.attr("data-state") != "0") {
                            window.history.pushState(null, rs.title, Utils.formBuilderQString(form, data));
                        }
                    } catch (e) {
                        console.log(e);
                    }

                    $(target).html(rs);
                },
                complete: function () {
                    Utils.toggleLoading(false, $(target));
                }
            });
            return false;
        });

        jQuery(document).on("change", ".sorting", function (e) {
            e.preventDefault();
            const $el = $(this);
            const table = $el.closest("table");
            if (!table) return;

            let key = jQuery($el.attr("data-key"));
            if (!key) return;

            const form = jQuery(table.attr("data-form-search"));
            if (!form) return;

            let direction = $el.data("direction") || "asc";
            direction = direction === "asc" ? "desc" : "asc";

            // reset direction của các cột khác
            $el.closest("tr").find("th").data("direction", null);

            // set direction cho cột hiện tại
            $el.data("direction", direction);

            let data = Utils.getSerialize(form);
            data["sortBy"] = key;
            data["sortOrder"] = direction;

            let url = form.attr("action");
            let method = form.attr("method");
            let target = form.attr("data-target");

            jQuery.ajax({
                type: method,
                async: true,
                url: url,
                data: data,
                beforeSend: function () {
                    Utils.toggleLoading(true, $(target));
                },
                success: function (rs) {
                    try {
                        if (form.attr("data-state") != "0") {
                            window.history.pushState(null, null, Utils.formBuilderQString(form));
                        }
                    } catch (e) {
                        console.log(e);
                    }

                    $(target).html(rs);
                },
                complete: function () {
                    Utils.toggleLoading(false, $(target));
                }
            });
            return false;
        });

        jQuery(document).on("click", ".quickDelete", function () {
            let id = $(this).attr("data-id");
            let url = $(this).attr("href") || $(this).data("url");

            let confirmHeader = jQuery(this).attr("data-comfirm-message") || 'Bạn có chắc chắn muốn xóa: ';
            let confirmMessage = $(this).attr("data-name");

            Utils.confirmAction(
                confirmHeader,
                confirmMessage,
                'Xóa',
                'Hủy',
                function () {
                    let someData = {};
                    let method = "POST";
                    let ssCallBack = function (rs) {
                        if (typeof rs === "object" && typeof rs.type !== undefined) {
                            if (rs.type === "Success") {
                                if (!Utils.isEmpty(rs.redirectUrl)) {
                                    setTimeout(function () {
                                        window.location.href = rs.redirectUrl;
                                    }, 1500);
                                } else {
                                    setTimeout(function () {
                                        window.location.reload();
                                    }, 1500);
                                }
                            }

                            FigmaUI.toast(rs.message, rs.type.toLowerCase());
                        } else {
                            FigmaUI.toast(rs);
                        }
                    };
                    Utils.CustAjaxCall(someData, method, url, "json", ssCallBack, "");
                });
            return false;
        });

        // ============================================================
        // Preview file — click .preview-file[data-id][data-url]
        // ============================================================
        jQuery(document).on('click', '.preview-file', function (e) {
            e.preventDefault();
            var $el = jQuery(this);
            if ($el.data('loading')) return;

            var id = $el.data('id');
            var url = $el.data('url');
            if (!id || !url) { toastr.warning('Không tìm thấy thông tin file.'); return; }

            var originalHtml = $el.html();
            $el.data('loading', true).html('<i class="fas fa-spinner fa-spin"></i>').prop('disabled', true);

            jQuery.ajax({
                type: 'GET',
                url: url,
                data: { id: id },
                success: function (resp) {
                    if (!resp || !resp.isSuccess) {
                        toastr.error((resp && resp.message) || 'Không thể tải thông tin file.');
                        return;
                    }
                    FilePreview.open(resp.signedUrl, resp.fileName, resp.extension, resp.mimeType);
                },
                error: function () {
                    toastr.error('Lỗi kết nối server. Vui lòng thử lại.');
                },
                complete: function () {
                    $el.html(originalHtml).prop('disabled', false).data('loading', false);
                }
            });
        });

        // ============================================================
        // Download file — click .download-file[data-id][data-url]
        // ============================================================
        jQuery(document).on('click', '.download-file', function (e) {
            e.preventDefault();
            var $el = jQuery(this);
            if ($el.data('loading')) return;

            var id = $el.data('id');
            var url = $el.data('url');
            if (!id || !url) { toastr.warning('Không tìm thấy thông tin file.'); return; }

            var originalHtml = $el.html();
            $el.data('loading', true).html('<i class="fas fa-spinner fa-spin"></i>').prop('disabled', true);

            jQuery.ajax({
                type: 'GET',
                url: url,
                data: { id: id },
                success: function (resp) {
                    if (!resp || !resp.isSuccess) {
                        toastr.error((resp && resp.message) || 'Không thể tải file.');
                        return;
                    }
                    var a = document.createElement('a');
                    a.href = resp.signedUrl;
                    a.download = resp.fileName || 'download';
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                },
                error: function () {
                    toastr.error('Lỗi kết nối server. Vui lòng thử lại.');
                },
                complete: function () {
                    $el.html(originalHtml).prop('disabled', false).data('loading', false);
                }
            });
        });

        // ============================================================
        // Quick Modal — click .quickModal[data-url]
        // Load PartialView HTML via AJAX GET và hiển thị trong #commonModal.
        // Attributes:
        //   data-url   = URL trả về HTML (PartialView)
        //   data-title = Tiêu đề modal (tuỳ chọn, mặc định "Chi tiết")
        //   data-size  = Bootstrap size: sm | md | lg | xl (mặc định "lg")
        // ============================================================
        jQuery(document).on('click', '.quickModal', function (e) {
            e.preventDefault();
            const $el = jQuery(this);
            if ($el.data('loading')) return;

            let url = $el.data('url');
            let method = $el.data("method") || "GET";
            let data = {};

            const $modal = $('#commonModal');

            const callback = function (rs) {
                if (rs.type != undefined && rs.type != "Success") {
                    if (rs.type == "Error") {
                        setTimeout(function () {
                            window.location.reload();
                        }, 1500);
                    }

                    FigmaUI.toast(rs.message, rs.type.toLowerCase());
                    return false;
                };

                $modal.html(rs);
                // Init select2-ajax nếu có trong nội dung vừa load
                Utils.renderSelect2Ajax($modal);
                Utils.initSelect2($modal);
                Utils.initDatePickerFlat($modal);
                Utils.openModal($modal);
                // Notify listeners that commonModal content was refreshed
                $(document).trigger('commonModal.loaded');
            }
            Utils.CustAjaxCall(data, method, url, "html", callback, "");

            return false;
        });
    }
}

jQuery(document).ready(function () {
    Main.init();
});