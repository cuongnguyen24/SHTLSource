/**
 * TaiNanLaoDong DanhMuc Management JavaScript
 * M0146 — Handles CRUD operations for CategoryTypes and Categories (scope=LaborAccident)
 */

let categoryTypesTable;
let categoryCounter = 0;
let modalMode = 'create'; // 'create', 'view', 'edit'
let editingCategoryTypeId = null;
let deleteId = null;
let isBulkDelete = false;
let selectedIds = [];
let isSubmitting = false;

// Fixed values for TNLD
const BASE_URL = '/TaiNanLaoDong/TaiNanLaoDongDanhMuc';
const SCOPE = 'LaborAccident';

function updateBulkDeleteBtn() {
    const count = selectedIds.length;
    $('#selectedCount').text(count);
    if (count > 0) {
        $('#btnBulkDelete').fadeIn(200);
    } else {
        $('#btnBulkDelete').fadeOut(200);
    }
}

$(document).ready(function () {
    initializeDataTable();
    initializeEventHandlers();
});

/**
 * Initialize DataTables
 */
function initializeDataTable() {
    categoryTypesTable = $('#categoryTypesTable').dataTableFigma({
        ajax: {
            url: BASE_URL + '/GetAll',
            dataSrc: '',
            error: function (xhr, error, code) {
                console.error('DataTables error:', error);
                toastr.error('Không thể tải dữ liệu. Vui lòng thử lại.');
            }
        },
        dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
        drawCallback: function(settings) {
            if (window.FigmaDataTables && FigmaDataTables.defaultConfig) {
                FigmaDataTables.defaultConfig.drawCallback(settings);
            }
            
            const $container = $('.pagination-figma-container');
            if ($container.length && $('#paginationFrame').length) {
                $container.appendTo('#paginationFrame');
            }

            // Reset checkbox state on draw
            selectedIds = [];
            $('#selectAllCheckbox').prop('checked', false);
            updateBulkDeleteBtn();

            // Render STT
            var api = this.api();
            var startIndex = api.context[0]._iDisplayStart;
            api.column(1, {page:'current'}).nodes().each(function (cell, i) {
                cell.innerHTML = startIndex + i + 1;
            });
        },
        autoWidth: false,
        columns: [
            {
                data: 'id',
                orderable: false,
                searchable: false,
                className: 'text-center',
                render: function (data, type, row) {
                    const isSystem = row.isSystem !== undefined ? row.isSystem : row.IsSystem;
                    if (isSystem) return '';
                    return `<input type="checkbox" class="row-checkbox" value="${data}" style="cursor: pointer;" />`;
                }
            },
            {
                data: null,
                orderable: false,
                searchable: false,
                className: 'text-center',
                defaultContent: ''
            },
            { 
                data: 'code',
                render: function(data) {
                    return `<span class="badge" style="background-color: #f1f5f9; color: #475569; font-family: monospace; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">${data}</span>`;
                }
            },
            { 
                data: 'name',
                render: function(data, type, row) {
                    const isSystem = row.isSystem !== undefined ? row.isSystem : row.IsSystem;
                    let html = `<strong>${data}</strong>`;
                    if (isSystem) {
                        html += ' <span class="badge badge-secondary ml-1" style="font-size: 9px; vertical-align: middle;">Hệ thống</span>';
                    }
                    return html;
                }
            },
            { 
                data: 'description',
                render: function(data) {
                    return data ? `<div class="text-truncate" style="max-width: 250px;" title="${escapeHtml(data)}">${escapeHtml(data)}</div>` : '<span class="text-muted italic">---</span>';
                }
            },
            { 
                data: 'displayOrder',
                className: 'text-center'
            },
            {
                data: 'isActive',
                className: 'text-center',
                render: function (data) {
                    return FigmaDataTables.renderStatusDot(data, data ? 'Hoạt động' : 'Ngưng hoạt động');
                }
            },
            {
                data: null,
                orderable: false,
                className: 'text-center',
                render: function (data, type, row) {
                    const id = row.id || row.Id;
                    const name = row.name || row.Name;
                    const val = row.isSystem !== undefined ? row.isSystem : row.IsSystem;
                    const isSystem = (val === true || val === 'true');

                    let html = '<div class="text-center">';
                    if (window.userPermissions && window.userPermissions.canUpdate) {
                        html += `
                            <button class="btn-edit btn-action-edit"
                                data-id="${id}"
                                title="Sửa"
                                style="width:28px; height:28px; border-radius:4px; background:#2563eb; color:#fff; border:none; cursor:pointer; margin-right:4px;">
                                <i class="fas fa-pencil-alt" style="font-size:11px;"></i>
                            </button>`;
                    }
                    if (window.userPermissions && window.userPermissions.canDelete) {
                        if (!isSystem) {
                            html += `
                                <button class="btn-delete btn-action-delete"
                                    data-id="${id}" data-name="${escapeHtml(name)}"
                                    title="Xóa"
                                    style="width:28px; height:28px; border-radius:4px; background:#dc2626; color:#fff; border:none; cursor:pointer;">
                                    <i class="fas fa-trash-alt" style="font-size:11px;"></i>
                                </button>`;
                        }
                    }
                    html += '</div>';
                    return html;
                }
            }
        ],
        order: [[2, 'asc']],
        pageLength: 25
    });
}

