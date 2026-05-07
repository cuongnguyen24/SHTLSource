/**
 * BaoCaoTHSDLD — Details workflow module
 * M0086 — Xác nhận / Yêu cầu bổ sung / Từ chối
 */
(function ($) {
    'use strict';

    var token = $('input[name="__RequestVerificationToken"]').val();

    function doPost(url, data, onSuccess) {
        $.ajax({
            url: url,
            method: 'POST',
            headers: { 'RequestVerificationToken': token },
            data: data,
            success: function (resp) {
                if (resp.success) {
                    toastr.success(resp.message);
                    setTimeout(function () { window.location.reload(); }, 800);
                } else {
                    toastr.error(resp.message);
                }
            },
            error: function () { toastr.error('Lỗi không xác định.'); }
        });
    }

    $(document).ready(function () {
        // Xác nhận
        $('#btnXacNhan').on('click', function () {
            $('#xacNhanGhiChu').val('');
            $('#xacNhanModal').modal('show');
        });

        $('#btnConfirmXacNhan').on('click', function () {
            doPost('/BaoCaoTHSDLD/XacNhan/' + baocaoId, {
                id: baocaoId,
                ghiChuNoiBo: $('#xacNhanGhiChu').val()
            });
            $('#xacNhanModal').modal('hide');
        });

        // Yêu cầu bổ sung
        $('#btnYeuCauBS').on('click', function () {
            $('#yeuCauBSNoiDung').val('');
            $('#yeuCauBSModal').modal('show');
        });

        $('#btnConfirmYeuCauBS').on('click', function () {
            var noiDung = $('#yeuCauBSNoiDung').val().trim();
            if (!noiDung) { toastr.error('Vui lòng nhập nội dung yêu cầu bổ sung.'); return; }
            doPost('/BaoCaoTHSDLD/YeuCauBoSung/' + baocaoId, {
                id: baocaoId,
                noiDung: noiDung
            });
            $('#yeuCauBSModal').modal('hide');
        });

        // Từ chối
        $('#btnTuChoi').on('click', function () {
            $('#tuChoiLyDo').val('');
            $('#tuChoiModal').modal('show');
        });

        $('#btnConfirmTuChoi').on('click', function () {
            var lyDo = $('#tuChoiLyDo').val().trim();
            if (!lyDo) { toastr.error('Vui lòng nhập lý do từ chối.'); return; }
            doPost('/BaoCaoTHSDLD/TuChoi/' + baocaoId, {
                id: baocaoId,
                lyDo: lyDo
            });
            $('#tuChoiModal').modal('hide');
        });
    });

})(jQuery);
