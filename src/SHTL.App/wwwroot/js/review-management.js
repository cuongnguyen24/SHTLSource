/**
 * Review Management — Danh sách BC QCDC & ĐTĐK chờ xử lý
 * Screen: SCR-NV-REV-001
 * Module: Quy chế Dân chủ & Đối thoại (M0093/M0094)
 *
 * ARCHITECTURE: JavaScript → MVC Controller (/Review/GetAll) → ApiService → Backend API
 */
(function () {
    'use strict';

    // ─── State ─────────────────────────────────────────────────────────────────
    let table;

    // ─── MVC Action Endpoints (NOT /api/v1/...) ─────────────────────────────────
    var API = {
        getAll: '/Review/GetAll',
        getKyBaoCaoList: '/Review/GetKyBaoCaoList',
        getKcnList: '/Enterprise/GetKcnOptions',
        exportExcel: '/Review/ExportExcel'
    };

    // ─── Badge: Loại BC ─────────────────────────────────────────────────────────
    var LOAI_BC_BADGE = {
        'QCDC':    { css: 'badge-loai-qcdc6t',  label: 'QCDC' },
        'DTDK':    { css: 'badge-loai-dtdk',     label: 'ĐTĐK' },
        'DOTXUAT': { css: 'badge-loai-dotxuat',  label: 'Đột xuất' }
    };

    // ─── Badge: Trạng thái ──────────────────────────────────────────────────────
    var TRANG_THAI_BADGE = {
        1: { css: 'badge-trangThai-default', label: 'Nháp' },
        2: { css: 'badge-trangThai-wait',    label: 'Chờ xác nhận' },
        3: { css: 'badge-trangThai-done',    label: 'Đã xác nhận' },
        4: { css: 'badge-trangThai-supp',    label: 'YC bổ sung' },
        5: { css: 'badge-trangThai-reject',  label: 'Từ chối' }
    };

    // ─── Badge: Mức tuân thủ ────────────────────────────────────────────────────
    var MUC_TUAN_THU = {
        'DAY_DU':   { css: 'badge-tuan-thu-day-du',   label: 'Đầy đủ' },
        'CO_BAN':   { css: 'badge-tuan-thu-co-ban',   label: 'Cơ bản' },
        'CHUA_DAT': { css: 'badge-tuan-thu-chua-dat', label: 'Chưa đạt' }
    };

    // ─── Utilities ───────────────────────────────────────────────────────────────
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '—';
        var dd  = String(d.getDate()).padStart(2, '0');
        var mm  = String(d.getMonth() + 1).padStart(2, '0');
        var yyyy = d.getFullYear();
        var hh  = String(d.getHours()).padStart(2, '0');
        var min = String(d.getMinutes()).padStart(2, '0');
        return dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + min;
    }

    function renderLoaiBCBadge(loaiBC, loaiBCDisplay) {
        var cfg = LOAI_BC_BADGE[loaiBC] || { css: 'badge-trangThai-default', label: escapeHtml(loaiBCDisplay || loaiBC) };
        return '<span class="' + cfg.css + '">' + (cfg.label || escapeHtml(loaiBCDisplay)) + '</span>';
    }

    function renderTrangThaiBadge(trangThai, trangThaiDisplay) {
        var cfg = TRANG_THAI_BADGE[trangThai];
        if (cfg) return '<span class="' + cfg.css + '">' + cfg.label + '</span>';
        return '<span class="badge-trangThai-default">' + escapeHtml(trangThaiDisplay || String(trangThai)) + '</span>';
    }

    function renderMucTuanThu(mucTuanThu) {
        if (!mucTuanThu) return '<span style="color:#94a3b8;">—</span>';
        var cfg = MUC_TUAN_THU[mucTuanThu];
        if (cfg) return '<span class="' + cfg.css + '">' + cfg.label + '</span>';
        return '<span class="badge-trangThai-default">' + escapeHtml(mucTuanThu) + '</span>';
    }

    function renderDungHan(nopDungHan) {
        return nopDungHan
            ? '<i class="fas fa-check-circle icon-dunghan-yes" title="Nộp đúng hạn"></i>'
            : '<i class="fas fa-times-circle icon-dunghan-no"  title="Nộp trễ hạn"></i>';
    }

    // ─── DataTable Initialization ────────────────────────────────────────────────
    function initDataTable() {
        table = $('#reviewTable').DataTable({
            processing: true,
            serverSide: true,
            ajax: {
                url: API.getAll,   // ✅ MVC action, NOT /api/v1/...
                type: 'GET',
                data: function (d) {
                    var params = new URLSearchParams();

                    // Pagination
                    var pageSize = d.length;
                    var page = Math.floor(d.start / pageSize) + 1;
                    params.append('page', page);
                    params.append('pageSize', pageSize);

                    // Filters
                    var search = document.getElementById('searchInput').value.trim();
                    if (search) params.append('search', search);

                    var loaiBC = document.getElementById('filterLoaiBC').value;
                    if (loaiBC) params.append('loaiBC', loaiBC);
                    var kcn = document.getElementById('filterKcn').value;
                    if (kcn) params.append('kcn', kcn);

                    var ky = document.getElementById('filterKy').value;
                    if (ky) params.append('kyBaoCaoId', ky);

                    var status = document.getElementById('filterStatus').value;
                    if (status) params.append('trangThai', status);

                    return params.toString();
                },
                dataSrc: function (json) {
                    if (!json.success) {
                        toastr.error(json.message || 'Không thể tải dữ liệu');
                        return [];
                    }
                    $('#resultCount').text('Tổng: ' + (json.recordsFiltered || 0) + ' kết quả');
                    return json.data || [];
                }
            },
            columns: [
                {
                    // Mã BC — clickable link
                    data: 'maBC',
                    render: function (data, type, row) {
                        if (type !== 'display') return data || '';
                        var url = '/Review/Details/' + row.id + '?loaiBC=' + (row.loaiBC || 'QCDC');
                        return '<a href="' + url + '" class="font-weight-bold" style="color:var(--primary);" onclick="event.stopPropagation();">'
                            + escapeHtml(data) + '</a>';
                    }
                },
                {
                    // Tên DN
                    data: 'enterpriseName',
                    render: function (data) { return escapeHtml(data) || '—'; }
                },
                {
                    data: 'kcnName',
                    orderable: false,
                    render: function (data) { return escapeHtml(data) || '—'; }
                },
                {
                    // Loại BC
                    data: 'loaiBC',
                    orderable: false,
                    render: function (data, type, row) {
                        if (type !== 'display') return data || '';
                        return renderLoaiBCBadge(data, row.loaiBCDisplay);
                    }
                },
                {
                    // Kỳ
                    data: 'kyBaoCaoName',
                    orderable: false,
                    render: function (data) { return escapeHtml(data) || '—'; }
                },
                {
                    // Ngày nộp
                    data: 'ngayNop',
                    render: function (data, type) {
                        if (type !== 'display') return data || '';
                        return formatDateTime(data);
                    }
                },
                {
                    // Trạng thái
                    data: 'trangThai',
                    orderable: false,
                    render: function (data, type, row) {
                        if (type !== 'display') return data;
                        return renderTrangThaiBadge(data, row.trangThaiDisplay);
                    }
                },
                {
                    // Đúng hạn
                    data: 'nopDungHan',
                    orderable: false,
                    className: 'text-center',
                    render: function (data, type) {
                        if (type !== 'display') return data;
                        return renderDungHan(data);
                    }
                },
                {
                    // Tuân thủ
                    data: 'mucTuanThu',
                    orderable: false,
                    render: function (data, type) {
                        if (type !== 'display') return data || '';
                        return renderMucTuanThu(data);
                    }
                }
            ],
            order: [[5, 'desc']], // Ngày nộp DESC (BR-04)
            pageLength: 20,
            lengthMenu: [[20, 50, 100], [20, 50, 100]],
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/vi.json',
                processing: '<i class="fas fa-spinner fa-spin fa-2x"></i><br>Đang tải...'
            },
            dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
            // Highlight overdue rows (BR-02)
            createdRow: function (row, data) {
                if (data.nopDungHan === false) {
                    $(row).addClass('row-overdue');
                }
            }
        });

        // Row click → navigate to review detail screen (BR-03)
        $('#reviewTable tbody').on('click', 'tr', function () {
            var data = table.row(this).data();
            if (!data) return;
            var url = '/Review/Details/' + data.id + '?loaiBC=' + (data.loaiBC || 'QCDC');
            window.location.href = url;
        });
    }

    // ─── Filter Handlers ─────────────────────────────────────────────────────────
    function initFilters() {
        // Search button
        $('#btnSearch').on('click', function () {
            if (table) table.ajax.reload();
        });

        // Reset filter button
        $('#btnResetFilter').on('click', function () {
            document.getElementById('searchInput').value = '';
            document.getElementById('filterKcn').value = '';
            document.getElementById('filterLoaiBC').value = '';
            document.getElementById('filterKy').value = '';
            document.getElementById('filterStatus').value = '';
            if (table) table.ajax.reload();
        });
    }

    // ─── Load Kỳ Báo Cáo for Dropdown ──────────────────────────────────────────
    function loadKyBaoCaoOptions() {
        fetch(API.getKyBaoCaoList)   // ✅ MVC action
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (!json.success || !json.data) return;
                var select = document.getElementById('filterKy');
                json.data.forEach(function (ky) {
                    var opt = document.createElement('option');
                    opt.value = ky.id;
                    opt.textContent = ky.tenKy;
                    select.appendChild(opt);
                });
            })
            .catch(function (err) {
                console.error('[Review] loadKyBaoCaoOptions error:', err);
            });
    }

    function loadKcnOptions() {
        var select = document.getElementById('filterKcn');
        if (!select) return;

        function appendKcnOptions(items) {
            var added = 0;
            var existed = new Set(Array.from(select.options).map(function (o) {
                return (o.value || '').trim().toLowerCase();
            }));

            items.forEach(function (item) {
                var ten = item.ten || item.name || item.displayName || item.industrialZoneName || item.tenKhuCongNghiep || '';
                ten = (ten || '').trim();
                if (!ten) return;

                var key = ten.toLowerCase();
                if (existed.has(key)) return;
                existed.add(key);

                var opt = document.createElement('option');
                opt.value = ten; // Review/GetAll currently filters by KCNName string
                opt.textContent = ten;
                select.appendChild(opt);
                added++;
            });
            return added;
        }

        function loadKcnFromMaster() {
            fetch('/IndustrialZones/GetAll')
                .then(function (r) { return r.json(); })
                .then(function (rows) {
                    var items = Array.isArray(rows) ? rows : [];
                    appendKcnOptions(items);
                })
                .catch(function (err) {
                    console.error('[Review] loadKcnOptions fallback error:', err);
                });
        }

        fetch(API.getKcnList)
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (!json || !json.success) {
                    loadKcnFromMaster();
                    return;
                }

                var items = (json.data && Array.isArray(json.data.items))
                    ? json.data.items
                    : (Array.isArray(json.data) ? json.data : []);

                var added = appendKcnOptions(items);
                if (added === 0) loadKcnFromMaster();
            })
            .catch(function (err) {
                console.error('[Review] loadKcnOptions error:', err);
                loadKcnFromMaster();
            });
    }

    // ─── Export Excel ────────────────────────────────────────────────────────────
    function initExportButton() {
        if (!window.userPermissions || !window.userPermissions.canExport) return;

        $('#btnExportExcel').on('click', function () {
            var params = new URLSearchParams();
            var search = document.getElementById('searchInput').value.trim();
            if (search) params.append('search', search);
            var loaiBC = document.getElementById('filterLoaiBC').value;
            if (loaiBC) params.append('loaiBC', loaiBC);
            var kcn = document.getElementById('filterKcn').value;
            if (kcn) params.append('kcn', kcn);
            var ky = document.getElementById('filterKy').value;
            if (ky) params.append('kyBaoCaoId', ky);
            var status = document.getElementById('filterStatus').value;
            if (status) params.append('trangThai', status);

            window.location.href = API.exportExcel + '?' + params.toString();
        });
    }

    // ─── Init ────────────────────────────────────────────────────────────────────
    $(document).ready(function () {
        initDataTable();
        initFilters();
        loadKyBaoCaoOptions();
        loadKcnOptions();
        initExportButton();

        $('#searchInput').on('keydown', function (e) {
            if (e.key === 'Enter' && table) table.ajax.reload();
        });
    });

})();
