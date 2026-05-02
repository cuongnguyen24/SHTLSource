/**
 * Project Management JavaScript (Quản lý Dự án – Tab trong Chi tiết Doanh nghiệp)
 * Handles: Suspend / Dissolve / Delete project modals with file uploads
 */
(function () {
    'use strict';

    var suspendUploader, dissolveUploader;

    $(document).ready(function () {
        try { initProjectUploaders(); } catch (e) { console.warn('Project uploaders init failed:', e); }
        bindProjectEvents();
    });

    function initProjectUploaders() {
        if (typeof FileUploadComponent === 'undefined') return;

        // Init uploader for Suspend modal
        if ($('#suspendProjectFiles').length) {
            suspendUploader = new FileUploadComponent({
                dropZoneId:  'uploadZone_suspendFiles',
                fileInputId: 'suspendProjectFiles',
                fileQueueId: 'fileQueue_suspendFiles',
                maxFiles:    5,
                maxSizeMB:   20,
                simple:      true
            });
        }

        // Init uploader for Dissolve modal
        if ($('#dissolveProjectFiles').length) {
            dissolveUploader = new FileUploadComponent({
                dropZoneId:  'uploadZone_dissolveFiles',
                fileInputId: 'dissolveProjectFiles',
                fileQueueId: 'fileQueue_dissolveFiles',
                maxFiles:    5,
                maxSizeMB:   20,
                simple:      true
            });
        }

        // Clear uploaders on modal hide
        $('#suspendProjectModal').on('hidden.bs.modal', function () {
            if (suspendUploader) suspendUploader.clear();
        });
        $('#dissolveProjectModal').on('hidden.bs.modal', function () {
            if (dissolveUploader) dissolveUploader.clear();
        });
    }

    function bindProjectEvents() {
        // ── SUSPEND PROJECT ──────────────────────────────────────────────
        $(document).on('click', '.btn-suspend-project', function () {
            var id   = $(this).data('id');
            var entId = $(this).data('enterprise-id');
            var name = $(this).data('name');

            $('#suspendProjectId').val(id);
            $('#suspendEnterpriseId').val(entId);
            $('#suspendProjectTitle').html('<i class="fas fa-pause-circle mr-2"></i>Ngưng hoạt động tạm thời — ' + $('<span>').text(name).html());

            // Reset form
            $('#suspendApplicationDate').val('');
            $('#suspendEffectiveDate').val('');
            $('#suspendPauseDuration').val('');
            $('#suspendReason').val('');
            if (suspendUploader) suspendUploader.clear();

            $('#suspendProjectModal').modal('show');
        });

        $('#btnConfirmSuspendProject').on('click', function () {
            submitProjectStatusChange('Suspended', {
                projectId:       $('#suspendProjectId').val(),
                enterpriseId:    $('#suspendEnterpriseId').val(),
                applicationDate: $('#suspendApplicationDate').val(),
                effectiveDate:   $('#suspendEffectiveDate').val(),
                pauseDuration:   $('#suspendPauseDuration').val(),
                reason:          $('#suspendReason').val(),
                uploader:        suspendUploader,
                modalId:         '#suspendProjectModal'
            });
        });

        // ── DISSOLVE PROJECT ─────────────────────────────────────────────
        $(document).on('click', '.btn-dissolve-project', function () {
            var id   = $(this).data('id');
            var entId = $(this).data('enterprise-id');
            var name = $(this).data('name');

            $('#dissolveProjectId').val(id);
            $('#dissolveEnterpriseId').val(entId);
            $('#dissolveProjectTitle').html('<span style="color:#ef4444; margin-right:6px;">&#x1F534;</span>Chấm dứt hoạt động / Giải thể — ' + $('<span>').text(name).html());

            // Reset form
            $('#dissolveTerminationType').val('');
            $('#dissolveApplicationDate').val('');
            $('#dissolveEffectiveDate').val('');
            $('#dissolveReason').val('');
            if (dissolveUploader) dissolveUploader.clear();

            $('#dissolveProjectModal').modal('show');
        });

        $('#btnConfirmDissolveProject').on('click', function () {
            var terminationType = $('#dissolveTerminationType').val();
            if (!terminationType) {
                toastrWarn('Vui lòng chọn loại chấm dứt');
                return;
            }
            submitProjectStatusChange('Dissolved', {
                projectId:       $('#dissolveProjectId').val(),
                enterpriseId:    $('#dissolveEnterpriseId').val(),
                terminationType: terminationType,
                applicationDate: $('#dissolveApplicationDate').val(),
                effectiveDate:   $('#dissolveEffectiveDate').val(),
                reason:          $('#dissolveReason').val(),
                uploader:        dissolveUploader,
                modalId:         '#dissolveProjectModal'
            });
        });

        // ── PROJECT DETAIL (expandable row) ─────────────────────────────
        $(document).on('click', '.btn-project-detail', function (e) {
            e.stopPropagation();
            var $btn = $(this);
            var projectId = $btn.data('id');
            var enterpriseId = $btn.data('enterprise-id');
            toggleProjectDetail(enterpriseId, projectId);
        });

        // Row click also toggles detail — ignore clicks on action buttons/links
        $(document).on('click', '.project-row', function (e) {
            if ($(e.target).closest('button, a, .btn-icon-figma').length) return;
            var projectId = $(this).data('project-id');
            var enterpriseId = $(this).data('enterprise-id');
            toggleProjectDetail(enterpriseId, projectId);
        });
    }

    // Cache loaded project detail HTML to avoid redundant API calls
    var _projectDetailCache = {};

    /**
     * Toggle expandable detail row for a project.
     * Server returns rendered HTML (PartialView), cached on first load.
     */
    function toggleProjectDetail(enterpriseId, projectId) {
        var $detailRow = $('#detail-' + projectId);
        if (!$detailRow.length) return;

        // Toggle visibility — just hide/show, no re-fetch
        if ($detailRow.is(':visible')) {
            $detailRow.slideUp(200);
            return;
        }

        // Hide all other open detail rows
        $('.project-detail-row:visible').slideUp(200);

        var $content = $detailRow.find('.project-detail-content');
        var $loading = $detailRow.find('.project-detail-loading');

        // If already cached, show immediately without API call
        if (_projectDetailCache[projectId]) {
            $content.html(_projectDetailCache[projectId]);
            $detailRow.slideDown(200);
            return;
        }

        // First time: fetch PartialView HTML from backend, then cache
        $detailRow.slideDown(200);
        $loading.show();
        $content.html('');

        $.ajax({
            url: '/Enterprise/GetProjectDetail',
            type: 'GET',
            data: { enterpriseId: enterpriseId, projectId: projectId },
            success: function (html) {
                $loading.hide();
                if (html && typeof html === 'string' && html.trim().length > 0) {
                    _projectDetailCache[projectId] = html;
                    $content.html(html);
                } else {
                    $content.html('<div class="text-center py-3 text-muted">Không thể tải chi tiết dự án</div>');
                }
            },
            error: function () {
                $loading.hide();
                $content.html('<div class="text-center py-3 text-muted">Đã xảy ra lỗi khi tải chi tiết</div>');
            }
        });
    }

    /**
     * Invalidate cache when project data changes (after status update, delete, etc.)
     */
    function clearProjectDetailCache(projectId) {
        if (projectId) {
            delete _projectDetailCache[projectId];
        } else {
            _projectDetailCache = {};
        }
    }

    /**
     * Submit project status change (Suspend or Dissolve)
     */
    function submitProjectStatusChange(type, opts) {
        if (!opts.effectiveDate) {
            toastrWarn('Vui lòng nhập ngày hiệu lực');
            return;
        }

        if (type === 'Suspended' && !opts.pauseDuration) {
            toastrWarn('Vui lòng nhập thời gian tạm ngưng');
            return;
        }

        if (!opts.reason) {
            toastrWarn('Vui lòng nhập lý do thay đổi');
            return;
        }

        // Parse dd/mm/yyyy → yyyy-mm-dd
        function parseDate(dateStr) {
            if (!dateStr) return '';
            var p = dateStr.split('/');
            return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : dateStr;
        }

        var formData = new FormData();
        formData.append('type', type);
        formData.append('applicationDate', parseDate(opts.applicationDate));
        formData.append('effectiveDate', parseDate(opts.effectiveDate));
        if (opts.reason) formData.append('reason', opts.reason);
        if (opts.terminationType) formData.append('terminationType', opts.terminationType);
        if (opts.pauseDuration) formData.append('pauseDuration', opts.pauseDuration);

        // Attach uploaded files
        var files = (opts.uploader) ? opts.uploader.getFiles() : [];
        files.forEach(function (file) {
            formData.append('files', file, file.name);
        });

        // Anti-forgery token
        var token = $('input[name="__RequestVerificationToken"]').first().val() ||
                    $('meta[name="csrf-token"]').attr('content');
        if (token) formData.append('__RequestVerificationToken', token);

        var $btn = $(opts.modalId).find('.btn-figma-primary, .btn-figma-destructive').last();
        var origHtml = $btn.html();
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Đang xử lý...');

        $.ajax({
            url: '/Enterprise/UpdateProjectStatus?enterpriseId=' + opts.enterpriseId + '&projectId=' + opts.projectId,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (resp) {
                $btn.prop('disabled', false).html(origHtml);
                $(opts.modalId).modal('hide');
                if (resp.success) {
                    toastrSuccess(resp.message || 'Cập nhật trạng thái thành công');
                    refreshProjectsTab();
                } else {
                    toastrError(resp.message || 'Không thể cập nhật trạng thái');
                }
            },
            error: function () {
                $btn.prop('disabled', false).html(origHtml);
                $(opts.modalId).modal('hide');
                toastrError('Đã xảy ra lỗi khi cập nhật trạng thái dự án');
            }
        });
    }

    /**
     * Refresh the projects tab by re-submitting the search form
     */
    function refreshProjectsTab() {
        clearProjectDetailCache(); // invalidate all cached detail data
        var $form = $('#frmProjects');
        if ($form.length) {
            $form.trigger('submit');
        }
    }

    // ── Toastr helpers ───────────────────────────────────────────────────
    function toastrSuccess(msg) {
        if (typeof toastr !== 'undefined') toastr.success(msg);
    }
    function toastrError(msg) {
        if (typeof toastr !== 'undefined') toastr.error(msg);
    }
    function toastrWarn(msg) {
        if (typeof toastr !== 'undefined') toastr.warning(msg);
    }

})();