/**
 * Initialize event handlers
 */
function initializeEventHandlers() {
    $('#customSearchInput').on('keyup', function () {
        categoryTypesTable.search(this.value).draw();
    });

    $('#btnShowCreate').on('click', function () {
        showCreateModal();
    });

    $('#btnAddCategory').on('click', function () {
        if (modalMode !== 'view') {
            addCategoryRow();
        }
    });

    $('#btnSave').on('click', function () {
        saveCategoryType();
    });

    $('#btnEditFromView').on('click', function () {
        setModalMode('edit');
    });

    $('#categoryTypeModal').on('hidden.bs.modal', function () {
        resetForm();
    });

    // Auto-generate Code from Name
    $('#categoryTypeName').on('input', function() {
        const name = $(this).val();
        const $code = $('#categoryTypeCode');
        const currentCode = $code.val();
        
        if (!$code.val() || $code.data('auto-generated') === currentCode || modalMode === 'create') {
            const code = generateAutoCode(name, 'DM');
            $code.val(code).data('auto-generated', code);
        }
    });

    // Track manual edits on code fields
    $('#categoryTypeCode').on('input', function () {
        $(this).data('auto-generated', null);
        
        const typeCode = $(this).val();
        $('#categoriesTableBody tr').each(function () {
            const $row = $(this);
            const $codeInput = $row.find('.category-code');
            const $nameInput = $row.find('.category-name');
            const currentCode = $codeInput.val();
            
            if (!currentCode || $codeInput.data('auto-generated') === currentCode) {
                const name = $nameInput.val();
                const index = $row.index() + 1;
                const code = generateAutoSubCode(name, typeCode, index);
                $codeInput.val(code).data('auto-generated', code);
            }
        });
    });

    $(document).on('input', '.category-name', function() {
        const $row = $(this).closest('tr');
        const $code = $row.find('.category-code');
        const currentCode = $code.val();
        
        if (!currentCode || $code.data('auto-generated') === currentCode || currentCode.startsWith('NEW_')) {
            const name = $(this).val();
            const typeCode = $('#categoryTypeCode').val() || '';
            const index = $row.index() + 1;
            const code = generateAutoSubCode(name, typeCode, index);
            $code.val(code).data('auto-generated', code);
        }
    });

    $(document).on('change', '.category-code', function() {
        $(this).data('auto-generated', null);
    });

    // --- Checkbox & Bulk Delete Logic ---
    $('#selectAllCheckbox', '#categoryTypesTable thead').on('change', function () {
        const isChecked = $(this).prop('checked');
        $('.row-checkbox', '#categoryTypesTable tbody').prop('checked', isChecked);

        selectedIds = [];
        if (isChecked) {
            $('.row-checkbox', '#categoryTypesTable tbody').each(function () {
                selectedIds.push($(this).val());
            });
        }
        updateBulkDeleteBtn();
    });

    $(document).on('change', '.row-checkbox', function () {
        const id = $(this).val();
        if ($(this).prop('checked')) {
            if (!selectedIds.includes(id)) selectedIds.push(id);
        } else {
            selectedIds = selectedIds.filter(x => x !== id);
        }

        const allChecked = $('.row-checkbox').length === selectedIds.length && selectedIds.length > 0;
        $('#selectAllCheckbox').prop('checked', allChecked);

        updateBulkDeleteBtn();
    });

    $('#btnBulkDelete').on('click', function () {
        if (selectedIds.length === 0) return;
        isBulkDelete = true;
        deleteId = selectedIds;
        $('#deleteCategoryTypeName').text(`${selectedIds.length} loại danh mục đã chọn`);
        $('#deleteModal').modal('show');
    });

    // Edit button
    $(document).on('click', '.btn-edit', function () {
        const id = $(this).attr('data-id') || $(this).data('id');
        if (id && id !== 'undefined') {
            editCategoryType(id);
        } else {
            toastr.error('Không tìm thấy ID loại danh mục để cập nhật');
        }
    });

    // Delete button click
    $(document).on('click', '.btn-delete', function () {
        isBulkDelete = false;
        deleteId = $(this).data('id');
        $('#deleteCategoryTypeName').text($(this).data('name'));
        $('#deleteModal').modal('show');
    });

    // Confirm delete button click
    $('#btnConfirmDelete').click(function () {
        if (!deleteId || (isBulkDelete && deleteId.length === 0)) return;

        const url = isBulkDelete ? BASE_URL + '/DeleteMultiple' : BASE_URL + '/Delete/' + deleteId;
        const method = 'DELETE'; 
        const payload = isBulkDelete ? JSON.stringify(Array.from(deleteId)) : null;

        $(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Xóa');
        
        const antiForgeryToken = $('input[name="__RequestVerificationToken"]').val();

        $.ajax({
            url: url,
            type: method,
            contentType: isBulkDelete ? 'application/json' : undefined,
            data: payload,
            processData: isBulkDelete ? false : true,
            headers: { 'RequestVerificationToken': antiForgeryToken },
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(isBulkDelete ? 'Xóa nhiều loại danh mục thành công' : 'Xóa loại danh mục thành công', 'Thành công');
                    $('#deleteModal').modal('hide');
                    categoryTypesTable.ajax.reload();
                } else {
                    toastr.error(response.message || 'Có lỗi xảy ra', 'Lỗi');
                }
            },
            error: function (xhr) {
                let error = 'Có lỗi xảy ra';
                if (xhr.responseJSON?.message) {
                    error = xhr.responseJSON.message;
                }
                toastr.error(error, 'Lỗi');
            },
            complete: function () {
                $('#btnConfirmDelete').prop('disabled', false).html('<i class="fas fa-trash mr-1"></i> Xóa');
                isBulkDelete = false;
                deleteId = null;
            }
        });
    });
}

