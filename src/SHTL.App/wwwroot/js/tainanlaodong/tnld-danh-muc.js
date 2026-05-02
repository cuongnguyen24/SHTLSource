/**
 * TNLD Danh mục JavaScript (M0146 - 5 tabs + modal CRUD per tab)
 * Pattern: IIFE + DataTables per tab + modal reusable
 */
(function () {
    'use strict';

    const permissions = window.userPermissions || {};
    let currentScope = 'TNLD_LOAI';
    let tables = {};

    $(document).ready(function () {
        initTabs();
        initModal();
    });

    function initTabs() {
        $('#danhMucTabs a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
            currentScope = $(e.target).data('scope');
            
            if (!tables[currentScope]) {
                initTableForScope(currentScope);
            } else {
                tables[currentScope].ajax.reload();
            }
        });

        currentScope = 'TNLD_LOAI';
        initTableForScope(currentScope);
    }

    function initTableForScope(scope) {
        const $table = $(`.danh-muc-table[data-scope="${scope}"]`);
        
        tables[scope] = $table.DataTable({
            serverSide: true,
            processing: true,
            ajax: {
                url: '/TaiNanLaoDongDanhMuc/GetByScope',
                type: 'GET',
                data: function (d) {
                    d.scope = scope;
                    d.page = Math.floor(d.start / d.length) + 1;
                    d.pageSize = d.length;
                    
                    delete d.start;
                    delete d.length;
                    delete d.columns;
                    delete d.order;
                },
                dataSrc: function (json) {
                    json.recordsTotal = json.totalCount || 0;
                    json.recordsFiltered = json.totalCount || 0;
                    return json.items || [];
                },
                error: function () {
                    toastr.error('Lỗi khi tải danh mục');
                }
            },
            columns: [
                {
                    data: null,
                    render: function (data, type, row, meta) {
                        return meta.row + meta.settings._iDisplayStart + 1;
                    },
                    orderable: false,
                    width: '50px'
                },
                { data: 'code', render: $.fn.dataTable.render.text() },
                { data: 'name', render: $.fn.dataTable.render.text() },
                { data: 'description', render: $.fn.dataTable.render.text() },
                { data: 'sortOrder', className: 'text-center' },
                {
                    data: 'isActive',
                    render: function (data) {
                        return data ? '<span class="badge badge-success">Hoạt động</span>' 
                                    : '<span class="badge badge-secondary">Vô hiệu</span>';
                    },
                    className: 'text-center'
                },
                {
                    data: null,
                    orderable: false,
                    render: function (data, type, row) {
                        let buttons = '';
                        
                        if (permissions.canUpdate) {
                            buttons += `<button onclick="editItem('${row.id}')" class="btn btn-sm btn-warning" title="Sửa">
                                <i class="fas fa-edit"></i>
                            </button> `;
                        }
                        
                        if (permissions.canDelete) {
                            buttons += `<button onclick="deleteItem('${row.id}', '${row.name}')" class="btn btn-sm btn-danger" title="Xóa">
                                <i class="fas fa-trash"></i>
                            </button>`;
                        }
                        
                        return buttons || '<span class="text-muted">-</span>';
                    }
                }
            ],
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/vi.json'
            }
        });
    }

    function initModal() {
        $('.btn-create-item').on('click', function () {
            const scope = $(this).data('scope');
            openModal(null, scope);
        });

        $('#btnSaveDanhMuc').on('click', function () {
            saveDanhMuc();
        });
    }

    function openModal(id, scope) {
        $('#formDanhMuc')[0].reset();
        $('#itemId').val(id || '');
        $('#itemScope').val(scope || currentScope);
        
        if (id) {
            $('#modalTitle').text('Cập nhật');
            loadItemDetails(id);
        } else {
            $('#modalTitle').text('Thêm mới');
        }
        
        $('#modalDanhMuc').modal('show');
    }

    function loadItemDetails(id) {
        $.ajax({
            url: `/TaiNanLaoDongDanhMuc/GetById/${id}`,
            type: 'GET',
            success: function (data) {
                $('#itemCode').val(data.code);
                $('#itemName').val(data.name);
                $('#itemDescription').val(data.description);
                $('#itemSortOrder').val(data.sortOrder);
                $('#itemIsActive').prop('checked', data.isActive);
            },
            error: function () {
                toastr.error('Lỗi khi tải thông tin');
            }
        });
    }

    function saveDanhMuc() {
        const formData = $('#formDanhMuc').serialize();
        const id = $('#itemId').val();
        const url = id ? `/TaiNanLaoDongDanhMuc/Update/${id}` : '/TaiNanLaoDongDanhMuc/Create';
        const method = id ? 'PUT' : 'POST';

        $.ajax({
            url: url,
            type: method,
            data: formData,
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (response) {
                if (response.success) {
                    toastr.success(response.message || 'Lưu thành công');
                    $('#modalDanhMuc').modal('hide');
                    const scope = $('#itemScope').val();
                    if (tables[scope]) {
                        tables[scope].ajax.reload(null, false);
                    }
                } else {
                    toastr.error(response.message || 'Đã có lỗi');
                }
            },
            error: function () {
                toastr.error('Không thể kết nối đến máy chủ');
            }
        });
    }

    window.editItem = function (id) {
        openModal(id, currentScope);
    };

    window.deleteItem = function (id, name) {
        if (!confirm(`Xóa "${name}"?`)) return;
        
        $.ajax({
            url: `/TaiNanLaoDongDanhMuc/Delete/${id}`,
            type: 'POST',
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (response) {
                if (response.success) {
                    toastr.success('Đã xóa');
                    if (tables[currentScope]) {
                        tables[currentScope].ajax.reload(null, false);
                    }
                } else {
                    toastr.error(response.message || 'Đã có lỗi');
                }
            },
            error: function () {
                toastr.error('Không thể kết nối đến máy chủ');
            }
        });
    };

})();
