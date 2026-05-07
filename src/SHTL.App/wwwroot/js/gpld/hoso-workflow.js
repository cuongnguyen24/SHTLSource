/**
 * hoso-workflow.js — HoSo GPLĐ Detail Workflow actions
 * Handles: Ineligible status, Export GPLĐ, OCR workflow
 * Namespace: HoSoWorkflow
 */
window.HoSoWorkflow = (function () {
    'use strict';

    function initWorkflowActions() {
        const hosoId = getHoSoId();
        if (!hosoId) return;

        // --- 1. KHÔNG ĐỦ ĐIỀU KIỆN ---
        $('#btnIneligible').on('click', function () {
            const maHoSo = $('#maHoSoLabel').text().trim() || 'Hồ sơ';
            const hoTen = $('#hoTenLabel').text().trim() || '';

            const html = `
                <div class="text-left">
                    <div class="p-3 mb-3" style="background:#fff1f2; border:1px solid #fecaca; border-radius:12px;">
                        <div class="font-weight-bold" style="color:#991b1b; font-size:14px; text-transform:uppercase;">${maHoSo} – ${hoTen}</div>
                        <div style="color:#b91c1c; font-size:13px; margin-top:4px;">
                            Trạng thái sẽ chuyển thành <strong>"Không đủ điều kiện"</strong> – đây là trạng thái cuối, <u>không thể hoàn tác</u> trừ khi tạo hồ sơ mới.
                        </div>
                    </div>
                    <label class="font-weight-bold mb-2" style="font-size:13px; color:#374151;">Lý do từ chối <span class="text-danger">*</span></label>
                    <textarea id="ineligibleReason" class="input-figma" style="height:100px; padding:12px;" placeholder="Nhập lý do từ chối hồ sơ..."></textarea>
                </div>
            `;

            Swal.fire({
                title: '<i class="fas fa-exclamation-triangle mr-2"></i>Không đủ điều kiện',
                html: html,
                showCancelButton: true,
                confirmButtonText: 'Xác nhận từ chối',
                cancelButtonText: 'Hủy',
                customClass: { confirmButton: 'btn-figma btn-figma-danger px-4', cancelButton: 'btn-figma btn-figma-outline px-4' },
                buttonsStyling: false,
                preConfirm: () => {
                    const reason = $('#ineligibleReason').val();
                    if (!reason || reason.trim().length < 10) {
                        Swal.showValidationMessage('Vui lòng nhập lý do tối thiểu 10 ký tự');
                        return false;
                    }
                    return reason;
                }
            }).then((result) => {
                if (result.isConfirmed) updateStatus(hosoId, 'KhongDuDieuKien', result.value);
            });
        });

        // --- 2. EXPORT GPLĐ ---
        $('#btnExportGPLD').on('click', function () {
            const ksqtTemplate = $('#ksqtTemplateSelect').val() || 'KSQT_CAP_MOI_D18';
            const html = `
                <div class="text-left">
                    <div class="p-3 mb-3" style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px;">
                        <div class="font-weight-bold mb-1" style="color:#1e40af; font-size:14px;"><i class="far fa-file-alt mr-2"></i>Sẽ export 2 file .docx:</div>
                        <div style="color:#1d4ed8; font-size:13px;">1. Mẫu GPLĐ số 01<br/>2. Phiếu KSQT</div>
                    </div>
                </div>
            `;
            Swal.fire({ title: 'Export GPLĐ', html: html, showCancelButton: true, confirmButtonText: 'Xác nhận Export', customClass: { confirmButton: 'btn-figma btn-figma-primary px-4', cancelButton: 'btn-figma btn-figma-outline px-4' }, buttonsStyling: false })
                .then((result) => {
                    if (result.isConfirmed) {
                        window.location.href = `/HoSoGiayPhep/ExportGPLDBundle/${hosoId}?ksqtTemplateType=${encodeURIComponent(ksqtTemplate)}`;
                        setTimeout(() => window.location.reload(), 3000);
                    }
                });
        });

        // --- 3. EXPORT PHIẾU KSQT (.docx) ---
        $('#btnExportKSQT').on('click', function () {
            const ksqtTemplate = $('#ksqtTemplateSelect').val() || '';
            
            Swal.fire({
                title: 'Xuất Phiếu KSQT',
                text: 'Bạn muốn tải xuống Phiếu Kiểm soát Quy trình (.docx)?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Tải xuống',
                cancelButtonText: 'Hủy',
                customClass: {
                    confirmButton: 'btn-figma btn-figma-primary px-4',
                    cancelButton: 'btn-figma btn-figma-outline px-4'
                },
                buttonsStyling: false
            }).then((result) => {
                if (result.isConfirmed) {
                    toastr.info('Đang chuẩn bị tệp tin .docx...');
                    const url = `/HoSoGiayPhep/ExportKSQT/${hosoId}?templateType=${encodeURIComponent(ksqtTemplate)}`;
                    window.location.href = url;
                }
            });
        });

        // --- 4. UPLOAD & OCR ---
        $('#btnOpenUploadOCR').on('click', function () {
            // Note: This should be overridden or handled in the view where @Model is available
            // but for safety, we keep the trigger.
            if (typeof openUploadModal === 'function') openUploadModal();
        });
    }

    function openUploadModal(forcedId, maHoSoVal, hoTenVal, loaiNVVal, trangThaiVal) {
        const hosoId = forcedId || getHoSoId();
        const maHoSo = maHoSoVal || $('#maHoSoLabel').text().trim() || 'Hồ sơ';
        const hoTen = hoTenVal || $('#hoTenLabel').text().trim() || '';
        const loaiNV = loaiNVVal || $('.badge-figma').first().text().trim() || '—';
        const trangThai = trangThaiVal || '🟠 Chờ ký số';
        
        // Determine badge color based on status text
        let statusClass = 'info';
        if (trangThai.includes('ký số') || trangThai.includes('thẩm định')) statusClass = 'warning';
        if (trangThai.includes('lực') || trangThai.includes('ký')) statusClass = 'success';
        if (trangThai.includes('thu hồi') || trangThai.includes('không')) statusClass = 'danger';

        let selectedFile = null;

        const html = `
            <div class="text-left">
                <div class="row mb-3">
                    <div class="col-md-6"><label class="text-muted small mb-1">Mã hồ sơ</label><input type="text" class="input-figma bg-light" value="${maHoSo}" readonly /></div>
                    <div class="col-md-6"><label class="text-muted small mb-1">Họ tên NLĐ</label><input type="text" class="input-figma bg-light" value="${hoTen}" readonly /></div>
                </div>
                <div class="row mb-4">
                    <div class="col-md-6"><label class="text-muted small mb-1">Nghiệp vụ</label><div><span class="badge-figma badge-figma-primary">${loaiNV}</span></div></div>
                    <div class="col-md-6"><label class="text-muted small mb-1">Trạng thái</label><div><span class="status-pill status-pill-${statusClass}" style="font-size:11px;">${trangThai}</span></div></div>
                </div>
                <h6 class="font-weight-bold mb-3" style="font-size:14px;"><i class="fas fa-file-upload mr-2 text-muted"></i>Upload file PDF đã ký số</h6>
                <div id="dropzoneOCR" class="p-5 text-center" style="border:2px dashed #cbd5e1; border-radius:12px; background:#f8fafc; cursor:pointer;">
                    <i class="fas fa-file-pdf fa-3x text-muted mb-3"></i>
                    <div class="text-muted"><span class="text-primary font-weight-bold">chọn file</span> hoặc kéo thả vào đây</div>
                    <div class="text-muted small mt-1">Chỉ nhận .pdf | Tối đa 20MB</div>
                </div>
                <input type="file" id="fileOCR" style="display:none;" accept="application/pdf" />
                <div id="fileListOCR" class="mt-3"></div>
            </div>
        `;

        Swal.fire({
            title: 'Quy trình Cập nhật kết quả ký',
            html: html,
            width: '700px',
            showCancelButton: true,
            confirmButtonText: 'Upload & Chạy OCR',
            customClass: { confirmButton: 'btn-figma btn-figma-primary px-4', cancelButton: 'btn-figma btn-figma-outline px-4' },
            buttonsStyling: false,
            didOpen: (modal) => {
                const $modal = $(modal);
                $modal.find('#dropzoneOCR').on('click', () => $modal.find('#fileOCR').click());
                $modal.find('#fileOCR').on('change', function () {
                    const file = this.files[0];
                    selectedFile = file || null;
                    if (file) {
                        $modal.find('#fileListOCR').html(`
                            <div class="alert alert-success d-flex align-items-center py-2 px-3 small">
                                <i class="fas fa-file-pdf mr-2"></i><b>${file.name}</b> (${(file.size / 1024 / 1024).toFixed(1)}MB)
                            </div>
                        `);
                    }
                });
            },
            preConfirm: () => {
                if (!selectedFile) { Swal.showValidationMessage('Vui lòng chọn file PDF'); return false; }
                return selectedFile;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const formData = new FormData();
                formData.append('id', hosoId);
                formData.append('file', result.value);
                submitOCR(formData);
            }
        });
    }

    function submitOCR(formData) {
        let token = $('input[name="__RequestVerificationToken"]').first().val();
        if (token) formData.append('__RequestVerificationToken', token);

        Swal.fire({ title: 'Đang upload...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        $.ajax({
            url: '/HoSoGiayPhep/UploadSignedFile',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: (data) => {
                if (data.success) {
                    Swal.fire({ icon: 'success', title: 'Thành công', timer: 1000, showConfirmButton: false }).then(() => { window.location.href = data.redirectUrl; });
                } else Swal.fire({ icon: 'error', title: 'Lỗi', text: data.message });
            },
            error: () => Swal.fire({ icon: 'error', title: 'Lỗi link server' })
        });
    }

    function getHoSoId() {
        const path = window.location.pathname;
        const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
        const pathParts = normalizedPath.split('/');
        return pathParts[pathParts.length - 1];
    }

    function updateStatus(id, status, reason) {
        const token = $('input[name="__RequestVerificationToken"]').first().val();
        $.post('/HoSoGiayPhep/UpdateStatus', { id: id, status: status, reason: reason, __RequestVerificationToken: token }, (res) => {
            if (res.success) { toastr.success('Thành công'); setTimeout(() => window.location.reload(), 500); }
            else toastr.error(res.message);
        });
    }

    $(function () {
        if (window.location.pathname.toLowerCase().includes('/hosogiayphep/details/')) {
            initWorkflowActions();
        }
    });

    function submitRevoking(requestData) {
        const token = $('input[name="__RequestVerificationToken"]').first().val();

        Swal.fire({ 
            title: 'Đang xử lý...', 
            allowOutsideClick: false, 
            didOpen: () => Swal.showLoading() 
        });

        $.ajax({
            url: '/HoSoGiayPhep/ThuHoiGPLD',
            type: 'POST',
            contentType: 'application/json',
            headers: {
                'RequestVerificationToken': token || ''
            },
            data: JSON.stringify(requestData),
            success: (data) => {
                if (data.success) {
                    Swal.fire({ 
                        icon: 'success', 
                        title: 'Đã thu hồi thành công', 
                        timer: 1500, 
                        showConfirmButton: false 
                    }).then(() => { 
                        window.location.reload(); 
                    });
                } else {
                    Swal.fire({ 
                        icon: 'error', 
                        title: 'Lỗi', 
                        text: data.message || 'Không thể thu hồi GPLĐ' 
                    });
                }
            },
            error: (xhr) => {
                const errorMsg = xhr.responseJSON?.message || 'Lỗi kết nối server';
                Swal.fire({ 
                    icon: 'error', 
                    title: 'Lỗi', 
                    text: errorMsg 
                });
            }
        });
    }

    return {
        initWorkflowActions: initWorkflowActions,
        openUploadModal: openUploadModal,
        submitRevoking: submitRevoking
    };

})();