/**
 * Generate Auto Code for CategoryType
 */
function generateAutoCode(name, prefix) {
    if (!name) return '';
    const abbrev = generateAbbreviation(name);
    return abbrev ? `${prefix}_${abbrev}` : prefix;
}

/**
 * Generate Auto Code for Category
 */
function generateAutoSubCode(name, typeCode, index) {
    if (!name) return '';
    const padIndex = (index.toString().padStart(2, '0'));
    return `${typeCode}${padIndex}`;
}

/**
 * Generate Abbreviation from Name
 */
function generateAbbreviation(name) {
    if (!name) return '';
    const unaccented = removeAccents(name);
    const words = unaccented.toUpperCase()
        .split(/[\s\-_]+/)
        .filter(w => w);
    
    if (words.length === 0) return unaccented.substring(0, 3).toUpperCase();
    if (words.length === 1) return words[0].substring(0, 3);
    
    return words.map(w => w[0]).join('');
}

/**
 * Remove Vietnamese accents and special chars
 */
function removeAccents(str) {
    if (!str) return '';
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd').replace(/Đ/g, 'D')
              .replace(/[^a-zA-Z0-9\s]/g, '')
              .trim();
}

/**
 * Set Modal Mode (UI adjustments)
 */
function setModalMode(mode) {
    modalMode = mode;
    
    $('#categoryTypeForm input, #categoryTypeForm textarea, #categoryTypeForm select').prop('disabled', false);
    $('#btnAddCategory').show();
    $('#btnSave').show();
    $('#btnEditFromView').hide();

    if (mode === 'create') {
        $('#modalTitle').html('<i class="fas fa-plus-circle mr-2"></i> Thêm mới Loại Danh mục');
        $('#categoryTypeCode').prop('disabled', false);
        $('#btnSave').html('<i class="fas fa-save mr-1"></i> Lưu và tạo mới');
    } 
    else if (mode === 'view') {
        $('#modalTitle').html('<i class="fas fa-info-circle mr-2"></i> Chi tiết Loại Danh mục');
        $('#categoryTypeForm input, #categoryTypeForm textarea, #categoryTypeForm select').prop('disabled', true);
        
        $('#btnAddCategory').hide();
        $('#btnSave').hide();
        if (window.userPermissions && window.userPermissions.canUpdate) {
            $('#btnEditFromView').show();
        }
        $('.btn-remove-category').hide();
    }
    else if (mode === 'edit') {
        $('#modalTitle').html('<i class="fas fa-edit mr-2"></i> Cập nhật Loại Danh mục');
        $('#categoryTypeCode').prop('disabled', false);
        $('#btnSave').html('<i class="fas fa-save mr-1"></i> Cập nhật thay đổi');
        $('#btnAddCategory').show();
        $('.btn-remove-category').show();
    }
}

