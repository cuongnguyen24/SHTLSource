// Wizard Auto-Save JavaScript
var saveDebounceTimer;
var saveIndicator = '<span class="badge badge-info ml-2"><i class="fas fa-spinner fa-spin"></i> Đang lưu...</span>';
var savedIndicator = '<span class="badge badge-success ml-2"><i class="fas fa-check"></i> Đã lưu</span>';

$(document).ready(function () {
    // Attach blur events for auto-save
    $('#step1Content input, #step1Content select, #step1Content textarea').on('blur', function () {
        debounceSave(saveStep1);
    });

    $('#step2Content input, #step2Content select, #step2Content textarea, #step2Content input[type="checkbox"]').on('blur change', function () {
        debounceSave(saveStep2);
    });

    $('#step3Content input, #step3Content select, #step3Content textarea').on('blur', function () {
        debounceSave(saveStep3);
    });
});

function debounceSave(saveFunction) {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(function () {
        saveFunction();
    }, 2000); // 2 second debounce
}

function saveStep1() {
    // Create application if not exists
    if (!applicationId) {
        createWizardApplication();
    } else {
        updateWizardStep(1);
    }
}

function saveStep2() {
    if (!applicationId) {
        toastr.warning('Vui lòng hoàn thành Bước 1 trước');
        return;
    }
    updateWizardStep(2);
}

function saveStep3() {
    if (!applicationId) {
        toastr.warning('Vui lòng hoàn thành Bước 1 trước');
        return;
    }
    updateWizardStep(3);
}

function createWizardApplication() {
    var data = {
        enterpriseId: enterpriseId,
        category: $('#step1_category').val(),
        year: parseInt($('#step1_year').val()) || 0,
        title: $('#step1_title').val(),
        level: $('#step1_level').val(),
        issuingAuthority: $('#step1_issuingAuthority').val(),
        reason: $('#step1_reason').val()
    };

    // Validate required fields
    if (!data.category || !data.year || !data.title || !data.level || !data.issuingAuthority || !data.reason) {
        return; // Skip auto-save if required fields missing
    }

    showSaveIndicator();

    $.ajax({
        url: '/Award/CreateWizardApplication',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function (response) {
            if (response.isSuccess && response.data) {
                applicationId = response.data.id;
                window.wizardConfig.applicationId = applicationId;
                showSavedIndicator();
                toastr.success('Đã tạo hồ sơ');
            } else {
                hideSaveIndicator();
            }
        },
        error: function () {
            hideSaveIndicator();
            toastr.error('Lỗi khi tạo hồ sơ');
        }
    });
}

function updateWizardStep(stepNo) {
    var stepData = {};

    if (stepNo === 1) {
        stepData = {
            category: $('#step1_category').val(),
            year: parseInt($('#step1_year').val()) || 0,
            title: $('#step1_title').val(),
            level: $('#step1_level').val(),
            issuingAuthority: $('#step1_issuingAuthority').val(),
            decisionNumber: $('#step1_decisionNumber').val(),
            reason: $('#step1_reason').val()
        };
    } else if (stepNo === 2) {
        stepData = {
            revenueGrowth: parseFloat($('#step2_revenueGrowth').val()) || null,
            profitGrowth: parseFloat($('#step2_profitGrowth').val()) || null,
            taxGrowth: parseFloat($('#step2_taxGrowth').val()) || null,
            newJobs: parseInt($('#step2_newJobs').val()) || null,
            exportValue: parseFloat($('#step2_exportValue').val()) || null,
            investExpand: parseFloat($('#step2_investExpand').val()) || null,
            noEnvViolation: $('#step2_noEnvViolation').is(':checked'),
            noLaborViolation: $('#step2_noLaborViolation').is(':checked'),
            taxCompliance: $('#step2_taxCompliance').is(':checked'),
            reportCompliance: $('#step2_reportCompliance').is(':checked'),
            charityAmount: parseFloat($('#step2_charityAmount').val()) || null,
            laborWelfare: $('#step2_laborWelfare').val(),
            achievementNote: $('#step2_achievementNote').val()
        };
    } else if (stepNo === 3) {
        stepData = {
            grading: $('#step3_grading').val(),
            examinerNote: $('#step3_examinerNote').val(),
            examinerResult: $('#step3_examinerResult').val(),
            examinerName: $('#step3_examinerName').val(),
            examinerDate: $('#step3_examinerDate').val() ? new Date($('#step3_examinerDate').val()).toISOString() : null
        };
    }

    showSaveIndicator();

    $.ajax({
        url: '/Award/UpdateWizardStep',
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({
            id: applicationId,
            enterpriseId: enterpriseId,
            stepNo: stepNo,
            stepData: stepData
        }),
        success: function (response) {
            if (response.isSuccess) {
                showSavedIndicator();
            } else {
                hideSaveIndicator();
            }
        },
        error: function () {
            hideSaveIndicator();
        }
    });
}

function showSaveIndicator() {
    $('.card-title .badge').remove();
    $('.card-title').append(saveIndicator);
}

function showSavedIndicator() {
    $('.card-title .badge').remove();
    $('.card-title').append(savedIndicator);
    setTimeout(function () {
        hideSaveIndicator();
    }, 2000);
}

function hideSaveIndicator() {
    $('.card-title .badge').remove();
}
