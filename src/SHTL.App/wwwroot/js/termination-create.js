/**
 * Termination Create — SCR-NV-TERM-002 (PA-B)
 * Module: M0085 — Nhập thay hộ DN (PA-B)
 * Pattern: IIFE
 * Flow: Tìm DN → Chọn LĐNN → Nhập chi tiết → File → Submit
 */
(function () {
    'use strict';

    var selectedEnterpriseId = null;
    var selectedWorkerId = null;
    var attachedFiles = [];
    var dnSearchItems = [];
    var searchTimer = null;

    function clearSelectedEnterpriseState(clearKeyword) {
        selectedEnterpriseId = null;
        selectedWorkerId = null;
        dnSearchItems = [];
        $('#hdnEnterpriseId').val('');
        $('#dnRes').hide();
        $('#formPB').hide();
        $('#dnSuggest').removeClass('show').empty();
        if (clearKeyword) {
            $('#dnQ').val('');
        }
        $('#workerSelect').html('<option value="">-- Chọn DN trước --</option>');
        $('#ldnnInfo').hide().html('');
    }

    // ── Utilities ──────────────────────────────────────────────────────
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function getToken() {
        var el = document.querySelector('input[name="__RequestVerificationToken"]');
        return el ? el.value : '';
    }

    function normalizeStatus(status) {
        if (!status) return '—';
        var raw = status.toString().trim().toLowerCase();
        if (raw.includes('dang') && raw.includes('viec')) return 'Hoạt động';
        return status;
    }

    function formatDateDisplay(dateText) {
        if (!dateText) return '—';
        var datePart = dateText.toString().split('T')[0];
        if (!datePart || datePart.indexOf('-') < 0) return dateText;
        var chunks = datePart.split('-');
        if (chunks.length !== 3) return dateText;
        return chunks[2] + '/' + chunks[1] + '/' + chunks[0];
    }

    function buildStatusHtml(statusText) {
        var normalized = normalizeStatus(statusText);
        if (normalized === 'Hoạt động') {
            return '<span class="status-active">Hoạt động</span>';
        }
        return '<span>' + escapeHtml(normalized || '—') + '</span>';
    }

    function ensureSuggestPortal() {
        var panel = document.getElementById('dnSuggest');
        if (!panel) return;

        if (panel.parentElement !== document.body) {
            document.body.appendChild(panel);
        }
    }

    function positionSuggestPanel() {
        var input = document.getElementById('dnQ');
        var panel = document.getElementById('dnSuggest');
        if (!input || !panel) return;

        var rect = input.getBoundingClientRect();
        panel.style.position = 'fixed';
        panel.style.left = rect.left + 'px';
        panel.style.top = (rect.bottom + 4) + 'px';
        panel.style.width = rect.width + 'px';
        panel.style.zIndex = '2147483000';
    }

    // ── Step 1: Tìm DN — §3.2 ─────────────────────────────────────────
    function selectEnterprise(dn) {
        selectedEnterpriseId = dn.id;
        $('#hdnEnterpriseId').val(dn.id);

        var html = '';
        html += '<div class="ig-item"><label>Tên DN</label><span>' + escapeHtml(dn.name) + '</span></div>';
        html += '<div class="ig-item"><label>MST</label><span>' + escapeHtml(dn.taxCode) + '</span></div>';
        html += '<div class="ig-item"><label>KCN</label><span>' + escapeHtml(dn.industrialZoneName || '—') + '</span></div>';
        html += '<div class="ig-item"><label>ĐDPL</label><span>' + escapeHtml(dn.representativeName || '—') + '</span></div>';
        html += '<div class="ig-item"><label>SĐT</label><span>' + escapeHtml(dn.phone || '—') + '</span></div>';
        html += '<div class="ig-item"><label>Email</label><span>' + escapeHtml(dn.email || '—') + '</span></div>';
        $('#dnInfoGrid').html(html);
        $('#dnRes').show();
        $('#formPB').show();

        loadWorkers(dn.id);
    }

    function renderEnterpriseSuggestions(items) {
        ensureSuggestPortal();
        var $suggest = $('#dnSuggest');
        if (!Array.isArray(items) || items.length === 0) {
            $suggest.removeClass('show').empty();
            return;
        }

        var html = items.map(function (dn) {
            return '<div class="proxy-search-item" data-id="' + dn.id + '">' +
                   '<div class="name">' + escapeHtml(dn.name || '—') + '</div>' +
                   '<div class="meta">MST: ' + escapeHtml(dn.taxCode || '—') + ' | KCN: ' + escapeHtml(dn.industrialZoneName || '—') + '</div>' +
                   '</div>';
        }).join('');

        $suggest.html(html).addClass('show');
        positionSuggestPanel();
    }

    function searchEnterprise(keyword, silent) {
        var q = (keyword || '').trim();
        var kcn = $('#kcnFilter').val();

        $.getJSON('/TerminationNotifications/SearchEnterprises', { q: q || null, kcn: kcn || null }, function (data) {
            var items = data.data || data || [];
            dnSearchItems = items;
            renderEnterpriseSuggestions(items);

            if (!silent && items.length === 0) {
                clearSelectedEnterpriseState(false);
                toastr.warning('Không tìm thấy doanh nghiệp phù hợp.');
                return;
            }

            if (!silent && items.length > 0) {
                selectEnterprise(items[0]);
                if (items.length > 1) {
                    toastr.info('Tìm thấy ' + items.length + ' DN. Đã chọn DN đầu tiên, bạn có thể chọn lại trong danh sách gợi ý.');
                }
            }
        }).fail(function () {
            dnSearchItems = [];
            renderEnterpriseSuggestions([]);
            if (!silent) {
                clearSelectedEnterpriseState(false);
                toastr.error('Lỗi kết nối khi tìm kiếm DN.');
            }
        });
    }

    function initDNSearch() {
        ensureSuggestPortal();

        $(window).on('resize scroll', function () {
            if ($('#dnSuggest').hasClass('show')) {
                positionSuggestPanel();
            }
        });

        $('#dnQ').on('input', function () {
            var keyword = $(this).val().trim();
            if (keyword.length < 1) {
                dnSearchItems = [];
                renderEnterpriseSuggestions([]);
                return;
            }

            positionSuggestPanel();
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                searchEnterprise(keyword, true);
            }, 150);
        });

        $('#btnSearchDN').on('click', function () {
            searchEnterprise($('#dnQ').val(), false);
        });

        $('#dnQ').on('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (dnSearchItems.length > 0) {
                    selectEnterprise(dnSearchItems[0]);
                    renderEnterpriseSuggestions(dnSearchItems);
                } else {
                    searchEnterprise($('#dnQ').val(), false);
                }
            }
        });

        $('#kcnFilter').on('change', function () {
            var keyword = $('#dnQ').val().trim();
            if (keyword.length >= 1) {
                searchEnterprise(keyword, true);
                return;
            }

            // Khi đã chọn KCN và ô tìm kiếm đang trống, mở sẵn danh sách DN theo KCN.
            if ($(this).val()) {
                searchEnterprise('', true);
            } else {
                renderEnterpriseSuggestions([]);
            }
        });

        $('#dnQ').on('focus', function () {
            var keyword = $(this).val().trim();
            var kcn = $('#kcnFilter').val();
            if (keyword.length === 0 && kcn) {
                searchEnterprise('', true);
            } else if (keyword.length >= 1) {
                searchEnterprise(keyword, true);
            }
        });

        $(document).on('click', '#dnSuggest .proxy-search-item', function () {
            var id = $(this).data('id');
            var selected = dnSearchItems.find(function (x) { return x.id === id; });
            if (selected) {
                selectEnterprise(selected);
                $('#dnQ').val(selected.name || '');
                renderEnterpriseSuggestions([]);
            }
        });

        $(document).on('click', function (e) {
            if (!$(e.target).closest('.proxy-search-wrap').length && !$(e.target).closest('#dnSuggest').length) {
                renderEnterpriseSuggestions([]);
            }
        });
    }

    function loadKcnFilter() {
        $.getJSON('/TerminationNotifications/GetIndustrialZones', function (data) {
            var items = data.data || data || [];
            var html = '<option value="">Tất cả KCN</option>';
            items.forEach(function (z) {
                html += '<option value="' + z.id + '">' + escapeHtml(z.name) + '</option>';
            });
            $('#kcnFilter').html(html);
        }).fail(function () {
            $('#kcnFilter').html('<option value="">Tất cả KCN</option>');
        });
    }

    $('#btnChangeDN').on('click', function () {
        clearSelectedEnterpriseState(true);
    });

    // ── LĐNN Dropdown — §3.4 ──────────────────────────────────────────
    function loadWorkers(enterpriseId) {
        $('#workerSelect').html('<option value="">Đang tải...</option>');
        $.getJSON('/TerminationNotifications/GetActiveWorkers/' + enterpriseId, function (data) {
            var items = data.data || data || [];
            var opts = '<option value="">-- Chọn LĐNN --</option>';
            items.forEach(function (w) {
                opts += '<option value="' + w.id + '"' +
                        ' data-name="' + escapeHtml(w.fullName) + '"' +
                        ' data-passport="' + escapeHtml(w.passportNumber) + '"' +
                        ' data-nationality="' + escapeHtml(w.nationalityName) + '"' +
                        ' data-position="' + escapeHtml(w.positionName || '') + '"' +
                        ' data-start="' + escapeHtml(w.contractStartDate || '') + '"' +
                        ' data-status="' + escapeHtml(w.status || '') + '">' +
                        escapeHtml(w.fullName) + ' (' + escapeHtml(w.passportNumber) + ')' +
                        '</option>';
            });
            $('#workerSelect').html(opts);
            if (items.length === 0) toastr.warning('Không có LĐNN đang hoạt động tại DN này.');
        }).fail(function () {
            $('#workerSelect').html('<option value="">-- Lỗi tải danh sách --</option>');
            toastr.error('Không thể tải danh sách LĐNN.');
        });
    }

    function initWorkerSelect() {
        $('#workerSelect').on('change', function () {
            var sel = $(this).find(':selected');
            selectedWorkerId = $(this).val();
            if (selectedWorkerId) {
                var html = '';
                html += '<div class="ig-item"><label>Họ tên</label><span>' + escapeHtml(sel.data('name')) + '</span></div>';
                html += '<div class="ig-item"><label>Hộ chiếu</label><span>' + escapeHtml(sel.data('passport')) + '</span></div>';
                html += '<div class="ig-item"><label>Quốc tịch</label><span>' + escapeHtml(sel.data('nationality')) + '</span></div>';
                html += '<div class="ig-item"><label>Vị trí</label><span>' + escapeHtml(sel.data('position') || '—') + '</span></div>';
                html += '<div class="ig-item"><label>Ngày bắt đầu HĐ</label><span>' + escapeHtml(formatDateDisplay(sel.data('start'))) + '</span></div>';
                html += '<div class="ig-item"><label>Trạng thái</label>' + buildStatusHtml(sel.data('status')) + '</div>';
                $('#ldnnInfo').html(html).css('display', 'grid');
            } else {
                $('#ldnnInfo').hide().html('');
            }
        });
    }

    // ── Load danh mục Lý do — §3.5 ───────────────────────────────────
    function loadReasons() {
        $.getJSON('/TerminationReasons/GetAll', { activeOnly: true }, function (data) {
            var items = data.data || data || [];
            var opts = '<option value="">-- Chọn lý do chấm dứt --</option>';
            items.forEach(function (r) {
                opts += '<option value="' + escapeHtml(r.code) + '">' +
                        escapeHtml(r.name) + ' (' + escapeHtml(r.legalBasis || '') + ')' +
                        '</option>';
            });
            $('#lyDoCD').html(opts);
        }).fail(function () {
            toastr.warning('Không thể tải danh mục lý do chấm dứt.');
        });
    }

    // ── Conditional: DiễnGiải khi ReasonCode = OTHER — §6.1 ──────────
    function initReasonConditional() {
        $('#lyDoCD').on('change', function () {
            if ($(this).val() === 'OTHER') {
                $('#dienGiaiWrap').show();
            } else {
                $('#dienGiaiWrap').hide();
                $('#dienGiai').val('');
                $('#charCount').text('0');
            }
        });

        $('#dienGiai').on('input', function () {
            $('#charCount').text(this.value.length);
        });
    }

    // ── File Upload — §3.6 ────────────────────────────────────────────
    function initFileUpload() {
        var zone = document.getElementById('uploadZone');
        var fileInput = document.getElementById('fileInput');

        zone.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', handleFiles);

        zone.addEventListener('dragover', function (e) {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', function () { zone.classList.remove('drag-over'); });
        zone.addEventListener('drop', function (e) {
            e.preventDefault();
            zone.classList.remove('drag-over');
            handleFiles({ target: { files: e.dataTransfer.files } });
        });

        function handleFiles(e) {
            var files = Array.from(e.target.files || []);
            var allowed = ['application/pdf', 'image/jpeg', 'image/png'];
            files.forEach(function (f) {
                if (!allowed.includes(f.type)) {
                    toastr.warning('Chỉ chấp nhận PDF, JPG, PNG: ' + f.name);
                    return;
                }
                if (f.size > 10 * 1024 * 1024) {
                    toastr.warning('File vượt 10MB: ' + f.name);
                    return;
                }
                if (attachedFiles.length >= 5) {
                    toastr.warning('Tối đa 5 file.');
                    return;
                }
                attachedFiles.push(f);
            });
            renderFileList();
        }

        function renderFileList() {
            var html = attachedFiles.map(function (f, i) {
                return '<div class="d-flex justify-content-between align-items-center py-1 px-2 mb-1" style="background:#f8fafc; border-radius:4px;">' +
                       '<span><i class="fas fa-paperclip mr-1 text-muted"></i>' + escapeHtml(f.name) +
                       ' <small class="text-muted">(' + (f.size / 1024).toFixed(0) + ' KB)</small></span>' +
                       '<button type="button" class="btn btn-sm btn-link text-danger p-0" onclick="removeFile(' + i + ')" title="Xóa"><i class="fas fa-times"></i></button>' +
                       '</div>';
            }).join('');
            document.getElementById('fileList').innerHTML = html;
        }

        window.removeFile = function (idx) {
            attachedFiles.splice(idx, 1);
            renderFileList();
        };
    }

    // ── Submit — §6.1 ────────────────────────────────────────────────
    function buildPayload(mode) {
        var rawDate = document.getElementById('terminationDate').value;
        var isDraft = mode === 'draft';
        var confirmImmediately = mode === 'confirm';
        return {
            EnterpriseId: selectedEnterpriseId,
            WorkerId: selectedWorkerId,
            TerminationDate: rawDate || null,
            ReasonCode: document.getElementById('lyDoCD').value,
            ReasonDetail: document.getElementById('dienGiai').value || null,
            DocumentNumber: document.getElementById('documentNumber').value || null,
            InternalNote: document.getElementById('internalNote').value || null,
            Notes: null,
            IsDraft: isDraft,
            ConfirmImmediately: confirmImmediately
        };
    }

    function validate() {
        if (!selectedEnterpriseId) { toastr.warning('Vui lòng chọn doanh nghiệp.'); return false; }
        if (!selectedWorkerId) { toastr.warning('Vui lòng chọn LĐNN.'); return false; }
        var termDate = document.getElementById('terminationDate').value;
        if (!termDate) { toastr.warning('Vui lòng nhập ngày chấm dứt.'); return false; }
        var reason = document.getElementById('lyDoCD').value;
        if (!reason) { toastr.warning('Vui lòng chọn lý do chấm dứt.'); return false; }
        if (reason === 'OTHER' && !document.getElementById('dienGiai').value.trim()) {
            toastr.warning('Vui lòng nhập diễn giải lý do.'); return false;
        }
        if (attachedFiles.length === 0) { toastr.warning('PA-B bắt buộc ít nhất 1 file scan văn bản gốc.'); return false; }
        return true;
    }

    function submitForm(mode) {
        if (!validate()) return;
        var payload = buildPayload(mode);

        fetch('/TerminationNotifications/CreateAjax', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': getToken()
            },
            body: JSON.stringify(payload)
        })
        .then(function (r) {
            return r.text().then(function (text) {
                if (!text) return { success: false, message: 'Phản hồi rỗng từ máy chủ.' };
                try {
                    return JSON.parse(text);
                } catch (e) {
                    return { success: false, message: 'Phản hồi không hợp lệ từ máy chủ.' };
                }
            });
        })
        .then(function (json) {
            if (json.success) {
                uploadAttachments(json.data.id)
                    .then(function (uploadResult) {
                        if (!uploadResult.success) {
                            toastr.warning(uploadResult.message || 'Đã tạo hồ sơ nhưng có file tải lên thất bại.');
                        } else {
                            toastr.success('Tạo hồ sơ thành công!');
                        }
                        window.location.href = '/TerminationNotifications';
                    })
                    .catch(function () {
                        toastr.warning('Đã tạo hồ sơ nhưng upload file gặp lỗi.');
                        window.location.href = '/TerminationNotifications';
                    });
            } else {
                toastr.error(json.message || 'Đã có lỗi xảy ra.');
            }
        })
        .catch(function () { toastr.error('Lỗi kết nối.'); });
    }

    function uploadAttachments(notificationId) {
        if (!notificationId || attachedFiles.length === 0) {
            return Promise.resolve({ success: true });
        }

        var uploads = attachedFiles.map(function (file, idx) {
            var form = new FormData();
            form.append('notificationId', notificationId);
            form.append('isOriginalScan', idx === 0 ? 'true' : 'false');
            form.append('file', file);

            return fetch('/TerminationNotifications/UploadAttachment', {
                method: 'POST',
                headers: {
                    'RequestVerificationToken': getToken()
                },
                body: form
            }).then(function (r) {
                return r.json().catch(function () {
                    return { success: false, message: 'Phản hồi upload không hợp lệ.' };
                });
            });
        });

        return Promise.all(uploads).then(function (results) {
            var failed = results.filter(function (x) { return !x || x.success !== true; });
            if (failed.length > 0) {
                return {
                    success: false,
                    message: 'Upload thành công ' + (results.length - failed.length) + '/' + results.length + ' file.'
                };
            }
            return { success: true };
        });
    }

    function initActionButtons() {
        $('#btnSaveDraft').on('click', function () { submitForm('draft'); });
        $('#btnSaveConfirm').on('click', function () { submitForm('confirm'); });
        $('#btnSubmit').on('click', function () {
            if (confirm('Bạn có chắc muốn nộp hồ sơ thay hộ doanh nghiệp?')) {
                submitForm('submit');
            }
        });
    }

    // ── Init ─────────────────────────────────────────────────────────
    $(document).ready(function () {
        loadKcnFilter();
        initDNSearch();
        initWorkerSelect();
        loadReasons();
        initReasonConditional();
        initFileUpload();
        initActionButtons();
    });

})();
