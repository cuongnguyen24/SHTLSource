/**
 * GPXD Phase 1 — Trang Xác nhận OCR (UC-06/07)
 * View: Views/CapPhepXayDung/OCRResult.cshtml
 *
 * Flow (học theo HoSoGiayPhep):
 *   1. Server đã chạy OCR, kết quả được truyền qua Cfg.initialOcrData.
 *   2. Render bảng 6 fields + confidence badges ngay khi trang load.
 *   3. Nút "Chạy lại OCR" → POST runOcr → nhận OcrTempResultDto mới (mock lại).
 *   4. Nút sửa thủ công → panel edit (đã có trong view HTML).
 *   5. Nút "Xác nhận & Cấp GPXD" → SweetAlert confirm → POST confirmOcr.
 *   6. Nút "Từ chối" → SweetAlert confirm → POST rejectOcr.
 *   7. Tất cả thông báo dùng toastr, không dùng alert/confirm native.
 */
(function ($) {
    'use strict';

    if (!window.gpxdOcrConfig) { console.error('gpxdOcrConfig is required'); return; }
    var Cfg = window.gpxdOcrConfig;

    var state = {
        signedPdfAttachmentId: Cfg.signedPdfAttachmentId || null,
        ocrData: null,  // OcrTempResultDto from server
        edits: {}       // { field: { value, reason } } — manual edits
    };

    // ─── Helpers ───────────────────────────────────────────────────────────────

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function getAntiForgeryToken() { return $('input[name="__RequestVerificationToken"]').val() || ''; }
    function toast(type, msg) { if (window.toastr) toastr[type](msg); }
    function toastError(m)   { toast('error',   m); }
    function toastSuccess(m) { toast('success', m); }
    function toastWarning(m) { toast('warning', m); }
    function toastInfo(m)    { toast('info',    m); }

    function fmtDate(d) {
        if (!d) return '';
        var s = String(d).substring(0, 10);
        var p = s.split('-');
        return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : s;
    }

    function lowerFirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

    function confColor(c) {
        var n = Number(c) * 100 || 0; // confidence từ backend là 0..1 (decimal) hoặc 0..100
        // Nếu đã là số > 1 thì giữ nguyên, nếu <= 1 thì nhân 100
        if (Number(c) <= 1) n = Number(c) * 100;
        else n = Number(c);
        if (n >= 80) return '#16a34a';
        if (n >= 60) return '#ca8a04';
        return '#dc2626';
    }
    function confPct(c) {
        var n = Number(c);
        if (n <= 1) n = n * 100;
        return Math.round(n);
    }
    function confEmoji(c) {
        var pct = confPct(c);
        if (pct >= 80) return '🟢';
        if (pct >= 60) return '🟡';
        return '🔴';
    }

    // ─── Render OCR table ───────────────────────────────────────────────────────

    function renderFieldRow(label, fieldKey, value, conf, isDate) {
        var color = confColor(conf);
        var pct   = confPct(conf);
        var emoji = confEmoji(conf);
        var displayVal = isDate ? fmtDate(value) : (value || '');
        return ''
            + '<tr data-field="' + fieldKey + '" data-isdate="' + (isDate ? '1' : '0') + '" style="border-bottom:1px solid #f8fafc;">'
            + '  <td class="py-2" style="font-weight:500;font-size:12px;">' + escapeHtml(label) + '</td>'
            + '  <td class="py-2 font-weight-bold field-display" style="font-size:12px;">' + escapeHtml(displayVal || '—') + '</td>'
            + '  <td class="py-2" style="width:110px;">'
            + '    <div class="d-flex align-items-center"><span class="mr-1">' + emoji + '</span>'
            + '    <span class="font-weight-bold" style="font-size:11px;color:' + color + ';">' + pct + '%</span></div>'
            + '    <div class="progress mt-1" style="height:3px;background:#f1f5f9;"><div class="progress-bar" style="width:' + pct + '%;background:' + color + ';"></div></div>'
            + '  </td>'
            + '  <td class="py-2 text-center" style="width:40px;">'
            + '    <button type="button" class="btn btn-sm btn-link p-0 text-primary btn-edit-field"'
            + '      data-field="' + fieldKey + '" data-label="' + escapeHtml(label) + '" title="Sửa thủ công">'
            + '      <i class="fas fa-pencil-alt" style="font-size:11px;"></i>'
            + '    </button>'
            + '  </td>'
            + '</tr>';
    }

    function renderOcrTable() {
        var d = state.ocrData;
        if (!d) {
            $('#gpxdOcrFieldsBox').html('<div class="text-muted text-center py-3" style="font-size:12px;">Chưa có dữ liệu OCR.</div>');
            return;
        }

        var html = '';

        // Cảnh báo nếu OCR thất bại
        if (d.isOcrFailed) {
            html += '<div class="alert alert-danger py-2 mb-2" style="font-size:12px;">'
                + '<i class="fas fa-exclamation-circle mr-1"></i>'
                + 'OCR thất bại — vui lòng nhập thủ công bằng nút ✏️.</div>';
        }

        html += '<table class="table table-sm table-borderless mb-2" style="font-size:12px;">'
            + '<thead class="text-muted"><tr>'
            + '<th style="width:30%;">Trường</th>'
            + '<th>Giá trị OCR</th>'
            + '<th style="width:110px;">Độ tin cậy</th>'
            + '<th style="width:40px;text-align:center;">Sửa</th>'
            + '</tr></thead><tbody>';

        html += renderFieldRow('Số GPXD',         'SoGpxd',         d.soGpxd,         d.soGpxdConfidence,         false);
        html += renderFieldRow('Ngày ký',          'NgayKy',          d.ngayKy,          d.ngayKyConfidence,          true);
        html += renderFieldRow('Ngày cấp',         'NgayCap',         d.ngayCap,         d.ngayCapConfidence,         true);
        html += renderFieldRow('Ngày hết hạn',     'NgayHetHan',     d.ngayHetHan,     d.ngayHetHanConfidence,     true);
        html += renderFieldRow('Người ký',         'NguoiKy',         d.nguoiKy,         d.nguoiKyConfidence,         false);
        html += renderFieldRow('Chức vụ người ký', 'ChucVuNguoiKy',  d.chucVuNguoiKy,  d.chucVuNguoiKyConfidence,  false);
        html += '</tbody></table>';

        $('#gpxdOcrFieldsBox').html(html);
        $('#gpxdOcrActionBox').show();
    }

    // ─── Run OCR (AJAX POST) ────────────────────────────────────────────────────

    function runOcr() {
        var attId = state.signedPdfAttachmentId || Cfg.signedPdfAttachmentId;
        if (!attId) {
            toastError('Không tìm thấy file PDF đã ký để chạy OCR.');
            return;
        }
        // Hiện spinner
        var $btn = $('#gpxdOcrBtnRerun');
        var origHtml = $btn.html();
        $btn.html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang chạy...').prop('disabled', true);
        $('#gpxdOcrFieldsBox').html(
            '<div class="text-muted text-center py-4" style="font-size:13px;">'
            + '<i class="fas fa-spinner fa-spin fa-2x mb-2 d-block" style="color:#7c3aed;"></i>'
            + 'Đang chạy OCR (mock)...</div>'
        );
        $('#gpxdOcrActionBox').hide();

        $.ajax({
            url: Cfg.urls.runOcr + '/' + Cfg.dossierId,
            type: 'POST',
            contentType: 'application/json; charset=utf-8',
            headers: { 'RequestVerificationToken': getAntiForgeryToken() },
            data: JSON.stringify({ signedPdfAttachmentId: attId })
        }).done(function (resp) {
            $btn.html(origHtml).prop('disabled', false);
            if (resp && resp.isSuccess && resp.data) {
                state.ocrData = resp.data;
                state.signedPdfAttachmentId = attId;
                state.edits = {};
                renderOcrTable();
                toastSuccess('Đã chạy lại OCR thành công.');
            } else {
                toastError((resp && resp.message) || 'OCR thất bại.');
                $('#gpxdOcrFieldsBox').html(
                    '<div class="alert alert-danger" style="font-size:12px;">'
                    + '<i class="fas fa-exclamation-circle mr-1"></i>'
                    + escapeHtml((resp && resp.message) || 'OCR thất bại.') + '</div>'
                );
            }
        }).fail(function () {
            $btn.html(origHtml).prop('disabled', false);
            toastError('Lỗi kết nối khi chạy OCR.');
        });
    }

    // ─── Bind events ────────────────────────────────────────────────────────────

    function bindEvents() {

        // Nút "Chạy lại OCR"
        $('#gpxdOcrBtnRerun').on('click', runOcr);

        // Checklist: bật nút Confirm khi đủ 6/6
        $(document).on('change', '.gpxd-ocr-check', function () {
            var total   = $('.gpxd-ocr-check').length;
            var checked = $('.gpxd-ocr-check:checked').length;
            var allOk   = total > 0 && checked === total;
            $('#gpxdOcrBtnConfirm').prop('disabled', !allOk)
                .attr('title', allOk ? 'Xác nhận và cấp GPXD' : 'Tick đủ ' + total + ' mục (' + checked + '/' + total + ').');
        });

        // Mở manual edit panel
        $(document).on('click', '.btn-edit-field', function () {
            var $btn  = $(this);
            var fld   = $btn.data('field');
            var lbl   = $btn.data('label');
            var $row  = $btn.closest('tr');
            var isDate = $row.data('isdate') === 1 || $row.data('isdate') === '1';
            var existing = state.edits[fld];
            var rawVal = (state.ocrData ? (state.ocrData[lowerFirst(fld)] || '') : '');
            var initialVal = existing ? existing.value : (isDate ? String(rawVal).substring(0, 10) : rawVal);

            $('#manualFieldLabel').text(lbl);
            $('#manualConfirmPanel')
                .data('field', fld)
                .data('isdate', isDate ? '1' : '0')
                .slideDown(200);
            $('#manualValueInput').attr('type', isDate ? 'date' : 'text').val(initialVal).focus();
            $('#manualReasonInput').val(existing ? existing.reason : '');
        });

        // Hủy manual edit
        $(document).on('click', '#btnCancelManualEdit', function () {
            $('#manualConfirmPanel').slideUp(150);
        });

        // Áp dụng manual edit
        $(document).on('click', '#btnApplyManualEdit', function () {
            var fld    = $('#manualConfirmPanel').data('field');
            var isDate = $('#manualConfirmPanel').data('isdate') === '1';
            var val    = ($('#manualValueInput').val() || '').trim();
            var reason = ($('#manualReasonInput').val() || '').trim();
            if (!val)         { toastWarning('Vui lòng nhập giá trị đúng.'); return; }
            if (reason.length < 5) { toastWarning('Vui lòng nhập lý do sửa (≥ 5 ký tự).'); return; }

            state.edits[fld] = { value: val, reason: reason };

            var $row = $('tr[data-field="' + fld + '"]');
            var displayVal = isDate ? fmtDate(val) : val;
            $row.find('.field-display').html(
                escapeHtml(displayVal)
                + ' <span class="badge badge-warning ml-1" style="font-size:10px;" title="Đã sửa thủ công">✏️ Đã sửa</span>'
            );
            $('#manualConfirmPanel').slideUp(150);
            toastSuccess('Đã áp dụng giá trị mới cho trường ' + fld + '.');
        });

        // Xác nhận & Cấp GPXD — dùng SweetAlert2 như mẫu HoSoGiayPhep
        $('#gpxdOcrBtnConfirm').on('click', function () {
            if ($(this).prop('disabled')) { toastWarning('Vui lòng tick đủ 6 mục trong Checklist.'); return; }
            if (!state.ocrData) { toastError('Chưa có dữ liệu OCR để xác nhận.'); return; }

            function pick(field, isDate) {
                if (state.edits[field]) return state.edits[field].value;
                var raw = state.ocrData[lowerFirst(field)];
                if (!raw) return null;
                return isDate ? String(raw).substring(0, 10) : raw;
            }

            var payload = {
                soGpxd:       pick('SoGpxd', false),
                ngayKy:       pick('NgayKy', true),
                ngayHetHan:   pick('NgayHetHan', true),
                ngayCap:      pick('NgayCap', true),
                nguoiKy:      pick('NguoiKy', false),
                chucVuNguoiKy: pick('ChucVuNguoiKy', false)
            };

            if (!payload.soGpxd || !payload.ngayKy || !payload.ngayHetHan || !payload.nguoiKy) {
                toastError('Vui lòng kiểm tra/nhập đầy đủ Số GPXD, Ngày ký, Ngày hết hạn, Người ký.');
                return;
            }

            var hasEdits = Object.keys(state.edits).length > 0;

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Xác nhận cấp GPXD?',
                    html: '<div class="text-left" style="font-size:13px;">'
                        + '<strong>Số GPXD:</strong> ' + escapeHtml(payload.soGpxd) + '<br>'
                        + '<strong>Ngày ký:</strong> ' + fmtDate(payload.ngayKy) + '<br>'
                        + '<strong>Ngày cấp:</strong> ' + fmtDate(payload.ngayCap) + '<br>'
                        + '<strong>Ngày hết hạn:</strong> ' + fmtDate(payload.ngayHetHan) + '<br>'
                        + '<strong>Người ký:</strong> ' + escapeHtml(payload.nguoiKy) + '<br>'
                        + '<strong>Chức vụ:</strong> ' + escapeHtml(payload.chucVuNguoiKy || '—') + '<br>'
                        + (hasEdits ? '<br><span class="text-warning font-weight-bold">⚠ Có chỉnh sửa thủ công</span>' : '')
                        + '</div>',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: '<i class="fas fa-check mr-1"></i> Xác nhận & Cấp',
                    cancelButtonText: 'Kiểm tra lại',
                    confirmButtonColor: '#1e3a8a',
                    cancelButtonColor: '#6c757d',
                    showLoaderOnConfirm: true,
                    preConfirm: function () {
                        return $.ajax({
                            url: Cfg.urls.confirmOcr + '/' + Cfg.dossierId,
                            type: 'POST',
                            contentType: 'application/json; charset=utf-8',
                            headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                            data: JSON.stringify(payload)
                        }).then(function (resp) {
                            if (!resp || !resp.isSuccess) {
                                Swal.showValidationMessage((resp && resp.message) || 'Lỗi khi xác nhận OCR.');
                            }
                            return resp;
                        }).fail(function () {
                            Swal.showValidationMessage('Lỗi kết nối.');
                        });
                    },
                    allowOutsideClick: function () { return !Swal.isLoading(); }
                }).then(function (result) {
                    if (result.isConfirmed && result.value && result.value.isSuccess) {
                        toastSuccess('Đã cấp GPXD thành công!');
                        setTimeout(function () { window.location.href = Cfg.urls.chiTiet + '/' + Cfg.dossierId; }, 1000);
                    }
                });
            } else {
                // Fallback nếu không có SweetAlert2
                if (!window.confirm('Xác nhận lưu kết quả OCR và CẤP GPXD cho hồ sơ ' + Cfg.maHoSo + '?')) return;
                postConfirmOcr(payload);
            }
        });

        function postConfirmOcr(payload) {
            $.ajax({
                url: Cfg.urls.confirmOcr + '/' + Cfg.dossierId,
                type: 'POST',
                contentType: 'application/json; charset=utf-8',
                headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                data: JSON.stringify(payload)
            }).done(function (resp) {
                if (resp && resp.isSuccess) {
                    toastSuccess('Đã cấp GPXD thành công!');
                    setTimeout(function () { window.location.href = Cfg.urls.chiTiet + '/' + Cfg.dossierId; }, 1000);
                } else {
                    toastError((resp && resp.message) || 'Xác nhận thất bại.');
                }
            }).fail(function () { toastError('Lỗi kết nối.'); });
        }

        // Từ chối OCR — dùng SweetAlert2
        $('#gpxdOcrBtnReject').on('click', function () {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Từ chối kết quả OCR?',
                    text: 'Hồ sơ sẽ quay lại trạng thái Chờ ký số. Bạn có chắc chắn không?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: '<i class="fas fa-times-circle mr-1"></i> Từ chối',
                    cancelButtonText: 'Hủy',
                    confirmButtonColor: '#dc2626',
                    cancelButtonColor: '#6c757d'
                }).then(function (result) {
                    if (result.isConfirmed) doRejectOcr();
                });
            } else {
                if (window.confirm('Từ chối kết quả OCR? Hồ sơ sẽ quay lại trạng thái Chờ ký số.')) doRejectOcr();
            }
        });

        function doRejectOcr() {
            $.ajax({
                url: Cfg.urls.rejectOcr + '/' + Cfg.dossierId,
                type: 'POST',
                headers: { 'RequestVerificationToken': getAntiForgeryToken() }
            }).done(function (resp) {
                if (resp && resp.isSuccess) {
                    toastSuccess('Đã từ chối kết quả OCR.');
                    setTimeout(function () { window.location.href = Cfg.urls.chiTiet + '/' + Cfg.dossierId; }, 800);
                } else {
                    toastError((resp && resp.message) || 'Thao tác thất bại.');
                }
            }).fail(function () { toastError('Lỗi kết nối.'); });
        }
    }

    // ─── Init ───────────────────────────────────────────────────────────────────

    $(function () {
        bindEvents();

        // Học theo HoSoGiayPhep: server đã chạy OCR, kết quả truyền qua Cfg.initialOcrData.
        // Render ngay — không cần AJAX thêm.
        // Nếu không có data → hiện trạng thái để user bấm "Chạy lại OCR" thủ công.
        if (Cfg.initialOcrData) {
            state.ocrData = Cfg.initialOcrData;
            state.edits = {};
            renderOcrTable();
        } else if (state.signedPdfAttachmentId) {
            toastInfo('Chưa có dữ liệu OCR — nhấn "Chạy lại OCR" để thử lại.');
        }
    });

})(jQuery);
