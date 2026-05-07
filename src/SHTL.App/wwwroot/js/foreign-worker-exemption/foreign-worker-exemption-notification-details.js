/**
 * foreign-worker-exemption-notification-details.js
 * Chi tiết hồ sơ thông báo LĐNN không thuộc diện cấp phép (SCR-NV-HS-003)
 * Pattern: IIFE + jQuery + AXDD Figma Design System
 */
(function () {
    'use strict';

    // ─── State ───────────────────────────────────────────────────────────────
    var auditLogLoaded = false;
    var notifId        = (window.notificationData && window.notificationData.id) || '';
    var supplementCount = (window.notificationData && window.notificationData.supplementCount) || 0;
    var MAX_YCBS       = 3;

    // ─── Routes (MVC Controller — NOT /api/v1/...) ───────────────────────────
    var ROUTES = {
        accept:            '/Foreign-Worker-Exemption-Notification/accept/',
        supplementRequest: '/Foreign-Worker-Exemption-Notification/supplement-request/',
        cancel:            '/Foreign-Worker-Exemption-Notification/cancel/',
        exportForm:        '/Foreign-Worker-Exemption-Notification/export-form/',
        getAuditLog:       '/Foreign-Worker-Exemption-Notification/get-audit-log/'
    };

    // ─── Helpers ─────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getAntiForgeryToken() {
        var tokenInput = $('input[name="__RequestVerificationToken"]').first();
        return tokenInput.length ? tokenInput.val() : '';
    }

    function formatDate(isoString) {
        if (!isoString) return '—';
        try {
            var d = new Date(isoString);
            if (isNaN(d.getTime())) return isoString;
            var day   = String(d.getDate()).padStart(2, '0');
            var month = String(d.getMonth() + 1).padStart(2, '0');
            var year  = d.getFullYear();
            var hours = String(d.getHours()).padStart(2, '0');
            var mins  = String(d.getMinutes()).padStart(2, '0');
            return day + '/' + month + '/' + year + ' ' + hours + ':' + mins;
        } catch (e) {
            return isoString;
        }
    }

    function showToast(message, type) {
        // type: 'success' | 'error' | 'warning' | 'info'
        if (typeof toastr !== 'undefined') {
            toastr[type](message);
        } else {
            alert(message);
        }
    }

    // ─── Tab switching ───────────────────────────────────────────────────────
    function switchDetailTab(idx) {
        // Deactivate all tabs and content
        $('.detail-tab-item').removeClass('active');
        $('.detail-tab-content').removeClass('active');

        // Activate selected
        $('.detail-tab-item[data-tab="' + idx + '"]').addClass('active');
        $('#dtab-' + idx).addClass('active');

        // Lazy-load audit log on first visit to tab 4
        if (idx === 4 && !auditLogLoaded) {
            loadAuditLog();
        }
    }

    // ─── Character counters ──────────────────────────────────────────────────
    function initCharCounters() {
        // YCBS content textarea
        $(document).on('input', '#ycbsNoiDung', function () {
            var len = $(this).val().length;
            $('#ycbsCharCount').text(len);
            if (len < 20) {
                $('#ycbsCharCount').addClass('text-danger').removeClass('text-muted');
            } else {
                $('#ycbsCharCount').removeClass('text-danger').addClass('text-muted');
            }
        });

        // Cancel reason textarea
        $(document).on('input', '#huyLyDo', function () {
            var len = $(this).val().length;
            $('#huyCharCount').text(len);
            if (len < 20) {
                $('#huyCharCount').addClass('text-danger').removeClass('text-muted');
            } else {
                $('#huyCharCount').removeClass('text-danger').addClass('text-muted');
            }
        });
    }

    // ─── Accept (Tiếp nhận) ───────────────────────────────────────────────────
    function initAccept() {
        $(document).on('click', '#btnXacNhan', function () {
            if (!confirm('Bạn có chắc muốn tiếp nhận hồ sơ này?')) return;

            var $btn = $(this);
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');

            $.ajax({
                url: ROUTES.accept + notifId,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({}),
                headers: {
                    'RequestVerificationToken': getAntiForgeryToken()
                },
                success: function (result) {
                    if (result && result.success) {
                        showToast('Tiếp nhận hồ sơ thành công.', 'success');
                        setTimeout(function () { window.location.reload(); }, 800);
                    } else {
                        showToast((result && result.message) || 'Đã có lỗi xảy ra.', 'error');
                        $btn.prop('disabled', false).html('<i class="fas fa-check mr-1"></i> Xác nhận tiếp nhận');
                    }
                },
                error: function (xhr) {
                    var msg = 'Không thể kết nối đến máy chủ.';
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp && resp.message) msg = resp.message;
                    } catch (e) { /* ignore */ }
                    showToast(msg, 'error');
                    $btn.prop('disabled', false).html('<i class="fas fa-check mr-1"></i> Xác nhận tiếp nhận');
                }
            });
        });
    }

    // ─── YCBS – Yêu cầu bổ sung ──────────────────────────────────────────────
    function initYcbs() {
        $(document).on('click', '#btnGuiYcbs', function () {
            var noiDung = $('#ycbsNoiDung').val().trim();

            if (noiDung.length < 20) {
                showToast('Nội dung yêu cầu phải có ít nhất 20 ký tự.', 'warning');
                $('#ycbsNoiDung').focus();
                return;
            }
            if (noiDung.length > 1000) {
                showToast('Nội dung yêu cầu không được vượt quá 1000 ký tự.', 'warning');
                return;
            }
            if (supplementCount >= MAX_YCBS) {
                showToast('Đã đạt số lần yêu cầu bổ sung tối đa (' + MAX_YCBS + ' lần).', 'warning');
                return;
            }

            // Collect checked fields
            var truongArr = [];
            $('.truong-can-sua-check:checked').each(function () {
                truongArr.push($(this).val());
            });

            var $btn = $(this);
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang gửi...');

            $.ajax({
                url: ROUTES.supplementRequest + notifId,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    content: noiDung,
                    fieldsToRevise: truongArr.length > 0 ? truongArr.join(', ') : null
                }),
                headers: {
                    'RequestVerificationToken': getAntiForgeryToken()
                },
                success: function (result) {
                    if (result && result.success) {
                        showToast('Gửi yêu cầu bổ sung thành công.', 'success');
                        setTimeout(function () { window.location.reload(); }, 800);
                    } else {
                        showToast((result && result.message) || 'Đã có lỗi xảy ra.', 'error');
                        $btn.prop('disabled', false).html('<i class="fas fa-exclamation-circle mr-1"></i> Gửi yêu cầu bổ sung');
                    }
                },
                error: function (xhr) {
                    var msg = 'Không thể kết nối đến máy chủ.';
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp && resp.message) msg = resp.message;
                    } catch (e) { /* ignore */ }
                    showToast(msg, 'error');
                    $btn.prop('disabled', false).html('<i class="fas fa-exclamation-circle mr-1"></i> Gửi yêu cầu bổ sung');
                }
            });
        });
    }

    // ─── Cancel (Huỷ hồ sơ) ────────────────────────────────────────────────
    function initCancel() {
        // Open modal
        $(document).on('click', '#btnHuy', function () {
            $('#huyLyDo').val('');
            $('#huyCharCount').text('0').removeClass('text-danger').addClass('text-muted');
            $('#huyModal').modal('show');
        });

        // Submit cancel
        $(document).on('click', '#btnSubmitHuy', function () {
            var lyDo = $('#huyLyDo').val().trim();

            if (lyDo.length < 20) {
                showToast('Lý do huỷ phải có ít nhất 20 ký tự.', 'warning');
                $('#huyLyDo').focus();
                return;
            }
            if (lyDo.length > 1000) {
                showToast('Lý do huỷ không được vượt quá 1000 ký tự.', 'warning');
                return;
            }

            var $btn = $(this);
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');

            $.ajax({
                url: ROUTES.cancel + notifId,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    cancellationReason: lyDo
                }),
                headers: {
                    'RequestVerificationToken': getAntiForgeryToken()
                },
                success: function (result) {
                    if (result && result.success) {
                        showToast('Đã huỷ hồ sơ thành công.', 'success');
                        $('#huyModal').modal('hide');
                        setTimeout(function () {
                            window.location.href = '/Foreign-Worker-Exemption-Notification';
                        }, 800);
                    } else {
                        showToast((result && result.message) || 'Đã có lỗi xảy ra.', 'error');
                        $btn.prop('disabled', false).html('<i class="fas fa-ban mr-1"></i> Xác nhận huỷ');
                    }
                },
                error: function (xhr) {
                    var msg = 'Không thể kết nối đến máy chủ.';
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp && resp.message) msg = resp.message;
                    } catch (e) { /* ignore */ }
                    showToast(msg, 'error');
                    $btn.prop('disabled', false).html('<i class="fas fa-ban mr-1"></i> Xác nhận huỷ');
                }
            });
        });
    }

    // ─── Export ──────────────────────────────────────────────────────────────
    function initExport() {
        $(document).on('click', '#btnXuatDocx, #btnXuatPdf', function () {
            var isDocx = $(this).attr('id') === 'btnXuatDocx';
            var templateType = isDocx ? 'DOCX' : 'PDF';
            var ext = isDocx ? '.docx' : '.pdf';

            var $btn = $(this);
            var originalHtml = $btn.html();
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xuất...');

            $.ajax({
                url: ROUTES.exportForm + notifId,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ templateType: templateType }),
                headers: {
                    'RequestVerificationToken': getAntiForgeryToken()
                },
                xhrFields: { responseType: 'blob' },
                success: function (blob, status, xhr) {
                    var contentType = xhr.getResponseHeader('content-type') || '';
                    // If response is JSON (error response), read as text
                    if (contentType.indexOf('application/json') !== -1) {
                        var reader = new FileReader();
                        reader.onload = function () {
                            try {
                                var resp = JSON.parse(reader.result);
                                showToast((resp && resp.message) || 'Xuất biểu mẫu không thành công.', 'warning');
                            } catch (e) {
                                showToast('Xuất biểu mẫu không thành công.', 'error');
                            }
                            $btn.prop('disabled', false).html(originalHtml);
                        };
                        reader.readAsText(blob);
                        return;
                    }
                    // Download the blob
                    var refNumber = (window.notificationData && window.notificationData.referenceNumber)
                        ? window.notificationData.referenceNumber.replace(/\//g, '-')
                        : notifId;
                    var filename = 'BM_' + refNumber + ext;
                    var url = window.URL.createObjectURL(blob);
                    var link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', filename);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                    $btn.prop('disabled', false).html(originalHtml);
                },
                error: function () {
                    showToast('Không thể xuất biểu mẫu. Vui lòng thử lại.', 'error');
                    $btn.prop('disabled', false).html(originalHtml);
                }
            });
        });
    }

    // ─── Audit Log (lazy-load) ───────────────────────────────────────────────
    function loadAuditLog() {
        var $container = $('#auditLogContainer');
        if (!$container.length) return;

        $container.html('<div class="text-center py-4"><i class="fas fa-spinner fa-spin fa-2x text-muted"></i></div>');

        $.ajax({
            url: ROUTES.getAuditLog + notifId,
            type: 'GET',
            success: function (result) {
                auditLogLoaded = true;
                if (!result || !result.isSuccess || !result.value || result.value.length === 0) {
                    $container.html('<div class="text-center text-muted py-4">Không có dữ liệu audit log.</div>');
                    return;
                }
                var rows = '';
                $.each(result.value, function (i, entry) {
                    rows += '<tr>' +
                        '<td style="white-space:nowrap;">' + escapeHtml(formatDate(entry.timestamp)) + '</td>' +
                        '<td>' + escapeHtml(entry.userName || '—') + '</td>' +
                        '<td>' + escapeHtml(entry.action || '—') + '</td>' +
                        '<td>' + escapeHtml(entry.description || '—') + '</td>' +
                        '</tr>';
                });
                var html = '<div class="table-responsive">' +
                    '<table class="audit-table" style="width:100%;">' +
                    '<thead><tr>' +
                    '<th>Thời gian</th>' +
                    '<th>Người dùng</th>' +
                    '<th>Hành động</th>' +
                    '<th>Mô tả</th>' +
                    '</tr></thead>' +
                    '<tbody>' + rows + '</tbody>' +
                    '</table></div>';
                $container.html(html);
            },
            error: function () {
                auditLogLoaded = false;
                $container.html('<div class="text-center text-danger py-4">Không thể tải audit log.</div>');
            }
        });
    }

    // ─── Tab event bindings ──────────────────────────────────────────────────
    function initTabs() {
        $(document).on('click', '.detail-tab-item', function () {
            var idx = parseInt($(this).attr('data-tab'), 10);
            switchDetailTab(idx);
        });
    }

    // ─── Init ─────────────────────────────────────────────────────────────────
    $(document).ready(function () {
        initTabs();
        initCharCounters();
        initAccept();
        initYcbs();
        initCancel();
        initExport();

        // Disable YCBS button if max supplement count reached
        if (supplementCount >= MAX_YCBS) {
            $('#btnGuiYcbs')
                .prop('disabled', true)
                .attr('title', 'Đã đạt số lần yêu cầu bổ sung tối đa (' + MAX_YCBS + ' lần)');
        }
    });

})();
