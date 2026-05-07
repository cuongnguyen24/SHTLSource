// Dashboard Cảnh báo DN chưa nộp/quá hạn — IIFE Pattern (SCR-NV-ALT-001)
(function () {
    'use strict';

    const API = {
        getAlerts: '/Alert/GetAlerts'
    };

    const perms = window.alertPermissions || {};
    let table;
    let lastMetrics = {};

    // ===== DATATABLE =====
    function initDataTable() {
        table = $('#tblAlerts').DataTable({
            processing: true,
            serverSide: true,
            ajax: {
                url: API.getAlerts,
                type: 'GET',
                data: function (d) {
                    d.loaiBC = $('#filterLoaiBC').val();
                    d.mucDo = $('#filterMucDo').val();
                    const pageSize = d.length;
                    const page = Math.floor(d.start / pageSize) + 1;
                    d.page = page;
                    d.pageSize = pageSize;
                    delete d.start;
                    delete d.length;
                },
                dataFilter: function (data) {
                    const json = JSON.parse(data);
                    if (json.success && json.data) {
                        json.recordsTotal = json.data.totalCount;
                        json.recordsFiltered = json.data.totalCount;
                        if (json.metrics) {
                            lastMetrics = json.metrics;
                            renderMetrics(json.metrics);
                        }
                        json.data = json.data.items;
                        $('#totalAlertCount').text(json.recordsTotal);
                    } else {
                        json.recordsTotal = 0;
                        json.recordsFiltered = 0;
                        json.data = [];
                    }
                    return JSON.stringify(json);
                }
            },
            columns: [
                {
                    data: null,
                    orderable: false,
                    render: function (data, type, row) {
                        return `<input type="checkbox" class="row-checkbox" value="${row.id}" data-name="${escapeHtml(row.enterpriseName)}">`;
                    }
                },
                {
                    data: 'mucDoUuTien',
                    render: function (data) {
                        const map = {
                            'KHAN_CAP': '<span class="badge-khan-cap">🔴🔴 Khẩn cấp</span>',
                            'QUA_HAN': '<span class="badge-qua-han">🔴 Quá hạn</span>',
                            'GAN_HAN': '<span class="badge-gan-han">⚠️ Gần hạn</span>',
                            'SAP_HAN': '<span class="badge-sap-han">⏰ Sắp hạn</span>'
                        };
                        return map[data] || '<span style="color:#94a3b8;">—</span>';
                    }
                },
                {
                    data: 'enterpriseName',
                    render: function (data) { return `<span style="font-weight:600;">${escapeHtml(data)}</span>`; }
                },
                {
                    data: 'kyBaoCaoName',
                    render: function (data) { return `<span style="font-size:12px; color:#64748b;">${escapeHtml(data || '—')}</span>`; }
                },
                {
                    data: 'loaiBC',
                    render: function (data, type, row) {
                        const cls = data === 'QCDC' ? 'badge-loai-qcdc' : 'badge-loai-dtdk';
                        const label = row.loaiBCDisplay || data;
                        return `<span class="${cls}">${escapeHtml(label)}</span>`;
                    }
                },
                {
                    data: 'ngayNop',
                    render: function (data) {
                        if (!data) return '<span class="text-muted" style="font-size:12px;">Chưa nộp</span>';
                        const d = new Date(data);
                        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                    }
                },
                {
                    data: 'soNgayQuaHan',
                    render: function (data) {
                        if (data === 999) return '<span class="text-muted">—</span>';
                        if (data > 0) return `<span style="color:#dc2626; font-weight:700;">${data} ngày</span>`;
                        if (data === 0) return '<span style="color:#f59e0b; font-weight:600;">Hôm nay</span>';
                        return `<span style="color:#2563eb; font-size:12px;">còn ${Math.abs(data)} ngày</span>`;
                    }
                },
                {
                    data: null,
                    orderable: false,
                    render: function (data, type, row) {
                        let btns = '';
                        if (perms.canSendEmail) {
                            btns += `<button onclick="window.sendEmail('${row.id}', '${escapeHtml(row.enterpriseName)}')" class="btn-figma btn-figma-outline" style="height:26px;padding:0 8px;font-size:11px;" title="Gửi email nhắc">
                                <i class="fas fa-envelope"></i>
                            </button> `;
                        }
                        return btns || '<span class="text-muted" style="font-size:12px;">—</span>';
                    }
                }
            ],
            language: { url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/vi.json' },
            order: [[6, 'desc']] // sort by SoNgayQuaHan DESC
        });
    }

    // ===== RENDER METRICS =====
    function renderMetrics(metrics) {
        $('#metricKhanCap').text(metrics.tongQuaHan7d ?? 0);
        $('#metricGanHan').text(metrics.tongChuaNop ?? 0);
        $('#metricTatCa').text(metrics.tongTatCa ?? 0);

        const quaHan1_7 = (metrics.tongTatCa ?? 0) - (metrics.tongQuaHan7d ?? 0) - (metrics.tongSapHan ?? 0);
        $('#metricQuaHan').text(Math.max(quaHan1_7, 0));
    }

    // ===== SELECT ALL CHECKBOX =====
    function initCheckAll() {
        $('#chkAll').on('change', function () {
            const checked = this.checked;
            $('#tblAlerts .row-checkbox').prop('checked', checked);
        });

        $('#tblAlerts').on('change', '.row-checkbox', function () {
            const allChecked = $('#tblAlerts .row-checkbox:not(:checked)').length === 0;
            $('#chkAll').prop('checked', allChecked);
        });
    }

    // ===== BULK EMAIL =====
    function initBulkEmail() {
        $('#btnBulkEmail').on('click', function () {
            const selected = [];
            $('#tblAlerts .row-checkbox:checked').each(function () {
                selected.push({ id: this.value, name: $(this).data('name') });
            });
            if (selected.length === 0) {
                toastr.warning('Vui lòng chọn ít nhất 1 doanh nghiệp để gửi email.');
                return;
            }
            const names = selected.slice(0, 5).map(x => `• ${x.name}`).join('\n');
            const more = selected.length > 5 ? `\n... và ${selected.length - 5} DN khác` : '';
            if (confirm(`Gửi email nhắc nhở đến ${selected.length} doanh nghiệp?\n\n${names}${more}`)) {
                toastr.info(`Đã yêu cầu gửi email đến ${selected.length} doanh nghiệp. Hệ thống sẽ gửi email trong vài phút.`);
            }
        });
    }

    // ===== SEND EMAIL (single) =====
    window.sendEmail = function (id, name) {
        if (confirm(`Gửi email nhắc nhở đến:\n"${name}"\n\nXác nhận gửi?`)) {
            toastr.success(`Đã gửi email nhắc nhở đến "${name}".`);
        }
    };

    // ===== FILTERS =====
    function initFilters() {
        $('#btnSearch').on('click', () => table.ajax.reload());
        $('#btnReset').on('click', function () {
            $('#filterLoaiBC').val('');
            $('#filterMucDo').val('');
            table.ajax.reload();
        });
    }

    // ===== UTIL =====
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ===== INIT =====
    $(document).ready(function () {
        initDataTable();
        initFilters();
        initCheckAll();
        if (perms.canSendEmail) initBulkEmail();
    });

})();
