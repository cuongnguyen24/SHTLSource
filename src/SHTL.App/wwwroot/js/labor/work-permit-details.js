// work-permit-details.js - Work Permit Application Details page
$(document).ready(function () {
    var applicationId = window.applicationId;

    // Tab navigation handling
    $('#detailTabs a').on('click', function (e) {
        e.preventDefault();
        $(this).tab('show');
    });

    // Check URL hash for direct tab navigation
    var hash = window.location.hash;
    if (hash) {
        $('#detailTabs a[href="' + hash + '"]').tab('show');
    }

    // Validate button click
    $('#btnValidate').on('click', function () {
        var btn = $(this);
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang kiểm tra...');

        $.ajax({
            url: '/WorkPermit/Validate/' + applicationId,
            type: 'POST',
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (response) {
                if (response.success && response.data) {
                    displayValidationResults(response.data);
                    toastr.success('Kiểm tra điều kiện thành công');
                } else {
                    toastr.error(response.message || 'Lỗi khi kiểm tra điều kiện');
                    $('#validationResults').html('<p class="text-danger">Không thể kiểm tra điều kiện</p>');
                }
            },
            error: function () {
                toastr.error('Lỗi kết nối khi kiểm tra điều kiện');
                $('#validationResults').html('<p class="text-danger">Lỗi kết nối</p>');
            },
            complete: function () {
                btn.prop('disabled', false).html('<i class="fas fa-check-circle"></i> Kiểm tra điều kiện');
            }
        });
    });

    // Display validation results
    function displayValidationResults(data) {
        var html = '<div class="validation-results">';
        
        if (data.rules && data.rules.length > 0) {
            data.rules.forEach(function (rule) {
                var passed = rule.status === 'Pass' || rule.status === 'Warning';
                var iconClass = passed ? 'fa-check-circle text-success' : 'fa-times-circle text-danger';
                var cardClass = passed ? 'border-success' : (rule.isBlocking ? 'border-danger' : 'border-warning');
                
                html += '<div class="card mb-2 ' + cardClass + '">';
                html += '<div class="card-body p-2">';
                html += '<h6><i class="fas ' + iconClass + '"></i> ' + (rule.code || '') + '</h6>';
                html += '<p class="mb-1 small">' + (rule.name || '') + '</p>';
                html += '<p class="mb-0 small text-muted">' + (rule.message || '') + '</p>';
                if (rule.suggestion) {
                    html += '<p class="mb-0 small text-info"><i class="fas fa-lightbulb"></i> ' + rule.suggestion + '</p>';
                }
                html += '</div></div>';
            });
        }

        // Overall status based on canExport
        var overallClass = data.canExport ? 'alert-success' : 'alert-danger';
        var overallIcon = data.canExport ? 'fa-check-circle' : 'fa-exclamation-triangle';
        html += '<div class="alert ' + overallClass + ' mt-3">';
        html += '<i class="fas ' + overallIcon + '"></i> ';
        html += '<strong>' + (data.canExport ? 'Đủ điều kiện xuất văn bản' : 'Chưa đủ điều kiện xuất văn bản') + '</strong>';
        html += '</div>';

        html += '</div>';
        $('#validationResults').html(html);
    }

    // Export document button
    $('#btnExportDocument').on('click', function () {
        var btn = $(this);
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang xuất...');

        window.location.href = '/WorkPermit/ExportDocument/' + applicationId;

        // Re-enable button after 3 seconds
        setTimeout(function () {
            btn.prop('disabled', false).html('<i class="fas fa-file-download"></i> Xuất văn bản');
            toastr.success('Đã tải xuống văn bản thành công');
        }, 3000);
    });

    // Delete button
    $('#btnDelete').on('click', function () {
        $('#deleteModal').modal('show');
    });

    // Confirm delete
    $('#btnConfirmDelete').on('click', function () {
        var reason = $('#deleteReason').val();

        if (!reason || reason.trim().length < 10) {
            toastr.warning('Vui lòng nhập lý do xóa (tối thiểu 10 ký tự)');
            return;
        }

        var token = $('input[name="__RequestVerificationToken"]').val();

        $.ajax({
            url: '/WorkPermit/Delete/' + applicationId,
            type: 'POST',
            headers: { 'RequestVerificationToken': token },
            data: { reason: reason },
            success: function (result) {
                if (result.success) {
                    toastr.success(result.message || 'Xóa hồ sơ thành công');
                    setTimeout(function () {
                        window.location.href = '/WorkPermit/Index';
                    }, 1000);
                } else {
                    toastr.error(result.message || 'Lỗi khi xóa hồ sơ');
                    $('#deleteModal').modal('hide');
                }
            },
            error: function () {
                toastr.error('Lỗi kết nối khi xóa hồ sơ');
                $('#deleteModal').modal('hide');
            }
        });
    });
});
