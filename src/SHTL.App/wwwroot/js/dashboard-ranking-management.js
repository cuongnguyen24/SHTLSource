// Xuất Báo cáo Tổng hợp QCDC & ĐTĐK — Ranking (SCR-NV-KPI-003) — IIFE Pattern
(function () {
    'use strict';

    let table;

    // ===== YEAR FILTER =====
    function initYearFilter() {
        const currentYear = new Date().getFullYear();
        const $sel = $('#filterYear');
        $sel.empty().append('<option value="">Tất cả</option>');
        for (let y = currentYear; y >= currentYear - 4; y--) {
            $sel.append(`<option value="${y}"${y === currentYear ? ' selected' : ''}>${y}</option>`);
        }
    }

    // ===== DATA TABLE =====
    function initDataTable() {
        table = $('#rankingTable').DataTable({
            serverSide: true,
            processing: true,
            ajax: {
                url: '/Dashboard/GetRankingData',
                type: 'GET',
                data: function (d) {
                    d.year = $('#filterYear').val();
                    d.kcnId = $('#filterKCN').val();
                    d.nganhId = $('#filterNganh').val();
                    // Map DataTables → API params
                    const pageSize = d.length;
                    const page = Math.floor(d.start / pageSize) + 1;
                    d.page = page;
                    d.pageSize = pageSize;
                    delete d.start;
                    delete d.length;
                },
                dataSrc: function (json) {
                    const total = json.recordsTotal ?? 0;
                    $('#totalDNCount').text(total.toLocaleString('vi-VN'));
                    json.recordsTotal = total;
                    json.recordsFiltered = total;
                    return json.data ?? [];
                }
            },
            order: [[7, 'desc']], // Default sort by Điểm DESC
            pageLength: 20,
            lengthMenu: [10, 20, 50, 100],
            columns: [
                {
                    data: 'xepHang',
                    orderable: false,
                    className: 'text-center',
                    render: function (data) {
                        if (data === 1) return `<span class="badge" style="background:#f59e0b; color:#fff; font-size:13px; border-radius:50%; width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center;">🥇</span>`;
                        if (data === 2) return `<span class="badge" style="background:#94a3b8; color:#fff; font-size:13px; border-radius:50%; width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center;">🥈</span>`;
                        if (data === 3) return `<span class="badge" style="background:#cd7c35; color:#fff; font-size:13px; border-radius:50%; width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center;">🥉</span>`;
                        return `<span style="font-weight:700; color:#64748b;">${data}</span>`;
                    }
                },
                {
                    data: 'enterpriseName',
                    render: function (data) {
                        return `<span style="font-weight:600;">${escapeHtml(data)}</span>`;
                    }
                },
                {
                    data: 'kcnName',
                    render: function (data) {
                        return data ? escapeHtml(data) : '<span class="text-muted">—</span>';
                    }
                },
                {
                    data: 'nganhName',
                    render: function (data) {
                        return data ? escapeHtml(data) : '<span class="text-muted">—</span>';
                    }
                },
                {
                    data: null,
                    className: 'text-center',
                    orderable: false,
                    render: function (data) {
                        const nop = data.soBCNop ?? 0;
                        const yc = data.tongBCYeuCau ?? 3;
                        const color = nop >= yc ? '#059669' : nop >= yc * 0.5 ? '#d97706' : '#dc2626';
                        return `<span style="font-weight:700; color:${color};">${nop}/${yc}</span>`;
                    }
                },
                {
                    data: 'tyLeTuanThu',
                    className: 'text-center',
                    render: function (data) {
                        const pct = parseFloat(data) || 0;
                        const color = pct >= 80 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626';
                        return `<span style="font-weight:700; color:${color};">${pct.toFixed(1)}%</span>`;
                    }
                },
                {
                    data: 'tyLeDungHan',
                    className: 'text-center',
                    render: function (data) {
                        const pct = parseFloat(data) || 0;
                        const color = pct >= 80 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626';
                        return `<span style="font-weight:700; color:${color};">${pct.toFixed(1)}%</span>`;
                    }
                },
                {
                    data: 'diemTuanThu',
                    className: 'text-center',
                    render: function (data) {
                        const score = parseFloat(data) || 0;
                        const color = score >= 80 ? '#059669' : score >= 60 ? '#2563eb' : score >= 40 ? '#d97706' : '#dc2626';
                        return `<span style="font-size:15px; font-weight:800; color:${color};">${score.toFixed(1)}</span>`;
                    }
                }
            ],
            language: {
                processing: '<i class="fas fa-spinner fa-spin"></i> Đang tải...',
                emptyTable: 'Không có dữ liệu',
                zeroRecords: 'Không tìm thấy doanh nghiệp phù hợp',
                lengthMenu: 'Hiển thị _MENU_ hàng',
                info: 'Doanh nghiệp _START_ đến _END_ / _TOTAL_',
                paginate: { first: '«', previous: '‹', next: '›', last: '»' }
            },
            responsive: true
        });
    }

    // ===== FILTERS =====
    function initFilters() {
        $('#btnSearch').on('click', function () {
            table.ajax.reload();
        });

        $('#btnReset').on('click', function () {
            $('#filterYear').val(new Date().getFullYear().toString());
            $('#filterKCN').val('');
            $('#filterNganh').val('');
            table.ajax.reload();
        });
    }

    // ===== EXPORT =====
    function initExport() {
        $('#btnExportExcel').on('click', function () {
            if (!window.rankingPermissions?.canExport) return;
            const year = $('#filterYear').val();
            const kcnId = $('#filterKCN').val();
            const nganhId = $('#filterNganh').val();
            const url = `/Dashboard/ExportExcel?year=${encodeURIComponent(year)}&kcnId=${encodeURIComponent(kcnId)}&nganhId=${encodeURIComponent(nganhId)}`;
            toastr.info('Đang chuẩn bị file xuất...');
            window.location.href = url;
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ===== INIT =====
    $(document).ready(function () {
        initYearFilter();
        initDataTable();
        initFilters();
        if (window.rankingPermissions?.canExport) initExport();
    });

})();
