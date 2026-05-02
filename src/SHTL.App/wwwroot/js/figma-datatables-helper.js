/**
 * FIGMA DATATABLES HELPER
 * Centralized configuration and styling for DataTables to match Figma design.
 */

const FigmaDataTables = {
    /**
     * Cấu hình mặc định cho DataTables theo phong cách Figma
     */
    defaultConfig: {
        language: {
            url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/vi.json",
            paginate: {
                previous: '<i class="fas fa-chevron-left"></i>',
                next: '<i class="fas fa-chevron-right"></i>',
                first: '<i class="fas fa-angle-double-left"></i>',
                last: '<i class="fas fa-angle-double-right"></i>'
            },
            lengthMenu: "_MENU_",
            info: "Tổng có _TOTAL_ bản ghi",
            infoEmpty: "Tổng có 0 bản ghi",
            zeroRecords: "Không tìm thấy kết quả phù hợp.",
            emptyTable: "Không tìm thấy kết quả phù hợp.",
            processing: '<i class="fas fa-spinner fa-spin mr-2"></i>Đang tải dữ liệu...',
            search: "_INPUT_",
            searchPlaceholder: "Tìm kiếm..."
        },
        pageLength: 10,
        lengthMenu: [10, 20, 50, 100],
        dom: '<"table-controls-figma">rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
        drawCallback: function(settings) {
            console.log("FigmaDataTables: V10.0 - Table Re-drawn (Fixed Dropdown Persistence)", settings.sTableId);

            // Safer way to find the wrapper
            const $wrapper = $(settings.nTable).closest('.dataTables_wrapper');
            if (!$wrapper.length) return;

            // CRITICAL FIX: Use CSS flexbox order instead of DOM manipulation
            // This prevents dropdown from disappearing on page change
            const $paginationRight = $wrapper.find('.pagination-right');
            $paginationRight.css({
                'display': 'flex',
                'align-items': 'center',
                'gap': '8px', // Match CSS gap value
                'justify-content': 'flex-end'
            });

            // Apply Figma classes immediately without DOM manipulation
            const $paginate = $wrapper.find('.dataTables_paginate');
            const $ul = $paginate.find('ul.pagination');
            const $length = $wrapper.find('.dataTables_length');
            const $info = $wrapper.find('.dataTables_info');

            // Add Figma styling classes
            $paginate.addClass('pagination-figma');
            $length.addClass('pagination-length-figma');
            $info.addClass('pagination-info-figma');

            if ($ul.length) {
                $ul.addClass('pagination-figma-list');
                $ul.css({
                    'display': 'flex',
                    'align-items': 'center',
                    'list-style': 'none',
                    'margin': '0',
                    'padding': '0',
                    'gap': '2px' // Reduced gap for tighter spacing
                });

                // Add extra class to children 
                $ul.find('li.page-item').addClass('pagination-figma-li');
                $ul.find('li.page-item a').addClass('pagination-figma-item');
            }

            // Remove the 'paginate_button' class from standard DataTables list items to avoid double borders
            // but keep '.page-item' for Bootstrap compatibility
            $wrapper.find('.paginate_button').removeClass('paginate_button');

            console.log("FigmaDataTables: Dropdown should remain visible at all times");
        }
    },

    /**
     * Render status badge chuẩn Figma
     */
    renderStatusBadge: function(isActive) {
        if (isActive) {
            return '<span class="status-badge-figma status-badge-active">Đang hoạt động</span>';
        }
        return '<span class="status-badge-figma status-badge-inactive">Ngừng hoạt động</span>';
    },

    /**
     * Render status với dấu chấm (dot + text) chuẩn Figma mới
     */
    renderStatusDot: function(isActive, activeText = 'Đang hoạt động', inactiveText = 'Ngừng hoạt động') {
        const statusClass = isActive ? 'status-active' : 'status-inactive';
        const statusText = isActive ? activeText : inactiveText;
        return `<div class="status-dot-text ${statusClass}">
                    <span class="status-dot"></span>
                    <span>${statusText}</span>
                </div>`;
    },

    /**
     * Render các nút thao tác (Edit, Delete, View) chuẩn Figma
     */
    renderActionButtons: function(row) {
        return `
            <div class="table-actions-figma">
                <a href="javascript:void(0)" class="btn-action-figma btn-action-edit btn-edit" data-id="${row.id}" data-name="${row.name}" title="Chỉnh sửa">
                    <i class="fas fa-pen"></i>
                </a>
                <a href="javascript:void(0)" class="btn-action-figma btn-action-delete btn-delete" data-id="${row.id}" data-name="${row.name}" title="Xóa">
                    <i class="fas fa-trash-alt"></i>
                </a>
            </div>
        `;
    }
};

/**
 * jQuery Plugin wrapper for easier usage
 */
(function($) {
    $.fn.dataTableFigma = function(options) {
        const mergedConfig = $.extend(true, {}, FigmaDataTables.defaultConfig, options);
        return this.DataTable(mergedConfig);
    };
})(jQuery);
