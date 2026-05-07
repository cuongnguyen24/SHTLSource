/**
 * TNLD Shared Utilities (v2.1 Figma)
 * Common helpers, renderers, formatters for TaiNanLaoDong module
 * Dependencies: jQuery, Select2, toastr
 */
(function (window, $) {
    'use strict';

    // ==========================================
    // NAMESPACE: TNLDShared
    // ==========================================
    window.TNLDShared = {
        
        // ========== BADGE RENDERERS ==========
        
        /**
         * Render status badge with Figma design
         * @param {string} status - Enum value (DaCBNhanXacNhan, DaXacNhan, ChoBoSung, etc.)
         * @param {string} displayText - Human-readable text
         * @returns {string} HTML badge
         */
        renderStatusBadge: function (status, displayText) {
            const colorMap = {
                'Nhap': 'badge-figma-secondary',
                'ChoXacNhan': 'badge-figma-info',
                'DaXacNhan': 'badge-figma-success',
                'YeuCauBoSung': 'badge-figma-warning',
                'TuChoi': 'badge-figma-danger',
                'DangDieuTra': 'badge-figma-primary',
                'DaKetThuc': 'badge-figma-success',
                'TamDung': 'badge-figma-secondary',
                'DaHuy': 'badge-figma-secondary'
            };
            const cls = colorMap[status] || 'badge-figma-secondary';
            return `<span class="badge-figma ${cls}">${displayText || status}</span>`;
        },

        /**
         * Render LoaiTNLD badge — hiển thị tên loại TNLĐ từ danh mục TNLD_LOAI
         * (Nhẹ / Nặng / Chết người ...). Màu badge dựa trên mức độ nghiêm trọng,
         * fallback về secondary cho các giá trị khác (mở rộng từ catalog).
         * @param {string} loaiDisplay - Tên loại TNLĐ trả từ server (LoaiTNLDDisplay)
         * @returns {string} HTML badge
         */
        renderLoaiTNLDBadge: function (loaiDisplay) {
            if (!loaiDisplay) {
                return '<span class="badge-figma badge-figma-secondary">—</span>';
            }
            const text = String(loaiDisplay);
            const lower = text.toLowerCase();
            let cls = 'badge-figma-secondary';
            if (lower.includes('chết')) {
                cls = 'badge-figma-danger';
            } else if (lower.includes('nặng')) {
                cls = 'badge-figma-warning';
            } else if (lower.includes('nhẹ')) {
                cls = 'badge-figma-info';
            }
            // HTML-escape để tránh XSS từ dữ liệu danh mục
            const escaped = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            return `<span class="badge-figma ${cls}">${escaped}</span>`;
        },

        /**
         * Render NopDungHan badge
         * @param {boolean} dungHan - True if on-time
         * @param {number} soGioTre - Hours late (if applicable)
         * @returns {string} HTML badge
         */
        renderNopDungHanBadge: function (dungHan, soGioTre) {
            if (dungHan) {
                return '<span class="badge-figma badge-figma-success">Đúng hạn</span>';
            }
            return `<span class="badge-figma badge-figma-danger">Trễ ${soGioTre || 0}h</span>`;
        },

        /**
         * Render priority/severity badge
         * @param {string} level - 'High', 'Medium', 'Low', 'Critical'
         * @returns {string} HTML badge
         */
        renderPriorityBadge: function (level) {
            const colorMap = {
                'Critical': 'badge-figma-danger',
                'High': 'badge-figma-warning',
                'Medium': 'badge-figma-info',
                'Low': 'badge-figma-secondary'
            };
            const cls = colorMap[level] || 'badge-figma-secondary';
            return `<span class="badge-figma ${cls}">${level}</span>`;
        },

        // ========== DATE/TIME FORMATTERS ==========

        /**
         * Format datetime to Vietnamese locale
         * @param {string|Date} dateValue - Date value
         * @param {boolean} dateOnly - Return date only (no time)
         * @returns {string} Formatted date string
         */
        formatDateTime: function (dateValue, dateOnly = false) {
            if (!dateValue) return '—';
            
            try {
                const date = new Date(dateValue);
                if (isNaN(date.getTime())) return '—';

                const pad = (n) => String(n).padStart(2, '0');
                const dd = pad(date.getDate());
                const MM = pad(date.getMonth() + 1);
                const yyyy = date.getFullYear();
                if (dateOnly) {
                    return `${dd}/${MM}/${yyyy}`;
                }
                const HH = pad(date.getHours());
                const mm = pad(date.getMinutes());
                // Format dd/MM/yyyy HH:mm — date first, then time
                return `${dd}/${MM}/${yyyy} ${HH}:${mm}`;
            } catch (e) {
                console.error('Date format error:', e);
                return '—';
            }
        },

        /**
         * Calculate relative time (e.g., "2 ngày trước")
         * @param {string|Date} dateValue - Date value
         * @returns {string} Relative time string
         */
        formatRelativeTime: function (dateValue) {
            if (!dateValue) return '—';
            
            try {
                const date = new Date(dateValue);
                const now = new Date();
                const diffMs = now - date;
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);

                if (diffMins < 60) return `${diffMins} phút trước`;
                if (diffHours < 24) return `${diffHours} giờ trước`;
                if (diffDays < 7) return `${diffDays} ngày trước`;
                
                return this.formatDateTime(dateValue, true);
            } catch (e) {
                return this.formatDateTime(dateValue, true);
            }
        },

        // ========== NUMBER FORMATTERS ==========

        /**
         * Format number with thousand separators
         * @param {number} value - Number value
         * @param {number} decimals - Decimal places (default: 0)
         * @returns {string} Formatted number string
         */
        formatNumber: function (value, decimals = 0) {
            if (value === null || value === undefined) return '0';
            
            const num = parseFloat(value);
            if (isNaN(num)) return '0';
            
            return num.toLocaleString('vi-VN', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        },

        /**
         * Format file size (bytes to human-readable)
         * @param {number} bytes - File size in bytes
         * @returns {string} Formatted size (e.g., "2.5 MB")
         */
        formatFileSize: function (bytes) {
            if (!bytes || bytes === 0) return '0 KB';
            
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        // ========== EMPTY STATE RENDERERS ==========

        /**
         * Render empty state with icon and message
         * @param {string} message - Message to display
         * @param {string} icon - FontAwesome icon class (default: 'fa-inbox')
         * @returns {string} HTML empty state
         */
        renderEmptyState: function (message, icon = 'fa-inbox') {
            return `
                <div class="text-center py-4" style="color:#94a3b8; font-size:13px;">
                    <i class="fas ${icon} fa-2x mb-2 d-block" style="color:#cbd5e1;"></i>
                    ${message || 'Chưa có dữ liệu'}
                </div>
            `;
        },

        /**
         * Render loading state
         * @param {string} message - Loading message
         * @returns {string} HTML loading state
         */
        renderLoadingState: function (message = 'Đang tải...') {
            return `
                <div class="text-center py-4" style="color:#64748b; font-size:13px;">
                    <i class="fas fa-spinner fa-spin fa-2x mb-2 d-block" style="color:#94a3b8;"></i>
                    ${message}
                </div>
            `;
        },

        /**
         * Render error state
         * @param {string} message - Error message
         * @returns {string} HTML error state
         */
        renderErrorState: function (message = 'Lỗi khi tải dữ liệu') {
            return `
                <div class="text-center py-4" style="color:#ef4444; font-size:13px;">
                    <i class="fas fa-exclamation-circle fa-2x mb-2 d-block" style="color:#fca5a5;"></i>
                    ${message}
                </div>
            `;
        },

        // ========== AJAX HELPERS ==========

        /**
         * Standardized AJAX error handler
         * @param {XMLHttpRequest} xhr - jQuery XHR object
         * @param {string} defaultMessage - Default error message
         */
        handleAjaxError: function (xhr, defaultMessage = 'Đã xảy ra lỗi') {
            let message = defaultMessage;
            
            try {
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    message = xhr.responseJSON.message;
                } else if (xhr.status === 401) {
                    message = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
                } else if (xhr.status === 403) {
                    message = 'Bạn không có quyền thực hiện thao tác này.';
                } else if (xhr.status === 404) {
                    message = 'Không tìm thấy dữ liệu.';
                } else if (xhr.status === 500) {
                    message = 'Lỗi hệ thống. Vui lòng thử lại sau.';
                }
            } catch (e) {
                console.error('Error parsing AJAX error:', e);
            }

            toastr.error(message);
        },

        /**
         * GET request with standardized error handling
         * @param {string} url - API endpoint
         * @param {object} data - Query params
         * @param {function} successCallback - Success handler
         * @param {function} errorCallback - Optional custom error handler
         */
        ajaxGet: function (url, data, successCallback, errorCallback) {
            $.ajax({
                url: url,
                type: 'GET',
                data: data,
                success: successCallback,
                error: errorCallback || function (xhr) {
                    TNLDShared.handleAjaxError(xhr);
                }
            });
        },

        /**
         * POST request with anti-forgery token
         * @param {string} url - API endpoint
         * @param {object} data - POST data
         * @param {function} successCallback - Success handler
         * @param {function} errorCallback - Optional custom error handler
         */
        ajaxPost: function (url, data, successCallback, errorCallback) {
            const token = $('input[name="__RequestVerificationToken"]').val();
            
            $.ajax({
                url: url,
                type: 'POST',
                data: data,
                headers: token ? { 'RequestVerificationToken': token } : {},
                success: successCallback,
                error: errorCallback || function (xhr) {
                    TNLDShared.handleAjaxError(xhr);
                }
            });
        },

        // ========== SELECT2 HELPERS ==========

        /**
         * Initialize Select2 with AJAX for enterprise dropdown
         * @param {string} selector - jQuery selector
         * @param {string} placeholder - Placeholder text
         */
        initEnterpriseSelect2: function (selector, placeholder = 'Chọn doanh nghiệp') {
            $(selector).select2({
                placeholder: placeholder,
                allowClear: true,
                width: '100%',
                ajax: {
                    url: '/Enterprise/Search',
                    dataType: 'json',
                    delay: 250,
                    data: function (params) {
                        return {
                            search: params.term,
                            page: params.page || 1,
                            pageSize: 20
                        };
                    },
                    processResults: function (data) {
                        return {
                            results: data.items.map(item => ({
                                id: item.id,
                                text: item.name
                            })),
                            pagination: {
                                more: data.hasNext
                            }
                        };
                    },
                    cache: true
                },
                minimumInputLength: 2
            });
        },

        /**
         * Initialize Select2 for static dropdown
         * @param {string} selector - jQuery selector
         * @param {string} placeholder - Placeholder text
         */
        initSelect2: function (selector, placeholder = 'Chọn...') {
            $(selector).select2({
                placeholder: placeholder,
                allowClear: true,
                width: '100%'
            });
        },

        // ========== VALIDATION HELPERS ==========

        /**
         * Validate required fields
         * @param {string} formSelector - Form selector
         * @returns {boolean} True if valid
         */
        validateRequiredFields: function (formSelector) {
            let isValid = true;
            
            $(formSelector).find('[required]').each(function () {
                const $field = $(this);
                const value = $field.val();
                
                if (!value || value.trim() === '') {
                    isValid = false;
                    $field.addClass('is-invalid');
                    
                    if (!$field.next('.invalid-feedback').length) {
                        $field.after('<div class="invalid-feedback">Trường này là bắt buộc</div>');
                    }
                } else {
                    $field.removeClass('is-invalid');
                }
            });

            return isValid;
        },

        /**
         * Clear validation errors
         * @param {string} formSelector - Form selector
         */
        clearValidation: function (formSelector) {
            $(formSelector).find('.is-invalid').removeClass('is-invalid');
            $(formSelector).find('.invalid-feedback').remove();
        },

        // ========== CONFIRMATION DIALOGS ==========

        /**
         * SweetAlert2 confirmation dialog
         * @param {string} title - Dialog title
         * @param {string} text - Dialog text
         * @param {function} confirmCallback - Callback on confirm
         * @param {string} confirmButtonText - Confirm button text
         */
        confirm: function (title, text, confirmCallback, confirmButtonText = 'Xác nhận') {
            Swal.fire({
                title: title,
                text: text,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: confirmButtonText,
                cancelButtonText: 'Hủy'
            }).then((result) => {
                if (result.isConfirmed && confirmCallback) {
                    confirmCallback();
                }
            });
        },

        /**
         * Delete confirmation dialog
         * @param {string} itemName - Name of item to delete
         * @param {function} confirmCallback - Callback on confirm
         */
        confirmDelete: function (itemName, confirmCallback) {
            this.confirm(
                'Xác nhận xóa',
                `Bạn có chắc chắn muốn xóa "${itemName}"? Hành động này không thể hoàn tác.`,
                confirmCallback,
                'Xóa'
            );
        },

        // ========== UTILITY FUNCTIONS ==========

        /**
         * Debounce function (delay execution)
         * @param {function} func - Function to debounce
         * @param {number} wait - Wait time in ms
         * @returns {function} Debounced function
         */
        debounce: function (func, wait = 300) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        /**
         * Copy text to clipboard
         * @param {string} text - Text to copy
         * @param {string} successMessage - Success toast message
         */
        copyToClipboard: function (text, successMessage = 'Đã sao chép') {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => {
                    toastr.success(successMessage);
                });
            } else {
                // Fallback for older browsers
                const $temp = $('<textarea>');
                $('body').append($temp);
                $temp.val(text).select();
                document.execCommand('copy');
                $temp.remove();
                toastr.success(successMessage);
            }
        },

        /**
         * Export table to Excel (trigger server-side export)
         * @param {string} url - Export endpoint
         * @param {object} filters - Filter params
         */
        exportToExcel: function (url, filters) {
            const params = new URLSearchParams(filters).toString();
            const fullUrl = url + (url.includes('?') ? '&' : '?') + params;
            
            window.location.href = fullUrl;
            toastr.success('Đang xuất file Excel...');
        }
    };

})(window, jQuery);
