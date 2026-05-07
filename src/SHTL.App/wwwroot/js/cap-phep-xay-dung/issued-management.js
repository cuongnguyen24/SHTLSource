/**
 * GPXD — Danh sách "GPXD đã cấp" (M0201)
 * View: Views/CapPhepXayDung/Issued.cshtml
 * Backend endpoint: GetIssuedList — JOIN Result + Dossier, KCN enriched server-side.
 *
 * Response: { success: true, data: { items: [...], totalCount, pageNumber, pageSize } }
 *   items[i]: { resultId, hoSoId, maHoSo, loaiThuTucB(int), loaiThuTucBName,
 *               loaiThuTucBDescription, tenCongTy, kcnId, kcnName,
 *               soGpxd, ngayKy, ngayCap, ngayHetHan, nguoiKy, isRevoked, createdAt }
 */
(function ($) {
    'use strict';

    if (!window.gpxdIssuedConfig) { console.error('gpxdIssuedConfig is required'); return; }
    var Cfg = window.gpxdIssuedConfig;

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function formatDate(s) {
        if (!s) return '<span class="text-muted">—</span>';
        var d = String(s).substring(0, 10);
        var p = d.split('-');
        return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : escapeHtml(s);
    }
    function loadKcnDropdown() {
        return $.ajax({ url: Cfg.urls.getKcn, type: 'GET', dataType: 'json' }).then(function (data) {
            if (!Array.isArray(data)) return;
            var $sel = $('#gpxdIssuedFilterKcn');
            data.forEach(function (z) {
                $sel.append('<option value="' + escapeHtml(z.id) + '">' + escapeHtml(z.name || z.code) + '</option>');
            });
        }).catch(function () { /* silent */ });
    }

    var Module = {
        table: null,
        searchTimer: null,

        init: function () {
            if ($('#gpxdIssuedTable').length === 0) return;
            var self = this;
            loadKcnDropdown().always(function () { self.initDataTable(); self.bindEvents(); });
        },

        initDataTable: function () {
            var ajax = {
                url: Cfg.urls.getIssued,
                type: 'GET',
                data: function (d) {
                    return {
                        page: (d.start / d.length) + 1,
                        pageSize: d.length,
                        search: $('#gpxdIssuedSearchInput').val() || null,
                        loaiB: $('#gpxdIssuedFilterLoaiB').val() || null,
                        kcnId: $('#gpxdIssuedFilterKcn').val() || null,
                        isRevoked: $('#gpxdIssuedFilterRevoked').val() || null,
                        fromNgayKy: $('#gpxdIssuedFilterFromDate').val() || null,
                        toNgayKy: $('#gpxdIssuedFilterToDate').val() || null
                    };
                },
                dataSrc: function (resp) {
                    // Response shape: { success, data: { items, totalCount, ... } }
                    // OR ApiResponse fallthrough: { isSuccess, data: { items, totalCount } }
                    var d = resp && (resp.data || (resp.isSuccess && resp.data));
                    if (!d) return [];
                    // For DataTables — set recordsTotal/Filtered
                    this._totalCount = d.totalCount || 0;
                    return Array.isArray(d.items) ? d.items : [];
                }
            };

            var columns = [
                { data: null, className: 'text-center', orderable: false,
                  render: function (d, t, r, m) { return m.row + m.settings._iDisplayStart + 1; } },
                {
                    data: 'soGpxd',
                    render: function (d, t, r) {
                        var url = Cfg.urls.issuedDetail + '/' + r.resultId;
                        return '<a href="' + url + '" class="font-weight-bold text-primary">' + escapeHtml(d || '—') + '</a>';
                    }
                },
                {
                    data: 'maHoSo',
                    render: function (d, t, r) {
                        return '<a href="' + Cfg.urls.chiTiet + '/' + r.hoSoId + '" class="text-secondary">' + escapeHtml(d || '—') + '</a>';
                    }
                },
                {
                    data: 'loaiThuTucBName', className: 'text-center',
                    render: function (d, t, r) {
                        var code = escapeHtml(d || ('B' + (r.loaiThuTucB || '')));
                        var desc = r.loaiThuTucBDescription || '';
                        return '<span class="badge badge-info" title="' + escapeHtml(desc) + '">' + code + '</span>';
                    }
                },
                { data: 'tenCongTy', render: function (d) { return '<div class="text-wrap font-weight-medium" style="font-size:12px;">' + escapeHtml(d || '—') + '</div>'; } },
                { data: 'kcnName', render: function (d) { return escapeHtml(d || '—'); } },
                { data: 'ngayKy', className: 'text-center', render: formatDate },
                { data: 'ngayHetHan', className: 'text-center', render: formatDate },
                {
                    data: 'isRevoked', className: 'text-center',
                    render: function (d) {
                        return d
                            ? '<span class="badge badge-danger">Đã thu hồi</span>'
                            : '<span class="badge badge-success">Còn hiệu lực</span>';
                    }
                },
                {
                    data: 'resultId', className: 'text-center', orderable: false,
                    render: function (d, t, r) {
                        var html = '<a href="' + Cfg.urls.issuedDetail + '/' + d + '" class="btn-action-figma btn-action-view" title="Chi tiết"><i class="fas fa-eye"></i></a>';
                        // Nút thu hồi — chỉ hiện khi chưa thu hồi và có quyền
                        if (!r.isRevoked && Cfg.permissions && Cfg.permissions.canRevoke) {
                            html += ' <button type="button" class="btn-action-figma btn-revoke-issued" data-result-id="' + escapeHtml(d) + '" data-so-gpxd="' + escapeHtml(r.soGpxd || '') + '" title="Thu hồi GPXD" style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;"><i class="fas fa-ban"></i></button>';
                        }
                        return html;
                    }
                }
            ];

            var $tbl = $('#gpxdIssuedTable');
            var dtOptions = {
                serverSide: true,
                processing: true,
                ordering: false,
                ajax: function (data, callback) {
                    $.ajax({
                        url: Cfg.urls.getIssued,
                        type: 'GET',
                        data: {
                            page: (data.start / data.length) + 1,
                            pageSize: data.length,
                            search: $('#gpxdIssuedSearchInput').val() || null,
                            loaiB: $('#gpxdIssuedFilterLoaiB').val() || null,
                            kcnId: $('#gpxdIssuedFilterKcn').val() || null,
                            isRevoked: $('#gpxdIssuedFilterRevoked').val() || null,
                            fromNgayKy: $('#gpxdIssuedFilterFromDate').val() || null,
                            toNgayKy: $('#gpxdIssuedFilterToDate').val() || null
                        },
                        success: function (resp) {
                            var d = (resp && resp.data) || (resp && resp.isSuccess && resp.data) || null;
                            var items = (d && Array.isArray(d.items)) ? d.items : [];
                            var total = (d && d.totalCount) || 0;
                            callback({
                                draw: data.draw,
                                recordsTotal: total,
                                recordsFiltered: total,
                                data: items
                            });
                        },
                        error: function () {
                            callback({ draw: data.draw, recordsTotal: 0, recordsFiltered: 0, data: [] });
                        }
                    });
                },
                columns: columns,
                lengthMenu: [10, 20, 50, 100],
                pageLength: 20,
                language: { url: '/lib/datatables/i18n/vi.json' },
                drawCallback: function (settings) {
                    if (settings.json && settings.json.recordsTotal === 0) {
                        $tbl.find('tbody').html(
                            '<tr><td colspan="10" class="text-center py-4 text-muted">' +
                            '<i class="fas fa-inbox fa-2x mb-2 d-block" style="color:#cbd5e1;"></i>' +
                            'Chưa có GPXD nào được cấp.</td></tr>');
                    }
                }
            };

            this.table = ($.fn.dataTableFigma)
                ? $tbl.dataTableFigma(dtOptions)
                : $tbl.DataTable(dtOptions);
        },

        bindEvents: function () {
            var self = this;
            var reload = function () { self.table && self.table.ajax.reload(); };

            $('#gpxdIssuedSearchInput').on('input', function () {
                clearTimeout(self.searchTimer);
                self.searchTimer = setTimeout(reload, 400);
            });
            $('#gpxdIssuedBtnSearch').on('click', reload);
            $('#gpxdIssuedBtnRefresh').on('click', reload);
            $('#gpxdIssuedFilterLoaiB, #gpxdIssuedFilterKcn, #gpxdIssuedFilterRevoked, #gpxdIssuedFilterFromDate, #gpxdIssuedFilterToDate').on('change', reload);

            // Thu hồi nhanh từ danh sách — Swal.fire với textarea (giống IssuedDetail)
            $(document).on('click', '.btn-revoke-issued', function () {
                var $btn = $(this);
                var resultId = $btn.data('result-id');
                var soGpxd  = $btn.data('so-gpxd');
                if (!resultId) return;

                if (typeof Swal === 'undefined') {
                    var lyDo = (window.prompt('Lý do thu hồi GPXD ' + soGpxd + ' (≥5 ký tự):', '') || '').trim();
                    if (!lyDo || lyDo.length < 5) { if (window.toastr) toastr.warning('Lý do phải ≥5 ký tự.'); return; }
                    doRevokeFromList(resultId, lyDo, reload);
                    return;
                }

                var html = '<div class="text-left">'
                    + '<div class="p-3 mb-3" style="background:#fff1f2;border:1px solid #fecaca;border-radius:12px;">'
                    + '<div class="font-weight-bold" style="color:#991b1b;font-size:14px;">Thu hồi GPXD: <strong>' + escapeHtml(soGpxd) + '</strong></div>'
                    + '<div style="color:#b91c1c;font-size:13px;margin-top:4px;">Hành động này sẽ cập nhật trạng thái GPXD và hồ sơ về <strong>"Đã thu hồi"</strong>.</div>'
                    + '</div>'
                    + '<label class="font-weight-bold mb-2" style="font-size:13px;color:#374151;">Lý do thu hồi <span class="text-danger">*</span></label>'
                    + '<textarea id="gpxdListRevokeReason" class="form-control" style="height:90px;font-size:13px;padding:10px;" placeholder="Nhập lý do thu hồi..."></textarea>'
                    + '</div>';

                Swal.fire({
                    title: '<i class="fas fa-ban mr-2 text-danger"></i>Thu hồi GPXD',
                    html: html,
                    showCancelButton: true,
                    confirmButtonText: '<i class="fas fa-ban mr-1"></i> Xác nhận',
                    cancelButtonText: 'Hủy',
                    customClass: { confirmButton: 'btn btn-danger px-4', cancelButton: 'btn btn-outline-secondary px-4' },
                    buttonsStyling: false,
                    preConfirm: function () {
                        var reason = ($('#gpxdListRevokeReason').val() || '').trim();
                        if (!reason || reason.length < 5) {
                            Swal.showValidationMessage('Vui lòng nhập lý do tối thiểu 5 ký tự.');
                            return false;
                        }
                        return reason;
                    }
                }).then(function (result) {
                    if (result.isConfirmed && result.value) {
                        doRevokeFromList(resultId, result.value, reload);
                    }
                });
            });
        }
    };

    function doRevokeFromList(resultId, lyDo, callback) {
        $.ajax({
            url: (Cfg.urls.revoke || '') + '/' + resultId,
            type: 'POST',
            contentType: 'application/json; charset=utf-8',
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() || '' },
            data: JSON.stringify({ lyDo: lyDo })
        }).done(function (resp) {
            if (resp && resp.isSuccess) {
                if (window.toastr) toastr.success('Đã thu hồi GPXD.');
                if (callback) callback();
            } else {
                if (window.toastr) toastr.error((resp && resp.message) || 'Thu hồi thất bại.');
            }
        }).fail(function () {
            if (window.toastr) toastr.error('Lỗi kết nối.');
        });
    }


    $(function () { Module.init(); });
})(jQuery);
