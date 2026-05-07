/**
 * foreign-worker-exemption-query.js
 * Module: M0122 — SCR-NV-TC-001: Tra cứu Lao động Nước ngoài Không thuộc Diện cấp phép
 *
 * ARCHITECTURE: JavaScript → MVC Controller (/Foreign-Worker-Exemption/*)
 *               → IForeignWorkerExemptionApiService → Labor.Api Backend
 * NEVER call /api/v1/... directly from JS.
 */
(function () {
    'use strict';

    // ─── State ───────────────────────────────────────────────────────────────
    var table;
    var filterOpen = false;

    // ─── MVC Action routes (NEVER /api/v1/...) ───────────────────────────────
    var ROUTES = {
        getAll: '/Foreign-Worker-Exemption/getall',
        markCompleted: '/Foreign-Worker-Exemption/mark-completed/',
        update: '/Foreign-Worker-Exemption/update/',
        exportExcel: '/Foreign-Worker-Exemption/export-excel',
        notificationDetails: '/Foreign-Worker-Exemption-Notification/details/',
        getCountries: '/Countries/GetAll'
    };

    // ─── Helpers ─────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

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

    function getAntiForgeryToken() {
        return $('input[name="__RequestVerificationToken"]').first().val() || '';
    }

    // ─── Warning badge (BR-07: 3 mức cảnh báo hết hạn) ─────────────────────
    function renderExpiryBadge(daysRemaining) {
        if (!daysRemaining) {
            return '<span class="badge badge-normal">—</span>';
        }
        if (daysRemaining <= 15) {
            return '<span class="badge badge-warn-red" title="≤ 15 ngày còn lại">≤ 15 ngày</span>';
        }
        if (daysRemaining <= 30) {
            return '<span class="badge badge-warn-orange" title="≤ 30 ngày còn lại">≤ 30 ngày</span>';
        }
        if (daysRemaining <= 45) {
            return '<span class="badge badge-warn-yellow" title="≤ 45 ngày còn lại">≤ 45 ngày</span>';
        }
        return '<span class="badge badge-success">Bình thường</span>';
    }

    // ─── Status badge ────────────────────────────────────────────────────────
    function renderStatusBadge(status, statusDisplay) {
        if (status === 'Active') {
            return '<span class="badge badge-active">' + escapeHtml(statusDisplay || 'Đang HĐ') + '</span>';
        }
        if (status === 'Completed') {
            return '<span class="badge badge-completed">' + escapeHtml(statusDisplay || 'Đã KT') + '</span>';
        }
        return '<span class="badge">' + escapeHtml(statusDisplay || status) + '</span>';
    }

    // ─── Row action buttons (BR-07 + BR-08) ─────────────────────────────────
    function renderActions(data, type, row) {
        var id = escapeHtml(row.id);
        var name = escapeHtml(row.fullName || '');
        var status = row.status;
        var daysRemaining = row.daysRemaining;
        var html = '';

        // [Xem] — always visible (navigates to parent notification details)
        var notifId = escapeHtml(row.notificationId || row.id);
        html += '<a href="' + ROUTES.notificationDetails + notifId + '" '
            + 'class="btn btn-sm btn-figma btn-figma-outline mr-1" title="Xem chi tiết hồ sơ">'
            + '<i class="fas fa-eye"></i></a>';

        if (status === 'Active') {
            // BR-07: Chỉ hiển thị [Sửa] và [Kết thúc] khi sắp hết hạn hoặc có quyền Update
            if (window.userPermissions.canUpdate) {
                html += '<button class="btn btn-sm btn-figma btn-figma-outline mr-1 btn-edit-worker" '
                    + 'data-id="' + id + '" '
                    + 'data-name="' + escapeHtml(row.fullName || '') + '" '
                    + 'data-nationality-id="' + (row.nationalityId || '') + '" '
                    + 'data-nationality-name="' + escapeHtml(row.nationalityName || '') + '" '
                    + 'data-passport="' + escapeHtml(row.passportNumber || '') + '" '
                    + 'data-dob="' + (row.dateOfBirth ? row.dateOfBirth.substring(0, 10) : '') + '" '
                    + 'data-gender="' + escapeHtml(row.gender || '') + '" '
                    + 'data-job="' + escapeHtml(row.jobPosition || '') + '" '
                    + 'data-contract-start="' + (row.contractStartDate ? row.contractStartDate.substring(0, 10) : '') + '" '
                    + 'data-contract-end="' + (row.contractEndDate ? row.contractEndDate.substring(0, 10) : '') + '" '
                    + 'data-visa-number="' + escapeHtml(row.visaNumber || '') + '" '
                    + 'data-visa-expiry="' + (row.visaExpiryDate ? row.visaExpiryDate.substring(0, 10) : '') + '" '
                    + 'title="Sửa thông tin">'
                    + '<i class="fas fa-edit"></i></button>';

                // [Kết thúc] — hiện khi sắp hết hạn (≤ 45 ngày) hoặc luôn hiện cho canUpdate
                if (daysRemaining !== null && daysRemaining !== undefined && daysRemaining <= 45) {
                    html += '<button class="btn btn-sm btn-figma mr-1 btn-complete-worker" '
                        + 'data-id="' + id + '" '
                        + 'data-name="' + name + '" '
                        + 'style="background:#dc2626;color:#fff;border:none;" title="Đánh dấu kết thúc">'
                        + '<i class="fas fa-flag-checkered"></i> Kết thúc</button>';
                }
            }
        }
        // BR-08: Completed → chỉ [Xem], không [Sửa] / [Kết thúc]

        return '<div class="d-flex align-items-center justify-content-center" style="gap:2px;">' + html + '</div>';
    }

    // ─── DataTable ───────────────────────────────────────────────────────────
    function initDataTable() {
        table = $('#fweQueryTable').dataTableFigma({
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

                    var fullName = $('#filterFullName').val() || '';
                    if (fullName) params.append('searchName', fullName);

                    var passport = $('#filterPassport').val() || '';
                    if (passport) params.append('searchPassport', passport);

                    var enterprise = $('#filterEnterprise').val() || '';
                    if (enterprise) params.append('searchEnterprise', enterprise);

                    var nationality = $('#filterNationality').val() || '';
                    if (nationality) params.append('nationalityId', nationality);

                    var status = $('#filterStatus').val() || '';
                    if (status) params.append('status', status);

                    var expiry = $('#filterExpiry').val() || '';
                    if (expiry) params.append('expiryWithinDays', expiry);

                    var fromDate = $('#filterFromDate').val() || '';
                    if (fromDate) params.append('fromDate', fromDate);

                    var toDate = $('#filterToDate').val() || '';
                    if (toDate) params.append('toDate', toDate);

                    return params.toString();
                },
                dataSrc: function (json) {
                    if (!json.success) {
                        toastr.error(json.error || json.message || 'Không thể tải dữ liệu');
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
                    data: 'fullName',
                    render: function (data) {
                        return '<span class="font-weight-bold">' + escapeHtml(data || '—') + '</span>';
                    }
                },
                {
                    data: 'nationalityName',
                    render: function (data) {
                        return escapeHtml(data || '—');
                    }
                },
                {
                    data: 'passportNumber',
                    render: function (data) {
                        return '<code>' + escapeHtml(data || '—') + '</code>';
                    }
                },
                {
                    data: 'enterpriseName',
                    render: function (data) {
                        return '<span title="' + escapeHtml(data) + '">'
                            + escapeHtml(truncate(data, 40)) + '</span>';
                    }
                },
                {
                    data: 'jobPosition',
                    render: function (data) {
                        return escapeHtml(truncate(data, 35) || '—');
                    }
                },
                {
                    data: 'contractStartDate',
                    render: function (data) { return formatDate(data); }
                },
                {
                    data: 'contractEndDate',
                    render: function (data) { return data ? formatDate(data) : '<span class="text-muted">—</span>'; }
                },
                {
                    data: 'daysRemaining',
                    className: 'text-center',
                    orderable: false,
                    render: function (data) { return renderExpiryBadge(data); }
                },
                {
                    data: 'status',
                    className: 'text-center',
                    orderable: false,
                    render: function (data, type, row) {
                        return renderStatusBadge(data, row.statusDisplay);
                    }
                },
                {
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    render: renderActions
                }
            ],
            createdRow: function (row, data) {
                // BR-08: Styling for completed rows
                if (data.status === 'Completed') {
                    $(row).addClass('completed-row');
                }
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

    // ─── Filter & Search ─────────────────────────────────────────────────────
    function initFilters() {
        // Toggle advanced filter
        $('#toggleFilter').on('click', function () {
            filterOpen = !filterOpen;
            $(this).toggleClass('active', filterOpen);
            $('#advancedFilterArea').toggleClass('show', filterOpen);
        });

        // Initialize Select2 for standard filters
        $('#filterStatus, #filterExpiry').select2({
            theme: 'bootstrap4',
            width: '100%',
            minimumResultsForSearch: Infinity, // Hide search for small fixed lists
            placeholder: $(this).data('placeholder')
        });

        // Debounce quick search (400ms)
        var searchTimer;
        $('#filterFullName').on('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                if (table) table.ajax.reload();
            }, 400);
        });

        $('#btnSearch').on('click', function () {
            if (table) table.ajax.reload();
        });

        $('#btnRefresh').on('click', function () {
            if (table) table.ajax.reload();
        });

        // Apply advanced filter — reload and close
        $('#btnApplyFilter').on('click', function () {
            if (table) table.ajax.reload();
            filterOpen = false;
            $('#advancedFilterArea').removeClass('show');
            $('#toggleFilter').removeClass('active');
        });

        // Clear all filters
        $('#btnClearFilter, #btnRefresh').on('click', function () {
            $('#filterFullName').val('');
            $('#filterPassport').val('');
            $('#filterEnterprise').val('');
            $('#filterNationality').val('').trigger('change');
            $('#filterStatus').val('');
            $('#filterExpiry').val('');
            $('#filterFromDate').val('');
            $('#filterToDate').val('');
            filterOpen = false;
            $('#advancedFilterArea').removeClass('show');
            $('#toggleFilter').removeClass('active');
            if (table) table.ajax.reload();
        });
    }

    // ─── Quốc tịch Select2 ──────────────────────────────────────────────────
    function loadNationalities() {
        $.get(ROUTES.getCountries)
            .done(function (data) {
                var items = Array.isArray(data) ? data : (data.data || []);
                var $sel = $('#filterNationality');
                $sel.empty().append('<option value="">-- Tất cả --</option>');
                items.forEach(function (item) {
                    $sel.append('<option value="' + item.id + '">' + escapeHtml(item.name) + '</option>');
                });
                // Initialize Select2 after population
                $sel.select2({
                    theme: 'bootstrap4',
                    width: '100%',
                    placeholder: $sel.data('placeholder') || '-- Chọn quốc tịch --',
                    allowClear: true,
                    language: {
                        noResults: function () { return "Không tìm thấy kết quả"; }
                    }
                });
            })
            .fail(function () {
                // Silently fail — nationality filter optional
                console.warn('[M0122] Failed to load nationalities for filter');
            });
    }

    // ─── Modal: Kết thúc ─────────────────────────────────────────────────────
    function initCompleteModal() {
        // Open modal from row button
        $(document).on('click', '.btn-complete-worker', function () {
            var id = $(this).data('id');
            var name = $(this).data('name');
            $('#completeWorkerId').val(id);
            $('#completeWorkerName').text(name);
            $('#completeActualDate').val(new Date().toISOString().substring(0, 10));
            $('#completeModal').modal('show');
        });

        // Submit kết thúc
        $('#btnSubmitComplete').on('click', function () {
            var id = $('#completeWorkerId').val();
            var actualDate = $('#completeActualDate').val();
            if (!actualDate) {
                toastr.warning('Vui lòng nhập ngày kết thúc thực tế');
                return;
            }

            var $btn = $(this);
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');

            $.ajax({
                url: ROUTES.markCompleted + id,
                type: 'POST',
                contentType: 'application/json',
                headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                data: JSON.stringify({ actualEndDate: actualDate }),
                success: function (result) {
                    if (result.success) {
                        toastr.success(result.message || 'Đã đánh dấu kết thúc thành công');
                        $('#completeModal').modal('hide');
                        if (table) table.ajax.reload(null, false);
                    } else {
                        toastr.error(result.message || 'Không thể thực hiện thao tác này');
                    }
                },
                error: function () {
                    toastr.error('Lỗi kết nối. Vui lòng thử lại.');
                },
                complete: function () {
                    $btn.prop('disabled', false).html('<i class="fas fa-check mr-1"></i> Xác nhận kết thúc');
                }
            });
        });
    }

    // ─── Modal: Sửa thông tin LĐNN ──────────────────────────────────────────
    function initEditModal() {
        // Open modal from row button — pre-fill data
        $(document).on('click', '.btn-edit-worker', function () {
            var $btn = $(this);
            // Store all required fields in hidden inputs
            $('#editWorkerId').val($btn.data('id'));
            $('#editFullName').val($btn.data('name') || '');
            $('#editNationalityId').val($btn.data('nationality-id') || '');
            $('#editNationalityName').val($btn.data('nationality-name') || '');
            $('#editPassportNumber').val($btn.data('passport') || '');
            $('#editDateOfBirth').val($btn.data('dob') || '');
            $('#editGender').val($btn.data('gender') || '');
            $('#editJobPosition').val($btn.data('job') || '');
            $('#editContractStartDate').val($btn.data('contract-start') || '');
            $('#editContractEndDate').val($btn.data('contract-end') || '');
            $('#editVisaNumber').val($btn.data('visa-number') || '');
            $('#editVisaExpiryDate').val($btn.data('visa-expiry') || '');
            $('#editWorkerModal').modal('show');
        });

        // Submit cập nhật
        $('#btnSubmitEdit').on('click', function () {
            var id = $('#editWorkerId').val();
            var jobPosition = $('#editJobPosition').val().trim();
            if (!jobPosition) {
                toastr.warning('Vui lòng nhập vị trí công việc');
                return;
            }

            // Only collect the 4 editable fields from M0122 query screen
            var payload = {
                jobPosition: jobPosition,
                contractEndDate: $('#editContractEndDate').val() || null,
                visaNumber: $('#editVisaNumber').val().trim() || null,
                visaExpiryDate: $('#editVisaExpiryDate').val() || null
            };

            var $btn = $(this);
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

            $.ajax({
                url: ROUTES.update + id,
                type: 'POST',
                contentType: 'application/json',
                headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                data: JSON.stringify(payload),
                success: function (result) {
                    if (result.success) {
                        toastr.success(result.message || 'Cập nhật thành công');
                        $('#editWorkerModal').modal('hide');
                        if (table) table.ajax.reload(null, false);
                    } else {
                        toastr.error(result.message || 'Không thể cập nhật thông tin');
                    }
                },
                error: function (xhr) {
                    console.error('Error response:', xhr);
                    if (xhr.status === 400) {
                        toastr.error('Dữ liệu không hợp lệ. Vui lòng kiểm tra lại các trường bắt buộc.');
                    } else {
                        toastr.error('Lỗi kết nối. Vui lòng thử lại.');
                    }
                },
                complete: function () {
                    $btn.prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu thay đổi');
                }
            });
        });
    }

    // ─── Export Excel ────────────────────────────────────────────────────────
    function initExportExcel() {
        $('#btnExportExcel').on('click', function () {
            var params = new URLSearchParams();
            var fullName = $('#filterFullName').val() || '';
            if (fullName) params.append('searchName', fullName);
            var passport = $('#filterPassport').val() || '';
            if (passport) params.append('searchPassport', passport);
            var enterprise = $('#filterEnterprise').val() || '';
            if (enterprise) params.append('searchEnterprise', enterprise);
            var nationality = $('#filterNationality').val() || '';
            if (nationality) params.append('nationalityId', nationality);
            var status = $('#filterStatus').val() || '';
            if (status) params.append('status', status);
            var expiry = $('#filterExpiry').val() || '';
            if (expiry) params.append('expiryWithinDays', expiry);
            var fromDate = $('#filterFromDate').val() || '';
            if (fromDate) params.append('fromDate', fromDate);
            var toDate = $('#filterToDate').val() || '';
            if (toDate) params.append('toDate', toDate);

            var qs = params.toString();
            window.location.href = ROUTES.exportExcel + (qs ? '?' + qs : '');
        });
    }

    // ─── Initialize ─────────────────────────────────────────────────────────
    $(document).ready(function () {
        // Hide export button if no permission
        if (!window.userPermissions || !window.userPermissions.canExport) {
            $('#btnExportExcel').hide();
        }

        loadNationalities();
        initDataTable();
        initFilters();
        initCompleteModal();
        initEditModal();
        initExportExcel();
    });

})();
