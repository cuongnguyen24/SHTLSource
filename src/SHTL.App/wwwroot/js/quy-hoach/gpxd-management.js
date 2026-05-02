/**
 * GPXD Management JS
 * Handles filtering, toggling advanced search, and delegated events for list actions.
 */
(function($) {
    'use strict';

    $(function() {
        // 1. Toggle Advanced Filter
        $(document).on('click', '#btnToggleAdvancedFilter', function(e) {
            e.preventDefault();
            $('#advancedFilterArea').toggleClass('show');
            $(this).toggleClass('active');
        });

        // 2. Reset Filter Form
        $(document).on('click', '.btnResetFilter', function(e) {
            e.preventDefault();
            const $form = $(this).closest('form');
            $form[0].reset();
            // Clear Select2 if present
            $form.find('select.select2').val('').trigger('change');
            $form.submit();
        });

        // 3. Delegation for Action Buttons (Edit, Delete, Toggle, etc.)
        
        // --- Template Actions (M0202) ---
        $(document).on('click', '#btnAddTemplate', function() {
            $('#templateId').val('');
            $('#templateFileId').val('');
            $('#templateTenFile').val('');
            $('#frmTemplateModal')[0].reset();
            $('#templateModalTitle').html('<i class="fas fa-file-word mr-2"></i>Thêm mẫu biểu mới');
            $('#templateFileName').text('Chọn file...');
            $('#templateModal').modal('show');
        });

        $(document).on('click', '.btnEditTemplate', function() {
            const id = $(this).data('id');
            $('#frmTemplateModal')[0].reset();
            $('#templateId').val(id);
            $('#templateModalTitle').html('<i class="fas fa-file-word mr-2"></i>Chỉnh sửa mẫu biểu');
            
            $.get('/CapPhepXayDungDanhMuc/GetTemplate/' + id, function(res) {
                if (res.success && res.data) {
                    const d = res.data;
                    $('#templateLoaiB').val(d.loaiB).trigger('change');
                    $('#templatePhienBan').val(d.phienBan);
                    $('#templateGhiChu').val(d.ghiChu);
                    $('#templateFileId').val(d.fileId);
                    $('#templateTenFile').val(d.tenFile);
                    if (d.ngayApDung) {
                        $('#templateNgayApDung').val(d.ngayApDung.split('T')[0]);
                    }
                    $('#templateFileName').text(d.tenFile || 'Chọn file...');
                }
            });
            $('#templateModal').modal('show');
        });

        $(document).on('click', '.btnDeleteTemplate', function() {
            const id = $(this).data('id');
            const name = $(this).data('name');
            if (window.FigmaUI && FigmaUI.confirm) {
                FigmaUI.confirm({
                    title: 'Xác nhận xóa',
                    message: `Bạn có chắc chắn muốn xóa mẫu biểu "${name}"?`,
                    onConfirm: function() {
                        $.post('/CapPhepXayDungDanhMuc/DeleteTemplate/' + id, { __RequestVerificationToken: $('input[name="__RequestVerificationToken"]').val() })
                            .done(function(res) {
                                if (res.isSuccess) {
                                    toastr.success('Đã xóa thành công.');
                                    $('#frmTemplates').submit();
                                } else {
                                    toastr.error(res.message || 'Lỗi khi xóa.');
                                }
                            });
                    }
                });
            }
        });

        $(document).on('click', '.btnToggleActiveTemplate', function() {
            const id = $(this).data('id');
            const currentStatus = $(this).data('status'); // 2: DangApDung, 1: Nhap
            const isActive = (currentStatus == 2);
            const url = isActive ? '/CapPhepXayDungDanhMuc/DeactivateTemplate/' + id : '/CapPhepXayDungDanhMuc/ActivateTemplate/' + id;
            
            $.post(url, { __RequestVerificationToken: $('input[name="__RequestVerificationToken"]').val() })
                .done(function(res) {
                    if (res.isSuccess) {
                        toastr.success('Cập nhật trạng thái thành công.');
                        $('#frmTemplates').submit();
                    } else {
                        toastr.error(res.message || 'Lỗi khi cập nhật.');
                    }
                });
        });

        $(document).on('change', '#templateFile', function() {
            const fileName = $(this).val().split('\\').pop() || 'Chọn file...';
            $('#templateFileName').text(fileName);
        });

        $(document).on('click', '#btnSaveTemplate', function() {
            const form = document.getElementById('frmTemplateModal');
            if (!form.checkValidity()) { form.reportValidity(); return; }

            const id = $('#templateId').val();
            const hasFile = $('#templateFile')[0].files.length > 0;
            
            if (!id) {
                const formData = new FormData(form);
                formData.append('__RequestVerificationToken', $('input[name="__RequestVerificationToken"]').val());
                $.ajax({
                    url: '/CapPhepXayDungDanhMuc/UploadTemplate',
                    type: 'POST',
                    data: formData,
                    processData: false,
                    contentType: false,
                    success: function(res) {
                        if (res.isSuccess) {
                            toastr.success('Lưu thành công.');
                            $('#templateModal').modal('hide');
                            $('#frmTemplates').submit();
                        } else {
                            toastr.error(res.message || 'Lỗi khi lưu.');
                        }
                    }
                });
            } else {
                if (hasFile) {
                    const formData = new FormData(form);
                    formData.append('__RequestVerificationToken', $('input[name="__RequestVerificationToken"]').val());
                    $.ajax({
                        url: '/CapPhepXayDungDanhMuc/ReplaceTemplateFile/' + id,
                        type: 'POST',
                        data: formData,
                        processData: false,
                        contentType: false,
                        success: function(res) {
                            if (res.isSuccess) {
                                toastr.success('Cập nhật file thành công.');
                                $('#templateModal').modal('hide');
                                $('#frmTemplates').submit();
                            } else { toastr.error(res.message || 'Lỗi khi cập nhật.'); }
                        }
                    });
                } else {
                    const data = {
                        PhienBan: $('#templatePhienBan').val(),
                        NgayApDung: $('#templateNgayApDung').val(),
                        GhiChu: $('#templateGhiChu').val(),
                        TenFile: $('#templateTenFile').val(),
                        FileId: $('#templateFileId').val() || null
                    };
                    $.ajax({
                        url: '/CapPhepXayDungDanhMuc/UpdateTemplate/' + id,
                        type: 'POST',
                        data: JSON.stringify(data),
                        contentType: 'application/json',
                        headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
                        success: function(res) {
                            if (res.isSuccess) {
                                toastr.success('Cập nhật thông tin thành công.');
                                $('#templateModal').modal('hide');
                                $('#frmTemplates').submit();
                            } else { toastr.error(res.message || 'Lỗi khi cập nhật.'); }
                        }
                    });
                }
            }
        });


        // --- Attachment Template Actions (M0204) ---
        $(document).on('click', '#btnAddAttTemplate', function() {
            $('#attId').val('');
            $('#attFileId').val('');
            $('#attFileNameHidden').val('');
            $('#frmAttTemplateModal')[0].reset();
            $('#attTemplateModalTitle').html('<i class="fas fa-file-alt mr-2"></i>Thêm loại tài liệu mới');
            $('#attFileName').text('Chọn file...');
            $('#attTemplateModal').modal('show');
        });

        $(document).on('click', '.btnEditAtt', function() {
            const id = $(this).data('id');
            $('#frmAttTemplateModal')[0].reset();
            $('#attId').val(id);
            $('#attTemplateModalTitle').html('<i class="fas fa-file-alt mr-2"></i>Chỉnh sửa loại tài liệu');
            
            $.get('/CapPhepXayDungDanhMuc/GetAttachmentTemplate/' + id, function(res) {
                if (res.success && res.data) {
                    const d = res.data;
                    $('#attLoaiNghiepVu').val(d.loaiNghiepVu).trigger('change');
                    $('#attMa').val(d.maLoaiTaiLieu);
                    $('#attTen').val(d.tenLoaiTaiLieu);
                    $('#attThuTu').val(d.thuTu);
                    $('#attBatBuoc').prop('checked', d.batBuoc);
                    $('#attMoTa').val(d.moTa);
                    $('#attFileId').val(d.fileId);
                    $('#attFileNameHidden').val(d.fileName);
                    if (d.ngayApDung) {
                        const datePart = d.ngayApDung.indexOf('T') > -1 ? d.ngayApDung.split('T')[0] : d.ngayApDung;
                        $('#attNgayApDung').val(datePart);
                    }
                    $('#attFileName').text(d.fileName || 'Chọn file...');
                }
            });
            $('#attTemplateModal').modal('show');
        });

        $(document).on('click', '.btnDeleteAtt', function() {
            const id = $(this).data('id');
            const name = $(this).data('name');
            if (window.FigmaUI && FigmaUI.confirm) {
                FigmaUI.confirm({
                    title: 'Xác nhận xóa',
                    message: `Bạn có chắc chắn muốn xóa loại tài liệu "${name}"?`,
                    onConfirm: function() {
                        $.post('/CapPhepXayDungDanhMuc/DeleteAttachmentTemplate/' + id, { __RequestVerificationToken: $('input[name="__RequestVerificationToken"]').val() })
                            .done(function(res) {
                                if (res.isSuccess) {
                                    toastr.success('Đã xóa thành công.');
                                    $('#frmAttTemplates').submit();
                                } else {
                                    toastr.error(res.message || 'Lỗi khi xóa.');
                                }
                            });
                    }
                });
            }
        });

        $(document).on('click', '.btnToggleActiveAtt', function() {
            const id = $(this).data('id');
            const currentStatus = $(this).data('status'); // 2: DangApDung, 1: Nhap
            const isActive = (currentStatus == 2);
            const url = isActive ? '/CapPhepXayDungDanhMuc/DeactivateAttachmentTemplate/' + id : '/CapPhepXayDungDanhMuc/ActivateAttachmentTemplate/' + id;
            
            $.post(url, { __RequestVerificationToken: $('input[name="__RequestVerificationToken"]').val() })
                .done(function(res) {
                    if (res.isSuccess) {
                        toastr.success('Cập nhật trạng thái thành công.');
                        $('#frmAttTemplates').submit();
                    } else {
                        toastr.error(res.message || 'Lỗi khi cập nhật.');
                    }
                });
        });

        $(document).on('change', '#attFile', function() {
            const fileName = $(this).val().split('\\').pop() || 'Chọn file...';
            $('#attFileName').text(fileName);
        });

        $(document).on('click', '#btnSaveAttTemplate', function() {
            const form = document.getElementById('frmAttTemplateModal');
            if (!form.checkValidity()) { form.reportValidity(); return; }

            const id = $('#attId').val();
            const hasFile = $('#attFile')[0].files.length > 0;
            
            if (!id) {
                const formData = new FormData(form);
                formData.append('__RequestVerificationToken', $('input[name="__RequestVerificationToken"]').val());
                $.ajax({
                    url: '/CapPhepXayDungDanhMuc/UploadAttachmentTemplate',
                    type: 'POST',
                    data: formData,
                    processData: false,
                    contentType: false,
                    success: function(res) {
                        if (res.isSuccess) {
                            toastr.success('Tạo mới thành công.');
                            $('#attTemplateModal').modal('hide');
                            $('#frmAttTemplates').submit();
                        } else { toastr.error(res.message || 'Lỗi khi tạo mới.'); }
                    }
                });
            } else {
                if (hasFile) {
                    const formData = new FormData(form);
                    formData.append('__RequestVerificationToken', $('input[name="__RequestVerificationToken"]').val());
                    $.ajax({
                        url: '/CapPhepXayDungDanhMuc/ReplaceAttachmentTemplateFile/' + id,
                        type: 'POST',
                        data: formData,
                        processData: false,
                        contentType: false,
                        success: function(res) {
                            if (res.isSuccess) {
                                toastr.success('Cập nhật file thành công.');
                                $('#attTemplateModal').modal('hide');
                                $('#frmAttTemplates').submit();
                            } else { toastr.error(res.message || 'Lỗi khi cập nhật.'); }
                        }
                    });
                } else {
                    const data = {
                        TenLoaiTaiLieu: $('#attTen').val(),
                        NgayApDung: $('#attNgayApDung').val(),
                        BatBuoc: $('#attBatBuoc').is(':checked'),
                        ThuTu: parseInt($('#attThuTu').val()) || 1,
                        MoTa: $('#attMoTa').val(),
                        FileName: $('#attFileNameHidden').val(),
                        FileId: $('#attFileId').val() || null
                    };
                    $.ajax({
                        url: '/CapPhepXayDungDanhMuc/UpdateAttachmentTemplate/' + id,
                        type: 'POST',
                        data: JSON.stringify(data),
                        contentType: 'application/json',
                        headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
                        success: function(res) {
                            if (res.isSuccess) {
                                toastr.success('Cập nhật thông tin thành công.');
                                $('#attTemplateModal').modal('hide');
                                $('#frmAttTemplates').submit();
                            } else { toastr.error(res.message || 'Lỗi khi cập nhật.'); }
                        }
                    });
                }
            }
        });


        // --- Category Actions (M0203) ---
        $(document).on('click', '#btnAddCategory', function() {
            $('#categoryId').val('');
            $('#frmCategoryModal')[0].reset();
            $('#categoryModalTitle').html('<i class="fas fa-list-ul mr-2"></i>Thêm danh mục mới');
            $('#tblSubCategories tbody').html('<tr class="empty-row"><td colspan="4" class="text-center text-muted small py-2">Chưa có giá trị nào</td></tr>');
            $('#categoryModal').modal('show');
        });

        $(document).on('click', '.btnEditCategoryType', function() {
            const id = $(this).data('id');
            $('#categoryId').val(id);
            $('#categoryModalTitle').html('<i class="fas fa-list-ul mr-2"></i>Chỉnh sửa danh mục');
            
            $.get('/CapPhepXayDungDanhMuc/GetCategoryType/' + id, function(res) {
                if (res.success && res.data) {
                    const data = res.data;
                    $('#categoryCode').val(data.code);
                    $('#categoryName').val(data.name);
                    $('#categoryOrder').val(data.displayOrder);
                    $('#categoryIsActive').prop('checked', data.isActive);
                    $('#categoryDescription').val(data.description);
                    
                    $.get('/CapPhepXayDungDanhMuc/GetCategories/' + id, function(subRes) {
                        let html = '';
                        if (subRes.success && subRes.data && subRes.data.length > 0) {
                            subRes.data.forEach(function(item) {
                                html += `<tr data-id="${item.id}">
                                    <td><input type="text" class="form-control form-control-sm sub-code" value="${item.code}" required /></td>
                                    <td><input type="text" class="form-control form-control-sm sub-name" value="${item.name}" required /></td>
                                    <td><input type="number" class="form-control form-control-sm sub-order" value="${item.displayOrder}" min="1" /></td>
                                    <td class="text-center"><button type="button" class="btn btn-sm btn-link text-danger btnRemoveSub"><i class="fas fa-times"></i></button></td>
                                </tr>`;
                            });
                        } else {
                            html = '<tr class="empty-row"><td colspan="4" class="text-center text-muted small py-2">Chưa có giá trị nào</td></tr>';
                        }
                        $('#tblSubCategories tbody').html(html);
                    });
                }
            });
            $('#categoryModal').modal('show');
        });

        $(document).on('click', '#btnAddSubCategory', function() {
            $('#tblSubCategories tbody .empty-row').remove();
            const html = `<tr data-id="">
                <td><input type="text" class="form-control form-control-sm sub-code" placeholder="Mã..." required /></td>
                <td><input type="text" class="form-control form-control-sm sub-name" placeholder="Tên giá trị..." required /></td>
                <td><input type="number" class="form-control form-control-sm sub-order" value="1" min="1" /></td>
                <td class="text-center"><button type="button" class="btn btn-sm btn-link text-danger btnRemoveSub"><i class="fas fa-times"></i></button></td>
            </tr>`;
            $('#tblSubCategories tbody').append(html);
        });

        $(document).on('click', '.btnRemoveSub', function() {
            $(this).closest('tr').remove();
            if ($('#tblSubCategories tbody tr').length === 0) {
                $('#tblSubCategories tbody').html('<tr class="empty-row"><td colspan="4" class="text-center text-muted small py-2">Chưa có giá trị nào</td></tr>');
            }
        });

        $(document).on('click', '#btnSaveCategory', function() {
            const form = document.getElementById('frmCategoryModal');
            if (!form.checkValidity()) { form.reportValidity(); return; }

            const categories = [];
            $('#tblSubCategories tbody tr:not(.empty-row)').each(function() {
                categories.push({
                    Id: $(this).data('id') || null,
                    Code: $(this).find('.sub-code').val(),
                    Name: $(this).find('.sub-name').val(),
                    DisplayOrder: parseInt($(this).find('.sub-order').val()) || 1,
                    IsActive: true
                });
            });

            const request = {
                CategoryType: {
                    Code: $('#categoryCode').val(),
                    Name: $('#categoryName').val(),
                    DisplayOrder: parseInt($('#categoryOrder').val()) || 1,
                    IsActive: $('#categoryIsActive').is(':checked'),
                    Description: $('#categoryDescription').val()
                },
                Categories: categories
            };

            const id = $('#categoryId').val();
            const url = id ? '/CapPhepXayDungDanhMuc/UpdateCategoryTypeWithCategories/' + id : '/CapPhepXayDungDanhMuc/CreateCategoryType';
            const method = id ? 'PUT' : 'POST';

            $.ajax({
                url: url,
                type: method,
                data: JSON.stringify(request),
                contentType: 'application/json',
                headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
                success: function(res) {
                    if (res.isSuccess) {
                        toastr.success('Lưu thành công.');
                        $('#categoryModal').modal('hide');
                        $('#frmCategories').submit();
                    } else { toastr.error(res.message || 'Lỗi khi lưu.'); }
                }
            });
        });

        $(document).on('click', '.btnDeleteCategoryType', function() {
            const id = $(this).data('id');
            const name = $(this).data('name');
            if (window.FigmaUI && FigmaUI.confirm) {
                FigmaUI.confirm({
                    title: 'Xác nhận xóa',
                    message: `Bạn có chắc chắn muốn xóa danh mục "${name}"?`,
                    onConfirm: function() {
                        $.ajax({
                            url: '/CapPhepXayDungDanhMuc/DeleteCategoryType/' + id,
                            type: 'DELETE',
                            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
                            success: function(res) {
                                if (res.isSuccess) {
                                    toastr.success('Xóa thành công.');
                                    $('#frmCategories').submit();
                                } else { toastr.error(res.message || 'Lỗi khi xóa.'); }
                            }
                        });
                    }
                });
            }
        });

    });

})(jQuery);
