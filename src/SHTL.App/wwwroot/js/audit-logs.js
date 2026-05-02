/**
 * Audit Logs — SCR-QT-AUDIT-001
 * Read-only, custom pagination, native fetch
 * Pattern: IIFE
 */
(function () {
    'use strict';

    var currentPage = 1;
    var totalPages = 1;
    var totalRecords = 0;
    var PAGE_SIZE = 20;

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function formatDatetime(str) {
        if (!str) return '—';
        try {
            var d = new Date(str);
            return ('0' + d.getDate()).slice(-2) + '/' +
                   ('0' + (d.getMonth() + 1)).slice(-2) + '/' +
                   d.getFullYear() + ' ' +
                   ('0' + d.getHours()).slice(-2) + ':' +
                   ('0' + d.getMinutes()).slice(-2) + ':' +
                   ('0' + d.getSeconds()).slice(-2);
        } catch (e) { return str; }
    }

    function getActionBadge(action) {
        var map = {
            'CONFIRM': 'act-confirm',
            'CREATE':  'act-create',
            'UPDATE':  'act-update',
            'DELETE':  'act-delete',
            'LOGIN':   'act-login'
        };
        var cls = map[action] || 'act-default';
        return '<span class="audit-action ' + cls + '">' + escapeHtml(action) + '</span>';
    }

    function getFilterParams() {
        var p = new URLSearchParams();
        p.append('page', currentPage);
        p.append('pageSize', PAGE_SIZE);
        var from = document.getElementById('filterFromDate').value;
        var to   = document.getElementById('filterToDate').value;
        var user = document.getElementById('filterUser').value.trim();
        var act  = document.getElementById('filterAction').value;
        if (from) p.append('fromDate', from);
        if (to)   p.append('toDate', to);
        if (user) p.append('userName', user);
        if (act)  p.append('action', act);
        return p.toString();
    }

    function renderTable(items) {
        var tbody = document.getElementById('auditBody');
        if (!Array.isArray(items) || items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Không có bản ghi nào.</td></tr>';
            return;
        }
        var html = items.map(function (r) {
            return '<tr>' +
                '<td style="white-space:nowrap;">' + formatDatetime(r.timestamp) + '</td>' +
                '<td>' + escapeHtml(r.userName) + '</td>' +
                '<td>' + getActionBadge(r.action) + '</td>' +
                '<td>' + escapeHtml(r.entityType || '—') + '</td>' +
                '<td style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;" title="' + escapeHtml(r.entityId) + '">' + escapeHtml(r.entityId || '—') + '</td>' +
                '<td>' + escapeHtml(r.ipAddress || '—') + '</td>' +
                '</tr>';
        }).join('');
        tbody.innerHTML = html;
    }

    function renderPagination() {
        var bar = document.getElementById('paginationBar');
        var info = document.getElementById('pageInfo');
        var btns = document.getElementById('pageButtons');
        bar.style.display = 'flex';

        info.textContent = 'Trang ' + currentPage + '/' + totalPages + ' (' + totalRecords + ' bản ghi)';

        var html = '';
        html += '<button onclick="goPage(' + (currentPage - 1) + ')" ' +
            (currentPage <= 1 ? 'disabled' : '') +
            ' style="height:28px;width:28px;border:1px solid #e2e8f0;border-radius:4px;background:#fff;cursor:pointer;">◀</button>';

        var start = Math.max(1, currentPage - 2);
        var end   = Math.min(totalPages, currentPage + 2);
        for (var p = start; p <= end; p++) {
            var active = p === currentPage ? 'background:var(--primary);color:#fff;border-color:var(--primary);' : 'background:#fff;';
            html += '<button onclick="goPage(' + p + ')" style="height:28px;width:28px;border:1px solid #e2e8f0;border-radius:4px;cursor:pointer;' + active + '">' + p + '</button>';
        }

        html += '<button onclick="goPage(' + (currentPage + 1) + ')" ' +
            (currentPage >= totalPages ? 'disabled' : '') +
            ' style="height:28px;width:28px;border:1px solid #e2e8f0;border-radius:4px;background:#fff;cursor:pointer;">▶</button>';

        btns.innerHTML = html;
    }

    window.goPage = function (page) {
        if (page < 1 || page > totalPages) return;
        currentPage = page;
        loadData();
    };

    function loadData() {
        var tbody = document.getElementById('auditBody');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Đang tải...</td></tr>';

        fetch('/AuditLogs/GetData?' + getFilterParams())
            .then(function (r) { return r.json(); })
            .then(function (json) {
                var data = json.data || json;
                var items = data.items || data.data || [];
                totalRecords = data.totalCount || data.total || items.length;
                totalPages = Math.ceil(totalRecords / PAGE_SIZE) || 1;
                renderTable(items);
                renderPagination();
            })
            .catch(function () {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-3">Lỗi tải dữ liệu.</td></tr>';
            });
    }

    function setDefaultDates() {
        var today = new Date();
        var from  = new Date(today);
        from.setDate(today.getDate() - 30);

        function fmt(d) {
            return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
        }
        document.getElementById('filterFromDate').value = fmt(from);
        document.getElementById('filterToDate').value   = fmt(today);
    }

    function initExport() {
        document.getElementById('btnExportCsv').addEventListener('click', function () {
            window.location = '/AuditLogs/ExportCsv?' + getFilterParams();
        });
        document.getElementById('btnExportExcel').addEventListener('click', function () {
            window.location = '/AuditLogs/ExportExcel?' + getFilterParams();
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        setDefaultDates();
        loadData();
        document.getElementById('btnFilter').addEventListener('click', function () {
            currentPage = 1;
            loadData();
        });
        initExport();
    });

})();
