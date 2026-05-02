/**
 * Role Management JavaScript
 * Handles Role CRUD and Permission Tree (jsTree) with Figma styling
 */

let currentRoleId = null;
let permissionTreeData = null;

$(document).ready(function () {
    initializeEventHandlers();

    // Load permission tree data once on page load to use for all role modals
    fetchPermissionTreeData();

    // Re-bind after each partial reload triggered by quickSearch
    $(document).on('quickSearchComplete', function () {
        // Any re-initialization after partial load can go here
    });
});

/**
 * Reload the list by submitting the search form
 */
function reloadList() {
    $('#frmRole').trigger('submit');
}

/**
 * Initialize event handlers
 */
function initializeEventHandlers() {
    // Create Role
    $('#btnAddRole').on('click', function () {
        showRoleModal('create');
    });

    // Edit Role (from partial)
    $(document).on('click', '.btn-edit', function() {
        const id = $(this).data('id');
        showRoleModal('edit', id);
    });

    // Delete Role (from partial)
    $(document).on('click', '.btn-delete', function() {
        const id = $(this).data('id');
        const name = $(this).data('name');
        showDeleteModal(id, name);
    });

    // Save Role
    $('#btnSaveRole').on('click', function () {
        saveRole();
    });

    // Confirm Delete
    $('#btnConfirmDelete').on('click', function () {
        deleteRole();
    });

    // Tree Controls
    $('#btnExpandAll').on('click', function() {
        $('#permTree').jstree('open_all');
    });
    
    $('#btnCollapseAll').on('click', function() {
        $('#permTree').jstree('close_all');
    });

    // Modal Reset
    $('#roleModal').on('hidden.bs.modal', function () {
        resetRoleForm();
    });
}

/**
 * Fetch permission tree structure
 */
function fetchPermissionTreeData() {
    $.ajax({
        url: '/Role/GetAllModulesWithPermissions',
        type: 'GET',
        success: function (response) {
            if (response.success && response.categories) {
                permissionTreeData = response.categories;
            } else {
                console.error('Failed to load permission tree:', response.error || response.message);
                toastr.error('Không thể tải dữ liệu phân quyền');
            }
        },
        error: function (xhr, status, error) {
            console.error('Error fetching permission tree:', error);
            toastr.error('Lỗi kết nối khi tải dữ liệu phân quyền');
        }
    });
}

/**
 * Show role modal (create or edit)
 */
function showRoleModal(mode, roleId = null) {
    resetRoleForm();
    currentRoleId = roleId;

    if (mode === 'create') {
        $('#roleModalTitle').html('<i class="fas fa-plus-circle mr-2"></i> Thêm mới Vai trò');

        if (!permissionTreeData) {
            toastr.warning('Đang tải dữ liệu phân quyền, vui lòng thử lại sau giây lát...');
            setTimeout(() => showRoleModal(mode, roleId), 1000);
            return;
        }

        renderPermissionTree(permissionTreeData);
        $('#roleModal').modal('show');
    } else {
        $('#roleModalTitle').html('<i class="fas fa-edit mr-2"></i> Cập nhật Vai trò & Phân quyền');
        loadRoleData(roleId);
    }
}

/**
 * Load role details and its permissions
 */
function loadRoleData(id) {
    $.ajax({
        url: `/Role/Get/${id}`,
        type: 'GET',
        success: function (response) {
            const role = response.data || response;
            if (role) {
                $('#roleId').val(role.id);
                $('#roleName').val(role.name);
                $('#roleDescription').val(role.description || '');

                $.ajax({
                    url: `/Role/GetPermissions/${id}`,
                    type: 'GET',
                    success: function (permResponse) {
                        if (permResponse.success && permResponse.categories) {
                            renderPermissionTree(permResponse.categories);
                        } else {
                            renderPermissionTree(permissionTreeData);
                        }
                        $('#roleModal').modal('show');
                    },
                    error: function(xhr, status, error) {
                        console.error('Error loading permissions:', error);
                        renderPermissionTree(permissionTreeData);
                        $('#roleModal').modal('show');
                    }
                });
            } else {
                toastr.error('Không thể tải thông tin vai trò');
            }
        },
        error: function (xhr, status, error) {
            console.error('Error loading role:', error);
            toastr.error('Lỗi khi kết nối máy chủ');
        }
    });
}

/**
 * Render jsTree with provided category data
 * @param {Array} data - Array of ModuleCategoryGroup objects
 */
