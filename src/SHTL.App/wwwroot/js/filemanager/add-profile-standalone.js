/**
 * add-profile-standalone.js - Standalone Profile Creation Logic with Tree Selection
 * Dedicated for /FileManager/Storage/Profiles page
 */

(function () {
    'use strict';

    const SELECT2_INIT_DELAY = 150;
    let isTreeLoaded = false;

    // ===== PUBLIC API =====

    window.openCreateProfileStandaloneModal = function (options) {
        options = options || {};
        
        // Reset Form
        const $form = $('#formCreateProfileStandalone');
        $form[0].reset();
        $('#standaloneProfileParentId').val('');
        $('#selectedFolderDisplay').html('<i class="fas fa-info-circle mr-1"></i>Chưa chọn vị trí');
        $('#standaloneDynamicMetadataFields').hide();
        $('#standaloneMetadataFieldsContainer').empty();

        // Load Dropdowns
        loadDropdowns();

        // Initialize Tree (only once or refresh)
        if (!isTreeLoaded) {
            initStandaloneTree();
            isTreeLoaded = true;
        } else {
            $('#standaloneStorageTree').jstree(true).refresh();
        }

        // Store callbacks
        $('#createProfileStandaloneModal').data('callbacks', options);
        $('#createProfileStandaloneModal').modal('show');
    };

    // ===== CORE LOGIC =====

    function initStandaloneTree() {
        $('#standaloneStorageTree').jstree({
            'core': {
                'data': function (node, callback) {
                    const parentId = node.id === '#' ? null : node.id;
                    const url = '/FileManager/Storage/GetNodes?parentId=' + (parentId || '');
                    
                    $.ajax({
                        url: url,
                        type: 'GET',
                        success: function (response) {
                            if (response.error) {
                                toastr.error(response.error);
                                callback([]);
                                return;
                            }
                            
                            const items = response.items || response.Items || [];
                            const nodes = items
                                .filter(item => {
                                    const type = (item.nodeType || item.NodeType || '').toUpperCase();
                                    // Theo yêu cầu: "không được hiện tài liệu"
                                    return type !== 'TAI_LIEU';
                                })
                                .map(item => {
                                    const type = (item.nodeType || item.NodeType || '').toUpperCase();
                                    return {
                                        id: item.id || item.Id,
                                        text: item.text || item.Name || item.name,
                                        icon: type === 'KHO' ? 'fas fa-warehouse text-primary' : 
                                              (type === 'THU_MUC' ? 'fas fa-folder text-warning' : 
                                              (type === 'HO_SO' ? 'fas fa-folder-open text-info' : 'fas fa-file text-muted')),
                                        children: type !== 'TAI_LIEU' && type !== 'HO_SO',
                                        data: {
                                            ...item,
                                            nodeType: type,
                                            myPermission: item.myPermission || item.MyPermission || {}
                                        }
                                    };
                                });
                            
                            callback(nodes);
                        },
                        error: function () {
                            toastr.error('Không thể tải cấu trúc thư mục.');
                            callback([]);
                        }
                    });
                },
                'check_callback': true,
                'multiple': false,
                'themes': { 'responsive': false, 'variant': 'small' }
            },
            'plugins': ['search', 'types', 'wholerow', 'conditionalselect'],
            'types': {
                'default': { 'icon': 'fas fa-folder text-warning' },
                'KHO': { 'icon': 'fas fa-warehouse text-primary' },
                'THU_MUC': { 'icon': 'fas fa-folder text-warning' },
                'HO_SO': { 'icon': 'fas fa-folder-open text-info' },
                'TAI_LIEU': { 'icon': 'fas fa-file-alt text-muted' }
            },
            'conditionalselect': function (node, event) {
                // Đã hiển thị trên cây tức là có quyền chọn (theo phản hồi người dùng)
                
                // Chỉ chọn KHO hoặc THU_MUC làm cha của HO_SO
                if (node.original.nodeType === 'HO_SO' || node.original.nodeType === 'TAI_LIEU') {
                    toastr.info('Vui lòng chọn Kho hoặc Thư mục.');
                    return false;
                }

                return true;
            }
        }).on('select_node.jstree', function (e, data) {
            const node = data.node;
            $('#standaloneProfileParentId').val(node.id);
            $('#selectedFolderDisplay').html(`<i class="fas fa-check-circle text-success mr-1"></i> Đã chọn: <strong>${node.text}</strong>`);
        }).on('loaded.jstree', function() {
            // Option to expand root
        });

        // Tree Search
        let to = false;
        $('#standaloneTreeSearch').keyup(function () {
            if (to) { clearTimeout(to); }
            to = setTimeout(function () {
                const v = $('#standaloneTreeSearch').val();
                $('#standaloneStorageTree').jstree(true).search(v);
            }, 250);
        });
    }

    function loadDropdowns() {
        // Reuse similar logic from add-profile-modal.js but adapted
        loadAjaxDropdown($('#standaloneProfileType'), '/FileManager/Storage/GetProfileTypes');
        loadAjaxDropdown($('#standaloneProfileEnterprise'), '/FileManager/Storage/GetEnterprises');
        loadAjaxDropdown($('#standaloneProfileDepartment'), '/FileManager/Storage/GetDepartments');

        setTimeout(() => {
            initSelect2($('#standaloneProfileType'));
            initSelect2($('#standaloneProfileEnterprise'));
            initSelect2($('#standaloneProfileDepartment'));
        }, SELECT2_INIT_DELAY);
    }

    function loadAjaxDropdown($dropdown, url) {
        $dropdown.empty().append('<option value="">-- Đang tải... --</option>');
        $.get(url, function (data) {
            $dropdown.empty().append(`<option value="">-- ${$dropdown.find('option:first').text() || 'Chọn'} --</option>`);
            if (Array.isArray(data)) {
                data.forEach(item => {
                    const id = item.id || item.Id;
                    const name = item.name || item.Name;
                    const code = item.code || item.Code;
                    const text = code ? `${code} - ${name}` : name;
                    $dropdown.append(`<option value="${id}">${text}</option>`);
                });
            }
        });
    }

    function initSelect2($el) {
        if ($el.length && typeof $el.select2 === 'function') {
            $el.select2({
                dropdownParent: $('#createProfileStandaloneModal'),
                width: '100%',
                placeholder: 'Chọn giá trị'
            });
        }
    }

    // Submit Logic
    $('#btnConfirmCreateProfileStandalone').on('click', function () {
        const $form = $('#formCreateProfileStandalone');
        
        // Validation
        const parentId = $('#standaloneProfileParentId').val();
        if (!parentId) {
            toastr.error('Vui lòng chọn vị trí lưu trữ (Kho/Thư mục) trên cây bên trái.');
            return;
        }

        if (!$('#standaloneProfileName').val()) {
            toastr.warning('Vui lòng nhập tên hồ sơ.'); 
            $('#standaloneProfileName').focus();
            return;
        }

        if (!$('#standaloneProfileType').val()) {
            toastr.warning('Vui lòng chọn loại hồ sơ.');
            return;
        }

        // Collect Data
        const data = {
            ParentId: parentId,
            Name: $('#standaloneProfileName').val(),
            ProfileTypeId: $('#standaloneProfileType').val(),
            ProfileCode: $('#standaloneProfileCode').val() || null,
            ProfileTitle: $('#standaloneProfileTitle').val() || $('#standaloneProfileName').val(),
            EnterpriseId: $('#standaloneProfileEnterprise').val() || null,
            DepartmentId: $('#standaloneProfileDepartment').val() || null,
            RetentionPeriod: $('#standaloneProfileRetention').val() ? parseInt($('#standaloneProfileRetention').val()) : null,
            StartDate: $('#standaloneProfileStartDate').val() || null,
            EndDate: $('#standaloneProfileEndDate').val() || null,
            TotalSheets: $('#standaloneProfileTotalSheets').val() ? parseInt($('#standaloneProfileTotalSheets').val()) : null,
            TotalPages: $('#standaloneProfileTotalPages').val() ? parseInt($('#standaloneProfileTotalPages').val()) : null,
            MetaValue: collectStandaloneMetadata()
        };

        const token = $('input[name="__RequestVerificationToken"]').val();

        // AJAX POST
        $.ajax({
            url: '/FileManager/Storage/CreateProfile',
            type: 'POST',
            contentType: 'application/json',
            headers: { 'RequestVerificationToken': token },
            data: JSON.stringify(data),
            success: function (res) {
                if (res.isSuccess) {
                    toastr.success(res.message || 'Tạo hồ sơ thành công.');
                    $('#createProfileStandaloneModal').modal('hide');
                    
                    const callbacks = $('#createProfileStandaloneModal').data('callbacks');
                    if (callbacks && typeof callbacks.onSuccess === 'function') {
                        callbacks.onSuccess(res);
                    } else {
                        // Default: reload list
                        if (typeof window.refreshProfilesList === 'function') window.refreshProfilesList();
                    }
                } else {
                    toastr.error(res.message || 'Lỗi khi tạo hồ sơ.');
                }
            },
            error: function (xhr) {
                console.error('Error creating profile:', xhr);
                let msg = 'Không thể kết nối với máy chủ.';
                if (xhr.status === 415) msg = 'Lỗi định dạng dữ liệu (Unsupported Media Type).';
                if (xhr.responseJSON && xhr.responseJSON.message) msg = xhr.responseJSON.message;
                toastr.error(msg, 'Lỗi hệ thống');
            }
        });
    });

    function collectStandaloneMetadata() {
        const meta = {};
        $('#standaloneMetadataFieldsContainer .metadata-field').each(function () {
            const name = $(this).data('field-name');
            let val = $(this).is(':checkbox') ? $(this).is(':checked') : $(this).val();
            if (val !== '' && val !== null && val !== undefined) {
                meta[name] = val;
            }
        });
        return meta;
    }

    // Dynamic Metadata Handler
    $(document).on('change', '#standaloneProfileType', function () {
        const typeId = $(this).val();
        if (!typeId) {
            $('#standaloneDynamicMetadataFields').hide();
            return;
        }

        $.get('/FileManager/Storage/GetProfileMetadataFields', { profileTypeId: typeId }, function (fields) {
            if (fields && fields.length > 0) {
                renderStandaloneMetadata(fields);
                $('#standaloneDynamicMetadataFields').show();
            } else {
                $('#standaloneDynamicMetadataFields').hide();
            }
        });
    });

    function renderStandaloneMetadata(fields) {
        let html = '';
        fields.forEach(f => {
            const name = f.fieldName || f.FieldName;
            const label = f.displayLabel || f.DisplayLabel || name;
            const type = (f.dataType || f.DataType || 'text').toLowerCase();
            const required = f.isRequired ? '<span class="text-danger">*</span>' : '';
            
            html += `<div class="col-md-6 mb-3">
                        <label class="demo-label-small">${label} ${required}</label>`;
            
            if (type === 'date') {
                html += `<input type="date" class="input-figma metadata-field" data-field-name="${name}" style="height: 38px; width: 100%;" onclick="this.showPicker()"/>`;
            } else if (type === 'number') {
                html += `<input type="number" class="input-figma metadata-field" data-field-name="${name}" style="height: 38px; width: 100%;" />`;
            } else {
                html += `<input type="text" class="input-figma metadata-field" data-field-name="${name}" style="height: 38px; width: 100%;" />`;
            }
            html += `</div>`;
        });
        $('#standaloneMetadataFieldsContainer').html(html);
    }

})();
