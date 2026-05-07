/**
 * HoSo Giay Phep Management - Index Page
 * Handles DataTables server-side processing, filtering, and CRUD actions
 * Pattern: IIFE (Immediately Invoked Function Expression)
 */

const HoSoGiayPhepManagement = (function () {
    'use strict';

    let table; // DataTables instance

    /**
     * Initialize DataTables with server-side processing
     */
    function initDataTable() {
        table = $('#hoSoTable').dataTableFigma({
            processing: true,
            serverSide: true,
            ajax: {
                url: '/HoSoGiayPhep/GetAll',
                type: 'GET',
                data: function (d) {
                    const pageSize = d.length;
                    const page = Math.floor(d.start / pageSize) + 1;

                    return {
                        draw: d.draw,
                        page: page,
                        pageSize: pageSize,
                        search: $('#customSearchInput').val() || null,
                        trangThai: getSelectedValues('#filterTrangThai'),
                        loaiNghiepVu: getSelectedValues('#filterLoaiNghiepVu'),
                        ngayNhanFrom: $('#ngayNhanFrom').val() || null,
                        ngayNhanTo: $('#ngayNhanTo').val() || null,
                        isOverdue: $('#filterIsOverdue').val() || null,
                        nguonDuLieu: $('#filterNguonDuLieu').val() || null,
                        showDeleted: $('#showDeleted').is(':checked')
                    };
                }
            },
            columns: [
                {
                    data: null,
                    className: 'text-center',
                    render: function (data, type, row, meta) {
                        return meta.row + meta.settings._iDisplayStart + 1;
                    }
                },
                {
                    data: 'maHoSo',
                    render: function (data, type, row) {
                        return `<a href="/HoSoGiayPhep/Details/${row.id}" class="text-primary font-weight-bold">${data}</a>`;
                    }
                },
                { data: 'hoVaTen' },
                { 
                    data: 'quocTichName',
                    className: 'text-center'
                },
                {
                    data: 'loaiNghiepVuRaw',
                    render: renderLoaiNghiepVuBadge
                },
                {
                    data: 'trangThai',
                    className: 'text-center',
                    render: function (data, type, row) {
                        return `<span class="badge-figma badge-figma-${row.trangThaiColor || 'secondary'}">${data}</span>`;
                    }
                },
                {
                    data: 'ngayNhan',
                    className: 'text-center',
                    render: renderDate
                },
                {
                    data: 'hanXuLy',
                    className: 'text-center',
                    render: function (data, type, row) {
                        const dateStr = renderDate(data);
                        return row.isOverdue
                            ? `<span class="text-danger font-weight-bold"><i class="fas fa-exclamation-triangle mr-1"></i>${dateStr}</span>`
                            : dateStr;
                    }
                },
                {
                    data: 'soGPLDHienTai',
                    render: function (data, type, row) {
                        return data
                            ? `<span class="badge-figma badge-figma-success">${data}</span>`
                            : '<span class="text-muted" style="font-size: 11px;">Chờ cập nhật</span>';
                    }
                },
                {
                    data: null,
                    className: 'text-center',
                    orderable: false,
                    render: renderActionButtons
                }
            ],
            order: [[5, 'desc']],
            dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>', 
            pageLength: 20,
            language: {
                processing: '<div class="spinner-border text-primary" role="status"></div>',
                emptyTable: '<div class="py-5 text-muted"><i class="fas fa-folder-open fa-3x mb-3 d-block"></i>Không có dữ liệu hồ sơ</div>'
            },
            drawCallback: function (settings) {
                if (typeof FigmaDataTables !== 'undefined' && FigmaDataTables.defaultConfig) {
                    FigmaDataTables.defaultConfig.drawCallback(settings);
                }

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
    }

    /**
     * Render business type badge (LoaiNghiepVu)
     */
    function renderLoaiNghiepVuBadge(data, type, row) {
        const colorMap = {
            '1': 'primary', // CapMoi
            '2': 'info',    // GiaHan
            '3': 'warning'  // CapLai
        };
        const enumMap = (window.AppEnums && window.AppEnums.HoSoLoaiNghiepVu) || {
            '1': 'Cấp mới',
            '2': 'Gia hạn',
            '3': 'Cấp lại'
        };
        
        const val = data ? data.toString() : '';
        const color = colorMap[val] || 'secondary';
        const label = enumMap[val] || row.loaiNghiepVu || val;
        
        return `<span class="badge-figma badge-figma-${color}">${label}</span>`;
    }

    /**
     * Render date in dd/MM/yyyy format
     */
    function renderDate(data) {
        if (!data) return '';
        const date = new Date(data);
        if (isNaN(date.getTime())) return data;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    /**
     * Render action buttons based on permissions
     */
    function renderActionButtons(data, type, row) {
        let html = '<div class="table-actions-figma" style="justify-content: center;">';
        
        html += `<a href="/HoSoGiayPhep/Details/${row.id}" class="btn-action-figma btn-action-edit" title="Xem chi tiết">
                   <i class="fas fa-eye"></i>
                 </a>`;

        // Terminal states: 4-CoHieuLuc, 5-DaGiaHan, 6-DaCapLai, 7-DaThuHoi, 8-KhongDuDieuKien, 9-DaXoa
        const isTerminal = row.trangThaiRaw >= 4;

        if (window.userPermissions.canUpdate && !isTerminal) {
            html += `<a href="/HoSoGiayPhep/Edit/${row.id}" class="btn-action-figma btn-action-edit" title="Sửa">
                       <i class="fas fa-pen"></i>
                     </a>`;
        }

        if (window.userPermissions.canDelete && !isTerminal) {
            html += `<button type="button" class="btn-action-figma btn-action-delete" 
                             onclick="HoSoGiayPhepManagement.confirmDelete('${row.id}', '${row.maHoSo}')" 
                             title="Xóa">
                        <i class="fas fa-trash-alt"></i>
                     </button>`;
        }

        html += '</div>';
        return html;
    }

    /**
     * Get selected values from multi-select (comma-separated string)
     */
    function getSelectedValues(selector) {
        const values = $(selector).val();
        return values && values.length > 0 ? (Array.isArray(values) ? values.join(',') : values) : null;
    }

    /**
     * Initialize search and filter event handlers
     */
    function initFilters() {
        // Toggle advanced filters slideDown area
        $('#btnToggleAdvancedFilter').on('click', function () {
            $('#advancedFilterArea').toggleClass('show');
            $(this).toggleClass('active');
        });

        // Search button or Enter key
        $('#btnSearch').on('click', function () {
            table.ajax.reload();
        });
        
        $('#customSearchInput').on('keypress', function (e) {
            if (e.which === 13) {
                table.ajax.reload();
            }
        });

        // Refresh button - Acts as Reset: clears search input and all advanced filters
        $('#btnRefresh').on('click', function () {
            $('#customSearchInput').val('');
            if ($('#filterForm').length) {
                $('#filterForm')[0].reset();
                $('.select2').val(null).trigger('change');
            }
            table.ajax.reload();
        });

        // Page size selector (handled by dataTableFigma)
    }

    /**
     * Confirm and execute delete action
     */
    function confirmDelete(id, maHoSo) {
        if (!confirm(`Bạn có chắc chắn muốn xóa hồ sơ "${maHoSo}"?`)) {
            return;
        }

        const token = $('input[name="__RequestVerificationToken"]').val();

        $.ajax({
            url: `/HoSoGiayPhep/Delete/${id}`,
            type: 'POST',
            headers: { 'RequestVerificationToken': token },
            data: { __RequestVerificationToken: token },
            success: function (response) {
                if (response.success) {
                    table.ajax.reload(null, false);
                    toastr.success('Xóa hồ sơ thành công');
                } else {
                    toastr.error(response.message || 'Lỗi khi xóa hồ sơ');
                }
            },
            error: function () {
                toastr.error('Lỗi hệ thống khi xóa hồ sơ');
            }
        });
    }

    /**
     * Export to Excel
     */
    function initExport() {
        $('#btnExport').on('click', function () {
            const params = {
                search: $('#customSearchInput').val(),
                trangThai: getSelectedValues('#filterTrangThai'),
                loaiNghiepVu: getSelectedValues('#filterLoaiNghiepVu'),
                ngayNhanFrom: $('#ngayNhanFrom').val(),
                ngayNhanTo: $('#ngayNhanTo').val(),
                isOverdue: $('#filterIsOverdue').val(),
                nguonDuLieu: $('#filterNguonDuLieu').val()
            };
            
            const queryString = $.param(params);
            window.location.href = `/HoSoGiayPhep/Export?${queryString}`;
        });
    }

    /**
     * Public interface
     */
    return {
        init: function () {
            initDataTable();
            initFilters();
            initExport();
        },
        confirmDelete: confirmDelete
    };
})();

// Initialize on document ready
$(document).ready(function () {
    HoSoGiayPhepManagement.init();
});
