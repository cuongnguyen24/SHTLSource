/**
 * TNLD Báo cáo định kỳ - Form (Create/Edit) (M0142)
 * Mirror of M0141 tnld-form.js: Select2 bootstrap4, file array management, deletedFileIds, redirect to detail.
 */
(function ($) {
    'use strict';

    const Form = {
        urls: {
            searchEnterprises: '/TaiNanLaoDong/TaiNanLaoDongBaoCaoDinhKy/SearchEnterprises',
            getKyBaoCao: '/TaiNanLaoDong/TaiNanLaoDongBaoCaoDinhKy/GetKyBaoCaoOptions',
            indexUrl: '/TaiNanLaoDong/TaiNanLaoDongBaoCaoDinhKy/Index',
            chiTietUrl: '/TaiNanLaoDong/TaiNanLaoDongBaoCaoDinhKy/ChiTiet',
            fileDownload: '/FileManager/Download'
        },
        kyBaoCaoMap: {},
        cfg: {},
        isEdit: false,
        fileScanVBGocList: [],
        fileList: [],
        deletedFileIds: [],
        maxFileSize: 10 * 1024 * 1024,
        maxFileCount: 10,

        init: function () {
            this.cfg = window.bcdkFormConfig || {};
            this.isEdit = this.cfg.isEdit === true;
            this.initEnterpriseSelect();
            this.initKyBaoCaoSelect();
            this.initVBGocUpload();
            this.initOtherFilesUpload();
            this.bindEvents();
            if (this.isEdit) this.loadExistingData();
        },

        initEnterpriseSelect: function () {
            const self = this;
            const $sel = $('#enterpriseId');
            if ($sel.prop('disabled')) return;
            $sel.select2({
                placeholder: 'Tìm kiếm doanh nghiệp...',
                allowClear: true,
                width: '100%',
                theme: 'bootstrap4',
                ajax: {
                    url: self.urls.searchEnterprises,
                    dataType: 'json',
                    delay: 300,
                    data: params => ({
                        searchTerm: params.term || '',
                        pageNumber: params.page || 1,
                        pageSize: 20
                    }),
                    processResults: (resp, params) => {
                        params.page = params.page || 1;
                        const items = (resp && resp.data && resp.data.items) || [];
                        const total = (resp && resp.data && resp.data.totalCount) || 0;
                        return {
                            results: items.map(e => ({
                                id: e.id || e.Id,
                                text: ((e.name || e.Name) || '') + ' (' + ((e.taxCode || e.TaxCode) || '—') + ')',
                                data: e
                            })),
                            pagination: { more: params.page * 20 < total }
                        };
                    },
                    cache: true
                }
            }).on('select2:select', function (ev) {
                self.populateEnterpriseInfo(ev.params.data.data || ev.params.data);
            }).on('select2:clear', function () {
                $('#enterpriseInfoSection').hide();
            });
        },

        populateEnterpriseInfo: function (e) {
            if (!e) { $('#enterpriseInfoSection').hide(); return; }
            $('#entTaxCode').text(e.taxCode || e.TaxCode || '—');
            $('#entIZone').text(e.industrialZoneName || e.IndustrialZoneName || '—');
            $('#entIndustry').text(e.industryName || e.IndustryName || '—');
            const repName = e.legalRepresentative || e.LegalRepresentative || '';
            const repPos = e.position || e.Position || '';
            const repDisplay = (repName && repPos) ? `${repPos} - ${repName}` : (repName || repPos || '—');
            $('#entRepresentative').text(repDisplay);
            $('#entPhone').text(e.phone || e.Phone || '—');
            $('#entEmail').text(e.email || e.Email || '—');
            $('#entAddress').text(e.address || e.Address || '—');
            $('#enterpriseInfoSection').fadeIn();
        },

        initKyBaoCaoSelect: function () {
            const self = this;
            const $sel = $('#kyBaoCaoId');
            const isFixed = $sel.prop('disabled');
            $sel.select2({
                placeholder: 'Chọn kỳ báo cáo...',
                allowClear: true,
                width: '100%',
                theme: 'bootstrap4'
            });

            $.get(self.urls.getKyBaoCao, function (resp) {
                if (!(resp && resp.success && Array.isArray(resp.data))) return;
                resp.data.forEach(k => {
                    self.kyBaoCaoMap[k.id] = k;
                    if (!isFixed) {
                        $sel.append(`<option value="${k.id}">${k.tenKy} - ${k.nam}</option>`);
                    }
                });
            });

            $sel.on('change', function () {
                const id = $(this).val();
                const k = self.kyBaoCaoMap[id];
                if (k) {
                    $('#kyNam').val(k.nam);
                    $('#kyHanNop').val(k.hanNop ? new Date(k.hanNop).toLocaleDateString('vi-VN') : '');
                } else {
                    $('#kyNam').val('');
                    $('#kyHanNop').val('');
                }
            });
        },

        // ========== FILE UPLOAD: VB GỐC ==========
        initVBGocUpload: function () {
            const self = this;
            const $input = $('#fileScanVBGoc');
            const $preview = $('#previewVBGoc');

            $input.on('change', function (e) {
                const files = e.target.files;
                if (!files || files.length === 0) return;
                let validCount = 0;
                for (let i = 0; i < files.length; i++) {
                    const f = files[i];
                    if (f.size > self.maxFileSize) { toastr.error(`File "${f.name}" vượt quá 10MB`); continue; }
                    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
                    if (!allowed.includes(f.type)) { toastr.error(`File "${f.name}" không đúng định dạng (PDF, JPG, PNG)`); continue; }
                    self.fileScanVBGocList.push({
                        id: 'new_' + Date.now() + Math.random(),
                        file: f, name: f.name, size: f.size, type: f.type, isExisting: false
                    });
                    validCount++;
                }
                $(this).val('');
                if (validCount > 0) self.renderVBGocList();
            });

            $preview.on('click', '.add-more-vbgoc', function () { $input.click(); });
        },

        renderVBGocList: function () {
            const self = this;
            const $preview = $('#previewVBGoc');
            if (this.fileScanVBGocList.length === 0) { $preview.html('').hide(); return; }

            let html = '<div class="mt-2">';
            html += `<div style="font-size:11px; font-weight:700; color:var(--primary); text-transform:uppercase; margin-bottom:8px; background:var(--primary-light); padding:6px 10px; border-radius:6px; border-left:3px solid var(--primary);">`;
            html += `<i class="fas fa-paperclip mr-1"></i>File VB gốc đã chọn (${this.fileScanVBGocList.length})</div>`;
            html += '<div class="table-responsive"><table class="table-figma w-100"><thead><tr>';
            html += '<th style="width:45px;" class="text-center">#</th><th>Tên file</th><th style="width:100px;" class="text-center">Kích thước</th><th style="width:80px;" class="text-center">Loại</th><th style="width:80px;" class="text-center">Hành động</th>';
            html += '</tr></thead><tbody>';

            this.fileScanVBGocList.forEach((fo, idx) => {
                const isExisting = fo.isExisting === true;
                const fileName = isExisting ? fo.fileName : fo.name;
                const sizeKB = isExisting ? (fo.fileSize ? (fo.fileSize / 1024).toFixed(1) + ' KB' : '—') : (fo.size / 1024).toFixed(1) + ' KB';
                const ext = (fileName || '').split('.').pop().toUpperCase();
                const iconCls = ext === 'PDF' ? 'fa-file-pdf text-danger' : 'fa-file-image text-info';
                let nameDisplay = `<span class="font-weight-medium">${self.escape(fileName)}</span>`;
                if (isExisting) nameDisplay = `<a href="${self.urls.fileDownload}/${fo.id}" target="_blank" class="font-weight-medium">${self.escape(fileName)}</a>`;
                html += `<tr><td class="text-center">${idx + 1}</td><td><i class="fas ${iconCls} mr-2"></i>${nameDisplay}</td><td class="text-center">${sizeKB}</td><td class="text-center"><span class="badge badge-light border">${ext}</span></td><td class="text-center"><button type="button" class="btn text-danger btn-sm p-0" onclick="BCDKForm.removeVBGocFile(${idx})" title="Xóa"><i class="fas fa-times-circle" style="font-size:16px;"></i></button></td></tr>`;
            });
            html += '</tbody></table></div>';
            html += '<div class="text-center mt-2"><button type="button" class="btn btn-sm btn-outline-primary add-more-vbgoc"><i class="fas fa-plus mr-1"></i>Thêm file khác</button></div></div>';
            $preview.html(html).show();
        },

        removeVBGocFile: function (idx) {
            const fo = this.fileScanVBGocList[idx];
            if (fo && fo.isExisting && fo.id) this.deletedFileIds.push(fo.id);
            this.fileScanVBGocList.splice(idx, 1);
            this.renderVBGocList();
        },

        // ========== FILE UPLOAD: OTHER ==========
        initOtherFilesUpload: function () {
            const self = this;
            const $input = $('#otherFiles');
            const $preview = $('#previewOtherFiles');

            $input.on('change', function (e) {
                const files = e.target.files;
                if (!files || files.length === 0) return;
                if (self.fileList.length + files.length > self.maxFileCount) {
                    toastr.error(`Tối đa ${self.maxFileCount} files đính kèm khác`);
                    $(this).val(''); return;
                }
                let validCount = 0;
                Array.from(files).forEach(f => {
                    if (f.size > self.maxFileSize) { toastr.error(`File "${f.name}" vượt quá 10MB`); return; }
                    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];
                    const fname = f.name.toLowerCase();
                    if (!allowed.some(ext => fname.endsWith(ext))) { toastr.error(`File "${f.name}" không hỗ trợ`); return; }
                    self.fileList.push({
                        id: 'new_' + Date.now() + Math.random(),
                        file: f, name: f.name, size: f.size, type: f.type, isExisting: false
                    });
                    validCount++;
                });
                $(this).val('');
                if (validCount > 0) self.renderOtherList();
            });

            $preview.on('click', '.add-more-other', function () { $input.click(); });
        },

        renderOtherList: function () {
            const self = this;
            const $preview = $('#previewOtherFiles');
            if (this.fileList.length === 0) { $preview.html('').hide(); return; }

            let html = '<div class="mt-2">';
            html += `<div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:8px; background:#f8fafc; padding:6px 10px; border-radius:6px; border-left:3px solid #64748b;">`;
            html += `<i class="fas fa-paperclip mr-1"></i>File đính kèm khác (${this.fileList.length})</div>`;
            html += '<div class="table-responsive"><table class="table-figma w-100"><thead><tr>';
            html += '<th style="width:45px;" class="text-center">#</th><th>Tên file</th><th style="width:100px;" class="text-center">Kích thước</th><th style="width:80px;" class="text-center">Loại</th><th style="width:80px;" class="text-center">Hành động</th>';
            html += '</tr></thead><tbody>';

            this.fileList.forEach((fo, idx) => {
                const isExisting = fo.isExisting === true;
                const fileName = isExisting ? fo.fileName : fo.name;
                const sizeKB = isExisting ? (fo.fileSize ? (fo.fileSize / 1024).toFixed(1) + ' KB' : '—') : (fo.size / 1024).toFixed(1) + ' KB';
                const ext = (fileName || '').split('.').pop().toUpperCase();
                let iconCls = 'fa-file text-secondary';
                if (ext === 'PDF') iconCls = 'fa-file-pdf text-danger';
                else if (['DOC', 'DOCX'].includes(ext)) iconCls = 'fa-file-word text-primary';
                else if (['XLS', 'XLSX'].includes(ext)) iconCls = 'fa-file-excel text-success';
                else if (['JPG', 'JPEG', 'PNG'].includes(ext)) iconCls = 'fa-file-image text-info';
                let nameDisplay = `<span class="font-weight-medium">${self.escape(fileName)}</span>`;
                if (isExisting) nameDisplay = `<a href="${self.urls.fileDownload}/${fo.id}" target="_blank" class="font-weight-medium">${self.escape(fileName)}</a>`;
                html += `<tr><td class="text-center">${idx + 1}</td><td><i class="fas ${iconCls} mr-2"></i>${nameDisplay}</td><td class="text-center">${sizeKB}</td><td class="text-center"><span class="badge badge-light border">${ext}</span></td><td class="text-center"><button type="button" class="btn text-danger btn-sm p-0" onclick="BCDKForm.removeOtherFile(${idx})" title="Xóa"><i class="fas fa-times-circle" style="font-size:16px;"></i></button></td></tr>`;
            });
            html += '</tbody></table></div>';
            html += '<div class="text-center mt-2"><button type="button" class="btn btn-sm btn-outline-primary add-more-other"><i class="fas fa-plus mr-1"></i>Thêm tài liệu</button></div></div>';
            $preview.html(html).show();
        },

        removeOtherFile: function (idx) {
            const fo = this.fileList[idx];
            if (fo && fo.isExisting && fo.id) this.deletedFileIds.push(fo.id);
            this.fileList.splice(idx, 1);
            this.renderOtherList();
        },

        loadExistingData: function () {
            const data = this.cfg.initialData;
            if (!data) return;

            // Populate enterprise info from initialData (DTO has limited fields - no email/address)
            this.populateEnterpriseInfo({
                taxCode: data.enterpriseTaxCode,
                industrialZoneName: data.industrialZoneName,
                phone: data.phone,
                email: data.email,
                legalRepresentative: data.legalRepresentative,
                address: data.address,
                industryName: data.industryName
            });

            // KyBaoCao display
            if (data.kyBaoCaoId) {
                $('#kyNam').val(data.nam || '');
                $('#kyHanNop').val(data.hanNop ? new Date(data.hanNop).toLocaleDateString('vi-VN') : '');
            }

            // Files
            if (data.files && Array.isArray(data.files)) {
                data.files.forEach(f => {
                    const item = {
                        id: f.id, fileName: f.fileName, fileSize: f.fileSize, fileUrl: f.fileUrl,
                        category: f.category, isExisting: true
                    };
                    if (f.category === 'SCAN_VB_GOC') this.fileScanVBGocList.push(item);
                    else this.fileList.push(item);
                });
                this.renderVBGocList();
                this.renderOtherList();
            }
        },

        bindEvents: function () {
            const self = this;
            $('#btnHeaderSubmit').on('click', () => self.submitForm());
            $('#soVuTNLD, #soVuChetNguoi, #soVuNang, #soVuNhe').on('blur', () => self.validateSoVu());
        },

        validateSoVu: function () {
            const total = parseInt($('#soVuTNLD').val() || 0);
            const sum = (parseInt($('#soVuChetNguoi').val() || 0)) + (parseInt($('#soVuNang').val() || 0)) + (parseInt($('#soVuNhe').val() || 0));
            if (total < sum) {
                toastr.warning(`Tổng số vụ (${total}) phải ≥ chết + nặng + nhẹ (${sum})`);
                return false;
            }
            return true;
        },

        submitForm: function () {
            const self = this;
            const $form = $('#formBCDK');

            const required = ['#enterpriseId', '#kyBaoCaoId', '#tongSoNLD', '#soVuTNLD', '#soVuChetNguoi', '#soVuNang', '#soVuNhe', '#tongNgayNghi'];
            for (const sel of required) {
                if (!$(sel).val() && $(sel).val() !== 0 && $(sel).val() !== '0') {
                    toastr.error('Vui lòng điền đầy đủ thông tin bắt buộc');
                    $(sel).focus(); return;
                }
            }

            if (!self.validateSoVu()) return;

            // VB Gốc required when create OR when edit and existing list cleared
            const totalVbGoc = self.fileScanVBGocList.length;
            if (!self.isEdit && totalVbGoc === 0) {
                toastr.error('Vui lòng chọn ít nhất 1 file VB gốc PA-B');
                return;
            }

            const $btn = $('#btnHeaderSubmit');
            const originalHtml = $btn.html();
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Đang gửi...');

            const formData = new FormData($form[0]);
            // Reset file inputs (we manage files via arrays)
            formData.delete('FileScanVBGoc');
            formData.delete('OtherFiles');

            // Append NEW files only
            self.fileScanVBGocList.forEach(fo => {
                if (!fo.isExisting && fo.file) formData.append('FileScanVBGoc', fo.file);
            });
            self.fileList.forEach(fo => {
                if (!fo.isExisting && fo.file) formData.append('OtherFiles', fo.file);
            });

            // Deleted file IDs as CSV (matches controller form binding string?)
            if (self.deletedFileIds.length > 0) {
                formData.append('DeleteFileIds', self.deletedFileIds.join(','));
            }

            $.ajax({
                url: $form.attr('action'),
                type: 'POST',
                data: formData,
                contentType: false,
                processData: false,
                success: function (resp) {
                    if (resp && resp.success) {
                        toastr.success(resp.message || (self.isEdit ? 'Cập nhật thành công' : 'Tạo báo cáo thành công'));
                        const newId = resp.id || (self.cfg.recordId);
                        setTimeout(() => {
                            window.location.href = newId ? `${self.urls.chiTietUrl}?id=${newId}` : self.urls.indexUrl;
                        }, 800);
                    } else {
                        toastr.error((resp && resp.message) || 'Thao tác thất bại');
                        $btn.prop('disabled', false).html(originalHtml);
                    }
                },
                error: function (xhr) {
                    if (typeof TNLDShared !== 'undefined') TNLDShared.handleAjaxError(xhr, 'Lỗi khi gửi báo cáo');
                    else toastr.error('Lỗi khi gửi báo cáo');
                    $btn.prop('disabled', false).html(originalHtml);
                }
            });
        },

        escape: function (s) {
            if (s == null) return '';
            return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }
    };

    window.BCDKForm = Form; // expose for inline onclick
    $(document).ready(() => Form.init());
})(jQuery);
