// Wizard Stepper JavaScript
var currentStep = 1;
var applicationId = window.wizardConfig.applicationId || null;
var enterpriseId = window.wizardConfig.enterpriseId;
var mode = window.wizardConfig.mode || 'Create';

$(document).ready(function () {
    // Initialize date max
    $('#step3_examinerDate').attr('max', new Date().toISOString().split('T')[0]);

    // Load existing data if Edit mode
    if (mode === 'Edit' && applicationId) {
        loadWizardData();
    }

    // Next button handler
    $('#btnNext').on('click', function () {
        if (validateCurrentStep()) {
            // Auto-save current step
            autoSaveCurrentStep();
            
            // Move to next step
            currentStep++;
            if (currentStep > 4) currentStep = 4;
            showStep(currentStep);
        }
    });

    // Previous button handler
    $('#btnPrevious').on('click', function () {
        currentStep--;
        if (currentStep < 1) currentStep = 1;
        showStep(currentStep);
    });

    // Submit button handler
    $('#btnSubmit').on('click', function () {
        submitWizard();
    });
});

function showStep(step) {
    // Hide all steps
    $('.step-content').removeClass('active');
    $('.step-item').removeClass('active completed');

    // Show current step content
    $('#step' + step + 'Content').addClass('active');

    // Update stepper UI
    for (var i = 1; i <= 4; i++) {
        if (i < step) {
            $('.step-item[data-step="' + i + '"]').addClass('completed');
        } else if (i === step) {
            $('.step-item[data-step="' + i + '"]').addClass('active');
        }
    }

    // Update progress bar
    var progress = (step / 4) * 100;
    $('#wizardProgress').css('width', progress + '%');

    // Update navigation buttons
    if (step === 1) {
        $('#btnPrevious').hide();
    } else {
        $('#btnPrevious').show();
    }

    if (step === 4) {
        $('#btnNext').hide();
        $('#btnSubmit').show();
        loadReviewData();
    } else {
        $('#btnNext').show();
        $('#btnSubmit').hide();
    }

    currentStep = step;
}

function validateCurrentStep() {
    var errors = [];

    if (currentStep === 1) {
        if (!$('#step1_category').val()) errors.push('Vui lòng chọn lĩnh vực');
        if (!$('#step1_year').val()) errors.push('Vui lòng nhập năm');
        if (!$('#step1_title').val()) errors.push('Vui lòng nhập danh hiệu');
        if (!$('#step1_level').val()) errors.push('Vui lòng chọn cấp');
        if (!$('#step1_issuingAuthority').val()) errors.push('Vui lòng nhập cơ quan ban hành');
        if (!$('#step1_reason').val()) errors.push('Vui lòng nhập lý do');
    } else if (currentStep === 2) {
        // Step 2: At least 3 metrics OR 2 compliance checkboxes
        var metricsCount = 0;
        if ($('#step2_revenueGrowth').val()) metricsCount++;
        if ($('#step2_profitGrowth').val()) metricsCount++;
        if ($('#step2_taxGrowth').val()) metricsCount++;
        if ($('#step2_newJobs').val()) metricsCount++;
        if ($('#step2_exportValue').val()) metricsCount++;
        if ($('#step2_investExpand').val()) metricsCount++;

        var complianceCount = 0;
        if ($('#step2_noEnvViolation').is(':checked')) complianceCount++;
        if ($('#step2_noLaborViolation').is(':checked')) complianceCount++;
        if ($('#step2_taxCompliance').is(':checked')) complianceCount++;
        if ($('#step2_reportCompliance').is(':checked')) complianceCount++;

        if (metricsCount < 3 && complianceCount < 2) {
            errors.push('Vui lòng nhập ít nhất 3 chỉ tiêu HOẶC chọn 2 mục tuân thủ');
        }
    } else if (currentStep === 3) {
        if (!$('#step3_grading').val()) errors.push('Vui lòng chọn mức đánh giá');
        if (!$('#step3_examinerNote').val()) errors.push('Vui lòng nhập nhận xét');
        if (!$('#step3_examinerResult').val()) errors.push('Vui lòng chọn kết quả xét duyệt');
    }

    if (errors.length > 0) {
        toastr.error(errors.join('<br/>'));
        return false;
    }

    return true;
}

function autoSaveCurrentStep() {
    if (currentStep === 1) {
        saveStep1();
    } else if (currentStep === 2) {
        saveStep2();
    } else if (currentStep === 3) {
        saveStep3();
    }
}

