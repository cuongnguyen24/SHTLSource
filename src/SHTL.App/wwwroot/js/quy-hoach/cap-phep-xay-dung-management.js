/**
 * GPXD Phase 1 — Inbox hồ sơ Cấp phép Xây dựng (M0200)
 * View: Views/CapPhepXayDung/Index.cshtml
 * Pattern: IIFE + DataTables server-side + debounce search + anti-forgery.
 */
(function ($) {
    'use strict';

    if (!window.gpxdConfig) {
        console.error('gpxdConfig is required');
        return;
    }

    var Cfg = window.gpxdConfig;

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function getAntiForgeryToken() {
        return $('input[name="__RequestVerificationToken"]').val() || '';
    }

    function formatDate(s) {
        if (!s) return '—';
        // s có thể là 'yyyy-MM-dd' hoặc ISO; lấy 10 ký tự đầu
        var d = String(s).substring(0, 10);
        var parts = d.split('-');
        return parts.length === 3 ? (parts[2] + '/' + parts[1] + '/' + parts[0]) : escapeHtml(s);
    }

    var STATUS_BADGE = {
        ChoXuLy:        { cls: 'badge-secondary', text: 'Chờ xử lý' },
        DangXuLy:       { cls: 'badge-info',      text: 'Đang xử lý' },
        ChoKySo:        { cls: 'badge-warning',   text: 'Chờ ký số' },
        ChoXacNhanOcr:  { cls: 'badge-warning',   text: 'Chờ xác nhận OCR' },
        DaCap:          { cls: 'badge-success',   text: 'Đã cấp' },
        TuChoi:         { cls: 'badge-danger',    text: 'Đã từ chối' }
    };

    function renderStatus(s, fallbackText) {
        var b = STATUS_BADGE[s];
        if (b) return '<span class="badge ' + b.cls + '" style="font-size:11px;">' + escapeHtml(b.text) + '</span>';
        // Khi service đã trả TrangThaiDescription thì show text đó thay vì enum số/string raw
        return '<span class="badge badge-light" style="font-size:11px;">' + escapeHtml(fallbackText || s || '—') + '</span>';
    }

    function renderRemaining(soNgay, quaHan) {
        if (soNgay === null || soNgay === undefined) return '<span class="text-muted">—</span>';
        var n = Number(soNgay);
        if (quaHan || n < 0) {
            return '<span class="badge badge-danger" style="font-size:11px;">Quá hạn ' + Math.abs(n) + ' ngày</span>';
        }
        if (n === 0) {
            return '<span class="badge badge-warning" style="font-size:11px;">Hết hạn hôm nay</span>';
        }
        var cls = n <= 2 ? 'badge-warning' : (n <= 5 ? 'badge-info' : 'badge-success');
        return '<span class="badge ' + cls + '" style="font-size:11px;">Còn ' + n + ' ngày</span>';
    }

    var Module = {
        table: null,
        searchTimer: null,

        init: function () {
            if ($('#gpxdTable').length === 0) return;
            this.initDataTable();
            this.bindEvents();
        },

        initDataTable: function () {
            var self = this;
            var ajax = {
                url: Cfg.urls.getDossiers,
                type: 'GET',
                data: function (d) {
                    return {
                        draw: d.draw,
                        page: (d.start / d.length) + 1,
                        pageSize: d.length,
                        search: $('#gpxdSearchInput').val(),
                        loaiB: $('#gpxdFilterLoaiB').val(),
                        status: $('#gpxdFilterStatus').val()
                    };
                }
            };

            var columns = [
                { data: null, className: 'text-center', render: function (d, t, r, m) { return m.row + m.settings._iDisplayStart + 1; } },
                {
                    data: 'maHoSo',
                    render: function (d, t, r) {
                        return '<a href="' + Cfg.urls.chiTiet + '/' + r.id + '" class="font-weight-bold text-primary">' + escapeHtml(d || '—') + '</a>';
                    }
                },
                {
                    data: 'loaiThuTucB', className: 'text-center',
                    render: function (d, t, r) {
                        var code = escapeHtml(d || '—');
                        var desc = r && r.loaiThuTucBDescription ? r.loaiThuTucBDescription : '';
                        return '<span class="badge badge-info" title="' + escapeHtml(desc) + '">' + code + '</span>';
                    }
                },
                { data: 'tenCongTy', render: function (d) { return '<div class="text-wrap font-weight-medium" style="font-size:12px;">' + escapeHtml(d || '—') + '</div>'; } },
                { data: 'kcnName', render: function (d) { return '<span style="font-size:12px;">' + escapeHtml(d || '—') + '</span>'; } },
                { data: 'ngayNhan', render: function (d) { return formatDate(d); } },
                { data: 'hanXuLy', render: function (d) { return formatDate(d); } },
                {
                    data: 'soNgayConLai', className: 'text-center',
                    render: function (d, t, r) { return renderRemaining(d, r && r.quaHan); }
                },
                {
                    data: 'trangThai', className: 'text-center',
                    render: function (d, t, r) { return renderStatus(d, r && r.trangThaiDescription); }
                },
                {
                    data: 'id', className: 'text-center', orderable: false,
                    render: function (d, t, r) {
                        var html = '<div class="table-actions-figma" style="justify-content:center;display:flex;gap:4px;">';
                        html += '<a href="' + Cfg.urls.chiTiet + '/' + r.id + '" class="btn-action-figma btn-action-view" title="Xem chi tiết"><i class="fas fa-eye"></i></a>';
                        if (Cfg.permissions.canUpdate && r.trangThai === 'ChoXuLy') {
                            html += '<a href="' + Cfg.urls.editDossier + '/' + r.id + '" class="btn-action-figma btn-action-edit" title="Sửa hồ sơ"><i class="fas fa-edit"></i></a>';
                        }
                        if (Cfg.permissions.canDelete && r.trangThai === 'ChoXuLy') {
                            html += '<button type="button" class="btn-action-figma btn-action-delete" data-action="delete" data-id="' + r.id + '" data-ma="' + escapeHtml(r.maHoSo) + '" title="Xoá hồ sơ"><i class="fas fa-trash"></i></button>';
                        }
                        html += '</div>';
                        return html;
                    }
                }
            ];

            var $tbl = $('#gpxdTable');
            if ($.fn.dataTableFigma) {
                this.table = $tbl.dataTableFigma({ serverSide: true, ordering: false, ajax: ajax, columns: columns });
            } else {
                this.table = $tbl.DataTable({ serverSide: true, processing: true, ordering: false, ajax: ajax, columns: columns, lengthMenu: [10, 20, 50, 100], pageLength: 20 });
            }
        },

        bindEvents: function () {
            var self = this;
            var reload = function () { self.table && self.table.ajax.reload(); };

            $('#gpxdSearchInput').on('input', function () {
                clearTimeout(self.searchTimer);
                self.searchTimer = setTimeout(reload, 300);
            });
            $('#gpxdBtnSearch').on('click', reload);
            $('#gpxdBtnRefresh').on('click', reload);
            $('#gpxdFilterLoaiB, #gpxdFilterStatus').on('change', reload);

            $('#gpxdTable tbody').on('click', 'button[data-action="delete"]', function () {
                var id = $(this).data('id');
                var ma = $(this).data('ma');
                if (!confirm('Xác nhận xoá hồ sơ "' + ma + '"?')) return;

                $.ajax({
                    url: Cfg.urls.deleteDossier + '/' + id,
                    type: 'POST',
                    headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                    success: function (resp) {
                        if (resp && resp.isSuccess) {
                            if (window.toastr) toastr.success('Đã xoá hồ sơ.'); else alert('Đã xoá.');
                            reload();
                        } else {
                            if (window.toastr) toastr.error((resp && resp.message) || 'Không thể xoá.'); else alert((resp && resp.message) || 'Không thể xoá.');
                        }
                    },
                    error: function () { alert('Lỗi kết nối khi xoá.'); }
                });
            });
        }
    };

    $(function () { Module.init(); });
})(jQuery);
