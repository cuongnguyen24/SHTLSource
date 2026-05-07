// Dashboard CanhBao — SCR-ALT-001 — IIFE Pattern
(function () {
    'use strict';

    let table;

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : '';
    }

    function initDataTable() {
        table = $('#tblCanhBao').DataTable({
            processing: true,
            serverSide: true,
            ajax: {
                url: '/DashboardQuyCheDanChu/GetViolations',
                type: 'GET',
                dataSrc: 'data',
                data: function (d) {
                    const params = new URLSearchParams();
                    params.set('page', String((d.start / d.length) + 1));
                    params.set('pageSize', String(d.length));
                    const s   = $('#alertSearch').val();
                    const kcn = $('#alertKCN').val();
                    const ky  = $('#alertKy').val();
                    const loi = $('#alertLoai').val();
                    const tt  = $('#alertTrangThai').val();
                    if (s)   params.set('search', s);
                    if (kcn) params.set('industrialZoneId', kcn);
                    if (ky)  params.set('kyBaoCaoId', ky);
                    if (loi) params.set('loai', loi);
                    if (tt)  params.set('trangThai', tt);
                    params.forEach(function (v, k) { d[k] = v; });
                    delete d.start; delete d.length;
                }
            },
            columns: [
                {
                    data: null, width: '5%', orderable: false,
                    render: function (data, type, row, meta) {
                        return meta.row + meta.settings._iDisplayStart + 1;
                    }
                },
                {
                    data: 'enterpriseName', width: '22%',
                    render: function (data) { return escapeHtml(data || ''); }
                },
                {
                    data: 'kcnName', width: '12%',
                    render: function (data) { return escapeHtml(data || ''); }
                },
                {
                    data: 'loaiBaoCao', width: '10%',
                    render: function (data) {
                        return data === 'DTDK'
                            ? '<span class="badge badge-dtdk">ĐTĐK</span>'
                            : '<span class="badge badge-qcdc">QCDC</span>';
                    }
                },
                {
                    data: 'kyBaoCaoName', width: '12%',
                    render: function (data) { return escapeHtml(data || ''); }
                },
                {
                    data: 'hanNop', width: '10%',
                    render: function (data) {
                        if (!data) return '';
                        const formatted = data.substring(0, 10).split('-').reverse().join('/');
                        const overdue = new Date(data) < new Date();
                        return overdue ? '<span style="color:#dc2626;font-weight:600;">' + formatted + '</span>' : formatted;
                    }
                },
                {
                    data: 'soNgayQuaHan', width: '10%', className: 'text-center',
                    render: function (data) {
                        if (!data || data <= 0) return '<span style="color:#94a3b8;">0</span>';
                        return '<span class="badge badge-quahan">+' + data + ' ngày</span>';
                    }
                },
                {
                    data: 'trangThai', width: '11%',
                    render: function (data) {
                        if (data === 'ChuaNop' || data === 0) {
                            return '<span class="badge badge-chuanop">Chưa nộp</span>';
                        }
                        return '<span class="badge badge-quahan">Quá hạn</span>';
                    }
                },
                {
                    data: null, width: '8%', orderable: false,
                    render: function (data, type, row) {
                        const ctrl = row.loaiBaoCao === 'DTDK' ? 'BaoCaoDoiThoaiDinhKy' : 'BaoCaoQuyCheDanChu';
                        if (row.id) {
                            return '<a href="/' + ctrl + '/Details/' + row.id + '" class="btn-figma btn-figma-outline" style="padding:3px 8px;font-size:12px;">Xem →</a>';
                        }
                        return '<span class="text-muted" style="font-size:12px;">Chưa tạo</span>';
                    }
                }
            ],
            language: { url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/vi.json' },
            order: [[5, 'asc']]
        });
    }

    function loadFilters() {
        $.ajax({
            url: '/KyBaoCaoQCDCVaDT/GetAll?page=1&pageSize=100',
            type: 'GET',
            success: function (r) {
                if (r.success && r.data) {
                    const items = r.data.items || r.data;
                    (Array.isArray(items) ? items : []).forEach(function (item) {
                        $('#alertKy').append('<option value="' + item.id + '">' + escapeHtml(item.tenKy) + ' - ' + item.nam + '</option>');
                    });
                }
            }
        });
        $.ajax({
            url: '/Enterprise/GetKCNList',
            type: 'GET',
            success: function (r) {
                if (r.success && r.data) {
                    (Array.isArray(r.data) ? r.data : []).forEach(function (k) {
                        $('#alertKCN').append('<option value="' + k.id + '">' + escapeHtml(k.name || k.ten) + '</option>');
                    });
                }
            }
        });
    }

    function bindEvents() {
        let searchTimer;
        $('#alertSearch').on('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () { table.ajax.reload(); }, 400);
        });

        $('#btnAlertFilter').on('click', function () { table.ajax.reload(); });

        $('#btnAlertReset').on('click', function () {
            $('#alertSearch').val('');
            $('#alertKCN').val('');
            $('#alertKy').val('');
            $('#alertLoai').val('');
            $('#alertTrangThai').val('');
            table.ajax.reload();
        });

        $('#btnExportAlert').on('click', function () {
            const params = new URLSearchParams();
            params.set('format', 'excel');
            const kcn = $('#alertKCN').val();
            const ky  = $('#alertKy').val();
            const loi = $('#alertLoai').val();
            if (kcn) params.set('industrialZoneId', kcn);
            if (ky)  params.set('kyBaoCaoId', ky);
            if (loi) params.set('loai', loi);
            window.location.href = '/DashboardQuyCheDanChu/ExportCanhBao?' + params.toString();
        });

        $('#btnSendReminder').on('click', function () {
            $('#reminderContent').val('');
            $('#modalReminder').css('display', 'flex');
        });

        $('#btnCancelReminder').on('click', function () {
            $('#modalReminder').css('display', 'none');
        });

        $('#btnConfirmReminder').on('click', function () {
            const content = $('#reminderContent').val().trim();
            $.ajax({
                url: '/DashboardQuyCheDanChu/SendReminder',
                type: 'POST',
                contentType: 'application/json',
                headers: { 'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') },
                data: JSON.stringify({
                    content: content,
                    kyBaoCaoId: $('#alertKy').val() || null,
                    industrialZoneId: $('#alertKCN').val() || null,
                    loai: $('#alertLoai').val() || null
                }),
                success: function (r) {
                    if (r.success) {
                        toastr.success(r.message || 'Đã gửi nhắc nhở thành công');
                    } else {
                        toastr.error(r.message || 'Có lỗi xảy ra');
                    }
                    $('#modalReminder').css('display', 'none');
                },
                error: function () {
                    toastr.error('Không thể gửi nhắc nhở');
                    $('#modalReminder').css('display', 'none');
                }
            });
        });
    }

    $(document).ready(function () {
        initDataTable();
        loadFilters();
        bindEvents();
    });

})();
