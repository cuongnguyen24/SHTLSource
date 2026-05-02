/**
 * Legal Document Types Management JavaScript
 */
$(document).ready(function () {
    let table;
    let deleteId = null;
    let isSubmitting = false;

    table = $('#dataTable').dataTableFigma({
        ajax: {
            url: window.apiUrl + '/GetAll',
            dataSrc: '',
            error: function (xhr, error, code) {
                console.error('DataTables error (LegalDocumentType):', error, code);
                toastr.error('Không thể tải danh sách ' + window.entityName, 'Lỗi');
            }
        },
        dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
        drawCallback: function(settings) {
            FigmaDataTables.defaultConfig.drawCallback(settings);
            const $container = $('.pagination-figma-container');
            if ($container.length && $('#paginationFrame').length) {
                $container.appendTo('#paginationFrame');
            }
            var api = this.api();
            var startIndex = api.context[0]._iDisplayStart;
            api.column(0, {page:'current'}).nodes().each(function (cell, i) {
                cell.innerHTML = startIndex + i + 1;
            });
        },
        autoWidth: false,
        scrollX: false,
        columns: [
            { data: null, orderable: false, searchable: false, className: 'text-center', defaultContent: '' },
            { data: 'code', render: function(data) { return `<span style="font-weight: 600; color: #1e293b;">${escapeHtml(data)}</span>`; } },
            { data: 'name', render: function(data) { return escapeHtml(data); } },
            { data: 'description', render: function (data) { return data ? escapeHtml(data) : '<span class="text-muted">--</span>'; } },
            { data: 'displayOrder', className: 'text-center' },
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
        pageLength: 25,
        order: [[4, 'asc'], [1, 'asc']]
    });

    $('#customSearchInput').on('keyup', function (e) { if (e.key === 'Enter') $('#btnSearch').click(); });
    $('#btnSearch').click(function () { table.search($('#customSearchInput').val()); table.ajax.reload(); });
    $('#btnRefreshTable').click(function () { table.ajax.reload(); toastr.info('Đang làm mới dữ liệu...', 'Thông báo', { timeOut: 2000 }); });

    $('#btnAddItem').click(function () {
        resetForm();
        $('#modalTitle').text('Thêm mới ' + window.entityName);
        $('#code').prop('readonly', false);
        $('#itemModal').modal('show');
    });

    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        $.ajax({
            url: window.apiUrl + '/Details/' + id,
            type: 'GET',
            success: function (data) {
                $('.is-invalid').removeClass('is-invalid');
                $('.invalid-feedback').remove();
                $('#itemId').val(data.id);
                $('#code').val(data.code).prop('readonly', false);
                $('#name').val(data.name);
                $('#description').val(data.description || '');
                $('#displayOrder').val(data.displayOrder);
                $('#modalTitle').text('Chỉnh sửa ' + window.entityName);
                $('#itemModal').modal('show');
            },
            error: function (xhr) { 
                console.error('Error loading details:', xhr);
                toastr.error('Không thể tải thông tin', 'Lỗi'); 
            }
        });
    });

    $('#btnSaveItem').click(function () {
        if (isSubmitting || !validateForm()) return;

        const id = $('#itemId').val();
        const data = {
            code: $('#code').val().trim(),
            name: $('#name').val().trim(),
            description: $('#description').val().trim() || null,
            displayOrder: parseInt($('#displayOrder').val())
        };

        const url = id ? window.apiUrl + '/Update/' + id : window.apiUrl + '/Create';
        isSubmitting = true;
        $('#btnSaveItem').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        const token = $('input[name="__RequestVerificationToken"]').val();

        $.ajax({
            url: url,
            type: 'POST',
            contentType: 'application/json',
            headers: { 'RequestVerificationToken': token },
            data: JSON.stringify(data),
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(response.message || 'Lưu thành công', 'Thành công');
                    $('#itemModal').modal('hide');
                    table.ajax.reload();
                } else {
                    if (response.errors && response.errors.length > 0) { response.errors.forEach(function(err) { toastr.error(err, 'Lỗi'); }); } else { toastr.error(response.message || 'Có lỗi xảy ra', 'Lỗi'); }
                }
            },
            error: function (xhr) {
                console.error('Error saving item:', xhr);
                if (xhr.responseJSON) {
                    if (xhr.responseJSON.errors && Array.isArray(xhr.responseJSON.errors) && xhr.responseJSON.errors.length > 0) {
                        xhr.responseJSON.errors.forEach(function (err) {
                            toastr.error(err, 'Lỗi', { timeOut: 5000, closeButton: true, progressBar: true });
                        });
                        return;
                    } 
                    
                    if (xhr.status === 400 && xhr.responseJSON.errors && !Array.isArray(xhr.responseJSON.errors)) {
                        const errors = xhr.responseJSON.errors;
                        const errorMessages = [];
                        for (const key in errors) { errorMessages.push(...errors[key]); }
                        toastr.error(errorMessages.join('<br>'), 'Lỗi nhập liệu');
                        return;
                    }

                    if (xhr.responseJSON.message) {
                        toastr.error(xhr.responseJSON.message, 'Lỗi');
                        return;
                    }
                }
                toastr.error('Có lỗi xảy ra khi lưu', 'Lỗi');
            },
            complete: function () {
                isSubmitting = false;
                $('#btnSaveItem').prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu');
            }
        });
    });

    $(document).on('click', '.btn-delete', function () {
        deleteId = $(this).data('id');
        $('#deleteItemName').text($(this).data('name'));
        $('#deleteModal').modal('show');
    });

    $('#btnConfirmDelete').click(function () {
        const token = $('input[name="__RequestVerificationToken"]').val();
        $.ajax({
            url: window.apiUrl + '/Delete/' + deleteId,
            type: 'POST',
            headers: { 'RequestVerificationToken': token },
            success: function (response) {
                if (response.isSuccess) {
                    toastr.success(response.message || 'Xóa thành công', 'Thành công');
                    $('#deleteModal').modal('hide');
                    table.ajax.reload();
                } else {
                    if (response.errors && response.errors.length > 0) { response.errors.forEach(function(err) { toastr.error(err, 'Lỗi'); }); } else { toastr.error(response.message || 'Có lỗi xảy ra', 'Lỗi'); }
                }
            },
            error: function (xhr) {
                console.error('Error deleting item:', xhr);
                let error = 'Có lỗi xảy ra';
                if (xhr.responseJSON?.message) error = xhr.responseJSON.message;
                toastr.error(error, 'Lỗi');
            }
        });
    });

    function resetForm() {
        $('#itemForm')[0].reset();
        $('#itemId').val('');
        $('#displayOrder').val(1);
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
    }

    function validateForm() {
        let isValid = true;
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();

        if (!$('#code').val().trim()) {
            showError('#code', 'Mã là bắt buộc');
            isValid = false;
        }
        if (!$('#name').val().trim()) {
            showError('#name', 'Tên là bắt buộc');
            isValid = false;
        }
        const displayOrder = $('#displayOrder').val();
        if (!displayOrder || displayOrder < 1) {
            showError('#displayOrder', 'Thứ tự hiển thị phải lớn hơn 0');
            isValid = false;
        }
        return isValid;
    }

    function showError(selector, message) {
        const $field = $(selector);
        $field.addClass('is-invalid');
        $field.after(`<div class="invalid-feedback" style="display: block;">${message}</div>`);
    }
});
