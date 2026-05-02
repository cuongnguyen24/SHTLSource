/**
 * GPXD DanhMuc Management JavaScript (M0203)
 * Mirror Labor pattern (tainanlaodong-danhmuc-management.js) with GPXD endpoints.
 * Scope = GPXD; IsHidden = true (controller forces this).
 */

let categoryTypesTable;
let categoryCounter = 0;
let modalMode = 'create'; // 'create' | 'edit'
let editingCategoryTypeId = null;
let deleteId = null;
let isSubmitting = false;

const BASE_URL = '/CapPhepXayDungDanhMuc';
const SCOPE = 'GPXD';

$(document).ready(function () {
    initializeDataTable();
    initializeEventHandlers();
});

function initializeDataTable() {
    categoryTypesTable = $('#categoryTypesTable').dataTableFigma({
        ajax: {
            url: BASE_URL + '/GetCategoryTypes',
            dataSrc: function (json) {
                // Backend GetCategoryTypes trả { success: true, data: [...] };
                // Mutation actions trả { isSuccess: true, ... } → chấp nhận cả hai.
                if (json && (json.success || json.isSuccess) && Array.isArray(json.data)) return json.data;
                if (Array.isArray(json)) return json;
                return [];
            },
            error: function (xhr, error) {
                console.error('DataTables error:', error);
                toastr.error('Không thể tải dữ liệu. Vui lòng thử lại.');
            }
        },
        dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
        drawCallback: function (settings) {
            if (window.FigmaDataTables && FigmaDataTables.defaultConfig) {
                FigmaDataTables.defaultConfig.drawCallback(settings);
            }
            const $container = $('.pagination-figma-container');
            if ($container.length && $('#paginationFrame').length) {
                $container.appendTo('#paginationFrame');
            }
            const api = this.api();
            const startIndex = api.context[0]._iDisplayStart;
            api.column(0, { page: 'current' }).nodes().each(function (cell, i) {
                cell.innerHTML = startIndex + i + 1;
            });
        },
        autoWidth: false,
        columns: [
            {
                data: null, orderable: false, searchable: false,
                className: 'text-center', defaultContent: ''
            },
            {
                data: 'code',
                render: function (data) {
                    return '<span class="badge" style="background-color: #f1f5f9; color: #475569; font-family: monospace; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">' + escapeHtml(data || '') + '</span>';
                }
            },
            {
                data: 'name',
                render: function (data, type, row) {
                    const isSystem = row.isSystem !== undefined ? row.isSystem : row.IsSystem;
                    let html = '<strong>' + escapeHtml(data || '') + '</strong>';
                    if (isSystem) {
                        html += ' <span class="badge badge-secondary ml-1" style="font-size: 9px;">Hệ thống</span>';
                    }
                    return html;
                }
            },
            {
                data: 'description',
                render: function (data) {
                    return data
                        ? '<div class="text-truncate" style="max-width: 250px;" title="' + escapeHtml(data) + '">' + escapeHtml(data) + '</div>'
                        : '<span class="text-muted italic">---</span>';
                }
            },
            { data: 'displayOrder', className: 'text-center' },
            {
                data: 'isActive', className: 'text-center',
                render: function (data) {
                    return FigmaDataTables.renderStatusDot(data, data ? 'Hoạt động' : 'Ngưng hoạt động');
                }
            },
            {
                data: null, orderable: false, className: 'text-center',
                render: function (data, type, row) {
                    const id = row.id || row.Id;
                    const name = row.name || row.Name;
                    const val = row.isSystem !== undefined ? row.isSystem : row.IsSystem;
                    const isSystem = (val === true || val === 'true');

                    let html = '<div class="text-center">';
                    if (window.userPermissions && window.userPermissions.canUpdate) {
                        html += '<button class="btn-edit" data-id="' + id + '" title="Sửa" '
                            + 'style="width:28px; height:28px; border-radius:4px; background:#2563eb; color:#fff; border:none; cursor:pointer; margin-right:4px;">'
                            + '<i class="fas fa-pencil-alt" style="font-size:11px;"></i></button>';
                    }
                    if (window.userPermissions && window.userPermissions.canDelete && !isSystem) {
                        html += '<button class="btn-delete" data-id="' + id + '" data-name="' + escapeHtml(name || '') + '" title="Xóa" '
                            + 'style="width:28px; height:28px; border-radius:4px; background:#dc2626; color:#fff; border:none; cursor:pointer;">'
                            + '<i class="fas fa-trash-alt" style="font-size:11px;"></i></button>';
                    }
                    html += '</div>';
                    return html;
                }
            }
        ],
        order: [[1, 'asc']],
        pageLength: 25
    });
}

