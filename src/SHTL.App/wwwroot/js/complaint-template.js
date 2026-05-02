/**
 * complaint-template.js
 * SCR-NV-DM-002 — Quản lý template biểu mẫu đơn thư khiếu nại
 * Pattern: IIFE + DataTables server-side + file upload
 */
(function () {
    'use strict';

    // ── State ────────────────────────────────────────────────────────
    var table;
    var templateTypes = [];   // cache from API
    var currentEditId = null;
    var selectedFile = null;

    // ── Helpers ──────────────────────────────────────────────────────
    function escapeHtml(text) {
        if (text == null) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text)));
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return String(d.getDate()).padStart(2, '0') + '/' +
               String(d.getMonth() + 1).padStart(2, '0') + '/' +
               d.getFullYear();
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function getAntiForgeryToken() {
        var el = document.querySelector('input[name="__RequestVerificationToken"]');
        return el ? el.value : '';
    }

    function getFileIcon(fileName) {
        if (!fileName) return 'fas fa-file';
        var ext = fileName.split('.').pop().toLowerCase();
        if (ext === 'docx' || ext === 'doc') return 'fas fa-file-word';
        if (ext === 'xlsx' || ext === 'xls') return 'fas fa-file-excel';
        return 'fas fa-file-alt';
    }

    function badgeHtml(isActive) {
        return isActive
            ? '<span class="badge-active"><i class="fas fa-check-circle mr-1"></i>Đang dùng</span>'
            : '<span class="badge-inactive"><i class="fas fa-ban mr-1"></i>Vô hiệu</span>';
    }

    function showFieldError(id, msg) { $('#' + id).text(msg).show(); }
    function clearErrors() {
        ['tmplNameError', 'tmplLoaiError', 'tmplFileError'].forEach(function (id) {
            $('#' + id).hide().text('');
        });
    }

    // ── Load template types into cache + selects ──────────────────────
    function loadTemplateTypes() {
        $.ajax({
            url: '/Complaint/GetTemplateTypes',
            type: 'GET',
            success: function (result) {
                templateTypes = (result && result.success && result.data) ? result.data : [];

                // Populate filter dropdown
                var $filter = $('#filterLoaiTemplate');
                $filter.find('option:not(:first)').remove();
                templateTypes.forEach(function (t) {
                    $filter.append($('<option>').val(t.id).text(escapeHtml(t.name)));
                });

                // Populate modal select
                var $modal = $('#tmplLoai');
                $modal.find('option').remove();
                $modal.append($('<option>').val('').text('-- Chọn loại --'));
                templateTypes.forEach(function (t) {
                    $modal.append($('<option>').val(t.id).text(escapeHtml(t.name)));
                });
            },
            error: function () {
                // Fallback: populate with known codes from spec
                var fallback = [
                    { id: 'PHIEU_TIEP_NHAN', name: 'Phiếu tiếp nhận' },
                    { id: 'PHIEU_THU_LY',    name: 'Phiếu thụ lý' },
                    { id: 'QUYET_DINH_DOCX', name: 'Quyết định (DOCX)' },
                    { id: 'QUYET_DINH_PDF',  name: 'Quyết định (PDF)' },
                    { id: 'THONG_BAO',       name: 'Thông báo' }
                ];
                templateTypes = fallback;
                var $filter = $('#filterLoaiTemplate');
                var $modal = $('#tmplLoai');
                $modal.find('option').remove();
                $modal.append($('<option>').val('').text('-- Chọn loại --'));
                fallback.forEach(function (t) {
                    $filter.append($('<option>').val(t.id).text(t.name));
                    $modal.append($('<option>').val(t.id).text(t.name));
                });
            }
        });
    }

    // ── DataTable ─────────────────────────────────────────────────────
    function initDataTable() {
        table = $('#templateTable').dataTableFigma({
            processing: true,
            serverSide: true,
            ajax: {
                url: '/Complaint/GetTemplates',
                type: 'GET',
                data: function (d) {
                    var params = new URLSearchParams();
                    var pageSize = d.length;
                    var page = Math.floor(d.start / pageSize) + 1;
                    params.append('page', page);
                    params.append('pageSize', pageSize);

                    var loai = $('#filterLoaiTemplate').val();
                    var trangThai = $('#filterTrangThai').val();
                    if (loai) params.append('templateTypeId', loai);
                    if (trangThai) params.append('status', trangThai);

                    return params.toString();
                },
                dataSrc: function (json) {
                    if (!json.success) {
                        toastr.error(json.message || 'Không thể tải dữ liệu');
                        return [];
                    }
                    // Update DataTables recordsTotal/recordsFiltered
                    json.recordsTotal = json.total || 0;
                    json.recordsFiltered = json.total || 0;
                    return json.data || [];
                }
            },
            columns: [
                {
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    render: function (data, type, row, meta) {
                        return meta.row + meta.settings._iDisplayStart + 1;
                    }
                },
                {
                    data: 'name',
                    render: function (data, type, row) {
                        var html = '<div class="font-weight-500">' + escapeHtml(data) + '</div>';
                        if (row.fileName) {
                            var icon = getFileIcon(row.fileName);
                            html += '<div class="tmpl-filename"><i class="' + icon + ' mr-1"></i>' + escapeHtml(row.fileName) + '</div>';
                        }
                        return html;
                    }
                },
                {
                    data: 'templateTypeName',
                    render: function (data) {
                        return '<span style="font-size:12px;padding:2px 8px;background:#eff6ff;color:#3b82f6;border-radius:12px;font-weight:500;">' +
                               escapeHtml(data) + '</span>';
                    }
                },
                {
                    data: 'version',
                    className: 'text-center',
                    render: function (data) {
                        return data ? '<span style="font-family:monospace;font-size:12px;">v' + escapeHtml(String(data)) + '</span>' : '—';
                    }
                },
                {
                    data: 'createdAt',
                    className: 'text-center',
                    render: function (data) { return formatDate(data); }
                },
                {
                    data: 'isActive',
                    className: 'text-center',
                    render: function (data) { return badgeHtml(data); }
                },
                {
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    render: function (data, type, row) {
                        var canManage = window.userPermissions && window.userPermissions.canManageTemplate;
                        var html = '';

                        if (canManage) {
                            html += '<button type="button" class="btn-icon-figma btn-edit-tmpl" data-id="' + escapeHtml(row.id) + '" title="Sửa" style="color:var(--warning,#f59e0b);">' +
                                    '<i class="fas fa-edit"></i></button> ';

                            var toggleTitle = row.isActive ? 'Vô hiệu hóa' : 'Kích hoạt';
                            var toggleColor = row.isActive ? '#ef4444' : '#10b981';
                            var toggleIcon  = row.isActive ? 'fa-ban' : 'fa-check-circle';
                            html += '<button type="button" class="btn-icon-figma btn-toggle-tmpl" ' +
                                    'data-id="' + escapeHtml(row.id) + '" ' +
                                    'data-name="' + escapeHtml(row.name) + '" ' +
                                    'data-active="' + (row.isActive ? '1' : '0') + '" ' +
                                    'title="' + toggleTitle + '" style="color:' + toggleColor + ';">' +
                                    '<i class="fas ' + toggleIcon + '"></i></button>';
                        }
                        return html || '—';
                    }
                }
            ],
            autoWidth: false,
            scrollX: false,
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/vi.json',
                processing: '<i class="fas fa-spinner fa-spin fa-2x"></i><br>Đang tải...'
            },
            dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
            order: [[4, 'desc']],
            pageLength: 20,
            lengthMenu: [[20, 50, 100], [20, 50, 100]],
            // Draw callback
            drawCallback: function (settings) {
                // Call default figma DrawCallback
                if (window.FigmaDataTables && FigmaDataTables.defaultConfig) {
                    FigmaDataTables.defaultConfig.drawCallback(settings);
                }

                // Ensure pagination is in #paginationFrame
                const $container = $('.pagination-figma-container');
                if ($container.length && $('#paginationFrame').length) {
                    $container.appendTo('#paginationFrame');
                }

                // Other custom rendering after each draw
            }
        });
    }

    // ── File upload area ──────────────────────────────────────────────
    function setupFileUploadArea() {
        var $area = $('#fileUploadArea');
        var $input = $('#tmplFileInput');

        $input.on('change', function () {
            var file = this.files && this.files[0] ? this.files[0] : null;
            setSelectedFile(file);
        });

        // Drag & drop
        $area[0].addEventListener('dragover', function (e) {
            e.preventDefault();
            $area.addClass('drag-over');
        });
        $area[0].addEventListener('dragleave', function () {
            $area.removeClass('drag-over');
        });
        $area[0].addEventListener('drop', function (e) {
            e.preventDefault();
            $area.removeClass('drag-over');
            var file = e.dataTransfer.files && e.dataTransfer.files[0] ? e.dataTransfer.files[0] : null;
            setSelectedFile(file);
        });

        $('#btnClearFile').on('click', function (e) {
            e.stopPropagation();
            clearSelectedFile();
        });
    }

    function setSelectedFile(file) {
        if (!file) { clearSelectedFile(); return; }

        // Validate type
        var allowedTypes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (!allowedTypes.includes(file.type)) {
            toastr.error('Chỉ chấp nhận file DOCX hoặc XLSX');
            clearSelectedFile();
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toastr.error('Kích thước file không được vượt quá 5MB');
            clearSelectedFile();
            return;
        }

        selectedFile = file;
        $('#filePreviewName').text(file.name);
        $('#filePreviewSize').text(formatFileSize(file.size));
        $('#fileIcon').attr('class', getFileIcon(file.name));
        $('#fileUploadHint').text('File đã chọn — nhấn để thay đổi');
        $('#filePreview').css('display', 'flex');
        $('#tmplFileError').hide();
    }

    function clearSelectedFile() {
        selectedFile = null;
        $('#tmplFileInput').val('');
        $('#filePreview').hide().css('display', 'none');
        $('#fileUploadHint').text('Nhấn để chọn file DOCX hoặc XLSX');
    }

    // ── Open Upload modal ─────────────────────────────────────────────
    function openUploadModal() {
        clearErrors();
        clearSelectedFile();
        currentEditId = null;
        $('#tmplId').val('');
        $('#tmplName').val('');
        $('#tmplLoai').val('');
        $('#tmplDescription').val('');
        $('#fileRequiredMark').show();
        $('#modalTemplateTitle').html('<i class="fas fa-upload mr-2"></i>Tải lên template mới');
        $('#modalTemplate').modal('show');
    }

    // ── Open Edit modal ───────────────────────────────────────────────
    function openEditModal(id) {
        clearErrors();
        clearSelectedFile();
        currentEditId = id;

        // Fetch current data
        $.ajax({
            url: '/Complaint/GetTemplateTypes',  // reuse cached types
            type: 'GET',
            success: function () {
                // Now fetch the specific template
                $.ajax({
                    url: '/Complaint/GetTemplates',
                    type: 'GET',
                    data: { page: 1, pageSize: 200 },
                    success: function (result) {
                        if (!result || !result.success || !result.data) { toastr.error('Không thể tải dữ liệu template'); return; }
                        var item = result.data.find(function (x) { return x.id === id; });
                        if (!item) { toastr.error('Không tìm thấy template'); return; }

                        $('#tmplId').val(item.id);
                        $('#tmplName').val(item.name);
                        $('#tmplLoai').val(item.templateTypeId);
                        $('#tmplDescription').val('');
                        $('#fileRequiredMark').hide(); // file optional on edit

                        // Show current file name hint
                        if (item.fileName) {
                            $('#fileUploadHint').text('File hiện tại: ' + item.fileName + ' — nhấn để thay thế');
                        }

                        $('#modalTemplateTitle').html('<i class="fas fa-edit mr-2"></i>Cập nhật template');
                        $('#modalTemplate').modal('show');
                    },
                    error: function () { toastr.error('Không thể tải dữ liệu template'); }
                });
            }
        });
    }

    // ── Validate ──────────────────────────────────────────────────────
    function validate() {
        var ok = true;
        clearErrors();

        if (!$('#tmplName').val().trim()) { showFieldError('tmplNameError', 'Vui lòng nhập tên template'); ok = false; }
        if (!$('#tmplLoai').val()) { showFieldError('tmplLoaiError', 'Vui lòng chọn loại template'); ok = false; }
        if (!currentEditId && !selectedFile) { showFieldError('tmplFileError', 'Vui lòng chọn file template'); ok = false; }

        return ok;
    }

    // ── Save template (upload or update) ──────────────────────────────
    function saveTemplate() {
        if (!validate()) return;

        var $btn = $('#btnSaveTemplate');
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        var formData = new FormData();
        formData.append('templateTypeId', $('#tmplLoai').val());
        formData.append('name', $('#tmplName').val().trim());
        formData.append('description', $('#tmplDescription').val().trim());
        if (selectedFile) {
            formData.append('file', selectedFile);
        }

        var url = '/Complaint/UploadTemplate';
        if (currentEditId) {
            formData.append('id', currentEditId);
            url = '/Complaint/UpdateTemplate';
        }

        $.ajax({
            url: url,
            type: 'POST',
            processData: false,
            contentType: false,
            headers: { 'RequestVerificationToken': getAntiForgeryToken() },
            data: formData,
            success: function (result) {
                if (result && result.success) {
                    toastr.success(currentEditId ? 'Cập nhật template thành công' : 'Tải lên template thành công');
                    $('#modalTemplate').modal('hide');
                    table.ajax.reload();
                } else {
                    var msg = (result && result.message) ? result.message : 'Đã có lỗi xảy ra';
                    toastr.error(msg);
                }
            },
            error: function (xhr) {
                var msg = 'Không thể kết nối đến máy chủ';
                if (xhr.status === 403) msg = 'Bạn không có quyền thực hiện thao tác này';
                toastr.error(msg);
            },
            complete: function () {
                $btn.prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu template');
            }
        });
    }

    // ── Toggle active status ──────────────────────────────────────────
    function toggleStatus(id, name, isActive) {
        var action = isActive ? 'vô hiệu hóa' : 'kích hoạt';
        if (!confirm('Bạn có chắc muốn ' + action + ' template "' + name + '"?')) return;

        $.ajax({
            url: '/Complaint/ToggleTemplateStatus',
            type: 'POST',
            data: { id: id, activate: !isActive, __RequestVerificationToken: getAntiForgeryToken() },
            success: function (result) {
                if (result && result.success) {
                    toastr.success('Đã ' + action + ' template thành công');
                    table.ajax.reload(null, false);
                } else {
                    toastr.error((result && result.message) || 'Đã có lỗi xảy ra');
                }
            },
            error: function (xhr) {
                toastr.error(xhr.status === 403 ? 'Bạn không có quyền thực hiện thao tác này' : 'Không thể kết nối đến máy chủ');
            }
        });
    }

    // ── Bind events ───────────────────────────────────────────────────
    function bindEvents() {
        // Upload new
        $('#btnUploadNew').on('click', openUploadModal);

        // Save
        $('#btnSaveTemplate').on('click', saveTemplate);

        // Filter change → reload
        $('#filterLoaiTemplate, #filterTrangThai').on('change', function () {
            table.ajax.reload();
        });

        // Reset filter
        $('#btnResetFilter').on('click', function () {
            $('#filterLoaiTemplate').val('');
            $('#filterTrangThai').val('');
            table.ajax.reload();
        });

        // Delegated: edit button
        $('#templateTable tbody').on('click', '.btn-edit-tmpl', function () {
            openEditModal($(this).data('id'));
        });

        // Delegated: toggle status button
        $('#templateTable tbody').on('click', '.btn-toggle-tmpl', function () {
            var $btn = $(this);
            toggleStatus(
                $btn.data('id'),
                $btn.data('name'),
                $btn.data('active') === 1 || $btn.data('active') === '1'
            );
        });

        // Clear file on modal hidden
        $('#modalTemplate').on('hidden.bs.modal', function () {
            clearSelectedFile();
            currentEditId = null;
        });
    }

    // ── Init ──────────────────────────────────────────────────────────
    $(document).ready(function () {
        loadTemplateTypes();
        setupFileUploadArea();
        initDataTable();
        bindEvents();
    });

})();
