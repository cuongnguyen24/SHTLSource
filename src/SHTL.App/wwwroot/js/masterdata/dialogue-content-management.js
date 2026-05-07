/**
 * Dialogue Content Management JavaScript
 * Module: M0094 - Quy chế Dân chủ và Đối thoại
 */
$(document).ready(function () {
    let table;
    let deleteId = null;
    let editingId = null;
    let isSubmitting = false;
    let allGroups = [];
    let rawItems = [];
    const expandedGroupIds = new Set();
    let formMode = 'content'; // group | content | edit

    // Initialize DataTable with Figma styling
    table = $('#dialogueContentTable').DataTable({
        processing: true,
        serverSide: false,
        ajax: {
            url: '/DialogueContent/GetAll',
            type: 'GET',
            data: function (d) {
                return {
                    search: $('#customSearchInput').val(),
                    isActive: $('#filterStatus').val() || null,
                    page: 1,
                    pageSize: 1000
                };
            },
            dataSrc: function (json) {
                if (json.success && json.data && json.data.items) {
                    rawItems = json.data.items || [];
                    $('#totalCount').text(rawItems.length || 0);
                    return buildVisibleRows(rawItems);
                }
                $('#totalCount').text(0);
                rawItems = [];
                return [];
            },
            error: function (xhr, error, code) {
                console.error('DataTables error:', error, code);
                toastr.error('Không thể tải danh sách nội dung đối thoại. Vui lòng thử lại.', 'Lỗi');
            }
        },
        dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
        drawCallback: function(settings) {
            const $container = $('.pagination-figma-container');
            if ($container.length && $('#paginationFrame').length) {
                $container.appendTo('#paginationFrame');
            }

            // STT
            var api = this.api();
            var startIndex = api.context[0]._iDisplayStart;
            api.column(0, {page:'current'}).nodes().each(function (cell, i) {
                cell.innerHTML = startIndex + i + 1;
            });
        },
        autoWidth: false,
        order: [],
        columns: [
            {
                data: null,
                orderable: false,
                searchable: false,
                className: 'text-center',
                defaultContent: ''
            },
            {
                data: 'name',
                render: function(data, type, row) {
                    const style = row.parentId ? '' : 'font-weight: 600; color: #1e293b;';
                    const displayName = escapeHtml(data);
                    const hasChildren = !!row.__hasChildren;
                    const isExpanded = !!row.__expanded;

                    const toggleIcon = isExpanded ? '<i class="fas fa-chevron-down"></i>' : '<i class="fas fa-chevron-right"></i>';
                    const toggleButton = row.parentId
                        ? '<span class="dialogue-child-indent">↳</span>'
                        : `<button type="button" class="btn-toggle-children ${hasChildren ? '' : 'disabled'}" data-id="${row.id}" ${hasChildren ? '' : 'tabindex="-1" aria-hidden="true"'}>${toggleIcon}</button>`;

                    const parentHint = row.parentId
                        ? `<div style="font-size:11px;color:#64748b;">Nhóm cha: ${escapeHtml(row.__parentName || row.parentName || '--')}</div>`
                        : (hasChildren ? `<div style="font-size:11px;color:#64748b;">${row.__childCount} nhóm con</div>` : '');

                    if (window.userPermissions && window.userPermissions.canUpdate) {
                        return `<div class="dialogue-name-cell">${toggleButton}<div><a href="javascript:void(0)" class="btn-edit" data-id="${row.id}" style="${style}">${displayName}</a>${parentHint}</div></div>`;
                    }
                    return `<div class="dialogue-name-cell">${toggleButton}<div><span style="${style}">${displayName}</span>${parentHint}</div></div>`;
                }
            },
            {
                data: 'code',
                render: function(data) {
                    return data ? `<code style="font-size: 11px; background: #f1f5f9; padding: 2px 6px; border-radius: 3px;">${escapeHtml(data)}</code>` : '<span class="text-muted">--</span>';
                }
            },
            {
                data: 'isActive',
                className: 'text-center',
                render: function (data) {
                    return data
                        ? '<span class="badge badge-success" style="font-size: 11px; padding: 4px 8px;">Active</span>'
                        : '<span class="badge badge-secondary" style="font-size: 11px; padding: 4px 8px;">Inactive</span>';
                }
            },
            {
                data: null,
                orderable: false,
                className: 'text-center',
                render: function (data, type, row) {
                    let html = '<div class="table-actions-figma" style="justify-content: center;">';
                    if (window.userPermissions && window.userPermissions.canUpdate) {
                        html += `<button type="button" class="btn-action-figma btn-action-edit btn-edit" data-id="${row.id}" title="Chỉnh sửa"><i class="fas fa-pen"></i></button>`;
                    }
                    if (window.userPermissions && window.userPermissions.canDelete) {
                        html += `<button type="button" class="btn-action-figma btn-action-delete btn-delete" data-id="${row.id}" data-name="${escapeHtml(row.name)}" title="Xóa"><i class="fas fa-trash-alt"></i></button>`;
                    }
                    html += '</div>';
                    return html;
                }
            }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/vi.json',
            emptyTable: 'Không có dữ liệu',
            zeroRecords: 'Không tìm thấy kết quả phù hợp'
        },
        pageLength: 25,
        lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]]
    });

    // Search functionality
    let searchTimer;
    $('#customSearchInput').on('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => table.ajax.reload(), 400);
    });

    $('#filterStatus').on('change', function () {
        table.ajax.reload();
    });

    $('#btnRefreshTable').on('click', function () {
        $('#customSearchInput').val('');
        $('#filterStatus').val('');
        expandedGroupIds.clear();
        table.ajax.reload();
    });

    // Expand/collapse child groups
    $(document).on('click', '.btn-toggle-children', function () {
        const id = $(this).data('id');
        if (!id) return;
        if (expandedGroupIds.has(id)) {
            expandedGroupIds.delete(id);
        } else {
            expandedGroupIds.add(id);
        }
        redrawFromCurrentData();
    });

    // Load groups for dropdown
    function loadGroups(callback) {
        $.ajax({
            url: '/DialogueContent/GetGroups',
            type: 'GET',
            success: function (res) {
                if (res.success && res.data) {
                    allGroups = res.data;
                    const options = allGroups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
                    $('#parentId').html(`<option value="">-- Không có (nhóm cha) --</option>${options}`);
                    if (callback) callback();
                }
            },
            error: function () {
                toastr.error('Không thể tải danh sách nhóm');
            }
        });
    }

    // Add Group button
    $('#btnAddGroup').on('click', function () {
        resetForm();
        editingId = null;
        formMode = 'group';
        $('#isGroup').val('true');
        $('#parentGroupContainer').hide();
        $('#modalTitle').html('<i class="fas fa-plus mr-2"></i>Thêm nhóm nội dung');
        $('#dialogueContentModal').modal('show');
    });

    // Add Content button
    $('#btnAddContent').on('click', function () {
        resetForm();
        editingId = null;
        formMode = 'content';
        $('#isGroup').val('false');
        $('#parentGroupContainer').show();
        $('#modalTitle').html('<i class="fas fa-plus mr-2"></i>Thêm nội dung đối thoại');
        loadGroups(function() {
            $('#dialogueContentModal').modal('show');
        });
    });

    // Edit button
    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        editingId = id;

        $.ajax({
            url: `/DialogueContent/GetById/${id}`,
            type: 'GET',
            success: function (res) {
                if (res.success && res.data) {
                    const data = res.data;
                    formMode = 'edit';
                    $('#dialogueContentId').val(data.id);
                    $('#name').val(data.name);
                    $('#code').val(data.code || '');
                    $('#description').val(data.description || '');
                    $('#isActive').prop('checked', data.isActive);

        // Always show parent selector in edit mode so user can change parent.
        $('#parentGroupContainer').show();
        $('#isGroup').val(data.parentId ? 'false' : 'true');

                    loadGroups(function() {
            // Prevent self-parent selection
            $(`#parentId option[value="${data.id}"]`).remove();

            if (data.parentId && $(`#parentId option[value="${data.parentId}"]`).length === 0) {
                const currentParentName = findNameById(data.parentId);
                $('#parentId').append(`<option value="${data.parentId}">${escapeHtml(currentParentName || '(Nhóm cha hiện tại)')}</option>`);
                        }
            $('#parentId').val(data.parentId || '');

            $('#modalTitle').html('<i class="fas fa-edit mr-2"></i>Chỉnh sửa nội dung/nhóm');
                        $('#dialogueContentModal').modal('show');
                    });
                } else {
                    toastr.error(res.message || 'Không thể tải thông tin danh mục');
                }
            },
            error: function (xhr) {
                toastr.error(extractAjaxErrorMessage(xhr, 'Không thể kết nối đến máy chủ'));
            }
        });
    });

    // Save button
    $('#btnSaveDialogueContent').on('click', function () {
        if (isSubmitting) return;

        const name = $('#name').val().trim();
        if (!name) {
            toastr.warning('Vui lòng nhập tên nội dung đối thoại');
            $('#name').focus();
            return;
        }

        const isEdit = !!editingId;
        const parentValue = $('#parentId').val() || null;
        if (!isEdit && formMode === 'content' && !parentValue) {
            toastr.warning('Vui lòng chọn NHÓM CHA khi thêm nội dung');
            $('#parentId').focus();
            return;
        }
        let parentIdToSave = null;
        if (isEdit) {
            parentIdToSave = parentValue;
        } else if (formMode === 'content') {
            parentIdToSave = parentValue;
        }
        const requestData = {
            Name: name,
            Code: $('#code').val().trim() || null,
            CategoryTypeId: window.userPermissions.categoryTypeId || null,
            ParentId: parentIdToSave,
            Description: $('#description').val().trim() || null,
            DisplayOrder: 0,
            IsActive: $('#isActive').is(':checked')
        };

        let url = '/DialogueContent/Create';
        if (isEdit) {
            url = `/DialogueContent/Update/${editingId}`;
        } else if (formMode === 'content') {
            url = '/DialogueContent/CreateContent';
        }

        isSubmitting = true;
        $('#btnSaveDialogueContent').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        $.ajax({
            url: url,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(requestData),
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (res) {
                if (res.success) {
                    toastr.success(isEdit ? 'Cập nhật thành công' : 'Thêm mới thành công');
                    $('#dialogueContentModal').modal('hide');
                    table.ajax.reload(null, false);
                } else {
                    toastr.error(res.message || 'Thao tác thất bại');
                }
            },
            error: function (xhr) {
                toastr.error(extractAjaxErrorMessage(xhr, 'Không thể kết nối đến máy chủ'));
            },
            complete: function () {
                isSubmitting = false;
                $('#btnSaveDialogueContent').prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu');
            }
        });
    });

    // Delete button
    $(document).on('click', '.btn-delete', function () {
        deleteId = $(this).data('id');
        const name = $(this).data('name');
        $('#deleteItemName').text(name);
        $('#deleteModal').modal('show');
    });

    $('#btnConfirmDelete').on('click', function () {
        if (!deleteId) return;

        $.ajax({
            url: `/DialogueContent/Delete/${deleteId}`,
            type: 'POST',
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (res) {
                if (res.success) {
                    toastr.success('Đã xóa danh mục thành công');
                    $('#deleteModal').modal('hide');
                    table.ajax.reload(null, false);
                } else {
                    toastr.error(res.message || 'Xóa thất bại. Danh mục có thể đang được sử dụng.');
                }
            },
            error: function (xhr) {
                toastr.error(extractAjaxErrorMessage(xhr, 'Không thể kết nối đến máy chủ'));
            }
        });
    });

    // Reset form
    function resetForm() {
        $('#dialogueContentForm')[0].reset();
        $('#dialogueContentId').val('');
        $('#isGroup').val('false');
        formMode = 'content';
        $('#isActive').prop('checked', true);
        $('#parentId').val('');
    }

    function redrawFromCurrentData() {
        const visible = buildVisibleRows(rawItems);
        table.clear();
        table.rows.add(visible);
        table.draw(false);
    }

    function buildVisibleRows(items) {
        if (!Array.isArray(items) || items.length === 0) return [];

        const parentRows = [];
        const childMap = {};
        const parentNameById = {};

        items.forEach(item => {
            if (!item || !item.id) return;
            parentNameById[item.id] = item.name || '';
            if (item.parentId) {
                if (!childMap[item.parentId]) childMap[item.parentId] = [];
                childMap[item.parentId].push(item);
            } else {
                parentRows.push(item);
            }
        });

        const visible = [];
        parentRows.forEach(parent => {
            const children = childMap[parent.id] || [];
            const expanded = expandedGroupIds.has(parent.id);
            visible.push({
                ...parent,
                __hasChildren: children.length > 0,
                __childCount: children.length,
                __expanded: expanded
            });

            if (expanded) {
                children.forEach(child => {
                    visible.push({
                        ...child,
                        __hasChildren: false,
                        __expanded: false,
                        __parentName: parentNameById[child.parentId] || ''
                    });
                });
            }
        });

        // Include orphan child rows if parent not in current dataset
        items.filter(x => x && x.parentId && !parentNameById[x.parentId]).forEach(orphan => {
            visible.push({
                ...orphan,
                __hasChildren: false,
                __expanded: false,
                __parentName: '(Không tìm thấy nhóm cha)'
            });
        });

        return visible;
    }

    function findNameById(id) {
        if (!id) return '';
        const item = rawItems.find(x => x && x.id === id);
        return item ? item.name : '';
    }

    function extractAjaxErrorMessage(xhr, fallback) {
        if (!xhr) return fallback;
        if (xhr.responseJSON) {
            if (typeof xhr.responseJSON.message === 'string' && xhr.responseJSON.message.trim()) {
                return xhr.responseJSON.message;
            }
            if (typeof xhr.responseJSON.title === 'string' && xhr.responseJSON.title.trim()) {
                return xhr.responseJSON.title;
            }
        }
        if (typeof xhr.responseText === 'string' && xhr.responseText.trim()) {
            try {
                const parsed = JSON.parse(xhr.responseText);
                if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
                    return parsed.message;
                }
            } catch (_) {
                // fallback below
            }
            return xhr.responseText.length > 180 ? `${xhr.responseText.substring(0, 180)}...` : xhr.responseText;
        }
        return fallback;
    }

    // Escape HTML
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
