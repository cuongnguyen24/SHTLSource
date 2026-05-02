/**
 * Investment Monitoring Report Management JavaScript (Quản lý Báo cáo Giám sát Đầu tư)
 * IIFE pattern — Server-side rendering + Slide-in Panel + Delete Modal + Generate Schedule
 * Search/Pagination handled by quickSearch form (main.js)
 */
(function () {
    'use strict';

    var deleteId = null;
    var _cmrFpDueDate = null;      // flatpickr instance for DueDate
    var _cmrFpActualDate = null;   // flatpickr instance for ActualSubmissionDate

    // ── URLs (from window.invConfig set in Index.cshtml) ─────────────
    function getUrls() {
        return window.invConfig && window.invConfig.urls ? window.invConfig.urls : {};
    }

    $(document).ready(function () {
        initializeEventHandlers();
        initCreateManualModal();
    });

    // ══════════════════════════════════════════════════════════════════
    // Reload table helper (submits quickSearch form)
    // ══════════════════════════════════════════════════════════════════

    function reloadTable() {
        $('#frmInvestmentReport').trigger('submit');
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
        $('#divInvestmentReport').on('click', '.btn-record-submission', function () {
            openPanel($(this).data('id'), 'submit');
        });

        // Edit (delegated)
        $('#divInvestmentReport').on('click', '.btn-edit', function () {
            openPanel($(this).data('id'), 'update');
        });

        // Panel close — btnClosePanel and btnCancelPanel use data-dismiss="modal" in view
        // Modal hidden event: reset form state
        $('#submissionPanel').on('hidden.bs.modal', function () {
            resetPanel();
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
        $('#divInvestmentReport').on('click', '.btn-delete-report', function () {
            deleteId = $(this).data('id');
            $('#deleteRecordName').text($(this).data('name'));
            $('#deleteRecordProject').text($(this).data('project'));
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
                $('#panelProjectName').text(d.projectName || '');
                $('#panelPeriodType').text(getPeriodTypeLabel(d.reportPeriodType));
                $('#panelReportYear').text(d.reportYear || '');
                $('#panelDueDate').text(d.dueDate ? formatDate(d.dueDate) : '');

                // If update mode, pre-fill data
                if (mode === 'update') {
                    $('#panelTitle').text('Cập nhật BC-GSDT');
                    $('#btnSavePanel').html('<i class="fas fa-save mr-1"></i>Lưu cập nhật');
                    $('#panelFileRequired').hide(); // File optional for update

                    if (d.actualSubmissionDate) {
                        $('#panelActualSubmissionDate').val(formatDateISO(d.actualSubmissionDate));
                    }
                    $('#panelReportTemplate').val(d.reportTemplate || '');
                    $('#panelRegisteredCapital').val(d.registeredCapital);
                    $('#panelImplementedCapital').val(d.implementedCapital);
                    $('#panelCapitalProgress').val(d.capitalProgress);
                    $('#panelOperationProgress').val(d.operationProgress || '');
                    $('#panelNotes').val(d.notes || '');

                    // Show existing file
                    if (d.attachmentFileName) {
                        $('#panelExistingFileName').text(d.attachmentFileName);
                        $('#panelExistingFile').removeClass('d-none');
                    }
                } else {
                    $('#panelTitle').text('Ghi nhận nộp BC-GSDT');
                    $('#btnSavePanel').html('<i class="fas fa-save mr-1"></i>Lưu ghi nhận');
                    $('#panelFileRequired').show();

                    // Pre-fill template from the record
                    if (d.reportTemplate) {
                        $('#panelReportTemplate').val(d.reportTemplate);
                    }
                }

                // Show modal
                $('#submissionPanel').modal('show');
                $('#btnSavePanel').prop('disabled', false);
            },
            error: function () {
                toastr.error('Không thể kết nối đến máy chủ.', 'Lỗi');
                $('#btnSavePanel').prop('disabled', false).html('<i class="fas fa-save mr-1"></i>Lưu ghi nhận');
            }
        });
    }

    function closePanel() {
        $('#submissionPanel').modal('hide');
    }

    function resetPanel() {
        $('#submissionForm')[0].reset();
        $('#panelFileInput').val('');
        $('#panelFileInfo').addClass('d-none');
        $('#panelExistingFile').addClass('d-none');
        $('#panelFileDropZone').show();
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
            reportTemplate: $('#panelReportTemplate').val(),
            registeredCapital: parseFloat($('#panelRegisteredCapital').val()) || null,
            implementedCapital: parseFloat($('#panelImplementedCapital').val()) || null,
            capitalProgress: parseInt($('#panelCapitalProgress').val()) || null,
            operationProgress: $('#panelOperationProgress').val() || null,
            attachmentUrl: '',
            attachmentFileName: '',
            notes: $('#panelNotes').val() || null
        };

        // Handle file
        var fileInput = $('#panelFileInput')[0];
        if (fileInput.files.length > 0) {
            payload.attachmentFileName = fileInput.files[0].name;
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
                if (resp && resp.success) {
                    $('#submissionPanel').modal('hide');
                    toastr.success(mode === 'submit' ? 'Ghi nhận nộp BC-GSDT thành công.' : 'Cập nhật BC-GSDT thành công.', 'Thành công');
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
            { id: '#panelReportTemplate', label: 'Mẫu biểu' }
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

        // Capital progress range check
        var progressVal = parseInt($('#panelCapitalProgress').val());
        if (!isNaN(progressVal) && (progressVal < 0 || progressVal > 100)) {
            $('#panelCapitalProgress').addClass('is-invalid');
            toastr.warning('Tiến độ vốn phải từ 0 đến 100%.', 'Cảnh báo');
            valid = false;
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
                if (resp && resp.success) {
                    $('#deleteModal').modal('hide');
                    toastr.success('Đã xóa bản ghi BC-GSDT thành công.', 'Thành công');
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
        var year = $('select[name="reportYear"]').val() || new Date().getFullYear();

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Tạo lịch nộp BC-GSDT?',
                html: 'Hệ thống sẽ tạo lịch nộp báo cáo giám sát đầu tư năm <strong>' + escapeHtml(year) + '</strong> cho tất cả doanh nghiệp đang hoạt động.',
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
            if (confirm('Tạo lịch nộp BC-GSDT năm ' + year + ' cho tất cả doanh nghiệp?')) {
                executeGenerateSchedule(year);
            }
        }
    }

    function executeGenerateSchedule(year) {
        var token = getAntiForgeryToken();
        var $btn = $('#btnGenerateSchedule');
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Đang tạo...');

        $.ajax({
            url: getUrls().generateSchedule + '?reportYear=' + year,
            type: 'POST',
            headers: { 'RequestVerificationToken': token },
            success: function (resp) {
                if (resp && resp.success) {
                    var count = resp.count || 0;
                    toastr.success('Đã tạo lịch nộp cho ' + count + ' bản ghi.', 'Thành công');
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

    function getPeriodTypeLabel(value) {
        var labels = {
            'SixMonths': '6 tháng',
            'Annual': 'Năm'
        };
        return labels[value] || value || '';
    }

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

    // ══════════════════════════════════════════════════════════════════
    // Manual Create Modal (Ghi nhận nộp thủ công)
    // ══════════════════════════════════════════════════════════════════

    function initCreateManualModal() {
        // Open modal
        $('#btnCreateManualReport').on('click', openCreateManualModal);

        // Save
        $('#btnSaveCreateManual').on('click', handleSaveCreateManual);

        // Auto-compute DueDate when year or period type changes
        $('#cmrReportYear, #cmrReportPeriodType').on('change', computeDueDate);

        // Project change — populate hidden fields + auto-fill capital from Attribute data
        $('#cmrProjectSelect').on('change', function () {
            var $selected = $(this).find(':selected');
            var id = $(this).val();
            if (!id) {
                $('#cmrProjectName, #cmrProjectCode').val('');
                return;
            }
            $('#cmrProjectName').val($selected.text().replace(/\s*\(.*\)\s*$/, '').trim());
            $('#cmrProjectCode').val($selected.attr('data-code') || '');

            // Auto-fill vốn đầu tư từ Attribute của dự án (categories format)
            var rc = $selected.attr('data-registered-capital');
            var ic = $selected.attr('data-implemented-capital');
            var cp = $selected.attr('data-capital-progress');
            if (rc) $('#cmrRegisteredCapital').val(rc);
            if (ic) $('#cmrImplementedCapital').val(ic);
            if (cp) $('#cmrCapitalProgress').val(cp);
        });

        // ── Flatpickr for date inputs ──────────────────────────────────
        if (typeof flatpickr !== 'undefined') {
            var fpLocale = (flatpickr.l10ns && flatpickr.l10ns.vn) ? flatpickr.l10ns.vn : undefined;
            var fpBaseOpts = {
                dateFormat:    'd/m/Y',   // stored & sent as dd/mm/yyyy; dmyToIso() converts for payload
                allowInput:    true,
                disableMobile: true
            };
            if (fpLocale) fpBaseOpts.locale = fpLocale;

            _cmrFpDueDate = flatpickr('#cmrDueDate', fpBaseOpts);
            _cmrFpActualDate = flatpickr('#cmrActualSubmissionDate',
                Object.assign({}, fpBaseOpts, { maxDate: 'today' }));
        }

        // ── Select2 cho enterprise — dùng Utils.initSelect2Ajax (categories format) ──
        if (typeof $.fn.select2 !== 'undefined' && typeof Utils !== 'undefined' && Utils.initSelect2Ajax) {
            var $entSelect = $('#cmrEnterpriseSelect');

            // Khai báo optionMapperValues để Utils.initSelect2Ajax trích xuất Attribute
            window.optionMapperValues = ['code', 'taxcode', 'industrialzoneid', 'industrialzonename'];
            Utils.initSelect2Ajax($entSelect);

            $entSelect.on('select2:select', function (e) {
                var d = e.params.data;
                $('#cmrEnterpriseName').val(d.text ? d.text.replace(/\s*\(.*\)\s*$/, '').trim() : '');
                $('#cmrEnterpriseCode').val(d.code || '');
                $('#cmrEnterpriseTaxCode').val(d.taxcode || '');
                $('#cmrIndustrialZoneId').val(d.industrialzoneid || '');
                $('#cmrIndustrialZoneName').val(d.industrialzonename || '');
                loadEnterpriseProjects(d.id);
            });

            $entSelect.on('select2:unselect select2:clear', function () {
                $('#cmrEnterpriseName, #cmrEnterpriseCode, #cmrEnterpriseTaxCode, #cmrIndustrialZoneId, #cmrIndustrialZoneName').val('');
                resetProjectSelect();
            });

            // Init project select in empty state
            resetProjectSelect();
        }
    }

    function openCreateManualModal() {
        // Reset form
        $('#frmCreateManualReport')[0].reset();
        $('.input-figma, .flatpickr-input').removeClass('is-invalid');
        $('#cmrErrorAlert').addClass('d-none');
        $('#cmrEnterpriseName, #cmrEnterpriseCode, #cmrEnterpriseTaxCode, #cmrIndustrialZoneId, #cmrIndustrialZoneName').val('');
        $('#cmrProjectName, #cmrProjectCode').val('');
        $('#cmrRegisteredCapital, #cmrImplementedCapital, #cmrCapitalProgress').val('');

        // Clear Select2 enterprise selection
        if (typeof $.fn.select2 !== 'undefined') {
            $('#cmrEnterpriseSelect').val(null).trigger('change.select2');
        }
        resetProjectSelect();

        // Clear flatpickr instances
        if (_cmrFpDueDate) _cmrFpDueDate.clear();
        if (_cmrFpActualDate) _cmrFpActualDate.clear();

        // Default year = current year
        $('#cmrReportYear').val(new Date().getFullYear());
        computeDueDate();

        $('#createManualReportModal').modal('show');
    }

    function loadEnterpriseProjects(enterpriseId) {
        var $sel = $('#cmrProjectSelect');

        // Destroy previous Select2 before manipulating options
        if (typeof $.fn.select2 !== 'undefined' && $sel.hasClass('select2-hidden-accessible')) {
            $sel.select2('destroy');
        }

        $sel.html('<option value="">Đang tải...</option>');
        $('#cmrProjectName, #cmrProjectCode').val('');

        if (!enterpriseId || enterpriseId === '') {
            resetProjectSelect();
            return;
        }

        // URL from data-url attribute (select2-ajax convention)
        var baseUrl = $sel.data('url') || getUrls().getEnterpriseProjects;
        var url = baseUrl + '?enterpriseId=' + encodeURIComponent(enterpriseId);

        $.get(url)
            .done(function (data) {
                // Controller trả về {categories: [{ID, Name, Attribute: {Code, RegisteredCapital, ...}}]}
                var items = (data && data.categories) ? data.categories : (Array.isArray(data) ? data : []);
                $sel.html('<option value="">-- Không gắn dự án cụ thể --</option>');
                items.forEach(function (p) {
                    var id   = p.ID   || p.id;
                    var name = p.Name || p.name || p.text || '';
                    // Hỗ trợ cả PascalCase (Attribute) và camelCase (attribute) từ JSON response
                    var rawAttr = p.Attribute || p.attribute || {};
                    var attr = {};
                    for (var k in rawAttr) { attr[k.toLowerCase()] = rawAttr[k]; }
                    $('<option>')
                        .val(id)
                        .text(name)
                        .attr('data-code',                attr.code               || '')
                        .attr('data-registered-capital',  attr.registeredcapital  || '')
                        .attr('data-implemented-capital', attr.implementedcapital || '')
                        .attr('data-capital-progress',    attr.capitalprogress    || '')
                        .appendTo($sel);
                });
            })
            .fail(function () {
                $sel.html('<option value="">-- Không thể tải dự án --</option>');
            })
            .always(function () {
                if (typeof $.fn.select2 !== 'undefined') {
                    $sel.select2({
                        dropdownParent: $('#createManualReportModal'),
                        placeholder: $sel.data('placeholder') || '-- Chọn dự án (tuỳ chọn) --',
                        allowClear: true,
                        width: '100%'
                    });
                }
            });
    }

    function resetProjectSelect() {
        var $sel = $('#cmrProjectSelect');
        if (typeof $.fn.select2 !== 'undefined' && $sel.hasClass('select2-hidden-accessible')) {
            $sel.select2('destroy');
        }
        $sel.html('<option value="">-- Chọn dự án (tuỳ chọn) --</option>');
        $('#cmrProjectName, #cmrProjectCode').val('');
        if (typeof $.fn.select2 !== 'undefined') {
            $sel.select2({
                dropdownParent: $('#createManualReportModal'),
                placeholder: $sel.data('placeholder') || '-- Chọn dự án (tuỳ chọn) --',
                allowClear: true,
                width: '100%'
            });
        }
    }

    function computeDueDate() {
        var year = parseInt($('#cmrReportYear').val(), 10);
        var period = $('#cmrReportPeriodType').val();
        if (!year || !period) return;

        var isoDate;
        if (period === 'SixMonths') {
            isoDate = year + '-07-10';
        } else if (period === 'Annual') {
            isoDate = (year + 1) + '-02-10';
        }

        if (isoDate) {
            if (_cmrFpDueDate) {
                _cmrFpDueDate.setDate(isoDate, true, 'Y-m-d');
            } else {
                // Fallback (flatpickr not loaded): set as dd/mm/yyyy
                var p = isoDate.split('-');
                $('#cmrDueDate').val(p[2] + '/' + p[1] + '/' + p[0]);
            }
        }
    }

    function handleSaveCreateManual() {
        if (!validateCreateManualForm()) return;

        var $btn = $('#btnSaveCreateManual');
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Đang lưu...');
        $('#cmrErrorAlert').addClass('d-none');

        // Resolve enterprise name from select2 selection
        var enterpriseName = $('#cmrEnterpriseName').val();
        if (!enterpriseName) {
            // Fallback: parse from select2 text
            var selectText = $('#cmrEnterpriseSelect option:selected').text() || '';
            enterpriseName = selectText.replace(/\s*\(.*\)\s*$/, '').trim();
        }

        var projectSelected = $('#cmrProjectSelect').val();
        var projectName = projectSelected
            ? ($('#cmrProjectName').val() || $('#cmrProjectSelect option:selected').text().replace(/\s*\(.*\)\s*$/, '').trim())
            : enterpriseName; // default ProjectName = EnterpriseName if no project

        var payload = {
            enterpriseId: $('#cmrEnterpriseSelect').val(),
            enterpriseName: enterpriseName,
            enterpriseCode: $('#cmrEnterpriseCode').val(),
            enterpriseTaxCode: $('#cmrEnterpriseTaxCode').val(),
            industrialZoneId: $('#cmrIndustrialZoneId').val() || null,
            industrialZoneName: $('#cmrIndustrialZoneName').val() || null,
            projectId: projectSelected || null,
            projectName: projectName,
            projectCode: $('#cmrProjectCode').val() || null,
            reportYear: parseInt($('#cmrReportYear').val(), 10),
            reportPeriodType: $('#cmrReportPeriodType').val(),
            reportTemplate: $('#cmrReportTemplate').val(),
            dueDate: dmyToIso($('#cmrDueDate').val()),
            actualSubmissionDate: dmyToIso($('#cmrActualSubmissionDate').val()),
            registeredCapital: parseFloatOrNull($('#cmrRegisteredCapital').val()),
            implementedCapital: parseFloatOrNull($('#cmrImplementedCapital').val()),
            capitalProgress: parseIntOrNull($('#cmrCapitalProgress').val()),
            operationProgress: $('#cmrOperationProgress').val().trim() || null,
            notes: $('#cmrNotes').val().trim() || null
        };

        $.ajax({
            url: getUrls().createManual,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(payload),
            headers: { 'RequestVerificationToken': getAntiForgeryToken() },
            success: function (resp) {
                if (resp && resp.success) {
                    $('#createManualReportModal').modal('hide');
                    toastr.success('Ghi nhận nộp BC-GSDT thủ công thành công.', 'Thành công');
                    reloadTable();
                } else {
                    var msg = (resp && resp.message) ? resp.message : 'Đã có lỗi xảy ra.';
                    showCreateManualError(msg);
                }
            },
            error: function (xhr) {
                var msg = 'Không thể kết nối đến máy chủ.';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    msg = xhr.responseJSON.message;
                }
                showCreateManualError(msg);
            },
            complete: function () {
                $btn.prop('disabled', false).html('<i class="fas fa-save mr-1"></i>Ghi nhận nộp');
            }
        });
    }

    function validateCreateManualForm() {
        var valid = true;
        $('.input-figma, .flatpickr-input').removeClass('is-invalid');
        $('#cmrErrorAlert').addClass('d-none');

        var required = [
            { id: '#cmrEnterpriseSelect', label: 'Doanh nghiệp' },
            { id: '#cmrReportYear', label: 'Năm báo cáo' },
            { id: '#cmrReportPeriodType', label: 'Kỳ báo cáo' },
            { id: '#cmrReportTemplate', label: 'Mẫu biểu' },
            { id: '#cmrDueDate', label: 'Hạn nộp' }
        ];

        var missingLabels = [];
        required.forEach(function (f) {
            var val = $(f.id).val();
            if (!val || val === '') {
                $(f.id).addClass('is-invalid');
                // Also mark visible flatpickr alt input
                var fp = (f.id === '#cmrDueDate') ? _cmrFpDueDate : (f.id === '#cmrActualSubmissionDate' ? _cmrFpActualDate : null);
                if (fp && fp.input) $(fp.input).addClass('is-invalid');
                missingLabels.push(f.label);
                valid = false;
            }
        });

        if (!valid) {
            showCreateManualError('Vui lòng nhập đủ các trường bắt buộc: ' + missingLabels.join(', ') + '.');
            return false;
        }

        // Future date guard — parse dd/mm/yyyy from flatpickr
        var actualDate = dmyToIso($('#cmrActualSubmissionDate').val());
        if (actualDate && new Date(actualDate) > new Date()) {
            $('#cmrActualSubmissionDate').addClass('is-invalid');
            if (_cmrFpActualDate && _cmrFpActualDate.input) $(_cmrFpActualDate.input).addClass('is-invalid');
            showCreateManualError('Ngày nộp thực tế không được là ngày tương lai.');
            return false;
        }

        // Capital progress range
        var progress = $('#cmrCapitalProgress').val();
        if (progress !== '' && progress !== null) {
            var pVal = parseInt(progress, 10);
            if (isNaN(pVal) || pVal < 0 || pVal > 100) {
                $('#cmrCapitalProgress').addClass('is-invalid');
                showCreateManualError('Tiến độ giải ngân phải từ 0 đến 100%.');
                return false;
            }
        }

        return true;
    }

    function showCreateManualError(msg) {
        $('#cmrErrorMessage').text(msg);
        $('#cmrErrorAlert').removeClass('d-none');
    }

    function parseFloatOrNull(val) {
        if (val === '' || val === null || val === undefined) return null;
        var n = parseFloat(val);
        return isNaN(n) ? null : n;
    }

    function parseIntOrNull(val) {
        if (val === '' || val === null || val === undefined) return null;
        var n = parseInt(val, 10);
        return isNaN(n) ? null : n;
    }

    /**
     * Converts dd/mm/yyyy (flatpickr dateFormat 'd/m/Y') → ISO yyyy-mm-dd for JSON payload.
     */
    function dmyToIso(dmy) {
        if (!dmy) return null;
        var p = dmy.split('/');
        return (p.length === 3) ? (p[2] + '-' + p[1] + '-' + p[0]) : dmy;
    }

})();
