/**
 * ProfileType Management JavaScript
 */

// Variables will be initialized from window within functions to avoid timing issues
let _dynamicListCategories = {};

$(document).ready(function () {
    const currentPath = window.location.pathname.toLowerCase();

    // Check if we're on the Index page
    if (currentPath.includes('/profiletype') && !currentPath.includes('/create') && !currentPath.includes('/edit')) {
        initializeIndex();
    }

    // Check if we're on the Create or Edit page
    if (currentPath.includes('/create') || currentPath.includes('/edit')) {
        initializeForm();
    }
});

// ========== Index Page Functions ==========

function initializeIndex() {
    // Initialize data from window
    const _dynamicListCategories = window.dynamicListCategories || {};

    let table;
    let deleteId = null;
    let deleteName = '';

    // --- Select2 Initialization ---
    function initSelect2(selector) {
        $(selector).each(function () {
            var $this = $(this);
            $this.select2({
                theme: 'bootstrap4',
                width: '100%',
                placeholder: $this.data('placeholder') || '-- Chọn giá trị --',
                allowClear: true,
                language: {
                    noResults: function () { return "Không tìm thấy kết quả"; }
                }
            });
        });
    }

    $(document).ready(function () {
        initSelect2('.select2-modern');
        initializeDataTable();
        initializeEventHandlers();
    });

    /**
     * Initialize DataTable for profile types
     */
    function initializeDataTable() {
        table = $('#profileTypesTable').dataTableFigma({
            searching: false, // Ẩn ô tìm kiếm mặc định vì đã có ô tìm kiếm tùy chỉnh
            ajax: {
                url: '/ProfileType/GetAll',
                data: function (d) {
                    d.isActive = $('#filterStatus').val();
                    d.searchTerm = $('#customSearchInput').val();
                    return d;
                },
                dataSrc: 'data'
            },
            columns: [
                {
                    data: null,
                    orderable: false,
                    searchable: false,
                    className: 'text-center',
                    defaultContent: ''
                },
                {
                    data: 'code',
                    render: function (data) { return `<strong>${escapeHtml(data)}</strong>`; }
                },
                {
                    data: 'name',
                    render: function (data) { return escapeHtml(data); }
                },
                {
                    data: 'metadataFields',
                    className: 'text-center',
                    render: function (data) {
                        return data ? `<span class="badge-figma badge-figma-primary" style="min-width: 30px;">${data.length}</span>` : '0';
                    }
                },
                {
                    data: 'isActive',
                    className: 'text-center',
                    render: function (data) {
                        return FigmaDataTables.renderStatusDot(data);
                    }
                },
                {
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    render: function (data, type, row) {
                        let html = '<div class="table-actions-figma" style="justify-content: center;">';

                        // View action
                        html += `<a href="/ProfileType/Edit/${row.id}?readonly_mode=true" class="btn-action-figma btn-action-view" title="Xem chi tiết"><i class="fas fa-eye"></i></a>`;

                        if (window.canUpdate) {
                            html += `<a href="/ProfileType/Edit/${row.id}" class="btn-action-figma btn-action-edit" title="Chỉnh sửa"><i class="fas fa-pen"></i></a>`;
                        }

                        if (window.canDelete) {
                            html += `<button type="button" class="btn-action-figma btn-action-delete btn-delete" data-id="${row.id}" data-name="${escapeHtml(row.name)}" title="Xóa"><i class="fas fa-trash-alt"></i></button>`;
                        }

                        html += '</div>';
                        return html;
                    }
                }
            ],
            drawCallback: function (settings) {
                // Call default figma DrawCallback
                FigmaDataTables.defaultConfig.drawCallback(settings);

                // Ensure pagination is in #paginationFrame
                const $container = $('.pagination-figma-container');
                if ($container.length && $('#paginationFrame').length) {
                    $container.appendTo('#paginationFrame');
                }

                // Render STT
                var api = this.api();
                var startIndex = api.context[0]._iDisplayStart;
                api.column(0, { page: 'current' }).nodes().each(function (cell, i) {
                    cell.innerHTML = startIndex + i + 1;
                });
            }
        });
    }

    /**
     * Initialize all event handlers
     */
    function initializeEventHandlers() {
        // Search button
        $('#btnSearch').click(function () {
            table.ajax.reload();
        });

        // Enter key to search
        $('#customSearchInput').on('keyup', function (e) {
            if (e.key === 'Enter') {
                table.ajax.reload();
            }
        });

        // Status filter
        $('#filterStatus').on('change', function () {
            table.ajax.reload();
        });

        // Refresh table
        $('#btnRefreshTable').click(function () {
            table.ajax.reload();
            toastr.info('Đang làm mới dữ liệu...');
        });

        // Delete button
        $('#profileTypesTable').on('click', '.btn-delete', function () {
            deleteId = $(this).data('id');
            deleteName = $(this).data('name');
            $('#deleteItemName').text(deleteName);
            $('#deleteModal').modal('show');
        });

        // Confirm delete
        $('#btnConfirmDelete').click(function () {
            if (!deleteId) return;

            const $btn = $(this);
            const originalHtml = $btn.html();
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xóa...');

            $.ajax({
                url: `/ProfileType/Delete/${deleteId}`,
                type: 'DELETE',
                success: function (response) {
                    toastr.success(`Đã xóa loại hồ sơ "${deleteName}" thành công!`);
                    $('#deleteModal').modal('hide');
                    table.ajax.reload();
                },
                error: function (xhr) {
                    const message = xhr.responseJSON?.message || 'Không thể xóa loại hồ sơ';
                    toastr.error(message, 'Lỗi');
                },
                complete: function () {
                    $btn.prop('disabled', false).html(originalHtml);
                    deleteId = null;
                }
            });
        });
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, function (m) { return map[m]; });
    }
}

