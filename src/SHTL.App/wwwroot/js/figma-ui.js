/**
 * ============================================================================
 * COMPREHENSIVE FIGMA UI LIBRARY - Enhanced JavaScript Utilities
 * ============================================================================
 * Bao gồm: Tabs, Tooltips, Modals, Dropdowns, Form Validation, Animations,
 * Table Sorting, Pagination, Infinite Scroll, Toast Notifications, etc.
 * ============================================================================
 */

(function (window, $) {
    'use strict';

    // ========== 1. NAMESPACE ==========
    window.FigmaUI = window.FigmaUI || {};

    // ========== 2. TABS COMPONENT ==========
    FigmaUI.initTabs = function () {
        $('[data-tabs]').each(function () {
            const $container = $(this);
            const $triggers = $container.find('[data-tab-trigger]');
            const $contents = $container.find('[data-tab-content]');

            $triggers.on('click', function (e) {
                e.preventDefault();
                const tabId = $(this).data('tab-trigger');

                $triggers.removeClass('active').attr('aria-selected', 'false');
                $(this).addClass('active').attr('aria-selected', 'true');

                $contents.removeClass('active').attr('aria-hidden', 'true');
                $container.find(`[data-tab-content="${tabId}"]`)
                    .addClass('active')
                    .attr('aria-hidden', 'false');

                $container.trigger('figma:tab-changed', [tabId]);
            });

            // Keyboard navigation (Arrow keys)
            $triggers.on('keydown', function (e) {
                const $current = $(this);
                let $next;

                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    const direction = e.key === 'ArrowLeft' ? 'prev' : 'next';
                    $next = $current[direction]('[data-tab-trigger]');
                    if ($next.length === 0) {
                        $next = $triggers[direction === 'prev' ? 'last' : 'first']();
                    }
                    $next.trigger('click').focus();
                }
            });
        });
    };

    // ========== 3. TOOLTIPS ==========
    FigmaUI.initTooltips = function () {
        $('[data-tooltip]').each(function () {
            const $el = $(this);
            const text = $el.attr('data-tooltip') || $el.attr('title');
            const position = $el.data('tooltip-position') || 'top';

            if (!text) return;

            const $tooltip = $('<div class="tooltip-figma"></div>').text(text);
            $('body').append($tooltip);

            $el.on('mouseenter focus', function () {
                const offset = $el.offset();
                const elWidth = $el.outerWidth();
                const elHeight = $el.outerHeight();
                const ttWidth = $tooltip.outerWidth();
                const ttHeight = $tooltip.outerHeight();

                let top, left;

                switch (position) {
                    case 'top':
                        top = offset.top - ttHeight - 8;
                        left = offset.left + (elWidth / 2) - (ttWidth / 2);
                        break;
                    case 'bottom':
                        top = offset.top + elHeight + 8;
                        left = offset.left + (elWidth / 2) - (ttWidth / 2);
                        break;
                    case 'left':
                        top = offset.top + (elHeight / 2) - (ttHeight / 2);
                        left = offset.left - ttWidth - 8;
                        break;
                    case 'right':
                        top = offset.top + (elHeight / 2) - (ttHeight / 2);
                        left = offset.left + elWidth + 8;
                        break;
                }

                $tooltip.css({ top, left }).addClass('show');
            });

            $el.on('mouseleave blur', function () {
                $tooltip.removeClass('show');
            });

            // Remove title to prevent browser tooltip
            $el.removeAttr('title');
        });
    };

    // ========== 4. PROGRESS BAR ANIMATION ==========
    FigmaUI.animateProgress = function (selector, targetValue, duration = 1000) {
        const $bar = $(selector);
        const startValue = parseInt($bar.css('width')) || 0;
        const startTime = Date.now();

        function update() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = startValue + (targetValue - startValue) * progress;

            $bar.css('width', current + '%');
            $bar.attr('aria-valuenow', Math.round(current));

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    };

    // ========== 5. SPINNER / LOADING ==========
    FigmaUI.showSpinner = function (target = 'body', message = '') {
        const html = `
            <div class="spinner-overlay" style="
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.5); z-index: 9999;
                display: flex; align-items: center; justify-content: center;
                flex-direction: column; gap: 1rem;">
                <div class="spinner-figma" style="
                    width: 40px; height: 40px; border-width: 4px;"></div>
                ${message ? `<p style="color: white; font-weight: 500;">${message}</p>` : ''}
            </div>
        `;
        $(target).append(html);
    };

    FigmaUI.hideSpinner = function (target = 'body') {
        $(target).find('.spinner-overlay').remove();
    };

    // ========== 6. EMPTY STATE ==========
    FigmaUI.showEmptyState = function (container, options = {}) {
        const defaults = {
            icon: 'fas fa-inbox',
            title: 'Không có dữ liệu',
            message: 'Chưa có dữ liệu để hiển thị',
            actionText: null,
            actionCallback: null
        };
        const opts = { ...defaults, ...options };

        const html = `
            <div class="empty-state-figma" style="
                text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
                <i class="${opts.icon}" style="
                    font-size: 4rem; color: var(--border-color); margin-bottom: 1.5rem;"></i>
                <h3 style="
                    font-size: 1.25rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem;">
                    ${opts.title}
                </h3>
                <p style="font-size: 0.875rem; margin-bottom: 1.5rem;">${opts.message}</p>
                ${opts.actionText ? `
                    <button class="btn-figma btn-figma-primary" data-empty-action>
                        ${opts.actionText}
                    </button>
                ` : ''}
            </div>
        `;

        $(container).html(html);

        if (opts.actionCallback) {
            $(container).find('[data-empty-action]').on('click', opts.actionCallback);
        }
    };

    // ========== 7. CONFIRM DIALOG ==========
    FigmaUI.confirm = function (options = {}) {
        const defaults = {
            title: 'Xác nhận',
            message: 'Bạn có chắc chắn?',
            confirmText: 'Đồng ý',
            cancelText: 'Hủy',
            type: 'danger', // primary, danger, warning
            onConfirm: () => { },
            onCancel: () => { }
        };
        const opts = { ...defaults, ...options };

        const modalId = 'figmaConfirmModal_' + Date.now();
        const colorClass = opts.type === 'danger' ? 'var(--destructive)' : 'var(--primary)';

        const html = `
            <div class="modal fade" id="${modalId}" tabindex="-1" data-backdrop="static">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content" style="border-radius: var(--radius-lg); border: none; overflow: hidden;">
                        <div class="modal-header" style="background-color: ${colorClass}; color: white; border: none;">
                            <h5 class="modal-title">
                                <i class="fas fa-${opts.type === 'danger' ? 'exclamation-triangle' : 'question-circle'} mr-2"></i>
                                ${opts.title}
                            </h5>
                            <button type="button" class="close text-white" data-dismiss="modal">
                                <span>&times;</span>
                            </button>
                        </div>
                        <div class="modal-body" style="padding: 1.5rem;">
                            <p style="font-size: 0.875rem; color: var(--text-main); margin: 0;">
                                ${opts.message}
                            </p>
                        </div>
                        <div class="modal-footer" style="border-top: 1px solid var(--border-color);">
                            <button type="button" class="btn-figma btn-figma-outline" data-dismiss="modal">
                                ${opts.cancelText}
                            </button>
                            <button type="button" class="btn-figma" data-confirm 
                                    style="background-color: ${colorClass}; color: white;">
                                ${opts.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('body').append(html);
        const $modal = $('#' + modalId);

        $modal.find('[data-confirm]').on('click', function () {
            opts.onConfirm();
            $modal.modal('hide');
        });

        $modal.on('hidden.bs.modal', function () {
            $modal.remove();
        });

        $modal.on('hide.bs.modal', function (e) {
            if (!$(e.target).find('[data-confirm]').is(':focus')) {
                opts.onCancel();
            }
        });

        $modal.modal('show');
    };

    // ========== 8. TOAST NOTIFICATION ==========
    FigmaUI.toast = function (message, type = 'info', duration = 3000) {
        // Sử dụng toastr nếu có, nếu không tạo custom
        if (window.toastr) {
            toastr[type](message);
            return;
        }

        const colors = {
            success: '#38A169',
            error: '#E53E3E',
            warning: '#D69E2E',
            info: '#3182CE'
        };

        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };

        const toastId = 'toast_' + Date.now();
        const html = `
            <div id="${toastId}" class="toast-figma" style="
                position: fixed; top: 20px; right: 20px; z-index: 9999;
                min-width: 300px; background: white; border-left: 4px solid ${colors[type]};
                box-shadow: var(--shadow-lg); border-radius: var(--radius-md);
                padding: 1rem; display: flex; align-items: center; gap: 0.75rem;
                animation: slideInRight 0.3s ease;">
                <i class="fas fa-${icons[type]}" style="
                    font-size: 1.25rem; color: ${colors[type]};"></i>
                <span style="flex: 1; font-size: 0.875rem; color: var(--text-main);">
                    ${message}
                </span>
                <button onclick="document.getElementById('${toastId}').remove()" style="
                    background: none; border: none; cursor: pointer; color: var(--text-muted);">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        $('body').append(html);

        setTimeout(() => {
            $('#' + toastId).fadeOut(300, function () {
                $(this).remove();
            });
        }, duration);
    };

    // ========== 9. TABLE SORTING ==========
    FigmaUI.initTableSort = function (tableSelector) {
        const $table = $(tableSelector);
        const $headers = $table.find('thead th[data-sortable]');

        $headers.each(function () {
            const $th = $(this);
            $th.addClass('sortable').css('cursor', 'pointer');

            $th.on('click', function () {
                const columnIndex = $th.index();
                const currentOrder = $th.data('sort-order') || 'asc';
                const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';

                // Reset other headers
                $headers.not($th).removeData('sort-order').find('.sort-icon').remove();

                // Update current header
                $th.data('sort-order', newOrder);
                $th.find('.sort-icon').remove();
                $th.append(`<i class="fas fa-sort-${newOrder === 'asc' ? 'up' : 'down'} sort-icon ml-2"></i>`);

                // Sort rows
                const rows = $table.find('tbody tr').get();
                rows.sort(function (a, b) {
                    const A = $(a).find('td').eq(columnIndex).text().toUpperCase();
                    const B = $(b).find('td').eq(columnIndex).text().toUpperCase();

                    if (newOrder === 'asc') {
                        return A < B ? -1 : (A > B ? 1 : 0);
                    } else {
                        return A > B ? -1 : (A < B ? 1 : 0);
                    }
                });

                $.each(rows, function (index, row) {
                    $table.find('tbody').append(row);
                });

                $table.trigger('figma:table-sorted', [columnIndex, newOrder]);
            });
        });
    };

    // ========== 10. FORM VALIDATION ==========
    FigmaUI.validateForm = function (formSelector) {
        const $form = $(formSelector);
        let isValid = true;

        $form.find('[required]').each(function () {
            const $input = $(this);
            const value = $input.val().trim();

            if (!value) {
                $input.attr('aria-invalid', 'true');
                $input.addClass('is-invalid');
                isValid = false;
            } else {
                $input.attr('aria-invalid', 'false');
                $input.removeClass('is-invalid');
                $input.addClass('is-valid');
            }
        });

        // Email validation
        $form.find('[type="email"]').each(function () {
            const $input = $(this);
            const email = $input.val().trim();
            const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (email && !regex.test(email)) {
                $input.attr('aria-invalid', 'true');
                $input.addClass('is-invalid');
                isValid = false;
            }
        });

        return isValid;
    };

    // ========== 11. DEBOUNCE UTILITY ==========
    FigmaUI.debounce = function (func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    // ========== 12. SMOOTH SCROLL ==========
    FigmaUI.scrollTo = function (target, duration = 500) {
        const $target = $(target);
        if ($target.length === 0) return;

        $('html, body').animate({
            scrollTop: $target.offset().top - 100
        }, duration);
    };

    // ========== 13. COPY TO CLIPBOARD ==========
    FigmaUI.copyToClipboard = function (text, successMessage = 'Đã sao chép!') {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                FigmaUI.toast(successMessage, 'success', 2000);
            });
        } else {
            // Fallback for older browsers
            const $temp = $('<textarea>');
            $('body').append($temp);
            $temp.val(text).select();
            document.execCommand('copy');
            $temp.remove();
            FigmaUI.toast(successMessage, 'success', 2000);
        }
    };

    // ========== 14. DROPDOWN ENHANCEMENT ==========
    FigmaUI.initDropdowns = function () {
        // Sử dụng một sự kiện duy nhất cho việc đóng dropdown khi click ra ngoài
        if (!FigmaUI._dropdownHandlerInitialized) {
            $(document).on('click', function (e) {
                const $target = $(e.target);
                
                // Nếu click vào một toggle, nó sẽ được xử lý bởi handler bên dưới (stopPropagation)
                // Nếu click ra ngoài, đóng tất cả dropdown
                if (!$target.closest('[data-dropdown-toggle]').length && !$target.closest('[data-dropdown]').length) {
                    $('[data-dropdown]').removeClass('show');
                }
            });
            FigmaUI._dropdownHandlerInitialized = true;
        }

        $('[data-dropdown-toggle]').off('click').on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const targetId = $(this).data('dropdown-toggle');
            const $menu = $(`[data-dropdown="${targetId}"]`);

            // Đóng các dropdown khác
            $('[data-dropdown]').not($menu).removeClass('show');

            // Toggle dropdown hiện tại
            $menu.toggleClass('show');

            // Định vị menu nếu cần (chỉ khi chưa có class CSS định vị cố định)
            if (!$menu.hasClass('dropdown-menu-right') && !$menu.hasClass('dropdown-menu-left')) {
                const offset = $(this).offset();
                $menu.css({
                    top: offset.top + $(this).outerHeight() + 5,
                    left: offset.left
                });
            }
        });
    };

    // ========== 15. LAZY LOAD IMAGES ==========
    FigmaUI.lazyLoadImages = function () {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    };

    // ========== 16. SELECT2 DYNAMIC LOADER & INITIALIZER ==========
    /**
     * Khởi tạo Select2 với chuẩn Figma
     * @param {string} selector - Selector cần khởi tạo (mặc định .select2, .select2-modern)
     */
    FigmaUI.initSelect2 = function(selector = '.select2, .select2-modern') {
        const $elements = $(selector);
        if ($elements.length === 0) return;
        
        if (!$.fn.select2) {
            console.warn('Select2 library not found. Ensure it is loaded in _Layout.cshtml');
            return;
        }
        
        $elements.each(function() {
            const $el = $(this);
            if ($el.hasClass('select2-hidden-accessible')) return; // Already initialized
            
            $el.select2({
                theme: 'bootstrap4',
                width: '100%',
                dropdownParent: $el.closest('.modal').length > 0 ? $el.closest('.modal') : $(document.body),
                placeholder: $el.data('placeholder') || '-- Chọn giá trị --',
                allowClear: true,
                language: {
                    noResults: function() { return "Không tìm thấy kết quả"; },
                    searching: function() { return "Đang tìm kiếm..."; }
                }
            });
        });
        
    };

    // Alias for global access if needed
    window.initSelect2 = FigmaUI.initSelect2;

    // ========== 17. AUTO-INITIALIZE ==========
    FigmaUI.init = function () {
        FigmaUI.initTabs();
        FigmaUI.initTooltips();
        FigmaUI.initDropdowns();
        FigmaUI.lazyLoadImages();
        FigmaUI.initSelect2(); // New: Dynamic Select2 Initialization

        // Form validation on submit
        $('form[data-validate]').on('submit', function (e) {
            if (!FigmaUI.validateForm(this)) {
                e.preventDefault();
                FigmaUI.toast('Vui lòng kiểm tra lại thông tin!', 'error');
            }
        });

        // Real-time validation
        $('input, select, textarea').on('blur', function () {
            const $input = $(this);
            if ($input.attr('required')) {
                if ($input.val().trim()) {
                    $input.removeClass('is-invalid').addClass('is-valid');
                } else {
                    $input.removeClass('is-valid').addClass('is-invalid');
                }
            }
        });

    };

    // ========== 18. AUTO-RUN ON DOM READY ==========
    $(document).ready(function () {
        FigmaUI.init();
    });

})(window, jQuery);