function initializeEventHandlers() {
    $('#gpxdDmBtnSearch').on('click', function () {
        categoryTypesTable.search($('#customSearchInput').val() || '').draw();
    });
    $('#customSearchInput').on('keypress', function (e) {
        if (e.which === 13) {
            e.preventDefault();
            categoryTypesTable.search(this.value).draw();
        }
    });

    $('#btnShowCreate').on('click', function () { showCreateModal(); });

    $('#btnAddCategory').on('click', function () {
        addCategoryRow();
    });

    $('#btnSave').on('click', function () { saveCategoryType(); });

    $('#categoryTypeModal').on('hidden.bs.modal', function () { resetForm(); });

    // Auto-generate Code from Name
    $('#categoryTypeName').on('input', function () {
        const $code = $('#categoryTypeCode');
        const currentCode = $code.val();
        if (!currentCode || $code.data('auto-generated') === currentCode || modalMode === 'create') {
            const code = generateAutoCode($(this).val(), 'GPXD');
            $code.val(code).data('auto-generated', code);
        }
    });

    $('#categoryTypeCode').on('input', function () {
        $(this).data('auto-generated', null);
        const typeCode = $(this).val();
        $('#categoriesTableBody tr').each(function () {
            const $row = $(this);
            const $codeInput = $row.find('.category-code');
            const currentCode = $codeInput.val();
            if (!currentCode || $codeInput.data('auto-generated') === currentCode) {
                const name = $row.find('.category-name').val();
                const idx = $row.index() + 1;
                const code = generateAutoSubCode(name, typeCode, idx);
                $codeInput.val(code).data('auto-generated', code);
            }
        });
    });

    $(document).on('input', '.category-name', function () {
        const $row = $(this).closest('tr');
        const $code = $row.find('.category-code');
        const currentCode = $code.val();
        if (!currentCode || $code.data('auto-generated') === currentCode) {
            const typeCode = $('#categoryTypeCode').val() || '';
            const idx = $row.index() + 1;
            const code = generateAutoSubCode($(this).val(), typeCode, idx);
            $code.val(code).data('auto-generated', code);
        }
    });

    $(document).on('change', '.category-code', function () {
        $(this).data('auto-generated', null);
    });

    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        if (id) editCategoryType(id);
    });

    $(document).on('click', '.btn-delete', function () {
        deleteId = $(this).data('id');
        $('#deleteCategoryTypeName').text($(this).data('name'));
        $('#deleteModal').modal('show');
    });

    $('#btnConfirmDelete').on('click', function () {
        if (!deleteId) return;
        const $btn = $(this);
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xóa');

        $.ajax({
            url: BASE_URL + '/DeleteCategoryType/' + deleteId,
            type: 'DELETE',
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (response) {
                if (response.isSuccess || response.success) {
                    toastr.success('Xóa loại danh mục thành công');
                    $('#deleteModal').modal('hide');
                    categoryTypesTable.ajax.reload();
                } else {
                    toastr.error(response.message || 'Có lỗi xảy ra');
                }
            },
            error: function (xhr) {
                toastr.error(xhr.responseJSON?.message || 'Có lỗi xảy ra');
            },
            complete: function () {
                $btn.prop('disabled', false).html('Xác nhận xóa');
                deleteId = null;
            }
        });
    });
}

function generateAutoCode(name, prefix) {
    if (!name) return '';
    const abbrev = generateAbbreviation(name);
    return abbrev ? prefix + '_' + abbrev : prefix;
}
function generateAutoSubCode(name, typeCode, index) {
    if (!name) return '';
    return typeCode + (index.toString().padStart(2, '0'));
}
function generateAbbreviation(name) {
    if (!name) return '';
    const unaccented = removeAccents(name);
    const words = unaccented.toUpperCase().split(/[\s\-_]+/).filter(w => w);
    if (words.length === 0) return unaccented.substring(0, 3).toUpperCase();
    if (words.length === 1) return words[0].substring(0, 3);
    return words.map(w => w[0]).join('');
}
function removeAccents(str) {
    if (!str) return '';
    return str.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .replace(/[^a-zA-Z0-9\s]/g, '').trim();
}

