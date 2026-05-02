/**
 * warehouses-list.js
 * DataTables for FileManager Warehouses List + Initialize Warehouse modal
 */

$(document).ready(function () {
    // CSRF Token for AJAX requests
    const token = $('input[name="__RequestVerificationToken"]').val();

    // Initialize Filters
    if (typeof Utils !== 'undefined' && typeof Utils.RenderSelect2Ajax === 'function') {
        Utils.RenderSelect2Ajax($('.frame-filter'));
    }

    if ($.fn.select2) {
        $('.select2-modern').select2({
            theme: 'bootstrap4',
            placeholder: $(this).data('placeholder'),
            allowClear: true
        });
    }

    // DataTables initialization
    const table = $('#warehousesTable').dataTableFigma({
        ajax: {
            url: '/FileManager/FileManagerWarehouses/GetAll',
            type: 'GET',
            data: function (d) {
                return {
                    keyword: $('#customSearchInput').val(),
                    departmentId: $('#filterDepartmentId').val(),
                    status: $('#filterStatus').val()
                };
            },
            dataSrc: function (response) {
                if (response.error) {
                    toastr.error(response.error);
                    return [];
                }
                return response || [];
            },
            error: function (xhr, status, error) {
                console.error('Error loading warehouses:', error);
                toastr.error('Lỗi khi tải danh sách kho');
            }
        },
        columns: [
            {
                data: null,
                render: function (data, type, row, meta) {
                    return meta.row + 1;
                }
            },
            { 
                data: 'code',
                render: function(data) { return '<span class="font-weight-bold" style="color: var(--primary);">' + data + '</span>'; } 
            },
            { data: 'name' },
            { data: 'departmentName', defaultContent: '—' },
            { data: 'description', defaultContent: '—' },
            {
                data: 'folderCount',
                className: 'text-center',
                defaultContent: '0'
            },
            {
                data: 'profileCount',
                className: 'text-center',
                defaultContent: '0'
            },
            {
                data: 'status',
                className: 'text-center',
                render: function (data) {
                    if (data === 'Active' || data === 1) {
                        return '<span class="badge-figma badge-figma-success">Hoạt động</span>';
                    }
                    return '<span class="badge-figma badge-figma-secondary">Không hoạt động</span>';
                }
            },
            {
                data: 'createdAt',
                render: function (data) {
                    if (!data) return '—';
                    const date = new Date(data);
                    return date.toLocaleDateString('vi-VN');
                }
            },
            { data: 'createdBy', defaultContent: '—' },
            {
                data: null,
                orderable: false,
                className: 'text-center',
                render: function (data, type, row) {
                    const perm = row.permission || {};
                    let html = '<div class="table-actions-figma" style="justify-content: center; gap: 4px;">';
                    
                    // View Storage (primary action - icon only)
                    if (perm.canView) {
                        html += `<a href="/FileManager/Storage?warehouseId=${row.id}&rootNodeId=${row.rootNodeId}" 
                                    class="btn-action-figma btn-action-primary" title="Xem thư mục trong kho">
                                    <i class="fas fa-folder-tree"></i>
                                 </a>`;
                    }

                    // Edit
                    /*if (perm.canEdit) {
                        html += `<button class="btn-action-figma btn-action-warning btn-edit-warehouse" 
                                    data-id="${row.id}" title="Sửa thông tin kho">
                                    <i class="fas fa-edit"></i>
                                 </button>`;
                    }*/

                    // Permissions
                    if (perm.canShare || perm.isFullControl) {
                        html += `<button class="btn-action-figma btn-action-info btn-permissions-warehouse" 
                                    data-id="${row.id}" data-name="${row.name}" data-root-node-id="${row.rootNodeId}" title="Phân quyền">
                                    <i class="fas fa-user-shield"></i>
                                 </button>`;
                    }

                    html += '</div>';
                    return html;
                }
            }
        ],
        dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/vi.json'
        },
        order: [[9, 'desc']], // Sort by CreatedAt descending
        pageLength: 20,
        responsive: false,
        autoWidth: false,
        drawCallback: function (settings) {
            if (window.FigmaDataTables && window.FigmaDataTables.defaultConfig) {
                window.FigmaDataTables.defaultConfig.drawCallback(settings);
            }
            // Renumber STT by visual display order
            var startIndex = settings._iDisplayStart;
            $(settings.nTable).find('tbody tr').each(function (i) {
                if ($(this).find('td.dataTables_empty').length) return;
                $(this).find('td:first-child').text(startIndex + i + 1);
            });

            var $container = $('.pagination-figma-container');
            if ($container.length && $('#paginationFrame').length) {
                $container.appendTo('#paginationFrame');
            }

            var totalRecords = settings._iRecordsDisplay || 0;
            if (totalRecords === 0) {
                $('#paginationFrame').hide();
            } else {
                $('#paginationFrame').show();
            }
        }
    });

    // Filter Event Listeners
    let filterTimeout;
    $('#customSearchInput').on('keyup', function () {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(function () {
            table.ajax.reload();
        }, 500); // 500ms debounce
    });

    $('#filterDepartmentId, #filterStatus').on('change', function () {
        table.ajax.reload();
    });

    // Button: Initialize Warehouse (Load modal)
    $('#btnInitializeWarehouse').on('click', function () {
        loadNotInitializedWarehouses();
    });

    // Load not-initialized warehouses for dropdown
    function loadNotInitializedWarehouses() {
        $.ajax({
            url: '/FileManager/FileManagerWarehouses/GetNotInitialized',
            type: 'GET',
            success: function (response) {
                if (response.error) {
                    toastr.error(response.error);
                    return;
                }

                const select = $('#selectWarehouse');
                select.empty();
                select.append('<option value="">-- Chọn kho --</option>');

                if (Array.isArray(response) && response.length > 0) {
                    response.forEach(function (warehouse) {
                        select.append(`<option value="${warehouse.id}" data-name="${warehouse.name}">${warehouse.code} - ${warehouse.name}</option>`);
                    });
                    $('#initializeWarehouseModal').modal('show');
                } else {
                    toastr.info('Tất cả các kho đã được khởi tạo');
                }
            },
            error: function (xhr, status, error) {
                console.error('Error loading not-initialized warehouses:', error);
                toastr.error('Lỗi khi tải danh sách kho chưa khởi tạo');
            }
        });
    }

    // Button: Confirm Initialize
    $('#btnConfirmInitialize').on('click', function () {
        const selectedOption = $('#selectWarehouse option:selected');
        const warehouseId = selectedOption.val();
        const warehouseName = selectedOption.data('name');

        if (!warehouseId) {
            toastr.warning('Vui lòng chọn kho');
            return;
        }

        const data = { 
            warehouseId: warehouseId,
            warehouseName: warehouseName
        };

        $.ajax({
            url: '/FileManager/FileManagerWarehouses/Initialize',
            type: 'POST',
            contentType: 'application/json',
            headers: {
                'RequestVerificationToken': token
            },
            data: JSON.stringify(data),
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(response.message || 'Khởi tạo kho thành công');
                    $('#initializeWarehouseModal').modal('hide');
                    table.ajax.reload();
                } else {
                    toastr.error(response.message || 'Không thể khởi tạo kho');
                }
            },
            error: function (xhr, status, error) {
                console.error('Error initializing warehouse:', error);
                toastr.error('Lỗi khi khởi tạo kho');
            }
        });
    });

    // === DELETE WAREHOUSE EVENT HANDLER (DISABLED) ===
    // Feature not implemented - requires backend cascade delete logic
    /*
    $(document).on('click', '.btn-delete-warehouse', function () {
        const warehouseId = $(this).data('id');
        const warehouseName = $(this).data('name');

        if (confirm(`Bạn có chắc chắn muốn xóa kho "${warehouseName}"?\n\nLưu ý: Tất cả dữ liệu lưu trữ trong kho sẽ bị xóa!`)) {
            $.ajax({
                url: `/FileManager/FileManagerWarehouses/Delete/${warehouseId}`,
                type: 'DELETE',
                headers: {
                    'RequestVerificationToken': token
                },
                success: function (response) {
                    if (response.isSuccess) {
                        toastr.success(response.message || 'Xóa kho thành công');
                        table.ajax.reload();
                    } else {
                        toastr.error(response.message || 'Không thể xóa kho');
                    }
                },
                error: function (xhr, status, error) {
                    console.error('Error deleting warehouse:', error);
                    toastr.error('Lỗi khi xóa kho');
                }
            });
        }
    });
    */

    // === EDIT WAREHOUSE ===
    $(document).on('click', '.btn-edit-warehouse', function () {
        const warehouseId = $(this).data('id');
        toastr.info('Chức năng đang phát triển - Backend API chưa sẵn sàng');
        // TODO: Open edit modal with warehouse data
        // $.get(`/FileManager/FileManagerWarehouses/GetById/${warehouseId}`, function(data) { ... });
    });

    // === PERMISSIONS WAREHOUSE ===
    $(document).on('click', '.btn-permissions-warehouse', function () {
        const warehouseId = $(this).data('id');
        const warehouseName = $(this).data('name');
        const rootNodeId = $(this).data('root-node-id');
        
        if (!rootNodeId) {
            toastr.error('Không tìm thấy rootNodeId của kho');
            return;
        }
        
        
        // Call global openPermissionModal function (from storage-management.js)
        if (typeof window.openPermissionModal === 'function') {
            window.openPermissionModal(rootNodeId, warehouseName);
        } else {
            toastr.error('Chức năng phân quyền chưa được load. Vui lòng thử lại.');
            console.error('openPermissionModal function not found on window object');
        }
    });

    // === EXPORT METADATA ===
    $(document).on('click', '.btn-export-metadata', function () {
        const warehouseId = $(this).data('id');
        toastr.info('Xuất metadata - Chức năng đang phát triển');
        // TODO: Download Excel/JSON metadata
        // window.location.href = `/FileManager/FileManagerWarehouses/ExportMetadata/${warehouseId}`;
    });
});
