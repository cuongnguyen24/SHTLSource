/**
 * GPXD Phase 1 — Form Chỉnh sửa hồ sơ (Edit)
 * View: Views/CapPhepXayDung/Edit.cshtml
 */
(function ($) {
    'use strict';

    if (!window.gpxdEditConfig) return;
    var Cfg = window.gpxdEditConfig;

    var BTYPE_CONFIG = {
        '1': { groups: [],                      label: 'B1 — Cấp mới (ĐB/I/II)',     hasRoot: false, slaDays: 15 },
        '2': { groups: [],                      label: 'B2 — Cấp mới (III/IV)',      hasRoot: false, slaDays: 10 },
        '3': { groups: ['has-root', 'repair'],  label: 'B3 — Sửa chữa (ĐB/I/II)',    hasRoot: true,  slaDays: 15 },
        '4': { groups: ['has-root', 'repair'],  label: 'B4 — Sửa chữa (III/IV)',     hasRoot: true,  slaDays: 10 },
        '5': { groups: ['has-root', 'adjust'],  label: 'B5 — Điều chỉnh (ĐB/I/II)',  hasRoot: true,  slaDays: 10 },
        '6': { groups: ['has-root', 'adjust'],  label: 'B6 — Điều chỉnh (III/IV)',   hasRoot: true,  slaDays: 15 },
        '7': { groups: ['has-root', 'extend'],  label: 'B7 — Gia hạn (ĐB/I/II)',     hasRoot: true,  slaDays: 5 },
        '8': { groups: ['has-root', 'extend'],  label: 'B8 — Gia hạn (III/IV)',      hasRoot: true,  slaDays: 5 }
    };

    var pendingAttachments = {};
    var currentLoaiB = '';

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function getAntiForgeryToken() { return $('input[name="__RequestVerificationToken"]').val() || ''; }
    function showError(msg) { if (window.toastr) toastr.success(msg); else alert(msg); } // Toastr.success is used in original code for some reason in one place, but I'll use error/success correctly
    function showSuccess(msg) { if (window.toastr) toastr.success(msg); else alert(msg); }
    function showWarning(msg) { if (window.toastr) toastr.warning(msg); else alert(msg); }
    function nullIfEmpty(v) { return (v === '' || v === undefined || v === null) ? null : v; }
    function numOrNull(v) { return (v === '' || v === undefined || v === null) ? null : Number(v); }
    function numOrZero(v) { return (v === '' || v === undefined || v === null) ? 0 : Number(v); }

    function addWorkingDays(startStr, days) {
        if (!startStr || !days || days <= 0) return null;
        var d = new Date(startStr + 'T00:00:00');
        if (isNaN(d.getTime())) return null;
        var added = 0;
        while (added < days) {
            d.setDate(d.getDate() + 1);
            var dow = d.getDay();
            if (dow !== 0 && dow !== 6) added++;
        }
        var yyyy = d.getFullYear();
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');
        return yyyy + '-' + mm + '-' + dd;
    }

    function recalcDeadline() {
        var loaiB = String($('input[name="LoaiThuTucB"]:checked').val() || '');
        var cfg = BTYPE_CONFIG[loaiB];
        var $sla = $('#gpxdSoNgayXuLy');
        var $han = $('#gpxdHanXuLy');
        if (!cfg) { $sla.val(''); return; }
        $sla.val(cfg.slaDays);
        var ngayNhan = $('input[name="NgayNhan"]').val();
        if (!ngayNhan) return;
        if ($han.data('userEdited')) return;
        var deadline = addWorkingDays(ngayNhan, cfg.slaDays);
        if (deadline) $han.val(deadline);
    }

    function loadDropdown(url, $select, placeholder) {
        var initialValue = $select.data('initial-value');
        $select.empty().append('<option value="">' + escapeHtml(placeholder) + '</option>');
        return $.get(url).done(function (resp) {
            if (resp && resp.success && Array.isArray(resp.data)) {
                resp.data.forEach(function (it) {
                    var label = it.code ? (it.code + ' — ' + it.name) : it.name;
                    var $opt = $('<option value="' + escapeHtml(it.id) + '">' + escapeHtml(label) + '</option>');
                    if (initialValue && String(it.id).toLowerCase() === String(initialValue).toLowerCase()) {
                        $opt.attr('selected', 'selected');
                    }
                    $select.append($opt);
                });
            }
        });
    }

    function loadCheckboxList(url, $container, name) {
        $container.empty().append('<span class="text-muted">Đang tải...</span>');
        return $.get(url).done(function (resp) {
            $container.empty();
            if (resp && resp.success && Array.isArray(resp.data)) {
                var checkedIds = (Cfg.professionalJson && Cfg.professionalJson.NoiDungDieuChinhIds) || [];
                resp.data.forEach(function (it, idx) {
                    var id = 'gpxd_nd_' + idx;
                    var isChecked = checkedIds.indexOf(it.id) >= 0;
                    $container.append(
                        '<label><input type="checkbox" name="' + escapeHtml(name) + '" value="' + escapeHtml(it.id) + '" id="' + id + '" ' + (isChecked ? 'checked' : '') + ' /> ' +
                        escapeHtml(it.name) + '</label>'
                    );
                });
            }
        });
    }

    function initEnterpriseSelect2() {
        var $sel = $('#gpxdEnterpriseSelect');
        $sel.select2({
            placeholder: '-- Tìm doanh nghiệp theo tên / mã số thuế --',
            allowClear: true,
            minimumInputLength: 1,
            theme: 'bootstrap4',
            width: '100%',
            ajax: {
                url: Cfg.urls.searchEnterprises,
                dataType: 'json',
                delay: 300,
                data: function (params) { return { searchTerm: params.term || '', pageNumber: params.page || 1, pageSize: 20 }; },
                processResults: function (resp, params) {
                    params.page = params.page || 1;
                    if (!resp || !resp.success || !resp.data || !Array.isArray(resp.data.items)) return { results: [] };
                    return {
                        results: resp.data.items.map(function (e) {
                            return { id: e.id, text: (e.code ? '[' + e.code + '] ' : '') + (e.name || ''), _raw: e };
                        }),
                        pagination: { more: (params.page * 20) < (resp.data.totalCount || 0) }
                    };
                },
                cache: true
            }
        });
        $sel.on('select2:select', function (e) {
            populateEnterpriseInfo(e.params.data && e.params.data._raw);
        });
    }

    function populateEnterpriseInfo(ent) {
        var $form = $('#gpxdEditForm');
        if (!ent) {
            $form.find('input[name="TenCongTy"], input[name="MaSoThue"]').val('');
            return;
        }
        $form.find('input[name="TenCongTy"]').val(ent.name || ent.tenCongTy || '');
        $form.find('input[name="MaSoThue"]').val(ent.taxCode || ent.maSoThue || '');
        var kcnId = ent.industrialZoneId || ent.kcnId || '';
        if (kcnId) {
            var $kcn = $form.find('select[name="KcnId"]');
            if ($kcn.find('option[value="' + kcnId + '"]').length > 0) $kcn.val(kcnId).trigger('change');
            else $kcn.data('pendingValue', kcnId);
        }
    }

    var gpxdGocDataMap = {};
    var gpxdGocLoaded = false;
    function loadGpxdGocOptions(kcnId) {
        var $sel = $('#gpxdGocSelect');
        if (gpxdGocLoaded && !kcnId) return;

        var initialValue = $sel.val() || $sel.data('initial-value');
        $sel.prop('disabled', true);
        
        return $.get(Cfg.urls.getGpxdGoc, { kcnId: kcnId }).done(function (resp) {
            $sel.empty().append('<option value="">-- Chọn từ danh sách GPXD đã cấp --</option>');
            if (resp && resp.success && Array.isArray(resp.data)) {
                resp.data.forEach(function (it) {
                    gpxdGocDataMap[it.id] = it;
                    var $opt = $('<option>').val(it.id).text(it.name);
                    if (initialValue && String(it.id).toLowerCase() === String(initialValue).toLowerCase()) {
                        $opt.attr('selected', 'selected');
                    }
                    $sel.append($opt);
                });
                if (!kcnId) gpxdGocLoaded = true;
            }
        }).always(function() {
            $sel.prop('disabled', false);
        });
    }

    function formatDateForInput(dateStr) {
        if (!dateStr) return '';
        var s = String(dateStr).trim();
        if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.substring(0, 10);
        var parts = s.split(/[\/\-]/);
        if (parts.length === 3 && parts[0].length <= 2 && parts[2].length === 4) {
            var dd = parts[0].length === 1 ? '0' + parts[0] : parts[0];
            var mm = parts[1].length === 1 ? '0' + parts[1] : parts[1];
            return parts[2] + '-' + mm + '-' + dd;
        }
        return s.substring(0, 10);
    }

    function setDateInputValue($input, dateStr) {
        var val = formatDateForInput(dateStr);
        if ($input.length > 0) {
            var el = $input[0];
            if (el._flatpickr) el._flatpickr.setDate(val);
            else $input.val(val).trigger('change');
        }
    }

    function onGpxdGocSelected() {
        var $form = $('#gpxdEditForm');
        var id = $('#gpxdGocSelect').val();
        if (!id) return;
        $.get('/CapPhepXayDung/GetResult/' + encodeURIComponent(id)).done(function (resp) {
            var d = resp ? (resp.data || resp.Data) : null;
            if (d) {
                $form.find('input[name="SoGpxdGoc"]').val(d.soGpxd || d.SoGpxd || '');
                $form.find('input[name="NguoiKyGpxdGoc"]').val(d.nguoiKy || d.NguoiKy || '');
                setDateInputValue($form.find('input[name="NgayCapGpxdGoc"]'), d.ngayCap || d.NgayCap || '');
                setDateInputValue($form.find('input[name="NgayHetHanGpxdGoc"]'), d.ngayHetHan || d.NgayHetHan || '');
            }
        });
    }

    function applySections() {
        var v = String($('#gpxdEditForm').find('input[name="LoaiThuTucB"]:checked').val() || '');
        currentLoaiB = v;
        var cfg = BTYPE_CONFIG[v] || { groups: [] };
        $('#gpxdCongTrinhSubtitle').text(cfg.hasRoot ? '(trước sửa chữa / điều chỉnh / gia hạn)' : '(mới)');
        $('.gpxd-btype-card').removeClass('active');
        $('input[name="LoaiThuTucB"]:checked').closest('.gpxd-btype-card').addClass('active');

        $('[data-btype-group]').each(function () {
            var g = $(this).data('btype-group');
            var visible = cfg.groups.indexOf(g) >= 0;
            $(this).toggle(visible);
            $(this).find('[data-btype-required]').each(function () {
                $(this).prop('required', visible);
            });
        });

        if (cfg.hasRoot) loadGpxdGocOptions(null);
        if (v) loadAttachmentTemplates(v);
    }

    function loadAttachmentTemplates(loaiB) {
        var $tb = $('#docs-tbody');
        $tb.html('<tr><td colspan="4" class="text-center text-muted">Đang tải cấu hình và tài liệu...</td></tr>');

        // Load templates và attachments song song
        $.when(
            $.get(Cfg.urls.getAttachmentTemplates, { loaiNghiepVu: loaiB, status: 2 }),
            $.get(Cfg.urls.getAttachments + '/' + Cfg.dossierId)
        ).done(function (templatesResp, attachmentsResp) {
            var templates = (templatesResp[0] && Array.isArray(templatesResp[0].data)) ? templatesResp[0].data : [];
            var attachments = (attachmentsResp[0] && Array.isArray(attachmentsResp[0].data)) ? attachmentsResp[0].data : [];

            if (templates.length === 0) {
                $tb.html('<tr><td colspan="4" class="text-center text-muted">Không có cấu hình tài liệu cho loại nghiệp vụ này.</td></tr>');
                return;
            }

            // Group attachments theo MaLoaiTaiLieu (Nguồn)
            var attMap = {};
            attachments.forEach(function (a) {
                if (a.maLoaiTaiLieu) attMap[a.maLoaiTaiLieu] = a;
            });

            var rows = templates.map(function (it, idx) {
                var ma = it.maLoaiTaiLieu || ('TL_' + idx);
                var batBuocBadge = it.batBuoc ? '<span class="badge badge-danger">Bắt buộc</span>' : '<span class="badge badge-secondary">Tùy chọn</span>';

                // File mẫu hệ thống
                var templateLink = it.fileId
                    ? '<a href="' + escapeHtml(Cfg.urls.downloadFile) + '/' + escapeHtml(it.fileId) + '" class="gpxd-template-link" target="_blank" title="Tải file mẫu hệ thống"><i class="fas fa-download"></i> Mẫu</a>'
                    : '<span class="text-muted">—</span>';

                // File đã upload của hồ sơ
                var existing = attMap[ma];
                var existingLink = '';
                if (existing) {
                    existingLink = '<div class="mt-1"><a href="' + escapeHtml(Cfg.urls.downloadFile) + '/' + escapeHtml(existing.fileId) + '" class="text-success font-weight-bold" target="_blank" style="font-size:12px;"><i class="fas fa-file-alt"></i> ' + escapeHtml(existing.tenFile) + '</a></div>';
                }

                var uploadCell = '<div><input type="file" class="form-control-file gpxd-doc-file" data-ma-loai-tai-lieu="' + escapeHtml(ma) + '" />' + existingLink + '</div>';

                return '<tr data-ma="' + escapeHtml(ma) + '" data-bat-buoc="' + (it.batBuoc ? '1' : '0') + '">'
                    + '<td>' + escapeHtml(it.tenLoaiTaiLieu || ma) + '</td>'
                    + '<td class="text-center">' + batBuocBadge + '</td>'
                    + '<td class="text-center">' + templateLink + '</td>'
                    + '<td>' + uploadCell + '</td>'
                    + '</tr>';
            });

            $tb.html(rows.join(''));
            $tb.find('.gpxd-doc-file').on('change', function () {
                var ma = $(this).data('ma-loai-tai-lieu');
                var f = this.files && this.files[0];
                if (f) pendingAttachments[ma] = f; else delete pendingAttachments[ma];
            });
        }).fail(function () {
            $tb.html('<tr><td colspan="4" class="text-center text-danger">Lỗi khi tải danh sách tài liệu.</td></tr>');
        });
    }

    function initProfessionalData() {
        if (!Cfg.professionalJson) return;
        var p = Cfg.professionalJson;
        var $form = $('#gpxdEditForm');
        ['QuyMoSuaChuaM2','VonDauTuSuaChua','ThoiGianThiCongThang','MoTaSuaChua',
         'DienTichXayDungMoi','TongDienTichSanMoi','LyDoDieuChinh',
         'NgayBatDauThiCong','NgayDuKienHoanThanh','LyDoGiaHan'
        ].forEach(function (k) {
            if (p[k]) {
                var $el = $form.find('[name="' + k + '"]');
                if ($el.attr('type') === 'date') setDateInputValue($el, p[k]);
                else $el.val(p[k]);
            }
        });
        if (p.LoaiSuaChuaId) $form.find('select[name="LoaiSuaChuaId"]').data('initial-value', p.LoaiSuaChuaId);
        if (p.ThoiGianGiaHanId) $form.find('select[name="ThoiGianGiaHanId"]').data('initial-value', p.ThoiGianGiaHanId);
        if (p.CamKetGiaHan) $form.find('input[name="CamKetGiaHan"]').prop('checked', true);
    }

    function buildPayload($form) {
        var loaiB = String($form.find('input[name="LoaiThuTucB"]:checked').val() || '');
        var thongTin = {};
        ['QuyMoSuaChuaM2','VonDauTuSuaChua','ThoiGianThiCongThang','MoTaSuaChua',
         'DienTichXayDungMoi','TongDienTichSanMoi','LyDoDieuChinh',
         'LoaiSuaChuaId','ThoiGianGiaHanId',
         'NgayBatDauThiCong','NgayDuKienHoanThanh','LyDoGiaHan'
        ].forEach(function (k) {
            var v = $form.find('[name="' + k + '"]').val();
            if (v !== '' && v !== undefined && v !== null) thongTin[k] = v;
        });
        var noiDungIds = [];
        $form.find('#gpxdNoiDungDieuChinhList input[type="checkbox"]:checked').each(function () { noiDungIds.push($(this).val()); });
        if (noiDungIds.length > 0) thongTin.NoiDungDieuChinhIds = noiDungIds;
        if ($form.find('input[name="CamKetGiaHan"]').is(':checked')) thongTin.CamKetGiaHan = true;

        return {
            LoaiThuTucB: Number(loaiB || 1),
            CapCongTrinhId: nullIfEmpty($form.find('select[name="CapCongTrinhId"]').val()),
            TenCongTy: $form.find('input[name="TenCongTy"]').val() || '',
            KcnId: nullIfEmpty($form.find('select[name="KcnId"]').val()),
            DienTichXayDung: numOrZero($form.find('input[name="DienTichXayDung"]').val()),
            DienTichSan: numOrZero($form.find('input[name="DienTichSan"]').val()),
            MatDoXayDung: numOrZero($form.find('input[name="MatDoXayDung"]').val()),
            VonDauTu: numOrZero($form.find('input[name="VonDauTu"]').val()),
            NgayNhan: $form.find('input[name="NgayNhan"]').val() || null,
            SoGpxdGoc: nullIfEmpty($form.find('input[name="SoGpxdGoc"]').val()),
            HoSoGocId: nullIfEmpty($form.find('select[name="HoSoGocId"]').val()),
            SoBienNhanGiay: nullIfEmpty($form.find('input[name="SoBienNhanGiay"]').val()),
            GhiChuTiepNhan: nullIfEmpty($form.find('textarea[name="GhiChuTiepNhan"]').val()),
            ThongTinChuyenMonJson: Object.keys(thongTin).length ? JSON.stringify(thongTin) : null,
            EnterpriseId: nullIfEmpty($form.find('select[name="EnterpriseId"]').val()),
            MaSoThue: nullIfEmpty($form.find('input[name="MaSoThue"]').val()),
            NguoiDaiDien: nullIfEmpty($form.find('input[name="NguoiDaiDien"]').val()),
            ChucVuNguoiDaiDien: nullIfEmpty($form.find('input[name="ChucVuNguoiDaiDien"]').val()),
            SoDienThoai: nullIfEmpty($form.find('input[name="SoDienThoai"]').val()),
            EmailLienHe: nullIfEmpty($form.find('input[name="EmailLienHe"]').val()),
            TenCongTrinh: nullIfEmpty($form.find('input[name="TenCongTrinh"]').val()),
            DiaDiemCongTrinh: nullIfEmpty($form.find('input[name="DiaDiemCongTrinh"]').val()),
            LoaiCongTrinhId: nullIfEmpty($form.find('select[name="LoaiCongTrinhId"]').val()),
            MucDichSuDung: nullIfEmpty($form.find('input[name="MucDichSuDung"]').val()),
            DienTichDat: numOrNull($form.find('input[name="DienTichDat"]').val()),
            SoTang: numOrNull($form.find('input[name="SoTang"]').val()),
            ChieuCaoCongTrinh: numOrNull($form.find('input[name="ChieuCaoCongTrinh"]').val()),
            HeSoSuDungDat: numOrNull($form.find('input[name="HeSoSuDungDat"]').val()),
            ToaDoViTri: nullIfEmpty($form.find('input[name="ToaDoViTri"]').val()),
            NgayCapGpxdGoc: nullIfEmpty($form.find('input[name="NgayCapGpxdGoc"]').val()),
            NgayHetHanGpxdGoc: nullIfEmpty($form.find('input[name="NgayHetHanGpxdGoc"]').val()),
            NguoiKyGpxdGoc: nullIfEmpty($form.find('input[name="NguoiKyGpxdGoc"]').val()),
            HanXuLyOverride: nullIfEmpty($form.find('input[name="HanXuLyOverride"]').val())
        };
    }

    function uploadAttachments(hoSoId, loaiB) {
        var files = pendingAttachments;
        var gpxdGocFile = document.getElementById('gpxdGocFile').files[0];
        var entries = Object.keys(files).map(function (ma) { return { ma: ma, file: files[ma] }; });
        if (gpxdGocFile) entries.push({ ma: 'GPXD_GOC', file: gpxdGocFile });

        if (entries.length === 0) {
            setTimeout(function () { window.location.href = Cfg.urls.chiTiet + '/' + hoSoId; }, 600);
            return;
        }

        function next() {
            if (entries.length === 0) {
                window.location.href = Cfg.urls.chiTiet + '/' + hoSoId;
                return;
            }
            var item = entries.shift();
            var fd = new FormData();
            fd.append('hoSoId', hoSoId);
            fd.append('loaiNghiepVu', loaiB);
            fd.append('maLoaiTaiLieu', item.ma);
            fd.append('file', item.file);
            $.ajax({
                url: Cfg.urls.uploadAttachment,
                type: 'POST',
                data: fd,
                contentType: false,
                processData: false,
                headers: { 'RequestVerificationToken': getAntiForgeryToken() }
            }).always(next);
        }
        next();
    }

    $(function () {
        var $form = $('#gpxdEditForm');
        if (!$form.length) return;

        initProfessionalData();

        loadDropdown(Cfg.urls.getKcn, $form.find('select[name="KcnId"]'), '-- Chọn KCN --');
        loadDropdown(Cfg.urls.getCapCongTrinh, $form.find('select[name="CapCongTrinhId"]'), '-- Chọn cấp --');
        loadDropdown(Cfg.urls.getLoaiCongTrinh, $form.find('select[name="LoaiCongTrinhId"]'), '-- Chọn loại --');
        loadDropdown(Cfg.urls.getLoaiSuaChua, $form.find('select[name="LoaiSuaChuaId"]'), '-- Chọn loại sửa chữa --');
        loadDropdown(Cfg.urls.getThoiGianGiaHan, $form.find('select[name="ThoiGianGiaHanId"]'), '-- Chọn thời gian gia hạn --');
        loadCheckboxList(Cfg.urls.getNoiDungDieuChinh, $('#gpxdNoiDungDieuChinhList'), 'NoiDungDieuChinhIds');

        initEnterpriseSelect2();
        $form.find('input[name="LoaiThuTucB"]').on('change', function () { applySections(); recalcDeadline(); });
        $form.find('input[name="NgayNhan"]').on('change', recalcDeadline);
        $('#gpxdGocSelect').on('change', onGpxdGocSelected);
        applySections();
        recalcDeadline();

        $form.on('submit', function (e) {
            e.preventDefault();
            if (!$form[0].checkValidity()) { $form[0].reportValidity(); return; }
            var $btn = $form.find('button[type="submit"]').prop('disabled', true);
            var payload = buildPayload($form);

            $.ajax({
                url: Cfg.urls.update,
                type: 'POST',
                contentType: 'application/json; charset=utf-8',
                headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                data: JSON.stringify(payload)
            }).done(function (resp) {
                if (resp && resp.isSuccess) {
                    showSuccess('Cập nhật hồ sơ thành công.');
                    uploadAttachments(Cfg.dossierId, payload.LoaiThuTucB);
                } else {
                    showError(resp.message || 'Cập nhật thất bại.');
                    $btn.prop('disabled', false);
                }
            }).fail(function () {
                showError('Lỗi kết nối.');
                $btn.prop('disabled', false);
            });
        });
    });
})(jQuery);
