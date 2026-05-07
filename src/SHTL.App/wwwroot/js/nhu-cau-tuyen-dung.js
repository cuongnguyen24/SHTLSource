/**
 * Nhu Cau Tuyen Dung - Unified Script (v2.1)
 * Standardized with Figma design system.
 * Handles: List Management, Entry On Behalf, and Edit flows.
 */
(function ($) {
    'use strict';

    // ==========================================
    // 1. MANAGEMENT MODULE (INDEX)
    // ==========================================
    var ManagementModule = {
        table: null,
        selectors: {
            table: '#nhuCauTuyenDungTable',
            btnSearch: '#btnSearch',
            btnRefresh: '#btnRefresh',
            btnToggleAdvancedFilter: '#btnToggleAdvancedFilter',
            btnExport: '#btnExport'
        },

        init: function () {
            if ($(this.selectors.table).length === 0) return;
            this.initDataTable();
            this.initEvents();
            this.loadPeriods();
        },

        initDataTable: function () {
            var self = this;

            this.table = $(this.selectors.table).dataTableFigma({
                serverSide: true,
                // deferLoading: 0, // Prevent initial load
                ordering: false,
                ajax: {
                    url: '/NhuCauTuyenDung/GetAll',
                    type: 'GET',
                    data: function (d) {
                        return {
                            draw: d.draw,
                            search: $('#customSearchInput').val(),
                            scope: $('#filterScope').val(),
                            statuses: $('#filterStatus').val(),
                            periodId: $('#filterPeriod').val(),
                            industrialZoneId: $('#filterZone').val(),
                            isOverdue: $('#filterIsOverdue').val(),
                            industryCode: $('#filterIndustry').val(),
                            page: (d.start / d.length) + 1,
                            pageSize: d.length
                        };
                    }
                },
                columns: [
                    {
                        data: null,
                        className: 'text-center',
                        render: (data, type, row, meta) => meta.row + meta.settings._iDisplayStart + 1
                    },
                    {
                        data: 'maHoSo',
                        render: (data, type, row) => `<a href="/NhuCauTuyenDung/Details/${row.id}" class="font-weight-bold text-primary" title="Xem chi tiết">${data || '—'}</a>`
                    },
                    {
                        data: 'enterpriseName',
                        render: (data) => `<div class="text-wrap font-weight-medium" style="min-width:180px">${data || '—'}</div>`
                    },
                    {
                        data: 'industrialZoneName',
                        render: (data) => `<div class="small text-muted" style="max-width:140px">${data || '—'}</div>`
                    },
                    {
                        data: 'periodName',
                        render: (data) => `<span class="small font-weight-semibold" style="color:#475569;">${data || '—'}</span>`
                    },
                    {
                        data: 'submittedAt',
                        className: 'text-center',
                        render: (data) => data ? new Date(data).toLocaleDateString('vi-VN') : '<span class="text-muted italic" style="font-size:11px;">Chưa nộp</span>'
                    },
                    {
                        data: 'scope',
                        render: function (data) {
                            let cls = 'badge-figma-primary';
                            let text = 'Trong nước';
                            if (data === 'Foreign') { cls = 'badge-figma-info'; text = 'Nước ngoài'; }
                            else if (data === 'Both') { cls = 'badge-figma-success'; text = 'Cả hai'; }
                            return `<span class="badge-figma ${cls}">${text}</span>`;
                        }
                    },
                    {
                        data: 'totalPositions',
                        className: 'text-center',
                        render: (data) => `<span class="font-weight-bold">${data || 0}</span>`
                    },
                    {
                        data: 'totalWorkers',
                        className: 'text-center',
                        render: (data) => `<span class="badge badge-light border" style="font-size:12px; font-weight:700;">${data || 0}</span>`
                    },
                    {
                        data: 'isOverdue',
                        className: 'text-center',
                        render: function (data, type, row) {
                            if (!row.submittedAt) return '<span class="text-muted">—</span>';

                            // Real-time calculation: compare submittedAt with periodDeadline
                            const subDate = new Date(row.submittedAt);
                            const deadline = row.periodDeadline ? new Date(row.periodDeadline) : null;

                            if (deadline && subDate > deadline) {
                                return '<span class="badge-figma badge-figma-danger">Quá hạn</span>';
                            }
                            return '<span class="badge-figma badge-figma-success">Đúng hạn</span>';
                        }
                    },
                    {
                        data: 'status',
                        className: 'text-center',
                        render: function (data) {
                            let cls = 'badge-figma-secondary';
                            let text = data || 'Draft';
                            switch (data) {
                                case 'Draft': cls = 'badge-figma-secondary'; text = 'Nháp'; break;
                                case 'Pending': cls = 'badge-figma-info'; text = 'Chờ xác nhận'; break;
                                case 'Approved': cls = 'badge-figma-success'; text = 'Đã xác nhận'; break;
                                case 'Requested': cls = 'badge-figma-warning'; text = 'Yêu cầu bổ sung'; break;
                                case 'Rejected': cls = 'badge-figma-danger'; text = 'Từ chối'; break;
                            }
                            return `<span class="badge-figma ${cls}">${text}</span>`;
                        }
                    },
                    {
                        data: 'id',
                        className: 'text-center',
                        render: function (data, type, row) {
                            // Defensive check for permissions
                            const permissions = window.userPermissions || {};
                            const canUpdate = permissions.canUpdate === true;
                            const canDelete = permissions.canDelete === true;

                            // Normalize status from any potential property name (camelCase or PascalCase)
                            const rawStatus = row.status !== undefined ? row.status : (row.Status !== undefined ? row.Status : "");
                            const statusStr = rawStatus.toString().toLowerCase();

                            let html = '<div class="table-actions-figma" style="justify-content: center;">';

                            // View Button (Primary Blue)
                            html += `<a href="/NhuCauTuyenDung/Details/${row.id || row.Id}" class="btn-action-figma btn-action-view" title="Xem chi tiết">
                                       <i class="fas fa-eye"></i>
                                     </a>`;

                            // Edit: Only for Draft (1) and Requested (4)
                            // We check for both string names and integer values
                            const isEditable = (statusStr === 'draft' || statusStr === '1' || statusStr === 'requested' || statusStr === '4');

                            if (canUpdate && isEditable) {
                                html += `<a href="/NhuCauTuyenDung/Edit/${row.id || row.Id}" class="btn-action-figma btn-action-edit" title="Sửa">
                                           <i class="fas fa-pen"></i>
                                         </a>`;
                            }

                            // Delete: Only for Draft (1)
                            const isDeletable = (statusStr === 'draft' || statusStr === '1');

                            if (canDelete && isDeletable) {
                                html += `<button type="button" class="btn-action-figma btn-action-delete btn-delete-row" 
                                                 data-id="${row.id || row.Id}" 
                                                 data-code="${row.maHoSo || row.MaHoSo}" 
                                                 title="Xóa">
                                            <i class="fas fa-trash-alt"></i>
                                         </button>`;
                            }

                            html += '</div>';
                            return html;
                        }
                    }
                ],
                drawCallback: function (settings) {
                    // Call standard Figma helper first
                    if (typeof FigmaDataTables !== 'undefined' && FigmaDataTables.defaultConfig) {
                        FigmaDataTables.defaultConfig.drawCallback(settings);
                    }

                    // Move pagination to standard frame-footer
                    const $wrapper = $(settings.nTable).closest('.dataTables_wrapper');
                    const $pagination = $wrapper.find('.pagination-figma-container');
                    if ($pagination.length && $('#paginationFrame').length) {
                        $pagination.appendTo('#paginationFrame');
                    }
                }
            });
        },

        initEvents: function () {
            var self = this;

            $(this.selectors.btnSearch).on('click', function () { self.table.ajax.reload(); });

            $('#customSearchInput').on('keypress', function (e) {
                if (e.which === 13) self.table.ajax.reload();
            });

            $(this.selectors.btnRefresh).on('click', function () {
                $('#customSearchInput').val('');
                self.resetFilters();
                self.table.ajax.reload();
            });

            $(this.selectors.btnToggleAdvancedFilter).on('click', function () {
                $('#advancedFilterArea').toggleClass('show');
                $(this).toggleClass('active');
            });

            // Auto-reload on filter change - DISABLED as per user request (only search on button click)
            // $('#filterForm select').on('change', function() {
            //     self.table.ajax.reload();
            // });

            // Delete action (Handles both legacy and new robust classes)
            $(document).on('click', '.btn-delete, .btn-delete-row', function () {
                var id = $(this).data('id');
                Swal.fire({
                    title: 'Xác nhận xóa?',
                    text: "Bạn không thể hoàn tác thao tác này!",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#ef4444',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: 'Đồng ý xóa',
                    cancelButtonText: 'Hủy'
                }).then((result) => {
                    if (result.isConfirmed) {
                        self.deleteRecord(id);
                    }
                });
            });

            // Export action
            $(this.selectors.btnExport).on('click', function () {
                self.exportExcel();
            });
        },

        resetFilters: function () {
            $('#filterForm').length && $('#filterForm')[0].reset();
            $('.select2, .select2-ajax').val('').trigger('change');
        },

        loadPeriods: async function () {
            try {
                const response = await fetch('/NhuCauTuyenDung/GetActiveReportingPeriods');
                const result = await response.json();
                const periods = result.data?.items || [];
                const $select = $('#filterPeriod');
                if ($select.length === 0) return;

                periods.forEach(p => {
                    $select.append(`<option value="${p.id}">${p.name} (${p.year})</option>`);
                });
                $select.select2({ width: '100%', allowClear: true, theme: 'bootstrap4' });

                // Initialize Industrial Zone filter if present
                const $zoneSelect = $('#filterZone');
                if ($zoneSelect.length > 0) {
                    $zoneSelect.select2({ width: '100%', allowClear: true, theme: 'bootstrap4' });
                }
            } catch (error) {
                console.error('Error loading periods:', error);
            }
        },

        deleteRecord: async function (id) {
            try {
                const response = await fetch(`/NhuCauTuyenDung/Delete/${id}`, {
                    method: 'POST',
                    headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() }
                });
                const result = await response.json();
                if (result.success) {
                    toastr.success('Xóa hồ sơ thành công');
                    this.table.ajax.reload();
                } else {
                    toastr.error(result.message || 'Lỗi khi xóa hồ sơ');
                }
            } catch (error) {
                toastr.error('Lỗi hệ thống');
            }
        },

        exportExcel: function () {
            var params = new URLSearchParams();

            var search = $('#customSearchInput').val();
            var statuses = $('#filterStatus').val();
            var scope = $('#filterScope').val();
            var periodId = $('#filterPeriod').val();
            var industrialZoneId = $('#filterZone').val();
            var isOverdue = $('#filterIsOverdue').val();

            if (search) params.append('search', search);
            if (statuses) params.append('statuses', statuses);
            if (scope) params.append('scope', scope);
            if (periodId) params.append('periodId', periodId);
            if (industrialZoneId) params.append('industrialZoneId', industrialZoneId);
            if (isOverdue) params.append('isOverdue', isOverdue);

            window.location.href = `/NhuCauTuyenDung/ExportExcel?${params.toString()}`;
        }
    };

    // ==========================================
    // 2. FORM MODULE (CREATE & EDIT)
    // ==========================================
    var FormModule = {
        domesticRowIndex: 0,
        foreignRowIndex: 0,
        files: [],
        type: 'create', // or 'edit'

        init: function () {
            const $form = $('#laborDemandForm');
            if ($form.length === 0) return;

            this.type = $('#formType').val() || 'create';

            // Set initial indices from backend if available (for Edit mode)
            if (window.NhuCauTuyenDungEdit) {
                this.domesticRowIndex = window.NhuCauTuyenDungEdit.domIdx - 1;
                this.foreignRowIndex = window.NhuCauTuyenDungEdit.forIdx - 1;
            } else {
                this.domesticRowIndex = -1;
                this.foreignRowIndex = -1;
                // Pre-add one row for better UX in Create mode
                this.addDomesticRow();
                this.addForeignRow();
            }

            this.initDropdowns($form);
            this.initPeriodDropdown();
            this.initEnterpriseDropdown();
            this.initRecruitmentMonthSelector();
            this.initFileUpload();
            this.initEvents();
            this.initCharacterCounters();

            this.toggleScopeSections(); // Run once on init
            this.recalculateTotals();
        },

        toggleScopeSections: function () {
            var scope = $('#scope').val();
            var $domSection = $('#domesticSection');
            var $forSection = $('#foreignSection');

            if (scope === 'Domestic') {
                $domSection.show().find('input, select, textarea').prop('disabled', false);
                $forSection.hide().find('input, select, textarea').prop('disabled', true);
            } else if (scope === 'Foreign') {
                $domSection.hide().find('input, select, textarea').prop('disabled', true);
                $forSection.show().find('input, select, textarea').prop('disabled', false);
            } else if (scope === 'Both') {
                $domSection.show().find('input, select, textarea').prop('disabled', false);
                $forSection.show().find('input, select, textarea').prop('disabled', false);
            } else {
                // If no scope selected, hide both and disable
                $domSection.hide().find('input, select, textarea').prop('disabled', true);
                $forSection.hide().find('input, select, textarea').prop('disabled', true);
            }

            // Re-init select2 for visibility or potential state changes
            $domSection.add($forSection).find('.select2-container').remove();
            this.initDropdowns($domSection.add($forSection));
        },

        initDropdowns: async function ($container) {
            var self = this;
            var $target = $container || $('#entryOnBehalfForm, #editForm');

            $target.find('.position-dropdown').each(function () {
                var $select = $(this);
                // In Edit mode, we already have the value selected, so we just init Select2
            })

            $target.find('.position-dropdown').each(function () {
                var $select = $(this);
                var typeCode = $select.data('type');
                if (typeCode) self.loadCategory($select, typeCode);
            });

            $target.find('.country-dropdown').each(function () {
                var $select = $(this);
                self.loadCountries($select);
            });

            $target.find('.select2:not(.position-dropdown):not(.country-dropdown)').each(function () {
                $(this).select2({ width: '100%', theme: 'bootstrap4' });
            });
        },

        loadCategory: async function ($select, typeCode) {
            try {
                const response = await fetch(`/NhuCauTuyenDung/GetCategories?typeCode=${typeCode}`);
                const result = await response.json();
                if (result.success) {
                    const currentVal = $select.val();
                    $select.empty().append('<option value="">-- Chọn --</option>');
                    result.data.forEach(item => {
                        const selected = item.name === currentVal ? 'selected' : '';
                        $select.append(`<option value="${item.name}" ${selected}>${item.name}</option>`);
                    });
                    $select.select2({ width: '100%', placeholder: '-- Chọn --', theme: 'bootstrap4' });
                    if (currentVal) $select.val(currentVal).trigger('change');
                }
            } catch (error) { console.error(`Error loading category ${typeCode}:`, error); }
        },

        loadCountries: async function ($select) {
            try {
                const response = await fetch('/NhuCauTuyenDung/GetCountries');
                const result = await response.json();
                if (result.success) {
                    const currentVal = $select.val();
                    $select.empty().append('<option value="">-- Chọn --</option>');
                    result.data.forEach(item => {
                        const selected = item.name === currentVal ? 'selected' : '';
                        $select.append(`<option value="${item.name}" ${selected}>${item.name}</option>`);
                    });
                    $select.select2({ width: '100%', placeholder: '-- Chọn --', theme: 'bootstrap4' });
                    if (currentVal) $select.val(currentVal).trigger('change');
                }
            } catch (error) { console.error('Error loading countries:', error); }
        },

        initPeriodDropdown: async function () {
            var self = this;
            var $select = $('#reportingPeriodId');
            if ($select.length === 0) return;

            // In Edit mode, the select is disabled but we still want Select2 for styling
            if ($select.prop('disabled')) {
                $select.select2({ width: '100%', theme: 'bootstrap4' });
                return;
            }

            try {
                const response = await fetch('/NhuCauTuyenDung/GetActiveReportingPeriods');
                const result = await response.json();
                const periods = result.data?.items || [];

                $select.empty().append('<option value="">Chọn kỳ</option>');
                periods.forEach(p => { $select.append(`<option value="${p.id}" data-json="${encodeURIComponent(JSON.stringify(p))}">${p.name || ('Kỳ ' + p.year)}</option>`); });

                $select.select2({ width: '100%', placeholder: 'Chọn kỳ khai báo', theme: 'bootstrap4' });
                $select.on('change', function () {
                    var $option = $(this).find(':selected');
                    if (!$option.val()) { $('#periodInfo').hide(); return; }

                    var periodData = JSON.parse(decodeURIComponent($option.data('json')));
                    $('#periodName').text(periodData.name || '');
                    $('#periodYear').text(periodData.year || '');
                    $('#periodDeadline').text(periodData.deadline ? new Date(periodData.deadline).toLocaleDateString('vi-VN') : '—');
                    $('#periodInfo').slideDown(200);

                    var minMonth = (periodData.year || 2026) + '-' + ({ 1: '01', 2: '04', 3: '07', 4: '10' }[periodData.quarter || 1]);
                    $('#recruitmentStartMonth').attr('data-min', minMonth);
                    this.validateRecruitmentMonth();
                });
            } catch (error) { console.error('Error loading periods:', error); }
        },

        initEnterpriseDropdown: function () {
            var $select = $('#enterpriseId');
            if ($select.length === 0 || $select.prop('disabled')) return;

            $select.select2({
                ajax: {
                    url: '/NhuCauTuyenDung/SearchEnterprises',
                    dataType: 'json',
                    delay: 300,
                    data: (params) => ({ searchTerm: params.term || '', pageNumber: params.page || 1, pageSize: 20 }),
                    processResults: (result, params) => {
                        var items = result.data?.items || [];
                        return { limits: 20, results: items.map(e => ({ id: e.id, text: e.name + ' (' + e.taxCode + ')', data: e })), pagination: { more: (params.page * 20) < (result.data?.totalCount || 0) } };
                    },
                    cache: true
                },
                width: '100%', placeholder: 'Tìm theo tên hoặc MST...', minimumInputLength: 0, theme: 'bootstrap4'
            });

            $('#enterpriseId').on('change', function () {
                var selectedData = $(this).select2('data')[0];
                if (!selectedData || !selectedData.data) {
                    $('#enterpriseInfoSection').hide();
                    $('#enterpriseTaxCode').val('');
                    return;
                }
                var ent = selectedData.data;
                console.log('Selected Enterprise Data:', ent); // Debug info

                $('#enterpriseTaxCode').val(ent.taxCode || ent.TaxCode || '');
                $('#industrialZoneId').val(ent.industrialZoneId || ent.IndustrialZoneId || '');
                $('#entTaxCode').text(ent.taxCode || ent.TaxCode || '—'); 
                
                // Aggregate Industries: Primary Industry + Investment Projects
                let industries = [];
                let primaryInd = ent.industryName || ent.IndustryName;
                if (primaryInd) industries.push(primaryInd);
                
                let projs = ent.investmentProjects || ent.InvestmentProjects;
                if (projs && Array.isArray(projs)) {
                    projs.forEach(proj => {
                        let projInd = proj.industryName || proj.IndustryName;
                        if (projInd && !industries.includes(projInd)) {
                            industries.push(projInd);
                        }
                    });
                }
                $('#entIndustry').text(industries.length > 0 ? industries.join('; ') : '—');

                $('#entIZone').text(ent.industrialZoneName || ent.IndustrialZoneName || '—');
                
                // Representative info with fallback for naming conventions
                var repName = ent.legalRepresentative || ent.LegalRepresentative || '';
                var repPos = ent.position || ent.Position || '';
                
                var repDisplay = '';
                if (repName && repPos) {
                    repDisplay = repPos + ' - ' + repName;
                } else {
                    repDisplay = repName || repPos || '';
                }
                
                $('#entRepresentative').text(repDisplay || '—');
                $('#entPhone').text(ent.phone || ent.Phone || '—'); 
                $('#entEmail').text(ent.email || ent.Email || '—');
                $('#enterpriseInfoSection').slideDown(200);
            });

            // If in Edit mode, ensure the section is visible
            if (this.type === 'edit') {
                $('#enterpriseInfoSection').show();
            }
        },

        initRecruitmentMonthSelector: function () {
            var self = this;
            var $hidden = $('#recruitmentStartMonth');
            var $monthSelect = $('#monthSelect');
            var $yearSelect = $('#yearSelect');

            if ($monthSelect.length === 0 || $yearSelect.length === 0) return;

            // Set initial values from hidden input (yyyy-MM) or current date
            var currentVal = $hidden.val();
            if (currentVal && currentVal.indexOf('-') > -1) {
                var parts = currentVal.split('-');
                $yearSelect.val(parts[0]);
                $monthSelect.val(parts[1]);
            } else {
                var now = new Date();
                var defaultYear = now.getFullYear();
                var defaultMonth = String(now.getMonth() + 1).padStart(2, '0');
                
                // Fallback to period year if available
                var periodYear = $('#periodYear').text();
                if (periodYear && parseInt(periodYear) > 0) defaultYear = periodYear;

                $yearSelect.val(defaultYear);
                $monthSelect.val(defaultMonth);
                $hidden.val(defaultYear + '-' + defaultMonth);
            }

            $monthSelect.select2({ width: '100%', theme: 'bootstrap4' });
            $yearSelect.select2({ width: '100%', theme: 'bootstrap4' });

            var syncHidden = function () {
                var y = $yearSelect.val();
                var m = $monthSelect.val();
                if (y && m) {
                    $hidden.val(y + '-' + m);
                    self.validateRecruitmentMonth();
                }
            };

            $monthSelect.on('change', syncHidden);
            $yearSelect.on('change', syncHidden);
            
            // Run validation once in case initial value is invalid
            this.validateRecruitmentMonth();
        },

        validateRecruitmentMonth: function () {
            var $hidden = $('#recruitmentStartMonth');
            var current = $hidden.val();
            var min = $hidden.attr('data-min');

            if (min && current && current < min) {
                toastr.warning('Tháng bắt đầu tuyển không được trước kỳ khai báo');
                
                // Reset to min
                var parts = min.split('-');
                $('#yearSelect').val(parts[0]).trigger('change.select2');
                $('#monthSelect').val(parts[1]).trigger('change.select2');
                $hidden.val(min);
            }
        },

        initFileUpload: function () {
            var self = this;
            var $dropZone = $('#dropZone');
            var $fileInput = $('#fileUpload');
            if ($dropZone.length === 0) return;

            $dropZone.on('click', () => $fileInput.click());
            $dropZone.on('dragover', (e) => { e.preventDefault(); $dropZone.css('background', '#eff6ff'); });
            $dropZone.on('dragleave', () => $dropZone.css('background', '#f8fafc'));
            $dropZone.on('drop', (e) => { e.preventDefault(); $dropZone.css('background', '#f8fafc'); self.handleFiles(e.originalEvent.dataTransfer.files, $fileInput); });
            $fileInput.on('change', (e) => self.handleFiles(e.target.files, $fileInput));
        },

        handleFiles: function (newFiles, $fileInput) {
            var self = this;
            Array.from(newFiles).forEach(file => {
                if (self.files.length >= 5) { toastr.warning('Tối đa 5 file đính kèm'); return; }
                var ext = '.' + file.name.split('.').pop().toLowerCase();
                if (!['.pdf', '.docx'].includes(ext)) { toastr.error(`File ${file.name} không đúng định dạng (.pdf, .docx)`); return; }
                if (file.size > 10 * 1024 * 1024) { toastr.error(`File ${file.name} vượt quá 10MB`); return; }
                self.files.push(file);
            });
            $fileInput.val(''); // Clear to allow re-selection of same file if needed
            this.renderFileList();
        },

        renderFileList: function () {
            var $body = $('#fileListBody');
            $body.empty();
            if (this.files.length === 0) { $('#fileListContainer').hide(); return; }
            this.files.forEach((file, idx) => {
                var sizeKB = (file.size / 1024).toFixed(1) + ' KB';
                var ext = file.name.split('.').pop().toUpperCase();
                $body.append(`<tr>
                    <td class="text-center">${idx + 1}</td>
                    <td><span class="text-truncate d-inline-block" style="max-width:300px">${file.name}</span></td>
                    <td class="text-center">${sizeKB}</td>
                    <td class="text-center">${ext}</td>
                    <td class="text-center"><button type="button" class="btn text-danger btn-sm p-0" onclick="window.NhuCauTuyenDungAll.removeFile(${idx})"><i class="fas fa-times-circle"></i></button></td>
                </tr>`);
            });
            $('#fileListContainer').show();
        },

        initEvents: function () {
            var self = this;
            $('#btnAddDomesticPosition').on('click', () => self.addDomesticRow());
            $('#btnAddForeignPosition').on('click', () => self.addForeignRow());

            $(document).on('click', '.btn-remove-row', function () {
                $(this).closest('tr').remove();
                self.recalculateTotals();
                self.check30PercentRule();
            });

            $(document).on('change', '.domestic-quantity, .foreign-quantity, #totalCurrentWorkers, #scope', function () {
                if ($(this).attr('id') === 'scope') {
                    self.toggleScopeSections();
                }
                self.recalculateTotals();
                self.check30PercentRule();
            });

            // Common form submission handler
            $('#laborDemandForm').on('submit', function (e) {
                e.preventDefault();
                $('#isDraft').val('false');
                if (self.validateForm()) {
                    self.submitForm($(this));
                }
            });

            // "Lưu nháp"
            $(document).on('click', '#btnDraft, #btnHeaderDraft', function () {
                var $form = $('#laborDemandForm');
                $('#isDraft').val('true');
                // Less strict validation for drafts
                if (!$('#enterpriseId').val()) { toastr.warning('Vui lòng chọn doanh nghiệp'); return; }
                self.submitForm($form);
            });
        },

        validateForm: function () {
            if (!$('#enterpriseId').val()) { toastr.warning('Vui lòng chọn doanh nghiệp'); return false; }
            if (!$('#totalCurrentWorkers').val()) { toastr.warning('Vui lòng nhập Tổng lao động hiện tại'); return false; }

            var scope = $('#scope').val();
            if (!scope) { toastr.warning('Vui lòng chọn phạm vi tuyển dụng'); return false; }

            var $domRows = $('#domesticPositionTable tbody tr');
            var $forRows = $('#foreignPositionTable tbody tr');

            if (scope === 'Domestic' || scope === 'Both') {
                if ($domRows.length === 0) { toastr.warning('Vui lòng thêm ít nhất một vị trí tuyển dụng trong nước'); return false; }
            }
            if (scope === 'Foreign' || scope === 'Both') {
                if ($forRows.length === 0) { toastr.warning('Vui lòng thêm ít nhất một vị trí tuyển dụng nước ngoài'); return false; }
            }

            return true;
        },

        submitForm: async function ($form) {
            var self = this;
            var isDraft = $('#isDraft').val() === 'true';
            var $btn = isDraft ? $('#btnDraft') : $('#btnSubmit, #btnHeaderSubmit');
            var originalHtml = $btn.html();

            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xử lý...');

            try {
                var formData = new FormData($form[0]);
                // Append tracked files
                if (self.files) {
                    self.files.forEach(file => formData.append('files', file));
                }

                // Add isDraft manually just in case it's not in the form
                formData.set('IsDraft', isDraft);

                const response = await fetch($form.attr('action') || window.location.href, {
                    method: 'POST',
                    body: formData,
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });

                const result = await response.json();
                if (result.success) {
                    toastr.success(result.message || 'Thao tác thành công');
                    setTimeout(() => window.location.href = '/NhuCauTuyenDung/Index', 1000);
                } else {
                    toastr.error(result.message || 'Lỗi xử lý');
                    $btn.prop('disabled', false).html(originalHtml);
                }
            } catch (error) {
                console.error('Submit error:', error);
                toastr.error('Lỗi hệ thống');
                $btn.prop('disabled', false).html(originalHtml);
            }
        },

        addDomesticRow: function () {
            var idx = ++this.domesticRowIndex;
            var html = `<tr data-row-index="${idx}">
                <td><select name="DomesticPositions[${idx}].PositionName" class="select-figma select2 position-dropdown" data-type="CAT_POSITION" style="width:100%;" required><option value="">-- Chọn --</option></select></td>
                <td><input type="number" name="DomesticPositions[${idx}].Quantity" class="input-figma domestic-quantity" style="width:100%; height:32px; font-size:13px; padding:0 4px !important; text-align:center;" min="1" value="1" required /></td>
                <td><select name="DomesticPositions[${idx}].WorkType" class="select-figma select2 position-dropdown" data-type="CAT_WORKTYPE" style="width:100%;" required><option value="">-- Chọn --</option></select></td>
                <td><select name="DomesticPositions[${idx}].EducationLevel" class="select-figma select2 position-dropdown" data-type="CAT_EDU" style="width:100%;" required><option value="">-- Chọn --</option></select></td>
                <td><input type="number" name="DomesticPositions[${idx}].Experience" class="input-figma" style="width:100%; height:32px; font-size:13px; padding:0 4px !important; text-align:center;" min="0" /></td>
                <td><input type="number" name="DomesticPositions[${idx}].MinSalary" class="input-figma" style="width:100%; height:32px; font-size:13px; padding:0 8px !important;" min="0" required /></td>
                <td><input type="number" name="DomesticPositions[${idx}].MaxSalary" class="input-figma" style="width:100%; height:32px; font-size:13px; padding:0 8px !important;" min="0" /></td>
                <td>
                    <textarea name="DomesticPositions[${idx}].JobDescription" class="input-figma job-description-textarea" maxlength="2000" style="width:100%; min-height:42px; height:42px; font-size:12px; resize:vertical; padding:6px 8px;" placeholder="Nhập mô tả..."></textarea>
                </td>
                <td class="text-center"><button type="button" class="btn-figma btn-figma-danger btn-remove-row" style="height:28px; width:28px; padding:0; display:inline-flex; align-items:center; justify-content:center;"><i class="fas fa-trash-alt"></i></button></td>
            </tr>`;
            var $row = $(html); $('#domesticPositionTable tbody').append($row); this.initDropdowns($row); this.recalculateTotals();
        },

        addForeignRow: function () {
            var idx = ++this.foreignRowIndex;
            var html = `<tr data-row-index="${idx}">
                <td><select name="ForeignPositions[${idx}].PositionName" class="select-figma select2 position-dropdown" data-type="CAT_POSITION" style="width:100%;" required><option value="">-- Chọn --</option></select></td>
                <td><input type="number" name="ForeignPositions[${idx}].Quantity" class="input-figma foreign-quantity" style="width:100%; height:32px; font-size:13px; padding:0 4px !important; text-align:center;" min="1" value="1" required /></td>
                <td><select name="ForeignPositions[${idx}].Nationality" class="select-figma select2 country-dropdown" style="width:100%;" required><option value="">-- Chọn --</option></select></td>
                <td><select name="ForeignPositions[${idx}].WorkPermitType" class="select-figma select2 position-dropdown" data-type="CAT_WORKPERMIT" style="width:100%;" required><option value="">-- Chọn --</option></select></td>
                <td><select name="ForeignPositions[${idx}].SalaryCurrency" class="select-figma select2" style="width:100%; height:32px;" required><option value="VND">VNĐ</option><option value="USD">USD</option></select></td>
                <td><input type="number" name="ForeignPositions[${idx}].MinSalary" class="input-figma" style="width:100%; height:32px; font-size:13px; padding:0 8px !important;" min="0" required /></td>
                <td><input type="number" name="ForeignPositions[${idx}].MaxSalary" class="input-figma" style="width:100%; height:32px; font-size:13px; padding:0 8px !important;" min="0" /></td>
                <td>
                    <textarea name="ForeignPositions[${idx}].Expertise" class="input-figma expertise-textarea" maxlength="500" style="width:100%; min-height:42px; height:42px; font-size:12px; resize:vertical; padding:6px 8px;" placeholder="Nhập chuyên môn..." required></textarea>
                </td>
                <td class="text-center"><button type="button" class="btn-figma btn-figma-danger btn-remove-row" style="height:28px; width:28px; padding:0; display:inline-flex; align-items:center; justify-content:center;"><i class="fas fa-trash-alt"></i></button></td>
            </tr>`;
            var $row = $(html); $('#foreignPositionTable tbody').append($row); this.initDropdowns($row); this.recalculateTotals();
        },

        recalculateTotals: function () {
            var domQty = 0; $('.domestic-quantity:not(:disabled)').each(function () { domQty += parseInt($(this).val()) || 0; });
            var forQty = 0; $('.foreign-quantity:not(:disabled)').each(function () { forQty += parseInt($(this).val()) || 0; });
            $('#totalDomesticWorkers').text(domQty); $('#totalForeignWorkers').text(forQty); $('#totalWorkers').text(domQty + forQty);
        },

        check30PercentRule: function () {
            var scope = $('#scope').val();
            var totalWorkers = parseInt($('#totalCurrentWorkers').val()) || 0;
            var newForeignWorkers = 0; $('.foreign-quantity').each(function () { newForeignWorkers += parseInt($(this).val()) || 0; });

            if ((scope === 'Foreign' || scope === 'Both') && totalWorkers > 0) {
                var percentage = (newForeignWorkers / totalWorkers) * 100;
                if (percentage > 30) {
                    $('#warning30PercentContainer').html(`<div class="alert mt-3" style="background:#fef3c7; border:1px solid #fbbf24; color:#92400e; padding:12px 16px; border-radius:8px;"><i class="fas fa-exclamation-triangle mr-2"></i><strong>Cảnh báo:</strong> Tổng LĐNN muốn tuyển (${newForeignWorkers}) chiếm <strong>${percentage.toFixed(1)}%</strong> lao động DN.</div>`);
                } else $('#warning30PercentContainer').empty();
            } else $('#warning30PercentContainer').empty();
        },

        initCharacterCounters: function () {
            $(document).on('input', '.job-description-textarea, .expertise-textarea', function () {
                var length = $(this).val().length; var max = $(this).attr('maxlength') || 2000;
                $(this).siblings('.char-counter').text(length + '/' + max);
            });
        }
    };

    /**
     * MODULE: REVIEW (Officer Actions)
     * Handles Approve, Supplement Request, and Reject
     */
    const ReviewModule = {
        init: function () {
            this.$idField = $('#demandId');
            if (this.$idField.length === 0) return;

            this.id = this.$idField.val();
            this.initEvents();
        },

        initEvents: function () {
            var self = this;

            // Approve Action
            $('#btnApprove').on('click', function () {
                Swal.fire({
                    title: 'Xác nhận duyệt?',
                    text: "Mọi thông tin trong hồ sơ sẽ được xác nhận chính thức.",
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#10b981',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: 'Đồng ý duyệt',
                    cancelButtonText: 'Hủy'
                }).then((result) => {
                    if (result.isConfirmed) {
                        self.postAction('/NhuCauTuyenDung/Approve', { reviewNotes: '' });
                    }
                });
            });

            // Supplement Request
            $('#confirmSupplement').on('click', function () {
                const content = $('#supplementContent').val();
                if (!content) { toastr.warning('Vui lòng nhập nội dung yêu cầu'); return; }

                $(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>...');
                self.postAction('/NhuCauTuyenDung/RequestSupplement', { content: content });
            });

            // Reject action
            $('#confirmReject').on('click', function () {
                const reason = $('#rejectReason').val();
                if (!reason) { toastr.warning('Vui lòng nhập lý do từ chối'); return; }

                $(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>...');
                self.postAction('/NhuCauTuyenDung/Reject', { reason: reason });
            });
        },

        postAction: function (url, body) {
            const token = $('input[name="__RequestVerificationToken"]').val();

            fetch(`${url}/${this.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': token,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(body)
            })
                .then(res => res.json())
                .then(result => {
                    if (result.success) {
                        toastr.success(result.message);
                        setTimeout(() => window.location.reload(), 1000);
                    } else {
                        toastr.error(result.message);
                        $('.modal button').prop('disabled', false).html('Xác nhận');
                    }
                })
                .catch(err => {
                    console.error('Review action error:', err);
                    toastr.error('Lỗi hệ thống');
                    $('.modal button').prop('disabled', false).html('Xác nhận');
                });
        }
    };

    window.NhuCauTuyenDungAll = {
        removeFile: (idx) => {
            FormModule.files.splice(idx, 1);
            FormModule.renderFileList();
        },
        removeExistingFile: (id) => {
            Swal.fire({
                title: 'Xác nhận xóa file?',
                text: "File sẽ bị gỡ khỏi hồ sơ sau khi bạn nhấn Lưu thay đổi.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Đồng ý xóa',
                cancelButtonText: 'Hủy'
            }).then((result) => {
                if (result.isConfirmed) {
                    $(`#file-row-${id}`).remove();
                    window.NhuCauTuyenDungAll.reindexExistingFiles();
                    toastr.info('Đã đánh dấu xóa file');
                }
            });

        },

        /**
         * Ensures sequential indexing (Files[0], Files[1]) for existing files
         * to prevent gaps that break ASP.NET MVC list binding.
         */
        reindexExistingFiles: () => {
            $('#existingFileListBody tr').each(function (idx) {
                $(this).find('td:first').text(idx + 1);
                $(this).find('input[name^="Files["]').each(function () {
                    let oldName = $(this).attr('name');
                    let newName = oldName.replace(/Files\[\d+\]/, `Files[${idx}]`);
                    $(this).attr('name', newName);
                });
            });
        }
    };

    $(document).ready(function () {
        ManagementModule.init();
        FormModule.init();
        ReviewModule.init();
    });

})(jQuery);
