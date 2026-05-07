/**
 * Enterprise Management JavaScript (Quản lý Doanh nghiệp)
 */
(function () {
    'use strict';

    let table;
    let deleteId = null;
    let deleteName = '';

    // Expose statusUploader globally for use by enterprise-management.js event handlers
    window.statusUploader = null;

    $(document).ready(function () {
        initializeEventHandlers();
        initStatusUploader();
    });

    // Re-init uploader after quickModal injects _StatusUpdateModal partial
    $(document).on('commonModal.loaded', function () {
        initStatusUploader();
    });

    /**
     * Initialize FileUploadComponent for status update modal (if present on page)
     */
    function initStatusUploader() {
        try {
            if (typeof FileUploadComponent === 'undefined') return;
            if (!document.getElementById('uploadZone_statusUpdate')) return;

            window.statusUploader = new FileUploadComponent({
                dropZoneId:  'uploadZone_statusUpdate',
                fileInputId: 'statusUpdateFiles',
                fileQueueId: 'fileQueue_statusUpdate',
                maxFiles:    5,
                maxSizeMB:   20,
                simple:      true
            });
            $('#statusUpdateModal').on('hidden.bs.modal', function () {
                if (window.statusUploader) window.statusUploader.clear();
            });
        } catch (e) {
            console.error('Failed to initialize statusUploader:', e);
        }
    }

    /**
     * Bind filter & delete handlers
     */
    function initializeEventHandlers() {
        // Init Select2 for filter dropdowns
        if (typeof window.initSelect2 === 'function') {
            window.initSelect2('.ent-filter-select2');
        } else if ($.fn.select2) {
            $('.ent-filter-select2').select2({
                theme: 'bootstrap4',
                width: 'resolve',
                allowClear: true,
                language: { noResults: function () { return 'Không tìm thấy'; } }
            });
        }

        // Search on Enter / debounce input
        var searchTimer;
        $('#customSearchInput').on('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                if (table) table.ajax.reload(null, false);
            }, 400);
        });

        $('#customSearchInput').on('keydown', function (e) {
            if (e.key === 'Enter') {
                clearTimeout(searchTimer);
                if (table) table.ajax.reload(null, false);
            }
        });

        // Dropdowns: reload on change
        $('#filterEconomicSector, #filterStatus').on('change', function () {
            if (table) table.ajax.reload(null, false);
        });
    }

    /**
     * Safely escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (text == null) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

})();
