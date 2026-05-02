/**
 * GPXD Phase 1 — Chi tiết hồ sơ + Tài liệu + Kết quả/OCR
 * View: Views/CapPhepXayDung/ChiTiet.cshtml
 */
(function ($) {
    'use strict';

    if (!window.gpxdDetailConfig) return;
    var Cfg = window.gpxdDetailConfig;

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function getAntiForgeryToken() { return $('input[name="__RequestVerificationToken"]').val() || ''; }
    function showError(m) { if (window.toastr) toastr.error(m); else alert(m); }
    function showSuccess(m) { if (window.toastr) toastr.success(m); else alert(m); }

    function loadAttachments() {
        $.ajax({
            url: Cfg.urls.getAttachments + '/' + Cfg.id,
            type: 'GET',
            success: function (resp) {
                var $box = $('#gpxdAttachmentList');
                if (!resp || !resp.isSuccess || !Array.isArray(resp.data)) {
                    $box.html('<div class="text-muted text-center py-2">Không có tài liệu.</div>');
                    return;
                }
                if (resp.data.length === 0) {
                    $box.html('<div class="text-muted text-center py-2">Chưa có tài liệu.</div>');
                    return;
                }
                var html = '<ul class="list-group list-group-flush">';
                resp.data.forEach(function (a) {
                    var downloadUrl = Cfg.urls.downloadAttachment + '/' + a.fileId;
                    
                    html += '<li class="list-group-item d-flex justify-content-between align-items-center py-2 px-0" style="font-size:13px; background:transparent; border-bottom:1px solid #f1f5f9;">';
                    html += '  <div class="d-flex align-items-center flex-fill min-width-0">';
                    html += '    <i class="fas fa-file-alt text-muted mr-2" style="font-size:16px;"></i>';
                    html += '    <div class="text-truncate">';
                    html += '      <div class="font-weight-bold text-dark text-truncate" title="' + escapeHtml(a.tenFile) + '">' + escapeHtml(a.tenFile) + '</div>';
                    html += '      <div class="text-muted" style="font-size:11px;">' + (a.kichThuocByte / 1024).toFixed(1) + ' KB • ' + escapeHtml(a.nguon) + '</div>';
                    html += '    </div>';
                    html += '  </div>';
                    html += '  <div class="ml-2">';
                    html += '    <a href="' + downloadUrl + '" class="btn btn-sm btn-light text-primary" title="Tải xuống" style="width:32px; height:32px; border-radius:6px; display:flex; align-items:center; justify-content:center; border:1px solid #e2e8f0;">';
                    html += '      <i class="fas fa-download"></i>';
                    html += '    </a>';
                    html += '  </div>';
                    html += '</li>';
                });
                html += '</ul>';
                $box.html(html);
            },
            error: function () { $('#gpxdAttachmentList').html('<div class="text-danger text-center py-2">Lỗi tải tài liệu.</div>'); }
        });
    }

    function loadResult() {
        $.ajax({
            url: Cfg.urls.getResult + '/' + Cfg.id,
            type: 'GET',
            success: function (resp) {
                var $box = $('#gpxdResultSection');
                if (resp && resp.isSuccess && resp.data) {
                    var r = resp.data;
                    var revokedBadge = r.isRevoked
                        ? '<span class="badge badge-danger ml-1">Đã thu hồi</span>'
                        : '<span class="badge badge-success ml-1">Còn hiệu lực</span>';
                    $box.html(
                        '<dl class="row mb-2">' +
                        '<dt class="col-sm-5">Số GPXD</dt><dd class="col-sm-7"><strong>' + escapeHtml(r.soGpxd) + '</strong> ' + revokedBadge + '</dd>' +
                        '<dt class="col-sm-5">Ngày ký</dt><dd class="col-sm-7">' + escapeHtml(String(r.ngayKy || '').substring(0, 10)) + '</dd>' +
                        '<dt class="col-sm-5">Ngày cấp</dt><dd class="col-sm-7">' + escapeHtml(String(r.ngayCap || '').substring(0, 10)) + '</dd>' +
                        '<dt class="col-sm-5">Ngày hết hạn</dt><dd class="col-sm-7">' + escapeHtml(String(r.ngayHetHan || '').substring(0, 10)) + '</dd>' +
                        '<dt class="col-sm-5">Người ký</dt><dd class="col-sm-7">' + escapeHtml(r.nguoiKy || '—') + '</dd>' +
                        '<dt class="col-sm-5">Chức vụ</dt><dd class="col-sm-7">' + escapeHtml(r.chucVuNguoiKy || '—') + '</dd>' +
                        '<dt class="col-sm-5">File PDF đã ký</dt><dd class="col-sm-7">' + escapeHtml(r.filePdfFileName || '—') + '</dd>' +
                        '<dt class="col-sm-5">Độ tin cậy TB</dt><dd class="col-sm-7">' + escapeHtml(String(r.doTinCayTrungBinh)) + '%</dd>' +
                        '</dl>'
                    );
                } else if (Cfg.trangThai === 'ChoXacNhanOcr') {
                    $box.html(
                        '<div class="text-muted text-center py-2" style="font-size:12px;">' +
                        '<i class="fas fa-hourglass-half mr-1"></i>Đang chờ xác nhận kết quả OCR. ' +
                        'Bấm <strong>Thực hiện OCR</strong> ở khung file để chạy/chạy lại.' +
                        '</div>'
                    );
                } else {
                    $box.html('<div class="text-muted text-center py-2">Chưa có kết quả GPXD.</div>');
                }
            },
            error: function () { $('#gpxdResultSection').html('<div class="text-danger text-center py-2">Lỗi tải kết quả.</div>'); }
        });
    }

    function bindEvents() {
        // Start processing
        $(document).on('click', '#gpxdBtnStartProcessing', function () {
            var id = $(this).data('id') || Cfg.id;
            $.ajax({
                url: Cfg.urls.startProcessing + '/' + id,
                type: 'POST',
                headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                success: function (resp) {
                    if (resp && resp.isSuccess) { showSuccess('Đã chuyển sang Đang xử lý.'); setTimeout(function () { location.reload(); }, 600); }
                    else showError((resp && resp.message) || 'Thao tác thất bại.');
                },
                error: function () { showError('Lỗi kết nối.'); }
            });
        });

        // Delete attachment
        $('#gpxdAttachmentList').on('click', 'button[data-action="del-att"]', function () {
            var id = $(this).data('id');
            $.ajax({
                url: Cfg.urls.deleteAttachment + '/' + id,
                type: 'POST',
                headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                success: function (resp) {
                    if (resp && resp.isSuccess) { showSuccess('Đã xoá.'); loadAttachments(); }
                    else showError((resp && resp.message) || 'Không xoá được.');
                }
            });
        });

        // Confirm OCR (legacy inline form — kept for backward compat, but new flow uses OCRResult page)
        $(document).on('submit', '#gpxdConfirmOcrForm', function (e) {
            e.preventDefault();
            var $f = $(this);
            var raw = $f.serializeArray(); var p = {};
            raw.forEach(function (kv) { p[kv.name] = kv.value; });
            $.ajax({
                url: Cfg.urls.confirmOcr + '/' + Cfg.id,
                type: 'POST',
                contentType: 'application/json; charset=utf-8',
                headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                data: JSON.stringify(p),
                success: function (resp) {
                    if (resp && resp.isSuccess) { showSuccess('Đã xác nhận OCR.'); setTimeout(function () { location.reload(); }, 600); }
                    else showError((resp && resp.message) || 'Xác nhận thất bại.');
                },
                error: function () { showError('Lỗi kết nối.'); }
            });
        });

        // Reject OCR
        $(document).on('click', '#gpxdBtnRejectOcr', function () {
            $.ajax({
                url: Cfg.urls.rejectOcr + '/' + Cfg.id,
                type: 'POST',
                headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                success: function (resp) {
                    if (resp && resp.isSuccess) { showSuccess('Đã từ chối.'); setTimeout(function () { location.reload(); }, 600); }
                    else showError((resp && resp.message) || 'Thao tác thất bại.');
                }
            });
        });

        // Approve dossier (workflow: ChoXuLy/DangXuLy → ChoKySo)
        $(document).on('click', '#gpxdBtnApprove', function () {
            var id = $(this).data('id') || Cfg.id;
            $.ajax({
                url: Cfg.urls.approve + '/' + id,
                type: 'POST',
                headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                success: function (resp) {
                    if (resp && resp.isSuccess) { showSuccess('Đã duyệt hồ sơ.'); setTimeout(function () { location.reload(); }, 600); }
                    else showError((resp && resp.message) || 'Duyệt thất bại.');
                },
                error: function () { showError('Lỗi kết nối.'); }
            });
        });

        // Reject dossier — mở modal (không dùng prompt)
        $(document).on('click', '#gpxdBtnReject', function () {
            var id = $(this).data('id') || Cfg.id;
            $('#gpxdRejectModal').data('dossier-id', id);
            $('#gpxdRejectReason').val('');
            $('#gpxdRejectReasonError').addClass('d-none').text('');
            $('#gpxdRejectModal').modal('show');
            setTimeout(function () { $('#gpxdRejectReason').trigger('focus'); }, 250);
        });

        // Submit reject từ modal
        $(document).on('click', '#gpxdRejectModalSubmit', function () {
            var $btn = $(this);
            var id = $('#gpxdRejectModal').data('dossier-id');
            var reason = ($('#gpxdRejectReason').val() || '').trim();
            var $err = $('#gpxdRejectReasonError');
            if (reason.length < 5) {
                $err.removeClass('d-none').text('Lý do phải có ít nhất 5 ký tự.');
                $('#gpxdRejectReason').trigger('focus');
                return;
            }
            $err.addClass('d-none').text('');
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');
            $.ajax({
                url: Cfg.urls.reject + '/' + id,
                type: 'POST',
                contentType: 'application/json; charset=utf-8',
                headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                data: JSON.stringify({ lyDo: reason }),
                success: function (resp) {
                    if (resp && resp.isSuccess) {
                        $('#gpxdRejectModal').modal('hide');
                        showSuccess('Đã từ chối hồ sơ.');
                        setTimeout(function () { location.reload(); }, 600);
                    } else {
                        $btn.prop('disabled', false).html('<i class="fas fa-check mr-1"></i> Xác nhận từ chối');
                        showError((resp && resp.message) || 'Thao tác thất bại.');
                    }
                },
                error: function () {
                    $btn.prop('disabled', false).html('<i class="fas fa-check mr-1"></i> Xác nhận từ chối');
                    showError('Lỗi kết nối.');
                }
            });
        });

        // Tải mẫu GPXD: trigger download (browser handles file save) + reload sau khi backend đã chuyển trạng thái
        $(document).on('click', '#gpxdBtnDownloadTemplate', function () {
            var id = $(this).data('id') || Cfg.id;
            if (!Cfg.urls.downloadTemplate) { showError('Thiếu cấu hình URL.'); return; }
            // browser navigates to download endpoint — file sẽ được lưu.
            window.location.href = Cfg.urls.downloadTemplate + '/' + id;
            // reload sau 2.5s để cập nhật UI.
            setTimeout(function () { location.reload(); }, 2500);
        });

        // ============ File đính kèm (OCR) — Upload modal + Trigger OCR ============

        // Mở modal upload PDF ký số
        $(document).on('click', '#gpxdBtnOpenUploadModal', function () {
            // reset form state
            var $err = $('#gpxdSignedPdfError').addClass('d-none').text('');
            var fi = document.getElementById('gpxdSignedPdfFile');
            if (fi) fi.value = '';
            $('#gpxdSelectedFile').addClass('d-none').text('');
            $('#gpxdBtnSubmitUpload').prop('disabled', false).html('<i class="fas fa-upload"></i> Upload &amp; Chạy OCR');
            $('#gpxdUploadSignedModal').modal('show');
        });

        // Click "chọn file" trong dropzone
        // Dùng stopPropagation để tránh trigger kép (click → input.click() → bubble lại → trigger lần 2)
        $(document).on('click', '#gpxdChooseFile', function (e) {
            e.stopPropagation();
            $('#gpxdSignedPdfFile').trigger('click');
        });
        $(document).on('click', '#gpxdDropZone', function (e) {
            // tránh trigger khi click vào chính input ẩn
            if (e.target && e.target.id === 'gpxdSignedPdfFile') return;
            // tránh trigger khi click vào nút #gpxdChooseFile (handler riêng đã xử lý)
            if (e.target && $(e.target).closest('#gpxdChooseFile').length) return;
            e.stopPropagation();
            $('#gpxdSignedPdfFile').trigger('click');
        });

        // Drag & drop
        $(document).on('dragover', '#gpxdDropZone', function (e) {
            e.preventDefault(); e.stopPropagation();
            $(this).css({ 'border-color': '#3b82f6', 'background': '#eff6ff' });
        });
        $(document).on('dragleave drop', '#gpxdDropZone', function (e) {
            e.preventDefault(); e.stopPropagation();
            $(this).css({ 'border-color': '#cbd5e1', 'background': '#f8fafc' });
        });
        $(document).on('drop', '#gpxdDropZone', function (e) {
            var files = e.originalEvent && e.originalEvent.dataTransfer && e.originalEvent.dataTransfer.files;
            if (files && files.length > 0) {
                var fi = document.getElementById('gpxdSignedPdfFile');
                if (fi) {
                    fi.files = files;
                    $(fi).trigger('change');
                }
            }
        });

        // Display selected file name
        $(document).on('change', '#gpxdSignedPdfFile', function () {
            var f = this.files && this.files[0];
            var $box = $('#gpxdSelectedFile');
            if (f) {
                $box.removeClass('d-none').html('<i class="fas fa-file-pdf text-primary mr-1"></i>' + escapeHtml(f.name) + ' <span class="text-muted">(' + (f.size / 1024 / 1024).toFixed(2) + ' MB)</span>');
            } else {
                $box.addClass('d-none').text('');
            }
        });

        // Submit upload từ modal → POST file → redirect OCRResult
        $(document).on('click', '#gpxdBtnSubmitUpload', function () {
            var $btn = $(this);
            var $err = $('#gpxdSignedPdfError').addClass('d-none').text('');
            var fi = document.getElementById('gpxdSignedPdfFile');
            var file = fi && fi.files && fi.files[0];
            if (!file) {
                $err.removeClass('d-none').text('Vui lòng chọn file PDF đã ký số.');
                return;
            }
            if (!/\.pdf$/i.test(file.name)) {
                $err.removeClass('d-none').text('Chỉ chấp nhận file PDF.');
                return;
            }
            if (file.size > 20 * 1024 * 1024) {
                $err.removeClass('d-none').text('File vượt quá 20 MB.');
                return;
            }
            var fd = new FormData(document.getElementById('gpxdSignedPdfForm'));
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xử lý...');
            $.ajax({
                url: Cfg.urls.uploadSignedPdf,
                type: 'POST',
                headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                data: fd, processData: false, contentType: false,
                success: function (resp) {
                    if (resp && resp.isSuccess) {
                        showSuccess(resp.message || 'OCR thành công.');
                        if (resp.redirectUrl) {
                            setTimeout(function () { window.location.href = resp.redirectUrl; }, 600);
                        } else {
                            setTimeout(function () { location.reload(); }, 600);
                        }
                    } else {
                        $btn.prop('disabled', false).html('<i class="fas fa-upload"></i> Upload &amp; Chạy OCR');
                        showError((resp && resp.message) || 'Upload + OCR thất bại.');
                    }
                },
                error: function () {
                    $btn.prop('disabled', false).html('<i class="fas fa-upload"></i> Upload &amp; Chạy OCR');
                    showError('Lỗi kết nối khi upload file.');
                }
            });
        });

        // "Thực hiện OCR" — chạy OCR trên file đã có sẵn
        $(document).on('click', '#gpxdBtnTriggerOcr', function () {
            var $btn = $(this);
            if ($btn.is(':disabled')) return;
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xử lý...');
            $.ajax({
                url: Cfg.urls.triggerOcr,
                type: 'POST',
                headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                data: { hoSoId: Cfg.id },
                success: function (resp) {
                    if (resp && resp.isSuccess) {
                        showSuccess(resp.message || 'OCR thành công.');
                        if (resp.redirectUrl) {
                            setTimeout(function () { window.location.href = resp.redirectUrl; }, 600);
                        } else {
                            setTimeout(function () { location.reload(); }, 600);
                        }
                    } else {
                        $btn.prop('disabled', false).html('<i class="fas fa-magic"></i> Thực hiện OCR');
                        showError((resp && resp.message) || 'OCR thất bại.');
                    }
                },
                error: function () {
                    $btn.prop('disabled', false).html('<i class="fas fa-magic"></i> Thực hiện OCR');
                    showError('Lỗi kết nối.');
                }
            });
        });
    }

    $(function () {
        loadAttachments();
        loadResult();
        bindEvents();
    });
})(jQuery);
