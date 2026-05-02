// wwwroot/js/dashboard-kpi-tdld-management.js
(function () {
    'use strict';

    let trendChart, scopeChart, topEnterprisesChart;

    /**
     * Load KPI dashboard data via AJAX
     */
    function loadKPIData() {
        const periodId = $('#filterPeriod').val() || null;
        const year = $('#filterYear').val() || new Date().getFullYear();

        $.ajax({
            url: '/DashboardKPITDLD/GetDashboardData',
            type: 'GET',
            data: { periodId, year },
            success: function (res) {
                if (res.success && res.data) {
                    renderKPICards(res.data);
                    renderCharts(res.data);
                } else {
                    console.warn('No KPI data returned');
                    resetKPICards();
                }
            },
            error: function (xhr, status, error) {
                console.error('Failed to load KPI data:', error);
                resetKPICards();
            }
        });
    }

    /**
     * Render KPI stat cards
     */
    function renderKPICards(data) {
        const total = data.totalEnterprises || 0;
        const filed = data.filedCount || 0;
        const notFiled = data.notFiledCount || 0;
        const rate = total > 0 ? Math.round((filed / total) * 100) : 0;

        $('#totalEnterprises').text(total.toLocaleString());
        $('#filedCount').text(filed.toLocaleString());
        $('#notFiledCount').text(notFiled.toLocaleString());
        $('#filingRate').text(rate + '%');
    }

    /**
     * Reset KPI cards to zero
     */
    function resetKPICards() {
        $('#totalEnterprises').text('0');
        $('#filedCount').text('0');
        $('#notFiledCount').text('0');
        $('#filingRate').text('0%');
    }

    /**
     * Render all charts
     */
    function renderCharts(data) {
        renderTrendLineChart(data.trendData || []);
        renderScopePieChart(data.scopeDistribution || {});
        renderTopEnterprisesBarChart(data.topEnterprises || []);
    }

    /**
     * Render trend line chart (last 12 months)
     */
    function renderTrendLineChart(trendData) {
        const ctx = document.getElementById('trendLineChart');
        if (!ctx) return;

        // Destroy previous chart instance
        if (trendChart) {
            trendChart.destroy();
        }

        // Extract labels and data
        const labels = trendData.map(d => d.month || '');
        const filedCounts = trendData.map(d => d.filed || 0);
        const notFiledCounts = trendData.map(d => d.notFiled || 0);

        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Đã khai báo',
                        data: filedCounts,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Chưa khai báo',
                        data: notFiledCounts,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    /**
     * Render scope distribution pie chart
     */
    function renderScopePieChart(scopeData) {
        const ctx = document.getElementById('scopePieChart');
        if (!ctx) return;

        // Destroy previous chart instance
        if (scopeChart) {
            scopeChart.destroy();
        }

        const domestic = scopeData.domestic || 0;
        const foreign = scopeData.foreign || 0;
        const both = scopeData.both || 0;

        scopeChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Trong nước', 'Nước ngoài', 'Cả hai'],
                datasets: [{
                    data: [domestic, foreign, both],
                    backgroundColor: ['#6366f1', '#f59e0b', '#10b981'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        display: true,
                        position: 'right'
                    }
                }
            }
        });
    }

    /**
     * Render top 10 enterprises bar chart
     */
    function renderTopEnterprisesBarChart(topEnterprises) {
        const ctx = document.getElementById('topEnterprisesBarChart');
        if (!ctx) return;

        // Destroy previous chart instance
        if (topEnterprisesChart) {
            topEnterprisesChart.destroy();
        }

        const labels = topEnterprises.map(e => e.enterpriseName || '');
        const totals = topEnterprises.map(e => e.totalWorkers || 0);

        topEnterprisesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tổng nhu cầu lao động',
                    data: totals,
                    backgroundColor: '#6366f1',
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 3,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    /**
     * Initialize event handlers
     */
    function initEventHandlers() {
        $('#btnRefresh').on('click', loadKPIData);
        $('#filterPeriod, #filterYear').on('change', loadKPIData);
    }

    /**
     * Initialize module
     */
    $(document).ready(function () {
        initEventHandlers();
        loadKPIData();
    });

})();
