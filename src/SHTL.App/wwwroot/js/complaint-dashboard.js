/**
 * Complaint Dashboard — Client JS (IIFE Pattern)
 * Module: M0062 (Đơn thư Khiếu nại)
 * Screen: SCR-NV-DB-001 — Dashboard KPI & Cảnh báo
 */
(function () {
    'use strict';

    // ─── State ──────────────────────────────────────────────────
    var donutChart = null;
    var lineChart = null;
    var barChart = null;
    var selectedRows = [];
    var currentFilter = 'QuaHan';

    // ─── Utility: XSS prevention ────────────────────────────────
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function formatDateVN(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return String(d.getDate()).padStart(2, '0') + '/' +
               String(d.getMonth() + 1).padStart(2, '0') + '/' +
               d.getFullYear();
    }

    function getAntiForgeryToken() {
        return $('input[name="__RequestVerificationToken"]').val() || '';
    }

    // ─── KPI Update ─────────────────────────────────────────────
    function updateKPI(kpi) {
        $('#valDangXuLy').text(kpi.dangXuLy);
        $('#valQuaHan').text(kpi.quaHan);
        $('#valTyLe').text(kpi.tyLeDungHan.toFixed(1) + '%');
        $('#valDonMoi').text(kpi.donMoiThang);
    }

    // ─── Charts: Donut ──────────────────────────────────────────
    function renderDonutChart(data) {
        var ctx = document.getElementById('donutChart');
        if (!ctx) return;

        var labels = data.map(function (d) { return d.label; });
        var values = data.map(function (d) { return d.value; });
        // Default palette if no colors provided
        var palette = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444'];
        var colors = data.map(function (d, i) { return d.color || palette[i % palette.length]; });

        if (donutChart) {
            donutChart.data.labels = labels;
            donutChart.data.datasets[0].data = values;
            donutChart.data.datasets[0].backgroundColor = colors;
            donutChart.update();
            return;
        }

        donutChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { font: { size: 12 }, padding: 12 }
                    }
                }
            }
        });
    }

    // ─── Charts: Line ───────────────────────────────────────────
    function renderLineChart(data) {
        var ctx = document.getElementById('lineChart');
        if (!ctx) return;

        if (lineChart) {
            lineChart.data.labels = data.labels;
            lineChart.data.datasets[0].data = data.nhan;
            lineChart.data.datasets[1].data = data.giaiQuyet;
            lineChart.update();
            return;
        }

        lineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Tiếp nhận',
                        data: data.nhan,
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59,130,246,.1)',
                        borderWidth: 2,
                        pointRadius: 4,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Giải quyết',
                        data: data.giaiQuyet,
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16,185,129,.1)',
                        borderWidth: 2,
                        pointRadius: 4,
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 12 } } }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, font: { size: 11 } }
                    },
                    x: {
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });
    }

    // ─── Charts: Horizontal Bar ─────────────────────────────────
    function renderBarChart(data) {
        var ctx = document.getElementById('barChart');
        if (!ctx) return;

        var labels = data.map(function (d) { return d.label; });
        var values = data.map(function (d) { return d.value; });

        if (barChart) {
            barChart.data.labels = labels;
            barChart.data.datasets[0].data = values;
            barChart.update();
            return;
        }

        barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Số đơn thư',
                    data: values,
                    backgroundColor: 'rgba(59,130,246,.7)',
                    borderColor: '#3B82F6',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',    // Horizontal bar
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, font: { size: 11 } }
                    },
                    y: {
                        ticks: { font: { size: 12 } }
                    }
                }
            }
        });
    }

    // ─── Load Dashboard Data (KPI + Charts) ─────────────────────
    function loadDashboardData() {
        var year = $('#yearSelector').val() || new Date().getFullYear();
        var phongId = $('#phongSelector').val() || '';

        var params = new URLSearchParams();
        params.append('year', year);
        if (phongId) params.append('phongId', phongId);

        $.ajax({
            url: '/Complaint/GetDashboardData?' + params.toString(),
            type: 'GET',
            success: function (res) {
                if (res.success && res.data) {
                    updateKPI(res.data.kpi);
                    if (res.data.donutChart && res.data.donutChart.length) {
                        renderDonutChart(res.data.donutChart);
                    }
                    if (res.data.lineChart) {
                        renderLineChart(res.data.lineChart);
                    }
                    if (res.data.barChart && res.data.barChart.length) {
                        renderBarChart(res.data.barChart);
                    }
                } else {
                    // Show zeros on error — graceful degradation
                    $('#valDangXuLy, #valQuaHan, #valTyLe, #valDonMoi').text('—');
                }
            },
            error: function () {
                toastr && toastr.warning('Không thể tải dữ liệu dashboard');
                $('#valDangXuLy, #valQuaHan, #valTyLe, #valDonMoi').text('—');
            }
        });
    }

    // ─── Row class by days left ─────────────────────────────────
    function getRowClass(daysLeft) {
        if (daysLeft < 0) return 'row-danger';
        if (daysLeft <= 3) return 'row-warning-strong';
        if (daysLeft <= 7) return 'row-warning';
        return '';
    }

    function getDaysBadge(daysLeft) {
        if (daysLeft < 0) {
            return '<span class="days-badge over">Quá ' + Math.abs(daysLeft) + ' ngày</span>';
        }
        if (daysLeft <= 3) {
            return '<span class="days-badge d3">Còn ' + daysLeft + ' ngày</span>';
        }
        if (daysLeft <= 7) {
            return '<span class="days-badge d7">Còn ' + daysLeft + ' ngày</span>';
        }
        return '<span class="days-badge ok">Còn ' + daysLeft + ' ngày</span>';
    }

    // ─── Render Warning Table ────────────────────────────────────
    function renderCanhBaoTable(data) {
        var tbody = $('#canhBaoTableBody');
        tbody.empty();
        // Reset selection
        selectedRows = [];
        updateReminderButton();
        $('#checkAll').prop('checked', false);

        if (!data || data.length === 0) {
            tbody.append(
                '<tr><td colspan="7" class="text-center" style="padding:24px;color:#94a3b8;">' +
                '<i class="fas fa-check-circle mr-2" style="color:var(--success)"></i>' +
                'Không có đơn thư nào cần cảnh báo</td></tr>'
            );
            return;
        }

        data.forEach(function (row) {
            var rowClass = getRowClass(row.soNgayConLai);
            var tr = $('<tr>').addClass(rowClass);

            tr.append(
                '<td class="text-center">' +
                '<input type="checkbox" class="row-check" data-id="' + escapeHtml(row.id) + '" ' +
                'data-name="' + escapeHtml(row.canBoName) + '">' +
                '</td>'
            );
            tr.append(
                '<td><span class="mono link" style="cursor:pointer;color:var(--primary);" ' +
                'onclick="window.location.href=\'/Complaint/Detail/' + escapeHtml(row.id) + '\'">' +
                escapeHtml(row.maDon) + '</span></td>'
            );
            tr.append('<td>' + escapeHtml(row.nguoiNop) + '</td>');
            tr.append('<td>' + formatDateVN(row.hanGiaiQuyet) + '</td>');
            tr.append('<td>' + getDaysBadge(row.soNgayConLai) + '</td>');
            tr.append('<td>' + escapeHtml(row.canBoName) + '</td>');
            tr.append('<td>' + escapeHtml(row.phongName) + '</td>');

            tbody.append(tr);
        });
    }

    // ─── Load Warning Table ─────────────────────────────────────
    function loadCanhBaoTable(filter) {
        currentFilter = filter || 'QuaHan';
        var tbody = $('#canhBaoTableBody');
        tbody.html(
            '<tr><td colspan="7" class="text-center" style="padding:24px;color:#94a3b8;">' +
            '<i class="fas fa-spinner fa-spin mr-2"></i> Đang tải...</td></tr>'
        );

        var params = new URLSearchParams();
        params.append('filter', filter);

        $.ajax({
            url: '/Complaint/GetCanhBaoData?' + params.toString(),
            type: 'GET',
            success: function (res) {
                // Update chip badge counts
                if (filter === 'QuaHan') $('#badgeQuaHan').text(res.total || 0);
                if (filter === 'D3') $('#badgeD3').text(res.total || 0);
                if (filter === 'D7') $('#badgeD7').text(res.total || 0);

                if (res.success) {
                    renderCanhBaoTable(res.data || []);
                } else {
                    tbody.html(
                        '<tr><td colspan="7" class="text-center" style="padding:24px;color:#94a3b8;">' +
                        'Không thể tải dữ liệu</td></tr>'
                    );
                }
            },
            error: function () {
                tbody.html(
                    '<tr><td colspan="7" class="text-center" style="padding:24px;color:var(--error);">' +
                    '<i class="fas fa-exclamation-triangle mr-2"></i> Lỗi kết nối máy chủ</td></tr>'
                );
            }
        });
    }

    // ─── Update send-reminder button state ──────────────────────
    function updateReminderButton() {
        var btn = $('#btnGuiNhacNho');
        if (!btn.length) return;
        if (selectedRows.length > 0) {
            btn.prop('disabled', false)
               .html('<i class="fas fa-envelope mr-1"></i> Gửi nhắc nhở (' + selectedRows.length + ' cán bộ)');
        } else {
            btn.prop('disabled', true)
               .html('<i class="fas fa-envelope mr-1"></i> Gửi nhắc nhở');
        }
    }

    // ─── Send reminder ───────────────────────────────────────────
    function guiNhacNho() {
        if (selectedRows.length === 0) return;

        if (!confirm('Gửi email nhắc nhở đến ' + selectedRows.length + ' cán bộ phụ trách?')) return;

        var btn = $('#btnGuiNhacNho');
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang gửi...');

        $.ajax({
            url: '/Complaint/GuiNhacNho',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ donIds: selectedRows }),
            headers: {
                'X-XSRF-TOKEN': getAntiForgeryToken(),
                'RequestVerificationToken': getAntiForgeryToken()
            },
            success: function (res) {
                if (res.success) {
                    toastr && toastr.success(res.message || 'Đã gửi email nhắc nhở thành công');
                    // Clear selection
                    selectedRows = [];
                    $('input.row-check').prop('checked', false);
                    $('#checkAll').prop('checked', false);
                    updateReminderButton();
                } else {
                    toastr && toastr.error(res.message || 'Không thể gửi nhắc nhở');
                    btn.prop('disabled', false).html('<i class="fas fa-envelope mr-1"></i> Gửi nhắc nhở (' + selectedRows.length + ' cán bộ)');
                }
            },
            error: function () {
                toastr && toastr.error('Đã có lỗi khi gửi nhắc nhở');
                btn.prop('disabled', false).html('<i class="fas fa-envelope mr-1"></i> Gửi nhắc nhở (' + selectedRows.length + ' cán bộ)');
            }
        });
    }

    // ─── Navigate KPI card to list with filter ──────────────────
    window.navigateToList = function (filterType) {
        var url = '/Complaint?status=' + encodeURIComponent(filterType);
        window.location.href = url;
    };

    // ─── Event Bindings ─────────────────────────────────────────
    function bindEvents() {
        // Year/Department selectors → reload dashboard data
        $('#yearSelector, #phongSelector').on('change', function () {
            loadDashboardData();
        });

        // Quick filter chips → reload warning table
        $(document).on('click', '.filter-chip', function () {
            $('.filter-chip').removeClass('active');
            $(this).addClass('active');
            var filter = $(this).data('filter');
            loadCanhBaoTable(filter);
        });

        // Select all checkbox
        $('#checkAll').on('change', function () {
            var checked = $(this).prop('checked');
            $('input.row-check').prop('checked', checked);
            selectedRows = [];
            if (checked) {
                $('input.row-check:checked').each(function () {
                    selectedRows.push($(this).data('id'));
                });
            }
            updateReminderButton();
        });

        // Individual row checkboxes
        $(document).on('change', 'input.row-check', function () {
            var id = $(this).data('id');
            if ($(this).prop('checked')) {
                if (selectedRows.indexOf(id) === -1) selectedRows.push(id);
            } else {
                selectedRows = selectedRows.filter(function (r) { return r !== id; });
                $('#checkAll').prop('checked', false);
            }
            updateReminderButton();
        });

        // Send reminder button
        $('#btnGuiNhacNho').on('click', guiNhacNho);
    }

    // ─── Initialize ─────────────────────────────────────────────
    $(document).ready(function () {
        loadDashboardData();
        loadCanhBaoTable('QuaHan');
        bindEvents();
    });

})();
