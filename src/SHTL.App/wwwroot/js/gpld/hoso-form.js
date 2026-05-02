/**
 * hoso-form.js — Hồ Sơ GPLĐ Form (Create & Edit)
 * Handles: Tab navigation, conditional fields, real-time validation panel,
 *          HanXuLy auto-calc, photo preview
 */
(function () {
    'use strict';

    // ====== TAB NAVIGATION ======
    var TAB_LINKS = ['#tab-nld-lnk,a[href="#tab-nld"]', 'a[href="#tab-cv"]', 'a[href="#tab-giay"]', 'a[href="#tab-theo-doi"]'];
    var TAB_HREFS = ['#tab-nld', '#tab-cv', '#tab-giay', '#tab-theo-doi'];
    var currentTabIdx = 0;

    function goToTab(idx) {
        if (idx < 0 || idx >= TAB_HREFS.length) return;
        currentTabIdx = idx;
        $('a[href="' + TAB_HREFS[idx] + '"]').tab('show');
        updateTabControls();
    }

    var isSubmitting = false;

    function updateTabControls() {
        var $prev = $('#btnPrevTab');
        var $next = $('#btnNextTab');
        if ($prev.length === 0) return;

        if (currentTabIdx === 0) {
            $prev.css('display', 'none');
        } else {
            $prev.css('display', 'flex');
        }

        if (currentTabIdx === TAB_HREFS.length - 1) {
            $next.html('<i class="fas fa-save mr-1"></i> Lưu hồ sơ');
            $next.off('click.nav').on('click.nav', function () {
                if (isSubmitting) return;
                var $form = $('#createHoSoForm, #editHoSoForm').first();
                if ($form.length) $form.submit();
            });
        } else {
            $next.html('Tiếp <i class="fas fa-chevron-right ml-1"></i>');
            $next.off('click.nav').on('click.nav', function () { goToTab(currentTabIdx + 1); });
        }

        // Update dots
        $('.tab-dot').each(function () {
            var tabIdx = parseInt($(this).data('tab'));
            $(this).css('background', tabIdx === currentTabIdx ? 'var(--primary)' : '#cbd5e1');
        });
    }

    function initTabs() {
        $('#btnNextTab').on('click.nav', function () { goToTab(currentTabIdx + 1); });
        $('#btnPrevTab').on('click.nav', function () { goToTab(currentTabIdx - 1); });

        $('.tab-dot').on('click', function () {
            goToTab(parseInt($(this).data('tab')));
        });

        // Sync currentTabIdx when tab link clicked
        $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
            var href = $(e.target).attr('href');
            var idx = TAB_HREFS.indexOf(href);
            if (idx >= 0) {
                currentTabIdx = idx;
                updateTabControls();
            }
        });

        updateTabControls();
    }

    // ====== LOAI NGHIEP VU → TAB 3 DISPLAY + CONDITIONAL FIELDS ======
    function getLoaiNghiepVu() {
        return $('#loaiNghiepVuSelect').val() || '1';
    }

    const LOAI_NGHIEP_VU = {
        CAP_MOI: '1',
        GIA_HAN: '2',
        CAP_LAI: '3'
    };

    function updateConditionalFields(fromUserChange) {
        var loai = getLoaiNghiepVu();
        var isCapMoi = (loai === LOAI_NGHIEP_VU.CAP_MOI);
        var isGiaHan = (loai === LOAI_NGHIEP_VU.GIA_HAN);
        var isCapLai = (loai === LOAI_NGHIEP_VU.CAP_LAI);

        // Tuyển dụng: CapMoi + CapLai
        $('#tuyen-dung-fields').toggle(isCapMoi || isCapLai);

        // Extra CapMoi only: KSKK, LLTP, KinhNghiem, BangCap
        $('#cap-moi-extra').toggle(isCapMoi);

        // GPLĐ cũ: GiaHan + CapLai
        $('#gpld-cu-fields').toggle(isGiaHan || isCapLai);

        // CapLai only
        $('#cap-lai-fields').toggle(isCapLai);

        // Tab 3: Tình trạng display
        var labelMap = (window.AppEnums && window.AppEnums.HoSoLoaiNghiepVu) || { CapMoi: 'Cấp mới', GiaHan: 'Gia hạn', CapLai: 'Cấp lại' };
        $('#tinhTrangText').text(labelMap[loai] || loai);

        // Tab 3: KSQT label
        var ksqtMap = (window.AppEnums && window.AppEnums.KSQTLoaiNghiepVu) || {
            CapMoi: 'KSQT Cấp mới – Điều 18',
            GiaHan: 'KSQT Gia hạn – Điều 20',
            CapLai: 'KSQT Cấp lại – Điều 21'
        };
        $('#ksqtLabel').text(ksqtMap[loai] || '');

        // Update KSKK/LLTP sidebar visibility
        if (!isCapMoi) {
            if (typeof setVldItem === 'function') {
                setVldItem('vld-kskk', 'na', 'Không áp dụng');
                setVldItem('vld-lltp', 'na', 'Không áp dụng');
            }
        } else {
            checkKSKK();
            checkLLTP();
        }

        calcHanXuLy();
        updateTabFourDisplay();
        updateSuggestedSoGPLD(fromUserChange);
        updateValidationRules(isGiaHan, isCapLai);
    }

    // ====== DINAMIC VALIDATION RULES ======
    function updateValidationRules(isGiaHan, isCapLai) {
        var $form = $('#createHoSoForm, #editHoSoForm');
        if (!$form.length) return;

        // Fields for GiaHan or CapLai
        var conditionalFields = ['#SoGPLDCu', '#NgayBatDauCu', '#NgayKetThucCu'];
        var isGiaHanOrCapLai = isGiaHan || isCapLai;

        conditionalFields.forEach(function (selector) {
            var $el = $(selector);
            if (isGiaHanOrCapLai) {
                $el.attr('required', 'required');
                $el.attr('data-val-required', 'Trường này là bắt buộc cho nghiệp vụ Gia hạn/Cấp lại');
            } else {
                $el.removeAttr('required');
                $el.removeAttr('data-val-required');
                // Clear error message if hidden
                $el.removeClass('is-invalid');
                $form.validate().element(selector);
            }
        });
        $('.asterisk-conditional').toggle(isGiaHanOrCapLai);

        // Fields for CapLai only
        var capLaiFields = ['#ThongTinCuThayDoi', '#LyDoCapLai'];
        capLaiFields.forEach(function (selector) {
            var $el = $(selector);
            if (isCapLai) {
                $el.attr('required', 'required');
                $el.attr('data-val-required', 'Trường này là bắt buộc cho nghiệp vụ Cấp lại');
            } else {
                $el.removeAttr('required');
                $el.removeAttr('data-val-required');
                $el.removeClass('is-invalid');
                $form.validate().element(selector);
            }
        });
        $('.asterisk-cap-lai').toggle(isCapLai);

        // Re-parse unobtrusive validation
        $form.removeData("validator").removeData("unobtrusiveValidation");
        $.validator.unobtrusive.parse($form);
        if ($form.data("validator")) {
            $form.data("validator").settings.ignore = [];
        }
    }

    // ====== AUTO-FETCH SUGGESTED SoGPLD ======
    function updateSuggestedSoGPLD(fromUserChange) {
        var loai = getLoaiNghiepVu();
        var isCreateForm = $('#createHoSoForm').length > 0;
        var isEditForm = $('#editHoSoForm').length > 0;

        // In Edit mode, only suggest if the user explicitly changed the type
        if (isEditForm && !fromUserChange) return;

        if (!isCreateForm && !isEditForm) return;

        $.ajax({
            url: '/HoSoGiayPhep/GetSuggestedNumber?loai=' + loai,
            type: 'GET',
            success: function (res) {
                if (res && res.success) {
                    $('#SoGPLD').val(res.value);
                }
            },
            error: function (err) {
                console.error('Error fetching suggested number:', err);
            }
        });
    }

    // ====== TAB 4 DISPLAY (mirrors Section 1 values) ======
    function updateTabFourDisplay() {
        var maHoSo = $('#MaHoSo').val() || '';
        $('#maHoSoDisplay').text(maHoSo);

        var ngayNhan = $('#NgayNhan').val();
        if (ngayNhan) {
            var d = new Date(ngayNhan);
            $('#ngayNhanDisplay').text(d.toLocaleDateString('vi-VN'));
        }
    }

    // ====== HAN XU LY AUTO-CALC ======
    function calcHanXuLy() {
        var ngayNhan = $('#NgayNhan').val();
        if (!ngayNhan) { $('#hanXuLyDisplay').text('—'); return; }
        var loai = getLoaiNghiepVu();
        var addDays = (loai === LOAI_NGHIEP_VU.CAP_LAI) ? 3 : 5;
        var d = new Date(ngayNhan);
        d.setDate(d.getDate() + addDays);
        var today = new Date(); today.setHours(0, 0, 0, 0);
        var isQuaHan = d < today;
        var str = d.toLocaleDateString('vi-VN') + (isQuaHan ? ' (quá hạn)' : '');
        $('#hanXuLyDisplay').text(str).css('color', isQuaHan ? '#dc2626' : '#d97706');
    }

    // ====== parseDate helper ======
    function parseDate(selector) {
        var val = $(selector).val();
        if (!val) return null;
        return new Date(val);
    }

    // ====== VALIDATION PANEL ======
    var statusCfg = {
        pending: { iconClass: 'fa-circle', color: '#94a3b8' },
        pass: { iconClass: 'fa-check-circle', color: '#16a34a' },
        fail: { iconClass: 'fa-times-circle', color: '#dc2626' },
        warn: { iconClass: 'fa-exclamation-triangle', color: '#d97706' },
        na: { iconClass: 'fa-minus-circle', color: '#94a3b8' }
    };

    function setVldItem(id, status, desc) {
        var $item = $('#' + id);
        if ($item.length === 0) return;
        var cfg = statusCfg[status] || statusCfg['pending'];
        $item.find('.vld-icon i')
            .attr('class', 'fas ' + cfg.iconClass)
            .css({ color: cfg.color, 'font-size': status === 'pending' || status === 'na' ? '8px' : '12px' });
        $item.find('.vld-desc').text(desc).css('color',
            status === 'pass' ? '#16a34a' : status === 'fail' ? '#dc2626' : status === 'warn' ? '#d97706' : '#6b7280'
        );
    }

    // BR-01: HanHoChieu > NgayKetThuc + 6 months → BLOCK
    function checkBR01() {
        var hanHC = parseDate('#HanHoChieu');
        var ngayKT = parseDate('#NgayKetThuc');
        if (!hanHC || !ngayKT) {
            setVldItem('vld-br01', 'pending', 'Chờ nhập ngày Hộ chiếu & KT GPLĐ');
            $('#br01-indicator').hide();
            return;
        }
        var threshold = new Date(ngayKT);
        threshold.setMonth(threshold.getMonth() + 6);
        if (hanHC > threshold) {
            setVldItem('vld-br01', 'pass', 'Còn hạn đủ (>' + formatDateVI(threshold) + ')');
            $('#br01-indicator').show().html('<span class="text-success"><i class="fas fa-check-circle mr-1"></i>Còn hạn đủ (BR-01)</span>');
        } else {
            var diff = Math.ceil((threshold - hanHC) / 86400000);
            setVldItem('vld-br01', 'fail', 'Vi phạm – HC hết hạn trước ' + diff + ' ngày');
            $('#br01-indicator').show().html('<span class="text-danger"><i class="fas fa-times-circle mr-1"></i>Vi phạm BR-01 – thiếu ' + diff + ' ngày</span>');
        }
    }

    // BR-02: NgayKetThuc – NgayBatDau ≤ 730 days → BLOCK
    function checkBR02() {
        var ngayBD = parseDate('#NgayBatDau');
        var ngayKT = parseDate('#NgayKetThuc');
        if (!ngayBD || !ngayKT) {
            setVldItem('vld-br02', 'pending', 'Chờ nhập ngày BĐ & KT');
            $('#br02-indicator').hide();
            return;
        }
        var days = Math.ceil((ngayKT - ngayBD) / 86400000);
        if (days <= 0) {
            setVldItem('vld-br02', 'fail', 'Ngày KT phải sau ngày BĐ');
            $('#br02-indicator').show().html('<span class="text-danger"><i class="fas fa-times-circle mr-1"></i>Ngày KT phải sau ngày BĐ</span>');
        } else if (days <= 730) {
            setVldItem('vld-br02', 'pass', 'Hợp lệ – ' + days + ' ngày (≤730)');
            $('#br02-indicator').hide();
        } else {
            setVldItem('vld-br02', 'fail', 'Vi phạm – ' + days + ' ngày (>730 ngày tối đa)');
            $('#br02-indicator').show().html('<span class="text-danger"><i class="fas fa-times-circle mr-1"></i>Vi phạm BR-02 – ' + days + '/730 ngày</span>');
        }
    }

    // KSKK: NgayNhan – NgayCapKSKK ≤ 365 days → BLOCK (CapMoi only)
    function checkKSKK() {
        var loai = getLoaiNghiepVu();
        if (loai !== LOAI_NGHIEP_VU.CAP_MOI) { setVldItem('vld-kskk', 'na', 'Không áp dụng'); return; }
        var ngayNhan = parseDate('#NgayNhan');
        var ngayCapKSKK = parseDate('#NgayCapKSKK');
        if (!ngayNhan || !ngayCapKSKK) {
            setVldItem('vld-kskk', 'pending', 'Chờ nhập ngày cấp KSKK');
            return;
        }
        var diffDays = Math.ceil((ngayNhan - ngayCapKSKK) / 86400000);
        if (diffDays <= 365) {
            setVldItem('vld-kskk', 'pass', 'Còn ' + (365 - diffDays) + ' ngày hiệu lực');
        } else {
            setVldItem('vld-kskk', 'fail', 'Vi phạm – Quá ' + (diffDays - 365) + ' ngày (>365)');
        }
    }

    // LLTP: NgayNhan – NgayCapLLTP ≤ 180 days → WARNING (CapMoi only)
    function checkLLTP() {
        var loai = getLoaiNghiepVu();
        if (loai !== LOAI_NGHIEP_VU.CAP_MOI) { setVldItem('vld-lltp', 'na', 'Không áp dụng'); return; }
        var ngayNhan = parseDate('#NgayNhan');
        var ngayCapLLTP = parseDate('#NgayCapLLTP');
        if (!ngayNhan || !ngayCapLLTP) {
            setVldItem('vld-lltp', 'pending', 'Chờ nhập ngày cấp LLTP');
            return;
        }
        var diffDays = Math.ceil((ngayNhan - ngayCapLLTP) / 86400000);
        if (diffDays <= 180) {
            setVldItem('vld-lltp', 'warn', diffDays + ' ngày (hợp lệ, ≤180)');
        } else {
            setVldItem('vld-lltp', 'warn', 'Quá hạn – ' + diffDays + ' ngày (>180)');
        }
    }

    // Ảnh NLĐ: check if file selected
    function checkAnh() {
        var hasFile = ($('#AnhNLDPath').val() || '') !== '' || ($('#anhFileInput')[0] && $('#anhFileInput')[0].files.length > 0);
        if (hasFile) {
            setVldItem('vld-anh', 'pass', 'Đã có ảnh');
        } else {
            setVldItem('vld-anh', 'warn', 'Chưa upload (không chặn nộp)');
        }
    }

    function runAllChecks() {
        checkBR01();
        checkBR02();

        var loai = getLoaiNghiepVu();
        if (loai === LOAI_NGHIEP_VU.CAP_MOI) {
            checkKSKK();
            checkLLTP();
        }
        checkAnh();
    }

    // ====== DEBOUNCE ======
    function debounce(fn, wait) {
        var timer;
        return function () {
            clearTimeout(timer);
            timer = setTimeout(fn, wait);
        };
    }
    var debouncedChecks = debounce(runAllChecks, 500);

    // ====== PHOTO PREVIEW ======
    function initPhotoPreview() {

        $('#anhFileInput').on('change', function () {
            var file = this.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                alert('File ảnh vượt quá 5MB. Vui lòng chọn file nhỏ hơn.');
                this.value = '';
                return;
            }
            var reader = new FileReader();
            reader.onload = function (e) {
                $('#anhPreviewImg').attr('src', e.target.result).show();
                $('#anhPreviewIcon').hide();
                $('#anhPreviewText').hide();
                $('#anhWarningText')
                    .removeClass('text-warning').addClass('text-success')
                    .html('<i class="fas fa-check-circle mr-1"></i>Đã chọn: ' + file.name);
                setVldItem('vld-anh', 'pass', 'Đã upload: ' + file.name);
                
                // Clear remove flag if a new file is selected
                $('#RemoveExistingFile').val('false');
            };
            reader.readAsDataURL(file);
        });

        $('#anhPreviewBox').on('click', function () {
            $('#anhFileInput').trigger('click');
        });

        $('#btnRemoveAnh').on('click', function (e) {
            e.stopPropagation();
            if (confirm('Bạn có chắc chắn muốn gỡ bỏ ảnh hiện tại?')) {
                $('#RemoveExistingFile').val('true');
                $('#AnhNLDPath').val('');
                $('#AnhNLDFileName').val('');
                
                // Reset preview UI
                $('#anhPreviewImg').attr('src', '').hide();
                $('#anhPreviewIcon').show();
                $('#anhPreviewText').show();
                $(this).hide();
                
                $('#anhWarningText')
                    .removeClass('text-success').addClass('text-warning')
                    .html('<i class="fas fa-exclamation-triangle mr-1"></i>Chưa cập nhật ảnh chân dung');
                
                setVldItem('vld-anh', 'warn', 'Chưa upload (không chặn nộp)');
                
                // Clear file input too
                $('#anhFileInput').val('');
            }
        });
    }

    // ====== FORMAT DATE VI ======
    function formatDateVI(date) {
        if (!date) return '';
        return date.toLocaleDateString('vi-VN');
    }

    // ====== UPPERCASE FULL NAME ======
    function initUppercase() {
        $('#HoVaTen').on('input', function () {
            var pos = this.selectionStart;
            this.value = this.value.toUpperCase();
            this.setSelectionRange(pos, pos);
        });
    }

    // ====== FORM SUBMIT GUARD (BLOCK if BR violations) ======
    function initFormSubmitGuard() {
        $('#createHoSoForm, #editHoSoForm').on('submit', function (e) {
            if (isSubmitting) {
                e.preventDefault();
                return false;
            }

            //// Check BR-01
            //var ngayKT = parseDate('#NgayKetThuc');
            //var hanHC = parseDate('#HanHoChieu');
            //if (hanHC && ngayKT) {
            //    var threshold = new Date(ngayKT);
            //    threshold.setMonth(threshold.getMonth() + 6);
            //    if (hanHC <= threshold) {
            //        if (!confirm('Cảnh báo: Hộ chiếu vi phạm BR-01. Hồ sơ sẽ bị từ chối. Bạn vẫn muốn lưu?')) {
            //            e.preventDefault();
            //            goToTab(0);
            //            return false;
            //        }
            //    }
            //}

            //// Check BR-02
            //var ngayBD = parseDate('#NgayBatDau');
            //if (ngayBD && ngayKT) {
            //    var days = Math.ceil((ngayKT - ngayBD) / 86400000);
            //    if (days > 730) {
            //        if (!confirm('Cảnh báo: Thời hạn GPLĐ vi phạm BR-02 (' + days + ' ngày). Bạn vẫn muốn lưu?')) {
            //            e.preventDefault();
            //            goToTab(1);
            //            return false;
            //        }
            //    }
            //}

            // ALL PASS -> Submit
            if (!$(this).valid()) {
                toastr.clear();
                toastr.error('Dữ liệu không hợp lệ. Vui lòng kiểm tra lại các trường đỏ trên tất cả các tab.', 'Lỗi nhập liệu');
                
                // Tự động tìm field lỗi đầu tiên và chuyển Tab nếu cần
                var $firstError = $(this).find('.input-validation-error, .error').first();
                if ($firstError.length) {
                    var $pane = $firstError.closest('.tab-pane');
                    if ($pane.length) {
                        var tabId = $pane.attr('id');
                        $('a[href="#' + tabId + '"]').tab('show');
                    }
                    $firstError.focus();
                }
                return false;
            }

            isSubmitting = true;
            var $btn = $('#btnNextTab');
            $btn.attr('disabled', 'disabled').html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');
            
            Swal.fire({
                title: 'Đang lưu hồ sơ...',
                text: 'Vui lòng chờ trong giây lát',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
        });
    }

    // ====== INIT ======
    $(function () {
        // Bật kiểm tra lỗi cho cả trường ẩn (Select2, Hidden fields)
        if ($.validator) {
            $.validator.setDefaults({ ignore: [] });
        }

        initTabs();
        initPhotoPreview();
        initUppercase();
        initFormSubmitGuard();

        // Trigger initial state
        updateConditionalFields(false);
        runAllChecks();
        calcHanXuLy();
        updateTabFourDisplay();

        // Bind events
        $('.select2').on('change', function() {
            $(this).valid();
        });
        $('#loaiNghiepVuSelect').on('change', function () {
            updateConditionalFields(true);
            debouncedChecks();
            calcHanXuLy();
        });

        $('#NgayNhan').on('change', function () {
            calcHanXuLy();
            updateTabFourDisplay();
            debouncedChecks();
        });

        $('#MaHoSo').on('input', updateTabFourDisplay);

        $('#HanHoChieu, #NgayKetThuc').on('change', function () {
            debouncedChecks();
        });

        $('#NgayBatDau, #NgayKetThuc').on('change', function () {
            debouncedChecks();
        });

        $('#NgayCapKSKK').on('change', function () {
            checkKSKK();
        });

        $('#NgayCapLLTP').on('change', function () {
            checkLLTP();
        });

        $('#anhFileInput').on('change', function () {
            checkAnh();
        });

        initValidationSwitchTab();
        initEnterpriseSelect();
    });

    // ====== TAB-SWITCH ON VALIDATION ERROR ======
    function initValidationSwitchTab() {
        var $form = $('#createHoSoForm, #editHoSoForm');
        // Hook into jQuery Validation invalid-form event
        $form.on('invalid-form.validate', function (event, validator) {
            var errors = validator.numberOfInvalids();
            if (errors) {
                // Show standard Toast (clear existing ones first to avoid duplicates)
                toastr.clear();
                // toastr.error removed per plan

                // Get the first invalid element
                var firstErrorField = validator.errorList[0].element;
                var $tabPane = $(firstErrorField).closest('.tab-pane');
                if ($tabPane.length) {
                    var tabId = $tabPane.attr('id');
                    var $tabLink = $('a[href="#' + tabId + '"]');
                    if ($tabLink.length) {
                        $tabLink.tab('show');
                        
                        // Scroll to the error element slightly
                        $('html, body').animate({
                            scrollTop: $(firstErrorField).offset().top - 150
                        }, 500);
                        
                        $(firstErrorField).focus();
                    }
                }
            }
        });
    }

    // ====== ENTERPRISE SELECT2 & AUTO-FILL ======
    function initEnterpriseSelect() {
        var $select = $('.select2-enterprise');
        if ($select.length === 0) return;

        // Nếu đã được figma-ui.js khởi tạo trước đó, ta sẽ khởi tạo lại với AJAX
        if ($select.hasClass('select2-hidden-accessible')) {
            $select.select2('destroy');
        }

        $select.select2({
            theme: 'bootstrap4',
            width: '100%',
            placeholder: '-- Chọn doanh nghiệp --',
            allowClear: true,
            ajax: {
                url: '/HoSoGiayPhep/SearchEnterprises',
                dataType: 'json',
                delay: 250,
                data: function (params) {
                    return {
                        q: params.term,
                        page: params.page || 1
                    };
                },
                processResults: function (data, params) {
                    params.page = params.page || 1;
                    return {
                        results: data.results,
                        pagination: {
                            more: data.pagination.more
                        }
                    };
                },
                cache: true
            },
            minimumInputLength: 0,
            templateResult: formatEnterprise,
            templateSelection: formatEnterpriseSelection
        }).on('select2:open', function() {
            // Tự động tìm kiếm để hiện kết quả ngay khi mở (dành cho AJAX)
            var self = $(this);
            setTimeout(function() {
                var searchField = $('.select2-search__field');
                if (searchField.length > 0 && !searchField.val()) {
                    self.select2('search', '');
                }
            }, 50);
        }).on('select2:select', function (e) {
            var data = e.params.data;
            if (data) {
                // Auto-fill hidden name field
                $('#TenNSDLD').val(data.text);
                // Auto-fill Tax Code
                $('#MaSoThue').val(data.taxCode || '');
                // Auto-fill Address
                $('#DiaChiTruSo').val(data.address || '');
                
                // Quan trọng: Trigger change để validator nhận biết giá trị mới
                $('#EnterpriseId').trigger('change');
            }
        }).on('select2:clear', function () {
            $('#TenNSDLD').val('');
            $('#MaSoThue').val('');
            $('#DiaChiTruSo').val('');
        });
    }

    function formatEnterprise(repo) {
        if (repo.loading) return repo.text;
        var $container = $(
            "<div class='select2-result-enterprise clearfix'>" +
            "<div class='select2-result-enterprise__title' style='font-weight:700; font-size:13px; color:#1e293b;'>" + repo.text + "</div>" +
            "<div class='select2-result-enterprise__details' style='font-size:11px; color:#64748b;'>" +
            "<span><i class='fas fa-id-card mr-1'></i> MST: " + (repo.taxCode || '—') + "</span>" +
            "<span class='ml-3'><i class='fas fa-map-marker-alt mr-1'></i> " + (repo.address || '—') + "</span>" +
            "</div>" +
            "</div>"
        );
        return $container;
    }

    function formatEnterpriseSelection(repo) {
        return repo.text || repo.id;
    }

})();
