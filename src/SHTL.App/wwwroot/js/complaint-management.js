/**
 * Complaint Management - Client JS (IIFE Pattern)
 * Module: M0062 (Đơn thư Khiếu nại)
 * Screen: SCR-NV-DON-001 — Danh sách đơn thư
 * Pattern: DataTables server-side + Quick Filter Chips + Row Highlighting
 */
(function () {
    'use strict';

    let complaintTable;
    let currentChipFilter = '';
    let selectedLoaiKetQua = [];  // State array for multi-tag select: Results
    let selectedLoaiDon = [];     // State array for multi-tag select: Complaint types
    let complaintTypeMap = {};    // ID -> Name mapping for tags

    // ─── Status badge mapping ───────────────────────────────────────
    const STATUS_BADGES = {
        'Draft': { label: 'Dự thảo', css: 'badge-figma badge-figma-info' },
        'Pending': { label: 'Đang phân loại', css: 'badge-figma badge-figma-warning' },
        'Accepted': { label: 'Đã thụ lý', css: 'badge-figma badge-figma-primary' },
        'Rejected': { label: 'Không thụ lý', css: 'badge-figma badge-figma-danger' },
        'Transferred': { label: 'Chuyển cơ quan', css: 'badge-figma badge-figma-warning' },
        'Assigned': { label: 'Đã phân công', css: 'badge-figma badge-figma-primary' },
        'InProgress': { label: 'Đang xử lý', css: 'badge-figma badge-figma-warning' },
        'Notified': { label: 'Đã thông báo', css: 'badge-figma', extra: 'background:#e0f2fe;color:#0369a1;' },
        'Closed': { label: 'Đã giải quyết', css: 'badge-figma badge-figma-success' }
    };

    // ─── Utility functions ──────────────────────────────────────────

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    /**
     * Format ISO date string to dd/MM/yyyy
     */
    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        var dd = String(d.getDate()).padStart(2, '0');
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var yyyy = d.getFullYear();
        return dd + '/' + mm + '/' + yyyy;
    }

    /**
     * Calculate days remaining (negative = overdue)
     */
    function getDaysRemaining(dueDateStr) {
        if (!dueDateStr) return null;
        var due = new Date(dueDateStr);
        if (isNaN(due.getTime())) return null;
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    }

    /**
     * Get row highlight CSS class based on deadline proximity
     * BR-18: Only applies to non-final statuses
     */
    function getRowHighlightClass(row) {
        var finalStatuses = ['Notified', 'Closed', 'Rejected', 'Transferred'];
        if (finalStatuses.indexOf(row.status) >= 0) return '';

        if (row.isOverdue) return 'complaint-row-overdue';

        var daysLeft = getDaysRemaining(row.dueDate);
        if (daysLeft === null) return '';
        if (daysLeft < 0) return 'complaint-row-overdue';
        if (daysLeft <= 3) return 'complaint-row-d3';
        if (daysLeft <= 7) return 'complaint-row-d7';
        return '';
    }

    /**
     * Render status badge
     */
    function renderStatusBadge(status) {
        var badge = STATUS_BADGES[status];
        if (!badge) return escapeHtml(status);
        var style = badge.extra ? ' style="' + badge.extra + '"' : '';
        return '<span class="' + badge.css + '"' + style + '>' + escapeHtml(badge.label) + '</span>';
    }

    /**
     * Render deadline status column badge
     * Returns: "Còn hạn" | "Còn N ngày" | "Quá hạn N ngày" | "—"
     */
    function renderDeadlineStatusBadge(row) {
        var finalStatuses = ['Rejected', 'Transferred', 'Resolved', 'Notified', 'Closed'];
        if (finalStatuses.indexOf(row.status) >= 0 || !row.dueDate) {
            return '<span class="text-muted" style="font-size:12px;">—</span>';
        }

        var daysLeft = getDaysRemaining(row.dueDate);
        if (daysLeft === null) {
            return '<span class="text-muted" style="font-size:12px;">—</span>';
        }

        if (daysLeft < 0) {
            var overdueDays = Math.abs(daysLeft);
            return '<span class="badge-figma badge-figma-danger" style="white-space:nowrap;">'
                + 'Quá hạn ' + overdueDays + ' ngày</span>';
        }
        if (daysLeft === 0) {
            return '<span class="badge-figma badge-figma-danger" style="white-space:nowrap;">Hết hạn hôm nay</span>';
        }
        if (daysLeft <= 3) {
            return '<span class="badge-figma badge-figma-warning" style="white-space:nowrap;">'
                + 'Còn ' + daysLeft + ' ngày</span>';
        }
        return '<span class="badge-figma badge-figma-success" style="white-space:nowrap;">Còn hạn</span>';
    }

    /**
     * Render deadline badge (overdue / near deadline indicator)
     */
    function renderDeadlineBadge(row) {
        var dateStr = formatDate(row.dueDate);
        if (!dateStr) return '';

        var finalStatuses = ['Notified', 'Closed', 'Rejected', 'Transferred'];
        if (finalStatuses.indexOf(row.status) >= 0) return dateStr;

        var daysLeft = getDaysRemaining(row.dueDate);
        if (daysLeft === null) return dateStr;

        if (daysLeft < 0) {
            return dateStr + ' <span class="badge-figma badge-figma-danger" style="font-size:10px;">Quá hạn</span>';
        }
        if (daysLeft <= 3) {
            return dateStr + ' <span class="badge-figma badge-figma-warning" style="font-size:10px;">D-' + daysLeft + '</span>';
        }
        return dateStr;
    }

    /**
     * Get anti-forgery token value
     */
    function getAntiForgeryToken() {
        var input = document.querySelector('input[name="__RequestVerificationToken"]');
        return input ? input.value : '';
    }

    function getCookie(name) {
        var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : '';
    }

    // ─── Multi-tag select helpers ────────────────────────────────────

    /**
     * Initialize multi-tag select component
     */
    function initMultiTagSelect(fieldId, stateArray) {
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
            var searchTerm = $(this).val().toLowerCase();
            $results.find('.select-option').each(function () {
                var optionText = $(this).text().toLowerCase();
                $(this).toggle(optionText.indexOf(searchTerm) > -1);
            });
        });

        // Add tag when option clicked
        $results.on('click', '.select-option', function (e) {
            e.stopPropagation();
            var val = $(this).data('val');

            if (stateArray.indexOf(val) === -1) {
                stateArray.push(val);
                renderMultiTagSelect(fieldId, stateArray);
            }

            $input.val('');
            $results.find('.select-option').show();
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
     * Render tags for multi-tag select
     */
    function renderMultiTagSelect(fieldId, stateArray) {
        var $tagsContainer = $('#' + fieldId + 'Tags');
        var $input = $('#' + fieldId + 'Input');

        // Map value to label
        var valueToLabel = {
            'CHAP_NHAN_TOAN_PHAN': 'Chấp nhận toàn phần',
            'CHAP_NHAN_MOT_PHAN': 'Chấp nhận một phần',
            'KHONG_CHAP_NHAN': 'Không chấp nhận',
            'DINH_CHI': 'Đình chỉ',
            'TAM_DINH_CHI': 'Tạm đình chỉ'
        };

        // If it's Complaint Type, use the loaded map
        if (fieldId === 'filterLoaiDon') {
            valueToLabel = complaintTypeMap;
        }

        // Remove existing tags
        $tagsContainer.find('.multi-tag').remove();

        // Render each tag
        stateArray.forEach(function (val) {
            var label = valueToLabel[val] || val;
            var $tag = $('<span class="multi-tag">' + escapeHtml(label) + ' <i class="fas fa-times"></i></span>');

            $tag.find('i').on('click', function (e) {
                e.stopPropagation();
                var idx = stateArray.indexOf(val);
                if (idx > -1) {
                    stateArray.splice(idx, 1);
                    renderMultiTagSelect(fieldId, stateArray);
                }
            });

            $input.before($tag);
        });
    }

    /**
     * Load complaint types from API to populate filter dropdown
     */
    function loadComplaintTypes() {
        var $results = $('#filterLoaiDonResults');

        $.ajax({
            url: '/ComplaintType/GetAll',
            type: 'GET',
            data: { isActive: true, pageSize: 100 },
            success: function (result) {
                if (result.success && result.data) {
                    $results.empty();
                    result.data.forEach(function (type) {
                        complaintTypeMap[type.id] = type.name;
                        var $option = $('<div class="select-option" data-val="' + type.id + '">' + escapeHtml(type.name) + '</div>');
                        $results.append($option);
                    });

                    if (result.data.length === 0) {
                        $results.append('<div class="text-center p-2" style="font-size:12px;color:#94a3b8;">Nô data</div>');
                    }
                } else {
                    $results.html('<div class="text-center p-2 text-danger" style="font-size:12px;">Không thể tải dữ liệu</div>');
                }
            },
            error: function () {
                $results.html('<div class="text-center p-2 text-danger" style="font-size:12px;">Lỗi kết nối</div>');
            }
        });
    }

    function initDataTable() {
        complaintTable = $('#complaintTable').dataTableFigma({
            processing: true,
            serverSide: true,
            ajax: {
                url: '/Complaint/GetAll',
                type: 'GET',
                data: function (d) {
                    // URLSearchParams pattern (from UI-COMPONENTS-ANALYSIS-REPORT)
                    var params = new URLSearchParams();

                    var pageSize = d.length;
                    var page = Math.floor(d.start / pageSize) + 1;

                    params.append('page', page);
                    params.append('pageSize', pageSize);

                    // Quick search
                    var searchVal = $('#searchInput').val();
                    if (searchVal) params.append('search', searchVal);

                    // ─── Advanced filters (SCR-NV-TRA-001) ───────────────────
                    // Row 1: Mã đơn, Họ tên, MST
                    var maDonVal = $('#filterMaDon').val();
                    if (maDonVal) params.append('maDon', maDonVal);

                    var hoTenVal = $('#filterHoTen').val();
                    if (hoTenVal) params.append('hoTen', hoTenVal);

                    var maSoNopDonVal = $('#filterMaSoNopDon').val();
                    if (maSoNopDonVal) params.append('maSoNopDon', maSoNopDonVal);

                    // Row 2: Date range + Kênh
                    var dateFromVal = $('#filterDateFrom').val();
                    if (dateFromVal) params.append('receivedDateFrom', dateFromVal);

                    var dateToVal = $('#filterDateTo').val();
                    if (dateToVal) params.append('receivedDateTo', dateToVal);

                    var kenhVal = $('#filterKenh').val();
                    if (kenhVal) params.append('kenh', kenhVal);

                    // Row 3: Loại đơn (Multi-tag)
                    selectedLoaiDon.forEach(function (val) { params.append('loaiDon', val); });

                    // Row 4: Trạng thái (checkboxes)
                    var trangThaiVals = $('input[name="trangThai"]:checked').map(function () { return $(this).val(); }).get();
                    trangThaiVals.forEach(function (val) { params.append('trangThai', val); });

                    // Row 5: Tình trạng hạn + Loại kết quả
                    var tinhTrangHanVal = $('#filterTinhTrangHan').val();
                    if (tinhTrangHanVal && tinhTrangHanVal !== 'ALL') params.append('tinhTrangHan', tinhTrangHanVal);

                    // Multi-tag select: loại kết quả
                    selectedLoaiKetQua.forEach(function (val) { params.append('loaiKetQua', val); });

                    // ─── Chip filter ──────────────────────────────────────
                    // All chip-based filters use 'chipFilter' param — backend handles the mapping
                    if (currentChipFilter) {
                        params.append('chipFilter', currentChipFilter);
                    }

                    return params.toString();
                },
                dataSrc: function (json) {
                    if (!json.success) {
                        toastr.error(json.message || 'Không thể tải dữ liệu');
                        return [];
                    }
                    return json.data;
                }
            },
            columns: [
                {
                    // Mã đơn thư
                    data: 'code',
                    render: function (data, type, row) {
                        return '<a href="/Complaint/Details/' + row.id + '" class="complaint-code-link">' + escapeHtml(data) + '</a>';
                    }
                },
                {
                    // Người nộp đơn
                    data: 'submitterName',
                    render: function (data, _type, row) {
                        return escapeHtml(`${data} (${row.submitterTypeName})`);
                    }
                },
                {
                    // Loại đơn
                    data: 'complaintTypeName',
                    render: function (data) {
                        if (!data) return '';
                        return escapeHtml(data);
                    }
                },
                {
                    // Ngày nhận
                    data: 'receivedDate',
                    render: function (data) {
                        return formatDate(data);
                    }
                },
                {
                    // Hạn giải quyết
                    data: 'dueDate',
                    render: function (data, type, row) {
                        return formatDate(data);
                    }
                },
                {
                    // Cán bộ phụ trách
                    data: 'assignedToUserName',
                    render: function (data, type, row) {
                        if (!data) return '<span style="color:#94a3b8;">Chưa phân công</span>';
                        var text = escapeHtml(data);
                        if (row.departmentName) {
                            text += ' – <small class="text-muted">' + escapeHtml(row.departmentName) + '</small>';
                        }
                        return text;
                    }
                },
                {
                    // Trạng thái
                    data: 'status',
                    render: function (data) {
                        return renderStatusBadge(data);
                    }
                },
                {
                    // Tình trạng hạn
                    data: 'dueDate',
                    orderable: false,
                    render: function (data, type, row) {
                        return renderDeadlineStatusBadge(row);
                    }
                },
                {
                    // Thao tác
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    render: function (data, type, row) {
                        var buttons = '<a href="/Complaint/Details/' + row.id + '" class="btn-icon-figma btn-figma-primary" '
                            + 'style="width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;" '
                            + 'title="Xem chi tiết"><i class="fas fa-eye" style="font-size:12px;"></i></a>';

                        if (window.userPermissions.canDelete && row.status === 'Draft') {
                            buttons += ' <button onclick="window.complaintDeleteItem(\'' + row.id + '\', \'' + escapeHtml(row.code).replace(/'/g, "\\'") + '\')" '
                                + 'class="btn-icon-figma btn-figma-destructive" '
                                + 'style="width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;" '
                                + 'title="Xóa"><i class="fas fa-trash" style="font-size:12px;"></i></button>';
                        }

                        return buttons;
                    }
                }
            ],
            createdRow: function (row, data) {
                var cls = getRowHighlightClass(data);
                if (cls) $(row).addClass(cls);
            },
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/vi.json',
                processing: '<i class="fas fa-spinner fa-spin fa-2x"></i><br>Đang tải...'
            },
            autoWidth: false,
            scrollX: false,
            order: [[0, 'desc']], // Sort by Mã đơn thư descending (BR-17)
            pageLength: 20,
            lengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
            dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
            // Draw callback
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

                // Other custom rendering after each draw
            }
        });
    }

    // ─── Chip Counts ─────────────────────────────────────────────────

    function loadChipCounts() {
        $.ajax({
            url: '/Complaint/GetChipCounts',
            method: 'GET',
            success: function (result) {
                if (result.success && result.data) {
                    var d = result.data;
                    $('#countAll').text(d.all != null ? d.all : 0);
                    $('#countInProgress').text(d.inProgress != null ? d.inProgress : 0);
                    $('#countOverdue').text(d.overdue != null ? d.overdue : 0);
                    $('#countNearDeadline').text(d.nearDeadline != null ? d.nearDeadline : 0);
                    $('#countResolved').text(d.resolved != null ? d.resolved : 0);
                    $('#countRejected').text(d.rejected != null ? d.rejected : 0);
                }
            },
            error: function () {
                // Non-critical — leave badge counts showing '-'
            }
        });
    }

    // ─── Quick Filter Chips ─────────────────────────────────────────

    function initQuickFilterChips() {
        $(document).on('click', '.filter-chip', function () {
            $('.filter-chip').removeClass('active');
            $(this).addClass('active');
            currentChipFilter = $(this).data('filter') || '';

            // Clear advanced filter status when chip is active
            if (currentChipFilter) {
                $('#filterStatus').val('');
            }

            complaintTable.ajax.reload();
        });
    }

    // ─── Search & Filter ────────────────────────────────────────────

    function initSearch() {
        var searchTimer;

        // Toggle advanced filter area
        $('#toggleFilter').on('click', function () {
            $(this).toggleClass('active');
            $('#advancedFilterArea').toggleClass('show');
        });

        // Debounce 400ms on search input
        $('#searchInput').on('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                complaintTable.ajax.reload();
            }, 400);
        });

        // Search button — reload and auto-close advanced filter
        $('#btnSearch').on('click', function () {
            complaintTable.ajax.reload();
            $('#advancedFilterArea').removeClass('show');
            $('#toggleFilter').removeClass('active');
        });

        // Apply advanced filters — reload and auto-close
        $('#btnApplyFilter').on('click', function () {
            // Clear chip filter when using advanced filter (checkboxes take precedence)
            var hasCheckboxFilter = $('input[name="trangThai"]:checked').length > 0 ||
                selectedLoaiDon.length > 0;
            if (hasCheckboxFilter) {
                currentChipFilter = '';
                $('.filter-chip').removeClass('active');
                $('.filter-chip[data-filter=""]').addClass('active');
            }
            complaintTable.ajax.reload();
            // Auto-close advanced filter area
            $('#advancedFilterArea').removeClass('show');
            $('#toggleFilter').removeClass('active');
        });

        // Reset all filters — clear and reload
        $('#btnResetFilter,#btnRefreshTable').on('click', function () {
            // Reset quick search
            $('#searchInput').val('');

            // Reset Row 1: Mã đơn, Họ tên, MST
            $('#filterMaDon').val('');
            $('#filterHoTen').val('');
            $('#filterMaSoNopDon').val('');

            // Reset Row 2: Date range + Kênh
            $('#filterDateFrom').val('');
            $('#filterDateTo').val('');
            $('#filterKenh').val('');

            // Reset Row 3: Loại đơn
            selectedLoaiDon.splice(0);
            renderMultiTagSelect('filterLoaiDon', selectedLoaiDon);

            // Reset Row 4: Trạng thái
            $('input[name="trangThai"]').prop('checked', false);

            // Reset Row 5: Tình trạng hạn + Loại kết quả
            $('#filterTinhTrangHan').val('ALL');
            selectedLoaiKetQua.splice(0);
            renderMultiTagSelect('filterLoaiKetQua', selectedLoaiKetQua);

            // Reset chip filter
            currentChipFilter = '';
            $('.filter-chip').removeClass('active');
            $('.filter-chip[data-filter=""]').addClass('active');

            complaintTable.ajax.reload();
        });

        // Refresh button — clear filters and close advanced area
        $('#btnRefreshTable').on('click', function () {
            $('#advancedFilterArea').removeClass('show');
            $('#toggleFilter').removeClass('active');
            complaintTable.ajax.reload(null, false);
        });
    }

    // ─── Delete action ──────────────────────────────────────────────

    window.complaintDeleteItem = function (id, code) {
        if (!confirm('Bạn có chắc muốn xóa đơn thư "' + code + '"?\n\nChỉ có thể xóa đơn ở trạng thái Nháp.')) {
            return;
        }

        $.ajax({
            url: '/Complaint/Delete/' + id,
            type: 'POST',
            headers: {
                'X-XSRF-TOKEN': getCookie('XSRF-TOKEN')
            },
            data: {
                __RequestVerificationToken: getAntiForgeryToken()
            },
            success: function (result) {
                if (result.success) {
                    toastr.success('Đã xóa đơn thư thành công');
                    complaintTable.ajax.reload(null, false);
                } else {
                    toastr.error(result.message || 'Không thể xóa đơn thư');
                }
            },
            error: function () {
                toastr.error('Không thể kết nối đến máy chủ');
            }
        });
    };

    // ─── Export ──────────────────────────────────────────────────────

    function initExport() {
        $('#btnExport').on('click', function () {
            var params = {
                search: $('#searchInput').val(),
                maDon: $('#filterMaDon').val(),
                hoTen: $('#filterHoTen').val(),
                maSoNopDon: $('#filterMaSoNopDon').val(),
                receivedDateFrom: $('#filterDateFrom').val(),
                receivedDateTo: $('#filterDateTo').val(),
                kenh: $('#filterKenh').val(),
                chipFilter: currentChipFilter || '',
                tinhTrangHan: $('input[name="tinhTrangHan"]:checked').val()
            };

            // Add loaiDon array
            selectedLoaiDon.forEach(function (val, idx) {
                params['loaiDon[' + idx + ']'] = val;
            });

            // Add trangThai array
            var trangThaiVals = $('input[name="trangThai"]:checked').map(function () { return $(this).val(); }).get();
            trangThaiVals.forEach(function (val, idx) {
                params['trangThai[' + idx + ']'] = val;
            });

            // Add loaiKetQua array (multi-tag select)
            selectedLoaiKetQua.forEach(function (val, idx) {
                params['loaiKetQua[' + idx + ']'] = val;
            });

            var queryString = $.param(params);
            window.location.href = '/Complaint/Export?' + queryString;
        });
    }

    // ─── Initialize ─────────────────────────────────────────────────

    $(document).ready(function () {
        initDataTable();
        initQuickFilterChips();
        initSearch();
        initExport();
        loadChipCounts();
        initMultiTagSelect('filterLoaiKetQua', selectedLoaiKetQua);
        initMultiTagSelect('filterLoaiDon', selectedLoaiDon);
        loadComplaintTypes();
    });

})();