function loadWizardData() {
    $.ajax({
        url: '/Award/GetWizardReviewData',
        type: 'GET',
        data: { id: applicationId, enterpriseId: enterpriseId },
        success: function (response) {
            if (response.isSuccess && response.data) {
                var data = response.data;
                // Populate Step 1
                $('#step1_category').val(data.category);
                $('#step1_year').val(data.year);
                $('#step1_title').val(data.title);
                $('#step1_level').val(data.level);
                $('#step1_issuingAuthority').val(data.issuingAuthority);
                $('#step1_decisionNumber').val(data.decisionNumber);
                $('#step1_reason').val(data.reason);

                // Populate Step 2
                $('#step2_revenueGrowth').val(data.revenueGrowth);
                $('#step2_profitGrowth').val(data.profitGrowth);
                $('#step2_taxGrowth').val(data.taxGrowth);
                $('#step2_newJobs').val(data.newJobs);
                $('#step2_exportValue').val(data.exportValue);
                $('#step2_investExpand').val(data.investExpand);
                $('#step2_noEnvViolation').prop('checked', data.noEnvViolation);
                $('#step2_noLaborViolation').prop('checked', data.noLaborViolation);
                $('#step2_taxCompliance').prop('checked', data.taxCompliance);
                $('#step2_reportCompliance').prop('checked', data.reportCompliance);
                $('#step2_charityAmount').val(data.charityAmount);
                $('#step2_laborWelfare').val(data.laborWelfare);
                $('#step2_achievementNote').val(data.achievementNote);

                // Populate Step 3
                $('#step3_grading').val(data.grading);
                $('#step3_examinerNote').val(data.examinerNote);
                $('#step3_examinerResult').val(data.examinerResult);
                $('#step3_examinerName').val(data.examinerName);
                if (data.examinerDate) {
                    $('#step3_examinerDate').val(moment(data.examinerDate).format('YYYY-MM-DD'));
                }
            }
        },
        error: function () {
            toastr.error('Lỗi khi tải dữ liệu');
        }
    });
}

function loadReviewData() {
    $('#reviewData').html('<p class="text-muted">Đang tải...</p>');

    $.ajax({
        url: '/Award/GetWizardReviewData',
        type: 'GET',
        data: { id: applicationId, enterpriseId: enterpriseId },
        success: function (response) {
            if (response.isSuccess && response.data) {
                var data = response.data;
                var html = '<table class="table table-bordered">';
                html += '<tr><th colspan="2" class="bg-primary text-white">Thông tin doanh nghiệp</th></tr>';
                html += '<tr><td><strong>Tên DN:</strong></td><td>' + (data.enterpriseName || '') + '</td></tr>';
                html += '<tr><td><strong>Mã số thuế:</strong></td><td>' + (data.taxCode || '') + '</td></tr>';
                html += '<tr><td><strong>Địa chỉ:</strong></td><td>' + (data.address || '') + '</td></tr>';
                html += '<tr><th colspan="2" class="bg-info text-white">Bước 1: Thông tin cơ bản</th></tr>';
                html += '<tr><td><strong>Lĩnh vực:</strong></td><td>' + (data.category || '') + '</td></tr>';
                html += '<tr><td><strong>Năm:</strong></td><td>' + (data.year || '') + '</td></tr>';
                html += '<tr><td><strong>Danh hiệu:</strong></td><td>' + (data.title || '') + '</td></tr>';
                html += '<tr><td><strong>Cấp:</strong></td><td>' + (data.level || '') + '</td></tr>';
                html += '<tr><td><strong>Lý do:</strong></td><td>' + (data.reason || '') + '</td></tr>';
                html += '<tr><th colspan="2" class="bg-success text-white">Bước 2: Thành tích</th></tr>';
                html += '<tr><td><strong>Tăng trưởng DT:</strong></td><td>' + (data.revenueGrowth || 0) + '%</td></tr>';
                html += '<tr><td><strong>Tăng trưởng LN:</strong></td><td>' + (data.profitGrowth || 0) + '%</td></tr>';
                html += '<tr><td><strong>Tuân thủ MT:</strong></td><td>' + (data.noEnvViolation ? 'Có' : 'Không') + '</td></tr>';
                html += '<tr><th colspan="2" class="bg-warning">Bước 3: Đánh giá</th></tr>';
                html += '<tr><td><strong>Mức đánh giá:</strong></td><td>' + (data.grading || '') + '</td></tr>';
                html += '<tr><td><strong>Kết quả:</strong></td><td>' + (data.examinerResult || '') + '</td></tr>';
                html += '</table>';
                $('#reviewData').html(html);
            } else {
                $('#reviewData').html('<p class="text-danger">Không thể tải dữ liệu</p>');
            }
        },
        error: function () {
            $('#reviewData').html('<p class="text-danger">Lỗi khi tải dữ liệu</p>');
        }
    });
}

function submitWizard() {
    if (!applicationId) {
        toastr.error('Không tìm thấy ID hồ sơ');
        return;
    }

    if (!confirm('Bạn có chắc chắn muốn hoàn tất hồ sơ?')) return;

    $.ajax({
        url: '/Award/FinalizeWizardApplication',
        type: 'POST',
        data: { id: applicationId, enterpriseId: enterpriseId },
        success: function (response) {
            if (response.isSuccess) {
                toastr.success('Hoàn tất hồ sơ thành công');
                setTimeout(function () {
                    window.location.href = '/Award/Index';
                }, 1500);
            } else {
                toastr.error(response.message || 'Hoàn tất thất bại');
            }
        },
        error: function () {
            toastr.error('Lỗi khi hoàn tất hồ sơ');
        }
    });
}
