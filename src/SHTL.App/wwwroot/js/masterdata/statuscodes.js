/**
 * Status Codes Management JavaScript (Read-Only)
 */
$(document).ready(function () {
    let table;

    // Initialize DataTable with Figma styling
    table = $('#statusCodesTable').dataTableFigma({
        ajax: {
            url: '/StatusCodes/GetAll',
            dataSrc: ''
        },
        // Phân trang sẽ được đẩy vào #paginationFrame
        dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
        drawCallback: function(settings) {
            // Gọi logic styling mặc định của Figma
            if (window.FigmaDataTables && FigmaDataTables.defaultConfig) {
                FigmaDataTables.defaultConfig.drawCallback(settings);
            }
            
            // Đảm bảo container phân trang luôn nằm trong khung 4 sau mỗi lần Draw
            const $container = $('.pagination-figma-container');
            if ($container.length && $('#paginationFrame').length) {
                $container.appendTo('#paginationFrame');
            }
        },
        columns: [
            { data: 'code' },
            { data: 'name' },
            { data: 'category' },
            {
                data: 'isActive',
                className: 'text-center',
                render: function (data) {
                    return FigmaDataTables.renderStatusDot(data, data ? 'Đang hoạt động' : 'Ngưng hoạt động');
                }
            },
            {
                data: null,
                orderable: false,
                className: 'text-center',
                render: function (data, type, row) {
                    return `
                        <div class="text-nowrap text-center">
                            <button class="btn btn-sm btn-info btn-view" data-id="${row.id}" title="Xem chi tiết" style="height: 28px; line-height: 28px; padding: 0 10px; font-size: 12px; border-radius: 4px; background-color: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">
                                <i class="fas fa-eye mr-1"></i> Xem
                            </button>
                        </div>
                    `;
                }
            }
        ],
        order: [[2, 'asc'], [0, 'asc']],
        pageLength: 25
    });

    // Custom search logic for Frame 2
    $('#customSearchInput').on('keyup', function () {
        table.search(this.value).draw();
    });

    // View button
    $(document).on('click', '.btn-view', function () {
        const id = $(this).data('id');
        $.ajax({
            url: '/StatusCodes/Get/' + id,
            type: 'GET',
            success: function (data) {
                let content = `
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label class="font-weight-bold small text-muted text-uppercase">Mã trạng thái</label>
                            <div class="p-2 border-bottom">${data.code}</div>
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="font-weight-bold small text-muted text-uppercase">Tên trạng thái</label>
                            <div class="p-2 border-bottom">${data.name}</div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-12 mb-3">
                            <label class="font-weight-bold small text-muted text-uppercase">Danh mục</label>
                            <div class="p-2 border-bottom">${data.category || 'N/A'}</div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-12">
                            <label class="font-weight-bold small text-muted text-uppercase">Mô tả</label>
                            <div class="p-2" style="background: #f8fafc; border-radius: 4px; min-height: 60px;">${data.description || '<span class="text-muted italic">Không có mô tả</span>'}</div>
                        </div>
                    </div>
                `;
                $('#viewModalBody').html(content);
                $('#viewModal').modal('show');
            },
            error: function (xhr) { 
                if (xhr.responseJSON && xhr.responseJSON.errors && xhr.responseJSON.errors.length > 0) { 
                    xhr.responseJSON.errors.forEach(function(err) { 
                        toastr.error(err, 'Lỗi', { timeOut: 5000, closeButton: true, progressBar: true }); 
                    }); 
                    return; 
                }
                toastr.error('Không thể tải thông tin trạng thái', 'Lỗi');
            }
        });
    });
});
