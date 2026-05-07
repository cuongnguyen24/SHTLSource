/**
 * SuKienQHLD Details — Client JS (IIFE Pattern)
 * Module: M0131 — Quan hệ Lao động
 * Screen: SCR-NV-XL-002 — Chi tiết Sự kiện QHLĐ & Xác nhận
 *
 * ARCHITECTURE: JavaScript → MVC Controller → ApiService → Backend API
 *   /File/GetFiles    → SuKienQHLDFileController
 *   /Timeline/...     → TimelineQHLDController
 *   /VPDDXacNhanQLDH/... → VPDDXacNhanQLDHController
 *   /KetQua/...       → KetQuaQHLDController
 *   /SuKienQHLD/...   → SuKienQHLDController
 *
 * Business Rules:
 *   BR-11: Timeline append-only — no edit/delete
 *   BR-12: KET_QUA file required before close (server-enforced)
 *   BR-XL-05: CoQuanTiepNhan required for escalation KetQua values
 *   BR-XL-06: GhiChuVPDD required when ChenhLech >= 20%
 *   BR-XL-08: Đóng hồ sơ requires confirm dialog (irreversible)
 */
(function () {
    'use strict';

    // ─── State ────────────────────────────────────────────────────────────────
    var suKienId = '';
    var trangThai = '';
    var tabLoaded = { vpdd: false, timeline: false, result: false };

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text)));
        return div.innerHTML;
    }

    function formatDatetime(val) {
        if (!val) return '';
        var d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
        var dd = String(d.getDate()).padStart(2, '0');
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var yyyy = d.getFullYear();
        var hh = String(d.getHours()).padStart(2, '0');
        var min = String(d.getMinutes()).padStart(2, '0');
        return dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + min;
    }

    function formatDateOnly(val) {
        if (!val) return '';
        var s = String(val);
        // Handle ISO yyyy-MM-dd or datetime
        var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return m[3] + '/' + m[2] + '/' + m[1];
        return s;
    }

    function getToken() {
        var el = document.querySelector('input[name="__RequestVerificationToken"]');
        return el ? el.value : '';
    }

    function ajaxPost(url, body, onSuccess, onError) {
        var token = getToken();
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': token,
                'RequestVerificationToken': token
            },
            body: JSON.stringify(body)
        })
            .then(function (r) { return r.json(); })
            .then(onSuccess)
            .catch(function (err) {
                console.error('[QHLD-Details] POST error:', url, err);
                if (onError) onError(err);
                else toastr.error('Lỗi kết nối máy chủ');
            });
    }

    // ─── Tab Switching ────────────────────────────────────────────────────────
    // Exposed globally — called from inline onclick in Details.cshtml

    function switchEntTab(name, btn) {
        // Update tab buttons
        document.querySelectorAll('.ent-tab-btn').forEach(function (b) {
            b.classList.remove('active');
        });
        if (btn) btn.classList.add('active');

        // Update tab panes
        document.querySelectorAll('.ent-tab-pane').forEach(function (p) {
            p.classList.remove('active');
        });
        var pane = document.getElementById('ent-tab-' + name);
        if (pane) pane.classList.add('active');

        // Lazy-load per tab
        if (name === 'vpdd' && !tabLoaded.vpdd) {
            tabLoaded.vpdd = true;
            loadVPDD();
        }
        if (name === 'timeline' && !tabLoaded.timeline) {
            tabLoaded.timeline = true;
            loadTimeline();
        }
        if (name === 'result' && !tabLoaded.result) {
            tabLoaded.result = true;
            loadResult();
        }
    }

    // Make switchEntTab accessible from inline onclick in .cshtml
    window.switchEntTab = switchEntTab;

    // ─── File Zones ───────────────────────────────────────────────────────────

    function loadFileList(listEl, category) {
        if (!listEl) return;
        listEl.innerHTML = '<p class="text-muted" style="font-size:12px;"><i class="fas fa-spinner fa-spin mr-1"></i>Đang tải...</p>';

        fetch('/File/GetFiles/' + encodeURIComponent(suKienId) + '?category=' + encodeURIComponent(category))
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (!json.success || !json.data || json.data.length === 0) {
                    listEl.innerHTML = '<p class="text-muted" style="font-size:12px;">Chưa có file nào.</p>';
                    return;
                }
                renderFileList(listEl, json.data, category);
            })
            .catch(function () {
                listEl.innerHTML = '<p class="text-danger" style="font-size:12px;">Không thể tải danh sách file.</p>';
            });
    }

    function renderFileList(listEl, files, category) {
        var canDelete = window.userPermissions && window.userPermissions.canUpdate;
        var html = '<div style="display:flex; flex-direction:column; gap:6px;">';
        files.forEach(function (f) {
            var fileId = escapeHtml(f.fileId || f.id || '');
            var fileName = escapeHtml(f.fileName || f.name || '');
            var cat = escapeHtml(category);
            var sizeKB = Math.ceil((f.fileSize || f.size || 0) / 1024);

            html += '<div class="d-flex align-items-center gap-2"'
                + ' style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 10px;">'
                + '<i class="fas fa-file-alt text-primary" style="flex-shrink:0;"></i>'
                + '<span style="flex:1; font-size:12px; word-break:break-all;">' + fileName
                + ' <span class="text-muted">(' + sizeKB + ' KB)</span></span>';

            if (canDelete && fileId) {
                html += '<button type="button" class="btn-figma btn-figma-ghost"'
                    + ' style="height:24px; padding:0 8px; font-size:11px; color:#dc2626; flex-shrink:0;"'
                    + ' onclick="deleteQHLDFile(\'' + fileId + '\',\'' + cat + '\')">'
                    + '<i class="fas fa-times"></i></button>';
            }

            html += '</div>';
        });
        html += '</div>';
        listEl.innerHTML = html;
    }

    // ─── File Preview (modal) ──────────────────────────────────────────────────

    function openFilePreview(fileId, fileName) {
        if (!fileId) return;

        // Initialize modal if not exists
        if (!document.getElementById('pageFilePreviewModal')) {
            // Create modal DOM
            var modal = document.createElement('div');
            modal.id = 'pageFilePreviewModal';
            modal.className = 'modal fade';
            modal.innerHTML = `
                <div class="modal-dialog modal-xl" role="document">
                    <div class="modal-content-figma">
                        <div class="modal-header-figma">
                            <h5 id="pageFilePreviewFileName" class="modal-title"></h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-0">
                            <div id="pageFilePreviewLoading" class="text-center py-5">
                                <i class="fas fa-spinner fa-spin mr-2"></i>Đang tải file...
                            </div>
                            <iframe id="pageFilePreviewFrame" style="width:100%; height:500px; border:none; display:none;"></iframe>
                            <div id="pageFilePreviewUnsupported" class="alert-figma alert-figma-warning m-3" style="display:none;">
                                <p class="mb-2">Không thể xem trước file này trong trình duyệt.</p>
                                <a id="pageFilePreviewUnsupportedLink" href="#" class="btn btn-primary btn-sm">
                                    <i class="fas fa-download"></i> Tải xuống
                                </a>
                            </div>
                        </div>
                        <div class="modal-footer-figma">
                            <a id="pageFilePreviewDownloadBtn" href="#" class="btn btn-sm btn-figma btn-figma-outline">
                                <i class="fas fa-download"></i> Tải xuống
                            </a>
                            <button type="button" class="btn btn-sm btn-figma btn-figma-outline" data-bs-dismiss="modal">Đóng</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        $('#pageFilePreviewFileName').text(fileName);
        $('#pageFilePreviewLoading').show();
        $('#pageFilePreviewFrame').hide();
        $('#pageFilePreviewUnsupported').hide();
        $('#pageFilePreviewModal').modal('show');

        const downloadUrl = `/FileManager/Download?id=${fileId}`;
        $('#pageFilePreviewDownloadBtn, #pageFilePreviewUnsupportedLink').attr('href', downloadUrl);

        const ext = (fileName.split('.').pop() || '').toLowerCase();
        const viewableExts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'txt'];

        if (viewableExts.includes(ext)) {
            const previewUrl = `/FileManager/Preview?id=${fileId}`;
            $('#pageFilePreviewFrame').attr('src', previewUrl);
            $('#pageFilePreviewFrame').on('load', function () {
                $('#pageFilePreviewLoading').hide();
                $('#pageFilePreviewFrame').show();
            });
            $('#pageFilePreviewFrame').on('error', function () {
                $('#pageFilePreviewLoading').hide();
                $('#pageFilePreviewUnsupported').show();
            });
        } else {
            $('#pageFilePreviewLoading').hide();
            $('#pageFilePreviewUnsupported').show();
        }
    }

    // Expose for inline onclick
    window.openFilePreview = openFilePreview;

    function deleteQHLDFile(fileId, category) {
        if (!confirm('Bạn có chắc muốn xóa file này?')) return;

        var token = getToken();
        fetch('/File/Delete/' + encodeURIComponent(fileId), {
            method: 'POST',
            headers: {
                'X-XSRF-TOKEN': token,
                'RequestVerificationToken': token
            }
        })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (json.success) {
                    toastr.success('Đã xóa file');
                    refreshFileList(category);
                } else {
                    toastr.error(json.message || 'Không thể xóa file');
                }
            })
            .catch(function () { toastr.error('Lỗi kết nối khi xóa file'); });
    }

    // Expose for inline onclick from renderFileList
    window.deleteQHLDFile = deleteQHLDFile;

    function refreshFileList(category) {
        var map = {
            'HO_SO': 'hoSoFileList',
            'VPDD': 'vpddFileList',
            'TIMELINE': 'timelineFileList',
            'KET_QUA': 'resultFileList'
        };
        var listId = map[category];
        if (!listId) return;
        var listEl = document.getElementById(listId);
        if (listEl) loadFileList(listEl, category);
    }

    function uploadFileToServer(file, category, fileListEl) {
        var MAX_SIZE = 20 * 1024 * 1024; // 20 MB
        if (file.size > MAX_SIZE) {
            toastr.warning('File "' + escapeHtml(file.name) + '" vượt quá 20MB, bỏ qua.');
            return;
        }

        var fd = new FormData();
        fd.append('file', file);
        fd.append('suKienQHLDId', suKienId);
        fd.append('fileCategory', category);

        var token = getToken();
        fetch('/File/Upload', {
            method: 'POST',
            headers: {
                'X-XSRF-TOKEN': token,
                'RequestVerificationToken': token
            },
            body: fd
        })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (json.success) {
                    toastr.success('Tải lên thành công: ' + escapeHtml(file.name));
                    loadFileList(fileListEl, category);
                } else {
                    toastr.error(json.message || 'Lỗi tải file: ' + escapeHtml(file.name));
                }
            })
            .catch(function () {
                toastr.error('Lỗi kết nối khi tải file: ' + escapeHtml(file.name));
            });
    }

    // ─── Tab 2: VPĐD ─────────────────────────────────────────────────────────

    function loadVPDD() {
        var content = document.getElementById('vpddContent');
        if (!content) return;

        content.innerHTML = '<p class="text-muted" style="font-size:13px;"><i class="fas fa-spinner fa-spin mr-1"></i>Đang tải dữ liệu VPĐD...</p>';

        fetch('/VPDDXacNhanQLDH/GetBySuKien/' + encodeURIComponent(suKienId))
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (json.success && json.data) {
                    renderVPDDData(json.data);
                } else {
                    renderVPDDEmpty();
                }
            })
            .catch(function () {
                var content = document.getElementById('vpddContent');
                if (content) content.innerHTML = '<p class="text-danger" style="font-size:13px;">Không thể tải dữ liệu VPĐD.</p>';
            });
    }

    function renderVPDDData(d) {
        var content = document.getElementById('vpddContent');
        if (!content) return;

        var html = '<div class="alert-figma alert-figma-info py-2 mb-3" style="font-size:13px;">'
            + '<i class="fas fa-check-circle mr-1"></i>'
            + '<strong>' + escapeHtml(d.nguoiXacNhanName || d.nguoiXacNhanId || '') + '</strong>'
            + ' – Đã xác nhận ' + formatDatetime(d.createdAt)
            + '</div>';

        // Readonly fields
        html += '<div class="row mb-3">'
            + '<div class="col-md-4 mb-2">'
            + '<div class="info-label">Số người quan sát (VPĐD)</div>'
            + '<div class="font-weight-semibold">' + escapeHtml(String(d.soNguoiVPDD)) + '</div>'
            + '</div>'
            + '<div class="col-md-8 mb-2">'
            + '<div class="info-label">Tình hình thực địa</div>'
            + '<div style="font-size:13px; white-space:pre-wrap;">' + escapeHtml(d.tinhHinhThucDia) + '</div>'
            + '</div>'
            + '</div>';

        // Comparison table
        var isHighlight = d.isHighlightChenhLech;
        html += '<h6 class="font-weight-bold mb-2" style="font-size:13px;">Đối chiếu PA-B vs VPĐD</h6>'
            + '<table class="table table-sm table-bordered" style="font-size:13px;">'
            + '<thead><tr class="bg-light"><th>Trường</th><th>PA-B</th><th>VPĐD</th><th>Chênh %</th></tr></thead>'
            + '<tbody>'
            + '<tr' + (isHighlight ? ' style="background:#fef9c3;"' : '') + '>'
            + '<td>Số người</td>'
            + '<td>' + escapeHtml(String(d.soNguoiPA)) + '</td>'
            + '<td>' + escapeHtml(String(d.soNguoiVPDD)) + '</td>'
            + '<td>' + escapeHtml(Number(d.chenhLechPercent).toFixed(1)) + '%'
            + (isHighlight ? ' <span class="badge-figma badge-figma-warning ml-1" style="font-size:10px;">≥20%</span>' : '')
            + '</td>'
            + '</tr>'
            + '<tr>'
            + '<td>Ngày giờ bắt đầu</td>'
            + '<td>' + escapeHtml(window.detailConfig.ngayGioPhatSinhDisplay || '') + '</td>'
            + '<td>—</td>'
            + '<td>—</td>'
            + '</tr>'
            + '</tbody></table>';

        if (d.ghiChuVPDD) {
            html += '<div class="info-label mt-2">Ghi chú VPĐD</div>'
                + '<div style="font-size:13px; white-space:pre-wrap;">' + escapeHtml(d.ghiChuVPDD) + '</div>';
        }

        content.innerHTML = html;

        // Hide the input form — already confirmed
        var vpddForm = document.getElementById('vpddForm');
        if (vpddForm) vpddForm.style.display = 'none';
    }

    function renderVPDDEmpty() {
        var content = document.getElementById('vpddContent');
        if (!content) return;

        content.innerHTML = '<div class="alert-figma alert-figma-warning py-2 mb-3" style="font-size:13px;">'
            + '<i class="fas fa-exclamation-triangle mr-1"></i>Chưa có dữ liệu VPĐD</div>';

        // Show input form if user has permission
        var vpddForm = document.getElementById('vpddForm');
        if (vpddForm && window.userPermissions && window.userPermissions.canUpdate) {
            vpddForm.style.display = '';
        }
    }

    function initVPDDForm() {
        // Tab 1: VPDD form is now read-only (display only for reference)
        // VPDD input and file upload happens in confirmation modal
        // No longer need conditional display logic
    }

    // ─── File Upload Components (FileUploadComponent) ────────────────────────

    var timelineUploader, resultUploader, vpddUploader, confirmVPDDUploader;

    function initFileUploaders() {
        // Initialize VPDD file uploader (Tab 1 — for reference only, disabled)
        vpddUploader = new FileUploadComponent({
            dropZoneId: 'dropZoneVPDD',
            fileInputId: 'fileInputVPDD',
            fileQueueId: 'vpddFileQueue',
            maxFiles: 1,
            maxSizeMB: 20,
            simple: true
        });

        // Initialize CONFIRMATION modal VPDD file uploader (new)
        confirmVPDDUploader = new FileUploadComponent({
            dropZoneId: 'dropZoneConfirmVPDD',
            fileInputId: 'fileInputConfirmVPDD',
            fileQueueId: 'confirmVPDDFileQueue',
            maxFiles: 10,  // Allow multiple files for photos
            maxSizeMB: 20,
            simple: true
        });

        // Initialize TIMELINE file uploader (in modal)
        timelineUploader = new FileUploadComponent({
            dropZoneId: 'dropZoneTimeline',
            fileInputId: 'fileInputTimeline',
            fileQueueId: 'timelineFileQueue',
            maxFiles: 1,
            maxSizeMB: 20,
            simple: true
        });

        // Initialize KET_QUA file uploader (Tab 4)
        resultUploader = new FileUploadComponent({
            dropZoneId: 'dropZoneResult',
            fileInputId: 'fileInputResult',
            fileQueueId: 'resultFileQueue',
            maxFiles: 1,
            maxSizeMB: 20,
            simple: true
        });
    }

    var TIMELINE_COLORS = {
        'Can thiệp hiện trường': { bg: '#fee2e2', iconColor: '#dc2626', icon: 'fa-exclamation-triangle' },
        'Hòa giải lần 1': { bg: '#fef9c3', iconColor: '#d97706', icon: 'fa-handshake' },
        'Hòa giải lần 2': { bg: '#fef9c3', iconColor: '#d97706', icon: 'fa-handshake' },
        'Đàm phán': { bg: '#dbeafe', iconColor: '#2563eb', icon: 'fa-comments' },
        'HĐHG cấp trên': { bg: '#e0e7ff', iconColor: '#4338ca', icon: 'fa-gavel' },
        'Kết thúc': { bg: '#dcfce7', iconColor: '#16a34a', icon: 'fa-check-circle' },
        'Tiếp nhận': { bg: '#dbeafe', iconColor: '#2563eb', icon: 'fa-inbox' }
    };

    function loadTimeline() {
        var content = document.getElementById('timelineContent');
        if (!content) return;

        content.innerHTML = '<p class="text-muted" style="font-size:13px;"><i class="fas fa-spinner fa-spin mr-1"></i>Đang tải timeline...</p>';

        fetch('/TimelineQHLD/GetBySuKien/' + encodeURIComponent(suKienId))
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (!json.success || !json.data || json.data.length === 0) {
                    content.innerHTML = '<p class="text-muted" style="font-size:13px;">Chưa có mốc cập nhật nào.</p>';
                    return;
                }
                renderTimeline(json.data);
            })
            .catch(function () {
                content.innerHTML = '<p class="text-danger" style="font-size:13px;">Không thể tải timeline.</p>';
            });
    }

    function renderTimeline(items) {
        var content = document.getElementById('timelineContent');
        if (!content) return;

        var sorted = items.sort(function (a, b) {
            var dateA = new Date(a.ngayGio || 0);
            var dateB = new Date(b.ngayGio || 0);
            return dateB - dateA;
        });

        var html = '';
        sorted.forEach(function (item) {
            var colors = TIMELINE_COLORS[item.giaiDoan]
                || { bg: '#dbeafe', iconColor: '#2563eb', icon: 'fa-dot-circle' };

            html += '<div class="timeline-item">'
                + '<div class="timeline-icon" style="background:' + colors.bg + ';">'
                + '<i class="fas ' + colors.icon + '" style="color:' + colors.iconColor + '; font-size:14px;"></i>'
                + '</div>'
                + '<div class="timeline-content">'
                + '<div class="d-flex justify-content-between align-items-start mb-1">'
                + '<strong style="font-size:13px;">' + escapeHtml(item.giaiDoan) + '</strong>'
                + '<span class="text-muted" style="font-size:11px; white-space:nowrap; margin-left:8px;">'
                + formatDatetime(item.ngayGio) + '</span>'
                + '</div>'
                + '<p class="mb-1" style="font-size:13px; white-space:pre-wrap;">' + escapeHtml(item.noiDung) + '</p>';

            if (item.fileBienBanName && item.fileBienBanId) {
                html += '<div style="font-size:12px; margin-top:8px;">'
                    + '<button type="button" class="btn btn-sm btn-figma btn-figma-outline" '
                    + 'onclick="openFilePreview(\'' + escapeHtml(item.fileBienBanId) + '\', \'' + escapeHtml(item.fileBienBanName).replace(/'/g, "\\'") + '\')">'
                    + '<i class="fas fa-download mr-1"></i>' + escapeHtml(item.fileBienBanName)
                    + '</button>'
                    + '</div>';
            }

            html += '<div class="text-muted" style="font-size:11px; margin-top:8px;">'
                + 'Tạo bởi: <strong>' + escapeHtml(item.nguoiTaoName || item.nguoiTaoId || '') + '</strong>'
                + '</div>'
                + '</div>'
                + '</div>';
        });

        content.innerHTML = html;
    }

    function initAddTimeline() {
        var btnAdd = document.getElementById('btnAddTimeline');
        if (!btnAdd) return;

        btnAdd.addEventListener('click', function () {
            var elGiaiDoan = document.getElementById('inputGiaiDoan');
            var elNgayGio = document.getElementById('inputNgayGio');
            var elNoiDung = document.getElementById('inputNoiDung');
            var elErrGiaiDoan = document.getElementById('errGiaiDoan');
            var elErrNoiDung = document.getElementById('errNoiDung');

            if (elGiaiDoan) elGiaiDoan.value = '';
            if (elNgayGio) elNgayGio.value = '';
            if (elNoiDung) elNoiDung.value = '';
            if (elErrGiaiDoan) elErrGiaiDoan.textContent = '';
            if (elErrNoiDung) elErrNoiDung.textContent = '';

            // Clear timeline uploader
            if (timelineUploader) timelineUploader.clear();

            // Initialize modal close button
            var btnCancel = document.getElementById('btnCancelAddTimeline');
            if (btnCancel && !btnCancel._cancelListener) {
                btnCancel._cancelListener = true;
                btnCancel.addEventListener('click', function () {
                    $('#moAddTimeline').modal('hide');
                });
            }

            $('#moAddTimeline').modal('show');
        });

        var btnSubmit = document.getElementById('btnAddTimelineSubmit');
        if (!btnSubmit) return;

        btnSubmit.addEventListener('click', function () {
            var giaiDoan = (document.getElementById('inputGiaiDoan') || {}).value;
            var ngayGio = (document.getElementById('inputNgayGio') || {}).value;
            var noiDung = ((document.getElementById('inputNoiDung') || {}).value || '').trim();
            var elErrGiaiDoan = document.getElementById('errGiaiDoan');
            var elErrNoiDung = document.getElementById('errNoiDung');

            if (elErrGiaiDoan) elErrGiaiDoan.textContent = '';
            if (elErrNoiDung) elErrNoiDung.textContent = '';

            var valid = true;
            if (!giaiDoan) {
                if (elErrGiaiDoan) elErrGiaiDoan.textContent = 'Vui lòng chọn giai đoạn';
                valid = false;
            }
            if (!ngayGio) {
                toastr.warning('Vui lòng nhập ngày giờ');
                valid = false;
            }
            if (!noiDung) {
                if (elErrNoiDung) elErrNoiDung.textContent = 'Vui lòng nhập nội dung';
                valid = false;
            }
            if (!valid) return;

            // Build FormData with form fields + files
            var formData = new FormData();
            let token = getToken();
            formData.append("__RequestVerificationToken", token);
            formData.append('SuKienQHLDId', suKienId);
            formData.append('GiaiDoan', giaiDoan);
            formData.append('NgayGio', ngayGio);
            formData.append('NoiDung', noiDung);

            // Add files from timelineUploader
            if (timelineUploader) {
                var files = timelineUploader.getFiles();
                if (files && files.length > 0) {
                    files.forEach(function (file) {
                        formData.append('files_Timeline', file);
                    });
                }
            }

            btnSubmit.disabled = true;
            $.ajax({
                url: '/TimelineQHLD/Add',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    'X-XSRF-TOKEN': token,
                    'RequestVerificationToken': token
                },
                success: function (json) {
                    btnSubmit.disabled = false;
                    if (json.success) {
                        toastr.success(json.message || 'Đã thêm mốc cập nhật');
                        $('#moAddTimeline').modal('hide');
                        tabLoaded.timeline = false;
                        loadTimeline();
                    } else {
                        toastr.error(json.message || 'Không thể thêm mốc cập nhật');
                    }
                },
                error: function (xhr, status, err) {
                    btnSubmit.disabled = false;
                    toastr.error('Lỗi kết nối: ' + (xhr.statusText || 'Unknown error'));
                }
            });
        });
    }

    // ─── Tab 4: Kết quả ───────────────────────────────────────────────────────

    var KET_QUA_LABELS = {
        'DaGiaiQuyet': 'Đã giải quyết tại cơ sở',
        'DangXuLy': 'Đang xử lý (kéo dài)',
        'ChuyenHDHG': 'Chuyển HĐHG cấp trên',
        'ChuyenTAND': 'Chuyển TAND',
        'KhoiKien': 'Khởi kiện'
    };

    var ESCALATION_VALUES = ['ChuyenHDHG', 'ChuyenTAND', 'KhoiKien'];

    function loadResult() {
        var content = document.getElementById('resultContent');
        if (!content) return;

        content.innerHTML = '<p class="text-muted" style="font-size:13px;"><i class="fas fa-spinner fa-spin mr-1"></i>Đang tải kết quả...</p>';

        fetch('/KetQuaQHLD/GetBySuKien/' + encodeURIComponent(suKienId))
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (json.success && json.data) {
                    renderResultData(json.data);
                } else {
                    renderResultEmpty();
                }
            })
            .catch(function () {
                content.innerHTML = '<p class="text-danger" style="font-size:13px;">Không thể tải kết quả.</p>';
            });
    }

    function renderResultData(d) {
        var content = document.getElementById('resultContent');
        if (!content) return;

        // If status is DaKetThuc, populate readonly form and show file list
        if (trangThai === 'DaKetThuc') {
            content.innerHTML = '';
            var resultForm = document.getElementById('resultForm');
            if (resultForm) {
                resultForm.style.display = '';
                // Populate form fields with KetQua data
                var ketQuaEl = document.getElementById('ketQua');
                if (ketQuaEl) ketQuaEl.value = d.ketQua || '';
                var ngayKetThucEl = document.getElementById('ngayKetThuc');
                if (ngayKetThucEl) {
                    var ngayStr = String(d.ngayKetThuc || '');
                    var m = ngayStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
                    ngayKetThucEl.value = m ? m[0] : '';
                }
                var tomTatEl = document.getElementById('tomTatThoaThuan');
                if (tomTatEl) tomTatEl.value = d.tomTatThoaThuan || '';
                var coQuanEl = document.getElementById('coQuanTiepNhan');
                if (coQuanEl) coQuanEl.value = d.coQuanTiepNhan || '';
            }
            return;
        }

        var html = '<div class="alert-figma alert-figma-success py-2 mb-3" style="font-size:13px;">'
            + '<i class="fas fa-check-circle mr-1"></i><strong>Hồ sơ đã đóng</strong></div>'
            + '<div class="row">'
            + '<div class="col-md-4 mb-2">'
            + '<div class="info-label">Kết quả xử lý</div>'
            + '<div>' + escapeHtml(KET_QUA_LABELS[d.ketQua] || d.ketQua) + '</div>'
            + '</div>'
            + '<div class="col-md-4 mb-2">'
            + '<div class="info-label">Ngày kết thúc</div>'
            + '<div>' + formatDateOnly(d.ngayKetThuc) + '</div>'
            + '</div>';

        if (d.coQuanTiepNhan) {
            html += '<div class="col-md-4 mb-2">'
                + '<div class="info-label">Cơ quan tiếp nhận</div>'
                + '<div>' + escapeHtml(d.coQuanTiepNhan) + '</div>'
                + '</div>';
        }
        html += '</div>';

        if (d.tomTatThoaThuan) {
            html += '<div class="info-label mt-2">Tóm tắt thỏa thuận</div>'
                + '<div style="font-size:13px; white-space:pre-wrap; background:#fafafa; border:1px solid #e2e8f0; border-radius:4px; padding:10px; margin-top:4px;">'
                + escapeHtml(d.tomTatThoaThuan) + '</div>';
        }

        content.innerHTML = html;

        // Hide the close form if it exists
        var resultForm = document.getElementById('resultForm');
        if (resultForm) resultForm.style.display = 'none';
    }

    function renderResultEmpty() {
        var content = document.getElementById('resultContent');
        if (!content) return;
        content.innerHTML = '';

        // Show close form if Razor rendered it (TrangThai = DangXuLy + canApprove)
        var resultForm = document.getElementById('resultForm');
        if (resultForm) resultForm.style.display = '';
    }

    function initResultForm() {
        // BR-XL-05: Show CoQuanTiepNhan when escalation value selected
        var selKetQua = document.getElementById('ketQua');
        if (selKetQua) {
            selKetQua.addEventListener('change', function () {
                var val = this.value;
                var row = document.getElementById('coQuanTiepNhanRow');
                if (row) {
                    row.style.display = ESCALATION_VALUES.indexOf(val) >= 0 ? '' : 'none';
                }
            });
        }

        var btnClose = document.getElementById('btnClose');
        if (!btnClose) return;

        btnClose.addEventListener('click', function () {
            var kq = (document.getElementById('ketQua') || {}).value || '';
            var nkt = (document.getElementById('ngayKetThuc') || {}).value || '';
            var tt = ((document.getElementById('tomTatThoaThuan') || {}).value || '').trim();
            var cq = ((document.getElementById('coQuanTiepNhan') || {}).value || '').trim();
            var coQuanRow = document.getElementById('coQuanTiepNhanRow');

            if (!kq) { toastr.warning('Vui lòng chọn kết quả xử lý'); return; }
            if (!nkt) { toastr.warning('Vui lòng nhập ngày kết thúc'); return; }
            if (!tt) { toastr.warning('Vui lòng nhập tóm tắt thỏa thuận'); return; }
            if (coQuanRow && coQuanRow.style.display !== 'none' && !cq) {
                toastr.warning('Vui lòng nhập tên cơ quan tiếp nhận'); return;
            }

            // BR-XL-08: Confirm dialog — irreversible action
            if (!confirm('Đóng hồ sơ là thao tác KHÔNG THỂ HOÀN TÁC.\n\nBạn có chắc chắn muốn tiếp tục?')) return;

            btnClose.disabled = true;

            // Build FormData with form fields + files
            var token = getToken();
            var formData = new FormData();
            formData.append('__RequestVerificationToken', token);
            formData.append('SuKienQHLDId', suKienId);
            formData.append('KetQua', kq);
            formData.append('NgayKetThuc', nkt);
            formData.append('TomTatThoaThuan', tt);
            if (cq) formData.append('CoQuanTiepNhan', cq);

            // Add files from resultUploader
            if (resultUploader) {
                var files = resultUploader.getFiles();
                if (files && files.length > 0) {
                    files.forEach(function (file) {
                        formData.append('files_KET_QUA', file);
                    });
                }
            }

            $.ajax({
                url: '/KetQuaQHLD/Close',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    'X-XSRF-TOKEN': token,
                    'RequestVerificationToken': token
                },
                success: function (json) {
                    btnClose.disabled = false;
                    if (json.success) {
                        toastr.success(json.message || 'Đã đóng hồ sơ thành công');
                        setTimeout(function () { window.location.href = '/SuKienQHLD/Index'; }, 1200);
                    } else {
                        toastr.error(json.message || 'Không thể đóng hồ sơ');
                    }
                },
                error: function (xhr, status, err) {
                    btnClose.disabled = false;
                    toastr.error('Lỗi kết nối: ' + (xhr.statusText || 'Unknown error'));
                }
            });
        });
    }

    // ─── Workflow: Confirm / YCBoSung / Reject ────────────────────────────────

    function initWorkflowButtons() {
        // ── Xác nhận ──────────────────────────────────────────────────────────
        var btnConfirm = document.getElementById('btnConfirm');
        if (btnConfirm) {
            btnConfirm.addEventListener('click', function () {
                // Pre-fill ghi chú from VPDD form if available
                var inputGC = document.getElementById('inputGhiChuThamDinh');
                var txtVPDDSoNguoi = document.getElementById('soNguoiVPDD');
                if (txtVPDDSoNguoi && inputGC && !inputGC.value) {
                    // If VPDD form exists, use its number as context hint
                    inputGC.placeholder = "Ghi chú nội bộ (nếu có)";
                }
                $('#moConfirm').modal('show');
            });
        }

        var btnConfirmSubmit = document.getElementById('btnConfirmSubmit');
        if (btnConfirmSubmit) {
            btnConfirmSubmit.addEventListener('click', function () {
                // Collect data from modal
                var ghiChu = ((document.getElementById('inputGhiChuThamDinh') || {}).value || '').trim();

                // Collect VPDD data from Tab 1 (separate section above modal)
                var elSoNguoi = document.getElementById('soNguoiVPDD');
                var elTinhHinh = document.getElementById('tinhHinhThucDia');
                var soNguoiVPDD = (elSoNguoi && elSoNguoi.value) ? parseInt(elSoNguoi.value, 10) : null;
                var tinhHinhThucDia = (elTinhHinh && elTinhHinh.value && elTinhHinh.value.trim()) ? elTinhHinh.value.trim() : null;

                // Build FormData with all confirm data + files
                let TOKEN = $('input[name="__RequestVerificationToken"]').val();
                var formData = new FormData();
                formData.append('__RequestVerificationToken', TOKEN);
                formData.append('GhiChuThamDinh', ghiChu || '');
                if (soNguoiVPDD) formData.append('SoNguoiVPDD', soNguoiVPDD);
                if (tinhHinhThucDia) formData.append('TinhHinhThucDia', tinhHinhThucDia);

                // Add files from vpddUploader (Tab 1 file upload component)
                if (vpddUploader) {
                    var files = vpddUploader.getFiles();
                    if (files && files.length > 0) {
                        files.forEach(function (file) {
                            formData.append('files_VPDD', file);
                        });
                    }
                }

                btnConfirmSubmit.disabled = true;

                $.ajax({
                    url: '/SuKienQHLD/confirm/' + encodeURIComponent(suKienId),
                    type: 'POST',
                    data: formData,
                    processData: false,
                    contentType: false,
                    headers: {
                        'X-XSRF-TOKEN': TOKEN,
                        'RequestVerificationToken': TOKEN
                    },
                    success: function (json) {
                        btnConfirmSubmit.disabled = false;
                        if (json.success) {
                            toastr.success(json.message || 'Xác nhận thành công');
                            $('#moConfirm').modal('hide');
                            setTimeout(function () { window.location.reload(); }, 1000);
                        } else {
                            toastr.error(json.message || 'Không thể xác nhận');
                        }
                    },
                    error: function (xhr, status, err) {
                        btnConfirmSubmit.disabled = false;
                        toastr.error('Lỗi kết nối: ' + (xhr.statusText || 'Unknown error'));
                    }
                });
            });
        }

        // ── Yêu cầu bổ sung ───────────────────────────────────────────────────
        var btnYCBS = document.getElementById('btnRequestSupplement');
        if (btnYCBS) {
            btnYCBS.addEventListener('click', function () {
                var el = document.getElementById('inputNoiDungYCBS');
                var errEl = document.getElementById('errNoiDungYCBS');
                if (el) el.value = '';
                if (errEl) errEl.textContent = '';
                $('#moYeuCauBoSung').modal('show');
            });
        }

        var btnYCBSSubmit = document.getElementById('btnRequestSupplementSubmit');
        if (btnYCBSSubmit) {
            btnYCBSSubmit.addEventListener('click', function () {
                var noiDung = ((document.getElementById('inputNoiDungYCBS') || {}).value || '').trim();
                var errEl = document.getElementById('errNoiDungYCBS');
                if (!noiDung) {
                    if (errEl) errEl.textContent = 'Vui lòng nhập nội dung yêu cầu bổ sung';
                    return;
                }
                btnYCBSSubmit.disabled = true;
                ajaxPost('/SuKienQHLD/request-supplement/' + encodeURIComponent(suKienId), {
                    NoiDungYCBS: noiDung
                }, function (json) {
                    btnYCBSSubmit.disabled = false;
                    if (json.success) {
                        toastr.success(json.message || 'Đã gửi yêu cầu bổ sung');
                        $('#moYeuCauBoSung').modal('hide');
                        setTimeout(function () { window.location.reload(); }, 1000);
                    } else {
                        toastr.error(json.message || 'Không thể gửi yêu cầu bổ sung');
                    }
                }, function () { btnYCBSSubmit.disabled = false; });
            });
        }

        // ── Từ chối ───────────────────────────────────────────────────────────
        var btnReject = document.getElementById('btnReject');
        if (btnReject) {
            btnReject.addEventListener('click', function () {
                var el = document.getElementById('inputLyDoTuChoi');
                var errEl = document.getElementById('errLyDoTuChoi');
                if (el) el.value = '';
                if (errEl) errEl.textContent = '';
                $('#moTuChoi').modal('show');
            });
        }

        var btnRejectSubmit = document.getElementById('btnRejectSubmit');
        if (btnRejectSubmit) {
            btnRejectSubmit.addEventListener('click', function () {
                var lyDo = ((document.getElementById('inputLyDoTuChoi') || {}).value || '').trim();
                var errEl = document.getElementById('errLyDoTuChoi');
                if (!lyDo) {
                    if (errEl) errEl.textContent = 'Vui lòng nhập lý do từ chối';
                    return;
                }
                btnRejectSubmit.disabled = true;
                ajaxPost('/SuKienQHLD/reject/' + encodeURIComponent(suKienId), {
                    LyDoTuChoi: lyDo
                }, function (json) {
                    btnRejectSubmit.disabled = false;
                    if (json.success) {
                        toastr.success(json.message || 'Đã từ chối sự kiện');
                        $('#moTuChoi').modal('hide');
                        setTimeout(function () { window.location.reload(); }, 1000);
                    } else {
                        toastr.error(json.message || 'Không thể từ chối');
                    }
                }, function () { btnRejectSubmit.disabled = false; });
            });
        }
    }

    // ─── Initialize ───────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', function () {
        var cfg = window.detailConfig || {};
        suKienId = cfg.suKienId
            || (document.getElementById('suKienId') ? document.getElementById('suKienId').value : '');
        trangThai = cfg.trangThai || '';

        if (!suKienId) {
            console.error('[QHLD-Details] suKienId not found — aborting init');
            return;
        }

        // Initialize FileUploadComponent instances
        initFileUploaders();

        // Initialize workflow buttons (Confirm / YCBoSung / Reject)
        initWorkflowButtons();

        // Initialize sub-forms
        initVPDDForm();
        initAddTimeline();
        initResultForm();
    });

})();
