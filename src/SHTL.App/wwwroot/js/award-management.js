// Award Management JS
(function () {
    'use strict';

    // Robust fix for Select2 search focus in Bootstrap modals
    if ($.fn.modal && $.fn.modal.Constructor) {
        $.fn.modal.Constructor.prototype._enforceFocus = function () { };
    }

    let table;
    let deleteId = null;
    let deleteName = '';
    let editId = null;
    let enterprisesLoaded = false;
    let dashboardStatus = ''; // Track current status filter from dashboard

    // Track existing attachments
    let existingFiles = []; // Array of {id, fileName}

    // FontAwesome icon class per file extension
    function getFileIconClass(fileName) {
        if (!fileName) return 'fas fa-file-alt text-muted';
        var ext = (fileName.split('.').pop() || '').toLowerCase();
        var map = {
            'pdf':  'fas fa-file-pdf text-danger',
            'doc':  'fas fa-file-word text-primary',
            'docx': 'fas fa-file-word text-primary',
            'xls':  'fas fa-file-excel text-success',
            'xlsx': 'fas fa-file-excel text-success',
            'ppt':  'fas fa-file-powerpoint text-warning',
            'pptx': 'fas fa-file-powerpoint text-warning',
            'jpg':  'fas fa-file-image text-info',
            'jpeg': 'fas fa-file-image text-info',
            'png':  'fas fa-file-image text-info',
            'gif':  'fas fa-file-image text-info'
        };
        return map[ext] || 'fas fa-file-alt text-muted';
    }

    // Enum display mappings
    const rewardFieldLabels = (window.rewardEnums && window.rewardEnums.fields) || {};
    const rewardTypeLabels = (window.rewardEnums && window.rewardEnums.types) || {};
    const rewardLevelLabels = (window.rewardEnums && window.rewardEnums.levels) || {};

    const awardStatusLabels = {
        'DangThamDinh': 'Đang thẩm định',
        'DaPheDuyet': 'Đã phê duyệt',
        'DaTraoThuong': 'Đã trao thưởng',
        'TuChoi': 'Từ chối'
    };

    const awardStatusBadges = {
        'DangThamDinh': 'status-pill-warning',
        'DaPheDuyet': 'status-pill-success',
        'DaTraoThuong': 'status-pill-primary',
        'TuChoi': 'status-pill-danger'
    };

    const awardStatusIcons = {
        'DangThamDinh': 'fa-circle-notch fa-spin',
        'DaPheDuyet': 'fa-check-circle',
        'DaTraoThuong': 'fa-award',
        'TuChoi': 'fa-times-circle'
    };

    // Column index → backend sortBy field mapping
    var sortFieldMap = {
        1: 'enterpriseName',
        2: 'industrialZoneName',
        3: 'rewardField',
        4: 'rewardType',
        5: 'rewardLevel',
        6: 'decisionNumber',
        7: 'awardDate',
        8: 'departmentName',
        9: 'wfStatus'
    };

    $(document).ready(function () {
        initializeDataTable();
        initializeEventHandlers();
        updateDashboardStats(); // Initial stats load
    });

    /**
     * Initialize DataTable (server-side processing)
     */
    function initializeDataTable() {
        table = $('#awardsTable').dataTableFigma({
            serverSide: true,
            processing: true,
            ajax: {
                url: '/Awards/GetAll',
                type: 'GET',
                data: function (d) {
                    if (d.order && d.order.length > 0) {
                        var colIdx = d.order[0].column;
                        var dir = d.order[0].dir;
                        if (sortFieldMap[colIdx]) {
                            d.sortBy = sortFieldMap[colIdx];
                            d.sortOrder = dir;
                        }
                    }

                    delete d.columns;
                    delete d.search;
                    delete d.order;

                    // Search and Filters
                    d.searchTerm = $('#customSearchInput').val() || '';
                    d.field = $('#filterField').val() || '';
                    d.type = $('#filterType').val() || '';
                    d.level = $('#filterLevel').val() || '';
                    d.yearFrom = $('#filterYearFrom').val() || '';
                    d.yearTo = $('#filterYearTo').val() || '';
                    d.industrialZoneId = $('#filterIndustrialZone').val() || '';
                    d.departmentCode = $('#filterDepartment').val() || '';

                    // Apply status filter from dashboard cards
                    if (dashboardStatus) d.wfStatus = dashboardStatus;
                }
            },
            dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
            autoWidth: false,
            scrollX: false,
            order: [[7, 'desc']],
            searching: false,
            columns: [
                {
                    data: null,
                    width: '45px',
                    orderable: false,
                    searchable: false,
                    className: 'text-center',
                    render: function (data, type, row, meta) {
                        return meta.row + meta.settings._iDisplayStart + 1;
                    }
                },
                {
                    data: 'enterpriseName',
                    // Flexible width
                    render: function (data, type, row) {
                        return '<span style="color: #1a4b8c; font-weight: 600;">' + escapeHtml(data) + '</span>';
                    }
                },
                {
                    data: 'industrialZoneName',
                    width: '100px',
                    render: function (data) {
                        return data ? '<span style="color: #64748b;">' + escapeHtml(data) + '</span>' : '<span class="text-muted">—</span>';
                    }
                },
                {
                    data: 'rewardField',
                    width: '110px',
                    render: function (data) {
                        return rewardFieldLabels[data] || escapeHtml(data);
                    }
                },
                {
                    data: 'rewardType',
                    width: '120px',
                    render: function (data) {
                        return rewardTypeLabels[data] || escapeHtml(data);
                    }
                },
                {
                    data: 'rewardLevel',
                    width: '100px',
                    render: function (data) {
                        return rewardLevelLabels[data] || escapeHtml(data) || '—';
                    }
                },
                { 
                    data: 'decisionNumber',
                    width: '100px',
                    render: function (data) {
                        return data ? escapeHtml(data) : '—';
                    }
                },
                {
                    data: 'awardDate',
                    width: '85px',
                    className: 'text-center',
                    render: function (data) {
                        if (!data) return '';
                        const d = new Date(data);
                        return String(d.getDate()).padStart(2, '0') + '/' + 
                               String(d.getMonth() + 1).padStart(2, '0') + '/' + 
                               d.getFullYear();
                    }
                },
                {
                    data: 'departmentName',
                    width: '130px',
                    render: function (data) {
                        return data ? escapeHtml(data) : '<span class="text-muted">—</span>';
                    }
                },
                {
                    data: 'wfStatus',
                    width: '140px',
                    className: 'text-center',
                    render: function (data) {
                        const label = awardStatusLabels[data] || data || 'Chưa xác định';
                        const pillClass = awardStatusBadges[data] || 'status-pill-secondary';
                        const iconClass = awardStatusIcons[data] || 'fa-info-circle';
                        
                        return `<span class="status-pill ${pillClass}">
                                    <i class="fas ${iconClass}"></i> ${escapeHtml(label)}
                                </span>`;
                    }
                },
                {
                    data: null,
                    width: '100px',
                    orderable: false,
                    className: 'text-center',
                    render: function (data, type, row) {
                        let actions = '<div class="table-actions-figma" style="justify-content: center;">';
                        
                        if (window.userPermissions && window.userPermissions.canUpdate) {
                            actions += '<button type="button" class="btn-action-figma btn-action-edit btn-edit" data-id="' + row.id + '" title="Chỉnh sửa"><i class="fas fa-pen"></i></button>';
                        }
                        
                        if (window.userPermissions && window.userPermissions.canDelete) {
                            actions += '<button type="button" class="btn-action-figma btn-action-delete btn-delete" data-id="' + row.id + '" data-name="' + escapeHtml(row.enterpriseName) + '" title="Xóa"><i class="fas fa-trash-alt"></i></button>';
                        }
                        
                        actions += '</div>';
                        return actions;
                    }
                }
            ],
            drawCallback: function (settings) {
                if (typeof FigmaDataTables !== 'undefined' && FigmaDataTables.defaultConfig) {
                    FigmaDataTables.defaultConfig.drawCallback(settings);
                }

                var startIndex = settings._iDisplayStart;
                $(settings.nTable).find('tbody tr').each(function (i) {
                    if ($(this).find('td.dataTables_empty').length) return;
                    $(this).find('td:first-child').text(startIndex + i + 1);
                });

                $(settings.nTable).find('.btn-action-figma[title]').each(function () {
                    var $btn = $(this);
                    if (!$btn.data('bs.tooltip')) {
                        $btn.tooltip({ container: 'body', placement: 'bottom' });
                    }
                });

                var $container = $('.pagination-figma-container');
                if ($container.length && $('#paginationFrame').length) {
                    $container.appendTo('#paginationFrame');
                }
                
                var totalRecords = settings._iRecordsDisplay || 0;
                if (totalRecords === 0) {
                    $('#paginationFrame').hide();
                } else {
                    $('#paginationFrame').show();
                }
            }
        });

        // Search input: Handle Enter key
        $('#customSearchInput').on('keypress', function (e) {
            if (e.which === 13) {
                e.preventDefault();
                table.ajax.reload();
            }
        });

        const btnSearch = $('#btnSearch');
        const btnRefresh = $('#btnRefresh');

        initSelect2();

        // Clear search and filters
        btnRefresh.on('click', function () {
            $('#customSearchInput').val('');
            $('.filter-item select').val('').trigger('change'); // Trigger change for select2
            $('.filter-item input').val('');
            dashboardStatus = '';
            $('.card-figma-stat').removeClass('stat-active');
            table.ajax.reload();
        });

        // Main search button action
        btnSearch.on('click', function () {
            table.ajax.reload();
            
            // Auto-close advanced filter after searching (using class to avoid inline style conflict)
            $('#advancedFilterArea').removeClass('show');
            $('#btnToggleAdvancedFilter').removeClass('active');
        });

        // Toggle Advanced Filter
        $('#btnToggleAdvancedFilter').on('click', function () {
            $(this).toggleClass('active');
            $('#advancedFilterArea').toggleClass('show');
        });

        // REMOVED: Auto-reload on change to allow manual search only
        // $('#filterRewardField, #filterRewardType, #filterRewardLevel, #filterYearFrom, #filterYearTo, #filterDepartment, #filterIndustrialZone').on('change', function () {
        //     table.ajax.reload();
        // });
    }

    function initializeEventHandlers() {
        $('#btnAddAward').on('click', function () {
            editId = null;
            resetForm();
            $('#awardModalTitle').html('<i class="fas fa-award mr-2"></i>Thêm khen thưởng mới');
            $('#awardEnterpriseId').prop('disabled', false);
            loadEnterprisesToSelect();
            $('#awardModal').modal('show');
        });

        // Use standard event delegation like Violation
        $('#awardsTable').on('click', '.btn-edit', handleEditClick);
        $('#awardsTable').on('click', '.btn-delete', handleDeleteClick);
        
        // Dashboard cards click handlers (SINGLE source of truth)
        $('.card-figma-stat').on('click', function () {
            const status = $(this).data('status') || '';
            
            // Toggle active state
            if ($(this).hasClass('stat-active')) {
                $(this).removeClass('stat-active');
                dashboardStatus = '';
            } else {
                $('.card-figma-stat').removeClass('stat-active');
                $(this).addClass('stat-active');
                dashboardStatus = status;
            }
            
            table.ajax.reload();
        });

        $(document).on('click', '.btn-preview-file', function(e) {
            e.preventDefault();
            const id = $(this).data('id');
            const name = $(this).data('name');
            openFilePreview(id, name);
        });
        
        $('#btnConfirmDelete').off('click').on('click', handleConfirmDelete);
        $('#btnSaveAward').on('click', handleSave);

        // Gán sự kiện xóa file đính kèm cũ
        $('#existingAttachmentList').on('click', '.btn-remove-attachment', handleRemoveExistingFile);

        // Toggle "Other" fields - REMOVED or UPDATED if needed
        // The modernized version doesn't have "Other" text fields yet, 
        // but keeping logic if categories match
        $('#awardField').on('change', function () {
            if ($(this).val() === 'Khac') {
                $('#rewardFieldOtherContainer').slideDown();
                $('#awardFieldOther').prop('required', true);
            } else {
                $('#rewardFieldOtherContainer').slideUp();
                $('#awardFieldOther').prop('required', false).val('');
            }
        });

        $('#awardType').on('change', function () {
            if ($(this).val() === 'Khac') {
                $('#rewardTypeOtherContainer').slideDown();
                $('#awardTypeOther').prop('required', true);
            } else {
                $('#rewardTypeOtherContainer').slideUp();
                $('#awardTypeOther').prop('required', false).val('');
            }
        });

        // Global listener for modal shown to init Select2 properly
        $('#awardModal').on('shown.bs.modal', function() {
            initSelect2('#awardModal');
        });
    }

    function loadEnterprisesToSelect(callback) {
        if (enterprisesLoaded) {
            if (callback) callback();
            return;
        }
        $.get('/Awards/GetEnterprises', function (data) {
            let $select = $('#awardEnterpriseId');
            $select.find('option:not(:first)').remove();
            if (data && data.length > 0) {
                data.forEach(function (e) {
                    $select.append('<option value="' + e.id + '">' + escapeHtml(e.name) + ' (' + escapeHtml(e.taxCode) + ')</option>');
                });
                enterprisesLoaded = true;
            }
            if (callback) callback();
        }).fail(function() {
            console.error('Không thể tải danh sách doanh nghiệp');
            if (callback) callback(); // Still call callback to allow showing other fields
        });
    }

    function handleEditClick() {
        var id = $(this).data('id');
        editId = id;
        resetForm();
        
        $('#awardModalTitle').html('<i class="fas fa-award mr-2"></i>Chỉnh sửa khen thưởng');
        $('#awardEnterpriseId').prop('disabled', true);
        
        loadEnterprisesToSelect(function () {
            $.get('/Awards/GetById?id=' + id, function (data) {
                console.log('Award Data Received:', data);
                if (data.error) {
                    toastr.error(data.error, 'Lỗi');
                    return;
                }
                
                $('#formAwardId').val(data.id);
                $('#awardEnterpriseId').val(data.enterpriseId).trigger('change');
                $('#awardField').val(data.rewardField).trigger('change');
                $('#awardType').val(data.rewardType).trigger('change');
                $('#awardLevel').val(data.rewardLevel).trigger('change');
                $('#awardDecisionNumber').val(data.decisionNumber);
                $('#awardDecisionDate').val(formatDateForInput(data.awardDate));
                $('#awardOrganization').val(data.organization);
                $('#awardContent').val(data.reason);
                $('#awardDepartmentName').val(data.departmentName);
                $('#awardDepartmentCode').val(data.departmentCode);
                $('#awardNotes').val(data.notes);

                if (data.rewardField === 'Khac') {
                    $('#awardFieldOther').val(data.rewardFieldOther);
                    $('#rewardFieldOtherContainer').show();
                }
                if (data.rewardType === 'Khac') {
                    $('#awardTypeOther').val(data.rewardTypeOther);
                    $('#rewardTypeOtherContainer').show();
                }

                if (data.fileId && data.fileName) {
                    existingFiles = [{ id: data.fileId, fileName: data.fileName }];
                    renderExistingFiles();
                }

                $('#awardModal').modal('show');
            }).fail(function() {
                toastr.error('Không thể kết nối đến máy chủ để lấy thông tin.', 'Lỗi');
            });
        });
    }

    function renderExistingFiles() {
        let $list = $('#existingAttachmentList').empty();
        
        existingFiles.forEach(function(file, idx) {
            let iconClass = getFileIconClass(file.fileName);
            let html = `
            <div class="d-flex align-items-center py-1 px-2 mb-1 rounded" style="background:#f8f9fa; border:1px solid #e9ecef;">
                <i class="${iconClass} fa-lg mr-2 flex-shrink-0"></i>
                <div class="flex-grow-1 text-truncate">
                    <button type="button" class="btn btn-link p-0 text-dark font-weight-bold small btn-preview-file" 
                            data-id="${file.id}" data-name="${escapeHtml(file.fileName)}" title="Xem tệp">
                        ${escapeHtml(file.fileName)}
                    </button>
                </div>
                <div class="ml-2 flex-shrink-0">
                    <button type="button" class="btn btn-sm btn-link text-danger btn-remove-attachment" data-id="${file.id}" title="Gỡ file này">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>`;
            $list.append(html);
        });
        $('#existingAttachmentSection').toggle(existingFiles.length > 0);
    }

    function handleRemoveExistingFile() {
        const id = $(this).data('id');
        existingFiles = existingFiles.filter(f => f.id !== id);
        renderExistingFiles();
    }

    // Initialize Select2 for all styled dropdowns
    function initSelect2(parentSelector) {
        if ($.fn.select2) {
            var $elements = parentSelector ? $(parentSelector).find('.select2') : $('.select2');
            
            $elements.each(function() {
                var $this = $(this);
                var placeholderText = $this.data('placeholder') || 'Chọn giá trị...';
                
                var config = {
                    theme: 'bootstrap4',
                    allowClear: true,
                    placeholder: placeholderText,
                    width: '100%'
                };
                
                if (parentSelector) {
                    // Use modal-content or modal-body if available to bypass pointer-events: none on .modal
                    var $parent = $(parentSelector);
                    var $dropdownParent = $parent.find('.modal-content-figma');
                    if ($dropdownParent.length === 0) $dropdownParent = $parent.find('.modal-content');
                    if ($dropdownParent.length === 0) $dropdownParent = $parent.find('.modal-body');
                    
                    config.dropdownParent = $dropdownParent.length > 0 ? $dropdownParent : $parent;
                }
                
                $this.select2(config);
            });
        }
    }

    function handleDeleteClick() {
        deleteId = $(this).data('id');
        deleteName = $(this).data('name');
        $('#deleteAwardName').text(deleteName);
        $('#deleteAwardId').val(deleteId);
        $('#deleteModal').modal('show');
    }

    function handleConfirmDelete() {
        var $btn = $('#btnConfirmDelete');
        var originalHtml = $btn.html();
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xóa...');

        $.post('/Awards/Delete/' + deleteId, {
            __RequestVerificationToken: $('input[name="__RequestVerificationToken"]').val()
        }, function (response) {
            if (response.isSuccess) {
                $('#deleteModal').modal('hide');
                table.ajax.reload();
                updateDashboardStats();
                toastr.success(response.message || 'Xóa thành công', 'Thành công');
            } else {
                toastr.error(response.message || 'Không thể xóa', 'Lỗi');
            }
            $btn.prop('disabled', false).html(originalHtml);
        });
    }

    function handleSave() {
        var form = document.getElementById('awardForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        var $btn = $('#btnSaveAward');
        var originalHtml = $btn.html();
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang lưu...');

        var token = $('input[name="__RequestVerificationToken"]').val();
        var isEdit = editId !== null;
        var fd = new FormData(form);

        if (isEdit) {
            if (existingFiles.length > 0) {
                fd.append('ExistingFileId', existingFiles[0].id);
            } else {
                fd.append('RemoveExistingFile', 'true');
            }
        }

        if (window.awardUploader) {
            window.awardUploader.getFiles().forEach(function (f) {
                fd.append('AttachmentFiles', f);
            });
        }

        var url = isEdit ? '/Awards/Update/' + editId : '/Awards/Create';
        
        $.ajax({
            url: url,
            type: 'POST',
            data: fd,
            contentType: false,
            processData: false,
            headers: { 'RequestVerificationToken': token },
            success: function (response) {
                if (response.isSuccess) {
                    $('#awardModal').modal('hide');
                    table.ajax.reload();
                    updateDashboardStats();
                    toastr.success(response.message || (isEdit ? 'Cập nhật thành công' : 'Thêm mới thành công'), 'Thành công');
                } else {
                    toastr.error(response.message || 'Không thể lưu', 'Lỗi');
                    // Display detailed validation errors if any
                    if (response.errors && response.errors.length > 0) {
                        response.errors.forEach(function (err) {
                            toastr.warning(err, 'Yêu cầu sửa đổi');
                        });
                    }
                }
                $btn.prop('disabled', false).html(originalHtml);
            },
            error: function () {
                toastr.error('Đã xảy ra lỗi hệ thống khi lưu dữ liệu.', 'Lỗi');
                $btn.prop('disabled', false).html(originalHtml);
            }
        });
    }

    function openFilePreview(fileId, fileName) {
        if (!fileId) return;

        $('#awardPreviewFileName').text(fileName);
        $('#awardPreviewLoading').show();
        $('#awardPreviewFrame').hide();
        $('#awardPreviewUnsupported').hide();
        
        const isStacked = $('#awardModal').hasClass('show');
        if (isStacked) $('#awardModal').data('_stacked', true);

        $('#awardFilePreviewModal').modal('show');

        const downloadUrl = `/FileManager/Download?id=${fileId}`;
        $('#awardPreviewDownloadBtn, #awardPreviewUnsupportedLink').attr('href', downloadUrl);

        const ext = (fileName.split('.').pop() || '').toLowerCase();
        const viewableExts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'txt'];

        if (viewableExts.includes(ext)) {
            // Get secure preview URL from FileManager (consistency with Violation)
            $.ajax({
                url: '/FileManager/GetPreviewUrl?id=' + fileId,
                type: 'GET',
                success: function (res) {
                    if (res.success && res.url) {
                        $('#awardPreviewFrame').attr('src', res.url).on('load', function() {
                            $('#awardPreviewLoading').hide();
                            $(this).show();
                        });
                    } else {
                        $('#awardPreviewLoading').hide();
                        $('#awardPreviewUnsupported').show();
                    }
                },
                error: function () {
                    $('#awardPreviewLoading').hide();
                    $('#awardPreviewUnsupported').show();
                }
            });
        } else {
            $('#awardPreviewLoading').hide();
            $('#awardPreviewUnsupported').show();
        }
    }

    function resetForm() {
        var form = document.getElementById('awardForm');
        form.reset();
        $('#formAwardId').val('');
        $('.select2').val('').trigger('change'); // Reset all select2 in form
        if (window.awardUploader) window.awardUploader.clear();
        $('#existingAttachmentSection').hide();
        $('#existingAttachmentList').empty();
        $('#rewardFieldOtherContainer, #rewardTypeOtherContainer').hide();
        $('#awardFieldOther, #awardTypeOther').prop('required', false);
        existingFiles = [];
        $('#awardModal').data('_stacked', false);
    }

    function formatDate(date) {
        if (!date) return '';
        var d = new Date(date);
        var day = d.getDate().toString().padStart(2, '0');
        var month = (d.getMonth() + 1).toString().padStart(2, '0');
        var year = d.getFullYear();
        return day + '/' + month + '/' + year;
    }

    function formatDateForInput(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        var year = d.getFullYear();
        var month = ('0' + (d.getMonth() + 1)).slice(-2);
        var day = ('0' + d.getDate()).slice(-2);
        return year + '-' + month + '-' + day;
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function updateDashboardStats() {
        $.ajax({
            url: '/Awards/GetStatistics',
            type: 'GET',
            success: function (response) {
                if (response.isSuccess && response.data) {
                    const stats = response.data;
                    $('#statTotalCount').text(stats.totalCount || 0);
                    $('#statDangThamDinh').text(stats.dangThamDinhCount || 0);
                    $('#statDaPheDuyet').text(stats.daPheDuyetCount || 0);
                    $('#statDaTraoThuong').text(stats.daTraoThuongCount || 0);
                    $('#statTuChoi').text(stats.tuChoiCount || 0);
                }
            },
            error: function (err) {
                console.error('Error loading dashboard stats:', err);
            }
        });
    }

    /**
     * Export awards to Excel with current filters
     */
    function exportToExcel() {
        var $btn = $('#btnExportExcel');
        var originalHtml = $btn.html();

        // Disable button and show loading
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xuất...');

        try {
            // Build query parameters from current filters
            var params = [];

            // Search term
            var searchTerm = $('#customSearchInput').val();
            if (searchTerm) {
                params.push('searchTerm=' + encodeURIComponent(searchTerm));
            }

            // Status filter from dashboard
            if (dashboardStatus) {
                params.push('wfStatus=' + encodeURIComponent(dashboardStatus));
            }

            // Advanced filters
            var field = $('#filterField').val();
            if (field) {
                params.push('field=' + encodeURIComponent(field));
            }

            var type = $('#filterType').val();
            if (type) {
                params.push('type=' + encodeURIComponent(type));
            }

            var level = $('#filterLevel').val();
            if (level) {
                params.push('level=' + encodeURIComponent(level));
            }

            var yearFrom = $('#filterYearFrom').val();
            if (yearFrom) {
                params.push('yearFrom=' + encodeURIComponent(yearFrom));
            }

            var yearTo = $('#filterYearTo').val();
            if (yearTo) {
                params.push('yearTo=' + encodeURIComponent(yearTo));
            }

            var industrialZoneId = $('#filterIndustrialZone').val();
            if (industrialZoneId) {
                params.push('industrialZoneId=' + encodeURIComponent(industrialZoneId));
            }

            var departmentCode = $('#filterDepartment').val();
            if (departmentCode) {
                params.push('departmentCode=' + encodeURIComponent(departmentCode));
            }

            // Build URL
            var url = '/Awards/Export';
            if (params.length > 0) {
                url += '?' + params.join('&');
            }

            // Create a temporary link and trigger download
            var link = document.createElement('a');
            link.href = url;
            link.download = 'DanhSachKhenThuong.xlsx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Show success message
            toastr.success('Đang tải xuống file Excel...', 'Thành công');

        } catch (error) {
            console.error('Export error:', error);
            toastr.error('Có lỗi xảy ra khi xuất dữ liệu', 'Lỗi');
        } finally {
            // Re-enable button after a short delay
            setTimeout(function() {
                $btn.prop('disabled', false).html(originalHtml);
            }, 1000);
        }
    }

})();
