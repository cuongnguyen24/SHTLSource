// awards-management.js - Quản lý Khen thưởng
// NOTE: Simplified version - TODO: Complete implementation with full CRUD, validation, file upload, conditional fields

let awardsTable;
let activeFilters = {};

$(document).ready(function () {
    // Load statistics for dashboard widget
    loadStatistics();

    // Initialize DataTables
    initDataTable();

    // Filter button handlers
    $('#filterSearch').on('keypress', function (e) {
        if (e.which === 13) applyFilters();
    });

    // Form submit handlers
    $('#createForm').on('submit', function (e) {
        e.preventDefault();
        createAward();
    });

    $('#editForm').on('submit', function (e) {
        e.preventDefault();
        updateAward();
    });
});

//=============================
// Dashboard Statistics
//=============================
function loadStatistics() {
    $.ajax({
        url: '/Awards/GetStatistics',
        type: 'GET',
        success: function (response) {
            if (response.isSuccess && response.data) {
                $('#statTotalCount').text(response.data.totalCount || 0);
                $('#statDangThamDinh').text(response.data.dangThamDinhCount || 0);
                $('#statDaPheDuyet').text(response.data.daPheDuyetCount || 0);
                $('#statDaTraoThuong').text(response.data.daTraoThuongCount || 0);
                $('#statTuChoi').text(response.data.tuChoiCount || 0);
            } else {
                console.error('Failed to load statistics:', response.message);
            }
        },
        error: function (xhr, status, error) {
            console.error('Error loading statistics:', error);
            // Set all stats to 0 on error
            $('#statTotalCount, #statDangThamDinh, #statDaPheDuyet, #statDaTraoThuong, #statTuChoi').text('0');
        }
    });
}

//=============================
// DataTables Initialization
//=============================
function initDataTable() {
    awardsTable = $('#awardsTable').DataTable({
        processing: true,
        serverSide: false, // Client-side processing (API returns all filtered data)
        ajax: {
            url: '/Awards/GetAll',
            type: 'GET',
            data: function (d) {
                // Add filter params
                d.enterpriseId = activeFilters.enterpriseId;
                d.field = activeFilters.field;
                d.type = activeFilters.type;
                d.level = activeFilters.level;
                d.industrialZoneId = activeFilters.industrialZoneId;
                d.yearFrom = activeFilters.yearFrom;
                d.yearTo = activeFilters.yearTo;
                d.departmentCode = activeFilters.departmentCode;
                d.searchTerm = activeFilters.searchTerm;
            },
            dataSrc: function (json) {
                if (json.error) {
                    toastr.error(json.error);
                    return [];
                }
                return json;
            }
        },
        columns: [
            {
                data: null,
                orderable: false,
                searchable: false,
                className: 'text-center',
                defaultContent: ''
            },
            {
                data: null,
                render: function (data) {
                    return `<div><strong>${escapeHtml(data.enterpriseName)}</strong><br/><small class="text-muted">${escapeHtml(data.enterpriseTaxCode)}</small></div>`;
                }
            },
            {
                data: 'industrialZoneName',
                render: function (data) {
                    return data ? escapeHtml(data) : '<span class="text-muted">--</span>';
                }
            },
            {
                data: 'rewardField',
                render: function (data, type, row) {
                    const fieldLabels = {
                        'MOITRUONG': 'Môi trường',
                        'DAUTU': 'Đầu tư',
                        'LAODONG': 'Lao động',
                        'XAYDUNG': 'Xây dựng',
                        'KHAC': row.rewardFieldOther || 'Khác'
                    };
                    return fieldLabels[data] || data;
                }
            },
            {
                data: 'rewardType',
                render: function (data, type, row) {
                    const typeLabels = {
                        'BANG_KHEN': 'Bằng khen',
                        'GIAY_KHEN': 'Giấy khen',
                        'CO_THI_DUA': 'Cờ thi đua',
                        'DANH_HIEU': 'Danh hiệu',
                        'KHAC': row.rewardTypeOther || 'Khác'
                    };
                    return typeLabels[data] || data;
                }
            },
            {
                data: 'rewardLevel',
                render: function (data) {
                    const levelLabels = {
                        'NHA_NUOC': '<span class="badge bg-danger">Nhà nước</span>',
                        'BO': '<span class="badge bg-primary">Bộ</span>',
                        'TINH': '<span class="badge bg-success">Tỉnh</span>',
                        'BQL': '<span class="badge bg-info">BQL KCN</span>'
                    };
                    return levelLabels[data] || data;
                }
            },
            {
                data: 'decisionNumber',
                render: function (data) {
                    return escapeHtml(data);
                }
            },
            {
                data: 'awardDate',
                render: function (data) {
                    return formatDate(data);
                }
            },
            {
                data: 'departmentName',
                render: function (data) {
                    return data ? escapeHtml(data) : '<span class="text-muted">--</span>';
                }
            },
            {
                data: 'wfStatus',
                render: function (data) {
                    return renderStatusBadge(data);
                }
            },
            {
                data: null,
                orderable: false,
                className: 'text-center',
                render: function (data, type, row) {
                    let html = '<div class="action-buttons">';
                    
                    // View button (always shown if can read)
                    html += `<button class="btn btn-sm btn-info" onclick="viewAward('${row.id}')" title="Xem chi tiết"><i class="fas fa-eye"></i></button>`;
                    
                    // Edit button (only for owner)
                    if (window.userPermissions && (window.userPermissions.canUpdate === true || window.userPermissions.canUpdate === 'true') && row.createdBy === window.currentUserId) {
                        html += `<button class="btn btn-sm btn-warning" onclick="editAward('${row.id}')" title="Chỉnh sửa"><i class="fas fa-edit"></i></button>`;
                    }
                    
                    // Delete button (only for owner)
                    if (window.userPermissions && (window.userPermissions.canDelete === true || window.userPermissions.canDelete === 'true') && row.createdBy === window.currentUserId) {
                        html += `<button class="btn btn-sm btn-danger" onclick="deleteAward('${row.id}', '${escapeHtml(row.enterpriseName)}', '${escapeHtml(row.decisionNumber)}')" title="Xóa"><i class="fas fa-trash"></i></button>`;
                    }
                    
                    html += '</div>';
                    return html;
                }
            }
        ],
        order: [[7, 'desc']], // Sort by AwardDate descending
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/vi.json',
            emptyTable: 'Không có dữ liệu',
            zeroRecords: 'Không tìm thấy bản ghi nào'
        },
        pageLength: 25,
        lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
        responsive: true,
        drawCallback: function (settings) {
            var api = this.api();
            var startIndex = api.context[0]._iDisplayStart;
            api.column(0, {page:'current'}).nodes().each(function (cell, i) {
                cell.innerHTML = startIndex + i + 1;
            });
        }
    });
}