function showCreateModal() {
    resetForm();
    modalMode = 'create';
    $('#modalTitle').html('<i class="fas fa-plus-circle mr-2"></i> Thêm mới Loại Danh mục GPXD');
    $('#categoryTypeCode').prop('disabled', false);
    $('#btnSave').html('<i class="fas fa-save mr-1"></i> Lưu và tạo mới');
    $('#categoriesTableBody').empty();
    addCategoryRow();
    $('#categoryTypeModal').modal('show');
}

function editCategoryType(id) {
    resetForm();
    editingCategoryTypeId = id;
    modalMode = 'edit';
    $('#modalTitle').html('<i class="fas fa-edit mr-2"></i> Cập nhật Loại Danh mục GPXD');
    $('#btnSave').html('<i class="fas fa-save mr-1"></i> Cập nhật thay đổi');

    $.ajax({
        url: BASE_URL + '/GetCategoryType/' + id,
        type: 'GET',
        success: function (response) {
            if (response.isSuccess || response.success) {
                const data = response.data;
                const isSystem = data.isSystem !== undefined ? data.isSystem : data.IsSystem;
                $('#categoryTypeId').val(data.id || data.Id);
                $('#categoryTypeCode').val(data.code || data.Code);
                $('#categoryTypeName').val(data.name || data.Name);
                $('#categoryTypeDescription').val(data.description || data.Description || '');
                $('#categoryTypeDisplayOrder').val(data.displayOrder || data.DisplayOrder || 0);
                const isActive = data.isActive !== undefined ? data.isActive : data.IsActive;
                $('#categoryTypeIsActive').val(isActive.toString());

                if (isSystem) {
                    $('#categoryTypeCode').prop('disabled', true).attr('title', 'Mã hệ thống không thể đổi');
                } else {
                    $('#categoryTypeCode').prop('disabled', false);
                }
                $('#categoryTypeModal').data('is-system', isSystem);

                loadCategories(id);
                $('#categoryTypeModal').modal('show');
            } else {
                toastr.error(response.message || 'Không thể tải thông tin');
            }
        },
        error: function () { toastr.error('Lỗi khi tải thông tin loại danh mục'); }
    });
}

function loadCategories(categoryTypeId) {
    $('#categoriesTableBody').html('<tr><td colspan="7" class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin mr-1"></i> Đang tải...</td></tr>');
    $.ajax({
        url: BASE_URL + '/GetCategories/' + categoryTypeId,
        type: 'GET',
        success: function (response) {
            $('#categoriesTableBody').empty();
            if ((response.isSuccess || response.success) && response.data) {
                if (response.data.length === 0) {
                    addCategoryRow();
                } else {
                    response.data.forEach(function (c) { addCategoryRowFromData(c); });
                }
            } else {
                toastr.error(response.message || 'Không thể tải danh mục con');
            }
        },
        error: function () { toastr.error('Lỗi khi tải danh mục con'); }
    });
}

function addCategoryRow() {
    categoryCounter++;
    const row = '<tr data-category-index="' + categoryCounter + '">'
        + '<td class="text-center align-middle" style="background-color: #f8fafc; font-weight: bold;">' + categoryCounter + '</td>'
        + '<td><input type="text" class="input-figma category-code" style="height:32px;font-size:13px;" maxlength="100" placeholder="Tự động..."></td>'
        + '<td><input type="text" class="input-figma category-name" style="height:32px;font-size:13px;" maxlength="200" required placeholder="Tên..."></td>'
        + '<td><input type="text" class="input-figma category-description" style="height:32px;font-size:13px;" maxlength="500" placeholder="Mô tả..."></td>'
        + '<td><input type="number" class="input-figma category-displayorder text-center" style="height:32px;font-size:13px;" min="0" value="' + (categoryCounter - 1) + '"></td>'
        + '<td><select class="input-figma category-isactive" style="height:32px;font-size:13px;"><option value="true">Hoạt động</option><option value="false">Không hoạt động</option></select></td>'
        + '<td class="text-center"><button type="button" class="btn btn-sm btn-danger btn-remove-category" onclick="removeCategoryRow(' + categoryCounter + ')" style="height:28px;width:28px;padding:0;border-radius:4px;"><i class="fas fa-trash-alt" style="font-size:11px;"></i></button></td>'
        + '</tr>';
    $('#categoriesTableBody').append(row);
}

