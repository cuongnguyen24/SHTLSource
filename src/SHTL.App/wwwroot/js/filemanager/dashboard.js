/**
 * Dashboard Management Script (Modern Version)
 * Module: FileManager - Dashboard
 * Author: AXDD Dev Team
 */

(function() {
    'use strict';

    // Initialize on document ready
    $(document).ready(function() {
        loadStatistics();

        // Refresh every 10 minutes (matching Redis cache is 60m, but UI can check more often)
        // setInterval(loadStatistics, 10 * 60 * 1000);
    });

    /**
     * Load statistics from API (Cached by Redis on backend)
     */
    function loadStatistics() {
        const statsUrl = '/FileManager/Dashboard/GetStatistics';
        
        $.ajax({
            url: statsUrl,
            type: 'GET',
            dataType: 'json',
            success: function(response) {
                if (response.success && response.data) {
                    updateStatsCards(response.data);
                    
                    if (response.fromCache) {
                        console.log('Dashboard stats loaded from Redis cache');
                    }
                } else {
                    showError(response.message || 'Không thể tải dữ liệu thống kê');
                    showPlaceholderValues();
                }
            },
            error: function(xhr, status, error) {
                console.error('Statistics load error:', error);
                showError('Lỗi kết nối máy chủ. Vui lòng thử lại sau.');
                showPlaceholderValues();
            }
        });
    }

    /**
     * Update stats cards with fetched data
     * @param {Object} data - Statistics data from API
     */
    function updateStatsCards(data) {
        // Main Statistics with animation
        animateValue('statWarehouses', 0, data.totalWarehouses || 0, 1000);
        animateValue('statFolders', 0, data.totalFolders || 0, 1000);
        animateValue('statProfiles', 0, data.totalProfiles || 0, 1000);
        animateValue('statDocuments', 0, data.totalDocuments || 0, 1000);
        
        // Total Size formatting
        const sizeElement = document.getElementById('statTotalSize');
        if (sizeElement) {
            sizeElement.textContent = formatBytesFromMB(data.totalSizeMB || 0);
        }

        // Update timestamp
        const timeElement = document.getElementById('lastUpdated');
        if (timeElement) {
            timeElement.textContent = data.lastUpdated || '--:--';
        }
    }

    /**
     * Animate number counting
     */
    function animateValue(elementId, start, end, duration) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (end === 0) {
            element.textContent = '0';
            return;
        }

        const range = end - start;
        let current = start;
        const increment = end > start ? Math.ceil(range / (duration / 16)) : -1;
        const startTime = performance.now();

        function step(timestamp) {
            const progress = Math.min((timestamp - startTime) / duration, 1);
            current = Math.floor(progress * range + start);
            element.textContent = formatNumber(current);
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                element.textContent = formatNumber(end);
            }
        }

        window.requestAnimationFrame(step);
    }

    /**
     * Format MB to appropriate unit (GB, TB or MB)
     */
    function formatBytesFromMB(mb) {
        if (mb === 0) return '0 MB';
        if (mb < 1024) return mb.toFixed(1) + ' MB';
        
        const gb = mb / 1024;
        if (gb < 1024) return gb.toFixed(2) + ' GB';
        
        const tb = gb / 1024;
        return tb.toFixed(2) + ' TB';
    }

    /**
     * Format number with thousand separators
     */
    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * Show placeholder values
     */
    function showPlaceholderValues() {
        const statIds = ['statWarehouses', 'statFolders', 'statProfiles', 'statDocuments', 'statTotalSize'];
        statIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '--';
        });
    }

    /**
     * Notification helper
     */
    function showError(message) {
        if (typeof Swal !== 'undefined') {
            const Toast = Swal.mixin({
                toast: true, position: 'top-end', showConfirmButton: false, timer: 3000
            });
            Toast.fire({ icon: 'error', title: message });
        } else if (typeof toastr !== 'undefined') {
            toastr.error(message);
        }
    }

})();
