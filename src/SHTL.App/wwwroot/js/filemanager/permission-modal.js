/**
 * permission-modal.js
 * Shared permission modal logic for both Warehouses list and Storage management
 * Grid-based permission assignment for Users, Departments, and Groups
 */

$(document).ready(function () {
    // CSRF Token
    const token = $('input[name="__RequestVerificationToken"]').val();
    
    // Storage for selected subjects in grid
    let selectedSubjects = {
        users: {},      // { id: { name, permissions } }
        departments: {},
        groups: {}
    };
    
    // ===== PERMISSION MODAL - GRID-BASED DESIGN =====
    
    function openPermissionModal(nodeId, nodeName, nodeType) {
        nodeType = (nodeType || '').toUpperCase();
        
        $('#permissionNodeId').val(nodeId);
        $('#permissionNodeName').text(nodeName);
        $('#permissionNodeType').val(nodeType);
        
        // Cập nhật giao diện theo loại đối tượng
        if (nodeType === 'TAI_LIEU') {
            $('.modal-header-figma .modal-title').html(`<i class="fas fa-file-lock mr-2"></i>Phân quyền Tài liệu: <span id="permissionNodeName" style="font-weight: 400;">${nodeName}</span>`);
            $('.col-perm-create, #globalPerm_Upload').closest('.form-check').hide();
            $('.col-perm-create').hide();
            $('#permissionScopeSection').hide();
            $('#scopeCurrent').prop('checked', true);
        } else {
            const label = nodeType === 'HO_SO' ? 'Hồ sơ' : 'Thư mục';
            $('.modal-header-figma .modal-title').html(`<i class="fas fa-user-lock mr-2"></i>Phân quyền ${label}: <span id="permissionNodeName" style="font-weight: 400;">${nodeName}</span>`);
            $('.col-perm-create, #globalPerm_Upload').closest('.form-check').show();
            $('.col-perm-create').show();
            $('#permissionScopeSection').show();
            $('#scopeRecursive').prop('checked', true);
        }

        // Reset everything
        selectedSubjects = { users: {}, departments: {}, groups: {} };
        $('.global-perm-checkbox').prop('checked', false).prop('disabled', false);
        $('#globalPerm_FullControl').prop('checked', false);
        $('#bulkPermissionProgress').hide();
        
        // Clear grids
        $('#selectedUsersGrid, #selectedDepartmentsGrid, #selectedGroupsGrid').empty();
        
        
        // Load dropdown data and wait for all to complete
        $.when(
            loadPermissionUsersDropdown(),
            loadPermissionDepartmentsDropdown(),
            loadPermissionGroupsDropdown()
        ).always(function() {
            // Fetch existing permissions
            $.ajax({
                url: `/FileManager/Storage/GetPermissions/${nodeId}`,
                type: 'GET',
                success: function(data) {
                    if (data && Array.isArray(data)) {
                        data.forEach(item => {
                            const type = item.subjectType || item.SubjectType;
                            const subjectId = item.subjectId || item.SubjectId;
                            const bits = item.permissionBits || item.PermissionBits || 0;
                            
                            let formattedType = type;
                            if (type.toLowerCase() === 'user') formattedType = 'User';
                            else if (type.toLowerCase() === 'department') formattedType = 'Department';
                            else if (type.toLowerCase() === 'group') formattedType = 'Group';
                            else if (type.toLowerCase() === 'everyone') {
                                // Update global checkboxes for Everyone
                                const perms = parsePermissionBits(bits);
                                const isInherited = item.isInherited || item.IsInherited || false;
                                
                                $('#globalPerm_FullControl').prop('checked', perms.fullControl);
                                $('#globalPerm_View').prop('checked', perms.view);
                                $('#globalPerm_Edit').prop('checked', perms.edit);
                                $('#globalPerm_Delete').prop('checked', perms.delete);
                                $('#globalPerm_Upload').prop('checked', perms.upload);
                                $('#globalPerm_Download').prop('checked', perms.download);
                                $('#globalPerm_Share').prop('checked', perms.share);
                                
                                if (isInherited) {
                                    $('.global-perm-checkbox').prop('disabled', true);
                                    $('#everyoneInheritedLabel').show();
                                } else {
                                    $('#everyoneInheritedLabel').hide();
                                    if (perms.fullControl) {
                                        $('.global-perm-checkbox').not('#globalPerm_FullControl').prop('disabled', true);
                                    }
                                }
                                return; // Don't add to grids
                            }
                            
                            let dropdownSelector = '';
                            if (formattedType === 'User') dropdownSelector = '#permissionUsersDropdown';
                            else if (formattedType === 'Department') dropdownSelector = '#permissionDepartmentsDropdown';
                            else if (formattedType === 'Group') dropdownSelector = '#permissionGroupsDropdown';
                            
                            let subjectName = $(dropdownSelector).find(`option[value="${subjectId}"]`).text() || item.subjectName || item.SubjectName || subjectId;
                            if (subjectName.startsWith('--')) {
                                subjectName = item.subjectName || item.SubjectName || subjectId;
                            }
                            const storageKey = formattedType.toLowerCase() + 's';
                            const perms = parsePermissionBits(bits);
                            const shareId = item.id || item.Id; // The ID of the StgDocShare record
                            
                            const isInherited = item.isInherited || item.IsInherited || false;
                            
                            selectedSubjects[storageKey][subjectId] = { 
                                name: subjectName, 
                                permissions: perms,
                                shareId: shareId,
                                isInherited: isInherited
                            };
                            renderSubjectRow(formattedType, subjectId, subjectName, perms, shareId, isInherited);
                        });
                    }
                },
                error: function(xhr) {
                    console.error('❌ Error fetching permissions:', xhr);
                }
            });
        });
        
        $('#permissionModal').modal('show');
    }
    
    // Load Users vào dropdown
    function loadPermissionUsersDropdown() {
        const $dropdown = $('#permissionUsersDropdown');
        $dropdown.html('<option value="">-- Chọn người dùng --</option>');
        
        return $.ajax({
            url: '/Account/GetAllUsers',
            type: 'GET',
            success: function (data) {
                if (data && Array.isArray(data)) {
                    data.forEach(item => {
                        const id = item.Id || item.id;
                        const name = item.Name || item.name || item.FullName || item.fullName || item.UserName || item.userName;
                        $dropdown.append(`<option value="${id}">${name}</option>`);
                    });
                }
            },
            error: function (xhr) {
                console.error('❌ Error loading users:', xhr.status, xhr.statusText, xhr.responseText);
                toastr.error('Không thể tải danh sách người dùng');
            }
        });
    }
    
    // Load Departments vào dropdown
    function loadPermissionDepartmentsDropdown() {
        const $dropdown = $('#permissionDepartmentsDropdown');
        $dropdown.html('<option value="">-- Chọn phòng ban --</option>');
        
        return $.ajax({
            url: '/FileManager/Storage/GetDepartments',
            type: 'GET',
            success: function (data) {
                if (data && Array.isArray(data)) {
                    data.forEach(item => {
                        const id = item.Id || item.id;
                        const name = item.Name || item.name;
                        const code = item.Code || item.code;
                        $dropdown.append(`<option value="${id}">${code ? code + ' - ' : ''}${name}</option>`);
                    });
                }
            },
            error: function (xhr) {
                console.error('❌ Error loading departments:', xhr.status, xhr.statusText, xhr.responseText);
                toastr.error('Không thể tải danh sách phòng ban');
            }
        });
    }
    
    // Load Groups vào dropdown
    function loadPermissionGroupsDropdown() {
        const $dropdown = $('#permissionGroupsDropdown');
        $dropdown.html('<option value="">-- Chọn nhóm --</option>');
        
        return $.ajax({
            url: '/Account/GetAllGroups',
            type: 'GET',
            success: function (data) {
                if (data && Array.isArray(data)) {
                    data.forEach(item => {
                        const id = item.Id || item.id;
                        const name = item.Name || item.name;
                        $dropdown.append(`<option value="${id}">${name}</option>`);
                    });
                }
            },
            error: function (xhr) {
                console.error('❌ Error loading groups:', xhr.status, xhr.statusText, xhr.responseText);
                toastr.warning('Không thể tải danh sách nhóm');
            }
        });
    }
    
    // Get current template permissions from global checkboxes
    function getTemplatePermissions() {
        const permissions = {
            view: $('#globalPerm_View').is(':checked'),
            edit: $('#globalPerm_Edit').is(':checked'),
            delete: $('#globalPerm_Delete').is(':checked'),
            upload: $('#globalPerm_Upload').is(':checked'),
            download: $('#globalPerm_Download').is(':checked'),
            share: $('#globalPerm_Share').is(':checked'),
            copy: $('#globalPerm_Copy').is(':checked'),
            move: $('#globalPerm_Move').is(':checked'),
            fullControl: $('#globalPerm_FullControl').is(':checked')
        };
        return permissions;
    }
    
    // Calculate permission bits from permissions object
    function calculatePermissionBits(permissions) {
        let bits = 0;
        if (permissions.fullControl) return 127; // All permissions (1+2+4+8+16+32+64)
        
        // Logic: Nếu có bất kỳ quyền nào (Sửa, Xóa, Tạo, Tải, Chia sẻ) thì bắt buộc phải có quyền Xem (View)
        const hasAnyOtherPerm = permissions.edit || permissions.delete || permissions.upload || permissions.download || permissions.share;
        if (hasAnyOtherPerm) permissions.view = true;
        
        if (permissions.view) bits += 1;
        if (permissions.download) bits += 2;
        if (permissions.upload) bits += 4;
        if (permissions.edit) bits += 8;
        if (permissions.delete) bits += 16;
        if (permissions.share) bits += 32;
        return bits;
    }
    
    // Parse permission bits to object
    function parsePermissionBits(bits) {
        // bit 64 is FullControl in backend
        const isFullControl = (bits === 127) || ((bits & 64) > 0);
        if (isFullControl) {
            return {
                fullControl: true, view: true, download: true, upload: true,
                edit: true, delete: true, share: true, copy: false, move: false
            };
        }
        return {
            fullControl: false,
            view: (bits & 1) > 0,
            download: (bits & 2) > 0,
            upload: (bits & 4) > 0,
            edit: (bits & 8) > 0,
            delete: (bits & 16) > 0,
            share: (bits & 32) > 0,
            copy: false,
            move: false
        };
    }
    
    // Add subject to grid
    function addSubjectToGrid(type, id, name) {
        // Check if already exists
        const storageKey = type.toLowerCase() + 's'; // 'users', 'departments', 'groups'
        if (selectedSubjects[storageKey][id]) {
            toastr.info(`${name} đã có trong danh sách`);
            return;
        }
        
        // Get template permissions
        const permissions = getTemplatePermissions();
        
        // Store subject
        selectedSubjects[storageKey][id] = { name, permissions };
        
        // Render row
        renderSubjectRow(type, id, name, permissions);
    }
    
    // Render subject row in grid
    function renderSubjectRow(type, id, name, permissions, shareId = null, isInherited = false) {
        const storageKey = type.toLowerCase() + 's';
        const gridId = `selected${type}sGrid`;
        
        const rowHtml = `
            <div class="subject-row ${isInherited ? 'inherited-rule' : ''}" data-type="${type}" data-id="${id}" data-share-id="${shareId || ''}">
                <div class="col-subject">
                    ${name}
                    ${isInherited ? '<span class="badge badge-secondary ml-1" style="font-size: 10px;">Kế thừa</span>' : ''}
                </div>
                <div class="col-perm">
                    <div class="form-check-grid">
                        <input type="checkbox" class="row-perm-checkbox" data-type="${type}" data-id="${id}" data-perm="fullControl" ${permissions.fullControl ? 'checked' : ''} ${isInherited ? 'disabled' : ''} />
                    </div>
                </div>
                <div class="col-perm">
                    <div class="form-check-grid">
                        <input type="checkbox" class="row-perm-checkbox" data-type="${type}" data-id="${id}" data-perm="view" ${permissions.view ? 'checked' : ''} ${permissions.fullControl || isInherited ? 'disabled' : ''} />
                    </div>
                </div>
                <div class="col-perm">
                    <div class="form-check-grid">
                        <input type="checkbox" class="row-perm-checkbox" data-type="${type}" data-id="${id}" data-perm="edit" ${permissions.edit ? 'checked' : ''} ${permissions.fullControl || isInherited ? 'disabled' : ''} />
                    </div>
                </div>
                <div class="col-perm">
                    <div class="form-check-grid">
                        <input type="checkbox" class="row-perm-checkbox" data-type="${type}" data-id="${id}" data-perm="delete" ${permissions.delete ? 'checked' : ''} ${permissions.fullControl || isInherited ? 'disabled' : ''} />
                    </div>
                </div>
                <div class="col-perm col-perm-create">
                    <div class="form-check-grid">
                        <input type="checkbox" class="row-perm-checkbox" data-type="${type}" data-id="${id}" data-perm="upload" ${permissions.upload ? 'checked' : ''} ${permissions.fullControl || isInherited ? 'disabled' : ''} />
                    </div>
                </div>
                <div class="col-perm">
                    <div class="form-check-grid">
                        <input type="checkbox" class="row-perm-checkbox" data-type="${type}" data-id="${id}" data-perm="download" ${permissions.download ? 'checked' : ''} ${permissions.fullControl || isInherited ? 'disabled' : ''} />
                    </div>
                </div>
                <div class="col-perm">
                    <div class="form-check-grid">
                        <input type="checkbox" class="row-perm-checkbox" data-type="${type}" data-id="${id}" data-perm="share" ${permissions.share ? 'checked' : ''} ${permissions.fullControl || isInherited ? 'disabled' : ''} />
                    </div>
                </div>
                <!-- Hidden permissions -->
                <div style="display:none;">
                    <input type="checkbox" class="row-perm-checkbox" data-type="${type}" data-id="${id}" data-perm="copy" ${permissions.copy ? 'checked' : ''} ${isInherited ? 'disabled' : ''} />
                    <input type="checkbox" class="row-perm-checkbox" data-type="${type}" data-id="${id}" data-perm="move" ${permissions.move ? 'checked' : ''} ${isInherited ? 'disabled' : ''} />
                </div>
                <div class="col-action">
                    ${!isInherited ? `
                    <button type="button" class="btn-remove-subject" data-type="${type}" data-id="${id}" title="Xóa">
                        <i class="fas fa-trash-alt"></i>
                    </button>` : ''}
                </div>
            </div>
        `;
        
        $(`#${gridId}`).append(rowHtml);
        
        // Ẩn cột nếu là tài liệu
        const currentNodeType = $('#permissionNodeType').val();
        if (currentNodeType === 'TAI_LIEU') {
            $('.col-perm-create').hide();
        }
    }
    
    // ===== EVENT HANDLERS =====
    
    // Dropdown change - Add to grid
    $(document).on('change', '#permissionUsersDropdown', function () {
        const id = $(this).val();
        const name = $(this).find('option:selected').text();
        if (id && name && name !== '-- Chọn người dùng --') {
            addSubjectToGrid('User', id, name);
            $(this).val(''); // Reset dropdown
        }
    });
    
    $(document).on('change', '#permissionDepartmentsDropdown', function () {
        const id = $(this).val();
        const name = $(this).find('option:selected').text();
        if (id && name && name !== '-- Chọn phòng ban --') {
            addSubjectToGrid('Department', id, name);
            $(this).val('');
        }
    });
    
    $(document).on('change', '#permissionGroupsDropdown', function () {
        const id = $(this).val();
        const name = $(this).find('option:selected').text();
        if (id && name && name !== '-- Chọn nhóm --') {
            addSubjectToGrid('Group', id, name);
            $(this).val('');
        }
    });
    
    // Remove subject from grid - REFACTORED to support Revoke
    $(document).on('click', '.btn-remove-subject', function () {
        const $row = $(this).closest('.subject-row');
        const type = $row.data('type');
        const id = $row.data('id');
        const shareId = $row.data('share-id');
        const storageKey = type.toLowerCase() + 's';
        const subjectName = selectedSubjects[storageKey][id]?.name || "đối tượng này";
        
        const doRemoveLocal = () => {
            // Remove from storage
            delete selectedSubjects[storageKey][id];
            // Remove row from UI
            $row.fadeOut(300, function() { $(this).remove(); });
        };

        const nodeId = $('#permissionNodeId').val();

        if (shareId) {
            Swal.fire({
                title: 'Thu hồi quyền?',
                html: `Bạn có chắc muốn xóa quyền của <b>${subjectName}</b>?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#6e7881',
                confirmButtonText: 'Xác nhận xóa',
                cancelButtonText: 'Hủy',
                focusCancel: true,
                allowOutsideClick: false
            }).then((result) => {
                if (result.isConfirmed) {
                    $.ajax({
                        url: `/FileManager/Storage/RevokePermission/${nodeId}/${shareId}`,
                        type: 'DELETE',
                        headers: { 'RequestVerificationToken': token },
                        success: function(response) {
                            if (response.isSuccess) {
                                toastr.success(`Đã thu hồi quyền của ${subjectName}`);
                                doRemoveLocal();
                            } else {
                                toastr.error(response.message || 'Không thể thu hồi quyền');
                            }
                        },
                        error: function(xhr) {
                            console.error('Revoke error:', xhr);
                            toastr.error('Lỗi khi gọi API thu hồi quyền');
                        }
                    });
                }
            });
        } else {
            // New items (not saved yet) - just remove from UI
            doRemoveLocal();
        }
    });
    
    // Row permission checkbox change
    $(document).on('change', '.row-perm-checkbox', function () {
        const type = $(this).data('type');
        const id = $(this).data('id');
        const perm = $(this).data('perm');
        const checked = $(this).is(':checked');
        const storageKey = type.toLowerCase() + 's';
        const $row = $(this).closest('.subject-row');
        
        // Update storage
        if (selectedSubjects[storageKey][id]) {
            selectedSubjects[storageKey][id].permissions[perm] = checked;
            
            // Logic: Nếu tích bất kỳ quyền nào khác => Tự động tích Xem
            if (checked && perm !== 'view' && perm !== 'fullControl') {
                $row.find('.row-perm-checkbox[data-perm="view"]').prop('checked', true);
                selectedSubjects[storageKey][id].permissions['view'] = true;
            }
            
            // Logic: Nếu bỏ tích Xem => Bỏ tích tất cả các quyền khác (trừ FullControl)
            if (perm === 'view' && !checked) {
                $row.find('.row-perm-checkbox').not('[data-perm="view"]').prop('checked', false);
                Object.keys(selectedSubjects[storageKey][id].permissions).forEach(key => {
                    selectedSubjects[storageKey][id].permissions[key] = false;
                });
            }

            // Handle "Full Control" checkbox
            if (perm === 'fullControl' && checked) {
                // Check View and disable others
                $row.find('.row-perm-checkbox').not('[data-perm="fullControl"]').prop('checked', true).prop('disabled', true);
                // Update storage
                Object.keys(selectedSubjects[storageKey][id].permissions).forEach(key => {
                    selectedSubjects[storageKey][id].permissions[key] = true;
                });
            } else if (perm === 'fullControl' && !checked) {
                // Enable all others
                $row.find('.row-perm-checkbox').prop('disabled', false);
            }
        }
    });

    // Logic cho phần "Tất cả mọi người" (Global checkboxes)
    $(document).on('change', '.global-perm-checkbox', function() {
        const perm = $(this).attr('id').replace('globalPerm_', ''); // View, Edit, etc.
        const checked = $(this).is(':checked');
        
        if (checked && perm !== 'View' && perm !== 'FullControl') {
            $('#globalPerm_View').prop('checked', true);
        }
        
        if (perm === 'View' && !checked) {
            $('.global-perm-checkbox').not('#globalPerm_View').prop('checked', false);
        }

        if (perm === 'FullControl' && checked) {
            $('.global-perm-checkbox').not('#globalPerm_FullControl').prop('checked', true).prop('disabled', true);
        } else if (perm === 'FullControl' && !checked) {
            $('.global-perm-checkbox').prop('disabled', false);
        }
    });
    
    // Global "Tất cả" checkbox
    $(document).on('change', '#globalPerm_FullControl', function () {
        if ($(this).is(':checked')) {
            $('.global-perm-checkbox').not('#globalPerm_FullControl').prop('checked', false).prop('disabled', true);
        } else {
            $('.global-perm-checkbox').prop('disabled', false);
        }
    });
    
    // Save Permissions - Thu thập từ GRID
    // Support both button IDs: btnSavePermissions (Index.cshtml) and btnApplyPermissions (Profiles.cshtml)
    $(document).on('click', '#btnSavePermissions, #btnApplyPermissions', function () {
        const nodeId = $('#permissionNodeId').val();
        
        if (!nodeId) {
            toastr.error('Không xác định được node ID');
            return;
        }
        
        // Thu thập TẤT CẢ subjects từ grid
        const allSubjects = [];
        
        // Users
        Object.keys(selectedSubjects.users).forEach(id => {
            const subject = selectedSubjects.users[id];
            allSubjects.push({
                type: 'User',
                id: id,
                name: subject.name,
                permissions: subject.permissions
            });
        });
        
        // Departments
        Object.keys(selectedSubjects.departments).forEach(id => {
            const subject = selectedSubjects.departments[id];
            allSubjects.push({
                type: 'Department',
                id: id,
                name: subject.name,
                permissions: subject.permissions
            });
        });
        
        // Groups
        Object.keys(selectedSubjects.groups).forEach(id => {
            const subject = selectedSubjects.groups[id];
            allSubjects.push({
                type: 'Group',
                id: id,
                name: subject.name,
                permissions: subject.permissions
            });
        });

        // "Tất cả mọi người" (Everyone) - Only add if at least one permission is checked
        const everyonePermissions = {
            view: $('#globalPerm_View').is(':checked'),
            edit: $('#globalPerm_Edit').is(':checked'),
            delete: $('#globalPerm_Delete').is(':checked'),
            upload: $('#globalPerm_Upload').is(':checked'),
            download: $('#globalPerm_Download').is(':checked'),
            share: $('#globalPerm_Share').is(':checked'),
            fullControl: $('#globalPerm_FullControl').is(':checked')
        };
        
        const everyoneBits = calculatePermissionBits(everyonePermissions);
        if (everyoneBits > 0) {
            allSubjects.push({
                type: 'Everyone',
                id: '00000000-0000-0000-0000-000000000000',
                name: 'Tất cả mọi người',
                permissions: everyonePermissions
            });
        }
        
        // Validate
        if (allSubjects.length === 0) {
            // If user cleared everything, just hide modal (deletions were handled individually)
            $('#permissionModal').modal('hide');
            return;
        }
        
        // Validate permissions - Mỗi subject phải có ít nhất 1 quyền
        let hasInvalidSubject = false;
        allSubjects.forEach(subject => {
            const bits = calculatePermissionBits(subject.permissions);
            if (bits === 0) {
                toastr.warning(`Vui lòng chọn ít nhất 1 quyền cho đối tượng ${subject.name}`);
                hasInvalidSubject = true;
            }
        });
        
        if (hasInvalidSubject) return;
        
        // Get apply scope
        const applyToChildren = $('input[name="permissionScope"]:checked').val() === 'true';
        
        // Disable button và show progress
        const $btn = $(this);
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Đang xử lý...');
        $('#bulkPermissionProgress').show();
        
        // Bulk grant
        const total = allSubjects.length;
        let completed = 0;
        let successCount = 0;
        let failCount = 0;
        
        const updateProgress = () => {
            const percent = Math.round((completed / total) * 100);
            $('#bulkPermissionProgress .progress-bar').css('width', percent + '%');
            $('#bulkProgressText').text(`${completed} / ${total}`);
        };
        
        // Sequential promise chain
        const grantPromises = allSubjects.reduce((promise, subject) => {
            return promise.then(() => {
                const permissionBits = calculatePermissionBits(subject.permissions);
                
                const requestData = {
                    SubjectType: subject.type,
                    SubjectId: subject.id,
                    PermissionBits: permissionBits,
                    ApplyToChildren: applyToChildren,
                    ExpiredAt: null
                };
                
                
                return $.ajax({
                    url: `/FileManager/Storage/GrantPermission/${nodeId}`,
                    type: 'POST',
                    contentType: 'application/json',
                    headers: { 'RequestVerificationToken': token },
                    data: JSON.stringify(requestData)
                }).then(
                    response => {
                        if (response.isSuccess) {
                            successCount++;
                            
                            // Cập nhật shareId vào local state và DOM để có thể xóa ngay lập tức
                            const newShareId = response.data?.shareId || response.shareId || response.Data?.ShareId;
                            if (newShareId) {
                                const typeKey = subject.type.toLowerCase() === 'user' ? 'users' : 
                                               (subject.type.toLowerCase() === 'department' ? 'departments' : 'groups');
                                if (selectedSubjects[typeKey][subject.id]) {
                                    selectedSubjects[typeKey][subject.id].shareId = newShareId;
                                    // Cập nhật data-attribute trong DOM
                                    $(`.subject-row[data-id="${subject.id}"][data-type="${subject.type.toLowerCase()}"]`).attr('data-share-id', newShareId);
                                }
                            }
                        } else {
                            console.error(`❌ Failed: ${subject.name}`, response);
                            failCount++;
                        }
                    },
                    error => {
                        console.error(`❌ Error: ${subject.name}`, error);
                        failCount++;
                    }
                ).always(() => {
                    completed++;
                    updateProgress();
                });
            });
        }, Promise.resolve());
        
        // After all complete
        grantPromises.finally(() => {
            // Re-enable button
            $btn.prop('disabled', false).html('<i class="fas fa-check mr-2"></i>Xong');
            
            // Hide progress
            setTimeout(() => {
                $('#bulkPermissionProgress').fadeOut();
            }, 1500);
            
            // Show summary
            if (successCount > 0) {
                toastr.success(`✅ Đã cấp quyền thành công cho ${successCount} đối tượng${failCount > 0 ? `, ${failCount} thất bại` : ''}`);
                
                // Close modal after success
                setTimeout(() => {
                    $('#permissionModal').modal('hide');
                }, 2000);
            } else if (failCount > 0) {
                toastr.error(`Không thể cấp quyền cho ${failCount} đối tượng`);
            }
        });
    });
    
    // ===== EXPOSE GLOBALLY =====
    window.openPermissionModal = openPermissionModal;
});
