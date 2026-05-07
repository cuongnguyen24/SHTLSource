/**
 * sukienqhld-edit.js — Chỉnh sửa Sự kiện QHLĐ
 * Module: M0131
 */
(function ($) {
    'use strict';

    // ─── Config ───────────────────────────────────────────────────────────────
    var cfg = window.editConfig || {};
    var TOKEN = cfg.antiForgeryToken || '';
    var SUKIEN_ID = cfg.suKienId || '';
    var TOTAL_EMPLOYEES = cfg.totalEmployees || 0;
    var TYLE_WARN_THRESHOLD = 50;

    // ─── State ────────────────────────────────────────────────────────────────
    var scanUploader = null;
    var attachUploader = null;
    var submitting = false;

    // ─── Helpers ──────────────────────────────────────────────────────────────
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
        var soNguoi = parseInt($soNguoi.val(), 10) || 0;

        if ($loaiSuKien.val() === 'TCLDCaNhan' || !TOTAL_EMPLOYEES || !soNguoi) {
            $('#tyleWarning').removeClass('show');
            return;
        }
        var tyle = (soNguoi / TOTAL_EMPLOYEES * 100).toFixed(1);
        $('#tyleWarningText').text('Tỷ lệ NLĐ tham gia: ' + tyle + '% (' + soNguoi.toLocaleString('vi-VN') + ' / ' + TOTAL_EMPLOYEES.toLocaleString('vi-VN') + ')');
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

    // ─── NguyenNhan dropdown (async load + pre-select) ───────────────────────
    var $nguyenNhan = $('#nguyenNhanId');
    var currentNguyenNhanId = (cfg.nguyenNhanId || '').toLowerCase();

    function initNguyenNhan() {
        $.get('/SuKienQHLD/GetNguyenNhanList')
            .done(function (res) {
                var data = res.data || [];
                // Clear and recreate options to ensure clean state
                $nguyenNhan.empty().append('<option value="">-- Chọn nguyên nhân --</option>');
                
                if (Array.isArray(data) && data.length) {
                    // Pre-process data for Select2
                    var items = data.map(function (item) {
                        return { id: item.id, text: item.name };
                    });

                    $nguyenNhan.select2({
                        theme: 'bootstrap4',
                        width: '100%',
                        data: items,
                        placeholder: '-- Chọn nguyên nhân --',
                        allowClear: true
                    });

                    // Pre-select current value with case-insensitive check
                    if (currentNguyenNhanId && currentNguyenNhanId !== '00000000-0000-0000-0000-000000000000') {
                        var found = items.find(function(it) { 
                            return (it.id || '').toString().toLowerCase() === currentNguyenNhanId; 
                        });
                        if (found) {
                            $nguyenNhan.val(found.id).trigger('change');
                        }
                    }
                }
            })
            .fail(function () {
                $nguyenNhan.html('<option value="">-- Lỗi tải nguyên nhân --</option>');
            });
    }

    // Initialize regular Select2 elements (those with predefined options in HTML)
    var $selects = $('.select2').not('#nguyenNhanId');
    if (typeof window.initSelect2 === 'function') {
        window.initSelect2($selects);
    } else {
        $selects.select2({ theme: 'bootstrap4', width: '100%', allowClear: true });
    }

    initNguyenNhan();

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
            ['loaiSuKien', 'errLoaiSuKien'],
            ['ngayPhatSinh', 'errNgayPhatSinh'],
            ['soNguoi', 'errSoNguoi'],
            ['mucDo', 'errMucDo'],
            ['nguyenNhanId', 'errNguyenNhan'],
            ['dienBien', 'errDienBien']
        ], function (_, pair) { clearInvalid(pair[0], pair[1]); });

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
    function buildFormData() {
        var fd = new FormData();
        fd.append('__RequestVerificationToken', TOKEN);
        fd.append('EnterpriseId', $('#hdEnterpriseId').val() || '');
        fd.append('LoaiSuKien', $loaiSuKien.val());
        fd.append('NgayPhatSinh', $('#ngayPhatSinh').val());
        var gio = $('#gioPhatSinh').val();
        if (gio) fd.append('GioPhatSinh', gio);
        var loai = $loaiSuKien.val();
        fd.append('SoNguoi', (loai && loai !== 'TCLDCaNhan') ? ($soNguoi.val() || '1') : '1');
        fd.append('MucDo', $('#mucDo').val());
        fd.append('PhamViAnhHuong', $('#phamViAnhHuong').val() || '');
        fd.append('NguyenNhanId', $nguyenNhan.val());
        fd.append('DienBien', $('#dienBien').val());
        fd.append('YeuCauNLD', $('#yeuCauNLD').val() || '');
        fd.append('GhiChu', $('#ghiChu').val() || '');
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

    // ─── Submit: Cập nhật ─────────────────────────────────────────────────────
    $('#btnUpdate').on('click', function () {
        if (submitting) return;
        hideValidationBanner();

        if (!validateForm()) {
            showValidationBanner('Vui lòng điền đầy đủ các trường bắt buộc trước khi cập nhật.');
            return;
        }

        submitting = true;
        showLoading();

        postForm('/SuKienQHLD/edit/' + SUKIEN_ID, buildFormData())
            .done(function (res) {
                if (res.isSuccess) {
                    toastr.success('Cập nhật sự kiện QHLĐ thành công!', 'Thành công');
                    setTimeout(function () { window.location.href = '/SuKienQHLD/Details/' + SUKIEN_ID; }, 800);
                } else {
                    showValidationBanner(res.message || 'Cập nhật sự kiện không thành công. Vui lòng thử lại.');
                    submitting = false;
                    hideLoading();
                }
            })
            .fail(function () {
                showValidationBanner('Đã có lỗi xảy ra khi cập nhật. Vui lòng thử lại.');
                submitting = false;
                hideLoading();
            });
    });

    // ─── Init ─────────────────────────────────────────────────────────────────
    updateLoaiSuKienUI();
    initFileZones();

}(jQuery));
