/**
 * TNLD Báo cáo định kỳ - Detail (ChiTiet) (M0142)
 * Workflow actions: XacNhan, YeuCauBoSung, TuChoi (modal-based JSON endpoints)
 */
(function () {
    'use strict';

    const Detail = {
        cfg: window.bcdkDetail || {},

        init: function () {
            this.bindEvents();
            this.loadAttachments();
        },

        bindEvents: function () {
            const self = this;
            $('#btnXacNhan').on('click', () => $('#modalXacNhan').modal('show'));
            $('#btnYCBS').on('click', () => $('#modalYCBS').modal('show'));
            $('#btnTuChoi').on('click', () => $('#modalTuChoi').modal('show'));

            $('#btnConfirmXacNhan').on('click', () => self.doXacNhan());
            $('#btnConfirmYCBS').on('click', () => self.doYCBS());
            $('#btnConfirmTuChoi').on('click', () => self.doTuChoi());
        },

        loadAttachments: function () {
            // Files are server-rendered from Model.Files (FileAttachment polymorphic table). No-op.
        },

        escape: function (s) {
            if (s == null) return '';
            return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        },

        getToken: function () { return $('input[name="__RequestVerificationToken"]').val(); },

        doXacNhan: function () {
            const self = this;
            const $btn = $('#btnConfirmXacNhan').prop('disabled', true);
            $.ajax({
                url: self.cfg.xacNhanUrl,
                type: 'POST',
                data: { id: self.cfg.id },
                headers: { 'RequestVerificationToken': self.getToken() },
                success: function (resp) {
                    if (resp && resp.success) {
                        toastr.success(resp.message || 'Đã xác nhận');
                        $('#modalXacNhan').modal('hide');
                        setTimeout(() => location.reload(), 600);
                    } else {
                        toastr.error((resp && resp.message) || 'Xác nhận thất bại');
                        $btn.prop('disabled', false);
                    }
                },
                error: xhr => { TNLDShared.handleAjaxError(xhr); $btn.prop('disabled', false); }
            });
        },

        doYCBS: function () {
            const self = this;
            const noiDung = ($('#ycbsNoiDung').val() || '').trim();
            if (!noiDung) { toastr.error('Vui lòng nhập nội dung'); return; }
            const $btn = $('#btnConfirmYCBS').prop('disabled', true);
            $.ajax({
                url: self.cfg.ycbsUrl,
                type: 'POST',
                data: { id: self.cfg.id, noiDung: noiDung },
                headers: { 'RequestVerificationToken': self.getToken() },
                success: function (resp) {
                    if (resp && resp.success) {
                        toastr.success(resp.message || 'Đã gửi yêu cầu bổ sung');
                        $('#modalYCBS').modal('hide');
                        setTimeout(() => location.reload(), 600);
                    } else {
                        toastr.error((resp && resp.message) || 'Thất bại');
                        $btn.prop('disabled', false);
                    }
                },
                error: xhr => { TNLDShared.handleAjaxError(xhr); $btn.prop('disabled', false); }
            });
        },

        doTuChoi: function () {
            const self = this;
            const lyDo = ($('#tuChoiLyDo').val() || '').trim();
            if (!lyDo) { toastr.error('Vui lòng nhập lý do'); return; }
            const $btn = $('#btnConfirmTuChoi').prop('disabled', true);
            $.ajax({
                url: self.cfg.tuChoiUrl,
                type: 'POST',
                data: { id: self.cfg.id, lyDo: lyDo },
                headers: { 'RequestVerificationToken': self.getToken() },
                success: function (resp) {
                    if (resp && resp.success) {
                        toastr.success(resp.message || 'Đã từ chối');
                        $('#modalTuChoi').modal('hide');
                        setTimeout(() => location.reload(), 600);
                    } else {
                        toastr.error((resp && resp.message) || 'Thất bại');
                        $btn.prop('disabled', false);
                    }
                },
                error: xhr => { TNLDShared.handleAjaxError(xhr); $btn.prop('disabled', false); }
            });
        }
    };

    $(document).ready(() => Detail.init());
})();