/**
 * Show create modal
 */
function showCreateModal() {
    resetForm();
    setModalMode('create');
    $('#categoriesTableBody').empty();
    $('#categoryTypeModal').modal('show');
}

/**
 * Edit category type
 */
function editCategoryType(id) {
    resetForm();
    editingCategoryTypeId = id;
    setModalMode('edit');
    loadCategoryTypeData(id);
}

/**
 * Load category type and its categories
 */
function loadCategoryTypeData(id) {
    $.ajax({
        url: `${BASE_URL}/Get/${id}`,
        type: 'GET',
        success: function (response) {
            if (response.isSuccess || response.success) {
                const data = response.data;
                const id = data.id || data.Id;
                const isSystem = data.isSystem !== undefined ? data.isSystem : data.IsSystem;

                $('#categoryTypeId').val(id);
                $('#categoryTypeCode').val(data.code || data.Code);
                $('#categoryTypeName').val(data.name || data.Name);
                $('#categoryTypeDescription').val(data.description || data.Description || '');
                $('#categoryTypeDisplayOrder').val(data.displayOrder || data.DisplayOrder || 0);
                
                const isActive = data.isActive !== undefined ? data.isActive : data.IsActive;
                $('#categoryTypeIsActive').val(isActive.toString()).trigger('change');

                if (isSystem) {
                    $('#categoryTypeCode').prop('disabled', true).attr('title', 'Mã danh mục hệ thống không thể thay đổi');
                    $('#modalTitle').find('h5').append(' <span class="badge badge-secondary ml-2" style="font-size: 10px;">Hệ thống</span>');
                } else {
                    $('#categoryTypeCode').prop('disabled', false).removeAttr('title');
                }

                $('#categoryTypeModal').data('is-system', isSystem);
                $('#categoryTypeModal').data('scope', data.scope || data.Scope);

                loadCategories(id);
                $('#categoryTypeModal').modal('show');
            } else {
                toastr.error(response.message || 'Không thể tải thông tin loại danh mục');
            }
        },
        error: function () {
            toastr.error('Lỗi khi tải thông tin loại danh mục');
        }
    });
}

/**
 * Load categories for a type
 */
function loadCategories(categoryTypeId) {
    $('#categoriesTableBody').html('<tr><td colspan="7" class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin mr-1"></i> Đang tải danh sách...</td></tr>');
    
    $.ajax({
        url: `${BASE_URL}/GetCategories/${categoryTypeId}`,
        type: 'GET',
        success: function (response) {
            $('#categoriesTableBody').empty();
            if ((response.isSuccess || response.success) && response.data) {
                if (response.data.length === 0 && modalMode !== 'view') {
                    addCategoryRow();
                } else {
                    response.data.forEach(function (cat) {
                        addCategoryRowFromData(cat);
                    });
                }
            } else {
                toastr.error(response.message || 'Không thể tải danh sách danh mục');
            }
        },
        error: function () {
            toastr.error('Lỗi khi tải danh sách danh mục');
        }
    });
}

/**
 * Add a new category row (Empty)
 */
