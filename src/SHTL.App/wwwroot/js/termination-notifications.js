/**
 * Termination Notifications Management — SCR-NV-LIST-001
 * Module: M0085 — Danh sách thông báo chấm dứt HĐLĐ
 * Pattern: IIFE, DataTables server-side, URLSearchParams
 * Status values: Draft | Pending | Supplemented | Confirmed | Cancelled
 * InputMethod: PA_A | PA_B
 */
(function () {
    'use strict';

    let table;

    // ── Status badges — theo §3.4 UI_SCR-NV-LIST-001 ──────────────────────
    const STATUS_BADGES = {
        'Draft':       '<span class="b-draft">Nháp</span>',
        'Pending':     '<span class="b-pending">Chờ XN</span>',
        'Supplemented':'<span class="b-req">YC bổ sung</span>',
        'Confirmed':   '<span class="b-ok">Đã XN</span>',
        'Cancelled':   '<span class="b-reject">Hủy</span>'
    };

    // ── PA badges — theo §3.5 ──────────────────────────────────────────────
    const PA_BADGES = {
        'PA_A': '<span class="b-pa">PA-A</span>',
        'PA_B': '<span class="b-pb">PA-B</span>'
    };

    // ── Utilities ─────────────────────────────────────────────────────────
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function formatDate(val) {
        if (!val) return '—';
        try {
            var d = new Date(val);
            if (isNaN(d.getTime())) return val;
            return ('0' + d.getDate()).slice(-2) + '/' +
                   ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
        } catch (e) { return val; }
    }

    function getAntiForgeryToken() {
        var el = document.querySelector('input[name="__RequestVerificationToken"]');
        return el ? el.value : '';
    }

    function loadCountryOptions() {
        var $select = $('#filterNationality');
        if (!$select.length) return;

        $.ajax({
            url: '/Countries/GetAll',
            type: 'GET',
            success: function (response) {
                var items = Array.isArray(response) ? response : [];
                $select.empty().append($('<option>').val('').text('Tất cả'));

                items.forEach(function (country) {
                    var name = country.name || country.Name || '';
                    if (name) {
                        $select.append($('<option>').val(name).text(name));
                    }
                });
            },
            error: function () {
                $select.empty().append($('<option>').val('').text('Tất cả'));
            }
        });
    }

    // ── DataTable ─────────────────────────────────────────────────────────
    function initDataTable() {
        table = $('#terminationTable').DataTable({
            processing: true,
            serverSide: true,
            ajax: {
                url: '/TerminationNotifications/GetAll',
                type: 'GET',
                data: function (d) {
                    var params = new URLSearchParams();
                    var pageSize = d.length;
                    var page = Math.floor(d.start / pageSize) + 1;
                    params.append('draw', d.draw);
                    params.append('page', page);
                    params.append('pageSize', pageSize);
                    var search = document.getElementById('filterSearch').value;
                    if (search) params.append('search', search);
                    var status = document.getElementById('filterStatus').value;
                    if (status) params.append('status', status);
                    var nat = document.getElementById('filterNationality').value;
                    if (nat) params.append('nationality', nat);
                    var method = document.getElementById('filterInputMethod').value;
                    if (method) params.append('inputMethod', method);
                    var from = document.getElementById('filterFromDate').value;
                    if (from) params.append('fromDate', from);
                    var to = document.getElementById('filterToDate').value;
                    if (to) params.append('toDate', to);
                    return params.toString();
                }
            },
            columns: [
                {
                    data: null,
                    className: 'text-center',
                    orderable: false,
                    render: function (data, type, row, meta) {
                        return meta.row + meta.settings._iDisplayStart + 1;
                    }
                },
                {
                    data: 'code',
                    render: function (data, type, row) {
                        return '<a href="/TerminationNotifications/Details/' + row.id +
                               '" class="text-primary font-weight-bold">' + escapeHtml(data) + '</a>';
                    }
                },
                {
                    data: 'enterpriseName',
                    render: function (data) {
                        return escapeHtml(data) || '<span class="text-muted">—</span>';
                    }
                },
                {
                    data: 'workerFullName',
                    render: function (data, type, row) {
                        var html = '<div class="font-weight-bold">' + escapeHtml(data || '—') + '</div>';
                        if (row.workerPassportNumber) {
                            html += '<div class="text-muted" style="font-size:11px;">' + escapeHtml(row.workerPassportNumber) + '</div>';
                        }
                        return html;
                    }
                },
                {
                    data: 'nationality',
                    className: 'text-center',
                    render: function (data) { return escapeHtml(data) || '—'; }
                },
                {
                    data: 'terminationDate',
                    className: 'text-center',
                    render: formatDate
                },
                {
                    data: 'submittedAt',
                    className: 'text-center',
                    render: formatDate
                },
                {
                    data: 'status',
                    className: 'text-center',
                    render: function (data) {
                        return STATUS_BADGES[data] || '<span class="b-draft">' + escapeHtml(data) + '</span>';
                    }
                },
                {
                    data: 'inputMethod',
                    className: 'text-center',
                    render: function (data) {
                        return PA_BADGES[data] || '<span class="b-draft">' + escapeHtml(data) + '</span>';
                    }
                },
                {
                    data: null,
                    className: 'text-center',
                    orderable: false,
                    render: function (data, type, row) {
                        return '<a href="/TerminationNotifications/Details/' + row.id +
                               '" class="btn btn-sm btn-outline-primary" title="Xem chi tiết"><i class="fas fa-eye"></i></a>';
                    }
                }
            ],
            order: [[6, 'desc']],
            dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
            pageLength: 20,
            lengthMenu: [[20, 50, 100], [20, 50, 100]],
            language: {
                processing: '<div class="d-flex justify-content-center py-3"><div class="spinner-border text-primary" role="status"></div></div>',
                emptyTable: '<div class="py-5 text-muted text-center"><i class="fas fa-file-contract fa-3x mb-3 d-block"></i>Không tìm thấy hồ sơ phù hợp với tiêu chí lọc.</div>'
            },
            drawCallback: function (settings) {
                var $container = $('.pagination-figma-container');
                if ($container.length && $('#paginationFrame').length) {
                    $container.appendTo('#paginationFrame');
                }
                var totalRecords = settings._iRecordsDisplay || 0;
                if (totalRecords === 0) $('#paginationFrame').hide();
                else $('#paginationFrame').show();
            }
        });
    }

    // ── Search & Filters ──────────────────────────────────────────────────
    function initFilters() {
        var searchTimer;

        $('#filterSearch').on('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () { table.ajax.reload(); }, 400);
        });

        $('#btnSearch').on('click', function () { table.ajax.reload(); });
        $('#btnRefresh').on('click', function () { table.ajax.reload(null, false); });

        $('#filterStatus, #filterNationality, #filterInputMethod').on('change', function () {
            table.ajax.reload();
        });

        $('#filterFromDate, #filterToDate').on('change', function () {
            table.ajax.reload();
        });

        $('#btnReset').on('click', function () {
            document.getElementById('filterSearch').value = '';
            document.getElementById('filterStatus').value = '';
            document.getElementById('filterNationality').value = '';
            document.getElementById('filterInputMethod').value = '';
            document.getElementById('filterFromDate').value = '';
            document.getElementById('filterToDate').value = '';
            table.ajax.reload();
        });

        $('#btnExport').on('click', function () {
            var params = new URLSearchParams();
            var search = document.getElementById('filterSearch').value;
            if (search) params.append('search', search);
            var status = document.getElementById('filterStatus').value;
            if (status) params.append('status', status);
            var nat = document.getElementById('filterNationality').value;
            if (nat) params.append('nationality', nat);
            var method = document.getElementById('filterInputMethod').value;
            if (method) params.append('inputMethod', method);
            var from = document.getElementById('filterFromDate').value;
            if (from) params.append('fromDate', from);
            var to = document.getElementById('filterToDate').value;
            if (to) params.append('toDate', to);
            window.location.href = '/TerminationNotifications/Export?' + params.toString();
        });
    }

    // ── Init ─────────────────────────────────────────────────────────────
    $(document).ready(function () {
        loadCountryOptions();
        initDataTable();
        initFilters();
    });

})();
