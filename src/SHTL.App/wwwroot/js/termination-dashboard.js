/**
 * Termination Dashboard — SCR-NV-ALERT-001
 * Module: M0073 — Dashboard KPI & Cảnh báo
 * Pattern: IIFE
 */
(function () {
    'use strict';

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function token() {
        var el = document.querySelector('input[name="__RequestVerificationToken"]');
        return el ? el.value : '';
    }

    // ── Set month display ─────────────────────────────────────────────
    function setMonthDisplay() {
        var now = new Date();
        var el = document.getElementById('kpiMonth');
        if (el) el.textContent = (now.getMonth() + 1) + '/' + now.getFullYear();
    }

    // ── Load KPI data ─────────────────────────────────────────────────
    function loadKpi() {
        fetch('/TerminationDashboard/GetKpiData')
            .then(function (r) { return r.json(); })
            .then(function (json) {
                var d = json.data || json || {};
                var total     = d.total     || 0;
                var confirmed = d.confirmed || 0;
                var pending   = d.pending   || 0;
                var overdue   = d.overdue   || 0;

                setText('kpiTotalVal',     total);
                setText('kpiTotalSub',     'Hồ sơ trong tháng');
                setText('kpiConfirmedVal', confirmed);
                setText('kpiConfirmedSub', Math.round(total > 0 ? (confirmed / total * 100) : 0) + '% tổng số');
                setText('kpiPendingVal',   pending);
                setText('kpiPendingSub',   pending > 0 ? 'Cần xử lý' : 'Tốt!');
                setText('kpiOverdueVal',   overdue);
                setText('kpiOverdueSub',   overdue > 0 ? 'Cần xử lý ngay' : 'Không có');
            })
            .catch(function () {
                ['kpiTotalSub','kpiConfirmedSub','kpiPendingSub','kpiOverdueSub'].forEach(function (id) {
                    setText(id, 'Lỗi tải dữ liệu');
                });
            });
    }

    function setText(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    // ── Load alert table ──────────────────────────────────────────────
    function loadAlertTable() {
        var tbody = document.getElementById('alertBody');
        fetch('/TerminationDashboard/GetAlertData')
            .then(function (r) { return r.json(); })
            .then(function (json) {
                var items = json.data || json || [];
                if (!Array.isArray(items) || items.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4" style="color:#22c55e; font-size:13px;"><i class="fas fa-check-circle mr-1"></i>Không có LĐNN quá hạn thông báo</td></tr>';
                    return;
                }
                var html = items.map(function (row) {
                    var badge = getAlertBadge(row.overdueDays);
                    var actions = '';
                    if (window.userPermissions && window.userPermissions.canCreate) {
                        var url = '/TerminationNotifications/Create?enterpriseId=' + encodeURIComponent(row.enterpriseId || '');
                        actions += '<a href="' + url + '" class="btn-figma btn-figma-outline mr-1" style="height:28px;padding:0 10px;font-size:12px;display:inline-flex;align-items:center;gap:4px;">' +
                                   '<i class="fas fa-edit"></i> Nhập thay PA-B</a>';
                        actions += '<button onclick="sendReminder(\'' + escapeHtml(row.enterpriseId) + '\',\'' + escapeHtml(row.workerId) + '\')" ' +
                                   'class="btn-figma btn-figma-outline" style="height:28px;padding:0 10px;font-size:12px;display:inline-flex;align-items:center;gap:4px;">' +
                                   '<i class="fas fa-bell"></i> Gửi nhắc</button>';
                    }
                    return '<tr>' +
                           '<td>' + escapeHtml(row.enterpriseName) + '</td>' +
                           '<td>' + escapeHtml(row.workerFullName) + '</td>' +
                           '<td>' + escapeHtml(row.workerNationality || '—') + '</td>' +
                           '<td>' + escapeHtml(formatDate(row.terminationDate)) + '</td>' +
                           '<td>' + badge + '</td>' +
                           '<td>' + actions + '</td>' +
                           '</tr>';
                }).join('');
                tbody.innerHTML = html;
            })
            .catch(function () {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Lỗi tải dữ liệu cảnh báo.</td></tr>';
            });
    }

    function getAlertBadge(days) {
        if (days === undefined || days === null) return '';
        if (days > 7) return '<span class="al-ovd">D+' + days + ' – Quá hạn</span>';
        if (days >= 5) return '<span class="al-soon">D+' + days + ' – Sắp quá hạn</span>';
        return '<span class="al-warn">D+' + days + ' – Cảnh báo</span>';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            var d = new Date(dateStr);
            return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
        } catch (e) { return dateStr; }
    }

    // ── Gửi nhắc nhở ─────────────────────────────────────────────────
    window.sendReminder = function (enterpriseId, workerId) {
        if (!confirm('Gửi email nhắc nhở đến doanh nghiệp này?')) return;
        fetch('/TerminationDashboard/SendReminder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': token()
            },
            body: JSON.stringify({ enterpriseId: enterpriseId, workerId: workerId })
        })
        .then(function (r) { return r.json(); })
        .then(function (json) {
            if (json.success) {
                toastr.success(json.message || 'Đã gửi email nhắc nhở.');
            } else {
                toastr.error(json.message || 'Gửi nhắc nhở thất bại.');
            }
        })
        .catch(function () { toastr.error('Lỗi kết nối.'); });
    };

    // ── Init ─────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        setMonthDisplay();
        loadKpi();
        loadAlertTable();
    });

})();
