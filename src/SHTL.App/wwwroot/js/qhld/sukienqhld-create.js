/**
 * sukienqhld-create.js — SCR-NV-PAB-001 Ghi nhận Sự kiện QHLĐ (PA-B)
 * Module: M0131
 */
(function ($) {
    'use strict';

    // ─── Constants ────────────────────────────────────────────────────────────
    var TOKEN = (window.pabConfig && window.pabConfig.antiForgeryToken) || '';
    var TYLE_WARN_THRESHOLD = 50;

    // ─── State ────────────────────────────────────────────────────────────────
    var selectedEnterprise = null;
    var scanUploader = null;
    var attachUploader = null;
    var submitting = false;

    // ─── Helpers ──────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        return $('<div>').text(String(str || '')).html();
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    }

    function debounce(fn, ms) {
        var timer;
        return function () {
            var args = arguments, ctx = this;
            clearTimeout(timer);
            timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
        };
    }

    function showLoading() { $('#loadingOverlay').addClass('show'); }
    function hideLoading() { $('#loadingOverlay').removeClass('show'); }

    function showValidationBanner(msg) {
        var $banner = $('#validationBanner');
        $('#validationBannerText').text(msg);
        $banner.addClass('show');
        $banner[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideValidationBanner() { $('#validationBanner').removeClass('show'); }

    function markInvalid(inputId, errId, msg) {
        $('#' + inputId).addClass('is-invalid');
        $('#' + errId).text(msg || '');
    }

    function clearInvalid(inputId, errId) {
        $('#' + inputId).removeClass('is-invalid');
        $('#' + errId).text('');
    }

    // ─── Enterprise Autocomplete ──────────────────────────────────────────────
    var $searchInput = $('#enterpriseSearch');
    var $suggestionsBox = $('#enterpriseSuggestions');
    var $hdEnterpriseId = $('#hdEnterpriseId');

    function clearEnterpriseSelection() {
        selectedEnterprise = null;
        $hdEnterpriseId.val('');
        $('#dnInfoCard').removeClass('show');
        $('#dnName, #dnTaxCode, #dnKcn, #dnNganh, #dnTotalLd').text('');
        recalcTyle();
    }

    function showEnterpriseInfo(dn) {
        selectedEnterprise = dn;
        $hdEnterpriseId.val(dn.id);
        $('#dnName').text(dn.name || '–');
        $('#dnTaxCode').text(dn.taxCode || '–');
        $('#dnKcn').text(dn.industrialZoneName || '–');
        $('#dnNganh').text(dn.industryName || '–');
        $('#dnTotalLd').text(dn.totalEmployees ? dn.totalEmployees.toLocaleString('vi-VN') : '–');
        $('#dnInfoCard').addClass('show');
        clearInvalid('enterpriseSearch', 'errEnterprise');
        recalcTyle();
    }

    function renderSuggestions(items) {
        if (!items || !items.length) {
            $suggestionsBox.html('<div style="padding:10px 14px;color:#94a3b8;font-size:13px;">Không tìm thấy doanh nghiệp</div>').show();
            return;
        }
        var html = items.map(function (dn) {
            return '<div class="suggest-item" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:13px;" data-id="' + escapeHtml(dn.id) + '">'
                + '<div style="font-weight:700;color:#1e293b;">' + escapeHtml(dn.name) + '</div>'
                + '<div style="font-size:11px;color:#64748b;">MST: ' + escapeHtml(dn.taxCode) + (dn.industrialZoneName ? ' • KCN: ' + escapeHtml(dn.industrialZoneName) : '') + '</div>'
                + '</div>';
        }).join('');
        $suggestionsBox.html(html).show();

        $suggestionsBox.find('.suggest-item').each(function (idx) {
            var $el = $(this);
            $el.on('mousedown', function (e) {
                e.preventDefault();
                showEnterpriseInfo(items[idx]);
                $searchInput.val(items[idx].name);
                $suggestionsBox.hide();
            }).hover(
                function () { $el.css('background', '#eff6ff'); },
                function () { $el.css('background', ''); }
            );
        });
    }

    var doSearch = debounce(function (q) {
        if (!q || q.trim().length < 2) { $suggestionsBox.hide(); return; }
        $.get('/SuKienQHLD/SearchEnterprise', { q: q.trim(), pageSize: 10 })
            .done(function (res) {
                if (res.success) renderSuggestions(res.data);
                else $suggestionsBox.hide();
            })
            .fail(function () { $suggestionsBox.hide(); });
    }, 300);

    $searchInput.on('input', function () {
        if (selectedEnterprise && $searchInput.val() !== selectedEnterprise.name) {
            clearEnterpriseSelection();
        }
        doSearch($searchInput.val());
    });

    $searchInput.on('blur', function () {
        setTimeout(function () { $suggestionsBox.hide(); }, 200);
    });

    $searchInput.on('focus', function () {
        if ($searchInput.val().trim().length >= 2 && $suggestionsBox.html()) {
            $suggestionsBox.show();
        }
    });

    // ─── LyDo (always visible, required) ─────────────────────────────────────
    var $selLyDo = $('#selLyDo');

    // ─── LoaiSuKien toggle ────────────────────────────────────────────────────
    var $loaiSuKien = $('#loaiSuKien');
    var $soNguoiRow = $('#soNguoiRow');
    var $soNguoi = $('#soNguoi');

    function updateLoaiSuKienUI() {
        $soNguoiRow.toggle($loaiSuKien.val() !== 'TCLDCaNhan');
        recalcTyle();
    }

    $loaiSuKien.on('change', updateLoaiSuKienUI);

    // ─── Tỷ lệ NLĐ calculation ────────────────────────────────────────────────
    function recalcTyle() {
        var totalLd = selectedEnterprise ? (selectedEnterprise.totalEmployees || 0) : 0;
        var soNguoi = parseInt($soNguoi.val(), 10) || 0;

        if ($loaiSuKien.val() === 'TCLDCaNhan' || !totalLd || !soNguoi) {
            $('#tyleWarning').removeClass('show');
            return;
        }
        var tyle = (soNguoi / totalLd * 100).toFixed(1);
        $('#tyleWarningText').text('Tỷ lệ NLĐ tham gia: ' + tyle + '% (' + soNguoi.toLocaleString('vi-VN') + ' / ' + totalLd.toLocaleString('vi-VN') + ')');
        $('#tyleWarning').toggleClass('show', parseFloat(tyle) >= TYLE_WARN_THRESHOLD);
    }

    $soNguoi.on('input change', recalcTyle);

    // ─── Character counters ───────────────────────────────────────────────────
    function wireCharCounter(textareaId, counterId, max) {
        var $ta = $('#' + textareaId);
        var $counter = $('#' + counterId);
        if (!$ta.length || !$counter.length) return;
        function update() {
            var len = $ta.val().length;
            $counter.text(len.toLocaleString('vi-VN') + ' / ' + max.toLocaleString('vi-VN'))
                    .attr('class', 'char-counter')
                    .toggleClass('danger', len >= max)
                    .toggleClass('warn', len >= max * 0.85 && len < max);
        }
        $ta.on('input', update);
        update();
    }

    wireCharCounter('dienBien', 'cntDienBien', 5000);
    wireCharCounter('yeuCauNLD', 'cntYeuCauNLD', 3000);
    wireCharCounter('ghiChu', 'cntGhiChu', 2000);

    // ─── NguyenNhan dropdown ──────────────────────────────────────────────────
    var $nguyenNhan = $('#nguyenNhanId');

    $.get('/SuKienQHLD/GetNguyenNhanList')
        .done(function (res) {
            $nguyenNhan.html('<option value="">-- Chọn nguyên nhân --</option>');
            var data = res.data || [];
            if (Array.isArray(data) && data.length) {
                $nguyenNhan.select2({
                    theme: 'bootstrap4',
                    width: '100%',
                    data: data.map(function (item) {
                        return { id: item.id, text: item.name };
                    })
                });
            }
        })
        .fail(function () {
            $nguyenNhan.html('<option value="">-- Lỗi tải nguyên nhân --</option>');
        });

    // ─── File zones (FileUploadComponent) ────────────────────────────────────
    function initFileZones() {
        if (!window.FileUploadComponent) return;
        scanUploader = new window.FileUploadComponent({
            dropZoneId:  'dropZoneScan',
            fileInputId: 'inputFileScan',
            fileQueueId: 'fileScanList',
            maxFiles:    10,
            maxSizeMB:   20
        });
        attachUploader = new window.FileUploadComponent({
            dropZoneId:  'dropZoneAttach',
            fileInputId: 'inputFileAttach',
            fileQueueId: 'fileAttachList',
            maxFiles:    10,
            maxSizeMB:   50
        });
    }

    // ─── Validation ───────────────────────────────────────────────────────────
    function validateForm() {
        var ok = true;
        $.each([
            ['enterpriseSearch', 'errEnterprise'],
            ['selLyDo', 'errLyDo'],
            ['loaiSuKien', 'errLoaiSuKien'],
            ['ngayPhatSinh', 'errNgayPhatSinh'],
            ['soNguoi', 'errSoNguoi'],
            ['mucDo', 'errMucDo'],
            ['nguyenNhanId', 'errNguyenNhan'],
            ['dienBien', 'errDienBien']
        ], function (_, pair) { clearInvalid(pair[0], pair[1]); });

        if (!$hdEnterpriseId.val()) {
            markInvalid('enterpriseSearch', 'errEnterprise', 'Vui lòng chọn doanh nghiệp');
            ok = false;
        }
        if (!$selLyDo.val()) {
            markInvalid('selLyDo', 'errLyDo', 'Vui lòng chọn lý do nhập thay');
            ok = false;
        }
        if (!$loaiSuKien.val()) {
            markInvalid('loaiSuKien', 'errLoaiSuKien', 'Vui lòng chọn loại sự kiện');
            ok = false;
        }
        var ngayVal = $('#ngayPhatSinh').val();
        if (!ngayVal) {
            markInvalid('ngayPhatSinh', 'errNgayPhatSinh', 'Vui lòng nhập ngày phát sinh');
            ok = false;
        } else {
            var today = new Date();
            var todayStr = today.getFullYear() + '-'
                + String(today.getMonth() + 1).padStart(2, '0') + '-'
                + String(today.getDate()).padStart(2, '0');
            if (ngayVal > todayStr) {
                markInvalid('ngayPhatSinh', 'errNgayPhatSinh', 'Ngày phát sinh không được lớn hơn ngày hiện tại');
                ok = false;
            }
        }
        var loai = $loaiSuKien.val();
        if (loai && loai !== 'TCLDCaNhan') {
            var sn = parseInt($soNguoi.val(), 10);
            if (!sn || sn < 1) {
                markInvalid('soNguoi', 'errSoNguoi', 'Số NLĐ tham gia phải lớn hơn 0');
                ok = false;
            }
        }
        if (!$('#mucDo').val()) {
            markInvalid('mucDo', 'errMucDo', 'Vui lòng chọn mức độ');
            ok = false;
        }
        if (!$nguyenNhan.val()) {
            markInvalid('nguyenNhanId', 'errNguyenNhan', 'Vui lòng chọn nguyên nhân chính');
            ok = false;
        }
        if (!$('#dienBien').val().trim()) {
            markInvalid('dienBien', 'errDienBien', 'Vui lòng nhập diễn biến sự kiện');
            ok = false;
        }
        return ok;
    }

    // ─── Build FormData ───────────────────────────────────────────────────────
    function buildFormData() {debugger
        var fd = new FormData();
        fd.append('__RequestVerificationToken', TOKEN);
        fd.append('EnterpriseId', $hdEnterpriseId.val());
        fd.append('LyDoNhapThay', $selLyDo.val() || '');
        fd.append('SoVanBanGiay', $('#soVanBan').val() || '');
        fd.append('LoaiSuKien', $loaiSuKien.val());
        fd.append('NgayPhatSinh', $('#ngayPhatSinh').val());
        var gio = $('#gioPhatSinh').val();
        if (gio) fd.append('GioPhatSinh', gio);
        var loai = $loaiSuKien.val();
        if (loai && loai !== 'TCLDCaNhan') 
            fd.append('SoNguoi', $soNguoi.val() || '1');
        else fd.append('SoNguoi', '1');
        fd.append('MucDo', $('#mucDo').val());
        fd.append('PhamViAnhHuong', $('#phamViAnhHuong').val() || '');
        fd.append('NguyenNhanId', $nguyenNhan.val());
        fd.append('DienBien', $('#dienBien').val());
        fd.append('YeuCauNLD', $('#yeuCauNLD').val() || '');
        fd.append('GhiChu', $('#ghiChu').val() || '');
        // files_HO_SO → hồ sơ scan; files_KHAC → file đính kèm khác
        $.each(scanUploader ? scanUploader.getFiles() : [], function (_, f) { fd.append('files_HO_SO', f, f.name); });
        $.each(attachUploader ? attachUploader.getFiles() : [], function (_, f) { fd.append('files_KHAC', f, f.name); });
        return fd;
    }

    function postForm(url, formData) {
        return $.ajax({
            url: url,
            method: 'POST',
            data: formData,
            contentType: false,
            processData: false,
            headers: { 'X-XSRF-TOKEN': TOKEN, 'RequestVerificationToken': TOKEN }
        });
    }

    // ─── Submit: Lưu ghi nhận ─────────────────────────────────────────────────
    $('#btnSubmit').on('click', function () {
        if (submitting) return;
        hideValidationBanner();

        if (!validateForm()) {
            showValidationBanner('Vui lòng điền đầy đủ các trường bắt buộc trước khi ghi nhận.');
            return;
        }

        submitting = true;
        showLoading();

        postForm('/SuKienQHLD/Create', buildFormData())
            .done(function (res) {
                if (res.isSuccess && res.id) {
                    toastr.success('Ghi nhận sự kiện QHLĐ thành công!', 'Thành công');
                    setTimeout(function () { window.location.href = '/SuKienQHLD/Details/' + res.id; }, 800);
                } else {
                    showValidationBanner(res.message || 'Ghi nhận sự kiện không thành công. Vui lòng thử lại.');
                    submitting = false;
                    hideLoading();
                }
            })
            .fail(function () {
                showValidationBanner('Đã có lỗi xảy ra khi ghi nhận. Vui lòng thử lại.');
                submitting = false;
                hideLoading();
            });
    });

    // ─── Submit: Lưu nháp ────────────────────────────────────────────────────
    $('#btnSaveDraft').on('click', function () {
        if (submitting) return;
        if (!$hdEnterpriseId.val()) {
            showValidationBanner('Vui lòng chọn doanh nghiệp trước khi lưu nháp.');
            markInvalid('enterpriseSearch', 'errEnterprise', 'Vui lòng chọn doanh nghiệp');
            return;
        }

        submitting = true;
        showLoading();
        hideValidationBanner();

        postForm('/SuKienQHLD/CreateDraft', buildFormData())
            .done(function (res) {
                if (res.isSuccess && res.id) {
                    toastr.success('Đã lưu nháp sự kiện QHLĐ!', 'Thành công');
                    setTimeout(function () { window.location.href = '/SuKienQHLD/Index'; }, 800);
                } else {
                    showValidationBanner(res.message || 'Lưu nháp không thành công. Vui lòng thử lại.');
                    submitting = false;
                    hideLoading();
                }
            })
            .fail(function () {
                showValidationBanner('Đã có lỗi xảy ra khi lưu nháp. Vui lòng thử lại.');
                submitting = false;
                hideLoading();
            });
    });

    // ─── Init ─────────────────────────────────────────────────────────────────
    updateLoaiSuKienUI();
    initFileZones();

}(jQuery));
