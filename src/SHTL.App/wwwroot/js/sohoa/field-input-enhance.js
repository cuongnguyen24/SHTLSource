(function () {
    'use strict';

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    function enhanceNumberInputs(root) {
        var nodes = (root || document).querySelectorAll('.ext-number, .chk-number');
        nodes.forEach(function (el) {
            if (el.dataset.numberBound === '1') return;
            el.dataset.numberBound = '1';
            el.addEventListener('keypress', function (e) {
                var ch = String.fromCharCode(e.which || e.keyCode);
                // Cho phép số, dấu chấm/phẩy thập phân, dấu trừ ở đầu.
                if (/[0-9.,\-]/.test(ch)) return;
                e.preventDefault();
            });
            el.addEventListener('blur', function () {
                var v = (el.value || '').trim();
                if (!v) return;
                v = v.replace(/,/g, '.');
                if (!/^-?\d+(\.\d+)?$/.test(v)) {
                    el.classList.add('is-invalid');
                } else {
                    el.classList.remove('is-invalid');
                    el.value = v;
                }
            });
        });
    }

    function pad2(n) { return ('0' + n).slice(-2); }

    function setIsoFromDmy(el, dd, mm, yy) {
        el.dataset.iso = yy + '-' + pad2(mm) + '-' + pad2(dd);
        el.value = pad2(dd) + '/' + pad2(mm) + '/' + yy;
    }

    function initIsoFromCurrentValue(el) {
        var v = (el.value || '').trim();
        if (!v) { delete el.dataset.iso; return; }
        var m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
        if (!m) return;
        var dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), yy = parseInt(m[3], 10);
        var d = new Date(yy, mm - 1, dd);
        if (d.getFullYear() === yy && d.getMonth() === mm - 1 && d.getDate() === dd) {
            setIsoFromDmy(el, dd, mm, yy);
        }
    }

    function enhanceDateInputs(root) {
        var hasFlatpickr = typeof flatpickr !== 'undefined';
        var locale = (hasFlatpickr && window.flatpickr.l10ns && window.flatpickr.l10ns.vn) ? 'vn' : 'default';
        var nodes = (root || document).querySelectorAll('.ext-date, .chk-date');
        nodes.forEach(function (el) {
            if (el.dataset.fpBound === '1') return;
            el.dataset.fpBound = '1';
            initIsoFromCurrentValue(el);
            if (hasFlatpickr) {
                try {
                    flatpickr(el, {
                        dateFormat: 'd/m/Y',
                        allowInput: true,
                        locale: locale,
                        onChange: function (selectedDates) {
                            if (selectedDates && selectedDates.length) {
                                var d = selectedDates[0];
                                el.dataset.iso = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
                                el.classList.remove('is-invalid');
                            } else {
                                delete el.dataset.iso;
                            }
                        }
                    });
                } catch (e) {
                    // Bỏ qua nếu flatpickr lỗi — giữ input text thủ công.
                }
            }
            el.addEventListener('blur', function () {
                var v = (el.value || '').trim();
                if (!v) { delete el.dataset.iso; el.classList.remove('is-invalid'); return; }
                var m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
                if (!m) { el.classList.add('is-invalid'); return; }
                var dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), yy = parseInt(m[3], 10);
                var d = new Date(yy, mm - 1, dd);
                if (d.getFullYear() !== yy || d.getMonth() !== mm - 1 || d.getDate() !== dd) {
                    el.classList.add('is-invalid');
                    return;
                }
                el.classList.remove('is-invalid');
                setIsoFromDmy(el, dd, mm, yy);
            });
        });
    }

    // Trả về giá trị nên gửi tới server cho một input. Date → ISO; còn lại giữ nguyên.
    function getSubmitValue(el) {
        if (!el) return '';
        if ((el.classList.contains('ext-date') || el.classList.contains('chk-date')) && el.dataset && el.dataset.iso) {
            return el.dataset.iso;
        }
        return el.value;
    }

    // Kiểm tra trước submit: trả về object { ok, message, firstInvalid }.
    function validateBeforeSubmit(root) {
        var scope = root || document;
        var invalids = scope.querySelectorAll('.ext-field.is-invalid, .chk-field.is-invalid');
        if (invalids.length > 0) {
            var first = invalids[0];
            var labelEl = first.closest('.form-group')?.querySelector('label');
            var label = labelEl ? labelEl.innerText.replace('*', '').trim() : 'trường nhập';
            return {
                ok: false,
                firstInvalid: first,
                message: 'Trường "' + label + '" có giá trị chưa hợp lệ. Vui lòng kiểm tra lại.'
            };
        }
        return { ok: true };
    }

    function focusFirstInvalid(scope) {
        var first = (scope || document).querySelector('.ext-field.is-invalid, .chk-field.is-invalid');
        if (!first) return;
        try { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* ignore */ }
        try { first.focus(); } catch (e) { /* ignore */ }
    }

    // Modal phóng to TextArea — dùng chung cho cả Extract và Check.
    function ensureExpandModal() {
        var m = document.getElementById('shtlTextareaExpandModal');
        if (m) return m;
        var html = ''
            + '<div class="modal fade" id="shtlTextareaExpandModal" tabindex="-1" role="dialog" aria-hidden="true">'
            + '  <div class="modal-dialog modal-xl" role="document">'
            + '    <div class="modal-content">'
            + '      <div class="modal-header py-2">'
            + '        <h6 class="modal-title mb-0"><i class="fas fa-expand-alt mr-2"></i><span id="shtlTextareaExpandTitle">Soạn nội dung</span></h6>'
            + '        <button type="button" class="close" data-dismiss="modal" aria-label="Đóng"><span aria-hidden="true">&times;</span></button>'
            + '      </div>'
            + '      <div class="modal-body">'
            + '        <textarea id="shtlTextareaExpandValue" class="form-control" rows="18" style="resize: vertical; min-height: 360px;"></textarea>'
            + '      </div>'
            + '      <div class="modal-footer py-2">'
            + '        <button type="button" class="btn btn-secondary btn-sm" data-dismiss="modal">Huỷ</button>'
            + '        <button type="button" class="btn btn-primary btn-sm" id="shtlTextareaExpandApply"><i class="fas fa-check mr-1"></i>Áp dụng</button>'
            + '      </div>'
            + '    </div>'
            + '  </div>'
            + '</div>';
        var wrap = document.createElement('div');
        wrap.innerHTML = html;
        document.body.appendChild(wrap.firstElementChild);
        return document.getElementById('shtlTextareaExpandModal');
    }

    function bindTextareaExpand(root) {
        ensureExpandModal();
        var modal = document.getElementById('shtlTextareaExpandModal');
        var bigArea = document.getElementById('shtlTextareaExpandValue');
        var titleEl = document.getElementById('shtlTextareaExpandTitle');
        var applyBtn = document.getElementById('shtlTextareaExpandApply');
        var currentTarget = null;

        if (applyBtn && applyBtn.dataset.bound !== '1') {
            applyBtn.dataset.bound = '1';
            applyBtn.addEventListener('click', function () {
                if (!currentTarget) {
                    if (window.jQuery) jQuery(modal).modal('hide');
                    return;
                }
                currentTarget.value = bigArea.value;
                currentTarget.dispatchEvent(new Event('input', { bubbles: true }));
                currentTarget.dispatchEvent(new Event('change', { bubbles: true }));
                if (window.jQuery) jQuery(modal).modal('hide');
            });
        }

        var btns = (root || document).querySelectorAll('.ext-textarea-expand, .chk-textarea-expand');
        btns.forEach(function (btn) {
            if (btn.dataset.expandBound === '1') return;
            btn.dataset.expandBound = '1';
            btn.addEventListener('click', function () {
                var sel = btn.getAttribute('data-target');
                if (!sel) return;
                var ta = document.querySelector(sel);
                if (!ta) return;
                currentTarget = ta;
                bigArea.value = ta.value || '';
                var label = ta.closest('.form-group')?.querySelector('label')?.innerText || 'Soạn nội dung';
                titleEl.textContent = 'Soạn nội dung — ' + label.trim();
                if (window.jQuery) jQuery(modal).modal('show');
            });
        });
    }

    function enhanceAll(root) {
        enhanceNumberInputs(root);
        enhanceDateInputs(root);
        bindTextareaExpand(root);
    }

    // Public API để gọi lại sau khi render động (ví dụ trong AJAX).
    window.ShtlFieldInputEnhance = {
        enhance: enhanceAll,
        getSubmitValue: getSubmitValue,
        validateBeforeSubmit: validateBeforeSubmit,
        focusFirstInvalid: focusFirstInvalid
    };

    ready(function () { enhanceAll(document); });
})();
