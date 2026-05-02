// work-permit-ocr-confirm.js - OCR Confirmation page with PDF.js viewer
var pdfDoc = null;
var pageNum = 1;
var pageRendering = false;
var pageNumPending = null;
var scale = 1.5;
var canvas = document.getElementById('pdfCanvas');
var ctx = canvas.getContext('2d');

$(document).ready(function () {
    var applicationId = window.applicationId;
    var pdfUrl = window.pdfUrl;

    // Initialize confidence badges
    updateConfidenceBadges();

    // Load PDF
    if (pdfUrl) {
        loadPdf(pdfUrl);
    }

    // Monitor field changes to detect edits
    $('#ocrForm input[data-original]').on('input', function () {
        checkForEdits();
    });

    // Upload PDF button
    $('#btnUploadPdf').on('click', function () {
        $('#pdfFileInput').click();
    });

    // File input change
    $('#pdfFileInput').on('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            toastr.error('Vui lòng chọn file PDF');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB
            toastr.error('Kích thước file không được vượt quá 10MB');
            return;
        }

        uploadPdf(file);
    });

    // Form submit
    $('#ocrForm').on('submit', function (e) {
        e.preventDefault();

        var hasEdits = $('#editReasonGroup').is(':visible');
        var editReason = $('#editReason').val();

        if (hasEdits && (!editReason || editReason.trim().length < 10)) {
            toastr.warning('Vui lòng nhập lý do chỉnh sửa (tối thiểu 10 ký tự)');
            return;
        }

        var data = {
            soGPLD: $('#soGPLD').val(),
            ngayKy: $('#ngayKy').val(),
            nguoiKy: $('#nguoiKy').val(),
            chucVu: $('#chucVu').val(),
            editReason: editReason
        };

        confirmOcr(data);
    });

    // Update confidence badges
    function updateConfidenceBadges() {
        $('input[data-confidence]').each(function () {
            var confidence = parseFloat($(this).data('confidence')) || 0;
            var fieldName = $(this).attr('id');
            var badgeId = fieldName + 'Confidence';
            var badge = $('#' + badgeId);

            var badgeClass = 'badge-success';
            var badgeText = confidence.toFixed(0) + '%';

            if (confidence < 60) {
                badgeClass = 'badge-danger';
            } else if (confidence < 85) {
                badgeClass = 'badge-warning';
            }

            badge.removeClass('badge-success badge-warning badge-danger').addClass(badgeClass).text(badgeText);
        });
    }

    // Check for edits
    function checkForEdits() {
        var hasEdits = false;

        $('#ocrForm input[data-original]').each(function () {
            var original = $(this).data('original') || '';
            var current = $(this).val() || '';
            if (original.toString() !== current.toString()) {
                hasEdits = true;
                return false; // break
            }
        });

        if (hasEdits) {
            $('#editReasonGroup').slideDown();
            $('#editReason').prop('required', true);
        } else {
            $('#editReasonGroup').slideUp();
            $('#editReason').prop('required', false).val('');
        }
    }

    // Upload PDF
    function uploadPdf(file) {
        var formData = new FormData();
        formData.append('file', file);

        var token = $('input[name="__RequestVerificationToken"]').val();

        $.ajax({
            url: '/WorkPermit/UploadPdf/' + applicationId,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: { 'RequestVerificationToken': token },
            beforeSend: function () {
                toastr.info('Đang tải lên và xử lý OCR...');
            },
            success: function (result) {
                if (result.success && result.data) {
                    toastr.success('Tải lên thành công. Đang nhận dạng...');
                    
                    // Update form with new OCR data
                    $('#soGPLD').val(result.data.soGPLD).data('original', result.data.soGPLD).data('confidence', result.data.soGPLDConfidence);
                    $('#ngayKy').val(result.data.ngayKy).data('original', result.data.ngayKy).data('confidence', result.data.ngayKyConfidence);
                    $('#nguoiKy').val(result.data.nguoiKy).data('original', result.data.nguoiKy).data('confidence', result.data.nguoiKyConfidence);
                    $('#chucVu').val(result.data.chucVu).data('original', result.data.chucVu).data('confidence', result.data.chucVuConfidence);
                    
                    updateConfidenceBadges();
                    checkForEdits();

                    // Reload PDF
                    if (result.data.pdfUrl) {
                        loadPdf(result.data.pdfUrl);
                    }
                } else {
                    toastr.error(result.message || 'Lỗi khi xử lý PDF');
                }
            },
            error: function () {
                toastr.error('Lỗi kết nối khi tải lên PDF');
            }
        });
    }

    // Confirm OCR
    function confirmOcr(data) {
        var token = $('input[name="__RequestVerificationToken"]').val();

        $.ajax({
            url: '/WorkPermit/ConfirmOcr/' + applicationId,
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            headers: { 'RequestVerificationToken': token },
            beforeSend: function () {
                $('#ocrForm button[type="submit"]').prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xử lý...');
            },
            success: function (result) {
                if (result.success) {
                    toastr.success(result.message || 'Tạo GPLĐ thành công');
                    setTimeout(function () {
                        window.location.href = '/WorkPermit/Issued';
                    }, 1500);
                } else {
                    toastr.error(result.message || 'Lỗi khi tạo GPLĐ');
                    $('#ocrForm button[type="submit"]').prop('disabled', false).html('<i class="fas fa-check"></i> Xác nhận và tạo GPLĐ');
                }
            },
            error: function () {
                toastr.error('Lỗi kết nối khi xác nhận OCR');
                $('#ocrForm button[type="submit"]').prop('disabled', false).html('<i class="fas fa-check"></i> Xác nhận và tạo GPLĐ');
            }
        });
    }
});

// PDF.js Functions
function loadPdf(url) {
    pdfjsLib.getDocument(url).promise.then(function (pdfDoc_) {
        pdfDoc = pdfDoc_;
        document.getElementById('pageCount').textContent = pdfDoc.numPages;
        renderPage(pageNum);
    }).catch(function (error) {
        console.error('Error loading PDF:', error);
        toastr.error('Lỗi khi tải PDF');
    });
}

function renderPage(num) {
    pageRendering = true;
    
    pdfDoc.getPage(num).then(function (page) {
        var viewport = page.getViewport({ scale: scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        var renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        var renderTask = page.render(renderContext);

        renderTask.promise.then(function () {
            pageRendering = false;
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });

    document.getElementById('pageNum').textContent = num;
    updatePageButtons();
}

function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

function onPrevPage() {
    if (pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
}

function onNextPage() {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
}

function updatePageButtons() {
    document.getElementById('btnPrevPage').disabled = (pageNum <= 1);
    document.getElementById('btnNextPage').disabled = (pageNum >= pdfDoc.numPages);
}

// Attach button events
document.getElementById('btnPrevPage').addEventListener('click', onPrevPage);
document.getElementById('btnNextPage').addEventListener('click', onNextPage);
