/**
 * BaoCaoDoiThoaiDinhKy Review Management
 */
(function () {
    'use strict';

    var baoCaoId = window.baoCaoId || '';
    var trangThai = window.baoCaoTrangThai || 0;

    var API = {
        approve: '/BaoCaoDoiThoaiDinhKy/XacNhan/' + baoCaoId,
        requestSupplement: '/BaoCaoDoiThoaiDinhKy/YeuCauBoSung/' + baoCaoId,
        reject: '/BaoCaoDoiThoaiDinhKy/TuChoi/' + baoCaoId
    };

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
                if (json.success) onSuccess(json);
                else onError(json.message || 'Đã có lỗi xảy ra.');
            })
            .catch(function () { onError('Lỗi kết nối. Vui lòng thử lại.'); });
    }

    function setButtonLoading(btn, loading) {
        if (loading) {
            btn.disabled = true;
            btn.dataset.originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...';
        } else {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
        }
    }

    function initApprove() {
        var btn = document.getElementById('btnApprove');
        if (!btn) return;
        btn.addEventListener('click', function () {
            var ghiChu = (document.getElementById('ghiChuThamDinh') || {}).value || '';
            if (!ghiChu.trim()) {
                toastr.warning('Vui lòng nhập ghi chú thẩm định.');
                return;
            }
            setButtonLoading(btn, true);
            postJson(API.approve, { ghiChuThamDinh: ghiChu },
                function () {
                    toastr.success('Đã xác nhận báo cáo thành công.');
                    setTimeout(function () { window.location.href = '/Review/Index'; }, 1200);
                },
                function (msg) {
                    toastr.error(msg);
                    setButtonLoading(btn, false);
                });
        });
    }

    function initRequestSupplement() {
        var btnOpen = document.getElementById('btnRequestSupplement');
        var btnConfirm = document.getElementById('btnConfirmYCBS');
        if (!btnOpen || !btnConfirm) return;

        btnOpen.addEventListener('click', function () {
            document.getElementById('noiDungYCBS').value = '';
            $('#modalYCBS').modal('show');
        });

        btnConfirm.addEventListener('click', function () {
            var value = document.getElementById('noiDungYCBS').value.trim();
            if (!value) {
                toastr.warning('Vui lòng nhập nội dung yêu cầu bổ sung.');
                return;
            }
            setButtonLoading(btnConfirm, true);
            postJson(API.requestSupplement, { noiDungYeuCauBoSung: value },
                function () {
                    $('#modalYCBS').modal('hide');
                    toastr.success('Đã gửi yêu cầu bổ sung.');
                    setTimeout(function () { window.location.href = '/Review/Index'; }, 1200);
                },
                function (msg) {
                    toastr.error(msg);
                    setButtonLoading(btnConfirm, false);
                });
        });
    }

    function initReject() {
        var btnOpen = document.getElementById('btnReject');
        var btnConfirm = document.getElementById('btnConfirmTuChoi');
        if (!btnOpen || !btnConfirm) return;

        btnOpen.addEventListener('click', function () {
            document.getElementById('lyDoTuChoi').value = '';
            $('#modalTuChoi').modal('show');
        });

        btnConfirm.addEventListener('click', function () {
            var value = document.getElementById('lyDoTuChoi').value.trim();
            if (!value) {
                toastr.warning('Vui lòng nhập lý do từ chối.');
                return;
            }
            setButtonLoading(btnConfirm, true);
            postJson(API.reject, { lyDoTuChoi: value },
                function () {
                    $('#modalTuChoi').modal('hide');
                    toastr.success('Đã từ chối báo cáo.');
                    setTimeout(function () { window.location.href = '/Review/Index'; }, 1200);
                },
                function (msg) {
                    toastr.error(msg);
                    setButtonLoading(btnConfirm, false);
                });
        });
    }

    $(document).ready(function () {
        if (trangThai === 2) {
            initApprove();
            initRequestSupplement();
            initReject();
        }
    });
})();
