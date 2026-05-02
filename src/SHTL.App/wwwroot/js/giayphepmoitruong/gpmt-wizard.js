(function () {
    'use strict';

    let currentStep = 1;
    const totalSteps = 3;
    let formData = {};

    function goToStep(step) {
        if (step < 1 || step > totalSteps) return;

        if (step > currentStep && !validateCurrentStep()) return;

        currentStep = step;
        updateUI();
    }

    function validateCurrentStep() {
        if (currentStep === 1) {
            const loaiGpmt = $('#loaiGpmt').val();
            const dnId = $('#dnId').val();
            const kcnId = $('#kcnId').val();

            if (!loaiGpmt) {
                toastr.warning('Vui lòng chọn loại GPMT');
                return false;
            }
            if (!dnId) {
                toastr.warning('Vui lòng chọn doanh nghiệp');
                return false;
            }
            if (!kcnId) {
                toastr.warning('Vui lòng chọn khu công nghiệp');
                return false;
            }

            if (['CapLai', 'CapDoi'].includes(loaiGpmt) && !$('#gpmtGocId').val()) {
                toastr.warning('Vui lòng chọn GPMT gốc');
                return false;
            }

            return true;
        }
        return true;
    }

    function updateUI() {
        // Hide all steps
        $('.wizard-step').removeClass('active');
        $('.progress-step').removeClass('active');

        // Show current step
        $(`#step${currentStep}`).addClass('active');
        $(`#step${currentStep}-indicator`).addClass('active');

        // Update buttons
        $('#btnBack').toggle(currentStep > 1);
        $('#btnNext').toggle(currentStep < totalSteps);
        $('#btnSubmit').toggle(currentStep === totalSteps);
    }

    function initEnterpriseSearch() {
        let searchTimeout;
        $('#dnSearch').on('input', function () {
            clearTimeout(searchTimeout);
            const query = $(this).val();

            if (query.length < 2) {
                $('#dnSearchResults').hide();
                return;
            }

            searchTimeout = setTimeout(() => {
                // Mock search - in real app would call API
                $('#dnSearchResults').html(`
                    <div class="search-item" onclick="selectEnterprise('dn-123', 'Công ty TNHH ABC')">
                        Công ty TNHH ABC
                    </div>
                `).show();
            }, 300);
        });
    }

    function initKcnSelect() {
        // Mock load KCN - in real app would call API
        $.ajax({
            url: '/api/v1/industrial-zones',
            type: 'GET',
            success: function (result) {
                if (result.isSuccess && result.data) {
                    const html = result.data.map(k =>
                        `<option value="${k.id}">${k.name}</option>`
                    ).join('');
                    $('#kcnId').append(html);
                }
            }
        });
    }

    window.selectEnterprise = function (id, name) {
        $('#dnId').val(id);
        $('#dnSearch').val(name);
        $('#dnSearchResults').hide();
    };

    window.selectGpmtGoc = function (id, soGpmt) {
        $('#gpmtGocId').val(id);
        $('#gpmtGocSearch').val(soGpmt);
        $('#gpmtGocSearchResults').hide();
    };

    function updateSummary() {
        const loaiGpmt = $('#loaiGpmt').find('option:selected').text();
        const dnName = $('#dnSearch').val();
        const kcnName = $('#kcnId').find('option:selected').text();

        const html = `
            <div class="summary-item">
                <h6>Loại giấy phép</h6>
                <p>${loaiGpmt}</p>
            </div>
            <div class="summary-item">
                <h6>Doanh nghiệp</h6>
                <p>${dnName}</p>
            </div>
            <div class="summary-item">
                <h6>Khu công nghiệp</h6>
                <p>${kcnName}</p>
            </div>
            <div class="summary-item">
                <h6>Loại hình kinh tế</h6>
                <p>${$('#loaiHinhKinh').val() || '---'}</p>
            </div>
            <div class="summary-item">
                <h6>Công suất</h6>
                <p>${$('#congSuat').val() || '---'}</p>
            </div>
            <div class="summary-item">
                <h6>Lưu lượng nước thải</h6>
                <p>${$('#luuLuongNuoc').val() || '---'}</p>
            </div>
        `;
        $('#summaryContent').html(html);
    }

    function submitForm() {
        const request = {
            loaiGpmt: $('#loaiGpmt').val(),
            dnId: $('#dnId').val(),
            kcnId: $('#kcnId').val(),
            gpmtGocId: $('#gpmtGocId').val() || null,
            loaiHinhKinh: $('#loaiHinhKinh').val(),
            congSuat: $('#congSuat').val(),
            luuLuongNuoc: $('#luuLuongNuoc').val()
        };

        $.ajax({
            url: '/GiayPhepMoiTruong/TaoMoi',
            type: 'POST',
            headers: { 'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') },
            data: JSON.stringify(request),
            contentType: 'application/json',
            success: function (result) {
                if (result.success) {
                    toastr.success('Tạo mới hồ sơ thành công');
                    window.location.href = result.redirectUrl;
                } else {
                    toastr.error(result.message || 'Không thể tạo mới hồ sơ');
                }
            },
            error: function () {
                toastr.error('Không thể kết nối đến máy chủ');
            }
        });
    }

    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : '';
    }

    $(document).ready(function () {
        initEnterpriseSearch();
        initKcnSelect();
        updateUI();

        $('#btnBack').on('click', () => goToStep(currentStep - 1));
        $('#btnNext').on('click', function () {
            if (currentStep === 2) updateSummary();
            goToStep(currentStep + 1);
        });
        $('#btnSubmit').on('click', submitForm);

        // Update summary when moving to step 3
        $('#loaiGpmt, #loaiHinhKinh, #congSuat, #luuLuongNuoc').on('change', updateSummary);
    });

})();