// ========== Create/Edit Form Functions ==========

function initializeForm() {
    // Initialize data from window
    _dynamicListCategories = window.dynamicListCategories || {};

    let fieldCounter = 0;
    let isSubmitting = false;
    const isReadOnlyMode = $('#isReadOnlyMode').val() === 'true';

    // Khởi tạo Select2 cho các trường chính trong form
    $('.select2-modern').select2({
        theme: 'bootstrap4',
        width: '100%',
        placeholder: '-- Chọn giá trị --',
        allowClear: true
    });

    // Event listeners will be bound here first...

    // Validate code uniqueness on blur (for both Create and Edit)
    $('#code').on('blur', function () {
        const code = $(this).val().trim();
        const originalCode = $('#originalCode').val(); // Will be empty for Create mode

        if (!code) return;

        // Skip validation if code hasn't changed in Edit mode
        if (originalCode && code === originalCode) {
            $(this).removeClass('is-invalid');
            return;
        }

        // Check if code exists via API
        $.ajax({
            url: '/ProfileType/GetAll',
            type: 'GET',
            data: { searchTerm: code, pageSize: 1000 },
            success: function (response) {
                const exists = response.data && response.data.some(pt => pt.code.toLowerCase() === code.toLowerCase());

                if (exists) {
                    $('#code').addClass('is-invalid');
                    toastr.error(`Mã "${code}" đã tồn tại. Vui lòng sử dụng mã khác.`, 'Lỗi Validation');
                } else {
                    $('#code').removeClass('is-invalid');
                }
            },
            error: function () {
                console.error('Error checking code uniqueness');
            }
        });
    });

    // Add metadata field button
    $('#btnAddMetadataField').click(function () {
        addMetadataFieldRow();
    });

    // Remove metadata field button (delegated event)
    $('#metadataFieldsBody').on('click', '.btn-remove-field', function () {
        if (!isReadOnlyMode) {
            $(this).closest('tr').remove();
        }
    });

    // Form submit
    $('#profileTypeForm').on('submit', function (e) {
        e.preventDefault();

        if (isSubmitting || isReadOnlyMode) return;

        if (!this.checkValidity()) {
            this.reportValidity();
            return;
        }

        // Check if code has validation error
        if ($('#code').hasClass('is-invalid')) {
            toastr.error('Vui lòng sửa lỗi mã trước khi lưu', 'Lỗi Validation');
            return;
        }

        try {
            const profileTypeId = $('#profileTypeId').val();
            if (profileTypeId) {
                updateProfileType(profileTypeId);
            } else {
                createProfileType();
            }
        } catch (err) {
            console.error('Submit error:', err);
            isSubmitting = false;
            toastr.error('Đã xảy ra lỗi khi xử lý dữ liệu', 'Lỗi');
        }
    });

    function addMetadataFieldRow(field = null) {
        // Xóa dòng thông báo "Chưa có dữ liệu" nếu có
        const $emptyRow = $('#metadataFieldsBody tr').filter(function () {
            return $(this).find('td[colspan]').length > 0;
        });
        if ($emptyRow.length) $emptyRow.remove();

        fieldCounter++;
        const fieldId = field?.id || null;
        const rowId = `field-${fieldCounter}`;

        // Determine which extra field value to use
        let extraInputValue = '';
        let extraSelectValue = '';

        if (field) {
            const dataType = field.dataType;
            if (dataType === 'Text' || dataType === 'TextArea' || dataType === 'Date') {
                extraInputValue = field.validationPattern || '';
            } else if (dataType === 'Select' || dataType === 'MultiSelect') {
                // listOptions could be string (category ID) or SelectOptions
                extraSelectValue = field.listOptions || field.selectOptions || '';
            }
        }

        // Get dynamic list categories options for Select/MultiSelect fields
        const dynamicListOptions = getDynamicListCategoriesHTML(extraSelectValue);

        const row = `<tr id="${rowId}" data-field-id="${fieldId || ''}" class="align-middle">
            <td><input type="text" class="input-figma input-figma-sm field-label" value="${field?.displayLabel || ''}" ${isReadOnlyMode ? 'disabled' : ''} required /></td>
            <td><input type="text" class="input-figma input-figma-sm field-name" value="${field?.fieldName || ''}" ${isReadOnlyMode ? 'disabled' : ''} required /></td>
            <td>
                <select class="input-figma input-figma-sm field-datatype select2-in-table" ${isReadOnlyMode ? 'disabled' : ''} required>
                    ${getDataTypeOptionsHTML(field?.dataType)}
                </select>
            </td>
            <td class="field-extra-container">
                <input type="text" class="input-figma input-figma-sm field-extra-input" 
                       value="${extraInputValue}" 
                       placeholder="Regex/Format" 
                       ${isReadOnlyMode ? 'disabled' : ''}
                       style="display: none;" />
                <select class="input-figma input-figma-sm field-extra-select select2-in-table" ${isReadOnlyMode ? 'disabled' : ''} style="display: none;">
                    ${dynamicListOptions}
                </select>
            </td>
            <td><input type="text" class="input-figma input-figma-sm field-placeholder" value="${field?.placeholder || ''}" ${isReadOnlyMode ? 'disabled' : ''} placeholder="Nhập placeholder..." /></td>
            <td class="text-center">
                <div class="custom-control custom-checkbox d-inline-block">
                    <input type="checkbox" class="custom-control-input field-visible" id="vis-${rowId}" ${field?.isVisibleInList !== false ? 'checked' : ''} ${isReadOnlyMode ? 'disabled' : ''} />
                    <label class="custom-control-label" for="vis-${rowId}"></label>
                </div>
            </td>
            <td class="text-center">
                <div class="custom-control custom-checkbox d-inline-block">
                    <input type="checkbox" class="custom-control-input field-required" id="req-${rowId}" ${field?.isRequired ? 'checked' : ''} ${isReadOnlyMode ? 'disabled' : ''} />
                    <label class="custom-control-label" for="req-${rowId}"></label>
                </div>
            </td>
            <td class="text-center">
                <div class="custom-control custom-checkbox d-inline-block">
                    <input type="checkbox" class="custom-control-input field-searchable" id="search-${rowId}" ${field?.isSearchable ? 'checked' : ''} ${isReadOnlyMode ? 'disabled' : ''} />
                    <label class="custom-control-label" for="search-${rowId}"></label>
                </div>
            </td>
            <td><input type="number" class="input-figma input-figma-sm field-minlen" value="${field?.minLength || ''}" ${isReadOnlyMode ? 'disabled' : ''} /></td>
            <td><input type="number" class="input-figma input-figma-sm field-maxlen" value="${field?.maxLength || ''}" ${isReadOnlyMode ? 'disabled' : ''} /></td>
            <td><input type="number" step="any" class="input-figma input-figma-sm field-minval" value="${field?.minValue || ''}" ${isReadOnlyMode ? 'disabled' : ''} /></td>
            <td><input type="number" step="any" class="input-figma input-figma-sm field-maxval" value="${field?.maxValue || ''}" ${isReadOnlyMode ? 'disabled' : ''} /></td>
            <td><input type="number" class="input-figma input-figma-sm field-order" value="${field?.displayOrder || fieldCounter}" ${isReadOnlyMode ? 'disabled' : ''} /></td>
            <td class="text-center">
                ${!isReadOnlyMode ? `<button type="button" class="btn-action-figma btn-action-delete btn-remove-field" style="width: 28px; height: 28px;" title="Xóa">
                    <i class="fas fa-trash-alt"></i>
                </button>` : ''}
            </td>
        </tr>`;

        $('#metadataFieldsBody').append(row);

        // Khởi tạo Select2 cho các dropdown trong bảng
        $(`#${rowId} .select2-in-table`).select2({
            theme: 'bootstrap4',
            width: '100%',
            dropdownAutoWidth: true
        });

        // Trigger initial validation state for the new row after a short delay to ensure DOM is ready
        setTimeout(() => {
            $(`#${rowId} .field-datatype`).trigger('change');
        }, 10);
    }

    // Handle DataType change to enable/disable relevant validation fields and toggle input/select
    $('#metadataFieldsBody').on('change', '.field-datatype', function () {
        const row = $(this).closest('tr');
        const type = $(this).val();

        // Get the extra field container
        const $extraInput = row.find('.field-extra-input');
        const $extraSelect = row.find('.field-extra-select');
        const $extraSelect2 = $extraSelect.next('.select2-container');

        // Reset state - hide and disable both
        $extraInput.hide().prop('disabled', true);
        $extraSelect.hide().prop('disabled', true);
        $extraSelect2.hide();

        row.find('.field-minlen, .field-maxlen, .field-minval, .field-maxval').prop('disabled', true);

        if (type === 'Text' || type === 'TextArea') {
            row.find('.field-minlen, .field-maxlen').prop('disabled', false);
            $extraInput.show().prop('disabled', false).attr('placeholder', 'Regex pattern (vd: [0-9]+)');
        } else if (type === 'Number' || type === 'Decimal') {
            row.find('.field-minval, .field-maxval').prop('disabled', false);
        } else if (type === 'Date') {
            $extraInput.show().prop('disabled', false).attr('placeholder', 'Định dạng (vd: dd/MM/yyyy)');
        } else if (type === 'Select' || type === 'MultiSelect') {
            // Show select dropdown and its Select2 container
            $extraSelect.show().prop('disabled', false);
            $extraSelect2.show();
        } else {
            // For other built-in lookup types (Departments, Warehouses, etc.)
            // We just keep extra fields hidden as they use fixed sources
        }
    });

    /**
     * Get HTML for DataType options from window.metadataFieldTypes
     */
    function getDataTypeOptionsHTML(selectedValue) {
        const types = window.metadataFieldTypes || [
            { id: 'Text', name: 'Chữ' },
            { id: 'TextArea', name: 'Text Area' },
            { id: 'Number', name: 'Số nguyên' },
            { id: 'Decimal', name: 'Số thập phân' },
            { id: 'Date', name: 'Ngày tháng' },
            { id: 'Boolean', name: 'Đúng/Sai' },
            { id: 'Select', name: 'Danh mục động' },
            { id: 'MultiSelect', name: 'Chọn nhiều giá trị' }
        ];

        return types.map(t => `<option value="${t.id}" ${selectedValue === t.id ? 'selected' : ''}>${t.name}</option>`).join('');
    }

    // Validate Min Length <= Max Length
    $('#metadataFieldsBody').on('blur', '.field-minlen, .field-maxlen', function () {
        const row = $(this).closest('tr');
        const minLen = parseInt(row.find('.field-minlen').val()) || 0;
        const maxLen = parseInt(row.find('.field-maxlen').val()) || 0;

        if (minLen > 0 && maxLen > 0 && minLen > maxLen) {
            toastr.error('Min Length không được lớn hơn Max Length', 'Lỗi Validation');
            $(this).addClass('is-invalid');
        } else {
            row.find('.field-minlen, .field-maxlen').removeClass('is-invalid');
        }
    });

    // Validate Min Value <= Max Value
    $('#metadataFieldsBody').on('blur', '.field-minval, .field-maxval', function () {
        const row = $(this).closest('tr');
        const minVal = parseFloat(row.find('.field-minval').val()) || 0;
        const maxVal = parseFloat(row.find('.field-maxval').val()) || 0;

        if (minVal !== 0 && maxVal !== 0 && minVal > maxVal) {
            toastr.error('Min Value không được lớn hơn Max Value', 'Lỗi Validation');
            $(this).addClass('is-invalid');
        } else {
            row.find('.field-minval, .field-maxval').removeClass('is-invalid');
        }
    });

    function getDynamicListCategoriesHTML(selectedValue = null) {
        let html = '<option value="">-- Chọn danh mục động --</option>';

        // Convert selectedValue to string for comparison
        const selectedStr = selectedValue ? String(selectedValue) : '';

        // Convert object to array and sort by name
        const categories = Object.entries(_dynamicListCategories).sort((a, b) => a[1].localeCompare(b[1]));

        categories.forEach(([id, name]) => {
            const selected = String(id) === selectedStr ? 'selected' : '';
            html += `<option value="${id}" ${selected}>${name}</option>`;
        });

        return html;
    }

    function collectFormData() {
        const metadataFields = [];
        const fieldNames = new Set();
        let hasDuplicate = false;
        let hasValidationError = false;

        $('#metadataFieldsBody tr').each(function () {
            const row = $(this);
            
            // Skip placeholder rows or rows without inputs
            const $nameInput = row.find('.field-name');
            if ($nameInput.length === 0) return;

            const fieldId = row.data('field-id');
            const dataType = row.find('.field-datatype').val();
            const fieldName = ($nameInput.val() || '').trim();

            // Validate unique fieldName
            if (fieldName) {
                if (fieldNames.has(fieldName.toLowerCase())) {
                    toastr.error(`Mã trường "${fieldName}" bị trùng lặp. Mỗi trường phải có mã duy nhất.`, 'Lỗi Validation');
                    $nameInput.addClass('is-invalid');
                    hasDuplicate = true;
                } else {
                    fieldNames.add(fieldName.toLowerCase());
                    $nameInput.removeClass('is-invalid');
                }
            }

            // Validate Min/Max Length
            const minLen = parseInt(row.find('.field-minlen').val()) || 0;
            const maxLen = parseInt(row.find('.field-maxlen').val()) || 0;
            if (minLen > 0 && maxLen > 0 && minLen > maxLen) {
                toastr.error(`Trường "${fieldName}": Min Length không được lớn hơn Max Length`, 'Lỗi Validation');
                row.find('.field-minlen, .field-maxlen').addClass('is-invalid');
                hasValidationError = true;
            }

            // Validate Min/Max Value
            const minVal = parseFloat(row.find('.field-minval').val()) || 0;
            const maxVal = parseFloat(row.find('.field-maxval').val()) || 0;
            if (minVal !== 0 && maxVal !== 0 && minVal > maxVal) {
                toastr.error(`Trường "${fieldName}": Min Value không được lớn hơn Max Value`, 'Lỗi Validation');
                row.find('.field-minval, .field-maxval').addClass('is-invalid');
                hasValidationError = true;
            }

            // Get the appropriate extra value based on whether input or select is visible
            const $extraInput = row.find('.field-extra-input');
            const $extraSelect = row.find('.field-extra-select');
            let extraValue = '';

            if ($extraInput.is(':visible') && !$extraInput.prop('disabled')) {
                extraValue = ($extraInput.val() || '').trim();
                console.log('Collected from input:', extraValue);
            } else if ($extraSelect.is(':visible') && !$extraSelect.prop('disabled')) {
                extraValue = $extraSelect.val();
                console.log('Collected from select:', extraValue, 'DataType:', dataType);
            }

            let validationPattern = null;
            let listOptions = null;

            if (dataType === 'Text' || dataType === 'TextArea' || dataType === 'Date') {
                validationPattern = extraValue || null;
            } else if (dataType === 'Select' || dataType === 'MultiSelect') {
                // Validate that a category is selected for Select/MultiSelect types
                if (!extraValue) {
                    const label = row.find('.field-label').val().trim() || fieldName || "Trường metadata";
                    toastr.error(`Vui lòng chọn Danh mục cho trường "${label}"`, 'Lỗi Validation');
                    $extraSelect.next('.select2-container').addClass('is-invalid-select2'); // Visual cue
                    hasValidationError = true;
                } else {
                    $extraSelect.next('.select2-container').removeClass('is-invalid-select2');
                }
                listOptions = extraValue || null;
                console.log('Setting listOptions:', listOptions);
            }

            const field = {
                FieldName: fieldName,
                DisplayLabel: (row.find('.field-label').val() || '').trim(),
                DataType: dataType,
                IsRequired: row.find('.field-required').is(':checked'),
                DefaultValue: null,
                Placeholder: (row.find('.field-placeholder').val() || '').trim() || null,
                SelectOptions: listOptions,
                ListOptions: listOptions,
                ValidationPattern: validationPattern,
                MinValue: parseFloat(row.find('.field-minval').val()) || null,
                MaxValue: parseFloat(row.find('.field-maxval').val()) || null,
                MinLength: parseInt(row.find('.field-minlen').val()) || null,
                MaxLength: parseInt(row.find('.field-maxlen').val()) || null,
                DisplayOrder: parseInt(row.find('.field-order').val()) || 0,
                IsVisibleInList: row.find('.field-visible').is(':checked'),
                IsSearchable: row.find('.field-searchable').is(':checked')
            };

            if (fieldId) {
                field.Id = fieldId;
            }

            metadataFields.push(field);
        });

        // Return null if validation fails
        if (hasDuplicate || hasValidationError) {
            return null;
        }

        return {
            Code: ($('#code').val() || '').trim(),
            Name: ($('#name').val() || '').trim(),
            Description: ($('#description').val() || '').trim() || null,
            IsActive: $('#isActive').is(':checked'),
            DisplayOrder: parseInt($('#displayOrder').val()) || 0,
            MetadataFields: metadataFields
        };
    }

    function createProfileType() {
        isSubmitting = true;
        const data = collectFormData();

        // Check if validation failed
        if (!data) {
            isSubmitting = false;
            return;
        }

        $.ajax({
            url: '/ProfileType/Create',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (response) {
                toastr.success('Tạo mới loại hồ sơ thành công', 'Thành công');
                setTimeout(function () {
                    window.location.href = '/ProfileType';
                }, 1000);
            },
            error: function (xhr) {
                console.error('Error creating profile type:', xhr);
                const message = xhr.responseJSON?.message || 'Không thể tạo mới loại hồ sơ';
                toastr.error(message, 'Lỗi');
            },
            complete: function () {
                isSubmitting = false;
            }
        });
    }

    function updateProfileType(id) {
        isSubmitting = true;
        const data = collectFormData();

        // Check if validation failed
        if (!data) {
            isSubmitting = false;
            return;
        }

        $.ajax({
            url: `/ProfileType/Update/${id}`,
            type: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (response) {
                toastr.success('Cập nhật loại hồ sơ thành công', 'Thành công');
                setTimeout(function () {
                    window.location.href = '/ProfileType';
                }, 1000);
            },
            error: function (xhr) {
                console.error('Error updating profile type:', xhr);
                const message = xhr.responseJSON?.message || 'Không thể cập nhật loại hồ sơ';
                toastr.error(message, 'Lỗi');
            },
            complete: function () {
                isSubmitting = false;
            }
        });
    }

    // Load existing profile type data if in edit mode (at the end after events are bound)
    if (window.existingProfileType) {
        const profileType = window.existingProfileType;
        if (profileType.metadataFields && profileType.metadataFields.length > 0) {
            profileType.metadataFields.sort((a, b) => a.displayOrder - b.displayOrder)
                .forEach(field => addMetadataFieldRow(field));
        }
    }
}
