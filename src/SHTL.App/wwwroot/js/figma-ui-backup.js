/**
 * Tabs Component JavaScript
 * Figma Design System - AXDD.WebApp.Admin
 * 
 * Usage:
 * <div class="tabs-figma" data-tabs>
 *   <div class="tabs-list-figma">
 *     <button class="tab-trigger-figma active" data-tab-trigger="tab1">Tab 1</button>
 *     <button class="tab-trigger-figma" data-tab-trigger="tab2">Tab 2</button>
 *   </div>
 *   <div class="tab-content-figma active" data-tab-content="tab1">Content 1</div>
 *   <div class="tab-content-figma" data-tab-content="tab2">Content 2</div>
 * </div>
 */

(function ($) {
    'use strict';

    /**
     * Initialize all tabs on the page
     */
    function initTabs() {
        $('[data-tabs]').each(function () {
            const $tabsContainer = $(this);
            const $triggers = $tabsContainer.find('[data-tab-trigger]');
            const $contents = $tabsContainer.find('[data-tab-content]');

            $triggers.on('click', function () {
                const tabId = $(this).data('tab-trigger');

                // Update triggers
                $triggers.removeClass('active').attr('aria-selected', 'false');
                $(this).addClass('active').attr('aria-selected', 'true');

                // Update contents
                $contents.removeClass('active').attr('aria-hidden', 'true');
                $tabsContainer.find(`[data-tab-content="${tabId}"]`)
                    .addClass('active')
                    .attr('aria-hidden', 'false');

                // Trigger custom event
                $tabsContainer.trigger('tab:changed', [tabId]);
            });

            // Keyboard navigation
            $triggers.on('keydown', function (e) {
                const $current = $(this);
                let $next;

                switch (e.key) {
                    case 'ArrowLeft':
                        e.preventDefault();
                        $next = $current.prev('[data-tab-trigger]');
                        if ($next.length === 0) {
                            $next = $triggers.last();
                        }
                        $next.click().focus();
                        break;

                    case 'ArrowRight':
                        e.preventDefault();
                        $next = $current.next('[data-tab-trigger]');
                        if ($next.length === 0) {
                            $next = $triggers.first();
                        }
                        $next.click().focus();
                        break;

                    case 'Home':
                        e.preventDefault();
                        $triggers.first().click().focus();
                        break;

                    case 'End':
                        e.preventDefault();
                        $triggers.last().click().focus();
                        break;
                }
            });
        });
    }

    /**
     * Tooltip initialization
     */
    function initTooltips() {
        $('[data-tooltip]').each(function () {
            const $trigger = $(this);
            const text = $trigger.data('tooltip');
            const position = $trigger.data('tooltip-position') || 'top';

            if (!$trigger.find('.tooltip-content-figma').length) {
                $trigger.addClass('tooltip-figma');
                $trigger.append(`<span class="tooltip-content-figma ${position}">${text}</span>`);
            }
        });
    }

    /**
     * Progress bar animation
     */
    function animateProgress($progressBar, targetValue, duration = 1000) {
        const currentValue = parseFloat($progressBar.css('width')) / $progressBar.parent().width() * 100;
        
        $({ value: currentValue }).animate({ value: targetValue }, {
            duration: duration,
            easing: 'swing',
            step: function () {
                $progressBar.css('width', this.value + '%');
                $progressBar.attr('aria-valuenow', Math.round(this.value));
                
                // Update text if exists
                const $text = $progressBar.find('.progress-text');
                if ($text.length) {
                    $text.text(Math.round(this.value) + '%');
                }
            }
        });
    }

    /**
     * Loading spinner helper
     */
    function showSpinner($element, size = 'default') {
        const spinnerClass = size === 'large' ? 'spinner-figma large' : 'spinner-figma';
        const $spinner = $(`<span class="${spinnerClass}" role="status" aria-label="Loading"></span>`);
        
        $element.data('original-content', $element.html());
        $element.prop('disabled', true).html('').append($spinner);
        
        return $spinner;
    }

    function hideSpinner($element) {
        const originalContent = $element.data('original-content');
        if (originalContent) {
            $element.html(originalContent).prop('disabled', false);
            $element.removeData('original-content');
        }
    }

    /**
     * Empty state helper
     */
    function showEmptyState($container, options = {}) {
        const defaults = {
            icon: 'fa-inbox',
            title: 'Không có dữ liệu',
            description: 'Chưa có dữ liệu để hiển thị',
            actionText: null,
            actionCallback: null
        };

        const settings = $.extend({}, defaults, options);

        let actionHtml = '';
        if (settings.actionText && settings.actionCallback) {
            actionHtml = `<button class="btn-figma btn-figma-primary" data-empty-action>${settings.actionText}</button>`;
        }

        const $emptyState = $(`
            <div class="empty-state-figma">
                <div class="icon">
                    <i class="fas ${settings.icon}"></i>
                </div>
                <div class="title">${settings.title}</div>
                <div class="description">${settings.description}</div>
                ${actionHtml}
            </div>
        `);

        if (settings.actionCallback) {
            $emptyState.find('[data-empty-action]').on('click', settings.actionCallback);
        }

        $container.html($emptyState);
        return $emptyState;
    }

    /**
     * Confirm dialog helper
     */
    function confirmDialog(options = {}) {
        const defaults = {
            title: 'Xác nhận',
            message: 'Bạn có chắc chắn muốn thực hiện hành động này?',
            confirmText: 'Xác nhận',
            cancelText: 'Hủy',
            confirmClass: 'btn-figma-primary',
            onConfirm: function () { },
            onCancel: function () { }
        };

        const settings = $.extend({}, defaults, options);

        // Use existing modal or create new one
        let $modal = $('#confirmDialogFigma');
        if ($modal.length === 0) {
            $modal = $(`
                <div class="modal fade" id="confirmDialogFigma" tabindex="-1" role="dialog">
                    <div class="modal-dialog modal-dialog-centered" role="document">
                        <div class="modal-content" style="border-radius: var(--radius-lg); border: none;">
                            <div class="modal-header" style="border-bottom: 1px solid var(--border-color);">
                                <h5 class="modal-title font-weight-bold"></h5>
                                <button type="button" class="close" data-dismiss="modal">
                                    <span>&times;</span>
                                </button>
                            </div>
                            <div class="modal-body" style="padding: 1.5rem;"></div>
                            <div class="modal-footer" style="border-top: 1px solid var(--border-color);">
                                <button type="button" class="btn-figma btn-figma-outline" data-dismiss="modal"></button>
                                <button type="button" class="btn-figma" data-confirm></button>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            $('body').append($modal);
        }

        $modal.find('.modal-title').text(settings.title);
        $modal.find('.modal-body').html(settings.message);
        $modal.find('[data-dismiss="modal"]').text(settings.cancelText);
        $modal.find('[data-confirm]')
            .text(settings.confirmText)
            .removeClass()
            .addClass('btn-figma ' + settings.confirmClass);

        // Remove old handlers
        $modal.off('click', '[data-confirm]');

        // Add new handlers
        $modal.on('click', '[data-confirm]', function () {
            settings.onConfirm();
            $modal.modal('hide');
        });

        $modal.on('hidden.bs.modal', function () {
            settings.onCancel();
        });

        $modal.modal('show');
        return $modal;
    }

    /**
     * Initialize on document ready
     */
    $(document).ready(function () {
        initTabs();
        initTooltips();

        // Re-initialize when new content is added dynamically
        $(document).on('content:loaded', function () {
            initTabs();
            initTooltips();
        });
    });

    /**
     * Expose helpers to global scope
     */
    window.FigmaUI = {
        initTabs: initTabs,
        initTooltips: initTooltips,
        animateProgress: animateProgress,
        showSpinner: showSpinner,
        hideSpinner: hideSpinner,
        showEmptyState: showEmptyState,
        confirmDialog: confirmDialog
    };

})(jQuery);
