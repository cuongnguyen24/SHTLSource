/**
 * Template Management Logic (SCR-05)
 * Standardized based on Award Management pattern.
 */
(function (window, $) {
    'use strict';

    let table;
    let templateUploader;
    let options = {};

    /**
     * Initialize the module with server-provided options
     * @param {Object} opt - Configuration (URLs, Permissions)
     */
    function init(opt) {
        options = $.extend({
            urls: {
                list: '',
                upload: '',
                activate: '',
                deactivate: '',
                download: '',
                versionHistory: ''
            },
            permissions: {
                canCreate: false,
                canUpdate: false
            }
        }, opt);

        initializeDataTable();
        initializeFileUpload();
        initializeEventHandlers();
    }

    function initializeDataTable() {
        const tableElement = $('#templatesTable');
        const initFn = tableElement.dataTableFigma ? 'dataTableFigma' : 'DataTable';

        table = tableElement[initFn]({
            processing: true,
            serverSide: false,
            paging: false,
            searching: false,
            info: false,
            ajax: {
                url: options.urls.list,
                type: 'GET',
                data: function (d) {
                    d.templateType = $('#filterTemplateType').val() || '';
                },
                dataSrc: function (json) {
                    if (json.isSuccess && json.data) return json.data;
                    if (json.success && json.data) return json.data;
                    return [];
                }
            },
            columns: [
                {
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    render: function (data, type, row, meta) {
                        return meta.row + 1;
                    }
                },
                {
                    data: 'tenMau',
                    render: function (data, type, row) {
                        var name = data || row.fileName || '-';
                        return '<div class="d-flex align-items-center">' +
                                    '<i class="far fa-file-word text-primary mr-2" style="font-size: 16px;"></i>' +
                                    '<div class="text-dark font-weight-bold">' + escapeHtml(name) + '</div>' +
                                '</div>';
                    }
                },
                {
                    data: 'templateTypeDisplay',
                    render: function (data) {
                        return '<span style="color: #64748b; font-size: 12px;">' + escapeHtml(data || '-') + '</span>';
                    }
                },
                {
                    data: 'templateVersion',
                    className: 'text-center',
                    render: function (data) {
                        return '<span style="color: #475569; font-weight: 500;">v' + (data || 1) + '</span>';
                    }
                },
                {
                    data: 'createdAt',
                    className: 'text-center',
                    render: function (data) {
                        if (!data) return '-';
                        var d = new Date(data);
                        return String(d.getDate()).padStart(2, '0') + '/' +
                            String(d.getMonth() + 1).padStart(2, '0') + '/' +
                            d.getFullYear();
                    }
                },
                {
                    data: 'createdBy',
                    render: function (data) { return escapeHtml(data || '-'); }
                },
                {
                    data: 'isActive',
                    className: 'text-center',
                    render: function (data) {
                        if (data) {
                            return '<span class="status-pill status-pill-success"><i class="fas fa-circle"></i> Active</span>';
                        } else {
                            return '<span class="status-pill status-pill-secondary"><i class="fas fa-circle"></i> Inactive</span>';
                        }
                    }
                },
                {
                    data: 'id',
                    orderable: false,
                    className: 'text-end',
                    render: function (data, type, row) {
                        var actions = '<div class="d-flex justify-content-end gap-1">';

                        // Download
                        actions += '<button class="btn-table-outline" title="Tải về" onclick="TemplateManager.previewTemplate(\'' + data + '\')"><i class="fas fa-download"></i></button>';

                        if (options.permissions.canUpdate) {
                            if (!row.isActive) {
                                actions += '<button class="btn-figma btn-figma-primary btn-sm px-2 py-1" style="font-size: 11px; height: 28px;" onclick="TemplateManager.toggleActive(\'' + data + '\', true)">Activate</button>';
                            } else {
                                actions += '<button class="btn-figma btn-figma-destructive btn-sm px-2 py-1" style="font-size: 11px; height: 28px;" onclick="TemplateManager.toggleActive(\'' + data + '\', false)">Deactivate</button>';
                            }
                        }

                        // History
                        actions += '<button class="btn-table-outline" title="Lịch sử phiên bản" onclick="TemplateManager.showVersionHistory(\'' + escapeHtml(row.templateType) + '\', \'' + escapeHtml(row.templateTypeDisplay) + '\')"><i class="fas fa-history"></i></button>';

                        actions += '</div>';
                        return actions;
                    }
                }
            ],
            order: [[4, 'desc']],
            language: {
                url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/vi.json'
            },
            dom: 'tr'
        });
    }

    function initializeFileUpload() {
        if (typeof FileUploadComponent !== 'undefined') {
            templateUploader = new FileUploadComponent({
                dropZoneId: 'templateUploadZone',
                fileInputId: 'templateFile',
                fileQueueId: 'templateFileQueue',
                maxFiles: 1,
                maxSizeMB: 10,
                simple: true
            });
        }
    }

    function initializeEventHandlers() {
        // Manual trigger for Modal Upload to ensure it opens on BS4/jQuery 3.x
        $(document).on('click', '[data-target="#modalUpload"]', function (e) {
            e.preventDefault();
            $('#modalUpload').modal('show');
        });

        // Trigger upload on button click
        $('#btnSubmitUpload').on('click', function () {
            $('#formUpload').submit();
        });

        $('#formUpload').on('submit', function (e) {
            e.preventDefault();
            uploadTemplate();
        });

        // Reset modal on hide
        $('#modalUpload').on('hidden.bs.modal', function () {
            $('#formUpload')[0].reset();
            if (templateUploader) templateUploader.clear();
        });

        // Refresh / filter change
        $('#btnRefreshTemplates').on('click', function () {
            if (table) table.ajax.reload(null, false);
        });
        $('#filterTemplateType').on('change', function () {
            if (table) table.ajax.reload(null, false);
        });
    }

    function uploadTemplate() {
        var form = document.getElementById('formUpload');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const btn = $('#btnSubmitUpload');
        const originalHtml = btn.html();
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang tải...');

        // Get Anti-Forgery Token
        var token = $('input[name="__RequestVerificationToken"]').val();

        // Construct FormData manually like Awards module
        var fd = new FormData(form);

        // Explicitly add files from uploader component to ensure consistency
        if (templateUploader) {
            var files = templateUploader.getFiles();
            if (files.length > 0) {
                // Remove any existing file field and append from component queue
                fd.delete('file');
                fd.append('file', files[0]);
            } else {
                Swal.fire('Chú ý', 'Vui lòng chọn file mẫu biểu (.docx)', 'warning');
                btn.prop('disabled', false).html(originalHtml);
                return;
            }
        }

        $.ajax({
            url: options.urls.upload,
            type: 'POST',
            data: fd,
            processData: false,
            contentType: false,
            headers: { 'RequestVerificationToken': token },
            success: function (res) {
                if (res.success) {
                    toastr.success(res.message || 'Tải lên thành công');
                    $('#modalUpload').modal('hide');
                    table.ajax.reload();
                } else {
                    Swal.fire('Thất bại', res.message || 'Lỗi khi tải lên mẫu biểu', 'error');
                }
            },
            error: function () {
                toastr.error('Đã xảy ra lỗi hệ thống khi tải file.', 'Lỗi');
            },
            complete: function () {
                btn.prop('disabled', false).html(originalHtml);
            }
        });
    }

    function toggleActive(id, active) {
        var action = active ? 'Kích hoạt' : 'Hủy kích hoạt';
        var url = active
            ? '/gxn/templates/' + id + '/set-active'
            : '/gxn/templates/' + id + '/deactivate';
        var token = $('input[name="__RequestVerificationToken"]').val();

        Swal.fire({
            title: 'Xác nhận ' + action + '?',
            text: active ? "Việc kích hoạt sẽ tự động thay thế mẫu đang hoạt động hiện tại." : "Template này sẽ không thể dùng để in hồ sơ nữa.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Đồng ý',
            cancelButtonText: 'Hủy',
            confirmButtonColor: active ? '#1b4f8a' : '#ef4444'
        }).then(function (result) {
            if (result.isConfirmed) {
                $.ajax({
                    url: url,
                    type: 'POST',
                    headers: { 'RequestVerificationToken': token },
                    success: function (res) {
                        if (res.success) {
                            toastr.success(res.message);
                            table.ajax.reload(null, false);
                        } else {
                            Swal.fire('Lỗi', res.message, 'error');
                        }
                    },
                    error: function () {
                        toastr.error('Không thể thực hiện thao tác này.', 'Lỗi');
                    }
                });
            }
        });
    }

    function previewTemplate(id) {
        window.location.href = '/gxn/templates/' + id + '/download';
    }

    function showVersionHistory(loaiMau, loaiMauDisplay) {
        $('#historyLoaiMauLabel').text(loaiMauDisplay || loaiMau);
        $('#historyLoading').show();
        $('#historyContent').hide();
        $('#historyEmpty').hide();
        $('#historyTableBody').empty();
        $('#modalVersionHistory').modal('show');

        $.ajax({
            url: options.urls.versionHistory + '?loaiMau=' + encodeURIComponent(loaiMau),
            type: 'GET',
            success: function (res) {
                $('#historyLoading').hide();
                if (!res.success || !res.data || res.data.length === 0) {
                    $('#historyEmpty').show();
                    return;
                }
                var rows = '';
                res.data.forEach(function (item) {
                    var date = item.uploadedAt ? new Date(item.uploadedAt) : null;
                    var dateStr = date
                        ? String(date.getDate()).padStart(2, '0') + '/' +
                          String(date.getMonth() + 1).padStart(2, '0') + '/' +
                          date.getFullYear()
                        : '-';
                    var sizeStr = item.fileSize > 0
                        ? (item.fileSize / 1024).toFixed(1) + ' KB'
                        : '-';
                    var statusPill = item.isActive
                        ? '<span class="status-pill status-pill-success" style="padding:2px 8px;font-size:11px;"><i class="fas fa-circle" style="font-size:7px;"></i> Active</span>'
                        : '<span class="status-pill status-pill-secondary" style="padding:2px 8px;font-size:11px;"><i class="fas fa-circle" style="font-size:7px;"></i> Inactive</span>';
                    rows += '<tr>' +
                        '<td class="text-center"><span style="color:#475569;font-weight:500;">v' + item.version + '</span></td>' +
                        '<td>' + escapeHtml(item.tenMau) + '</td>' +
                        '<td>' + dateStr + '</td>' +
                        '<td>' + escapeHtml(item.uploadedByName || item.uploadedBy || '-') + '</td>' +
                        '<td class="text-center">' + sizeStr + '</td>' +
                        '<td class="text-center">' + statusPill + '</td>' +
                        '<td class="text-center">' +
                            '<button class="btn-table-outline btn-table-primary" title="Tải về" onclick="TemplateManager.previewTemplate(\'' + item.id + '\')">' +
                                '<i class="fas fa-download"></i>' +
                            '</button>' +
                        '</td>' +
                        '</tr>';
                });
                $('#historyTableBody').html(rows);
                $('#historyContent').show();
            },
            error: function () {
                $('#historyLoading').hide();
                $('#historyEmpty').text('Lỗi khi tải lịch sử phiên bản.').show();
            }
        });
    }

    function reloadTable() {
        if (table) table.ajax.reload(null, false);
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Expose public methods
    window.TemplateManager = {
        init: init,
        toggleActive: toggleActive,
        previewTemplate: previewTemplate,
        showVersionHistory: showVersionHistory,
        reloadTable: reloadTable
    };

})(window, jQuery);
