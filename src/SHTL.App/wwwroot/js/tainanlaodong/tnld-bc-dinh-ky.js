/**
 * TNLD Báo cáo định kỳ - Index (List) Management (M0142)
 * Mirror tnld-management.js (M0141): dataTableFigma helper, ?id= URL, bootstrap4 select2.
 */
(function () {
    'use strict';

    const BCDK = {
        table: null,
        urls: {
            getAll: '/TaiNanLaoDong/TaiNanLaoDongBaoCaoDinhKy/GetAll',
            chiTiet: '/TaiNanLaoDong/TaiNanLaoDongBaoCaoDinhKy/ChiTiet',
            edit: '/TaiNanLaoDong/TaiNanLaoDongBaoCaoDinhKy/NhapThayPA_B',
            delete: '/TaiNanLaoDong/TaiNanLaoDongBaoCaoDinhKy/Delete',
            chipCounts: '/TaiNanLaoDong/TaiNanLaoDongBaoCaoDinhKy/GetChipCounts',
            kyBaoCao: '/TaiNanLaoDong/TaiNanLaoDongBaoCaoDinhKy/GetKyBaoCaoOptions',
            industrialZones: '/TaiNanLaoDong/TaiNanLaoDongBaoCaoDinhKy/GetIndustrialZones'
        },
        currentFilter: { trangThai: '', kyBaoCaoId: '', industrialZoneId: '', nam: '', search: '' },

        init: function () {
            this.initFilters();
            this.initTable();
            this.bindEvents();
            this.loadChipCounts();
            this.loadKyBaoCaoOptions();
            this.loadIndustrialZones();
            this.populateNamOptions();
        },

        populateNamOptions: function () {
            const $sel = $('#filterNam');
            const currentYear = new Date().getFullYear();
            for (let y = currentYear; y >= currentYear - 5; y--) {
                $sel.append(`<option value="${y}">${y}</option>`);
            }
        },

        initFilters: function () {
            $('#filterKyBaoCao, #filterNam, #filterKCN, #filterTrangThai').select2({
                width: '100%',
                allowClear: true,
                theme: 'bootstrap4'
            });
        },

        initTable: function () {
            const self = this;
            this.table = $('#bcdkTable').dataTableFigma({
                serverSide: true,
                ordering: false,
                searching: false,
                ajax: {
                    url: self.urls.getAll,
                    type: 'GET',
                    data: function (d) {
                        d.search = self.currentFilter.search;
                        d.trangThai = self.currentFilter.trangThai;
                        d.kyBaoCaoId = self.currentFilter.kyBaoCaoId;
                        d.industrialZoneId = self.currentFilter.industrialZoneId;
                        d.nam = self.currentFilter.nam;
                    },
                    dataSrc: function (json) {
                        if (json.error) toastr.error(json.error);
                        return json.data || [];
                    }
                },
                columns: [
                    { data: null, className: 'text-center', render: (d, t, r, m) => m.row + 1 + m.settings._iDisplayStart },
                    {
                        data: 'enterpriseName',
                        render: (d, t, r) => `<a href="${self.urls.chiTiet}?id=${r.id}" class="font-weight-bold text-primary" title="Xem chi tiết">${self.escape(d || '—')}</a><div style="font-size:11px; color:#64748b;">${self.escape(r.maBaoCao || '')}</div>`
                    },
                    { data: 'industrialZoneName', render: d => self.escape(d || '—') },
                    { data: 'tenKyBaoCao', render: d => self.escape(d || '—') },
                    { data: 'nam', className: 'text-center' },
                    { data: 'ngayNop', className: 'text-center', render: d => d ? new Date(d).toLocaleDateString('vi-VN') : '—' },
                    { data: 'soVuTNLD', className: 'text-center font-weight-bold' },
                    { data: 'soVuChetNguoi', className: 'text-center', render: d => d > 0 ? `<span style="color:#dc2626; font-weight:700;">${d}</span>` : d },
                    { data: 'soVuNang', className: 'text-center', render: d => d > 0 ? `<span style="color:#f59e0b; font-weight:700;">${d}</span>` : d },
                    { data: 'soVuNhe', className: 'text-center' },
                    { data: 'tongNgayNghi', className: 'text-center' },
                    {
                        data: 'trangThai', className: 'text-center', render: function (d, t, r) {
                            const colorMap = {
                                'ChoXacNhan': 'background:#fef3c7; color:#92400e;',
                                'DaXacNhan': 'background:#d1fae5; color:#065f46;',
                                'YeuCauBoSung': 'background:#fed7aa; color:#9a3412;',
                                'TuChoi': 'background:#fee2e2; color:#991b1b;',
                                'Nhap': 'background:#e2e8f0; color:#475569;'
                            };
                            const style = colorMap[d] || 'background:#e2e8f0; color:#475569;';
                            return `<span style="padding:4px 10px; border-radius:12px; font-size:11px; font-weight:600; ${style}">${self.escape(r.trangThaiDisplay || d)}</span>`;
                        }
                    },
                    { data: 'canBoXacNhan', render: d => self.escape(d || '—') },
                    {
                        data: null, className: 'text-center', render: function (r) {
                            const perms = window.userPermissions || {};
                            const canEdit = perms.canUpdate && (r.trangThai === 'ChoXacNhan' || r.trangThai === 'YeuCauBoSung');
                            const canDelete = perms.canDelete && (r.trangThai === 'Nhap' || r.trangThai === 'YeuCauBoSung');
                            let html = '<div class="table-actions-figma" style="justify-content:center;">';
                            html += `<a href="${self.urls.chiTiet}?id=${r.id}" class="btn-action-figma btn-action-view" title="Xem"><i class="fas fa-eye"></i></a>`;
                            if (canEdit) html += `<a href="${self.urls.edit}?id=${r.id}" class="btn-action-figma btn-action-edit" title="Sửa"><i class="fas fa-pen"></i></a>`;
                            if (canDelete) html += `<button type="button" class="btn-action-figma btn-action-delete btn-delete-row" data-id="${r.id}" data-code="${self.escape(r.maBaoCao || '')}" title="Xóa"><i class="fas fa-trash-alt"></i></button>`;
                            html += '</div>';
                            return html;
                        }
                    }
                ],
                drawCallback: function (settings) {
                    if (typeof FigmaDataTables !== 'undefined' && FigmaDataTables.defaultConfig) {
                        FigmaDataTables.defaultConfig.drawCallback(settings);
                    }
                    const $wrapper = $(settings.nTable).closest('.dataTables_wrapper');
                    const $pagination = $wrapper.find('.pagination-figma-container');
                    if ($pagination.length && $('#paginationFrame').length) {
                        $pagination.appendTo('#paginationFrame');
                    }
                    self.loadChipCounts();
                }
            });
        },

        bindEvents: function () {
            const self = this;

            $('#btnSearch').on('click', () => {
                // Apply BOTH text search + advanced filter values at the same time
                self.currentFilter.search = $('#customSearchInput').val().trim();
                self.currentFilter.kyBaoCaoId = $('#filterKyBaoCao').val() || '';
                self.currentFilter.nam = $('#filterNam').val() || '';
                self.currentFilter.industrialZoneId = $('#filterKCN').val() || '';
                self.currentFilter.trangThai = $('#filterTrangThai').val() || '';
                self.syncChipsWithFilter();
                self.table.ajax.reload();
            });
            $('#customSearchInput').on('keypress', function (e) { if (e.which === 13) $('#btnSearch').click(); });
            $('#btnRefresh').on('click', () => {
                $('#customSearchInput').val('');
                self.currentFilter = { trangThai: '', kyBaoCaoId: '', industrialZoneId: '', nam: '', search: '' };
                $('#filterKyBaoCao, #filterNam, #filterKCN, #filterTrangThai').val('').trigger('change.select2');
                $('#quickFilterChips .filter-chip').removeClass('active');
                $('#quickFilterChips .filter-chip[data-filter=""]').addClass('active');
                self.table.ajax.reload();
            });
            $('#btnToggleAdvancedFilter').on('click', () => $('#advancedFilterArea').toggleClass('show'));

            // NOTE: Advanced filter dropdowns KHÔNG auto reload — chỉ phản hồi khi click "Tìm kiếm".
            // (Trước đây có .on('change') tự reload, đã được loại bỏ theo yêu cầu UX.)

            $('#quickFilterChips').on('click', '.filter-chip', function () {
                $('#quickFilterChips .filter-chip').removeClass('active');
                $(this).addClass('active');
                self.currentFilter.trangThai = $(this).data('filter') || '';
                $('#filterTrangThai').val(self.currentFilter.trangThai).trigger('change.select2');
                self.table.ajax.reload();
            });

            $(document).on('click', '.btn-delete-row', function () {
                const id = $(this).data('id');
                const code = $(this).data('code');
                if (!confirm(`Xóa báo cáo ${code}?`)) return;
                $.ajax({
                    url: `${self.urls.delete}?id=${id}`,
                    type: 'POST',
                    headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
                    success: function (resp) {
                        if (resp.success) {
                            toastr.success(resp.message || 'Đã xóa');
                            self.table.ajax.reload();
                            self.loadChipCounts();
                        } else {
                            toastr.error(resp.message || 'Xóa thất bại');
                        }
                    },
                    error: xhr => TNLDShared.handleAjaxError(xhr, 'Lỗi khi xóa')
                });
            });
        },

        syncChipsWithFilter: function () {
            const trangThai = this.currentFilter.trangThai;
            $('#quickFilterChips .filter-chip').removeClass('active');
            $(`#quickFilterChips .filter-chip[data-filter="${trangThai}"]`).addClass('active');
        },

        loadChipCounts: function () {
            $.get(this.urls.chipCounts, function (resp) {
                if (resp && resp.success && resp.data) {
                    $('#countAll').text(resp.data.all ?? 0);
                    $('#countChoXacNhan').text(resp.data.ChoXacNhan ?? 0);
                    $('#countDaXacNhan').text(resp.data.DaXacNhan ?? 0);
                    $('#countYeuCauBoSung').text(resp.data.YeuCauBoSung ?? 0);
                    $('#countTuChoi').text(resp.data.TuChoi ?? 0);
                }
            });
        },

        loadKyBaoCaoOptions: function () {
            const $sel = $('#filterKyBaoCao');
            $.get(this.urls.kyBaoCao, function (resp) {
                if (resp && resp.success && Array.isArray(resp.data)) {
                    resp.data.forEach(k => {
                        $sel.append(`<option value="${k.id}">${k.tenKy} - ${k.nam}</option>`);
                    });
                }
            });
        },

        loadIndustrialZones: function () {
            const $sel = $('#filterKCN');
            $.get(this.urls.industrialZones, function (resp) {
                if (resp && resp.success && Array.isArray(resp.data)) {
                    resp.data.forEach(z => {
                        $sel.append(`<option value="${z.id}">${z.name}</option>`);
                    });
                }
            });
        },

        escape: function (s) {
            if (s == null) return '';
            return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }
    };

    $(document).ready(() => BCDK.init());
})();
