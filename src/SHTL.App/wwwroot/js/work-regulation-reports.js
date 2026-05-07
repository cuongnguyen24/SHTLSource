(function () {
    'use strict';

    let table;

    /**
     * Initialize export history DataTable using dataTableFigma plugin
     * Follows DataTable UI pattern from analysis with 8 columns (STT + 7 data columns + Actions)
     */
    function initExportHistoryTable() {
        table = $('#exportHistoryTable').dataTableFigma({
            // Server-side processing configuration
            serverSide: true,
            processing: true,

            // AJAX configuration
            ajax: {
                url: window.reportConfig.historyUrl,
                type: 'GET',
                data: function (d) {
                    // Simple call without pagination - API returns 20 most recent
                    return {
                        draw: d.draw
                    };
                },
                dataSrc: 'data',  // Map response.data → table rows
                error: function (xhr, error, code) {
                    console.error('DataTables AJAX error:', error, xhr.responseText);
                    toastr.error('Không thể tải lịch sử xuất báo cáo');
                }
            },

            // DOM customization for Figma layout
            dom: 'rt',
            // r = Processing indicator
            // t = Table (no pagination needed - API returns 20 most recent)

            // Layout settings
            autoWidth: false,
            scrollX: false,

            // Sort & Search
            order: [[5, 'desc']],      // DEFAULT: Column 5 (Thời điểm xuất) DESC
            searching: false,           // Client-side search disabled

            // Pagination
            pageLength: 20,             // Items per page
            paging: false,
            info: false,

            // Localization
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/vi.json',
                processing: '<i class="fas fa-spinner fa-spin fa-2x"></i><br>Đang tải...'
            },

            // Column definitions (8 columns total)
            columns: [
                // Column 0: STT (Sequence Number)
                {
                    data: null,
                    orderable: false,
                    searchable: false,
                    className: 'text-center',
                    width: '50px',
                    defaultContent: ''
                    // Rendered in drawCallback
                },
                // Column 1: Loai ky (Thang/Quy/Nam) - Format: T1/2026, Q1/2026, 2026
                {
                    data: 'loaiKyBaoCao',
                    className: 'text-center',
                    width: '60px',
                    render: function (data, type, row) {
                        if (data === 'Thang') {
                            return `T${row.kyBaoCao}/${row.namBaoCao}`;
                        } else if (data === 'Quy') {
                            return `Q${row.kyBaoCao}/${row.namBaoCao}`;
                        } else if (data === 'Nam') {
                            return `${row.namBaoCao}`;
                        }
                        return data || '—';
                    }
                },
                // Column 2: Năm (Year)
                {
                    data: 'namBaoCao',
                    className: 'text-center',
                    width: '70px'
                },
                // Column 3: Định dạng (Format with badge)
                {
                    data: 'dinhDang',
                    className: 'text-center',
                    width: '100px',
                    render: function (data) {
                        if (data === 'Excel') {
                            return '<span class="badge-figma badge-figma-success" style="font-size: 0.9em;">' +
                                '<i class="fas fa-file-excel mr-1"></i>Excel</span>';
                        } else if (data === 'PDF') {
                            return '<span class="badge-figma badge-figma-danger" style="font-size: 0.9em;">' +
                                '<i class="fas fa-file-pdf mr-1"></i>PDF</span>';
                        }
                        return '<span class="text-muted">—</span>';
                    }
                },
                // Column 4: Người xuất (Exported by)
                {
                    data: 'nguoiXuat',
                    width: '140px',
                    render: function (data) {
                        return data || '<span class="text-muted">Hệ thống</span>';
                    }
                },
                // Column 5: Thời điểm xuất (Export time - DEFAULT SORT)
                {
                    data: 'thoiDiemXuat',
                    className: 'text-center',
                    width: '150px',
                    render: function (data) {
                        if (!data) return '<span class="text-muted">—</span>';
                        const date = new Date(data);
                        return date.toLocaleString('vi-VN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    }
                },
                // Column 6: Link tải (Actions - Download buttons)
                {
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    width: '90px',
                    render: function (data, type, row) {
                        var html = '<div class="d-flex justify-content-center" style="gap:4px;">';

                        // Download button (only if file exists)
                        if (row.fileId && row.fileName) {
                            html += `<a href="/FileManager/Download?id=${row.fileId}" target="_blank"
                                       class="btn-icon-figma btn-figma-primary" 
                                       style="background:#4B5563; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px; cursor: pointer;" 
                                       title="Tải xuống">
                                       <i class="fas fa-download" style="color:#fff; font-size: 12px;"></i>
                                    </a>`;
                        }

                        html += '</div>';
                        return html;
                    }
                }
            ],

            // Draw callback - called each time table is drawn
            drawCallback: function (settings) {
                // Call default Figma DrawCallback
                if (window.FigmaDataTables && FigmaDataTables.defaultConfig) {
                    FigmaDataTables.defaultConfig.drawCallback(settings);
                }

                // Render STT (sequence number) - always start from 1 (no pagination)
                var api = this.api();
                api.column(0, { page: 'current' }).nodes().each(function (cell, i) {
                    cell.innerHTML = i + 1;
                });
            }
        });

        // Event delegation for action buttons
        $(document).on('click', '.btn-delete-export', function () {
            const id = $(this).data('id');
            const name = $(this).data('name');

            if (confirm(`Bạn có chắc muốn xóa báo cáo ${name}?`)) {
                deleteExportRecord(id);
            }
        });
    }

    /**
     * Delete export record via AJAX
     */
    function deleteExportRecord(id) {
        $.ajax({
            url: window.reportConfig.deleteUrl || `/Work-Regulation/DeleteExportRecord/${id}`,
            type: 'POST',
            headers: { 'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') },
            success: function (result) {
                if (result.isSuccess || result.success) {
                    toastr.success('Đã xóa báo cáo thành công');
                    if (table) {
                        table.ajax.reload(null, false);
                    }
                } else {
                    toastr.error(result.message || 'Không thể xóa báo cáo');
                }
            },
            error: function (xhr, status, error) {
                console.error('Delete error:', error);
                toastr.error('Không thể xóa báo cáo');
            }
        });
    }

    /**
     * Populate year dropdown (current year and past 5 years)
     */
    function populateYearDropdown() {
        const currentYear = new Date().getFullYear();
        const $yearSelect = $('#namBaoCao');

        for (let i = 0; i < 6; i++) {
            const year = currentYear - i;
            $yearSelect.append(`<option value="${year}">${year}</option>`);
        }
    }

    /**
     * Validate export form
     * V1: ky_bao_cao – Bắt buộc chọn (thang, quy, hoặc năm)
     * V2: Không cho xuất kỳ trong tương lai (kỳ > tháng hiện tại)
     * V3: dinh_dang – Bắt buộc chọn Excel hoặc PDF
     */
    function validateForm() {
        let isValid = true;

        // Clear previous errors
        $('#errorLoaiKyBaoCao, #errorThangBaoCao, #errorQuyBaoCao, #errorNamBaoCao, #errorDinhDang').text('');

        // Get current date
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentQuarter = Math.ceil(currentMonth / 3);

        // [V1] Validate loại kỳ báo cáo
        const loaiKy = $('#loaiKyBaoCao').val();
        if (!loaiKy) {
            $('#errorLoaiKyBaoCao').text('Vui lòng chọn loại kỳ báo cáo');
            isValid = false;
        }

        // Validate Năm báo cáo (always required)
        const namBaoCao = $('#namBaoCao').val();
        if (!namBaoCao) {
            $('#errorNamBaoCao').text('Vui lòng chọn năm báo cáo');
            isValid = false;
        }

        // Validate based on loại kỳ
        if (loaiKy === 'Thang') {
            // Validate Tháng báo cáo
            const thang = $('#thangBaoCao').val();
            if (!thang) {
                $('#errorThangBaoCao').text('Vui lòng chọn tháng báo cáo');
                isValid = false;
            }

            // [V2] Check if month is in future
            if (thang && namBaoCao && isValid) {
                if (parseInt(namBaoCao) > currentYear ||
                    (parseInt(namBaoCao) === currentYear && parseInt(thang) > currentMonth)) {
                    $('#errorThangBaoCao').text('Không thể xuất báo cáo cho tháng tương lai');
                    isValid = false;
                }
            }
        } else if (loaiKy === 'Quy') {
            // Validate Quý báo cáo
            const quy = $('#quyBaoCao').val();
            if (!quy) {
                $('#errorQuyBaoCao').text('Vui lòng chọn quý báo cáo');
                isValid = false;
            }

            // [V2] Check if quarter is in future
            if (quy && namBaoCao && isValid) {
                if (parseInt(namBaoCao) > currentYear ||
                    (parseInt(namBaoCao) === currentYear && parseInt(quy) > currentQuarter)) {
                    $('#errorQuyBaoCao').text('Không thể xuất báo cáo cho quý tương lai');
                    isValid = false;
                }
            }
        }

        // [V3] Validate Định dạng
        const dinhDang = $('input[name="dinhDang"]:checked').val();
        if (!dinhDang) {
            $('#errorDinhDang').text('Vui lòng chọn định dạng file');
            isValid = false;
        }

        return isValid;
    }

    /**
     * Get form data for export request
     * Includes period type (Thang/Quy/Nam) and corresponding period value
     */
    function getFormData() {
        const loaiKy = $('#loaiKyBaoCao').val();
        let periodValue = 0;  // Default to 0 for Nam (year)

        if (loaiKy === 'Thang') {
            periodValue = parseInt($('#thangBaoCao').val()) || 0;
        } else if (loaiKy === 'Quy') {
            periodValue = parseInt($('#quyBaoCao').val()) || 0;
        }

        return {
            loaiKyBaoCao: loaiKy,           // Thang, Quy, or Nam
            kyBaoCao: periodValue,          // Month/Quarter value (0 for Nam)
            namBaoCao: parseInt($('#namBaoCao').val()),
            dinhDang: $('input[name="dinhDang"]:checked').val(),
            donViId: $('#donViBaoCao').val() || null
        };
    }

    /**
     * Get CSRF token from cookie
     */
    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : '';
    }

    /**
     * Handle preview button click
     * Format data and request preview (MSG-S-01 on success)
     */
    function handlePreview() {
        if (!validateForm()) {
            toastr.error('Vui lòng điền đầy đủ thông tin bắt buộc');
            return;
        }

        const formData = getFormData();
        const $btn = $('#btnPreview');
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');

        $.ajax({
            url: window.reportConfig.previewUrl,
            type: 'POST',
            headers: { 'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') },
            data: JSON.stringify(formData),
            contentType: 'application/json',
            xhrFields: {
                responseType: 'blob' // Important for file download
            },
            success: function (data, status, xhr) {
                // Check if no data available (MSG-W-01)
                const contentType = xhr.getResponseHeader('Content-Type');
                if (contentType && contentType.includes('application/json')) {
                    const reader = new FileReader();
                    reader.onload = function () {
                        const result = JSON.parse(reader.result);
                        if (!result.isSuccess && result.message) {
                            toastr.warning(result.message); // MSG-W-01 or custom message
                        }
                    };
                    reader.readAsText(data);
                } else {
                    // Get filename from Content-Disposition header
                    const disposition = xhr.getResponseHeader('Content-Disposition');
                    let filename = 'preview.xlsx';
                    if (disposition) {
                        const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                        if (filenameMatch && filenameMatch[1]) {
                            filename = filenameMatch[1].replace(/['"]/g, '');
                        }
                    }

                    // Create blob URL and open in new tab
                    const blob = new Blob([data], { type: xhr.getResponseHeader('Content-Type') });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename;

                    document.body.appendChild(a);
                    a.click();

                    a.remove();
                    window.URL.revokeObjectURL(url);

                    toastr.success('Đã mở xem trước báo cáo');
                }
            },
            error: function (xhr, status, error) {
                console.error('Preview error:', error);
                // MSG-E-01
                toastr.error('Lỗi xuất báo cáo. Vui lòng thử lại.');
            },
            complete: function () {
                $btn.prop('disabled', false).html('<i class="fas fa-eye mr-1"></i> Xem trước');
            }
        });
    }

    /**
     * Handle export button click (form submit)
     * Messages:
     * MSG-I-01: "Đang xử lý báo cáo lớn. File sẽ gửi qua email khi hoàn tất."
     * MSG-W-01: "Không có dữ liệu báo cáo cho kỳ [X]."
     * MSG-S-01: "Xuất báo cáo thành công."
     * MSG-E-01: "Lỗi xuất báo cáo. Vui lòng thử lại."
     */
    function handleExport(e) {
        e.preventDefault();

        if (!validateForm()) {
            toastr.error('Vui lòng điền đầy đủ thông tin bắt buộc');
            return;
        }

        const formData = getFormData();
        const $btn = $('#btnExport');
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xuất...');

        $.ajax({
            url: window.reportConfig.exportUrl,
            type: 'POST',
            headers: { 'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') },
            data: JSON.stringify(formData),
            contentType: 'application/json',
            xhrFields: {
                responseType: 'blob'
            },
            success: function (data, status, xhr) {
                // Check if response is async processing notification
                const contentType = xhr.getResponseHeader('Content-Type');

                if (contentType && contentType.includes('application/json')) {
                    // Async processing - MSG-I-01
                    const reader = new FileReader();
                    reader.onload = function () {
                        const result = JSON.parse(reader.result);
                        if (result.message) {
                            toastr.info(result.message);
                        } else {
                            // MSG-I-01
                            toastr.info('Đang xử lý báo cáo lớn. File sẽ gửi qua email khi hoàn tất.');
                        }
                        // Refresh history table
                        if (table) {
                            table.ajax.reload(null, false);
                        }
                    };
                    reader.readAsText(data);
                } else {
                    // Direct download
                    const disposition = xhr.getResponseHeader('Content-Disposition');
                    let filename = `BaoCao_${formData.loaiKyBaoCao}_${formData.kyBaoCao || formData.namBaoCao}_${formData.namBaoCao}.${formData.dinhDang === 'Excel' ? 'xlsx' : 'pdf'}`;
                    if (disposition) {
                        const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                        if (filenameMatch && filenameMatch[1]) {
                            filename = filenameMatch[1].replace(/['"]/g, '');
                        }
                    }

                    // Create download link
                    const blob = new Blob([data], { type: xhr.getResponseHeader('Content-Type') });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();

                    // MSG-S-01
                    toastr.success('Xuất báo cáo thành công.');

                    // Refresh history table
                    if (table) {
                        table.ajax.reload(null, false);
                    }
                }
            },
            error: function (xhr, status, error) {
                console.error('Export error:', error);
                // MSG-E-01
                toastr.error('Lỗi xuất báo cáo. Vui lòng thử lại.');
            },
            complete: function () {
                $btn.prop('disabled', false).html('<i class="fas fa-file-download mr-1"></i> Xuất báo cáo');
            }
        });
    }

    /**
     * Handle refresh history button click
     */
    function handleRefreshHistory() {
        if (table) {
            table.ajax.reload(null, false);
            toastr.success('Đã làm mới danh sách');
        }
    }

    /**
     * Handle loại kỳ báo cáo change (Thang/Quy/Nam)
     * Show/hide corresponding select boxes
     */
    function handleLoaiKyChange() {
        const loaiKy = $('#loaiKyBaoCao').val();

        // Hide all period-specific select boxes first
        $('#thangBaoCaoGroup').hide();
        $('#quyBaoCaoGroup').hide();

        // Clear values and hide error messages
        $('#thangBaoCao').val('').change();
        $('#quyBaoCao').val('').change();
        $('#errorThangBaoCao, #errorQuyBaoCao').text('');

        // Show appropriate select box based on selection
        if (loaiKy === 'Thang') {
            $('#thangBaoCaoGroup').show();
        } else if (loaiKy === 'Quy') {
            $('#quyBaoCaoGroup').show();
        }
        // If Nam (Year), no additional select needed
    }

    /**
     * Load departments from API and populate donViBaoCao select
     */
    function loadDepartments() {
        $.ajax({
            url: '/departments/GetActive',
            type: 'GET',
            dataType: 'json',
            success: function (response) {
                const $select = $('#donViBaoCao');
                // Clear existing options (keep the default "Tất cả đơn vị" option)
                $select.find('option:not(:first)').remove();

                // Handle both ApiResponse wrapper and direct array response
                let departments = [];
                if (response.data && Array.isArray(response.data)) {
                    departments = response.data;  // ApiResponse<T> format
                } else if (Array.isArray(response)) {
                    departments = response;        // Direct array format
                }

                // Populate options
                if (departments && departments.length > 0) {
                    departments.forEach(function (dept) {
                        const id = dept.id || dept.departmentId;
                        const name = dept.name || dept.departmentName;
                        if (id && name) {
                            $select.append(`<option value="${id}">${name}</option>`);
                        }
                    });

                    // Refresh Select2 to reflect new options
                    $select.trigger('change');
                } else {
                    console.warn('No departments received from API');
                }
            },
            error: function (xhr, status, error) {
                console.error('Error loading departments:', error);
                // Silently fail - allow form to work without unit filter
            }
        });
    }

    /**
     * Initialize Select2 dropdowns
     */
    function initSelect2() {
        $('.select2').select2({
            theme: 'bootstrap4',
            width: '100%',
            allowClear: false
        });
    }

    /**
     * Initialize all components
     */
    $(document).ready(function () {
        // Initialize Select2
        initSelect2();

        // Load departments into select box
        loadDepartments();

        // Populate year dropdown
        populateYearDropdown();

        // Initialize export history table
        initExportHistoryTable();

        // Event handlers
        $('#loaiKyBaoCao').on('change', handleLoaiKyChange);  // Show/hide period select boxes
        $('#btnPreview').on('click', handlePreview);
        $('#reportExportForm').on('submit', handleExport);
        $('#btnRefreshHistory').on('click', handleRefreshHistory);
    });

})();
