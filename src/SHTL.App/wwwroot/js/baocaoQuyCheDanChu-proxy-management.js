/**
 * BaoCaoQuyCheDanChu Proxy Management — Client JS (IIFE Pattern)
 * Module: M0093 — Báo cáo Quy chế Dân chủ cơ sở
 * Screen: SCR-PROXY-QCDC — CB nhập thay hộ DN: BC QCDC định kỳ
 *
 * ARCHITECTURE: JavaScript → MVC Controller → ApiService → Backend API
 */
(function () {
    'use strict';

    // ─── MVC Action Endpoints (NOT /api/v1/...) ─────────────────
    const API = {
        searchDN:     '/Enterprise/SearchByKeyword',
        getDnInfo:    '/Enterprise/GetProxyEnterpriseInfo',
        getKyBaoCao:  '/KyBaoCaoQCDCVaDT/GetAll',
        getCategories:'/DialogueContent/GetAll',
        getKcn:       '/Enterprise/GetKcnOptions',
        create:       '/BaoCaoQuyCheDanChu/Create'
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

    // ─── DTDK Divergence State ───────────────────────────────────
    let dtdkData = null;          // { totalCount, countDinhKy, countDotXuat }
    let dtdkConfirmed = false;    // user clicked "Xác nhận"
    let hasDtdkDivergence = false;

    function getToken() {
        return $('input[name="__RequestVerificationToken"]').val();
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function buildDetailedErrorMessage(res, fallbackMessage) {
        const fallback = fallbackMessage || 'Thao tác thất bại';
        if (!res) return fallback;

        const message = (typeof res.message === 'string' && res.message.trim())
            ? res.message.trim()
            : fallback;

        const rawErrors = Array.isArray(res.errors)
            ? res.errors.filter(function (x) { return typeof x === 'string' && x.trim(); }).map(function (x) { return x.trim(); })
            : [];

        // Deduplicate — skip any error that is identical to the main message
        const distinct = [];
        rawErrors.forEach(function (item) {
            if (item !== message && distinct.indexOf(item) === -1) distinct.push(item);
        });

        if (distinct.length === 0) return message;

        const topDetails = distinct.slice(0, 3).join(' | ');
        return message + ' (' + topDetails + ')';
    }

    function extractReadableDetails(rawText) {
        if (!rawText) return [];
        const text = String(rawText).trim();
        if (!text) return [];

        if (!(text.startsWith('{') || text.startsWith('['))) {
            return [text];
        }

        try {
            const parsed = JSON.parse(text);
            const out = [];

            if (typeof parsed.message === 'string' && parsed.message.trim()) {
                out.push(parsed.message.trim());
            }

            if (Array.isArray(parsed.errors)) {
                parsed.errors.forEach(function (item) {
                    if (typeof item === 'string' && item.trim()) out.push(item.trim());
                });
            } else if (parsed.errors && typeof parsed.errors === 'object') {
                Object.keys(parsed.errors).forEach(function (key) {
                    const value = parsed.errors[key];
                    if (Array.isArray(value)) {
                        value.forEach(function (item) {
                            if (typeof item === 'string' && item.trim()) out.push(item.trim());
                        });
                    } else if (typeof value === 'string' && value.trim()) {
                        out.push(value.trim());
                    }
                });
            }

            if (out.length > 0) return out;
        } catch (_) {
            // If parse fails, keep original raw text.
        }

        return [text];
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

        // Fallback from displayed value in UI panel (already formatted vi-VN)
        return toInt($('#dnResultTongLD').text());
    }

    function formatNumberVi(numberValue) {
        const value = toInt(numberValue);
        return value.toLocaleString('vi-VN');
    }

    function toDateInputValue(value) {
        if (!value) return '';
        const raw = String(value).trim();
        if (!raw) return '';

        // Accept dd/MM/yyyy or dd-MM-yyyy from legacy/localized payloads.
        const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (dmyMatch) {
            const day = dmyMatch[1].padStart(2, '0');
            const month = dmyMatch[2].padStart(2, '0');
            const year = dmyMatch[3];
            return `${year}-${month}-${day}`;
        }

        // Accept ISO-like values (yyyy-MM-dd or yyyy-MM-ddTHH:mm:ss...).
        const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
        }

        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? '' : d.toISOString().substring(0, 10);
    }

    function updateTyLeFormulaHint(totalWorkers) {
        const denominator = toInt(totalWorkers);
        const text = denominator > 0 ? formatNumberVi(denominator) : 'Tổng LĐ DN';
        $('#tyLeFormulaDenominator').text(text);
    }

    // ===== KỲ BÁO CÁO =====
    function loadKyBaoCao() {
        $.ajax({
            url: API.getKyBaoCao,
            type: 'GET',
            data: { page: 1, pageSize: 200 },
            success: function (res) {
                const items = Array.isArray(res?.data?.items)
                    ? res.data.items
                    : (Array.isArray(res?.data) ? res.data : []);
                const $sel = $('#proxyKyBaoCaoId');
                $sel.empty().append('<option value="">-- Chọn kỳ báo cáo --</option>');
                items.forEach(function (ky) {
                    const isOpen = ky.isOpen === true
                        || ky.trangThai === 1
                        || ky.trangThai === '1'
                        || ky.trangThai === 'Mo';
                    if (isOpen) {
                        const tenKy = ky.tenKy || ky.name || '';
                        const $opt = $(`<option value="${ky.id}" data-nam="${ky.nam || ''}" data-han="${ky.hanNop || ''}">${tenKy}</option>`);
                        $sel.append($opt);
                    }
                });
                if (isEditMode && draftData && draftData.kyBaoCaoId) {
                    $sel.val(draftData.kyBaoCaoId);
                    const $opt = $sel.find(':selected');
                    $('#proxyNamBC').val($opt.data('nam') || '');
                    const han = $opt.data('han');
                    $('#proxyHanNop').val(han ? new Date(han).toLocaleDateString('vi-VN') : '');
                }
                $sel.on('change', function () {
                    const $opt = $sel.find(':selected');
                    $('#proxyNamBC').val($opt.data('nam') || '');
                    const han = $opt.data('han');
                    $('#proxyHanNop').val(han ? new Date(han).toLocaleDateString('vi-VN') : '');
                    fetchDtdkData();
                });
            },
            error: function () {
                toastr.warning('Không thể tải danh sách kỳ báo cáo');
            }
        });
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

        $('#proxyDnSearch').on('input', function () {
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
            const keyword = getEffectiveKeyword($('#proxyDnSearch').val());
            searchEnterprise(keyword, false);
        });

        $('#proxyDnSearch').on('keydown', function (e) {
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
            }
        });

        $(document).on('click', '.proxy-search-item', function () {
            const id = $(this).data('id');
            const dn = dnSearchItems.find(function (x) { return x.id === id; });
            if (dn) {
                selectEnterprise(dn);
                renderEnterpriseSuggestions([]);
            }
        });

        $(document).on('click', function (e) {
            if (!$(e.target).closest('.proxy-search-wrap').length) {
                $suggest.removeClass('show');
            }
        });

        $('#btnChangeDN').on('click', function () {
            selectedDN = null;
            $('#dnResultPanel').removeClass('show');
            $('#proxyDnSearch').val('').focus();
            $('#selectedEnterpriseId').val('');
            $('#proxyDnHint').hide().text('');
            $('#dnResultNganh, #dnResultWebsite').text('—');
            $('#dnResultTongLD').text('0');
            $('#tongSoLaoDongDN').val('0');
            updateTyLeFormulaHint(0);
            calcTyLeThamGia();
            dtdkData = null;
            dtdkConfirmed = false;
            hasDtdkDivergence = false;
            hideDTDKWarning();
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
                if (!silent && items.length === 0) {
                    toastr.warning('Không tìm thấy doanh nghiệp.');
                    return;
                }
                if (!silent && items.length > 0) {
                    selectEnterprise(items[0]);
                    renderEnterpriseSuggestions(items);
                }
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
        if (!Array.isArray(items) || items.length === 0) {
            $suggest.removeClass('show').empty();
            return;
        }
        const html = items.map(function (dn) {
            const name = escapeHtml(dn.name || '');
            const tax = escapeHtml(dn.maSoThue || '—');
            const kcn = escapeHtml(dn.kcnName || '—');
            return `
                <div class="proxy-search-item" data-id="${dn.id}">
                    <div class="name">${name}</div>
                    <div class="meta">MST: ${tax} | KCN: ${kcn}</div>
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
                updateTyLeFormulaHint(totalWorker);
                $('#dnResultWebsite').text(enriched.website || '—');
                $('#proxyDnHint').text(`BC này được tạo bởi Cán bộ Phòng LĐ thay cho DN ${dnName}. Trạng thái sau nộp: Chờ xác nhận.`).show();
                $('#dnResultPanel').addClass('show');
                calcTyLeThamGia();
                fetchDtdkData();
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
                updateTyLeFormulaHint(totalWorker);
                $('#dnResultWebsite').text(dn.website || '—');
                $('#proxyDnHint').text(`BC này được tạo bởi Cán bộ Phòng LĐ thay cho DN ${dnName}. Trạng thái sau nộp: Chờ xác nhận.`).show();
                $('#dnResultPanel').addClass('show');
                calcTyLeThamGia();
                fetchDtdkData();
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

    // ===== QCDC SPECIFIC TOGGLES =====
    function initQCDCToggles() {
        const syncCoBanQCDCFromSelect = function () {
            const val = $('#coBanQCDCSelect').val();
            if (val === 'true') {
                $('#coBanQCDCYes').prop('checked', true);
                $('#coBanQCDCNo').prop('checked', false);
            } else {
                $('#coBanQCDCYes').prop('checked', false);
                $('#coBanQCDCNo').prop('checked', true);
            }
            $('#rowNgayBanHanh').toggle(val === 'true');
        };

        if ($('#coBanQCDCSelect').length) {
            $('#coBanQCDCSelect').on('change', syncCoBanQCDCFromSelect);
            syncCoBanQCDCFromSelect();
        }

        $('input[name="coBanQCDC"]').on('change', function () {
            $('#rowNgayBanHanh').toggle(this.value === 'true');
        });

        $('input[name="coHoiNghiNLD"]').on('change', function () {
            $('#rowSoNguoiThamGia').toggle(this.value === 'true');
        });
    }

    function loadKcnFilter() {
        const $sel = $('#proxyKcnFilter');
        if ($sel.length === 0) return;

        function appendKcnOptions(items) {
            let added = 0;
            items.forEach(function (item) {
                const id = item.id || item.ma || item.industrialZoneId || '';
                const name = item.ten || item.name || item.displayName || item.industrialZoneName || item.tenKhuCongNghiep || '';
                if (id && name) {
                    $sel.append(`<option value="${id}">${escapeHtml(name)}</option>`);
                    added++;
                }
            });
            return added;
        }

        function loadKcnFromMaster() {
            $.ajax({
                url: '/IndustrialZones/GetAll',
                type: 'GET',
                success: function (rows) {
                    const items = Array.isArray(rows) ? rows : [];
                    const added = appendKcnOptions(items);
                    if (added === 0) {
                        toastr.warning('Không có dữ liệu KCN để hiển thị.');
                    }
                },
                error: function () {
                    toastr.warning('Không thể tải danh sách KCN.');
                }
            });
        }

        $.ajax({
            url: API.getKcn,
            type: 'GET',
            data: {},
            success: function (res) {
                const items = (res?.data?.items && Array.isArray(res.data.items))
                    ? res.data.items
                    : (Array.isArray(res?.data) ? res.data : []);
                const added = appendKcnOptions(items);
                if (added === 0) {
                    loadKcnFromMaster();
                }
            },
            error: function () {
                loadKcnFromMaster();
            }
        });
    }

    function calcTyLeThamGia() {
        const tongThamGia = toInt($('#tongSoLaoDongThamGia').val());
        const tongLdDn = toInt($('#tongSoLaoDongDN').val()) || getEnterpriseWorkerCount();
        const tyLe = tongLdDn > 0 ? (tongThamGia * 100 / tongLdDn) : 0;
        $('#tyLeThamGia').val(tyLe.toFixed(2));
    }

    // ===== CATEGORIES =====
    function loadCategories() {
        $.ajax({
            url: API.getCategories,
            type: 'GET',
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

    // ===== FILE UPLOAD =====
    function initFileUpload() {
        const $area = $('#fileUploadArea');
        const $input = $('#fileInput');

        $area.on('click', function (e) { if (!$(e.target).is('input')) $input.trigger('click'); });
        $area.on('dragover', function (e) { e.preventDefault(); $area.css('border-color', 'var(--primary)'); });
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
        if (uploadedFiles.length + files.length > 5) { toastr.warning('Tối đa 5 file đính kèm.'); return; }
        Array.from(files).forEach(function (file) {
            if (file.size > 20 * 1024 * 1024) { toastr.warning(`File "${file.name}" quá 20MB.`); return; }
            const ext = file.name.split('.').pop().toLowerCase();
            if (!['pdf', 'xls', 'xlsx'].includes(ext)) {
                toastr.warning(`File "${file.name}" không đúng định dạng. Chỉ chấp nhận PDF, Excel.`);
                return;
            }
            const fileId = 'local_' + Date.now() + '_' + Math.round(Math.random() * 1e6);
            file._proxyId = fileId;
            uploadedFiles.push(file);
            $('#fileList').append(`
                <div class="d-flex align-items-center justify-content-between p-2 bg-light rounded mb-1" id="file_${fileId}">
                    <span><i class="fas fa-file-pdf mr-2 text-danger"></i>${escapeHtml(file.name)} (${(file.size / 1048576).toFixed(1)} MB)</span>
                    <button type="button" class="btn-figma btn-figma-outline" style="height:22px;padding:0 8px;font-size:11px;" onclick="removeQCDCFile('${fileId}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>`);
        });
    }

    window.removeQCDCFile = function (fileId) {
        const idx = uploadedFiles.findIndex(function (f) { return f._proxyId === fileId; });
        if (idx > -1) uploadedFiles.splice(idx, 1);
        $('#file_' + fileId).remove();
    };

    // ===== DTDK DIVERGENCE CHECK =====
    function fetchDtdkData() {
        const enterpriseId = $('#selectedEnterpriseId').val();
        const kyBaoCaoId = $('#proxyKyBaoCaoId').val();
        if (!enterpriseId || !kyBaoCaoId) {
            dtdkData = null;
            hideDTDKWarning();
            return;
        }

        $.ajax({
            url: '/BaoCaoDoiThoaiDinhKy/GetAll',
            type: 'GET',
            data: { enterpriseId: enterpriseId, kyBaoCaoId: kyBaoCaoId, page: 1, pageSize: 100 },
            success: function (res) {
                var items = (res && res.success && Array.isArray(res.data)) ? res.data : [];
                // Only consider submitted / approved (trangThai >= 2)
                var submitted = items.filter(function (x) { return (x.trangThai || 0) >= 2; });
                var countDinhKy = submitted.filter(function (x) {
                    var loai = (x.loaiDisplay || x.loaiDoiThoaiDinhKyDisplay || '').toLowerCase();
                    return loai.indexOf('đột xuất') === -1 && loai.indexOf('dot xuat') === -1;
                }).length;
                var countDotXuat = submitted.length - countDinhKy;
                dtdkData = {
                    totalCount: submitted.length,
                    countDinhKy: countDinhKy,
                    countDotXuat: countDotXuat
                };
                checkDTDKDivergence();
            },
            error: function () {
                dtdkData = null;
                hideDTDKWarning();
            }
        });
    }

    function checkDTDKDivergence() {
        if (!dtdkData || dtdkData.totalCount === 0) {
            hasDtdkDivergence = false;
            hideDTDKWarning();
            return;
        }

        var inputDinhKy = toInt($('#tongSoCuocDTDK').val());
        var inputDotXuat = toInt($('#tongSoCuocDotXuat').val());

        var divergeDinhKy = inputDinhKy !== dtdkData.countDinhKy;
        var divergeDotXuat = inputDotXuat !== dtdkData.countDotXuat;

        if (divergeDinhKy || divergeDotXuat) {
            hasDtdkDivergence = true;
            dtdkConfirmed = false;
            showDTDKWarning(inputDinhKy, inputDotXuat);
        } else {
            hasDtdkDivergence = false;
            hideDTDKWarning();
        }
    }

    function showDTDKWarning(inputDinhKy, inputDotXuat) {
        var lines = [];
        if (inputDinhKy !== dtdkData.countDinhKy) {
            lines.push(
                'Số cuộc ĐTĐK (Định kỳ): BC ĐTĐK đã nộp = <strong>' + dtdkData.countDinhKy + '</strong>' +
                ', bạn nhập = <strong>' + inputDinhKy + '</strong>'
            );
        }
        if (inputDotXuat !== dtdkData.countDotXuat) {
            lines.push(
                'Số cuộc ĐTĐK (Đột xuất): BC ĐTĐK đã nộp = <strong>' + dtdkData.countDotXuat + '</strong>' +
                ', bạn nhập = <strong>' + inputDotXuat + '</strong>'
            );
        }
        $('#dtdkWarningDetail').html(lines.join('<br>'));
        $('#dtdkDivergenceWarning').addClass('show');
        $('#dtdkConfirmedBanner').removeClass('show');
    }

    function hideDTDKWarning() {
        $('#dtdkDivergenceWarning').removeClass('show');
        $('#dtdkConfirmedBanner').removeClass('show');
        dtdkConfirmed = false;
    }

    function initDTDKDivergenceHandlers() {
        $('#btnDtdkConfirm').on('click', function () {
            dtdkConfirmed = true;
            hasDtdkDivergence = true;
            $('#dtdkDivergenceWarning').removeClass('show');
            $('#dtdkConfirmedBanner').addClass('show');
        });

        $('#btnDtdkAdjust').on('click', function () {
            if (!dtdkData) return;
            $('#tongSoCuocDTDK').val(dtdkData.countDinhKy);
            $('#tongSoCuocDotXuat').val(dtdkData.countDotXuat);
            hasDtdkDivergence = false;
            dtdkConfirmed = false;
            hideDTDKWarning();
            toastr.info('Số liệu đã được điều chỉnh theo BC ĐTĐK.');
        });

        $('#btnDtdkUnconfirm').on('click', function () {
            dtdkConfirmed = false;
            $('#dtdkConfirmedBanner').removeClass('show');
            checkDTDKDivergence();
        });

        $('#tongSoCuocDTDK, #tongSoCuocDotXuat').on('input change', function () {
            dtdkConfirmed = false;
            checkDTDKDivergence();
        });
    }

    // ===== VALIDATION =====
    function validate() {
        let valid = true;

        if (!selectedDN || !$('#selectedEnterpriseId').val()) {
            toastr.warning('Vui lòng tìm và chọn doanh nghiệp (Bước 1).');
            valid = false;
        }
        if (!$('#proxyKyBaoCaoId').val()) {
            toastr.warning('Vui lòng chọn kỳ báo cáo.'); valid = false;
        }

        if (!$('#proxyReason').val()) {
            $('#errProxyReason').show(); valid = false;
        } else { $('#errProxyReason').hide(); }
        if ($('#proxyReason').val() === 'KHAC' && !$('#proxyReasonNote').val().trim()) {
            toastr.warning('Vui lòng nhập ghi chú lý do khi chọn "Khác".');
            valid = false;
        }

        if (!$('#loaiQuyCheDanChu').val()) {
            $('#errLoaiQCDC').show(); valid = false;
        } else { $('#errLoaiQCDC').hide(); }

        const coBanQCDCValue = $('#coBanQCDCSelect').length
            ? $('#coBanQCDCSelect').val()
            : $('input[name="coBanQCDC"]:checked').val();
        if ((coBanQCDCValue === 'true') && !$('#ngayBanHanh').val()) {
            toastr.warning('Vui lòng nhập ngày ban hành QCDC.');
            valid = false;
        }

        if (uploadedFiles.length === 0 && existingFiles.length === 0) {
            toastr.warning('Vui lòng đính kèm ít nhất 1 file.');
            valid = false;
        }

        const selectedNoiDung = getSelectedCategoryIds().length;
        if (selectedNoiDung === 0) {
            $('#errNoiDung').show(); valid = false;
        } else { $('#errNoiDung').hide(); }

        if (hasDtdkDivergence && !dtdkConfirmed) {
            toastr.warning('Số liệu chênh lệch với BC ĐTĐK đã nộp. Vui lòng xác nhận hoặc điều chỉnh trước khi nộp.');
            $('#dtdkDivergenceWarning')[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            valid = false;
        }

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
            $('#confirmQCDCDnName').text(escapeHtml(selectedDN.name || selectedDN.tenDN || selectedDN.id));
            var $overlay = $('#modalConfirmProxyQCDC');
            $overlay.css('display', 'flex');
        });

        $('#btnConfirmProxyQCDC').on('click', function () {
            $('#modalConfirmProxyQCDC').css('display', 'none');
            doSubmit(false);
        });

        $('#btnCancelProxyQCDC, #modalConfirmProxyQCDC').on('click', function (e) {
            if (e.target === this) $('#modalConfirmProxyQCDC').css('display', 'none');
        });
        $('#modalConfirmProxyQCDC .modal-box').on('click', function (e) { e.stopPropagation(); });
    }

    function doSubmit(isDraft) {
        calcTyLeThamGia();

        const formData = new FormData();
        const danhSachNoiDung = getSelectedCategoryIds();
        const danhSachNoiDungText = $('#danhSachNoiDungSelect option:selected').map(function () {
            return $(this).text().trim();
        }).get();
        const tongThamGia = toInt($('#tongSoLaoDongThamGia').val());
        const tongSoLaoDong = toInt($('#tongSoLaoDongDN').val()) || getEnterpriseWorkerCount();

        formData.append('enterpriseId', $('#selectedEnterpriseId').val());
        formData.append('kyBaoCaoId', $('#proxyKyBaoCaoId').val());
        formData.append('loaiQuyCheDanChu', $('#loaiQuyCheDanChu').val() || '');
        const coBanQCDCValue = $('#coBanQCDCSelect').length
            ? $('#coBanQCDCSelect').val()
            : $('input[name="coBanQCDC"]:checked').val();
        formData.append('coBanQuyCheDanChu', coBanQCDCValue === 'true');
        formData.append('ngayBanHanh', $('#ngayBanHanh').val() || '');
        formData.append('soQDBanHanh', $('#soQDBanHanh').val() || '');
        formData.append('coHoiNghiNLD', $('input[name="coHoiNghiNLD"]:checked').val() === 'true');
        formData.append('soNguoiThamGia', toInt($('#soNguoiThamGia').val()) || tongThamGia);
        formData.append('coBanTT', $('input[name="coBanTT"]:checked').val() === 'true');
        formData.append('tongSoLaoDong', tongSoLaoDong);
        formData.append('noiDungChinh', danhSachNoiDungText.join('; '));
        formData.append('ngayHoiNghi', '');
        formData.append('diaDiem', '');
        formData.append('ketQuaThucHien', '');
        formData.append('khoKhan', '');
        formData.append('deXuat', '');
        formData.append('tongSoCuocDTDK', toInt($('#tongSoCuocDTDK').val()));
        formData.append('tongSoCuocDotXuat', toInt($('#tongSoCuocDotXuat').val()));
        formData.append('tongSoLaoDongThamGia', tongThamGia);
        formData.append('tyLeThamGia', parseFloat($('#tyLeThamGia').val()) || 0);
        formData.append('soKienNghiDaGiaiQuyet', toInt($('#soKienNghiDaGiaiQuyet').val()));
        formData.append('soKienNghiTonDong', toInt($('#soKienNghiTonDong').val()));
        formData.append('ghiChu', $('#ghiChuTongQuat').val() || '');
        formData.append('proxyReason', $('#proxyReason').val() || '');
        formData.append('proxyReasonNote', $('#proxyReasonNote').val() || '');
        formData.append('isDraft', isDraft);
        danhSachNoiDung.forEach(function (id, index) {
            formData.append(`danhSachNoiDung[${index}].categoryId`, id);
        });
        uploadedFiles.forEach(function (file) { formData.append('files', file); });

        const $draftBtn = $('#btnSaveDraftProxy');
        const $submitBtn = $('#btnSubmitProxy');

        $.ajax({
            url: isEditMode ? '/BaoCaoQuyCheDanChu/Update/' + editReportId : API.create,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: { 'RequestVerificationToken': getToken() },
            beforeSend: function () {
                if (isDraft) $draftBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>Đang lưu...');
                else $submitBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i>' + (isEditMode ? 'Đang cập nhật...' : 'Đang nộp...'));
            },
            success: function (res) {
                if (res.success) {
                    toastr.success(res.message || (isDraft ? 'Đã lưu nháp thành công' : 'Nộp báo cáo thành công'));
                    const redirectUrl = (typeof res.redirectUrl === 'string' && res.redirectUrl.trim())
                        ? res.redirectUrl.trim()
                        : '/Review';
                    setTimeout(function () { window.location.href = redirectUrl; }, 1500);
                } else {
                    toastr.error(buildDetailedErrorMessage(res, 'Thao tác thất bại'));
                    $draftBtn.prop('disabled', false).html('<i class="fas fa-save mr-1"></i>Lưu nháp');
                    $submitBtn.prop('disabled', false).html('<i class="fas fa-paper-plane mr-1"></i>' + (isEditMode ? 'Cập nhật' : 'Nộp thay hộ DN →'));
                }
            },
            error: function () {
                toastr.error('Không thể kết nối đến máy chủ');
                $draftBtn.prop('disabled', false).html('<i class="fas fa-save mr-1"></i>Lưu nháp');
                $submitBtn.prop('disabled', false).html('<i class="fas fa-paper-plane mr-1"></i>' + (isEditMode ? 'Cập nhật' : 'Nộp thay hộ DN →'));
            }
        });
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
                    <span><i class="fas fa-file-alt mr-2 text-primary"></i>${escapeHtml(file.tenFile || 'File đã đính kèm')}</span>
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
        $('#dnResultTongLD').text(formatNumberVi(draftData.tongSoLaoDong || 0));
        $('#tongSoLaoDongDN').val(toInt(draftData.tongSoLaoDong));
        updateTyLeFormulaHint(draftData.tongSoLaoDong || 0);
        $('#proxyDnHint').text('Đang cập nhật bản nháp. Sau khi bấm Cập nhật, trạng thái sẽ chuyển sang Chờ xác nhận.').show();
        $('#dnResultPanel').addClass('show');

        $('#proxyReason').val('CAP_NHAT_LD');
        $('#loaiQuyCheDanChu').val(draftData.loaiQuyCheDanChu || 1);
        $('#coBanQCDCSelect').val(String(draftData.coBanQuyCheDanChu === true)).trigger('change');
        const ngayBanHanhValue = draftData.ngayBanHanh || draftData.ngayBanHanhQCDC || draftData.ngayBanHanhQuyCheDanChu;
        $('#ngayBanHanh').val(toDateInputValue(ngayBanHanhValue));
        $('#tongSoCuocDTDK').val(toInt(
            draftData.tongSoCuocDTDK ?? draftData.tongSoCuocDtdk ?? draftData.soCuocDoiThoaiDinhKy
        ));
        $('#tongSoCuocDotXuat').val(toInt(
            draftData.tongSoCuocDotXuat ?? draftData.soCuocDoiThoaiDotXuat
        ));
        $('#soKienNghiDaGiaiQuyet').val(toInt(draftData.soKienNghiDaGiaiQuyet ?? 0));
        $('#soKienNghiTonDong').val(toInt(draftData.soKienNghiTonDong ?? 0));
        $('#soQDBanHanh').val(draftData.soQDBanHanh || '');
        $('input[name="coHoiNghiNLD"][value="' + String(draftData.coHoiNghiNLD === true) + '"]').prop('checked', true).trigger('change');
        $('input[name="coBanTT"][value="' + String(draftData.coBanTT === true) + '"]').prop('checked', true);
        $('#soNguoiThamGia').val(toInt(draftData.soNguoiThamGia));
        $('#tongSoLaoDongThamGia').val(toInt(draftData.soNguoiThamGia));
        $('#tyLeThamGia').val(draftData.tongSoLaoDong ? (toInt(draftData.soNguoiThamGia) * 100 / toInt(draftData.tongSoLaoDong)).toFixed(2) : '0.00');
        $('#ghiChuTongQuat').val(draftData.ghiChu || '');
        $('#charGhiChuTongQuat').text(($('#ghiChuTongQuat').val() || '').length);
        renderExistingFiles();
        applyDraftCategorySelection();
        if (draftData.enterpriseId) {
            selectEnterprise(selectedDN);
        }
    }

    // ===== INIT =====
    $(document).ready(function () {
        loadKyBaoCao();
        loadKcnFilter();
        loadCategories();
        initDNSearch();
        initProxyReason();
        initQCDCToggles();
        initFileUpload();
        initSubmit();
        initDTDKDivergenceHandlers();
        updateTyLeFormulaHint(0);
        initEditMode();
        $('#tongSoLaoDongThamGia').on('input', calcTyLeThamGia);
        $('#ghiChuTongQuat').on('input', function () {
            $('#charGhiChuTongQuat').text(this.value.length);
        });
        $('#btnDownloadTemplateQCDC').on('click', function (e) {
            e.preventDefault();
            toastr.info('Biểu mẫu TT 28/2021 sẽ được cập nhật sau.');
        });

        $(document).on('keydown', function (e) {
            if (e.key === 'Escape') $('#modalConfirmProxyQCDC').css('display', 'none');
        });
    });

})();
