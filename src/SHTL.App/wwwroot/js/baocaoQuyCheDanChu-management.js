/**
 * BaoCaoQuyCheDanChu Management — Client JS (IIFE Pattern)
 * Module: M0093 — Báo cáo Quy chế Dân chủ cơ sở
 * Screen: SCR-NV-REV-001 — Danh sách Báo cáo QCDC & ĐTĐK chờ xử lý
 *
 * ARCHITECTURE: JavaScript → MVC Controller → ApiService → Backend API
 */
(function () {
    'use strict';

    // ─── State ──────────────────────────────────────────────────
    let table;

    // ─── MVC Action Endpoints (NOT /api/v1/...) ─────────────────
    const API = {
        getAll:  '/BaoCaoQuyCheDanChu/GetAll',
        delete:  '/BaoCaoQuyCheDanChu/Delete',
        details: '/BaoCaoQuyCheDanChu/Details'
    };

    // ─── Status badge config ────────────────────────────────────
    const STATUS_BADGES = {
        1: '<span class="badge-status badge-nhap">Nháp</span>',
        2: '<span class="badge-status badge-choxn">Chờ xác nhận</span>',
        3: '<span class="badge-status badge-daxn">Đã xác nhận</span>',
        4: '<span class="badge-status badge-ycbs">Yêu cầu bổ sung</span>',
        5: '<span class="badge-status badge-tuchoi">Từ chối</span>'
    };

    // ─── Utility ────────────────────────────────────────────────
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text)));
        return div.innerHTML;
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '<span style="color:#94a3b8;">—</span>';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        var dd   = String(d.getDate()).padStart(2, '0');
        var mm   = String(d.getMonth() + 1).padStart(2, '0');
        var yyyy = d.getFullYear();
        var hh   = String(d.getHours()).padStart(2, '0');
        var min  = String(d.getMinutes()).padStart(2, '0');
        return dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + min;
    }

    function getLoaiBCBadge(loaiDisplay) {
        if (!loaiDisplay) return '';
        var text = escapeHtml(loaiDisplay);
        var lower = loaiDisplay.toLowerCase();
        if (lower.indexOf('qcdc') !== -1 && lower.indexOf('năm') !== -1) {
            return '<span class="badge-status badge-qcdcnam">' + text + '</span>';
        }
        if (lower.indexOf('qcdc') !== -1) {
            return '<span class="badge-status badge-qcdc6t">' + text + '</span>';
        }
        if (lower.indexOf('đtđk') !== -1 || lower.indexOf('đối thoại') !== -1) {
            return '<span class="badge-status badge-dtdk">' + text + '</span>';
        }
        if (lower.indexOf('đột xuất') !== -1) {
            return '<span class="badge-status badge-dotxuat">' + text + '</span>';
        }
        return '<span class="badge-status badge-nhap">' + text + '</span>';
    }

    // ─── DataTable ──────────────────────────────────────────────
    function initDataTable() {
        table = $('#dataTable').DataTable({
            processing: true,
            serverSide: true,
            ajax: {
                url: API.getAll,
                type: 'GET',
                data: function (d) {
                    var params = new URLSearchParams();
                    var pageSize = d.length;
                    var page = Math.floor(d.start / pageSize) + 1;
                    params.append('page', page);
                    params.append('pageSize', pageSize);

                    var search = document.getElementById('searchInput').value;
                    if (search) params.append('search', search);

                    var loaiBC = document.getElementById('filterLoaiBC').value;
                    if (loaiBC) params.append('loaiBC', loaiBC);

                    var trangThai = document.getElementById('filterTrangThai').value;
                    if (trangThai) params.append('trangThai', trangThai);

                    var isOverdue = document.getElementById('filterIsOverdue').value;
                    if (isOverdue !== '') params.append('isOverdue', isOverdue);

                    return params.toString();
                },
                dataSrc: function (json) {
                    if (!json.success) {
                        toastr.error(json.message || 'Không thể tải dữ liệu báo cáo');
                        return [];
                    }
                    return json.data || [];
                }
            },
            columns: [
                {
                    data: 'maBC',
                    render: function (data, type, row) {
                        var url = API.details + '/' + escapeHtml(row.id);
                        return '<a href="' + url + '" class="font-weight-600" style="color: var(--primary); font-size: 12.5px;">' + escapeHtml(data) + '</a>';
                    }
                },
                {
                    data: 'enterpriseName',
                    render: function (data) {
                        return '<span style="font-size: 13px;">' + escapeHtml(data) + '</span>';
                    }
                },
                {
                    data: 'loaiDisplay',
                    render: function (data) { return getLoaiBCBadge(data); }
                },
                {
                    data: 'kyBaoCaoName',
                    render: function (data) {
                        return '<span style="font-size: 12.5px; color: #475569;">' + escapeHtml(data) + '</span>';
                    }
                },
                {
                    data: 'ngayNop',
                    render: function (data) {
                        return '<span style="font-size: 12.5px;">' + formatDateTime(data) + '</span>';
                    }
                },
                {
                    data: 'trangThai',
                    className: 'text-center',
                    render: function (data) {
                        return STATUS_BADGES[data] || '<span class="badge-status badge-nhap">' + escapeHtml(data) + '</span>';
                    }
                },
                {
                    data: 'nopDungHan',
                    className: 'text-center',
                    render: function (data) {
                        if (data === true) {
                            return '<i class="fas fa-check-circle" style="color: #16a34a; font-size: 15px;" title="Đúng hạn"></i>';
                        }
                        return '<i class="fas fa-times-circle" style="color: #dc2626; font-size: 15px;" title="Quá hạn"></i>';
                    }
                },
                {
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    render: function (data, type, row) {
                        var buttons = '<a href="' + API.details + '/' + escapeHtml(row.id) + '" class="btn-figma btn-figma-outline" style="height: 28px; padding: 0 10px; font-size: 12px;" title="Xem chi tiết">'
                            + '<i class="fas fa-eye"></i></a>';
                        if (window.userPermissions && window.userPermissions.canDelete && row.trangThai === 1) {
                            buttons += ' <button type="button" onclick="qcdcMgmt.deleteItem(\'' + escapeHtml(row.id) + '\', \'' + escapeHtml(row.maBC) + '\')" '
                                + 'class="btn-figma" style="height: 28px; padding: 0 10px; font-size: 12px; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;" title="Xóa">'
                                + '<i class="fas fa-trash"></i></button>';
                        }
                        return buttons;
                    }
                }
            ],
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/vi.json',
                processing: '<i class="fas fa-spinner fa-spin fa-2x"></i><br>Đang tải...'
            },
            dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
            order: [[4, 'desc']],
            pageLength: 20,
            lengthMenu: [[20, 50, 100], [20, 50, 100]],
            createdRow: function (row, data) {
                if (data.nopDungHan === false && data.trangThai !== 3) {
                    $(row).addClass('row-overdue');
                }
            }
        });
    }

    // ─── Filters ────────────────────────────────────────────────
    function initFilters() {
        $('#toggleFilter').on('click', function () {
            $(this).toggleClass('active');
            $('#advancedFilterArea').toggleClass('show');
        });

        var searchTimer;
        $('#searchInput').on('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () { table.ajax.reload(); }, 400);
        });

        $('#btnSearch').on('click', function () { table.ajax.reload(); });

        $('#btnRefreshTable').on('click', function () { table.ajax.reload(null, false); });

        $('#btnApplyFilter').on('click', function () {
            table.ajax.reload();
            $('#advancedFilterArea').removeClass('show');
            $('#toggleFilter').removeClass('active');
        });

        $('#btnResetFilter').on('click', function () {
            document.getElementById('searchInput').value = '';
            document.getElementById('filterLoaiBC').value = '';
            document.getElementById('filterTrangThai').value = '';
            document.getElementById('filterIsOverdue').value = '';
            table.ajax.reload();
        });

        $('#btnExportExcel').on('click', function () {
            toastr.info('Tính năng xuất Excel đang được phát triển.');
        });
    }

    // ─── Delete ─────────────────────────────────────────────────
    function deleteItem(id, maBC) {
        if (!confirm('Bạn có chắc muốn xóa báo cáo "' + maBC + '"?\nHành động này không thể hoàn tác.')) return;
        var token = document.querySelector('input[name="__RequestVerificationToken"]');
        fetch('/BaoCaoQuyCheDanChu/Delete/' + id, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': token ? token.value : ''
            }
        })
        .then(function (r) { return r.json(); })
        .then(function (json) {
            if (json.success) {
                toastr.success('Đã xóa báo cáo thành công.');
                table.ajax.reload(null, false);
            } else {
                toastr.error(json.message || 'Không thể xóa báo cáo.');
            }
        })
        .catch(function () { toastr.error('Lỗi kết nối. Vui lòng thử lại.'); });
    }

    // ─── Public API ─────────────────────────────────────────────
    window.qcdcMgmt = { deleteItem: deleteItem };

    // ─── Init ───────────────────────────────────────────────────
    $(document).ready(function () {
        initDataTable();
        initFilters();
    });

})();
