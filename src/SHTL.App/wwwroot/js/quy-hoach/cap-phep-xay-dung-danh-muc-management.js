/**
 * GPXD Phase 1 — Danh mục Template GPXD (M0202) + Loại tài liệu đính kèm (M0204)
 * Views: Views/CapPhepXayDungDanhMuc/Index.cshtml + LoaiTaiLieu.cshtml
 *
 * Single-file shared module — auto-detect view via existence of #gpxdTplTable hoặc #gpxdAttTable.
 */
(function ($) {
    'use strict';

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function getAntiForgeryToken() { return $('input[name="__RequestVerificationToken"]').val() || ''; }
    function showError(m) { if (window.toastr) toastr.error(m); else alert(m); }
    function showSuccess(m) { if (window.toastr) toastr.success(m); else alert(m); }
    function formatDate(s) {
        if (!s) return '—';
        var d = String(s).substring(0, 10), p = d.split('-');
        return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : escapeHtml(s);
    }

    var STATUS_BADGE = {
        Nhap:       { cls: 'badge-secondary', text: 'Nháp' },
        DangApDung: { cls: 'badge-success',   text: 'Đang áp dụng' },
        DaThayThe:  { cls: 'badge-light',     text: 'Đã thay thế' }
    };
    function renderStatus(s) {
        var b = STATUS_BADGE[s] || { cls: 'badge-light', text: escapeHtml(s) };
        return '<span class="badge ' + b.cls + '" style="font-size:11px;">' + escapeHtml(b.text) + '</span>';
    }

    // ================================================================
    // TEMPLATE GPXD MODULE (M0202) — bound to #gpxdTplTable
    // ================================================================
    var TemplateModule = {
        Cfg: null,
        table: null,
        searchTimer: null,

        init: function () {
            if ($('#gpxdTplTable').length === 0 || !window.gpxdTplConfig) return;
            this.Cfg = window.gpxdTplConfig;
            this.initDataTable();
            this.bindEvents();
        },

        initDataTable: function () {
            var self = this;
            var ajax = {
                url: self.Cfg.urls.getList,
                type: 'GET',
                data: function (d) {
                    return {
                        draw: d.draw,
                        page: (d.start / d.length) + 1,
                        pageSize: d.length,
                        search: $('#gpxdTplSearchInput').val(),
                        loaiB: $('#gpxdTplFilterLoaiB').val(),
                        status: $('#gpxdTplFilterStatus').val()
                    };
                }
            };
            var columns = [
                { data: null, className: 'text-center', render: function (d, t, r, m) { return m.row + m.settings._iDisplayStart + 1; } },
                { data: 'loaiB', className: 'text-center', render: function (d) { return '<span class="badge badge-info">' + escapeHtml(d) + '</span>'; } },
                { data: 'phienBan', render: function (d) { return escapeHtml(d); } },
                { data: 'tenFile', render: function (d) { return '<div class="text-wrap font-weight-medium" style="font-size:12px;">' + escapeHtml(d) + '</div>'; } },
                { data: 'ngayApDung', render: function (d) { return formatDate(d); } },
                { data: 'trangThai', className: 'text-center', render: function (d) { return renderStatus(d); } },
                {
                    data: 'id', className: 'text-center', orderable: false,
                    render: function (d, t, r) {
                        var html = '<div class="table-actions-figma" style="justify-content:center;display:flex;gap:4px;">';
                        if (self.Cfg.permissions.canUpdate && r.trangThai === 'Nhap') {
                            html += '<button type="button" class="btn-action-figma btn-action-edit" data-action="edit" data-row=\'' + escapeHtml(JSON.stringify(r)) + '\' title="Sửa"><i class="fas fa-edit"></i></button>';
                        }
                        if (self.Cfg.permissions.canApprove && r.trangThai === 'Nhap') {
                            html += '<button type="button" class="btn-action-figma btn-action-view" data-action="activate" data-id="' + r.id + '" title="Kích hoạt"><i class="fas fa-check"></i></button>';
                        }
                        if (self.Cfg.permissions.canDelete && r.trangThai !== 'DangApDung') {
                            html += '<button type="button" class="btn-action-figma btn-action-delete" data-action="delete" data-id="' + r.id + '" title="Xoá"><i class="fas fa-trash"></i></button>';
                        }
                        html += '</div>';
                        return html;
                    }
                }
            ];
            var $tbl = $('#gpxdTplTable');
            this.table = $.fn.dataTableFigma
                ? $tbl.dataTableFigma({ serverSide: true, ordering: false, ajax: ajax, columns: columns })
                : $tbl.DataTable({ serverSide: true, processing: true, ordering: false, ajax: ajax, columns: columns, lengthMenu: [10, 20, 50, 100], pageLength: 20 });
        },

        bindEvents: function () {
            var self = this;
            var reload = function () { self.table && self.table.ajax.reload(); };

            $('#gpxdTplSearchInput').on('input', function () {
                clearTimeout(self.searchTimer);
                self.searchTimer = setTimeout(reload, 300);
            });
            $('#gpxdTplBtnSearch').on('click', reload);
            $('#gpxdTplFilterLoaiB, #gpxdTplFilterStatus').on('change', reload);

            $('#gpxdTplBtnCreate').on('click', function () { self.openModal(null); });

            $('#gpxdTplTable tbody').on('click', 'button[data-action]', function () {
                var act = $(this).data('action');
                var id = $(this).data('id');
                if (act === 'edit') {
                    var row = JSON.parse($(this).attr('data-row'));
                    self.openModal(row);
                } else if (act === 'activate') {
                    if (!confirm('Kích hoạt template này (sẽ thay thế bản đang áp dụng cùng Loại B)?')) return;
                    self.callPost(self.Cfg.urls.activate + '/' + id, null, 'Đã kích hoạt.', reload);
                } else if (act === 'delete') {
                    if (!confirm('Xác nhận xoá template?')) return;
                    self.callPost(self.Cfg.urls.delete + '/' + id, null, 'Đã xoá.', reload);
                }
            });

            $('#gpxdTplForm').on('submit', function (e) {
                e.preventDefault();
                var $f = $(this);
                var p = {}; $f.serializeArray().forEach(function (kv) { p[kv.name] = kv.value; });
                var id = p.Id; delete p.Id;
                if (p.GhiChu === '') p.GhiChu = null;
                var url = id ? (self.Cfg.urls.update + '/' + id) : self.Cfg.urls.create;
                self.callPost(url, p, id ? 'Đã cập nhật.' : 'Đã thêm template.', function () { $('#gpxdTplModal').modal('hide'); reload(); });
            });
        },

        openModal: function (row) {
            var $f = $('#gpxdTplForm')[0];
            $f.reset();
            $('input[name="Id"]', $f).val(row ? row.id : '');
            if (row) {
                $('select[name="LoaiB"]', $f).val(row.loaiB);
                $('input[name="PhienBan"]', $f).val(row.phienBan);
                $('input[name="TenFile"]', $f).val(row.tenFile);
                $('input[name="FileId"]', $f).val(row.fileId);
                $('input[name="NgayApDung"]', $f).val(String(row.ngayApDung).substring(0, 10));
                $('textarea[name="GhiChu"]', $f).val(row.ghiChu || '');
                $('select[name="LoaiB"]', $f).prop('disabled', true);
            } else {
                $('select[name="LoaiB"]', $f).prop('disabled', false);
            }
            $('#gpxdTplModalTitle').text(row ? 'Sửa template GPXD' : 'Thêm template GPXD');
            $('#gpxdTplModal').modal('show');
        },

        callPost: function (url, payload, successMsg, onDone) {
            $.ajax({
                url: url,
                type: 'POST',
                contentType: payload ? 'application/json; charset=utf-8' : undefined,
                headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                data: payload ? JSON.stringify(payload) : undefined,
                success: function (resp) {
                    if (resp && resp.isSuccess) { showSuccess(successMsg); if (onDone) onDone(); }
                    else showError((resp && resp.message) || 'Thao tác thất bại.');
                },
                error: function () { showError('Lỗi kết nối.'); }
            });
        }
    };

    // ================================================================
    // ATTACHMENT TEMPLATE MODULE (M0204) — bound to #gpxdAttTable
    // ================================================================
    var AttachmentTemplateModule = {
        Cfg: null,
        table: null,
        searchTimer: null,

        init: function () {
            if ($('#gpxdAttTable').length === 0 || !window.gpxdAttConfig) return;
            this.Cfg = window.gpxdAttConfig;
            this.initDataTable();
            this.bindEvents();
        },

        initDataTable: function () {
            var self = this;
            var ajax = {
                url: self.Cfg.urls.getList, type: 'GET',
                data: function (d) {
                    return {
                        draw: d.draw,
                        page: (d.start / d.length) + 1,
                        pageSize: d.length,
                        search: $('#gpxdAttSearchInput').val(),
                        loaiNghiepVu: $('#gpxdAttFilterLoaiNV').val(),
                        status: $('#gpxdAttFilterStatus').val()
                    };
                }
            };
            var columns = [
                { data: null, className: 'text-center', render: function (d, t, r, m) { return m.row + m.settings._iDisplayStart + 1; } },
                { data: 'loaiNghiepVu', className: 'text-center', render: function (d) { return '<span class="badge badge-info">' + escapeHtml(d) + '</span>'; } },
                { data: 'maLoaiTaiLieu', render: function (d) { return '<code>' + escapeHtml(d) + '</code>'; } },
                { data: 'tenLoaiTaiLieu', render: function (d) { return '<div class="text-wrap font-weight-medium" style="font-size:12px;">' + escapeHtml(d) + '</div>'; } },
                { data: 'batBuoc', className: 'text-center', render: function (d) { return d ? '<span class="badge badge-danger">Bắt buộc</span>' : '<span class="badge badge-light">Tuỳ chọn</span>'; } },
                { data: 'thuTu', className: 'text-center' },
                { data: 'phienBan', className: 'text-center', render: function (d) { return '<strong>v' + escapeHtml(d) + '</strong>'; } },
                { data: 'trangThai', className: 'text-center', render: function (d) { return renderStatus(d); } },
                {
                    data: 'id', className: 'text-center', orderable: false,
                    render: function (d, t, r) {
                        var html = '<div class="table-actions-figma" style="justify-content:center;display:flex;gap:4px;">';
                        if (self.Cfg.permissions.canUpdate && r.trangThai === 'Nhap') {
                            html += '<button type="button" class="btn-action-figma btn-action-edit" data-action="edit" data-row=\'' + escapeHtml(JSON.stringify(r)) + '\' title="Sửa"><i class="fas fa-edit"></i></button>';
                        }
                        if (self.Cfg.permissions.canApprove && r.trangThai === 'Nhap') {
                            html += '<button type="button" class="btn-action-figma btn-action-view" data-action="activate" data-id="' + r.id + '" title="Kích hoạt"><i class="fas fa-check"></i></button>';
                        }
                        if (self.Cfg.permissions.canDelete && r.trangThai !== 'DangApDung') {
                            html += '<button type="button" class="btn-action-figma btn-action-delete" data-action="delete" data-id="' + r.id + '" title="Xoá"><i class="fas fa-trash"></i></button>';
                        }
                        html += '</div>';
                        return html;
                    }
                }
            ];
            var $tbl = $('#gpxdAttTable');
            this.table = $.fn.dataTableFigma
                ? $tbl.dataTableFigma({ serverSide: true, ordering: false, ajax: ajax, columns: columns })
                : $tbl.DataTable({ serverSide: true, processing: true, ordering: false, ajax: ajax, columns: columns, lengthMenu: [10, 20, 50, 100], pageLength: 20 });
        },

        bindEvents: function () {
            var self = this;
            var reload = function () { self.table && self.table.ajax.reload(); };

            $('#gpxdAttSearchInput').on('input', function () {
                clearTimeout(self.searchTimer);
                self.searchTimer = setTimeout(reload, 300);
            });
            $('#gpxdAttBtnSearch').on('click', reload);
            $('#gpxdAttFilterLoaiNV, #gpxdAttFilterStatus').on('change', reload);

            $('#gpxdAttBtnCreate').on('click', function () { self.openModal(null); });

            $('#gpxdAttTable tbody').on('click', 'button[data-action]', function () {
                var act = $(this).data('action');
                var id = $(this).data('id');
                if (act === 'edit') {
                    self.openModal(JSON.parse($(this).attr('data-row')));
                } else if (act === 'activate') {
                    if (!confirm('Kích hoạt loại tài liệu này (sẽ thay thế bản đang áp dụng cùng Loại NV + Mã loại)?')) return;
                    self.callPost(self.Cfg.urls.activate + '/' + id, null, 'Đã kích hoạt.', reload);
                } else if (act === 'delete') {
                    if (!confirm('Xác nhận xoá loại tài liệu?')) return;
                    self.callPost(self.Cfg.urls.delete + '/' + id, null, 'Đã xoá.', reload);
                }
            });

            $('#gpxdAttForm').on('submit', function (e) {
                e.preventDefault();
                var $f = $(this);
                var p = {}; $f.serializeArray().forEach(function (kv) { p[kv.name] = kv.value; });
                var id = p.Id; delete p.Id;

                p.BatBuoc = (p.BatBuoc === 'true' || p.BatBuoc === true);
                p.ThuTu = p.ThuTu === '' || p.ThuTu === undefined ? 0 : Number(p.ThuTu);
                ['MoTa', 'FileName', 'ContentType'].forEach(function (k) { if (p[k] === '') p[k] = null; });
                if (!p.FileId) p.FileId = null;
                if (p.FileSize === '' || p.FileSize === undefined) p.FileSize = null; else p.FileSize = Number(p.FileSize);

                var url = id ? (self.Cfg.urls.update + '/' + id) : self.Cfg.urls.create;
                self.callPost(url, p, id ? 'Đã cập nhật.' : 'Đã thêm.', function () { $('#gpxdAttModal').modal('hide'); reload(); });
            });
        },

        openModal: function (row) {
            var $f = $('#gpxdAttForm')[0];
            $f.reset();
            $('input[name="Id"]', $f).val(row ? row.id : '');
            if (row) {
                $('select[name="LoaiNghiepVu"]', $f).val(row.loaiNghiepVu).prop('disabled', true);
                $('input[name="MaLoaiTaiLieu"]', $f).val(row.maLoaiTaiLieu).prop('readonly', true);
                $('input[name="TenLoaiTaiLieu"]', $f).val(row.tenLoaiTaiLieu);
                $('input[name="NgayApDung"]', $f).val(String(row.ngayApDung).substring(0, 10));
                $('select[name="BatBuoc"]', $f).val(row.batBuoc ? 'true' : 'false');
                $('input[name="ThuTu"]', $f).val(row.thuTu);
                $('input[name="FileId"]', $f).val(row.fileId || '');
                $('textarea[name="MoTa"]', $f).val(row.moTa || '');
            } else {
                $('select[name="LoaiNghiepVu"]', $f).prop('disabled', false);
                $('input[name="MaLoaiTaiLieu"]', $f).prop('readonly', false);
            }
            $('#gpxdAttModalTitle').text(row ? 'Sửa loại tài liệu' : 'Thêm loại tài liệu');
            $('#gpxdAttModal').modal('show');
        },

        callPost: function (url, payload, successMsg, onDone) {
            $.ajax({
                url: url,
                type: 'POST',
                contentType: payload ? 'application/json; charset=utf-8' : undefined,
                headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                data: payload ? JSON.stringify(payload) : undefined,
                success: function (resp) {
                    if (resp && resp.isSuccess) { showSuccess(successMsg); if (onDone) onDone(); }
                    else showError((resp && resp.message) || 'Thao tác thất bại.');
                },
                error: function () { showError('Lỗi kết nối.'); }
            });
        }
    };

    $(function () {
        TemplateModule.init();
        AttachmentTemplateModule.init();
    });
})(jQuery);
