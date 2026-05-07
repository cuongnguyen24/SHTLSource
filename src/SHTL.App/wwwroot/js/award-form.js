// Award Form JavaScript (for Create & Edit views)
$(document).ready(function () {
    // Date picker initialization
    $('input[type="date"]').attr('max', new Date().toISOString().split('T')[0]);

    // File upload handling
    $('#fileUpload').on('change', function () {
        var file = this.files[0];
        if (!file) return;

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            toastr.error('Kích thước file không được vượt quá 10MB');
            $(this).val('');
            return;
        }

        // Validate file type
        var allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
        if (allowedTypes.indexOf(file.type) === -1) {
            toastr.error('Chỉ chấp nhận file PDF, DOCX, JPG, PNG');
            $(this).val('');
            return;
        }

        // Upload file to server
        uploadFile(file);
    });

    function uploadFile(file) {
        var formData = new FormData();
        formData.append('file', file);
        
        // Optional: pass enterpriseCode if available in a hidden field
        var enterpriseCode = $('#enterpriseCode').val() || 'SYSTEM';
        formData.append('enterpriseCode', enterpriseCode);

        // Show loading
        var loadingToast = toastr.info('Đang tải file lên...', '', { timeOut: 0, extendedTimeOut: 0 });

        $.ajax({
            url: '/File/Upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (response) {
                toastr.clear(loadingToast);
                if (response.isSuccess && response.data) {
                    $('#attachmentFileId').val(response.data.id);
                    toastr.success('Tải file lên thành công');
                    
                    // Optional: Show filename
                    $('#fileUploadName').text(file.name).show();
                } else {
                    toastr.error(response.message || 'Tải file lên thất bại');
                }
            },
            error: function () {
                toastr.clear(loadingToast);
                toastr.error('Lỗi khi tải file lên');
            }
        });
    }

    // Form validation
    $('form').validate({
        rules: {
            Category: { required: true },
            AwardType: { required: true, maxlength: 100 },
            Level: { required: true },
            IssuingAuthority: { required: true, maxlength: 200 },
            DecisionNumber: { required: true, maxlength: 100 },
            DecisionDate: { required: true },
            Reason: { required: true, maxlength: 500 },
            Notes: { maxlength: 2000 }
        },
        messages: {
            Category: { required: 'Vui lòng chọn lĩnh vực' },
            AwardType: { required: 'Vui lòng nhập loại khen thưởng', maxlength: 'Tối đa 100 ký tự' },
            Level: { required: 'Vui lòng chọn cấp khen thưởng' },
            IssuingAuthority: { required: 'Vui lòng nhập cơ quan ban hành', maxlength: 'Tối đa 200 ký tự' },
            DecisionNumber: { required: 'Vui lòng nhập số quyết định', maxlength: 'Tối đa 100 ký tự' },
            DecisionDate: { required: 'Vui lòng chọn ngày quyết định' },
            Reason: { required: 'Vui lòng nhập lý do khen thưởng', maxlength: 'Tối đa 500 ký tự' },
            Notes: { maxlength: 'Tối đa 2000 ký tự' }
        },
        errorElement: 'span',
        errorPlacement: function (error, element) {
            error.addClass('text-danger');
            error.insertAfter(element);
        }
    });
});
