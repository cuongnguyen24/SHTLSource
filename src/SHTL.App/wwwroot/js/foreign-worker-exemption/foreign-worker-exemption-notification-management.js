/**
 * foreign-worker-exemption-notification-management.js
 * Module: LĐNN-KTDCP (M0121) — SCR-NV-HS-001: Danh sách hồ sơ thông báo
 *
 * ARCHITECTURE: JavaScript → MVC Controller (/Foreign-Worker-Exemption-Notification/*)
 *               → ApiService (HttpClient) → Labor.Api Backend
 * NEVER call /api/v1/... directly from JS.
 */
(function () {
    'use strict';

    // ─── State ───────────────────────────────────────────────────────────────
    var table;
    var currentStatus = ''; // active tab status filter ('' = all)
    var filterOpen = false;

    // ─── MVC Action routes (NEVER /api/v1/...) ───────────────────────────────
    var ROUTES = {
        getAll: '/Foreign-Worker-Exemption-Notification/getall',
        getStatusCounts: '/Foreign-Worker-Exemption-Notification/get-status-counts',
        details: '/Foreign-Worker-Exemption-Notification/details/',
        edit: '/Foreign-Worker-Exemption-Notification/edit/',
        accept: '/Foreign-Worker-Exemption-Notification/accept/',
        supplementRequest: '/Foreign-Worker-Exemption-Notification/supplement-request/',
        cancel: '/Foreign-Worker-Exemption-Notification/cancel/',
        exportForm: '/Foreign-Worker-Exemption-Notification/export-form/',
        exportExcel: '/Foreign-Worker-Exemption-Notification/export-excel'
    };

    // ─── Status badge mapping (INT enum values from backend) ─────────────────
    var STATUS_BADGES = {
        'Draft': '<span class="badge badge-secondary">Nháp</span>',
        'PendingApproval': '<span class="badge badge-warning">Chờ xác nhận</span>',
        'Accepted': '<span class="badge badge-success">Đã tiếp nhận</span>',
        'SupplementRequest': '<span class="badge badge-info">Yêu cầu bổ sung</span>',
        'Cancelled': '<span class="badge badge-danger">Đã huỷ</span>',
        'Completed': '<span class="badge badge-primary">Đã kết thúc</span>'
    };

    // ─── Phương án badge ──────────────────────────────────────────────────────
    var PA_BADGES = {
        1: '<span class="badge badge-pa-a">PA-A</span>',
        2: '<span class="badge badge-pa-b">PA-B</span>'
    };

    function getStatusBadge(status, display) {
        return STATUS_BADGES[status] || ('<span class="badge">' + display + '</span>');
    }

    function getPaBadge(method) {
        return PA_BADGES[method] || '<span class="badge">' + method + '</span>';
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────
    function formatDate(isoDate) {
        if (!isoDate) return '—';
        var d = new Date(isoDate);
        if (isNaN(d)) return isoDate;
        return ('0' + d.getDate()).slice(-2) + '/'
            + ('0' + (d.getMonth() + 1)).slice(-2) + '/'
            + d.getFullYear();
    }

    function truncate(str, maxLen) {
        if (!str) return '';
        return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getAntiForgeryToken() {
        return $('input[name="__RequestVerificationToken"]').first().val() || '';
    }

    // ─── Row action buttons (conditional per status + BR-14) ─────────────────
    function renderActions(data, type, row) {
        var status = row.status;
        var id = row.id;
        var refNum = escapeHtml(row.referenceNumber || '');
        var supplementCount = row.supplementRequestCount || 0;
        var html = '';

        // [Xem] — always visible
        html += '<a href="' + ROUTES.details + id + '" '
            + 'class="btn btn-sm btn-figma btn-figma-outline mr-1" title="Xem chi tiết">'
            + '<i class="fas fa-eye"></i></a>';

        if (status === 2) {
            // PendingApproval: Xác nhận + YCBS (if < 3) + Huỷ
            if (window.userPermissions.canApprove) {
                html += '<button class="btn btn-sm btn-figma mr-1 btn-accept" '
                    + 'data-id="' + id + '" data-ref="' + refNum + '" '
                    + 'style="background:#065f46;color:#fff;border:none;" title="Xác nhận tiếp nhận">'
                    + '<i class="fas fa-check"></i> Xác nhận</button>';
            }
            if (window.userPermissions.canApprove && supplementCount < 3) {
                html += '<button class="btn btn-sm btn-figma btn-figma-outline mr-1 btn-ycbs" '
                    + 'data-id="' + id + '" data-count="' + supplementCount + '" title="Yêu cầu bổ sung">'
                    + '<i class="fas fa-exclamation-circle"></i> YCBS</button>';
            }
            if (window.userPermissions.canDelete) {
                html += '<button class="btn btn-sm btn-figma btn-figma-outline text-danger mr-1 btn-cancel" '
                    + 'data-id="' + id + '" data-ref="' + refNum + '" title="Huỷ hồ sơ">'
                    + '<i class="fas fa-ban"></i></button>';
            }
        } else if (status === 3) {
            // Accepted: Xuất BM + YCBS (if < 3) + Huỷ
            if (window.userPermissions.canExport) {
                html += '<button class="btn btn-sm btn-figma btn-figma-outline mr-1 btn-export-bm-row" '
                    + 'data-id="' + id + '" title="Xuất biểu mẫu">'
                    + '<i class="fas fa-file-word"></i> Xuất BM</button>';
            }
            if (window.userPermissions.canApprove && supplementCount < 3) {
                html += '<button class="btn btn-sm btn-figma btn-figma-outline mr-1 btn-ycbs" '
                    + 'data-id="' + id + '" data-count="' + supplementCount + '" title="Yêu cầu bổ sung">'
                    + '<i class="fas fa-exclamation-circle"></i> YCBS</button>';
            }
            if (window.userPermissions.canDelete) {
                html += '<button class="btn btn-sm btn-figma btn-figma-outline text-danger mr-1 btn-cancel" '
                    + 'data-id="' + id + '" data-ref="' + refNum + '" title="Huỷ hồ sơ">'
                    + '<i class="fas fa-ban"></i></button>';
            }
        } else if (status === 4) {
            // SupplementRequested: Nhập thay BS
            if (window.userPermissions.canUpdate) {
                html += '<a href="' + ROUTES.edit + id + '" '
                    + 'class="btn btn-sm btn-figma mr-1" '
                    + 'style="background:var(--primary,#1565C0);color:#fff;border:none;" title="Nhập thay bổ sung">'
                    + '<i class="fas fa-edit mr-1"></i> Nhập thay BS</a>';
            }
        }
        // status 5 (Cancelled) and 6 (Completed): only [Xem] (already added above)

        return '<div class="d-flex align-items-center justify-content-center" style="gap:2px;">' + html + '</div>';
    }



    // ─── DataTable ───────────────────────────────────────────────────────────
    function initDataTable() {
        table = $('#fweNotificationTable').dataTableFigma({
            processing: true,
            serverSide: true,
            ajax: {
                url: ROUTES.getAll,
                type: 'GET',
                data: function (d) {
                    var pageSize = d.length;
                    var page = Math.floor(d.start / pageSize) + 1;
                    var params = new URLSearchParams();
                    params.append('page', page);
                    params.append('pageSize', pageSize);

                    var search = $('#searchInput').val() || '';
                    if (search) params.append('search', search);

                    // Active tab status filter
                    if (currentStatus) params.append('trangThai', currentStatus);

                    // Advanced filter fields
                    var entName = $('#filterEnterpriseName').val() || '';
                    if (entName) params.append('search', entName); // merge with quick search

                    var fromDate = $('#filterFromDate').val() || '';
                    if (fromDate) params.append('fromDate', fromDate);

                    var toDate = $('#filterToDate').val() || '';
                    if (toDate) params.append('toDate', toDate);

                    // Nationality filter
                    var quocTich = $('#filterQuocTich').val() || '';
                    if (quocTich) params.append('quocTichId', quocTich);

                    var phuongAn = $('#filterPhuongAn').val() || '';
                    if (phuongAn) params.append('phuongAn', phuongAn);

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
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    render: function (data, type, row, meta) {
                        return meta.row + meta.settings._iDisplayStart + 1;
                    }
                },
                {
                    data: 'referenceNumber',
                    render: function (data, type, row) {
                        return '<a href="' + ROUTES.details + row.id + '" '
                            + 'class="font-weight-bold" style="color: var(--primary);">'
                            + escapeHtml(data || '—') + '</a>';
                    }
                },
                {
                    data: 'enterpriseName',
                    render: function (data) {
                        return '<span title="' + escapeHtml(data) + '">'
                            + escapeHtml(truncate(data, 45)) + '</span>';
                    }
                },
                {
                    data: 'workerCount',
                    className: 'text-center',
                    render: function (data) {
                        return '<span class="badge badge-secondary">' + (data || 0) + '</span>';
                    }
                },
                {
                    data: 'notificationDate',
                    render: function (data) {
                        return data ? formatDate(data) : '—';
                    }
                },
                {
                    data: 'dataEntryMethodDisplay',
                    className: 'text-center',
                    orderable: false,
                    render: function (data) {
                        return getPaBadge(data);
                    }
                },
                {
                    data: 'status',
                    orderable: false,
                    render: function (data, _type, row) {
                        return getStatusBadge(data, row.statusDisplay);
                    }
                },
                {
                    data: 'approvedByName',
                    render: function (data) {
                        return data ? escapeHtml(data) : '<span class="text-muted">—</span>';
                    }
                },
                {
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    render: renderActions
                }
            ],
            autoWidth: false,
            scrollX: false,
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

    // ─── Tab badge helper ─────────────────────────────────────────────────────
    function updateTabBadge(status, count) {
        var badgeMap = {
            '': '#tabBadgeAll',
            '2': '#tabBadgePending',
            '3': '#tabBadgeAccepted',
            '4': '#tabBadgeSupplement',
            '5': '#tabBadgeCancelled',
            '6': '#tabBadgeCompleted'
        };
        var sel = badgeMap[status];
        if (sel) $(sel).text(count);
    }

    // ─── Tab bar ─────────────────────────────────────────────────────────────
    function initTabs() {
        $('#ldnnTabBar .ldnn-tab-item').on('click', function () {
            $('#ldnnTabBar .ldnn-tab-item').removeClass('active');
            $(this).addClass('active');
            currentStatus = $(this).data('status') || '';
            if (table) table.ajax.reload(null, false);
        });
    }

    // ─── Search & Filter ─────────────────────────────────────────────────────
    function initSearch() {
        var searchTimer;
        $('#searchInput').on('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                if (table) table.ajax.reload(null, false);
            }, 400);
        });

        $('#btnSearch').on('click', function () {
            if (table) table.ajax.reload(null, false);
        });

        $('#searchInput').on('keypress', function (e) {
            if (e.which === 13 && table) table.ajax.reload(null, false);
        });
    }

    function initFilter() {
        $('#toggleFilter').on('click', function () {
            filterOpen = !filterOpen;
            if (filterOpen) {
                $('#advancedFilterArea').addClass('show');
                $(this).find('i').addClass('text-primary');
            } else {
                $('#advancedFilterArea').removeClass('show');
                $(this).find('i').removeClass('text-primary');
            }
        });

        $('#btnApplyFilter').on('click', function () {
            if (table) table.ajax.reload(null, false);
            $('#advancedFilterArea').removeClass('show');
            filterOpen = false;
            $('#toggleFilter').find('i').removeClass('text-primary');
        });

        $('#btnClearFilter,#btnRefresh').on('click', function () {
            $('#filterEnterpriseName, #filterFromDate, #filterToDate').val('');
            $('#filterPhuongAn').val('');
            $('#filterQuocTich').val('').trigger('change');
            $('#searchInput').val('');
            if (table) table.ajax.reload(null, false);
        });

        $('#btnRefresh').on('click', function () {
            if (table) table.ajax.reload(null, false);
        });
    }

    // ─── Load countries for quocTich filter ──────────────────────────────────
    function loadCountriesFilter() {
        $.ajax({
            url: '/Countries/GetAll',
            type: 'GET',
            success: function (response) {
                var $select = $('#filterQuocTich');
                var items = response || [];

                $select.empty().append($('<option>').val('').text($select.data('placeholder') || '-- Tất cả --'));
                items.forEach(function (country) {
                    var id = country.id || country.countryId || '';
                    var name = country.name || country.tenQuocGia || country.countryName || '';
                    if (id && name) {
                        $select.append($('<option>').val(id).text(name));
                    }
                });

                // Initialize Select2 after population
                $select.select2({
                    theme: 'bootstrap4',
                    width: '100%',
                    placeholder: $select.data('placeholder') || '-- Chọn quốc tịch --',
                    allowClear: true,
                    language: {
                        noResults: function () { return "Không tìm thấy kết quả"; }
                    }
                });
            },
            error: function () {
                console.error('Failed to load countries');
            }
        });
    }

    // ─── Load status counts for tab badges ───────────────────────────────────
    function loadStatusCounts() {
        $.ajax({
            url: ROUTES.getStatusCounts,
            type: 'GET',
            success: function (result) {
                if (!result || !result.success || !result.counts) return;
                var c = result.counts;
                var total = Object.values(c).reduce(function (a, b) { return a + b; }, 0);
                updateTabBadge('', total);
                updateTabBadge('2', c['PendingApproval'] || 0);
                updateTabBadge('3', c['Accepted'] || 0);
                updateTabBadge('4', c['SupplementRequested'] || 0);
                updateTabBadge('5', c['Cancelled'] || 0);
                updateTabBadge('6', c['Completed'] || 0);
            },
            error: function () {
                // Silent fail — tab badges remain at '—'
            }
        });
    }



    // ─── Inline Action: Accept ────────────────────────────────────────────────
    $(document).on('click', '.btn-accept', function () {
        var id = $(this).data('id');
        var ref = $(this).data('ref');
        if (!confirm('Xác nhận tiếp nhận hồ sơ ' + (ref || id) + '?')) return;

        $.ajax({
            url: ROUTES.accept + id,
            type: 'POST',
            headers: { 'RequestVerificationToken': getAntiForgeryToken() },
            contentType: 'application/json',
            data: JSON.stringify({}),
            success: function (result) {
                if (result.success) {
                    toastr.success('Hồ sơ đã xác nhận tiếp nhận.');
                    if (table) table.ajax.reload(null, false);
                } else {
                    toastr.error(result.message || 'Không thể xác nhận hồ sơ.');
                }
            },
            error: function () { toastr.error('Không thể kết nối đến máy chủ.'); }
        });
    });

    // ─── Inline Action: YCBS — open modal ────────────────────────────────────
    $(document).on('click', '.btn-ycbs', function () {
        var id = $(this).data('id');
        var count = parseInt($(this).data('count') || 0);
        $('#ycbsNotificationId').val(id);
        $('#ycbsNoiDung').val('');
        $('#ycbsCharCount').text('0');
        if (count >= 2) {
            $('#ycbsCurrentCount').text(count + 1);
            $('#ycbsWarning').removeClass('d-none');
        } else {
            $('#ycbsWarning').addClass('d-none');
        }
        $('#ycbsModal').modal('show');
    });

    $('#ycbsNoiDung').on('input', function () {
        $('#ycbsCharCount').text($(this).val().length);
    });

    $('#btnSubmitYcbs').on('click', function () {
        var id = $('#ycbsNotificationId').val();
        var noiDung = $('#ycbsNoiDung').val().trim();
        if (noiDung.length < 20) {
            toastr.warning('Nội dung yêu cầu bổ sung tối thiểu 20 ký tự.');
            $('#ycbsNoiDung').focus();
            return;
        }
        if (noiDung.length > 1000) {
            toastr.warning('Nội dung không được vượt quá 1000 ký tự.');
            return;
        }

        var $btn = $(this);
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang gửi...');

        $.ajax({
            url: ROUTES.supplementRequest + id,
            type: 'POST',
            headers: { 'RequestVerificationToken': getAntiForgeryToken() },
            contentType: 'application/json',
            data: JSON.stringify({ content: noiDung }),
            success: function (result) {
                $btn.prop('disabled', false).html('<i class="fas fa-paper-plane mr-1"></i> Gửi yêu cầu bổ sung');
                if (result.success) {
                    toastr.success('Yêu cầu bổ sung đã gửi đến doanh nghiệp.');
                    $('#ycbsModal').modal('hide');
                    if (table) table.ajax.reload(null, false);
                } else {
                    toastr.error(result.message || 'Không thể gửi yêu cầu bổ sung.');
                }
            },
            error: function () {
                $btn.prop('disabled', false).html('<i class="fas fa-paper-plane mr-1"></i> Gửi yêu cầu bổ sung');
                toastr.error('Không thể kết nối đến máy chủ.');
            }
        });
    });

    // ─── Inline Action: Cancel — open modal ──────────────────────────────────
    $(document).on('click', '.btn-cancel', function () {
        var id = $(this).data('id');
        var ref = $(this).data('ref');
        $('#cancelNotificationId').val(id);
        $('#cancelRefNumber').text(ref || id);
        $('#cancelLyDo').val('');
        $('#cancelCharCount').text('0');
        $('#cancelModal').modal('show');
    });

    $('#cancelLyDo').on('input', function () {
        $('#cancelCharCount').text($(this).val().length);
    });

    $('#btnSubmitCancel').on('click', function () {
        var id = $('#cancelNotificationId').val();
        var lyDo = $('#cancelLyDo').val().trim();
        if (lyDo.length < 20) {
            toastr.warning('Lý do huỷ tối thiểu 20 ký tự.');
            $('#cancelLyDo').focus();
            return;
        }
        if (lyDo.length > 1000) {
            toastr.warning('Lý do không được vượt quá 1000 ký tự.');
            return;
        }

        var $btn = $(this);
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');

        $.ajax({
            url: ROUTES.cancel + id,
            type: 'POST',
            headers: { 'RequestVerificationToken': getAntiForgeryToken() },
            contentType: 'application/json',
            data: JSON.stringify({ cancellationReason: lyDo }),
            success: function (result) {
                $btn.prop('disabled', false).html('<i class="fas fa-ban mr-1"></i> Xác nhận huỷ');
                if (result.success) {
                    toastr.success('Hồ sơ đã được huỷ.');
                    $('#cancelModal').modal('hide');
                    if (table) table.ajax.reload(null, false);
                } else {
                    toastr.error(result.message || 'Không thể huỷ hồ sơ.');
                }
            },
            error: function () {
                $btn.prop('disabled', false).html('<i class="fas fa-ban mr-1"></i> Xác nhận huỷ');
                toastr.error('Không thể kết nối đến máy chủ.');
            }
        });
    });

    // ─── Inline Action: Xuất BM (row button → open modal) ────────────────────
    $(document).on('click', '.btn-export-bm-row', function () {
        var id = $(this).data('id');
        $('#exportBmNotificationId').val(id);
        $('#exportBmModal').modal('show');
    });

    $('.btn-export-bm').on('click', function () {
        var id = $('#exportBmNotificationId').val();
        var loai = $(this).data('loai');

        var $btn = $(this);
        $btn.prop('disabled', true);

        $.ajax({
            url: ROUTES.exportForm + id,
            type: 'POST',
            headers: { 'RequestVerificationToken': getAntiForgeryToken() },
            contentType: 'application/json',
            data: JSON.stringify({ templateType: loai }),
            xhrFields: { responseType: 'blob' },
            success: function (blob, status, xhr) {
                $btn.prop('disabled', false);
                var filename = 'BM_' + id + '.docx';
                var cd = xhr.getResponseHeader('Content-Disposition');
                if (cd) {
                    var m = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                    if (m && m[1]) filename = m[1].replace(/['"]/g, '');
                }
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                $('#exportBmModal').modal('hide');
            },
            error: function (xhr) {
                $btn.prop('disabled', false);
                if (xhr.status === 400) {
                    toastr.error('Template chưa cấu hình. Vui lòng liên hệ quản trị viên.');
                } else {
                    toastr.error('Không thể xuất biểu mẫu. Vui lòng thử lại.');
                }
            }
        });
    });

    // ─── Toolbar: Xuất Excel ──────────────────────────────────────────────────
    $('#btnExportExcel').on('click', function () {
        var params = new URLSearchParams();
        var search = $('#searchInput').val() || '';
        if (search) params.append('search', search);
        if (currentStatus) params.append('trangThai', currentStatus);
        var fromDate = $('#filterFromDate').val() || '';
        if (fromDate) params.append('fromDate', fromDate);
        var toDate = $('#filterToDate').val() || '';
        if (toDate) params.append('toDate', toDate);
        var quocTich = $('#filterQuocTich').val() || '';
        if (quocTich) params.append('quocTichId', quocTich);
        var phuongAn = $('#filterPhuongAn').val() || '';
        if (phuongAn) params.append('phuongAn', phuongAn);

        window.location.href = ROUTES.exportExcel + '?' + params.toString();
    });

    // ─── Init ─────────────────────────────────────────────────────────────────
    $(document).ready(function () {
        initDataTable();
        initTabs();
        initSearch();
        initFilter();
        loadCountriesFilter();
        loadStatusCounts();

        // Show TempData flash messages
        var $body = $('body');
        var successMsg = $body.data('success');
        var errorMsg = $body.data('error');
        if (successMsg) toastr.success(successMsg);
        if (errorMsg) toastr.error(errorMsg);
    });

})();
