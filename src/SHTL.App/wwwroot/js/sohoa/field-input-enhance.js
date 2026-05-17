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
        el.dataset.rawSnapshot = '';
    }

    function initIsoFromCurrentValue(el) {
        var v = (el.value || '').trim();
        if (!v) { delete el.dataset.iso; el.dataset.rawSnapshot = ''; return; }
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
                                el.dataset.rawSnapshot = '';
                                el.classList.remove('is-invalid');
                            } else {
                                delete el.dataset.iso;
                            }
                        }
                    });
                } catch (e) {
                    // noop
                }
            }
            el.addEventListener('input', function () {
                el.dataset.rawSnapshot = el.value || '';
            });
            el.addEventListener('blur', function () {
                var v = (el.value || '').trim();
                if (!v) { delete el.dataset.iso; el.classList.remove('is-invalid'); el.dataset.rawSnapshot = ''; return; }
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

    function effectiveDateText(el) {
        var snap = (el.dataset && el.dataset.rawSnapshot != null) ? String(el.dataset.rawSnapshot).trim() : '';
        if (snap.length > 0) return snap;
        return (el.value || '').trim();
    }

    function getSubmitValue(el) {
        if (!el) return '';
        var isDate = el.classList.contains('ext-date') || el.classList.contains('chk-date');
        var text = isDate ? effectiveDateText(el) : (el.value || '');
        text = text.trim();
        if (isDate && el.dataset && el.dataset.iso) {
            if (text.length > 0) {
                var m = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
                if (m) {
                    var dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), yy = parseInt(m[3], 10);
                    var d = new Date(yy, mm - 1, dd);
                    if (d.getFullYear() === yy && d.getMonth() === mm - 1 && d.getDate() === dd) {
                        return el.dataset.iso;
                    }
                }
                return text;
            }
            return '';
        }
        return isDate ? text : (el.value || '');
    }

    function validateBeforeSubmit(root) {
        var scope = root || document;
        var fields = scope.querySelectorAll('.ext-field, .chk-field, [data-stg-field][data-input-type="date"]');
        var firstInvalid = null;

        function markInvalid(el) {
            el.classList.add('is-invalid');
            if (!firstInvalid) firstInvalid = el;
        }
        function clearInvalid(el) { el.classList.remove('is-invalid'); }
        function getLabel(el) {
            var custom = el.getAttribute('data-field-label');
            if (custom) return custom;
            var fg = el.closest('.form-group');
            var labelEl = fg ? fg.querySelector('label') : null;
            return labelEl ? labelEl.innerText.replace('*', '').trim() : 'trường nhập';
        }

        for (var i = 0; i < fields.length; i++) {
            var el = fields[i];
            var inputType = (el.getAttribute('data-input-type') || '').toLowerCase();
            var raw = (el.value || '').trim();
            if (inputType === 'date' || el.classList.contains('ext-date') || el.classList.contains('chk-date')) {
                var eff = effectiveDateText(el);
                if (eff.length > 0) raw = eff;
            }
            var isRequired = String(el.getAttribute('data-required') || 'false').toLowerCase() === 'true';
            var minLen = parseInt(el.getAttribute('data-min-len') || '0', 10) || 0;
            var maxLen = parseInt(el.getAttribute('data-max-len') || '0', 10) || 0;

            clearInvalid(el);

            if (isRequired && raw.length === 0) {
                markInvalid(el);
                return { ok: false, firstInvalid: firstInvalid, message: 'Trường "' + getLabel(el) + '" không được để trống.' };
            }
            if (raw.length > 0 && minLen > 0 && raw.length < minLen) {
                markInvalid(el);
                return { ok: false, firstInvalid: firstInvalid, message: 'Trường "' + getLabel(el) + '" phải có ít nhất ' + minLen + ' ký tự.' };
            }
            if (raw.length > 0 && maxLen > 0 && raw.length > maxLen) {
                markInvalid(el);
                return { ok: false, firstInvalid: firstInvalid, message: 'Trường "' + getLabel(el) + '" không được vượt quá ' + maxLen + ' ký tự.' };
            }

            if (inputType === 'number' || el.classList.contains('ext-number') || el.classList.contains('chk-number')) {
                if (raw.length > 0) {
                    var normalized = raw.replace(/,/g, '.');
                    if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
                        markInvalid(el);
                        return { ok: false, firstInvalid: firstInvalid, message: 'Trường "' + getLabel(el) + '" phải là số hợp lệ.' };
                    }
                    el.value = normalized;
                }
            }

            if (inputType === 'date' || el.classList.contains('ext-date') || el.classList.contains('chk-date')) {
                if (raw.length > 0) {
                    var m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
                    if (!m) {
                        markInvalid(el);
                        return { ok: false, firstInvalid: firstInvalid, message: 'Trường "' + getLabel(el) + '" phải đúng định dạng dd/MM/yyyy.' };
                    }
                    var dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), yy = parseInt(m[3], 10);
                    var d = new Date(yy, mm - 1, dd);
                    if (d.getFullYear() !== yy || d.getMonth() !== mm - 1 || d.getDate() !== dd) {
                        markInvalid(el);
                        return { ok: false, firstInvalid: firstInvalid, message: 'Trường "' + getLabel(el) + '" có ngày không hợp lệ.' };
                    }
                    setIsoFromDmy(el, dd, mm, yy);
                }
            }

            if (inputType === 'select' || el.classList.contains('ext-select') || el.classList.contains('chk-select')) {
                if (isRequired && el.options && el.options.length === 0) {
                    markInvalid(el);
                    return { ok: false, firstInvalid: firstInvalid, message: 'Trường "' + getLabel(el) + '" chưa có lựa chọn hợp lệ.' };
                }
                if (isRequired && raw.length === 0) {
                    markInvalid(el);
                    return { ok: false, firstInvalid: firstInvalid, message: 'Vui lòng chọn giá trị cho trường "' + getLabel(el) + '".' };
                }
            }
        }

        var cells = scope.querySelectorAll('.ext-cell[data-cell-id]');
        for (var j = 0; j < cells.length; j++) {
            var cell = cells[j];
            var cellValue = (cell.value || '').trim();
            var cellMax = parseInt(cell.getAttribute('maxlength') || '0', 10) || 0;
            cell.classList.remove('is-invalid');
            if (cellMax > 0 && cellValue.length > cellMax) {
                cell.classList.add('is-invalid');
                firstInvalid = firstInvalid || cell;
                var cellName = cell.getAttribute('data-cell-label') || ('Ô #' + (cell.getAttribute('data-cell-id') || ''));
                return { ok: false, firstInvalid: firstInvalid, message: cellName + ' không được vượt quá ' + cellMax + ' ký tự.' };
            }
        }

        var invalids = scope.querySelectorAll('.ext-field.is-invalid, .chk-field.is-invalid, .ext-cell.is-invalid');
        if (invalids.length > 0) {
            return {
                ok: false,
                firstInvalid: invalids[0],
                message: 'Có trường dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.'
            };
        }
        return { ok: true };
    }

    function focusFirstInvalid(scope) {
        var first = (scope || document).querySelector('.ext-field.is-invalid, .chk-field.is-invalid, .ext-cell.is-invalid');
        if (!first) return;
        try { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* ignore */ }
        try { first.focus(); } catch (e) { /* ignore */ }
    }

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
                var label = ta.closest('.form-group') ? ta.closest('.form-group').querySelector('label') : null;
                titleEl.textContent = 'Soạn nội dung — ' + ((label ? label.innerText : 'Soạn nội dung').trim());
                if (window.jQuery) jQuery(modal).modal('show');
            });
        });
    }

    function enhanceAll(root) {
        enhanceNumberInputs(root);
        enhanceDateInputs(root);
        bindTextareaExpand(root);
    }

    window.ShtlFieldInputEnhance = {
        enhance: enhanceAll,
        getSubmitValue: getSubmitValue,
        validateBeforeSubmit: validateBeforeSubmit,
        focusFirstInvalid: focusFirstInvalid
    };

    ready(function () { enhanceAll(document); });
})();
