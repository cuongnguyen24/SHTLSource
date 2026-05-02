/**
 * Termination Templates — SCR-NV-TPL-001
 * Module: M0084 — Quản lý Template Biểu mẫu
 * Pattern: IIFE
 */
(function () {
    'use strict';

    var perms = window.userPermissions || {};
    var tplFile = null;

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function token() {
        return perms.antiForgeryToken || '';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            var d = new Date(dateStr);
            return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
        } catch (e) { return dateStr; }
    }

    // ── Load table ────────────────────────────────────────────────────
    function loadTemplates() {
        fetch('/TerminationNotifications/GetTemplates')
            .then(function (r) { return r.json(); })
            .then(function (json) {
                var items = json.data || json || [];
                var tbody = document.getElementById('templateBody');
                if (!Array.isArray(items) || items.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Chưa có template nào.</td></tr>';
                    return;
                }
                var html = items.map(function (t) {
                    var status = t.isActive
                        ? '<span class="badge-active">Đang dùng</span>'
                        : '<span class="badge-inactive">Chưa kích hoạt</span>';
                    var actions = '<a href="/TerminationNotifications/DownloadTemplate/' + t.id + '" target="_blank"' +
                        ' class="btn-figma btn-figma-outline mr-1" style="height:28px;padding:0 10px;font-size:12px;display:inline-flex;align-items:center;gap:4px;">' +
                        '<i class="fas fa-download"></i> Tải về</a>';
                    if (perms.canUpdate) {
                        actions += '<button onclick="activateTemplate(\'' + t.id + '\')"' +
                            ' class="btn-figma btn-figma-outline" style="height:28px;padding:0 10px;font-size:12px;display:inline-flex;align-items:center;gap:4px;">' +
                            (t.isActive ? '<i class="fas fa-toggle-off"></i> Vô hiệu hóa' : '<i class="fas fa-toggle-on"></i> Kích hoạt') +
                            '</button>';
                    }
                    return '<tr>' +
                        '<td>' + escapeHtml(t.name) + '</td>' +
                        '<td>' + escapeHtml(t.fileType) + '</td>' +
                        '<td>' + escapeHtml(t.version) + '</td>' +
                        '<td>' + formatDate(t.updatedAt) + '</td>' +
                        '<td>' + status + '</td>' +
                        '<td>' + actions + '</td>' +
                        '</tr>';
                }).join('');
                tbody.innerHTML = html;
            })
            .catch(function () {
                document.getElementById('templateBody').innerHTML =
                    '<tr><td colspan="6" class="text-center text-danger py-3">Lỗi tải dữ liệu.</td></tr>';
            });
    }

    // ── Activate / Deactivate ─────────────────────────────────────────
    window.activateTemplate = function (id) {
        if (!confirm('Kích hoạt / vô hiệu hóa template này?')) return;
        fetch('/TerminationNotifications/ActivateTemplate/' + id, {
            method: 'POST',
            headers: { 'RequestVerificationToken': token() }
        })
        .then(function (r) { return r.json(); })
        .then(function (json) {
            if (json.success) {
                toastr.success(json.message || 'Đã cập nhật trạng thái template.');
                loadTemplates();
            } else {
                toastr.error(json.message || 'Cập nhật thất bại.');
            }
        })
        .catch(function () { toastr.error('Lỗi kết nối.'); });
    };

    // ── Upload modal ──────────────────────────────────────────────────
    function initUploadModal() {
        var overlay = document.getElementById('moUpload');
        var btnOpen = document.getElementById('btnUploadNew');
        var btnClose = document.getElementById('btnUploadClose');
        var btnSave = document.getElementById('btnUploadSave');
        var zone = document.getElementById('tplZone');
        var fi = document.getElementById('tplFileInput');

        if (!btnOpen) return;

        btnOpen.addEventListener('click', function () {
            overlay.classList.add('open');
            tplFile = null;
            document.getElementById('tplName').value = '';
            document.getElementById('tplVersion').value = '';
            document.getElementById('tplFileSelected').textContent = '';
        });
        btnClose.addEventListener('click', function () { overlay.classList.remove('open'); });
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.classList.remove('open');
        });

        zone.addEventListener('click', function () { fi.click(); });
        fi.addEventListener('change', function (e) {
            tplFile = e.target.files[0];
            if (tplFile) document.getElementById('tplFileSelected').textContent = tplFile.name;
        });
        zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', function () { zone.classList.remove('drag-over'); });
        zone.addEventListener('drop', function (e) {
            e.preventDefault();
            zone.classList.remove('drag-over');
            tplFile = e.dataTransfer.files[0];
            if (tplFile) document.getElementById('tplFileSelected').textContent = tplFile.name;
        });

        btnSave.addEventListener('click', function () {
            var name = document.getElementById('tplName').value.trim();
            var type = document.getElementById('tplType').value;
            var version = document.getElementById('tplVersion').value.trim();
            if (!name)    { toastr.warning('Nhập tên template.'); return; }
            if (!version) { toastr.warning('Nhập phiên bản.'); return; }
            if (!tplFile) { toastr.warning('Chọn file template.'); return; }

            var fd = new FormData();
            fd.append('name', name);
            fd.append('fileType', type);
            fd.append('version', version);
            fd.append('file', tplFile);

            btnSave.disabled = true;
            fetch('/TerminationNotifications/UploadTemplate', {
                method: 'POST',
                headers: { 'RequestVerificationToken': token() },
                body: fd
            })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (json.success) {
                    toastr.success('Đã tải template mới thành công.');
                    overlay.classList.remove('open');
                    loadTemplates();
                } else {
                    toastr.error(json.message || 'Tải template thất bại.');
                }
            })
            .catch(function () { toastr.error('Lỗi kết nối.'); })
            .finally(function () { btnSave.disabled = false; });
        });
    }

    // ── Init ─────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        loadTemplates();
        initUploadModal();
    });

})();
