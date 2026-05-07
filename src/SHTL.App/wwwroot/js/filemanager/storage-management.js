/**
 * storage-management.js
 * [x] 3. Sửa lỗi nhận diện nodeType trong storage-management.js (Nút Sửa)
 * jsTree-based storage management với lazy load, CRUD operations, file upload
 * Updated: Collapsible tree + content list table view
 * VERSION: 2026-04-01-V7-FINAL - Event handlers + positioning fixes
 */


$(document).ready(function () {   
    // CSRF Token
    const token = $('input[name="__RequestVerificationToken"]').val();

    // Context from View
    const warehouseId = window.storageContext.warehouseId;
    const rootNodeId = window.storageContext.rootNodeId;
    const warehouseName = window.storageContext.warehouseName || 'Kho lưu trữ';

    // Current selected node
    let selectedNode = null;
    let treeCollapsed = false;

    // Pagination state
    let currentPage = 1;
    let pageSize = 20;
    let totalCount = 0;
    let totalPages = 0; // Add totalPages as module-level variable
    
    // Tree loading needs all children (not paginated like content list)
    const TREE_PAGE_SIZE = 1000;

    // Select2 initialization delay (ms)
    const SELECT2_INIT_DELAY = 200;

    // ===== MULTI-FILE UPLOAD STATE =====
    let selectedFiles = [];
    let useCommonType = false;
    let documentTypesCache = [];
    const MAX_FILES = 50;
    const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

    // ===== COLLAPSIBLE TREE TOGGLE =====
    $('#btnCollapseTree').on('click', function () {
        $('#treePanel').hide();
        $('#btnExpandTree').fadeIn(200).css('display', 'flex');
        treeCollapsed = true;
    });

    $('#btnExpandTree').on('click', function () {
        $('#treePanel').fadeIn(200);
        $(this).hide();
        treeCollapsed = false;
    });

    // ===== TREE SEARCH IMPLEMENTATION =====
    let searchTimeout = false;
    $('#treeSearchInput').on('keyup input', function () {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function () {
            const v = $('#treeSearchInput').val();
            const tree = $.jstree.reference('#storageTree');
            if (tree) {
                if (v && v.trim().length > 0) {
                    tree.search(v);
                } else {
                    tree.clear_search();
                }
            }
        }, 300);
    });

    // ===== jsTree INITIALIZATION =====
    $('#storageTree').jstree({
        core: {
            data: function (node, callback) {
                const parentId = node.id === '#' ? rootNodeId : node.id;

                // Show Tree Spinner
                $('#treeSpinner').show();

                // IMPORTANT: Tree needs ALL children (use large pageSize, not user's content pageSize)
                $.ajax({
                    url: `/FileManager/Storage/GetNodes?warehouseId=${warehouseId}&parentId=${parentId}&pageSize=${TREE_PAGE_SIZE}`,
                    type: 'GET',
                    success: function (response) {
                        $('#treeSpinner').hide();
                        
                        // Debug logging
                        // Debug: Tree loaded successfully
                        
                        if (response.error) {
                            toastr.error(response.error);
                            callback([]);
                            return;
                        }

                        // Transform API response to jsTree format
                        const rawItems = response.items || response.Items || [];
                        
                        // De-duplicate items by ID to prevent tree clutter
                        const uniqueItemsMap = new Map();
                        rawItems.forEach(item => {
                            const id = item.id || item.Id;
                            if (id && !uniqueItemsMap.has(id)) {
                                uniqueItemsMap.set(id, item);
                            }
                        });
                        const allItems = Array.from(uniqueItemsMap.values());

                        // De-duplication complete: unique items loaded
                        
                        const nodes = allItems
                            .filter(item => {
                                const type = (item.nodeType || item.NodeType || '').toUpperCase().trim();
                                const isAllowed = type === 'THU_MUC' || type === 'HO_SO' || type === 'ROOT' || type === 'DIRECTORY' || type === 'FOLDER';
                                return isAllowed;
                            })
                            .map(item => {
                                const type = (item.nodeType || item.NodeType || '').toUpperCase().trim();
                                const id = item.id || item.Id;
                                const name = item.name || item.Name;
                                return {
                                    id: id,
                                    text: name,
                                    icon: getNodeIcon(type, name, item.fileExtension || item.FileExtension),
                                    children: type !== 'TAI_LIEU',
                                    data: {
                                        ...item,
                                        nodeType: type,
                                        myPermission: item.myPermission || item.MyPermission || {}
                                    }
                                };
                            });

                        callback(nodes);
                    },
                    error: function (xhr, status, error) {
                        console.error('Error loading nodes:', error);
                        toastr.error('Lỗi khi tải danh sách');
                        callback([]);
                    }
                });
            },
            check_callback: true,
            themes: {
                stripes: true
            }
        },
        plugins: ['contextmenu', 'wholerow', 'search'],
        search: {
            show_only_matches: true,
            show_only_matches_children: true,
            ajax: {
                url: '/FileManager/Storage/SearchTreeNodes',
                data: function (str) {
                    return {
                        warehouseId: warehouseId,
                        keyword: str
                    };
                }
            },
            search_callback: function (str, node) {
                if (!str) return true;
                const normalize = (s) => (s || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/Đ/g, "d");
                return normalize(node.text).indexOf(normalize(str)) !== -1;
            }
        },
        contextmenu: {
            items: function (node) {
                const tree = $('#storageTree').jstree(true);
                const items = {};

                const dataObj = node.data || (node.original && node.original.data) || {};

                // Get node-level permissions from API response
                const perm = dataObj.myPermission || {};
                const canUpload = perm.canUpload === true;
                const canEdit = perm.canEdit === true;
                const canDelete = perm.canDelete === true;
                const canShare = perm.canShare === true;

                // Create Folder (requires Upload permission on parent)
                if (canUpload &&
                    (dataObj.nodeType === 'THU_MUC' || dataObj.nodeType === 'ROOT')) {
                    items.createFolder = {
                        label: 'Tạo thư mục',
                        icon: 'fas fa-folder-plus',
                        action: function () {
                            openCreateFolderModal(node.id);
                        }
                    };
                }

        // Create Profile (requires Upload permission, only in folders)
        if (canUpload &&
            dataObj.nodeType === 'THU_MUC') {
            items.createProfile = {
                label: 'Tạo hồ sơ',
                icon: 'fas fa-folder-open',
                action: function () {
                    // Use shared modal
                    if (typeof window.openCreateProfileModal === 'function') {
                        window.openCreateProfileModal(node.id, {
                            onSuccess: function () {
                                const tree = $('#storageTree').jstree(true);
                                tree.refresh_node(node);
                                if (selectedNode && (selectedNode.id === node.id || selectedNode.id === '#')) {
                                    loadContentList(selectedNode);
                                }
                            }
                        });
                    } else {
                        toastr.error('Không tìm thấy chức năng tạo hồ sơ dùng chung');
                    }
                }
            };
        }

                // Upload Document (requires Upload permission)
                if (canUpload &&
                    (dataObj.nodeType === 'ROOT' ||
                        dataObj.nodeType === 'THU_MUC' ||
                        dataObj.nodeType === 'HO_SO')) {
                    items.uploadDocument = {
                        label: 'Upload tài liệu',
                        icon: 'fas fa-upload',
                        action: function () {
                            // Use shared modal
                            if (typeof window.openUploadDocumentModal === 'function') {
                                window.openUploadDocumentModal(node.id, {
                                    onSuccess: function () {
                                        const tree = $('#storageTree').jstree(true);
                                        tree.refresh_node(node);
                                        if (selectedNode && (selectedNode.id === node.id || selectedNode.id === '#')) {
                                            loadContentList(selectedNode);
                                        }
                                    }
                                });
                            } else {
                                toastr.error('Không tìm thấy chức năng upload tài liệu dùng chung');
                            }
                        }
                    };
                }

                // Permission Management (requires Share permission)
                if (canShare) {
                    items.permission = {
                        label: 'Phân quyền',
                        icon: 'fas fa-user-shield',
                        action: function () {
                            if (typeof window.openPermissionModal === 'function') {
                                window.openPermissionModal(node.id, node.text, dataObj.nodeType);
                            }
                        }
                    };
                }

                // Edit (requires Edit permission)
                if (canEdit) {
                    items.edit = {
                        label: 'Sửa',
                        icon: 'fas fa-edit',
                        action: function () {
                            if (dataObj.nodeType === 'TAI_LIEU') {
                                window.open(`/FileManager/Storage/DocumentView/${node.id}?mode=edit`, '_blank');
                            } else {
                                openEditNodeModal(node);
                            }
                        }
                    };
                }

                // Delete (requires Delete permission)
                if (canDelete) {
                    items.delete = {
                        label: 'Xóa',
                        icon: 'fas fa-trash',
                        action: function () {
                            const nodeData = node.original.data;
                            openDeleteModal(nodeData.id, nodeData.name, node.parent);
                        }
                    };
                }

                return items;
            }
        }
    });

    // Helper: Get icon based on node type and file extension
    function getNodeIcon(nodeType, fileName, extension) {
        const type = (nodeType || '').toUpperCase().trim();
        if (type === 'THU_MUC' || type === 'DIRECTORY' || type === 'FOLDER') return 'fas fa-folder text-warning';
        if (type === 'HO_SO' || type === 'PROFILE') return 'fas fa-folder-open text-info';
        if (type === 'ROOT') return 'fas fa-warehouse text-primary';

        if (nodeType === 'TAI_LIEU') {
            let ext = (extension || getExtension(fileName)).toLowerCase();
            if (ext && !ext.startsWith('.')) ext = '.' + ext;

            // Debug icon (có thể xem trong F12 console)
            // console.log('Icon for:', fileName, 'Ext:', ext);

            // FontAwesome 6 solid icons with inline colors for reliability
            switch (ext) {
                case '.pdf': return 'fa-solid fa-file-pdf" style="color: #ef4444;';
                case '.doc':
                case '.docx': return 'fa-solid fa-file-word" style="color: #3b82f6;';
                case '.xls':
                case '.xlsx': return 'fa-solid fa-file-excel" style="color: #22c55e;';
                case '.ppt':
                case '.pptx': return 'fa-solid fa-file-powerpoint" style="color: #f59e0b;';
                case '.zip':
                case '.rar':
                case '.7z': return 'fa-solid fa-file-zipper" style="color: #64748b;';
                case '.jpg':
                case '.jpeg':
                case '.png':
                case '.svg':
                case '.gif': return 'fa-solid fa-file-image" style="color: #06b6d4;';
                case '.txt': return 'fa-solid fa-file-lines" style="color: #94a3b8;';
                default: return 'fa-solid fa-file" style="color: #94a3b8;';
            }
        }
        return 'fas fa-folder';
    }

    function getExtension(fileName) {
        if (!fileName) return '';
        const idx = fileName.lastIndexOf('.');
        return idx >= 0 ? fileName.substring(idx).toLowerCase() : '';
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        if (!bytes) return '---';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Event: Node selected — update breadcrumb and load content list
    $('#storageTree').on('select_node.jstree', function (e, data) {
        currentPage = 1; // Reset to page 1 on new selection
        selectedNode = data.node;
        updateBreadcrumb(data.node);
        loadContentList(data.node);

        // Update action buttons based on node-level permissions
        updateToolbarButtons(data.node);
    });

    // Update toolbar buttons based on selected node's permissions
    // IMPORTANT: Create buttons use MODULE permission, Edit/Delete use NODE permission
    function updateToolbarButtons(node) {
        // Fallback for Root or invalid node - use context-level permissions
        if (!node || node.id === '#') {
            const up = window.userPermissions || {};

            $('#btnEditNode').prop('disabled', true);
            $('#btnDeleteNode').prop('disabled', true);

            // For Root: can create if the user has permissions on the root node
            $('#btnCreateFolder').prop('disabled', up.canCreate !== true);
            $('#btnCreateProfile').prop('disabled', up.canCreate !== true);
            $('#btnUploadDocument').prop('disabled', up.canCreate !== true);
            return;
        }

        // Get node permissions
        const dataObj = node.data || (node.original && node.original.data) || {};
        const perm = dataObj.myPermission || {};

        // SUPERADMIN BYPASS: If isSuperAdmin is true in permission object, enable everything
        const isSuperAdmin = perm.isSuperAdmin === true;

        const canUpload = isSuperAdmin || perm.canUpload === true || perm.CanUpload === true;
        const canEdit = isSuperAdmin || perm.canEdit === true || perm.CanEdit === true;
        const canDelete = isSuperAdmin || perm.canDelete === true || perm.CanDelete === true;

        // Enable/disable buttons based on permissions
        $('#btnEditNode').prop('disabled', !canEdit);
        $('#btnDeleteNode').prop('disabled', !canDelete);

        // For Root/null node, use window.userPermissions
        let finalCanUpload = canUpload;
        if (!node || node.id === '#') {
            finalCanUpload = window.userPermissions?.canCreate === true;
        }

        // Create buttons (only enable if canUpload)
        $('#btnCreateFolder').prop('disabled', !finalCanUpload);
        $('#btnCreateProfile').prop('disabled', !finalCanUpload);
        $('#btnUploadDocument').prop('disabled', !finalCanUpload);

        // Profile can only be created in Folders (unless bypass logic allows for Root)
        if (dataObj.nodeType !== 'THU_MUC' && dataObj.nodeType !== 'ROOT' && !isSuperAdmin) {
            $('#btnCreateProfile').prop('disabled', true);
        }
    }

    // Handle initial loading of the tree
    $('#storageTree').on('ready.jstree', function () {
        // Update header title and breadcrumb if needed
        if (warehouseName && warehouseName !== 'Kho lưu trữ') {
            $('.warehouse-title-header').text(warehouseName);
        }

        // Set root node text in the tree explicitly
        const tree = $('#storageTree').jstree(true);
        if (tree) {
            const rootNode = tree.get_node(rootNodeId);
            if (rootNode && (rootNode.text === 'Kho lưu trữ' || !rootNode.text)) {
                tree.rename_node(rootNode, warehouseName);
            }
        }

        selectedNode = {
            id: '#',
            original: {
                data: {
                    id: '#',
                    name: warehouseName,
                    nodeType: 'ROOT'
                }
            }
        };
        updateBreadcrumb(selectedNode);
        loadContentList(selectedNode);
    });

    // Update Breadcrumb Path
    function updateBreadcrumb(node) {
        let path = [];
        const tree = $('#storageTree').jstree(true);

        if (node && node.id !== '#') {
            // Get path from tree
            const pathIds = tree.get_path(node, false, true);
            pathIds.forEach(id => {
                const n = tree.get_node(id);
                if (n && n.id !== '#') {
                    path.push({
                        id: id,
                        name: n.text,
                        type: n.data ? n.data.nodeType : ''
                    });
                }
            });
        }

        // Root warehouse node
        let html = `
            <span class="root-breadcrumb" style="cursor: pointer; color: var(--primary); font-weight: 600;" data-id="#">
                <i class="fas fa-warehouse mr-1" style="font-size: 12px; opacity: 0.7;"></i>${warehouseName}
            </span>
        `;

        path.forEach((item, index) => {
            html += ` <i class="fas fa-chevron-right mx-2" style="font-size: 10px; opacity: 0.3;"></i> `;
            const icon = getNodeIcon(item.type);
            html += `
                <span class="breadcrumb-item-click" style="cursor: pointer; ${index === path.length - 1 ? 'font-weight: 700; color: #1e293b;' : 'color: #64748b;'}" data-id="${item.id}">
                    <i class="${icon} mr-1" style="font-size: 12px; opacity: 0.8;"></i>${item.name}
                </span>
            `;
        });

        $('#nodeBreadcrumb').html(html);

        // Attach click events
        $('.root-breadcrumb, .breadcrumb-item-click').off('click').on('click', function (e) {
            e.preventDefault();
            const id = $(this).attr('data-id');
            const tree = $('#storageTree').jstree(true);
            if (id === '#') {
                selectedNode = { id: '#', original: { data: { id: '#', name: warehouseName, nodeType: 'ROOT' } } };
                tree.deselect_all();
                currentPage = 1;
                updateBreadcrumb(selectedNode);
                loadContentList(selectedNode);
            } else {
                tree.deselect_all();
                tree.select_node(id);
            }
        });
    }

    function loadContentList(node) {
        const nodeId = node.id || node.Id || '#';
        $('#contentSpinner').show();

        const actualParentId = nodeId === '#' ? window.storageContext.rootNodeId : nodeId;
        $.ajax({
            url: '/FileManager/Storage/GetNodes',
            type: 'GET',
            data: {
                parentId: actualParentId,
                warehouseId: window.storageContext.warehouseId,
                page: currentPage,
                pageSize: pageSize
            },
            success: function (response) {
                $('#contentSpinner').hide();
                
                // Debug logging
                // Debug: Content list loaded successfully
                
                const items = response.items || response.Items || [];
                
                // Get totalCount from response (API should always return this)
                totalCount = response.totalCount || response.TotalCount || 0;
                
                // Log for debugging if totalCount seems wrong
                if (totalCount === 0 && items.length > 0) {
                    console.warn('[Pagination] API returned items but totalCount=0. Response:', response);
                }
                
                // Pagination: totalCount extracted from response

                if (items && items.length > 0) {
                    renderContentTable(items);
                    renderPagination();
                } else {
                    totalCount = 0;
                    $('#contentList').html(`
                        <div class="text-center text-muted" style="padding: 40px 20px;">
                            <i class="fas fa-folder-open" style="font-size: 48px; opacity: 0.3;"></i>
                            <p style="font-size: 14px; margin-top: 12px;">Thư mục rỗng</p>
                        </div>
                    `);
                    $('#nodePagination').hide();
                }
            },
            error: function (xhr, status, error) {
                $('#contentSpinner').hide();
                console.error('Error loading content:', error);
                $('#contentList').html(`
                    <div class="text-center text-danger" style="padding: 40px 20px;">
                        <i class="fas fa-exclamation-circle" style="font-size: 32px; opacity: 0.5;"></i>
                        <p style="font-size: 14px; margin-top: 12px;">Không thể tải dữ liệu</p>
                    </div>
                `);
                $('#nodePagination').hide();
            }
        });
    }

    // Render Pagination
    // Render Pagination
    function renderPagination() {
        if (!totalCount || totalCount === 0) {
            $('#nodePagination').hide();
            return;
        }

        totalPages = Math.ceil(totalCount / pageSize); 
        if (totalPages < 1 && totalCount > 0) totalPages = 1;

        const startItem = (currentPage - 1) * pageSize + 1;
        const endItem = Math.min(currentPage * pageSize, totalCount);

        let html = `
            <div class="pagination-figma-container d-flex align-items-center justify-content-between w-100" style="padding: 12px 16px;">
                <div class="pagination-left pagination-info-figma text-muted" style="font-size: 13px;">
                    Tổng số &nbsp;<b>${totalCount}</b>&nbsp; bản ghi
                </div>
                <div class="pagination-right d-flex align-items-center" style="gap: 8px;">
                    <div class="pagination-length-figma">
                        <label class="mb-0 text-muted" style="font-size: 13px; display: flex; align-items: center; gap: 4px; font-weight: normal;">
                            Hiển thị 
                            <select id="pageSizeSelect" class="form-control form-control-sm" style="width: 70px; display: inline-block; padding: 2px 8px; height: 32px;">
                                <option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
                                <option value="20" ${pageSize === 20 ? 'selected' : ''}>20</option>
                                <option value="25" ${pageSize === 25 ? 'selected' : ''}>25</option>
                                <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
                                <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
                            </select> 
                            bản ghi
                        </label>
                    </div>
        `;

        // Page navigation
        html += `
                    <div class="pagination-figma">
                        <nav aria-label="Page navigation">
                            <ul class="pagination pagination-sm mb-0 pagination-figma-list" style="display: flex; gap: 4px; align-items: center;">
                                <li class="page-item ${currentPage <= 1 ? 'disabled' : ''}">
                                    <a class="page-link border-0 rounded" href="javascript:void(0)" data-page="${currentPage - 1}" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: #64748b;">
                                        <i class="fas fa-chevron-left" style="font-size: 11px;"></i>
                                    </a>
                                </li>
        `;

        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
        if (startPage < 1) startPage = 1;

        for (let i = startPage; i <= endPage; i++) {
            if (i < 1) continue;
            html += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link border-0 rounded ${i === currentPage ? 'bg-primary text-white' : ''}" href="javascript:void(0)" data-page="${i}" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: ${i === currentPage ? '600' : '500'}; color: ${i === currentPage ? '#fff' : '#64748b'};">${i}</a>
                </li>
            `;
        }

        // Fix Next Button: Show and functional if currentPage < totalPages
        const isNextDisabled = currentPage >= totalPages || totalPages <= 1;
        html += `
                                <li class="page-item ${isNextDisabled ? 'disabled' : ''}">
                                    <a class="page-link border-0 rounded" href="javascript:void(0)" data-page="${currentPage + 1}" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: #64748b;">
                                        <i class="fas fa-chevron-right" style="font-size: 11px;"></i>
                                    </a>
                                </li>
                            </ul>
                        </nav>
                    </div>
                </div>
            </div>
        `;

        $('#nodePagination').html(html).fadeIn(200);

        // Bind events
        $('#pageSizeSelect').off('change').on('change', function () {
            pageSize = parseInt($(this).val());
            currentPage = 1;
            loadContentList(selectedNode);
        });

        // Events
        $('.page-link').off('click').on('click', function (e) {
            e.preventDefault();
            const page = $(this).data('page');
            if (page && page >= 1 && page <= totalPages && page !== currentPage) {
                currentPage = page;
                loadContentList(selectedNode);
            }
        });
    }

    // Render Content Table
    function renderContentTable(items) {
        let html = `
            <div class="table-responsive" style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                <table class="table table-hover table-figma" style="font-size: 13.5px; width: 100%; min-width: 1100px; table-layout: auto;">
                    <thead style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                        <tr>
                            <th style="width: 48px; padding: 12px 16px; text-align: center;"></th>
                            <th style="padding: 12px 16px; min-width: 280px;">Tên / Mã hồ sơ</th>
                            <th style="width: 180px; padding: 12px 16px; min-width: 150px;">Loại / Định dạng</th>
                            <th style="width: 120px; padding: 12px 16px; min-width: 100px;">Dung lượng</th>
                            <th style="width: 180px; padding: 12px 16px; min-width: 150px;">Phòng ban</th>
                            <th style="width: 220px; padding: 12px 16px; min-width: 180px;">Doanh nghiệp</th>
                            <th style="width: 110px; padding: 12px 16px; min-width: 90px;">Ngày tạo</th>
                            <th style="width: 180px; padding: 12px 16px; text-align: center; min-width: 160px;">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // De-duplicate items by ID (items might have duplicates from API)
        const uniqueItemsMap = new Map();
        items.forEach(item => {
            const id = item.id || item.Id;
            if (id && !uniqueItemsMap.has(id)) {
                uniqueItemsMap.set(id, item);
            }
        });
        const uniqueItems = Array.from(uniqueItemsMap.values());

        uniqueItems.forEach(function (item) {
            const id = item.id || item.Id;
            const name = item.name || item.Name;
            const type = (item.nodeType || item.NodeType || '').toUpperCase();
            const icon = getNodeIcon(type, name || '', item.fileExtension || item.FileExtension);
            const typeLabel = getNodeTypeLabel(type);
            const typeBadge = getNodeTypeBadge(type);
            const createdDate = new Date(item.createdAt || item.CreatedAt).toLocaleDateString('vi-VN');
            const fileSize = item.fileSize !== undefined ? item.fileSize : (item.FileSize !== undefined ? item.FileSize : 0);
            const displaySize = type === 'TAI_LIEU' ? formatBytes(fileSize) : '---';

            html += `
                <tr data-id="${id}" data-type="${type}" style="cursor: pointer;">
                    <td style="padding: 10px 12px; text-align: center;">
                        <i class="${icon}" style="font-size: 16px;"></i>
                    </td>
                    <td style="padding: 10px 12px; font-weight: 500;">
                        <div class="text-truncate" title="${name}">${name}</div>
                        ${(item.profileCode || item.ProfileCode) ? `<small class="text-primary font-weight-bold" style="font-size: 11px;">[${item.profileCode || item.ProfileCode}]</small>` : ''}
                        ${(item.documentCode || item.DocumentCode) ? `<small class="text-primary font-weight-bold" style="font-size: 11px;">[${item.documentCode || item.DocumentCode}]</small>` : ''}
                    </td>
                    <td style="padding: 10px 12px;">
                        <span class="badge ${typeBadge}" style="font-size: 11px; padding: 4px 8px;">
                            ${item.profileTypeName || item.ProfileTypeName || item.documentTypeName || item.DocumentTypeName || typeLabel}
                        </span>
                    </td>
                    <td style="padding: 10px 12px; color: #64748b; font-size: 12px;">
                        ${displaySize}
                    </td>
                    <td style="padding: 10px 12px; color: #64748b; font-size: 12px;">
                        <div class="text-truncate" title="${item.departmentName || item.DepartmentName || ''}">${item.departmentName || item.DepartmentName || '<small class="text-muted">---</small>'}</div>
                    </td>
                    <td style="padding: 10px 12px; color: #64748b; font-size: 12px;">
                        <div class="text-truncate" title="${item.enterpriseName || item.EnterpriseName || ''}">${(item.enterpriseName || item.EnterpriseName) ? `${item.enterpriseName || item.EnterpriseName}${(item.enterpriseTaxCode || item.EnterpriseTaxCode) ? '<br><small class="text-muted">MST: ' + (item.enterpriseTaxCode || item.EnterpriseTaxCode) + '</small>' : ''}` : '<small class="text-muted">---</small>'}</div>
                    </td>
                    <td style="padding: 10px 12px; color: #64748b;">
                        ${createdDate}
                    </td>
                    <td style="padding: 10px 12px; text-align: center;">
                        ${renderContentActions(item)}
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        $('#contentList').html(html);

        // Attach click handlers for table rows
        $('#contentList tbody tr').on('click', function (e) {
            // If clicking on action buttons, don't trigger row click
            if ($(e.target).closest('button, a').length > 0) return;

            const nodeId = $(this).data('id');
            const nodeType = $(this).data('type');

            if (nodeType === 'THU_MUC' || nodeType === 'HO_SO') {
                const tree = $('#storageTree').jstree(true);
                currentPage = 1;
                const parentIdForTree = selectedNode ? selectedNode.id : '#';

                if (parentIdForTree !== '#' && !tree.is_open(parentIdForTree)) {
                    tree.open_node(parentIdForTree, function () {
                        tree.deselect_all();
                        tree.select_node(nodeId);
                    });
                } else {
                    tree.deselect_all();
                    tree.select_node(nodeId);
                }
            }
        });

        // Event listener for direct download
        $(document).off('click', '.btn-download-document').on('click', '.btn-download-document', function (e) {
            e.preventDefault();
            const id = $(this).data('id');
            window.location.href = `/FileManager/Storage/Download/${id}`;
            toastr.info('Đang chuẩn bị tải xuống...');
        });
    }

    // Render action buttons for content list items using node-level permissions
    function renderContentActions(item) {
        let html = '<div class="d-flex align-items-center justify-content-center" style="gap: 6px;">';

        const perm = item.myPermission || item.MyPermission || {};
        const isSuperAdmin = perm.isSuperAdmin === true || perm.IsSuperAdmin === true;
        
        const canView = isSuperAdmin || perm.canView === true || perm.CanView === true;
        const canDownload = isSuperAdmin || perm.canDownload === true || perm.CanDownload === true;
        const canEdit = isSuperAdmin || perm.canEdit === true || perm.CanEdit === true;
        const canDelete = isSuperAdmin || perm.canDelete === true || perm.CanDelete === true;
        const canShare = isSuperAdmin || perm.canShare === true || perm.CanShare === true;

        const id = item.id || item.Id;
        const name = item.name || item.Name;
        const type = (item.nodeType || item.NodeType || '').toUpperCase();

        if (type === 'TAI_LIEU') {
            if (canView) {
                html += `<button class="btn-figma btn-figma-secondary btn-view-document" data-id="${id}" data-title="${name}" title="Xem chi tiết" style="width: 28px; height: 28px; padding: 0;">
                            <i class="fas fa-eye" style="font-size: 12px;"></i>
                         </button>`;
            }
            if (canDownload) {
                html += `<button class="btn-figma btn-figma-secondary btn-download-document" data-id="${id}" title="Tải xuống" style="width: 28px; height: 28px; padding: 0;">
                            <i class="fas fa-download" style="font-size: 12px;"></i>
                         </button>`;
            }
            if (canEdit) {
                html += `<button class="btn-figma btn-figma-secondary btn-edit-content" data-id="${id}" data-node-type="${type}" title="Sửa thông tin" style="width: 28px; height: 28px; padding: 0;">
                            <i class="fas fa-edit" style="font-size: 12px;"></i>
                         </button>`;
            }
            if (canShare) {
                html += `<button class="btn-figma btn-figma-secondary btn-permission-content" data-id="${id}" data-name="${name}" title="Phân quyền" style="width: 28px; height: 28px; padding: 0;">
                            <i class="fas fa-user-shield" style="font-size: 12px;"></i>
                         </button>`;
            }
            if (canDelete) {
                html += `<button class="btn-figma btn-figma-danger btn-delete-content" data-id="${id}" data-name="${name}" title="Xóa" style="width: 28px; height: 28px; padding: 0;">
                            <i class="fas fa-trash" style="font-size: 12px;"></i>
                         </button>`;
            }
        } else {
            if (canShare) {
                html += `<button class="btn-figma btn-figma-secondary btn-permission-content" data-id="${id}" data-name="${name}" title="Phân quyền" style="width: 28px; height: 28px; padding: 0;">
                            <i class="fas fa-user-shield" style="font-size: 12px;"></i>
                         </button>`;
            }
            if (canEdit) {
                html += `<button class="btn-figma btn-figma-secondary btn-edit-content" data-id="${id}" data-node-type="${type}" title="Sửa" style="width: 28px; height: 28px; padding: 0;">
                            <i class="fas fa-edit" style="font-size: 12px;"></i>
                         </button>`;
            }
            if (canDelete) {
                html += `<button class="btn-figma btn-figma-danger btn-delete-content" data-id="${id}" data-name="${name}" title="Xóa" style="width: 28px; height: 28px; padding: 0;">
                            <i class="fas fa-trash" style="font-size: 12px;"></i>
                         </button>`;
            }
        }

        html += '</div>';
        return html;
    }

    function getNodeTypeBadge(nodeType) {
        switch (nodeType) {
            case 'THU_MUC': return 'badge-warning';
            case 'HO_SO': return 'badge-info';
            case 'TAI_LIEU': return 'badge-success';
            default: return 'badge-secondary';
        }
    }

    function getNodeTypeLabel(nodeType) {
        switch (nodeType) {
            case 'THU_MUC': return 'Thư mục';
            case 'HO_SO': return 'Hồ sơ';
            case 'TAI_LIEU': return 'Tài liệu';
            default: return nodeType;
        }
    }

    // ===== CREATE FOLDER =====
    function openCreateFolderModal(parentId) {
        $('#folderParentId').val(parentId);
        $('#folderName').val('');
        $('#folderDescription').val('');
        $('#createFolderModal').modal('show');
    }

    $('#btnCreateFolder').on('click', function () {
        const node = selectedNode;
        const dataObj = node ? (node.data || (node.original && node.original.data) || {}) : { nodeType: 'ROOT' };
        
        // Cần quyền Upload để tạo thư mục
        const isSuperAdmin = dataObj.myPermission?.isSuperAdmin === true;
        let canUpload = isSuperAdmin || dataObj.myPermission?.canUpload === true || dataObj.myPermission?.CanUpload === true;

        // Fallback for Root or no selection
        if (!selectedNode || selectedNode.id === '#') {
            canUpload = window.userPermissions?.canCreate === true;
        }

        if (!canUpload) {
            toastr.warning('Bạn không có quyền tạo thư mục tại đây');
            return;
        }

        // Reset form and show modal
        $('#formCreateFolder')[0].reset();
        $('#folderParentId').val(node && node.id !== '#' ? node.id : window.storageContext.rootNodeId);
        $('#createFolderModal').modal('show');
    });

    $('#btnConfirmCreateFolder').on('click', function () {
        let formParentId = $('#folderParentId').val();
        if (formParentId === '#' || !formParentId) formParentId = rootNodeId;

        const data = {
            parentId: formParentId,
            name: $('#folderName').val(),
            description: $('#folderDescription').val() || null,
            IDWarehouse: warehouseId  // Fix: Match C# DTO property name (uppercase ID)
        };

        if (!data.name) {
            toastr.warning('Vui lòng nhập tên thư mục');
            return;
        }

        $.ajax({
            url: '/FileManager/Storage/CreateFolder',
            type: 'POST',
            contentType: 'application/json',
            headers: { 'RequestVerificationToken': token },
            data: JSON.stringify(data),
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(response.message || 'Tạo thư mục thành công');
                    $('#createFolderModal').modal('hide');

                    // Refresh tree and content list
                    const actualParentId = data.parentId === rootNodeId ? '#' : data.parentId;
                    refreshTree(actualParentId);

                    // Always refresh content list if currently viewing parent
                    if (!selectedNode || selectedNode.id === '#' || selectedNode.id === actualParentId) {
                        // Reload content list for root or current parent
                        loadContentList(selectedNode || { id: '#', original: { data: { name: warehouseName, nodeType: 'ROOT' } } });
                    }
                } else {
                    toastr.error(response.message || 'Không thể tạo thư mục');
                }
            },
            error: function (xhr, status, error) {
                console.error('Error creating folder:', error, xhr.responseText);
                toastr.error('Lỗi khi tạo thư mục: ' + (xhr.responseText || error));
            }
        });
    });

    // ===== CREATE PROFILE (LOCAL FALLBACK) =====
    // Removed local profile creation helpers as they are now in add-profile-modal.js

    // Event: ProfileType changed — load dynamic metadata fields
    $('#profileType').on('change', function () {
        const profileTypeId = $(this).val();

        if (!profileTypeId) {
            $('#dynamicMetadataFields').hide();
            $('#metadataFieldsContainer').empty();
            return;
        }

        // Load metadata fields for selected ProfileType from backend API
        $.ajax({
            url: '/FileManager/Storage/GetProfileMetadataFields',
            type: 'GET',
            data: { profileTypeId: profileTypeId },
            success: function (fields) {
                if (fields && Array.isArray(fields) && fields.length > 0) {
                    renderDynamicMetadataFields(fields);
                    $('#dynamicMetadataFields').show();
                } else {
                    // No dynamic fields for this ProfileType
                    $('#dynamicMetadataFields').hide();
                    $('#metadataFieldsContainer').empty();
                }
            },
            error: function (xhr, status, error) {
                console.error('Error loading metadata fields:', error, xhr.responseText);
                // Graceful degradation - continue without metadata fields
                $('#dynamicMetadataFields').hide();
                $('#metadataFieldsContainer').empty();
            }
        });
    });

    // Render dynamic metadata fields based on ProfileType definition
    function renderDynamicMetadataFields(fields) {
        let html = '';
        const fieldsToInit = []; // Track fields that need dynamic loading

        fields.forEach(function (field) {
            // Support both camelCase and PascalCase from backend
            const fieldName = field.fieldName || field.FieldName;
            const fieldLabel = field.displayLabel || field.DisplayLabel || field.fieldLabel || field.FieldLabel;
            let fieldType = field.dataType || field.DataType || field.fieldType || field.FieldType || 'text';
            fieldType = fieldType.toLowerCase(); // ✅ NORMALIZE to lowercase (match Edit mode)

            const isRequired = field.isRequired !== undefined ? field.isRequired : (field.IsRequired !== undefined ? field.IsRequired : false);
            const placeholder = field.placeholder || field.Placeholder || '';
            const maxLength = field.maxLength || field.MaxLength || 500;
            const selectOptions = field.selectOptions || field.SelectOptions; // JSON string for fixed options
            const listOptions = field.listOptions || field.ListOptions;       // JSON string for dynamic options

            // Validate required fields
            if (!fieldName) {
                console.error('[Create] Field missing fieldName:', field);
                return; // Skip this field
            }
            if (!fieldLabel) {
                console.error('[Create] Field missing fieldLabel:', field);
                return; // Skip this field
            }

            const colClass = (fieldType === 'textarea' || fieldType === 'multiselect') ? 'col-md-12' : 'col-md-6';
            const required = isRequired ? '<span class="text-danger">*</span>' : '';
            const requiredAttr = isRequired ? 'required' : '';

            html += `<div class="${colClass}">`;
            html += `<div class="form-group mb-3">`;

            // Checkbox/Boolean special layout
            if (fieldType === 'boolean') {
                html += `<div class="form-check form-switch pt-4">
                            <input class="form-check-input metadata-field" type="checkbox" id="meta_${fieldName}" 
                                   data-field-name="${fieldName}" style="cursor: pointer;">
                            <label class="form-check-label demo-label-small ms-2" for="meta_${fieldName}">${fieldLabel} ${required}</label>
                         </div>`;
            } else {
                html += `<label for="meta_${fieldName}" class="demo-label-small">${fieldLabel} ${required}</label>`;

                if (['text', 'string', 'tag'].includes(fieldType)) {
                    html += `<input type="text" class="input-figma metadata-field" id="meta_${fieldName}" 
                             data-field-name="${fieldName}" placeholder="${placeholder}" 
                             style="height: 38px; font-size: 14px; width: 100%;" 
                             maxlength="${maxLength}" ${requiredAttr} />`;
                } else if (['number', 'integer'].includes(fieldType)) {
                    const stepAttr = (fieldType === 'number') ? 'step="any"' : 'step="1"';
                    html += `<input type="number" class="input-figma metadata-field" id="meta_${fieldName}" 
                             data-field-name="${fieldName}" placeholder="${placeholder}" 
                             style="height: 38px; font-size: 14px; width: 100%;" ${stepAttr} ${requiredAttr} />`;
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
                    const isMulti = (fieldType === 'MultiSelect' || fieldType === 'multiselect');
                    const multiAttr = isMulti ? 'multiple="multiple"' : '';

                    html += `<select class="select-figma metadata-field dropdown-metadata" id="meta_${fieldName}" 
                             data-field-name="${fieldName}" ${multiAttr} ${requiredAttr} style="width: 100%;">
                             <option value="">-- Chọn ${fieldLabel} --</option>`;

                    // Xác định cấu hình nạp động (ListOptions hoặc SelectOptions nếu là mã/ID)
                    let dynamicConfig = listOptions;
                    let looksLikeDynamic = false;

                    // Xử lý drop cứng (SelectOptions)
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
                                // Nếu là object đơn lẻ có CategoryCode/Endpoint
                                looksLikeDynamic = true;
                                dynamicConfig = selectOptions;
                            }
                        } catch (e) {
                            // Nếu không phải JSON nhưng có giá trị, có thể là CategoryCode hoặc CategoryTypeId
                            if (typeof selectOptions === 'string' && selectOptions.trim().length > 0 && selectOptions !== 'null') {
                                looksLikeDynamic = true;
                                if (!dynamicConfig) dynamicConfig = selectOptions;
                            }
                        }
                    }

                    html += `</select>`;

                    // Mark for dynamic loading if dynamicConfig present OR if fieldType is a MasterData/Select type
                    if (dynamicConfig || looksLikeDynamic || ['select', 'multiselect', 'departments', 'warehouses', 'shelves', 'racks', 'boxes'].includes(fieldType)) {
                        // Store element ID for later loading (AFTER HTML is appended to DOM)
                        // Pass ORIGINAL field type (not lowercased) for loadDynamicMetadataOptions switch/case
                        const originalFieldType = field.dataType || field.DataType || field.fieldType || field.FieldType || 'text';
                        fieldsToInit.push({ fieldName: fieldName, config: dynamicConfig, type: originalFieldType });
                    }
                } else {
                    // Default to text input for unknown types
                    html += `<input type="text" class="input-figma metadata-field" id="meta_${fieldName}" 
                             data-field-name="${fieldName}" placeholder="${placeholder}" 
                             style="height: 38px; font-size: 14px; width: 100%;" 
                             maxlength="${maxLength}" ${requiredAttr} />`;
                }
            }

            html += `</div></div>`;
        });

        if (!html) {
            console.warn('[Create] No metadata fields to render');
            $('#metadataFieldsContainer').empty();
            return;
        }

        // Clean up old Select2 instances before replacing HTML to prevent zombie dropdowns
        if ($('#metadataFieldsContainer').length) {
            $('#metadataFieldsContainer .select2-hidden-accessible').each(function () {
                try { $(this).select2('destroy'); } catch (e) { }
            });
        }
        $('#metadataFieldsContainer').html(html);

        // Initialize Select2 for metadata dropdowns with standard delay
        setTimeout(function () {
            if (fieldsToInit && fieldsToInit.length > 0) {
                fieldsToInit.forEach(function (field) {
                    const $elem = $(`#meta_${field.fieldName}`);
                    if ($elem.length > 0) {
                        const promise = window.fileManagerEditNode.loadDynamicMetadataOptions($elem, field.config, field.type);
                        if (promise) dynamicLoadPromises.push(promise);
                    } else {
                        console.warn(`[Create Init] Element #meta_${field.fieldName} not found`);
                    }
                });
            }

            // After loading options, initialize Select2 for all dropdowns
            $.when.apply($, dynamicLoadPromises).always(function () {
                setTimeout(function () {
                    $('#metadataFieldsContainer .dropdown-metadata').each(function () {
                        initSelect2ForElement($(this));
                    });
                }, SELECT2_INIT_DELAY);
            });
        }, SELECT2_INIT_DELAY);
    }


    // ===== SELECT2 INITIALIZATION - SIMPLIFIED & FIXED =====
    // Helper: Select2 init - Simplified version without backdrop manipulation
    function initSelect2ForElement(element) {
        if (window.fileManagerEditNode && typeof window.fileManagerEditNode.initSelect2ForElement === 'function') {
            window.fileManagerEditNode.initSelect2ForElement(element);
        } else {
            if (element.hasClass('select2-hidden-accessible')) return;
            element.select2({ width: '100%', placeholder: '-- Chọn --', allowClear: true });
        }
    }

    function loadDynamicMetadataOptions(selectElement, optionsConfig, fieldType) {
        if (window.fileManagerEditNode && typeof window.fileManagerEditNode.loadDynamicMetadataOptions === 'function') {
            return window.fileManagerEditNode.loadDynamicMetadataOptions(selectElement, optionsConfig, fieldType);
        }
        return $.Deferred().resolve().promise();
    }


    // Collect dynamic metadata fields from the form
    function collectMetadataFieldsAsObject() {
        const metadata = {};
        $('.metadata-field').each(function () {
            const fieldName = $(this).data('field-name');
            const value = $(this).val();
            if (value) {
                metadata[fieldName] = value;
            }
        });
        return metadata;
    }

    $('#btnCreateProfile').on('click', function () {
        const node = selectedNode;
        const dataObj = node ? (node.data || (node.original && node.original.data) || {}) : { nodeType: 'ROOT' };
        
        // Cần quyền Upload để tạo hồ sơ
        const isSuperAdmin = dataObj.myPermission?.isSuperAdmin === true;
        let canUpload = isSuperAdmin || dataObj.myPermission?.canUpload === true || dataObj.myPermission?.CanUpload === true;

        // Fallback for Root or no selection
        if (!selectedNode || selectedNode.id === '#') {
            canUpload = window.userPermissions?.canCreate === true;
        }

        if (!canUpload) {
            toastr.warning('Bạn không có quyền tạo hồ sơ tại đây');
            return;
        }

        // Determine parentId: Use selectedNode.id if valid, otherwise fallback to rootNodeId
        // IMPORTANT: Never pass '#' to modal, always use rootNodeId for root level
        let parentId;
        if (selectedNode && selectedNode.id && selectedNode.id !== '#') {
            parentId = selectedNode.id;
        } else {
            parentId = rootNodeId;
        }

        if (!parentId) {
            toastr.error('Không xác định được vị trí tạo hồ sơ');
            return;
        }

        console.log('[Storage] CreateProfile button clicked. SelectedNode:', selectedNode?.id, 'ParentId:', parentId, 'IsRoot:', !selectedNode || selectedNode.id === '#');

        if (typeof window.openCreateProfileModal === 'function') {
            window.openCreateProfileModal(parentId, {
                onSuccess: function () {
                    const tree = $('#storageTree').jstree(true);
                    if (selectedNode && selectedNode.id !== '#') {
                        tree.refresh_node(selectedNode);
                    } else {
                        tree.refresh();
                    }
                    loadContentList(selectedNode);
                }
            });
        } else {
            toastr.error('Không tìm thấy chức năng tạo hồ sơ dùng chung');
        }
    });

    // ===== UPLOAD DOCUMENT - MULTI-FILE (LOCAL FALLBACK) =====
    // Removed local upload document helpers as they are now in upload-document-modal.js

    $('#btnUploadDocument').on('click', function () {
        const node = selectedNode;
        const dataObj = node ? (node.data || (node.original && node.original.data) || {}) : { nodeType: 'ROOT' };
        
        // Cần quyền Upload để upload tài liệu
        const isSuperAdmin = dataObj.myPermission?.isSuperAdmin === true;
        let canUpload = isSuperAdmin || dataObj.myPermission?.canUpload === true || dataObj.myPermission?.CanUpload === true;

        // Fallback for Root or no selection
        if (!selectedNode || selectedNode.id === '#') {
            canUpload = window.userPermissions?.canCreate === true;
        }

        if (!canUpload) {
            toastr.warning('Bạn không có quyền upload tại đây');
            return;
        }

        // Determine parentId: Use selectedNode.id if valid, otherwise fallback to rootNodeId
        // IMPORTANT: Never pass '#' to modal, always use rootNodeId for root level
        let parentId;
        if (selectedNode && selectedNode.id && selectedNode.id !== '#') {
            parentId = selectedNode.id;
        } else {
            parentId = rootNodeId;
        }

        if (!parentId) {
            toastr.error('Không xác định được vị trí upload tài liệu');
            return;
        }

        console.log('[Storage] Upload button clicked. SelectedNode:', selectedNode?.id, 'ParentId:', parentId, 'IsRoot:', !selectedNode || selectedNode.id === '#');

        // Check node type - allow upload to ROOT, FOLDER, or PROFILE
        if (selectedNode) {
            const dataObj = selectedNode.data || (selectedNode.original && selectedNode.original.data) || {};
            if (dataObj.nodeType === 'TAI_LIEU') {
                toastr.warning('Không thể upload vào tài liệu. Vui lòng chọn kho, thư mục hoặc hồ sơ.');
                return;
            }
        }

        // Use shared upload modal
        if (typeof window.openUploadDocumentModal === 'function') {
            window.openUploadDocumentModal(parentId, {
                onSuccess: function () {
                    const tree = $('#storageTree').jstree(true);
                    if (selectedNode && selectedNode.id !== '#') {
                        tree.refresh_node(selectedNode.id);
                    } else {
                        tree.refresh();
                    }
                    loadContentList(selectedNode);
                }
            });
        } else {
            toastr.error('Chức năng upload chưa được tải. Vui lòng tải lại trang.');
        }
    });

    // ===== OLD SINGLE-FILE UPLOAD (DEPRECATED - Kept for backward compatibility) =====
    $('#btnConfirmUpload').on('click', function () {
        const fileInput = document.getElementById('documentFile');
        const file = fileInput.files[0];

        if (!file) {
            toastr.warning('Vui lòng chọn file');
            return;
        }

        let formParentId = $('#documentParentId').val();
        if (formParentId === '#' || !formParentId) formParentId = rootNodeId;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('parentId', formParentId);

        // Thêm DocumentTypeId nếu có chọn
        const documentTypeId = $('#documentType').val();
        if (documentTypeId) {
            formData.append('documentTypeId', documentTypeId);
        }

        formData.append('documentCode', $('#documentCode').val());
        formData.append('documentTitle', $('#documentTitle').val());

        // LƯU Ý: Không gửi metadata khi upload, metadata sẽ cập nhật sau khi preview

        // Show progress bar
        $('#uploadProgress').removeClass('d-none');
        $('#uploadProgress .progress-bar').css('width', '0%').text('0%');

        $.ajax({
            url: '/FileManager/Storage/UploadDocument',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: { 'RequestVerificationToken': token },
            xhr: function () {
                const xhr = new window.XMLHttpRequest();
                xhr.upload.addEventListener('progress', function (e) {
                    if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded / e.total) * 100);
                        $('#uploadProgress .progress-bar')
                            .css('width', percentComplete + '%')
                            .text(percentComplete + '%');
                    }
                }, false);
                return xhr;
            },
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(response.message || 'Upload tài liệu thành công');
                    $('#uploadDocumentModal').modal('hide');
                    const actualParentId = $('#documentParentId').val();

                    // Refresh tree and content list
                    const treeParentId = actualParentId === rootNodeId ? '#' : actualParentId;
                    refreshTree(treeParentId);

                    // Always refresh content list if currently viewing parent
                    if (!selectedNode || selectedNode.id === '#' || selectedNode.id === treeParentId) {
                        loadContentList(selectedNode || { id: '#', original: { data: { name: warehouseName, nodeType: 'ROOT' } } });
                    }
                } else {
                    toastr.error(response.message || 'Không thể upload tài liệu');
                }
            },
            error: function (xhr, status, error) {
                console.error('Error uploading document:', error);
                toastr.error('Lỗi khi upload tài liệu');
            },
            complete: function () {
                $('#uploadProgress').addClass('d-none');
            }
        });
    });

    // Event: EditProfileType changed — load dynamic metadata fields
    $('#editProfileType').on('change', function () {
        const profileTypeId = $(this).val();

        if (!profileTypeId) {
            $('#editDynamicMetadataFields').hide();
            $('#editMetadataFieldsContainer').empty();
            return;
        }

        // Load metadata fields for selected ProfileType
        $.ajax({
            url: '/FileManager/Storage/GetProfileMetadataFields',
            type: 'GET',
            data: { profileTypeId: profileTypeId },
            success: function (fields) {
                if (fields && Array.isArray(fields) && fields.length > 0) {
                    renderEditDynamicMetadataFields(fields);
                    $('#editDynamicMetadataFields').show();
                } else {
                    $('#editDynamicMetadataFields').hide();
                    $('#editMetadataFieldsContainer').empty();
                }
            },
            error: function () {
                $('#editDynamicMetadataFields').hide();
                $('#editMetadataFieldsContainer').empty();
            }
        });
    });

    // renderEditDynamicMetadataFields, collectEditMetadataFieldsAsObject, populateEditMetadataFields 
    // are now handled by edit-node-modal.js to ensure consistency across all views.


    // Collect edit metadata fields into Object
    // Removed collectEditMetadataFieldsAsObject - handled by edit-node-modal.js


    // Collect edit metadata fields into JSON string (Legacy support)
    function collectEditMetadataFieldsAsJson() {
        const metadata = collectEditMetadataFieldsAsObject();
        return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
    }

    // Populate edit metadata fields with existing values
    function populateEditMetadataFields(metaValue, loadingPromises) {

        if (!metaValue) {
            return;
        }

        let metadata = metaValue;
        if (typeof metaValue === 'string') {
            try {
                metadata = JSON.parse(metaValue);
            } catch (e) {
                console.error('[Populate] Failed to parse metadata string:', e, metaValue);
                return;
            }
        }

        if (metadata && typeof metadata === 'object') {
            // NO waiting for promises - they should already be resolved
            Object.keys(metadata).forEach(function (fieldName) {
                const fieldId = `#edit_meta_${fieldName}`;
                const $field = $(fieldId);

                if ($field.length > 0) {
                    const val = metadata[fieldName];

                    if ($field.is(':checkbox')) {
                        $field.prop('checked', val === true || val === 'true');
                    } else {
                        // Set value
                        $field.val(val);

                        // Trigger change event
                        if ($field.hasClass('select2-hidden-accessible')) {
                            $field.trigger('change.select2');
                        } else if ($field.is('select')) {
                            $field.trigger('change');
                        }
                    }
                } else {
                    console.warn(`[Populate] Field ${fieldId} not found, trying case-insensitive...`);

                    // Try case-insensitive search
                    const $altField = $('#editMetadataFieldsContainer [data-field-name]').filter(function () {
                        return $(this).attr('data-field-name').toLowerCase() === fieldName.toLowerCase();
                    });

                    if ($altField.length > 0) {
                        const val = metadata[fieldName];
                        if ($altField.is(':checkbox')) {
                            $altField.prop('checked', val === true || val === 'true');
                        } else {
                            $altField.val(val);
                            if ($altField.hasClass('select2-hidden-accessible')) {
                                $altField.trigger('change.select2');
                            } else if ($altField.is('select')) {
                                $altField.trigger('change');
                            }
                        }
                    } else {
                        console.error(`[Populate] Field ${fieldName} not found anywhere in DOM`);
                    }
                }
            });
        }
    }

    // ===== EDIT NODE =====
    function openEditNodeModal(node) {
        if (typeof window.openEditNodeModal === 'function') {
            window.openEditNodeModal(node, {
                onSuccess: function () {
                    refreshTree(node.id);
                    loadContentList(selectedNode);
                }
            });
        } else {
            toastr.error('Tính năng chỉnh sửa chưa được tải. Vui lòng tải lại trang.');
        }
    }

    $('#btnEditNode').on('click', function () {
        if (!selectedNode) {
            toastr.warning('Vui lòng chọn node cần sửa');
            return;
        }

        const dataObj = selectedNode.data || (selectedNode.original && selectedNode.original.data) || {};
        if (dataObj.nodeType === 'TAI_LIEU') {
            window.open(`/FileManager/Storage/DocumentView/${selectedNode.id}`, '_blank');
            return;
        }

        openEditNodeModal(selectedNode);
    });

    // Redundant btnConfirmEdit handled by edit-node-modal.js

    // ===== DOCUMENT VIEW (opens in new tab) =====

    // ===== DELETE NODE =====
    // Unified helper to show delete modal
    function openDeleteModal(id, name, parentId = null) {
        $('#deleteNodeName').text(name);
        $('#deleteNodeId').val(id);
        $('#confirmDeleteModal').data('parent-id', parentId);
        $('#confirmDeleteModal').modal('show');
    }

    // Trigger from Tree
    $('#btnDeleteNode').on('click', function () {
        if (!selectedNode) {
            toastr.warning('Vui lòng chọn node cần xóa');
            return;
        }

        // Check permission: Use node permission if available, fallback to module permission
        const dataObj = selectedNode.data || (selectedNode.original && selectedNode.original.data) || {};
        const perm = dataObj.myPermission || {};
        const hasNodePermission = perm.canView !== undefined;

        let canDelete;
        if (hasNodePermission) {
            canDelete = perm.canDelete === true || perm.isSuperAdmin === true;
        } else {
            // Fallback to module permission
            canDelete = window.userPermissions?.canDelete === true;
        }

        if (!canDelete) {
            toastr.error('Bạn không có quyền xóa mục này');
            return;
        }

        const nodeData = selectedNode.original.data;
        openDeleteModal(nodeData.id, nodeData.name, selectedNode.parent);
    });

    // Trigger from Content List (Table)
    $(document).on('click', '.btn-delete-content', function (e) {
        e.stopPropagation();
        const id = $(this).data('id');
        const name = $(this).data('name');
        // Parent is the current directory we're looking at
        const parentId = selectedNode ? selectedNode.id : null;
        openDeleteModal(id, name, parentId);
    });

    // Unified Confirm Delete Action
    $('#btnConfirmDelete').off('click').on('click', function () {
        const nodeId = $('#deleteNodeId').val();
        const parentId = $('#confirmDeleteModal').data('parent-id');

        if (!nodeId) {
            toastr.error('Không xác định được node cần xóa');
            return;
        }

        const $btn = $(this);
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xóa...');

        $.ajax({
            url: `/FileManager/Storage/Delete/${nodeId}`,
            type: 'DELETE',
            headers: { 'RequestVerificationToken': token },
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(response.message || 'Xóa thành công');
                    $('#confirmDeleteModal').modal('hide');

                    // Refresh Tree
                    if (parentId && parentId !== '#') {
                        refreshTree(parentId);
                    } else if (selectedNode) {
                        refreshTree(selectedNode.id);
                    } else {
                        refreshTree('#');
                    }

                    // Refresh Content List (Re-load current folder)
                    if (selectedNode) {
                        loadContentList(selectedNode);
                    }
                } else {
                    toastr.error(response.message || 'Không thể xóa');
                }
            },
            error: function (xhr) {
                handleAjaxError(xhr, 'Lỗi khi xóa tài liệu');
            },
            complete: function () {
                $btn.prop('disabled', false).text('Xóa');
            }
        });
    });

    // ===== PERMISSION MANAGEMENT =====

    // ===== PERMISSION MODAL LOGIC =====
    // NOTE: Permission modal logic has been moved to permission-modal.js (shared between Warehouses and Storage pages)
    // window.openPermissionModal is now exposed by permission-modal.js
    // All event handlers for permission modal are handled in permission-modal.js to avoid duplication

    // ===== CONTENT LIST ACTION HANDLERS =====

    // Permission button handler
    $(document).on('click', '.btn-permission-content', function (e) {
        e.stopPropagation();
        const nodeId = $(this).data('id');
        const nodeName = $(this).data('name') || 'Node';
        const nodeType = $(this).data('node-type');
        
        // Use shared permission modal
        if (typeof window.openPermissionModal === 'function') {
            window.openPermissionModal(nodeId, nodeName, nodeType);
        } else {
            toastr.error('Chức năng phân quyền chưa được tải. Vui lòng tải lại trang.');
        }
    });

    // View document - Open in new tab
    $(document).on('click', '.btn-view-document', function (e) {
        e.stopPropagation();
        const documentId = $(this).data('id');
        window.open(`/FileManager/Storage/DocumentView/${documentId}`, '_blank');
    });

    // Download document
    $(document).on('click', '.btn-download-document', function (e) {
        e.stopPropagation();
        const documentId = $(this).data('id');
        $.ajax({
            url: `/FileManager/Storage/Download/${documentId}`,
            type: 'GET',
            success: function (response) {
                if (response.isSuccess && response.downloadUrl) {
                    toastr.success('Bắt đầu tải xuống...');
                    window.open(response.downloadUrl, '_blank');
                } else {
                    toastr.error(response.message || 'Không thể lấy link tải xuống');
                }
            },
            error: function (xhr) {
                handleAjaxError(xhr, 'Lỗi khi tải tài liệu');
            }
        });
    });

    // Edit content (from row)
    $(document).on('click', '.btn-edit-content', function (e) {
        e.stopPropagation();
        const nodeId = $(this).data('id');
        const nodeType = $(this).data('node-type');

        if (nodeType === 'TAI_LIEU') {
            // Document detail view - Go directly to Edit mode
            window.open(`/FileManager/Storage/DocumentView/${nodeId}?mode=edit`, '_blank');
        } else {
            // Node (Folder/Profile) edit modal
            openEditNodeModal({ id: nodeId, nodeType: nodeType });
        }
    });

    // ===== HELPERS =====
    function refreshTree(nodeId) {
        const tree = $('#storageTree').jstree(true);
        if (!tree) return;

        const targetNodeId = nodeId || '#';
        if (targetNodeId === '#' || !targetNodeId) {
            tree.refresh();
        } else {
            tree.refresh_node(targetNodeId);
        }

        // Fix F5 issue: Always reload content list after a tree refresh 
        // if we are currently viewing that folder or the root.
        const currentSelectedId = selectedNode ? selectedNode.id : (rootNodeId || '#');
        if (currentSelectedId === targetNodeId || (targetNodeId === '#' && currentSelectedId === rootNodeId)) {
            loadContentList(selectedNode);
        }
    }

    function handleAjaxError(xhr, defaultMsg) {
        let msg = defaultMsg;
        try {
            if (xhr.responseText) {
                const response = JSON.parse(xhr.responseText);
                if (response && response.message) {
                    msg = response.message;
                }
            }
        } catch (e) {
            console.error('Error parsing AJAX error response:', e);
        }
        toastr.error(msg, 'Lỗi');
    }

    // ===== MODAL EVENT HANDLERS =====
    // Initialize modal state when shown (simplified - no backdrop manipulation)
    $('#createProfileModal, #editNodeModal, #uploadDocumentModal').on('shown.bs.modal', function () {
        const $modal = $(this);
    });

    // Cleanup Select2 when modals are closed
    $('#createProfileModal, #editNodeModal, #uploadDocumentModal').on('hidden.bs.modal', function () {
        const $modal = $(this);

        // Destroy all Select2 instances and clear init flags
        $modal.find('.select2-hidden-accessible').each(function () {
            "use strict";
            try {
                $(this).select2('destroy');
                $(this).removeData('select2-initialized');
            } catch (e) {
                console.warn('[Modal] Error destroying Select2:', e);
            }
        });

        // Clear dynamic metadata containers
        if ($modal.attr('id') === 'createProfileModal') {
            $('#metadataFieldsContainer').empty();
            $('#dynamicMetadataFields').hide();
        } else if ($modal.attr('id') === 'editNodeModal') {
            $('#editMetadataFieldsContainer').empty();
            $('#editDynamicMetadataFields').hide();
        }
    });

    // Prevent modal from interfering with Select2
    $(document).on('select2:open', function (e) {
        const $target = $(e.target);
        const $modal = $target.closest('.modal');

        if ($modal.length > 0) {
            // Ensure dropdown is above modal backdrop
            $('.select2-container--open').css('z-index', 10050);
            $('.select2-dropdown').css('z-index', 10050);
        }
    });

    // Prevent modal clicks from closing Select2 dropdown
    $(document).on('mousedown', '.modal.show', function (e) {
        const $modal = $(this);

        // If modal has open select2, prevent clicks from bubbling unless clicking outside select2 to close it
        if ($modal.hasClass('has-select2-open')) {
            // If clicking on select2 elements, allow it
            if ($(e.target).closest('.select2-dropdown, .select2-container, .select2-selection').length > 0) {
                // Allow select2 to handle this
                return;
            }

            // If clicking elsewhere in modal while select2 is open, close the select2 but DON'T close modal
            const $openSelect = $modal.find('.select2-hidden-accessible').filter(function () {
                return $(this).data('select2') && $(this).data('select2').isOpen();
            });

            if ($openSelect.length > 0) {
                $openSelect.select2('close');
                e.stopPropagation();
                return false;
            }
        }
    });

    // Prevent clicks on Select2 dropdown from propagating to modal
    $(document).on('mousedown click', '.select2-container--open .select2-dropdown, .select2-container--open', function (e) {
        e.stopPropagation();
    });

    // Additional protection: prevent modal backdrop clicks when select2 is open
    $(document).on('click', '.modal-backdrop', function (e) {
        const hasOpenSelect2 = $('.modal.show.has-select2-open').length > 0;
        if (hasOpenSelect2) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
        }
    });
});
