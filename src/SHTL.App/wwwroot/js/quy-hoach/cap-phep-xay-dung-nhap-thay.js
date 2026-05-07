/**
 * GPXD Phase 1 — Form Nhập thay (UC-NEW-01)
 * View: Views/CapPhepXayDung/NhapThay.cshtml
 *
 * UI mới (28/04/2026):
 *  - Section ② Thông tin cơ bản (bắt buộc cho mọi loại) — 4 cột grid
 *  - KCN auto-set theo doanh nghiệp (industrialZoneId từ Enterprise DTO)
 *  - Section ③ Thông tin công trình xây dựng — chia 4 cột
 *  - Section ④ Thông tin GPXD gốc — Số GPXD gốc dropdown từ list DaCap
 *      → khi chọn auto-fill các ô; có file đính kèm riêng (PDF GPXD gốc)
 *  - Section ⑥ Tài liệu đính kèm — bỏ cột Ghi chú; Tải mẫu (download); Upload sau khi tạo
 */
(function ($) {
    'use strict';

    if (!window.gpxdNhapThayConfig) return;
    var Cfg = window.gpxdNhapThayConfig;

    // BTYPE_CONFIG — map LoaiThuTucB → required section groups + SLA working days
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

    // Pending attachment files: { maLoaiTaiLieu: File }
    var pendingAttachments = {};
    var currentLoaiB = '';

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function getAntiForgeryToken() { return $('input[name="__RequestVerificationToken"]').val() || ''; }
    function showError(msg) { if (window.toastr) toastr.error(msg); else alert(msg); }
    function showSuccess(msg) { if (window.toastr) toastr.success(msg); else alert(msg); }
    function showWarning(msg) { if (window.toastr) toastr.warning(msg); else alert(msg); }
    function nullIfEmpty(v) { return (v === '' || v === undefined || v === null) ? null : v; }
    function numOrNull(v) { return (v === '' || v === undefined || v === null) ? null : Number(v); }
    function numOrZero(v) { return (v === '' || v === undefined || v === null) ? 0 : Number(v); }

    /**
     * Cộng số ngày làm việc (loại trừ T7, CN) vào ngày start (yyyy-MM-dd).
     * Trả về string yyyy-MM-dd. Nếu start không hợp lệ → null.
     */
    function addWorkingDays(startStr, days) {
        if (!startStr || !days || days <= 0) return null;
        var d = new Date(startStr + 'T00:00:00');
        if (isNaN(d.getTime())) return null;
        var added = 0;
        while (added < days) {
            d.setDate(d.getDate() + 1);
            var dow = d.getDay(); // 0=CN, 6=T7
            if (dow !== 0 && dow !== 6) added++;
        }
        var yyyy = d.getFullYear();
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');
        return yyyy + '-' + mm + '-' + dd;
    }

    /** Cập nhật field "Số ngày xử lý" + "Hạn xử lý" theo (loaiB, ngayNhan). */
    function recalcDeadline() {
        var loaiB = String($('input[name="LoaiThuTucB"]:checked').val() || '');
        var cfg = BTYPE_CONFIG[loaiB];
        var $sla = $('#gpxdSoNgayXuLy');
        var $han = $('#gpxdHanXuLy');
        if (!cfg) {
            $sla.val('');
            // không xoá Hạn xử lý nếu user đã chỉnh tay
            return;
        }
        $sla.val(cfg.slaDays);
        var ngayNhan = $('input[name="NgayNhan"]').val();
        if (!ngayNhan) return;
        // Chỉ auto-set khi user chưa chỉnh tay (data flag)
        if ($han.data('userEdited')) return;
        var deadline = addWorkingDays(ngayNhan, cfg.slaDays);
        if (deadline) $han.val(deadline);
    }

    // -----------------------------------------------------------------
    // Dropdown loaders
    // -----------------------------------------------------------------
    function loadDropdown(url, $select, placeholder) {
        $select.empty().append('<option value="">' + escapeHtml(placeholder) + '</option>');
        return $.get(url).done(function (resp) {
            if (resp && resp.success && Array.isArray(resp.data)) {
                resp.data.forEach(function (it) {
                    var label = it.code ? (it.code + ' — ' + it.name) : it.name;
                    $select.append('<option value="' + escapeHtml(it.id) + '">' + escapeHtml(label) + '</option>');
                });
            } else if (resp && resp.message) {
                showWarning(resp.message);
            }
        }).fail(function () {
            showError('Không tải được ' + placeholder.toLowerCase() + '.');
        });
    }

    function loadCheckboxList(url, $container, name) {
        $container.empty().append('<span class="text-muted">Đang tải...</span>');
        return $.get(url).done(function (resp) {
            $container.empty();
            if (resp && resp.success && Array.isArray(resp.data) && resp.data.length > 0) {
                resp.data.forEach(function (it, idx) {
                    var id = 'gpxd_nd_' + idx;
                    $container.append(
                        '<label><input type="checkbox" name="' + escapeHtml(name) + '" value="' + escapeHtml(it.id) + '" id="' + id + '" /> ' +
                        escapeHtml(it.name) + '</label>'
                    );
                });
            } else {
                $container.append('<span class="text-muted">Chưa có dữ liệu.</span>');
            }
        }).fail(function () {
            $container.empty().append('<span class="text-danger">Lỗi tải danh mục.</span>');
        });
    }

    // -----------------------------------------------------------------
    // Enterprise Select2 + auto-fill (incl. KCN auto-set)
    // -----------------------------------------------------------------
    function initEnterpriseSelect2() {
        var $sel = $('#gpxdEnterpriseSelect');
        if (!$sel.length || !$.fn.select2) return;

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
                data: function (params) {
                    return { searchTerm: params.term || '', pageNumber: params.page || 1, pageSize: 20 };
                },
                processResults: function (resp, params) {
                    params.page = params.page || 1;
                    if (!resp || !resp.success || !resp.data || !Array.isArray(resp.data.items)) {
                        return { results: [] };
                    }
                    return {
                        results: resp.data.items.map(function (e) {
                            return {
                                id: e.id,
                                text: (e.code ? '[' + e.code + '] ' : '') + (e.name || ''),
                                _raw: e
                            };
                        }),
                        pagination: { more: (params.page * 20) < (resp.data.totalCount || 0) }
                    };
                },
                cache: true
            }
        });

        $sel.on('select2:select', function (e) {
            var ent = e.params.data && e.params.data._raw;
            populateEnterpriseInfo(ent);
            // KHÔNG gọi lại loadGpxdGocOptions ở đây nữa để tránh làm mất selection GPXD gốc ở trên
        });
        $sel.on('select2:clear', function () {
            populateEnterpriseInfo(null);
        });
    }

    function populateEnterpriseInfo(ent) {
        var $form = $('#gpxdNhapThayForm');

        if (!ent) {
            ['TenCongTy','MaSoThue','NguoiDaiDien','ChucVuNguoiDaiDien','SoDienThoai','EmailLienHe'].forEach(function (n) {
                $form.find('input[name="' + n + '"]').val('');
            });
            $form.find('select[name="KcnId"]').val('').trigger('change');
            return;
        }

        var name    = ent.name || ent.tenCongTy || '';
        var taxCode = ent.taxCode || ent.maSoThue || '';
        var rep     = ent.legalRepresentative || ent.representative || ent.nguoiDaiDien || '';
        var role    = ent.legalRepresentativeTitle || ent.chucVuNguoiDaiDien || '';
        var phone   = ent.phone || ent.soDienThoai || '';
        var email   = ent.email || ent.emailLienHe || '';
        var kcnId   = ent.industrialZoneId || ent.kcnId || '';

        $form.find('input[name="TenCongTy"]').val(name);
        $form.find('input[name="MaSoThue"]').val(taxCode);
        $form.find('input[name="NguoiDaiDien"]').val(rep);
        $form.find('input[name="ChucVuNguoiDaiDien"]').val(role);
        $form.find('input[name="SoDienThoai"]').val(phone);
        $form.find('input[name="EmailLienHe"]').val(email);

        // KCN auto-select theo doanh nghiệp
        if (kcnId) {
            var $kcn = $form.find('select[name="KcnId"]');
            if ($kcn.find('option[value="' + kcnId + '"]').length === 0) {
                // Nếu chưa có option (chưa load xong) thì giữ value để khi load xong sẽ set
                $kcn.data('pendingValue', kcnId);
            } else {
                $kcn.val(kcnId).trigger('change');
            }
        }
    }

    // -----------------------------------------------------------------
    // GPXD gốc dropdown (B3..B8) — lưu toàn bộ data vào option để fill ngay
    // -----------------------------------------------------------------
    var gpxdGocDataMap = {}; // { id: {...} } — cache để onGpxdGocSelected dùng

    var gpxdGocLoaded = false;
    function loadGpxdGocOptions(kcnId) {
        var $sel = $('#gpxdGocSelect');
        if (gpxdGocLoaded && !kcnId) return; // Đã load tất cả rồi thì không load lại nữa

        var currentVal = $sel.val() || $sel.data('initial-value');
        $sel.prop('disabled', true);
        
        var params = {};
        if (kcnId) params.kcnId = kcnId;

        return $.get(Cfg.urls.getGpxdGoc, params).done(function (resp) {
            $sel.empty().append('<option value="">-- Chọn từ danh sách GPXD đã cấp --</option>');
            if (resp && resp.success && Array.isArray(resp.data)) {
                resp.data.forEach(function (it) {
                    gpxdGocDataMap[it.id] = it;
                    var $opt = $('<option>').val(it.id).text(it.name);
                    if (currentVal && String(it.id).toLowerCase() === String(currentVal).toLowerCase()) {
                        $opt.attr('selected', 'selected');
                    }
                    $sel.append($opt);
                });
                if (!kcnId) gpxdGocLoaded = true;
            } else {
                $sel.append('<option value="" disabled>Chưa có GPXD đã cấp phù hợp</option>');
            }
        }).always(function() {
            $sel.prop('disabled', false);
        });
    }

    function formatDateForInput(dateStr) {
        if (!dateStr) return '';
        var s = String(dateStr).trim();
        // Nếu đã là chuẩn ISO yyyy-MM-dd...
        if (s.match(/^\d{4}-\d{2}-\d{2}/)) {
            return s.substring(0, 10);
        }
        // Nếu là chuẩn Việt Nam dd/MM/yyyy (hoặc d/M/yyyy)
        var parts = s.split(/[\/\-]/); // Hỗ trợ cả dd-MM-yyyy
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
            if (el._flatpickr) {
                el._flatpickr.setDate(val);
            } else {
                $input.val(val).trigger('change');
            }
        }
    }

    function onGpxdGocSelected() {
        var $form = $('#gpxdNhapThayForm');
        var id = $('#gpxdGocSelect').val();
        if (!id) {
            // Reset các trường GPXD gốc khi bỏ chọn
            $form.find('input[name="SoGpxdGoc"]').val('');
            $form.find('input[name="NgayCapGpxdGoc"]').val('');
            $form.find('input[name="NgayHetHanGpxdGoc"]').val('');
            $form.find('input[name="NguoiKyGpxdGoc"]').val('');
            return;
        }

        // Ưu tiên gọi API GetResult để lấy chính xác thông tin Ngày cấp, Ngày hết hạn, Người ký
        $.get('/CapPhepXayDung/GetResult/' + encodeURIComponent(id)).done(function (resp) {
            var isSucc = resp && (resp.isSuccess || resp.IsSuccess);
            var d = resp ? (resp.data || resp.Data) : null;
            if (isSucc && d) {
                $form.find('input[name="SoGpxdGoc"]').val(d.soGpxd || d.SoGpxd || '').trigger('change');
                $form.find('input[name="NguoiKyGpxdGoc"]').val(d.nguoiKy || d.NguoiKy || '').trigger('change');
                
                var ngayCap = d.ngayCap || d.NgayCap;
                setDateInputValue($form.find('input[name="NgayCapGpxdGoc"]'), ngayCap || '');

                var ngayHetHan = d.ngayHetHan || d.NgayHetHan;
                setDateInputValue($form.find('input[name="NgayHetHanGpxdGoc"]'), ngayHetHan || '');
            } else {
                // Fallback: lấy từ cache nếu API không trả về
                var it = gpxdGocDataMap[id];
                if (it) {
                    fillFromGpxdGocData($form, it);
                }
            }
        }).fail(function () {
            // Fallback: lấy từ cache nếu gọi API lỗi
            var it = gpxdGocDataMap[id];
            if (it) {
                fillFromGpxdGocData($form, it);
            }
        });
    }

    function fillFromGpxdGocData($form, it) {
        // CHỈ fill các trường thuộc mục "Thông tin GPXD gốc đã được cấp".
        // KHÔNG cập nhật các vùng khác (Công trình, KCN, Loại công trình...).

        // Lấy SoGpxd từ trường soGpxd (IssuedListDto) hoặc maHoSo (fallback)
        $form.find('input[name="SoGpxdGoc"]').val(it.soGpxd || it.maHoSo || '').trigger('change');

        // Người ký — lấy từ trường nguoiKy (ConstructionPermitIssuedListDto.NguoiKy)
        if (it.nguoiKy || it.nguoiKyGpxdGoc) {
            $form.find('input[name="NguoiKyGpxdGoc"]').val(it.nguoiKy || it.nguoiKyGpxdGoc).trigger('change');
        }

        // Ngày cấp — lấy từ ngayCap (DateOnly, format yyyy-MM-dd)
        var nCap = it.ngayCap || it.NgayCap;
        if (nCap) {
            setDateInputValue($form.find('input[name="NgayCapGpxdGoc"]'), nCap);
        } else if (it.ngayCapGpxdGoc || it.NgayCapGpxdGoc) {
            var nCapGoc = it.ngayCapGpxdGoc || it.NgayCapGpxdGoc;
            setDateInputValue($form.find('input[name="NgayCapGpxdGoc"]'), nCapGoc);
        }

        // Ngày hết hạn — lấy từ ngayHetHan (ConstructionPermitIssuedListDto.NgayHetHan)
        var nHan = it.ngayHetHan || it.NgayHetHan;
        if (nHan) {
            setDateInputValue($form.find('input[name="NgayHetHanGpxdGoc"]'), nHan);
        } else if (it.ngayHetHanGpxdGoc || it.NgayHetHanGpxdGoc) {
            var nHanGoc = it.ngayHetHanGpxdGoc || it.NgayHetHanGpxdGoc;
            setDateInputValue($form.find('input[name="NgayHetHanGpxdGoc"]'), nHanGoc);
        }
    }


    // -----------------------------------------------------------------
    // Section visibility theo LoaiThuTucB
    // -----------------------------------------------------------------
    function applySections() {
        var v = String($('#gpxdNhapThayForm').find('input[name="LoaiThuTucB"]:checked').val() || '');
        currentLoaiB = v;
        var cfg = BTYPE_CONFIG[v] || { groups: [] };

        // Update preview mã hồ sơ
        $('#gpxdMaPreviewLoai').text(v || '?');

        // Subtitle "Thông tin công trình xây dựng"
        $('#gpxdCongTrinhSubtitle').text(cfg.hasRoot ? '(trước sửa chữa / điều chỉnh / gia hạn)' : '(mới)');

        // Highlight active card
        $('.gpxd-btype-card').removeClass('active');
        $('input[name="LoaiThuTucB"]:checked').closest('.gpxd-btype-card').addClass('active');

        // Toggle groups
        $('[data-btype-group]').each(function () {
            var g = $(this).data('btype-group');
            var visible = cfg.groups.indexOf(g) >= 0;
            $(this).toggle(visible);
            $(this).find('[data-btype-required]').each(function () {
                if (visible) $(this).prop('required', true);
                else { $(this).prop('required', false); $(this).val(''); }
            });
        });

        // GPXD gốc: load options khi chuyển sang B3-B8
        if (cfg.hasRoot) {
            // Loại bỏ filter KcnId ở đây để luôn load toàn bộ danh sách, tránh rủi ro thiếu GPXD
            loadGpxdGocOptions(null);
        }

        // Load attachment templates theo loại B
        if (v) loadAttachmentTemplates(v);
        else $('#docs-tbody').html('<tr><td colspan="4" class="text-center text-muted">Vui lòng chọn Loại thủ tục B trước.</td></tr>');
    }

    // -----------------------------------------------------------------
    // Attachment templates per LoaiB (M0204) — render với download + upload
    // -----------------------------------------------------------------
    function loadAttachmentTemplates(loaiB) {
        var $tb = $('#docs-tbody');
        $tb.html('<tr><td colspan="4" class="text-center text-muted">Đang tải danh sách tài liệu...</td></tr>');
        // Reset pending uploads when loaiB changes
        pendingAttachments = {};

        $.get(Cfg.urls.getAttachmentTemplates, {
            page: 1,
            pageSize: 100,
            loaiNghiepVu: loaiB,
            status: 2 // DangApDung
        }).done(function (resp) {
            var items = (resp && Array.isArray(resp.data)) ? resp.data : [];
            if (items.length === 0) {
                $tb.html('<tr><td colspan="4" class="text-center text-muted">Chưa cấu hình tài liệu cho loại thủ tục này.</td></tr>');
                return;
            }
            var rows = items.map(function (it, idx) {
                var ma = it.maLoaiTaiLieu || ('TL_' + idx);
                var batBuocBadge = it.batBuoc
                    ? '<span class="badge badge-danger">Bắt buộc</span>'
                    : '<span class="badge badge-secondary">Tùy chọn</span>';
                var downloadCell = it.fileId
                    ? '<a href="' + escapeHtml(Cfg.urls.downloadFile) + '/' + escapeHtml(it.fileId)
                        + '" class="gpxd-template-link" target="_blank" rel="noopener">'
                        + '<i class="fas fa-download"></i> Tải mẫu</a>'
                        + (it.fileName ? '<div class="form-control-sm-text">' + escapeHtml(it.fileName) + '</div>' : '')
                    : '<span class="gpxd-template-link disabled"><i class="fas fa-minus"></i> Không có mẫu</span>';
                var uploadCell = '<input type="file" class="form-control-file gpxd-doc-file" '
                    + 'data-ma-loai-tai-lieu="' + escapeHtml(ma) + '" '
                    + 'accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.dwg" />'
                    + (it.batBuoc ? '<div class="form-control-sm-text text-danger">* Bắt buộc tải lên</div>' : '');
                return '<tr data-ma="' + escapeHtml(ma) + '" data-bat-buoc="' + (it.batBuoc ? '1' : '0') + '">'
                    + '<td><div>' + escapeHtml(it.tenLoaiTaiLieu || ma) + '</div>'
                    + (it.moTa ? '<div class="form-control-sm-text">' + escapeHtml(it.moTa) + '</div>' : '')
                    + '</td>'
                    + '<td class="text-center">' + batBuocBadge + '</td>'
                    + '<td>' + downloadCell + '</td>'
                    + '<td>' + uploadCell + '</td>'
                    + '</tr>';
            });
            $tb.html(rows.join(''));

            // Bind file change → store in pendingAttachments
            $tb.find('.gpxd-doc-file').on('change', function () {
                var ma = $(this).data('ma-loai-tai-lieu');
                var f = this.files && this.files[0];
                if (f) pendingAttachments[ma] = f; else delete pendingAttachments[ma];
            });
        }).fail(function () {
            $tb.html('<tr><td colspan="4" class="text-center text-danger">Lỗi tải danh sách tài liệu.</td></tr>');
        });
    }

    // -----------------------------------------------------------------
    // Build payload
    // -----------------------------------------------------------------
    function buildPayload($form) {
        var loaiB = String($form.find('input[name="LoaiThuTucB"]:checked').val() || '');

        var noiDungIds = [];
        $form.find('#gpxdNoiDungDieuChinhList input[type="checkbox"]:checked').each(function () {
            noiDungIds.push($(this).val());
        });

        var thongTin = {};
        ['QuyMoSuaChuaM2','VonDauTuSuaChua','ThoiGianThiCongThang','MoTaSuaChua',
         'DienTichXayDungMoi','TongDienTichSanMoi','LyDoDieuChinh',
         'LoaiSuaChuaId','ThoiGianGiaHanId',
         'NgayBatDauThiCong','NgayDuKienHoanThanh','LyDoGiaHan'
        ].forEach(function (k) {
            var v = $form.find('[name="' + k + '"]').val();
            if (v !== '' && v !== undefined && v !== null) thongTin[k] = v;
        });
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
            CanhBaoGpxdGocThuCong: false,
            TienDoThiCongPercent: numOrNull($form.find('input[name="TienDoThiCongPercent"]').val()),

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

            // Cho phép user override hạn xử lý (D-23)
            HanXuLyOverride: nullIfEmpty($form.find('input[name="HanXuLyOverride"]').val())
        };
    }

    // -----------------------------------------------------------------
    // Upload attachments after dossier creation
    // -----------------------------------------------------------------
    function uploadAttachmentsSequential(hoSoId, loaiB, files) {
        var entries = Object.keys(files).map(function (ma) { return { ma: ma, file: files[ma] }; });
        var done = 0, failed = 0;

        function next() {
            if (entries.length === 0) {
                if (failed > 0) showWarning('Tải xong ' + done + ' file, có ' + failed + ' file lỗi.');
                else if (done > 0) showSuccess('Đã tải lên ' + done + ' tài liệu đính kèm.');
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
            }).done(function (resp) {
                if (resp && resp.isSuccess) done++;
                else { failed++; if (resp && resp.message) showWarning('TL ' + item.ma + ': ' + resp.message); }
            }).fail(function () {
                failed++;
            }).always(next);
        }
        next();
    }

    function uploadGpxdGocFile(hoSoId, loaiB, file, onComplete) {
        var fd = new FormData();
        fd.append('hoSoId', hoSoId);
        fd.append('loaiNghiepVu', loaiB);
        fd.append('maLoaiTaiLieu', 'GPXD_GOC');
        fd.append('file', file);
        $.ajax({
            url: Cfg.urls.uploadAttachment,
            type: 'POST',
            data: fd,
            contentType: false,
            processData: false,
            headers: { 'RequestVerificationToken': getAntiForgeryToken() }
        }).always(onComplete);
    }

    // -----------------------------------------------------------------
    // Init
    // -----------------------------------------------------------------
    $(function () {
        var $form = $('#gpxdNhapThayForm');
        if ($form.length === 0) return;

        // Dropdowns
        var $kcn = $form.find('select[name="KcnId"]');
        loadDropdown(Cfg.urls.getKcn, $kcn, '-- Chọn KCN --').done(function () {
            var pending = $kcn.data('pendingValue');
            if (pending) { $kcn.val(pending).trigger('change'); $kcn.removeData('pendingValue'); }
        });
        loadDropdown(Cfg.urls.getCapCongTrinh, $form.find('select[name="CapCongTrinhId"]'), '-- Chọn cấp công trình --');
        loadDropdown(Cfg.urls.getLoaiCongTrinh, $form.find('select[name="LoaiCongTrinhId"]'), '-- Chọn loại công trình --');
        loadDropdown(Cfg.urls.getLoaiSuaChua, $form.find('select[name="LoaiSuaChuaId"]'), '-- Chọn loại sửa chữa --');
        loadDropdown(Cfg.urls.getThoiGianGiaHan, $form.find('select[name="ThoiGianGiaHanId"]'), '-- Chọn thời gian gia hạn --');
        loadCheckboxList(Cfg.urls.getNoiDungDieuChinh, $('#gpxdNoiDungDieuChinhList'), 'NoiDungDieuChinhIds');

        // Enterprise Select2
        initEnterpriseSelect2();

        // Section toggle
        $form.find('input[name="LoaiThuTucB"]').on('change', function () {
            applySections();
            recalcDeadline();
        });
        $form.find('input[name="NgayNhan"]').on('change', recalcDeadline);
        $('#gpxdHanXuLy').on('input change', function () {
            $(this).data('userEdited', true);
        });
        applySections();
        recalcDeadline();

        // GPXD gốc dropdown — auto-fill when selected
        $('#gpxdGocSelect').on('change', onGpxdGocSelected);

        // Submit
        $form.on('submit', function (e) {
            e.preventDefault();
            var $btn = $form.find('button[type="submit"]');

            if (!$form[0].checkValidity()) { $form[0].reportValidity(); return; }

            var loaiB = String($form.find('input[name="LoaiThuTucB"]:checked').val() || '');
            var cfg = BTYPE_CONFIG[loaiB] || { groups: [] };

            // Validate adjust: ít nhất 1 nội dung
            if (cfg.groups.indexOf('adjust') >= 0) {
                if ($('#gpxdNoiDungDieuChinhList input[type="checkbox"]:checked').length === 0) {
                    showError('Vui lòng chọn ít nhất 1 nội dung điều chỉnh.');
                    return;
                }
            }

            // Validate GPXD gốc file (B3..B8)
            var gpxdGocFile = null;
            if (cfg.hasRoot) {
                var fileInput = document.getElementById('gpxdGocFile');
                gpxdGocFile = fileInput && fileInput.files && fileInput.files[0];
                if (!gpxdGocFile) {
                    showError('Vui lòng tải lên file scan GPXD gốc (PDF/ảnh).');
                    return;
                }
            }

            // Validate bắt buộc các tài liệu trong section ⑥
            var missingRequired = [];
            $('#docs-tbody tr[data-bat-buoc="1"]').each(function () {
                var ma = $(this).data('ma');
                if (!pendingAttachments[ma]) {
                    var ten = $(this).find('td:first').text().trim();
                    missingRequired.push(ten);
                }
            });
            if (missingRequired.length > 0) {
                showError('Thiếu tài liệu bắt buộc: ' + missingRequired.join(', '));
                return;
            }

            $btn.prop('disabled', true);
            var payload = buildPayload($form);

            $.ajax({
                url: Cfg.urls.create,
                type: 'POST',
                contentType: 'application/json; charset=utf-8',
                headers: { 'RequestVerificationToken': getAntiForgeryToken() },
                data: JSON.stringify(payload)
            }).done(function (resp) {
                if (!(resp && resp.isSuccess && resp.data && resp.data.id)) {
                    showError((resp && resp.message) || 'Tạo hồ sơ thất bại.');
                    $btn.prop('disabled', false);
                    return;
                }
                var hoSoId = resp.data.id;
                showSuccess('Đã tạo hồ sơ ' + (resp.data.maHoSo || ''));

                var afterGpxdGoc = function () {
                    var hasFiles = Object.keys(pendingAttachments).length > 0;
                    if (hasFiles) uploadAttachmentsSequential(hoSoId, loaiB, pendingAttachments);
                    else setTimeout(function () { window.location.href = Cfg.urls.chiTiet + '/' + hoSoId; }, 600);
                };

                if (gpxdGocFile) uploadGpxdGocFile(hoSoId, loaiB, gpxdGocFile, afterGpxdGoc);
                else afterGpxdGoc();
            }).fail(function (xhr) {
                showError('Lỗi kết nối: ' + xhr.status);
                $btn.prop('disabled', false);
            });
        });
    });
})(jQuery);
