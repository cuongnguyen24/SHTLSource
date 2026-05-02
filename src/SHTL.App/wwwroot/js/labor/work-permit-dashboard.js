// work-permit-dashboard.js - Dashboard with Chart.js widgets
var businessTypeChart, statusChart, trendChart, approvalRateChart;

$(document).ready(function () {
    // Initialize charts
    initializeCharts();

    // Load data
    loadDashboardData();

    // Load expiring permits table
    loadExpiringPermits();

    // Refresh button
    $('#btnRefreshExpiring').on('click', function () {
        loadExpiringPermits();
    });

    // Trend type selector
    $('#trendTypeSelector').on('change', function () {
        loadTrendData($(this).val());
    });
});

// Initialize all charts
function initializeCharts() {
    // Business Type Bar Chart
    var ctxBusinessType = document.getElementById('businessTypeChart').getContext('2d');
    businessTypeChart = new Chart(ctxBusinessType, {
        type: 'bar',
        data: {
            labels: ['Cấp mới', 'Gia hạn', 'Cấp lại'],
            datasets: [{
                label: 'Số hồ sơ',
                data: [0, 0, 0],
                backgroundColor: ['#007bff', '#17a2b8', '#ffc107']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // Status Donut Chart
    var ctxStatus = document.getElementById('statusChart').getContext('2d');
    statusChart = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['Chờ thẩm định', 'Đang thẩm định', 'Chờ ký số', 'Có hiệu lực', 'Hết hạn', 'Đã thu hồi'],
            datasets: [{
                data: [0, 0, 0, 0, 0, 0],
                backgroundColor: [
                    '#6c757d',
                    '#17a2b8',
                    '#007bff',
                    '#28a745',
                    '#343a40',
                    '#dc3545'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // Trend Line Chart
    var ctxTrend = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Hồ sơ nộp',
                data: [],
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // Approval Rate Gauge (Doughnut as gauge)
    var ctxApproval = document.getElementById('approvalRateChart').getContext('2d');
    approvalRateChart = new Chart(ctxApproval, {
        type: 'doughnut',
        data: {
            labels: ['Đã duyệt', 'Từ chối/Hủy'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#28a745', '#e9ecef'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            circumference: 180,
            rotation: -90,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

// Load dashboard statistics and charts data
function loadDashboardData() {
    $.ajax({
        url: '/WorkPermit/GetDashboardData',
        type: 'GET',
        success: function (response) {
            if (response.success && response.data) {
                updateStatistics(response.data.statistics);
                updateBusinessTypeChart(response.data.byBusinessType);
                updateStatusChart(response.data.byStatus);
                updateApprovalRate(response.data.approvalRate);
            }
        },
        error: function () {
            console.error('Failed to load dashboard data');
        }
    });

    // Load trend data
    loadTrendData('all');
}

// Update statistics cards
function updateStatistics(stats) {
    $('#statTotalApplications').text((stats.totalApplications || 0).toLocaleString());
    $('#statPending').text((stats.pending || 0).toLocaleString());
    $('#statActivePermits').text((stats.activePermits || 0).toLocaleString());
    $('#statExpiring').text((stats.expiring || 0).toLocaleString());
}

// Update business type chart
function updateBusinessTypeChart(data) {
    if (!data) return;
    businessTypeChart.data.datasets[0].data = [
        data.capMoi || 0,
        data.giaHan || 0,
        data.capLai || 0
    ];
    businessTypeChart.update();
}

// Update status chart
function updateStatusChart(data) {
    if (!data) return;
    statusChart.data.datasets[0].data = [
        data.choThamDinh || 0,
        data.dangThamDinh || 0,
        data.choKySo || 0,
        data.coHieuLuc || 0,
        data.hetHan || 0,
        data.daThuHoi || 0
    ];
    statusChart.update();
}

// Update approval rate
function updateApprovalRate(rate) {
    if (rate == null) rate = 0;
    approvalRateChart.data.datasets[0].data = [rate, 100 - rate];
    approvalRateChart.update();
    $('#approvalRateText').text(rate.toFixed(1) + '%');
}

// Load trend data
function loadTrendData(type) {
    $.ajax({
        url: '/WorkPermit/GetTrendData',
        type: 'GET',
        data: { businessType: type, months: 12 },
        success: function (response) {
            if (response.success && response.data) {
                updateTrendChart(response.data);
            }
        },
        error: function () {
            console.error('Failed to load trend data');
        }
    });
}

// Update trend chart
function updateTrendChart(data) {
    if (!data || !data.labels || !data.values) return;
    trendChart.data.labels = data.labels;
    trendChart.data.datasets[0].data = data.values;
    trendChart.update();
}

// Load expiring permits table
function loadExpiringPermits() {
    $.ajax({
        url: '/WorkPermit/GetExpiringPermits',
        type: 'GET',
        data: { daysUntilExpiry: 45 },
        success: function (response) {
            if (response.success && response.data) {
                populateExpiringTable(response.data);
            }
        },
        error: function () {
            console.error('Failed to load expiring permits');
        }
    });
}

// Populate expiring permits table
function populateExpiringTable(data) {
    var tbody = $('#expiringPermitsTable tbody');
    tbody.empty();

    if (!data || data.length === 0) {
        tbody.append('<tr><td colspan="6" class="text-center">Không có GPLĐ sắp hết hạn</td></tr>');
        return;
    }

    data.forEach(function (item) {
        var badgeClass = 'badge-success';
        if (item.daysUntilExpiry <= 15) {
            badgeClass = 'badge-danger';
        } else if (item.daysUntilExpiry <= 30) {
            badgeClass = 'badge-warning';
        }

        var row = '<tr>' +
            '<td>' + item.soGPLD + '</td>' +
            '<td>' + item.hoVaTen + '</td>' +
            '<td>' + item.tenNguoiSuDungLaoDong + '</td>' +
            '<td>' + new Date(item.ngayHetHan).toLocaleDateString('vi-VN') + '</td>' +
            '<td><span class="badge ' + badgeClass + '">' + item.daysUntilExpiry + ' ngày</span></td>' +
            '<td>' +
            '<a href="/WorkPermit/Details/' + item.applicationId + '" class="btn btn-sm btn-info">' +
            '<i class="fas fa-eye"></i></a>' +
            '</td>' +
            '</tr>';
        tbody.append(row);
    });
}
