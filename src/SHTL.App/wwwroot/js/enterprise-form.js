/* ═══════════════════════════════════════════════════════
   Enterprise Form – Tab switching, DN type toggle,
   auto-sum, calc-diff, toggle-bool, auto-fill, validation
   Common event handlers via class + data-attribute pattern
   ═══════════════════════════════════════════════════════ */

$(function () {

    // Đảm bảo jQuery Validate không bỏ qua các <select> bị ẩn bởi Select2
    // (chỉ bỏ qua input[type="hidden"] thực sự, không bỏ qua select)
    // Đồng thời bỏ qua tất cả input trong .ent-hidden-f (các field ẩn do toggle FDI/VN)
    $.validator.setDefaults({ ignore: ':input[type="hidden"], .ent-hidden-f :input' });

    // ─── FLATPICKR DATE INPUTS (dd/mm/yyyy) ─────────────────
    if (typeof flatpickr !== 'undefined') {
        flatpickr('.ent-date-input', {
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd/m/Y',
            allowInput: true,
            locale: {
                firstDayOfWeek: 1,
                weekdays: {
                    shorthand: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
                    longhand: ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']
                },
                months: {
                    shorthand: ['Th01', 'Th02', 'Th03', 'Th04', 'Th05', 'Th06', 'Th07', 'Th08', 'Th09', 'Th10', 'Th11', 'Th12'],
                    longhand: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12']
                }
            },
            onReady: function (selectedDates, dateStr, instance) {
                instance.altInput.placeholder = 'dd/mm/yyyy';
            }
        });
    }

    // ─── SELECT2 STATUS DOT RE-FIRE ON CHANGE ───────────────
    if (typeof $.fn.select2 !== 'undefined') {
        $('#projectStatus').on('change.select2', updateStatusDot);
    }

    // ═══════════════════════════════════════════════════════
    //  DN TYPE TOGGLE (FDI / VN) ↔ EnterpriseType select
    //  LD (Liên doanh) → cùng nhóm VN: toggle VN, hiện/ẩn giống TN
    // ═══════════════════════════════════════════════════════
    function applyDNType(type) {
        var isFDI = type === 'FDI';
        $('.ent-fdi-only').toggleClass('ent-hidden-f', !isFDI);
        $('.ent-vn-only').toggleClass('ent-hidden-f', isFDI);
    }

    // Ánh xạ giá trị EnterpriseType → nhóm toggle:
    // TN, LD → 'VN'; FDI hoặc rỗng → 'FDI'
    function entTypeToToggle(val) {
        return (val === 'TN' || val === 'LD') ? 'VN' : 'FDI';
    }

    // Toggle radio → sync EnterpriseType select + visibility
    $('input[name="dnTypeToggle"]').on('change', function () {
        var toggleVal = $(this).val(); // 'FDI' hoặc 'VN'
        applyDNType(toggleVal);
        // Khi bật FDI → sựa select thành FDI
        // Khi bật VN → giữ LD nếu đang là LD, còn lại set TN
        if (toggleVal === 'FDI') {
            $('#enterpriseType').val('FDI').trigger('change.select2');
        } else {
            var curEnt = $('#enterpriseType').val();
            if (curEnt !== 'LD') {
                $('#enterpriseType').val('TN').trigger('change.select2');
            }
        }
    });

    // EnterpriseType select → sync toggle radio + visibility
    // LD (Liên doanh) → mặc định toggle VN, càc sự kiện ẩn/hiện giống TN
    $('#enterpriseType').on('change', function () {
        var val = $(this).val();
        var toggleVal = entTypeToToggle(val);
        $('input[name="dnTypeToggle"][value="' + toggleVal + '"]').prop('checked', true);
        applyDNType(toggleVal);
    });

    // Initialize DN type on load (từ EnterpriseType select hoặc toggle radio)
    var initEntType = $('#enterpriseType').val();
    if (initEntType) {
        // Edit mode: EnterpriseType đã có giá trị từ model binding
        var initToggle = entTypeToToggle(initEntType);
        $('input[name="dnTypeToggle"][value="' + initToggle + '"]').prop('checked', true);
        applyDNType(initToggle);
    } else {
        // Create mode: lấy từ toggle radio
        var checkedToggle = $('input[name="dnTypeToggle"]:checked').val() || 'FDI';
        applyDNType(checkedToggle);
        var defaultSelect = checkedToggle === 'VN' ? 'TN' : 'FDI';
        $('#enterpriseType').val(defaultSelect).trigger('change.select2');
    }

    // ═══════════════════════════════════════════════════════
    //  TOGGLE BOOL (common handler)
    //  Uses: class="ent-toggle-bool"
    //        data-on-text="..."  data-off-text="..."
    //        data-label-target="#lblXxx"
    //        data-toggle-panel="#panelId" (optional)
    // ═══════════════════════════════════════════════════════
    $(document).on('change', '.ent-toggle-bool', function () {
        var $cb = $(this);
        var checked = $cb.is(':checked');
        var labelTarget = $cb.data('label-target');
        var panelTarget = $cb.data('toggle-panel');

        // Update label text
        if (labelTarget) {
            var text = checked ? $cb.data('on-text') : $cb.data('off-text');
            $(labelTarget).text(text);
        }

        // Toggle panel visibility with slide animation
        if (panelTarget) {
            if (checked) {
                $(panelTarget).slideDown(200);
            } else {
                $(panelTarget).slideUp(200);
            }
        }
    });

    // ═══════════════════════════════════════════════════════
    //  AUTO-SUM (common handler)
    //  Uses: class="ent-autosum-input"
    //        data-sum-group="groupName"
    //        data-sum-field="prev|cur"
    //  Result: data-sum-group="groupName" data-sum-role="result"
    // ═══════════════════════════════════════════════════════
    $(document).on('input', '.ent-autosum-input', function () {
        var group = $(this).data('sum-group');
        if (!group) return;

        var $prev = $('[data-sum-group="' + group + '"][data-sum-field="prev"]');
        var $cur = $('[data-sum-group="' + group + '"][data-sum-field="cur"]');
        var $result = $('[data-sum-group="' + group + '"][data-sum-role="result"]');

        var a = parseFloat(String($prev.val()).replace(/[^0-9.-]/g, '')) || 0;
        var b = parseFloat(String($cur.val()).replace(/[^0-9.-]/g, '')) || 0;
        $result.val(a + b);
    });

    // ═══════════════════════════════════════════════════════
    //  CALC-DIFF (common handler for labor-type subtraction)
    //  Uses: class="ent-calc-diff-input"
    //        data-diff-group="groupName"
    //        data-diff-field="current|previous"
    //  Result: data-diff-group="groupName" data-diff-role="result"
    // ═══════════════════════════════════════════════════════
    $(document).on('input', '.ent-calc-diff-input', function () {
        var group = $(this).data('diff-group');
        if (!group) return;

        var $current = $('[data-diff-group="' + group + '"][data-diff-field="current"]');
        var $previous = $('[data-diff-group="' + group + '"][data-diff-field="previous"]');
        var $result = $('[data-diff-group="' + group + '"][data-diff-role="result"]');

        var c = parseInt($current.val()) || 0;
        var p = parseInt($previous.val()) || 0;
        $result.val(c - p);
    });

    // ═══════════════════════════════════════════════════════
    //  CALC END-DATE (Duration + License date → End date)
    //  Uses: class="ent-calc-end-date"
    //        data-partner="#dateInputId"
    //        data-target="#endDateId"
    // ═══════════════════════════════════════════════════════
    function calcEndDate($trigger) {
        var partnerId = $trigger.data('partner');
        var targetId = $trigger.data('target');
        if (!partnerId || !targetId) return;

        var dateVal = $(partnerId).val();
        var years = parseInt($trigger.val());

        if (dateVal && years > 0) {
            var d = new Date(dateVal);
            d.setFullYear(d.getFullYear() + years);
            $(targetId).val(d.toISOString().split('T')[0]);
            // Refresh flatpickr if present
            var fp = $(targetId)[0] && $(targetId)[0]._flatpickr;
            if (fp) fp.setDate(d, true);
        } else {
            $(targetId).val('');
        }
    }

    $(document).on('input', '.ent-calc-end-date', function () {
        calcEndDate($(this));
    });

    // Also recalculate when the partner date changes
    $('#originalLicenseDate').on('change', function () {
        var $durationInput = $('.ent-calc-end-date[data-partner="#originalLicenseDate"]');
        if ($durationInput.length) calcEndDate($durationInput);
    });

    // ═══════════════════════════════════════════════════════
    //  KCN AUTO-FILL HIDDEN NAME
    // ═══════════════════════════════════════════════════════
    function syncKcnName(selectId, nameId) {
        var $sel = $('#' + selectId);
        $sel.on('change', function () {
            var txt = $(this).find('option:selected').text();
            var blank = txt.indexOf('—') !== -1 || $(this).val() === '';
            $('#' + nameId).val(blank ? '' : txt);
        });
        var selTxt = $sel.find('option:selected').text();
        var $name = $('#' + nameId);
        if ($sel.val() && selTxt.indexOf('—') === -1 && !$name.val()) {
            $name.val(selTxt);
        }
    }
    syncKcnName('tab2IndustrialZone', 'tab2IndustrialZoneName');

    // Sync Tab2 KCN selection to Tab1 hidden fields
    $('#tab2IndustrialZone').on('change', function () {
        $('#tab1IndustrialZone').val($(this).val());
        var txt = $(this).find('option:selected').text();
        var blank = txt.indexOf('—') !== -1 || $(this).val() === '';
        $('#tab1IndustrialZoneName').val(blank ? '' : txt);
    });

    // ═══════════════════════════════════════════════════════
    //  VSIC cấp 4 select2 → auto-fill cấp 2, tên ngành, mã BC
    // ═══════════════════════════════════════════════════════
    $('#industryCode4').on('select2:select', function (e) {
        var data = e.params.data;
        var code = data.id || '';
        // Tách tên ngành từ text “CODE – Tên ngành”
        var text = data.text || '';
        var namePart = text.indexOf('–') !== -1
            ? text.substring(text.indexOf('–') + 1).trim()
            : text;

        $('#industryCode2').val(code.length >= 2 ? code.substring(0, 2) : '');
        $('#industryReportCode').val(code ? 'MA-' + code : '');
        $('#IndustryName').val(namePart);
    });

    // Xóa chọn VSIC → xóa các trường liên quan
    $('#industryCode4').on('select2:clear', function () {
        $('#industryCode2').val('');
        $('#industryReportCode').val('');
        $('#IndustryName').val('');
    });

    // ═══════════════════════════════════════════════════════
    //  TAB SWITCHING
    // ═══════════════════════════════════════════════════════
    $('.ent-tab-btn').on('click', function () {
        var targetId = $(this).data('tab');
        $('.ent-tab-btn').removeClass('active');
        $(this).addClass('active');
        $('.ent-tab-pane').removeClass('active');
        $('#' + targetId).addClass('active');
    });

    // ─── SECTION COLLAPSE ───────────────────────────────────
    window.toggleEntSection = function (header) {
        var $header = $(header);
        var $body = $header.next('.ent-section-body');
        var $icon = $header.find('.ent-section-toggle');
        $body.slideToggle(200);
        $icon.toggleClass('collapsed');
    };

    // ═══════════════════════════════════════════════════════
    //  STATUS DOT COLORING
    // ═══════════════════════════════════════════════════════
    var statusClasses = {
        'Active': 's-active',
        'Suspended': 's-pending',
        'Developing': 's-developing',
        'Dissolved': 's-dissolved'
    };

    function updateStatusDot() {
        var $wrap = $('#projectStatusWrap');
        var val = $('#projectStatus').val();
        $wrap.removeClass('s-active s-pending s-developing s-dissolved');
        if (val && statusClasses[val]) {
            $wrap.addClass(statusClasses[val]);
        }
    }

    $('#projectStatus').on('change', updateStatusDot);
    updateStatusDot();

    // ═══════════════════════════════════════════════════════
    //  CNHT — khởi tạo bởi Utils.renderSelect2Ajax() qua class "select2-ajax"
    //  (data-url và data-selected-value được khai báo trực tiếp trên element)
    //  Sync tên CNHT → hidden field khi người dùng chọn
    // ═══════════════════════════════════════════════════════
    $('#cnhtSelect').on('select2:select', function (e) {
        $('#supportingIndustryNameHidden').val(e.params.data.text || '');
    });
    $('#cnhtSelect').on('select2:unselecting select2:clear', function () {
        $('#supportingIndustryNameHidden').val('');
    });

    // ═══════════════════════════════════════════════════════
    //  CROSS-TAB VALIDATION
    // ═══════════════════════════════════════════════════════
    function hasInvalidFields(tabId) {
        return $('#' + tabId).find('.input-validation-error').length > 0;
    }

    function switchToTab(tabId) {
        $('.ent-tab-btn[data-tab="' + tabId + '"]').click();
    }

    function markTabError(tabId, hasError) {
        var $btn = $('.ent-tab-btn[data-tab="' + tabId + '"]');
        $btn.toggleClass('ent-tab-has-error', hasError);
    }

    function updateErrorBadges() {
        var t1 = $('#ent-tab1').find('.input-validation-error').length;
        var t2 = $('#ent-tab2').find('.input-validation-error').length;
        if (t1 > 0) { $('#eb1').text(t1).addClass('show'); } else { $('#eb1').removeClass('show'); }
        if (t2 > 0) { $('#eb2').text(t2).addClass('show'); } else { $('#eb2').removeClass('show'); }
    }

    setTimeout(function () {
        var $form = $('#enterpriseForm').length ? $('#enterpriseForm') : $('#projectForm');
        if (!$form.length) return;
        var validator = $form.data('validator');
        if (!validator) return;

        // Cho phép validate các <select> bị ẩn bởi Select2 (không ignore chúng)
        // Nhưng vẫn bỏ qua field trong .ent-hidden-f (toggle FDI/VN đang ẩn)
        validator.settings.ignore = ':input[type="hidden"], .ent-hidden-f :input';

        validator.settings.invalidHandler = function () {
            var tab1Errors = hasInvalidFields('ent-tab1');
            var tab2Errors = hasInvalidFields('ent-tab2');

            markTabError('ent-tab1', tab1Errors);
            markTabError('ent-tab2', tab2Errors);
            updateErrorBadges();

            // Tự động mở các section đang ẩn nếu bên trong có trường lỗi
            $('.ent-section-body:hidden').each(function () {
                if ($(this).find('.input-validation-error').length > 0) {
                    $(this).slideDown(150);
                    $(this).closest('.ent-section')
                           .find('.ent-section-toggle')
                           .removeClass('collapsed');
                }
            });

            if (tab1Errors) {
                switchToTab('ent-tab1');
            } else if (tab2Errors) {
                switchToTab('ent-tab2');
            }

            var tabNames = [];
            if (tab1Errors) tabNames.push('Tab 1: Thông tin Doanh nghiệp');
            if (tab2Errors) tabNames.push('Tab 2: Thông tin Dự án');

            if (typeof toastr !== 'undefined' && tabNames.length > 0) {
                toastr.warning(
                    'Vui lòng kiểm tra lại thông tin ở: <br><strong>' + tabNames.join('</strong>, <strong>') + '</strong>',
                    'Dữ liệu chưa hợp lệ',
                    { timeOut: 6000, closeButton: true, progressBar: true, escapeHtml: false }
                );
            }
        };
    }, 0);

    $('#enterpriseForm, #projectForm').on('submit', function () {
        markTabError('ent-tab1', false);
        markTabError('ent-tab2', false);
        $('#eb1, #eb2').removeClass('show');
    });

    $(document).on('blur change', '.input-validation-error', function () {
        var $tab = $(this).closest('.ent-tab-pane');
        if ($tab.length && $tab.find('.input-validation-error').length === 0) {
            markTabError($tab.attr('id'), false);
        }
        updateErrorBadges();
    });

    // ═══════════════════════════════════════════════════════
    //  SERVER-SIDE ERROR TOAST
    // ═══════════════════════════════════════════════════════
    var $validationSummary = $('[asp-validation-summary], .alert-figma-destructive');
    if ($validationSummary.length && $validationSummary.find('li').length > 0) {
        if (typeof toastr !== 'undefined') {
            toastr.error(
                'Có lỗi xảy ra khi lưu dữ liệu. Vui lòng kiểm tra lại thông tin.',
                'Lỗi dữ liệu',
                { timeOut: 7000, closeButton: true, progressBar: true }
            );
        }
    }

    // ═══════════════════════════════════════════════════════
    //  LƯU & TIẾP TỤC BUTTON
    // ═══════════════════════════════════════════════════════
    $('#btnSaveContinue').on('click', function () {
        $('#saveContinueInput').val('true');
        $(this).closest('form').submit();
    });

    $('#btnSave').on('click', function () {
        $('#saveContinueInput').val('false');
    });

    // ═══════════════════════════════════════════════════════
    //  INITIALIZE AUTO-SUM fields on load (for edit mode)
    // ═══════════════════════════════════════════════════════
    $('.ent-autosum-input').trigger('input');
    $('.ent-calc-diff-input').trigger('input');

});
