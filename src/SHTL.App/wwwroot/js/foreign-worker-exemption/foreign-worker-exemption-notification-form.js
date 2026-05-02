/**
 * SCR-NV-HS-002 — Tạo hồ sơ thông báo PA-B
 * IIFE pattern — MVC route only (never /api/v1/... directly)
 */
(function () {
    'use strict';

    // ── Routes ──────────────────────────────────────────────────────────────
    var ROUTES = {
        searchEnterprise: '/Foreign-Worker-Exemption-Notification/search-enterprise',
        uploadAttachment: '/Foreign-Worker-Exemption-Notification/upload-attachment',
        index: '/Foreign-Worker-Exemption-Notification'
    };

    // ── Attachment type codes ────────────────────────────────────────────────
    var ATTACHMENT_TYPE = { VAN_BAN_GOC: 1, SCAN_GOC: 2, DINH_KEM_KHAC: 3 };

    // ── Application state ────────────────────────────────────────────────────
    var workers = [];       // Array of worker objects
    var workerFileSelections = { // Files for current worker in modal
        passportFile: null,
        contractFile: null
    };
    var fileSelections = { // Selected files (local, not uploaded yet)
        vanBanGoc: [],      // Array of File objects
        scanGoc: [],        // Array of File objects
        other: []           // Array of File objects
    };
    var selectedEnterprise = null; // { id, name, taxCode, address, legalRepresentative, phone, email }

    // ── Helpers ──────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        var k = 1024;
        var sizes = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function getAntiForgeryToken() {
        var el = document.querySelector('input[name="__RequestVerificationToken"]');
        return el ? el.value : '';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            var d = new Date(dateStr);
            return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }

    function showError(elementId, message) {
        var el = document.getElementById(elementId);
        if (el) { el.textContent = message; el.style.display = message ? 'block' : 'none'; }
    }

    function clearAllErrors() {
        ['enterpriseIdError', 'reasonIdsError', 'workersError', 'vanBanGocError', 'scanGocError'].forEach(function (id) {
            showError(id, '');
        });
        var summary = document.getElementById('formErrorSummary');
        if (summary) summary.style.display = 'none';
    }

    // ── 1. Enterprise Autocomplete ────────────────────────────────────────────
    function initEnterpriseAutocomplete() {
        var searchInput = document.getElementById('enterpriseSearch');
        var dropdown = document.getElementById('enterpriseDropdown');
        var debounceTimer;

        if (!searchInput || !dropdown) return;

        searchInput.addEventListener('input', function () {
            clearTimeout(debounceTimer);
            var q = searchInput.value.trim();

            if (q.length < 2) {
                dropdown.style.display = 'none';
                return;
            }

            debounceTimer = setTimeout(function () {
                fetchEnterprises(q);
            }, 300);
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                dropdown.style.display = 'none';
            }
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest('#enterpriseAutocompleteWrapper')) {
                dropdown.style.display = 'none';
            }
        });
    }

    function fetchEnterprises(q) {
        var dropdown = document.getElementById('enterpriseDropdown');
        dropdown.innerHTML = '<div style="padding:10px 14px; font-size:13px; color:#64748b;">Đang tìm kiếm...</div>';
        dropdown.style.display = 'block';

        var url = ROUTES.searchEnterprise + '?q=' + encodeURIComponent(q);

        fetch(url, {
            method: 'GET',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            renderEnterpriseDropdown(data);
        })
        .catch(function () {
            dropdown.innerHTML = '<div style="padding:10px 14px; font-size:13px; color:#ef4444;">Lỗi khi tìm kiếm.</div>';
        });
    }

    function renderEnterpriseDropdown(items) {
        var dropdown = document.getElementById('enterpriseDropdown');
        if (!items || items.length === 0) {
            dropdown.innerHTML = '<div style="padding:10px 14px; font-size:13px; color:#64748b;">Không tìm thấy doanh nghiệp nào.</div>';
            return;
        }

        var html = '';
        items.forEach(function (e) {
            html += '<div class="enterprise-dropdown-item" data-id="' + escapeHtml(e.id) + '">'
                + '<strong>' + escapeHtml(e.name) + '</strong>'
                + ' <span style="color:#64748b; font-size:11px;">— ' + escapeHtml(e.taxCode) + '</span>'
                + '</div>';
        });
        dropdown.innerHTML = html;
        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.enterprise-dropdown-item').forEach(function (item) {
            item.addEventListener('click', function () {
                var id = item.getAttribute('data-id');
                var enterprise = items.find(function (e) { return e.id === id; });
                if (enterprise) selectEnterprise(enterprise);
            });
        });
    }

    function selectEnterprise(e) {
        selectedEnterprise = e;
        document.getElementById('enterpriseId').value = e.id;
        document.getElementById('hiddenEnterpriseName').value = e.name;
        document.getElementById('hiddenTaxCode').value = e.taxCode;
        document.getElementById('hiddenEnterpriseAddress').value = e.address || '';
        document.getElementById('hiddenLegalRep').value = e.legalRepresentative || '';

        // Update display fields
        document.getElementById('enterpriseSearch').value = e.name + ' (' + e.taxCode + ')';
        setReadonly('displayEnterpriseName', e.name);
        setReadonly('displayTaxCode', e.taxCode);
        setReadonly('displayLegalRep', e.legalRepresentative || '');
        setReadonly('displayAddress', e.address || '');

        // Pre-fill editable contact fields
        var phoneEl = document.getElementById('phoneNumber');
        var emailEl = document.getElementById('emailInput');
        if (phoneEl && !phoneEl.value) phoneEl.value = e.phone || '';
        if (emailEl && !emailEl.value) emailEl.value = e.email || '';

        document.getElementById('enterpriseDropdown').style.display = 'none';
        showError('enterpriseIdError', '');
    }

    function setReadonly(elementId, value) {
        var el = document.getElementById(elementId);
        if (el) el.value = value;
    }

    // ── 2. Reason multi-select component ────────────────────────────────────
    var selectedReasons = [];
    var reasonOptions = {
        '1': '(1) Di chuyển nội bộ doanh nghiệp',
        '2': '(2) Thực hiện hợp đồng kinh tế',
        '3': '(3) Nhà cung cấp dịch vụ',
        '4': '(4) Chào bán dịch vụ',
        '5': '(5) Làm việc cho tổ chức phi chính phủ',
        '6': '(6) Tình nguyện viên',
        '7': '(7) Lắp đặt, sửa chữa máy móc',
        '8': '(8) Tư vấn kỹ thuật',
        '9': '(9) Có giấy phép hành nghề',
        '10': '(10) Trường hợp khác theo quy định ⚠️',
        '11': '(11) Trường hợp khác theo Hiệp định ⚠️'
    };

    function initReasonMultiSelect() {
        var $container = document.getElementById('reasonSelectContainer');
        var $tagsContainer = document.getElementById('reasonTags');
        var $input = document.getElementById('reasonInput');
        var $results = document.getElementById('reasonResults');

        if (!$container || !$tagsContainer || !$input || !$results) return;

        // Focus input when clicking tags container
        $tagsContainer.addEventListener('click', function () {
            $input.focus();
        });

        // Show dropdown on input focus
        $input.addEventListener('focus', function () {
            $results.style.display = 'block';
        });

        // Filter options as user types
        $input.addEventListener('input', function () {
            var searchTerm = $input.value.toLowerCase();
            Array.from($results.querySelectorAll('.select-option')).forEach(function (opt) {
                var optionText = opt.textContent.toLowerCase();
                opt.style.display = optionText.indexOf(searchTerm) > -1 ? '' : 'none';
            });
        });

        // Add reason when option clicked
        $results.addEventListener('click', function (e) {
            if (e.target.classList.contains('select-option')) {
                e.stopPropagation();
                var val = e.target.getAttribute('data-val');
                if (selectedReasons.indexOf(val) === -1) {
                    selectedReasons.push(val);
                    renderReasonTags();
                }
                $input.value = '';
                Array.from($results.querySelectorAll('.select-option')).forEach(function (opt) {
                    opt.style.display = '';
                });
                $results.style.display = 'none';
            }
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', function (e) {
            if (!$container.contains(e.target)) {
                $results.style.display = 'none';
            }
        });
    }

    function renderReasonTags() {
        var $tagsContainer = document.getElementById('reasonTags');
        var $input = document.getElementById('reasonInput');

        // Remove existing tags
        Array.from($tagsContainer.querySelectorAll('.multi-tag')).forEach(function (tag) {
            tag.remove();
        });

        // Render each tag
        selectedReasons.forEach(function (val) {
            var label = reasonOptions[val] || val;
            var $tag = document.createElement('span');
            $tag.className = 'multi-tag';
            $tag.innerHTML = escapeHtml(label) + ' <i class="fas fa-times" style="cursor:pointer;"></i>';

            $tag.querySelector('i').addEventListener('click', function (e) {
                e.stopPropagation();
                var idx = selectedReasons.indexOf(val);
                if (idx > -1) {
                    selectedReasons.splice(idx, 1);
                    renderReasonTags();
                }
            });

            $input.parentElement.insertBefore($tag, $input);
        });

        // Update hidden ReasonIds field
        document.getElementById('reasonIds').value = selectedReasons.join(',');

        // Show/hide ReasonDetails section when code 10 or 11 is selected
        var hasOther = selectedReasons.indexOf('10') !== -1 || selectedReasons.indexOf('11') !== -1;
        var detailsSection = document.getElementById('reasonDetailsSection');
        if (detailsSection) detailsSection.style.display = hasOther ? '' : 'none';

        if (selectedReasons.length > 0) showError('reasonIdsError', '');
    }

    // ── 3. Worker Modal ───────────────────────────────────────────────────────
    function initWorkerModal() {
        var btnAdd = document.getElementById('btnAddWorker');
        var btnConfirm = document.getElementById('btnConfirmAddWorker');
        var btnToggleVisa = document.getElementById('btnToggleVisaFields');

        if (btnAdd) {
            btnAdd.addEventListener('click', function () {
                resetWorkerModal();
                $('#addWorkerModal').modal('show');
            });
        }

        if (btnConfirm) {
            btnConfirm.addEventListener('click', confirmAddWorker);
        }

        if (btnToggleVisa) {
            btnToggleVisa.addEventListener('click', function () {
                var collapse = document.getElementById('visaFieldsCollapse');
                if (collapse) {
                    var isHidden = collapse.style.display === 'none';
                    collapse.style.display = isHidden ? '' : 'none';
                    btnToggleVisa.querySelector('i').className = isHidden
                        ? 'fas fa-chevron-up mr-1'
                        : 'fas fa-chevron-down mr-1';
                }
            });
        }

        // Initialize worker file zones
        initWorkerFileZones();
        
        // Load countries for the modal
        loadCountriesModal();
    }

    function loadCountriesModal() {
        var $select = $('#w_nationalityId');
        if ($select.length === 0) return;

        fetch('/Countries/GetAll', {
            method: 'GET',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
        .then(function (res) { return res.json(); })
        .then(function (items) {
            $select.empty().append('<option value="">Chọn quốc tịch...</option>');
            (items || []).forEach(function (country) {
                var id = country.id || country.countryId || '';
                var name = country.name || country.tenQuocGia || country.countryName || '';
                if (id && name) {
                    $select.append($('<option>').val(id).text(name));
                }
            });

            $select.select2({
                theme: 'bootstrap4',
                dropdownParent: $('#addWorkerModal'),
                width: '100%',
                placeholder: 'Chọn quốc tịch...',
                allowClear: true,
                language: {
                    noResults: function () { return "Không tìm thấy kết quả"; }
                }
            });
        })
        .catch(function (err) {
            console.error('Failed to load countries for modal:', err);
        });
    }

    function resetWorkerModal() {
        ['w_fullName', 'w_nationalityName', 'w_passportNumber', 'w_dateOfBirth',
         'w_visaNumber', 'w_visaExpiryDate', 'w_jobPosition', 'w_contractStartDate', 'w_contractEndDate']
            .forEach(function (id) {
                 var el = document.getElementById(id);
                 if (el) el.value = '';
             });
 
         $('#w_nationalityId').val('').trigger('change');
         document.getElementById('w_gender').value = '1';

        // Reset worker file selections
        workerFileSelections.passportFile = null;
        workerFileSelections.contractFile = null;
        displayWorkerFile('passport');
        displayWorkerFile('contract');

        var visaCollapse = document.getElementById('visaFieldsCollapse');
        if (visaCollapse) visaCollapse.style.display = 'none';

        var btnToggle = document.getElementById('btnToggleVisaFields');
        if (btnToggle) {
            var icon = btnToggle.querySelector('i');
            if (icon) icon.className = 'fas fa-chevron-down mr-1';
        }

        var errorEl = document.getElementById('workerModalError');
        if (errorEl) errorEl.style.display = 'none';

        // Reset editing index
        window.fweForm._editingIndex = -1;

        // Reset button text
        var btnConfirm = document.getElementById('btnConfirmAddWorker');
        if (btnConfirm) {
            btnConfirm.textContent = '';
            var icon = document.createElement('i');
            icon.className = 'fas fa-plus mr-1';
            btnConfirm.appendChild(icon);
            btnConfirm.appendChild(document.createTextNode('Thêm vào danh sách'));
        }
    }

    function initWorkerFileZones() {
        // Passport file zone
        initWorkerFileZone('w_passportFileInput', 'w_passportFileDropZone', 'w_passportFileQueue', 'passport', ['pdf', 'jpg', 'jpeg', 'png']);
        // Contract file zone
        initWorkerFileZone('w_contractFileInput', 'w_contractFileDropZone', 'w_contractFileQueue', 'contract', ['pdf', 'docx', 'doc', 'jpg', 'jpeg', 'png']);
    }

    function initWorkerFileZone(inputId, zoneId, queueId, fileType, allowedExts) {
        var input = document.getElementById(inputId);
        var zone = document.getElementById(zoneId);
        if (!input || !zone) return;

        input.addEventListener('change', function (e) {
            var files = Array.from(e.target.files || []);
            handleWorkerFileInput(files, fileType, allowedExts);
            input.value = '';
        });

        zone.addEventListener('dragover', function (e) {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', function () {
            zone.classList.remove('drag-over');
        });
        zone.addEventListener('drop', function (e) {
            e.preventDefault();
            zone.classList.remove('drag-over');
            var files = Array.from(e.dataTransfer.files || []);
            handleWorkerFileInput(files, fileType, allowedExts);
        });
    }

    function handleWorkerFileInput(files, fileType, allowedExts) {
        if (!files || files.length === 0) return;

        var file = files[0]; // Only accept 1 file per type
        var ext = file.name.split('.').pop().toLowerCase();

        if (allowedExts && allowedExts.indexOf(ext) === -1) {
            toastr.error('Định dạng ".' + ext + '" không được phép. Chấp nhận: ' + allowedExts.join(', '));
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            toastr.error('"' + file.name + '" vượt quá giới hạn 20 MB.');
            return;
        }

        if (fileType === 'passport') {
            workerFileSelections.passportFile = file;
        } else if (fileType === 'contract') {
            workerFileSelections.contractFile = file;
        }

        displayWorkerFile(fileType);
    }

    function displayWorkerFile(fileType) {
        var queueId = fileType === 'passport' ? 'w_passportFileQueue' : 'w_contractFileQueue';
        var file = fileType === 'passport' ? workerFileSelections.passportFile : workerFileSelections.contractFile;
        var queue = document.getElementById(queueId);

        if (!queue) return;
        queue.innerHTML = '';

        if (file) {
            var item = document.createElement('div');
            item.className = 'file-queue-item';
            var sizeLabel = formatFileSize(file.size);
            item.innerHTML = '<i class="fas fa-file-alt" style="color:var(--primary);"></i>'
                + '<span>' + escapeHtml(file.name) + ' <span style="color:#94a3b8;">(' + sizeLabel + ')</span></span>'
                + '<span class="file-remove" title="Xóa"><i class="fas fa-times"></i></span>';

            var removeBtn = item.querySelector('.file-remove');
            if (removeBtn) {
                removeBtn.addEventListener('click', function () {
                    if (fileType === 'passport') {
                        workerFileSelections.passportFile = null;
                    } else if (fileType === 'contract') {
                        workerFileSelections.contractFile = null;
                    }
                    displayWorkerFile(fileType);
                });
            }

            queue.appendChild(item);
        }
    }

    function confirmAddWorker() {
        var errorEl = document.getElementById('workerModalError');
        if (errorEl) errorEl.style.display = 'none';

        var fullName = document.getElementById('w_fullName').value.trim();
        var nationalityId = $('#w_nationalityId').val();
        var nationalityName = $('#w_nationalityId option:selected').text();
        var passportNumber = document.getElementById('w_passportNumber').value.trim().toUpperCase();
        var dateOfBirth = document.getElementById('w_dateOfBirth').value;
        var gender = parseInt(document.getElementById('w_gender').value, 10);
        var jobPosition = document.getElementById('w_jobPosition').value.trim();
        var contractStartDate = document.getElementById('w_contractStartDate').value;
        var contractEndDate = document.getElementById('w_contractEndDate').value;
        var visaNumber = document.getElementById('w_visaNumber').value.trim();
        var visaExpiryDate = document.getElementById('w_visaExpiryDate').value;

        // Validation
        var errors = [];
        if (!fullName) errors.push('Họ và tên là bắt buộc.');
        if (!nationalityId || nationalityId === '00000000-0000-0000-0000-000000000000' || nationalityId === '')
            errors.push('Vui lòng chọn quốc tịch.');
        if (!fullName) errors.push('Họ và tên là bắt buộc.');
        if (!passportNumber || passportNumber.length < 6 || passportNumber.length > 20)
            errors.push('Số hộ chiếu phải từ 6–20 ký tự.');
        if (!gender || gender < 1) errors.push('Giới tính là bắt buộc.');
        if (!dateOfBirth) {
            errors.push('Ngày sinh là bắt buộc.');
        } else {
            var dob = new Date(dateOfBirth);
            var age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
            if (age < 18) errors.push('LĐNN phải từ 18 tuổi trở lên (BR-04).');
        }
        if (!jobPosition) errors.push('Vị trí công việc là bắt buộc.');
        if (!contractStartDate) errors.push('Ngày bắt đầu HĐ là bắt buộc.');
        
        // BR-02: Ngày bắt đầu HĐ không được sau ngày thông báo quá 30 ngày
        if (contractStartDate) {
            var notificationDateEl = document.getElementById('notificationDate');
            if (notificationDateEl && notificationDateEl.value) {
                var notificationDate = new Date(notificationDateEl.value);
                var contractDate = new Date(contractStartDate);
                var maxAllowedDate = new Date(notificationDate);
                maxAllowedDate.setDate(maxAllowedDate.getDate() + 30);
                
                if (contractDate > maxAllowedDate) {
                    errors.push('Ngày bắt đầu hợp đồng không được sau ngày thông báo quá 30 ngày (BR-02).');
                }
            }
        }
        
        if (contractEndDate && contractStartDate && contractEndDate < contractStartDate)
            errors.push('Ngày kết thúc HĐ phải sau ngày bắt đầu.');

        // Validate files
        if (!workerFileSelections.passportFile)
            errors.push('File hộ chiếu là bắt buộc.');
        if (!workerFileSelections.contractFile)
            errors.push('File hợp đồng là bắt buộc.');

        if (errors.length > 0) {
            if (errorEl) {
                errorEl.textContent = errors.join(' ');
                errorEl.style.display = 'block';
            }
            return;
        }

        var worker = {
            fullName: fullName,
            nationalityId: nationalityId,
            nationalityName: nationalityName,
            passportNumber: passportNumber,
            dateOfBirth: dateOfBirth,
            gender: gender,
            jobPosition: jobPosition,
            contractStartDate: contractStartDate,
            contractEndDate: contractEndDate || null,
            visaNumber: visaNumber || null,
            visaExpiryDate: visaExpiryDate || null,
            passportFile: workerFileSelections.passportFile,
            contractFile: workerFileSelections.contractFile
        };

        // Check if editing existing worker
        if (window.fweForm._editingIndex !== undefined && window.fweForm._editingIndex !== -1) {
            workers[window.fweForm._editingIndex] = worker;
            window.fweForm._editingIndex = -1;
        } else {
            workers.push(worker);
        }

        renderWorkersTable();
        renderWorkersHiddenInputs();
        showError('workersError', '');
        
        // Reset modal button text
        var btnConfirm = document.getElementById('btnConfirmAddWorker');
        if (btnConfirm) {
            btnConfirm.textContent = '';
            var icon = document.createElement('i');
            icon.className = 'fas fa-plus mr-1';
            btnConfirm.appendChild(icon);
            btnConfirm.appendChild(document.createTextNode('Thêm vào danh sách'));
        }
        
        $('#addWorkerModal').modal('hide');
    }

    function renderWorkersTable() {
        var tbody = document.getElementById('workerTableBody');
        var emptyRow = document.getElementById('emptyWorkerRow');

        if (workers.length === 0) {
            tbody.innerHTML = '';
            if (emptyRow) {
                tbody.appendChild(emptyRow);
                emptyRow.style.display = '';
            }
            return;
        }

        var html = '';
        workers.forEach(function (w, idx) {
            var genderLabel = w.gender === 1 ? 'Nam' : (w.gender === 2 ? 'Nữ' : 'Khác');
            var fileIcons = '';
            if (w.passportFile && w.contractFile) {
                fileIcons = ' <i class="fas fa-paperclip" style="color:#10b981; font-size:11px; margin-left:6px;" title="Đã có file"></i>';
            }
            html += '<tr>'
                + '<td class="text-center">' + (idx + 1) + '</td>'
                + '<td>' + escapeHtml(w.fullName) + fileIcons + '</td>'
                + '<td>' + escapeHtml(w.nationalityName) + '</td>'
                + '<td><code style="font-size:12px;">' + escapeHtml(w.passportNumber) + '</code></td>'
                + '<td>' + formatDate(w.dateOfBirth) + '</td>'
                + '<td>' + genderLabel + '</td>'
                + '<td>' + escapeHtml(w.jobPosition) + '</td>'
                + '<td>' + formatDate(w.contractStartDate) + '</td>'
                + '<td>' + (w.contractEndDate ? formatDate(w.contractEndDate) : '<span class="text-muted">—</span>') + '</td>'
                + '<td class="text-center">'
                + '<button type="button" onclick="fweForm.editWorker(' + idx + ')" '
                + 'class="btn btn-link btn-sm p-0 mr-2" style="color:var(--primary);" title="Sửa">'
                + '<i class="fas fa-edit"></i>'
                + '</button>'
                + '<button type="button" onclick="fweForm.removeWorker(' + idx + ')" '
                + 'class="btn btn-link btn-sm p-0" style="color:#ef4444;" title="Xóa">'
                + '<i class="fas fa-trash-alt"></i>'
                + '</button>'
                + '</td>'
                + '</tr>';
        });

        tbody.innerHTML = html;
    }

    function renderWorkersHiddenInputs() {
        var container = document.getElementById('workersHiddenInputs');
        if (!container) return;

        var html = '';
        workers.forEach(function (w, i) {
            var prefix = 'Workers[' + i + '].';
            html += hiddenInput(prefix + 'FullName', w.fullName)
                + hiddenInput(prefix + 'NationalityId', w.nationalityId || '')
                + hiddenInput(prefix + 'NationalityName', w.nationalityName)
                + hiddenInput(prefix + 'PassportNumber', w.passportNumber)
                + hiddenInput(prefix + 'DateOfBirth', w.dateOfBirth)
                + hiddenInput(prefix + 'Gender', w.gender || '1')  // Default to 1 if missing
                + hiddenInput(prefix + 'JobPosition', w.jobPosition)
                + hiddenInput(prefix + 'ContractStartDate', w.contractStartDate)
                + (w.contractEndDate ? hiddenInput(prefix + 'ContractEndDate', w.contractEndDate) : '')
                + (w.visaNumber ? hiddenInput(prefix + 'VisaNumber', w.visaNumber) : '')
                + (w.visaExpiryDate ? hiddenInput(prefix + 'VisaExpiryDate', w.visaExpiryDate) : '');
        });
        container.innerHTML = html;
    }

    function hiddenInput(name, value) {
        return '<input type="hidden" name="' + escapeHtml(name) + '" value="' + escapeHtml(String(value)) + '" />';
    }

    // Public API for inline onclick
    window.fweForm = {
        editWorker: function (index) {
            if (index < 0 || index >= workers.length) return;
            var w = workers[index];
            
            document.getElementById('w_fullName').value = w.fullName;
            $('#w_nationalityId').val(w.nationalityId).trigger('change');
            document.getElementById('w_passportNumber').value = w.passportNumber;
            document.getElementById('w_dateOfBirth').value = w.dateOfBirth;
            document.getElementById('w_gender').value = w.gender;
            document.getElementById('w_jobPosition').value = w.jobPosition;
            document.getElementById('w_contractStartDate').value = w.contractStartDate;
            document.getElementById('w_contractEndDate').value = w.contractEndDate || '';
            document.getElementById('w_visaNumber').value = w.visaNumber || '';
            document.getElementById('w_visaExpiryDate').value = w.visaExpiryDate || '';

            // Load worker files
            workerFileSelections.passportFile = w.passportFile || null;
            workerFileSelections.contractFile = w.contractFile || null;
            displayWorkerFile('passport');
            displayWorkerFile('contract');

            // Show visa fields if data exists
            var visaCollapse = document.getElementById('visaFieldsCollapse');
            if (visaCollapse && (w.visaNumber || w.visaExpiryDate)) {
                visaCollapse.style.display = '';
                var btnToggle = document.getElementById('btnToggleVisaFields');
                if (btnToggle) {
                    var icon = btnToggle.querySelector('i');
                    if (icon) icon.className = 'fas fa-chevron-up mr-1';
                }
            }

            // Store current edit index
            window.fweForm._editingIndex = index;

            // Change button text to "Cập nhật"
            var btnConfirm = document.getElementById('btnConfirmAddWorker');
            if (btnConfirm) btnConfirm.textContent = '';
            if (btnConfirm) {
                var icon = document.createElement('i');
                icon.className = 'fas fa-save mr-1';
                btnConfirm.appendChild(icon);
                btnConfirm.appendChild(document.createTextNode('Cập nhật'));
            }

            $('#addWorkerModal').modal('show');
        },
        removeWorker: function (index) {
            if (!confirm('Bạn có chắc muốn xóa lao động "' + escapeHtml(workers[index].fullName) + '" khỏi danh sách?')) return;
            workers.splice(index, 1);
            renderWorkersTable();
            renderWorkersHiddenInputs();
        }
    };

    // ── 4. File Upload Zones ──────────────────────────────────────────────────
    function initFileZones() {
        initFileZone('vanBanGocFileInput', 'vanBanGocUploadZone', 'vanBanGocFileQueue',
            'vanBanGoc', 5, 10, ['pdf', 'jpg', 'jpeg', 'png']);

        initFileZone('scanGocFileInput', 'scanGocUploadZone', 'scanGocFileQueue',
            'scanGoc', 1, 10, ['pdf']);

        initFileZone('otherFilesInput', 'otherFilesUploadZone', 'otherFilesQueue',
            'other', 10, 10, null);
    }

    function initFileZone(inputId, zoneId, queueId, fileType, maxFiles, maxMb, allowedExts) {
        // fileType: 'vanBanGoc', 'scanGoc', 'other'
        var input = document.getElementById(inputId);
        var zone = document.getElementById(zoneId);
        if (!input || !zone) return;

        input.addEventListener('change', function (e) {
            var files = Array.from(e.target.files || []);
            handleSelectedFiles(files, fileType, maxFiles, maxMb, allowedExts, queueId);
            input.value = ''; // reset so same file can be re-selected
        });

        zone.addEventListener('dragover', function (e) {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', function () {
            zone.classList.remove('drag-over');
        });
        zone.addEventListener('drop', function (e) {
            e.preventDefault();
            zone.classList.remove('drag-over');
            var files = Array.from(e.dataTransfer.files || []);
            handleSelectedFiles(files, fileType, maxFiles, maxMb, allowedExts, queueId);
        });
    }

    function handleSelectedFiles(files, fileType, maxFiles, maxMb, allowedExts, queueId) {
        // fileType: 'vanBanGoc', 'scanGoc', 'other'
        var errors = [];

        Array.from(files).forEach(function (file) {
            if (fileSelections[fileType].length >= maxFiles) {
                errors.push('Tối đa ' + maxFiles + ' tệp cho khu vực này.');
                return;
            }

            var ext = file.name.split('.').pop().toLowerCase();
            if (allowedExts && allowedExts.indexOf(ext) === -1) {
                errors.push('Định dạng ".' + ext + '" không được phép. Chấp nhận: ' + allowedExts.join(', '));
                return;
            }

            if (file.size > maxMb * 1024 * 1024) {
                errors.push('"' + file.name + '" vượt quá giới hạn ' + maxMb + ' MB.');
                return;
            }

            // Store File object locally
            fileSelections[fileType].push(file);
        });

        if (errors.length > 0) {
            errors.forEach(function (msg) { toastr.error(msg); });
        }

        displaySelectedFiles(fileType, queueId);
    }

    function displaySelectedFiles(fileType, queueId) {
        var queue = document.getElementById(queueId);
        if (!queue) return;

        queue.innerHTML = '';
        var files = fileSelections[fileType] || [];

        files.forEach(function (file, idx) {
            var item = document.createElement('div');
            item.className = 'file-queue-item';
            var sizeLabel = formatFileSize(file.size);
            item.innerHTML = '<i class="fas fa-file-alt" style="color:var(--primary);"></i>'
                + '<span>' + escapeHtml(file.name) + ' <span style="color:#94a3b8;">(' + sizeLabel + ')</span></span>'
                + '<span class="file-remove" title="Xóa"><i class="fas fa-times"></i></span>';

            var removeBtn = item.querySelector('.file-remove');
            if (removeBtn) {
                removeBtn.addEventListener('click', function () {
                    fileSelections[fileType].splice(idx, 1);
                    displaySelectedFiles(fileType, queueId);
                });
            }

            queue.appendChild(item);
        });
    }

    // ── 5. Form Validation & Submit ───────────────────────────────────────────
    function initFormSubmit() {
        var form = document.getElementById('fweCreateForm');
        if (!form) return;

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            clearAllErrors();

            var valid = true;
            var errors = [];

            // Validate enterprise
            var enterpriseId = document.getElementById('enterpriseId').value;
            if (!enterpriseId) {
                showError('enterpriseIdError', 'Vui lòng chọn doanh nghiệp.');
                errors.push('Chưa chọn doanh nghiệp.');
                valid = false;
            }

            // Validate reason IDs
            var reasonIds = document.getElementById('reasonIds').value;
            if (!reasonIds) {
                showError('reasonIdsError', 'Vui lòng chọn ít nhất 1 lý do.');
                errors.push('Chưa chọn lý do.');
                valid = false;
            }

            // Validate ReasonDetails required when code 10 or 11 selected
            var hasOtherReason = reasonIds.split(',').some(function (rid) { return rid === '10' || rid === '11'; });
            if (hasOtherReason) {
                var details = document.getElementById('reasonDetails').value.trim();
                if (!details) {
                    showError('reasonDetailsError', 'Diễn giải lý do là bắt buộc.');
                    errors.push('Diễn giải lý do là bắt buộc khi chọn mục 10 hoặc 11.');
                    valid = false;
                }
            }

            // Validate workers
            if (workers.length === 0) {
                showError('workersError', 'Phải có ít nhất 1 lao động nước ngoài.');
                errors.push('Chưa có lao động nước ngoài nào.');
                valid = false;
            }

            // Validate van ban goc
            if (!fileSelections.vanBanGoc || fileSelections.vanBanGoc.length === 0) {
                showError('vanBanGocError', 'File đính kèm văn bản gốc là bắt buộc.');
                errors.push('Chưa chọn file văn bản gốc.');
                valid = false;
            }

            // Validate scan goc
            if (!fileSelections.scanGoc || fileSelections.scanGoc.length === 0) {
                showError('scanGocError', 'File scan gốc là bắt buộc.');
                errors.push('Chưa chọn file scan gốc.');
                valid = false;
            }

            if (!valid) {
                var summary = document.getElementById('formErrorSummary');
                if (summary) {
                    summary.innerHTML = '<strong>Vui lòng kiểm tra lại:</strong> '
                        + errors.map(function (msg) { return escapeHtml(msg); }).join(' | ');
                    summary.style.display = 'block';
                }
                summary && summary.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            // Prepare FormData with form fields + files
            var formData = new FormData(form);

            // Append files
            (fileSelections.vanBanGoc || []).forEach(function (file) {
                formData.append('vanBanGocFiles', file);
            });
            (fileSelections.scanGoc || []).forEach(function (file) {
                formData.append('scanGocFiles', file);
            });
            (fileSelections.other || []).forEach(function (file) {
                formData.append('otherFiles', file);
            });

            // Append worker files
            workers.forEach(function (worker, idx) {
                if (worker.passportFile) {
                    formData.append('Worker_' + idx + '_PassportFile', worker.passportFile);
                }
                if (worker.contractFile) {
                    formData.append('Worker_' + idx + '_ContractFile', worker.contractFile);
                }
            });

            // Submit FormData
            var btn = document.querySelector('button[type="submit"]');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang lưu...';
            }

            fetch(form.action || ROUTES.index, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (result.success) {
                    toastr.success(result.message || 'Lưu thành công');
                    setTimeout(function () {
                        window.location.href = ROUTES.index;
                    }, 1500);
                } else {
                    toastr.error(result.message || 'Không thể lưu');
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-save mr-1"></i> Lưu & Xác nhận';
                    }
                }
            })
            .catch(function (err) {
                toastr.error('Lỗi kết nối: ' + (err.message || 'Không xác định'));
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save mr-1"></i> Lưu & Xác nhận';
                }
            });
        });
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        initEnterpriseAutocomplete();
        initReasonMultiSelect();
        initWorkerModal();
        initFileZones();
        initFormSubmit();

        // Set default notification date to today if not set
        var notifDate = document.getElementById('notificationDate');
        if (notifDate && !notifDate.value) {
            var today = new Date().toISOString().split('T')[0];
            notifDate.value = today;
        }
    });

})();
