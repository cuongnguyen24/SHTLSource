/**
 * Module Form JavaScript - OPTIMIZED VERSION
 * Icon picker and category auto-fill with performance improvements
 */
(function () {
    'use strict';

    // Cache DOM elements
    const $categoryInput = $('#categoryInput');
    const $categoryDisplayOrderInput = $('#categoryDisplayOrderInput');
    const $moduleIconInput = $('#moduleIconInput');
    const $categoryIconInput = $('#categoryIconInput');
    const $moduleIconPreview = $('#moduleIconPreview');
    const $categoryIconPreview = $('#categoryIconPreview');
    const $moduleIconPreviewIcon = $('#moduleIconPreviewIcon');
    const $categoryIconPreviewIcon = $('#categoryIconPreviewIcon');
    const $moduleIconPreviewText = $('#moduleIconPreviewText');
    const $categoryIconPreviewText = $('#categoryIconPreviewText');
    const $moduleIconSearch = $('#moduleIconSearch');
    const $categoryIconSearch = $('#categoryIconSearch');
    const $moduleIconPickerModal = $('#moduleIconPickerModal');
    const $categoryIconPickerModal = $('#categoryIconPickerModal');

    // Global variables
    let categoriesData = [];
    let isCreate = false;

    /**
     * Initialize module form - PUBLIC API
     */
    window.initializeModuleForm = function (options) {
        categoriesData = options.categoriesData || [];
        isCreate = options.isCreate || false;

        console.log('Module form initialized. IsCreate:', isCreate, 'Categories:', categoriesData.length);

        // Initialize all features
        initializeCategoryAutoFill();
        initializeIconPickers();
        initializeIconSearch();
        showExistingIconPreviews();
    };

    /**
     * Initialize category input auto-fill - OPTIMIZED: debounced
     */
    function initializeCategoryAutoFill() {
        let timeout;

        $categoryInput.on('input blur change', function () {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                const categoryName = $(this).val().trim();

                if (categoryName) {
                    // Use find instead of filter for better performance
                    const matchingCategory = categoriesData.find(cat => cat.name === categoryName);

                    if (matchingCategory) {
                        console.log('Found matching category:', matchingCategory.name);
                        $categoryDisplayOrderInput.val(matchingCategory.displayOrder);

                        if (matchingCategory.icon) {
                            updateCategoryIconPreview(matchingCategory.icon);
                        }
                    } else {
                        console.log('New category, calculating next DisplayOrder');
                        // OPTIMIZED: use Math.max with spread operator
                        const maxDisplayOrder = Math.max(0, ...categoriesData.map(cat => cat.displayOrder));
                        $categoryDisplayOrderInput.val(maxDisplayOrder + 1);
                    }
                } else {
                    $categoryDisplayOrderInput.val(1);
                }
            }, 150); // Debounce 150ms
        });
    }

    /**
     * Initialize icon pickers - OPTIMIZED: use event delegation on modal body
     */
    function initializeIconPickers() {
        // Module icon picker - delegate to modal body
        $moduleIconPickerModal.on('click', '.module-icon-btn', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const icon = $(this).data('icon');
            console.log('Module icon selected:', icon);
            updateModuleIconPreview(icon);
            $moduleIconPickerModal.modal('hide');
        });

        // Category icon picker - delegate to modal body
        $categoryIconPickerModal.on('click', '.category-icon-btn', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const icon = $(this).data('icon');
            console.log('Category icon selected:', icon);
            updateCategoryIconPreview(icon);
            $categoryIconPickerModal.modal('hide');
        });
    }

    /**
     * Initialize icon search filters - OPTIMIZED: debounced
     */
    function initializeIconSearch() {
        let moduleSearchTimeout, categorySearchTimeout;

        // Module icon search - debounced
        $moduleIconSearch.on('keyup', function () {
            clearTimeout(moduleSearchTimeout);
            moduleSearchTimeout = setTimeout(() => {
                const searchTerm = $(this).val().toLowerCase();

                // OPTIMIZED: batch DOM updates
                if (searchTerm) {
                    $('.module-icon-item').each(function () {
                        const iconName = $(this).find('.icon-name').text().toLowerCase();
                        $(this).toggle(iconName.includes(searchTerm));
                    });
                } else {
                    $('.module-icon-item').show();
                }
            }, 200);
        });

        // Category icon search - debounced
        $categoryIconSearch.on('keyup', function () {
            clearTimeout(categorySearchTimeout);
            categorySearchTimeout = setTimeout(() => {
                const searchTerm = $(this).val().toLowerCase();

                // OPTIMIZED: batch DOM updates
                if (searchTerm) {
                    $('.category-icon-item').each(function () {
                        const iconName = $(this).find('.icon-name').text().toLowerCase();
                        $(this).toggle(iconName.includes(searchTerm));
                    });
                } else {
                    $('.category-icon-item').show();
                }
            }, 200);
        });

        // OPTIMIZED: Clear search and reset view when modal closes
        $moduleIconPickerModal.on('hidden.bs.modal', function () {
            $moduleIconSearch.val('');
            $('.module-icon-item').show();
        });

        $categoryIconPickerModal.on('hidden.bs.modal', function () {
            $categoryIconSearch.val('');
            $('.category-icon-item').show();
        });
    }

    /**
     * Update module icon preview - OPTIMIZED: batch DOM updates
     */
    function updateModuleIconPreview(icon) {
        // Batch DOM updates
        $moduleIconInput.val(icon);
        $moduleIconPreviewIcon.attr('class', icon);
        $moduleIconPreviewText.text(icon);
        $moduleIconPreview.show();
    }

    /**
     * Update category icon preview - OPTIMIZED: batch DOM updates
     */
    function updateCategoryIconPreview(icon) {
        // Batch DOM updates
        $categoryIconInput.val(icon);
        $categoryIconPreviewIcon.attr('class', icon);
        $categoryIconPreviewText.text(icon);
        $categoryIconPreview.show();
    }

    /**
     * Show existing icon previews on page load
     */
    function showExistingIconPreviews() {
        const moduleIcon = $moduleIconInput.val();
        if (moduleIcon) {
            updateModuleIconPreview(moduleIcon);
        }

        const categoryIcon = $categoryIconInput.val();
        if (categoryIcon) {
            updateCategoryIconPreview(categoryIcon);
        }
    }

})();
