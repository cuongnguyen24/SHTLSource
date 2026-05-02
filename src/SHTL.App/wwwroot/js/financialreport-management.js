/**
 * Financial Report Management JavaScript (Quản lý Báo cáo Tài chính)
 * IIFE pattern — Server-side rendering + Slide-in Panel + Delete Modal + Generate Schedule
 * Search/Pagination handled by quickSearch form (main.js)
 */
(function () {
    'use strict';

    var deleteId = null;

    // ── URLs (from window.finConfig set in Index.cshtml) ─────────────
    function getUrls() {
        return window.finConfig && window.finConfig.urls ? window.finConfig.urls : {};
    }

    $(document).ready(function () {
        initializeEventHandlers();
    });

    // ══════════════════════════════════════════════════════════════════
    // Reload table helper (submits quickSearch form)
    // ══════════════════════════════════════════════════════════════════

    function reloadTable() {
        $('#frmFinancialReport').trigger('submit');
    }

    // ══════════════════════════════════════════════════════════════════
    // Event Handlers
    // ══════════════════════════════════════════════════════════════════

    function initializeEventHandlers() {
        // Summary card click → filter by status
        $(document).on('click', '[data-summary-filter]', function () {
            var status = $(this).attr('data-summary-filter');
            $('select[name="submissionStatus"]').val(status);
            if (typeof $.fn.select2 !== 'undefined') {
                $('select[name="submissionStatus"]').trigger('change.select2');
            }
            reloadTable();
        });

        // ── Slide-in Panel ──────────────────────────────────────────
        // Record Submission (delegated)
        $('#divFinancialReport').on('click', '.btn-record-submission', function () {
            openPanel($(this).data('id'), 'submit');
        });

        // Edit (delegated)
        $('#divFinancialReport').on('click', '.btn-edit', function () {
            openPanel($(this).data('id'), 'update');
        });

        // Panel close
        $('#btnClosePanel, #btnCancelPanel, #panelBackdrop').on('click', closePanel);

        // Esc key
        $(document).on('keydown', function (e) {
            if (e.key === 'Escape' && $('#submissionPanel').css('right') === '0px') {
                closePanel();
            }
        });

        // Save panel
        $('#btnSavePanel').on('click', handleSavePanel);

        // File upload
        $('#panelFileBrowse').on('click', function () { $('#panelFileInput').trigger('click'); });
        $('#panelFileInput').on('change', handleFileSelected);
        $('#panelFileRemove').on('click', function () {
            $('#panelFileInput').val('');
            $('#panelFileInfo').addClass('d-none');
            $('#panelFileDropZone').show();
        });

        // Drag & drop
        var $dropZone = $('#panelFileDropZone');
        $dropZone.on('dragover', function (e) {
            e.preventDefault();
            $(this).css('border-color', '#3b82f6');
        });
        $dropZone.on('dragleave', function () {
            $(this).css('border-color', '#cbd5e1');
        });
        $dropZone.on('drop', function (e) {
            e.preventDefault();
            $(this).css('border-color', '#cbd5e1');
            var files = e.originalEvent.dataTransfer.files;
            if (files.length > 0) {
                $('#panelFileInput')[0].files = files;
                handleFileSelected();
            }
        });

        // ── Delete Modal ────────────────────────────────────────────
        $('#divFinancialReport').on('click', '.btn-delete-report', function () {
            deleteId = $(this).data('id');
            $('#deleteRecordName').text($(this).data('name'));
            $('#deleteRecordYear').text($(this).data('year'));
            $('#deletionReason').val('');
            $('#deletionReasonError').addClass('d-none');
            $('#deleteRecordId').val(deleteId);
            $('#deleteModal').modal('show');
        });

        $('#btnConfirmDelete').on('click', handleConfirmDelete);

        // ── Generate Schedule ───────────────────────────────────────
        $('#btnGenerateSchedule').on('click', handleGenerateSchedule);
    }

    // ══════════════════════════════════════════════════════════════════
    // Slide-in Panel
    // ══════════════════════════════════════════════════════════════════

    function openPanel(id, mode) {
        resetPanel();
        $('#panelMode').val(mode);
        $('#panelRecordId').val(id);

        // Loading state
        $('#btnSavePanel').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Đang tải...');

        $.ajax({
            url: getUrls().getById + '/' + id,
            type: 'GET',
            success: function (resp) {
                if (!resp || !resp.isSuccess || !resp.data) {
                    toastr.error('Không thể tải thông tin bản ghi.', 'Lỗi');
                    return;
                }
                var d = resp.data;

                // Header info
                $('#panelEnterpriseName').text(d.enterpriseName || '');
                $('#panelFiscalYear').text(d.fiscalYear || '');
                $('#panelDueDate').text(d.dueDate ? formatDate(d.dueDate) : '');

                // FDI indicator
                if (d.isAuditRequired) {
                    $('#panelFdiIndicator').show();
                    $('#panelAuditUnitRequired').show();
                    $('#panelAuditUnitHint').show();
                } else {
                    $('#panelFdiIndicator').hide();
                    $('#panelAuditUnitRequired').hide();
                    $('#panelAuditUnitHint').hide();
                }

                // If update mode, pre-fill data
                if (mode === 'update') {
                    $('#panelTitle').text('Cập nhật BCTC');
                    $('#btnSavePanel').html('<i class="fas fa-save mr-1"></i>Lưu cập nhật');
                    $('#panelFileRequired').hide(); // File optional for update

                    if (d.actualSubmissionDate) {
                        $('#panelActualSubmissionDate').val(formatDateISO(d.actualSubmissionDate));
                    }
                    $('#panelReportVersion').val(d.reportVersion || '');
                    $('#panelAuditUnit').val(d.auditUnit || '');
                    $('#panelNetRevenue').val(d.netRevenue);
                    $('#panelProfitBeforeTax').val(d.profitBeforeTax);
                    $('#panelProfitAfterTax').val(d.profitAfterTax);
                    $('#panelAccumulatedProfit').val(d.accumulatedProfit);
                    $('#panelTaxAndStateContribution').val(d.taxAndStateContribution);
                    $('#panelTotalAssets').val(d.totalAssets);
                    $('#panelOwnerEquity').val(d.ownerEquity);
                    $('#panelNotes').val(d.notes || '');

                    // Show existing file
                    if (d.attachmentFileName) {
                        $('#panelExistingFileName').text(d.attachmentFileName);
                        $('#panelExistingFile').removeClass('d-none');
                    }
                } else {
                    $('#panelTitle').text('Ghi nhận nộp BCTC');
                    $('#btnSavePanel').html('<i class="fas fa-save mr-1"></i>Lưu ghi nhận');
                    $('#panelFileRequired').show();
                }

                // Show panel
                $('#panelBackdrop').removeClass('d-none');
                $('#submissionPanel').css('right', '0');
                $('body').css('overflow', 'hidden');
                $('#btnSavePanel').prop('disabled', false);
            },
            error: function () {
                toastr.error('Không thể kết nối đến máy chủ.', 'Lỗi');
                $('#btnSavePanel').prop('disabled', false).html('<i class="fas fa-save mr-1"></i>Lưu ghi nhận');
            }
        });
    }

    function closePanel() {
        $('#submissionPanel').css('right', '-500px');
        $('#panelBackdrop').addClass('d-none');
        $('body').css('overflow', '');
    }

    function resetPanel() {
        $('#submissionForm')[0].reset();
        $('#panelFileInput').val('');
        $('#panelFileInfo').addClass('d-none');
        $('#panelExistingFile').addClass('d-none');
        $('#panelFileDropZone').show();
        $('#panelFdiIndicator').hide();
        $('#panelAuditUnitRequired').hide();
        $('#panelAuditUnitHint').hide();
        $('#panelFileRequired').show();
        $('.input-figma').removeClass('is-invalid');
    }

    // ══════════════════════════════════════════════════════════════════
    // Save Panel (Submit / Update)
    // ══════════════════════════════════════════════════════════════════

    function handleSavePanel() {
        if (!validatePanel()) return;

        var mode = $('#panelMode').val();
        var id = $('#panelRecordId').val();
        var url = mode === 'submit' ? getUrls().recordSubmission + '/' + id : getUrls().update + '/' + id;

        var payload = {
            actualSubmissionDate: $('#panelActualSubmissionDate').val(),
            reportVersion: $('#panelReportVersion').val(),
            auditUnit: $('#panelAuditUnit').val() || null,
            netRevenue: parseFloat($('#panelNetRevenue').val()) || 0,
            profitBeforeTax: parseFloat($('#panelProfitBeforeTax').val()) || 0,
            profitAfterTax: parseFloat($('#panelProfitAfterTax').val()) || 0,
            accumulatedProfit: parseFloat($('#panelAccumulatedProfit').val()) || 0,
            taxAndStateContribution: parseFloat($('#panelTaxAndStateContribution').val()) || 0,
            totalAssets: parseFloat($('#panelTotalAssets').val()) || null,
            ownerEquity: parseFloat($('#panelOwnerEquity').val()) || null,
            attachmentUrl: '', // Will be set via file upload flow on server
            attachmentFileName: '',
            notes: $('#panelNotes').val() || null
        };

        // Handle file — for now set filename from file input
        var fileInput = $('#panelFileInput')[0];
        if (fileInput.files.length > 0) {
            payload.attachmentFileName = fileInput.files[0].name;
            // TODO: integrate with IFileManagerApiService for actual upload
            payload.attachmentUrl = 'pending-upload';
        }

        var token = getAntiForgeryToken();
        var $btn = $('#btnSavePanel');
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Đang lưu...');

        $.ajax({
            url: url,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(payload),
            headers: { 'RequestVerificationToken': token },
            success: function (resp) {
                if (resp && resp.isSuccess) {
                    closePanel();
                    toastr.success(mode === 'submit' ? 'Ghi nhận BCTC thành công.' : 'Cập nhật BCTC thành công.', 'Thành công');
                    reloadTable();
                } else {
                    var msg = (resp && resp.message) ? resp.message : 'Đã có lỗi xảy ra.';
                    toastr.error(msg, 'Lỗi');
                }
            },
            error: function (xhr) {
                var msg = 'Không thể kết nối đến máy chủ.';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    msg = xhr.responseJSON.message;
                }
                toastr.error(msg, 'Lỗi');
            },
            complete: function () {
                var label = mode === 'submit' ? 'Lưu ghi nhận' : 'Lưu cập nhật';
                $btn.prop('disabled', false).html('<i class="fas fa-save mr-1"></i>' + label);
            }
        });
    }

    function validatePanel() {
        var valid = true;
        $('.input-figma').removeClass('is-invalid');

        // Required fields
        var requiredFields = [
            { id: '#panelActualSubmissionDate', label: 'Ngày nộp thực tế' },
            { id: '#panelReportVersion', label: 'Phiên bản BCTC' },
            { id: '#panelNetRevenue', label: 'Doanh thu thuần' },
            { id: '#panelProfitBeforeTax', label: 'Lợi nhuận trước thuế' },
            { id: '#panelProfitAfterTax', label: 'Lợi nhuận sau thuế' },
            { id: '#panelAccumulatedProfit', label: 'Lợi nhuận lũy kế' },
            { id: '#panelTaxAndStateContribution', label: 'Thuế & khoản đóng NSNN' }
        ];

        requiredFields.forEach(function (f) {
            var val = $(f.id).val();
            if (!val && val !== 0) {
                $(f.id).addClass('is-invalid');
                valid = false;
            }
        });

        // File required for submit mode
        var mode = $('#panelMode').val();
        if (mode === 'submit') {
            var fileInput = $('#panelFileInput')[0];
            if (!fileInput.files.length) {
                $('#panelFileDropZone').css('border-color', '#ef4444');
                valid = false;
            }
        }

        // FDI audit unit check
        if ($('#panelAuditUnitRequired').is(':visible')) {
            if (!$('#panelAuditUnit').val().trim()) {
                $('#panelAuditUnit').addClass('is-invalid');
                valid = false;
            }
        }

        // Future date check
        var submissionDate = $('#panelActualSubmissionDate').val();
        if (submissionDate && new Date(submissionDate) > new Date()) {
            $('#panelActualSubmissionDate').addClass('is-invalid');
            toastr.warning('Ngày nộp không được là ngày tương lai.', 'Cảnh báo');
            valid = false;
        }

        if (!valid) {
            toastr.warning('Vui lòng nhập đầy đủ các trường bắt buộc.', 'Cảnh báo');
        }
        return valid;
    }

    // ══════════════════════════════════════════════════════════════════
    // File Handling
    // ══════════════════════════════════════════════════════════════════

    function handleFileSelected() {
        var fileInput = $('#panelFileInput')[0];
        if (!fileInput.files.length) return;

        var file = fileInput.files[0];
        var ext = file.name.split('.').pop().toLowerCase();
        var allowedExts = ['pdf', 'xls', 'xlsx'];
        var maxSize = 20 * 1024 * 1024; // 20MB

        if (allowedExts.indexOf(ext) === -1) {
            toastr.warning('Chỉ chấp nhận file PDF, XLS, XLSX.', 'Cảnh báo');
            fileInput.value = '';
            return;
        }

        if (file.size > maxSize) {
            toastr.warning('File vượt quá 20MB.', 'Cảnh báo');
            fileInput.value = '';
            return;
        }

        $('#panelFileName').text(file.name);
        $('#panelFileInfo').removeClass('d-none');
        $('#panelFileDropZone').hide();
    }

    // ══════════════════════════════════════════════════════════════════
    // Delete
    // ══════════════════════════════════════════════════════════════════

    function handleConfirmDelete() {
        var reason = $('#deletionReason').val().trim();
        if (!reason) {
            $('#deletionReasonError').removeClass('d-none');
            return;
        }
        $('#deletionReasonError').addClass('d-none');

        var id = $('#deleteRecordId').val();
        var token = getAntiForgeryToken();
        var $btn = $('#btnConfirmDelete');
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Đang xóa...');

        $.ajax({
            url: getUrls().deleteUrl + '/' + id,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ deletionReason: reason }),
            headers: { 'RequestVerificationToken': token },
            success: function (resp) {
                if (resp && resp.isSuccess) {
                    $('#deleteModal').modal('hide');
                    toastr.success('Đã xóa bản ghi BCTC thành công.', 'Thành công');
                    reloadTable();
                } else {
                    var msg = (resp && resp.message) ? resp.message : 'Đã có lỗi xảy ra.';
                    toastr.error(msg, 'Lỗi');
                }
            },
            error: function () {
                toastr.error('Không thể kết nối đến máy chủ.', 'Lỗi');
            },
            complete: function () {
                $btn.prop('disabled', false).html('<i class="fas fa-trash mr-2"></i>Xác nhận xóa');
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // Generate Schedule
    // ══════════════════════════════════════════════════════════════════

    function handleGenerateSchedule() {
        var year = $('select[name="fiscalYear"]').val() || new Date().getFullYear();

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Tạo lịch nộp BCTC?',
                html: 'Hệ thống sẽ tạo lịch nộp BCTC năm <strong>' + year + '</strong> cho tất cả doanh nghiệp đang hoạt động.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-calendar-plus mr-1"></i> Tạo lịch',
                cancelButtonText: 'Hủy',
                confirmButtonColor: '#3085d6'
            }).then(function (result) {
                if (result.isConfirmed) {
                    executeGenerateSchedule(year);
                }
            });
        } else {
            if (confirm('Tạo lịch nộp BCTC năm ' + year + ' cho tất cả doanh nghiệp?')) {
                executeGenerateSchedule(year);
            }
        }
    }

    function executeGenerateSchedule(year) {
        var token = getAntiForgeryToken();
        var $btn = $('#btnGenerateSchedule');
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Đang tạo...');

        $.ajax({
            url: getUrls().generateSchedule + '?fiscalYear=' + year,
            type: 'POST',
            headers: { 'RequestVerificationToken': token },
            success: function (resp) {
                if (resp && resp.isSuccess) {
                    var count = resp.data || 0;
                    toastr.success('Đã tạo lịch nộp cho ' + count + ' doanh nghiệp.', 'Thành công');
                    reloadTable();
                } else {
                    var msg = (resp && resp.message) ? resp.message : 'Đã có lỗi xảy ra.';
                    toastr.error(msg, 'Lỗi');
                }
            },
            error: function () {
                toastr.error('Không thể kết nối đến máy chủ.', 'Lỗi');
            },
            complete: function () {
                $btn.prop('disabled', false).html('<i class="fas fa-calendar-plus mr-1"></i> Tạo lịch nộp');
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // Utilities
    // ══════════════════════════════════════════════════════════════════

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        var day = ('0' + d.getDate()).slice(-2);
        var month = ('0' + (d.getMonth() + 1)).slice(-2);
        return day + '/' + month + '/' + d.getFullYear();
    }

    function formatDateISO(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        var year = d.getFullYear();
        var month = ('0' + (d.getMonth() + 1)).slice(-2);
        var day = ('0' + d.getDate()).slice(-2);
        return year + '-' + month + '-' + day;
    }

    function escapeHtml(text) {
        if (text == null) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getAntiForgeryToken() {
        return $('input[name="__RequestVerificationToken"]').first().val() || '';
    }

})();
