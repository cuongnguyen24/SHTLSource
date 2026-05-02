/**
 * Termination Details — SCR-NV-DETAIL-001
 * Module: M0085 — Chi tiết hồ sơ chấm dứt HĐLĐ
 * Pattern: IIFE
 */
(function () {
    'use strict';

    var id = window.notificationId;
    var perms = window.userPermissions || {};

    function token() {
        var el = document.querySelector('input[name="__RequestVerificationToken"]');
        return el ? el.value : '';
    }

    function postAction(url, body, successMsg, redirect) {
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': token()
            },
            body: JSON.stringify(body || {})
        })
        .then(function (r) { return r.json(); })
        .then(function (json) {
            if (json.success) {
                toastr.success(json.message || successMsg);
                setTimeout(function () {
                    window.location.href = redirect || window.location.href;
                }, 1200);
            } else {
                toastr.error(json.message || 'Thao tác thất bại.');
            }
        })
        .catch(function () { toastr.error('Lỗi kết nối.'); });
    }

    // ── Xác nhận ─────────────────────────────────────────────────────
    function initConfirm() {
        var btn = document.getElementById('btnConfirm');
        if (!btn) return;
        btn.addEventListener('click', function () {
            if (!confirm('Xác nhận tiếp nhận hồ sơ này?')) return;
            btn.disabled = true;
            postAction('/TerminationNotifications/Confirm/' + id, {}, 'Đã xác nhận hồ sơ.', window.location.href);
        });
    }

    // ── Chuyển bản nháp thành chính thức ─────────────────────────────
    function initPublishDraft() {
        var btnSaveConfirm = document.getElementById('btnSaveConfirmDraft');
        var btnSubmitDraft = document.getElementById('btnSubmitDraft');

        if (btnSaveConfirm) {
            btnSaveConfirm.addEventListener('click', function () {
                if (!confirm('Lưu và xác nhận hồ sơ nháp này?')) return;
                btnSaveConfirm.disabled = true;
                postAction(
                    '/TerminationNotifications/SubmitDraft/' + id + '?confirmImmediately=true',
                    {},
                    'Đã lưu và xác nhận hồ sơ.',
                    window.location.href
                );
            });
        }

        if (btnSubmitDraft) {
            btnSubmitDraft.addEventListener('click', function () {
                if (!confirm('Nộp hồ sơ nháp này để chuyển sang trạng thái Chờ xác nhận?')) return;
                btnSubmitDraft.disabled = true;
                postAction(
                    '/TerminationNotifications/SubmitDraft/' + id + '?confirmImmediately=false',
                    {},
                    'Đã nộp hồ sơ nháp.',
                    window.location.href
                );
            });
        }
    }

    // ── YC Bổ sung ────────────────────────────────────────────────────
    function initYCBS() {
        var btnOpen = document.getElementById('btnYCBS');
        var btnClose = document.getElementById('btnMoClose');
        var btnSend = document.getElementById('btnMoSend');
        var overlay = document.getElementById('moYCBS');
        var ta = document.getElementById('ycbsReason');
        var cnt = document.getElementById('ycbsCount');
        if (!btnOpen) return;

        btnOpen.addEventListener('click', function () {
            overlay.classList.add('open');
            if (ta) { ta.value = ''; cnt.textContent = '0'; }
        });
        btnClose.addEventListener('click', function () { overlay.classList.remove('open'); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.classList.remove('open'); });

        if (ta && cnt) {
            ta.addEventListener('input', function () { cnt.textContent = this.value.length; });
        }

        btnSend.addEventListener('click', function () {
            var reason = ta.value.trim();
            if (!reason) { toastr.warning('Vui lòng nhập nội dung yêu cầu bổ sung.'); return; }
            btnSend.disabled = true;
            postAction(
                '/TerminationNotifications/RequestSupplement/' + id,
                { reason: reason },
                'Đã gửi yêu cầu bổ sung.',
                window.location.href
            );
        });
    }

    // ── Từ chối ──────────────────────────────────────────────────────
    function initCancel() {
        var btnOpen = document.getElementById('btnCancel');
        var btnClose = document.getElementById('btnCancelClose');
        var btnSend = document.getElementById('btnCancelSend');
        var overlay = document.getElementById('moCancelConfirm');
        var ta = document.getElementById('cancelReason');
        if (!btnOpen) return;

        btnOpen.addEventListener('click', function () {
            overlay.classList.add('open');
            if (ta) ta.value = '';
        });
        btnClose.addEventListener('click', function () { overlay.classList.remove('open'); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.classList.remove('open'); });

        btnSend.addEventListener('click', function () {
            var reason = ta.value.trim();
            if (!reason) { toastr.warning('Vui lòng nhập lý do từ chối (bắt buộc).'); return; }
            btnSend.disabled = true;
            postAction(
                '/TerminationNotifications/Cancel/' + id,
                { reason: reason },
                'Hồ sơ đã được từ chối.',
                '/TerminationNotifications'
            );
        });
    }

    // ── Sinh biểu mẫu ────────────────────────────────────────────────
    function initDocGen() {
        var btnDocx = document.getElementById('btnGenDocx');
        var btnPdf = document.getElementById('btnGenPdf');
        if (btnDocx) {
            btnDocx.addEventListener('click', function () {
                window.location.href = '/TerminationNotifications/GenerateDocument/' + id + '?format=docx';
            });
        }
        if (btnPdf) {
            btnPdf.addEventListener('click', function () {
                window.location.href = '/TerminationNotifications/GenerateDocument/' + id + '?format=pdf';
            });
        }
    }

    // ── Init ─────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        initPublishDraft();
        initConfirm();
        initYCBS();
        initCancel();
        initDocGen();
    });

})();