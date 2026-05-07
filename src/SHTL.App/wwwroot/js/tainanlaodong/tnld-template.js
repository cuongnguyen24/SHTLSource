/**
 * TNLD Template JavaScript (M0148 - DataTable + upload modal + activate toggle)
 * Pattern: IIFE + DataTables + File upload + status toggle
 */
(function () {
    'use strict';

    const permissions = window.userPermissions || {};
    let table;

    $(document).ready(function () {
        initDataTable();
        initFilterBar();
        initUploadModal();
    });

    function initDataTable() {
        table = $('#templateTable').DataTable({
            serverSide: true,
            processing: true,
            ajax: {
                url: '/TaiNanLaoDongTemplate/GetAll',
                type: 'GET',
                data: function (d) {
                    d.page = Math.floor(d.start / d.length) + 1;
                    d.pageSize = d.length;
                    d.loaiMau = $('#filterLoaiMau').val();
                    d.isActive = $('#filterTrangThai').val();
                    
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
                    toastr.error('Lỗi khi tải dữ liệu');
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
                {
                    data: 'loaiMau',
                    render: function (data) {
                        const labels = {
                            'TNLD_PHIEU_XN': 'Phiếu xác nhận',
                            'TNLD_BC_TONG_HOP': 'Báo cáo tổng hợp'
                        };
                        return labels[data] || data;
                    }
                },
                {
                    data: 'fileName',
                    render: function (data, type, row) {
                        return `<a href="/TaiNanLaoDongTemplate/Download/${row.id}" target="_blank">
                            <i class="fas fa-file-download"></i> ${data}
                        </a>`;
                    }
                },
                { data: 'version' },
                {
                    data: 'fileSize',
                    render: function (data) {
                        return (data / 1024).toFixed(1) + ' KB';
                    },
                    className: 'text-right'
                },
                {
                    data: 'createdAt',
                    render: function (data) {
                        return new Date(data).toLocaleString('vi-VN');
                    }
                },
                { data: 'createdByName' },
                {
                    data: 'isActive',
                    render: function (data, type, row) {
                        if (permissions.canUpdate) {
                            const checked = data ? 'checked' : '';
                            return `<label class="switch">
                                <input type="checkbox" ${checked} onchange="toggleActive('${row.id}', this)">
                                <span class="slider round"></span>
                            </label>`;
                        } else {
                            return data ? '<span class="badge badge-success">Đang áp dụng</span>' 
                                        : '<span class="badge badge-secondary">Ngưng áp dụng</span>';
                        }
                    },
                    className: 'text-center'
                },
                {
                    data: null,
                    orderable: false,
                    render: function (data, type, row) {
                        let buttons = '';
                        
                        buttons += `<a href="/TaiNanLaoDongTemplate/Download/${row.id}" class="btn btn-sm btn-info" title="Tải xuống">
                            <i class="fas fa-download"></i>
                        </a> `;
                        
                        if (permissions.canDelete && !row.isActive) {
                            buttons += `<button onclick="deleteItem('${row.id}', '${row.fileName}')" class="btn btn-sm btn-danger" title="Xóa">
                                <i class="fas fa-trash"></i>
                            </button>`;
                        }
                        
                        return buttons;
                    }
                }
            ],
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/vi.json'
            }
        });
    }

    function initFilterBar() {
        $('#btnSearch').on('click', () => table.ajax.reload());
        $('#btnReset').on('click', function () {
            $('#filterLoaiMau').val('');
            $('#filterTrangThai').val('');
            table.ajax.reload();
        });
    }

    function initUploadModal() {
        $('#btnUpload').on('click', function () {
            $('#formUpload')[0].reset();
            $('#modalUpload').modal('show');
        });

        $('#btnUploadSubmit').on('click', function () {
            uploadTemplate();
        });

        $('#fileInput').on('change', function () {
            const file = this.files[0];
            if (file && file.size > 10 * 1024 * 1024) {
                toastr.error('File vượt quá 10 MB');
                $(this).val('');
                return;
            }
        });
    }

    function uploadTemplate() {
        const form = $('#formUpload');
        if (!form[0].checkValidity()) {
            form[0].reportValidity();
            return;
        }

        const formData = new FormData(form[0]);
        
        $.ajax({
            url: '/TaiNanLaoDongTemplate/Upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (response) {
                if (response.success) {
                    toastr.success(response.message || 'Đã tải lên mẫu biểu');
                    $('#modalUpload').modal('hide');
                    table.ajax.reload();
                } else {
                    toastr.error(response.message || 'Đã có lỗi');
                }
            },
            error: function () {
                toastr.error('Không thể kết nối đến máy chủ');
            }
        });
    }

    window.toggleActive = function (id, checkbox) {
        const isActive = $(checkbox).is(':checked');
        
        $.ajax({
            url: `/TaiNanLaoDongTemplate/Activate/${id}`,
            type: 'POST',
            data: JSON.stringify({ isActive: isActive }),
            contentType: 'application/json',
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (response) {
                if (response.success) {
                    toastr.success(isActive ? 'Đã kích hoạt mẫu biểu' : 'Đã ngưng áp dụng mẫu biểu');
                    table.ajax.reload(null, false);
                } else {
                    toastr.error(response.message || 'Đã có lỗi');
                    $(checkbox).prop('checked', !isActive);
                }
            },
            error: function () {
                toastr.error('Không thể kết nối đến máy chủ');
                $(checkbox).prop('checked', !isActive);
            }
        });
    };

    window.deleteItem = function (id, fileName) {
        if (!confirm(`Xóa mẫu biểu "${fileName}"?`)) return;
        
        $.ajax({
            url: `/TaiNanLaoDongTemplate/Delete/${id}`,
            type: 'POST',
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (response) {
                if (response.success) {
                    toastr.success('Đã xóa mẫu biểu');
                    table.ajax.reload(null, false);
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
