/**
 * BaoCaoQuyCheDanChu Review Management — Client JS (IIFE Pattern)
 * Module: M0093 — Báo cáo Quy chế Dân chủ cơ sở
 * Screen: SCR-NV-REV-002 — Chi tiết & Xác nhận Báo cáo QCDC
 *
 * ARCHITECTURE: JavaScript → MVC Controller → ApiService → Backend API
 */
(function () {
    'use strict';

    // ─── MVC Action Endpoints (NOT /api/v1/...) ─────────────────
    var baoCaoId     = window.baoCaoId || '';
    var trangThai    = window.baoCaoTrangThai || 0;

    const API = {
        approve:          '/BaoCaoQuyCheDanChu/XacNhan/' + baoCaoId,
        requestSupplement:'/BaoCaoQuyCheDanChu/YeuCauBoSung/' + baoCaoId,
        reject:           '/BaoCaoQuyCheDanChu/TuChoi/' + baoCaoId,
        versionHistory:   '/BaoCaoQuyCheDanChu/GetVersionHistory/' + baoCaoId
    };

    // ─── Utility ────────────────────────────────────────────────
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text)));
        return div.innerHTML;
    }

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

    // ─── Approve ────────────────────────────────────────────────
    function initApprove() {
        var btn = document.getElementById('btnApprove');
        if (!btn) return;

        btn.addEventListener('click', function () {
            var ghiChu = (document.getElementById('ghiChuThamDinh') || {}).value || '';
            var mucTuanThuQCDC = (document.getElementById('mucTuanThuQCDC') || {}).value || '';
            var mucToChucDTDK = (document.getElementById('mucToChucDTDK') || {}).value || '';
            if (!mucTuanThuQCDC || !mucToChucDTDK) {
                toastr.warning('Vui lòng chọn đủ mức tuân thủ trước khi xác nhận.');
                return;
            }
            if (!confirm('Xác nhận báo cáo này?\n\nHành động sẽ thay đổi trạng thái sang "Đã xác nhận".')) return;

            var mergedNote = ghiChu;
            if (mergedNote && mergedNote.trim().length > 0) {
                mergedNote += '\n';
            }
            mergedNote += '[Đánh giá] Mức tuân thủ QCDC: ' + mucTuanThuQCDC + '; Mức tổ chức ĐTĐK: ' + mucToChucDTDK;

            setButtonLoading(btn, true);
            postJson(API.approve, { ghiChuThamDinh: mergedNote },
                function (json) {
                    toastr.success('Đã xác nhận báo cáo thành công.');
                    setTimeout(function () { window.location.href = '/Review/Index'; }, 1200);
                },
                function (msg) {
                    toastr.error(msg);
                    setButtonLoading(btn, false);
                }
            );
        });
    }

    // ─── Request Supplement ─────────────────────────────────────
    function initRequestSupplement() {
        var btnOpen    = document.getElementById('btnRequestSupplement');
        var btnConfirm = document.getElementById('btnConfirmYCBS');
        if (!btnOpen || !btnConfirm) return;

        btnOpen.addEventListener('click', function () {
            document.getElementById('noiDungYCBS').value = '';
            $('#modalYCBS').modal('show');
        });

        btnConfirm.addEventListener('click', function () {
            var noiDung = document.getElementById('noiDungYCBS').value.trim();
            if (!noiDung) {
                toastr.warning('Vui lòng nhập nội dung yêu cầu bổ sung.');
                return;
            }
            setButtonLoading(btnConfirm, true);
            postJson(API.requestSupplement, { noiDungYeuCauBoSung: noiDung },
                function () {
                    $('#modalYCBS').modal('hide');
                    toastr.success('Đã gửi yêu cầu bổ sung thành công.');
                    setTimeout(function () { window.location.href = '/Review/Index'; }, 1200);
                },
                function (msg) {
                    toastr.error(msg);
                    setButtonLoading(btnConfirm, false);
                }
            );
        });
    }

    // ─── Reject ─────────────────────────────────────────────────
    function initReject() {
        var btnOpen    = document.getElementById('btnReject');
        var btnConfirm = document.getElementById('btnConfirmTuChoi');
        if (!btnOpen || !btnConfirm) return;

        btnOpen.addEventListener('click', function () {
            document.getElementById('lyDoTuChoi').value = '';
            $('#modalTuChoi').modal('show');
        });

        btnConfirm.addEventListener('click', function () {
            var lyDo = document.getElementById('lyDoTuChoi').value.trim();
            if (!lyDo) {
                toastr.warning('Vui lòng nhập lý do từ chối.');
                return;
            }
            setButtonLoading(btnConfirm, true);
            postJson(API.reject, { lyDoTuChoi: lyDo },
                function () {
                    $('#modalTuChoi').modal('hide');
                    toastr.success('Đã từ chối báo cáo.');
                    setTimeout(function () { window.location.href = '/Review/Index'; }, 1200);
                },
                function (msg) {
                    toastr.error(msg);
                    setButtonLoading(btnConfirm, false);
                }
            );
        });
    }

    // ─── Version History ────────────────────────────────────────
    function initVersionHistory() {
        var btnToggle = document.getElementById('btnToggleHistory');
        if (!btnToggle) return;

        var loaded = false;

        btnToggle.addEventListener('click', function () {
            var card = document.getElementById('cardLichSu');
            if (card.style.display === 'none') {
                card.style.display = '';
                btnToggle.innerHTML = '<i class="fas fa-chevron-up mr-1"></i> Ẩn lịch sử';
                if (!loaded) {
                    loadVersionHistory();
                    loaded = true;
                }
            } else {
                card.style.display = 'none';
                btnToggle.innerHTML = '<i class="fas fa-history mr-1"></i> Xem lịch sử phiên bản';
            }
        });
    }

    function loadVersionHistory() {
        fetch(API.versionHistory, { method: 'GET' })
        .then(function (r) { return r.json(); })
        .then(function (json) {
            var container = document.getElementById('versionHistoryContent');
            if (!json.success || !json.data || json.data.length === 0) {
                container.innerHTML = '<p class="text-muted text-center">Chưa có lịch sử phiên bản.</p>';
                return;
            }
            var rows = json.data.map(function (v, i) {
                return '<tr>'
                    + '<td class="text-center">' + (i + 1) + '</td>'
                    + '<td><strong>' + escapeHtml(v.maBC) + '</strong> <span style="color:#64748b; font-size:12px;">v' + v.phienBan + '</span></td>'
                    + '<td>' + (v.ngayNop ? new Date(v.ngayNop).toLocaleDateString('vi-VN') : '—') + '</td>'
                    + '<td>' + escapeHtml(v.trangThaiDisplay) + '</td>'
                    + '<td style="font-size:12px; color:#64748b;">' + escapeHtml(v.noiDungYeuCauBoSung || v.ghiChuThamDinh || '') + '</td>'
                    + '</tr>';
            }).join('');
            container.innerHTML = '<table class="table table-sm table-bordered" style="font-size:13px;">'
                + '<thead><tr><th>STT</th><th>Mã BC / Phiên bản</th><th>Ngày nộp</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>'
                + '<tbody>' + rows + '</tbody></table>';
        })
        .catch(function () {
            document.getElementById('versionHistoryContent').innerHTML = '<p class="text-danger">Không thể tải lịch sử phiên bản.</p>';
        });
    }

    // ─── Init ───────────────────────────────────────────────────
    $(document).ready(function () {
        if (trangThai === 2) {
            initApprove();
            initRequestSupplement();
            initReject();
        }
        initVersionHistory();
    });

})();
