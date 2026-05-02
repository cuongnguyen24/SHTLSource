/**
 * Ky Bao Cao THSDLD Management JavaScript
 * Pattern: SupportingIndustry (quickSearch + partial reload, no DataTables)
 * Actions: Add, Edit, Mo Ky, Dong Ky, Delete
 */
(function () {
    'use strict';

    let currentActionId = null;
    let currentActionType = null; // 'mo' | 'dong' | 'delete'
    let isSubmitting = false;

    // ── Reload danh sach qua quickSearch form ─────────────────────────────────

    function reloadList() {
        $('#frmKyBaoCaoTHSDLD').trigger('submit');
    }

    // ── Auto-fill Han Nop khi chon Loai Ky hoac thay Nam ─────────────────────

    function autoFillHanNop() {
        var selectedId = $('#loaiKyBaoCaoId').val();
        var nam = parseInt($('#namBaoCao').val(), 10);
        if (!selectedId || !nam || isNaN(nam)) return;

        var loaiKy = (window.loaiKyList || []).find(function (x) { return x.id === selectedId; });
        if (!loaiKy) return;

        var hanNopStr = null;
        if (loaiKy.thuTu === 1) {
            hanNopStr = nam + '-06-05'; // Ky I: 05/06
        } else if (loaiKy.thuTu === 2) {
            hanNopStr = nam + '-12-05'; // Ky II: 05/12
        }

        if (hanNopStr) {
            $('#hanNop').val(hanNopStr);
            $('#hanNopHint').show();
        }
    }

    // ── Mo modal Them moi ─────────────────────────────────────────────────────

    $(document).on('click', '#btnAddKyBaoCao', function () {
        resetForm();
        $('#modalKyBaoCaoLabel').html('<i class="fas fa-calendar-plus mr-2"></i>Thêm kỳ báo cáo mới');
        $('#loaiKyBaoCaoId').prop('disabled', false);
        $('#namBaoCao').val(new Date().getFullYear());
        $('#modalKyBaoCao').modal('show');
    });

    // ── Mo ky ─────────────────────────────────────────────────────────────────

    $(document).on('click', '.btn-mo-ky', function () {
        currentActionId = $(this).data('id');
        currentActionType = 'mo';
        var ten = $(this).data('ten');

        $('#confirmActionTitle').html('<i class="fas fa-lock-open mr-2 text-info"></i>Mở kỳ báo cáo');
        $('#confirmActionMessage').text('Bạn có chắc chắn muốn mở kỳ báo cáo "' + ten + '"?');
        $('#confirmActionSubMessage')
            .html('<i class="fas fa-info-circle mr-1"></i>Sau khi mở, doanh nghiệp có thể nộp báo cáo cho kỳ này.')
            .show();
        $('#btnConfirmAction')
            .removeClass('btn-figma-danger btn-figma-warning')
            .addClass('btn-figma-primary')
            .html('<i class="fas fa-lock-open mr-1"></i> Mở kỳ');
        $('#modalConfirmAction').modal('show');
    });

    // ── Dong ky ───────────────────────────────────────────────────────────────

    $(document).on('click', '.btn-dong-ky', function () {
        currentActionId = $(this).data('id');
        currentActionType = 'dong';
        var ten = $(this).data('ten');

        $('#confirmActionTitle').html('<i class="fas fa-lock mr-2 text-warning"></i>Đóng kỳ báo cáo');
        $('#confirmActionMessage').text('Bạn có chắc chắn muốn đóng kỳ báo cáo "' + ten + '"?');
        $('#confirmActionSubMessage')
            .html('<i class="fas fa-exclamation-triangle mr-1"></i>Sau khi đóng, doanh nghiệp không thể nộp thêm báo cáo.')
            .show();
        $('#btnConfirmAction')
            .removeClass('btn-figma-primary btn-figma-danger')
            .addClass('btn-figma-warning')
            .html('<i class="fas fa-lock mr-1"></i> Đóng kỳ');
        $('#modalConfirmAction').modal('show');
    });

    // ── Xac nhan thao tac ─────────────────────────────────────────────────────

    $(document).on('click', '#btnConfirmAction', function () {
        if (!currentActionId || !currentActionType) return;

        var url, method, successMsg;
        switch (currentActionType) {
            case 'mo':
                url = '/KyBaoCaoTHSDLD/Mo/' + currentActionId;
                method = 'POST';
                successMsg = 'Mở kỳ báo cáo thành công';
                break;
            case 'dong':
                url = '/KyBaoCaoTHSDLD/Dong/' + currentActionId;
                method = 'POST';
                successMsg = 'Đóng kỳ báo cáo thành công';
                break;
            case 'delete':
                url = '/KyBaoCaoTHSDLD/Delete/' + currentActionId;
                method = 'DELETE';
                successMsg = 'Xóa kỳ báo cáo thành công';
                break;
            default:
                return;
        }

        var $btn = $('#btnConfirmAction');
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');

        var token = $('input[name="__RequestVerificationToken"]').val();
        $.ajax({
            url: url,
            type: method,
            headers: { 'RequestVerificationToken': token },
            success: function (response) {
                if (response && response.isSuccess) {
                    toastr.success(response.message || successMsg, 'Thành công');
                    $('#modalConfirmAction').modal('hide');
                    reloadList();
                } else {
                    toastr.error((response && response.message) || 'Có lỗi xảy ra', 'Lỗi');
                }
            },
            error: function (xhr) {
                var actionLabel = currentActionType === 'delete' ? 'xóa'
                    : currentActionType === 'mo' ? 'mở' : 'đóng';
                handleAjaxError(xhr, actionLabel + ' kỳ báo cáo');
            },
            complete: function () {
                $btn.prop('disabled', false);
                // nút label được set lại khi modal đóng / mở lại
            }
        });
    });

    // ── Reset trang thai sau khi dong modal xac nhan ──────────────────────────

    $(document).on('hidden.bs.modal', '#modalConfirmAction', function () {
        currentActionId = null;
        currentActionType = null;
    });

    // ── Form helpers ──────────────────────────────────────────────────────────

    function resetForm() {
        var form = document.getElementById('formKyBaoCao');
        if (form) form.reset();
        $('#kyBaoCaoId').val('');
        $('#loaiKyBaoCaoId').prop('disabled', false);
        $('#hanNopHint').hide();
        clearErrors();
    }

    function validateForm(isEdit) {
        var valid = true;
        clearErrors();

        var tenKy = $('#tenKy').val().trim();
        if (!tenKy) {
            showError('#tenKy', 'Tên kỳ báo cáo là bắt buộc');
            valid = false;
        }

        if (!isEdit) {
            var loaiKy = $('#loaiKyBaoCaoId').val();
            if (!loaiKy) {
                showError('#loaiKyBaoCaoId', 'Loại kỳ là bắt buộc');
                valid = false;
            }
        }

        var nam = parseInt($('#namBaoCao').val(), 10);
        if (!nam || nam < 2020 || nam > 2100) {
            showError('#namBaoCao', 'Năm không hợp lệ (2020–2100)');
            valid = false;
        }

        var batDau = $('#ngayBatDau').val();
        if (!batDau) {
            showError('#ngayBatDau', 'Ngày bắt đầu là bắt buộc');
            valid = false;
        }

        var ketThuc = $('#ngayKetThuc').val();
        if (!ketThuc) {
            showError('#ngayKetThuc', 'Ngày kết thúc là bắt buộc');
            valid = false;
        } else if (batDau && ketThuc < batDau) {
            showError('#ngayKetThuc', 'Ngày kết thúc phải sau ngày bắt đầu');
            valid = false;
        }

        var hanNop = $('#hanNop').val();
        if (!hanNop) {
            showError('#hanNop', 'Hạn nộp là bắt buộc');
            valid = false;
        }

        return valid;
    }

    function showError(selector, message) {
        var $field = $(selector);
        $field.addClass('is-invalid');
        $field.after('<div class="invalid-feedback" style="display:block;">' + message + '</div>');
    }

    function clearErrors() {
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
    }

    function formatDateForInput(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    function handleAjaxError(xhr, action) {
        if (xhr.responseJSON) {
            if (xhr.responseJSON.errors && Array.isArray(xhr.responseJSON.errors)) {
                xhr.responseJSON.errors.forEach(function (e) { toastr.error(e, 'Lỗi'); });
                return;
            }
            if (xhr.responseJSON.message) {
                toastr.error(xhr.responseJSON.message, 'Lỗi');
                return;
            }
        }
        toastr.error('Có lỗi xảy ra khi ' + action, 'Lỗi');
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    $(document).ready(function () {
        // Auto-fill HanNop khi chon Loai Ky hoac thay doi Nam
        $(document).on('change', '#loaiKyBaoCaoId, #namBaoCao', autoFillHanNop);
    });

}());