function addCategoryRowFromData(cat) {
    categoryCounter++;
    const id = cat.id || cat.Id || '';
    const name = escapeHtml(cat.name || cat.Name || '');
    const code = escapeHtml(cat.code || cat.Code || '');
    const desc = escapeHtml(cat.description || cat.Description || '');
    const order = cat.displayOrder || cat.DisplayOrder || 0;
    const active = cat.isActive !== undefined ? cat.isActive : cat.IsActive;

    const row = '<tr data-category-id="' + id + '" data-category-index="' + categoryCounter + '">'
        + '<td class="text-center align-middle" style="background-color: #f8fafc; font-weight: bold;">' + categoryCounter + '</td>'
        + '<td><input type="text" class="input-figma category-code" style="height:32px;font-size:13px;" value="' + code + '"></td>'
        + '<td><input type="text" class="input-figma category-name" style="height:32px;font-size:13px;" value="' + name + '"></td>'
        + '<td><input type="text" class="input-figma category-description" style="height:32px;font-size:13px;" value="' + desc + '"></td>'
        + '<td><input type="number" class="input-figma category-displayorder text-center" style="height:32px;font-size:13px;" min="0" value="' + order + '"></td>'
        + '<td><select class="input-figma category-isactive" style="height:32px;font-size:13px;"><option value="true" ' + (active !== false ? 'selected' : '') + '>Hoạt động</option><option value="false" ' + (active === false ? 'selected' : '') + '>Không hoạt động</option></select></td>'
        + '<td class="text-center"><button type="button" class="btn btn-sm btn-danger btn-remove-category" onclick="removeCategoryRow(' + categoryCounter + ')" style="height:28px;width:28px;padding:0;border-radius:4px;"><i class="fas fa-trash-alt" style="font-size:11px;"></i></button></td>'
        + '</tr>';
    $('#categoriesTableBody').append(row);
}

function removeCategoryRow(index) {
    $('tr[data-category-index="' + index + '"]').remove();
    $('#categoriesTableBody tr').each(function (idx) {
        $(this).find('td:first').text(idx + 1);
    });
}

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

    const categories = [];
    let hasError = false;
    $('#categoriesTableBody tr').each(function () {
        const id = $(this).attr('data-category-id');
        const catName = $(this).find('.category-name').val().trim();
        const catCode = $(this).find('.category-code').val().trim() || null;
        if (!catName) {
            hasError = true;
            $(this).find('.category-name').addClass('is-invalid');
            toastr.error('Vui lòng nhập tên cho tất cả danh mục con');
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
    const original = $btn.html();
    $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');

    const isSystemValue = modalMode === 'create' ? false : ($('#categoryTypeModal').data('is-system') === true);
    const request = {
        categoryType: {
            name: name, code: code, description: description,
            displayOrder: displayOrder, isActive: isActive,
            scope: SCOPE, isSystem: isSystemValue, isHidden: true
        },
        categories: categories
    };

    const url = modalMode === 'edit'
        ? BASE_URL + '/UpdateCategoryTypeWithCategories/' + editingCategoryTypeId
        : BASE_URL + '/CreateCategoryType';
    const method = modalMode === 'edit' ? 'PUT' : 'POST';

    $.ajax({
        url: url, type: method,
        contentType: 'application/json',
        data: JSON.stringify(request),
        headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
        success: function (response) {
            if (response.isSuccess || response.success) {
                toastr.success(response.message || (modalMode === 'edit' ? 'Cập nhật thành công' : 'Tạo mới thành công'));
                $('#categoryTypeModal').modal('hide');
                categoryTypesTable.ajax.reload();
            } else {
                toastr.error(response.message || 'Có lỗi xảy ra');
            }
        },
        error: function (xhr) {
            toastr.error(xhr.responseJSON?.message || 'Lỗi khi lưu loại danh mục');
        },
        complete: function () {
            isSubmitting = false;
            $btn.prop('disabled', false).html(original);
        }
    });
}

function resetForm() {
    $('#categoryTypeForm')[0].reset();
    $('#categoryTypeId').val('');
    $('#categoriesTableBody').empty();
    $('.error-message').text('');
    $('.is-invalid').removeClass('is-invalid');
    categoryCounter = 0;
    modalMode = 'create';
    editingCategoryTypeId = null;
    $('#categoryTypeForm input, #categoryTypeForm textarea, #categoryTypeForm select').prop('disabled', false);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.toString().replace(/[&<>"']/g, function (m) { return map[m]; });
}

// Expose for inline onclick
window.removeCategoryRow = removeCategoryRow;
window.GpxdDanhMucManager = {
    showCreateModal: showCreateModal,
    editCategoryType: editCategoryType,
    saveCategoryType: saveCategoryType,
    addCategoryRow: addCategoryRow,
    removeCategoryRow: removeCategoryRow,
    reloadTable: function () { if (categoryTypesTable) categoryTypesTable.ajax.reload(); }
};
