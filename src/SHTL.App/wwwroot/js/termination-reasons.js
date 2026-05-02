/**
 * Termination Reasons — SCR-NV-CAT-001
 * Module: M0083 — Danh mục lý do chấm dứt HĐLĐ
 * Pattern: IIFE
 */
(function () {
    'use strict';

    var perms = window.userPermissions || {};
    var editingId = null;

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function token() { return perms.antiForgeryToken || ''; }

    // ── Load table ────────────────────────────────────────────────────
    function loadReasons() {
        fetch('/TerminationReasons/GetAll')
            .then(function (r) { return r.json(); })
            .then(function (json) {
                var items = json.data || json || [];
                var tbody = document.getElementById('reasonsBody');
                if (!Array.isArray(items) || items.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Chưa có lý do nào.</td></tr>';
                    return;
                }
                var html = items.map(function (r, i) {
                    var status = r.isActive
                        ? '<span class="b-ok">Hoạt động</span>'
                        : '<span class="b-reject">Vô hiệu</span>';
                    var actions = '';
                    if (perms.canUpdate) {
                        actions += '<button onclick="editReason(\'' + r.id + '\')" ' +
                            'class="btn-figma btn-figma-outline mr-1" style="height:28px;padding:0 10px;font-size:12px;display:inline-flex;align-items:center;gap:4px;">' +
                            '<i class="fas fa-edit"></i> Sửa</button>';
                        if (r.isActive) {
                            actions += '<button onclick="toggleReason(\'' + r.id + '\',false)" ' +
                                'class="btn-figma btn-figma-outline" style="height:28px;padding:0 10px;font-size:12px;display:inline-flex;align-items:center;gap:4px;color:#64748b;">' +
                                '<i class="fas fa-toggle-off"></i> Vô hiệu</button>';
                        } else {
                            actions += '<button onclick="toggleReason(\'' + r.id + '\',true)" ' +
                                'class="btn-figma btn-figma-outline" style="height:28px;padding:0 10px;font-size:12px;display:inline-flex;align-items:center;gap:4px;color:#22c55e;">' +
                                '<i class="fas fa-toggle-on"></i> Kích hoạt</button>';
                        }
                    }
                    return '<tr>' +
                        '<td class="text-center">' + (i + 1) + '</td>' +
                        '<td><code>' + escapeHtml(r.code) + '</code></td>' +
                        '<td>' + escapeHtml(r.name) + '</td>' +
                        '<td>' + escapeHtml(r.legalBasis || '—') + '</td>' +
                        '<td class="text-center">' + (r.totalNotifications || 0) + '</td>' +
                        '<td class="text-center">' + status + '</td>' +
                        '<td>' + actions + '</td>' +
                        '</tr>';
                }).join('');
                tbody.innerHTML = html;
            })
            .catch(function () {
                document.getElementById('reasonsBody').innerHTML =
                    '<tr><td colspan="7" class="text-center text-danger py-3">Lỗi tải dữ liệu.</td></tr>';
            });
    }

    // ── Toggle active/inactive ────────────────────────────────────────
    window.toggleReason = function (id, activate) {
        var action = activate ? 'Kích hoạt' : 'Vô hiệu hóa';
        if (!confirm(action + ' lý do này?')) return;
        var endpoint = activate
            ? '/TerminationReasons/Activate/' + id
            : '/TerminationReasons/Deactivate/' + id;
        fetch(endpoint, {
            method: 'POST',
            headers: { 'RequestVerificationToken': token() }
        })
        .then(function (r) { return r.json(); })
        .then(function (json) {
            if (json.success) {
                toastr.success(json.message || 'Đã cập nhật trạng thái.');
                loadReasons();
            } else {
                toastr.error(json.message || 'Thao tác thất bại.');
            }
        })
        .catch(function () { toastr.error('Lỗi kết nối.'); });
    };

    // ── Edit ──────────────────────────────────────────────────────────
    window.editReason = function (id) {
        fetch('/TerminationReasons/GetById/' + id)
            .then(function (r) { return r.json(); })
            .then(function (json) {
                var d = json.data || json;
                editingId = d.id;
                document.getElementById('moTitle').innerHTML = '<i class="fas fa-edit mr-2"></i>Sửa lý do chấm dứt';
                document.getElementById('reasonId').value = d.id;
                document.getElementById('fCode').value = d.code;
                document.getElementById('fCode').disabled = true;
                document.getElementById('fName').value = d.name;
                document.getElementById('fLegal').value = d.legalBasis || '';
                document.getElementById('fTotalNotifications').value = Number.isFinite(d.totalNotifications) ? d.totalNotifications : 0;
                document.getElementById('fStatus').value = d.isActive ? 'true' : 'false';
                document.getElementById('moReason').classList.add('open');
            })
            .catch(function () { toastr.error('Lỗi tải thông tin lý do.'); });
    };

    // ── Modal ─────────────────────────────────────────────────────────
    function initModal() {
        var overlay = document.getElementById('moReason');
        var btnAdd = document.getElementById('btnAdd');
        var btnClose = document.getElementById('btnMoClose');
        var btnSave = document.getElementById('btnMoSave');

        if (btnAdd) {
            btnAdd.addEventListener('click', function () {
                editingId = null;
                document.getElementById('moTitle').innerHTML = '<i class="fas fa-tags mr-2"></i>Thêm lý do chấm dứt';
                document.getElementById('reasonId').value = '';
                document.getElementById('fCode').value = '';
                document.getElementById('fCode').disabled = false;
                document.getElementById('fName').value = '';
                document.getElementById('fLegal').value = '';
                document.getElementById('fTotalNotifications').value = '0';
                document.getElementById('fStatus').value = 'true';
                overlay.classList.add('open');
            });
        }

        btnClose.addEventListener('click', function () { overlay.classList.remove('open'); });
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.classList.remove('open');
        });

        btnSave.addEventListener('click', function () {
            var code = document.getElementById('fCode').value.trim();
            var name = document.getElementById('fName').value.trim();
            var legal = document.getElementById('fLegal').value.trim();
            var totalNotificationsRaw = document.getElementById('fTotalNotifications').value;
            var totalNotifications = parseInt(totalNotificationsRaw, 10);
            var isActive = document.getElementById('fStatus').value === 'true';

            if (!editingId && !code) { toastr.warning('Nhập mã lý do.'); return; }
            if (!editingId && !/^[A-Z0-9_]{3,20}$/.test(code)) {
                toastr.warning('Mã chỉ gồm A-Z, 0-9, _ (3-20 ký tự).'); return;
            }
            if (!name) { toastr.warning('Nhập tên lý do.'); return; }
            if (isNaN(totalNotifications) || totalNotifications < 0) {
                toastr.warning('Số hồ sơ phải là số nguyên không âm.'); return;
            }

            var body;
            var url;
            var method;

            if (editingId) {
                body = { name: name, legalBasis: legal || null, totalNotifications: totalNotifications, isActive: isActive };
                url = '/TerminationReasons/Update/' + editingId;
                method = 'POST';
            } else {
                body = { code: code, name: name, legalBasis: legal || null, totalNotifications: totalNotifications, isActive: isActive };
                url = '/TerminationReasons/Create';
                method = 'POST';
            }

            btnSave.disabled = true;
            fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': token()
                },
                body: JSON.stringify(body)
            })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (json.success) {
                    toastr.success(editingId ? 'Đã cập nhật lý do.' : 'Đã thêm lý do mới.');
                    overlay.classList.remove('open');
                    loadReasons();
                } else {
                    toastr.error(json.message || 'Lưu thất bại.');
                }
            })
            .catch(function () { toastr.error('Lỗi kết nối.'); })
            .finally(function () { btnSave.disabled = false; });
        });
    }

    // ── Init ─────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        loadReasons();
        initModal();
    });

})();