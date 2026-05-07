/**
 * add-profile-modal.js - Shared Profile Creation Modal Logic
 * Requires: _CreateProfileModal.cshtml partial view
 * Usage: Include this script AFTER jQuery, Select2, and Bootstrap Modal
 * 
 * Public API:
 *   window.openCreateProfileModal(parentId, options)
 *   window.submitCreateProfile(onSuccess, onError)
 */

(function () {
    'use strict';

    // Module state
    const SELECT2_INIT_DELAY = 200;
    let documentTypesCache = [];

    // Formatters are now handled by window.fileManagerMetadataCore
    // ===== PUBLIC API =====

    /**
     * Open Create Profile Modal
     * @param {string} parentId - Parent node ID (folder or root)
     * @param {object} options - Optional configuration { onSuccess: function, onError: function }
     */
    window.openCreateProfileModal = function (parentId, options) {
        options = options || {};

        // Auto-replace '#' with rootNodeId if available (defensive programming)
        if (parentId === '#' && window.storageContext && window.storageContext.rootNodeId) {
            console.log('[CreateProfileModal] Replacing "#" with rootNodeId:', window.storageContext.rootNodeId);
            parentId = window.storageContext.rootNodeId;
        }

        // Validate parentId
        if (!parentId || parentId === '#' || parentId.trim() === '') {
            console.error('[CreateProfileModal] Invalid parentId after normalization:', parentId);
            toastr.error('Không xác định được vị trí tạo hồ sơ. Vui lòng chọn thư mục.');
            return;
        }

        console.log('[CreateProfileModal] Opening modal with parentId:', parentId);

        // Reset form fields
        $('#profileParentId').val(parentId);
        $('#profileName').val('');
        $('#profileCode').val('');
        $('#profileTitle').val('');
        $('#profileRetention').val('');
        $('#profileStartDate').val('');
        $('#profileEndDate').val('');
        $('#profileTotalSheets').val('');
        $('#profileTotalPages').val('');
        $('#profileEnterprise').val('');
        $('#profileDepartment').val('');

        // Hide dynamic metadata fields initially
        $('#dynamicMetadataFields').hide();
        $('#metadataFieldsContainer').empty();

        // Load dropdowns
        $.when(
            loadProfileTypes($('#profileType')),
            loadEnterprises($('#profileEnterprise')),
            loadDepartments($('#profileDepartment'))
        ).always(function () {
            // Initialize Select2 after dropdowns are loaded
            setTimeout(function () {
                initSelect2ForElement($('#profileType'));
                initSelect2ForElement($('#profileEnterprise'));
                initSelect2ForElement($('#profileDepartment'));
            }, SELECT2_INIT_DELAY);
        });

        // Store callbacks for later use
        $('#createProfileModal').data('callbacks', options);

        $('#createProfileModal').modal('show');
    };

    /**
     * Submit Create Profile (call from external code or button)
     * @param {function} onSuccess - Success callback
     * @param {function} onError - Error callback
     */
    window.submitCreateProfile = function (onSuccess, onError) {
        // Validate required fields
        if (!$('#profileName').val()) {
            toastr.warning('Vui lòng nhập tên hồ sơ');
            return;
        }

        if (!$('#profileType').val()) {
            toastr.warning('Vui lòng chọn loại hồ sơ');
            return;
        }

        // Validate dynamic metadata required fields via metadata-core
        if (window.fileManagerMetadataCore && !window.fileManagerMetadataCore.validateMetadataFields('#metadataFieldsContainer', '.metadata-field')) {
            return;
        }

        // Get CSRF token
        const token = $('input[name="__RequestVerificationToken"]').val();

        // Collect form data
        const parentId = $('#profileParentId').val();

        const data = {
            ParentId: parentId,
            Name: $('#profileName').val(),
            ProfileTypeId: $('#profileType').val() || null,
            EnterpriseId: $('#profileEnterprise').val() || null,
            DepartmentId: $('#profileDepartment').val() || null,
            ProfileCode: $('#profileCode').val() || null,
            ProfileTitle: $('#profileTitle').val() || $('#profileName').val(),
            RetentionPeriod: $('#profileRetention').val() ? parseInt($('#profileRetention').val()) : null,
            StartDate: $('#profileStartDate').val() || null,
            EndDate: $('#profileEndDate').val() || null,
            TotalSheets: $('#profileTotalSheets').val() ? parseInt($('#profileTotalSheets').val()) : null,
            TotalPages: $('#profileTotalPages').val() ? parseInt($('#profileTotalPages').val()) : null,
            MetaValue: collectMetadataFieldsAsObject()
        };

        $.ajax({
            url: '/FileManager/Storage/CreateProfile',
            type: 'POST',
            contentType: 'application/json',
            headers: { 'RequestVerificationToken': token },
            data: JSON.stringify(data),
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(response.message || 'Tạo hồ sơ thành công');
                    $('#createProfileModal').modal('hide');

                    if (onSuccess) onSuccess(response);
                } else {
                    toastr.error(response.message || 'Không thể tạo hồ sơ');
                    if (onError) onError(response);
                }
            },
            error: function (xhr) {
                let errMsg = 'Lỗi kết nối khi lưu hệ thống';
                if (xhr.responseJSON) {
                    if (xhr.responseJSON.message) errMsg = xhr.responseJSON.message;
                    else if (xhr.responseJSON.Errors && xhr.responseJSON.Errors.length > 0) errMsg = xhr.responseJSON.Errors.join('<br>');
                    else if (xhr.responseJSON.errors) {
                        errMsg = Object.values(xhr.responseJSON.errors).map(e => e.join(', ')).join('<br>');
                    }
                } else if (xhr.responseText) {
                    try {
                        const parsed = JSON.parse(xhr.responseText);
                        errMsg = parsed.message || errMsg;
                    } catch(e) {}
                }
                toastr.error(errMsg, 'Lưu thất bại');
                if (onError) onError(xhr);
            }
        });
    };

    // ===== INTERNAL HELPERS =====

    function loadProfileTypes(dropdown, selectedId) {
        dropdown.empty().append('<option value="">-- Chọn loại hồ sơ --</option>');
        return $.ajax({
            url: '/FileManager/Storage/GetProfileTypes',
            type: 'GET',
            success: function (data) {
                if (data && Array.isArray(data)) {
                    data.forEach(function (item) {
                        const id = item.Id || item.id;
                        const name = item.Name || item.name;
                        const selected = (selectedId === id) ? 'selected' : '';
                        dropdown.append(`<option value="${id}" ${selected}>${name}</option>`);
                    });
                }
            }
        });
    }

    function loadEnterprises(dropdown, selectedId) {
        dropdown.empty().append('<option value="">-- Chọn doanh nghiệp --</option>');
        return $.ajax({
            url: '/FileManager/Storage/GetEnterprises',
            type: 'GET',
            success: function (data) {
                if (data && Array.isArray(data)) {
                    data.forEach(function (item) {
                        const id = item.Id || item.id;
                        const name = item.Name || item.name;
                        const code = item.Code || item.code;
                        const selected = (selectedId === id) ? 'selected' : '';
                        dropdown.append(`<option value="${id}" ${selected}>${code ? code + ' - ' : ''}${name}</option>`);
                    });
                }
            }
        });
    }

    function loadDepartments(dropdown, selectedId) {
        dropdown.empty().append('<option value="">-- Chọn phòng ban --</option>');
        return $.ajax({
            url: '/FileManager/Storage/GetDepartments',
            type: 'GET',
            success: function (data) {
                if (data && Array.isArray(data)) {
                    data.forEach(function (item) {
                        const id = item.id || item.Id;
                        const name = item.name || item.Name;
                        const code = item.code || item.Code;
                        const selected = (selectedId === id) ? 'selected' : '';
                        dropdown.append(`<option value="${id}" ${selected}>${code ? code + ' - ' : ''}${name}</option>`);
                    });
                }
            }
        });
    }

    function initSelect2ForElement(element) {
        if (!element || element.length === 0) return;

        if (element.data('select2-initialized') === true) return;

        const $modal = element.closest('.modal');
        const isInModal = $modal.length > 0;

        if (element.hasClass('select2-hidden-accessible')) {
            try {
                element.select2('destroy');
            } catch (e) { }
        }

        try {
            element.select2({
                dropdownParent: isInModal ? $modal : $(document.body),
                placeholder: element.find('option:first').text() || 'Chọn giá trị',
                allowClear: true,
                width: '100%',
                closeOnSelect: true
            });

            element.data('select2-initialized', true);
        } catch (e) {
            console.error('Error initializing Select2:', e);
        }
    }

    function collectMetadataFieldsAsObject() {
        const metadata = {};
        $('.metadata-field').each(function () {
            const fieldName = $(this).data('field-name');
            let value;

            if ($(this).is(':checkbox')) {
                value = $(this).is(':checked');
            } else {
                value = $(this).val();
            }

            if (value !== null && value !== undefined && value !== '') {
                if ($(this).hasClass('format-decimal') || $(this).hasClass('format-integer')) {
                    value = window.fileManagerMetadataCore ? window.fileManagerMetadataCore.parseFormattedNumber(value) : value;
                }
                metadata[fieldName] = value;
            }
        });
        return metadata;
    }

    // ===== EVENT BINDINGS (Auto-init on document ready) =====
    $(document).ready(function () {
        // ProfileType change - Load dynamic metadata fields
        $(document).on('change', '#profileType', function () {
            const profileTypeId = $(this).val();

            if (!profileTypeId) {
                $('#dynamicMetadataFields').hide();
                $('#metadataFieldsContainer').empty();
                return;
            }

            $.ajax({
                url: '/FileManager/Storage/GetProfileMetadataFields',
                type: 'GET',
                data: { profileTypeId: profileTypeId },
                success: function (fields) {
                    if (fields && Array.isArray(fields) && fields.length > 0) {
                        renderDynamicMetadataFields(fields);
                        $('#dynamicMetadataFields').show();
                    } else {
                        $('#dynamicMetadataFields').hide();
                        $('#metadataFieldsContainer').empty();
                    }
                },
                error: function (xhr, status, error) {
                    console.error('Error loading metadata fields:', error);
                    $('#dynamicMetadataFields').hide();
                    $('#metadataFieldsContainer').empty();
                }
            });
        });

        // Confirm button click
        $(document).on('click', '#btnConfirmCreateProfile', function () {
            const callbacks = $('#createProfileModal').data('callbacks') || {};
            window.submitCreateProfile(callbacks.onSuccess, callbacks.onError);
        });

        // Modal cleanup on hide
        $('#createProfileModal').on('hidden.bs.modal', function () {
            // Clean up Select2 instances
            $(this).find('.select2-hidden-accessible').each(function () {
                try {
                    $(this).select2('destroy');
                } catch (e) { }
            });
        });
    });

    // Render dynamic metadata fields (robust version aligned with edit renderer)
    function renderDynamicMetadataFields(fields) {
        let html = '';
        const fieldsToInit = [];

        fields.forEach(function (field) {
            const fieldName = field.fieldName || field.FieldName;
            const fieldLabel = field.displayLabel || field.DisplayLabel || field.fieldLabel || field.FieldLabel;
            let fieldType = (field.dataType || field.DataType || field.fieldType || field.FieldType || 'text').toLowerCase();

            const isRequired = field.isRequired !== undefined ? field.isRequired : (field.IsRequired !== undefined ? field.IsRequired : false);
            let placeholder = field.placeholder || field.Placeholder || '';
            placeholder = placeholder.replace(/"/g, '&quot;');
            
            const maxLength = field.maxLength || field.MaxLength || 500;
            const minLength = field.minLength || field.MinLength || '';
            const minVal = field.minValue !== undefined && field.minValue !== null ? field.minValue : (field.MinValue !== undefined && field.MinValue !== null ? field.MinValue : '');
            const maxVal = field.maxValue !== undefined && field.maxValue !== null ? field.maxValue : (field.MaxValue !== undefined && field.MaxValue !== null ? field.MaxValue : '');
            
            const selectOptions = field.selectOptions || field.SelectOptions;
            const listOptions = field.listOptions || field.ListOptions;

            if (!fieldName || !fieldLabel) return;

            const colClass = (fieldType === 'textarea' || fieldType === 'multiselect') ? 'col-md-12' : 'col-md-6';
            const requiredBadge = isRequired ? '<span class="text-danger">*</span>' : '';
            const requiredAttr = isRequired ? 'required' : '';

            html += `<div class="${colClass}">`;
            html += `<div class="form-group mb-3">`;

            if (fieldType === 'boolean') {
                html += `<div class="form-check form-switch pt-4">
                            <input class="form-check-input metadata-field" type="checkbox" id="meta_${fieldName}" 
                                   data-field-name="${fieldName}" style="cursor: pointer;">
                            <label class="form-check-label demo-label-small ms-2" for="meta_${fieldName}">${fieldLabel} ${requiredBadge}</label>
                         </div>`;
            } else {
                html += `<label for="meta_${fieldName}" class="demo-label-small">${fieldLabel} ${requiredBadge}</label>`;

                if (['text', 'string', 'tag'].includes(fieldType)) {
                    const minLenAttr = minLength !== '' ? `minlength="${minLength}"` : '';
                    html += `<input type="text" class="input-figma metadata-field" id="meta_${fieldName}" 
                             data-field-name="${fieldName}" placeholder="${placeholder}" 
                             style="height: 38px; font-size: 14px; width: 100%;" 
                             maxlength="${maxLength}" ${minLenAttr} ${requiredAttr} />`;
                } else if (['number', 'integer'].includes(fieldType)) {
                const isDecimal = fieldType === 'number';
                const formatClass = isDecimal ? 'format-decimal' : 'format-integer';
                const minAttr = minVal !== '' ? `data-min="${minVal}"` : '';
                const maxAttr = maxVal !== '' ? `data-max="${maxVal}"` : '';
                const maxLenAttr = maxLength ? `maxlength="${maxLength}"` : '';
                const minLenAttr = minLength ? `minlength="${minLength}"` : '';
                html += `<input type="text" class="input-figma metadata-field ${formatClass}" id="meta_${fieldName}" 
                         data-field-name="${fieldName}" placeholder="${placeholder}" 
                         style="height: 38px; font-size: 14px; width: 100%;" ${minAttr} ${maxAttr} ${minLenAttr} ${maxLenAttr} ${requiredAttr} />`;
                } else if (['date', 'datetime'].includes(fieldType)) {
                    html += `<input type="date" class="input-figma metadata-field" id="meta_${fieldName}" 
                             data-field-name="${fieldName}" 
                             style="height: 38px; font-size: 14px; width: 100%; cursor: pointer;" 
                             onclick="this.showPicker()" ${requiredAttr} />`;
                } else if (['textarea'].includes(fieldType)) {
                    html += `<textarea class="textarea-figma metadata-field" id="meta_${fieldName}" 
                             data-field-name="${fieldName}" placeholder="${placeholder}" 
                             style="min-height: 80px;" maxlength="${maxLength * 4}" ${requiredAttr}></textarea>`;
                } else if (['select', 'multiselect', 'departments', 'warehouses', 'shelves', 'racks', 'boxes'].includes(fieldType)) {
                    const isMulti = (fieldType === 'multiselect');
                    const multiAttr = isMulti ? 'multiple="multiple"' : '';

                    html += `<select class="select-figma metadata-field dropdown-metadata" id="meta_${fieldName}" 
                             data-field-name="${fieldName}" ${multiAttr} ${requiredAttr} style="width: 100%;">
                             <option value="">-- Chọn ${fieldLabel} --</option>`;

                    let dynamicConfig = listOptions;
                    let looksLikeDynamic = false;

                    if (selectOptions) {
                        try {
                            const options = typeof selectOptions === 'string' ? JSON.parse(selectOptions) : selectOptions;
                            if (Array.isArray(options)) {
                                options.forEach(opt => {
                                    const val = opt.value || opt.Value || opt;
                                    const text = opt.text || opt.Text || opt.label || opt.Label || val;
                                    html += `<option value="${val}">${text}</option>`;
                                });
                            } else if (typeof options === 'object' && options !== null) {
                                looksLikeDynamic = true;
                                dynamicConfig = selectOptions;
                            }
                        } catch (e) {
                            if (typeof selectOptions === 'string' && selectOptions.trim().length > 0 && selectOptions !== 'null') {
                                looksLikeDynamic = true;
                                if (!dynamicConfig) dynamicConfig = selectOptions;
                            }
                        }
                    }
                    html += `</select>`;

                    if (dynamicConfig || looksLikeDynamic || ['select', 'multiselect', 'departments', 'warehouses', 'shelves', 'racks', 'boxes'].includes(fieldType)) {
                        const originalFieldType = field.dataType || field.DataType || field.fieldType || field.FieldType || 'text';
                        fieldsToInit.push({ fieldName: fieldName, config: dynamicConfig, type: originalFieldType });
                    }
                } else {
                    html += `<input type="text" class="input-figma metadata-field" id="meta_${fieldName}" 
                             data-field-name="${fieldName}" placeholder="${placeholder}" 
                             style="height: 38px; font-size: 14px; width: 100%;" 
                             maxlength="${maxLength}" ${requiredAttr} />`;
                }
            }

            html += `</div></div>`;
        });

        // Clean up previous select2
        if ($('#metadataFieldsContainer').length) {
            $('#metadataFieldsContainer .select2-hidden-accessible').each(function () {
                try { $(this).select2('destroy'); } catch (e) { }
            });
        }
        
        $('#metadataFieldsContainer').html(html);

        setTimeout(function () {
            const dynamicLoadPromises = [];
            if (fieldsToInit.length > 0) {
                fieldsToInit.forEach(function (field) {
                    const $elem = $(`#meta_${field.fieldName}`);
                    if ($elem.length > 0 && window.fileManagerEditNode && typeof window.fileManagerEditNode.loadDynamicMetadataOptions === 'function') {
                        const promise = window.fileManagerEditNode.loadDynamicMetadataOptions($elem, field.config, field.type);
                        if (promise) dynamicLoadPromises.push(promise);
                    }
                });
            }

            $.when.apply($, dynamicLoadPromises).always(function () {
                setTimeout(function () {
                    $('#metadataFieldsContainer .dropdown-metadata').each(function () {
                        // Use existing robust initSelect2ForElement that uses dropdownParent properly
                        initSelect2ForElement($(this));
                    });
                }, SELECT2_INIT_DELAY);
            });
        }, SELECT2_INIT_DELAY);
    }

})();
