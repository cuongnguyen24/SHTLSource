/**
 * TNLD Kỳ báo cáo JavaScript (M0147 - DataTable + modal CRUD + DongKy action)
 * Pattern: IIFE + DataTables server-side + modal form
 */
(function () {
    'use strict';

    const permissions = window.userPermissions || {};
    let table;

    $(document).ready(function () {
        initDataTable();
        initFilterBar();
        initModal();
        initFilters();
    });

    function initFilters() {
        const currentYear = new Date().getFullYear();
        const $nam = $('#filterNam');
        for (let y = currentYear + 1; y >= currentYear - 5; y--) {
            $nam.append(`<option value="${y}">${y}</option>`);
        }
    }

    function initDataTable() {
        table = $('#kyBaoCaoTable').dataTableFigma({
            serverSide: true,
            processing: true,
            searching: false,
            dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
            ajax: {
                url: '/TaiNanLaoDong/TaiNanLaoDongKyBaoCao/GetAll',
                type: 'GET',
                data: function (d) {
                    d.nam = $('#filterNam').val();
                    d.trangThai = $('#filterTrangThai').val();
                    d.search = $('#customSearchInput').val();
                },
                error: function () {
                    toastr.error('Lỗi khi tải dữ liệu');
                }
            },
            columns: [
                {
                    data: null,
                    width: '45px',
                    className: 'text-center',
                    orderable: false,
                    render: function (data, type, row, meta) {
                        return meta.row + meta.settings._iDisplayStart + 1;
                    }
                },
                { 
                    data: 'tenKy',
                    render: function(data) {
                        return `<span class="font-weight-semibold text-primary">${escapeHtml(data)}</span>`;
                    }
                },
                { data: 'nam', className: 'text-center', width: '80px' },
                {
                    data: 'ngayBatDau',
                    className: 'text-center',
                    width: '120px',
                    render: function (data) {
                        return data ? moment(data).format('DD/MM/YYYY') : '-';
                    }
                },
                {
                    data: 'hanNop',
                    className: 'text-center',
                    width: '120px',
                    render: function (data) {
                        return data ? moment(data).format('DD/MM/YYYY') : '-';
                    }
                },
                {
                    data: 'trangThai',
                    className: 'text-center',
                    width: '130px',
                    render: function (data) {
                        const badges = {
                            'MoNhap': '<span class="badge-figma badge-figma-success">Đang mở</span>',
                            'Dong': '<span class="badge-figma badge-figma-secondary">Đã đóng</span>'
                        };
                        return badges[data] || `<span class="badge-figma badge-figma-secondary">${data}</span>`;
                    }
                },
                {
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    width: '120px',
                    render: function (data, type, row) {
                        let buttons = '<div class="table-actions-figma" style="justify-content: center;">';
                        
                        if (permissions.canUpdate && row.trangThai !== 'Dong') {
                            buttons += `<button onclick="editItem('${row.id}')" class="btn-action-figma btn-action-edit" title="Sửa">
                                <i class="fas fa-pen"></i>
                            </button> `;
                        }
                        
                        if (permissions.canUpdate && row.trangThai === 'MoNhap') {
                            buttons += `<button onclick="dongKy('${row.id}', '${escapeHtml(row.tenKy)}')" class="btn-action-figma btn-action-info" title="Đóng kỳ">
                                <i class="fas fa-lock"></i>
                            </button> `;
                        }
                        
                        if (permissions.canDelete && row.trangThai === 'MoNhap') {
                            buttons += `<button onclick="deleteItem('${row.id}', '${escapeHtml(row.tenKy)}')" class="btn-action-figma btn-action-delete" title="Xóa">
                                <i class="fas fa-trash-alt"></i>
                            </button>`;
                        }
                        
                        buttons += '</div>';
                        return buttons;
                    }
                }
            ],
            drawCallback: function (settings) {
                if (typeof FigmaDataTables !== 'undefined' && FigmaDataTables.defaultConfig) {
                    FigmaDataTables.defaultConfig.drawCallback(settings);
                }

                const $container = $('.pagination-figma-container');
                if ($container.length && $('#paginationFrame').length) {
                    $container.appendTo('#paginationFrame');
                }
            }
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function initFilterBar() {
        $('#btnSearch').on('click', () => table.ajax.reload());
        $('#customSearchInput').on('keyup', function(e) {
            if (e.key === 'Enter') table.ajax.reload();
        });
        $('#filterNam, #filterTrangThai').on('change', () => table.ajax.reload());
    }

    function initModal() {
        $('#btnCreate').on('click', function () {
            openModal(null);
        });

        $('#btnSaveKy').on('click', function () {
            saveKyBaoCao();
        });
    }

    function openModal(id) {
        $('#formKyBaoCao')[0].reset();
        $('#kyId').val(id || '');
        
        if (id) {
            $('#modalTitle').html('<i class="fas fa-edit mr-2"></i>Cập nhật Kỳ báo cáo');
            loadKyDetails(id);
        } else {
            $('#modalTitle').html('<i class="fas fa-calendar-plus mr-2"></i>Tạo Kỳ báo cáo mới');
            $('#nam').val(new Date().getFullYear());
        }
        
        $('#modalKyBaoCao').modal('show');
    }

    function loadKyDetails(id) {
        $.ajax({
            url: `/TaiNanLaoDong/TaiNanLaoDongKyBaoCao/GetById/${id}`,
            type: 'GET',
            success: function (data) {
                $('#nam').val(data.nam);
                $('#tenKy').val(data.tenKy);
                if (data.ngayBatDau) $('#ngayBatDau').val(data.ngayBatDau.split('T')[0]);
                if (data.hanNop) $('#hanNop').val(data.hanNop.split('T')[0]);
            },
            error: function () {
                toastr.error('Lỗi khi tải thông tin');
            }
        });
    }

    function saveKyBaoCao() {
        const form = $('#formKyBaoCao');
        if (!form[0].checkValidity()) {
            form[0].reportValidity();
            return;
        }

        const id = $('#kyId').val();
        const url = id ? `/TaiNanLaoDong/TaiNanLaoDongKyBaoCao/Update/${id}` : '/TaiNanLaoDong/TaiNanLaoDongKyBaoCao/Create';
        
        const formData = form.serialize();

        $.ajax({
            url: url,
            type: 'POST',
            data: formData,
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (response) {
                if (response.success) {
                    toastr.success(response.message || 'Lưu thành công');
                    $('#modalKyBaoCao').modal('hide');
                    table.ajax.reload(null, false);
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
        openModal(id);
    };

    window.dongKy = function (id, tenKy) {
        if (!confirm(`Đóng kỳ báo cáo "${tenKy}"? Sau khi đóng sẽ không thể sửa!`)) return;
        
        $.ajax({
            url: `/TaiNanLaoDong/TaiNanLaoDongKyBaoCao/DongKy/${id}`,
            type: 'POST',
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (response) {
                if (response.success) {
                    toastr.success('Đã đóng kỳ báo cáo');
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

    window.deleteItem = function (id, tenKy) {
        if (!confirm(`Xóa kỳ báo cáo "${tenKy}"?`)) return;
        
        $.ajax({
            url: `/TaiNanLaoDong/TaiNanLaoDongKyBaoCao/Delete/${id}`,
            type: 'POST',
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (response) {
                if (response.success) {
                    toastr.success('Đã xóa');
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
