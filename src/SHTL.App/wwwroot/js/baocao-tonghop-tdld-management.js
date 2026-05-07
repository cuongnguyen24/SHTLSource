/**
 * Báo cáo tổng hợp TDLD — Management Module
 * M0075 — IIFE pattern with filter logic + export actions
 */
(function ($) {
    'use strict';

    var BaoCaoTongHopModule = {
        init: function () {
            this.loadPeriods();
            this.initFilters();
            this.initExport();
        },

        loadPeriods: function () {
            // Load available periods for dropdown
            $.ajax({
                url: '/CauHinhKyTDLD/GetAllActive',
                type: 'GET',
                success: function (result) {
                    var $select = $('#periodId');
                    $select.empty().append('<option value="">Chọn kỳ</option>');
                    
                    if (result && result.data && result.data.length > 0) {
                        result.data.forEach(function (period) {
                            var label = 'Kỳ ' + period.periodNumber + '/' + period.year;
                            if (period.isCurrent) {
                                label += ' (Kỳ hiện tại)';
                            }
                            $select.append(
                                $('<option></option>')
                                    .val(period.id)
                                    .text(label)
                                    .prop('selected', period.isCurrent)
                            );
                        });
                    } else {
                        toastr.warning('Chưa có kỳ khai báo nào được cấu hình');
                    }
                },
                error: function () {
                    toastr.error('Không thể tải danh sách kỳ khai báo');
                }
            });
        },

        initFilters: function () {
            var self = this;

            // Auto-fill year from current period
            $('#periodId').on('change', function () {
                var selectedText = $(this).find('option:selected').text();
                var yearMatch = selectedText.match(/\/(\d{4})/);
                if (yearMatch) {
                    $('#year').val(yearMatch[1]);
                }
            });

            // Enterprise search filter (debounced)
            var searchTimer;
            $('#enterpriseSearch').on('input', function () {
                clearTimeout(searchTimer);
                var query = $(this).val();
                if (query.length >= 2) {
                    searchTimer = setTimeout(function () {
                        self.searchEnterprises(query);
                    }, 400);
                }
            });
        },

        searchEnterprises: function (query) {
            // Optional: Auto-complete search for enterprises
            // Implementation depends on backend API availability
            console.log('Search enterprises:', query);
        },

        initExport: function () {
            var self = this;

            $('#btnExport').on('click', function () {
                self.handleExport();
            });
        },

        handleExport: function () {
            var periodId = $('#periodId').val();
            var year = $('#year').val();
            var enterpriseSearch = $('#enterpriseSearch').val();
            var format = $('input[name="format"]:checked').val();

            // Validation
            if (!periodId) {
                toastr.warning('Vui lòng chọn kỳ khai báo');
                $('#periodId').focus();
                return;
            }

            if (!year || year < 2000 || year > 2100) {
                toastr.warning('Vui lòng nhập năm hợp lệ (2000-2100)');
                $('#year').focus();
                return;
            }

            // Build query params
            var params = {
                periodId: periodId,
                year: year
            };

            if (enterpriseSearch && enterpriseSearch.trim() !== '') {
                params.enterpriseSearch = enterpriseSearch.trim();
            }

            if (format === 'pdf') {
                params.format = 'pdf';
            }

            var queryString = $.param(params);
            var exportUrl = '/BaoCaoTongHopTDLD/Export?' + queryString;

            // Visual feedback
            var $btn = $('#btnExport');
            var originalHtml = $btn.html();
            $btn.prop('disabled', true)
                .html('<span class="spinner-border spinner-border-sm mr-1"></span> Đang xuất...');

            // Use AJAX POST for anti-forgery
            var token = $('input[name="__RequestVerificationToken"]').val();

            $.ajax({
                url: '/BaoCaoTongHopTDLD/Export',
                type: 'POST',
                data: params,
                headers: {
                    'X-XSRF-TOKEN': token
                },
                xhrFields: {
                    responseType: 'blob' // Handle binary response
                },
                success: function (data, status, xhr) {
                    // Extract filename from Content-Disposition header
                    var filename = 'BaoCaoTongHop_' + periodId + '.xlsx';
                    var disposition = xhr.getResponseHeader('Content-Disposition');
                    if (disposition && disposition.indexOf('filename=') !== -1) {
                        var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                        var matches = filenameRegex.exec(disposition);
                        if (matches != null && matches[1]) {
                            filename = matches[1].replace(/['"]/g, '');
                        }
                    }

                    // Download file
                    var blob = new Blob([data], { type: xhr.getResponseHeader('Content-Type') });
                    var link = document.createElement('a');
                    link.href = window.URL.createObjectURL(blob);
                    link.download = filename;
                    link.click();
                    window.URL.revokeObjectURL(link.href);

                    toastr.success('Xuất báo cáo thành công');
                },
                error: function (xhr) {
                    if (xhr.status === 404) {
                        toastr.error('Không tìm thấy dữ liệu để xuất');
                    } else if (xhr.status === 400) {
                        toastr.error('Tham số không hợp lệ');
                    } else {
                        toastr.error('Xuất báo cáo thất bại. Vui lòng thử lại.');
                    }
                },
                complete: function () {
                    $btn.prop('disabled', false).html(originalHtml);
                }
            });
        }
    };

    // Initialize on document ready
    $(document).ready(function () {
        BaoCaoTongHopModule.init();
    });

})(jQuery);
