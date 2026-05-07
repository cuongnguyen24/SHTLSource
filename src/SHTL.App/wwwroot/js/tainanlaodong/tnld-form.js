/**
 * TNLD Form JavaScript (M0141 NhapThayPA_B - v2.0 Figma)
 * Pattern: FormModule + Dynamic table + File upload + Draft save
 */
(function ($) {
    'use strict';

    // ==========================================
    // FORM MODULE
    // ==========================================
    var FormModule = {
        nguoiBiNanList: [],
        fileList: [],
        fileScanVBGocList: [], // Changed from single file to array
        deletedFileIds: [], // Track file IDs to delete from server
        config: window.formConfig || {},
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFileCount: 10,
        countdownInterval: null, // Add countdown interval tracker

        init: function () {
            this.initCategoryDropdowns();
            this.initEnterpriseSelect2();
            this.initNguoiBiNanModal();
            this.initFileUpload();
            this.initVBGocUpload(); // VB gốc upload (multiple files)
            this.initFormActions();

            // Load existing data if edit mode
            if (this.config.isEdit) {
                this.loadExistingData();
            }

            this.updateEmptyStates();
        },

        initEnterpriseSelect2: function () {
            var self = this;


            if ($('#enterpriseId').prop('disabled') && !this.config.isSupplement) {
                return; // Skip if edit mode (disabled) and NOT supplement
            }

            $('#enterpriseId').select2({
                ajax: {
                    url: '/TaiNanLaoDong/SearchEnterprises',
                    dataType: 'json',
                    delay: 300,
                    data: function (params) {
                        return {
                            searchTerm: params.term || '',
                            pageNumber: params.page || 1,
                            pageSize: 20
                        };
                    },
                    processResults: function (result, params) {
                        var items = result.data?.items || [];
                        return {
                            results: items.map(function (e) {
                                return {
                                    id: e.id || e.Id,
                                    text: (e.name || e.Name) + ' (' + (e.taxCode || e.TaxCode || '—') + ')',
                                    data: e
                                };
                            }),
                            pagination: {
                                more: (params.page * 20) < (result.data?.totalCount || 0)
                            }
                        };
                    },
                    cache: true,
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.error('❌ [TNLD AJAX ERROR]', textStatus, errorThrown);
                        console.error('❌ [TNLD AJAX ERROR] Response:', jqXHR.responseText);
                    }
                },
                placeholder: 'Tìm theo tên hoặc MST...',
                minimumInputLength: 0,
                theme: 'bootstrap4',
                width: '100%'
            }).on('select2:opening', function (e) {
            }).on('select2:select', function (e) {
                const enterprise = e.params.data.data;
                self.populateEnterpriseInfo(enterprise);
            });
        },

        populateEnterpriseInfo: function (enterprise) {
            if (!enterprise) {
                $('#enterpriseInfoSection').hide();
                $('#enterpriseTaxCode').val('');
                $('#industrialZoneId').val('');
                return;
            }

            // Set hidden fields for backend (pattern: NhuCauTuyenDung line 500-501)
            $('#enterpriseTaxCode').val(enterprise.taxCode || enterprise.TaxCode || '');
            $('#industrialZoneId').val(enterprise.industrialZoneId || enterprise.IndustrialZoneId || '');

            // Show enterprise info panel
            $('#enterpriseInfoSection').fadeIn();

            // Populate enterprise info display fields (robust mapping for CamelCase/PascalCase)
            $('#entTaxCode').text(enterprise.taxCode || enterprise.TaxCode || '—');

            // Aggregate Industries: Primary Industry + Investment Projects (like reference module)
            var industries = [];
            var primaryInd = enterprise.industryName || enterprise.IndustryName;
            if (primaryInd) industries.push(primaryInd);

            var projs = enterprise.investmentProjects || enterprise.InvestmentProjects;
            if (projs && Array.isArray(projs)) {
                projs.forEach(function (proj) {
                    var projInd = proj.industryName || proj.IndustryName;
                    if (projInd && industries.indexOf(projInd) === -1) {
                        industries.push(projInd);
                    }
                });
            }
            $('#entIndustry').text(industries.length > 0 ? industries.join('; ') : '—');

            $('#entIZone').text(enterprise.industrialZoneName || enterprise.IndustrialZoneName || '—');

            // Representative info with fallback (like reference module)
            var repName = enterprise.legalRepresentative || enterprise.LegalRepresentative || '';
            var repPos = enterprise.position || enterprise.Position || '';
            var repDisplay = '';
            if (repName && repPos) {
                repDisplay = repPos + ' - ' + repName;
            } else {
                repDisplay = repName || repPos || '';
            }
            $('#entRepresentative').text(repDisplay || '—');

            $('#entPhone').text(enterprise.phone || enterprise.Phone || enterprise.phoneNumber || '—');
            $('#entEmail').text(enterprise.email || enterprise.Email || '—');
            $('#entAddress').text(enterprise.address || enterprise.Address || '—');

            // Enable worker search after enterprise selected
            $('#selectLaborWorker').prop('disabled', false);
        },

        initCategoryDropdowns: function () {
            var self = this;

            // CategoryType API pattern: GetByTypeCode
            const categories = [
                { typeCode: 'TNLD_LOAI', selector: '#loaiTNLD', useCode: false },
                { typeCode: 'TNLD_NGUYEN_NHAN', selector: '#nguyenNhan', useCode: false },
                { typeCode: 'TNLD_HINH_THUC', selector: '#hinhThuc', useCode: false },
                { typeCode: 'TNLD_TINH_TRANG', selector: '#tinhTrangNLDChung', useCode: false },
                { typeCode: 'TNLD_BO_PHAN', selector: '#modalBoPhanBiThuong', useCode: false },
                { typeCode: 'TNLD_TINH_TRANG', selector: '#modalTinhTrang', useCode: false }
            ];

            categories.forEach(cat => {
                $.get(`/CategoryType/GetByTypeCode?typeCode=${cat.typeCode}`, function (response) {
                    const $select = $(cat.selector);
                    if (response.success && response.data) {
                        response.data.forEach(item => {
                            const val = cat.useCode ? item.code : item.id;
                            $select.append(`<option value="${val}" data-code="${item.code}">${item.name}</option>`);
                        });
                    }
                }).fail(function () {
                    console.warn(`Failed to load category: ${cat.typeCode}`);
                });
            });

            // Initialize Select2 for static selects (exclude enterprise search processed in initEnterpriseSelect2)
            $('.select2:not(#enterpriseId)').select2({
                theme: 'bootstrap4',
                width: '100%',
                allowClear: true
            });

            // Initialize multi-select for Bộ phận bị thương
            $('#modalBoPhanBiThuong').select2({
                theme: 'bootstrap4',
                width: '100%',
                placeholder: 'Chọn bộ phận (có thể chọn nhiều)',
                allowClear: true,
                multiple: true
            });

            // Conditional validation for BenhVien
            this.initBenhVienConditionalValidation();

            // Countdown timer logic for Loại TNLĐ = LOAI_CHETNGUOI
            this.initCountdownTimer();
        },

        initBenhVienConditionalValidation: function () {
            $('#tinhTrangNLDChung').on('change', function () {
                const selectedText = $(this).find('option:selected').text().toLowerCase();
                const $benhVien = $('#benhVien');
                const $required = $('#benhVienRequired');

                // Check if selected option contains "điều trị" or "đang điều trị"
                if (selectedText.includes('điều trị')) {
                    $benhVien.attr('required', true);
                    $required.show();
                } else {
                    $benhVien.removeAttr('required');
                    $required.hide();
                }
            });
        },

        initCountdownTimer: function () {
            var self = this;
            var countdownInterval = null;

            // Create countdown panel HTML (initially hidden)
            const countdownHtml = `
                <div id="countdownPanel" class="alert alert-warning mt-3" style="display:none; border-radius:8px; border:2px solid #f59e0b;">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-clock fa-2x mr-3" style="color:#f59e0b;"></i>
                        <div>
                            <strong style="font-size:13px;">Thời hạn báo cáo 24h (Loại chết người)</strong>
                            <div id="countdownTimer" style="font-size:20px; font-weight:700; color:#dc2626; margin-top:4px;">
                                23:59:59 còn lại
                            </div>
                            <small style="font-size:11px; color:#64748b;">Khai báo phải hoàn thành trong 24h kể từ thời điểm xảy ra tai nạn</small>
                        </div>
                    </div>
                </div>
            `;

            // Insert countdown panel after "Loại TNLĐ" row
            if ($('#countdownPanel').length === 0) {
                $(countdownHtml).insertAfter($('#loaiTNLD').closest('.row'));
            }

            // Watch for Loại TNLĐ changes
            $('#loaiTNLD').on('change', function () {
                const selectedCode = $(this).find('option:selected').data('code');

                if (selectedCode === 'LOAI_CHETNGUOI') {
                    self.startCountdown();
                } else {
                    self.stopCountdown();
                }
            });

            // Store countdown interval
            this.countdownInterval = countdownInterval;
        },

        startCountdown: function () {
            var self = this;
            const ngayGioXayRa = $('#ngayGioXayRa').val();

            if (!ngayGioXayRa) {
                toastr.warning('Vui lòng chọn "Ngày giờ xảy ra" để xem đồng hồ đếm ngược');
                return;
            }

            const accidentTime = new Date(ngayGioXayRa).getTime();
            const deadline24h = accidentTime + (24 * 60 * 60 * 1000); // Add 24 hours

            // Show countdown panel
            $('#countdownPanel').fadeIn();

            // Clear existing interval
            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
            }

            // Start countdown
            this.countdownInterval = setInterval(function () {
                const now = new Date().getTime();
                const distance = deadline24h - now;

                if (distance < 0) {
                    clearInterval(self.countdownInterval);
                    $('#countdownTimer').html('<span style="color:#dc2626;">ĐÃ QUÁ HẠN 24H!</span>');
                    return;
                }

                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                $('#countdownTimer').text(
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} còn lại`
                );
            }, 1000);
        },

        stopCountdown: function () {
            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
            }
            $('#countdownPanel').fadeOut();
        },

        initNguoiBiNanModal: function () {
            var self = this;

            // Open modal
            $('#btnAddNguoiBiNan').on('click', function () {
                $('#formNguoiBiNan')[0].reset();
                $('#modalNguoiBiNan .select2').val('').trigger('change');
                $('#modalLaborWorkerId').val('');
                $('#modalNguoiBiNan').modal('show');
                $('#selectLaborWorker').prop('disabled', false).val('').trigger('change');

                // Re-initialize Nationality dropdown if needed (Select2 AJAX)
                self.initNationalitySelect();
            });

            // Labor worker search (Select2 AJAX)
            const workerSearchUrl = '/Labor/SearchWorkersByEnterprise';

            $('#selectLaborWorker').select2({
                ajax: {
                    url: function (params) {
                        return workerSearchUrl;
                    },
                    dataType: 'json',
                    delay: 400,
                    data: function (params) {
                        const enterpriseId = $('#enterpriseId').val();

                        if (!enterpriseId) {
                            toastr.warning('Vui lòng chọn doanh nghiệp trước');
                            return null;
                        }

                        return {
                            search: params.term || '',
                            searchTerm: params.term || '',
                            enterpriseId: enterpriseId,
                            page: params.page || 1,
                            pageNumber: params.page || 1,
                            pageSize: 20
                        };
                    },
                    processResults: function (response, params) {
                        let items = [];
                        if (response.data) {
                            items = response.data.items || response.data || [];
                        } else if (response.items) {
                            items = response.items;
                        } else if (Array.isArray(response)) {
                            items = response;
                        }

                        return {
                            results: items.map(function (item) {
                                const hoTen = item.hoTen || item.HoTen || item.fullName || item.FullName || '—';
                                // Sử dụng trường cccdHoChieu (raw) từ Backend (hỗ trợ cả camelCase và PascalCase)
                                const cccd = item.cccdHoChieu || item.CccdHoChieu || '—';

                                return {
                                    id: item.id || item.Id,
                                    text: `${hoTen} - ${cccd}`,
                                    worker: item
                                };
                            }),
                            pagination: {
                                more: (params.page * 20) < (response.data?.totalCount || response.totalCount || items.length)
                            }
                        };
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.error('❌ [WORKER SEARCH ERROR]', textStatus, errorThrown);
                        toastr.error('Không thể tìm thấy thông tin lao động.');
                    }
                },
                placeholder: 'Tìm kiếm theo tên, CCCD...',
                minimumInputLength: 2,
                dropdownParent: $('#modalNguoiBiNan'),
                language: {
                    inputTooShort: function () { return 'Vui lòng nhập ít nhất 2 ký tự'; },
                    searching: function () { return 'Đang tìm kiếm...'; },
                    noResults: function () { return 'Không tìm thấy kết quả'; }
                }
            }).on('select2:select', function (e) {
                const worker = e.params.data.worker;
                if (worker) {
                    $('#modalLaborWorkerId').val(worker.id || worker.Id || '');
                    self.populateModalFromWorker(worker);
                }
            });

            // Initialize Nationality Select2
            this.initNationalitySelect();


            // Save button
            $('#btnSaveNguoiBiNan').on('click', function () {
                self.addNguoiBiNan();
            });
        },

        initNationalitySelect: function () {
            const self = this;
            const $el = $('#modalQuocTich');
            if ($el.length === 0) return;

            // Nếu Select2 đã được khởi tạo, hủy đi để đảm bảo cấu hình AJAX mới được áp dụng
            if ($el.hasClass('select2-hidden-accessible')) {
                $el.select2('destroy');
            }

            $el.select2({
                ajax: {
                    url: '/Countries/GetForSelect2',
                    dataType: 'json',
                    delay: 250,
                    data: function (params) {
                        return {
                            keyword: params.term || '',
                            pageIndex: params.page || 1,
                            pageSize: 20 // Tăng pageSize để lấy được nhiều kết quả hơn
                        };
                    },
                    processResults: function (data, params) {
                        params.page = params.page || 1;
                        let results = [];
                        let more = false;

                        // Dự án thường trả về ApiResponse có Data chứa Items hoặc Categories
                        // Hoặc trả về trực tiếp PagedResult
                        let rawData = data.categories || data.items || data.Items || (Array.isArray(data) ? data : []);

                        if (rawData && rawData.length > 0) {
                            results = rawData.map(function (item) {
                                return {
                                    id: item.id || item.Id || item.ID,
                                    text: item.name || item.Name || item.text || item.Text
                                };
                            });
                        }

                        if (data.pagination) more = data.pagination.more;
                        else if (data.Pagination) more = data.Pagination.More;

                        return {
                            results: results,
                            pagination: { more: more }
                        };
                    },
                    cache: true
                },
                placeholder: 'Chọn quốc tịch...',
                allowClear: true,
                theme: 'bootstrap4',
                width: '100%',
                dropdownParent: $('#modalNguoiBiNan'),
                language: {
                    searching: function () { return 'Đang tải...'; },
                    noResults: function () { return 'Không tìm thấy kết quả'; }
                }
            });
        },

        populateModalFromWorker: function (worker) {
            // Mapping giúp xử lý cả CamelCase và PascalCase từ API
            const hoTen = worker.hoTen || worker.HoTen || '';
            // Sử dụng trường cccdHoChieu (raw) từ Backend (hỗ trợ cả camelCase và PascalCase)
            const cccd = worker.cccdHoChieu || worker.CccdHoChieu || '';
            const gioiTinhValue = worker.gioiTinh || worker.GioiTinh || 'Nam';
            const quocTichId = worker.quocTichId || worker.QuocTichId;
            const quocTichName = worker.quocTichName || worker.QuocTichName || 'Việt Nam';
            const viTri = worker.viTriChucDanh || worker.ViTriChucDanh || worker.viTri || worker.ViTri || '';

            // Gender mapping: Nam/Nu/Khac (from Enum) -> Nam/Nữ/Khác (UI)
            const genderMap = {
                'Nam': 'Nam', 'Nu': 'Nữ', 'Khac': 'Khác',
                'Male': 'Nam', 'Female': 'Nữ', 'Other': 'Khác'
            };
            const displayGender = genderMap[gioiTinhValue] || gioiTinhValue;

            $('#modalHoTen').val(hoTen);
            $('#modalCCCD').val(cccd);
            $('#modalGioiTinh').val(displayGender).trigger('change');
            $('#modalViTri').val(viTri);

            // Set Nationality (Select2)
            if (quocTichId) {
                const newOption = new Option(quocTichName, quocTichId, true, true);
                $('#modalQuocTich').append(newOption).trigger('change');
            } else {
                $('#modalQuocTich').val(null).trigger('change');
            }

            // Formatted Date of Birth (YYYY-MM-DD for input type="date")
            const ngaySinh = worker.ngaySinh || worker.NgaySinh;
            if (ngaySinh) {
                const d = new Date(ngaySinh);
                if (!isNaN(d.getTime())) {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    $('#modalNgaySinh').val(`${year}-${month}-${day}`);
                } else {
                    $('#modalNgaySinh').val('');
                }
            } else {
                $('#modalNgaySinh').val('');
            }
        },

        addNguoiBiNan: function () {
            const hoTen = $('#modalHoTen').val().trim();
            const cccd = $('#modalCCCD').val().trim();
            const boPhanIds = $('#modalBoPhanBiThuong').val(); // Array for multi-select
            const ngayVaoVien = $('#modalNgayVaoVien').val();
            const tinhTrangId = $('#modalTinhTrang').val();

            if (!hoTen || !cccd) {
                toastr.error('Họ tên và CCCD là bắt buộc');
                return;
            }

            if (!boPhanIds || boPhanIds.length === 0) {
                toastr.warning('Vui lòng chọn ít nhất một bộ phận bị thương');
                return;
            }

            if (!ngayVaoVien) {
                toastr.error('Vui lòng nhập ngày vào viện');
                return;
            }

            if (!tinhTrangId) {
                toastr.error('Vui lòng chọn tình trạng');
                return;
            }

            // Get selected bộ phận names
            const boPhanNames = $('#modalBoPhanBiThuong option:selected').map(function () {
                return $(this).text();
            }).get().join(', ');

            const ngaySinh = $('#modalNgaySinh').val();
            const ngaySinhDisplay = ngaySinh ? new Date(ngaySinh).toLocaleDateString('vi-VN') : '—';

            const nguoi = {
                id: Date.now(),
                LaborWorkerId: $('#modalLaborWorkerId').val(),
                hoTen: hoTen,
                cccd: cccd,
                gioiTinh: $('#modalGioiTinh').val(),
                ngaySinh: ngaySinh,
                ngaySinhDisplay: ngaySinhDisplay,
                viTri: $('#modalViTri').val(),
                BoPhanBiThuong: boPhanIds, // Array of Guids (multi-select)
                boPhanBiThuongDisplay: boPhanNames, // For UI table
                NgayVaoVien: ngayVaoVien,
                ngayVaoVienDisplay: new Date(ngayVaoVien).toLocaleString('vi-VN'),
                TinhTrangNBN: tinhTrangId,
                tinhTrangDisplay: $('#modalTinhTrang option:selected').text()
            };

            this.nguoiBiNanList.push(nguoi);
            this.renderNguoiBiNanTable();
            $('#modalNguoiBiNan').modal('hide');
            toastr.success(`Thêm "${hoTen}" vào danh sách`);
        },

        renderNguoiBiNanTable: function () {
            const $tbody = $('#tableNguoiBiNan tbody');
            $tbody.empty();

            if (this.nguoiBiNanList.length === 0) {
                this.updateEmptyStates();
                return;
            }

            this.nguoiBiNanList.forEach((nguoi, index) => {
                const row = `
                    <tr>
                        <td class="text-center">${index + 1}</td>
                        <td class="font-weight-medium">${nguoi.hoTen}</td>
                        <td>${nguoi.cccd}</td>
                        <td>${nguoi.gioiTinh}</td>
                        <td class="text-center">${nguoi.ngaySinhDisplay || '—'}</td>
                        <td style="font-size:12px;">${nguoi.viTri || '—'}</td>
                        <td style="font-size:12px;">${nguoi.boPhanBiThuongDisplay || '—'}</td>
                        <td style="font-size:12px;">${nguoi.ngayVaoVienDisplay || '—'}</td>
                        <td style="font-size:12px;">${nguoi.tinhTrangDisplay || '—'}</td>
                        <td class="text-center">
                            <button type="button" class="btn-action-figma btn-action-delete" 
                                    onclick="FormModule.removeNguoiBiNan(${index})" title="Xóa">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </td>
                    </tr>
                `;
                $tbody.append(row);
            });

            this.updateEmptyStates();
        },

        removeNguoiBiNan: function (index) {
            var self = this;
            Swal.fire({
                title: 'Xác nhận xóa?',
                text: 'Bạn có chắc muốn xóa người này khỏi danh sách?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Đồng ý xóa',
                cancelButtonText: 'Hủy'
            }).then((result) => {
                if (result.isConfirmed) {
                    self.nguoiBiNanList.splice(index, 1);
                    self.renderNguoiBiNanTable();
                    toastr.success('Đã xóa');
                }
            });
        },

        updateEmptyStates: function () {
            if (this.nguoiBiNanList.length === 0) {
                $('#emptyNguoiBiNan').show();
                $('#tableNguoiBiNan').hide();
            } else {
                $('#emptyNguoiBiNan').hide();
                $('#tableNguoiBiNan').show();
            }
        },

        // ========== VB GOC FILE UPLOAD (MULTIPLE FILES - FIXED WITH LIST PREVIEW) ==========
        initVBGocUpload: function () {
            var self = this;
            const $fileInput = $('#fileScanVBGoc');
            const $preview = $('#previewVBGoc');

            $fileInput.on('change', function (e) {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                // Validate each file and add to list (not replace)
                let validCount = 0;
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];

                    // Validate file size
                    if (file.size > self.maxFileSize) {
                        toastr.error(`File "${file.name}" vượt quá 10MB`);
                        continue;
                    }

                    // Validate file type
                    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
                    if (!allowedTypes.includes(file.type)) {
                        toastr.error(`File "${file.name}" không đúng định dạng (chỉ chấp nhận PDF, JPG, PNG)`);
                        continue;
                    }

                    // Add to array with unique ID
                    self.fileScanVBGocList.push({
                        id: Date.now() + Math.random(),
                        file: file,
                        name: file.name,
                        size: file.size,
                        type: file.type
                    });
                    validCount++;
                }

                $(this).val(''); // Clear input for next selection

                if (validCount > 0) {
                    self.renderVBGocFileList();
                }
            });

            // Make the preview zone clickable to re-open file picker
            $preview.on('click', '.add-more-vbgoc', function () {
                $fileInput.click();
            });
        },

        renderVBGocFileList: function () {
            var self = this;
            const $preview = $('#previewVBGoc');

            if (this.fileScanVBGocList.length === 0) {
                $preview.fadeOut();
                return;
            }

            let html = '<div class="mt-2">';
            html += '<div style="font-size:11px; font-weight:700; color:var(--primary); text-transform:uppercase; margin-bottom:8px; background:var(--primary-light); padding:6px 10px; border-radius:6px; border-left:3px solid var(--primary);">';
            html += `<i class="fas fa-paperclip mr-1"></i>File VB gốc đã chọn (${this.fileScanVBGocList.length})`;
            html += '</div>';
            html += '<div class="table-responsive"><table class="table-figma w-100"><thead><tr>';
            html += '<th style="width:45px;" class="text-center">#</th>';
            html += '<th>Tên file</th>';
            html += '<th style="width:100px;" class="text-center">Kích thước</th>';
            html += '<th style="width:80px;" class="text-center">Loại</th>';
            html += '<th style="width:60px;" class="text-center">Xóa</th>';
            html += '</tr></thead><tbody>';

            this.fileScanVBGocList.forEach((fileObj, index) => {
                // Check if existing file from server or newly uploaded
                const isExisting = fileObj.isExisting === true;
                const fileName = isExisting ? fileObj.fileName : fileObj.name;
                const sizeKB = isExisting ? '—' : (fileObj.size / 1024).toFixed(1) + ' KB';
                const ext = fileName.split('.').pop().toUpperCase();
                const iconClass = ext === 'PDF' ? 'fa-file-pdf text-danger' : 'fa-file-image text-info';
                
                let nameDisplay = `<span class="font-weight-medium">${fileName}</span>`;
                if (isExisting && fileObj.fileUrl) {
                    nameDisplay = `<a href="${fileObj.fileUrl}" target="_blank" class="font-weight-medium">${fileName}</a>`;
                }

                html += `<tr>
                    <td class="text-center">${index + 1}</td>
                    <td><i class="fas ${iconClass} mr-2"></i>${nameDisplay}</td>
                    <td class="text-center">${sizeKB}</td>
                    <td class="text-center"><span class="badge badge-light border">${ext}</span></td>
                    <td class="text-center">
                        <button type="button" class="btn text-danger btn-sm p-0" onclick="FormModule.removeVBGocFile(${index})" title="Xóa">
                            <i class="fas fa-times-circle" style="font-size:16px;"></i>
                        </button>
                    </td>
                </tr>`;
            });

            html += '</tbody></table></div>';
            html += '<div class="text-center mt-2">';
            html += '<button type="button" class="btn btn-sm btn-outline-primary add-more-vbgoc"><i class="fas fa-plus mr-1"></i>Thêm file khác</button>';
            html += '</div></div>';

            $preview.html(html).fadeIn();
        },

        removeVBGocFile: function (index) {
            const fileObj = this.fileScanVBGocList[index];
            
            // If existing file from server, track for deletion
            if (fileObj && fileObj.isExisting && fileObj.id) {
                this.deletedFileIds.push(fileObj.id);
                console.log('📌 [TNLD] Marked file for deletion:', fileObj.fileName, 'ID:', fileObj.id);
            }
            
            this.fileScanVBGocList.splice(index, 1);
            this.renderVBGocFileList();
        },

        // ========== OTHER FILES UPLOAD (TABLE LIST - GIỐNG VB GỐC) ==========
        initFileUpload: function () {
            var self = this;
            const $fileInput = $('#fileInput');
            const $preview = $('#fileList');

            // File input change
            $fileInput.on('change', function () {
                self.handleOtherFiles(this.files);
                $(this).val(''); // Clear for re-selection
            });

            // Re-open file picker from preview click
            $preview.on('click', '.add-more-files', function () {
                $fileInput.click();
            });
        },

        handleOtherFiles: function (files) {
            var self = this;


            // Check total count
            if (this.fileList.length + files.length > this.maxFileCount) {
                toastr.error(`Tối đa ${this.maxFileCount} files đính kèm khác`);
                return;
            }

            let validCount = 0;
            Array.from(files).forEach(file => {
                // Validate size
                if (file.size > self.maxFileSize) {
                    toastr.error(`File "${file.name}" vượt quá 10MB`);
                    return;
                }

                // Validate type (more permissive than VB gốc)
                const allowedExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];
                const fileName = file.name.toLowerCase();
                const isValidType = allowedExts.some(ext => fileName.endsWith(ext));

                if (!isValidType) {
                    toastr.error(`File "${file.name}" không đúng định dạng hỗ trợ`);
                    return;
                }

                self.fileList.push({
                    id: Date.now() + Math.random(),
                    file: file,
                    name: file.name,
                    size: file.size,
                    type: file.type
                });
                validCount++;
            });

            if (validCount > 0) {
                this.renderOtherFileList();
            }
        },

        renderOtherFileList: function () {
            var self = this;
            const $fileList = $('#fileList');

            if (this.fileList.length === 0) {
                $fileList.fadeOut();
                return;
            }

            // Render table list (GIỐNG VB GỐC)
            let html = '<div class="mt-2">';
            html += '<div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:8px; background:#f8fafc; padding:6px 10px; border-radius:6px; border-left:3px solid #64748b;">';
            html += `<i class="fas fa-paperclip mr-1"></i>File đính kèm khác (${this.fileList.length})`;
            html += '</div>';
            html += '<div class="table-responsive"><table class="table-figma w-100"><thead><tr>';
            html += '<th style="width:45px;" class="text-center">#</th>';
            html += '<th>Tên file</th>';
            html += '<th style="width:100px;" class="text-center">Kích thước</th>';
            html += '<th style="width:80px;" class="text-center">Loại</th>';
            html += '<th style="width:60px;" class="text-center">Xóa</th>';
            html += '</tr></thead><tbody>';

            this.fileList.forEach((fileObj, index) => {
                // Check if existing file from server or newly uploaded
                const isExisting = fileObj.isExisting === true;
                const fileName = isExisting ? fileObj.fileName : fileObj.name;
                const sizeKB = isExisting ? '—' : (fileObj.size / 1024).toFixed(1) + ' KB';
                const ext = fileName.split('.').pop().toUpperCase();
                let iconClass = 'fa-file text-secondary';

                if (ext === 'PDF') iconClass = 'fa-file-pdf text-danger';
                else if (['DOC', 'DOCX'].includes(ext)) iconClass = 'fa-file-word text-primary';
                else if (['XLS', 'XLSX'].includes(ext)) iconClass = 'fa-file-excel text-success';
                else if (['JPG', 'JPEG', 'PNG'].includes(ext)) iconClass = 'fa-file-image text-info';
                
                let nameDisplay = `<span class="font-weight-medium">${fileName}</span>`;
                if (isExisting && fileObj.fileUrl) {
                    nameDisplay = `<a href="${fileObj.fileUrl}" target="_blank" class="font-weight-medium">${fileName}</a>`;
                }

                html += `<tr>
                    <td class="text-center">${index + 1}</td>
                    <td><i class="fas ${iconClass} mr-2"></i>${nameDisplay}</td>
                    <td class="text-center">${sizeKB}</td>
                    <td class="text-center"><span class="badge badge-light border">${ext}</span></td>
                    <td class="text-center">
                        <button type="button" class="btn text-danger btn-sm p-0" onclick="FormModule.removeOtherFile(${index})" title="Xóa">
                            <i class="fas fa-times-circle" style="font-size:16px;"></i>
                        </button>
                    </td>
                </tr>`;
            });

            html += '</tbody></table></div>';
            html += '<div class="text-center mt-2">';
            html += '<button type="button" class="btn btn-sm btn-outline-primary add-more-files"><i class="fas fa-plus mr-1"></i>Thêm tài liệu</button>';
            html += '</div></div>';

            $fileList.html(html).fadeIn();
        },

        removeOtherFile: function (index) {
            const fileObj = this.fileList[index];
            
            // If existing file from server, track for deletion
            if (fileObj && fileObj.isExisting && fileObj.id) {
                this.deletedFileIds.push(fileObj.id);
                console.log('📌 [TNLD] Marked file for deletion:', fileObj.fileName, 'ID:', fileObj.id);
            }
            
            this.fileList.splice(index, 1);
            this.renderOtherFileList();
            toastr.info('Đã xóa file');
        },

        initFormActions: function () {
            var self = this;

            // Draft button
            $('#btnHeaderDraft').on('click', function () {
                self.saveDraft();
            });

            // Submit button (both in header)
            $('#btnHeaderSubmit').on('click', function () {
                self.submitForm();
            });

            // Form submit event
            $('#formTNLD').on('submit', function (e) {
                e.preventDefault();
                self.submitForm();
            });
        },

        saveDraft: async function () {
            $('#isDraft').val('true');


            console.log('--- [TNLD DEBUG DRAFT] ---');
            console.log('EnterpriseId:', $('#enterpriseId').val());
            console.log('LoaiTNLD:', $('#loaiTNLD').val());

            // Basic validation for draft (Detailed messages now inside validateForm)
            if (!this.validateForm()) {
                return;
            }

            // Show loading
            Swal.fire({
                title: 'Đang lưu nháp...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            try {
                const formData = this.prepareFormData();

                // Add files if present (optional for draft)
                // ONLY append newly uploaded files (skip existing files from server)
                if (this.fileScanVBGocList && this.fileScanVBGocList.length > 0) {
                    this.fileScanVBGocList.forEach((fileObj, index) => {
                        if (!fileObj.isExisting && fileObj.file) {
                            formData.append(`FileScanVBGoc`, fileObj.file);
                        }
                    });
                }

                if (this.fileList && this.fileList.length > 0) {
                    this.fileList.forEach((fileObj, index) => {
                        if (!fileObj.isExisting && fileObj.file) {
                            formData.append('OtherFiles', fileObj.file);
                        }
                    });
                }

                // Add NguoiBiNan if present (optional for draft)
                if (this.nguoiBiNanList && this.nguoiBiNanList.length > 0) {
                    formData.append('NguoiBiNanJson', JSON.stringify(this.nguoiBiNanList));
                }

                // Send deleted file IDs for server-side deletion
                if (this.deletedFileIds && this.deletedFileIds.length > 0) {
                    formData.append('DeletedFileIds', JSON.stringify(this.deletedFileIds));
                }


                const response = await fetch($('#formTNLD').attr('action'), {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-XSRF-TOKEN': $('input[name="__RequestVerificationToken"]').val(),
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                // CRITICAL FIX: Close Swal loading modal before showing toastr
                Swal.close();

                const result = await response.json();

                if (result.success || result.isSuccess) {
                    toastr.success('Lưu bản nháp thành công');
                    
                    // Redirect to detail page if recordId is returned
                    const recordId = result.recordId || result.data?.id;
                    if (recordId) {
                        setTimeout(() => {
                            window.location.href = `/TaiNanLaoDong/ChiTiet/${recordId}`;
                        }, 1000);
                    }
                } else {
                    toastr.error(result.message || result.error || 'Lưu nháp thất bại');
                }
            } catch (error) {
                console.error('❌ [DRAFT ERROR]', error);
                Swal.close(); // Close loading modal on error
                toastr.error('Không thể kết nối đến máy chủ: ' + error.message);
            }
        },

        submitForm: async function () {
            $('#isDraft').val('false');

            // Console log for debugging (User reported validation issues)
            console.log('--- [TNLD DEBUG SUBMIT] ---');
            console.log('EnterpriseId:', $('#enterpriseId').val());
            console.log('LoaiTNLD:', $('#loaiTNLD').val());
            console.log('NguoiBiNanList size:', this.nguoiBiNanList.length);
            console.log('VB Goc List size:', this.fileScanVBGocList.length);

            // Validation (Detailed messages are now handled inside validateForm)
            if (!this.validateForm(true)) {
                return;
            }

            if (this.nguoiBiNanList.length === 0) {
                toastr.error('Vui lòng thêm ít nhất một người bị nạn');
                return;
            }

            // Legal verification check (R6)
            if (!$('#xacNhanPhapLy').is(':checked')) {
                toastr.warning('Vui lòng xác nhận pháp lý trước khi gửi khai báo');
                $('#xacNhanPhapLy').focus();
                return;
            }

            // Show simple loading toast
            toastr.info('Đang gửi khai báo...', 'Vui lòng đợi');

            try {
                // Prepare FormData with all fields including files
                const formData = this.prepareFormData();


                // Add multiple VB gốc files
                // ONLY append newly uploaded files (skip existing files from server)
                this.fileScanVBGocList.forEach((fileObj, index) => {
                    if (!fileObj.isExisting && fileObj.file) {
                        formData.append(`FileScanVBGoc`, fileObj.file);
                    }
                });

                // Add other files (optional)
                if (this.fileList && this.fileList.length > 0) {
                    this.fileList.forEach((fileObj, index) => {
                        if (!fileObj.isExisting && fileObj.file) {
                            formData.append('OtherFiles', fileObj.file);
                        }
                    });
                }

                // Add NguoiBiNan as JSON string
                formData.append('NguoiBiNanJson', JSON.stringify(this.nguoiBiNanList));

                // Send deleted file IDs for server-side deletion
                if (this.deletedFileIds && this.deletedFileIds.length > 0) {
                    formData.append('DeletedFileIds', JSON.stringify(this.deletedFileIds));
                }

                const response = await fetch($('#formTNLD').attr('action'), {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-XSRF-TOKEN': $('input[name="__RequestVerificationToken"]').val(),
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });


                const submitResult = await response.json();

                if (submitResult.success || submitResult.isSuccess) {
                    toastr.success('Đã gửi khai báo thành công');

                    const recordId = submitResult.recordId || submitResult.data?.id;
                    const redirectUrl = recordId ? `/TaiNanLaoDong/ChiTiet/${recordId}` : '/TaiNanLaoDong/Index';

                    setTimeout(() => {
                        window.location.href = redirectUrl;
                    }, 1000);
                } else {
                    toastr.error(submitResult.message || submitResult.error || 'Gửi khai báo thất bại');
                }
            } catch (error) {
                console.error('❌ [SUBMIT ERROR]', error);
                toastr.error('Không thể kết nối đến máy chủ: ' + error.message);
            }
        },

        validateForm: function (fullValidation = false) {
            const enterpriseId = $('#enterpriseId').val();
            const loaiTNLD = $('#loaiTNLD').val();

            if (!enterpriseId) {
                if (fullValidation) toastr.warning('Vui lòng chọn doanh nghiệp');
                return false;
            }
            if (!loaiTNLD) {
                if (fullValidation) toastr.warning('Vui lòng chọn loại TNLĐ');
                return false;
            }

            if (fullValidation) {
                const fields = [
                    { id: 'ngayGioXayRa', label: 'ngày giờ xảy ra' },
                    { id: 'diaDiem', label: 'địa điểm xảy ra' },
                    { id: 'nguyenNhan', label: 'nhóm nguyên nhân' },
                    { id: 'hinhThuc', label: 'hình thức' },
                    { id: 'tinhTrangNLDChung', label: 'tình trạng NLĐ chung' },
                    { id: 'moTaDienBien', label: 'mô tả diễn biến tai nạn' },
                    { id: 'soVanBanGoc', label: 'số VB gốc' }
                ];

                for (const field of fields) {
                    const val = $(`#${field.id}`).val();
                    if (!val || val.trim() === '') {
                        toastr.warning(`Vui lòng nhập/chọn ${field.label}`);
                        $(`#${field.id}`).focus();
                        return false;
                    }
                }

                // Check file list instead of input length (input is cleared after selection)
                if (this.fileScanVBGocList.length === 0) {
                    toastr.warning('Vui lòng chọn file scan VB gốc');
                    $('#fileScanVBGoc').focus();
                    return false;
                }

                // Conditional validation: BenhVien
                const tinhTrangText = $('#tinhTrangNLDChung option:selected').text().toLowerCase();
                if (tinhTrangText.includes('điều trị')) {
                    const benhVien = $('#benhVien').val();
                    if (!benhVien || benhVien.trim() === '') {
                        toastr.error('Bệnh viện là bắt buộc khi tình trạng NLĐ là "Đang điều trị"');
                        $('#benhVien').focus();
                        return false;
                    }
                }
            }

            return true;
        },

        prepareFormData: function () {
            const formData = new FormData($('#formTNLD')[0]);

            // NOTE: NguoiBiNanJson is added in submitForm() along with files
            // Don't duplicate here

            return formData;
        },

        // ========== FILE UPLOAD TO API ==========

        /**
         * Upload File scan VB gốc (single file) qua FileStorage API
         * @returns {Promise<string|null>} FileAttachment.Id or null on error
         */
        uploadFileScanVBGoc: async function () {
            if (!this.fileScanVBGoc) return null;

            const formData = new FormData();
            formData.append('file', this.fileScanVBGoc);
            formData.append('entityType', 'KhaiBaoTNLD');
            formData.append('category', 'SCAN_VB_GOC');

            try {
                // TODO: Thay đổi endpoint theo backend thực tế
                const response = await fetch('/api/v1/file-storage/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${window.accessToken || ''}`,
                        'X-XSRF-TOKEN': $('input[name="__RequestVerificationToken"]').val()
                    },
                    body: formData
                });

                if (!response.ok) {
                    console.error('Upload VB gốc failed:', response.statusText);
                    return null;
                }

                const result = await response.json();
                if (result.isSuccess && result.data) {
                    return result.data.id; // FileAttachment.Id
                }

                return null;
            } catch (error) {
                console.error('Upload VB gốc error:', error);
                return null;
            }
        },

        /**
         * Upload nhiều file khác (multiple files) qua FileStorage API
         * @returns {Promise<Array<string>>} Array của FileAttachment.Ids
         */
        uploadOtherFiles: async function () {
            if (this.fileList.length === 0) return [];

            const formData = new FormData();
            this.fileList.forEach((fileObj, index) => {
                formData.append(`files[${index}]`, fileObj.file);
            });
            formData.append('entityType', 'KhaiBaoTNLD');
            formData.append('category', 'OTHER');

            try {
                // TODO: Thay đổi endpoint theo backend thực tế
                const response = await fetch('/api/v1/file-storage/upload-multiple', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${window.accessToken || ''}`,
                        'X-XSRF-TOKEN': $('input[name="__RequestVerificationToken"]').val()
                    },
                    body: formData
                });

                if (!response.ok) {
                    console.warn('Upload other files failed (non-critical):', response.statusText);
                    return [];
                }

                const result = await response.json();
                if (result.isSuccess && result.data && Array.isArray(result.data)) {
                    return result.data.map(item => item.id); // Array of FileAttachment.Ids
                }

                return [];
            } catch (error) {
                console.error('Upload other files error:', error);
                return [];
            }
        },

        loadExistingData: function () {
            const data = this.config.initialData;
            if (!data) {
                console.warn('⚠️ [TNLD] No initialData found in config');
                return;
            }

            console.log('🔄 [TNLD] Loading existing data:', data);
            console.log('🔍 [TNLD] EnterpriseId:', data.enterpriseId);
            console.log('🔍 [TNLD] TotalWorkers:', data.totalWorkers);
            console.log('🔍 [TNLD] DiaDiem:', data.diaDiem);
            console.log('🔍 [TNLD] IndustrialZoneName:', data.industrialZoneName);

            // 1. Populate Enterprise (Special Select2)
            if (data.enterpriseId) {
                // Only append option if NOT disabled (Create mode with existing data, e.g., supplement mode)
                // In Edit Draft mode, View already pre-populates the enterprise select
                if (!$('#enterpriseId').prop('disabled')) {
                    const displayName = data.enterpriseName + (data.enterpriseTaxCode ? ` (${data.enterpriseTaxCode})` : '');
                    const newOption = new Option(displayName, data.enterpriseId, true, true);
                    $('#enterpriseId').append(newOption).trigger('change');
                }

                // Populate enterprise info from draft data (DTO may contain full enterprise details)
                const mockEnterprise = {
                    id: data.enterpriseId,
                    name: data.enterpriseName,
                    taxCode: data.enterpriseTaxCode,
                    address: data.enterpriseAddress,
                    // Additional fields (may exist in DTO with camelCase naming)
                    industrialZoneId: data.industrialZoneId,
                    industrialZoneName: data.industrialZoneName,
                    industryName: data.industryName,
                    legalRepresentative: data.legalRepresentative,
                    position: data.position,
                    phone: data.phone,
                    email: data.email
                };
                this.populateEnterpriseInfo(mockEnterprise);
            }

            // 2. Simple fields
            if (data.soVanBanGoc) $('#soVanBanGoc').val(data.soVanBanGoc);
            
            if (data.totalWorkers) {
                console.log('✅ [TNLD] Setting totalWorkers:', data.totalWorkers);
                $('#totalWorkers').val(data.totalWorkers);
            } else {
                console.warn('⚠️ [TNLD] totalWorkers is missing in data');
            }
            
            // Set values with slight delay to ensure categories are loaded (via AJAX in initCategoryDropdowns)
            setTimeout(() => {
                if (data.loaiTNLD) $('#loaiTNLD').val(data.loaiTNLD).trigger('change');
                if (data.nhomNguyenNhanId) $('#nguyenNhan').val(data.nhomNguyenNhanId).trigger('change');
                if (data.hinhThucId) $('#hinhThuc').val(data.hinhThucId).trigger('change');
                if (data.tinhTrangNLDChung) $('#tinhTrangNLDChung').val(data.tinhTrangNLDChung).trigger('change');
            }, 1000); 

            if (data.ngayGioXayRa) {
                // Formatting for datetime-local input (YYYY-MM-DDTHH:mm)
                const d = new Date(data.ngayGioXayRa);
                const localStr = d.getFullYear() + '-' + 
                                String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                                String(d.getDate()).padStart(2, '0') + 'T' + 
                                String(d.getHours()).padStart(2, '0') + ':' + 
                                String(d.getMinutes()).padStart(2, '0');
                $('#ngayGioXayRa').val(localStr);
            }

            if (data.diaDiem) {
                console.log('✅ [TNLD] Setting diaDiem:', data.diaDiem);
                $('#diaDiem').val(data.diaDiem);
            } else {
                console.warn('⚠️ [TNLD] diaDiem is missing in data');
            }
            
            if (data.moTaDienBien) $('#moTaDienBien').val(data.moTaDienBien);
            if (data.nguyenNhanChiTiet) $('#nguyenNhanChiTiet').val(data.nguyenNhanChiTiet);
            if (data.benhVien) $('#benhVien').val(data.benhVien);

            // 3. Files (Load existing files from server)
            if (data.files && Array.isArray(data.files)) {
                data.files.forEach(f => {
                    const fileItem = {
                        id: f.id,
                        fileName: f.fileName,
                        fileUrl: f.fileUrl,
                        category: f.category,
                        uploadedAt: f.uploadedAt,
                        isExisting: true // Flag to distinguish from newly uploaded files
                    };
                    
                    if (f.category === 'SCAN_VB_GOC') {
                        this.fileScanVBGocList.push(fileItem);
                    } else {
                        this.fileList.push(fileItem);
                    }
                });
                
                // Render file lists
                this.renderVBGocFileList();
                this.renderOtherFileList();
            }

            // 4. Victims
            if (data.nguoiBiNan && Array.isArray(data.nguoiBiNan)) {
                this.nguoiBiNanList = data.nguoiBiNan.map(n => {
                    let boPhanArray = n.boPhanBiThuong;
                    if (typeof boPhanArray === 'string') {
                        boPhanArray = boPhanArray.split(',').map(s => s.trim()).filter(s => s);
                    } else if (!Array.isArray(boPhanArray)) {
                        boPhanArray = [];
                    }
                    
                    // BoPhanBiThuongDisplay from DTO is List<string>, need to join
                    let boPhanDisplayText = '—';
                    if (n.boPhanBiThuongDisplay && Array.isArray(n.boPhanBiThuongDisplay)) {
                        boPhanDisplayText = n.boPhanBiThuongDisplay.join(', ');
                    } else if (typeof n.boPhanBiThuongDisplay === 'string') {
                        boPhanDisplayText = n.boPhanBiThuongDisplay;
                    }
                    
                    return {
                        id: n.id || Date.now() + Math.random(),
                        LaborWorkerId: n.laborWorkerId,
                        hoTen: n.hoTen,
                        cccd: n.cmnd || n.cccd,
                        gioiTinh: n.gioiTinh,
                        ngaySinh: n.ngaySinh,
                        ngaySinhDisplay: n.ngaySinh ? new Date(n.ngaySinh).toLocaleDateString('vi-VN') : '—',
                        viTri: n.viTri,
                        BoPhanBiThuong: boPhanArray, // Always array
                        boPhanBiThuongDisplay: boPhanDisplayText,
                        NgayVaoVien: n.ngayVaoVien,
                        ngayVaoVienDisplay: n.ngayVaoVien ? new Date(n.ngayVaoVien).toLocaleString('vi-VN') : '—',
                        TinhTrangNBN: n.tinhTrangNBN,
                        tinhTrangDisplay: n.tinhTrangNBNDisplay || n.tinhTrangDisplay || '—'
                    };
                });
                this.renderNguoiBiNanTable();
            }
        }
    };

    // ==========================================
    // AUTO-INIT
    // ==========================================
    $(document).ready(function () {
        if ($('#formTNLD').length) {
            FormModule.init();
        } else {
            console.warn('⚠️ [TNLD] formTNLD not found - skipping init');
        }
    });

    // Expose to window for onclick handlers
    window.FormModule = FormModule;

})(jQuery);
