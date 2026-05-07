/**
 * Cấu hình kỳ khai báo — Management Module
 * M0077 — IIFE pattern with DataTables server-side + CRUD + Open/Close/SetCurrent
 */
(function ($) {
    'use strict';

    var CauHinhKyModule = {
        $dataTable: null,

        init: function () {
            this.initDataTable();
            this.initFilters();
        },

        initDataTable: function () {
            var $table = $('#periodsTable');
            if ($table.length === 0) return;

            var self = this;
            var token = $('input[name="__RequestVerificationToken"]').val();

            this.$dataTable = $table.DataTable({
                processing: true,
                serverSide: true,
                searching: false,
                ajax: {
                    url: '/CauHinhKyTDLD/GetAll',
                    type: 'GET',
                    data: function (d) {
                        d.page = Math.floor(d.start / d.length) + 1;
                        d.pageSize = d.length;
                        d.year = $('#filterYear').val() || null;
                        d.isOpen = $('#filterStatus').val() || null;
                    },
                    dataSrc: function (json) {
                        if (!json || json.success === false) return [];
                        return json.data || [];
                    },
                    error: function () {
                        toastr.error('Lỗi khi tải danh sách kỳ khai báo');
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
                        data: 'year',
                        className: 'text-center',
                        render: function (data) {
                            return '<span class="font-weight-bold">' + (data || '—') + '</span>';
                        }
                    },
                    {
                        data: 'name',
                        render: function (data, type, row) {
                            return '<span class="font-weight-medium" style="color:#1e293b;">' + (data || '—') + '</span>';
                        }
                    },
                    {
                        data: 'startDate',
                        render: function (data) {
                            return data ? new Date(data).toLocaleDateString('vi-VN') : '—';
                        }
                    },
                    {
                        data: 'endDate',
                        render: function (data) {
                            return data ? new Date(data).toLocaleDateString('vi-VN') : '—';
                        }
                    },
                    {
                        data: 'deadline',
                        render: function (data) {
                            if (!data) return '—';
                            var d = new Date(data);
                            var isOverdue = d < new Date();
                            var formatted = d.toLocaleDateString('vi-VN');
                            return isOverdue
                                ? '<span class="text-danger font-weight-bold">' + formatted + '</span>'
                                : formatted;
                        }
                    },
                    {
                        data: 'isOpen',
                        className: 'text-center',
                        render: function (data) {
                            return data
                                ? '<span class="badge-figma badge-figma-success"><i class="fas fa-check-circle"></i> Đang hoạt động</span>'
                                : '<span class="badge-figma badge-figma-secondary"><i class="fas fa-ban"></i> Ngừng hoạt động</span>';
                        }
                    },
                    {
                        data: null,
                        orderable: false,
                        className: 'text-center',
                        render: function (data, type, row) {
                            var btns = '<div class="table-actions-figma" style="justify-content:center;">';
                            var perms = window.userPermissions || {};

                            if (perms.canUpdate) {
                                if (row.isOpen) {
                                    btns += '<button class="btn-action-figma btn-action-edit btn-close-period" data-id="' + row.id + '" title="Đóng kỳ"><i class="fas fa-lock"></i></button>';
                                } else {
                                    btns += '<button class="btn-action-figma btn-action-edit btn-open-period" data-id="' + row.id + '" title="Mở lại kỳ"><i class="fas fa-lock-open"></i></button>';
                                }
                                btns += '<a href="/CauHinhKyTDLD/Edit/' + row.id + '" class="btn-action-figma btn-action-edit" title="Chỉnh sửa"><i class="fas fa-pencil-alt"></i></a>';
                            }

                            if (perms.canDelete) {
                                btns += '<button class="btn-action-figma btn-action-delete btn-delete" data-id="' + row.id + '" title="Xóa kỳ"><i class="fas fa-trash"></i></button>';
                            }

                            btns += '</div>';
                            return btns;
                        }
                    }
                ],
                order: [[1, 'desc']],
                pageLength: 20,
                dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
                language: {
                    processing: '<div class="text-center py-3"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải...</div>',
                    emptyTable: '<div class="text-center py-4 text-muted"><i class="fas fa-calendar-times fa-2x mb-2 d-block"></i>Không có dữ liệu kỳ khai báo</div>',
                    info: 'Hiển thị _START_ đến _END_ / _TOTAL_ kết quả',
                    lengthMenu: 'Hiển thị _MENU_ dòng',
                    paginate: { first: 'Đầu', last: 'Cuối', next: '»', previous: '«' }
                },
                drawCallback: function (settings) {
                    var $container = $('.pagination-figma-container');
                    if ($container.length && $('#paginationFrame').length) {
                        $container.appendTo('#paginationFrame');
                    }
                    var total = settings._iRecordsDisplay || 0;
                    if (total === 0) $('#paginationFrame').hide();
                    else $('#paginationFrame').show();
                }
            });

            // Action handlers
            $table.on('click', '.btn-open-period', function () {
                var id = $(this).data('id');
                self.handleAction(id, '/CauHinhKyTDLD/Open/' + id, 'Mở kỳ thành công');
            });
            $table.on('click', '.btn-close-period', function () {
                var id = $(this).data('id');
                if (!confirm('Đóng kỳ khai báo này?')) return;
                self.handleAction(id, '/CauHinhKyTDLD/Close/' + id, 'Đóng kỳ thành công');
            });
            $table.on('click', '.btn-delete', function () {
                var id = $(this).data('id');
                self.handleDeletePeriod(id);
            });
        },

        initFilters: function () {
            var self = this;
            $('#btnSearch').on('click', function () {
                if (self.$dataTable) self.$dataTable.ajax.reload();
            });
            $('#filterYear').on('keyup', function (e) {
                if (e.key === 'Enter' && self.$dataTable) self.$dataTable.ajax.reload();
            });
            $('#filterStatus').on('change', function () {
                if (self.$dataTable) self.$dataTable.ajax.reload();
            });
        },

        handleDeletePeriod: function (id) {
            if (!confirm('Bạn có chắc muốn xóa kỳ khai báo này?')) return;
            this.handleAction(id, '/CauHinhKyTDLD/Delete/' + id, 'Xóa kỳ thành công');
        },

        handleAction: function (id, url, successMessage) {
            var token = $('input[name="__RequestVerificationToken"]').val();
            var self = this;

            $.ajax({
                url: url,
                type: 'POST',
                headers: { 'RequestVerificationToken': token },
                success: function (res) {
                    if (res.success) {
                        toastr.success(successMessage);
                        if (self.$dataTable) self.$dataTable.ajax.reload();
                    } else {
                        toastr.error(res.message || 'Lỗi thao tác');
                    }
                },
                error: function () {
                    toastr.error('Lỗi hệ thống');
                }
            });
        }
    };

    $(document).ready(function () {
        CauHinhKyModule.init();
    });
})(jQuery);
