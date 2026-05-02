/**
 * GPXD — Trang chi tiết GPXD đã cấp (IssuedDetail).
 * View: Views/CapPhepXayDung/IssuedDetail.cshtml
 *
 * Actions:
 *  - Thu hồi GPXD (modal nhập lý do ≥ 5 ký tự).
 *  - Tải lại PDF đã ký (file picker → upload qua FileManager → POST ReUploadSignedPdf).
 *  - Tải attachments dossier hiện hữu (read-only).
 */
(function ($) {
    'use strict';

    if (!window.gpxdIssuedDetailConfig) return;
    var Cfg = window.gpxdIssuedDetailConfig;

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function getAntiForgeryToken() { return $('input[name="__RequestVerificationToken"]').val() || ''; }
    function showError(m) { if (window.toastr) toastr.error(m); else alert(m); }
    function showSuccess(m) { if (window.toastr) toastr.success(m); else alert(m); }
    function showWarning(m) { if (window.toastr) toastr.warning(m); else alert(m); }

    function loadAttachments() {
        $.ajax({
            url: Cfg.urls.getAttachments + '/' + Cfg.hoSoId,
            type: 'GET'
        }).done(function (resp) {
            var $box = $('#gpxdIssuedAttachmentsBox');
            if (!resp || !resp.isSuccess || !Array.isArray(resp.data) || resp.data.length === 0) {
                $box.html('<div class="text-muted text-center py-2">Chưa có tài liệu.</div>');
                return;
            }
            var html = '<ul class="list-group">';
            resp.data.forEach(function (a) {
                html += '<li class="list-group-item d-flex justify-content-between align-items-center" style="padding:6px 10px;font-size:12px;">'
                    + '<div><i class="far fa-file mr-1"></i>' + escapeHtml(a.tenFile)
                    + ' <span class="badge badge-light ml-1">' + escapeHtml(a.nguon || '—') + '</span></div>'
                    + '</li>';
            });
            html += '</ul>';
            $box.html(html);
        }).fail(function () {
            $('#gpxdIssuedAttachmentsBox').html('<div class="text-danger text-center py-2">Lỗi tải tài liệu.</div>');
        });
    }

    function doRevoke(lyDo) {
        $.ajax({
            url: Cfg.urls.revoke + '/' + Cfg.resultId,
            type: 'POST',
            contentType: 'application/json; charset=utf-8',
            headers: { 'RequestVerificationToken': getAntiForgeryToken() },
            data: JSON.stringify({ lyDo: lyDo })
        }).done(function (resp) {
            if (resp && resp.isSuccess) {
                toastr.success('Đã thu hồi GPXD ' + Cfg.soGpxd + '.');
                setTimeout(function () { location.reload(); }, 800);
            } else {
                toastr.error((resp && resp.message) || 'Thu hồi thất bại.');
            }
        }).fail(function () { toastr.error('Lỗi kết nối.'); });
    }

    function bindEvents() {
        // Thu hồi GPXD — Swal.fire với textarea nhập lý do (học theo HoSoGiayPhep/hoso-workflow.js)
        $('#gpxdRevokeBtn').on('click', function () {
            if (typeof Swal === 'undefined') {
                // fallback
                var lyDo = (window.prompt('Lý do thu hồi GPXD ' + Cfg.soGpxd + ' (≥5 ký tự):', '') || '').trim();
                if (!lyDo) return;
                if (lyDo.length < 5) { showWarning('Lý do phải ≥ 5 ký tự.'); return; }
                doRevoke(lyDo);
                return;
            }

            var html = '<div class="text-left">'
                + '<div class="p-3 mb-3" style="background:#fff1f2;border:1px solid #fecaca;border-radius:12px;">'
                + '<div class="font-weight-bold" style="color:#991b1b;font-size:14px;">Thu hồi GPXD: <strong>' + escapeHtml(Cfg.soGpxd) + '</strong></div>'
                + '<div style="color:#b91c1c;font-size:13px;margin-top:4px;">Hành động này sẽ cập nhật trạng thái GPXD và hồ sơ về <strong>"Đã thu hồi"</strong>. <u>Không thể hoàn tác tự động.</u></div>'
                + '</div>'
                + '<label class="font-weight-bold mb-2" style="font-size:13px;color:#374151;">Lý do thu hồi <span class="text-danger">*</span></label>'
                + '<textarea id="gpxdRevokeReason" class="form-control" style="height:100px;font-size:13px;padding:10px;" placeholder="Nhập lý do thu hồi GPXD..."></textarea>'
                + '</div>';

            Swal.fire({
                title: '<i class="fas fa-ban mr-2 text-danger"></i>Thu hồi GPXD',
                html: html,
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-ban mr-1"></i> Xác nhận thu hồi',
                cancelButtonText: 'Hủy',
                customClass: {
                    confirmButton: 'btn btn-danger px-4',
                    cancelButton: 'btn btn-outline-secondary px-4'
                },
                buttonsStyling: false,
                preConfirm: function () {
                    var reason = ($('#gpxdRevokeReason').val() || '').trim();
                    if (!reason || reason.length < 5) {
                        Swal.showValidationMessage('Vui lòng nhập lý do thu hồi tối thiểu 5 ký tự.');
                        return false;
                    }
                    return reason;
                }
            }).then(function (result) {
                if (result.isConfirmed && result.value) {
                    doRevoke(result.value);
                }
            });
        });

        // Re-upload PDF
        $('#gpxdReUploadBtn').on('click', function () { $('#gpxdReUploadFile').trigger('click'); });

        $('#gpxdReUploadFile').on('change', function (e) {
            var file = e.target.files && e.target.files[0];
            if (!file) return;
            if (file.type && file.type.indexOf('pdf') < 0 && !/\.pdf$/i.test(file.name)) {
                showWarning('Vui lòng chọn file PDF.');
                $(this).val('');
                return;
            }
            // Dùng toastr info thay confirm(), upload trực tiếp
            toastr.info('Đang upload PDF mới: ' + file.name);

            // Bước 1: Upload qua FileManager
            var fd = new FormData();
            fd.append('files', file);
            fd.append('enterpriseCode', 'gpxd');

            $.ajax({
                url: Cfg.urls.uploadFileManager,
                type: 'POST',
                data: fd,
                processData: false,
                contentType: false,
                headers: { 'RequestVerificationToken': getAntiForgeryToken() }
            }).done(function (uploadResp) {
                // FileManager returns various shapes — try common ones
                var uploaded = (uploadResp && (uploadResp.data || uploadResp))
                            || null;
                var fileId = null;
                if (Array.isArray(uploaded) && uploaded.length > 0) fileId = uploaded[0].id || uploaded[0].fileId;
                else if (uploaded && uploaded.items && uploaded.items.length > 0) fileId = uploaded.items[0].id || uploaded.items[0].fileId;
                else if (uploaded && uploaded.id) fileId = uploaded.id;

                if (!fileId) { showError('Không lấy được FileId sau khi upload.'); return; }

                // Bước 2: gắn FilePdfId mới vào Result
                $.ajax({
                    url: Cfg.urls.reUpload + '/' + Cfg.resultId,
                    type: 'POST',
                    contentType: 'application/json; charset=utf-8',
                    headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                    data: JSON.stringify({ fileId: fileId, fileName: file.name })
                }).done(function (resp) {
                    if (resp && resp.isSuccess) {
                        showSuccess('Đã cập nhật PDF đã ký.');
                        setTimeout(function () { location.reload(); }, 700);
                    } else {
                        showError((resp && resp.message) || 'Cập nhật PDF thất bại.');
                    }
                }).fail(function () { showError('Lỗi kết nối khi cập nhật.'); });
            }).fail(function () { showError('Upload file thất bại.'); })
              .always(function () { $('#gpxdReUploadFile').val(''); });
        });
    }

    $(function () {
        loadAttachments();
        bindEvents();
    });
})(jQuery);