//=============================
// Filter Functions
//=============================
function applyFilters() {
    // TODO: Full filter implementation with all 8 criteria
    activeFilters = {
        field: $('#filterField').val() || null,
        type: $('#filterType').val() || null,
        level: $('#filterLevel').val() || null,
        yearFrom: $('#filterYearFrom').val() || null,
        yearTo: $('#filterYearTo').val() || null,
        searchTerm: $('#filterSearch').val().trim() || null
    };

    renderActiveFilters();
    awardsTable.ajax.reload();
}

function clearFilters() {
    activeFilters = {};
    $('#filterField, #filterType, #filterLevel').val('');
    $('#filterYearFrom, #filterYearTo, #filterSearch').val('');
    renderActiveFilters();
    awardsTable.ajax.reload();
}

function renderActiveFilters() {
    let html = '';
    // TODO: Render filter chips dynamically
    $('#activeFilters').html(html);
}

//=============================
// CRUD Functions
//=============================
function openCreatePanel() {
    // TODO: Load enterprise dropdown, reset form
    $('#createForm')[0].reset();
    new bootstrap.Offcanvas('#createPanel').show();
}

function createAward() {
    const data = {
        enterpriseId: $('#createEnterpriseId').val(),
        decisionNumber: $('#createDecisionNumber').val(),
        awardDate: $('#createAwardDate').val()
        // TODO: Add all required fields
    };

    const token = $('input[name="__RequestVerificationToken"]').val();

    $.ajax({
        url: '/Awards/Create',
        type: 'POST',
        contentType: 'application/json',
        headers: { 'RequestVerificationToken': token },
        data: JSON.stringify(data),
        success: function (result) {
            if (result.success) {
                toastr.success('Tạo khen thưởng thành công', '', { timeOut: 4000 });
                bootstrap.Offcanvas.getInstance('#createPanel').hide();
                awardsTable.ajax.reload();
            } else {
                toastr.error(result.error || 'Tạo khen thưởng thất bại', '', { timeOut: 6000 });
            }
        },
        error: function () {
            toastr.error('Lỗi khi tạo khen thưởng', '', { timeOut: 6000 });
        }
    });
}

