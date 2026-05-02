/**
 * TaiNanLaoDong - Unified Script (v2.2)
 * Standardized with Figma design system.
 * Handles: List Management (TNLD Index)
 * Dependencies: jQuery, TNLDShared, DataTables, SweetAlert2, toastr
 */
(function ($) {
    'use strict';

    // Check TNLDShared dependency
    if (typeof TNLDShared === 'undefined') {
        console.error('TNLDShared is required but not loaded');
        return;
    }

    // ==========================================
    // MANAGEMENT MODULE (INDEX)
    // ==========================================
    var ManagementModule = {
        table: null,
        selectors: {
            table: '#tnldTable',
            btnSearch: '#btnSearch',
            btnRefresh: '#btnRefresh',
            btnToggleAdvancedFilter: '#btnToggleAdvancedFilter',
            btnExport: '#btnExport',
            searchInput: '#customSearchInput',
            chipContainer: '#quickFilterChips',
            chips: '.filter-chip'
        },
        activeFilterGroup: '',

        init: function () {
            if ($(this.selectors.table).length === 0) return;
            this.initCategoryDropdowns();
            this.initDataTable();
            this.initEvents();
            this.loadChipCounts();
        },

        initCategoryDropdowns: function () {
            // Load TNLD_LOAI for filter
            $.get('/CategoryType/GetByTypeCode?typeCode=TNLD_LOAI', function (response) {
                if (response.success && response.data) {
                    const $select = $('#filterLoaiTNLD');
                    response.data.forEach(item => {
                        // Robust mapping for case-sensitive propery names (Id/id, Name/name)
                        const id = item.id || item.Id;
                        const name = item.name || item.Name;
                        if (id && name) {
                            $select.append(`<option value="${id}">${name}</option>`);
                        }
                    });
                    // Trigger change to update Select2 UI
                    $select.trigger('change');
                } else {
                    console.error('Failed to load TNLD_LOAI category:', response.message);
                }
            }).fail(function (xhr) {
                console.error('Error fetching TNLD_LOAI category:', xhr.status, xhr.statusText);
            });

            // Initialize Enterprise Select2 AJAX (Matched with NhapThayPA_B logic)
            $('#filterEnterprise').select2({
                placeholder: 'Tìm kiếm doanh nghiệp...',
                allowClear: true,
                width: '100%',
                theme: 'bootstrap4',
                minimumInputLength: 0,
                ajax: {
                    url: '/TaiNanLaoDong/SearchEnterprises',
                    dataType: 'json',
                    delay: 300,
                    data: function (params) {
                        return { 
                            searchTerm: params.term || '',
                            pageNumber: params.page || 1,
                            pageSize: 20
                        };
                    },
                    processResults: function (response, params) {
                        // Support both Direct API response and PagedResult wrapper
                        const data = response.data || response;
                        const items = data.items || [];
                        return {
                            results: items.map(e => ({
                                id: e.id || e.Id,
                                text: (e.name || e.Name) + ' (' + (e.taxCode || e.TaxCode || '—') + ')'
                            })),
                            pagination: {
                                more: (params.page * 20) < (data.totalCount || 0)
                            }
                        };
                    },
                    cache: true,
                    error: function (xhr) {
                        console.error('Error searching enterprises:', xhr.status, xhr.statusText);
                    }
                }
            });


            // Initialize filterLoaiTNLD as Select2 (Manual init since we removed class select2)
            $('#filterLoaiTNLD').select2({
                placeholder: 'Tất cả loại',
                allowClear: true,
                width: '100%',
                theme: 'bootstrap4'
            });

            // Initialize other Select2-figma elements
            $('.select2-figma').select2({
                width: '100%',
                allowClear: true,
                theme: 'bootstrap4'
            });
        },

        initDataTable: function () {
            var self = this;

            this.table = $(this.selectors.table).dataTableFigma({
                serverSide: true,
                ordering: false,
                ajax: {
                    url: '/TaiNanLaoDong/GetAll',
                    type: 'GET',
                    data: function (d) {
                        return {
                            draw: d.draw,
                            search: $(self.selectors.searchInput).val(),
                            trangThai: self.activeFilterGroup ? self.getStatusFromGroup(self.activeFilterGroup) : '',
                            loaiTNLD: $('#filterLoaiTNLD').val(),
                            enterpriseId: $('#filterEnterprise').val(),
                            ngayXayRaTu: $('#filterNgayXayRaTu').val(),
                            ngayXayRaDen: $('#filterNgayXayRaDen').val(),
                            page: (d.start / d.length) + 1,
                            pageSize: d.length
                        };
                    }
                },
                columns: [
                    {
                        data: null,
                        className: 'text-center',
                        render: (data, type, row, meta) => meta.row + meta.settings._iDisplayStart + 1
                    },
                    {
                        data: 'maKhaiBao',
                        render: (data, type, row) => `<a href="/TaiNanLaoDong/ChiTiet/${row.id}" class="font-weight-bold text-primary" title="Xem chi tiết">${data || '—'}</a>`
                    },
                    {
                        data: 'loaiTNLD',
                        render: (data, type, row) => TNLDShared.renderLoaiTNLDBadge(row.loaiTNLDDisplay)
                    },
                    {
                        data: 'enterpriseName',
                        render: (data) => `<div class="text-wrap font-weight-medium" style="min-width:150px; font-size:12px;">${data || '—'}</div>`
                    },
                    {
                        data: 'kcnName',
                        render: (data) => `<div class="text-wrap" style="font-size:12px; color:#64748b;">${data || '—'}</div>`
                    },
                    {
                        data: 'ngayGioXayRa',
                        render: (data) => TNLDShared.formatDateTime(data)
                    },
                    {
                        data: 'createdAt',
                        render: (data) => TNLDShared.formatDateTime(data)
                    },
                    {
                        data: 'soNguoiBiNan',
                        className: 'text-center',
                        render: (data) => `<span class="font-weight-bold">${data || 0}</span>`
                    },
                    {
                        data: 'nopDungHan',
                        className: 'text-center',
                        render: (data, type, row) => TNLDShared.renderNopDungHanBadge(data, row.soGioTre)
                    },
                    {
                        data: 'phuongThucNhap',
                        className: 'text-center',
                        render: (data) => `<span class="badge badge-secondary" style="font-size:10px;">${data || 'PA-B'}</span>`
                    },
                    {
                        data: 'trangThaiDisplay',
                        className: 'text-center',
                        render: (data, type, row) => TNLDShared.renderStatusBadge(row.trangThai, data)
                    },
                    {
                        data: 'id',
                        className: 'text-center',
                        render: function (data, type, row) {
                            const permissions = window.userPermissions || {};
                            let html = '<div class="table-actions-figma" style="justify-content: center;">';

                            // View Button
                            html += `<a href="/TaiNanLaoDong/ChiTiet/${row.id}" class="btn-action-figma btn-action-view" title="Xem chi tiết">
                                       <i class="fas fa-eye"></i>
                                     </a>`;

                            // Edit button: Route differently based on status
                            if (permissions.canUpdate) {
                                if (row.trangThai === 'Nhap') {
                                    // Draft: Edit in input form (allow full edit + submit)
                                    html += `<a href="/TaiNanLaoDong/NhapThayPA_B?id=${row.id}" class="btn-action-figma btn-action-edit" title="Sửa nháp (Chỉnh sửa và gửi)">
                                               <i class="fas fa-pen"></i>
                                             </a>`;
                                } else if (row.trangThai === 'YeuCauBoSung') {
                                    // Supplement request: Edit in supplement form
                                    html += `<a href="/TaiNanLaoDong/NhapThayBoSung/${row.id}" class="btn-action-figma btn-action-edit" title="Sửa (Cập nhật bổ sung)">
                                               <i class="fas fa-pen"></i>
                                             </a>`;
                                }
                            }

                             // Delete: Only for ChoXacNhan status
                             if (permissions.canDelete && row.trangThai === 'ChoXacNhan') {
                                 html += `<button type="button" class="btn-action-figma btn-action-delete btn-delete-row" 
                                                  data-id="${row.id}" 
                                                  data-code="${row.maKhaiBao}" 
                                                  title="Xóa">
                                             <i class="fas fa-trash-alt"></i>
                                          </button>`;
                             }

                            html += '</div>';
                            return html;
                        }
                    }
                ],
                drawCallback: function (settings) {
                    // Call standard Figma helper first
                    if (typeof FigmaDataTables !== 'undefined' && FigmaDataTables.defaultConfig) {
                        FigmaDataTables.defaultConfig.drawCallback(settings);
                    }

                    // Move pagination to frame-footer
                    const $wrapper = $(settings.nTable).closest('.dataTables_wrapper');
                    const $pagination = $wrapper.find('.pagination-figma-container');
                    if ($pagination.length && $('#paginationFrame').length) {
                        $pagination.appendTo('#paginationFrame');
                    }

                    // Refresh counts
                    self.loadChipCounts();
                }
            });
        },

        initEvents: function () {
            var self = this;

            // Search button
            $(this.selectors.btnSearch).on('click', function () { 
                self.table.ajax.reload(); 
            });

            // Enter key on search input
            $(this.selectors.searchInput).on('keypress', function (e) {
                if (e.which === 13) self.table.ajax.reload();
            });

            // Refresh button
            $(this.selectors.btnRefresh).on('click', function () {
                $(self.selectors.searchInput).val('');
                self.resetFilters();
                self.table.ajax.reload();
            });

            // Toggle advanced filter
            $(this.selectors.btnToggleAdvancedFilter).on('click', function () {
                $('#advancedFilterArea').toggleClass('show');
                $(this).toggleClass('active');
            });

            // Quick Filter Chips click
            $(this.selectors.chipContainer).on('click', this.selectors.chips, function () {
                const $chip = $(this);
                const filterGroup = $chip.data('filter');

                // Active UI
                $(self.selectors.chips).removeClass('active');
                $chip.addClass('active');

                // Reload table
                self.activeFilterGroup = filterGroup;
                self.table.ajax.reload();
            });

            // Delete action
            $(document).on('click', '.btn-delete-row', function () {
                var id = $(this).data('id');
                var code = $(this).data('code');
                TNLDShared.confirmDelete(`Khai báo ${code}`, function () {
                    self.deleteRecord(id);
                });
            });

            // Export (if applicable)
            if ($(this.selectors.btnExport).length) {
                $(this.selectors.btnExport).on('click', function () {
                    self.exportExcel();
                });
            }
        },

        resetFilters: function () {
            $('#filterForm').length && $('#filterForm')[0].reset();
            $('.select2').val('').trigger('change');
        },

        deleteRecord: async function (id) {
            try {
                const response = await fetch(`/TaiNanLaoDong/Delete/${id}`, {
                    method: 'POST',
                    headers: {
                        'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
                    }
                });
                const result = await response.json();
                if (result.success || result.isSuccess) {
                    toastr.success('Xóa khai báo thành công');
                    this.table.ajax.reload();
                } else {
                    toastr.error(result.message || 'Lỗi khi xóa khai báo');
                }
            } catch (error) {
                console.error('Delete error:', error);
                toastr.error('Lỗi hệ thống');
            }
        },

        exportExcel: function () {
            // TODO: Implement if backend supports
            toastr.info('Tính năng xuất Excel đang được phát triển');
        },

        loadChipCounts: function () {
            $.get('/TaiNanLaoDong/GetChipCounts', function (response) {
                if (response.success && response.data) {
                    const data = response.data;
                    $('#countAll').text(data.All ?? 0);
                    $('#countChoXacNhan').text(data.ChoXacNhan ?? 0);
                    $('#countDaXacNhan').text(data.DaXacNhan ?? 0);
                    $('#countDangDieuTra').text(data.DangDieuTra ?? 0);
                    $('#countYeuCauBoSung').text(data.YeuCauBoSung ?? 0);
                    $('#countDaKetThuc').text(data.DaKetThuc ?? 0);
                    $('#countRejected').text(data.Rejected ?? 0);
                }
            });
        },

        getStatusFromGroup: function (group) {
            // Map chip filter keys directly to backend status enum names
            switch (group) {
                case 'ChoXacNhan':
                case 'DaXacNhan':
                case 'DangDieuTra':
                case 'YeuCauBoSung':
                case 'DaKetThuc':
                    return group;
                case 'Rejected':
                    return 'TuChoi,DaHuy';
                default:
                    return '';
            }
        }
    };

    // ==========================================
    // AUTO-INIT
    // ==========================================
    $(document).ready(function () {
        if ($('#tnldTable').length) {
            ManagementModule.init();
        }
    });

})(jQuery);
