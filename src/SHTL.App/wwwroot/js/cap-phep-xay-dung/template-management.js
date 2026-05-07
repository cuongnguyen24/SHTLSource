/**
 * GPXD Template Management (M0202)
 * Mirror Labor template-management.js — multipart upload via FileManager.
 */
(function (window, $) {
    'use strict';
    if (!window.gpxdTplConfig) {
        console.error('gpxdTplConfig not configured');
        return;
    }
    const cfg = window.gpxdTplConfig;
    const URLS = cfg.urls;
    const PERM = cfg.permissions || {};

    const LOAI_B_LABELS = {
        1: 'B1 – Cấp mới (CT ĐB/I/II)',
        2: 'B2 – Cấp mới (CT III/IV/Nhà ở)',
        3: 'B3 – Sửa chữa (CT ĐB/I/II)',
        4: 'B4 – Sửa chữa (CT III/IV)',
        5: 'B5 – Điều chỉnh (CT III/IV/Nhà ở)',
        6: 'B6 – Điều chỉnh (CT ĐB/I/II)',
        7: 'B7 – Gia hạn (CT ĐB/I/II)',
        8: 'B8 – Gia hạn (CT III/IV/Nhà ở)',
        'B1': 'B1 – Cấp mới (CT ĐB/I/II)',
        'B2': 'B2 – Cấp mới (CT III/IV/Nhà ở)',
        'B3': 'B3 – Sửa chữa (CT ĐB/I/II)',
        'B4': 'B4 – Sửa chữa (CT III/IV)',
        'B5': 'B5 – Điều chỉnh (CT III/IV/Nhà ở)',
        'B6': 'B6 – Điều chỉnh (CT ĐB/I/II)',
        'B7': 'B7 – Gia hạn (CT ĐB/I/II)',
        'B8': 'B8 – Gia hạn (CT III/IV/Nhà ở)'
    };
    const STATUS_MAP = {
        1: { code: 'Nhap', label: 'Nháp', cls: 'status-pill-secondary' },
        2: { code: 'DangApDung', label: 'Đang áp dụng', cls: 'status-pill-success' },
        3: { code: 'DaThayThe', label: 'Đã thay thế', cls: 'status-pill-secondary' },
        'Nhap': { code: 'Nhap', label: 'Nháp', cls: 'status-pill-secondary' },
        'DangApDung': { code: 'DangApDung', label: 'Đang áp dụng', cls: 'status-pill-success' },
        'DaThayThe': { code: 'DaThayThe', label: 'Đã thay thế', cls: 'status-pill-secondary' }
    };

    let table;

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return s.toString().replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }
    function token() { return $('input[name="__RequestVerificationToken"]').val(); }
    function fmtDate(d) {
        if (!d) return '';
        const s = d.toString();
        if (s.length >= 10) {
            const p = s.substr(0, 10).split('-');
            return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s;
        }
        return s;
    }

    $(document).ready(function () {
        initTable();
        bindEvents();
    });

    function initTable() {
        table = $('#gpxdTplTable').DataTable({
            serverSide: true,
            processing: true,
            searching: false,
            lengthChange: true,
            pageLength: 25,
            lengthMenu: [10, 25, 50, 100],
            language: { url: '//cdn.datatables.net/plug-ins/2.0.0/i18n/vi.json' },
            dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
            drawCallback: function () {
                const $c = $('.pagination-figma-container');
                if ($c.length && $('#gpxdTplPagination').length) {
                    $c.appendTo('#gpxdTplPagination');
                }
            },
            ajax: function (data, callback) {
                $.get(URLS.getList, {
                    draw: data.draw,
                    page: Math.floor(data.start / data.length) + 1,
                    pageSize: data.length,
                    search: $('#gpxdTplSearchInput').val() || null,
                    loaiB: $('#gpxdTplFilterLoaiB').val() || null,
                    status: $('#gpxdTplFilterStatus').val() || null
                }).done(callback)
                  .fail(function () { toastr.error('Không thể tải danh sách mẫu biểu.'); });
            },
            columns: [
                { data: null, orderable: false, className: 'text-center',
                  render: function (d, t, r, m) { return m.row + 1 + m.settings._iDisplayStart; } },
                { data: 'loaiB', className: 'text-center',
                  render: function (v) {
                      const lbl = LOAI_B_LABELS[v] || v || '';
                      return '<span class="badge-loaib" title="' + escapeHtml(lbl) + '" style="white-space:normal; font-size:11px; line-height:1.3;">' + escapeHtml(lbl) + '</span>';
                  } },
                { data: 'phienBan', className: 'text-center', render: escapeHtml },
                { data: 'tenFile', render: function (v) { return '<span title="' + escapeHtml(v) + '">' + escapeHtml(v) + '</span>'; } },
                { data: 'ngayApDung', render: fmtDate },
                { data: 'trangThai', className: 'text-center', render: function (v) {
                    const s = STATUS_MAP[v] || { label: v, cls: 'status-pill-secondary' };
                    return '<span class="status-pill ' + s.cls + '"><i class="fas fa-circle"></i> ' + escapeHtml(s.label) + '</span>';
                } },
                { data: null, orderable: false, className: 'text-center',
                  render: function (r) {
                      const id = r.id || r.Id;
                      const fileId = r.fileId || r.FileId;
                      const status = STATUS_MAP[r.trangThai] || {};
                      let html = '<div class="d-inline-flex" style="gap:4px;">';
                      if (fileId) {
                          html += '<button class="btn-table-outline btn-tpl-download" data-fileid="' + escapeHtml(fileId) + '" title="Tải file"><i class="fas fa-download"></i></button>';
                      }
                      if (PERM.canUpdate && status.code === 'Nhap') {
                          html += '<button class="btn-table-outline btn-tpl-edit" data-row=\'' + JSON.stringify(r).replace(/'/g, '&#39;') + '\' title="Sửa metadata"><i class="fas fa-edit"></i></button>';
                          html += '<button class="btn-table-outline btn-tpl-replace" data-row=\'' + JSON.stringify(r).replace(/'/g, '&#39;') + '\' title="Thay file"><i class="fas fa-exchange-alt"></i></button>';
                      }
                      if (PERM.canApprove && status.code === 'Nhap') {
                          html += '<button class="btn-table-outline btn-tpl-activate" data-id="' + id + '" title="Áp dụng" style="color:#15803d;"><i class="fas fa-check"></i></button>';
                      }
                      if (PERM.canApprove && status.code === 'DangApDung') {
                          html += '<button class="btn-table-outline btn-tpl-deactivate" data-id="' + id + '" title="Bỏ kích hoạt" style="color:#b45309;"><i class="fas fa-undo"></i></button>';
                      }
                      if (PERM.canDelete && status.code === 'Nhap') {
                          html += '<button class="btn-table-outline btn-tpl-delete" data-id="' + id + '" title="Xóa" style="color:#dc2626;"><i class="fas fa-trash"></i></button>';
                      }
                      html += '</div>';
                      return html;
                  } }
            ],
            order: []
        });
    }

    function bindEvents() {
        $('#gpxdTplBtnSearch').on('click', function () { table.ajax.reload(); });
        $('#gpxdTplSearchInput').on('keypress', function (e) { if (e.which === 13) table.ajax.reload(); });
        $('#gpxdTplFilterLoaiB, #gpxdTplFilterStatus').on('change', function () { table.ajax.reload(); });

        $('#gpxdTplBtnUpload').on('click', function () {
            $('#gpxdTplUploadForm')[0].reset();
            $('#gpxdTplUploadFileQueue').empty();
            $('#gpxdTplUploadModal').modal('show');
        });

        $('#gpxdTplUploadFile').on('change', function () { showFileQueue(this, '#gpxdTplUploadFileQueue'); });
        $('#gpxdTplReplaceFile').on('change', function () { showFileQueue(this, '#gpxdTplReplaceFileQueue'); });

        $('#gpxdTplBtnSubmitUpload').on('click', submitUpload);
        $('#gpxdTplBtnSubmitEdit').on('click', submitEdit);
        $('#gpxdTplBtnSubmitReplace').on('click', submitReplace);

        $(document).on('click', '.btn-tpl-download', function () {
            const fid = $(this).data('fileid'); if (fid) window.location = URLS.download + fid;
        });
        $(document).on('click', '.btn-tpl-edit', function () {
            const row = JSON.parse($(this).attr('data-row').replace(/&#39;/g, "'"));
            openEdit(row);
        });
        $(document).on('click', '.btn-tpl-replace', function () {
            const row = JSON.parse($(this).attr('data-row').replace(/&#39;/g, "'"));
            openReplace(row);
        });
        $(document).on('click', '.btn-tpl-activate', function () { activate($(this).data('id')); });
        $(document).on('click', '.btn-tpl-deactivate', function () { deactivate($(this).data('id')); });
        $(document).on('click', '.btn-tpl-delete', function () { confirmDelete($(this).data('id')); });
    }

    function showFileQueue(input, target) {
        const $t = $(target).empty();
        if (input.files && input.files.length) {
            const f = input.files[0];
            const sizeKB = (f.size / 1024).toFixed(1);
            $t.html('<div class="alert alert-light p-2 mb-0" style="font-size:12px; border:1px solid #e2e8f0;">'
                + '<i class="fas fa-file mr-2 text-primary"></i><strong>' + escapeHtml(f.name) + '</strong> '
                + '<span class="text-muted">(' + sizeKB + ' KB)</span></div>');
        }
    }

    function submitUpload() {
        const $form = $('#gpxdTplUploadForm');
        const formEl = $form[0];
        if (formEl && !formEl.checkValidity()) { formEl.reportValidity(); return; }
        const file = document.getElementById('gpxdTplUploadFile').files[0];
        if (!file) { toastr.warning('Vui lòng chọn file mẫu.'); return; }

        const fd = new FormData();
        fd.append('loaiB', $form.find('[name="loaiB"]').val());
        fd.append('phienBan', $form.find('[name="phienBan"]').val());
        fd.append('ngayApDung', $form.find('[name="ngayApDung"]').val());
        fd.append('ghiChu', $form.find('[name="ghiChu"]').val() || '');
        fd.append('file', file);

        ajaxFormData(URLS.upload, fd, '#gpxdTplBtnSubmitUpload', function () {
            toastr.success('Đăng ký mẫu biểu thành công.');
            $('#gpxdTplUploadModal').modal('hide');
            table.ajax.reload(null, false);
        });
    }

    function openEdit(row) {
        const $f = $('#gpxdTplEditForm');
        $f.find('[name="Id"]').val(row.id || row.Id);
        $f.find('[name="FileId"]').val(row.fileId || row.FileId);
        $f.find('[name="TenFile"]').val(row.tenFile || row.TenFile);
        $f.find('[name="PhienBan"]').val(row.phienBan || row.PhienBan);
        $f.find('[name="NgayApDung"]').val((row.ngayApDung || row.NgayApDung || '').toString().substr(0, 10));
        $f.find('[name="GhiChu"]').val(row.ghiChu || row.GhiChu || '');
        $('#gpxdTplEditModal').modal('show');
    }

    function submitEdit() {
        const $f = $('#gpxdTplEditForm');
        const formEl = $f[0];
        if (formEl && !formEl.checkValidity()) { formEl.reportValidity(); return; }
        const id = $f.find('[name="Id"]').val();
        const payload = {
            phienBan: $f.find('[name="PhienBan"]').val(),
            tenFile: $f.find('[name="TenFile"]').val(),
            fileId: $f.find('[name="FileId"]').val(),
            ngayApDung: $f.find('[name="NgayApDung"]').val(),
            ghiChu: $f.find('[name="GhiChu"]').val() || null
        };
        ajaxJson(URLS.update + '/' + id, 'POST', payload, '#gpxdTplBtnSubmitEdit', function () {
            toastr.success('Cập nhật metadata thành công.');
            $('#gpxdTplEditModal').modal('hide');
            table.ajax.reload(null, false);
        });
    }

    function openReplace(row) {
        const $f = $('#gpxdTplReplaceForm');
        $f[0].reset();
        $f.find('[name="id"]').val(row.id || row.Id);
        $f.find('[name="phienBan"]').val(row.phienBan || row.PhienBan);
        $f.find('[name="ngayApDung"]').val((row.ngayApDung || row.NgayApDung || '').toString().substr(0, 10));
        $f.find('[name="ghiChu"]').val(row.ghiChu || row.GhiChu || '');
        $('#gpxdTplReplaceFileQueue').empty();
        $('#gpxdTplReplaceModal').modal('show');
    }

    function submitReplace() {
        const $form = $('#gpxdTplReplaceForm');
        const formEl = $form[0];
        if (formEl && !formEl.checkValidity()) { formEl.reportValidity(); return; }
        const file = document.getElementById('gpxdTplReplaceFile').files[0];
        if (!file) { toastr.warning('Vui lòng chọn file mẫu mới.'); return; }
        const fd = new FormData();
        fd.append('id', $form.find('[name="id"]').val());
        fd.append('phienBan', $form.find('[name="phienBan"]').val());
        fd.append('ngayApDung', $form.find('[name="ngayApDung"]').val());
        fd.append('ghiChu', $form.find('[name="ghiChu"]').val() || '');
        fd.append('file', file);

        ajaxFormData(URLS.replace, fd, '#gpxdTplBtnSubmitReplace', function () {
            toastr.success('Thay file thành công.');
            $('#gpxdTplReplaceModal').modal('hide');
            table.ajax.reload(null, false);
        });
    }

    function activate(id) {
        ajaxJson(URLS.activate + '/' + id, 'POST', null, null, function () {
            toastr.success('Đã áp dụng.');
            table.ajax.reload(null, false);
        });
    }

    function deactivate(id) {
        ajaxJson(URLS.deactivate + '/' + id, 'POST', null, null, function () {
            toastr.success('Đã bỏ kích hoạt.');
            table.ajax.reload(null, false);
        });
    }

    function confirmDelete(id) {
        if (!confirm('Xóa mẫu biểu này? Hành động không thể hoàn tác.')) return;
        ajaxJson(URLS.delete + '/' + id, 'POST', null, null, function () {
            toastr.success('Đã xóa.');
            table.ajax.reload(null, false);
        });
    }

    function ajaxFormData(url, fd, btnSel, onOk) {
        const $btn = btnSel ? $(btnSel) : null;
        const orig = $btn ? $btn.html() : null;
        if ($btn) $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');

        $.ajax({
            url: url, type: 'POST', data: fd, processData: false, contentType: false,
            headers: { 'RequestVerificationToken': token() },
            success: function (resp) {
                if (resp && (resp.isSuccess || resp.success)) onOk(resp);
                else toastr.error((resp && resp.message) || 'Có lỗi xảy ra.');
            },
            error: function (xhr) {
                toastr.error((xhr.responseJSON && xhr.responseJSON.message) || 'Lỗi kết nối máy chủ.');
            },
            complete: function () { if ($btn) $btn.prop('disabled', false).html(orig); }
        });
    }
    function ajaxJson(url, method, payload, btnSel, onOk) {
        const $btn = btnSel ? $(btnSel) : null;
        const orig = $btn ? $btn.html() : null;
        if ($btn) $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');

        $.ajax({
            url: url, type: method,
            contentType: 'application/json',
            data: payload ? JSON.stringify(payload) : undefined,
            headers: { 'RequestVerificationToken': token() },
            success: function (resp) {
                if (resp && (resp.isSuccess || resp.success)) onOk(resp);
                else toastr.error((resp && resp.message) || 'Có lỗi xảy ra.');
            },
            error: function (xhr) {
                toastr.error((xhr.responseJSON && xhr.responseJSON.message) || 'Lỗi kết nối máy chủ.');
            },
            complete: function () { if ($btn) $btn.prop('disabled', false).html(orig); }
        });
    }

    window.GpxdTplManager = {
        reload: function () { if (table) table.ajax.reload(null, false); }
    };
})(window, jQuery);
