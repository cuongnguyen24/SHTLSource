/**
 * Violation Management JavaScript (Quản lý Xử phạt VPHC)
 *
 * Kiến trúc:
 *  - Form Create/Edit được tải động vào #commonModal qua class .quickModal (main.js)
 *  - Partial view _ViolationForm.cshtml tự init Flatpickr + Select2 + FileUpload
 *  - Module này xử lý: lưu form, xóa record, xóa file đính kèm hiện có
 *  - Tất cả event handler dùng delegation để hoạt động với DOM động
 */
(function () {
    'use strict';

    // ── Module state ────────────────────────────────────────────────────────────

    var deleteId   = null;
    var deleteName = '';

    // ── Bootstrap ───────────────────────────────────────────────────────────────

    $(document).ready(function () {
        initializeEventHandlers();
    });

    // ── Event handlers ──────────────────────────────────────────────────────────

    function initializeEventHandlers() {

        // Nút xóa (delegated — danh sách re-render qua quickSearch)
        $('#divViolation').on('click', '.btn-delete', handleDeleteClick);

        // Xác nhận xóa
        $('#btnConfirmDelete').off('click').on('click', handleConfirmDelete);

        // Lưu form (Create hoặc Edit) — delegated vì form nằm trong #commonModal
        $(document).on('click', '#btnSaveViolationForm', saveViolationForm);

        // Kiểm tra trùng Số QĐ khi rời trường nhập (blur)
        $(document).on('blur', '#vm_decisionNumber', checkDecisionNumberDuplicate);

        // Xóa cảnh báo ngay khi người dùng sửa lại
        $(document).on('input', '#vm_decisionNumber', clearDecisionNumberError);

        // Hiện / ẩn trường Số tiền phạt khi chọn hình thức xử phạt
        $(document).on('change', '#vm_penaltyType', function () {
            var isFine = $(this).val() === 'PhatTien';
            $('#vm_fineAmountGroup').toggle(isFine);
            $('#vm_fineAmount').prop('required', isFine);
            if (!isFine) $('#vm_fineAmount').val('');
        });

        // Hiện / ẩn trường Ngày hoàn thành khi tình trạng = DaKP
        $(document).on('change', '#vm_remediationStatus', function () {
            var isDone = $(this).val() === 'DaKP';
            $('#vm_completionDateGroup').toggle(isDone);
            $('#vm_completionDate').prop('required', isDone);
            if (!isDone) {
                var el = document.getElementById('vm_completionDate');
                if (el && el._flatpickr) el._flatpickr.clear();
                else if (el) el.value = '';
            }
        });

        // Xóa file đính kèm hiện có khỏi danh sách trong #commonModal
        $(document).on('click', '#commonModal .vm-btn-remove-file', function () {
            $(this).closest('.vm-attachment-item').remove();
            if ($('#vm_existingAttachmentList .vm-attachment-item').length === 0) {
                $('#vm_existingAttachmentSection').hide();
            }
        });

        // Dọn dẹp uploader khi đóng #commonModal
        $('#commonModal').on('hidden.bs.modal', function () {
            if (window.vmUploader) {
                window.vmUploader.clear();
                window.vmUploader = null;
            }
        });
    }

    // ── Reload danh sách ────────────────────────────────────────────────────────

    function reloadList() {
        $('#frmViolation').submit();
    }

    // ── Save form (Create / Edit) ───────────────────────────────────────────────

    /**
     * Gửi form lên server.
     * Xác định Create hay Edit dựa vào giá trị của #vm_id.
     */
    function saveViolationForm() {
        var form = document.getElementById('violationForm');
        if (!form) return;

        // Guard: trường Số QĐ đang báo lỗi trùng — chặn lưu
        if ($('#vm_decisionNumberFeedback').is(':visible')) {
            toastr.warning('Vui lòng sửa lỗi trùng Số QĐ xử phạt trước khi lưu.', 'Cảnh báo');
            $('#vm_decisionNumber').focus();
            return;
        }

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        var violationId = $('#vm_id').val();
        var isEdit = !!(violationId);
        // Đọc URL từ action attribute của form (do asp-action tag helper tạo ra)
        var url = $(form).attr('action') || (isEdit ? '/Violation/Update/' + violationId : '/Violation/Create');

        var $btn = $('#btnSaveViolationForm');
        var originalHtml = $btn.html();
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang lưu...');

        // Đọc token từ form được inject vào commonModal
        var token = $('#commonModal input[name="__RequestVerificationToken"]').val()
                 || $('input[name="__RequestVerificationToken"]').first().val();

        var fd = buildViolationFormData(isEdit);

        // Gắn file mới từ FileUploadComponent (được khởi tạo trong partial's IIFE)
        if (window.vmUploader) {
            window.vmUploader.getFiles().forEach(function (f) {
                fd.append('AttachmentFiles', f);
            });
        }

        $.ajax({
            url: url,
            type: 'POST',
            contentType: false,
            processData: false,
            headers: { 'RequestVerificationToken': token },
            data: fd,
            success: function (response) {
                if (response.isSuccess) {
                    $('#commonModal').modal('hide');
                    toastr.success(
                        response.message || (isEdit ? 'Cập nhật thành công' : 'Thêm mới thành công'),
                        'Thành công'
                    );
                    reloadList();
                } else {
                    toastr.error(response.message || 'Không thể lưu bản ghi', 'Lỗi');
                    $btn.prop('disabled', false).html(originalHtml);
                }
            },
            error: function (xhr) {
                var errMsg = (xhr.responseJSON && xhr.responseJSON.message)
                    ? xhr.responseJSON.message
                    : 'Có lỗi xảy ra khi lưu';
                toastr.error(errMsg, 'Lỗi');
                $btn.prop('disabled', false).html(originalHtml);
            }
        });
    }

    /**
     * Thu thập toàn bộ giá trị từ form thống nhất.
     * Nếu isEdit = true, gắn thêm danh sách file hiện còn giữ lại.
     * @param {boolean} isEdit
     * @returns {FormData}
     */
    function buildViolationFormData(isEdit) {
        var fd = new FormData();

        fd.append('enterpriseId',         $('#vm_enterpriseId').val() || '');
        fd.append('violationField',       $('#vm_violationField').val() || '');
        fd.append('decisionNumber',       $('#vm_decisionNumber').val() || '');
        fd.append('decisionDate',         parseFlatpickrToISO('#vm_decisionDate'));
        fd.append('issuingAuthority',     $('#vm_issuingAuthority').val() || '');
        fd.append('violationDescription', $('#vm_violationDescription').val() || '');
        fd.append('penaltyType',          $('#vm_penaltyType').val() || '');
        fd.append('remedyMeasures',       $('#vm_remedyMeasures').val() || '');
        fd.append('remediationDeadline',  parseFlatpickrToISO('#vm_remediationDeadline'));
        fd.append('remediationStatus',    $('#vm_remediationStatus').val() || '');

        var fineAmt = $('#vm_fineAmount').val();
        if (fineAmt) fd.append('fineAmount', parseFloat(fineAmt));

        var compDate = parseFlatpickrToISO('#vm_completionDate');
        if (compDate) fd.append('completionDate', compDate);

        var notes = $('#vm_notes').val();
        if (notes) fd.append('notes', notes);

        if (isEdit) {
            // Gắn danh sách file hiện còn giữ lại (những item chưa bị user xóa khỏi DOM)
            $('#vm_existingAttachmentList .vm-attachment-item').each(function () {
                fd.append('RemainingFilePaths', $(this).data('path') || '');
                fd.append('RemainingFileNames', $(this).data('name') || '');
            });
        }

        return fd;
    }

    // ── Delete ──────────────────────────────────────────────────────────────────

    function handleDeleteClick(e) {
        e.preventDefault();
        var $btn = $(this);
        deleteId   = $btn.data('id');
        deleteName = $btn.data('name');

        $('#deleteViolationName').text(deleteName);
        $('#deleteViolationId').val(deleteId);
        $('#deleteModal').modal('show');
    }

    function handleConfirmDelete() {
        if (!deleteId) {
            toastr.error('Không tìm thấy ID bản ghi', 'Lỗi');
            return;
        }

        var $btn = $('#btnConfirmDelete');
        var originalHtml = $btn.html();
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xóa...');

        var token = $('input[name="__RequestVerificationToken"]').first().val();

        $.ajax({
            url: '/Violation/Delete/' + deleteId,
            type: 'POST',
            headers: { 'RequestVerificationToken': token },
            data: { __RequestVerificationToken: token },
            success: function (response) {
                $('#deleteModal').modal('hide');
                $btn.prop('disabled', false).html(originalHtml);

                if (response.isSuccess) {
                    toastr.success(response.message || 'Xóa thành công', 'Thành công');
                    reloadList();
                } else {
                    toastr.error(response.message || 'Không thể xóa bản ghi', 'Lỗi');
                }

                deleteId   = null;
                deleteName = '';
            },
            error: function (xhr) {
                $('#deleteModal').modal('hide');
                var errMsg = (xhr.responseJSON && xhr.responseJSON.message)
                    ? xhr.responseJSON.message
                    : 'Có lỗi xảy ra khi xóa';
                toastr.error(errMsg, 'Lỗi');
                $btn.prop('disabled', false).html(originalHtml);
            }
        });
    }

    // ── Duplicate check: Số QĐ xử phạt ────────────────────────────────────────

    /**
     * Kiểm tra trùng Số QĐ xử phạt khi rời trường nhập (blur).
     * Edit mode: loại trừ ID hiện tại khỏi kiểm tra.
     */
    function checkDecisionNumberDuplicate() {
        var val = ($('#vm_decisionNumber').val() || '').trim();
        if (!val) { clearDecisionNumberError(); return; }
        var excludeId = $('#vm_id').val();
        var url = '/Violation/CheckDecisionNumber?decisionNumber=' + encodeURIComponent(val);
        if (excludeId) url += '&excludeId=' + encodeURIComponent(excludeId);
        $.ajax({
            url: url,
            type: 'GET',
            success: function (result) {
                if (result && result.exists) {
                    showDecisionNumberError('Số QĐ xử phạt "' + val + '" đã tồn tại trong hệ thống.');
                } else {
                    clearDecisionNumberError();
                }
            }
        });
    }

    function showDecisionNumberError(msg) {
        $('#vm_decisionNumberMsg').text(msg);
        $('#vm_decisionNumberFeedback').show();
        $('#vm_decisionNumber').addClass('is-invalid').css('border-color', '#dc3545');
    }

    function clearDecisionNumberError() {
        $('#vm_decisionNumberFeedback').hide();
        $('#vm_decisionNumber').removeClass('is-invalid').css('border-color', '');
    }

    // ── Flatpickr helpers ───────────────────────────────────────────────────────

    /**
     * Đọc ngày từ Flatpickr-managed input, trả về ISO yyyy-MM-dd.
     */
    function parseFlatpickrToISO(selector) {
        var el = document.querySelector(selector);
        if (!el) return '';

        if (el._flatpickr && el._flatpickr.selectedDates.length > 0) {
            var d     = el._flatpickr.selectedDates[0];
            var year  = d.getFullYear();
            var month = ('0' + (d.getMonth() + 1)).slice(-2);
            var day   = ('0' + d.getDate()).slice(-2);
            return year + '-' + month + '-' + day;
        }

        // Fallback: parse dd/MM/yyyy thủ công
        var val   = (el.value || '').trim();
        var parts = val.split('/');
        if (parts.length === 3) return parts[2] + '-' + parts[1] + '-' + parts[0];

        return val;
    }

})();