// work-permit-index.js - Work Permit Applications Index page
$(document).ready(function () {
    // Initialize DataTable
    var table = $('#workPermitTable').DataTable({
        processing: true,
        serverSide: false, // Client-side processing for simplicity
        ajax: {
            url: '/WorkPermit/GetAll',
            type: 'GET',
            data: function (d) {
                d.searchTerm = $('#searchTerm').val();
                d.status = $('#statusFilter').val();
                d.businessType = $('#businessTypeFilter').val();
                d.pageNumber = 1;
                d.pageSize = 1000; // Load all for client-side filtering
            },
            dataSrc: ''
        },
        columns: [
            { data: 'maHoSo' },
            { data: 'hoVaTen' },
            { data: 'quocTich' },
            {
                data: 'loaiNghiepVu',
                render: function (data) {
                    var badges = {
                        '1': '<span class="badge badge-primary">Cấp mới</span>',
                        '2': '<span class="badge badge-info">Gia hạn</span>',
                        '3': '<span class="badge badge-warning">Cấp lại</span>'
                    };
                    return badges[data] || data;
                }
            },
            {
                data: 'status',
                render: function (data, type, row) {
                    var statusMap = {
                        '1': '<span class="badge badge-secondary">Chờ thẩm định</span>',
                        '2': '<span class="badge badge-info">Đang thẩm định</span>',
                        '3': '<span class="badge badge-primary">Chờ ký số</span>',
                        '4': '<span class="badge badge-primary">Chờ xác nhận OCR</span>',
                        '5': '<span class="badge badge-success">Có hiệu lực</span>',
                        '6': '<span class="badge badge-info">Đã gia hạn</span>',
                        '7': '<span class="badge badge-warning">Đã cấp lại</span>',
                        '8': '<span class="badge badge-danger">Đã thu hồi</span>',
                        '9': '<span class="badge badge-danger">Không đủ điều kiện</span>',
                        '10': '<span class="badge badge-secondary">Đã xóa</span>'
                    };
                    return statusMap[data] || data;
                }
            },
            {
                data: 'ngayNhan',
                render: function (data) {
                    return data ? new Date(data).toLocaleDateString('vi-VN') : '';
                }
            },
            {
                data: null,
                orderable: false,
                render: function (data, type, row) {
                    var html = '<div class="btn-group btn-group-sm">';
                    
                    // Details button
                    html += '<a href="/WorkPermit/Details/' + row.id + '" class="btn btn-info" title="Chi tiết">' +
                            '<i class="fas fa-eye"></i></a>';
                    
                    // Validate button
                    html += '<a href="/WorkPermit/Details/' + row.id + '#validation" class="btn btn-warning" title="Kiểm tra điều kiện">' +
                            '<i class="fas fa-check-circle"></i></a>';
                    
                    // Delete button
                    if (window.userPermissions.canDelete === 'True' && row.status === '1') {
                        html += '<button class="btn btn-danger btn-delete" data-id="' + row.id + '" data-name="' + row.maHoSo + '" title="Xóa">' +
                                '<i class="fas fa-trash"></i></button>';
                    }
                    
                    html += '</div>';
                    return html;
                }
            }
        ],
        order: [[5, 'desc']], // Sort by created date desc
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/vi.json',
            processing: "Đang tải dữ liệu...",
            emptyTable: "Không có dữ liệu",
            zeroRecords: "Không tìm thấy kết quả phù hợp"
        },
        pageLength: 20,
        dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
             '<"row"<"col-sm-12"tr>>' +
             '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>'
    });

    // Search button click
    $('#btnSearch').on('click', function () {
        table.ajax.reload();
    });

    // Search on Enter key
    $('#searchTerm').on('keypress', function (e) {
        if (e.which === 13) {
            e.preventDefault();
            table.ajax.reload();
        }
    });

    // Filter change
    $('#statusFilter, #businessTypeFilter').on('change', function () {
        table.ajax.reload();
    });

    // Delete modal show
    $(document).on('click', '.btn-delete', function () {
        var id = $(this).data('id');
        var name = $(this).data('name');
        $('#deleteEntityName').text(name);
        $('#deleteEntityId').val(id);
        $('#deleteReason').val('');
        $('#deleteModal').modal('show');
    });

    // Confirm delete
    $('#btnConfirmDelete').on('click', function () {
        var id = $('#deleteEntityId').val();
        var reason = $('#deleteReason').val();

        if (!reason || reason.trim().length < 10) {
            toastr.warning('Vui lòng nhập lý do xóa (tối thiểu 10 ký tự)');
            return;
        }

        var token = $('input[name="__RequestVerificationToken"]').val();

        $.ajax({
            url: '/WorkPermit/Delete/' + id,
            type: 'POST',
            headers: { 'RequestVerificationToken': token },
            data: { reason: reason },
            success: function (result) {
                $('#deleteModal').modal('hide');
                if (result.success) {
                    toastr.success(result.message || 'Xóa hồ sơ thành công');
                    table.ajax.reload();
                } else {
                    toastr.error(result.message || 'Lỗi khi xóa hồ sơ');
                }
            },
            error: function () {
                toastr.error('Lỗi kết nối khi xóa hồ sơ');
            }
        });
    });
});
