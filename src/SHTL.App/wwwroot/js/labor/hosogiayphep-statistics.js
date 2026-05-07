/**
 * HoSoGiayPhep Statistics - Business Logic & UI Interaction
 * Handles data fetching, chart rendering, and report export.
 */

var statisticsModule = (function () {
    let mainCharts = {
        category: null,
        nationality: null
    };

    const COLORS = {
        primary: '#6366f1',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#06b6d4'
    };

    function init() {
        initSelect2();
        updatePeriodValues();
        initEventListeners();
        loadStatistics();
        loadExportHistory();
    }

    function initSelect2() {
        if ($.fn.select2) {
            $('.select2-figma').select2({
                placeholder: "-- Chọn --",
                allowClear: true,
                width: '100%'
            });
        }
    }

    function updatePeriodValues() {
        const type = $('#periodType').val();
        const valueSelect = $('#periodValue');
        valueSelect.empty();

        if (type === 'thang') {
            for (let i = 1; i <= 12; i++) {
                valueSelect.append(`<option value="${i}" ${i === new Date().getMonth() + 1 ? 'selected' : ''}>Tháng ${i}</option>`);
            }
        } else if (type === 'quy') {
            for (let i = 1; i <= 4; i++) {
                const currentQuarter = Math.floor((new Date().getMonth() + 3) / 3);
                valueSelect.append(`<option value="${i}" ${i === currentQuarter ? 'selected' : ''}>Quý ${i}</option>`);
            }
        } else if (type === 'nam') {
            valueSelect.append(`<option value="1" selected>Cả năm</option>`);
        }
    }

    function initEventListeners() {
        $('#periodType').on('change', updatePeriodValues);
        $('#btnFilter').on('click', loadStatistics);
        $('#btnExportExcel').on('click', () => exportReport('Excel'));
        $('#btnRefreshHistory').on('click', loadExportHistory);
    }

    function loadStatistics() {
        const params = {
            periodType: $('#periodType').val(),
            periodValue: $('#periodValue').val(),
            year: $('#reportYear').val(),
            loaiNV: $('#filterLoaiNV').val(),
            quocTich: $('#filterQuocTich').val()
        };

        // Show loading state
        $('#btnUpdateStats i').addClass('fa-spin');

        $.ajax({
            url: '/HoSoGiayPhep/GetReportStatistics',
            type: 'GET',
            data: params,
            success: function (res) {
                if (res.success && res.data) {
                    updateSummaryCards(res.data);
                    renderCategoryChart(res.data.categoryStats);
                    renderNationalityChart(res.data.topNationalities);
                } else {
                    toastr.error(res.message || "Không thể tải dữ liệu thống kê");
                }
            },
            error: function () {
                toastr.error("Lỗi hệ thống khi tải dữ liệu");
            },
            complete: function () {
                $('#btnFilter i').removeClass('fa-spin');
            }
        });
    }

    function updateSummaryCards(data) {
        $('#statActiveGPLD').text(data.totalActiveGPLD.toLocaleString());
        $('#statNewIssued').text(data.totalNewlyIssuedInRange.toLocaleString());
        $('#statExpiringNext').text(data.totalExpiringNextMonth.toLocaleString());
        $('#statRevoked').text(data.totalRevokedInRange.toLocaleString());

        // Trend
        const trendEl = $('#trendNew');
        const percent = Math.abs(data.newlyIssuedChangePercent);
        if (data.newlyIssuedChangePercent >= 0) {
            trendEl.find('i').removeClass('fa-caret-down trend-down').addClass('fa-caret-up trend-up');
            trendEl.find('.trend-up, .trend-down').text(`${percent}%`).removeClass('trend-down').addClass('trend-up');
        } else {
            trendEl.find('i').removeClass('fa-caret-up trend-up').addClass('fa-caret-down trend-down');
            trendEl.find('.trend-up, .trend-down').text(`${percent}%`).removeClass('trend-up').addClass('trend-down');
        }
    }

    function renderCategoryChart(stats) {
        const labels = Object.keys(stats);
        const dataValues = Object.values(stats);
        const backgroundColors = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger, COLORS.info];

        if (mainCharts.category) mainCharts.category.destroy();

        const ctx = document.getElementById('categoryChart').getContext('2d');
        mainCharts.category = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: backgroundColors.slice(0, labels.length),
                    borderWidth: 0,
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: { size: 12, weight: '600' }
                        }
                    }
                }
            }
        });
    }

    function renderNationalityChart(data) {
        const labels = data.map(x => x.name);
        const values = data.map(x => x.count);

        if (mainCharts.nationality) mainCharts.nationality.destroy();

        const ctx = document.getElementById('nationalityChart').getContext('2d');
        mainCharts.nationality = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Số lao động',
                    data: values,
                    backgroundColor: COLORS.primary,
                    borderRadius: 8,
                    barThickness: 20
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { weight: '600' } } },
                    y: { grid: { display: false }, ticks: { font: { weight: '600' } } }
                }
            }
        });
    }

    function loadExportHistory() {
        $.ajax({
            url: '/HoSoGiayPhep/GetExportHistory',
            type: 'GET',
            data: { count: 8 },
            success: function (res) {
                const tbody = $('#exportHistoryTable tbody');
                tbody.empty();

                if (res.success && res.data && res.data.length > 0) {
                    res.data.forEach(item => {
                        const dateStr = item.exportedDate ? new Date(item.exportedDate).toLocaleString('vi-VN') : 'N/A';
                        tbody.append(`
                            <tr>
                                <td class="pl-4 font-weight-bold" style="color: #1e293b;">${item.period}</td>
                                <td>
                                    <span class="badge ${item.type === 'Excel' ? 'badge-soft-success' : 'badge-soft-danger'}" style="border-radius:6px; padding: 4px 10px;">
                                        ${item.type}
                                    </span>
                                </td>
                                <td class="font-weight-medium">${item.exportedBy}</td>
                                <td class="text-center text-muted small">${dateStr}</td>
                                <td class="pr-4 text-right">
                                    <button class="btn btn-sm btn-outline-primary btn-premium-action shadow-sm" 
                                            style="border-radius:8px; padding: 4px 12px;" 
                                            onclick="reExportReport(this)"
                                            data-period-type="${item.periodType || ''}"
                                            data-period-value="${item.periodValue || ''}"
                                            data-year="${item.year || ''}"
                                            data-format="${item.type || ''}"
                                            data-loai-nv="${item.loaiNghiepVuRaw || ''}"
                                            data-quoc-tich="${item.quocTichId || ''}">
                                        <i class="fas fa-redo mr-1" style="font-size: 10px;"></i> Tải lại
                                    </button>
                                </td>
                            </tr>
                        `);
                    });
                } else {
                    tbody.append('<tr><td colspan="5" class="text-center py-4 text-muted small">Chưa có lịch sử xuất báo cáo</td></tr>');
                }
            }
        });
    }

    return {
        init: init
    };
})();

