/**
 * TNLD Chi tiết JavaScript (M0141 Detail - v2.0 Figma)
 * Pattern: Module + Tab management + AJAX actions
 */
(function ($) {
    'use strict';

    // ==========================================
    // DETAILS MODULE
    // ==========================================
    var DetailsModule = {
        tnldId: null,
        
        init: function () {
            this.tnldId = location.pathname.split('/').pop();
            
            this.loadDieuTraTimeline();
            this.loadVersions();
            // this.initTabHandlers(); // DISABLED: Files now rendered via Razor, no AJAX needed
            this.initActionButtons();
        },

        loadDieuTraTimeline: function () {
            var self = this;
            $.ajax({
                url: `/TaiNanLaoDong/GetDieuTraTimeline/${self.tnldId}`,
                type: 'GET',
                success: function (response) {
                    if (response.success && response.data) {
                        self.renderTimeline(response.data);
                    }
                },
                error: function () {
                    $('#dieutraTimeline').html('<p class="text-danger" style="font-size:13px;">Không thể tải timeline điều tra</p>');
                }
            });
        },

        renderTimeline: function (entries) {
            if (!entries || entries.length === 0) {
                $('#dieutraTimeline').html('<div class="text-center py-4" style="color:#94a3b8; font-size:13px;"><i class="fas fa-inbox fa-2x mb-2 d-block" style="color:#cbd5e1;"></i>Chưa có hoạt động điều tra</div>');
                return;
            }

            const fmtDateTime = (v) => (typeof TNLDShared !== 'undefined' && TNLDShared.formatDateTime) ? TNLDShared.formatDateTime(v) : new Date(v).toLocaleString('vi-VN');
            const fmtDate = (v) => (typeof TNLDShared !== 'undefined' && TNLDShared.formatDateTime) ? TNLDShared.formatDateTime(v, true) : new Date(v).toLocaleDateString('vi-VN');
            const escapeHtml = (s) => String(s == null ? '' : s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            const nl2br = (s) => escapeHtml(s).replace(/\n/g, '<br>');

            const META = {
                'ChuaBatDau':   { label: 'Chưa bắt đầu',  color: '#64748b', bg: '#f1f5f9', icon: 'fa-hourglass-start' },
                'DangThucHien': { label: 'Đang thực hiện', color: '#2563eb', bg: '#dbeafe', icon: 'fa-spinner' },
                'DaHoanThanh':  { label: 'Đã hoàn thành',  color: '#16a34a', bg: '#dcfce7', icon: 'fa-check-circle' },
                'TamDung':      { label: 'Tạm dừng',       color: '#d97706', bg: '#fef3c7', icon: 'fa-pause-circle' }
            };

            // Reverse chronological: newest first
            const sorted = [...entries].reverse();
            const total = sorted.length;

            let html = '<div class="tnld-timeline" style="position:relative; padding-left:32px;">';
            html += '<div style="position:absolute; left:14px; top:6px; bottom:6px; width:2px; background:linear-gradient(to bottom,#cbd5e1,#e2e8f0);"></div>';

            sorted.forEach(function (entry, idx) {
                const meta = META[entry.trangThai] || { label: entry.trangThai, color: '#475569', bg: '#f1f5f9', icon: 'fa-circle' };
                const isLatest = idx === 0;
                const stepNo = total - idx; // chronological step number

                html += `
                    <div class="tnld-timeline-item" style="position:relative; margin-bottom:16px;">
                        <div style="position:absolute; left:-26px; top:8px; width:28px; height:28px; border-radius:50%; background:${meta.bg}; border:2px solid ${meta.color}; display:flex; align-items:center; justify-content:center; box-shadow:0 0 0 3px #fff;">
                            <i class="fas ${meta.icon}" style="color:${meta.color}; font-size:12px;"></i>
                        </div>
                        <div style="background:#fff; border:1px solid #e2e8f0; border-left:3px solid ${meta.color}; border-radius:6px; padding:12px 14px; box-shadow:0 1px 2px rgba(0,0,0,0.04);">
                            <div class="d-flex justify-content-between align-items-center mb-2" style="flex-wrap:wrap; gap:6px;">
                                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                    <span style="font-size:11px; font-weight:600; color:#94a3b8;">#${stepNo}</span>
                                    <span style="display:inline-block; padding:2px 10px; border-radius:12px; background:${meta.bg}; color:${meta.color}; font-size:11px; font-weight:600;">
                                        <i class="fas ${meta.icon}" style="font-size:10px; margin-right:4px;"></i>${escapeHtml(meta.label)}
                                    </span>
                                    ${isLatest ? '<span style="display:inline-block; padding:2px 8px; border-radius:10px; background:#fee2e2; color:#dc2626; font-size:10px; font-weight:600;">MỚI NHẤT</span>' : ''}
                                </div>
                                <span style="font-size:11px; color:#64748b;"><i class="far fa-clock" style="margin-right:4px;"></i>${fmtDateTime(entry.ngayTao)}</span>
                            </div>
                            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:8px 16px; font-size:12px; color:#334155;">
                                <div><i class="fas fa-building" style="color:#94a3b8; width:14px;"></i> <strong>Cơ quan:</strong> ${escapeHtml(entry.coQuanDieuTra || '—')}</div>
                                <div><i class="far fa-calendar-alt" style="color:#94a3b8; width:14px;"></i> <strong>Dự kiến HT:</strong> ${entry.ngayDuKienHoanThanh ? fmtDate(entry.ngayDuKienHoanThanh) : '—'}</div>
                                <!--<div><i class="far fa-user" style="color:#94a3b8; width:14px;"></i> <strong>Cán bộ:</strong> ${escapeHtml(entry.canBoDieuTraName || '—')}</div>-->
                            </div>
                            ${entry.ghiChuTienTrinh ? `
                                <div style="margin-top:10px; padding:8px 10px; background:#f8fafc; border-radius:4px; font-size:12px; color:#475569;">
                                    <div style="font-weight:600; color:#64748b; margin-bottom:2px; font-size:11px; text-transform:uppercase; letter-spacing:.3px;"><i class="far fa-sticky-note" style="margin-right:4px;"></i>Ghi chú tiến trình</div>
                                    <div>${nl2br(entry.ghiChuTienTrinh)}</div>
                                </div>` : ''}
                            ${entry.ketQuaDieuTra ? `
                                <div style="margin-top:10px; padding:10px 12px; background:#ecfdf5; border-left:3px solid #10b981; border-radius:4px; font-size:12px; color:#065f46;">
                                    <div style="font-weight:700; color:#047857; margin-bottom:4px; font-size:11px; text-transform:uppercase; letter-spacing:.3px;"><i class="fas fa-clipboard-check" style="margin-right:4px;"></i>Kết quả điều tra</div>
                                    <div>${nl2br(entry.ketQuaDieuTra)}</div>
                                </div>` : ''}
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            $('#dieutraTimeline').html(html);
        },

        loadVersions: function () {
            var self = this;
            $.ajax({
                url: `/TaiNanLaoDong/GetVersions/${self.tnldId}`,
                type: 'GET',
                success: function (response) {
                    if (response.success && response.data) {
                        self.renderVersions(response.data);
                    }
                },
                error: function () {
                    $('#versionsContainer').html('<p class="text-danger" style="font-size:13px;">Không thể tải lịch sử phiên bản</p>');
                }
            });
        },

        renderVersions: function (versions) {
            if (!versions || versions.length === 0) {
                $('#versionsContainer').html('<div class="text-center py-4" style="color:#94a3b8; font-size:13px;"><i class="fas fa-inbox fa-2x mb-2 d-block" style="color:#cbd5e1;"></i>Chưa có phiên bản nào</div>');
                return;
            }

            let html = '<div class="list-group">';
            versions.forEach(function (v) {
                html += `
                    <div class="list-group-item" style="border-left:3px solid var(--primary); margin-bottom:8px; border-radius:4px;">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong style="font-size:13px;">Phiên bản ${v.phienBan}</strong>
                                <div style="font-size:11px; color:#64748b; margin-top:2px;">
                                    ${new Date(v.createdAt).toLocaleString('vi-VN')} • ${v.createdBy}
                                </div>
                                ${v.lyDoTaoVersion ? `<div style="font-size:12px; color:#475569; margin-top:4px;"><em>${v.lyDoTaoVersion}</em></div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            $('#versionsContainer').html(html);
        },

        /* DISABLED: Files tab now uses server-side Razor rendering
        initTabHandlers: function () {
            var self = this;
            $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
                const target = $(e.target).attr('href');
                if (target === '#tabFiles') {
                    self.loadFiles();
                }
            });
        },

        loadFiles: function () {
            var self = this;
            $('#filesContainer').html('<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Đang tải...</div>');
            
            $.ajax({
                url: `/TaiNanLaoDong/GetFiles/${self.tnldId}`,
                type: 'GET',
                success: function (response) {
                    if (response.success && response.data && response.data.length > 0) {
                        self.renderFiles(response.data);
                    } else {
                        $('#filesContainer').html('<div class="text-center py-4" style="color:#94a3b8; font-size:13px;"><i class="fas fa-folder-open fa-2x mb-2 d-block" style="color:#cbd5e1;"></i>Chưa có tài liệu đính kèm</div>');
                    }
                },
                error: function () {
                    $('#filesContainer').html('<p class="text-danger" style="font-size:13px;">Không thể tải danh sách tài liệu</p>');
                }
            });
        },

        renderFiles: function (files) {
            let html = '<div class="table-responsive"><table class="table-figma w-100">';
            html += '<thead><tr><th class="text-center" style="width:45px;">STT</th><th>Tên file</th><th>Loại</th><th class="text-center" style="width:100px;">Kích thước</th><th class="text-center" style="width:130px;">Ngày tải</th><th class="text-center" style="width:70px;">Tải về</th></tr></thead><tbody>';
            
            files.forEach(function (file, index) {
                html += `
                    <tr>
                        <td class="text-center">${index + 1}</td>
                        <td><i class="fas fa-file-pdf text-danger mr-2"></i>${file.fileName}</td>
                        <td>${file.fileType || 'PDF'}</td>
                        <td class="text-center">${(file.fileSize / 1024).toFixed(2)} KB</td>
                        <td class="text-center">${new Date(file.uploadedAt).toLocaleString('vi-VN')}</td>
                        <td class="text-center">
                            <a href="/FileManager/Download/${file.id}" class="btn-action-figma btn-action-view" title="Tải về">
                                <i class="fas fa-download"></i>
                            </a>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            $('#filesContainer').html(html);
        },
        */

        initActionButtons: function () {
            var self = this;

            // Xác nhận
            $('#btnXacNhan').on('click', function () {
                const id = $(this).data('id');
                Swal.fire({
                    title: 'Xác nhận hồ sơ?',
                    text: 'Bạn có chắc chắn muốn xác nhận khai báo này?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#198754',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: 'Đồng ý xác nhận',
                    cancelButtonText: 'Hủy'
                }).then((result) => {
                    if (result.isConfirmed) {
                        self.xacNhan(id);
                    }
                });
            });

            // Modal: Yêu cầu bổ sung
            $('#confirmYeuCauBoSung').on('click', function () {
                const content = $('#yeuCauBoSungContent').val().trim();
                if (!content) {
                    toastr.warning('Vui lòng nhập nội dung yêu cầu bổ sung');
                    return;
                }
                const id = $('#btnYeuCauBoSung').data('id');
                self.yeuCauBoSung(id, content);
            });

            // Modal: Từ chối
            $('#confirmTuChoi').on('click', function () {
                const reason = $('#tuChoiReason').val().trim();
                if (!reason) {
                    toastr.warning('Vui lòng nhập lý do từ chối');
                    return;
                }
                const id = $('#btnTuChoi').data('id');
                self.tuChoi(id, reason);
            });

            // Chuyển điều tra
            $('#btnChuyenDieuTra').on('click', function () {
                const id = $(this).data('id');
                Swal.fire({
                    title: 'Chuyển sang giai đoạn điều tra?',
                    text: 'Hồ sơ sẽ được chuyển trạng thái Đang điều tra.',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#0d6efd',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: 'Đồng ý',
                    cancelButtonText: 'Hủy'
                }).then((result) => {
                    if (result.isConfirmed) {
                        self.chuyenDieuTra(id);
                    }
                });
            });

            // Modal: Đóng hồ sơ
            $('#confirmDongHoSo').on('click', function () {
                const ketLuan = $('#dongHoSoKetLuan').val().trim();
                const coQuan = $('#dongCoQuanDieuTra').val();
                const ngayDuKien = $('#dongNgayDuKien').val();

                if (!coQuan) { toastr.warning('Vui lòng chọn cơ quan điều tra'); return; }
                if (!ngayDuKien) { toastr.warning('Vui lòng chọn ngày dự kiến hoàn thành'); return; }
                if (!ketLuan) { toastr.warning('Vui lòng nhập kết quả điều tra'); return; }

                const id = $('#btnDongHoSo').data('id') || self.tnldId;
                self.dongHoSo(id, {
                    ketLuan: ketLuan,
                    coQuanDieuTra: coQuan,
                    ngayDuKienHoanThanh: ngayDuKien
                });
            });

            // Modal: Thêm thông tin điều tra (append-only)
            $('#confirmThemDieuTra').on('click', function () {
                const coQuan = $('#themCoQuanDieuTra').val();
                const trangThai = $('#themTrangThai').val();
                const ngayDuKien = $('#themNgayDuKien').val();
                const ghiChu = $('#themGhiChu').val().trim();

                if (!coQuan) { toastr.warning('Vui lòng chọn cơ quan điều tra'); return; }
                if (!trangThai) { toastr.warning('Vui lòng chọn trạng thái điều tra'); return; }
                if (!ngayDuKien) { toastr.warning('Vui lòng chọn ngày dự kiến hoàn thành'); return; }

                const id = $(this).data('id') || self.tnldId;
                self.addDieuTraEntry(id, {
                    trangThai: trangThai,
                    coQuanDieuTra: coQuan,
                    ngayDuKienHoanThanh: ngayDuKien,
                    ghiChuTienTrinh: ghiChu,
                    ketQuaDieuTra: ''
                });
            });
        },

        xacNhan: async function (id) {
            try {
                const response = await fetch('/TaiNanLaoDong/XacNhan', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
                    },
                    body: new URLSearchParams({ id: id })
                });
                const result = await response.json();
                if (result.success || result.isSuccess) {
                    toastr.success('Xác nhận khai báo thành công');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    toastr.error(result.message || 'Xác nhận thất bại');
                }
            } catch (error) {
                console.error('Xác nhận error:', error);
                toastr.error('Lỗi hệ thống');
            }
        },

        yeuCauBoSung: async function (id, content) {
            try {
                const response = await fetch('/TaiNanLaoDong/YeuCauBoSung', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
                    },
                    body: new URLSearchParams({ id: id, noiDung: content })
                });
                const result = await response.json();
                if (result.success || result.isSuccess) {
                    $('#modalYCBS').modal('hide');
                    toastr.success('Đã gửi yêu cầu bổ sung');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    toastr.error(result.message || 'Gửi yêu cầu thất bại');
                }
            } catch (error) {
                console.error('Yêu cầu bổ sung error:', error);
                toastr.error('Lỗi hệ thống');
            }
        },

        tuChoi: async function (id, reason) {
            try {
                const response = await fetch('/TaiNanLaoDong/TuChoi', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
                    },
                    body: new URLSearchParams({ id: id, lyDo: reason })
                });
                const result = await response.json();
                if (result.success || result.isSuccess) {
                    $('#modalTuChoi').modal('hide');
                    toastr.success('Đã từ chối hồ sơ');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    toastr.error(result.message || 'Từ chối thất bại');
                }
            } catch (error) {
                console.error('Từ chối error:', error);
                toastr.error('Lỗi hệ thống');
            }
        },

        dongHoSo: async function (id, payload) {
            try {
                const body = new URLSearchParams({
                    id: id,
                    ketLuan: payload.ketLuan,
                    coQuanDieuTra: payload.coQuanDieuTra || '',
                    ngayDuKienHoanThanh: payload.ngayDuKienHoanThanh || '',
                    ghiChuTienTrinh: payload.ghiChuTienTrinh || ''
                });
                const response = await fetch('/TaiNanLaoDong/DongHoSo', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
                    },
                    body: body
                });
                const result = await response.json();
                if (result.success || result.isSuccess) {
                    $('#modalDongHoSo').modal('hide');
                    toastr.success('Đã đóng hồ sơ điều tra');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    toastr.error(result.message || 'Đóng hồ sơ thất bại');
                }
            } catch (error) {
                console.error('Đóng hồ sơ error:', error);
                toastr.error('Lỗi hệ thống');
            }
        },

        chuyenDieuTra: async function (id) {
            try {
                const response = await fetch('/TaiNanLaoDong/ChuyenDieuTra', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
                    },
                    body: new URLSearchParams({ id: id })
                });
                const result = await response.json();
                if (result.success || result.isSuccess) {
                    toastr.success('Đã chuyển giai đoạn điều tra');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    toastr.error(result.message || 'Chuyển điều tra thất bại');
                }
            } catch (error) {
                console.error('Chuyển điều tra error:', error);
                toastr.error('Lỗi hệ thống');
            }
        },

        addDieuTraEntry: async function (id, payload) {
            try {
                const body = new URLSearchParams({
                    id: id,
                    trangThai: payload.trangThai,
                    coQuanDieuTra: payload.coQuanDieuTra,
                    ngayDuKienHoanThanh: payload.ngayDuKienHoanThanh,
                    ghiChuTienTrinh: payload.ghiChuTienTrinh || '',
                    ketQuaDieuTra: payload.ketQuaDieuTra || ''
                });
                const response = await fetch('/TaiNanLaoDong/AddDieuTraEntry', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
                    },
                    body: body
                });
                const result = await response.json();
                if (result.success || result.isSuccess) {
                    $('#modalThemDieuTra').modal('hide');
                    // Reset form
                    $('#themCoQuanDieuTra').val('');
                    $('#themTrangThai').val('DangThucHien');
                    $('#themNgayDuKien').val('');
                    $('#themGhiChu').val('');
                    $('#themKetQua').val('');
                    toastr.success('Đã thêm thông tin điều tra');
                    DetailsModule.loadDieuTraTimeline();
                } else {
                    toastr.error(result.message || 'Thêm thông tin điều tra thất bại');
                }
            } catch (error) {
                console.error('Thêm điều tra error:', error);
                toastr.error('Lỗi hệ thống');
            }
        }
    };

    // ==========================================
    // AUTO-INIT
    // ==========================================
    $(document).ready(function () {
        if ($('#tabThongTin').length) {
            DetailsModule.init();
        }
    });

})(jQuery);