function renderPermissionTree(data) {
    $('#permTreeLoading').show();
    $('#permTree').hide().jstree('destroy');

    const sourceData = data || permissionTreeData;
    if (!sourceData) {
        setTimeout(() => renderPermissionTree(data), 500);
        return;
    }

    const treeData = sourceData.map(cat => ({
        text: `<strong>${cat.categoryName}</strong>`,
        type: 'category',
        state: { opened: true },
        children: (cat.modules || []).map(mod => ({
            text: `${mod.description || mod.code} <span class="module-code">${mod.code}</span>`,
            type: 'module',
            state: { opened: false },
            children: (mod.permissions || []).map(perm => {
                const moduleId = mod.moduleId || mod.ModuleId;
                const typePermissionId = perm.typePermissionId || perm.TypePermissionId;
                const nodeId = `${moduleId}_${typePermissionId}`;
                const isGranted = perm.isGranted || perm.IsGranted;
                const isSelected = isGranted === true;

                return {
                    id: nodeId,
                    text: perm.description || perm.code,
                    type: 'permission',
                    state: { selected: isSelected },
                    moduleId: moduleId, 
                    typePermissionId: typePermissionId,
                    isPermissionNode: true
                };
            })
        }))
    }));

    $('#permTree').jstree({
        'core': {
            'data': treeData,
            'themes': {
                'name': 'default',
                'dots': true,
                'icons': true
            }
        },
        'plugins': ['checkbox', 'search', 'types'],
        'checkbox': {
            'keep_selected_style': false,
            'tie_selection': false,
            'three_state': true
        },
        'types': {
            'default': { 'icon': 'fas fa-folder text-warning' },
            'category': { 'icon': 'fas fa-folder text-warning' },
            'module': { 'icon': 'fas fa-cube text-primary' },
            'permission': { 'icon': 'fas fa-check-circle text-success' }
        }
    }).on('ready.jstree', function() {
        const tree = $('#permTree').jstree(true);

        treeData.forEach(cat => {
            cat.children?.forEach(mod => {
                mod.children?.forEach(perm => {
                    if (perm.state?.selected === true) {
                        tree.check_node(perm.id);
                    }
                });
            });
        });

        $('#permTreeLoading').hide();
        $('#permTree').show();
    });
}

/**
 * Save Role
 */
function saveRole() {
    const name = $('#roleName').val().trim();
    if (!name) {
        $('#roleName').addClass('is-invalid');
        toastr.warning('Vui lòng nhập tên vai trò');
        return;
    }
    $('#roleName').removeClass('is-invalid');

    const tree = $('#permTree').jstree(true);
    if (!tree) {
        toastr.error('Cây phân quyền chưa sẵn sàng. Vui lòng thử lại.');
        return;
    }

    // Get ALL nodes to include both checked and unchecked permissions
    const allNodes = tree.get_json('#', { flat: true });
    const permissions = allNodes
        .map(nodeJson => {
            const node = tree.get_node(nodeJson.id);
            if (node && node.original && node.original.isPermissionNode === true) {
                const parts = node.id.split('_');
                if (parts.length < 2) return null;
                
                return {
                    moduleId: parts[0],
                    typePermissionId: parts[1],
                    isGranted: tree.is_checked(node.id)
                };
            }
            return null;
        })
        .filter(p => p !== null);

    if (allNodes.length > 0 && permissions.length === 0) {
        toastr.error('Lỗi: Không thể trích xuất quyền từ cây phân quyền.');
        return;
    }

    const request = {
        name: name,
        description: $('#roleDescription').val().trim(),
        permissions: permissions
    };

    const $btn = $('#btnSaveRole');
    const originalHtml = $btn.html();
    $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

    const method = currentRoleId ? 'PUT' : 'POST';
    const url = currentRoleId ? `/Role/Update/${currentRoleId}` : '/Role/Create';

    $.ajax({
        url: url,
        type: method,
        contentType: 'application/json',
        data: JSON.stringify(request),
        headers: {
            'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
        },
        success: function (response) {
            if (response.isSuccess || response.success) {
                toastr.success(response.message || 'Lưu vai trò thành công');
                $('#roleModal').modal('hide');
                reloadList();
            } else {
                toastr.error(response.message || 'Không thể lưu vai trò');
            }
        },
        error: function (xhr, status, error) {
            console.error('Save error:', error);
            toastr.error('Lỗi khi gửi yêu cầu lên máy chủ');
        },
        complete: function () {
            $btn.prop('disabled', false).html(originalHtml);
        }
    });
}

/**
 * Show delete modal
 */
function showDeleteModal(id, name) {
    currentRoleId = id;
    $('#deleteRoleName').text(name);
    $('#deleteModal').modal('show');
}

/**
 * Delete Role
 */
function deleteRole() {
    const $btn = $('#btnConfirmDelete');
    const originalHtml = $btn.html();
    $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xóa...');

    $.ajax({
        url: `/Role/Delete/${currentRoleId}`,
        type: 'DELETE',
        headers: {
            'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
        },
        success: function (response) {
            if (response.isSuccess || response.success) {
                toastr.success(response.message || 'Xóa vai trò thành công');
                $('#deleteModal').modal('hide');
                reloadList();
            } else {
                toastr.error(response.message || 'Không thể xóa vai trò');
            }
        },
        error: function () {
            toastr.error('Lỗi khi thực hiện yêu cầu xóa');
        },
        complete: function () {
            $btn.prop('disabled', false).html(originalHtml);
        }
    });
}

/**
 * Reset form
 */
function resetRoleForm() {
    $('#roleForm')[0].reset();
    $('#roleId').val('');
    $('#roleName').removeClass('is-invalid');
    if ($('#permTree').jstree(true)) {
        $('#permTree').jstree('destroy').empty();
    }
    $('#permTreeLoading').show();
    currentRoleId = null;
}

/**
 * Global helper for edit button
 */
function editRole(id) {
    showRoleModal('edit', id);
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function (m) { return map[m]; });
}
