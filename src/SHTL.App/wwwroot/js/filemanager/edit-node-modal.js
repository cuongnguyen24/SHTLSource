/**
 * edit-node-modal.js
 * Logic chia sẻ cho việc chỉnh sửa Node (Thư mục hoặc Hồ sơ)
 * Dùng chung giữa Index.cshtml (Storage) và Profiles.cshtml (Hồ sơ)
 */

(function ($) {
    'use strict';

    // Formatters are now handled by window.fileManagerMetadataCore

    // Constants
    const SELECT2_INIT_DELAY = 200;

    // Cache cho các danh mục
    let profileTypesCache = [];
    let enterprisesCache = [];
    let departmentsCache = [];

    /* =========================================================
       API DATA LOADING
    ========================================================= */

    function loadProfileTypes() {
        return $.ajax({
            url: '/FileManager/Storage/GetProfileTypes',
            type: 'GET',
            success: function (data) {
                if (data && Array.isArray(data)) {
                    profileTypesCache = data;
                    const $select = $('#editProfileType');
                    $select.empty().append('<option value="">-- Chọn loại hồ sơ --</option>');
                    data.forEach(function (item) {
                        $select.append(`<option value="${item.id || item.Id}">${item.name || item.Name}</option>`);
                    });
                }
            }
        });
    }

    function loadEnterprises() {
        return $.ajax({
            url: '/FileManager/Storage/GetEnterprises',
            type: 'GET',
            success: function (data) {
                if (data && Array.isArray(data)) {
                    enterprisesCache = data;
                    const $select = $('#editProfileEnterprise');
                    $select.empty().append('<option value="">-- Chọn doanh nghiệp --</option>');
                    data.forEach(function (item) {
                        $select.append(`<option value="${item.id || item.Id}">${item.name || item.Name}</option>`);
                    });
                }
            }
        });
    }

    function loadDepartments() {
        return $.ajax({
            url: '/FileManager/Storage/GetDepartments',
            type: 'GET',
            success: function (data) {
                if (data && Array.isArray(data)) {
                    departmentsCache = data;
                    const $select = $('#editProfileDepartment');
                    $select.empty().append('<option value="">-- Chọn phòng ban --</option>');
                    data.forEach(function (item) {
                        $select.append(`<option value="${item.id || item.Id}">${item.name || item.Name}</option>`);
                    });
                }
            }
        });
    }

    /* =========================================================
       DYNAMIC METADATA FIELDS
    ========================================================= */

    function loadDynamicMetadataOptions(selectElement, optionsConfig, fieldType) {
        let config = {};
        if (optionsConfig) {
            try {
                config = typeof optionsConfig === 'string' ? JSON.parse(optionsConfig) : optionsConfig;
            } catch (e) {
                if (typeof optionsConfig === 'string' && optionsConfig.trim().length > 0 && optionsConfig !== 'null') {
                    const rawVal = optionsConfig.trim();
                    if (rawVal.includes('-') && rawVal.length > 30) {
                        config = { CategoryTypeId: rawVal };
                    } else {
                        config = { CategoryCode: rawVal };
                    }
                }
            }
        }

        const categoryCode = config.CategoryCode || config.categoryCode;
        const categoryTypeId = config.CategoryTypeId || config.categoryTypeId;
        let endpoint = config.MasterDataEndpoint || config.endpoint || config.url;

        if (!endpoint && !categoryCode && !categoryTypeId) {
            switch (fieldType) {
                case 'Departments': endpoint = '/Departments/GetAll'; break;
                case 'Warehouses': endpoint = '/Warehouses/GetAll'; break;
                case 'Shelves': endpoint = '/Shelves/GetAll'; break;
                case 'Racks': endpoint = '/Racks/GetAll'; break;
                case 'Boxes': endpoint = '/Boxes/GetAll'; break;
            }
        }

        if (categoryCode || categoryTypeId) {
            const url = categoryCode
                ? `/CategoryType/GetByTypeCode?typeCode=${categoryCode}`
                : `/CategoryType/GetCategories?categoryTypeId=${categoryTypeId}`;

            return $.ajax({
                url: url,
                type: 'GET',
                success: function (response) {
                    const data = response.data || response;
                    if (data && Array.isArray(data)) {
                        data.forEach(function (item) {
                            const val = item.code || item.Code || item.id || item.Id || item;
                            const text = item.name || item.Name || val;
                            if (selectElement.find(`option[value="${val}"]`).length === 0) {
                                selectElement.append(`<option value="${val}">${text}</option>`);
                            }
                        });
                    }
                }
            });
        } else if (endpoint) {
            const finalUrl = endpoint.startsWith('/') ? endpoint : `/api/v1/masterdata/${endpoint}`;
            return $.ajax({
                url: finalUrl,
                type: 'GET',
                success: function (response) {
                    const items = Array.isArray(response) ? response : (response.data ? (Array.isArray(response.data) ? response.data : (response.data.items || [])) : []);
                    items.forEach(function (item) {
                        const val = item.id || item.Id || item.code || item.Code || item;
                        const text = item.name || item.Name || val;
                        selectElement.append(`<option value="${val}">${text}</option>`);
                    });
                }
            });
        }
        return null;
    }

    function initSelect2ForElement($element) {
        if (!$element.hasClass('select2-hidden-accessible')) {
            const $modal = $element.closest('.modal');
            const isInModal = $modal.length > 0;
            
            $element.select2({
                dropdownParent: isInModal ? $modal : $(document.body),
                width: '100%',
                placeholder: $element.attr('placeholder') || '-- Chọn --',
                allowClear: true
            });
        }
    }

    function renderEditDynamicMetadataFields(fields) {
        let html = '';
        const fieldsToInit = [];
        const deferred = $.Deferred();

        fields.forEach(function (field) {
            const fieldName = field.fieldName || field.FieldName || field.fieldId || field.FieldId;
            const fieldLabel = field.displayLabel || field.DisplayLabel || field.fieldLabel || field.FieldLabel;
            let fieldType = field.dataType || field.DataType || field.fieldType || field.FieldType || 'text';
            fieldType = fieldType.toLowerCase();

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
                            <input class="form-check-input edit-metadata-field" type="checkbox" id="edit_meta_${fieldName}" 
                                    data-field-name="${fieldName}" style="cursor: pointer;">
                            <label class="form-check-label demo-label-small ms-2" for="edit_meta_${fieldName}">${fieldLabel} ${requiredBadge}</label>
                         </div>`;
            } else {
                html += `<label for="edit_meta_${fieldName}" class="demo-label-small">${fieldLabel} ${requiredBadge}</label>`;

                if (['text', 'string', 'tag'].includes(fieldType)) {
                    const minLenAttr = minLength !== '' ? `minlength="${minLength}"` : '';
                    const maxLenAttr = maxLength ? `maxlength="${maxLength}"` : '';
                    html += `<input type="text" class="input-figma edit-metadata-field" id="edit_meta_${fieldName}" 
                             data-field-name="${fieldName}" placeholder="${placeholder}" 
                             style="height: 38px; font-size: 14px; width: 100%;" ${maxLenAttr} ${minLenAttr} ${requiredAttr} />`;
                } else if (['number', 'integer'].includes(fieldType)) {
                    const isDecimal = fieldType === 'number';
                    const formatClass = isDecimal ? 'format-decimal' : 'format-integer';
                    const minAttr = minVal !== '' ? `data-min="${minVal}"` : '';
                    const maxAttr = maxVal !== '' ? `data-max="${maxVal}"` : '';
                    const maxLenAttr = maxLength ? `maxlength="${maxLength}"` : '';
                    const minLenAttr = minLength ? `minlength="${minLength}"` : '';
                    html += `<input type="text" class="input-figma edit-metadata-field ${formatClass}" id="edit_meta_${fieldName}" 
                             data-field-name="${fieldName}" placeholder="${placeholder}" 
                             style="height: 38px; font-size: 14px; width: 100%;" ${minAttr} ${maxAttr} ${maxLenAttr} ${minLenAttr} ${requiredAttr} />`;
                } else if (['date', 'datetime'].includes(fieldType)) {
                    html += `<input type="date" class="input-figma edit-metadata-field" id="edit_meta_${fieldName}" 
                             data-field-name="${fieldName}" 
                             style="height: 38px; font-size: 14px; width: 100%; cursor: pointer;" 
                             onclick="this.showPicker()" ${requiredAttr} />`;
                } else if (['textarea'].includes(fieldType)) {
                    html += `<textarea class="textarea-figma edit-metadata-field" id="edit_meta_${fieldName}" 
                             data-field-name="${fieldName}" placeholder="${placeholder}" 
                             style="min-height: 80px; width: 100%;" maxlength="${maxLength * 4}" ${requiredAttr}></textarea>`;
                } else if (['select', 'multiselect', 'departments', 'warehouses', 'shelves', 'racks', 'boxes'].includes(fieldType)) {
                    const isMulti = (fieldType === 'multiselect');
                    const multiAttr = isMulti ? 'multiple="multiple"' : '';

                    html += `<select class="select-figma edit-metadata-field dropdown-metadata" id="edit_meta_${fieldName}" 
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
                    const maxLenAttr = maxLength ? `maxlength="${maxLength}"` : '';
                    const minLenAttr = minLength ? `minlength="${minLength}"` : '';
                    html += `<input type="text" class="input-figma edit-metadata-field" id="edit_meta_${fieldName}" 
                             data-field-name="${fieldName}" placeholder="${placeholder}" 
                             style="height: 38px; font-size: 14px; width: 100%;" ${maxLenAttr} ${minLenAttr} ${requiredAttr} />`;
                }
            }
            html += `</div></div>`;
        });

        if ($('#editMetadataFieldsContainer').length) {
            $('#editMetadataFieldsContainer .select2-hidden-accessible').each(function () {
                try { $(this).select2('destroy'); } catch (e) { }
            });
        }
        $('#editMetadataFieldsContainer').html(html);

        setTimeout(function () {
            const dynamicLoadPromises = [];
            if (fieldsToInit.length > 0) {
                fieldsToInit.forEach(function (field) {
                    const $elem = $(`#edit_meta_${field.fieldName}`);
                    if ($elem.length > 0) {
                        const promise = loadDynamicMetadataOptions($elem, field.config, field.type);
                        if (promise) dynamicLoadPromises.push(promise);
                    }
                });
            }

            $.when.apply($, dynamicLoadPromises).always(function () {
                setTimeout(function () {
                    $('#editMetadataFieldsContainer .dropdown-metadata').each(function () {
                        initSelect2ForElement($(this));
                    });
                    deferred.resolve();
                }, SELECT2_INIT_DELAY);
            });
        }, SELECT2_INIT_DELAY);

        return [deferred.promise()];
    }

    function populateEditMetadataFields(metaValue) {
        if (!metaValue) return;
        let metadata = metaValue;
        if (typeof metaValue === 'string') {
            try { metadata = JSON.parse(metaValue); } catch (e) { return; }
        }

        if (metadata && typeof metadata === 'object') {
            Object.keys(metadata).forEach(function (key) {
                const val = metadata[key];
                const $field = $(`.edit-metadata-field[data-field-name="${key}"]`);
                if ($field.length) {
                    if ($field.is(':checkbox')) {
                        $field.prop('checked', val === true || val === 'true');
                    } else if ($field.is('select') && $field.attr('multiple')) {
                        let valArray = val;
                        if (typeof val === 'string') valArray = val.split(',').map(s => s.trim());
                        $field.val(valArray).trigger('change');
                    } else {
                        // Apply formatting for numbers when populating
                        if ($field.hasClass('format-decimal') || $field.hasClass('format-integer')) {
                            $field.val(val);
                            if (window.fileManagerMetadataCore) window.fileManagerMetadataCore.formatNumberInput($field[0], $field.hasClass('format-decimal'));
                        } else {
                            $field.val(val).trigger('change');
                        }
                    }
                }
            });
        }
    }

    function collectEditMetadataFieldsAsObject() {
        const metadata = {};
        $('.edit-metadata-field').each(function () {
            const fieldName = $(this).data('field-name');
            let value = $(this).val();
            
            if (value !== null && value !== undefined && value !== '') {
                if ($(this).hasClass('format-decimal') || $(this).hasClass('format-integer')) {
                    value = window.fileManagerMetadataCore ? window.fileManagerMetadataCore.parseFormattedNumber(value) : value;
                }
                metadata[fieldName] = value;
            }
        });
        return metadata;
    }

    /**
     * Tải và hiển thị các trường Metadata động dựa trên Loại hồ sơ
     */
    function refreshEditMetadataFields(profileTypeId, initialMetaValue) {
        if (!profileTypeId) {
            $('#editDynamicMetadataFields').hide();
            $('#editMetadataFieldsContainer').empty();
            return;
        }

        $.ajax({
            url: '/FileManager/Storage/GetProfileMetadataFields',
            type: 'GET',
            data: { profileTypeId: profileTypeId },
            success: function (fields) {
                if (fields && fields.length > 0) {
                    const promises = renderEditDynamicMetadataFields(fields);
                    if (initialMetaValue) {
                        $.when.apply($, promises).done(function() {
                            populateEditMetadataFields(initialMetaValue);
                        });
                    }
                    $('#editDynamicMetadataFields').show();
                } else {
                    $('#editDynamicMetadataFields').hide();
                    $('#editMetadataFieldsContainer').empty();
                }
            },
            error: function() {
                $('#editDynamicMetadataFields').hide();
                $('#editMetadataFieldsContainer').empty();
            }
        });
    }

    /* =========================================================
       MAIN ENTRY POINT
    ========================================================= */

    window.openEditNodeModal = function (node, options) {
        const settings = $.extend({
            onSuccess: null
        }, options);

        const dataObj = node.data || (node.original && node.original.data) || node;
        const id = node.id || dataObj.id || dataObj.Id;
        
        $('#editNodeId').val(id);
        
        // Debug
        const type = (dataObj.nodeType || dataObj.NodeType || node.nodeType || '').toString().trim().toUpperCase();
        $('#editNodeType').val(type);
        $('#editNodeName').val(dataObj.name || dataObj.Name || '');
        
        let typeLabel = 'Thư mục';
        if (type === 'HO_SO' || type === '2') typeLabel = 'Hồ sơ';
        else if (type === 'TAI_LIEU' || type === '3') {
            // Should not happen if redirect works, but as fallback:
            window.open('/FileManager/Storage/DocumentView/' + (dataObj.id || node.id || node) + '?mode=edit', '_blank');
            $('#editNodeModal').modal('hide');
            return;
        }
        $('#editNodeTypeLabel').text(typeLabel);

        // Fetch FULL details if it's a shell object (missing fields)
        if (id && (!dataObj.name && !dataObj.Name)) {
            $.ajax({
                url: `/FileManager/Storage/GetNodeDetail/${id}`,
                type: 'GET',
                success: function (res) {
                    if (res.isSuccess && res.data) {
                        populateEditModal(res.data, settings);
                    } else {
                        toastr.error(res.message || 'Không thể lấy thông tin chi tiết');
                    }
                },
                error: function() {
                    toastr.error('Lỗi khi lấy thông tin node');
                }
            });
        } else {
            populateEditModal(dataObj, settings);
        }
    };

    function populateEditModal(dataObj, settings) {
        const type = (dataObj.nodeType || dataObj.NodeType || '').trim().toUpperCase();
        const profileTypeId = dataObj.idProfileType || dataObj.IdProfileType || dataObj.profileTypeId;

        $('#editNodeName').val(dataObj.name || dataObj.Name || '');

        if (type === 'HO_SO') {
            $('#editProfileFields').show();
            $('#editFolderFields').hide();

            $('#editProfileCode').val(dataObj.maHoSo || dataObj.MaHoSo || '');
            $('#editProfileTitle').val(dataObj.tieuDeHoSo || dataObj.TieuDeHoSo || '');
            $('#editProfileRetention').val(dataObj.thoiHanLuuTru || dataObj.ThoiHanLuuTru || '');
            
            const startDate = dataObj.ngayBatDau || dataObj.NgayBatDau;
            const endDate = dataObj.ngayKetThuc || dataObj.NgayKetThuc;
            $('#editProfileStartDate').val(startDate ? startDate.split('T')[0] : '');
            $('#editProfileEndDate').val(endDate ? endDate.split('T')[0] : '');
            
            $('#editProfileTotalSheets').val(dataObj.tongSoTo || dataObj.TongSoTo || 0);
            $('#editProfileTotalPages').val(dataObj.tongSoTrang || dataObj.TongSoTrang || 0);

            const p1 = loadProfileTypes();
            const p2 = loadEnterprises();
            const p3 = loadDepartments();

            $.when(p1, p2, p3).done(function () {
                // Lưu dữ liệu meta ban đầu vào data attribute để hàm change xử lý
                $('#editProfileType').data('initial-meta', dataObj.metaValue || dataObj.MetaValue);
                
                $('#editProfileType').val(profileTypeId).trigger('change');
                $('#editProfileEnterprise').val(dataObj.enterpriseId || dataObj.EnterpriseId).trigger('change');
                $('#editProfileDepartment').val(dataObj.departmentId || dataObj.DepartmentId).trigger('change');
            });
        } else {
            $('#editProfileFields').hide();
            $('#editFolderFields').show();
            $('#editNodeDescription').val(dataObj.description || dataObj.Description || '');
        }

        $('#editNodeModal').modal('show');

        $('#btnConfirmEdit').off('click').on('click', function () {
            console.log('[EditNodeModal] Confirm button clicked');
            
            const id = $('#editNodeId').val();
            const currentType = $('#editNodeType').val();
            const updatedName = $('#editNodeName').val().trim();
            
            console.log('[EditNodeModal] Editing node:', { id, currentType, updatedName });
            
            if (!updatedName) {
                console.warn('[EditNodeModal] Validation failed: Name is empty');
                toastr.warning('Vui lòng nhập tên');
                return;
            }
            
            // Parse totalSheets and totalPages correctly (handle formatted numbers)
            let totalSheets = 0;
            let totalPages = 0;
            if (currentType === 'HO_SO') {
                const sheetsVal = $('#editProfileTotalSheets').val();
                const pagesVal = $('#editProfileTotalPages').val();
                
                if (sheetsVal && window.fileManagerMetadataCore) {
                    const parsed = window.fileManagerMetadataCore.parseFormattedNumber(sheetsVal);
                    totalSheets = parseInt(parsed) || 0;
                }
                if (pagesVal && window.fileManagerMetadataCore) {
                    const parsed = window.fileManagerMetadataCore.parseFormattedNumber(pagesVal);
                    totalPages = parseInt(parsed) || 0;
                }
            }

            const payload = {
                id: id,
                name: updatedName,
                nodeType: currentType,
                description: $('#editNodeDescription').val() || '',
                profileTypeId: currentType === 'HO_SO' ? ($('#editProfileType').val() || null) : null,
                profileCode: currentType === 'HO_SO' ? ($('#editProfileCode').val() || null) : null,
                profileTitle: currentType === 'HO_SO' ? ($('#editProfileTitle').val() || null) : null,
                enterpriseId: (currentType === 'HO_SO' && $('#editProfileEnterprise').val()) ? $('#editProfileEnterprise').val() : null,
                departmentId: (currentType === 'HO_SO' && $('#editProfileDepartment').val()) ? $('#editProfileDepartment').val() : null,
                retentionPeriod: currentType === 'HO_SO' ? (parseInt($('#editProfileRetention').val()) || null) : null,
                startDate: currentType === 'HO_SO' ? ($('#editProfileStartDate').val() || null) : null,
                endDate: currentType === 'HO_SO' ? ($('#editProfileEndDate').val() || null) : null,
                totalSheets: totalSheets,
                totalPages: totalPages,
                metaValue: currentType === 'HO_SO' ? collectEditMetadataFieldsAsObject() : null
            };
            
            console.log('[EditNodeModal] Payload prepared:', payload);

            // Enhanced Validation via metadata-core
            if (currentType === 'HO_SO') {
                console.log('[EditNodeModal] Validating profile metadata fields...');
                if (window.fileManagerMetadataCore) {
                    var isValid = window.fileManagerMetadataCore.validateMetadataFields('#editMetadataFieldsContainer', '.edit-metadata-field');
                    if (!isValid) {
                        console.warn('[EditNodeModal] Profile metadata validation failed');
                        return;
                    }
                    console.log('[EditNodeModal] Profile metadata validation passed');
                } else {
                    console.warn('[EditNodeModal] fileManagerMetadataCore not found, skipping validation');
                }
            }
            
            console.log('[EditNodeModal] Sending update request...');

            const $btn = $(this);
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-2"></i> Đang lưu...');

            $.ajax({
                url: `/FileManager/Storage/Update/${id}`,
                type: 'PUT',
                contentType: 'application/json',
                data: JSON.stringify(payload),
                headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
                success: function (response) {
                    if (response.isSuccess) {
                        toastr.success(response.message || 'Cập nhật thành công');
                        $('#editNodeModal').modal('hide');
                        if (settings.onSuccess) settings.onSuccess(response.data);
                    } else {
                        toastr.error(response.message || 'Lỗi khi cập nhật');
                    }
                },
                error: function (xhr) {
                    let errMsg = 'Lỗi kết nối khi cập nhật';
                    let errorDetails = [];
                    
                    if (xhr.responseJSON) {
                        if (xhr.responseJSON.message) {
                            errMsg = xhr.responseJSON.message;
                        }
                        if (xhr.responseJSON.Errors && xhr.responseJSON.Errors.length > 0) {
                            errorDetails = xhr.responseJSON.Errors;
                        }
                        if (xhr.responseJSON.errors) {
                            Object.keys(xhr.responseJSON.errors).forEach(function(key) {
                                const msgs = xhr.responseJSON.errors[key];
                                if (Array.isArray(msgs)) {
                                    errorDetails.push(key + ': ' + msgs.join(', '));
                                }
                            });
                        }
                    } else if (xhr.responseText) {
                        try {
                            const parsed = JSON.parse(xhr.responseText);
                            errMsg = parsed.message || errMsg;
                            if (parsed.errors) {
                                errorDetails = Object.values(parsed.errors).flat();
                            }
                        } catch(e) {
                            console.error('[EditNodeModal] Error parsing response:', e);
                        }
                    }
                    
                    // Show main error
                    toastr.error(errMsg, 'Lưu thất bại');
                    
                    // Show detailed errors if available
                    if (errorDetails.length > 0) {
                        setTimeout(function() {
                            errorDetails.forEach(function(detail) {
                                toastr.warning(detail, 'Chi tiết lỗi');
                            });
                        }, 500);
                    }
                    
                    console.error('[EditNodeModal] Update failed:', xhr.status, errMsg, errorDetails);
                },
                complete: function () {
                    $btn.prop('disabled', false).html('<i class="fas fa-save mr-2"></i> Lưu');
                }
            });
        });
    }

    // Initialize Select2 and Events
    $(document).ready(function() {
        $('#editProfileType, #editProfileEnterprise, #editProfileDepartment').each(function() {
            initSelect2ForElement($(this));
        });

        // Bắt sự kiện thay đổi loại hồ sơ để render lại Metadata động
        $(document).on('change', '#editProfileType', function() {
            const profileTypeId = $(this).val();
            const initialMeta = $(this).data('initial-meta');
            
            // Xóa dữ liệu tạm sau khi đọc
            $(this).removeData('initial-meta');
            
            refreshEditMetadataFields(profileTypeId, initialMeta);
        });
    });

    // EXPORT UTILITIES FOR SHARING
    window.fileManagerEditNode = {
        openModal: window.openEditNodeModal,
        loadDynamicMetadataOptions: loadDynamicMetadataOptions,
        initSelect2ForElement: initSelect2ForElement,
        renderDynamicFields: renderEditDynamicMetadataFields,
        populateFields: populateEditMetadataFields,
        collectFields: collectEditMetadataFieldsAsObject
    };

})(jQuery);
