/**
 * complaint-danhmuc.js
 * SCR-NV-DM-001 — Quản lý danh mục nghiệp vụ (Loại đơn / Lý do KTL / Giai đoạn TD)
 * Pattern: IIFE + jQuery AJAX + Bootstrap modal
 * 
 * TAB 1 (Loại đơn): Calls /ComplaintType/* MVC actions → IComplaintTypeApiService → Backend API
 * TAB 2 & 3: Placeholder for Categories CRUD (pending implementation)
 */
(function () {
    'use strict';

    // ── Helpers ──────────────────────────────────────────────────────
    function escapeHtml(text) {
        if (text == null) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text)));
        return div.innerHTML;
    }

    function badgeHtml(status) {
        if (status === 'Active' || status === 'active') {
            return '<span class="badge-active">Hoạt động</span>';
        }
        return '<span class="badge-inactive">Vô hiệu</span>';
    }

    function getAntiForgeryToken() {
        var el = document.querySelector('input[name="__RequestVerificationToken"]');
        return el ? el.value : '';
    }

    function showFieldError(errorId, msg) {
        var $el = $('#' + errorId);
        $el.text(msg).show();
    }

    function clearFieldErrors(ids) {
        ids.forEach(function (id) { $('#' + id).hide().text(''); });
    }

    // ════════════════════════════════════════════════════════════════
    // TAB 1: LOẠI ĐƠN & THỜI HẠN PHÁP LÝ
    // Calls: /ComplaintType/GetAll, /ComplaintType/Create, /ComplaintType/Update/{id}, /ComplaintType/Delete/{id}
    // ════════════════════════════════════════════════════════════════

    var loaiDonData = [];

    function loadLoaiDon() {
        $('#loaiDonBody').html('<tr><td colspan="8" class="text-center" style="padding:20px;color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>');

        $.ajax({
            url: '/ComplaintType/GetAll',
            type: 'GET',
            dataType: 'json',
            success: function (result) {
                // Response: { success, data[], recordsTotal, recordsFiltered, pageNumber, pageSize, totalPages }
                if (result && result.success && result.data) {
                    loaiDonData = result.data;
                    renderLoaiDonTable();
                } else {
                    $('#loaiDonBody').html('<tr><td colspan="8" class="text-center text-warning" style="padding:20px;"><i class="fas fa-info-circle"></i> ' + (result.message || 'Không có dữ liệu') + '</td></tr>');
                    if (result.message) toastr.warning(result.message);
                }
            },
            error: function (xhr, status, error) {
                $('#loaiDonBody').html('<tr><td colspan="8" class="text-center text-danger" style="padding:20px;"><i class="fas fa-exclamation-triangle"></i> Lỗi kết nối máy chủ</td></tr>');
                console.error('LoadLoaiDon error:', error);
            }
        });
    }

    function renderLoaiDonTable() {
        if (!loaiDonData || loaiDonData.length === 0) {
            $('#loaiDonBody').html('<tr><td colspan="8" class="text-center" style="padding:20px;color:#94a3b8;">Chưa có dữ liệu</td></tr>');
            return;
        }

        var html = '';
        loaiDonData.forEach(function (item) {
            var canEdit = window.userPermissions && window.userPermissions.canManageCatalog;
            var editBtn = canEdit
                ? '<button type="button" class="btn-icon-figma btn-edit-loai-don" data-id="' + escapeHtml(item.id) + '" title="Sửa" style="color:var(--warning,#f59e0b);cursor:pointer;"><i class="fas fa-edit"></i></button>'
                : '';
            var deleteBtn = canEdit
                ? ' <button type="button" class="btn-icon-figma btn-delete-loai-don" data-id="' + escapeHtml(item.id) + '" data-name="' + escapeHtml(item.name) + '" title="Xóa" style="color:#ef4444;cursor:pointer;"><i class="fas fa-trash"></i></button>'
                : '';
            html += '<tr>';
            html += '<td><code class="dm-code">' + escapeHtml(item.code) + '</code></td>';
            html += '<td>' + escapeHtml(item.name) + '</td>';
            html += '<td class="text-center">' + escapeHtml(item.acceptanceTimelineDays) + '</td>';
            html += '<td class="text-center">' + escapeHtml(item.resolutionTimelineDays) + '</td>';
            html += '<td class="text-center">' + escapeHtml(item.maxExtensionDays) + '</td>';
            html += '<td class="text-center">' + escapeHtml(item.maxExtensionCount) + '</td>';
            html += '<td class="text-center">' + badgeHtml(item.isActive ? 'Active' : 'Inactive') + '</td>';
            html += '<td class="text-center">' + editBtn + deleteBtn + '</td>';
            html += '</tr>';
        });
        $('#loaiDonBody').html(html);
    }

    function openAddLoaiDon() {
        clearFieldErrors(['ldCodeError', 'ldNameError']);
        $('#ldId').val('');
        $('#ldCode').val('').prop('disabled', false);
        $('#ldName').val('');
        $('#ldHanThuLy').val(10);
        $('#ldHanGQ').val(45);
        $('#ldGiaHanToiDa').val(30);
        $('#ldSoLanGiaHan').val(1);
        $('#ldStatus').val('Active');
        $('#modalLoaiDonTitle').html('<i class="fas fa-list-alt mr-2"></i>Thêm loại đơn');
        $('#modalLoaiDon').modal('show');
    }

    function openEditLoaiDon(id) {
        var item = loaiDonData.find(function (x) { return x.id === id; });
        if (!item) { toastr.error('Không tìm thấy bản ghi'); return; }

        clearFieldErrors(['ldCodeError', 'ldNameError']);
        $('#ldId').val(item.id);
        $('#ldCode').val(item.code).prop('disabled', true); // BR-47: code locked on edit
        $('#ldName').val(item.name);
        $('#ldHanThuLy').val(item.acceptanceTimelineDays);
        $('#ldHanGQ').val(item.resolutionTimelineDays);
        $('#ldGiaHanToiDa').val(item.maxExtensionDays);
        $('#ldSoLanGiaHan').val(item.maxExtensionCount);
        $('#ldStatus').val(item.isActive ? 'Active' : 'Inactive');
        $('#modalLoaiDonTitle').html('<i class="fas fa-edit mr-2"></i>Cập nhật loại đơn');
        $('#modalLoaiDon').modal('show');
    }

    function validateLoaiDon() {
        var ok = true;
        clearFieldErrors(['ldCodeError', 'ldNameError']);
        var code = $('#ldCode').val().trim();
        if (!code) { showFieldError('ldCodeError', 'Vui lòng nhập mã CODE'); ok = false; }
        else if (!/^[A-Z0-9_]+$/.test(code)) { showFieldError('ldCodeError', 'Mã CODE chỉ được chứa CHỮ HOA, số, gạch dưới (BR-47)'); ok = false; }
        var name = $('#ldName').val().trim();
        if (!name) { showFieldError('ldNameError', 'Vui lòng nhập tên loại đơn'); ok = false; }
        return ok;
    }

    function saveLoaiDon() {
        if (!validateLoaiDon()) return;

        var id = $('#ldId').val();
        var payload = {
            code: $('#ldCode').val().trim().toUpperCase(),
            name: $('#ldName').val().trim(),
            acceptanceTimelineDays: parseInt($('#ldHanThuLy').val()) || 0,
            resolutionTimelineDays: parseInt($('#ldHanGQ').val()) || 0,
            maxExtensionDays: parseInt($('#ldGiaHanToiDa').val()) || 0,
            maxExtensionCount: parseInt($('#ldSoLanGiaHan').val()) || 0,
            isActive: $('#ldStatus').val() === 'Active'
        };

        var isCreate = !id;
        var url = isCreate ? '/ComplaintType/Create' : '/ComplaintType/Update/' + id;
        var method = isCreate ? 'POST' : 'PUT';

        $('#btnSaveLoaiDon').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...');

        $.ajax({
            url: url,
            type: method,
            contentType: 'application/json',
            headers: { 'X-XSRF-TOKEN': getAntiForgeryToken() },
            data: JSON.stringify(payload),
            success: function (result) {
                if (result && result.success) {
                    toastr.success(isCreate ? 'Thêm loại đơn thành công' : 'Cập nhật loại đơn thành công');
                    $('#modalLoaiDon').modal('hide');
                    loadLoaiDon();
                } else {
                    toastr.error(result && result.message ? result.message : 'Đã có lỗi xảy ra');
                }
            },
            error: function (xhr) {
                var msg = 'Không thể kết nối đến máy chủ';
                if (xhr.status === 403) msg = 'Bạn không có quyền thực hiện thao tác này';
                toastr.error(msg);
            },
            complete: function () {
                $('#btnSaveLoaiDon').prop('disabled', false).html('<i class="fas fa-save mr-1"></i> Lưu');
            }
        });
    }

    function deleteLoaiDon(id, name) {
        if (!confirm('Bạn có chắc muốn xóa loại đơn "' + name + '"?')) return;

        var btnEl = $('[data-id="' + id + '"].btn-delete-loai-don');
        btnEl.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>');

        $.ajax({
            url: '/ComplaintType/Delete/' + id,
            type: 'DELETE',
            headers: { 'X-XSRF-TOKEN': getAntiForgeryToken() },
            success: function (result) {
                if (result && result.success) {
                    toastr.success('Xóa loại đơn thành công');
                    loadLoaiDon();
                } else {
                    toastr.error(result && result.message ? result.message : 'Không thể xóa loại đơn này');
                }
            },
            error: function (xhr) {
                var msg = 'Không thể kết nối đến máy chủ';
                if (xhr.status === 403) msg = 'Bạn không có quyền xóa loại đơn';
                toastr.error(msg);
            },
            complete: function () {
                btnEl.prop('disabled', false).html('<i class="fas fa-trash"></i>');
            }
        });
    }

    // ════════════════════════════════════════════════════════════════
    // TAB 2: LÝ DO KHÔNG THỤ LÝ (Placeholder)
    // ════════════════════════════════════════════════════════════════

    var lyDoData = [];

    function loadLyDo() {
        $('#lyDoBody').html('<tr><td colspan="5" class="text-center" style="padding:20px;color:#94a3b8;"><i class="fas fa-info-circle"></i> Chức năng này sẽ được triển khai sau</td></tr>');
    }

    function openAddLyDo() {
        toastr.info('Chức năng thêm lý do chưa được triển khai');
    }

    // ════════════════════════════════════════════════════════════════
    // TAB 3: GIAI ĐOẠN TIẾN ĐỘ (Placeholder)
    // ════════════════════════════════════════════════════════════════

    var giaiDoanData = [];

    function loadGiaiDoan() {
        $('#giaiDoanBody').html('<tr><td colspan="6" class="text-center" style="padding:20px;color:#94a3b8;"><i class="fas fa-info-circle"></i> Chức năng này sẽ được triển khai sau</td></tr>');
    }

    function openAddGiaiDoan() {
        toastr.info('Chức năng thêm giai đoạn chưa được triển khai');
    }

    // ════════════════════════════════════════════════════════════════
    // EVENT BINDING
    // ════════════════════════════════════════════════════════════════

    function bindEvents() {
        // ── Tab shown → load data lazily ──────────────────────────
        $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
            var target = $(e.target).attr('href');
            if (target === '#tabLyDo' && lyDoData.length === 0) {
                loadLyDo();
            } else if (target === '#tabGiaiDoan' && giaiDoanData.length === 0) {
                loadGiaiDoan();
            }
        });

        // ── Loại đơn ──────────────────────────────────────────────
        $('#btnAddLoaiDon').on('click', openAddLoaiDon);
        $('#btnSaveLoaiDon').on('click', saveLoaiDon);

        // Delegated edit click
        $(document).on('click', '.btn-edit-loai-don', function () {
            openEditLoaiDon($(this).data('id'));
        });

        // Delegated delete click
        $(document).on('click', '.btn-delete-loai-don', function () {
            deleteLoaiDon($(this).data('id'), $(this).data('name'));
        });

        // Force uppercase as user types (BR-47)
        $('#ldCode').on('input', function () {
            var pos = this.selectionStart;
            this.value = this.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
            this.setSelectionRange(pos, pos);
        });

        // ── Lý do ─────────────────────────────────────────────────
        $('#btnAddLyDo').on('click', openAddLyDo);

        // ── Giai đoạn ─────────────────────────────────────────────
        $('#btnAddGiaiDoan').on('click', openAddGiaiDoan);
    }

    // ════════════════════════════════════════════════════════════════
    // INIT
    // ════════════════════════════════════════════════════════════════

    $(document).ready(function () {
        bindEvents();
        loadLoaiDon(); // Load tab 1 immediately (active tab)
        // Tab 2 & 3 loaded lazily on first shown event
    });

})();
