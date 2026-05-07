(function () {
    'use strict';

    let table;
    let chipCounts = {};

    function initDataTable() {
        table = dataTableFigma('#gpmtTable', {
            ajax: {
                url: '/GiayPhepMoiTruong/GetAll',
                type: 'GET',
                data: function (d) {
                    d.search = $('#searchInput').val();
                    d.nam = $('#namInput').val() || null;
                    d.loaiGpmt = $('#loaiGpmtSelect').val();
                    d.trangThai = $('#trangThaiSelect').val();

                    const pageSize = d.length;
                    const page = Math.floor(d.start / pageSize) + 1;
                    d.page = page;
                    d.pageSize = pageSize;
                    delete d.start;
                    delete d.length;
                }
            },
            serverSide: true,
            columns: [
                {
                    data: null,
                    render: function (data, type, row, meta) {
                        return meta.row + meta.settings._iDisplayStart + 1;
                    },
                    orderable: false,
                    width: '50px'
                },
                { data: 'maHoSo', title: 'Mã hồ sơ' },
                { data: 'soGpmt', title: 'Số GPMT' },
                {
                    data: 'loaiGpmt',
                    title: 'Loại',
                    render: function (data) {
                        const badges = {
                            'CapMoi': '<span class="badge badge-info">Cấp mới</span>',
                            'CapLai': '<span class="badge badge-warning">Cấp lại</span>',
                            'CapDoi': '<span class="badge badge-secondary">Cấp đổi</span>'
                        };
                        return badges[data] || data;
                    }
                },
                { data: 'tenDonVi', title: 'Doanh nghiệp' },
                {
                    data: 'trangThai',
                    render: function (data) {
                        const badges = {
                            'DaTiepNhan': '<span class="badge badge-primary">Đã tiếp nhận</span>',
                            'DangThamDinh': '<span class="badge badge-info">Đang thẩm định</span>',
                            'DaDuyetNoiBo': '<span class="badge badge-success">Đã duyệt nội bộ</span>',
                            'ChoXacNhanOcr': '<span class="badge badge-warning">Chờ xác nhận OCR</span>',
                            'DaCap': '<span class="badge badge-success">Đã cấp</span>',
                            'YcBoSung': '<span class="badge badge-danger">Yêu cầu bổ sung</span>',
                            'TuChoi': '<span class="badge badge-danger">Từ chối</span>',
                            'RutHoSo': '<span class="badge badge-secondary">Rút hồ sơ</span>'
                        };
                        return badges[data] || `<span class="badge badge-secondary">${data}</span>`;
                    }
                },
                {
                    data: 'ngayTiepNhan',
                    render: function (data) {
                        return data ? new Date(data).toLocaleDateString('vi-VN') : '---';
                    }
                },
                {
                    data: 'hanGiaiQuyet',
                    render: function (data) {
                        return data ? new Date(data).toLocaleDateString('vi-VN') : '---';
                    }
                },
                {
                    data: 'ngayHoanTat',
                    render: function (data) {
                        return data ? new Date(data).toLocaleDateString('vi-VN') : '---';
                    }
                },
                {
                    data: null,
                    orderable: false,
                    render: function (data, type, row) {
                        let buttons = '';
                        buttons += `<a href="/GiayPhepMoiTruong/ChiTiet/${row.id}" class="btn btn-sm btn-figma btn-info">
                            <i class="fas fa-eye"></i> Xem
                        </a> `;

                        if (window.userPermissions.canUpdate) {
                            buttons += `<a href="/GiayPhepMoiTruong/Sua/${row.id}" class="btn btn-sm btn-figma btn-warning">
                                <i class="fas fa-edit"></i> Sửa
                            </a> `;
                        }

                        if (window.userPermissions.canDelete) {
                            buttons += `<button onclick="deleteItem('${row.id}', '${row.maHoSo}')"
                                class="btn btn-sm btn-figma btn-danger">
                                <i class="fas fa-trash"></i> Xóa
                            </button>`;
                        }

                        return buttons;
                    }
                }
            ]
        });
    }

    function initSearch() {
        let searchTimer;

        $('#searchInput').on('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => table.ajax.reload(), 400);
        });

        $('#btnSearch').on('click', () => table.ajax.reload());

        $('#btnReset').on('click', function () {
            $('#searchInput').val('');
            $('#namInput').val('');
            $('#loaiGpmtSelect').val('');
            $('#trangThaiSelect').val('');
            table.ajax.reload();
        });

        // Filter inputs
        $('#namInput, #loaiGpmtSelect, #trangThaiSelect').on('change', function () {
            table.ajax.reload();
        });
    }

    function loadChipCounts() {
        $.ajax({
            url: '/GiayPhepMoiTruong/GetChipCounts',
            type: 'GET',
            success: function (result) {
                if (result.success && result.data) {
                    chipCounts = result.data;
                    // Update chip counts in UI if needed
                }
            }
        });
    }

    window.deleteItem = function (id, maHoSo) {
        if (!confirm(`Bạn có chắc muốn xóa hồ sơ "${maHoSo}"?`)) return;

        $.ajax({
            url: `/GiayPhepMoiTruong/Xoa/${id}`,
            type: 'POST',
            headers: { 'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') },
            data: JSON.stringify({ lyDo: 'Xóa từ danh sách', version: 1 }),
            contentType: 'application/json',
            success: function (result) {
                if (result.success) {
                    toastr.success('Đã xóa thành công.');
                    table.ajax.reload(null, false);
                } else {
                    toastr.error(result.message || 'Đã có lỗi xảy ra.');
                }
            },
            error: function () {
                toastr.error('Không thể kết nối đến máy chủ.');
            }
        });
    };

    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : '';
    }

    $(document).ready(function () {
        initDataTable();
        initSearch();
        loadChipCounts();
    });

})();
