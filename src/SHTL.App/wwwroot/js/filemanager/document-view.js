/**
 * document-view.js — Standalone Document Viewer + Metadata Editor
 * Handles: file preview (MinIO signed URL), metadata editing, version history, file replacement
 */
(function ($) {
    'use strict';

    /* =========================================================
       CONSTANTS & STATE
    ========================================================= */
    // Formatters are now handled by window.fileManagerMetadataCore

    const DOC_ID = $('#docId').val();
    const TOKEN = $('input[name="__RequestVerificationToken"]').val();
    const OFFICE_VIEWER = 'https://view.officeapps.live.com/op/view.aspx?src=';
    const OFFICE_EXTS = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
    const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif'];

    let documentTypesCache = [];
    let currentDocData = null;
    let ORIGINAL_DATA = null; // Issue 2: Track original data to detect changes
    let CAN_DOWNLOAD = false; // Issue 3: Track download permission
    let isPopulating = false; // New: prevent clearing dependent fields during initial load

    /* =========================================================
       TOASTR CONFIG
    ========================================================= */
    toastr.options = {
        positionClass: 'toast-top-right',
        timeOut: 3000,
        closeButton: true,
        progressBar: true
    };

    /* =========================================================
       INIT
    ========================================================= */
    $(document).ready(function () {
        if (!DOC_ID) {
            showViewerError('Không tìm thấy ID tài liệu.');
            return;
        }
        loadDocumentTypes();
        loadDocumentDetail();
        loadVersionHistory(true); // Tải trước để lấy version badge, không mở modal
        checkDownloadPermission(); // Issue 3: Check permission and hide download button
        setupSecurityProtection(); // Issue 3: Setup right-click disable and other security
        
        // Handle Edit Information button
        $('#btnEditMetadata').on('click', function() {
            enableEditMode();
        });

        // Auto-trigger edit mode handled in populateMetadataForm
        initMetadataSelect2();
    });

    function initMetadataSelect2() {
        // Init Enterprise Select2
        $('#metaEnterprise').select2({
            placeholder: '-- Chọn doanh nghiệp --',
            allowClear: true,
            width: '100%',
            ajax: {
                url: '/FileManager/Storage/GetEnterprises',
                dataType: 'json',
                delay: 250,
                data: function (params) {
                    return { searchTerm: params.term };
                },
                processResults: function (data) {
                    return { results: data.isSuccess ? data.data : [] };
                },
                cache: true
            }
        }).on('change', function() {
            if (isPopulating) return; // Don't clear if we are initially populating
            
            var data = $(this).select2('data')[0];
            var enterpriseId = $(this).val();
            
            // Priority: data from Select2 search > data-attribute from manual option
            var taxCode = '';
            if (data && data.taxCode) {
                taxCode = data.taxCode;
            } else {
                taxCode = $(this).find(':selected').data('tax-code') || '';
            }

            // Reset dependent fields
            $('#metaTaxCode').val(taxCode);
            $('#metaProject').val(null).trigger('change').find('option:not([value=""])').remove();
            $('#metaOriginalLicense').val('');

            // Logic: Only clear dependent fields if user manually changes Enterprise
            // AFTER the initial population is complete.
            if (isPopulating) return;

            var enterpriseId = $(this).val();
            // ...
            if (enterpriseId) {
                // ...
                loadProjects(enterpriseId);
            } else {
                $('#metaProject').prop('disabled', true).val(null).trigger('change');
            }
        });

        // Init Project Select2
        $('#metaProject').select2({
            placeholder: '-- Chọn dự án --',
            allowClear: true,
            width: '100%'
        }).on('change', function() {
            var $selected = $(this).find(':selected');
            var license = $selected.data('license') || '';
            $('#metaOriginalLicense').val(license);
        });
    }

    function loadEnterpriseTaxCode(enterpriseId) {
        $.ajax({
            url: '/FileManager/Storage/GetEnterpriseDetail/' + enterpriseId,
            type: 'GET',
            success: function(response) {
                if (response.isSuccess && response.data) {
                    $('#metaTaxCode').val(response.data.taxCode || '');
                }
            }
        });
    }

    function loadProjects(enterpriseId, selectedProjectId) {
        var $select = $('#metaProject');
        $select.prop('disabled', true);
        
        $.ajax({
            url: '/FileManager/Storage/GetProjectsByEnterprise/' + enterpriseId,
            type: 'GET',
            success: function(response) {
                $select.empty().append('<option value="">-- Chọn dự án --</option>');
                if (response.isSuccess && Array.isArray(response.data)) {
                    response.data.forEach(function(p) {
                        var sel = (selectedProjectId && p.id === selectedProjectId) ? 'selected' : '';
                        $select.append('<option value="' + p.id + '" ' + sel + ' data-license="' + (p.licenseNumber || '') + '">' + p.text + '</option>');
                    });
                }
                
                if ($('#btnSaveDoc').is(':visible') || $('#viewMode').val() === 'edit') {
                    $select.prop('disabled', false);
                }
                
                if (selectedProjectId) {
                    $select.val(selectedProjectId).trigger('change');
                }
                
                // End of cascading population
                if (isPopulating) {
                    setTimeout(() => { isPopulating = false; }, 100);
                }
            }
        });
    }

    function enableEditMode() {
        $('#btnEditMetadata').hide();
        $('#btnSaveDoc, #btnReplaceFile').show();
        $('.metadata-field').prop('disabled', false);
        // Important: DO NOT trigger('change') on Select2 here as it clears dependent fields
        // Selection state is already visual, no need to trigger.
        
        // Explicitly enable project if enterprise is selected
        if ($('#metaEnterprise').val()) {
            $('#metaProject').prop('disabled', false);
        }
    }

    /* =========================================================
       DOCUMENT TYPES
    ========================================================= */
    function loadDocumentTypes() {
        $.ajax({
            url: '/FileManager/Storage/GetDocumentTypes',
            type: 'GET',
            success: function (data) {
                if (data && Array.isArray(data)) {
                    documentTypesCache = data.map(function (item) {
                        return {
                            id: item.id || item.Id,
                            name: item.name || item.Name,
                            code: item.code || item.Code
                        };
                    });
                    populateTypeDropdown($('#metaDocType'), null);
                }
            }
        });
    }

    function populateTypeDropdown($select, selectedId) {
        var currentVal = selectedId || $select.val();
        $select.empty().append('<option value="">-- Chọn loại tài liệu --</option>');
        documentTypesCache.forEach(function (t) {
            var sel = currentVal && t.id === currentVal ? 'selected' : '';
            $select.append('<option value="' + t.id + '" ' + sel + '>' + t.name + '</option>');
        });
    }

    /* =========================================================
       DOCUMENT DETAIL
    ========================================================= */
    function loadDocumentDetail() {
        $.ajax({
            url: '/FileManager/Storage/GetDocumentDetail/' + DOC_ID,
            type: 'GET',
            success: function (response) {
                if (response.isSuccess && response.data) {
                    currentDocData = response.data;
                    populateMetadataForm(response.data);
                    applyPermissions(response.data.myPermission || {});
                    loadPreview();
                } else {
                    toastr.error(response.message || 'Không thể tải thông tin tài liệu');
                    showViewerError(response.message || 'Không thể tải tài liệu');
                }
            },
            error: function () {
                toastr.error('Lỗi kết nối khi tải thông tin tài liệu');
                showViewerError('Lỗi kết nối');
            }
        });
    }
    
    /* =========================================================
       APPLY PERMISSIONS - Hide/show buttons based on node-level permissions
       Fallback to allowing actions if no permission data (for backward compatibility)
    ========================================================= */
    function applyPermissions(perm) {
        // Check if permission data exists
        const hasPermissionData = perm && perm.canView !== undefined;
        
        let canEdit, canDelete, canDownload, canUpload;
        
        if (hasPermissionData) {
            // Use node-level permission
            canEdit = perm.canEdit === true || perm.isSuperAdmin === true;
            canDelete = perm.canDelete === true || perm.isSuperAdmin === true;
            canDownload = perm.canDownload === true || perm.isSuperAdmin === true;
            canUpload = perm.canUpload === true || perm.isSuperAdmin === true; // For replace file
        } else {
            // Fallback from hidden field if no direct permission object
            canEdit = $('#canEditPermission').val() === 'true';
            canDelete = true;
            canDownload = true;
            canUpload = true;
        }
        
        // Update global CAN_DOWNLOAD flag
        CAN_DOWNLOAD = canDownload;
        
        // Hide/show action buttons
        if (!canEdit) {
            $('#btnEditMetadata, #btnSaveDoc, #btnReplaceFile').hide();
            // Metadata fields are disabled by default in HTML
        }
        
        if (!canUpload) {
            $('#btnReplaceFile').hide();
        }
        
        // ... (canDelete/canDownload logic remains same)
    }

    function populateMetadataForm(data) {
        isPopulating = true;
        $('#docTitle').text(data.name || data.documentTitle || 'Tài liệu');
        $('#metaDocCode').val(data.documentCode || data.maTaiLieu || '');
        $('#metaDocName').val(data.name || data.tieuDeTaiLieu || '');
        $('#metaDocDescription').val(data.description || data.moTaTaiLieu || '');
        
        // Handle new date fields
        if (data.ngayBanHanh) {
            $('#metaNgayBanHanh').val(data.ngayBanHanh.split('T')[0]);
        } else {
            $('#metaNgayBanHanh').val('');
        }
        
        if (data.ngayHetHan) {
            $('#metaNgayHetHan').val(data.ngayHetHan.split('T')[0]);
        } else {
            $('#metaNgayHetHan').val('');
        }

        // Điền Doanh nghiệp và Dự án
        if (data.enterpriseId) {
            // Cần add option thủ công vì Select2 dùng AJAX
            var enterpriseOption = new Option(data.enterpriseName || '---', data.enterpriseId, true, true);
            $(enterpriseOption).data('tax-code', data.enterpriseTaxCode || '');
            
            $('#metaEnterprise').append(enterpriseOption);
            
            // Điền trực tiếp mã số thuế nếu có
            if (data.enterpriseTaxCode) {
                $('#metaTaxCode').val(data.enterpriseTaxCode);
            }

            if (data.investmentProjectId) {
                loadProjects(data.enterpriseId, data.investmentProjectId);
            } else {
                loadProjects(data.enterpriseId);
            }
            
            // Trigger change AFTER setting up everything to avoid race conditions with projects
            $('#metaEnterprise').trigger('change');
        } else {
            $('#metaEnterprise').val(null).trigger('change');
            $('#metaProject').val(null).trigger('change');
            $('#metaTaxCode').val('');
            isPopulating = false; // Reset if nothing to load
        }

        // Check if we need to auto-enable edit mode
        if ($('#viewMode').val() === 'edit') {
            enableEditMode();
        }

        // Cập nhật icon header dựa trên extension
        const extension = data.fileExtension || getExtension(data.name || '');
        const iconClass = getFileIcon(extension);
        $('#docHeaderIcon').attr('class', iconClass).css('color', '#fff'); // Giữ màu trắng cho header dark

        var docTypeId = data.documentTypeId || data.idDocumentType || null;

        // Load trường động ngay lập tức (không phụ thuộc type cache)
        if (docTypeId) {
            loadDynamicFields(docTypeId, data.metaValue);
        }

        // Điền dropdown loại tài liệu (chờ cache nếu chưa xong)
        if (documentTypesCache.length > 0) {
            populateTypeDropdown($('#metaDocType'), docTypeId);
        } else {
            var retries = 0;
            var interval = setInterval(function () {
                retries++;
                if (documentTypesCache.length > 0 || retries > 20) {
                    clearInterval(interval);
                    populateTypeDropdown($('#metaDocType'), docTypeId);
                }
            }, 200);
        }

        // Issue 2: Store original data to detect changes later
        ORIGINAL_DATA = {
            name: data.name || '',
            documentCode: data.documentCode || '',
            description: data.description || '',
            ngayBanHanh: data.ngayBanHanh ? data.ngayBanHanh.split('T')[0] : '',
            ngayHetHan: data.ngayHetHan ? data.ngayHetHan.split('T')[0] : '',
            documentTypeId: docTypeId || null,
            enterpriseId: data.enterpriseId || null,
            enterpriseName: data.enterpriseName || '',
            enterpriseTaxCode: data.enterpriseTaxCode || '',
            investmentProjectId: data.investmentProjectId || null,
            investmentProjectName: data.investmentProjectName || '',
            originalLicenseNumber: data.originalLicenseNumber || '',
            metaValue: data.metaValue ? JSON.parse(JSON.stringify(data.metaValue)) : {}
        };
        
        isPopulating = false;
    }

    /* =========================================================
       FILE PREVIEW - Embedded viewer for DocumentView page
       - PDF/images  → stream qua /Preview/{id} (tránh CORS với MinIO URL)
       - Office docs → Google/Microsoft viewer dùng signed URL
    ========================================================= */
    function loadPreview() {
        $('#viewerLoading').show();
        $('#viewerError').hide();
        $('#fileViewerFrame').hide();
        $('#fileViewerImage').hide();

        // Lấy fileName + signed URL để xác định loại file
        // Add cache-bust to force fresh file info after replacement
        $.ajax({
            url: '/FileManager/Storage/View/' + DOC_ID + '?t=' + Date.now(),
            type: 'GET',
            success: function (response) {
                $('#viewerLoading').hide();
                if (!response.isSuccess || !response.downloadUrl) {
                    showViewerError(response.message || 'Không lấy được thông tin file');
                    return;
                }

                var signedUrl = response.downloadUrl;
                var fileName = response.fileName || '';
                $('#viewerFileName').text(fileName);

                var ext = getExtension(fileName);

                if (ext === '.pdf') {
                    // Stream qua ASP.NET Core tránh X-Frame-Options của MinIO
                    var previewUrl = '/FileManager/Storage/Preview/' + DOC_ID + '?t=' + Date.now();
                    
                    // Nếu không có quyền download, ẩn thanh công cụ của trình duyệt PDF
                    if (!CAN_DOWNLOAD) {
                        previewUrl += '#toolbar=0&navpanes=0&scrollbar=1';
                    }

                    $('#fileViewerFrame')
                        .attr('src', previewUrl)
                        .show();
                } else if (IMAGE_EXTS.indexOf(ext) >= 0) {
                    $('#fileViewerImage')
                        .attr('src', '/FileManager/Storage/Preview/' + DOC_ID + '?t=' + Date.now())
                        .show();
                } else {
                    // File không hỗ trợ xem trực tiếp hoặc là Office (không đáng tin cậy khi xem qua domain live.com)
                    // Hiển thị thông báo với nút download theo yêu cầu người dùng
                    var label = ext ? ext.toUpperCase().replace('.', '') : 'này';
                    showViewerError('Định dạng file ' + label + ' không được hỗ trợ để xem trực tiếp trên trình duyệt.', true, fileName);
                }
            },
            error: function () {
                $('#viewerLoading').hide();
                showViewerError('Lỗi kết nối khi tải file');
            }
        });
    }

    function showViewerError(msg, canDownload, fileName) {
        $('#viewerLoading').hide();
        $('#fileViewerFrame').hide();
        $('#fileViewerImage').hide();
        $('#viewerErrorMsg').text(msg || 'Không thể xem file này');
        
        // Hiển thị nút download nếu có quyền và được yêu cầu
        if (canDownload && CAN_DOWNLOAD) {
            $('#btnDownloadFromViewer')
                .off('click')
                .on('click', function() {
                    window.location.href = '/FileManager/Storage/Download/' + DOC_ID;
                    toastr.success('Đang chuẩn bị tải file: ' + (fileName || 'tài liệu'));
                })
                .show();
        } else {
            $('#btnDownloadFromViewer').hide();
        }
        
        $('#viewerError').css('display', 'flex');
    }

    /* =========================================================
       DYNAMIC METADATA FIELDS
    ========================================================= */
    function loadDynamicFields(documentTypeId, existingMetaValue) {
        $.ajax({
            url: '/FileManager/Storage/GetDocumentMetadataFields',
            type: 'GET',
            data: { documentTypeId: documentTypeId },
            success: function (fields) {
                renderDynamicFields(fields, existingMetaValue);
            },
            error: function () {
                $('#dynamicSection').hide();
            }
        });
    }

    function parseMetaValues(raw) {
        if (!raw) return {};
        if (typeof raw === 'string') { try { return JSON.parse(raw); } catch (e) { return {}; } }
        return raw;
    }

    function renderDynamicFields(fields, existingMetaValue) {
        var container = $('#dynamicFieldsContainer');
        container.empty();

        if (!fields || fields.length === 0) {
            $('#dynamicSection').hide();
            return;
        }

        var metaValues = parseMetaValues(existingMetaValue);
        var html = '';
        var fieldsNeedDynOpts = []; // {fieldName, dataType, selectOptions, listOptions, currentVal}

        fields.forEach(function (field) {
            var fieldName    = field.fieldName    || field.FieldName    || '';
            var displayName  = field.displayName  || field.DisplayLabel || field.displayLabel ||
                               field.FieldLabel   || field.fieldLabel   || fieldName;
            var dataType     = (field.dataType || field.DataType || field.fieldType || field.FieldType || 'text').toLowerCase();
            var isRequired   = field.isRequired   || field.IsRequired   || false;
            var placeholder  = field.placeholder  || field.Placeholder  || '';
            var maxLength    = field.maxLength     || field.MaxLength    || 500;
            var minLength    = field.minLength     || field.MinLength    || '';
            var minVal       = field.minValue !== undefined && field.minValue !== null ? field.minValue : (field.MinValue !== undefined && field.MinValue !== null ? field.MinValue : '');
            var maxVal       = field.maxValue !== undefined && field.maxValue !== null ? field.maxValue : (field.MaxValue !== undefined && field.MaxValue !== null ? field.MaxValue : '');
            var selectOpts   = field.selectOptions || field.SelectOptions;
            var listOpts     = field.listOptions   || field.ListOptions;
            var val          = metaValues[fieldName] !== undefined ? metaValues[fieldName] : '';
            
            // Parse multi-select values (array or comma-separated string)
            if (dataType === 'multiselect' && val) {
                if (typeof val === 'string' && val.indexOf(',') >= 0) {
                    val = val.split(',').map(function(v) { return v.trim(); });
                } else if (!Array.isArray(val)) {
                    val = [val];
                }
            }

            if (!fieldName) return;

            var req     = isRequired ? ' <span class="text-danger">*</span>' : '';
            var reqAttr = isRequired ? ' required' : '';

            html += '<div class="form-group">';

            if (dataType === 'boolean') {
                var chk = (val === 'true' || val === true) ? ' checked' : '';
                html += '<div class="custom-control custom-switch mt-2">' +
                    '<input type="checkbox" class="custom-control-input metadata-field"' +
                    ' id="df_' + escHtml(fieldName) + '" data-field-name="' + escHtml(fieldName) + '"' + chk + '>' +
                    '<label class="custom-control-label" for="df_' + escHtml(fieldName) + '">' + escHtml(displayName) + req + '</label>' +
                    '</div>';
            } else {
                html += '<label>' + escHtml(displayName) + req + '</label>';

                if (['select', 'multiselect', 'departments', 'warehouses', 'shelves', 'racks', 'boxes'].indexOf(dataType) >= 0) {
                    var multiAttr = (dataType === 'multiselect') ? ' multiple' : '';
                    html += '<select class="select-figma metadata-field" id="df_' + escHtml(fieldName) +
                        '" data-field-name="' + escHtml(fieldName) + '" style="width:100%;"' + reqAttr + multiAttr + '>' +
                        '<option value="">-- Chọn ' + escHtml(displayName) + ' --</option>';

                    // Thêm static options nếu có
                    var staticAdded = false;
                    if (selectOpts) {
                        try {
                            var opts = typeof selectOpts === 'string' ? JSON.parse(selectOpts) : selectOpts;
                            if (Array.isArray(opts)) {
                                opts.forEach(function (o) {
                                    var v = o.value || o.Value || o;
                                    var t = o.text || o.Text || o.label || o.Label || v;
                                    var s = '';
                                    // Check if value is selected (handle array for multiselect)
                                    if (dataType === 'multiselect' && Array.isArray(val)) {
                                        s = val.indexOf(String(v)) >= 0 ? ' selected' : '';
                                    } else {
                                        s = String(val) === String(v) ? ' selected' : '';
                                    }
                                    html += '<option value="' + escHtml(v) + '"' + s + '>' + escHtml(t) + '</option>';
                                });
                                staticAdded = true;
                            }
                        } catch (e) { /* không phải array JSON → dynamic */ }
                    }

                    html += '</select>';

                    // Queue dynamic loading nếu chưa có static opts
                    if (!staticAdded) {
                        fieldsNeedDynOpts.push({ fieldName: fieldName, dataType: dataType,
                            selectOptions: selectOpts, listOptions: listOpts, currentVal: val });
                    }

                } else if (dataType === 'textarea') {
                    html += '<textarea class="textarea-figma metadata-field" id="df_' + escHtml(fieldName) +
                        '" data-field-name="' + escHtml(fieldName) + '" rows="2" style="min-height:60px;"' +
                        reqAttr + '>' + escHtml(val) + '</textarea>';

                } else if (dataType === 'number' || dataType === 'integer') {
                    var isDecimal = dataType === 'number';
                    var formatClass = isDecimal ? 'format-decimal' : 'format-integer';
                    var minAttr = minVal !== '' ? ' data-min="' + minVal + '"' : '';
                    var maxAttr = maxVal !== '' ? ' data-max="' + maxVal + '"' : '';
                    var minLenAttrValue = minLength !== '' ? ' minlength="' + minLength + '"' : '';
                    var disNum = $('#btnEditMetadata').is(':visible') ? ' disabled' : '';
                    html += '<input type="text" class="input-figma metadata-field ' + formatClass + '" id="df_' + escHtml(fieldName) +
                        '" data-field-name="' + escHtml(fieldName) + '" value="' + escHtml(val) + '"' +
                        ' maxlength="' + maxLength + '"' + minLenAttrValue + reqAttr + minAttr + maxAttr + disNum + '>';

                } else if (dataType === 'date' || dataType === 'datetime') {
                    var disDate = $('#btnEditMetadata').is(':visible') ? ' disabled' : '';
                    html += '<input type="date" class="input-figma metadata-field" id="df_' + escHtml(fieldName) +
                        '" data-field-name="' + escHtml(fieldName) + '" value="' + escHtml(val) + '"' + reqAttr + disDate + '>';

                } else {
                    var dis = $('#btnEditMetadata').is(':visible') ? ' disabled' : '';
                    var minLenAttr = minLength !== '' ? ' minlength="' + minLength + '"' : '';
                    html += '<input type="text" class="input-figma metadata-field" id="df_' + escHtml(fieldName) +
                        '" data-field-name="' + escHtml(fieldName) + '" value="' + escHtml(val) + '"' +
                        ' placeholder="' + escHtml(placeholder) + '" maxlength="' + maxLength + '"' + minLenAttr + reqAttr + dis + '>';
                }
            }

            html += '</div>';
        });

        container.html(html);
        $('#dynamicSection').show();

        // Initialize Select2 for all select fields (especially multi-select)
        setTimeout(function() {
            $('.metadata-field.select-figma').each(function() {
                $(this).select2({
                    placeholder: '-- Chọn --',
                    allowClear: true,
                    width: '100%',
                    dropdownParent: $('#dynamicFieldsContainer') // fix dropdown being detatched sometimes
                });
            });
            // Update formatting for populated fields
            $('.format-decimal, .format-integer').each(function() {
                window.formatNumberInput(this, $(this).hasClass('format-decimal'));
            });
        }, 100);

        // Nạp options động cho các dropdown cần thiết
        fieldsNeedDynOpts.forEach(function (f) {
            loadDynamicOptions(
                $('#df_' + f.fieldName), f.dataType,
                f.selectOptions, f.listOptions, f.currentVal
            );
        });
    }

    /* =========================================================
       DYNAMIC OPTIONS LOADER (CategoryType / MasterData)
       Tham khảo loadDynamicMetadataOptions trong storage-management.js
    ========================================================= */
    function loadDynamicOptions($select, dataType, selectOptions, listOptions, currentVal) {
        var config = {};
        var rawConfig = listOptions || selectOptions;

        if (rawConfig) {
            try {
                config = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;
            } catch (e) {
                if (typeof rawConfig === 'string' && rawConfig.trim() && rawConfig !== 'null') {
                    var raw = rawConfig.trim();
                    if (raw.indexOf('-') >= 0 && raw.length > 30) {
                        config = { CategoryTypeId: raw };
                    } else {
                        config = { CategoryCode: raw };
                    }
                }
            }
        }

        var categoryCode   = config.CategoryCode   || config.categoryCode;
        var categoryTypeId = config.CategoryTypeId || config.categoryTypeId;
        var endpoint       = config.MasterDataEndpoint || config.endpoint || config.url;

        if (!endpoint && !categoryCode && !categoryTypeId) {
            switch (dataType) {
                case 'departments': endpoint = '/Departments/GetAll'; break;
                case 'warehouses':  endpoint = '/Warehouses/GetAll';  break;
                case 'shelves':     endpoint = '/Shelves/GetAll';     break;
                case 'racks':       endpoint = '/Racks/GetAll';       break;
                case 'boxes':       endpoint = '/Boxes/GetAll';       break;
            }
        }

        var url = null;
        if (categoryCode) {
            url = '/CategoryType/GetByTypeCode?typeCode=' + encodeURIComponent(categoryCode);
        } else if (categoryTypeId) {
            url = '/CategoryType/GetCategories?categoryTypeId=' + encodeURIComponent(categoryTypeId);
        } else if (endpoint) {
            url = endpoint.charAt(0) === '/' ? endpoint : '/api/v1/masterdata/' + endpoint;
        }

        if (!url) return;

        $.ajax({
            url: url,
            type: 'GET',
            success: function (response) {
                var items = Array.isArray(response) ? response :
                    (response.data ? (Array.isArray(response.data) ? response.data :
                        (response.data.items || [])) : []);
                items.forEach(function (item) {
                    var v = item.code || item.Code || item.id || item.Id || item;
                    var t = item.name || item.Name || v;
                    var s = currentVal && String(currentVal) === String(v) ? ' selected' : '';
                    $select.append('<option value="' + escHtml(v) + '"' + s + '>' + escHtml(t) + '</option>');
                });
            },
            error: function () {
                console.warn('[document-view] Failed to load dynamic options for', $select.attr('id'));
            }
        });
    }

    /* =========================================================
       VERSION HISTORY (Modal)
    ========================================================= */
    $('#btnShowHistory').on('click', function () {
        $('#historyModal').modal('show');
        loadVersionHistory(false); // Load và hiển thị vào modal
    });

    function loadVersionHistory(onlyBadge) {
        var $list = $('#modalVersionHistoryList');
        if (!onlyBadge) {
            $list.html('<li class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải lịch sử phiên bản...</li>');
        }

        $.ajax({
            url: '/FileManager/Storage/GetVersionHistory/' + DOC_ID,
            type: 'GET',
            success: function (response) {
                if (!response.isSuccess || !response.data || response.data.length === 0) {
                    if (!onlyBadge) {
                        $list.html('<li class="text-center py-4 text-muted">Chưa có phiên bản nào</li>');
                    }
                    $('#versionBadge').text('v1');
                    return;
                }

                var versions = response.data;
                // Cập nhật badge ở header (phiên bản cao nhất)
                var maxVer = 1;
                versions.forEach(function (v) {
                    var vn = v.versionNumber !== undefined ? v.versionNumber : (v.VersionNumber || 1);
                    if (vn > maxVer) maxVer = vn;
                });
                $('#versionBadge').text('v' + maxVer);

                if (onlyBadge) return;

                // Hiển thị vào modal
                $list.empty();
                // Sắp xếp phiên bản mới nhất lên đầu
                versions.sort(function(a, b) {
                    var va = a.versionNumber !== undefined ? a.versionNumber : (a.VersionNumber || 0);
                    var vb = b.versionNumber !== undefined ? b.versionNumber : (b.VersionNumber || 0);
                    return vb - va;
                });

                versions.forEach(function (v) {
                    var vn = v.versionNumber !== undefined ? v.versionNumber : (v.VersionNumber || 1);
                    var note = v.changeNote || v.ChangeNote || 'Không có ghi chú thay đổi';
                    var createdAt = v.createdAt || v.CreatedAt || '';
                    var createdBy = v.createdBy || v.CreatedBy || '';
                    var dateStr = createdAt ? new Date(createdAt).toLocaleDateString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    }) : '';

                    $list.append(
                        '<li style="display:flex; align-items:flex-start; gap:12px; padding:12px; border-bottom:1px solid #e2e8f0; background:#fff; margin-bottom:8px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">' +
                        '<span style="background:#eff6ff; color:#1e40af; font-size:11px; font-weight:700; padding:2px 8px; border-radius:12px; white-space:nowrap;">v' + vn + '</span>' +
                        '<div style="min-width:0; flex:1;">' +
                        '<div style="font-size:13px; color:#1e293b; font-weight:500; margin-bottom:4px;">' + escHtml(note) + '</div>' +
                        '<div style="font-size:11px; color:#64748b;">' +
                        '<i class="far fa-clock mr-1"></i>' + (dateStr ? escHtml(dateStr) : '---') +
                        '<span class="mx-2">|</span>' +
                        '<i class="far fa-user mr-1"></i>' + (createdBy ? escHtml(createdBy) : 'Hệ thống') +
                        '</div>' +
                        '</div>' +
                        '</li>'
                    );
                });
            },
            error: function () {
                if (!onlyBadge) {
                    $list.html('<li class="text-center py-4 text-danger">Lỗi tải lịch sử phiên bản</li>');
                }
            }
        });
    }

    /* =========================================================
       SAVE DOCUMENT
    ========================================================= */
    $('#btnSaveDoc').on('click', function () {
        console.log('[DocumentView] Save button clicked');
        
        var name = $('#metaDocName').val().trim();
        if (!name) {
            console.warn('[DocumentView] Validation failed: Name is empty');
            toastr.warning('Tên tài liệu không được để trống');
            return;
        }

        var metaValue = {};
        $('.metadata-field').each(function () {
            var field = $(this).data('field-name');
            if (!field) return;
            if ($(this).is(':checkbox')) {
                metaValue[field] = $(this).is(':checked') ? 'true' : 'false';
            } else {
                var v = $(this).val();
                
                // Collect formatting numbers properly
                if ($(this).hasClass('format-decimal') || $(this).hasClass('format-integer')) {
                    if (window.fileManagerMetadataCore && window.fileManagerMetadataCore.parseFormattedNumber) {
                        v = window.fileManagerMetadataCore.parseFormattedNumber(v);
                    } else {
                        // Fallback: remove commas manually
                        v = (v || '').toString().replace(/,/g, '');
                    }
                }

                // Handle multi-select: serialize array to comma-separated string
                if (Array.isArray(v)) {
                    metaValue[field] = v.join(',');
                } else if (v !== null && v !== undefined && v !== '') {
                    metaValue[field] = v;
                }
            }
        });

        var currentData = {
            name: name,
            documentCode: $('#metaDocCode').val().trim(),
            description: $('#metaDocDescription').val().trim(),
            ngayBanHanh: $('#metaNgayBanHanh').val() || null,
            ngayHetHan: $('#metaNgayHetHan').val() || null,
            documentTypeId: $('#metaDocType').val() || null,
            enterpriseId: $('#metaEnterprise').val() || null,
            investmentProjectId: $('#metaProject').val() || null,
            metaValue: metaValue
        };

        console.log('[DocumentView] Current data prepared:', currentData);
        
        // Validate dynamic metadata fields
        if (window.fileManagerMetadataCore) {
            console.log('[DocumentView] Validating dynamic metadata fields...');
            var isValid = window.fileManagerMetadataCore.validateMetadataFields('#dynamicFieldsContainer', '.metadata-field');
            if (!isValid) {
                console.warn('[DocumentView] Dynamic metadata validation failed');
                return;
            }
            console.log('[DocumentView] Dynamic metadata validation passed');
        } else {
            console.warn('[DocumentView] fileManagerMetadataCore not found, skipping dynamic validation');
        }

        // Detect if data actually changed (Issue 2: Only increment version on real changes)
        if (ORIGINAL_DATA && !hasDataChanged(ORIGINAL_DATA, currentData)) {
            console.log('[DocumentView] No data changed, skipping save');
            toastr.warning('Không có thay đổi nào để lưu', 'Thông báo', {
                timeOut: 3000,
                positionClass: 'toast-top-center'
            });
            return;
        }
        
        console.log('[DocumentView] Data has changed, proceeding with save...');

        var changeNote = getDetailedChangeNote(ORIGINAL_DATA, currentData);
        var payload = {
            id: DOC_ID,
            name: name,
            documentCode: currentData.documentCode,
            documentTypeId: currentData.documentTypeId,
            description: currentData.description,
            ngayBanHanh: currentData.ngayBanHanh,
            ngayHetHan: currentData.ngayHetHan,
            enterpriseId: currentData.enterpriseId,
            investmentProjectId: currentData.investmentProjectId,
            metaValue: metaValue,
            ChangeNote: changeNote // Đổi thành PascalCase cho đồng bộ với backend
        };

        console.log('[DocumentView] Saving document with changes:', changeNote);
        var $btn = $(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang lưu...');

        $.ajax({
            url: '/FileManager/Storage/UpdateDocument',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(payload),
            headers: { 'RequestVerificationToken': TOKEN },
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success('Đã lưu tài liệu');
                    $('#docTitle').text(name);
                    // Re-lock the form after saving
                    $('#btnSaveDoc, #btnReplaceFile').hide();
                    $('#btnEditMetadata').show();
                    $('.metadata-field').prop('disabled', true);
                    
                    // Cập nhật lại dữ liệu gốc
                    ORIGINAL_DATA = JSON.parse(JSON.stringify(currentData));
                    // Làm mới badge phiên bản
                    loadVersionHistory(true);
                } else {
                    // Hiển thị lỗi chi tiết từ backend
                    var errorMsg = response.message || 'Không thể lưu tài liệu';
                    console.error('[DocumentView] Save failed:', errorMsg);
                    
                    // Nếu có nhiều lỗi (phân cách bởi "; "), hiển thị từng lỗi
                    if (errorMsg.includes('; ')) {
                        var errors = errorMsg.split('; ');
                        var mainError = errors[0]; // Lỗi đầu tiên
                        
                        toastr.error(mainError, 'Lưu thất bại', {
                            timeOut: 8000,
                            positionClass: 'toast-top-center'
                        });
                        
                        // Hiển thị các lỗi còn lại
                        setTimeout(function() {
                            for (var i = 1; i < errors.length; i++) {
                                toastr.warning(errors[i], 'Chi tiết lỗi', {
                                    timeOut: 10000,
                                    positionClass: 'toast-top-center'
                                });
                            }
                        }, 500);
                    } else {
                        toastr.error(errorMsg, 'Lưu thất bại', {
                            timeOut: 8000,
                            positionClass: 'toast-top-center'
                        });
                    }
                }
            },
            error: function (xhr) {
                let errMsg = 'Lỗi kết nối khi lưu tài liệu';
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
                        console.error('[DocumentView] Error parsing response:', e);
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
                
                console.error('[DocumentView] Save failed:', xhr.status, errMsg, errorDetails);
            },
            complete: function () {
                $btn.prop('disabled', false).html('<i class="fas fa-save"></i> Lưu');
            }
        });
    });

    /* =========================================================
       REPLACE FILE
    ========================================================= */
    $('#btnReplaceFile').on('click', function () {
        $('#replaceFileInput').val('').trigger('click');
    });

    $('#replaceFileInput').on('change', function () {
        var file = this.files[0];
        if (!file) return;

        var userNote = prompt('Nhập ghi chú thay đổi (không bắt buộc):', 'Thay thế file: ' + file.name);
        if (userNote === null) {
            $(this).val('');
            return;
        }

        var formData = new FormData();
        formData.append('documentId', DOC_ID);
        formData.append('file', file);
        formData.append('changeNote', userNote || ('Thay thế file: ' + file.name));
        formData.append('__RequestVerificationToken', TOKEN);

        var $btn = $('#btnReplaceFile').prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>');

        $.ajax({
            url: '/FileManager/Storage/ReplaceFile',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success('Đã thay thế file thành công');
                    // Tải lại thông tin chi tiết và làm mới bản xem trước
                    loadDocumentDetail();
                    loadVersionHistory(true); // Cập nhật lại badge version
                } else {
                    toastr.error(response.message || 'Không thể thay thế file');
                }
            },
            error: function () {
                toastr.error('Lỗi kết nối khi thay thế file');
            },
            complete: function () {
                $btn.prop('disabled', false).html('<i class="fas fa-exchange-alt"></i> Thay file');
                $('#replaceFileInput').val('');
            }
        });
    });

    /* =========================================================
       DOCUMENT TYPE CHANGE
    ========================================================= */
    $('#metaDocType').on('change', function () {
        var selectedId = $(this).val();
        var existingMeta = currentDocData ? (currentDocData.metaValue || null) : null;

        if (selectedId) {
            loadDynamicFields(selectedId, existingMeta);
        } else {
            $('#dynamicSection').hide();
            $('#dynamicFieldsContainer').empty();
        }
    });

    /* =========================================================
       CLOSE
    ========================================================= */
    $('#btnCloseView').on('click', function () {
        window.close();
    });

    /* =========================================================
       UTILITIES
    ========================================================= */
    function getExtension(fileName) {
        if (!fileName) return '';
        var parts = fileName.split('.');
        return parts.length > 1 ? '.' + parts.pop().toLowerCase() : '';
    }

    function getFileIcon(ext) {
        if (ext && !ext.startsWith('.')) ext = '.' + ext;
        ext = (ext || '').toLowerCase();

        switch (ext) {
            case '.pdf': return 'fas fa-file-pdf';
            case '.doc':
            case '.docx': return 'fas fa-file-word';
            case '.xls':
            case '.xlsx': return 'fas fa-file-excel';
            case '.ppt':
            case '.pptx': return 'fas fa-file-powerpoint';
            case '.zip':
            case '.rar':
            case '.7z': return 'fas fa-file-archive';
            case '.jpg':
            case '.jpeg':
            case '.png':
            case '.gif': return 'fas fa-file-image';
            case '.txt': return 'fas fa-file-alt';
            default: return 'fas fa-file-alt';
        }
    }

    // Issue 2: Compare data to detect changes before saving
    function hasDataChanged(original, current) {
        if (!original) return true;

        // Compare simple fields
        if ((original.name || '').trim() !== (current.name || '').trim()) return true;
        if ((original.documentCode || '').trim() !== (current.documentCode || '').trim()) return true;
        if ((original.description || '').trim() !== (current.description || '').trim()) return true;
        
        // Normalize date comparison (only compare YYYY-MM-DD string part)
        const d1 = (original.ngayBanHanh || '').split('T')[0];
        const d2 = (current.ngayBanHanh || '').split('T')[0];
        if (d1 !== d2) return true;

        const e1 = (original.ngayHetHan || '').split('T')[0];
        const e2 = (current.ngayHetHan || '').split('T')[0];
        if (e1 !== e2) return true;

        if (original.documentTypeId !== current.documentTypeId) return true;
        
        // New: compare Enterprise and Project
        if (original.enterpriseId !== current.enterpriseId) return true;
        if (original.investmentProjectId !== current.investmentProjectId) return true;

        // Deep compare metaValue objects
        var origMeta = original.metaValue || {};
        var currMeta = current.metaValue || {};

        var allKeys = [...new Set([...Object.keys(origMeta), ...Object.keys(currMeta)])];
        for (var key of allKeys) {
            var v1 = (origMeta[key] === null || origMeta[key] === undefined ? '' : String(origMeta[key])).trim();
            var v2 = (currMeta[key] === null || currMeta[key] === undefined ? '' : String(currMeta[key])).trim();
            if (v1 !== v2) return true;
        }

        return false;
    }

    // Issue 3: Check download permission and hide button accordingly
    function checkDownloadPermission() {
        $.ajax({
            url: '/FileManager/Storage/CheckPermission',
            type: 'GET',
            data: { docId: DOC_ID, permission: 'Download' },
            success: function (response) {
                CAN_DOWNLOAD = response.hasPermission === true;
                
                if (!CAN_DOWNLOAD) {
                    $('#btnDownloadFromViewer').hide();
                    // Ẩn tất cả các nút tải xuống trong header nếu có
                    $('.btn-hdr:contains("Tải về")').hide();
                    
                    // Nếu đã load preview rồi thì reload lại để áp dụng #toolbar=0
                    var $iframe = $('#fileViewerFrame');
                    if ($iframe.attr('src') && $iframe.attr('src').indexOf('Preview') >= 0 && $iframe.attr('src').indexOf('#toolbar=0') < 0) {
                        $iframe.attr('src', $iframe.attr('src') + '#toolbar=0&navpanes=0&scrollbar=1');
                    }
                }
            },
            error: function () {
                CAN_DOWNLOAD = false;
                $('#btnDownloadFromViewer').hide();
            }
        });
    }

    function getDetailedChangeNote(original, current) {
        if (!original) return 'Cập nhật thông tin tài liệu';
        var changes = [];

        var oldName = (original.name || '').trim();
        var newName = (current.name || '').trim();
        if (oldName !== newName) changes.push('Sửa Tên');

        var oldCode = (original.documentCode || '').trim();
        var newCode = (current.documentCode || '').trim();
        if (oldCode !== newCode) changes.push('Sửa Mã tài liệu');

        var oldDesc = (original.description || '').trim();
        var newDesc = (current.description || '').trim();
        if (oldDesc !== newDesc) changes.push('Sửa Mô tả');

        if (original.documentTypeId !== current.documentTypeId) changes.push('Sửa Loại tài liệu');
        
        const d1 = (original.ngayBanHanh || '').split('T')[0];
        const d2 = (current.ngayBanHanh || '').split('T')[0];
        if (d1 !== d2) changes.push('Sửa Ngày ban hành');

        const e1 = (original.ngayHetHan || '').split('T')[0];
        const e2 = (current.ngayHetHan || '').split('T')[0];
        if (e1 !== e2) changes.push('Sửa Ngày hết hạn');

        if (original.enterpriseId !== current.enterpriseId) changes.push('Sửa Doanh nghiệp');
        if (original.investmentProjectId !== current.investmentProjectId) changes.push('Sửa Dự án');

        var origMeta = original.metaValue || {};
        var currMeta = current.metaValue || {};
        var changedFields = [];

        // So sánh metaValue
        var allKeys = Object.keys({...origMeta, ...currMeta});
        var uniqueKeys = [...new Set(allKeys)];
        
        uniqueKeys.forEach(function(key) {
            var oldV = String(origMeta[key] === null || origMeta[key] === undefined ? '' : origMeta[key]).trim();
            var newV = String(currMeta[key] === null || currMeta[key] === undefined ? '' : currMeta[key]).trim();
            
            if (oldV !== newV) {
                // Thử lấy label cho đẹp nếu có thể (tùy theo frontend render)
                var label = $('label[for="df_' + key + '"]').text().replace('*', '').trim() || 
                            $('.metadata-field[data-field-name="' + key + '"]').closest('.form-group').find('label').text().replace('*', '').trim() || 
                            key;
                changedFields.push(label);
            }
        });

        if (changedFields.length > 0) {
            changes.push('Cập nhật Metadata: [' + changedFields.join(', ') + ']');
        }

        var finalNote = changes.length > 0 ? changes.join('; ') : 'Cập nhật thông tin tài liệu';
        return finalNote;
    }

    function escHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Issue 3: Security - Setup protection against unauthorized downloads
    function setupSecurityProtection() {
        // Disable right-click on preview area
        $(document).on('contextmenu', '#fileViewerFrame, #fileViewerImage, #viewerContent', function(e) {
            e.preventDefault();
            toastr.warning('Chức năng này đã được vô hiệu hóa để bảo vệ tài liệu');
            return false;
        });

        // Disable text selection and drag on preview
        $('#fileViewerFrame, #fileViewerImage, #viewerContent').css({
            'user-select': 'none',
            '-webkit-user-select': 'none',
            '-moz-user-select': 'none',
            '-ms-user-select': 'none'
        });

        // Disable keyboard shortcuts for save/print
        $(document).on('keydown', function(e) {
            // Ctrl+S (Save)
            if (e.ctrlKey && e.keyCode === 83) {
                e.preventDefault();
                toastr.warning('Chức năng lưu tài liệu đã bị vô hiệu hóa');
                return false;
            }
            // Ctrl+P (Print)
            if (e.ctrlKey && e.keyCode === 80) {
                e.preventDefault();
                toastr.warning('Chức năng in tài liệu đã bị vô hiệu hóa');
                return false;
            }
        });
    }

    // Issue 3: Security - Disable right-click and text selection on viewer
    $(document).ready(function() {
        // This is now handled by setupSecurityProtection() called in main init
    });

}(jQuery));
