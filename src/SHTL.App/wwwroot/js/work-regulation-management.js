/**
 * Work Regulation Registration Management JavaScript
 * Module: Quản lý Đăng ký Nội quy Lao động (M-0021)
 */
(function () {
    'use strict';

    let table;
    let deleteId = null;
    let deleteName = '';
    let confirmId = null;
    let confirmName = '';
    let showDeletedFilter = false;  // ⭐ Checkbox state for showing deleted records

    // Multi-tag select storage
    let selectedLoaiHinhDN = [];
    let selectedTinhThanhPho = [];
    let selectedTrangThai = [];

    // Enum mappings for badges
    const trangThaiLabels = {
        '1': 'Chờ kiểm tra',
        '2': 'Đang kiểm tra',
        '3': 'Đã kiểm tra',
        '4': 'Tồn đọng'
    };

    const trangThaiBadgeClass = {
        '1': 'badge-figma-warning',
        '2': 'badge-figma-info',
        '3': 'badge-figma-success',
        '4': 'badge-figma-danger'
    };

    const nguonDuLieuLabels = {
        '1': 'Thủ công',
        '2': 'API Đồng Nai',
        '3': 'Excel Import'
    };

    const nguonDuLieuBadgeClass = {
        '1': 'badge-figma-secondary',
        '2': 'badge-figma-primary',
        '3': 'badge-figma-info'
    };

    const slaStatusLabels = {
        'None': '—',
        'Normal': 'Bình thường',
        'Warning': 'Sắp trễ',
        'Overdue': 'Đã trễ'
    };

    const slaStatusBadgeClass = {
        'None': '',
        'Normal': 'badge-figma-success',
        'Warning': 'badge-figma-warning',
        'Overdue': 'badge-figma-danger'
    };

    const loaiHinhDNLabels = {
        'TNHH': 'TNHH',
        'CoPhan': 'Cổ phần',
        'TuNhan': 'Tư nhân',
        'NuocNgoai': '100% vốn nước ngoài',
        'LienDoanh': 'Liên doanh',
        'Khac': 'Khác'
    };

    // Column index → backend sortBy field mapping
    var sortFieldMap = {
        1: 'soHoSoApi',
        2: 'tenNSDLD',
        3: 'maSoThue',
        4: 'loaiHinhDN',
        5: 'soLaoDong',
        6: 'ngayNopHoSo',
        7: 'trangThai',
        8: 'nguonDuLieu'
    };

    $(document).ready(function () {
        initDataTable();
        initFilters();
        loadProvincesForFilter(); // Load provinces from API before initializing multi-tag selects
        loadBusinessTypesForFilter(); // Load business types from API before initializing multi-tag selects
        initMultiTagSelects();
        initButtons();
    });

    /**
     * Initialize DataTable with server-side processing
     */
    function initDataTable() {
        table = $('#workRegulationTable').dataTableFigma({
            serverSide: true,
            processing: true,
            ajax: {
                url: '/Work-Regulation/getall',
                type: 'GET',
                data: function (d) {
                    // Build URLSearchParams for proper multi-value parameter handling
                    var params = new URLSearchParams();

                    // Pagination & sort
                    params.append('pageNumber', d.start / d.length + 1);
                    params.append('pageSize', d.length);

                    // Extract sort info
                    if (d.order && d.order.length > 0) {
                        var colIdx = d.order[0].column;
                        var dir = d.order[0].dir;
                        if (sortFieldMap[colIdx]) {
                            params.append('sortBy', sortFieldMap[colIdx]);
                            params.append('sortOrder', dir);
                        }
                    }

                    // Add custom filter params
                    var searchVal = $('#searchInput').val();
                    if (searchVal) params.append('searchTerm', searchVal);

                    // Multi-value filters (Multi-tag selects)
                    if (selectedTrangThai && selectedTrangThai.length > 0) {
                        selectedTrangThai.forEach(function (val) {
                            params.append('trangThai', val);
                        });
                    }

                    var nguonVal = $('#filterNguonDuLieu').val();
                    if (nguonVal) params.append('nguonDuLieu', nguonVal);

                    // Date range for ngayNop (submission date)
                    var ngayNopTuVal = $('#filterTuNgay').val();
                    if (ngayNopTuVal) params.append('ngayNopTu', ngayNopTuVal);

                    var ngayNopDenVal = $('#filterDenNgay').val();
                    if (ngayNopDenVal) params.append('ngayNopDen', ngayNopDenVal);

                    if (selectedLoaiHinhDN && selectedLoaiHinhDN.length > 0) {
                        selectedLoaiHinhDN.forEach(function (val) {
                            params.append('loaiHinhDN', val);
                        });
                    }

                    if (selectedTinhThanhPho && selectedTinhThanhPho.length > 0) {
                        selectedTinhThanhPho.forEach(function (val) {
                            params.append('tinhThanhPho', val);
                        });
                    }

                    // New filter parameters
                    var tenNSDLDVal = $('#filterTenNSDLD').val();
                    if (tenNSDLDVal) params.append('tenNSDLD', tenNSDLDVal);

                    var maSoThueVal = $('#filterMaSoThue').val();
                    if (maSoThueVal) params.append('maSoThue', maSoThueVal);

                    var diaChiVal = $('#filterDiaChi').val();
                    if (diaChiVal) params.append('diaChi', diaChiVal);

                    // Date range for ngayBanHanh (issue date)
                    var ngayBanHanhTuVal = $('#filterNgayBanHanhTu').val();
                    if (ngayBanHanhTuVal) params.append('ngayBanHanhTu', ngayBanHanhTuVal);

                    var ngayBanHanhDenVal = $('#filterNgayBanHanhDen').val();
                    if (ngayBanHanhDenVal) params.append('ngayBanHanhDen', ngayBanHanhDenVal);

                    // Number range for soLaoDong (employee count)
                    var soLaoDongTuVal = $('#filterSoLaoDongTu').val();
                    if (soLaoDongTuVal) params.append('soLaoDongTu', parseInt(soLaoDongTuVal));

                    var soLaoDongDenVal = $('#filterSoLaoDongDen').val();
                    if (soLaoDongDenVal) params.append('soLaoDongDen', parseInt(soLaoDongDenVal));

                    // Show deleted filter
                    params.append('showDeleted', showDeletedFilter);

                    return params.toString();
                },
                error: function (xhr, error, code) {
                    console.error('DataTables AJAX error:', error);
                    toastr.error('Không thể tải dữ liệu từ server', 'Lỗi');
                },
                dataSrc: 'data'
            },
            dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
            autoWidth: false,
            scrollX: false,
            order: [[6, 'desc']], // Default sort: NgayNopHoSo desc
            searching: false,
            pageLength: 10,
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/vi.json',
                processing: '<i class="fas fa-spinner fa-spin fa-2x"></i><br>Đang tải...'
            },
            columns: [
                {
                    // STT
                    data: null,
                    orderable: false,
                    searchable: false,
                    className: 'text-center',
                    width: '40px',
                    defaultContent: ''
                },
                {
                    // Số hồ sơ API
                    data: 'soHoSoApi',
                    render: function (data) {
                        return data ? '<code>' + escapeHtml(data) + '</code>' : '<span class="text-muted">—</span>';
                    }
                },
                {
                    // Tên NSDLĐ
                    data: 'tenNSDLD',
                    render: function (data, type, row) {
                        var html = '<div class="font-weight-bold text-primary" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="' + escapeHtml(data) + '">';
                        html += escapeHtml(data);
                        html += '</div>';
                        return html;
                    }
                },
                {
                    // Mã số thuế
                    data: 'maSoThue',
                    render: function (data) {
                        return data ? escapeHtml(data) : '<span class="text-muted">—</span>';
                    }
                },
                {
                    // Loại hình DN
                    data: 'tenLoaiHinhDN',
                    className: 'text-center',
                    render: function (data, type, row) {
                        // Display TenLoaiHinhDN (name) if available, otherwise show code
                        var displayText = data || '—';
                        return '<span class="badge badge-light" style="font-size: 0.9em;" title="' + escapeHtml(data) + '">' + escapeHtml(displayText) + '</span>';
                    }
                },
                {
                    // Số lao động
                    data: 'soLaoDong',
                    className: 'text-right',
                    render: function (data) {
                        return data !== null && data !== undefined ? new Intl.NumberFormat('vi-VN').format(data) : '<span class="text-muted">—</span>';
                    }
                },
                {
                    // Ngày nộp hồ sơ
                    data: 'ngayNopHoSo',
                    className: 'text-center',
                    render: function (data) {
                        return data ? formatDate(new Date(data)) : '<span class="text-muted">—</span>';
                    }
                },
                {
                    // Trạng thái
                    data: 'trangThai',
                    className: 'text-center',
                    render: function (data) {
                        var label = trangThaiLabels[data] || data;
                        var badgeClass = trangThaiBadgeClass[data] || 'badge-figma-secondary';
                        return '<span class="badge-figma ' + badgeClass + '">' + escapeHtml(label) + '</span>';
                    }
                },
                {
                    // Nguồn dữ liệu
                    data: 'nguonDuLieu',
                    className: 'text-center',
                    render: function (data, type, row) {
                        var badgeClass = nguonDuLieuBadgeClass[row.nguonDuLieu] || 'badge-figma-secondary';
                        return '<span class="badge-figma ' + badgeClass + '" style="font-size: 0.85em;">' + escapeHtml(nguonDuLieuLabels[row.nguonDuLieu] || "") + '</span>';
                    }
                },
                {
                    // Cảnh báo
                    data: 'hasWarnings',
                    className: 'text-center',
                    render: function (data, type, row) {
                        if (data) {
                            return '<i class="fas fa-exclamation-triangle text-warning" style="cursor:pointer;" title="Có cảnh báo - Xem chi tiết tab Cảnh báo"></i>';
                        }
                        return '<span class="text-muted">—</span>';
                    },
                    orderable: false,
                    className: 'text-center'
                },
                {
                    // SLA Status
                    data: 'slaStatus',
                    className: 'text-center',
                    render: function (data, type, row) {
                        if (!data) return '<span class="text-muted">—</span>';
                        var label = slaStatusLabels[data] || data;
                        var badgeClass = slaStatusBadgeClass[data] || '';
                        var html = '<span class="badge-figma ' + badgeClass + '">' + escapeHtml(label) + '</span>';
                        return html;
                    }
                },
                {
                    // Thao tác
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    width: '140px',
                    render: function (data, type, row) {
                        var html = '<div class="d-flex justify-content-center" style="gap:4px;">';

                        // Details button (always visible if CanRead)
                        if (window.userPermissions && (window.userPermissions.canRead === 'true' || window.userPermissions.canRead === true)) {
                            html += '<a href="/Work-Regulation/Details/' + row.id + '" class="btn-icon-figma" style="background:#555;" title="Chi tiết"><i class="fas fa-eye" style="color:#fff;"></i></a>';
                        }

                        // Edit button (only if CanUpdate and not DaKiemTra)
                        if (window.userPermissions && (window.userPermissions.canUpdate === 'true' || window.userPermissions.canUpdate === true) && row.trangThai !== '3') {
                            html += '<a href="/Work-Regulation/Edit/' + row.id + '" class="btn-icon-figma" style="background:var(--warning);" title="Chỉnh sửa"><i class="fas fa-edit" style="color:#fff;"></i></a>';
                        }

                        // Confirm button (only if CanConfirm and TrangThai = DangKiemTra)
                        if (window.userPermissions && (window.userPermissions.canConfirm === 'true' || window.userPermissions.canConfirm === true) && row.trangThai === '2') {
                            html += '<button type="button" class="btn-icon-figma btn-confirm" data-id="' + row.id + '" data-name="' + escapeHtml(row.tenNSDLD) + '" style="background:var(--success);" title="Xác nhận"><i class="fas fa-check" style="color:#fff;"></i></button>';
                        }

                        // Delete button (only if CanDelete and not DaKiemTra)
                        if (window.userPermissions && (window.userPermissions.canDelete === 'true' || window.userPermissions.canDelete === true) && row.trangThai !== '3') {
                            html += '<button type="button" class="btn-icon-figma btn-delete" data-id="' + row.id + '" data-name="' + escapeHtml(row.tenNSDLD) + '" style="background:var(--destructive);" title="Xóa"><i class="fas fa-trash-alt" style="color:#fff;"></i></button>';
                        }

                        html += '</div>';
                        return html;
                    }
                }
            ],
            drawCallback: function (settings) {
                // Call default figma DrawCallback
                if (window.FigmaDataTables && FigmaDataTables.defaultConfig) {
                    FigmaDataTables.defaultConfig.drawCallback(settings);
                }

                // Ensure pagination is in #paginationFrame
                const $container = $('.pagination-figma-container');
                if ($container.length && $('#paginationFrame').length) {
                    $container.appendTo('#paginationFrame');
                }

                // Render STT (sequence number)
                var api = this.api();
                var startIndex = api.context[0]._iDisplayStart;
                api.column(0, { page: 'current' }).nodes().each(function (cell, i) {
                    cell.innerHTML = startIndex + i + 1;
                });
            }
        });
    }

    /**
     * Initialize filter handlers
     */
    function initFilters() {
        // Toggle advanced filter section (award-management.js pattern: class-based toggle)
        $('#toggleFilter').on('click', function () {
            $(this).toggleClass('active');
            $('#advancedFilterArea').toggleClass('show');
        });

        // Checkbox: Show deleted records
        $('#chkShowDeleted').on('change', function () {
            showDeletedFilter = $(this).is(':checked');
            if (table) {
                table.ajax.reload();
            }
        });

        // Apply filter button - reload and auto-close advanced filter
        $('#btnApplyFilter').on('click', function () {
            if (table) {
                table.ajax.reload();
            }
            $('#advancedFilterArea').removeClass('show');
            $('#btnToggleFilter').removeClass('active');
        });

        // Search button - reload and auto-close advanced filter
        $('#btnSearch').on('click', function () {
            if (table) {
                table.ajax.reload();
            }
            $('#advancedFilterArea').removeClass('show');
            $('#toggleFilter').removeClass('active');
        });

        // Refresh button - clear all filters and toggle filter area closed
        $('#btnRefreshTable').on('click', function () {
            $('#advancedFilterArea').removeClass('show');
            $('#toggleFilter').removeClass('active');
        });

        // Reset filter button
        $('#btnResetFilter,#btnRefreshTable').on('click', function () {
            // Clear all filter inputs
            $('#searchInput').val('');
            $('#filterNguonDuLieu').val('');
            $('#filterTuNgay').val('');
            $('#filterDenNgay').val('');

            // Clear new filter inputs
            $('#filterTenNSDLD').val('');
            $('#filterMaSoThue').val('');
            $('#filterDiaChi').val('');
            $('#filterNgayBanHanhTu').val('');
            $('#filterNgayBanHanhDen').val('');
            $('#filterSoLaoDongTu').val('');
            $('#filterSoLaoDongDen').val('');

            // Clear multi-tag arrays and render
            selectedLoaiHinhDN = [];
            selectedTinhThanhPho = [];
            selectedTrangThai = [];
            renderTags('filterLoaiHinhDN');
            renderTags('filterTinhThanhPho');
            renderTags('filterTrangThai');

            // Reset checkbox
            $('#chkShowDeleted').prop('checked', false);
            showDeletedFilter = false;

            // Reload table
            if (table) {
                table.ajax.reload();
            }
        });

        // Search input: debounced reload (400ms)
        var searchTimer = null;
        $('#searchInput').on('keyup', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                if (table) {
                    table.ajax.reload();
                }
            }, 400);
        });

        // Quick filter dropdowns: reload on change (only for non-multi-tag selects)
        $('#filterNguonDuLieu').on('change', function () {
            if (table) {
                table.ajax.reload();
            }
        });
    }

    /**
     * Load provinces from AdministrativeDivisions API and populate filter options
     */
    function loadProvincesForFilter() {
        $.ajax({
            url: '/AdministrativeDivisions/GetAll',
            type: 'GET',
            dataType: 'json',
            success: function (response) {
                var $resultsContainer = $('#filterTinhThanhPhoResults');
                // Response is direct array, not wrapped in { data: ... }
                if (response && Array.isArray(response)) {
                    response.forEach(function (item) {
                        var $option = $('<div></div>')
                            .addClass('select-option')
                            .attr('data-val', item.name)
                            .text(item.name);
                        $resultsContainer.append($option);
                    });
                }
            },
            error: function (xhr, status, error) {
                console.error('Failed to load provinces from API:', status, error);
                // Fallback: show error in console
                console.log('Response:', xhr.responseText);
            }
        });
    }

    /**
     * Load business types from BusinessTypes API and populate filter options
     */
    function loadBusinessTypesForFilter() {
        $.ajax({
            url: '/BusinessTypes/GetAll',
            type: 'GET',
            dataType: 'json',
            success: function (response) {
                var $resultsContainer = $('#filterLoaiHinhDNResults');
                // Response is direct array, not wrapped in { data: ... }
                if (response && Array.isArray(response)) {
                    response.forEach(function (item) {
                        var $option = $('<div></div>')
                            .addClass('select-option')
                            .attr('data-val', item.code)
                            .text(item.name);
                        $resultsContainer.append($option);
                    });
                }
            },
            error: function (xhr, status, error) {
                console.error('Failed to load business types from API:', status, error);
                // Fallback: show error in console
                console.log('Response:', xhr.responseText);
            }
        });
    }

    /**
     * Initialize Multi-Tag Select controls (Loại hình DN, Tỉnh/TP, Trạng thái)
     */
    function initMultiTagSelects() {
        // Initialize each multi-tag select
        initMultiTag('filterLoaiHinhDN', selectedLoaiHinhDN);
        initMultiTag('filterTinhThanhPho', selectedTinhThanhPho);
        initMultiTag('filterTrangThai', selectedTrangThai);
    }

    /**
     * Initialize a single multi-tag select component
     */
    function initMultiTag(fieldId, tagArray) {
        var $container = $('#' + fieldId + 'Container');
        var $tagsContainer = $('#' + fieldId + 'Tags');
        var $input = $('#' + fieldId + 'Input');
        var $results = $('#' + fieldId + 'Results');

        // Focus input when clicking container
        $tagsContainer.on('click', function () {
            $input.focus();
        });

        // Show dropdown on input focus
        $input.on('focus', function () {
            $results.show();
        });

        // Filter options as user types
        $input.on('input', function () {
            var query = $(this).val().toLowerCase();
            $results.find('.select-option').each(function () {
                var text = $(this).text().toLowerCase();
                $(this).toggle(text.includes(query));
            });
            $results.show();
        });

        // Add tag when option clicked
        $results.on('click', '.select-option', function (e) {
            e.stopPropagation();
            var val = $(this).data('val');
            var text = $(this).text();

            // Get the correct array based on fieldId
            var currentArray = getTagArray(fieldId);

            if (!currentArray.includes(val)) {
                currentArray.push(val);
                renderTags(fieldId);
            }
            $input.val('');
            $results.hide();
        });

        // Hide dropdown when clicking outside
        $(document).on('click', function (e) {
            if (!$container.is(e.target) && $container.has(e.target).length === 0) {
                $results.hide();
            }
        });
    }

    /**
     * Get tag array by field ID
     */
    function getTagArray(fieldId) {
        switch (fieldId) {
            case 'filterLoaiHinhDN': return selectedLoaiHinhDN;
            case 'filterTinhThanhPho': return selectedTinhThanhPho;
            case 'filterTrangThai': return selectedTrangThai;
            default: return [];
        }
    }

    /**
     * Render tags for a multi-tag select
     */
    function renderTags(fieldId) {
        var $tagsContainer = $('#' + fieldId + 'Tags');
        var $input = $('#' + fieldId + 'Input');
        var tagArray = getTagArray(fieldId);

        // Remove existing tags
        $tagsContainer.find('.multi-tag').remove();

        // Render each tag
        tagArray.forEach(function (val) {
            // Get display text from corresponding option
            var text = $('#' + fieldId + 'Results .select-option[data-val="' + val + '"]').text();

            var $tag = $('<span class="multi-tag"></span>')
                .text(text)
                .append(' <i class="fas fa-times"></i>');

            // Handle tag removal
            $tag.find('i').on('click', function (e) {
                e.stopPropagation();
                var index = tagArray.indexOf(val);
                if (index > -1) {
                    tagArray.splice(index, 1);
                    renderTags(fieldId);
                }
            });

            $tag.insertBefore($input);
        });
    }

    /**
     * Initialize button handlers
     */
    function initButtons() {
        // File preview button (delegated - Award-Management pattern)
        // Handle both document-level and existingAttachmentList-level delegation
        $(document).on('click', '.btn-preview-file', function (e) {
            e.preventDefault();
            var fileId = $(this).data('id');
            var fileName = $(this).data('name');
            window.openFilePreview(fileId, fileName);
        });

        // File removal button (delegated - Award-Management pattern)
        // Use document-level delegation since #existingAttachmentList may not exist in Index view
        $(document).on('click', '.btn-remove-attachment', function (e) {
            e.preventDefault();
            window.handleRemoveExistingFile.call(this, e);
        });

        // File preview modal cleanup (Award-Management pattern)
        $('#pageFilePreviewModal').on('hidden.bs.modal', function () {
            $('#pageFilePreviewFrame').attr('src', 'about:blank').hide();
            $('#pageFilePreviewLoading').hide();
            $('#pageFilePreviewUnsupported').hide();
        });

        // Excel import/export placeholders
        $('#btnImportExcel').on('click', function (e) {
            e.preventDefault();
            if (typeof toastr !== 'undefined') {
                toastr.info('Chức năng Nhập từ Excel đang được phát triển.', 'Thông báo');
            }
        });

        // Export Excel button
        $('#btnExportExcel').on('click', function (e) {
            e.preventDefault();
            var $btn = $(this);
            var originalHtml = $btn.html();
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xuất...');

            var queryString = getFilterQueryString();
            var token = $('input[name="__RequestVerificationToken"]').val();

            $.ajax({
                url: '/Work-Regulation/ExportExcel?' + queryString,
                type: 'POST',
                headers: { 'RequestVerificationToken': token },
                data: { __RequestVerificationToken: token },
                xhrFields: {
                    responseType: 'blob'
                },
                success: function (blob, status, xhr) {
                    // Extract filename from Content-Disposition header
                    var filename = 'DangKyNoiQuyLaoDong_' + new Date().getTime() + '.xlsx';
                    var disposition = xhr.getResponseHeader('Content-Disposition');
                    if (disposition && disposition.indexOf('filename=') !== -1) {
                        var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                        var matches = filenameRegex.exec(disposition);
                        if (matches != null && matches[1]) {
                            filename = matches[1].replace(/['"]/g, '');
                        }
                    }

                    // Create download link
                    var url = window.URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);

                    toastr.success('Xuất Excel thành công', 'Thành công');
                    $btn.prop('disabled', false).html(originalHtml);
                },
                error: function (xhr) {
                    var error = 'Có lỗi xảy ra khi xuất Excel';
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        error = xhr.responseJSON.message;
                    }
                    toastr.error(error, 'Lỗi');
                    $btn.prop('disabled', false).html(originalHtml);
                }
            });
        });

        // Delete button (delegated)
        $('#workRegulationTable').on('click', '.btn-delete', function (e) {
            e.preventDefault();
            var btn = $(this);
            deleteId = btn.data('id');
            deleteName = btn.data('name');

            $('#deleteRecordName').text(deleteName);
            $('#deleteModal').modal('show');
        });

        // Confirm delete
        $('#btnConfirmDelete').off('click').on('click', function () {
            if (!deleteId) {
                toastr.error('Không tìm thấy ID bản ghi', 'Lỗi');
                return;
            }

            var $btn = $(this);
            var originalHtml = $btn.html();
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xóa...');

            var token = $('input[name="__RequestVerificationToken"]').val();

            $.ajax({
                url: '/Work-Regulation/Delete/' + deleteId,
                type: 'POST',
                headers: { 'RequestVerificationToken': token },
                data: { __RequestVerificationToken: token },
                success: function (response) {
                    $('#deleteModal').modal('hide');

                    if (response.isSuccess) {
                        toastr.success(response.message || 'Xóa thành công', 'Thành công');
                        table.ajax.reload();
                    } else {
                        toastr.error(response.message || 'Không thể xóa', 'Lỗi');
                    }

                    $btn.prop('disabled', false).html(originalHtml);
                    deleteId = null;
                    deleteName = '';
                },
                error: function (xhr) {
                    $('#deleteModal').modal('hide');
                    var error = 'Có lỗi xảy ra khi xóa';
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        error = xhr.responseJSON.message;
                    }
                    toastr.error(error, 'Lỗi');
                    $btn.prop('disabled', false).html(originalHtml);
                }
            });
        });

        // Confirm button (Xác nhận hồ sơ → DaKiemTra)
        $('#workRegulationTable').on('click', '.btn-confirm', function (e) {
            e.preventDefault();
            var btn = $(this);
            confirmId = btn.data('id');
            confirmName = btn.data('name');

            $('#confirmRecordName').text(confirmName);
            $('#confirmModal').modal('show');
        });

        // Confirm action
        $('#btnConfirmAction').off('click').on('click', function () {
            if (!confirmId) {
                toastr.error('Không tìm thấy ID bản ghi', 'Lỗi');
                return;
            }

            var $btn = $(this);
            var originalHtml = $btn.html();
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xử lý...');

            var token = $('input[name="__RequestVerificationToken"]').val();

            $.ajax({
                url: '/Work-Regulation/Confirm/' + confirmId,
                type: 'POST',
                headers: { 'RequestVerificationToken': token },
                data: { __RequestVerificationToken: token },
                success: function (response) {
                    $('#confirmModal').modal('hide');

                    if (response.isSuccess) {
                        toastr.success(response.message || 'Xác nhận thành công', 'Thành công');
                        table.ajax.reload();
                    } else {
                        toastr.error(response.message || 'Không thể xác nhận', 'Lỗi');
                    }

                    $btn.prop('disabled', false).html(originalHtml);
                    confirmId = null;
                    confirmName = '';
                },
                error: function (xhr) {
                    $('#confirmModal').modal('hide');
                    var error = 'Có lỗi xảy ra khi xác nhận';
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        error = xhr.responseJSON.message;
                    }
                    toastr.error(error, 'Lỗi');
                    $btn.prop('disabled', false).html(originalHtml);
                }
            });
        });
    }

    /**
     * Build query string from filter inputs
     */
    function getFilterQueryString() {
        var params = new URLSearchParams();

        var searchVal = $('#searchInput').val();
        if (searchVal) params.append('searchTerm', searchVal);

        // Multi-value filters - proper array handling
        var trangThaiVal = $('#filterTrangThai').val();
        if (trangThaiVal && Array.isArray(trangThaiVal) && trangThaiVal.length > 0) {
            trangThaiVal.forEach(function (val) {
                params.append('trangThai', val);
            });
        }

        var nguonVal = $('#filterNguonDuLieu').val();
        if (nguonVal) params.append('nguonDuLieu', nguonVal);

        var ngayNopTuVal = $('#filterTuNgay').val();
        if (ngayNopTuVal) params.append('ngayNopTu', ngayNopTuVal);

        var ngayNopDenVal = $('#filterDenNgay').val();
        if (ngayNopDenVal) params.append('ngayNopDen', ngayNopDenVal);

        var loaiHinhVal = $('#filterLoaiHinhDN').val();
        if (loaiHinhVal && Array.isArray(loaiHinhVal) && loaiHinhVal.length > 0) {
            loaiHinhVal.forEach(function (val) {
                params.append('loaiHinhDN', val);
            });
        }

        var tinhThanhVal = $('#filterTinhThanhPho').val();
        if (tinhThanhVal && Array.isArray(tinhThanhVal) && tinhThanhVal.length > 0) {
            tinhThanhVal.forEach(function (val) {
                params.append('tinhThanhPho', val);
            });
        }

        // New filter parameters
        var tenNSDLDVal = $('#filterTenNSDLD').val();
        if (tenNSDLDVal) params.append('tenNSDLD', tenNSDLDVal);

        var maSoThueVal = $('#filterMaSoThue').val();
        if (maSoThueVal) params.append('maSoThue', maSoThueVal);

        var diaChiVal = $('#filterDiaChi').val();
        if (diaChiVal) params.append('diaChi', diaChiVal);

        var ngayBanHanhTuVal = $('#filterNgayBanHanhTu').val();
        if (ngayBanHanhTuVal) params.append('ngayBanHanhTu', ngayBanHanhTuVal);

        var ngayBanHanhDenVal = $('#filterNgayBanHanhDen').val();
        if (ngayBanHanhDenVal) params.append('ngayBanHanhDen', ngayBanHanhDenVal);

        var soLaoDongTuVal = $('#filterSoLaoDongTu').val();
        if (soLaoDongTuVal) params.append('soLaoDongTu', soLaoDongTuVal);

        var soLaoDongDenVal = $('#filterSoLaoDongDen').val();
        if (soLaoDongDenVal) params.append('soLaoDongDen', soLaoDongDenVal);

        // Show deleted filter
        params.append('showDeleted', showDeletedFilter);

        console.log('Export query string:', params.toString()); // Debug
        return params.toString();
    }

    /**
     * Format Date to dd/MM/yyyy
     */
    function formatDate(date) {
        if (!(date instanceof Date) || isNaN(date)) return '';
        var day = ('0' + date.getDate()).slice(-2);
        var month = ('0' + (date.getMonth() + 1)).slice(-2);
        var year = date.getFullYear();
        return day + '/' + month + '/' + year;
    }

    /**
     * Get file icon class based on file extension
     */
    function getFileIconClass(fileName) {
        if (!fileName) return 'fas fa-file-alt text-muted';
        var ext = (fileName.split('.').pop() || '').toLowerCase();
        var map = {
            'pdf': 'fas fa-file-pdf text-danger',
            'doc': 'fas fa-file-word text-primary',
            'docx': 'fas fa-file-word text-primary',
            'xls': 'fas fa-file-excel text-success',
            'xlsx': 'fas fa-file-excel text-success',
            'ppt': 'fas fa-file-powerpoint text-warning',
            'pptx': 'fas fa-file-powerpoint text-warning',
            'jpg': 'fas fa-file-image text-info',
            'jpeg': 'fas fa-file-image text-info',
            'png': 'fas fa-file-image text-info',
            'gif': 'fas fa-file-image text-info'
        };
        return map[ext] || 'fas fa-file-alt text-muted';
    }

    /**
     * Render existing files list with preview and remove buttons
     */
    function renderExistingFiles(existingFiles, containerId) {
        let selector = containerId ? '#' + containerId : '#existingAttachmentList';
        let $list = $(selector).empty();

        existingFiles.forEach(function (file, idx) {
            let iconClass = getFileIconClass(file.fileName);
            let html = `
            <div class="d-flex align-items-center py-1 px-2 mb-1 rounded" style="background:#f8f9fa; border:1px solid #e9ecef;">
                <i class="${iconClass} fa-lg mr-2 flex-shrink-0"></i>
                <div class="flex-grow-1 text-truncate">
                    <button type="button" class="btn btn-link p-0 text-dark font-weight-bold small btn-preview-file" 
                            data-id="${file.id}" data-name="${escapeHtml(file.fileName)}" title="Xem tệp">
                        ${escapeHtml(file.fileName)}
                    </button>
                </div>
                <div class="ml-2 flex-shrink-0">
                    <button type="button" class="btn btn-sm btn-link text-danger btn-remove-attachment" data-id="${file.id}" title="Gỡ file này">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>`;
            $list.append(html);
        });

        let sectionSelector = containerId ? '#' + containerId.replace('List', 'Section') : '#existingAttachmentSection';
        $(sectionSelector).toggle(existingFiles.length > 0);
    }

    /**
     * Handle remove existing file (Award-Management pattern)
     */
    function handleRemoveExistingFile(event) {
        event.preventDefault();
        const id = $(this).data('id');
        // Handle both Edit form and Index view existing attachments
        const fileIdInput = $('#fileVanBanDeNghi_FileId, #fileGopYToChuc_FileId, #fileKyLuat_FileId, #fileNQLD_FileId').filter(function () {
            return $(this).val() === id;
        });

        if (fileIdInput.length) {
            fileIdInput.val('').trigger('change');
            const fileNameInput = fileIdInput.siblings('[id*="_FileName"]');
            if (fileNameInput.length) fileNameInput.val('').trigger('change');
        }

        $(this).closest('.rounded').fadeOut(300, function () {
            $(this).remove();
        });
    }

    /**
     * Open file preview modal (AJAX-based, consistent with award-management.js)
     */
    function openFilePreview(fileId, fileName) {
        if (!fileId) return;

        $('#pageFilePreviewFileName').text(fileName);
        $('#pageFilePreviewLoading').show();
        $('#pageFilePreviewFrame').hide();
        $('#pageFilePreviewUnsupported').hide();

        $('#pageFilePreviewModal').modal('show');

        const downloadUrl = `/FileManager/Download?id=${fileId}`;
        $('#pageFilePreviewDownloadBtn, #pageFilePreviewUnsupportedLink').attr('href', downloadUrl);

        const ext = (fileName.split('.').pop() || '').toLowerCase();
        const viewableExts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'txt'];

        if (viewableExts.includes(ext)) {
            // Get secure preview URL from FileManager (consistency with Violation & Award)
            $.ajax({
                url: '/FileManager/GetPreviewUrl?id=' + fileId,
                type: 'GET',
                success: function (res) {
                    if (res.success && res.url) {
                        $('#pageFilePreviewFrame').attr('src', res.url).on('load', function () {
                            $('#pageFilePreviewLoading').hide();
                            $(this).show();
                        });
                    } else {
                        $('#pageFilePreviewLoading').hide();
                        $('#pageFilePreviewUnsupported').show();
                    }
                },
                error: function () {
                    $('#pageFilePreviewLoading').hide();
                    $('#pageFilePreviewUnsupported').show();
                }
            });
        } else {
            $('#pageFilePreviewLoading').hide();
            $('#pageFilePreviewUnsupported').show();
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, function (m) { return map[m]; });
    }

    /**
     * Handle save form (Create or Edit) - AJAX submission with file upload support
     * Pattern: Award Management handleSave()-based
     */
    function handleSaveWorkRegulation(lyDoChinhSua) {
        // Find form - check both Create and Edit forms
        var form = document.getElementById('workRegulationForm') || document.getElementById('editForm');
        if (!form) {
            console.error('Form element not found');
            toastr.error('Không thể tìm thấy form', 'Lỗi');
            return;
        }

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        var $btn = $('#btnSaveWorkRegulation') || $('#btnShowReasonModal');
        if ($btn.length === 0) $btn = $('button[type="button"]:has(i.fa-save)').first();

        var originalHtml = $btn.html();
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Đang lưu...');

        try {
            var token = $('input[name="__RequestVerificationToken"]').val();
            var formData = new FormData(form);

            // Xử lý checkbox value thành true/false thay vì on/off hoặc absent
            $(form).find('input[type="checkbox"]').each(function () {
                formData.set(this.name, this.checked ? 'true' : 'false');
            });

            // Append files from each uploader into FormData (overrides hidden file inputs)
            if (window.fileNQLDUploader) {
                window.fileNQLDUploader.getFiles().forEach(function (f) {
                    formData.set('FileNQLD', f);
                });
            }
            if (window.fileVanBanDeNghiUploader) {
                window.fileVanBanDeNghiUploader.getFiles().forEach(function (f) {
                    formData.set('FileVanBanDeNghi', f);
                });
            }
            if (window.fileGopYToChucUploader) {
                window.fileGopYToChucUploader.getFiles().forEach(function (f) {
                    formData.set('FileGopYToChuc', f);
                });
            }
            if (window.fileKyLuatUploader) {
                window.fileKyLuatUploader.getFiles().forEach(function (f) {
                    formData.set('FileKyLuat', f);
                });
            }

            // Get the form's current action
            var action = $(form).attr('action') || '';
            var url = action;

            if (!url) {
                // Construct URL from current pathname
                var pathParts = window.location.pathname.split('/').filter(Boolean);
                var isEdit = pathParts[pathParts.length - 2] === 'Edit' || window.location.pathname.includes('/Edit/');
                url = isEdit ?
                    window.location.pathname :
                    window.location.pathname.split('/').slice(0, -1).join('/') + '/Create';
            }

            if (lyDoChinhSua) {
                formData.append('LyDoChinhSua', lyDoChinhSua);
            }

            $.ajax({
                url: url,
                type: 'POST',
                data: formData,
                contentType: false,
                processData: false,
                headers: { 'RequestVerificationToken': token },
                success: function (response) {
                    // Check if response is JSON
                    var isJson = (response instanceof Object);

                    if (isJson && response.isSuccess) {
                        toastr.success(response.message || 'Lưu thông tin thành công', 'Thành công');
                        // Redirect to Index after success
                        setTimeout(function () {
                            var baseUrl = window.location.pathname.split('/').slice(0, -2).join('/') || '/Work-Regulation';
                            window.location.href = baseUrl;
                        }, 1500);
                    } else if (isJson) {
                        // Build error message with bullet list if errors array is non-empty
                        var msg = response.message || response.error || 'Đã xảy ra lỗi khi lưu dữ liệu';
                        if (response.errors && Array.isArray(response.errors) && response.errors.length > 0) {
                            var html = msg + '<ul class="mb-0 mt-1 pl-4" style="text-align:left;">';
                            response.errors.forEach(function (e) {
                                html += '<li>' + e + '</li>';
                            });
                            html += '</ul>';
                            toastr.error(html, 'Lỗi', { escapeHtml: false });
                        } else {
                            toastr.error(msg, 'Lỗi');
                        }
                        $btn.prop('disabled', false).html(originalHtml);
                    } else {
                        toastr.error('Đã xảy ra lỗi không xác định', 'Lỗi');
                        $btn.prop('disabled', false).html(originalHtml);
                    }
                },
                error: function (xhr, status, error) {
                    console.error('Save error:', error, xhr);
                    var msg = 'Đã xảy ra lỗi khi lưu dữ liệu';

                    if (xhr.responseJSON) {
                        var rj = xhr.responseJSON;
                        msg = rj.message || rj.error || msg;
                        if (rj.errors && Array.isArray(rj.errors) && rj.errors.length > 0) {
                            var html = msg + '<ul class="mb-0 mt-1 pl-4" style="text-align:left;">';
                            rj.errors.forEach(function (e) {
                                html += '<li>' + e + '</li>';
                            });
                            html += '</ul>';
                            toastr.error(html, 'Lỗi', { escapeHtml: false });
                            $btn.prop('disabled', false).html(originalHtml);
                            return;
                        }
                    } else if (xhr.status === 400) {
                        msg = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại';
                    } else if (xhr.status === 401) {
                        msg = 'Phiên làm việc đã hết. Vui lòng đăng nhập lại';
                    } else if (xhr.status === 403) {
                        msg = 'Bạn không có quyền thực hiện hành động này';
                    }

                    toastr.error(msg, 'Lỗi');
                    $btn.prop('disabled', false).html(originalHtml);
                }
            });
        } catch (ex) {
            console.error('Exception during save:', ex);
            toastr.error('Có lỗi xảy ra: ' + ex.message, 'Lỗi');
            $btn.prop('disabled', false).html(originalHtml);
        }
    }

    // Make functions globally accessible for inline event handlers and Edit.cshtml
    window.handleSaveWorkRegulation = handleSaveWorkRegulation;
    window.openFilePreview = openFilePreview;
    window.handleRemoveExistingFile = handleRemoveExistingFile;
    window.renderExistingFiles = renderExistingFiles;

})();
