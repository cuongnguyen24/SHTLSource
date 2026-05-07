/**
 * Review Detail Management — Client JS (IIFE Pattern)
 * Screen: SCR-NV-REV-002 — Chi tiết & Xác nhận Báo cáo
 * Endpoints: /Review/XacNhan, /Review/YeuCauBoSung, /Review/TuChoi
 */
(function () {
    'use strict';

    var baoCaoId  = window.reviewBaoCaoId  || '';
    var loaiBC    = window.reviewLoaiBC    || 'QCDC';
    var trangThai = window.reviewTrangThai || 0;

    var API = {
        approve:           '/Review/XacNhan/'         + baoCaoId,
        requestSupplement: '/Review/YeuCauBoSung/'    + baoCaoId,
        reject:            '/Review/TuChoi/'          + baoCaoId
    };

    // ─── Utilities ───────────────────────────────────────────────

    function getToken() {
        var el = document.querySelector('input[name="__RequestVerificationToken"]');
        return el ? el.value : '';
    }

    function postJson(url, body, onSuccess, onError) {
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': getToken()
            },
            body: JSON.stringify(body)
        })
        .then(function (r) { return r.json(); })
        .then(function (json) {
            if (json.success) {
                onSuccess(json);
            } else {
                onError(json.message || 'Đã có lỗi xảy ra.');
            }
        })
        .catch(function (err) {
            console.error('[ReviewDetail] fetch error:', err);
            onError('Lỗi kết nối. Vui lòng thử lại.');
        });
    }

    function setButtonLoading(btn, loading) {
        if (!btn) return;
        if (loading) {
            btn.disabled = true;
            btn.dataset.originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...';
        } else {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
        }
    }

    function showToast(type, message) {
        if (typeof toastr !== 'undefined') {
            toastr[type](message);
        } else {
            alert(message);
        }
    }

    function goToList() {
        setTimeout(function () { window.location.href = '/Review/Index'; }, 1400);
    }

    // ─── Approve (Xác nhận) ──────────────────────────────────────

    function initApprove() {
        var btn = document.getElementById('btnApprove');
        if (!btn) return;

        btn.addEventListener('click', function () {
            var mucQCDC = (document.getElementById('mucTuanThuQCDC') || {}).value || '';
            var mucDTDK = (document.getElementById('mucToChucDTDK') || {}).value || '';
            var ghiChu  = (document.getElementById('ghiChuThamDinh') || {}).value || '';

            if (loaiBC === 'QCDC') {
                if (!mucQCDC || !mucDTDK) {
                    showToast('warning', 'Vui lòng chọn đủ Mức tuân thủ QCDC và Mức tổ chức ĐTĐK trước khi xác nhận.');
                    return;
                }
            }

            if (!confirm('Xác nhận báo cáo này?\n\nHành động sẽ thay đổi trạng thái sang "Đã xác nhận".')) return;

            // Build ghi chú bao gồm đánh giá tuân thủ
            var note = ghiChu.trim();
            if (loaiBC === 'QCDC' && (mucQCDC || mucDTDK)) {
                if (note) note += '\n';
                note += '[Đánh giá] Mức tuân thủ QCDC: ' + mucQCDC + '; Mức tổ chức ĐTĐK: ' + mucDTDK;
            }

            setButtonLoading(btn, true);
            postJson(API.approve, { loaiBC: loaiBC, ghiChuThamDinh: note },
                function () {
                    showToast('success', 'Đã xác nhận báo cáo thành công. Phiếu xác nhận đã được ghi nhận.');
                    goToList();
                },
                function (msg) {
                    showToast('error', msg);
                    setButtonLoading(btn, false);
                }
            );
        });
    }

    // ─── Request Supplement (YC bổ sung) ────────────────────────

    function initRequestSupplement() {
        var btnOpen    = document.getElementById('btnRequestSupplement');
        var btnConfirm = document.getElementById('btnConfirmYCBS');
        if (!btnOpen) return;

        btnOpen.addEventListener('click', function () {
            var textarea = document.getElementById('noiDungYCBS');
            if (textarea) textarea.value = '';
            $('#modalYCBS').modal('show');
            setTimeout(function () { if (textarea) textarea.focus(); }, 400);
        });

        if (!btnConfirm) return;
        btnConfirm.addEventListener('click', function () {
            var noiDung = (document.getElementById('noiDungYCBS') || {}).value || '';
            noiDung = noiDung.trim();
            if (!noiDung) {
                showToast('warning', 'Vui lòng nhập nội dung yêu cầu bổ sung.');
                return;
            }
            setButtonLoading(btnConfirm, true);
            postJson(API.requestSupplement, { loaiBC: loaiBC, noiDungYeuCauBoSung: noiDung },
                function () {
                    $('#modalYCBS').modal('hide');
                    showToast('success', 'Đã gửi yêu cầu bổ sung. Doanh nghiệp sẽ được thông báo.');
                    goToList();
                },
                function (msg) {
                    showToast('error', msg);
                    setButtonLoading(btnConfirm, false);
                }
            );
        });
    }

    // ─── Reject (Từ chối) ────────────────────────────────────────

    function initReject() {
        var btnOpen    = document.getElementById('btnReject');
        var btnConfirm = document.getElementById('btnConfirmTuChoi');
        if (!btnOpen) return;

        btnOpen.addEventListener('click', function () {
            var textarea = document.getElementById('lyDoTuChoi');
            if (textarea) textarea.value = '';
            $('#modalTuChoi').modal('show');
            setTimeout(function () { if (textarea) textarea.focus(); }, 400);
        });

        if (!btnConfirm) return;
        btnConfirm.addEventListener('click', function () {
            var lyDo = (document.getElementById('lyDoTuChoi') || {}).value || '';
            lyDo = lyDo.trim();
            if (!lyDo) {
                showToast('warning', 'Vui lòng nhập lý do từ chối.');
                return;
            }
            setButtonLoading(btnConfirm, true);
            postJson(API.reject, { loaiBC: loaiBC, lyDoTuChoi: lyDo },
                function () {
                    $('#modalTuChoi').modal('hide');
                    showToast('success', 'Đã từ chối báo cáo. Doanh nghiệp sẽ được thông báo.');
                    goToList();
                },
                function (msg) {
                    showToast('error', msg);
                    setButtonLoading(btnConfirm, false);
                }
            );
        });
    }

    // ─── Init ────────────────────────────────────────────────────

    $(document).ready(function () {
        if (trangThai === 2) {
            initApprove();
            initRequestSupplement();
            initReject();
        }
    });

})();
