/**
 * Complaint Create Form - Client JS (IIFE Pattern)
 * Module: M0062 (Đơn thư Khiếu nại)
 * Screen: SCR-NV-DON-002 — Nhập đơn mới (V2.0)
 * Updated: 2026-04-13 — Align with UI Prototype V2.0
 */
(function () {
    'use strict';

    // ─── State variables ────────────────────────────────────────
    let duplicateCheckTimeout;
    let taxCodeAutocompleteTimeout;
    let complaintTypesData = []; // Store complaint types for lookup by ID/code    // Form submit guard flag

    // ─── Utility functions ──────────────────────────────────────

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    /**
     * Get anti-forgery token
     */
    function getAntiForgeryToken() {
        var input = document.querySelector('input[name="__RequestVerificationToken"]');
        return input ? input.value : '';
    }

    function getCookie(name) {
        var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : '';
    }

    // ─── Conditional Rendering — SubmitterType Toggle ───────────

    function toggleSubmitterFields() {
        var submitterType = $('input[name="SubmitterType"]:checked').val();

        // Hide all conditional sections
        $('#fieldsEnterprise, #fieldsLabor, #fieldsOrganization').hide();

        // Show selected section
        $('#ContactPhone').removeClass('visible');
        $('#ContactEmailEnterprise').removeClass('visible');
        $('#ContactPhoneLabor').removeClass('visible');
        $('#ContactEmailLabor').removeClass('visible');
        $('#ContactPhoneOrg').removeClass('visible');
        $('#ContactEmailOrg').removeClass('visible');
        if (submitterType === 'Enterprise') {
            $('#fieldsEnterprise').show();
            $('#ContactPhone').addClass('visible');
            $('#ContactEmailEnterprise').addClass('visible');
        } else if (submitterType === 'Labor') {
            $('#fieldsLabor').show();
            $('#ContactPhoneLabor').addClass('visible');
            $('#ContactEmailLabor').addClass('visible');
        } else if (submitterType === 'Organization') {
            $('#fieldsOrganization').show();
            $('#ContactPhoneOrg').addClass('visible');
            $('#ContactEmailOrg').addClass('visible');
        }

        // Clear fields from hidden sections
        if (submitterType !== 'Enterprise') {
            $('#TaxCode, #EnterpriseId, #EnterpriseName, #IndustrialZoneName, #RepresentativeName, #ContactEmailEnterprise').val('');
        }
        if (submitterType !== 'Labor') {
            $('#LaborIdNumber, #LaborName, #LaborAddress, #ContactPhoneLabor, #ContactEmailLabor').val('');
        }
        if (submitterType !== 'Organization') {
            $('#OrganizationName, #OrganizationCode, #ContactPhoneOrg, #ContactEmailOrg').val('');
        }
    }

    // ─── Conditional Display: AccusedSubject (dựa trên ComplaintType) ────────

    function updateAccusedSubjectVisibility() {
        var complaintTypeId = $('#ComplaintTypeId').val();
        
        // Find the selected complaint type in stored data
        var selectedType = complaintTypesData.find(function (t) {
            return t.id === complaintTypeId;
        });

        if (!selectedType) {
            // If type not found, hide the field
            $('#accusedSubjectRow').hide();
            $('#AccusedSubject').val('');
            return;
        }

        // Check code: show if code contains 'KN_HC' or 'TO_CAO'
        // Adjust based on actual enum codes in backend (e.g., 'KN_HC_LAN_1', 'TO_CAO', etc.)
        var shouldShow = selectedType.code && (
            selectedType.code.includes('KN_HC') || 
            selectedType.code.includes('TO_CAO')
        );
        
        var isRequired = shouldShow; // Required when shown for these types

        if (shouldShow) {
            $('#accusedSubjectRow').show();
            if (isRequired) {
                $('#accusedSubjectRequired').show();
            } else {
                $('#accusedSubjectRequired').hide();
            }
        } else {
            $('#accusedSubjectRow').hide();
            $('#AccusedSubject').val(''); // Clear field when hidden
        }
    }

    // ─── INT-01: Autocomplete TaxCode Lookup ────────────────────

    // Helper: Set readonly styling for enterprise fields
    function setEnterpriseFieldsReadonly(readonly) {
        var fields = ['#EnterpriseName', '#IndustrialZoneName', '#RepresentativeName', '#ContactEmailEnterprise'];
        fields.forEach(function (fieldId) {
            var $field = $(fieldId);
            if (readonly) {
                $field.prop('readonly', true).css({
                    'background-color': '#F5F7FA',
                    'cursor': 'not-allowed',
                    'color': '#475569'
                });
            } else {
                $field.prop('readonly', false).css({
                    'background-color': '#FFFFFF',
                    'cursor': 'text',
                    'color': '#1E293B'
                });
            }
        });
    }

    // Helper: Clear enterprise fields
    function clearEnterpriseFields() {
        $('#EnterpriseId').val('');
        $('#EnterpriseName').val('');
        $('#IndustrialZoneName').val('');
        $('#RepresentativeName').val('');
        $('#ContactEmailEnterprise').val('');
        setEnterpriseFieldsReadonly(false); // Mở để user nhập
    }

    // Helper: Show error/warning badge khi INT-01 lỗi
    function showEnterpriseErrorBadge(message) {
        var $badge = $('#enterpriseErrorBadge');
        if ($badge.length === 0) {
            $badge = $('<div id="enterpriseErrorBadge" style="margin-top: 5px;"></div>')
                .insertAfter('#TaxCode');
        }
        $badge.html('<span class="badge badge-danger" style="font-size: 12px;">' +
            '<i class="fas fa-exclamation-circle mr-1"></i>' + message + '</span>')
            .show();
    }

    function hideEnterpriseErrorBadge() {
        $('#enterpriseErrorBadge').hide();
    }

    function initTaxCodeAutocomplete() {
        $('#TaxCode').on('input', function () {
            var value = $(this).val().trim();
            var $dropdown = $('#taxCodeSuggestions');

            clearTimeout(taxCodeAutocompleteTimeout);
            hideEnterpriseErrorBadge();

            if (value.length >= 3) {
                taxCodeAutocompleteTimeout = setTimeout(function () {
                    // Call Enterprise search API (INT-01)
                    $.ajax({
                        url: '/api/v1/enterprise/search',
                        type: 'GET',
                        data: {
                            taxCode: value,
                            page: 1,
                            pageSize: 10
                        },
                        timeout: 5000, // 5 second timeout
                        success: function (response) {
                            if (response.success && response.data && response.data.items && response.data.items.length > 0) {
                                // ✅ SUCCESS: Show dropdown
                                var html = '';
                                response.data.items.forEach(function (item) {
                                    html += '<div class="autocomplete-item" data-id="' + item.id + '" ' +
                                        'data-name="' + escapeHtml(item.name) + '" ' +
                                        'data-taxcode="' + escapeHtml(item.taxCode) + '" ' +
                                        'data-izn="' + escapeHtml(item.industrialZoneName || '') + '" ' +
                                        'data-representative="' + escapeHtml(item.representative || '') + '" ' +
                                        'data-email="' + escapeHtml(item.email || '') + '" ' +
                                        'data-phone="' + escapeHtml(item.phone || '') + '">' +
                                        '<div style="font-weight: 600;">' + escapeHtml(item.name) + '</div>' +
                                        '<div style="font-size: 11px; color: #64748b;">MST: ' + escapeHtml(item.taxCode) + ' | ' + escapeHtml(item.industrialZoneName || 'N/A') + '</div>' +
                                        '</div>';
                                }); $dropdown.html(html).show();

                                // Click handler for autocomplete items
                                $('.autocomplete-item').on('click', function () {
                                    var $item = $(this);
                                    $('#EnterpriseId').val($item.data('id'));
                                    $('#TaxCode').val($item.data('taxcode'));
                                    $('#EnterpriseName').val($item.data('name'));
                                    $('#IndustrialZoneName').val($item.data('izn'));
                                    $('#RepresentativeName').val($item.data('representative'));
                                    $('#ContactEmailEnterprise').val($item.data('email'));
                                    $('#ContactPhone').val($item.data('phone'));

                                    // ✅ Set readonly (API success)
                                    setEnterpriseFieldsReadonly(true);
                                    hideEnterpriseErrorBadge();
                                    $dropdown.hide();
                                });
                            } else {
                                // ⚠️ EMPTY: Không tìm thấy DN
                                $dropdown.hide();
                                toastr.error('Không tìm thấy doanh nghiệp với MST này');
                                clearEnterpriseFields(); // Mở readonly để user nhập tay
                            }
                        },
                        error: function (xhr, status, error) {
                            // ❌ ERROR: API lỗi hoặc timeout
                            console.error('[INT-01] API error:', status, error);
                            $dropdown.hide();
                            toastr.error('Lỗi tra cứu. Vui lòng nhập thông tin doanh nghiệp thủ công');
                            clearEnterpriseFields(); // Mở readonly để user nhập tay
                        }
                    });
                }, 400); // Debounce 400ms per SRS §3.5.1
            } else {
                $dropdown.hide();
            }
        });

        // Hide dropdown when clicking outside
        $(document).on('click', function (e) {
            if (!$(e.target).closest('#TaxCode, #taxCodeSuggestions').length) {
                $('#taxCodeSuggestions').hide();
            }
        });
    }

    // ─── BR-13: Duplicate Check onBlur ContentSummary ───────────

    function initDuplicateCheck() {
        $('#ContentSummary').on('blur', function () {
            var contentSummary = $(this).val().trim();
            if (contentSummary.length < 20) {
                $('#duplicateWarningArea').hide();
                return;
            }

            // Get submitter identifier
            var submitterType = $('input[name="SubmitterType"]:checked').val();
            var submitterIdentifier = '';

            if (submitterType === 'Enterprise') {
                submitterIdentifier = $('#TaxCode').val().trim();
            } else if (submitterType === 'Labor') {
                submitterIdentifier = $('#LaborIdNumber').val().trim();
            } else if (submitterType === 'Organization') {
                submitterIdentifier = $('#OrganizationCode').val().trim();
            }

            if (!submitterIdentifier) {
                $('#duplicateWarningArea').hide();
                return;
            }

            // Call check-duplicate API
            $.ajax({
                url: '/api/v1/complaints/check-duplicate',
                type: 'GET',
                data: {
                    submitterIdentifier: submitterIdentifier,
                    contentSummary: contentSummary
                },
                success: function (response) {
                    if (response.success && response.data && response.data.length > 0) {
                        showDuplicateWarning(response.data);
                    } else {
                        $('#duplicateWarningArea').hide();
                    }
                },
                error: function () {
                    $('#duplicateWarningArea').hide();
                }
            });
        });
    }

    function showDuplicateWarning(duplicates) {
        var $area = $('#duplicateWarningArea');
        var $list = $('#duplicateList');
        var $count = $('#duplicateCount');

        $count.text(duplicates.length);
        $list.empty();

        duplicates.forEach(function (item) {
            var li = '<li>' +
                '<strong>' + escapeHtml(item.code || 'N/A') + '</strong> — ' +
                escapeHtml(item.contentSummary ? item.contentSummary.substring(0, 80) : '') + '...' +
                ' <em>(' + formatDate(item.receivedDate) + ')</em>' +
                '</li>';
            $list.append(li);
        });

        $area.show();

        // View duplicate button
        $('#btnViewDuplicate').off('click').on('click', function () {
            if (duplicates.length > 0) {
                window.open('/Complaint/Detail/' + duplicates[0].id, '_blank');
            }
        });

        // Dismiss duplicate warning
        $('#btnDismissDuplicate').off('click').on('click', function () {
            $area.hide();
        });
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        var dd = String(d.getDate()).padStart(2, '0');
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var yyyy = d.getFullYear();
        return dd + '/' + mm + '/' + yyyy;
    }

    // ─── Character counter ──────────────────────────────────────

    function initCharCounters() {
        $('textarea[data-maxlength]').on('input', function () {
            var $textarea = $(this);
            var maxLength = parseInt($textarea.data('maxlength')) || 3000;
            var currentLength = $textarea.val().length;
            var $counter = $textarea.siblings('.form-counter');

            $counter.text(currentLength + ' / ' + maxLength + ' ký tự');

            // Warning at 90%
            if (currentLength > maxLength * 0.9) {
                $counter.addClass('text-danger');
            } else {
                $counter.removeClass('text-danger');
            }

            // Prevent exceeding
            if (currentLength > maxLength) {
                $textarea.val($textarea.val().substring(0, maxLength));
            }
        });
    }

    // ─── Form Validation ────────────────────────────────────────

    // Helper: Validate email format (RFC 5322 simplified)
    function isValidEmail(email) {
        var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailPattern.test(email);
    }

    // Helper: Validate phone format (10-11 digits, starting with 0)
    function isValidPhoneVN(phone) {
        var phonePattern = /^0\d{9,10}$/;
        return phonePattern.test(phone);
    }

    function validateCreateForm() {
        var errors = [];

        // 1. SubmitterType (required)
        var submitterType = $('input[name="SubmitterType"]:checked').val();
        if (!submitterType) {
            errors.push('Vui lòng chọn loại người nộp đơn');
        }

        // 2. Recipient info validation based on SubmitterType
        if (submitterType === 'Enterprise') {
            var taxCode = $('#TaxCode').val().trim();
            if (!taxCode || !/^\d{10,13}$/.test(taxCode)) {
                errors.push('Mã số thuế phải là 10-13 chữ số');
            }
            var enterpriseName = $('#EnterpriseName').val().trim();
            if (!enterpriseName) {
                errors.push('Vui lòng chọn doanh nghiệp từ danh sách gợi ý');
            }
            var contactPhone = $('#ContactPhone').val().trim();
            if (!contactPhone) {
                errors.push('Vui lòng nhập số điện thoại liên hệ');
            } else if (!isValidPhoneVN(contactPhone)) {
                errors.push('Số điện thoại phải là 10-11 chữ số, bắt đầu bằng 0 (VD: 0987654321)');
            }
            var contactEmailEnterprise = $('#ContactEmailEnterprise').val().trim();
            if (contactEmailEnterprise && !isValidEmail(contactEmailEnterprise)) {
                errors.push('Email không đúng định dạng (RFC 5322)');
            }
        } else if (submitterType === 'Labor') {
            var laborIdNumber = $('#LaborIdNumber').val().trim();
            if (!laborIdNumber || laborIdNumber.length < 9 || laborIdNumber.length > 12) {
                errors.push('Số CCCD/CMND phải là 9-12 chữ số');
            }
            var laborName = $('#LaborName').val().trim();
            if (!laborName) {
                errors.push('Vui lòng nhập họ tên người lao động');
            }
            var laborAddress = $('#LaborAddress').val().trim();
            if (!laborAddress) {
                errors.push('Vui lòng nhập địa chỉ liên hệ');
            }
            var contactPhoneLabor = $('#ContactPhoneLabor').val().trim();
            if (!contactPhoneLabor) {
                errors.push('Vui lòng nhập số điện thoại liên hệ');
            } else if (!isValidPhoneVN(contactPhoneLabor)) {
                errors.push('Số điện thoại phải là 10-11 chữ số, bắt đầu bằng 0 (VD: 0987654321)');
            }
            var contactEmailLabor = $('#ContactEmailLabor').val().trim();
            if (contactEmailLabor && !isValidEmail(contactEmailLabor)) {
                errors.push('Email không đúng định dạng (RFC 5322)');
            }
        } else if (submitterType === 'Organization') {
            var orgName = $('#OrganizationName').val().trim();
            if (!orgName) {
                errors.push('Vui lòng nhập tên tổ chức');
            }
            var contactPhoneOrg = $('#ContactPhoneOrg').val().trim();
            if (!contactPhoneOrg) {
                errors.push('Vui lòng nhập số điện thoại liên hệ');
            } else if (!isValidPhoneVN(contactPhoneOrg)) {
                errors.push('Số điện thoại phải là 10-11 chữ số, bắt đầu bằng 0 (VD: 0987654321)');
            }
            var contactEmailOrg = $('#ContactEmailOrg').val().trim();
            if (contactEmailOrg && !isValidEmail(contactEmailOrg)) {
                errors.push('Email không đúng định dạng (RFC 5322)');
            }
        }

        // 3. ComplaintTypeId (required)
        if (!$('#ComplaintTypeId').val()) {
            errors.push('Vui lòng chọn loại đơn thư');
        }

        // 4. ReceivedDate (required)
        var receivedDate = $('#ReceivedDate').val();
        if (!receivedDate) {
            errors.push('Vui lòng chọn ngày nhận đơn');
        } else {
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            var selected = new Date(receivedDate);
            selected.setHours(0, 0, 0, 0);
            if (selected > today) {
                errors.push('Ngày nhận đơn không được trong tương lai');
            }
        }

        // 5. ReceiptChannel (required)
        if (!$('#ReceiptChannel').val()) {
            errors.push('Vui lòng chọn kênh tiếp nhận');
        }

        // 5a. AccusedSubject (conditional: required nếu hiển thị và là loại KN HC hoặc Tố cáo)
        var complaintTypeId = $('#ComplaintTypeId').val();
        var selectedComplaintType = complaintTypesData.find(function (t) {
            return t.id === complaintTypeId;
        });

        var isAccusedSubjectRequired = selectedComplaintType && selectedComplaintType.code && (
            selectedComplaintType.code.includes('KN_HC') || 
            selectedComplaintType.code.includes('TOCAO')
        );

        var accusedSubjectValue = $('#AccusedSubject').val().trim();

        if (isAccusedSubjectRequired) {
            if (!accusedSubjectValue) {
                errors.push('Vui lòng nhập đối tượng bị khiếu nại/tố cáo');
            } else if (accusedSubjectValue.length > 500) {
                errors.push('Đối tượng bị KN/TC không được vượt quá 500 ký tự');
            }
        } else if ($('#accusedSubjectRow').is(':visible') && accusedSubjectValue && accusedSubjectValue.length > 500) {
            errors.push('Đối tượng bị KN/TC không được vượt quá 500 ký tự');
        }

        // 6. ContentSummary (required, 20-3000 chars)
        var contentSummary = $('#ContentSummary').val().trim();
        if (!contentSummary || contentSummary.length < 20) {
            errors.push('Nội dung tóm tắt phải có ít nhất 20 ký tự');
        }
        if (contentSummary && contentSummary.length > 3000) {
            errors.push('Nội dung tóm tắt không được vượt quá 3000 ký tự');
        }

        // 7. ScanFiles (required - BR-12)
        if (!scanFileUploader || scanFileUploader.files.length === 0) {
            errors.push('Vui lòng tải lên file scan đơn gốc (bắt buộc)');
        }

        // Show errors
        if (errors.length > 0) {
            toastr.error(errors.join('<br>'), 'Dữ liệu không hợp lệ', {
                timeOut: 5000,
                escapeHtml: false,
                positionClass: 'toast-top-right'
            });
            return false;
        }

        return true;
    }

    // ─── File Upload Handlers (Using FileUploadComponent) ──────

    var scanFileUploader, attachmentFilesUploader;

    function initFileUploadHandlers() {
        // Initialize FileUploadComponent for scan file (multiple, required)
        if (window.FileUploadComponent && document.getElementById('scanFileDropZone')) {
            scanFileUploader = new window.FileUploadComponent({
                dropZoneId: 'scanFileDropZone',
                fileInputId: 'scanFileInput',
                fileQueueId: 'scanFileQueue',
                maxFiles: 5,
                maxSizeMB: 20
            });
        }

        // Initialize FileUploadComponent for attachment files (multiple, optional)
        if (window.FileUploadComponent && document.getElementById('attachmentFilesDropZone')) {
            attachmentFilesUploader = new window.FileUploadComponent({
                dropZoneId: 'attachmentFilesDropZone',
                fileInputId: 'attachmentFilesInput',
                fileQueueId: 'attachmentFilesQueue',
                maxFiles: 10,
                maxSizeMB: 20
            });
        }
    }

    // Load Loại đơn thư từ API
    function loadComplaintTypes() {
        $.ajax({
            url: '/ComplaintType/GetAll?isActive=true',
            type: 'GET',
            dataType: 'json',
            success: function (response) {
                var $select = $('#ComplaintTypeId');
                const _data = response.data ?? [];
                // Response is direct array, not wrapped in { data: ... }
                if (_data && Array.isArray(_data)) {
                    // Store complaint types data globally for lookup
                    complaintTypesData = _data;
                    
                    // Reinitialize Select2
                    $select.select2({
                        theme: 'bootstrap4',
                        width: '100%',
                        data: _data.map(function (item) {
                            return { id: item.id, text: item.name };
                        })
                    });

                    // Update AccusedSubject visibility after Select2 is loaded
                    updateAccusedSubjectVisibility();
                }
            },
            error: function (xhr, status, error) {
                console.error('Failed to load complaint types from API:', status, error);
                console.log('Response:', xhr.responseText);
            }
        });
    }

    // function loadComplaintTypes() {
    //     $.ajax({
    //         url: '/ComplaintType/GetAll',
    //         type: 'GET',
    //         dataType: 'json',
    //         success: function (result) {
    //             if (result && result.success && result.data) {
    //                 var $select = $('#ComplaintTypeId');

    //                 // Clear existing options except placeholder
    //                 $select.find('option:not(:first)').remove();

    //                 // Sort by code
    //                 var sortedData = result.data.sort(function (a, b) {
    //                     return a.code.localeCompare(b.code);
    //                 });

    //                 // Add options
    //                 sortedData.forEach(function (item) {
    //                     if (item.isActive) {
    //                         $select.append($('<option>').val(item.id).text(item.name + ' (' + item.code + ')'));
    //                     }
    //                 });

    //                 // Reinitialize Select2 properly: destroy first if already initialized, then reinitialize
    //                 if ($select.hasClass('select2')) {
    //                     // Check if Select2 data exists and destroy it
    //                     if ($select.data('select2')) {
    //                         $select.select2('destroy');
    //                     }
    //                     // Reinitialize Select2
    //                     $select.select2();
    //                 }

    //                 // Trigger change to notify any listeners
    //                 $select.trigger('change');

    //             } else {
    //                 console.warn('Failed to load ComplaintTypes:', result?.message || 'No data returned');
    //                 toastr.warning('Không thể tải danh sách loại đơn');
    //             }
    //         },
    //         error: function (xhr, status, error) {
    //             console.error('Error loading ComplaintTypes:', error);
    //             console.log('Response:', xhr.responseText);
    //             toastr.error('Lỗi kết nối: không thể tải danh sách loại đơn');
    //         }
    //     });
    // }

    // ─── Form Submission ────────────────────────────────────────

    function handleSaveComplaint(e) {
        e.preventDefault();
        
        if (!validateCreateForm()) return;

        var $btn = $('#btnLuuDon');
        $btn.html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...').prop('disabled', true);

        var formData = new FormData();
        var submitterType = $('input[name="SubmitterType"]:checked').val();
debugger
        // Nhóm 2: Người nộp đơn
        if (submitterType) formData.append('SubmitterType', submitterType);
        var enterpriseId = $('#EnterpriseId').val(); if (enterpriseId) formData.append('EnterpriseId', enterpriseId);
        var enterpriseName = $('#EnterpriseName').val().trim(); if (enterpriseName) formData.append('EnterpriseName', enterpriseName);
        var taxCode = $('#TaxCode').val().trim(); if (taxCode) formData.append('TaxCode', taxCode);
        var izName = $('#IndustrialZoneName').val().trim(); if (izName) formData.append('IndustrialZoneName', izName);
        var laborName = $('#LaborName').val().trim(); if (laborName) formData.append('LaborName', laborName);
        var laborId = $('#LaborIdNumber').val().trim(); if (laborId) formData.append('LaborIdNumber', laborId);
        var laborAddress = $('#LaborAddress').val().trim(); if (laborAddress) formData.append('LaborAddress', laborAddress);
        var orgName = $('#OrganizationName').val().trim(); if (orgName) formData.append('OrganizationName', orgName);
        var orgCode = $('#OrganizationCode').val().trim(); if (orgCode) formData.append('OrganizationCode', orgCode);
        var representativeName = $('#RepresentativeName').val().trim(); if (representativeName) formData.append('RepresentativeName', representativeName);
        var contactPhone = $('.contact-phone.visible').val()?.trim(); if (contactPhone) formData.append('ContactPhone', contactPhone);
        var contactEmail = $('.contact-email.visible').val()?.trim(); if (contactEmail) formData.append('ContactEmail', contactEmail);

        // Nhóm 1: Thông tin đơn thư
        var complaintTypeId = $('#ComplaintTypeId').val(); if (complaintTypeId) formData.append('ComplaintTypeId', complaintTypeId);
        var receivedDate = $('#ReceivedDate').val(); if (receivedDate) formData.append('ReceivedDate', receivedDate);
        var receiptChannel = $('#ReceiptChannel').val(); if (receiptChannel) formData.append('ReceiptChannel', receiptChannel);
        var accusedSubject = $('#AccusedSubject').val().trim(); if (accusedSubject) formData.append('AccusedSubject', accusedSubject);
        var contentSummary = $('#ContentSummary').val().trim(); if (contentSummary) formData.append('ContentSummary', contentSummary);
        var receiptNotes = $('#ReceiptNotes').val().trim(); if (receiptNotes) formData.append('ReceiptNotes', receiptNotes);

        // Nhóm 6: State
        var priority = $('#Priority').val(); if (priority) formData.append('Priority', priority);

        // Upload files
        var scanFiles = scanFileUploader ? Array.from(scanFileUploader.files) : [];
        if (scanFiles.length === 0) {
            toastr.error('Vui lòng tải lên scan đơn gốc');
            $btn.prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu đơn thư');
            return;
        }
        scanFiles.forEach(function (f) {
            formData.append('scanFiles', f);
        });

        var attachFiles = attachmentFilesUploader ? Array.from(attachmentFilesUploader.files) : [];
        attachFiles.forEach(function (f) {
            formData.append('attachmentFiles', f);
        });

        // Submit to API
        $.ajax({
            url: '/Complaint/Create',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'RequestVerificationToken': getAntiForgeryToken()
            },
            success: function (result) {debugger
                if (result.success && result.data) {
                    toastr.success(result.message || 'Nhập đơn thư thành công');

                    // Show success modal (MSG-S-01)
                    $('#complaintCodeDisplay').text(result.data.code || 'ĐT-XXXX-XX-XXXX');
                    $('#modalSuccess').modal('show');

                    // Print receipt handler
                    $('#btnPrintReceipt').off('click').on('click', function () {
                        window.open('/Complaint/PrintReceipt/' + result.data.id, '_blank');
                    });

                    // Close modal handler - redirect to list
                    $('#btnCloseModal').off('click').on('click', function () {
                        window.location.href = '/Complaint';
                    });
                } else {
                    if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
                        var html = result.message + '<ul class="mb-0 mt-1 pl-4" style="text-align:left;">';
                        result.errors.forEach(function (e) {
                            html += '<li>' + e + '</li>';
                        });
                        html += '</ul>';
                        toastr.error(html, 'Lỗi', { escapeHtml: false });
                    } else {
                        toastr.error(result.message || 'Không thể lưu đơn thư', 'Lỗi');
                    }
                    $btn.prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu đơn thư');
                }
            },
            error: function (xhr) {
                var message = 'Không thể kết nối đến máy chủ';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    message = xhr.responseJSON.message;
                } else if (xhr.status === 400) {
                    message = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.';
                } else if (xhr.status === 401) {
                    message = 'Phiên làm việc hết hạn. Vui lòng đăng nhập lại.';
                }
                toastr.error(message);
                $btn.prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu đơn thư');
            }
        });
    }

    // ─── Initialize ─────────────────────────────────────────────

    $(document).ready(function () {
        // SubmitterType toggle handler
        $('input[name="SubmitterType"]').on('change', toggleSubmitterFields);

        // ComplaintType change handler - update AccusedSubject visibility
        $('#ComplaintTypeId').on('change', updateAccusedSubjectVisibility);

        // Character counters
        initCharCounters();

        // File upload handlers
        initFileUploadHandlers();

        // Autocomplete and duplicate check handlers
        initTaxCodeAutocomplete();
        initDuplicateCheck();

        // Save button
        $('#btnLuuDon').on('click', handleSaveComplaint);

        // Select2 init (if available)
        if (typeof $.fn.select2 !== 'undefined') {
            $('#ComplaintTypeId').select2({
                theme: 'bootstrap4',
                width: '100%',
                allowClear: true
            });
        }

        // Set default date to today
        var today = new Date().toISOString().split('T')[0];
        $('#ReceivedDate').val(today);

        // Initialize submitter field display
        toggleSubmitterFields();

        loadComplaintTypes();

        // Initial AccusedSubject visibility check
        updateAccusedSubjectVisibility();

        console.log('[Complaint Create] Form initialized');
    });

})();
