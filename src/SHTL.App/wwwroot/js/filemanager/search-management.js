/**
 * Search Management - Advanced Document Search
 * File: wwwroot/js/filemanager/search-management.js
 * Description: Dynamic metadata filters + AJAX HTML Search with Figma style
 */
(function () {
    'use strict';

    // Initialize on document ready
    $(document).ready(function () {
        initializeUI();
        loadFilterData();
        bindEvents();
        // Load initial data (optional, user asked for "Nhấn nút TÌM KIẾM")
    });

    /**
     * Initialize UI components
     */
    function initializeUI() {
        // Initialize Select2 for all basic selects
        $('.select2-basic').select2({
            theme: 'default',
            placeholder: function() {
                return $(this).data('placeholder') || 'Tất cả';
            },
            allowClear: true
        });
    }

    /**
     * Load dynamic filter data (Warehouses, Profile Types, etc.)
     */
    function loadFilterData() {
        // Load Warehouses
        $.getJSON('/FileManager/Search/GetWarehouses', function (response) {
            const items = response.data || [];
            if (Array.isArray(items)) {
                items.forEach(item => $('#filterWarehouse').append(`<option value="${item.id}">${item.name}</option>`));
            }
        });
        
        // Load Profile Types
        $.getJSON('/FileManager/Search/GetProfileTypes', function (response) {
            const data = response.data || {};
            const items = data.items || [];
            if (Array.isArray(items)) {
                items.forEach(item => $('#filterProfileType').append(`<option value="${item.id}">${item.name}</option>`));
            }
        });

        // Load Document Types
        $.getJSON('/FileManager/Search/GetDocumentTypes', function (response) {
            const data = response.data || {};
            const items = data.items || [];
            if (Array.isArray(items)) {
                items.forEach(item => $('#filterDocumentType').append(`<option value="${item.id}">${item.name}</option>`));
            }
        });

        // Load Departments
        $.getJSON('/FileManager/Search/GetDepartments', function (response) {
            const items = response.data || [];
            if (Array.isArray(items)) {
                items.forEach(item => $('#filterDepartment').append(`<option value="${item.id}">${item.name}</option>`));
            }
        });
    }

    /**
     * Bind events for buttons and pagination
     */
    function bindEvents() {
        // Search button
        $('#btnApplyFilter').on('click', function () {
            $('#currentPage').val(1); // Reset to page 1 on new search
            loadSearchData();
        });

        // Clear filter
        $('#btnClearFilter').on('click', function () {
            $('#formSearch')[0].reset();
            $('.select2-basic').val(null).trigger('change');
            $('#searchResultContainer').html('<div class="text-center py-5 text-muted italic">Nhấn nút "TÌM KIẾM" để hiển thị kết quả</div>');
            $('#resultCount').html('(0 kết quả)');
            toastr.info('Đã xóa bộ lọc');
        });

        // Enter key to search
        $('#formSearch input').on('keypress', function (e) {
            if (e.which === 13) { 
                e.preventDefault(); 
                $('#btnApplyFilter').click();
            }
        });

        // Pagination: Change Page — _Pagination uses data-page attribute
        $(document).on('click', '.onSetPageIndex', function (e) {
            e.preventDefault();
            if ($(this).hasClass('disabled')) return;
            const page = $(this).data('page');
            if (!page) return;
            console.log('Setting Page to:', page);
            $('#currentPage').val(page);
            loadSearchData();
        });

        // Pagination: Change Page Size
        $(document).on('change', '.onChangePageSize', function () {
            const pageSize = $(this).val();
            $('#currentPageSize').val(pageSize);
            $('#currentPage').val(1);
            loadSearchData();
        });
    }

    /**
     * Main data loading function - Fetching AJAX HTML
     */
    function loadSearchData() {
        const $container = $('#searchResultContainer');
        const $spinner = $('#searchSpinner');
        const formData = $('#formSearch').serialize();
        console.log('Search Criteria:', formData);

        $spinner.show();
        $container.css('opacity', '0.6');

        $.ajax({
            url: '/FileManager/Search/AdvancedSearch',
            type: 'POST',
            data: formData,
            success: function (html) {
                $spinner.hide();
                $container.css('opacity', '1');
                $container.html(html);
                
                // Update result count from the loaded table info if exists
                const totalCount = $('#searchResultsTable').siblings('.pagination-figma-container').find('.pagination-info-figma span').text().match(/\d+/);
                if (totalCount) {
                    $('#resultCount').html(`(<span class="text-primary font-weight-bold">${totalCount[0]}</span> kết quả)`);
                }

                // Scroll to results
                $('html, body').animate({
                    scrollTop: $container.offset().top - 100
                }, 500);

                // Initialize tooltips for new content
                if ($.fn.tooltip) {
                    $('[title]').tooltip();
                }
            },
            error: function (xhr) {
                $spinner.hide();
                $container.css('opacity', '1');
                toastr.error('Có lỗi xảy ra khi tìm kiếm: ' + xhr.statusText);
            }
        });
    }

})();
