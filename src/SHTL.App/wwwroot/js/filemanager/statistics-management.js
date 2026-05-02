/**
 * Statistics Management - Document Statistics Dashboard
 * File: wwwroot/js/filemanager/statistics-management.js
 */
(function () {
    'use strict';

    let fileTypeChart = null;
    let profileTypeChart = null;
    let docTypeChart = null;
    let storageTable = null;

    // Initialize on document ready
    $(document).ready(function () {
        // Register Chart.js plugin for labels
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }

        initializeFilters();
        loadDashboardStats();
        initializeStorageTable();
        bindEvents();
    });

    /**
     * Initialize filter values
     */
    function initializeFilters() {
        // Mặc định để trống để xem toàn bộ dữ liệu (All time)
        $('#filterFrom').val('');
        $('#filterTo').val('');
        
        // Load warehouses for filter
        $.getJSON('/FileManager/FileManagerWarehouses/GetAll', function (response) {
            const data = Array.isArray(response) ? response : (response.data || []);
            $('#filterWarehouse').empty().append('<option value="">--- Tất cả các kho ---</option>');
            if (data && data.length > 0) {
                const options = data.map(item => `<option value="${item.id || item.ID}">${item.name || item.Name}</option>`).join('');
                $('#filterWarehouse').append(options);
            }
        });
    }

    /**
     * Load dashboard summary statistics and charts
     */
    function loadDashboardStats() {
        const params = {
            warehouseId: $('#filterWarehouse').val() || '',
            dateFrom: $('#filterFrom').val(),
            dateTo: $('#filterTo').val()
        };

        $.getJSON('/FileManager/Statistics/GetDashboard', params, function (response) {
            if (!response.isSuccess) return;

            const data = response.data;

            // Update Metric Cards
            $('#totalWarehouses').text(data.totalWarehouses.toLocaleString());
            $('#totalFolders').text(data.totalFolders.toLocaleString());
            $('#totalProfiles').text(data.totalProfiles.toLocaleString());
            $('#totalDocuments').text(data.totalDocuments.toLocaleString());
            $('#totalSizeGB').text(data.totalSizeGB.toFixed(2));

            // Render Charts
            renderFileTypeChart(data.documentsByType || []);
            renderProfileTypeChart(data.profileTypesDistribution || []);
            renderDocTypeChart(data.documentTypesDistribution || []);
        });
    }

    /**
     * Render Donut Chart: File Type Distribution with Percentages
     */
    function renderFileTypeChart(data) {
        const canvas = document.getElementById('fileTypeChart');
        if (!canvas) return;

        if (fileTypeChart) fileTypeChart.destroy();

        if (data.length === 0) {
            showNoData(canvas);
            return;
        }

        const total = data.reduce((sum, item) => sum + item.count, 0);

        fileTypeChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: data.map(item => item.typeName),
                datasets: [{
                    data: data.map(item => item.count),
                    backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 10, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed;
                                const pct = ((val / total) * 100).toFixed(1);
                                return ` ${context.label}: ${val.toLocaleString()} (${pct}%)`;
                            }
                        }
                    },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold', size: 10 },
                        formatter: (value) => {
                            const pct = ((value / total) * 100).toFixed(1);
                            return pct > 8 ? pct + '%' : '';
                        }
                    }
                }
            }
        });
    }

    /**
     * Render Bar Chart: Profile Type Distribution
     */
    function renderProfileTypeChart(data) {
        const canvas = document.getElementById('profileTypeChart');
        if (!canvas) return;

        if (profileTypeChart) profileTypeChart.destroy();

        if (data.length === 0) {
            showNoData(canvas);
            return;
        }

        const labels = data.map(x => x.name).slice(0, 10);

        profileTypeChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Số lượng hồ sơ',
                    data: data.map(x => x.count).slice(0, 10),
                    backgroundColor: '#6366f1',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Biểu đồ ngang cho không gian hẹp
                scales: {
                    y: { ticks: { font: { size: 10 } }, grid: { display: false } },
                    x: { beginAtZero: true, ticks: { font: { size: 10 }, precision: 0 }, grid: { color: '#f1f5f9' } }
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        color: '#64748b',
                        font: { size: 10, weight: 'bold' },
                        formatter: (val) => val > 0 ? val : ''
                    }
                }
            }
        });
    }

    /**
     * Render Bar Chart: Document Type Distribution
     */
    function renderDocTypeChart(data) {
        const canvas = document.getElementById('docTypeChart');
        if (!canvas) return;

        if (docTypeChart) docTypeChart.destroy();

        if (data.length === 0) {
            showNoData(canvas);
            return;
        }

        const labels = data.map(x => x.name).slice(0, 10);

        docTypeChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Số lượng tài liệu',
                    data: data.map(x => x.count).slice(0, 10),
                    backgroundColor: '#2dd4bf',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Biểu đồ ngang cho không gian hẹp
                scales: {
                    y: { ticks: { font: { size: 10 } }, grid: { display: false } },
                    x: { beginAtZero: true, ticks: { font: { size: 10 }, precision: 0 }, grid: { color: '#f1f5f9' } }
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        color: '#64748b',
                        font: { size: 10, weight: 'bold' },
                        formatter: (val) => val > 0 ? val : ''
                    }
                }
            }
        });
    }

    /**
     * Initialize Warehouse Statistics Table
     */
    function initializeStorageTable() {
        storageTable = $('#storageTable').DataTable({
            processing: true,
            ajax: {
                url: '/FileManager/Statistics/GetStorageByWarehouse',
                data: function (d) {
                    d.warehouseId = $('#filterWarehouse').val() || '';
                    d.dateFrom = $('#filterFrom').val();
                    d.dateTo = $('#filterTo').val();
                },
                dataSrc: 'data'
            },
            columns: [
                { data: 'warehouseName', render: d => `<strong>${d}</strong>` },
                { data: 'folderCount', className: 'text-center', render: d => d.toLocaleString() },
                { data: 'profileCount', className: 'text-center', render: d => d.toLocaleString() },
                { data: 'documentCount', className: 'text-center', render: d => d.toLocaleString() },
                { data: 'totalSizeGB', className: 'text-end', render: d => `<strong>${d.toFixed(2)}</strong>` }
            ],
            paging: false,
            searching: false,
            info: false,
            order: [[4, 'desc']],
            drawCallback: function (settings) {
                updateTableTotals(settings.json ? settings.json.data : []);
            }
        });
    }

    /**
     * Calculate and update totals in table footer
     */
    function updateTableTotals(data) {
        if (!data) return;
        
        let folders = 0, profiles = 0, docs = 0, size = 0;
        data.forEach(item => {
            folders += item.folderCount || 0;
            profiles += item.profileCount || 0;
            docs += item.documentCount || 0;
            size += item.totalSizeGB || 0;
        });

        $('#totalFoldersSum').text(folders.toLocaleString());
        $('#totalProfilesSum').text(profiles.toLocaleString());
        $('#totalDocsSum').text(docs.toLocaleString());
        $('#totalSizeGBSum').text(size.toFixed(2));
    }

    /**
     * Event bindings
     */
    function bindEvents() {
        $('#btnApplyDateFilter').on('click', function () {
            loadDashboardStats();
            storageTable.ajax.reload();
        });

        $('#btnRefreshStats').on('click', function () {
            loadDashboardStats();
            storageTable.ajax.reload();
        });
    }

    function showNoData(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText('Không có dữ liệu', canvas.width / 2, canvas.height / 2);
    }

    function formatDate(date) {
        return date.toISOString().split('T')[0];
    }
})();