function addCategoryRow() {
    categoryCounter++;
    const isView = modalMode === 'view';
    const row = `
        <tr data-category-index="${categoryCounter}">
            <td class="text-center align-middle" style="background-color: #f8fafc; font-weight: bold;">${categoryCounter}</td>
            <td class="align-middle">
                <input type="text" class="input-figma category-code" style="height: 32px; font-size: 13px;"
                       maxlength="100" placeholder="Tự động..." ${isView ? 'disabled' : ''}>
            </td>
            <td class="align-middle">
                <input type="text" class="input-figma category-name" style="height: 32px; font-size: 13px;"
                       maxlength="200" required placeholder="Tên danh mục..." ${isView ? 'disabled' : ''}>
            </td>
            <td class="align-middle">
                <input type="text" class="input-figma category-description" style="height: 32px; font-size: 13px;"
                       maxlength="500" placeholder="Mô tả..." ${isView ? 'disabled' : ''}>
            </td>
            <td class="align-middle">
                <input type="number" class="input-figma category-displayorder text-center" style="height: 32px; font-size: 13px;"
                       min="0" value="${categoryCounter - 1}" ${isView ? 'disabled' : ''}>
            </td>
            <td class="align-middle">
                <select class="input-figma category-isactive" style="height: 32px; font-size: 13px;" ${isView ? 'disabled' : ''}>
                    <option value="true">Hoạt động</option>
                    <option value="false">Không hoạt động</option>
                </select>
            </td>
            <td class="text-center align-middle">
                <button type="button" class="btn btn-sm btn-danger btn-remove-category" 
                        onclick="removeCategoryRow(${categoryCounter})" 
                        style="height: 28px; width: 28px; padding: 0; border-radius: 4px; ${isView ? 'display:none' : ''}">
                    <i class="fas fa-trash-alt" style="font-size: 11px;"></i>
                </button>
            </td>
        </tr>
    `;
    $('#categoriesTableBody').append(row);
}

/**
 * Add category row from data
 */
function addCategoryRowFromData(cat) {
    categoryCounter++;
    const isView = modalMode === 'view';
    const categoryId = cat.id || cat.Id || '';
    const catName = cat.name || cat.Name || '';
    const catCode = cat.code || cat.Code || '';
    const catDesc = cat.description || cat.Description || '';
    const catOrder = cat.displayOrder || cat.DisplayOrder || 0;
    const catActive = cat.isActive !== undefined ? cat.isActive : cat.IsActive;

    const row = `
        <tr data-category-id="${categoryId}" data-category-index="${categoryCounter}">
            <td class="text-center align-middle" style="background-color: #f8fafc; font-weight: bold;">${categoryCounter}</td>
            <td class="align-middle">
                <input type="text" class="input-figma category-code" style="height: 32px; font-size: 13px;"
                    value="${escapeHtml(catCode)}" placeholder="Mã..." ${isView ? 'disabled' : ''}>
            </td>
            <td class="align-middle">
                <input type="text" class="input-figma category-name" style="height: 32px; font-size: 13px;"
                    value="${escapeHtml(catName)}" placeholder="Tên danh mục..." ${isView ? 'disabled' : ''}>
            </td>
            <td class="align-middle">
                <input type="text" class="input-figma category-description" style="height: 32px; font-size: 13px;"
                    value="${escapeHtml(catDesc)}" placeholder="Mô tả..." ${isView ? 'disabled' : ''}>
            </td>
            <td class="align-middle">
                <input type="number" class="input-figma category-displayorder" style="height: 32px; font-size: 13px;"
                    value="${catOrder}" min="0" ${isView ? 'disabled' : ''}>
            </td>
            <td class="align-middle">
                <select class="input-figma category-isactive" style="height: 32px; font-size: 13px;" ${isView ? 'disabled' : ''}>
                    <option value="true" ${catActive !== false ? 'selected' : ''}>Hoạt động</option>
                    <option value="false" ${catActive === false ? 'selected' : ''}>Ngưng hoạt động</option>
                </select>
            </td>
            <td class="text-center align-middle">
                <button type="button" class="btn btn-sm btn-danger btn-remove-category" 
                        onclick="removeCategoryRow(${categoryCounter})" 
                        style="height: 28px; width: 28px; padding: 0; border-radius: 4px; ${isView ? 'display:none' : ''}">
                    <i class="fas fa-trash-alt" style="font-size: 11px;"></i>
                </button>
            </td>
        </tr>
    `;
    $('#categoriesTableBody').append(row);
}

/**
 * Remove row
 */
function removeCategoryRow(index) {
    $(`tr[data-category-index="${index}"]`).remove();
    const typeCode = $('#categoryTypeCode').val() || '';
    
    $('#categoriesTableBody tr').each(function (idx) {
        const newIndex = idx + 1;
        $(this).find('td:first').text(newIndex);
        
        const $codeInput = $(this).find('.category-code');
        const currentCode = $codeInput.val();
        if (!currentCode || $codeInput.data('auto-generated') === currentCode) {
            const name = $(this).find('.category-name').val();
            const code = generateAutoSubCode(name, typeCode, newIndex);
            $codeInput.val(code).data('auto-generated', code);
        }
    });
}

