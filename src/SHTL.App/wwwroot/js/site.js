// Site-wide JavaScript for AXDD Admin

(function ($) {
    'use strict';

    // Initialize tooltips
    $(function () {
        $('[data-toggle="tooltip"]').tooltip();
    });

    // Initialize popovers
    $(function () {
        $('[data-toggle="popover"]').popover();
    });

    // Auto-hide alerts after 5 seconds
    $(function () {
        setTimeout(function () {
            $('.alert:not(.alert-permanent)').fadeOut('slow');
        }, 5000);
    });

    // Confirm delete action
    window.confirmDelete = function (message) {
        return confirm(message || 'Are you sure you want to delete this item?');
    };

    // Loading overlay
    window.showLoading = function () {
        if ($('.loading-overlay').length === 0) {
            $('body').append(`
                <div class="loading-overlay">
                    <div class="loading-spinner"></div>
                </div>
            `);
        }
    };

    window.hideLoading = function () {
        $('.loading-overlay').remove();
    };

    // Toast notification
    window.showToast = function (message, type = 'success') {
        const iconMap = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const bgMap = {
            success: 'bg-success',
            error: 'bg-danger',
            warning: 'bg-warning',
            info: 'bg-info'
        };

        const toast = $(`
            <div class="toast ${bgMap[type]}" role="alert" aria-live="assertive" aria-atomic="true" data-autohide="true" data-delay="3000">
                <div class="toast-header ${bgMap[type]} text-white">
                    <i class="fas ${iconMap[type]} mr-2"></i>
                    <strong class="mr-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                    <button type="button" class="ml-2 mb-1 close text-white" data-dismiss="toast" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `);

        $('body').append(toast);
        toast.toast('show');

        toast.on('hidden.bs.toast', function () {
            $(this).remove();
        });
    };

    // Format file size
    window.formatFileSize = function (bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    // Format date
    window.formatDate = function (date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Relative time
    window.getRelativeTime = function (date) {
        const now = new Date();
        const diff = now - new Date(date);
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'just now';
        if (minutes < 60) return minutes + ' minute' + (minutes > 1 ? 's' : '') + ' ago';
        if (hours < 24) return hours + ' hour' + (hours > 1 ? 's' : '') + ' ago';
        if (days < 7) return days + ' day' + (days > 1 ? 's' : '') + ' ago';
        return window.formatDate(date);
    };

    // AJAX error handler
    $(document).ajaxError(function (event, jqxhr, settings, thrownError) {
        console.error('AJAX Error:', thrownError);
        if (jqxhr.status === 401) {
            window.location.href = '/Account/Login?returnUrl=' + encodeURIComponent(window.location.pathname + window.location.search);
        } else if (jqxhr.status === 403) {
            window.showToast('Bạn không có quyền thực hiện thao tác này.', 'error');
        }
    });

    // DataTables default configuration
    if ($.fn.DataTable) {
        $.extend(true, $.fn.dataTable.defaults, {
            language: {
                search: '_INPUT_',
                searchPlaceholder: 'Search...',
                lengthMenu: '_MENU_ records per page',
                info: 'Showing _START_ to _END_ of _TOTAL_ entries',
                paginate: {
                    first: '<i class="fas fa-angle-double-left"></i>',
                    previous: '<i class="fas fa-angle-left"></i>',
                    next: '<i class="fas fa-angle-right"></i>',
                    last: '<i class="fas fa-angle-double-right"></i>'
                }
            },
            responsive: true,
            autoWidth: false,
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]]
        });
    }

    // File input preview
    $(document).on('change', 'input[type="file"]', function () {
        const input = this;
        if (input.files && input.files[0]) {
            const fileName = input.files[0].name;
            const fileSize = window.formatFileSize(input.files[0].size);
            $(input).next('.custom-file-label').html(fileName);

            // Show preview if container exists
            const previewContainer = $(input).closest('form').find('.file-preview');
            if (previewContainer.length) {
                previewContainer.html(`
                    <div class="alert alert-info">
                        <i class="fas fa-file mr-2"></i>
                        <strong>${fileName}</strong> (${fileSize})
                    </div>
                `);
            }
        }
    });

    // Character counter for textareas
    $(document).on('input', 'textarea[maxlength]', function () {
        const textarea = $(this);
        const maxLength = textarea.attr('maxlength');
        const currentLength = textarea.val().length;
        const remaining = maxLength - currentLength;

        // lấy isView từ attribute
        const isView = textarea.data('isview');
        if (isView === false) {
            return;
        }

        let counter = textarea.next('.character-counter');
        //css for counter
        if (counter.length === 0) {
            counter = $('<small class="character-counter text-muted"></small>').css({
                'display': 'block',
                'margin-top': '6px',
                'margin-bottom': '4px',
                'line-height': '1.4',
                'text-align': 'left',
                'font-size': '12px'
            });
            textarea.after(counter);
        }

        counter.text(`${currentLength} / ${maxLength} characters`);

        if (remaining < 50) {
            counter.removeClass('text-muted').addClass('text-warning');
        } else {
            counter.removeClass('text-warning').addClass('text-muted');
        }
    });

    // Prevent double submission
    // NOTE: Only applies to forms WITHOUT custom submit handlers
    // Forms with custom handlers should set data-has-custom-submit="true"
    $('form').on('submit', function () {
        const $form = $(this);
        
        // Skip if form has custom submit handler
        // This prevents conflicts with page-specific double-submission prevention
        if ($form.attr('data-has-custom-submit') === 'true') {
            return; // Let custom handler take over
        }
        
        const submitButton = $form.find('button[type="submit"], input[type="submit"]');
        submitButton.prop('disabled', true);
        submitButton.html('<i class="fas fa-spinner fa-spin mr-1"></i> Processing...');

        // Re-enable after 5 seconds (in case of validation errors)
        setTimeout(function () {
            submitButton.prop('disabled', false);
            submitButton.html(submitButton.data('original-text') || 'Submit');
        }, 500);
    });

    // Store original button text
    $('button[type="submit"], input[type="submit"]').each(function () {
        $(this).data('original-text', $(this).html());
    });

    // ============================================
    // Core Modal Enhancements
    // ============================================

    // 1. Draggable Modal by Header
    $(document).on('mousedown', '.modal-header-figma, .modal-header', function (e) {
        if (e.button !== 0) return;
        if ($(e.target).closest('button, .close, a, input').length) return;

        var $dialog = $(this).closest('.modal-dialog');
        var startX = e.clientX;
        var startY = e.clientY;

        var offsetX = 0, offsetY = 0;
        var currentTransform = $dialog.css('transform');
        if (currentTransform && currentTransform !== 'none') {
            var matrix = currentTransform.match(/matrix.*\((.+)\)/);
            if (matrix) {
                var values = matrix[1].split(', ');
                offsetX = parseFloat(values[4]) || 0;
                offsetY = parseFloat(values[5]) || 0;
            }
        }

        $('body').css('user-select', 'none');

        $(document).on('mousemove.modaldrag', function (e2) {
            var dx = e2.clientX - startX;
            var dy = e2.clientY - startY;
            $dialog.css('transform', 'translate(' + (offsetX + dx) + 'px, ' + (offsetY + dy) + 'px)');
        });

        $(document).on('mouseup.modaldrag', function () {
            $(document).off('.modaldrag');
            $('body').css('user-select', '');
        });
    });

    // 2. Nested Modal Stack
    var _modalStack = [];

    $(document).on('show.bs.modal', '.modal', function () {
        var $newModal = $(this);
        var $openModal = $('.modal.show').not($newModal);

        if ($openModal.length > 0) {
            $openModal.data('_stacked', true);
            _modalStack.push($openModal.attr('id'));
            $openModal.modal('hide');
        }
    });

    // Combined handler: reset drag position + restore stacked modal
    $(document).on('hidden.bs.modal', '.modal', function () {
        var $closed = $(this);

        // Always reset drag position
        $closed.find('.modal-dialog').css('transform', '');

        // If this modal was stacked away (hidden to make room for another), do nothing else
        if ($closed.data('_stacked')) {
            $closed.removeData('_stacked');
            return;
        }

        // User closed this modal — restore previous stacked modal if exists
        if (_modalStack.length > 0) {
            var prevId = _modalStack.pop();
            setTimeout(function () {
                $('#' + prevId).modal('show');
            }, 300);
        }
    });

    // Global Bootstrap tooltip for .btn-action-figma (escapes overflow clipping; works with DataTable dynamic content)
    $(document).on('mouseenter', '.btn-action-figma[title]', function () {
        var $el = $(this);
        if (!$el.data('bs.tooltip')) {
            $el.tooltip({ container: 'body', placement: 'bottom' });
        }
    });

    // ============================================
    // Global Helper Functions & UI Fixes
    // ============================================

    /**
     * Escape HTML to prevent XSS
     */
    window.escapeHtml = function (text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    };

    // Modal Focus Fix for Select2 (Bootstrap 4 vs Select2 focus conflict)
    if ($.fn.modal && $.fn.modal.Constructor) {
        var originalEnforceFocus = $.fn.modal.Constructor.prototype._enforceFocus;
        $.fn.modal.Constructor.prototype._enforceFocus = function () {
            var $modalElement = $(this._element);
            $(document).on('focusin.bs.modal', function (e) {
                if ($modalElement[0] !== e.target && !$modalElement.has(e.target).length &&
                    $(e.target).closest('.select2-dropdown, .select2-container').length) {
                    return true;
                }
            });
            originalEnforceFocus.apply(this, arguments);
        };
    }

})(jQuery);
