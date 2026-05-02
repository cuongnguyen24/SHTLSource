/**
 * Complaint Detail View - Tab Switching & File Preview
 * Pattern: IIFE + Tab State Management
 * Reference: UI_SCR-NV-DON-003 to 008
 */
(function () {
    'use strict';

    // ══════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════
    let currentTab = 'info';
    let dropdownOpen = false;

    // ══════════════════════════════════════════════════════════════
    // DOM READY
    // ══════════════════════════════════════════════════════════════
    $(document).ready(function () {
        initDropdownExport();
        initFilePreviewModal();
        loadTabDataIfNeeded(currentTab);
    });

    // ══════════════════════════════════════════════════════════════
    // TAB SWITCHING
    // ══════════════════════════════════════════════════════════════
    function showTab(tabId, btnElement) {
        // Check if tab is disabled
        if (btnElement && $(btnElement).hasClass('disabled')) {
            const title = $(btnElement).attr('title');
            if (title) {
                toastr.warning(title);
            }
            return;
        }

        // Update tab bar
        $('.ent-tab-btn').removeClass('active');
        if (btnElement) {
            $(btnElement).addClass('active');
        } else {
            // Find by data-tab or fallback to onclick matching
            let $btn = $(`.ent-tab-btn[data-tab="${tabId}"]`);
            if ($btn.length === 0) $btn = $(`.ent-tab-btn[onclick*="'${tabId}'"]`);
            $btn.addClass('active');
        }

        // Update tab content
        $('.ent-tab-pane').removeClass('active');
        $(`#ent-tab-${tabId}`).addClass('active');

        currentTab = tabId;

        // Load data for tab if needed (lazy loading)
        loadTabDataIfNeeded(tabId);
    }

    function loadTabDataIfNeeded(tabId) {
        // For now, only tab-info has static data
        // Other tabs will load data via AJAX when implemented
        switch (tabId) {
            case 'info':
                // Static data already rendered
                break;
            case 'classification':
                initClassificationTab();
                break;
            case 'assignment':
                initAssignmentTab();
                break;
            case 'extension':
                initExtensionTab();
                break;
            case 'result':
                initResultTab();
                break;
            case 'notification':
                initNotificationTab();
                break;
        }
    }

    // ══════════════════════════════════════════════════════════════
    // TAB 2: CLASSIFICATION & ACCEPTANCE
    // ══════════════════════════════════════════════════════════════

    // Cache for dynamically loaded complaint types
    var _complaintTypesCache = [];

    function initClassificationTab() {
        if ($('#loaiDonThuLy').data('initialized')) return;
        $('#loaiDonThuLy').data('initialized', true);

        // Load complaint types from API
        loadComplaintTypesDropdown();

        // Load history timeline
        loadLichSuThuLy();

        // Complaint type change → update deadline info
        $('#loaiDonThuLy').on('change', onComplaintTypeChange);

        // Only wire up decision controls if section is present (Status = Pending & has permissions)
        if ($('#sectionQuyetDinh').length) {
            // Radio group change
            $('input[name="decisionType"]').on('change', function () {
                onDecisionRadioChange($(this).val());
            });

            // ngayThuLy change → update deadline preview
            $('#ngayThuLy').on('change', updateDeadlinePreview);

            // Character counter for textarea fields
            $('#lyDoKhongThuLyDetail').on('input', function () {
                $('#lyDoKhongThuLyCount').text($(this).val().length);
            });
            $('#lyDoChuyenDon').on('input', function () {
                $('#lyDoChuyenDonCount').text($(this).val().length);
            });

            // Submit
            $('#btnConfirmDecision').on('click', handleDecisionSubmit);
        }
    }

    function loadComplaintTypesDropdown() {
        $.ajax({
            url: '/Complaint/GetComplaintTypesForDropdown',
            method: 'GET',
            success: function (result) {
                if (!result.success || !result.data) return;

                _complaintTypesCache = result.data;
                var $select = $('#loaiDonThuLy');
                $select.empty().append('<option value="">-- Chọn loại đơn --</option>');

                $.each(result.data, function (i, t) {
                    var selected = (window.complaintTypeId && t.id === window.complaintTypeId) ? ' selected' : '';
                    $select.append('<option value="' + t.id + '"' + selected + '>' + t.name + '</option>');
                });

                // Trigger info update for preselected value
                onComplaintTypeChange();
            },
            error: function () {
                $('#loaiDonThuLy').empty().append('<option value="">-- Lỗi tải dữ liệu --</option>');
            }
        });
    }

    function onComplaintTypeChange() {
        var selectedId = $('#loaiDonThuLy').val();
        var found = null;

        if (selectedId && _complaintTypesCache.length) {
            $.each(_complaintTypesCache, function (i, t) {
                if (t.id === selectedId) { found = t; return false; }
            });
        }

        if (found) {
            $('#loaiDonInfo').html(
                '<i class="fas fa-info-circle" style="color:var(--info);"></i> ' +
                'Thụ lý: <strong>' + found.acceptanceTimelineDays + ' ngày LV</strong> · ' +
                'Giải quyết: <strong>' + found.resolutionTimelineDays + ' ngày LV</strong>'
            );
        } else {
            $('#loaiDonInfo').text('');
        }

        updateDeadlinePreview();
    }

    function updateDeadlinePreview() {
        var ngayThuLy = $('#ngayThuLy').val();
        var selectedId = $('#loaiDonThuLy').val();
        var found = null;

        if (selectedId && _complaintTypesCache.length) {
            $.each(_complaintTypesCache, function (i, t) {
                if (t.id === selectedId) { found = t; return false; }
            });
        }

        if (!ngayThuLy || !found) {
            $('#hanGiaiQuyet').val('');
            return;
        }

        // COMMENTED OUT: Auto-calculation of deadline disabled
        // Users must manually select ngày giải quyết (required field)
        // calculateDeadlineFromApi(ngayThuLy, found);
    }

    /**
     * Call API to calculate resolution deadline from start date + complaint type
     * Backend will retrieve workingDays from ComplaintType configuration
     * Accounts for weekends and public holidays
     * @param {string} ngayThuLy - Acceptance date from input (YYYY-MM-DD)
     * @param {object} complaintType - ComplaintType object with resolutionTimelineDays
     */
    function calculateDeadlineFromApi(ngayThuLy, complaintType) {
        if (!complaintType || !complaintType.resolutionTimelineDays) {
            console.warn('Invalid complaint type or missing resolutionTimelineDays');
            return;
        }

        var selectedComplaintTypeId = complaintType.id;
        var resolutionDays = complaintType.resolutionTimelineDays;

        $.ajax({
            url: '/Complaint/CalculateDeadline',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                startDate: ngayThuLy,
                complaintTypeId: selectedComplaintTypeId
            }),
            headers: {
                'RequestVerificationToken': getAntiForgeryToken()
            },
            success: function (result) {
                if (result.success && result.data) {
                    var deadline = new Date(result.data);
                    $('#hanGiaiQuyet').val(formatDateVN(deadline) + ' (' + resolutionDays + ' ngày LV)');
                } else {
                    // Fallback to client-side calculation if API fails
                    var hanGQ = addWorkingDays(new Date(ngayThuLy), resolutionDays);
                    $('#hanGiaiQuyet').val(formatDateVN(hanGQ) + ' (' + resolutionDays + ' ngày LV)');
                }
            },
            error: function (xhr) {
                console.error('Error calculating deadline:', xhr);
                // Fallback to client-side calculation
                var hanGQ = addWorkingDays(new Date(ngayThuLy), resolutionDays);
                $('#hanGiaiQuyet').val(formatDateVN(hanGQ) + ' (' + resolutionDays + ' ngày LV)');
            }
        });
    }

    /**
     * Add N working days (excluding Sat/Sun) to a start date
     * @param {Date} startDate - Starting date
     * @param {number} days - Number of working days to add
     * @returns {Date} New date after adding working days
     */
    function addWorkingDays(startDate, days) {
        var current = new Date(startDate);
        var remaining = days;
        while (remaining > 0) {
            current.setDate(current.getDate() + 1);
            if (current.getDay() !== 0 && current.getDay() !== 6) {
                remaining--;
            }
        }
        return current;
    }

    /**
     * Calculate number of working days between two dates (excluding Sat/Sun)
     * @param {Date|string} date1 - First date
     * @param {Date|string} date2 - Second date
     * @returns {number} Number of working days between the dates
     */
    function getWorkingDaysDifference(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        
        // Ensure d1 <= d2 for consistent calculation
        const start = d1 <= d2 ? d1 : d2;
        const end = d1 <= d2 ? d2 : d1;
        
        let workingDays = 0;
        let current = new Date(start);
        
        while (current < end) {
            current.setDate(current.getDate() + 1);
            // Count only weekdays (Mon=1 to Fri=5)
            if (current.getDay() !== 0 && current.getDay() !== 6) {
                workingDays++;
            }
        }
        
        return Math.abs(workingDays);
    }

    function formatDateVN(date) {
        var d = new Date(date);
        var day = String(d.getDate()).padStart(2, '0');
        var month = String(d.getMonth() + 1).padStart(2, '0');
        var year = d.getFullYear();
        return day + '/' + month + '/' + year;
    }

    function onDecisionRadioChange(decision) {
        // Hide all conditional sections
        $('#sectionThuLyFields').hide();
        $('#sectionKhongThuLyFields').hide();
        $('#sectionChuyenCQFields').hide();

        var btnLabel = 'Xác nhận';
        if (decision === 'accept') {
            $('#sectionThuLyFields').show();
            btnLabel = 'Xác nhận thụ lý';
            $('#btnConfirmDecision').removeClass('btn-figma-destructive btn-figma-warning').addClass('btn-figma-success');
        } else if (decision === 'reject') {
            $('#sectionKhongThuLyFields').show();
            btnLabel = 'Xác nhận không thụ lý';
            $('#btnConfirmDecision').removeClass('btn-figma-success btn-figma-warning').addClass('btn-figma-destructive');
        } else if (decision === 'transfer') {
            $('#sectionChuyenCQFields').show();
            btnLabel = 'Xác nhận chuyển cơ quan';
            $('#btnConfirmDecision').removeClass('btn-figma-success btn-figma-destructive').addClass('btn-figma-warning');
        }

        $('#btnConfirmDecisionLabel').text(btnLabel);

        if (decision) {
            $('#sectionDecisionSubmit').show();
        } else {
            $('#sectionDecisionSubmit').hide();
        }
    }

    function handleDecisionSubmit() {
        var decision = $('input[name="decisionType"]:checked').val();

        if (!decision) {
            toastr.warning('Vui lòng chọn hành động (Thụ lý / Không thụ lý / Chuyển cơ quan)');
            return;
        }
debugger
        if (decision === 'accept') {
            handleThuLy();
        } else if (decision === 'reject') {
            handleKhongThuLy();
        } else if (decision === 'transfer') {
            handleChuyenCQ();
        }
    }

    function handleThuLy() {
        var ngayThuLy = $('#ngayThuLy').val();

        if (!ngayThuLy) {
            toastr.warning('Vui lòng chọn ngày thụ lý');
            return;
        }

        // Validate: Cannot be future date
        var selectedDate = new Date(ngayThuLy);
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);

        if (selectedDate > today) {
            toastr.warning('Ngày thụ lý không được lớn hơn ngày hiện tại');
            $('#ngayThuLy').focus();
            return;
        }

        if (window.receivedDate) {
            var receivedDate = new Date(window.receivedDate);
            receivedDate.setHours(0, 0, 0, 0);
            if (selectedDate < receivedDate) {
                toastr.warning('Ngày thụ lý không được nhỏ hơn ngày nhận đơn (' + formatDateVN(receivedDate) + ')');
                $('#ngayThuLy').focus();
                return;
            }
        }

        if (!confirm('Xác nhận TH LÝ đơn thư này? Hành động không thể hoàn tác.')) {
            return;
        }

        setSubmitLoading(true);

        var ngayThuLy = $('#ngayThuLy').val();
        var ngayGiaiQuyet = $('#ngayGiaiQuyet').val();

        $.ajax({
            url: '/Complaint/AcceptComplaint',
            method: 'POST',
            data: {
                id: window.complaintId,
                ngayThuLy: ngayThuLy,
                ngayGiaiQuyet: ngayGiaiQuyet,
                __RequestVerificationToken: getAntiForgeryToken()
            },
            headers: { 'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') },
            success: function (result) {
                if (result.success) {
                    toastr.success('Đã thụ lý đơn thư thành công');
                    setTimeout(function () { window.location.reload(); }, 1200);
                } else {
                    let $btn = $('#btnConfirmDecision');
                    if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
                        var html = result.message + '<ul class="mb-0 mt-1 pl-4" style="text-align:left;">';
                        result.errors.forEach(function (e) {
                            html += '<li>' + e + '</li>';
                        });
                        html += '</ul>';
                        toastr.error(html, 'Lỗi', { escapeHtml: false });
                    } else {
                        toastr.error(result.message || 'Không thể thụ lý đơn thư');
                    }
                    $btn.prop('disabled', false).html('<i class="fas fa-check mr-1"></i> <span id="btnConfirmDecisionLabel">Xác nhận thụ lý</span>');
                    setSubmitLoading(false);
                }
            },
            error: function (xhr) {
                var message = 'Đã có lỗi xảy ra khi thụ lý đơn thư';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    message = xhr.responseJSON.message;
                } else if (xhr.status === 400) {
                    message = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.';
                } else if (xhr.status === 401) {
                    message = 'Phiên làm việc hết hạn. Vui lòng đăng nhập lại.';
                }
                toastr.error(message);
                setSubmitLoading(false);
            }
        });
    }

    function handleKhongThuLy() {
        var rejectionDetail = $('#lyDoKhongThuLyDetail').val().trim();

        if (!rejectionDetail || rejectionDetail.length < 20) {
            toastr.warning('Lý do không thụ lý phải có ít nhất 20 ký tự');
            return;
        }

        if (!confirm('Xác nhận KHÔNG THỤ LÝ đơn thư này? Hành động không thể hoàn tác.')) {
            return;
        }

        setSubmitLoading(true);

        $.ajax({
            url: '/Complaint/RejectComplaint',
            method: 'POST',
            data: {
                id: window.complaintId,
                rejectionDetail: rejectionDetail,
                __RequestVerificationToken: getAntiForgeryToken()
            },
            headers: { 'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') },
            success: function (result) {
                if (result.success) {
                    toastr.success('Đã từ chối thụ lý đơn thư');
                    setTimeout(function () { window.location.reload(); }, 1200);
                } else {
                    toastr.error(result.message || 'Không thể từ chối thụ lý');
                    let $btn = $('#btnConfirmDecision');
                    $btn.prop('disabled', false).html('<i class="fas fa-check mr-1"></i> <span id="btnConfirmDecisionLabel">Xác nhận không thụ lý</span>');
                    setSubmitLoading(false);
                }
            },
            error: function (xhr) {
                console.error('Error rejecting complaint:', xhr);
                toastr.error('Đã có lỗi xảy ra khi từ chối thụ lý');
                setSubmitLoading(false);
            }
        });
    }

    function handleChuyenCQ() {
        var transferAgency = $('#coQuanTiepNhan').val().trim();
        var transferReason = $('#lyDoChuyenDon').val().trim();

        if (!transferAgency) {
            toastr.warning('Vui lòng nhập tên cơ quan tiếp nhận');
            return;
        }

        if (!transferReason || transferReason.length < 20) {
            toastr.warning('Lý do chuyển đơn phải có ít nhất 20 ký tự');
            return;
        }

        if (!confirm('Xác nhận CHUYỂN CƠ QUAN cho đơn thư này? Hành động không thể hoàn tác.')) {
            return;
        }

        setSubmitLoading(true);

        $.ajax({
            url: '/Complaint/TransferComplaint',
            method: 'POST',
            data: {
                id: window.complaintId,
                transferAgency: transferAgency,
                transferReason: transferReason,
                __RequestVerificationToken: getAntiForgeryToken()
            },
            headers: { 'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') },
            success: function (result) {
                if (result.success) {
                    toastr.success('Đã chuyển đơn thư sang cơ quan khác');
                    setTimeout(function () { window.location.reload(); }, 1200);
                } else {
                    toastr.error(result.message || 'Không thể chuyển đơn thư');
                    let $btn = $('#btnConfirmDecision');
                    $btn.prop('disabled', false).html('<i class="fas fa-check mr-1"></i> <span id="btnConfirmDecisionLabel">Xác nhận chuyển cơ quan</span>');
                    setSubmitLoading(false);
                }
            },
            error: function (xhr) {
                console.error('Error transferring complaint:', xhr);
                toastr.error('Đã có lỗi xảy ra khi chuyển đơn thư');
                setSubmitLoading(false);
            }
        });
    }

    function setSubmitLoading(loading) {
        var $btn = $('#btnConfirmDecision');
        if (loading) {
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');
        } else {
            $btn.prop('disabled', false);
            var decision = $('input[name="decisionType"]:checked').val();
            onDecisionRadioChange(decision || '');
        }
    }

    function loadLichSuThuLy() {
        $.ajax({
            url: '/Complaint/GetProgress',
            method: 'GET',
            data: { id: window.complaintId },
            success: function (result) {
                if (!result || !result.success) {
                    renderLichSuEmpty();
                    return;
                }
                var items = result.data || [];
                // Filter to classification-related events using Action field
                var classificationItems = $.grep(items, function (item) {
                    var action = (item.action || '').toLowerCase();
                    return action.indexOf('thụ lý') >= 0 ||
                        action.indexOf('thu ly') >= 0 ||
                        action.indexOf('phân loại') >= 0 ||
                        action.indexOf('chuyển') >= 0 ||
                        action.indexOf('reject') >= 0 ||
                        action.indexOf('accept') >= 0 ||
                        action.indexOf('transfer') >= 0 ||
                        action.indexOf('approve') >= 0 ||
                        action.indexOf('từ chối') >= 0;
                });

                // Fall back to showing first 5 items if no classification events found
                if (classificationItems.length === 0 && items.length > 0) {
                    classificationItems = items.slice(0, 5);
                }

                renderLichSuTimeline(classificationItems);
            },
            error: function () {
                renderLichSuEmpty();
            }
        });
    }

    function renderLichSuTimeline(items) {
        var $container = $('#lichSuThuLy');

        if (!items || items.length === 0) {
            renderLichSuEmpty();
            return;
        }

        var html = '<div style="position:relative; padding-left:24px; border-left:2px solid #e2e8f0;">';
        $.each(items, function (i, item) {
            // ComplaintProgressDto fields: Action, ProgressDescription, UpdatedByUserName, ActionTimestamp
            var dateStr = '';
            if (item.actionTimestamp) {
                var d = new Date(item.actionTimestamp);
                dateStr = formatDateVN(d) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
            }
            var description = item.progressDescription || item.action || 'Không rõ hành động';
            var user = item.updatedByUserName || '';

            html += '<div style="position:relative; margin-bottom:16px; padding-left:12px;">' +
                '<div style="position:absolute; left:-19px; top:4px; width:12px; height:12px; background:#3b82f6; border-radius:50%; border:2px solid white; box-shadow:0 0 0 2px #e2e8f0;"></div>' +
                '<div style="font-size:13px; color:#475569;">' +
                (dateStr ? '<small style="color:#94a3b8;">' + dateStr + '</small> · ' : '') +
                (user ? '<strong>' + user + '</strong>: ' : '') +
                description +
                '</div></div>';
        });
        html += '</div>';

        $container.html(html);
    }

    function renderLichSuEmpty() {
        $('#lichSuThuLy').html(
            '<div style="text-align:center; color:#94a3b8; padding:24px;">' +
            '<i class="fas fa-inbox" style="font-size:32px; display:block; margin-bottom:8px;"></i>' +
            '<p style="margin:0; font-size:13px;">Chưa có lịch sử thụ lý</p></div>'
        );
    }

    // ══════════════════════════════════════════════════════════════
    // TAB 3: ASSIGNMENT & PROGRESS
    // ══════════════════════════════════════════════════════════════
    function initAssignmentTab() {
        // Check if already initialized
        if ($('#btnTogglePhanCong').data('initialized')) return;
        $('#btnTogglePhanCong').data('initialized', true);

        // Load departments for assignment (only if form is shown)
        if (window.canAssign) {
            loadDepartments();
        }

        // Load current assignment info from pre-rendered window vars (no AJAX needed)
        displayCurrentAssignment();

        // Load progress timeline
        loadProgressTimeline();

        // Toggle assignment form
        $('#btnTogglePhanCong').on('click', togglePhanCongForm);
        $('#btnCancelPhanCong').on('click', function () {
            $('#phanCongForm').slideUp(300);
        });

        // Department change → load users
        $('#phongBanSelect').on('change', loadCanBoByDepartment);

        // Save assignment
        $('#btnSavePhanCong').on('click', savePhanCong);

        // Character counter for timeline content
        $('#mocNoidung').on('input', function () {
            const len = this.value.length;
            $('#mocNoidungCount').text(`${len}/2000`);
            if (len < 10) {
                $('#mocNoidungCount').css('color', 'var(--danger)');
            } else {
                $('#mocNoidungCount').css('color', 'var(--text-sec)');
            }
        });

        // Save timeline milestone
        $('#btnSaveTimeline').on('click', saveTimelineMilestone);

        // File input change → show file queue
        $('#filesMocTienDo').on('change', function () {
            const file = this.files[0];
            const $queue = $('#filesMocTienDoQueue');
            $queue.empty();
            if (!file) return;

            const ext = file.name.split('.').pop().toLowerCase();
            const isValidType = ext === 'pdf' || ext === 'docx';
            const isOversize = file.size > 20 * 1024 * 1024;
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            const isOk = isValidType && !isOversize;

            const iconCls = isOk ? 'fa-check-circle' : 'fa-exclamation-circle';
            const bgColor = isOk ? '#f0fdf4' : '#fef2f2';
            const borderColor = isOk ? '#bbf7d0' : '#fecaca';
            const iconColor = isOk ? '#16a34a' : '#dc2626';
            const errorMsg = !isValidType
                ? ' — Chỉ chấp nhận PDF/DOCX'
                : (!isOk ? ` — Vượt quá 20MB` : '');

            $queue.html(
                `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;` +
                `background:${bgColor};border:1px solid ${borderColor};border-radius:6px;font-size:13px;">` +
                `<i class="fas ${iconCls}" style="color:${iconColor};flex-shrink:0;"></i>` +
                `<span style="flex:1;">${escapeHtml(file.name)}${errorMsg}</span>` +
                `<span style="color:#94a3b8;margin-right:8px;">${sizeMB}MB</span>` +
                `<i class="fas fa-times" style="cursor:pointer;color:#94a3b8;" ` +
                `title="Xóa" onclick="$('#filesMocTienDo').val('');$('#filesMocTienDoQueue').empty();"></i>` +
                `</div>`
            );
        });
    }

    function togglePhanCongForm() {
        $('#phanCongForm').slideToggle(300);
    }

    function displayCurrentAssignment() {
        const dept = window.assignedDepartmentName || '';
        const user = window.assignedToUserName || '';
        const date = window.assignedDate || '';
        const by = window.assignedBy || '';

        $('#currentPhongBan').text(dept || 'Chưa phân công');
        $('#currentCanBo').text(user || '--');
        $('#currentPhanCongDate').text(date || '--');
        $('#currentPhanCongBy').text(by || '--');
    }

    /**
     * Load departments from API and populate donViBaoCao select
     */
    function loadDepartments() {
        $.ajax({
            url: '/Departments/GetActive',
            type: 'GET',
            dataType: 'json',
            timeout: 15000,
            success: function (response) {
                const $select = $('#phongBanSelect');
                if (!$select.length) {
                    console.error('Element #phongBanSelect not found');
                    return;
                }

                // Clear existing options
                $select.find('option:not(:first)').remove();

                // Handle multiple response formats
                let departments = [];

                // Case 1: ApiResponse<T> wrapper { data: [...] }
                if (response && response.data && Array.isArray(response.data)) {
                    departments = response.data;
                }
                // Case 2: Direct array
                else if (Array.isArray(response)) {
                    departments = response;
                }
                // Case 3: Error response
                else if (response && response.error) {
                    console.error('Error from GetActive:', response.error);
                    departments = [];
                }
                else {
                    console.warn('Unexpected response format:', response);
                    departments = [];
                }

                // Populate options
                if (departments && departments.length > 0) {
                    departments.forEach(function (dept) {
                        const id = dept.id || dept.departmentId;
                        const name = dept.name || dept.departmentName;
                        if (id && name) {
                            $select.append(`<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`);
                        }
                    });
                    console.log('Loaded ' + departments.length + ' departments');
                } else {
                    console.warn('No departments received from API');
                }
            },
            error: function (xhr, status, error) {
                console.error('Error loading departments:', {
                    status: status,
                    error: error,
                    statusCode: xhr.status
                });
            }
        });
    }

    // function loadDepartments() {
    //     $.ajax({
    //         url: '/Complaint/GetDepartmentsForDropdown',
    //         method: 'GET',
    //         success: function (result) {
    //             if (result && result.success && result.data) {
    //                 const options = result.data.map(d =>
    //                     `<option value="${d.id}">${escapeHtml(d.name)}</option>`
    //                 ).join('');
    //                 $('#phongBanSelect').html('<option value="">-- Chọn phòng ban --</option>' + options);

    //                 // Pre-select current department if already assigned
    //                 if (window.assignedDepartmentId) {
    //                     $('#phongBanSelect').val(window.assignedDepartmentId);
    //                     loadCanBoByDepartment(window.assignedToUserId);
    //                 }
    //             }
    //         },
    //         error: function (xhr) {
    //             console.error('Error loading departments:', xhr);
    //         }
    //     });
    // }

    function loadCanBoByDepartment(preSelectUserId) {
        const departmentId = typeof preSelectUserId === 'string'
            ? window.assignedDepartmentId    // called internally for pre-select
            : undefined;
        const selectedDeptId = departmentId || $('#phongBanSelect').val();
        const canBoSelect = $('#canBoSelect');

        if (!canBoSelect.length) {
            console.error('Element #canBoSelect not found');
            return;
        }

        if (!selectedDeptId) {
            canBoSelect.prop('disabled', true)
                .html('<option value="">-- Chọn sau khi chọn phòng --</option>');
            return;
        }

        canBoSelect.prop('disabled', true).html('<option value="">Đang tải...</option>');

        $.ajax({
            url: `/Complaint/GetUsersByDepartment?departmentId=${selectedDeptId}`,
            method: 'GET',
            timeout: 15000,
            success: function (result) {
                if (result && result.success && result.data && result.data.length > 0) {
                    const options = result.data.map(u =>
                        `<option value="${escapeHtml(u.id)}">${escapeHtml(u.fullName)}</option>`
                    ).join('');
                    canBoSelect.prop('disabled', false)
                        .html('<option value="">-- Chọn cán bộ --</option>' + options);

                    // Pre-select current officer if pre-selecting
                    const userToSelect = typeof preSelectUserId === 'string'
                        ? preSelectUserId
                        : window.assignedToUserId;
                    if (userToSelect) {
                        canBoSelect.val(userToSelect);
                    }
                    console.log('Loaded ' + result.data.length + ' users');
                } else {
                    canBoSelect.prop('disabled', false)
                        .html('<option value="">Không có cán bộ nào trong phòng này</option>');
                }
            },
            error: function (xhr, status, error) {
                console.error('Error loading users:', {
                    status: status,
                    error: error,
                    statusCode: xhr.status
                });
                canBoSelect.prop('disabled', false)
                    .html('<option value="">Lỗi tải danh sách</option>');
            }
        });
    }

    function loadCurrentAssignment() {
        // Kept for backward compatibility — delegates to displayCurrentAssignment
        displayCurrentAssignment();
    }

    function refreshAssignmentInfo() {
        $.ajax({
            url: '/Complaint/GetAssignment?id=' + window.complaintId,
            method: 'GET',
            success: function (result) {
                if (result && result.success && result.data) {
                    $('#currentPhongBan').text(result.data.departmentName || 'Chưa phân công');
                    $('#currentCanBo').text(result.data.assignedUserName || '--');
                    $('#currentPhanCongDate').text(result.data.assignedDateDisplay || '--');
                    $('#currentPhanCongBy').text(result.data.assignedByUserName || '--');
                }
            },
            error: function () {
                // Fallback to stale window vars
                displayCurrentAssignment();
            }
        });
    }

    function savePhanCong() {
        const departmentId = $('#phongBanSelect').val();
        const userId = $('#canBoSelect').val();
        const notes = $('#ghiChuPhanCong').val();

        // Validation
        if (!departmentId) {
            toastr.warning('Vui lòng chọn phòng ban');
            $('#phongBanSelect').focus();
            return;
        }

        if (!userId) {
            toastr.warning('Vui lòng chọn cán bộ phụ trách');
            $('#canBoSelect').focus();
            return;
        }

        if (!confirm('Xác nhận phân công cán bộ này?')) return;

        $.ajax({
            url: '/Complaint/AssignComplaint',
            method: 'POST',
            data: {
                id: window.complaintId,
                userId: userId,
                departmentId: departmentId,
                notes: notes,
                __RequestVerificationToken: getAntiForgeryToken()
            },
            headers: {
                'X-XSRF-TOKEN': getCookie('XSRF-TOKEN')
            },
            success: function (result) {
                if (result.success) {
                    toastr.success('Đã phân công thành công');
                    if (!window.assignedDepartmentId) {
                        // Reload trang để render lại giao diện thay vì js DOM trick
                        setTimeout(() => location.reload(), 1000);
                    } else {
                        togglePhanCongForm();
                        // Refresh displayed assignment info from API
                        refreshAssignmentInfo();
                        // Clear form
                        $('#phongBanSelect').val('');
                        $('#canBoSelect').prop('disabled', true).html('<option value="">-- Chọn sau khi chọn phòng --</option>');
                        $('#ghiChuPhanCong').val('');
                    }
                } else {
                    toastr.error(result.message || 'Không thể phân công');
                }
            },
            error: function (xhr) {
                console.error('Error assigning complaint:', xhr);
                toastr.error('Đã có lỗi xảy ra');
            }
        });
    }

    function loadProgressTimeline() {
        const complaintId = window.complaintId;
        if (!complaintId) {
            console.error('window.complaintId not set');
            return;
        }

        $.ajax({
            url: `/Complaint/GetProgress?id=${complaintId}`,
            method: 'GET',
            timeout: 15000,
            success: function (result) {
                if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
                    renderTimeline(result.data);
                    $('#timelineEmpty').hide();
                    console.log('Loaded ' + result.data.length + ' progress entries');
                } else {
                    $('#timelineEmpty').show();
                    console.log('No progress entries found');
                }
            },
            error: function (xhr, status, error) {
                console.error('Error loading progress timeline:', {
                    status: status,
                    error: error,
                    statusCode: xhr.status
                });
                $('#timelineEmpty').show();
            }
        });
    }

    function renderTimeline(items) {
        const container = $('#timelineContainer');
        container.empty();

        const actionLabels = {
            'Created': 'Tiếp nhận đơn',
            'Accepted': 'Thụ lý đơn',
            'Rejected': 'Không thụ lý',
            'Transferred': 'Chuyển cơ quan',
            'Assigned': 'Phân công xử lý',
            'ProgressStarted': 'Bắt đầu xử lý',
            'StageUpdated': 'Cập nhật tiến độ',
            'ExtensionRequested': 'Yêu cầu gia hạn',
            'ExtensionApproved': 'Phê duyệt gia hạn',
            'ExtensionRejected': 'Từ chối gia hạn',
            'Resolved': 'Hoàn thành xử lý',
            'NotificationSent': 'Gửi thông báo kết quả',
            'Closed': 'Đóng đơn'
        };

        const actionIconClass = {
            'Created': 'fa-file-alt text-secondary',
            'Accepted': 'fa-check-circle text-success',
            'Rejected': 'fa-times-circle text-danger',
            'Transferred': 'fa-exchange-alt text-warning',
            'Assigned': 'fa-user-check text-info',
            'ProgressStarted': 'fa-play-circle text-primary',
            'StageUpdated': 'fa-tasks text-primary',
            'Resolved': 'fa-flag-checkered text-success',
            'Closed': 'fa-lock text-secondary'
        };

        items.forEach(function (item, index) {
            const isLast = (index === items.length - 1);
            // item.action = enum name e.g. "StageUpdated", item.description may contain "[stage] content"
            const actionLabel = actionLabels[item.action] || item.action;
            const iconCls = actionIconClass[item.action] || 'fa-circle text-secondary';

            // Extract stage tag from description if prefixed with [stage]
            let stageBadge = '';
            let bodyText = item.progressDescription || '';
            const stageMatch = bodyText.match(/^\[([^\]]+)\]\s*/);
            if (stageMatch) {
                stageBadge = `<span class="badge badge-light" style="margin-right:6px;font-size:11px;background:#E8F4FD;color:#1565C0;border:1px solid #BBDEFB;">${escapeHtml(stageMatch[1])}</span>`;
                bodyText = bodyText.slice(stageMatch[0].length);
            }

            const dateDisplay = item.actionTimestamp
                ? new Date(item.actionTimestamp).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '';

            const timelineItem = `
                <div class="timeline-item-figma">
                    <div class="timeline-dot-figma ${isLast ? 'active' : ''}">
                        <i class="fas ${iconCls}" style="font-size:11px;"></i>
                    </div>
                    <div class="timeline-content-figma"
                        style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;background:#fff;">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:${bodyText ? '8px' : '0'};">
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                <span style="font-size:12px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:0.4px;">
                                    ${escapeHtml(actionLabel)}
                                </span>
                                ${stageBadge}
                            </div>
                            <span style="font-size:11px;color:#94a3b8;white-space:nowrap;margin-left:12px;flex-shrink:0;">
                                ${dateDisplay}
                            </span>
                        </div>
                        ${bodyText ? `<div style="font-size:13px;color:var(--text-sec);line-height:1.6;">${escapeHtml(bodyText)}</div>` : ''}
                        
                        ${item.attachmentFileId
                    ? `<div style="margin-top:8px;padding:6px 10px;background:#f8fafc;border-radius:6px;display:flex;align-items:center;gap:8px;border:1px solid #e2e8f0;">
                                <i class="fas fa-paperclip text-secondary" style="font-size:12px;"></i>
                                <a href="javascript:void(0)" onclick="openFilePreview('${item.attachmentFileId}', '${item.attachmentFileName || 'dinh-kem.pdf'}')" 
                                   style="font-size:12px;color:var(--primary);text-decoration:none;font-weight:500;">
                                   ${escapeHtml(item.attachmentFileName || 'Tài liệu đính kèm')}
                                </a>
                               </div>`
                    : ''}

                        ${item.updatedByUserName
                    ? `<div style="margin-top:8px;font-size:12px;color:var(--text-ter);display:flex;align-items:center;gap:4px;">
                                <i class="fas fa-user-circle"></i> ${escapeHtml(item.updatedByUserName)}
                               </div>`
                    : ''}
                    </div>
                </div>
            `;
            container.append(timelineItem);
        });
    }

    function saveTimelineMilestone() {
        const stage = $('#giaiDoanMoc').val();
        const content = $('#mocNoidung').val().trim();
        const file = $('#filesMocTienDo')[0].files[0]; // single file

        // Validation
        if (!stage) {
            toastr.warning('Vui lòng chọn giai đoạn xử lý');
            $('#giaiDoanMoc').focus();
            return;
        }

        if (!content || content.length < 10) {
            toastr.warning('Nội dung tiến độ cần ít nhất 10 ký tự');
            $('#mocNoidung').focus();
            return;
        }

        if (content.length > 2000) {
            toastr.warning('Nội dung không được vượt quá 2000 ký tự');
            $('#mocNoidung').focus();
            return;
        }

        // File validation (single file)
        if (file) {
            if (file.size > 20 * 1024 * 1024) {
                toastr.error(`File "${file.name}" vượt quá 20MB`);
                return;
            }
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext !== 'pdf' && ext !== 'docx') {
                toastr.error('Chỉ chấp nhận file PDF hoặc DOCX');
                return;
            }
        }

        // Confirm before save (BR-10: immutable)
        if (!confirm('Mốc tiến độ sau khi lưu không thể chỉnh sửa hoặc xóa. Bạn có chắc chắn?')) return;

        // Prepare FormData for file upload
        const formData = new FormData();
        formData.append('id', window.complaintId);
        formData.append('stage', stage);
        formData.append('content', content);
        formData.append('__RequestVerificationToken', getAntiForgeryToken());

        if (file) {
            formData.append('files', file);
        }

        // Disable button during save
        const btnSave = $('#btnSaveTimeline');
        btnSave.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang lưu...');

        $.ajax({
            url: '/Complaint/AddProgress',
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'X-XSRF-TOKEN': getCookie('XSRF-TOKEN')
            },
            success: function (result) {
                if (result.success) {
                    // Clear form
                    $('#giaiDoanMoc').val('');
                    $('#mocNoidung').val('');
                    $('#mocNoidungCount').text('0/2000').css('color', 'var(--text-sec)');
                    $('#filesMocTienDo').val('');
                    $('#filesMocTienDoQueue').empty();

                    // Rule 3.1: Any progress save → transition to InProgress if not already
                    if (window.complaintStatus !== 'InProgress') {
                        // Status transition needed → reload page after update
                        updateComplaintStatusToInProgress();
                    } else if (stage === 'Hoàn thiện') {
                        // Already InProgress + "Hoàn thiện" → reload to unlock notification tab
                        toastr.success('Đã lưu mốc tiến độ thành công');
                        setTimeout(() => location.reload(), 800);
                    } else {
                        // Already InProgress, other stages → just reload timeline
                        toastr.success('Đã lưu mốc tiến độ thành công');
                        loadProgressTimeline();
                    }
                } else {
                    toastr.error(result.message || 'Không thể lưu mốc tiến độ');
                }
            },
            error: function (xhr) {
                console.error('Error saving milestone:', xhr);
                toastr.error('Đã có lỗi xảy ra');
            },
            complete: function () {
                btnSave.prop('disabled', false).html('<i class="fas fa-plus-circle"></i> Lưu mốc tiến độ');
            }
        });
    }

    function updateComplaintStatusToInProgress() {
        $.ajax({
            url: '/Complaint/UpdateStatus',
            method: 'POST',
            data: {
                id: window.complaintId,
                status: 'InProgress',
                __RequestVerificationToken: getAntiForgeryToken()
            },
            headers: {
                'X-XSRF-TOKEN': getCookie('XSRF-TOKEN')
            },
            success: function (result) {
                if (result.success) {
                    toastr.success('Đã cập nhật trạng thái thành "Đang xử lý"');
                    setTimeout(() => {
                        location.reload();
                    }, 800);
                } else {
                    toastr.warning('Lưu mốc thành công nhưng cập nhật trạng thái thất bại');
                    setTimeout(() => {
                        location.reload();
                    }, 1200);
                }
            },
            error: function (xhr) {
                console.error('Error updating complaint status:', xhr);
                toastr.warning('Lưu mốc thành công nhưng không thể cập nhật trạng thái');
                setTimeout(() => {
                    location.reload();
                }, 1200);
            }
        });
    }

    // ══════════════════════════════════════════════════════════════
    // TAB 4: EXTENSION REQUESTS
    // ══════════════════════════════════════════════════════════════
    function initExtensionTab() {
        // Check if already initialized
        if ($('#soNgayGiaHan').data('initialized')) return;
        $('#soNgayGiaHan').data('initialized', true);

        // Load extension info (deadline info)
        loadExtensionInfo();

        // Load extension requests list
        loadExtensionList();

        // Number spinner buttons
        $('#btnDecreaseDays').on('click', () => adjustExtensionDays(-1));
        $('#btnIncreaseDays').on('click', () => adjustExtensionDays(1));

        // Input change → update date picker
        $('#soNgayGiaHan').on('input', updateNewDeadlineFromDays);
        // Input change → update date picker
        $('#soNgayGiaHan').on('input', updateNewDeadlineFromDays);

        // Date input change → calculate days
        $('#hanGiaiQuyetMoi').on('change', function() {
            const dateValue = $(this).val();
            if (dateValue) {
                calculateDaysFromSelectedDate(dateValue);
            }
        });

        // Date input change → calculate days
        $('#hanGiaiQuyetMoi').on('change', function() {
            const dateValue = $(this).val();
            if (dateValue) {
                calculateDaysFromSelectedDate(dateValue);
            }
        });

        // Character counter for reason
        $('#lyDoGiaHan').on('input', function () {
            const len = this.value.length;
            $('#lyDoGiaHanCount').text(`${len}/500`);

            // Hide error if valid
            if (len >= 20) {
                $('#lyDoGiaHanError').hide();
                $(this).removeClass('input-error');
            }
        });

        // Submit extension request
        $('#btnSubmitExtension').on('click', submitExtensionRequest);
    }

    function loadExtensionInfo() {
        const complaintId = window.complaintId;
        if (!complaintId) return;

        $.ajax({
            url: `/Complaint/GetExtensionInfo?id=${complaintId}`,
            method: 'GET',
            success: function (result) {
                if (result.success && result.data) {
                    const data = result.data;

                    // Update current deadline info
                    $('#hanGocDisplay').text(data.originalDueDateDisplay || '--');
                    $('#soLanGiaHan').text(data.extensionCount || 0);
                    $('#giaHanBadge').text(`tối đa ${data.maxExtensionCount || 1} lần`);
                    $('#giaHanToiDa').text(`${data.maxExtensionDays || 30} ngày`);

                    // If has extended, show new deadline
                    if (data.currentDueDateDisplay) {
                        $('#hanSauGiaHan').text(data.currentDueDateDisplay)
                            .css('color', 'var(--primary)');
                    }

                    // Check if extension allowed
                    if (data.extensionCount >= data.maxExtensionCount) {
                        // Block further extensions
                        $('#extensionForm').hide();
                        $('#extensionBlockedMsg').show();
                        $('#extensionCountMsg').text(data.extensionCount);
                        // Update helper text to show limit reached
                        $('#soNgayGiaHanHelper').text(
                            `Đã dùng hết ${data.maxExtensionCount} lần gia hạn`
                        ).css('color', 'var(--error)');
                    } else {
                        // Set max days for input — driven by complaint type config (BR-06)
                        const maxDays = data.maxExtensionDays || 30;
                        $('#soNgayGiaHan').attr('max', maxDays).val(maxDays);

                        // Update helper text: "Giới hạn tối đa: N ngày (còn M lần gia hạn)"
                        const remaining = data.maxExtensionCount - data.extensionCount;
                        $('#soNgayGiaHanHelper').text(
                            `Giới hạn tối đa: ${maxDays} ngày (còn ${remaining} lần gia hạn)`
                        ).css('color', '');

                        // Store original due date for calculation and extension list
                        const latestExt = data.extensions && data.extensions.length > 0 ? data.extensions[0] : null;
                        window.extensionData = {
                            originalDueDate: data.originalDueDate,
                            maxExtensionDays: maxDays,
                            extensionCount: data.extensionCount || 0,
                            maxExtensionCount: data.maxExtensionCount || 1,
                            extensions: data.extensions || [],
                            // Latest extension request info (from first item in extensions list)
                            latestExtensionRequestedDate: latestExt?.createdAt,
                            latestExtensionRequestedByUserName: latestExt?.requestedByUserName,
                            latestExtensionRequestReason: latestExt?.requestReason,
                            latestExtensionStatus: latestExt?.status
                        };

                        // Initial datepicker update
                        updateNewDeadlineFromDays();
                    }
                }
            },
            error: function (xhr) {
                console.error('Error loading extension info:', xhr);
            }
        });
    }

    function adjustExtensionDays(delta) {
        const input = $('#soNgayGiaHan');
        const current = parseInt(input.val()) || 0;
        const maxDays = parseInt(input.attr('max')) || 30;
        const newVal = Math.max(1, Math.min(maxDays, current + delta));
        input.val(newVal);
        updateNewDeadlineFromDays();
    }

    // ── Update new deadline date input FROM days input (working days calculation) ──
    function updateNewDeadlineFromDays() {
        const days = parseInt($('#soNgayGiaHan').val()) || 0;

        if (days < 1 || !window.extensionData || !window.extensionData.originalDueDate) {
            $('#hanGiaiQuyetMoi').val('');
            return;
        }

        const maxDays = window.extensionData.maxExtensionDays || 30;
        if (days > maxDays) {
            toastr.warning(`Số ngày gia hạn không được vượt quá ${maxDays} ngày`);
            $('#hanGiaiQuyetMoi').val('');
            return;
        }

        // Calculate new deadline (original + working days)
        const originalDue = new Date(window.extensionData.originalDueDate);
        const newDue = addWorkingDays(originalDue, days);

        // Format to YYYY-MM-DD for HTML5 date input
        const year = newDue.getFullYear();
        const month = String(newDue.getMonth() + 1).padStart(2, '0');
        const day = String(newDue.getDate()).padStart(2, '0');
        $('#hanGiaiQuyetMoi').val(`${year}-${month}-${day}`);
    }

    // ── Calculate days FROM selected date (reverse calculation) ──
    function calculateDaysFromSelectedDate(dateValue) {
        // dateValue is in YYYY-MM-DD format from HTML5 date input
        const parts = dateValue.split('-');
        if (parts.length !== 3) return;

        const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
        
        if (!window.extensionData || !window.extensionData.originalDueDate) {
            toastr.warning('Không tìm thấy hạn gốc để tính toán');
            return;
        }

        const originalDue = new Date(window.extensionData.originalDueDate);
        
        // Validate: selected date must be after original due date
        if (selectedDate <= originalDue) {
            toastr.warning('Ngày mới phải sau hạn giải quyết hiện tại');
            $('#hanGiaiQuyetMoi').val('');
            return;
        }

        // Calculate working days between original and selected date
        const workingDays = getWorkingDaysDifference(originalDue, selectedDate);
        
        // Validate max extension days
        const maxDays = window.extensionData.maxExtensionDays || 30;
        if (workingDays > maxDays) {
            toastr.warning(`Số ngày gia hạn vượt quá giới hạn ${maxDays} ngày làm việc`);
            $('#hanGiaiQuyetMoi').val('');
            return;
        }

        // Update days input
        $('#soNgayGiaHan').val(workingDays);
        toastr.success(`Tự động tính: ${workingDays} ngày làm việc`);
    }

    // ── Calculate days FROM selected date (reverse calculation) ──
    function calculateDaysFromSelectedDate(dateText) {
        // Parse dd/mm/yyyy format
        const parts = dateText.split('/');
        if (parts.length !== 3) return;

        const selectedDate = new Date(parts[2], parts[1] - 1, parts[0]);
        
        if (!window.extensionData || !window.extensionData.originalDueDate) {
            toastr.warning('Không tìm thấy hạn gốc để tính toán');
            return;
        }

        const originalDue = new Date(window.extensionData.originalDueDate);
        
        // Validate: selected date must be after original due date
        if (selectedDate <= originalDue) {
            toastr.warning('Ngày mới phải sau hạn giải quyết hiện tại');
            $('#hanGiaiQuyetMoi').val('');
            return;
        }

        // Calculate working days between original and selected date
        const workingDays = getWorkingDaysDifference(originalDue, selectedDate);
        
        // Validate max extension days
        const maxDays = window.extensionData.maxExtensionDays || 30;
        if (workingDays > maxDays) {
            toastr.warning(`Số ngày gia hạn vượt quá giới hạn ${maxDays} ngày làm việc`);
            $('#hanGiaiQuyetMoi').val('');
            return;
        }

        // Update days input
        $('#soNgayGiaHan').val(workingDays);
        toastr.success(`Tự động tính: ${workingDays} ngày làm việc`);
    }

    function submitExtensionRequest() {
        const days = parseInt($('#soNgayGiaHan').val());
        const reason = $('#lyDoGiaHan').val().trim();

        // Validation
        if (!days || days < 1) {
            toastr.warning('Vui lòng nhập số ngày gia hạn');
            $('#soNgayGiaHan').focus();
            return;
        }

        const maxDays = window.extensionData?.maxExtensionDays || 30;
        if (days > maxDays) {
            toastr.warning(`Số ngày gia hạn không được vượt quá ${maxDays} ngày`);
            $('#soNgayGiaHan').focus();
            return;
        }

        if (reason.length < 20) {
            toastr.warning('Lý do gia hạn phải có ít nhất 20 ký tự');
            $('#lyDoGiaHan').addClass('input-error').focus();
            $('#lyDoGiaHanError').show();
            return;
        }

        if (reason.length > 500) {
            toastr.warning('Lý do gia hạn không được vượt quá 500 ký tự');
            $('#lyDoGiaHan').focus();
            return;
        }

        // Confirm with max days info
        if (!confirm(`Xác nhận gia hạn ${days} ngày làm việc (giới hạn: ${maxDays} ngày)?`)) return;

        // Disable button during request
        const btnSubmit = $('#btnSubmitExtension');
        btnSubmit.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xử lý...');

        $.ajax({
            url: '/Complaint/RequestExtension',
            method: 'POST',
            data: {
                id: window.complaintId,
                extensionDays: days,
                reason: reason,
                extendedDeadline: $('#hanGiaiQuyetMoi').val(),
                __RequestVerificationToken: getAntiForgeryToken()
            },
            headers: {
                'X-XSRF-TOKEN': getCookie('XSRF-TOKEN')
            },
            success: function (result) {
                if (result.success) {
                    toastr.success(result.message || 'Gia hạn thành công');
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
                        var html = result.message + '<ul class="mb-0 mt-1 pl-4" style="text-align:left;">';
                        result.errors.forEach(function (e) {
                            html += '<li>' + e + '</li>';
                        });
                        html += '</ul>';
                        toastr.error(html, 'Lỗi', { escapeHtml: false });
                    } else {
                        toastr.error(result.message || 'Không thể gia hạn');
                    }
                }
            },
            error: function (xhr) {
                console.error('Error submitting extension request:', xhr);
                toastr.error('Đã có lỗi xảy ra');
            },
            complete: function () {
                btnSubmit.prop('disabled', false).html('<i class="fas fa-clock"></i> Xác nhận gia hạn');
            }
        });
    }

    // ── Load extension requests list ──────────────────────────────
    function loadExtensionList() {
        $.ajax({
            url: `/Complaint/GetExtensionsList?id=${window.complaintId}`,
            method: 'GET',
            success: function (result) {
                if (result.success && result.data && Array.isArray(result.data)) {
                    renderExtensionList(result.data);
                } else {
                    $('#extensionListBody').html(
                        '<div style="padding:24px;text-align:center;color:var(--text-ter);">' +
                        '<i class="fas fa-inbox" style="font-size:28px;display:block;margin-bottom:8px;"></i>' +
                        '<p style="margin:0;font-size:13px;">Chưa có yêu cầu gia hạn nào</p></div>'
                    );
                }
            },
            error: function() {
                $('#extensionListBody').html(
                    '<div style="padding:24px;text-align:center;color:var(--error);">' +
                    '<i class="fas fa-exclamation-triangle" style="font-size:28px;display:block;margin-bottom:8px;"></i>' +
                    '<p style="margin:0;font-size:13px;">Lỗi tải danh sách gia hạn</p></div>'
                );
            }
        });
    }

    // ── Render extension list ────────────────────────────────────
    function renderExtensionList(extensions) {
        if (!extensions || extensions.length === 0) {
            $('#extensionListBody').html(
                '<div style="padding:24px;text-align:center;color:var(--text-ter);">' +
                '<i class="fas fa-inbox" style="font-size:28px;display:block;margin-bottom:8px;"></i>' +
                '<p style="margin:0;font-size:13px;">Chưa có yêu cầu gia hạn nào</p></div>'
            );
            return;
        }

        const statusBadgeClass = {
            'Pending': 'badge-warning',
            'Approved': 'badge-success',
            'Rejected': 'badge-danger'
        };

        const statusLabel = {
            'Pending': 'Chờ duyệt',
            'Approved': 'Đã duyệt',
            'Rejected': 'Từ chối'
        };

        let html = '<div style="padding:0;">';
        extensions.forEach(function (ext, idx) {debugger
            const requestedDate = ext.requestedDate ? new Date(ext.requestedDate).toLocaleString('vi-VN') : '';

            const borderTop = idx > 0 ? 'border-top:1px solid #e2e8f0;' : '';

            html += `
                <div style="${borderTop}padding:16px 20px;">
                    <!-- Header: Date + Requester -->
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                        <div style="flex:1;">
                            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
                                <span style="font-size:12px;color:#94a3b8;white-space:nowrap;">📅 ${requestedDate}</span>
                            </div>
                            <div style="font-size:12px;color:var(--text-sec);">
                                <i class="fas fa-user-circle mr-1"></i> 
                                <strong>${escapeHtml(ext.requestedByUserName)}</strong>
                            </div>
                        </div>
                    </div>

                    <!-- Extension Days -->
                    <div style="background:#f0f9ff;border-left:4px solid var(--primary);padding:10px 12px;border-radius:4px;margin-bottom:10px;font-size:12px;">
                        <i class="fas fa-hourglass-half mr-1" style="color:var(--primary);"></i> 
                        <strong>Gia hạn:</strong> <span style="color:var(--primary);font-weight:600;">${ext.extensionDays} ngày làm việc.</span>
                    </div>

                    <!-- Request Reason -->
                    ${ext.requestReason ? `
                        <div style="background:#fef3f2;border-left:4px solid var(--warning);padding:10px 12px;border-radius:4px;margin-bottom:10px;font-size:12px;">
                            <i class="fas fa-comment-dots mr-1" style="color:var(--warning);"></i>
                            <strong>Lý do:</strong>
                            <div style="margin-top:4px;color:var(--text-sec);">${escapeHtml(ext.requestReason)}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        html += '</div>';

        $('#extensionListBody').html(html);
    }

    // ── Load extension requests list ──────────────────────────────
    function loadExtensionList() {
        $.ajax({
            url: `/Complaint/GetExtensionsList?id=${window.complaintId}`,
            method: 'GET',
            success: function (result) {
                if (result.success && result.data && Array.isArray(result.data)) {
                    renderExtensionList(result.data);
                } else {
                    $('#extensionListBody').html(
                        '<div style="padding:24px;text-align:center;color:var(--text-ter);">' +
                        '<i class="fas fa-inbox" style="font-size:28px;display:block;margin-bottom:8px;"></i>' +
                        '<p style="margin:0;font-size:13px;">Chưa có yêu cầu gia hạn nào</p></div>'
                    );
                }
            },
            error: function() {
                $('#extensionListBody').html(
                    '<div style="padding:24px;text-align:center;color:var(--error);">' +
                    '<i class="fas fa-exclamation-triangle" style="font-size:28px;display:block;margin-bottom:8px;"></i>' +
                    '<p style="margin:0;font-size:13px;">Lỗi tải danh sách gia hạn</p></div>'
                );
            }
        });
    }

    // ── Render extension list ────────────────────────────────────
    function renderExtensionList(extensions) {
        if (!extensions || extensions.length === 0) {
            $('#extensionListBody').html(
                '<div style="padding:24px;text-align:center;color:var(--text-ter);">' +
                '<i class="fas fa-inbox" style="font-size:28px;display:block;margin-bottom:8px;"></i>' +
                '<p style="margin:0;font-size:13px;">Chưa có yêu cầu gia hạn nào</p></div>'
            );
            return;
        }

        const statusBadgeClass = {
            'Pending': 'badge-warning',
            'Approved': 'badge-success',
            'Rejected': 'badge-danger'
        };

        const statusLabel = {
            'Pending': 'Chờ duyệt',
            'Approved': 'Đã duyệt',
            'Rejected': 'Từ chối'
        };

        let html = '<div style="padding:0;">';
        extensions.forEach(function (ext, idx) {debugger
            const requestedDate = ext.requestedDate ? new Date(ext.requestedDate).toLocaleString('vi-VN') : '';

            const borderTop = idx > 0 ? 'border-top:1px solid #e2e8f0;' : '';

            html += `
                <div style="${borderTop}padding:16px 20px;">
                    <!-- Header: Date + Requester -->
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                        <div style="flex:1;">
                            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
                                <span style="font-size:12px;color:#94a3b8;white-space:nowrap;">📅 ${requestedDate}</span>
                            </div>
                            <div style="font-size:12px;color:var(--text-sec);">
                                <i class="fas fa-user-circle mr-1"></i> 
                                <strong>${escapeHtml(ext.requestedByUserName)}</strong>
                            </div>
                        </div>
                    </div>

                    <!-- Extension Days -->
                    <div style="background:#f0f9ff;border-left:4px solid var(--primary);padding:10px 12px;border-radius:4px;margin-bottom:10px;font-size:12px;">
                        <i class="fas fa-hourglass-half mr-1" style="color:var(--primary);"></i> 
                        <strong>Gia hạn:</strong> <span style="color:var(--primary);font-weight:600;">${ext.extensionDays} ngày làm việc.</span>
                    </div>

                    <!-- Request Reason -->
                    ${ext.requestReason ? `
                        <div style="background:#fef3f2;border-left:4px solid var(--warning);padding:10px 12px;border-radius:4px;margin-bottom:10px;font-size:12px;">
                            <i class="fas fa-comment-dots mr-1" style="color:var(--warning);"></i>
                            <strong>Lý do:</strong>
                            <div style="margin-top:4px;color:var(--text-sec);">${escapeHtml(ext.requestReason)}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        html += '</div>';

        $('#extensionListBody').html(html);
    }

    // ══════════════════════════════════════════════════════════════
    // TAB 5: KẾT QUẢ & ĐÓNG HỒ SƠ (SCR-NV-DON-007)
    // ══════════════════════════════════════════════════════════════

    let hasQuyetDinhPdf = false;

    function initResultTab() {
        // Prevent duplicate initialization
        if ($('#loaiKetQua').data('initialized')) return;
        $('#loaiKetQua').data('initialized', true);

        // Character counter for summary
        const txtSummary = $('#tomTatKetQua');
        const summaryCounter = $('#tomTatKQCount');
        const summaryError = $('#tomTatKQError');

        txtSummary.on('input', function () {
            const length = $(this).val().length;
            summaryCounter.text(`${length}/3000`);

            // Validate minimum 20 characters
            if (length > 0 && length < 20) {
                summaryError.show();
                $(this).addClass('input-error');
            } else {
                summaryError.hide();
                $(this).removeClass('input-error');
            }

            updateDongHoSoButton();
        });

        // PDF file upload handler
        $('#quyetDinhPdf').on('change', function () {
            const file = this.files[0];
            const $queue = $('#quyetDinhPdfQueue');
            $queue.empty();

            if (!file) {
                hasQuyetDinhPdf = false;
                $('#pdfWarning').show();
                updateDongHoSoButton();
                return;
            }

            // Validate file type
            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            if (!isPdf) {
                toastr.error('Chỉ chấp nhận file PDF');
                $(this).val('');
                hasQuyetDinhPdf = false;
                updateDongHoSoButton();
                renderPdfQueueError(file.name, 'Chỉ chấp nhận file PDF');
                return;
            }

            // Validate file size (20MB max per spec)
            if (file.size > 20 * 1024 * 1024) {
                toastr.error('File PDF không được vượt quá 20MB');
                $(this).val('');
                hasQuyetDinhPdf = false;
                updateDongHoSoButton();
                renderPdfQueueError(file.name, 'Vượt quá 20MB');
                return;
            }

            // Valid file
            hasQuyetDinhPdf = true;
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            $queue.html(
                `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;` +
                `background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:13px;">` +
                `<i class="fas fa-file-pdf" style="color:#dc2626;flex-shrink:0;"></i>` +
                `<span style="flex:1;">${escapeHtml(file.name)}</span>` +
                `<span style="color:#94a3b8;margin-right:8px;">${sizeMB}MB</span>` +
                `<i class="fas fa-check-circle" style="color:#16a34a;flex-shrink:0;"></i>` +
                `<i class="fas fa-times" style="cursor:pointer;color:#94a3b8;margin-left:4px;" ` +
                `title="Xóa" onclick="$('#quyetDinhPdf').val('');$('#quyetDinhPdfQueue').empty();` +
                `window.hasQuyetDinhPdfFlag=false;$('#pdfWarning').show();` +
                `if(window.ComplaintDetail)window.ComplaintDetail.resetPdfFlag();"></i>` +
                `</div>`
            );
            $('#pdfWarning').hide();
            updateDongHoSoButton();
        });

        // Drag-and-drop visual feedback for PDF zone
        const $pdfZone = $('#quyetDinhPdfZone');
        $pdfZone.on('dragover dragenter', function (e) {
            e.preventDefault();
            $(this).addClass('drag-over');
        }).on('dragleave drop', function (e) {
            e.preventDefault();
            $(this).removeClass('drag-over');
        });

        // Form field change listeners
        $('#loaiKetQua, #soVanBan').on('change input', function () {
            updateDongHoSoButton();
        });
        $('#ngayGiaiQuyet').on('change input', function () {
            validateResolutionDate();
            updateOverdueIndicator();
            updateDongHoSoButton();
        });

        // Close case button
        $('#btnDongHoSo').on('click', function () {
            submitDongHoSo();
        });

        // Set min date for resolution date = acceptance date
        if (window.acceptanceDate) {
            $('#ngayGiaiQuyet').attr('min', window.acceptanceDate);
        }
    }

    function updateDongHoSoButton() {
        // Guard: do not process if case is already closed
        if (window.isClosed === true) return;

        const btnClose = $('#btnDongHoSo');
        if (!btnClose.length) return;

        const loaiKQ = $('#loaiKetQua').val();
        const ngayGQ = $('#ngayGiaiQuyet').val();
        const soVB = $('#soVanBan').val().trim();
        const tomTat = $('#tomTatKetQua').val().trim();

        // Validate all required fields (loại, ngày, số VB, tóm tắt, PDF) + hasHoanThienProgress
        // NOTE: Notification is sent AFTER closing, not before
        let isValid = loaiKQ !== '' &&
            ngayGQ !== '' &&
            soVB !== '' &&
            tomTat.length >= 20 &&
            tomTat.length <= 3000 &&
            hasQuyetDinhPdf &&
            window.hasHoanThienProgress === true;

        // Validate resolution date >= acceptance date
        let isDateValid = true;
        if (ngayGQ && window.acceptanceDate) {
            const resDate = new Date(ngayGQ);
            const acceptDate = new Date(window.acceptanceDate);
            resDate.setHours(0, 0, 0, 0);
            acceptDate.setHours(0, 0, 0, 0);
            if (resDate < acceptDate) {
                isDateValid = false;
                isValid = false;
            }
        }

        btnClose.prop('disabled', !isValid);

        if (isValid) {
            btnClose.html('<i class="fas fa-lock"></i> Đóng hồ sơ');
        } else if (window.hasHoanThienProgress !== true) {
            btnClose.html('<i class="fas fa-lock"></i> Đóng hồ sơ (Cần mốc "Hoàn thiện")');
        } else if (!isDateValid) {
            btnClose.html('<i class="fas fa-lock"></i> Đóng hồ sơ (Ngày GQ phải >= ngày TL)');
        } else {
            btnClose.html('<i class="fas fa-lock"></i> Đóng hồ sơ (Chưa đủ điều kiện)');
        }
    }

    /**
     * Validate resolution date:
     * - Must be >= acceptance date
     * - Must be <= today
     */
    function validateResolutionDate() {
        const $input = $('#ngayGiaiQuyet');
        const resDate = $input.val();

        if (!resDate) return;

        const selectedDate = new Date(resDate);
        selectedDate.setHours(0, 0, 0, 0);

        // Check >= acceptance date
        if (window.acceptanceDate) {
            const acceptDate = new Date(window.acceptanceDate);
            acceptDate.setHours(0, 0, 0, 0);

            if (selectedDate < acceptDate) {
                toastr.warning('Ngày giải quyết không được nhỏ hơn ngày thụ lý');
                $input.val('');
                return;
            }
        }

        // Check <= today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate > today) {
            toastr.warning('Ngày giải quyết không được lớn hơn ngày hiện tại');
            $input.val('');
            return;
        }
    }

    // ── Overdue indicator for ngayGiaiQuyet (GAP-007-05) ──
    // Calculate overdue working days (excluding Sat/Sun)
    function updateOverdueIndicator() {
        const $tag = $('#overdueTag');
        if (!$tag.length) return;

        const ngayVal = $('#ngayGiaiQuyet').val();
        if (!ngayVal) { $tag.hide(); return; }

        // Use extendedDeadline if exists, otherwise resolutionDeadline
        const deadlineStr = window.extendedDeadline || window.resolutionDeadline;
        if (!deadlineStr) { $tag.hide(); return; }

        const ngay = new Date(ngayVal);
        const deadline = new Date(deadlineStr);

        if (ngay > deadline) {
            // Calculate working days between deadline and resolution date
            const overdueWorkingDays = getWorkingDaysDifference(deadline, ngay);
            $tag.text(`Quá hạn ${overdueWorkingDays} ngày LV`)
                .css('color', 'var(--error)')
                .show();
        } else {
            $tag.hide();
        }
    }

    function submitDongHoSo() {
        // Confirmation dialog
        if (!confirm('⚠️ Sau khi đóng hồ sơ, không thể mở lại để chỉnh sửa.\n\nBạn có chắc chắn muốn đóng hồ sơ này không?')) {
            return;
        }

        const btnClose = $('#btnDongHoSo');
        btnClose.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xử lý...');

        // Client-side validation
        const resolutionType = $('#loaiKetQua').val();
        if (!resolutionType) {
            toastr.error('Vui lòng chọn loại kết quả');
            btnClose.prop('disabled', false).html('<i class="fas fa-lock"></i> Đóng hồ sơ');
            return;
        }

        const resolutionDate = $('#ngayGiaiQuyet').val();
        if (!resolutionDate) {
            toastr.error('Vui lòng chọn ngày giải quyết');
            btnClose.prop('disabled', false).html('<i class="fas fa-lock"></i> Đóng hồ sơ');
            return;
        }

        // Validate resolution date >= acceptance date
        if (window.acceptanceDate) {
            const resDate = new Date(resolutionDate);
            const acceptDate = new Date(window.acceptanceDate);
            resDate.setHours(0, 0, 0, 0);
            acceptDate.setHours(0, 0, 0, 0);

            if (resDate < acceptDate) {
                toastr.error('Ngày giải quyết không được nhỏ hơn ngày thụ lý');
                btnClose.prop('disabled', false).html('<i class="fas fa-lock"></i> Đóng hồ sơ');
                return;
            }
        }

        const decisionNumber = $('#soVanBan').val().trim();
        if (!decisionNumber || decisionNumber.length > 100) {
            toastr.error('Vui lòng nhập số văn bản quyết định (tối đa 100 ký tự)');
            btnClose.prop('disabled', false).html('<i class="fas fa-lock"></i> Đóng hồ sơ');
            return;
        }

        const summary = $('#tomTatKetQua').val().trim();
        if (!summary || summary.length < 20 || summary.length > 3000) {
            toastr.error('Tóm tắt kết quả phải từ 20 đến 3000 ký tự');
            btnClose.prop('disabled', false).html('<i class="fas fa-lock"></i> Đóng hồ sơ');
            return;
        }

        // Upload PDF to FileManager first
        const pdfInput = $('#quyetDinhPdf')[0];
        const pdfFile = pdfInput.files[0];

        if (!pdfFile) {
            toastr.error('Vui lòng chọn file PDF quyết định');
            btnClose.prop('disabled', false).html('<i class="fas fa-lock"></i> Đóng hồ sơ');
            return;
        }

        // Validate PDF file type and size
        if (!pdfFile.name.toLowerCase().endsWith('.pdf')) {
            toastr.error('Chỉ chấp nhận file PDF');
            btnClose.prop('disabled', false).html('<i class="fas fa-lock"></i> Đóng hồ sơ');
            return;
        }

        if (pdfFile.size > 20 * 1024 * 1024) {
            toastr.error('File PDF không được vượt quá 20MB');
            btnClose.prop('disabled', false).html('<i class="fas fa-lock"></i> Đóng hồ sơ');
            return;
        }

        // Create FormData for multipart upload
        const formData = new FormData();
        formData.append('__RequestVerificationToken', getAntiForgeryToken());
        formData.append('id', window.complaintId);
        formData.append('resolutionType', $('#loaiKetQua').val());

        // Append date (already validated above, so resolutionDate is already set)
        formData.append('resolutionDate', resolutionDate);
        formData.append('decisionNumber', $('#soVanBan').val().trim());
        formData.append('summary', $('#tomTatKetQua').val().trim());
        formData.append('decisionPdf', pdfFile);

        console.log('Closing complaint with data:', {
            id: window.complaintId,
            resolutionType: $('#loaiKetQua').val(),
            resolutionDate: resolutionDate,
            decisionNumber: $('#soVanBan').val().trim(),
            summaryLength: $('#tomTatKetQua').val().trim().length,
            pdfFileName: pdfFile.name,
            pdfSize: pdfFile.size
        });

        $.ajax({
            url: `/Complaint/CloseComplaint`,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (response) {
                if (response.success) {
                    toastr.success(response.message || 'Đã đóng hồ sơ thành công');
                    // Reload current page to show read-only state
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    toastr.error(response.message || 'Đã có lỗi xảy ra');
                    btnClose.prop('disabled', false).html('<i class="fas fa-lock"></i> Đóng hồ sơ');
                }
            },
            error: function (xhr) {
                console.error('Error closing complaint:', {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    responseText: xhr.responseText,
                    response: xhr.responseJSON
                });

                let errorMsg = 'Đã có lỗi xảy ra';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMsg = xhr.responseJSON.message;
                } else if (xhr.status === 400) {
                    errorMsg = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin.';
                } else if (xhr.status === 403) {
                    errorMsg = 'Bạn không có quyền đóng hồ sơ đơn thư.';
                }

                toastr.error(errorMsg);
                btnClose.prop('disabled', false).html('<i class="fas fa-lock"></i> Đóng hồ sơ');
            }
        });
    }

    // ══════════════════════════════════════════════════════════════
    // TAB 6: THÔNG BÁO KẾT QUẢ (SCR-NV-DON-008)
    // ══════════════════════════════════════════════════════════════

    function initNotificationTab() {
        // Prevent duplicate initialization
        if ($('#ngayThongBao').data('initialized')) return;
        $('#ngayThongBao').data('initialized', true);

        // ── Pre-fill if a notification has already been saved ──────
        if (window.savedNotificationMethod) {
            $(`input[name="hinh_thuc_thong_bao"][value="${window.savedNotificationMethod}"]`)
                .prop('checked', true);
        }
        if (window.savedNotificationDate) {
            $('#ngayThongBao').val(window.savedNotificationDate);
        }

        // ── Live validation on field change ───────────────────────
        $('input[name="hinh_thuc_thong_bao"]').on('change', function () {
            $('#notifyMethodError').hide();
            $('input[name="hinh_thuc_thong_bao"]').closest('label').css('color', '');
        });

        $('#ngayThongBao').on('change input', function () {
            validateNotificationDate();
        });

        // ── Save button click ─────────────────────────────────────
        $('#btnLuuThongBao').on('click', function () {
            submitSaveNotification();
        });
    }

    // ── Client-side date validation ────────────────────────────────
    function validateNotificationDate() {
        var $input = $('#ngayThongBao');
        var $error = $('#ngayThongBaoError');
        var val = $input.val();
        const _closureDate = window.closureDate;

        if (!val) {
            $input.removeClass('input-error');
            $error.hide();
            return false;
        }

        if(_closureDate && new Date(val) < new Date(_closureDate)) {
            $input.addClass('input-error');
            $error.text('Ngày thông báo không được trước ngày đóng hồ sơ').show();
            return false;
        }


        $input.removeClass('input-error');
        $error.hide();
        return true;
    }

    // ── AJAX submit ────────────────────────────────────────────────
    function submitSaveNotification() {
        var method = $('input[name="hinh_thuc_thong_bao"]:checked').val();
        var date = $('#ngayThongBao').val();

        // Validate hình thức
        if (!method) {
            $('#notifyMethodError').show();
            $('input[name="hinh_thuc_thong_bao"]').first().focus();
            return;
        }

        // Validate ngày thông báo
        if (!date) {
            $('#ngayThongBao').addClass('input-error');
            $('#ngayThongBaoError').show();
            $('#ngayThongBao').focus();
            return;
        }

        if (!validateNotificationDate()) return;

        var $btn = $('#btnLuuThongBao');
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        $.ajax({
            url: '/Complaint/SaveNotification',
            type: 'POST',
            data: {
                __RequestVerificationToken: getAntiForgeryToken(),
                id: window.complaintId,
                notificationMethod: method,
                notificationDate: date
            },
            success: function (response) {
                if (response.success) {
                    toastr.success(response.message || 'Đã lưu thông báo kết quả.');
                    // Update saved values so re-init doesn't clear form
                    window.savedNotificationMethod = method;
                    window.savedNotificationDate = date;
                    // Rule 3.3: After notification saved → enable close button
                    window.notificationSaved = true;
                    updateDongHoSoButton();
                    $btn.prop('disabled', false)
                        .html('<i class="fas fa-check mr-1"></i> Đã lưu');
                    setTimeout(function () {
                        $btn.html('<i class="fas fa-save mr-1"></i> Lưu thông báo')
                            .prop('disabled', false);
                        window.location.reload();
                    }, 2500);
                } else {
                    toastr.error(response.message || 'Không thể lưu thông báo kết quả');
                    $btn.prop('disabled', false)
                        .html('<i class="fas fa-save mr-1"></i> Lưu thông báo');
                }
            },
            error: function (xhr) {
                var msg = 'Đã có lỗi xảy ra';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    msg = xhr.responseJSON.message;
                } else if (xhr.status === 403) {
                    msg = 'Bạn không có quyền lưu thông báo kết quả';
                } else if (xhr.status === 400) {
                    msg = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.';
                }
                toastr.error(msg);
                $btn.prop('disabled', false)
                    .html('<i class="fas fa-save mr-1"></i> Lưu thông báo');
            }
        });
    }

    // ══════════════════════════════════════════════════════════════
    // DROPDOWN: XUẤT VĂN BẢN
    // ══════════════════════════════════════════════════════════════
    function initDropdownExport() {
        const btnDropdown = $('#btnXuatVanBan');
        const dropdownMenu = $('#dropdownXuatVanBan');

        // Toggle dropdown on button click
        btnDropdown.on('click', function (e) {
            e.stopPropagation();
            toggleDropdown();
        });

        // Close dropdown when clicking outside
        $(document).on('click', function (e) {
            if (dropdownOpen && !$(e.target).closest('.dropdown-wrapper').length) {
                closeDropdown();
            }
        });

        // Handle dropdown item clicks
        dropdownMenu.find('.dropdown-item').on('click', function () {
            const action = $(this).data('action');
            handleExportAction(action);
            closeDropdown();
        });
    }

    function toggleDropdown() {
        const dropdownMenu = $('#dropdownXuatVanBan');
        if (dropdownOpen) {
            closeDropdown();
        } else {
            dropdownMenu.fadeIn(150);
            dropdownOpen = true;
        }
    }

    function closeDropdown() {
        $('#dropdownXuatVanBan').fadeOut(150);
        dropdownOpen = false;
    }

    function handleExportAction(action) {
        const complaintId = window.complaintId;
        const complaintCode = window.complaintCode || 'DON';

        switch (action) {
            case 'print-reception':
                printDocument('phieu-tiep-nhan');
                break;
            case 'print-acceptance':
                printDocument('phieu-thu-ly');
                break;
            case 'export-docx':
                exportDocument('docx');
                break;
            case 'export-pdf':
                exportDocument('pdf');
                break;
            default:
                toastr.error('Chức năng chưa được triển khai');
        }
    }

    function printDocument(type) {
        toastr.info('Đang chuẩn bị in...');
        const url = `/api/v1/complaintpetitions/${window.complaintId}/print/${type}`;

        // Open print preview in new window
        window.open(url, '_blank');
    }

    function exportDocument(format) {
        toastr.info(`Đang chuẩn bị file ${format.toUpperCase()}...`);
        const url = `/api/v1/complaintpetitions/${window.complaintId}/export/${format}`;

        // Trigger download
        window.location.href = url;
    }

    // ══════════════════════════════════════════════════════════════
    // FILE PREVIEW MODAL
    // ══════════════════════════════════════════════════════════════
    function initFilePreviewModal() {
        // Reset modal state when hidden
        $(document).on('hidden.bs.modal', '#filePreviewModal', function () {
            $('#filePreviewFrame').attr('src', 'about:blank').hide();
            $('#filePreviewLoading').hide();
            $('#filePreviewUnsupported').hide();
        });
    }

    window.openFilePreview = function (fileId, fileName) {
        if (!fileId) return;

        $('#pageFilePreviewFileName').text(fileName);
        $('#pageFilePreviewLoading').show();
        $('#pageFilePreviewFrame').hide();
        $('#pageFilePreviewUnsupported').hide();

        $('#pageFilePreviewModal').modal('show');

        const downloadUrl = `/FileManager/Download?id=${fileId}`;
        $('#pageFilePreviewDownloadBtn, #pageFilePreviewUnsupportedLink').attr('href', downloadUrl);

        const ext = (fileName.split('.').pop() || '').toLowerCase();
        const viewableExts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'txt'];

        if (viewableExts.includes(ext)) {
            // Get secure preview URL from FileManager (consistency with Violation & Award)
            $.ajax({
                url: '/FileManager/GetPreviewUrl?id=' + fileId,
                type: 'GET',
                success: function (res) {
                    if (res.success && res.url) {
                        $('#pageFilePreviewFrame').attr('src', res.url).on('load', function () {
                            $('#pageFilePreviewLoading').hide();
                            $(this).show();
                        });
                    } else {
                        $('#pageFilePreviewLoading').hide();
                        $('#pageFilePreviewUnsupported').show();
                    }
                },
                error: function () {
                    $('#pageFilePreviewLoading').hide();
                    $('#pageFilePreviewUnsupported').show();
                }
            });
        } else {
            $('#pageFilePreviewLoading').hide();
            $('#pageFilePreviewUnsupported').show();
        }
    };

    window.closeFilePreview = function () {
        $('#filePreviewModal').modal('hide');
    };
    window.openModal = function (modalId) {
        $(`#${modalId}`).modal('show');
    };

    window.closeModal = function (modalId) {
        $(`#${modalId}`).modal('hide');
    };

    // Clear form fields when any modal is hidden
    $(document).on('hidden.bs.modal', '.modal', function () {
        $(this).find('input:not([type=hidden]), textarea, select').val('');
        // Also clear validation states if any
        $(this).find('.is-invalid').removeClass('is-invalid');
    });

    // ══════════════════════════════════════════════════════════════
    // UTILITIES
    // ══════════════════════════════════════════════════════════════
    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    function renderPdfQueueError(fileName, errorMsg) {
        $('#quyetDinhPdfQueue').html(
            `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;` +
            `background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:13px;">` +
            `<i class="fas fa-file-pdf" style="color:#dc2626;flex-shrink:0;"></i>` +
            `<span style="flex:1;">${escapeHtml(fileName)}</span>` +
            `<span style="color:#dc2626;">${escapeHtml(errorMsg)}</span>` +
            `<i class="fas fa-times-circle" style="color:#dc2626;flex-shrink:0;"></i>` +
            `</div>`
        );
    }

    // ══════════════════════════════════════════════════════════════
    // UTILITY FUNCTIONS (Global)
    // ══════════════════════════════════════════════════════════════
    function getAntiForgeryToken() {
        return $('input[name="__RequestVerificationToken"]').val() ||
            document.querySelector('input[name="__RequestVerificationToken"]')?.value || '';
    }

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return '';
    }

    // ══════════════════════════════════════════════════════════════
    // PUBLIC API (for inline onclick handlers in Razor)
    // ══════════════════════════════════════════════════════════════
    window.ComplaintDetail = {
        showTab: showTab,
        openFilePreview: openFilePreview,
        closeFilePreview: closeFilePreview,
        resetPdfFlag: function () {
            hasQuyetDinhPdf = false;
            updateDongHoSoButton();
        }
    };

})();
