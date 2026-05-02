(function () {
    'use strict';

    window.fileManagerMetadataCore = {
        formatNumberInput: function(element, isDecimal) {
            let val = $(element).val();
            if (val === undefined || val === null) return;
            
            let cursorPosition = element.selectionStart;
            let oldLength = val.length;

            if (isDecimal) {
                // Decimal: Allow minus at start, digits, and one dot
                let isNegative = val.startsWith('-');
                val = val.replace(/-/g, ''); // Remove all minus signs
                
                // Remove everything except digits and dot
                val = val.replace(/[^\d.]/g, '');
                
                // Keep only the first dot
                let dotIndex = val.indexOf('.');
                if (dotIndex !== -1) {
                    val = val.substring(0, dotIndex + 1) + val.substring(dotIndex + 1).replace(/\./g, '');
                }
                
                // Re-add minus if it was at start
                if (isNegative && val.length > 0) {
                    val = '-' + val;
                }
            } else {
                // Integer: Only positive integers (no minus, no dot, no comma)
                val = val.replace(/[^\d]/g, '');
            }

            // Don't format if empty or incomplete
            if (!val || val === '-' || val === '.') {
                $(element).val(val);
                return;
            }

            let parts = val.split('.');
            let minusPart = '';
            
            // Handle negative sign for decimal
            if (parts[0].startsWith('-')) {
                minusPart = '-';
                parts[0] = parts[0].substring(1);
            }
            
            // Format integer part with commas (thousands separator)
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            
            if (isDecimal && parts.length > 1) {
                val = minusPart + parts[0] + '.' + parts.slice(1).join('');
            } else {
                val = minusPart + parts[0];
            }

            $(element).val(val);
            
            try {
                let newLength = val.length;
                let newCursorPosition = cursorPosition + (newLength - oldLength);
                element.setSelectionRange(newCursorPosition, newCursorPosition);
            } catch (e) {}
        },

        parseFormattedNumber: function(val) {
            if (val === null || val === undefined) return val;
            if (typeof val === 'string') {
                return val.replace(/,/g, '');
            }
            return val;
        },

        validateMetadataFields: function(containerSelector, elementClassSelector) {
            let metadataValid = true;
            $(`${containerSelector} ${elementClassSelector}`).each(function () {
                const val = $(this).val();
                const fieldName = $(this).data('field-name');
                const labelStr = $(`label[for="${$(this).attr('id')}"]`).text().replace('*', '').trim() || fieldName;
                
                if ($(this).attr('required') && (!val || val.length === 0)) {
                    toastr.warning(`Vui lòng nhập: ${labelStr}`);
                    metadataValid = false;
                    return false; // Break loop
                }

                if (val) {
                    const minLen = $(this).attr('minlength');
                    if (minLen && val.length < parseInt(minLen)) {
                        toastr.warning(`${labelStr} phải có ít nhất ${minLen} ký tự`);
                        metadataValid = false;
                        return false;
                    }

                    if ($(this).hasClass('format-decimal') || $(this).hasClass('format-integer')) {
                        const numVal = parseFloat(window.fileManagerMetadataCore.parseFormattedNumber(val));
                        let minValData = $(this).data('min');
                        let maxValData = $(this).data('max');

                        if (minValData !== undefined && minValData !== '') {
                            const minNum = parseFloat(window.fileManagerMetadataCore.parseFormattedNumber(minValData.toString()));
                            if (!isNaN(minNum) && !isNaN(numVal) && numVal < minNum) {
                                toastr.warning(`${labelStr} phải lớn hơn hoặc bằng ${minValData}`);
                                metadataValid = false;
                                return false;
                            }
                        }

                        if (maxValData !== undefined && maxValData !== '') {
                            const maxNum = parseFloat(window.fileManagerMetadataCore.parseFormattedNumber(maxValData.toString()));
                            if (!isNaN(maxNum) && !isNaN(numVal) && numVal > maxNum) {
                                toastr.warning(`${labelStr} không được vượt quá ${maxValData}`);
                                metadataValid = false;
                                return false;
                            }
                        }
                    }
                }
            });

            return metadataValid;
        }
    };

    // Auto-bind formatting events globally ONCE
    $(document).off('input.fmtNum').on('input.fmtNum', '.format-decimal, .format-integer', function() {
        window.fileManagerMetadataCore.formatNumberInput(this, $(this).hasClass('format-decimal'));
    });

    // Instant validation on blur/change to notify user immediately (User requested immediate View validation)
    $(document).off('change.fmtValidate').on('change.fmtValidate blur.fmtValidate', '.metadata-field, .edit-metadata-field', function() {
        const val = $(this).val();
        if (!val) return; // Skip if empty (Required validation handles empty)

        const fieldName = $(this).data('field-name');
        const labelStr = $(`label[for="${$(this).attr('id')}"]`).text().replace('*', '').trim() || fieldName || 'Trường này';

        const minLen = $(this).attr('minlength');
        if (minLen && val.length < parseInt(minLen)) {
            toastr.warning(`${labelStr} phải có ít nhất ${minLen} ký tự`);
            return;
        }

        if ($(this).hasClass('format-decimal') || $(this).hasClass('format-integer')) {
            const numVal = parseFloat(window.fileManagerMetadataCore.parseFormattedNumber(val));
            let minValData = $(this).data('min');
            let maxValData = $(this).data('max');

            if (minValData !== undefined && minValData !== '') {
                const minNum = parseFloat(window.fileManagerMetadataCore.parseFormattedNumber(minValData.toString()));
                if (!isNaN(minNum) && !isNaN(numVal) && numVal < minNum) {
                    toastr.warning(`${labelStr} phải lớn hơn hoặc bằng ${minValData}`);
                }
            }

            if (maxValData !== undefined && maxValData !== '') {
                const maxNum = parseFloat(window.fileManagerMetadataCore.parseFormattedNumber(maxValData.toString()));
                if (!isNaN(maxNum) && !isNaN(numVal) && numVal > maxNum) {
                    toastr.warning(`${labelStr} không được vượt quá ${maxValData}`);
                }
            }
        }
    });
})();
