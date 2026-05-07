/**
 * CategoryType Management JavaScript
 * Pattern: server-side search/pagination via quickSearch form → _CategoryTypes partial
 */
(function () {
    'use strict';

    let categoryCounter = 0;
    let modalMode = 'create'; // 'create', 'view', 'edit'
    let editingCategoryTypeId = null;
    let deleteId = null;
    let isBulkDelete = false;
    let selectedIds = [];
    let isSubmitting = false;

    // ── Reload helpers ────────────────────────────────────────────────────

    function reloadList() {
        $('#frmCategoryType').trigger('submit');
    }

    // ── Checkbox & Bulk Delete ────────────────────────────────────────────

    function updateBulkDeleteBtn() {
        const $btn = $('#btnBulkDelete');
        if ($btn.length === 0) return;
        const count = selectedIds.length;
        $('#selectedCount').text(count);
        count > 0 ? $btn.fadeIn(200) : $btn.fadeOut(200);
    }

    function bindCheckboxEvents() {
        // Select-all
        $(document).off('change', '#selectAllCheckbox').on('change', '#selectAllCheckbox', function () {
            const isChecked = $(this).prop('checked');
            $('.row-checkbox').prop('checked', isChecked);
            selectedIds = [];
            if (isChecked) {
                $('.row-checkbox').each(function () { selectedIds.push($(this).val()); });
            }
            updateBulkDeleteBtn();
        });

        // Row checkbox
        $(document).off('change', '.row-checkbox').on('change', '.row-checkbox', function () {
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
    }

    // ── Form & Modal Logic ────────────────────────────────────────────────

    function resetForm() {
        $('#categoryTypeForm')[0].reset();
        $('#categoryTypeId').val('');
        $('#categoryTypeCode').val('').data('auto-generated', null);
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

    function showCreateModal() {
        resetForm();
        setModalMode('create');
        $('#categoryTypeModal').modal('show');
        addCategoryRow();
    }

    function loadCategoryTypeData(id) {
        $.ajax({
            url: `/CategoryType/Get/${id}`,
            type: 'GET',
            success: function (response) {
                if (response.success && response.data) {
                    const data = response.data;
                    $('#categoryTypeId').val(data.id);
                    $('#categoryTypeCode').val(data.code);
                    $('#categoryTypeName').val(data.name);
                    $('#categoryTypeDescription').val(data.description || '');
                    $('#categoryTypeDisplayOrder').val(data.displayOrder || 0);
                    $('#categoryTypeIsActive').val(data.isActive.toString()).trigger('change');

                    // Store metadata
                    $('#categoryTypeModal').data('is-system', data.isSystem);
                    $('#categoryTypeModal').data('scope', data.scope);
                    $('#categoryTypeModal').data('is-hidden', data.isHidden);

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

    function loadCategories(categoryTypeId) {
        $('#categoriesTableBody').html('<tr><td colspan="7" class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin mr-1"></i> Đang tải danh sách...</td></tr>');

        $.ajax({
            url: `/CategoryType/GetCategories/${categoryTypeId}`,
            type: 'GET',
            success: function (response) {
                $('#categoriesTableBody').empty();
                if (response.success && response.data) {
                    if (response.data.length === 0 && modalMode !== 'view') {
                        addCategoryRow();
                    } else {
                        response.data.forEach(function (cat) {
                            addCategoryRowFromData(cat);
                        });
                    }
                } else {
                    toastr.error('Không thể tải danh sách danh mục');
                }
            },
            error: function () {
                toastr.error('Lỗi khi tải danh sách danh mục');
            }
        });
    }

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
                            data-index="${categoryCounter}" 
                            style="height: 28px; width: 28px; padding: 0; border-radius: 4px; ${isView ? 'display:none' : ''}">
                        <i class="fas fa-trash-alt" style="font-size: 11px;"></i>
                    </button>
                </td>
            </tr>
        `;
        $('#categoriesTableBody').append(row);
    }

    function addCategoryRowFromData(cat) {
        categoryCounter++;
        const isView = modalMode === 'view';
        const row = `
            <tr data-category-index="${categoryCounter}" data-category-id="${cat.id}">
                <td class="text-center align-middle" style="background-color: #f8fafc; font-weight: bold;">${categoryCounter}</td>
                <td class="align-middle">
                    <input type="text" class="input-figma category-code" style="height: 32px; font-size: 13px;"
                           maxlength="100" value="${escapeHtml(cat.code)}" ${isView ? 'disabled' : ''}>
                </td>
                <td class="align-middle">
                    <input type="text" class="input-figma category-name" style="height: 32px; font-size: 13px;"
                           maxlength="200" required value="${escapeHtml(cat.name)}" ${isView ? 'disabled' : ''}>
                </td>
                <td class="align-middle">
                    <input type="text" class="input-figma category-description" style="height: 32px; font-size: 13px;"
                           maxlength="500" value="${escapeHtml(cat.description || '')}" ${isView ? 'disabled' : ''}>
                </td>
                <td class="align-middle">
                    <input type="number" class="input-figma category-displayorder text-center" style="height: 32px; font-size: 13px;"
                           min="0" value="${cat.displayOrder}" ${isView ? 'disabled' : ''}>
                </td>
                <td class="align-middle">
                    <select class="input-figma category-isactive" style="height: 32px; font-size: 13px;" ${isView ? 'disabled' : ''}>
                        <option value="true" ${cat.isActive ? 'selected' : ''}>Hoạt động</option>
                        <option value="false" ${!cat.isActive ? 'selected' : ''}>Không hoạt động</option>
                    </select>
                </td>
                <td class="text-center align-middle">
                    <button type="button" class="btn btn-sm btn-danger btn-remove-category" 
                            data-index="${categoryCounter}" 
                            style="height: 28px; width: 28px; padding: 0; border-radius: 4px; ${isView ? 'display:none' : ''}">
                        <i class="fas fa-trash-alt" style="font-size: 11px;"></i>
                    </button>
                </td>
            </tr>
        `;
        $('#categoriesTableBody').append(row);
    }

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

    // ── CRUD Actions ──────────────────────────────────────────────────────

    function saveCategoryType() {
        if (isSubmitting) return;

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

        isSubmitting = true;
        const $btn = $('#btnSave');
        const originalHtml = $btn.html();
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');

        const request = {
            categoryType: {
                name,
                code,
                description,
                displayOrder,
                isActive,
                scope: modalMode === 'create' ? (window.currentScope || null) : $('#categoryTypeModal').data('scope'),
                isSystem: modalMode === 'create' ? false : $('#categoryTypeModal').data('is-system'),
                isHidden: modalMode === 'create' ? (window.currentScope ? true : false) : $('#categoryTypeModal').data('is-hidden')
            },
            categories: categories
        };

        const url = modalMode === 'edit'
            ? '/CategoryType/UpdateWithCategories/' + editingCategoryTypeId
            : '/CategoryType/Create';
        const method = modalMode === 'edit' ? 'PUT' : 'POST';

        $.ajax({
            url: url,
            type: method,
            contentType: 'application/json',
            data: JSON.stringify(request),
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(response.message || 'Lưu thành công', 'Thành công');
                    $('#categoryTypeModal').modal('hide');
                    selectedIds = [];
                    reloadList();
                } else {
                    if (response.errors && response.errors.length > 0) {
                        response.errors.forEach(function (err) { toastr.error(err, 'Lỗi'); });
                    } else {
                        toastr.error(response.message || 'Có lỗi xảy ra', 'Lỗi');
                    }
                }
            },
            error: function (xhr) {
                let error = 'Lỗi khi lưu loại danh mục';
                if (xhr.responseJSON?.message) error = xhr.responseJSON.message;
                toastr.error(error, 'Lỗi');
            },
            complete: function () {
                isSubmitting = false;
                $btn.prop('disabled', false).html(originalHtml);
            }
        });
    }

    // ── Code Generation Helpers ───────────────────────────────────────────

    function generateAutoCode(name, prefix) {
        if (!name) return '';
        const abbrev = generateAbbreviation(name);
        return abbrev ? `${prefix}_${abbrev}` : prefix;
    }

    function generateAutoSubCode(name, typeCode, index) {
        if (!name) return '';
        const padIndex = (index.toString().padStart(2, '0'));
        return `${typeCode}${padIndex}`;
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
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'D')
            .replace(/[^a-zA-Z0-9\s]/g, '').trim();
    }

    function escapeHtml(text) {
        if (!text) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.toString().replace(/[&<>"']/g, function (m) { return map[m]; });
    }

    // ── Initialization ────────────────────────────────────────────────────

    $(document).ready(function () {
        bindCheckboxEvents();

        // Add
        $(document).on('click', '#btnShowCreate', showCreateModal);

        // Edit
        $(document).on('click', '.btn-edit', function () {
            const id = $(this).data('id');
            resetForm();
            editingCategoryTypeId = id;
            setModalMode('edit');
            loadCategoryTypeData(id);
        });

        // Delete
        $(document).on('click', '.btn-delete', function () {
            isBulkDelete = false;
            deleteId = $(this).data('id');
            $('#deleteCategoryTypeName').text($(this).data('name'));
            $('#deleteModal').modal('show');
        });

        // Bulk Delete
        $(document).on('click', '#btnBulkDelete', function () {
            if (selectedIds.length === 0) return;
            isBulkDelete = true;
            deleteId = selectedIds;
            $('#deleteCategoryTypeName').text(selectedIds.length + ' mục đã chọn');
            $('#deleteModal').modal('show');
        });

        // Confirm Delete
        $(document).on('click', '#btnConfirmDelete', function () {
            if (!deleteId || (isBulkDelete && deleteId.length === 0)) return;

            $('#btnConfirmDelete').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Xóa');

            const url = isBulkDelete ? '/CategoryType/DeleteMultiple' : '/CategoryType/Delete/' + deleteId;
            const method = 'DELETE';
            const body = isBulkDelete ? JSON.stringify(deleteId) : null;
            const token = $('input[name="__RequestVerificationToken"]').val();

            $.ajax({
                url: url,
                type: method,
                contentType: isBulkDelete ? 'application/json' : undefined,
                headers: { 'RequestVerificationToken': token },
                data: body,
                success: function (response) {
                    if (response.isSuccess) {
                        toastr.success(response.message || 'Xóa thành công', 'Thành công');
                        $('#deleteModal').modal('hide');
                        selectedIds = [];
                        reloadList();
                    } else {
                        toastr.error(response.message || 'Có lỗi xảy ra', 'Lỗi');
                    }
                },
                error: function (xhr) {
                    let msg = 'Có lỗi xảy ra khi xóa';
                    if (xhr.responseJSON?.message) msg = xhr.responseJSON.message;
                    toastr.error(msg, 'Lỗi');
                },
                complete: function () {
                    $('#btnConfirmDelete').prop('disabled', false).html('<i class="fas fa-trash-alt mr-1"></i> Xóa');
                }
            });
        });

        // Save
        $(document).on('click', '#btnSave', saveCategoryType);

        // Sub-categories helpers
        $(document).on('click', '#btnAddCategory', addCategoryRow);
        $(document).on('click', '.btn-remove-category', function () {
            removeCategoryRow($(this).data('index'));
        });

        // Auto-generation events
        $(document).on('input', '#categoryTypeName', function () {
            const name = $(this).val();
            const $code = $('#categoryTypeCode');
            const currentCode = $code.val();
            if (!$code.val() || $code.data('auto-generated') === currentCode || modalMode === 'create') {
                const code = generateAutoCode(name, 'DM');
                $code.val(code).data('auto-generated', code);
            }
        });

        $(document).on('input', '.category-name', function () {
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

        // Sync re-init on partial reload
        $(document).on('quickSearchComplete', function () {
            selectedIds = [];
            updateBulkDeleteBtn();
            bindCheckboxEvents();
        });
    });
})();