function editAward(id) {
    // TODO: Load award data, populate form
    $.get(`/Awards/Get?id=${id}`, function (award) {
        $('#editId').val(award.id);
        $('#editDecisionNumber').val(award.decisionNumber);
        $('#editAwardDate').val(award.awardDate.substring(0, 10));
        // TODO: Populate all fields
        
        new bootstrap.Offcanvas('#editPanel').show();
    }).fail(function () {
        toastr.error('Không thể tải thông tin khen thưởng');
    });
}

function updateAward() {
    const id = $('#editId').val();
    const data = {
        decisionNumber: $('#editDecisionNumber').val(),
        awardDate: $('#editAwardDate').val()
        // TODO: Add all fields
    };

    const token = $('input[name="__RequestVerificationToken"]').val();

    $.ajax({
        url: `/Awards/Edit?id=${id}`,
        type: 'POST',
        contentType: 'application/json',
        headers: { 'RequestVerificationToken': token },
        data: JSON.stringify(data),
        success: function (result) {
            if (result.success) {
                toastr.success('Cập nhật khen thưởng thành công', '', { timeOut: 4000 });
                bootstrap.Offcanvas.getInstance('#editPanel').hide();
                awardsTable.ajax.reload();
            } else {
                toastr.error(result.error || 'Cập nhật khen thưởng thất bại', '', { timeOut: 6000 });
            }
        },
        error: function () {
            toastr.error('Lỗi khi cập nhật khen thưởng', '', { timeOut: 6000 });
        }
    });
}

function viewAward(id) {
    // TODO: Open Details offcanvas panel (read-only)
    toastr.info('Chức năng xem chi tiết đang phát triển');
}

function deleteAward(id, enterpriseName, decisionNumber) {
    $('#deleteId').val(id);
    $('#deleteAwardInfo').text(`${enterpriseName} - ${decisionNumber}`);
    new bootstrap.Modal('#deleteModal').show();
}

function confirmDelete() {
    const id = $('#deleteId').val();
    const token = $('input[name="__RequestVerificationToken"]').val();

    $.ajax({
        url: `/Awards/Delete?id=${id}`,
        type: 'POST',
        headers: { 'RequestVerificationToken': token },
        success: function (result) {
            if (result.success) {
                toastr.success('Xóa khen thưởng thành công', '', { timeOut: 4000 });
                bootstrap.Modal.getInstance('#deleteModal').hide();
                awardsTable.ajax.reload();
            } else {
                toastr.error(result.error || 'Xóa khen thưởng thất bại', '', { timeOut: 6000 });
            }
        },
        error: function () {
            toastr.error('Lỗi khi xóa khen thưởng', '', { timeOut: 6000 });
        }
    });
}

function exportExcel() {
    // TODO: Implement Excel export with current filters
    toastr.info('Chức năng xuất Excel đang phát triển');
}

//=============================
// Utility Functions
//=============================


function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Render status badge with icon + color (UISPEC V1.1 §8.2)
 * @param {string} status - Enum string: DangThamDinh, DaPheDuyet, DaTraoThuong, TuChoi
 * @returns {string} HTML badge
 */
function renderStatusBadge(status) {
    if (!status) return '<span class="badge badge-secondary">—</span>';
    
    const statusConfig = {
        'DangThamDinh': {
            label: '🟡 Đang thẩm định',
            class: 'badge-dang-tham-dinh'
        },
        'DaPheDuyet': {
            label: '✅ Đã phê duyệt',
            class: 'badge-da-phe-duyet'
        },
        'DaTraoThuong': {
            label: '🏆 Đã trao thưởng',
            class: 'badge-da-trao-thuong'
        },
        'TuChoi': {
            label: '✕ Từ chối',
            class: 'badge-tu-choi'
        }
    };
    
    const config = statusConfig[status] || { 
        label: status, 
        class: 'badge-secondary'
    };
    
    return `<span class="badge ${config.class}">${escapeHtml(config.label)}</span>`;
}