$(document).ready(function () {
    statisticsModule.init();
});

// Global functions for direct HTML calls
function exportReport(format, overrideParams) {
    const params = overrideParams || {
        periodType: $('#periodType').val(),
        periodValue: $('#periodValue').val(),
        year: $('#reportYear').val(),
        format: format,
        loaiNV: $('#filterLoaiNV').val(),
        quocTich: $('#filterQuocTich').val()
    };

    if (overrideParams && !overrideParams.format) params.format = format;

    // Use dynamic form for download
    const form = $('<form>', {
        action: '/HoSoGiayPhep/ExportReport',
        method: 'POST'
    });

    Object.keys(params).forEach(key => {
        // Chỉ append nếu có giá trị thực sự (không null, undefined hoặc chuỗi rỗng)
        if (params[key] !== null && params[key] !== undefined && params[key] !== "") {
            form.append($('<input>', { type: 'hidden', name: key, value: params[key] }));
        }
    });

    // Bổ sung Antiforgery Token để tránh lỗi 400/403 khi submit POST
    const token = $('input[name="__RequestVerificationToken"]').val();
    if (token) {
        form.append($('<input>', { type: 'hidden', name: '__RequestVerificationToken', value: token }));
    }

    $('body').append(form);
    form.submit();
    form.remove();

    // Refresh history after a short delay
    setTimeout(() => {
        $('#btnRefreshHistory').trigger('click');
    }, 2000);
}

function reExportReport(btn) {
    const $btn = $(btn);
    const params = {
        periodType: $btn.data('period-type'),
        periodValue: $btn.data('period-value'),
        year: $btn.data('year'),
        format: $btn.data('format'),
        loaiNV: $btn.data('loai-nv'),
        quocTich: $btn.data('quoc-tich')
    };
    
    // Parse period type from period string if needed, but we should have it from DTO
    // The DTO needs to be updated in the backend to return these raw values.
    
    // Add loading effect to button
    const originalHtml = $btn.html();
    $btn.html('<i class="fas fa-spinner fa-spin"></i>').prop('disabled', true);
    
    exportReport(params.format, params);
    
    setTimeout(() => {
        $btn.html(originalHtml).prop('disabled', false);
    }, 2000);
}
