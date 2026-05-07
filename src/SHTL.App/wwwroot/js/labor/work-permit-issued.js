// work-permit-issued.js - Issued Permits page
$(document).ready(function () {
    // Initialize DataTable
    var table = $('#issuedPermitsTable').DataTable({
        processing: true,
        serverSide: false,
        ajax: {
            url: '/WorkPermit/GetAllIssued',
            type: 'GET',
            data: function (d) {
                d.searchTerm = $('#searchTerm').val();
                d.status = $('#statusFilter').val();
                d.daysUntilExpiry = $('#daysFilter').val();
                d.pageNumber = 1;
                d.pageSize = 1000;
            },
            dataSrc: function (json) {
                updateStatistics(json);
                return json;
            }
        },
        columns: [
            { data: 'soGPLD' },
            { data: 'hoVaTen' },
            { data: 'quocTich' },
            {
                data: 'ngayCapGPLD',
                render: function (data) {
                    return data ? new Date(data).toLocaleDateString('vi-VN') : '';
                }
            },
            {
                data: 'ngayHetHan',
                render: function (data) {
                    return data ? new Date(data).toLocaleDateString('vi-VN') : '';
                }
            },
            {
                data: 'daysUntilExpiry',
                render: function (data, type, row) {
                    if (data == null || row.status === 'DaThuHoi') return '-';
                    
                    var badgeClass = 'badge-success';
                    if (data <= 15) {
                        badgeClass = 'badge-danger';
                    } else if (data <= 30) {
                        badgeClass = 'badge-warning';
                    } else if (data <= 45) {
                        badgeClass = 'badge-info';
                    }
                    
                    return '<span class="badge ' + badgeClass + '">' + data + ' ngày</span>';
                }
            },
            {
                data: 'status',
                render: function (data, type, row) {
                    var statusMap = {
                        'CoHieuLuc': '<span class="badge badge-success">Còn hiệu lực</span>',
                        'SapHetHan': '<span class="badge badge-warning">Sắp hết hạn</span>',
                        'HetHan': '<span class="badge badge-dark">Hết hạn</span>',
                        'DaThuHoi': '<span class="badge badge-danger">Đã thu hồi</span>'
                    };
                    return statusMap[data] || data;
                }
            },
            {
                data: null,
                orderable: false,
                render: function (data, type, row) {
                    var html = '<div class="btn-group btn-group-sm">';
                    
                    // Details button
                    html += '<a href="/WorkPermit/Details/' + row.applicationId + '" class="btn btn-info" title="Chi tiết">' +
                            '<i class="fas fa-eye"></i></a>';
                    
                    // Download button
                    html += '<a href="/WorkPermit/DownloadPermit/' + row.id + '" class="btn btn-success" title="Tải xuống">' +
                            '<i class="fas fa-download"></i></a>';
                    
                    // Revoke button
                    if (window.userPermissions.canRevoke === 'true' && row.status === 'CoHieuLuc') {
                        html += '<button class="btn btn-danger btn-revoke" data-id="' + row.id + '" data-number="' + row.soGPLD + '" title="Thu hồi">' +
                                '<i class="fas fa-ban"></i></button>';
                    }
                    
                    html += '</div>';
                    return html;
                }
            }
        ],
        order: [[3, 'desc']], // Sort by NgayCapGPLD desc
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/vi.json'
        },
        pageLength: 20
    });

    // Update statistics
    function updateStatistics(data) {
        if (!data || !Array.isArray(data)) return;

        var total = data.length;
        var active = data.filter(function (item) { return item.status === 'CoHieuLuc'; }).length;
        var expiring = data.filter(function (item) { return item.daysUntilExpiry != null && item.daysUntilExpiry <= 45 && item.status === 'CoHieuLuc'; }).length;
        var expired = data.filter(function (item) { return item.status === 'HetHan'; }).length;

        $('#statTotal').text(total.toLocaleString());
        $('#statActive').text(active.toLocaleString());
        $('#statExpiring').text(expiring.toLocaleString());
        $('#statExpired').text(expired.toLocaleString());
    }

    // Search button
    $('#btnSearch').on('click', function () {
        table.ajax.reload();
    });

    // Search on Enter
    $('#searchTerm').on('keypress', function (e) {
        if (e.which === 13) {
            e.preventDefault();
            table.ajax.reload();
        }
    });

    // Filter change
    $('#statusFilter, #daysFilter').on('change', function () {
        table.ajax.reload();
    });

    // Export Excel
    $('#btnExportExcel').on('click', function () {
        var btn = $(this);
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xuất...');

        window.location.href = '/WorkPermit/ExportIssuedPermits';

        setTimeout(function () {
            btn.prop('disabled', false).html('<i class="fas fa-file-excel"></i> Xuất Excel');
            toastr.success('Đã tải xuống file Excel');
        }, 2000);
    });

    // Revoke modal show
    $(document).on('click', '.btn-revoke', function () {
        var id = $(this).data('id');
        var number = $(this).data('number');
        
        $('#revokePermitId').val(id);
        $('#revokePermitNumber').text(number);
        $('#soQuyetDinhThuHoi').val('');
        $('#ngayThuHoi').val(new Date().toISOString().split('T')[0]);
        $('#lyDoThuHoi').val('');
        
        $('#revokeModal').modal('show');
    });

    // Confirm revoke
    $('#btnConfirmRevoke').on('click', function () {
        var id = $('#revokePermitId').val();
        var soQuyetDinh = $('#soQuyetDinhThuHoi').val();
        var ngayThuHoi = $('#ngayThuHoi').val();
        var lyDo = $('#lyDoThuHoi').val();

        if (!soQuyetDinh || !ngayThuHoi || !lyDo) {
            toastr.warning('Vui lòng điền đầy đủ thông tin');
            return;
        }

        if (lyDo.trim().length < 20) {
            toastr.warning('Lý do thu hồi phải có tối thiểu 20 ký tự');
            return;
        }

        var data = {
            soQuyetDinhThuHoi: soQuyetDinh,
            ngayThuHoi: ngayThuHoi,
            lyDoThuHoi: lyDo
        };

        var token = $('input[name="__RequestVerificationToken"]').val();

        $.ajax({
            url: '/WorkPermit/Revoke/' + id,
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            headers: { 'RequestVerificationToken': token },
            beforeSend: function () {
                $('#btnConfirmRevoke').prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xử lý...');
            },
            success: function (result) {
                if (result.success) {
                    toastr.success(result.message || 'Thu hồi GPLĐ thành công');
                    $('#revokeModal').modal('hide');
                    table.ajax.reload();
                } else {
                    toastr.error(result.message || 'Lỗi khi thu hồi GPLĐ');
                }
            },
            error: function () {
                toastr.error('Lỗi kết nối khi thu hồi GPLĐ');
            },
            complete: function () {
                $('#btnConfirmRevoke').prop('disabled', false).html('Thu hồi');
            }
        });
    });
});
