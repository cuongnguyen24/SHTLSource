(function () {
    'use strict';

    const hoSoId = window.location.pathname.split('/').pop();

    function loadFiles() {
        $.ajax({
            url: `/api/v1/giay-phep-moi-truong/${hoSoId}/files-dinh-kem`,
            type: 'GET',
            headers: { 'Authorization': `Bearer ${getAuthToken()}` },
            success: function (result) {
                if (result.isSuccess && result.data) {
                    const rows = result.data.map(f => `
                        <tr>
                            <td>${f.tenFile}</td>
                            <td>${f.contentType}</td>
                            <td>${formatBytes(f.kichThuoc)}</td>
                            <td>${new Date(f.uploadedAt).toLocaleDateString('vi-VN')}</td>
                            <td><a href="#" class="btn btn-sm btn-primary">Tải</a></td>
                        </tr>
                    `).join('');
                    $('#filesBody').html(rows || '<tr><td colspan="5" class="text-center">Chưa có tài liệu</td></tr>');
                }
            }
        });
    }

    function loadExportHistory() {
        $.ajax({
            url: `/api/v1/giay-phep-moi-truong/${hoSoId}/lich-su-xuat`,
            type: 'GET',
            headers: { 'Authorization': `Bearer ${getAuthToken()}` },
            success: function (result) {
                if (result.isSuccess && result.data) {
                    const html = result.data.map(h => `
                        <div class="export-item">
                            <strong>${new Date(h.exportedAt).toLocaleString('vi-VN')}</strong> - ${h.exportedBy}
                        </div>
                    `).join('');
                    $('#exportHistory').html(html || '<p class="text-muted">Chưa có lần xuất nào</p>');
                }
            }
        });
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    function getAuthToken() {
        // Get JWT token from localStorage or cookie
        return localStorage.getItem('authToken') || '';
    }

    $(document).ready(function () {
        // Load data for all tabs
        loadFiles();
        loadExportHistory();

        // Action buttons
        $('#btnReview').on('click', function () {
            showReviewModal();
        });

        $('#btnExport').on('click', function () {
            showExportModal();
        });

        $('#btnUploadPdf').on('click', function () {
            showUploadModal();
        });

        $('#btnExportDraft').on('click', function () {
            exportDraft();
        });
    });

    window.showReviewModal = function () {
        const html = `
            <div class="modal fade" id="reviewModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Ghi nhận thẩm định</h5>
                            <button type="button" class="close" data-dismiss="modal">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label>Kết quả thẩm định *</label>
                                <select id="ketQua" class="form-control">
                                    <option value="">-- Chọn --</option>
                                    <option value="Dat">Đạt</option>
                                    <option value="KhongDat">Không đạt</option>
                                    <option value="YcBoSung">Yêu cầu bổ sung</option>
                                </select>
                            </div>
                            <div class="form-group" id="lyDoGroup" style="display:none;">
                                <label>Lý do</label>
                                <textarea id="lyDo" class="form-control" rows="3"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Hủy</button>
                            <button type="button" class="btn btn-primary" id="btnSubmitReview">Ghi nhận</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('body').append(html);
        $('#reviewModal').modal('show');

        $('#ketQua').on('change', function () {
            $('#lyDoGroup').toggle($(this).val() !== 'Dat');
        });

        $('#btnSubmitReview').on('click', function () {
            const request = {
                ketQua: $('#ketQua').val(),
                lyDo: $('#lyDo').val(),
                version: window.detailData.version
            };

            $.ajax({
                url: `/GiayPhepMoiTruong/ThamDinh/${hoSoId}`,
                type: 'POST',
                headers: { 'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') },
                data: JSON.stringify(request),
                contentType: 'application/json',
                success: function (result) {
                    if (result.success) {
                        toastr.success('Ghi nhận thẩm định thành công');
                        $('#reviewModal').modal('hide');
                        location.reload();
                    } else {
                        toastr.error(result.message || 'Có lỗi xảy ra');
                    }
                },
                error: function () {
                    toastr.error('Không thể kết nối');
                }
            });
        });
    };

    window.showExportModal = function () {
        // Similar to review modal
        toastr.info('Chức năng xuất đang được phát triển');
    };

    window.showUploadModal = function () {
        // Similar to review modal
        toastr.info('Chức năng tải lên đang được phát triển');
    };

    window.exportDraft = function () {
        toastr.info('Chức năng xuất dự thảo đang được phát triển');
    };

    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : '';
    }

})();
