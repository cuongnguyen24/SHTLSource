/**
 * gxn-form.js — Tab navigation + Conditional fields per LoaiNghiepVu
 * Used in: Views/Gxn/Create.cshtml, Views/Gxn/Edit.cshtml
 * Independent of gxn-management.js (which handles index/list page).
 */
(function () {
    'use strict';

    const TAB_IDS = ['#tab-nld-lnk', '#tab-cv-lnk', '#tab-giay-lnk', '#tab-theo-doi-lnk'];

    function init() {
        const $loai = $('#loaiNghiepVuSelect');
        if ($loai.length === 0) return; // Not on form page

        bindLoaiNghiepVuChange($loai);
        bindTabNavigation();
        bindNgayNhanChange();
        bindAnhNLD();
        initEnterpriseSelect();
        bindRealtimeValidation();
        initFormSubmitGuard();

        // Initial paint
        applyLoaiNghiepVuVisibility($loai.val());
        updateHanXuLyEditable();
        updateNgayNhanDisplay();
        updateSoGxnPreview();
        runRealtimeValidation();
    }

    function bindLoaiNghiepVuChange($loai) {
        $loai.on('change', function () {
            applyLoaiNghiepVuVisibility($(this).val());
            updateHanXuLyEditable();
            updateSoGxnPreview();
        });
    }

    function applyLoaiNghiepVuVisibility(loai) {
        const isCapMoi = loai === 'CapMoi' || loai === '0';
        const isGiaHan = loai === 'GiaHan' || loai === '1';
        const isCapLai = loai === 'CapLai' || loai === '2';

        // Tuyển dụng: required cho CapMoi & CapLai (KHÔNG cho GiaHan)
        $('#tuyen-dung-fields').toggle(isCapMoi || isCapLai);
        // GXN cũ: required cho GiaHan & CapLai
        $('#gxn-cu-fields').toggle(isGiaHan || isCapLai);
        // Cấp lại only
        $('#cap-lai-fields').toggle(isCapLai);

        $('.asterisk-conditional').toggle(isGiaHan || isCapLai);
        $('.asterisk-cap-lai').toggle(isCapLai);

        const labelMap = {
            'CapMoi': { txt: 'Cấp mới', ksqt: 'KSQT Cấp mới – Điều 8 (NĐ 152)' },
            'GiaHan': { txt: 'Gia hạn', ksqt: 'KSQT Gia hạn – Điều 18 (NĐ 152)' },
            'CapLai': { txt: 'Cấp lại', ksqt: 'KSQT Cấp lại – Điều 13 (NĐ 152)' }
        };
        const meta = labelMap[loai] || labelMap['CapMoi'];
        $('#tinhTrangText').text(meta.txt);
        $('#ksqtLabel').text(meta.ksqt);
    }

    function bindNgayNhanChange() {
        $('#NgayNhanHoSo').on('change', function () {
            updateHanXuLyEditable();
            updateNgayNhanDisplay();
        });
    }

    function updateNgayNhanDisplay() {
        const v = $('#NgayNhanHoSo').val();
        $('#ngayNhanDisplay').text(v ? formatDate(v) : '—');
    }

    /**
     * Tự động điền HanXuLy theo NgayNhanHoSo + LoaiNghiepVu nhưng cho phép user sửa.
     * Chỉ overwrite nếu input HanXuLy đang trống hoặc chưa bị user chỉnh sửa thủ công.
     */
    function updateHanXuLyEditable() {
        const $han = $('#HanXuLy');
        if ($han.length === 0) return;
        const v = $('#NgayNhanHoSo').val();
        const loai = $('#loaiNghiepVuSelect').val();
        if (!v) return;

        // Nếu user đã sửa thủ công (data-user-edited), không ghi đè
        if ($han.data('user-edited')) return;

        const days = (loai === 'GiaHan' || loai === '1') ? 3 : 5;
        const d = new Date(v);
        d.setDate(d.getDate() + days);
        const iso = d.toISOString().substring(0, 10);
        $han.val(iso);
    }

    // Đánh dấu HanXuLy đã bị user sửa (để không bị overwrite khi đổi LoaiNV/NgàyNhận)
    $(document).on('change', '#HanXuLy', function () {
        $(this).data('user-edited', true);
    });

    /**
     * Sinh preview Số GXN format 075-YY-{CM|GH|CL}-NNNNNNN (chỉ display, server sẽ sinh thực tế khi save).
     */
    function updateSoGxnPreview() {
        const $prev = $('#soGxnPreview');
        if ($prev.length === 0) return;
        const loai = $('#loaiNghiepVuSelect').val();
        const yy = new Date().getFullYear().toString().slice(-2);
        const typeMap = { 'CapMoi': 'CM', '0': 'CM', 'GiaHan': 'GH', '1': 'GH', 'CapLai': 'CL', '2': 'CL' };
        const ch = typeMap[loai] || 'CM';
        $prev.text('075-' + yy + '-' + ch + '-NNNNNNN');
    }

    function formatDate(yyyyMmDd) {
        const parts = yyyyMmDd.split('-');
        if (parts.length !== 3) return yyyyMmDd;
        return parts[2] + '/' + parts[1] + '/' + parts[0];
    }

    // ---- Tab navigation ----
    function bindTabNavigation() {
        $('#btnNextTab').on('click', () => moveTab(1));
        $('#btnPrevTab').on('click', () => moveTab(-1));

        $('.tab-dot').on('click', function () {
            const idx = parseInt($(this).data('tab'), 10);
            activateTab(idx);
        });

        $('a[data-toggle="tab"][href^="#tab-"]').on('shown.bs.tab', function () {
            const idx = TAB_IDS.indexOf('#' + $(this).attr('id'));
            updateTabUI(idx);
        });
    }

    function moveTab(delta) {
        const cur = currentTabIndex();
        const next = Math.min(Math.max(cur + delta, 0), TAB_IDS.length - 1);
        activateTab(next);
    }

    function currentTabIndex() {
        for (let i = 0; i < TAB_IDS.length; i++) {
            if ($(TAB_IDS[i]).hasClass('active')) return i;
        }
        return 0;
    }

    function activateTab(idx) {
        $(TAB_IDS[idx]).tab('show');
    }

    function updateTabUI(idx) {
        $('.tab-dot').each(function (i) {
            $(this).css('background', i === idx ? 'var(--primary)' : '#cbd5e1');
            $(this).toggleClass('active', i === idx);
        });
        $('#btnPrevTab').css('display', idx === 0 ? 'none' : 'flex');
        $('#btnNextTab').css('display', idx === TAB_IDS.length - 1 ? 'none' : 'flex');
    }

    // ---- Ảnh NLĐ picker ----
    function bindAnhNLD() {
        const $btn = $('#anhNLDBtn');
        const $input = $('#anhFileInput');
        const $box = $('#anhPreviewBox');
        if ($btn.length === 0) return;

        // Hủy mọi handler đã bind trước đó (gxn-management.js cũng bind cùng selector → double trigger).
        $btn.off('click.anhpicker');
        $box.off('click.anhpicker click');
        $input.off('change.anhpicker change');

        let opening = false;
        const openPicker = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            if (opening) return;
            opening = true;
            try { $input[0].click(); } catch (_) {}
            setTimeout(() => { opening = false; }, 300);
        };
        $btn.on('click.anhpicker', openPicker);
        $box.on('click.anhpicker', function (e) {
            // Click vào button bên trong cũng bubble → bỏ qua nếu target là button.
            if ($(e.target).closest('#anhNLDBtn,#btnRemoveAnh').length) return;
            openPicker(e);
        });

        $input.on('change.anhpicker', function () {
            const file = this.files && this.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                if (window.toastr) toastr.error('Ảnh vượt quá 5MB.'); else alert('Ảnh vượt quá 5MB.');
                $(this).val('');
                return;
            }
            const okType = ['image/jpeg', 'image/jpg', 'image/png'].includes(file.type);
            if (!okType) {
                if (window.toastr) toastr.error('Chỉ chấp nhận ảnh JPG hoặc PNG.'); else alert('Chỉ chấp nhận JPG/PNG.');
                $(this).val('');
                return;
            }
            const reader = new FileReader();
            reader.onload = function (e) {
                $('#anhPreviewImg').attr('src', e.target.result).show();
                $('#anhPreviewIcon').hide();
                $('#anhPreviewText').hide();
                $('#anhWarningText').removeClass('text-warning').addClass('text-success')
                    .html('<i class="fas fa-check-circle mr-1"></i> <span>Đã chọn ảnh: ' + escapeHtml(file.name) + '</span>');
                $('#AnhNLDFileName').val(file.name);
                runRealtimeValidation();
            };
            reader.readAsDataURL(file);
        });
    }

    // ---- Enterprise Select2 (mirror /HoSoGiayPhep) ----
    // Chỉ auto-fill Tên + MST. Các trường khác của doanh nghiệp đã bỏ form.
    function initEnterpriseSelect() {
        // Dùng class selector mừng A: '.select2-enterprise' (đồng bộ với /HoSoGiayPhep).
        var $sel = $('.select2-enterprise');
        if ($sel.length === 0) {
            console.warn('[GXN] Không tìm thấy .select2-enterprise trên trang.');
            return;
        }
        if (!$.fn.select2) {
            console.error('[GXN] Thư viện Select2 chưa load. Kiểm tra _Layout.cshtml.');
            return;
        }

        // figma-ui.js đã init Select2 cơ bản (không AJAX) — destroy để đè bằng AJAX config.
        try {
            if ($sel.hasClass('select2-hidden-accessible')) {
                $sel.select2('destroy');
                console.info('[GXN] Đã destroy Select2 cơ bản — chuẩn bị gắn AJAX.');
            }
        } catch (err) {
            console.warn('[GXN] Lỗi destroy Select2 cũ:', err);
        }

        $sel.select2({
            theme: 'bootstrap4',
            width: '100%',
            placeholder: '-- Chọn doanh nghiệp NSDLĐ --',
            allowClear: true,
            minimumInputLength: 0,
            ajax: {
                url: '/gxn/dossiers/search-enterprises',
                dataType: 'json',
                delay: 250,
                data: function (params) {
                    console.debug('[GXN] Tìm doanh nghiệp:', params.term, 'page', params.page);
                    return { q: params.term || '', page: params.page || 1 };
                },
                processResults: function (data, params) {
                    params.page = params.page || 1;
                    var n = (data && data.results) ? data.results.length : 0;
                    console.debug('[GXN] Nhận', n, 'doanh nghiệp từ backend.');
                    return {
                        results: (data && data.results) || [],
                        pagination: { more: !!(data && data.pagination && data.pagination.more) }
                    };
                },
                error: function (xhr) {
                    console.error('[GXN] AJAX search-enterprises lỗi:', xhr.status, xhr.statusText, xhr.responseText && xhr.responseText.substring(0, 300));
                    if (window.toastr) {
                        toastr.error('Không tải được danh sách doanh nghiệp (HTTP ' + xhr.status + '). Vui lòng đăng nhập lại nếu phiên hết hạn.', 'Lỗi tải dữ liệu');
                    }
                },
                cache: true
            },
            templateResult: function (item) {
                if (item.loading) return item.text;
                if (!item.id) return item.text;
                var tax = item.taxCode ? '<div style="font-size:11px;color:#64748b;"><i class="fas fa-id-card mr-1"></i> MST: ' + escapeHtml(item.taxCode) + '</div>' : '';
                return $('<div><div style="font-weight:700;color:#1e293b;">' + escapeHtml(item.text) + '</div>' + tax + '</div>');
            },
            templateSelection: function (item) { return item.text || ''; }
        }).on('select2:open', function () {
            // Tự động load danh sách ngay khi mở.
            var self = $(this);
            setTimeout(function () {
                var $f = $('.select2-search__field');
                if ($f.length && !$f.val()) self.select2('search', '');
            }, 50);
        }).on('select2:select', function (e) {
            var d = e.params.data || {};
            $('#TenNsdld').val(d.text || '');
            $('#MaSoThueNsdld').val(d.taxCode || '');
            $('#EnterpriseId').trigger('change');
            runRealtimeValidation();
        }).on('select2:clear', function () {
            $('#TenNsdld').val('');
            $('#MaSoThueNsdld').val('');
            runRealtimeValidation();
        });

        console.info('[GXN] Enterprise Select2 đã gắn AJAX thành công.');
    }

    // ---- Real-time validation sidebar (req #13) ----
    function bindRealtimeValidation() {
        $('#ThoiHanHoChieu, #NgayKetThucLv, #NgayBatDauLv').on('change', runRealtimeValidation);
    }

    function runRealtimeValidation() {
        // Điều 7: Hộ chiếu > NgayKetThucLv + 6 tháng
        const hc = $('#ThoiHanHoChieu').val();
        const kt = $('#NgayKetThucLv').val();
        if (hc && kt) {
            const dHc = new Date(hc);
            const dKt = new Date(kt);
            dKt.setMonth(dKt.getMonth() + 6);
            setVldState('#vld-passport', dHc > dKt);
        }
        // Điều 17: Ngày kết thúc - bắt đầu ≤ 730 ngày
        const bd = $('#NgayBatDauLv').val();
        if (bd && kt) {
            const diff = (new Date(kt) - new Date(bd)) / (1000 * 60 * 60 * 24);
            setVldState('#vld-lv', diff > 0 && diff <= 730);
        }
        // Ảnh NLĐ
        const hasImg = $('#anhPreviewImg').is(':visible') || $('#AnhNLDPath').val();
        const $vldAnh = $('#vld-anh .vld-icon i');
        if (hasImg) {
            $vldAnh.removeClass('fa-exclamation-triangle').addClass('fa-check-circle')
                .css({ 'color': '#16a34a', 'font-size': '12px' });
            $('#vld-anh .vld-desc').removeClass('text-warning').css('color', '#16a34a').text('Đã upload');
        }
    }

    function setVldState(selector, ok) {
        const $i = $(selector + ' .vld-icon i');
        $i.removeClass('fa-circle fa-check-circle fa-times-circle')
            .addClass(ok ? 'fa-check-circle' : 'fa-times-circle')
            .css({ 'color': ok ? '#16a34a' : '#dc2626', 'font-size': '12px' });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // ====== FORM SUBMIT GUARD ======
    // Chặn submit khi client-side validation lỗi — hiện toastr và chuyển tab tới field lỗi đầu tiên.
    function initFormSubmitGuard() {
        const $form = $('#createGxnForm, #editGxnForm');
        if ($form.length === 0) return;

        $form.on('submit', function (e) {
            const $f = $(this);
            // jQuery validate (.valid()) — được emit bởi data-val-* tag helpers.
            if ($.fn.valid && !$f.valid()) {
                e.preventDefault();
                if (window.toastr) {
                    toastr.clear();
                    toastr.error('Dữ liệu không hợp lệ. Vui lòng kiểm tra lại các trường đỏ trên tất cả các tab.', 'Lỗi nhập liệu');
                }
                const $firstError = $f.find('.input-validation-error, .field-validation-error').first();
                if ($firstError.length) {
                    const $pane = $firstError.closest('.tab-pane');
                    if ($pane.length) {
                        const tabId = $pane.attr('id');
                        $('a[href="#' + tabId + '"]').tab('show');
                    }
                    setTimeout(() => { try { $firstError.focus(); } catch (_) {} }, 100);
                }
                return false;
            }
            // Lock submit button để chống double-submit.
            const $btn = $f.find('button[type="submit"]');
            $btn.prop('disabled', true);
            return true;
        });

        // Nếu server trả về ModelState errors — đọc validation summary + tất cả field errors → toast.
        var errorMsgs = [];
        $form.find('.validation-summary-errors li, .field-validation-error').each(function () {
            var t = $(this).text().trim();
            if (t && errorMsgs.indexOf(t) === -1) errorMsgs.push(t);
        });
        if (errorMsgs.length > 0 && window.toastr) {
            // Hiện toast lỗi server-side (sau postback ModelState invalid).
            toastr.error(errorMsgs.slice(0, 10).join('<br/>') + (errorMsgs.length > 10 ? '<br/>...' : ''),
                'Lỗi từ server (' + errorMsgs.length + ')',
                { allowHtml: true, timeOut: 10000, closeButton: true });
            // Auto-switch sang tab có field lỗi đầu tiên.
            var $firstErr = $form.find('.input-validation-error, .field-validation-error').first();
            if ($firstErr.length) {
                var $pane = $firstErr.closest('.tab-pane');
                if ($pane.length) {
                    $('a[href="#' + $pane.attr('id') + '"]').tab('show');
                }
            }
        }
    }

    // QUAN TRỌNG: Dùng $(document).ready để đảm bảo chạy SAU figma-ui.js (cũng dùng $(document).ready).
    // Sau đó setTimeout 0 để nhảy vào cuối task queue — figma-ui có cơ hội init Select2 cơ bản trước, ta destroy + re-init AJAX.
    $(function () {
        setTimeout(init, 0);
    });
})();