/**
 * Save
 */
function saveCategoryType() {
    $('.error-message').text('');
    $('.is-invalid').removeClass('is-invalid');

    const name = $('#categoryTypeName').val().trim();
    if (!name) {
        $('#error-categoryTypeName').text('Tên loại danh mục là bắt buộc');
        $('#categoryTypeName').addClass('is-invalid');
        return;
    }

    const code = $('#categoryTypeCode').val().trim();
    const description = $('#categoryTypeDescription').val().trim() || null;
    const displayOrder = parseInt($('#categoryTypeDisplayOrder').val()) || 0;
    const isActive = $('#categoryTypeIsActive').val() === 'true';

    // Collect categories
    const categories = [];
    let hasError = false;

    $('#categoriesTableBody tr').each(function () {
        const id = $(this).attr('data-category-id');
        const catName = $(this).find('.category-name').val().trim();
        const catCode = $(this).find('.category-code').val().trim() || null;
        
        if (!catName) {
            hasError = true;
            $(this).find('.category-name').addClass('is-invalid');
            toastr.error('Vui lòng nhập tên cho tất cả các hàng danh mục');
            return false;
        }

        categories.push({
            id: id || null,
            name: catName,
            code: catCode,
            description: $(this).find('.category-description').val().trim() || null,
            displayOrder: parseInt($(this).find('.category-displayorder').val()) || 0,
            isActive: $(this).find('.category-isactive').val() === 'true'
        });
    });

    if (hasError) return;

    if (isSubmitting) return;
    isSubmitting = true;
    const $btn = $('#btnSave');
    const originalHtml = $btn.html();
    $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');

    const isSystemValue = modalMode === 'create' ? false : ($('#categoryTypeModal').data('is-system') === true);

    const request = {
        categoryType: { 
            name: name, 
            code: code, 
            description: description, 
            displayOrder: displayOrder, 
            isActive: isActive,
            scope: SCOPE,
            isSystem: isSystemValue,
            isHidden: true
        },
        categories: categories
    };

    if (modalMode === 'edit' && (!editingCategoryTypeId || editingCategoryTypeId === 'undefined')) {
        toastr.error('Dữ liệu không hợp lệ. Vui lòng tải lại trang.');
        return;
    }

    const url = modalMode === 'edit'
        ? BASE_URL + '/UpdateWithCategories/' + editingCategoryTypeId
        : BASE_URL + '/Create';
    const method = modalMode === 'edit' ? 'PUT' : 'POST';

    $.ajax({
        url: url,
        type: method,
        contentType: 'application/json',
        data: JSON.stringify(request),
        headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
        success: function (response) {
            if (response.isSuccess || response.success) {
                toastr.success(response.message || (modalMode === 'edit' ? 'Cập nhật loại danh mục thành công' : 'Tạo loại danh mục thành công'), 'Thành công');
                $('#categoryTypeModal').modal('hide');
                categoryTypesTable.ajax.reload();
            } else {
                toastr.error(response.message || 'Có lỗi xảy ra', 'Lỗi');
            }
        },
        error: function (xhr) {
            let error = 'Lỗi khi lưu loại danh mục';
            if (xhr.responseJSON?.message) {
                error = xhr.responseJSON.message;
            }
            toastr.error(error, 'Lỗi');
        },
        complete: function() {
            isSubmitting = false;
            $btn.prop('disabled', false).html(originalHtml);
        }
    });
}

/**
 * Reset
 */
function resetForm() {
    $('#categoryTypeForm')[0].reset();
    $('#categoryTypeId').val('');
    $('#categoryTypeCode').val('');
    $('#categoriesTableBody').empty();
    $('.error-message').text('');
    $('.is-invalid').removeClass('is-invalid');
    categoryCounter = 0;
    modalMode = 'create';
    editingCategoryTypeId = null;
    
    $('#categoryTypeForm input, #categoryTypeForm textarea, #categoryTypeForm select').prop('disabled', false);
    $('#btnSave').show();
    $('#btnEditFromView').hide();
    $('.btn-remove-category').show();
}

/**
 * Helper
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.toString().replace(/[&<>"']/g, function (m) { return map[m]; });
}
