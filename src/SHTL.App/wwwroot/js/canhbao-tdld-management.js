// wwwroot/js/canhbao-tdld-management.js
(function () {
    'use strict';

    /**
     * Load alert data via AJAX
     */
    function loadAlertData() {
        const periodId = $('#filterPeriod').val() || '';
        
        $.ajax({
            url: '/CanhBaoTDLD/GetAlertData',
            type: 'GET',
            data: { periodId: periodId || null },
            success: function (res) {
                if (res.success && res.data) {
                    renderAlerts(res.data);
                } else {
                    $('#alertTableBody').html('<tr><td colspan="7" class="text-center text-muted">Không có dữ liệu</td></tr>');
                    resetStatCards();
                }
            },
            error: function () {
                $('#alertTableBody').html('<tr><td colspan="7" class="text-center text-danger">Lỗi tải dữ liệu</td></tr>');
                resetStatCards();
            }
        });
    }

    /**
     * Render alerts to table and populate stat cards
     */
    function renderAlerts(alerts) {
        if (!Array.isArray(alerts) || alerts.length === 0) {
            $('#alertTableBody').html('<tr><td colspan="7" class="text-center text-muted">Không có cảnh báo</td></tr>');
            resetStatCards();
            return;
        }

        // Apply filter
        let filtered = alerts;
        const level = $('#filterAlertLevel').val();
        if (level) {
            filtered = alerts.filter(a => a.alertLevel === level);
        }

        // Calculate stat card values
        let d7 = 0, d3 = 0, overdue = 0;
        alerts.forEach(a => {
            if (a.alertLevel === 'D-7') d7++;
            else if (a.alertLevel === 'D-3') d3++;
            else if (a.alertLevel === 'Overdue') overdue++;
        });

        // Update stat cards
        $('#countD7').text(d7);
        $('#countD3').text(d3);
        $('#countOverdue').text(overdue);

        // Render table rows
        const rows = filtered.map((item, idx) => {
            const levelClass = item.alertLevel === 'D-7' ? 'alert-level-d7'
                : item.alertLevel === 'D-3' ? 'alert-level-d3' : 'alert-level-overdue';
            const levelIcon = item.alertLevel === 'D-7' ? '⚠️'
                : item.alertLevel === 'D-3' ? '🔶' : '🚨';

            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${item.enterpriseName || ''}</td>
                    <td>${item.taxCode || ''}</td>
                    <td>${item.industrialZoneName || ''}</td>
                    <td>${item.submissionDeadline ? new Date(item.submissionDeadline).toLocaleDateString('vi-VN') : ''}</td>
                    <td class="${levelClass} fw-bold">${levelIcon} ${item.alertLevel || ''}</td>
                    <td>${item.daysRemaining ?? ''}</td>
                </tr>
            `;
        }).join('');

        $('#alertTableBody').html(rows);
    }

    /**
     * Reset stat cards to zero
     */
    function resetStatCards() {
        $('#countD7').text('0');
        $('#countD3').text('0');
        $('#countOverdue').text('0');
    }

    /**
     * Initialize event handlers
     */
    function initEventHandlers() {
        $('#btnRefresh').on('click', loadAlertData);
        $('#filterPeriod, #filterAlertLevel').on('change', loadAlertData);
    }

    /**
     * Initialize module
     */
    $(document).ready(function () {
        initEventHandlers();
        loadAlertData();
    });

})();
