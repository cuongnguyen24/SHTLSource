/**
 * Termination Import — SCR-NV-IMPORT-001
 * Module: M0085 — Nhập hàng loạt từ Excel (PA-B)
 * Pattern: IIFE
 */
(function () {
    'use strict';

    var selectedFile = null;
    var previewRows = [];

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function token() {
        return window.antiForgeryToken || '';
    }

    // ── Step helpers ──────────────────────────────────────────────────
    function setStep(s1cls, s2cls, s3cls) {
        setStepClass('s1', s1cls);
        setStepClass('s2', s2cls);
        setStepClass('s3', s3cls);
    }

    function setStepClass(id, cls) {
        var el = document.getElementById(id);
        if (!el) return;
        el.className = 'step ' + (cls || '');
    }

    // ── File upload zone ──────────────────────────────────────────────
    function initUploadZone() {
        var zone = document.getElementById('uploadZone');
        var fileInput = document.getElementById('fileInput');

        zone.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function (e) {
            handleFile(e.target.files[0]);
        });

        zone.addEventListener('dragover', function (e) {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', function () { zone.classList.remove('drag-over'); });
        zone.addEventListener('drop', function (e) {
            e.preventDefault();
            zone.classList.remove('drag-over');
            handleFile(e.dataTransfer.files[0]);
        });
    }

    function handleFile(file) {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.xlsx')) {
            toastr.error('Chỉ chấp nhận file .xlsx');
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            toastr.error('File vượt quá 50MB.');
            return;
        }
        selectedFile = file;
        var el = document.getElementById('selectedFile');
        if (el) el.textContent = 'Đã chọn: ' + file.name + ' (' + (file.size / 1024).toFixed(0) + ' KB)';
        uploadPreview(file);
    }

    // ── Upload preview ────────────────────────────────────────────────
    function uploadPreview(file) {
        var formData = new FormData();
        formData.append('file', file);

        fetch('/TerminationNotifications/ImportBatchPreview', {
            method: 'POST',
            headers: { 'RequestVerificationToken': token() },
            body: formData
        })
        .then(function (r) { return r.json(); })
        .then(function (json) {
            if (!json.success) {
                toastr.error(json.message || 'Lỗi xử lý file.');
                return;
            }
            var d = json.data || {};
            previewRows = d.rows || [];
            renderPreview(d.validCount || 0, d.errorCount || 0, previewRows);
            showStep2();
        })
        .catch(function () { toastr.error('Lỗi kết nối khi upload file.'); });
    }

    function showStep2() {
        document.getElementById('imp1').style.display = 'none';
        document.getElementById('imp2').style.display = 'block';
        setStep('done', 'on', '');
    }

    // ── Render preview table ──────────────────────────────────────────
    function renderPreview(valid, error, rows) {
        document.getElementById('impValid').textContent = valid;
        document.getElementById('impError').textContent = error;

        var html = rows.map(function (r, i) {
            var isValid = r.isValid;
            var result = isValid
                ? '<span style="color:#22c55e;font-weight:700;">✓ Hợp lệ</span>'
                : '<span style="color:#ef4444;font-weight:700;">✗ ' + escapeHtml(r.errorMessage) + '</span>';
            var chk = isValid
                ? '<input type="checkbox" class="row-chk" data-idx="' + i + '" checked>'
                : '<input type="checkbox" disabled>';
            return '<tr class="' + (isValid ? '' : 'row-err') + '">' +
                   '<td>' + chk + '</td>' +
                   '<td>' + r.rowNumber + '</td>' +
                   '<td>' + escapeHtml(r.enterpriseName || r.enterpriseTaxCode) + '</td>' +
                   '<td>' + escapeHtml(r.workerFullName || r.workerPassport) + '</td>' +
                   '<td>' + escapeHtml(r.terminationDate) + '</td>' +
                   '<td>' + escapeHtml(r.reasonCode) + '</td>' +
                   '<td>' + result + '</td>' +
                   '</tr>';
        }).join('');
        document.getElementById('previewBody').innerHTML = html;

        updateConfirmBtn();
    }

    function updateConfirmBtn() {
        var checked = document.querySelectorAll('.row-chk:checked').length;
        var btn = document.getElementById('btnConfirmImport');
        var lbl = document.getElementById('btnConfirmLabel');
        if (btn) btn.disabled = checked === 0;
        if (lbl) lbl.textContent = 'Xác nhận Import ' + checked + ' dòng';
    }

    // ── Checkbox handlers ─────────────────────────────────────────────
    function initCheckboxes() {
        document.getElementById('previewBody').addEventListener('change', function (e) {
            if (e.target.classList.contains('row-chk')) updateConfirmBtn();
        });
        document.getElementById('chkAll').addEventListener('change', function () {
            var checked = this.checked;
            document.querySelectorAll('.row-chk').forEach(function (c) { c.checked = checked; });
            updateConfirmBtn();
        });
    }

    // ── Reset ─────────────────────────────────────────────────────────
    function initReset() {
        document.getElementById('btnReset').addEventListener('click', function () {
            selectedFile = null;
            previewRows = [];
            document.getElementById('fileInput').value = '';
            document.getElementById('selectedFile').textContent = '';
            document.getElementById('previewBody').innerHTML = '';
            document.getElementById('imp1').style.display = 'block';
            document.getElementById('imp2').style.display = 'none';
            setStep('on', '', '');
        });
    }

    // ── Confirm import ────────────────────────────────────────────────
    function initConfirm() {
        document.getElementById('btnConfirmImport').addEventListener('click', function () {
            if (!selectedFile) return;
            var selectedIndexes = Array.from(document.querySelectorAll('.row-chk:checked'))
                .map(function (c) { return parseInt(c.getAttribute('data-idx')); });

            var formData = new FormData();
            formData.append('file', selectedFile);
            selectedIndexes.forEach(function (idx) {
                formData.append('selectedRows', idx);
            });

            var btn = document.getElementById('btnConfirmImport');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang import...';

            setStep('done', 'done', 'on');

            fetch('/TerminationNotifications/ImportBatchConfirm', {
                method: 'POST',
                headers: { 'RequestVerificationToken': token() },
                body: formData
            })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (json.success) {
                    toastr.success('Import thành công ' + (json.data.successCount || selectedIndexes.length) + ' hồ sơ.');
                    setTimeout(function () { window.location.href = '/TerminationNotifications'; }, 1500);
                } else {
                    toastr.error(json.message || 'Import thất bại.');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-check mr-1"></i> Xác nhận Import';
                    setStep('done', 'on', '');
                }
            })
            .catch(function () {
                toastr.error('Lỗi kết nối.');
                btn.disabled = false;
                setStep('done', 'on', '');
            });
        });
    }

    // ── Init ─────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        initUploadZone();
        initCheckboxes();
        initReset();
        initConfirm();
    });

})();
