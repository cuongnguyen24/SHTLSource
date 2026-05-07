// Nhập thay hộ DN – Báo cáo Đối thoại Định kỳ (SCR-PROXY-DTDK) — IIFE Pattern
(function () {
    'use strict';

    const API = {
        searchDN: '/Enterprise/SearchByKeyword',
        getDnInfo: '/Enterprise/GetProxyEnterpriseInfo',
        getCategories: '/DialogueContent/GetAll',
        getKcn: '/Enterprise/GetKcnOptions',
        create: '/BaoCaoDoiThoaiDinhKy/CreateProxy'
    };

    let selectedDN = null;
    const uploadedFiles = [];
    let dnSearchItems = [];
    let searchTimer = null;
    const editConfig = window.proxyEditConfig || {};
    const isEditMode = editConfig.isEdit === true || editConfig.isEdit === 'true';
    const draftData = editConfig.draftData || null;
    const editReportId = editConfig.reportId || (draftData && draftData.id) || '';
    const existingFiles = isEditMode && draftData && Array.isArray(draftData.fileDinhKem) ? draftData.fileDinhKem : [];

    function getToken() {
        return $('input[name="__RequestVerificationToken"]').val();
    }

    function toInt(value) {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
        }
        if (typeof value === 'string') {
            const normalized = value.replace(/[^\d-]/g, '');
            if (!normalized || normalized === '-') return 0;
            const parsed = parseInt(normalized, 10);
            return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
        }
        return 0;
    }

    function getEnterpriseWorkerCount(dn) {
        const source = dn || selectedDN || {};
        const candidates = [
            source.soLaoDong,
            source.tongSoLaoDong,
            source.totalWorkers,
            source.tongLaoDong,
            source.soLaoDongDangLamViec,
            source.tongSoNguoiLaoDong
        ];

        for (let i = 0; i < candidates.length; i++) {
            const value = toInt(candidates[i]);
            if (value > 0) return value;
        }

        return toInt($('#dnResultTongLD').text());
    }

    function toDateInputValue(value) {
        if (!value) return '';
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? '' : d.toISOString().substring(0, 10);
    }

    // ===== DN SEARCH =====
    function initDNSearch() {
        const $input = $('#proxyDnSearch');
        const $suggest = $('#proxyDnSuggest');

        function getSelectedDnName() {
            return (selectedDN && (selectedDN.name || selectedDN.tenDN) || '').trim();
        }

        function getEffectiveKeyword(rawKeyword) {
            const keyword = (rawKeyword || '').trim();
            const selectedName = getSelectedDnName();
            // If input still equals the auto-filled selected enterprise name,
            // treat it as no manual keyword so KCN-only search works.
            if (keyword && selectedName && keyword.localeCompare(selectedName, 'vi', { sensitivity: 'accent' }) === 0) {
                return '';
            }
            return keyword;
        }

        $input.on('input', function () {
            const keyword = this.value.trim();
            if (keyword.length < 1) {
                dnSearchItems = [];
                $suggest.removeClass('show').empty();
                return;
            }
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                searchEnterprise(keyword, true);
            }, 120);
        });

        $('#btnSearchDN').on('click', function () {
            const keyword = getEffectiveKeyword($input.val());
            searchEnterprise(keyword, false);
        });

        $input.on('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (dnSearchItems.length > 0) {
                    selectEnterprise(dnSearchItems[0]);
                    renderEnterpriseSuggestions([]);
                } else {
                    $('#btnSearchDN').trigger('click');
                }
            }
        });

        $('#proxyKcnFilter').on('change', function () {
            const keyword = $input.val().trim();
            if (keyword.length >= 1) {
                searchEnterprise(getEffectiveKeyword(keyword), true);
            } else {
                dnSearchItems = [];
                $suggest.removeClass('show').empty();
            }
        });

        $(document).on('click', '.proxy-search-item', function () {
            const id = $(this).data('id');
            const dn = dnSearchItems.find(function (x) { return x.id === id; });
            if (dn) { selectEnterprise(dn); renderEnterpriseSuggestions([]); }
        });

        $(document).on('click', function (e) {
            if (!$(e.target).closest('.proxy-search-wrap').length) {
                $suggest.removeClass('show');
            }
        });

        $('#btnChangeDN').on('click', function () {
            selectedDN = null;
            $('#dnResultPanel').removeClass('show');
            $input.val('').focus();
            $('#selectedEnterpriseId').val('');
            $('#tongSoLaoDongDN').val('0');
            $('#proxyDnHint').hide().text('');
            $('#dnResultNganh, #dnResultWebsite').text('—');
            $('#dnResultTongLD').text('0');
            dnSearchItems = [];
            $suggest.removeClass('show').empty();
        });
    }

    function searchEnterprise(keyword, silent) {
        const $kcn = $('#proxyKcnFilter');
        const kcnFilter = $kcn.val();
        const kcnName = kcnFilter ? $kcn.find(':selected').text().trim() : '';
        $.ajax({
            url: API.searchDN,
            type: 'GET',
            data: { keyword: keyword || '', pageSize: 10, kcnId: kcnFilter || null, kcnName: kcnName || null },
            success: function (res) {
                const items = (res.success && res.data?.items) ? res.data.items : [];
                dnSearchItems = items;
                renderEnterpriseSuggestions(items);
                if (!silent && items.length === 0) { toastr.warning('Không tìm thấy doanh nghiệp.'); return; }
                if (!silent && items.length > 0) { selectEnterprise(items[0]); renderEnterpriseSuggestions(items); }
            },
            error: function () {
                dnSearchItems = [];
                renderEnterpriseSuggestions([]);
                if (!silent) toastr.error('Không thể tìm kiếm doanh nghiệp.');
            }
        });
    }

    function renderEnterpriseSuggestions(items) {
        const $suggest = $('#proxyDnSuggest');
        if (!Array.isArray(items) || items.length === 0) { $suggest.removeClass('show').empty(); return; }
        const html = items.map(function (dn) {
            return `<div class="proxy-search-item" data-id="${dn.id}">
                <div class="name">${escapeHtml(dn.name || '')}</div>
                <div class="meta">MST: ${escapeHtml(dn.maSoThue || '—')} | KCN: ${escapeHtml(dn.kcnName || '—')}</div>
            </div>`;
        }).join('');
        $suggest.html(html).addClass('show');
    }

    function selectEnterprise(dn) {
        $.ajax({
            url: API.getDnInfo,
            type: 'GET',
            data: { id: dn.id },
            success: function (res) {
                const enriched = (res && res.success && res.data) ? Object.assign({}, dn, res.data) : dn;
                selectedDN = enriched;
                $('#selectedEnterpriseId').val(enriched.id);
                $('#proxyDnSearch').val(enriched.name || enriched.tenDN || enriched.enterpriseName || '');
                const dnName = enriched.name || enriched.tenDN || enriched.enterpriseName || enriched.id;
                const totalWorker = getEnterpriseWorkerCount(enriched);
                $('#dnResultName').text(dnName);
                $('#dnResultMeta').text(`MST: ${enriched.maSoThue || enriched.taxCode || '—'} | KCN: ${enriched.kcnName || enriched.industrialZoneName || '—'}`);
                $('#dnResultNganh').text(enriched.nganhNghe || enriched.linhVuc || '—');
                $('#dnResultTongLD').text(totalWorker.toLocaleString('vi-VN'));
                $('#tongSoLaoDongDN').val(totalWorker);
                $('#dnResultWebsite').text(enriched.website || '—');
                $('#proxyDnHint').text(`BC Đối thoại Định kỳ sẽ được tạo bởi CB Phòng LĐ thay cho DN ${dnName}. Trạng thái sau nộp: Chờ xác nhận.`).show();
                $('#dnResultPanel').addClass('show');
            },
            error: function () {
                selectedDN = dn;
                $('#selectedEnterpriseId').val(dn.id);
                $('#proxyDnSearch').val(dn.name || dn.tenDN || dn.enterpriseName || '');
                const dnName = dn.name || dn.tenDN || dn.enterpriseName || dn.id;
                const totalWorker = getEnterpriseWorkerCount(dn);
                $('#dnResultName').text(dnName);
                $('#dnResultMeta').text(`MST: ${dn.maSoThue || dn.taxCode || '—'} | KCN: ${dn.kcnName || dn.industrialZoneName || '—'}`);
                $('#dnResultNganh').text(dn.nganhNghe || dn.linhVuc || '—');
                $('#dnResultTongLD').text(totalWorker.toLocaleString('vi-VN'));
                $('#tongSoLaoDongDN').val(totalWorker);
                $('#dnResultWebsite').text(dn.website || '—');
                $('#proxyDnHint').text(`BC Đối thoại Định kỳ sẽ được tạo bởi CB Phòng LĐ thay cho DN ${dnName}. Trạng thái sau nộp: Chờ xác nhận.`).show();
                $('#dnResultPanel').addClass('show');
            }
        });
    }

    // ===== KCN FILTER =====
    function loadKcnFilter() {
        const $sel = $('#proxyKcnFilter');
        if ($sel.length === 0) return;

        function appendKcnOptions(items) {
            let added = 0;
            items.forEach(function (item) {
                const id = item.id || item.ma || item.industrialZoneId || '';
                const ten = item.ten || item.name || item.displayName || item.industrialZoneName || item.tenKhuCongNghiep || '';
                if (id && ten) { $sel.append(`<option value="${id}">${escapeHtml(ten)}</option>`); added++; }
            });
            return added;
        }

        $.ajax({
            url: API.getKcn, type: 'GET',
            success: function (res) {
                const items = (res?.data?.items && Array.isArray(res.data.items))
                    ? res.data.items : (Array.isArray(res?.data) ? res.data : []);
                const added = appendKcnOptions(items);
                if (added === 0) {
                    $.ajax({
                        url: '/IndustrialZones/GetAll', type: 'GET',
                        success: function (rows) { appendKcnOptions(Array.isArray(rows) ? rows : []); },
                        error: function () { toastr.warning('Không thể tải danh sách KCN.'); }
                    });
                }
            },
            error: function () {
                $.ajax({
                    url: '/IndustrialZones/GetAll', type: 'GET',
                    success: function (rows) { appendKcnOptions(Array.isArray(rows) ? rows : []); },
                    error: function () {}
                });
            }
        });
    }

    // ===== PROXY REASON =====
    function initProxyReason() {
        $('#proxyReason').on('change', function () {
            $('#proxyReasonNoteGroup').toggle(this.value === 'KHAC');
            $('#errProxyReason').hide();
        });
        $('#proxyReasonNote').on('input', function () {
            $('#proxyNoteCount').text(this.value.length);
        });
    }

    // ===== CONDITIONAL: Loại đối thoại → Lý do đột xuất =====
    function initLoaiToggle() {
        $('#loaiDoiThoaiDinhKy').on('change', function () {
            const isDotXuat = this.value === '2';
            $('#lyDoDotXuatGroup').toggle(isDotXuat);
            $('#errLoaiDTDK').hide();
            updateHanNopHint();
        });
    }

    // ===== HẠN NỘP HINT =====
    function addDays(dateStr, days) {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        d.setDate(d.getDate() + days);
        return d.toLocaleDateString('vi-VN');
    }

    function updateHanNopHint() {
        const ngayToChuc = $('#ngayToChuc').val();
        if (!ngayToChuc) { $('#hanNopHint').hide(); return; }
        const loai = $('#loaiDoiThoaiDinhKy').val();
        const plusDays = loai === '2' ? 5 : 10;
        const hanNop = addDays(ngayToChuc, plusDays);
        if (hanNop) {
            $('#hanNopText').text(`Hạn nộp dự kiến = Ngày tổ chức + ${plusDays} ngày → ${hanNop}`);
            $('#hanNopHint').show();
        }
    }

    function initDeadlinePreview() {
        $('#ngayToChuc').on('change', function () {
            updateHanNopHint();
            $('#errNgayToChuc').hide();
        });
    }

    // ===== CATEGORIES (listbox-style) =====
    function loadCategories() {
        $.ajax({
            url: API.getCategories, type: 'GET',
            data: { page: 1, pageSize: 100, isActive: true },
            success: function (res) {
                const items = Array.isArray(res?.data?.items)
                    ? res.data.items
                    : (Array.isArray(res?.data) ? res.data : []);
                const $select = $('#danhSachNoiDungSelect');
                $select.empty();
                if (items.length === 0) {
                    $select.append('<option value="">Không có danh mục nội dung</option>');
                    return;
                }
                items.forEach(function (cat) {
                    $select.append(`<option value="${cat.id}">${escapeHtml(cat.name)}</option>`);
                });
                $select.off('change').on('change', function () {
                    if (getSelectedCategoryIds().length > 0) $('#errNoiDung').hide();
                });
                applyDraftCategorySelection();
            },
            error: function () {
                const $select = $('#danhSachNoiDungSelect');
                $select.empty().append('<option value="">Không thể tải danh mục nội dung</option>');
            }
        });
    }

    function getSelectedCategoryIds() {
        return $('#danhSachNoiDungSelect').val() || [];
    }

    // ===== FILE UPLOAD (single PDF) =====
    function initFileUpload() {
        const $area = $('#fileUploadArea');
        const $input = $('#fileInput');

        $area.on('click', function (e) { if (!$(e.target).is('input')) $input.trigger('click'); });
        $area.on('dragover', function (e) { e.preventDefault(); $area.css('border-color', 'var(--primary, #4338ca)'); });
        $area.on('dragleave', function () { $area.css('border-color', '#cbd5e1'); });
        $area.on('drop', function (e) {
            e.preventDefault();
            $area.css('border-color', '#cbd5e1');
            handleFiles(e.originalEvent.dataTransfer.files);
        });
        $input.on('change', function () { handleFiles(this.files); this.value = ''; });
    }

    function handleFiles(files) {
        if (!files || files.length === 0) return;
        // Single file only
        const file = files[0];
        if (file.size > 20 * 1024 * 1024) { toastr.warning(`File "${file.name}" quá 20MB.`); return; }
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'pdf') { toastr.warning(`Chỉ chấp nhận file PDF.`); return; }

        // Replace existing file
        uploadedFiles.length = 0;
        file._proxyId = 'dtdk_' + Date.now();
        uploadedFiles.push(file);
        renderFileList();
        $('#errFile').hide();
    }

    function renderFileList() {
        const $list = $('#fileList');
        $list.empty();
        uploadedFiles.forEach(function (file) {
            $list.append(`
                <div class="d-flex align-items-center justify-content-between p-2 bg-light rounded mb-1" id="file_${file._proxyId}">
                    <span><i class="fas fa-file-pdf mr-2 text-danger"></i>${escapeHtml(file.name)} (${(file.size / 1048576).toFixed(1)} MB)</span>
                    <button type="button" class="btn-figma btn-figma-outline"
                            style="height:22px;padding:0 8px;font-size:11px;"
                            onclick="removeDTDKFile('${file._proxyId}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>`);
        });
    }

    window.removeDTDKFile = function (fileId) {
        const idx = uploadedFiles.findIndex(function (f) { return f._proxyId === fileId; });
        if (idx > -1) uploadedFiles.splice(idx, 1);
        $('#file_' + fileId).remove();
    };

    // ===== VALIDATION =====
    function validate() {
        let valid = true;

        if (!selectedDN || !$('#selectedEnterpriseId').val()) {
            toastr.warning('Vui lòng tìm và chọn doanh nghiệp (Bước 1).');
            valid = false;
        }

        if (!$('#proxyReason').val()) {
            $('#errProxyReason').show(); valid = false;
        } else { $('#errProxyReason').hide(); }

        if ($('#proxyReason').val() === 'KHAC' && !$('#proxyReasonNote').val().trim()) {
            toastr.warning('Vui lòng nhập ghi chú lý do khi chọn "Khác".');
            valid = false;
        }

        if (!$('#loaiDoiThoaiDinhKy').val()) {
            $('#errLoaiDTDK').show(); valid = false;
        } else { $('#errLoaiDTDK').hide(); }

        if (!$('#ngayToChuc').val()) {
            $('#errNgayToChuc').show(); valid = false;
        } else { $('#errNgayToChuc').hide(); }

        const soNLDN = parseInt($('#soNguoiThamDuDN').val(), 10);
        if (!soNLDN || soNLDN < 1) {
            $('#errSoNLDN').show(); valid = false;
        } else { $('#errSoNLDN').hide(); }

        const soNSDLD = parseInt($('#soNguoiThamDuCongDoan').val(), 10);
        if (!soNSDLD || soNSDLD < 1) {
            $('#errSoNSDLD').show(); valid = false;
        } else { $('#errSoNSDLD').hide(); }

        if (!$('#diaDiem').val().trim()) {
            $('#errDiaDiem').show(); valid = false;
        } else { $('#errDiaDiem').hide(); }

        if ($('#loaiDoiThoaiDinhKy').val() === '2' && !$('#lyDoDotXuat').val().trim()) {
            $('#errLyDoDotXuat').show(); valid = false;
        } else { $('#errLyDoDotXuat').hide(); }

        if (getSelectedCategoryIds().length === 0) {
            $('#errNoiDung').show(); valid = false;
        } else { $('#errNoiDung').hide(); }

        if (!$('#ketQua').val().trim()) {
            $('#errKetQua').show(); valid = false;
        } else { $('#errKetQua').hide(); }

        if (!$('#camKetDN').val().trim()) {
            $('#errCamKet').show(); valid = false;
        } else { $('#errCamKet').hide(); }

        if (uploadedFiles.length === 0 && existingFiles.length === 0) {
            $('#errFile').show();
            toastr.warning('Vui lòng đính kèm file biên bản (PDF).');
            valid = false;
        } else { $('#errFile').hide(); }

        return valid;
    }

    // ===== SUBMIT =====
    function initSubmit() {
        $('#btnSaveDraftProxy').on('click', function () {
            if (!selectedDN) { toastr.warning('Vui lòng chọn doanh nghiệp trước.'); return; }
            doSubmit(true);
        });

        $('#btnSubmitProxy').on('click', function () {
            if (!validate()) return;
            $('#confirmDTDKDnName').text(escapeHtml(selectedDN.name || selectedDN.tenDN || selectedDN.id));
            $('#modalConfirmProxyDTDK').css('display', 'flex');
        });

        $('#btnConfirmProxyDTDK').on('click', function () {
            $('#modalConfirmProxyDTDK').css('display', 'none');
            doSubmit(false);
        });

        $('#btnCancelProxyDTDK, #modalConfirmProxyDTDK').on('click', function (e) {
            if (e.target === this) $('#modalConfirmProxyDTDK').css('display', 'none');
        });
        $('#modalConfirmProxyDTDK .modal-box').on('click', function (e) { e.stopPropagation(); });
    }

    function doSubmit(isDraft) {
        const formData = new FormData();
        const danhSachNoiDung = getSelectedCategoryIds();

        formData.append('enterpriseId', $('#selectedEnterpriseId').val());
        formData.append('proxyReason', $('#proxyReason').val());
        formData.append('proxyReasonNote', $('#proxyReasonNote').val() || '');
        formData.append('loaiDoiThoaiDinhKy', parseInt($('#loaiDoiThoaiDinhKy').val(), 10) || 1);
        formData.append('ngayToChuc', $('#ngayToChuc').val() || '');
        formData.append('diaDiem', $('#diaDiem').val() || '');
        formData.append('lyDoDotXuat', $('#lyDoDotXuat').val() || '');
        const soNguoiThamDuDN = parseInt($('#soNguoiThamDuDN').val(), 10) || 0;
        const soNguoiThamDuCongDoan = parseInt($('#soNguoiThamDuCongDoan').val(), 10) || 0;
        formData.append('soNguoiThamDuDN', soNguoiThamDuDN);
        formData.append('soNguoiThamDuCongDoan', soNguoiThamDuCongDoan);
        formData.append('soNguoiThamGia', soNguoiThamDuDN + soNguoiThamDuCongDoan);
        // noiDungChinh = kết quả (required by backend)
        formData.append('noiDungChinh', $('#ketQua').val() || '(Xem biên bản đính kèm)');
        formData.append('ketQua', $('#ketQua').val() || '');
        formData.append('camKetDN', $('#camKetDN').val() || '');
        formData.append('camKetCongDoan', '');
        formData.append('tonDong', $('#tonDong').val() || '');
        formData.append('ghiChu', '');
        formData.append('isDraft', isDraft);

        danhSachNoiDung.forEach(function (id, index) {
            formData.append('danhSachNoiDung[' + index + '].categoryId', id);
        });

        uploadedFiles.forEach(function (file) { formData.append('files', file); });

        const $draftBtn = $('#btnSaveDraftProxy');
        const $submitBtn = $('#btnSubmitProxy');

        $.ajax({
            url: isEditMode ? '/BaoCaoDoiThoaiDinhKy/Update/' + editReportId : API.create, type: 'POST',
            data: formData, processData: false, contentType: false,
            headers: { 'RequestVerificationToken': getToken() },
            beforeSend: function () {
                if (isDraft) $draftBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Đang lưu...');
                else $submitBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>' + (isEditMode ? 'Đang cập nhật...' : 'Đang nộp...'));
            },
            success: function (res) {
                if (res.success) {
                    toastr.success(res.message || (isDraft ? 'Đã lưu nháp thành công' : 'Nộp báo cáo thành công'));
                    var redirectUrl = res.redirectUrl || '/Review';
                    setTimeout(function () { window.location.href = redirectUrl; }, 1500);
                } else {
                    var errMsg = buildErrorMessage(res, 'Không thể nộp báo cáo. Vui lòng kiểm tra lại thông tin đã nhập.');
                    toastr.error(errMsg);
                    $draftBtn.prop('disabled', false).html('<i class="fas fa-save mr-1"></i>Lưu nháp');
                    $submitBtn.prop('disabled', false).html('<i class="fas fa-paper-plane mr-1"></i>' + (isEditMode ? 'Cập nhật' : 'Nộp thay hộ DN →'));
                }
            },
            error: function (xhr) {
                var errMsg = 'Không thể kết nối đến máy chủ';
                try { var r = JSON.parse(xhr.responseText); errMsg = buildErrorMessage(r, errMsg); } catch (e) {}
                toastr.error(errMsg);
                $draftBtn.prop('disabled', false).html('<i class="fas fa-save mr-1"></i>Lưu nháp');
                $submitBtn.prop('disabled', false).html('<i class="fas fa-paper-plane mr-1"></i>' + (isEditMode ? 'Cập nhật' : 'Nộp thay hộ DN →'));
            }
        });
    }

    function buildErrorMessage(res, fallback) {
        if (!res) return fallback;
        var message = res.message || fallback;
        var errors = normalizeErrors(res.errors);
        if (errors.length === 0 && message === 'Dữ liệu đầu vào không hợp lệ') {
            return 'Dữ liệu đầu vào không hợp lệ. Vui lòng kiểm tra các trường bắt buộc, ngày tổ chức, nội dung đối thoại và file biên bản.';
        }
        return errors.length > 0 ? message + ': ' + errors.join('; ') : message;
    }

    function normalizeErrors(errors) {
        if (!errors) return [];
        if (Array.isArray(errors)) return errors.filter(Boolean).map(toFriendlyError);
        if (typeof errors === 'object') {
            var result = [];
            Object.keys(errors).forEach(function (key) {
                var value = errors[key];
                if (Array.isArray(value)) {
                    value.forEach(function (msg) { if (msg) result.push(toFriendlyError(msg)); });
                } else if (value) {
                    result.push(toFriendlyError(value));
                }
            });
            return result;
        }
        return [toFriendlyError(errors)];
    }

    function toFriendlyError(message) {
        return String(message)
            .replace(/EnterpriseId/g, 'Doanh nghiệp')
            .replace(/KyBaoCaoId/g, 'Kỳ báo cáo')
            .replace(/LoaiDoiThoaiDinhKy/g, 'Loại đối thoại')
            .replace(/NgayToChuc/g, 'Ngày tổ chức')
            .replace(/DiaDiem/g, 'Địa điểm tổ chức')
            .replace(/LyDoDotXuat/g, 'Lý do đột xuất')
            .replace(/SoNguoiThamDuDN/g, 'Số đại diện NLĐ')
            .replace(/SoNguoiThamDuCongDoan/g, 'Số đại diện NSDLĐ')
            .replace(/NoiDungChinh/g, 'Kết quả đạt được')
            .replace(/KetQua/g, 'Kết quả đạt được')
            .replace(/CamKetDN/g, 'Cam kết thực hiện')
            .replace(/CategoryIds/g, 'Danh mục nội dung đối thoại');
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function applyDraftCategorySelection() {
        if (!isEditMode || !draftData || !Array.isArray(draftData.danhSachNoiDung)) return;
        const ids = draftData.danhSachNoiDung.map(function (x) { return String(x.categoryId || '').toLowerCase(); });
        $('#danhSachNoiDungSelect option').each(function () {
            this.selected = ids.indexOf(String(this.value || '').toLowerCase()) >= 0;
        });
    }

    function renderExistingFiles() {
        if (!isEditMode || existingFiles.length === 0) return;
        existingFiles.forEach(function (file) {
            $('#fileList').append(`
                <div class="d-flex align-items-center justify-content-between p-2 bg-light rounded mb-1">
                    <span><i class="fas fa-file-pdf mr-2 text-danger"></i>${escapeHtml(file.tenFile || 'File đã đính kèm')}</span>
                    ${file.duongDan ? `<a href="${file.duongDan}" target="_blank" class="btn-figma btn-figma-outline" style="height:22px;padding:0 8px;font-size:11px;">Xem</a>` : ''}
                </div>`);
        });
    }

    function initEditMode() {
        if (!isEditMode || !draftData) return;

        selectedDN = {
            id: draftData.enterpriseId,
            name: draftData.enterpriseName,
            tenDN: draftData.enterpriseName,
            maSoThue: draftData.taxCode,
            taxCode: draftData.taxCode,
            tongSoLaoDong: draftData.tongSoLaoDong
        };
        $('#selectedEnterpriseId').val(draftData.enterpriseId || '');
        $('#proxyDnSearch').val(draftData.enterpriseName || '');
        $('#dnResultName').text(draftData.enterpriseName || draftData.enterpriseId || '—');
        $('#dnResultMeta').text(`MST: ${draftData.taxCode || '—'} | KCN: —`);
        $('#dnResultTongLD').text('0');
        $('#proxyDnHint').text('Đang cập nhật bản nháp. Sau khi bấm Cập nhật, trạng thái sẽ chuyển sang Chờ xác nhận.').show();
        $('#dnResultPanel').addClass('show');

        $('#proxyReason').val('CAP_NHAT_LD');
        $('#loaiDoiThoaiDinhKy').val(String(draftData.loaiDoiThoaiDinhKy || 1)).trigger('change');
        $('#ngayToChuc').val(toDateInputValue(draftData.ngayToChuc)).trigger('change');
        $('#diaDiem').val(draftData.diaDiem || '');
        $('#soNguoiThamDuDN').val(toInt(draftData.soNguoiThamDuDN || draftData.soNguoiThamGia));
        $('#soNguoiThamDuCongDoan').val(toInt(draftData.soNguoiThamDuCongDoan));
        $('#ketQua').val(draftData.ketQua || draftData.noiDungChinh || '');
        $('#camKetDN').val(draftData.camKetDN || '');
        $('#tonDong').val(draftData.tonDong || '');
        $('#charKetQua').text(Math.min(($('#ketQua').val() || '').length, 3000));
        $('#charCamKetDN').text(Math.min(($('#camKetDN').val() || '').length, 3000));
        $('#charTonDong').text(Math.min(($('#tonDong').val() || '').length, 2000));
        renderExistingFiles();
        applyDraftCategorySelection();
        if (draftData.enterpriseId) {
            selectEnterprise(selectedDN);
        }
    }

    // ===== INIT =====
    $(document).ready(function () {
        loadKcnFilter();
        loadCategories();
        initDNSearch();
        initProxyReason();
        initLoaiToggle();
        initDeadlinePreview();
        initFileUpload();
        initSubmit();
        initEditMode();

        // Char counters
        $('#proxyReasonNote').on('input', function () { $('#proxyNoteCount').text(this.value.length); });
        $('#lyDoDotXuat').on('input', function () { $('#charLyDoDotXuat').text(this.value.length); });
        $('#ketQua').on('input', function () { $('#charKetQua').text(Math.min(this.value.length, 3000)); });
        $('#camKetDN').on('input', function () { $('#charCamKetDN').text(Math.min(this.value.length, 3000)); });
        $('#tonDong').on('input', function () { $('#charTonDong').text(Math.min(this.value.length, 2000)); });

        $('#btnDownloadTemplateDTDK').on('click', function (e) {
            e.preventDefault();
            toastr.info('Biểu mẫu TT 28/2021 sẽ được cập nhật sau.');
        });

        $(document).on('keydown', function (e) {
            if (e.key === 'Escape') $('.modal-overlay').css('display', 'none');
        });
    });

})();
