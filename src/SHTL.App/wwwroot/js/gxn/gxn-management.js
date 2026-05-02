(function () {
    'use strict';

    let table;
    let issuedTable;
    let searchTimer;

    const configElement = document.getElementById('gxn-page-config');
    if (!configElement) {
        return;
    }

    const pageType = configElement.dataset.page || '';

    const userPermissions = {
        canCreate: configElement.dataset.canCreate === 'true',
        canUpdate: configElement.dataset.canUpdate === 'true',
        canDelete: configElement.dataset.canDelete === 'true',
        canExport: configElement.dataset.canExport === 'true',
        canRevoke: configElement.dataset.canRevoke === 'true',
        canImport: configElement.dataset.canImport === 'true',
        canApprove: configElement.dataset.canApprove === 'true'
    };

    const dossierId = configElement.dataset.dossierId || '';
    const issuedId = configElement.dataset.issuedId || '';

    function getAntiForgeryToken() {
        const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
        return tokenInput ? tokenInput.value : '';
    }

    function buildHeaders() {
        const token = getAntiForgeryToken();
        return {
            'RequestVerificationToken': token,
            'X-XSRF-TOKEN': token
        };
    }

    function initDataTable() {
        table = $('#gxnTable').dataTableFigma({
            processing: true,
            serverSide: true,
            ajax: {
                url: '/gxn/dossiers/get-all',
                type: 'POST',
                headers: buildHeaders(),
                data: function (d) {
                    const pageSize = d.length;
                    const page = Math.floor(d.start / pageSize) + 1;

                    return {
                        __RequestVerificationToken: getAntiForgeryToken(),
                        draw: d.draw,
                        page: page,
                        pageSize: pageSize,
                        search: $('#searchInput').val() || null,
                        status: $('#statusFilter').val() || null,
                        issueType: $('#issueTypeFilter').val() || null,
                        isOverdue: $('#overdueFilter').is(':checked') ? true : null,
                        fromDate: $('#fromDateFilter').val() || null,
                        toDate: $('#toDateFilter').val() || null
                    };
                }
            },
            columns: [
                {
                    data: null,
                    className: 'text-center',
                    orderable: false,
                    render: function (data, type, row, meta) {
                        return meta.row + meta.settings._iDisplayStart + 1;
                    }
                },
                {
                    data: 'maHoSo',
                    render: function (data, type, row) {
                        return `<a href="/gxn/dossiers/${row.id}" class="text-primary font-weight-bold">${escapeHtml(row.maHoSo)}</a>`;
                    }
                },
                {
                    data: 'hoTenNld',
                    render: function (data, type, row) {
                        return `<a href="/gxn/dossiers/${row.id}" class="text-primary font-weight-bold">${escapeHtml(data)}</a>`;
                    }
                },
                { data: 'soHoChieu' },
                {
                    data: 'loaiNghiepVu',
                    className: 'text-center',
                    render: renderIssueType
                },
                {
                    data: 'trangThai',
                    className: 'text-center',
                    render: renderStatus
                },
                {
                    data: 'createdAt',
                    className: 'text-center',
                    render: renderDate
                },
                {
                    data: 'hanXuLy',
                    className: 'text-center',
                    render: renderDate
                },
                {
                    data: 'isOverdue',
                    className: 'text-center',
                    render: function (data) {
                        return data
                            ? '<span class="badge-figma badge-figma-danger">Quá hạn</span>'
                            : '<span class="badge-figma badge-figma-success">Đúng hạn</span>';
                    }
                },
                {
                    data: 'soGxn',
                    className: 'text-center',
                    render: function (data, type, row) {
                        // Số GIẤY chỉ hiển thị khi GXN đã được cấp (Có hiệu lực hoặc Đã thu hồi).
                        // Các trạng thái khác KHÔNG hiển thị số tự sinh — tránh nhầm với mã hồ sơ.
                        var st = row && row.trangThai;
                        if (st !== 'CoHieuLuc' && st !== 'DaThuHoi') {
                            return '<span class="text-muted">—</span>';
                        }
                        return data
                            ? '<span class="font-weight-bold" style="font-family:monospace;color:#1e40af;">' + escapeHtml(data) + '</span>'
                            : '<span class="text-muted">—</span>';
                    }
                },
                {
                    data: null,
                    className: 'text-center',
                    orderable: false,
                    render: renderActions
                }
            ],
            order: [[7, 'desc']],
            pageLength: 20,
            language: {
                processing: '<div class="spinner-border text-primary" role="status"></div>',
                emptyTable: '<div class="py-5 text-muted"><i class="fas fa-folder-open fa-3x mb-3 d-block"></i>Không có dữ liệu hồ sơ</div>'
            },
            dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
            drawCallback: function (settings) {
                if (typeof FigmaDataTables !== 'undefined' && FigmaDataTables.defaultConfig) {
                    FigmaDataTables.defaultConfig.drawCallback(settings);
                }

                var startIndex = settings._iDisplayStart;
                $(settings.nTable).find('tbody tr').each(function (i) {
                    if ($(this).find('td.dataTables_empty').length) return;
                    $(this).find('td:first-child').text(startIndex + i + 1);
                });

                var $container = $('.pagination-figma-container');
                if ($container.length && $('#paginationFrame').length) {
                    $container.appendTo('#paginationFrame');
                }

                var totalRecords = settings._iRecordsDisplay || 0;
                if (totalRecords === 0) {
                    $('#paginationFrame').hide();
                } else {
                    $('#paginationFrame').show();
                }
            }
        });
    }

    // ══════════════════════════════════════════════════
    // THU HỒI TỪ DANH SÁCH (mirror GPLD openRevokeFromList)
    // ══════════════════════════════════════════════════
    function openRevokeFromList(id, soGxn, tenNld, nsdld, ngayHetHan) {
        $('#revokeIssuedId').val(id);
        $('#revokeInfoSoGxn').text(soGxn);
        $('#revokeInfoTenNld').text(tenNld);
        $('#revokeInfoNsdld').text(nsdld).attr('title', nsdld);
        $('#revokeInfoNgayHetHan').text(ngayHetHan);
        // Clear form fields
        $('#revokeSoVanBan, #revokeLyDo').val('');
        $('#revokeNgayBanHanh').val('');
        $('#revokeDieuKhoan').val('Dieu32');
        $('#revokeCharCount').text('0 ký tự').removeClass('text-danger');
        $('#modalThuHoi').modal('show');
    }

    // ══════════════════════════════════════════════════
    // BIND MODAL THU HỒI — dùng chung cho cả list và detail
    // ══════════════════════════════════════════════════
    function bindRevokeModal() {
        // Init Select2 for DieuKhoan select inside modal (must set dropdownParent)
        $('#modalThuHoi').on('show.bs.modal', function () {
            if ($.fn.select2 && !$('#revokeDieuKhoan').hasClass('select2-hidden-accessible')) {
                $('#revokeDieuKhoan').select2({ dropdownParent: $('#modalThuHoi'), width: '100%' });
            }
        });

        // Char count for LyDoThuHoi
        $(document).on('input', '#revokeLyDo', function () {
            var len = $(this).val().length;
            $('#revokeCharCount').text(len + ' ký tự').toggleClass('text-danger', len < 20);
        });

        // Confirm Thu Hoi
        $(document).on('click', '#btnConfirmThuHoi', function () {
            var id = $('#revokeIssuedId').val();
            if (!id) { return; }

            var soVanBan = $('#revokeSoVanBan').val().trim();
            var ngayBanHanh = $('#revokeNgayBanHanh').val() || null;
            var dieuKhoan = $('#revokeDieuKhoan').val();
            var lyDo = $('#revokeLyDo').val().trim();

            if (!soVanBan || !dieuKhoan || lyDo.length < 20) {
                if (window.toastr) {
                    toastr.warning('Vui lòng điền đầy đủ thông tin và lý do tối thiểu 20 ký tự.');
                }
                return;
            }

            var requestData = {
                SoVanBan: soVanBan,
                NgayBanHanh: ngayBanHanh,
                DieuKhoanCanCu: dieuKhoan,
                LyDoThuHoi: lyDo
            };

            var $btn = $(this);
            $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');

            $.ajax({
                url: '/gxn/issued/' + id + '/revoke',
                type: 'POST',
                contentType: 'application/json',
                headers: buildHeaders(),
                data: JSON.stringify(requestData),
                success: function (response) {
                    $btn.prop('disabled', false).html('<i class="fas fa-ban mr-1"></i> Xác nhận Thu hồi');
                    if (response && response.success) {
                        $('#modalThuHoi').modal('hide');
                        showSuccess(response.message || 'Thu hồi GXN thành công.');
                        setTimeout(function () {
                            if (pageType === 'issue-detail') {
                                window.location.reload();
                            } else if (issuedTable) {
                                issuedTable.ajax.reload(null, false);
                            }
                        }, 700);
                    } else {
                        showError((response && response.message) || 'Không thể thu hồi GXN.');
                    }
                },
                error: function (xhr) {
                    $btn.prop('disabled', false).html('<i class="fas fa-ban mr-1"></i> Xác nhận Thu hồi');
                    handleConflict(xhr, 'Có lỗi xảy ra khi thu hồi GXN.');
                }
            });
        });
    }

    function initIssuedDataTable() {
        issuedTable = $('#gxnIssuedTable').dataTableFigma({
            processing: true,
            serverSide: true,
            ajax: {
                url: '/gxn/issued/get-all',
                type: 'POST',
                headers: buildHeaders(),
                data: function (d) {
                    const pageSize = d.length;
                    const page = Math.floor(d.start / pageSize) + 1;

                    return {
                        __RequestVerificationToken: getAntiForgeryToken(),
                        draw: d.draw,
                        page: page,
                        pageSize: pageSize,
                        soGxn: $('#issuedSearchInput').val() || null,
                        tenNld: $('#issuedTenNldFilter').val() || null,
                        quocTich: $('#issuedQuocTichFilter').val() || null,
                        nsdld: $('#issuedNsdldFilter').val() || null,
                        tab: $('#issuedTab').val() || null,
                        trangThai: $('#filterTrangThai').val() || null,
                        loaiNghiepVu: $('#filterLoaiNghiepVu').val() || null,
                        fromNgayCap: $('#issuedFromNgayCapFilter').val() || null,
                        toNgayCap: $('#issuedToNgayCapFilter').val() || null
                    };
                }
            },
            columns: [
                {
                    data: null,
                    className: 'text-center',
                    orderable: false,
                    render: function (data, type, row, meta) {
                        return meta.row + meta.settings._iDisplayStart + 1;
                    }
                },
                { data: 'soGxn', render: function (data, type, row) {
                    if (type !== 'display') return data || '';
                    return '<a href="/gxn/issued/' + escapeHtml(String(row.id)) + '" class="font-weight-bold text-primary" style="font-family:\'IBM Plex Mono\';">' + escapeHtml(data || '\u2014') + '</a>';
                }},
                { data: 'hoTenNld' },
                { data: 'quocTich' },
                { data: 'tenNsdld' },
                {
                    data: 'loaiNghiepVu',
                    className: 'text-center',
                    render: renderIssueType
                },
                {
                    data: 'ngayKy',
                    className: 'text-center',
                    render: renderDate
                },
                {
                    data: 'ngayHetHan',
                    className: 'text-center',
                    render: renderDate
                },
                {
                    data: 'trangThai',
                    className: 'text-center',
                    render: renderIssuedStatus
                },
                {
                    data: null,
                    className: 'text-center',
                    orderable: false,
                    render: renderIssuedActions
                }
            ],
            order: [[6, 'desc']],
            pageLength: 20,
            language: {
                processing: '<div class="spinner-border text-primary" role="status"></div>',
                emptyTable: '<div class="py-5 text-muted"><i class="fas fa-folder-open fa-3x mb-3 d-block"></i>Không có dữ liệu hồ sơ</div>'
            },
            dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
            drawCallback: function (settings) {
                if (typeof FigmaDataTables !== 'undefined' && FigmaDataTables.defaultConfig) {
                    FigmaDataTables.defaultConfig.drawCallback(settings);
                }

                var startIndex = settings._iDisplayStart;
                $(settings.nTable).find('tbody tr').each(function (i) {
                    if ($(this).find('td.dataTables_empty').length) return;
                    $(this).find('td:first-child').text(startIndex + i + 1);
                });

                var $container = $('.pagination-figma-container');
                if ($container.length && $('#paginationFrame').length) {
                    $container.appendTo('#paginationFrame');
                }

                var totalRecords = settings._iRecordsDisplay || 0;
                if (totalRecords === 0) {
                    $('#paginationFrame').hide();
                } else {
                    $('#paginationFrame').show();
                }
            }
        });
    }

    function initEvents() {
        // Toggle advanced filter panel (same pattern as HoSoGiayPhep)
        $('#btnToggleAdvancedFilter').on('click', function () {
            $('#advancedFilterArea').toggleClass('show');
            $(this).toggleClass('active');
        });

        // Refresh — reload without changing filters
        $('#btnRefresh').on('click', function () {
            table.ajax.reload();
        });

        // Apply filters (inside advanced panel)
        $('#btnApplyFilters').on('click', function () {
            table.ajax.reload();
        });

        $('#btnSearch').on('click', function () {
            table.ajax.reload();
        });

        $('#btnReset').on('click', function () {
            $('#filterForm')[0] && $('#filterForm')[0].reset();
            $('#searchInput').val('');
            $('#statusFilter').val('');
            $('#issueTypeFilter').val('');
            $('#fromDateFilter').val('');
            $('#toDateFilter').val('');
            $('#overdueFilter').prop('checked', false);
            table.ajax.reload();
        });

        $('#searchInput').on('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                table.ajax.reload();
            }, 400);
        });

        $('#statusFilter, #issueTypeFilter, #fromDateFilter, #toDateFilter, #overdueFilter').on('change', function () {
            table.ajax.reload();
        });

        $('#btnExport').on('click', function () {
            if (!userPermissions.canExport) {
                if (window.toastr) {
                    toastr.warning('Bạn không có quyền xuất dữ liệu.');
                }
                return;
            }

            // Xuất Excel trực tiếp với filter hiện tại
            var params = [];
            var search = $('#searchInput').val();
            if (search) params.push('search=' + encodeURIComponent(search));
            var status = $('#statusFilter').val();
            if (status) params.push('status=' + encodeURIComponent(status));
            var issueType = $('#issueTypeFilter').val();
            if (issueType) params.push('issueType=' + encodeURIComponent(issueType));
            var fromDate = $('#fromDateFilter').val();
            if (fromDate) params.push('fromDate=' + encodeURIComponent(fromDate));
            var toDate = $('#toDateFilter').val();
            if (toDate) params.push('toDate=' + encodeURIComponent(toDate));
            var isOverdue = $('#overdueFilter').is(':checked');
            if (isOverdue) params.push('isOverdue=true');

            window.location.href = '/gxn/dossiers/export-excel' + (params.length ? '?' + params.join('&') : '');
        });

        $(document).on('click', '.btn-delete-draft', function () {
            const dossierId = $(this).data('id');
            const dossierName = $(this).data('name');
            deleteDraft(dossierId, dossierName);
        });
    }

    function initIssuedEvents() {
        let issuedSearchTimer;

        $('#btnIssuedSearch').on('click', function () {
            if (issuedTable) {
                issuedTable.ajax.reload();
            }
        });

        $('#btnIssuedReset').on('click', function () {
            $('#issuedSearchInput').val('');
            $('#issuedTenNldFilter').val('');
            $('#issuedQuocTichFilter').val('');
            $('#issuedNsdldFilter').val('');
            $('#issuedFromNgayCapFilter').val('');
            $('#issuedToNgayCapFilter').val('');
            $('#issuedTab').val('').trigger('change.select2');
            $('#filterTrangThai').val('').trigger('change.select2');
            $('#filterLoaiNghiepVu').val('').trigger('change.select2');
            if (issuedTable) {
                issuedTable.ajax.reload();
            }
        });

        $('#btnToggleIssuedFilter').on('click', function () {
            $('#issuedAdvancedFilterArea').toggleClass('show');
            $(this).toggleClass('active');
        });

        $('#btnIssuedApplyFilters').on('click', function () {
            if (issuedTable) {
                issuedTable.ajax.reload();
            }
        });

        $('#issuedSearchInput').on('keypress', function (e) {
            if (e.which === 13) {
                e.preventDefault();
                if (issuedTable) issuedTable.ajax.reload();
            }
        });

        $('#issuedSearchInput').on('input', function () {
            clearTimeout(issuedSearchTimer);
            issuedSearchTimer = setTimeout(function () {
                if (issuedTable) {
                    issuedTable.ajax.reload();
                }
            }, 400);
        });

        $('#issuedTab').on('change', function () {
            if (issuedTable) {
                issuedTable.ajax.reload();
            }
        });

        $('#filterTrangThai, #filterLoaiNghiepVu').on('change', function () {
            if (issuedTable) {
                issuedTable.ajax.reload();
            }
        });

        // Stat card clicks: set tab filter and reload
        $(document).on('click', '.card-figma-stat[data-tab]', function () {
            var tab = $(this).data('tab');
            $('#issuedTab').val(tab || '').trigger('change.select2');
            if (issuedTable) issuedTable.ajax.reload();
            // Active state
            $('.card-figma-stat[data-tab]').removeClass('stat-active');
            $(this).addClass('stat-active');
        });

        // Thu hồi từ danh sách (mirror GPLD openRevokeFromList pattern)
        $(document).on('click', '.btn-revoke-issued', function (e) {
            e.stopPropagation();
            var $btn = $(this);
            openRevokeFromList(
                $btn.data('id'),
                $btn.data('soGxn'),
                $btn.data('tenNld'),
                $btn.data('nsdld'),
                $btn.data('ngayHetHan')
            );
        });
    }

    function loadIssuedStatistics() {
        $.ajax({
            url: '/gxn/issued/statistics',
            method: 'GET',
            success: function (response) {
                if (response && response.success && response.data) {
                    var d = response.data;
                    $('#issuedStatTotal').text(d.total   || 0);
                    $('#issuedStatActive').text(d.coHieuLuc  || 0);
                    $('#issuedStatExpiring').text(d.sapHetHan || 0);
                    $('#issuedStatRevoked').text(d.daThuHoi  || 0);
                } else {
                    $('#issuedStatTotal, #issuedStatActive, #issuedStatExpiring, #issuedStatRevoked').text('—');
                }
            },
            error: function () {
                $('#issuedStatTotal, #issuedStatActive, #issuedStatExpiring, #issuedStatRevoked').text('—');
            }
        });
    }

    function initDetailsEvents() {
        // === KHÔNG ĐỦ ĐIỀU KIỆN (mirror GPLD #btnIneligible → Swal → Reject) ===
        $('#btnIneligible').on('click', function () {
            if (!userPermissions.canExport) {
                showWarning('Bạn không có quyền thực hiện thao tác này.');
                return;
            }

            var maHoSo = configElement.dataset.maHoSo || 'Hồ sơ';
            var hoTen = configElement.dataset.hoTen || '';

            var html = '<div class="text-left">' +
                '<div class="p-3 mb-3" style="background:#fff1f2; border:1px solid #fecaca; border-radius:12px;">' +
                '<div class="font-weight-bold" style="color:#991b1b; font-size:14px; text-transform:uppercase;">' + escapeHtml(maHoSo) + ' – ' + escapeHtml(hoTen) + '</div>' +
                '<div style="color:#b91c1c; font-size:13px; margin-top:4px;">' +
                'Trạng thái sẽ chuyển thành <strong>"Không đủ điều kiện"</strong> – đây là trạng thái cuối, <u>không thể hoàn tác</u> trừ khi tạo hồ sơ mới.' +
                '</div></div>' +
                '<label class="font-weight-bold mb-2" style="font-size:13px; color:#374151;">Lý do từ chối <span class="text-danger">*</span></label>' +
                '<textarea id="ineligibleReason" class="input-figma" style="height:100px; padding:12px;" placeholder="Nhập lý do từ chối hồ sơ..."></textarea>' +
                '</div>';

            if (typeof Swal === 'undefined') {
                showError('Thư viện SweetAlert2 chưa được tải.');
                return;
            }

            Swal.fire({
                title: '<i class="fas fa-exclamation-triangle mr-2"></i>Không đủ điều kiện',
                html: html,
                showCancelButton: true,
                confirmButtonText: 'Xác nhận từ chối',
                cancelButtonText: 'Hủy',
                customClass: { confirmButton: 'btn-figma btn-figma-danger px-4', cancelButton: 'btn-figma btn-figma-outline px-4' },
                buttonsStyling: false,
                preConfirm: function () {
                    var reason = $('#ineligibleReason').val();
                    if (!reason || reason.trim().length < 10) {
                        Swal.showValidationMessage('Vui lòng nhập lý do tối thiểu 10 ký tự');
                        return false;
                    }
                    return reason.trim();
                }
            }).then(function (result) {
                if (result.isConfirmed) {
                    ajaxPost('/gxn/dossiers/' + dossierId + '/reject', { reason: result.value }, function (response) {
                        if (response && response.success) {
                            showSuccess(response.message || 'Đã từ chối hồ sơ.');
                            setTimeout(function () { window.location.reload(); }, 700);
                        } else {
                            showError((response && response.message) || 'Không thể từ chối hồ sơ.');
                        }
                    });
                }
            });
        });

        // === REJECT DOSSIER ===
        $('#btnRejectDossier').on('click', function () {
            if (!userPermissions.canApprove) {
                showWarning('Bạn không có quyền từ chối hồ sơ.');
                return;
            }

            $('#rejectLyDo').val('');
            var modal = document.getElementById('rejectModal');
            if (modal && typeof bootstrap !== 'undefined') {
                var bsModal = new bootstrap.Modal(modal);
                bsModal.show();
            } else {
                var reason = window.prompt('Nhập lý do từ chối hồ sơ:');
                if (!reason || !reason.trim()) return;
                submitReject(reason.trim());
            }
        });

        $(document).on('click', '#btnConfirmReject', function () {
            var reason = $('#rejectLyDo').val();
            if (!reason || !reason.trim()) {
                showWarning('Vui lòng nhập lý do từ chối.');
                return;
            }
            submitReject(reason.trim());
        });

        function submitReject(reason) {
            ajaxPost('/gxn/dossiers/' + dossierId + '/reject', { reason: reason }, function (response) {
                if (response && response.success) {
                    showSuccess(response.message || 'Từ chối hồ sơ thành công.');
                    var modal = document.getElementById('rejectModal');
                    if (modal && typeof bootstrap !== 'undefined') {
                        var bsInstance = bootstrap.Modal.getInstance(modal);
                        if (bsInstance) bsInstance.hide();
                    }
                    setTimeout(function () { window.location.reload(); }, 700);
                } else {
                    showError((response && response.message) || 'Không thể từ chối hồ sơ.');
                }
            });
        }

        // === XUẤT PHIẾU KSQT (.docx) — chỉ Phiếu Kiểm soát Quy trình, không kèm Mẫu GXN ===
        $('#btnExportKSQT').on('click', function () {
            if (!userPermissions.canExport) {
                showWarning('Bạn không có quyền xuất Phiếu KSQT.');
                return;
            }
            var ksqtTemplate = $('#ksqtTemplateSelect').val() || 'GXN_KSQT_DIEU_8';
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
            }).then(function (result) {
                if (result.isConfirmed) {
                    toastr.info('Đang chuẩn bị tệp tin .docx...');
                    window.location.href = '/gxn/dossiers/' + dossierId + '/export-ksqt?templateType=' + encodeURIComponent(ksqtTemplate);
                }
            });
        });

        // === XUẤT BỘ HỒ SƠ GXN (.zip = Mẫu GXN + Phiếu KSQT) ===
        // Mirrors GPLD #btnExportGPLD: Swal confirm → window.location.href → 3s reload
        // Hỗ trợ cả selector cũ (#btnExportBundle) và mới (#btnExportGPLD).
        $('#btnExportBundle, #btnExportGPLD').on('click', function () {
            if (!userPermissions.canExport) {
                showWarning('Bạn không có quyền xuất bộ hồ sơ GXN.');
                return;
            }
            var ksqtTemplate = $('#ksqtTemplateSelect').val() || 'GXN_KSQT_DIEU_8';
            var html = '<div class="text-left">' +
                '<div class="p-3 mb-3" style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px;">' +
                '<div class="font-weight-bold mb-1" style="color:#1e40af; font-size:14px;"><i class="far fa-file-archive mr-2"></i>Sẽ export 2 file .docx dưới dạng <strong>.zip</strong>:</div>' +
                '<div style="color:#1d4ed8; font-size:13px;">1. Mẫu Giấy Xác nhận GXN<br/>2. Phiếu Kiểm soát Quy trình (KSQT)</div>' +
                '</div>' +
                '<div class="p-2" style="background:#fef9c3; border:1px solid #fde68a; border-radius:8px;">' +
                '<div style="color:#78350f; font-size:12px;"><i class="fas fa-info-circle mr-1"></i>Sau khi xuất, hồ sơ sẽ tự động chuyển sang <strong>Chờ ký số</strong>.</div>' +
                '</div></div>';

            Swal.fire({
                title: 'Xuất bộ hồ sơ GXN',
                html: html,
                showCancelButton: true,
                confirmButtonText: 'Xác nhận Export (.zip)',
                cancelButtonText: 'Hủy',
                customClass: {
                    confirmButton: 'btn-figma btn-figma-primary px-4',
                    cancelButton: 'btn-figma btn-figma-outline px-4'
                },
                buttonsStyling: false
            }).then(function (result) {
                if (result.isConfirmed) {
                    toastr.info('Đang chuẩn bị bộ hồ sơ .zip...');
                    window.location.href = '/gxn/dossiers/' + dossierId + '/export-bundle?templateType=' + encodeURIComponent(ksqtTemplate);
                    setTimeout(function () { window.location.reload(); }, 3000);
                }
            });
        });

        // === UPLOAD PDF KÝ SỐ (Swal.fire modal — mirror GPLD pattern) ===
        $('#btnOpenUploadOCR, #btnSidebarUploadOCR').on('click', function () {
            if (!userPermissions.canImport) {
                showWarning('Bạn không có quyền tải lên PDF.');
                return;
            }
            openUploadModal();
        });
    }

    // ══════════════════════════════════════════════════
    // UPLOAD MODAL: Swal.fire dropzone (mirror GPLD hoso-workflow.js)
    // ══════════════════════════════════════════════════
    function openUploadModal() {
        var maHoSo = configElement.dataset.maHoSo || 'Hồ sơ';
        var hoTen = configElement.dataset.hoTen || '';
        var loaiNV = configElement.dataset.loaiNv || '—';
        var trangThai = configElement.dataset.status || '';

        var statusLabel = {
            ChoKySo: 'Chờ ký số',
            DangXuLyOCR: 'Đang xử lý OCR'
        }[trangThai] || trangThai;

        var selectedFile = null;

        var html = '<div class="text-left">' +
            '<div class="row mb-3">' +
            '<div class="col-md-6"><label class="text-muted small mb-1">Mã hồ sơ</label><input type="text" class="input-figma bg-light" value="' + escapeHtml(maHoSo) + '" readonly /></div>' +
            '<div class="col-md-6"><label class="text-muted small mb-1">Họ tên NLĐ</label><input type="text" class="input-figma bg-light" value="' + escapeHtml(hoTen) + '" readonly /></div>' +
            '</div>' +
            '<div class="row mb-4">' +
            '<div class="col-md-6"><label class="text-muted small mb-1">Nghiệp vụ</label><div><span class="badge-figma badge-figma-primary">' + escapeHtml(loaiNV) + '</span></div></div>' +
            '<div class="col-md-6"><label class="text-muted small mb-1">Trạng thái</label><div><span class="badge-figma badge-figma-warning">' + escapeHtml(statusLabel) + '</span></div></div>' +
            '</div>' +
            '<h6 class="font-weight-bold mb-3" style="font-size:14px;"><i class="fas fa-file-upload mr-2 text-muted"></i>Upload file PDF đã ký số</h6>' +
            '<div id="dropzoneOCR" class="p-5 text-center" style="border:2px dashed #cbd5e1; border-radius:12px; background:#f8fafc; cursor:pointer;">' +
            '<i class="fas fa-file-pdf fa-3x text-muted mb-3"></i>' +
            '<div class="text-muted"><span class="text-primary font-weight-bold">chọn file</span> hoặc kéo thả vào đây</div>' +
            '<div class="text-muted small mt-1">Chỉ nhận .pdf | Tối đa 20MB</div>' +
            '</div>' +
            '<input type="file" id="fileOCR" style="display:none;" accept="application/pdf" />' +
            '<div id="fileListOCR" class="mt-3"></div>' +
            '</div>';

        if (typeof Swal === 'undefined') {
            showError('Thư viện SweetAlert2 chưa được tải.');
            return;
        }

        Swal.fire({
            title: 'Upload file PDF ký số',
            html: html,
            width: '700px',
            showCancelButton: true,
            confirmButtonText: 'Upload & Chạy OCR',
            cancelButtonText: 'Hủy',
            customClass: { confirmButton: 'btn-figma btn-figma-primary px-4', cancelButton: 'btn-figma btn-figma-outline px-4' },
            buttonsStyling: false,
            didOpen: function (modal) {
                var $modal = $(modal);
                $modal.find('#dropzoneOCR').on('click', function () { $modal.find('#fileOCR').click(); });
                $modal.find('#dropzoneOCR').on('dragover', function (e) {
                    e.preventDefault();
                    $(this).css('border-color', 'var(--primary)');
                }).on('dragleave', function () {
                    $(this).css('border-color', '#cbd5e1');
                }).on('drop', function (e) {
                    e.preventDefault();
                    $(this).css('border-color', '#cbd5e1');
                    var files = e.originalEvent.dataTransfer.files;
                    if (files.length > 0) {
                        $modal.find('#fileOCR')[0].files = files;
                        $modal.find('#fileOCR').trigger('change');
                    }
                });
                $modal.find('#fileOCR').on('change', function () {
                    var file = this.files[0];
                    selectedFile = file || null;
                    if (file) {
                        $modal.find('#fileListOCR').html(
                            '<div class="alert alert-success d-flex align-items-center py-2 px-3 small">' +
                            '<i class="fas fa-file-pdf mr-2"></i><b>' + escapeHtml(file.name) + '</b> (' + (file.size / 1024 / 1024).toFixed(1) + 'MB)' +
                            '</div>'
                        );
                    }
                });
            },
            preConfirm: function () {
                if (!selectedFile) { Swal.showValidationMessage('Vui lòng chọn file PDF'); return false; }
                if (selectedFile.size > 20 * 1024 * 1024) { Swal.showValidationMessage('File không được vượt quá 20 MB'); return false; }
                var ext = selectedFile.name.split('.').pop().toLowerCase();
                if (ext !== 'pdf') { Swal.showValidationMessage('Chỉ chấp nhận file PDF'); return false; }
                return selectedFile;
            }
        }).then(function (result) {
            if (result.isConfirmed) {
                var formData = new FormData();
                formData.append('id', dossierId);
                formData.append('file', result.value);
                submitUploadOCR(formData);
            }
        });
    }

    function submitUploadOCR(formData) {
        var token = getAntiForgeryToken();
        if (token) formData.append('__RequestVerificationToken', token);

        Swal.fire({ title: 'Đang upload...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });

        $.ajax({
            url: '/gxn/dossiers/' + dossierId + '/upload-signed-file',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (data) {
                if (data && data.success) {
                    Swal.fire({ icon: 'success', title: 'Thành công', text: 'Upload file thành công!', timer: 1200, showConfirmButton: false }).then(function () {
                        window.location.href = data.redirectUrl;
                    });
                } else {
                    Swal.fire({ icon: 'error', title: 'Lỗi', text: (data && data.message) || 'Không thể upload file.' });
                }
            },
            error: function () {
                Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Không thể kết nối đến máy chủ.' });
            }
        });
    }

    // ══════════════════════════════════════════════════
    // ISSUE DETAIL: Upload PDF ký số (Re-upload từ màn Issued)
    // Mirror GPLD GPLDDetails → openUploadModal pattern
    // ══════════════════════════════════════════════════
    function openIssueUploadModal() {
        var soGxn = configElement.dataset.soGxn || '';
        var hoTen = configElement.dataset.hoTen || '';
        var loaiNV = configElement.dataset.loaiNv || '—';
        var trangThaiText = configElement.dataset.trangThaiText || '';

        var selectedFile = null;

        var html = '<div class="text-left">' +
            '<div class="row mb-3">' +
            '<div class="col-md-6"><label class="text-muted small mb-1">Số GXN</label><input type="text" class="input-figma bg-light" value="' + escapeHtml(soGxn) + '" readonly /></div>' +
            '<div class="col-md-6"><label class="text-muted small mb-1">Họ tên NLĐ</label><input type="text" class="input-figma bg-light" value="' + escapeHtml(hoTen) + '" readonly /></div>' +
            '</div>' +
            '<div class="row mb-4">' +
            '<div class="col-md-6"><label class="text-muted small mb-1">Nghiệp vụ</label><div><span class="badge-figma badge-figma-primary">' + escapeHtml(loaiNV) + '</span></div></div>' +
            '<div class="col-md-6"><label class="text-muted small mb-1">Trạng thái</label><div><span class="badge-figma badge-figma-success">' + escapeHtml(trangThaiText) + '</span></div></div>' +
            '</div>' +
            '<h6 class="font-weight-bold mb-3" style="font-size:14px;"><i class="fas fa-file-upload mr-2 text-muted"></i>Upload file PDF đã ký số</h6>' +
            '<div id="dropzoneReUpload" class="p-5 text-center" style="border:2px dashed #cbd5e1; border-radius:12px; background:#f8fafc; cursor:pointer;">' +
            '<i class="fas fa-file-pdf fa-3x text-muted mb-3"></i>' +
            '<div class="text-muted"><span class="text-primary font-weight-bold">chọn file</span> hoặc kéo thả vào đây</div>' +
            '<div class="text-muted small mt-1">Chỉ nhận .pdf | Tối đa 20MB</div>' +
            '</div>' +
            '<input type="file" id="fileReUpload" style="display:none;" accept="application/pdf" />' +
            '<div id="fileListReUpload" class="mt-3"></div>' +
            '</div>';

        if (typeof Swal === 'undefined') {
            showError('Thư viện SweetAlert2 chưa được tải.');
            return;
        }

        Swal.fire({
            title: 'Upload file PDF ký số',
            html: html,
            width: '700px',
            showCancelButton: true,
            confirmButtonText: 'Upload & Chạy OCR',
            cancelButtonText: 'Hủy',
            customClass: { confirmButton: 'btn-figma btn-figma-primary px-4', cancelButton: 'btn-figma btn-figma-outline px-4' },
            buttonsStyling: false,
            didOpen: function (modal) {
                var $modal = $(modal);
                $modal.find('#dropzoneReUpload').on('click', function () { $modal.find('#fileReUpload').click(); });
                $modal.find('#dropzoneReUpload').on('dragover', function (e) {
                    e.preventDefault();
                    $(this).css('border-color', 'var(--primary)');
                }).on('dragleave', function () {
                    $(this).css('border-color', '#cbd5e1');
                }).on('drop', function (e) {
                    e.preventDefault();
                    $(this).css('border-color', '#cbd5e1');
                    var files = e.originalEvent.dataTransfer.files;
                    if (files.length > 0) {
                        $modal.find('#fileReUpload')[0].files = files;
                        $modal.find('#fileReUpload').trigger('change');
                    }
                });
                $modal.find('#fileReUpload').on('change', function () {
                    var file = this.files[0];
                    selectedFile = file || null;
                    if (file) {
                        $modal.find('#fileListReUpload').html(
                            '<div class="alert alert-success d-flex align-items-center py-2 px-3 small">' +
                            '<i class="fas fa-file-pdf mr-2"></i><b>' + escapeHtml(file.name) + '</b> (' + (file.size / 1024 / 1024).toFixed(1) + 'MB)' +
                            '</div>'
                        );
                    }
                });
            },
            preConfirm: function () {
                if (!selectedFile) { Swal.showValidationMessage('Vui lòng chọn file PDF'); return false; }
                if (selectedFile.size > 20 * 1024 * 1024) { Swal.showValidationMessage('File không được vượt quá 20 MB'); return false; }
                var ext = selectedFile.name.split('.').pop().toLowerCase();
                if (ext !== 'pdf') { Swal.showValidationMessage('Chỉ chấp nhận file PDF'); return false; }
                return selectedFile;
            }
        }).then(function (result) {
            if (result.isConfirmed) {
                var formData = new FormData();
                formData.append('id', issuedId);
                formData.append('file', result.value);
                submitReUploadPdf(formData);
            }
        });
    }

    function submitReUploadPdf(formData) {
        var token = getAntiForgeryToken();
        if (token) formData.append('__RequestVerificationToken', token);

        Swal.fire({ title: 'Đang upload...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });

        $.ajax({
            url: '/gxn/issued/' + issuedId + '/re-upload-pdf',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (data) {
                if (data && data.success) {
                    Swal.fire({ icon: 'success', title: 'Thành công', text: data.message || 'Upload file thành công!', timer: 1500, showConfirmButton: false }).then(function () {
                        if (data.redirectUrl) {
                            window.location.href = data.redirectUrl;
                        } else {
                            window.location.reload();
                        }
                    });
                } else {
                    Swal.fire({ icon: 'error', title: 'Lỗi', text: (data && data.message) || 'Không thể upload file.' });
                }
            },
            error: function () {
                Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Không thể kết nối đến máy chủ.' });
            }
        });
    }

    function initUploadPdfEvents() {
        // Legacy: UploadPdf separate page — now handled by Swal modal from Details page.
        // Keep basic handler for backward compatibility if UploadPdf.cshtml is accessed directly.
        $('#uploadPdfForm').on('submit', function (event) {
            event.preventDefault();

            if (!userPermissions.canImport) {
                showWarning('Bạn không có quyền tải lên PDF.');
                return;
            }

            var formData = $(this).serialize();

            $.ajax({
                url: '/gxn/dossiers/upload-pdf',
                type: 'POST',
                headers: buildHeaders(),
                data: formData,
                success: function (response) {
                    if (response && response.success) {
                        showSuccess(response.message || 'Tải lên PDF thành công.');
                        if (response.redirectUrl) {
                            window.location.href = response.redirectUrl;
                        }
                    } else {
                        showError((response && response.message) || 'Không thể tải lên PDF.');
                    }
                },
                error: function (xhr) {
                    handleConflict(xhr, 'Có lỗi xảy ra khi tải lên PDF.');
                }
            });
        });
    }

    function initOcrConfirmEvents() {
        // Đọc giá trị OCR gốc từ data-attributes (được set bởi Razor từ ViewBag.OCRData)
        // NgayKy luôn là "yyyy-MM-dd" (ISO) — đúng format cho backend
        var cfg = document.getElementById('gxn-page-config');
        var originalValues = {
            SoGxn:      (cfg && cfg.dataset.ocrSoGxn)       || '',
            NgayKy:     (cfg && cfg.dataset.ocrNgayKy)      || '',  // yyyy-MM-dd
            NgayCap:    (cfg && cfg.dataset.ocrNgayCap)     || '',  // yyyy-MM-dd
            NgayHetHan: (cfg && cfg.dataset.ocrNgayHetHan)  || '',  // yyyy-MM-dd
            NguoiKy:    (cfg && cfg.dataset.ocrNguoiKy)     || '',
            ChucVu:     (cfg && cfg.dataset.ocrChucVu)      || ''
        };
        var manualEdits = {};
        var hasAnyModification = false;
        var currentEditField = null;

        // Helper: đảm bảo date string luôn là yyyy-MM-dd để gửi backend
        // Chấp nhận cả "yyyy-MM-dd" và "dd/MM/yyyy" input từ user
        function toIsoDate(dateStr) {
            if (!dateStr) return '';
            if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.substring(0, 10);
            var m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(dateStr);
            if (m) return m[3] + '-' + m[2] + '-' + m[1];
            return dateStr;
        }

        // Helper: format date cho hiển thị (dd/MM/yyyy)
        function toDisplayDate(isoDate) {
            if (!isoDate) return '';
            if (typeof moment !== 'undefined') return moment(isoDate, 'YYYY-MM-DD').format('DD/MM/YYYY');
            var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
            return m ? m[3] + '/' + m[2] + '/' + m[1] : isoDate;
        }

        // ── Mở panel chỉnh sửa thủ công ──────────────────────────────────
        $(document).on('click', '.btn-edit-ocr', function () {
            currentEditField = $(this).data('field');
            $('#targetFieldLabel').text($(this).data('label'));

            // Các trường ngày: dùng type="date" để native date picker hiển thị đúng (input value phải là yyyy-MM-dd)
            if (currentEditField === 'NgayKy' || currentEditField === 'NgayCap' || currentEditField === 'NgayHetHan') {
                $('#manualValue').attr('type', 'date');
            } else {
                $('#manualValue').attr('type', 'text');
            }

            $('#manualValue').val($(this).data('val')).focus();
            $('#manualReason').val('');
            $('#manualConfirmPanel').slideDown(200);
        });

        // ── Xác nhận 1 trường đã chỉnh sửa ──────────────────────────────
        $('#btnConfirmField').on('click', function () {
            var val    = $('#manualValue').val();
            var reason = $('#manualReason').val();

            if (!val || !val.trim()) {
                showWarning('Vui lòng nhập giá trị đúng.');
                return;
            }
            if (!reason || reason.trim().length < 5) {
                showWarning('Vui lòng nhập lý do sửa tối thiểu 5 ký tự.');
                return;
            }

            // Lưu giá trị ISO (yyyy-MM-dd) cho các trường ngày, raw cho các field khác
            var isDateField = currentEditField === 'NgayKy' || currentEditField === 'NgayCap' || currentEditField === 'NgayHetHan';
            var storedVal = isDateField ? toIsoDate(val.trim()) : val.trim();
            manualEdits[currentEditField] = { value: storedVal, reason: reason.trim() };
            hasAnyModification = true;

            // Cập nhật ô giá trị — các trường ngày hiển thị dd/MM/yyyy, các field khác hiển thị raw
            var displayVal = isDateField
                ? toDisplayDate(storedVal)
                : $('<div>').text(storedVal).html();
            $('#cell-' + currentEditField).html('<span class="text-primary font-weight-bold">' + displayVal + '</span>');

            // Cập nhật ô độ tin cậy → "✅ Đã xác nhận" (mirrors GPLD: td:nth-child(3))
            $('#conf-' + currentEditField).html(
                '<span class="badge badge-success" style="font-size:10px;">' +
                '<i class="fas fa-check mr-1"></i>Đã xác nhận</span>'
            );

            $('.btn-edit-ocr[data-field="' + currentEditField + '"]').data('val', storedVal);

            $('#manualConfirmPanel').slideUp(200);
            showSuccess('Đã xác nhận: ' + $('#targetFieldLabel').text());
        });

        // ── Nút "Xác nhận & Lưu" (Swal + AJAX JSON) ─────────────────────
        $('#btnFinalSave').on('click', function () {
            if (!userPermissions.canApprove) {
                showWarning('Bạn không có quyền xác nhận OCR.');
                return;
            }

            // finalNgayKy/Cap/HetHan luôn là yyyy-MM-dd — backend System.Text.Json deserialize đúng
            var finalSoGxn      = (manualEdits.SoGxn      && manualEdits.SoGxn.value)      || originalValues.SoGxn;
            var finalNgayKy     = toIsoDate((manualEdits.NgayKy     && manualEdits.NgayKy.value)     || originalValues.NgayKy);
            var finalNgayCap    = toIsoDate((manualEdits.NgayCap    && manualEdits.NgayCap.value)    || originalValues.NgayCap);
            var finalNgayHetHan = toIsoDate((manualEdits.NgayHetHan && manualEdits.NgayHetHan.value) || originalValues.NgayHetHan);
            var finalNguoiKy    = (manualEdits.NguoiKy    && manualEdits.NguoiKy.value)    || originalValues.NguoiKy;
            var finalChucVu     = (manualEdits.ChucVu     && manualEdits.ChucVu.value)     || originalValues.ChucVu;

            if (!finalSoGxn.trim())      { showWarning('Số GXN không được để trống.');       return; }
            if (!finalNgayKy.trim())     { showWarning('Ngày ký không được để trống.');      return; }
            if (!finalNgayCap.trim())    { showWarning('Ngày cấp không được để trống.');     return; }
            if (!finalNgayHetHan.trim()) { showWarning('Ngày hết hạn không được để trống.'); return; }
            if (finalNgayHetHan <= finalNgayCap) { showWarning('Ngày hết hạn phải sau ngày cấp.'); return; }
            if (!finalNguoiKy.trim())    { showWarning('Người ký không được để trống.');     return; }

            var modifiedNote = hasAnyModification
                ? '<br><strong class="text-warning">⚠ Có chỉnh sửa thông tin OCR</strong>'
                : '';

            Swal.fire({
                title: 'Xác nhận lưu kết quả OCR?',
                html: '<div class="text-left" style="font-size:13px;">' +
                      '<strong>Số GXN:</strong> ' + $('<div>').text(finalSoGxn).html() + '<br>' +
                      '<strong>Ngày ký:</strong> ' + toDisplayDate(finalNgayKy) + '<br>' +
                      '<strong>Ngày cấp:</strong> ' + toDisplayDate(finalNgayCap) + '<br>' +
                      '<strong>Ngày hết hạn:</strong> ' + toDisplayDate(finalNgayHetHan) + '<br>' +
                      '<strong>Người ký:</strong> ' + $('<div>').text(finalNguoiKy).html() +
                      modifiedNote +
                      '</div>',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-check mr-1"></i> Xác nhận & Lưu',
                cancelButtonText: 'Kiểm tra lại',
                confirmButtonColor: '#1e3a8a',
                cancelButtonColor: '#6c757d',
                showLoaderOnConfirm: true,
                preConfirm: function () {
                    return $.ajax({
                        url: '/gxn/ocr-confirm/' + dossierId,
                        method: 'POST',
                        contentType: 'application/json',
                        headers: buildHeaders(),
                        data: JSON.stringify({
                            SoGxn:       finalSoGxn,
                            NgayKy:      finalNgayKy,    // yyyy-MM-dd — backend DateTime deserialization
                            NgayCap:     finalNgayCap,   // yyyy-MM-dd
                            NgayHetHan:  finalNgayHetHan, // yyyy-MM-dd
                            NguoiKy:     finalNguoiKy,
                            ChucVu:      finalChucVu || null,
                            HasModified: hasAnyModification,
                            EditReason:  hasAnyModification
                                ? Object.values(manualEdits).map(function (e) { return e.reason; }).filter(Boolean).join('; ')
                                : null
                        })
                    }).then(null, function (xhr) {
                        Swal.showValidationMessage(
                            (xhr.responseJSON && xhr.responseJSON.message) || 'Lỗi khi gọi API xác nhận.'
                        );
                    });
                },
                allowOutsideClick: function () { return !Swal.isLoading(); }
            }).then(function (result) {
                if (result.isConfirmed && result.value && result.value.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Thành công!',
                        text: 'GXN đã được cấp và có hiệu lực.',
                        timer: 2000,
                        showConfirmButton: false
                    }).then(function () {
                        window.location.href = result.value.redirectUrl || '/gxn/issued';
                    });
                } else if (result.isConfirmed) {
                    showError((result.value && result.value.message) || 'Xác nhận thất bại.');
                }
            });
        });

        // ── Nút "Từ chối" (Swal textarea thay window.prompt) ─────────────
        $('#btnOcrReject').on('click', function () {
            if (!userPermissions.canApprove) {
                showWarning('Bạn không có quyền từ chối OCR.');
                return;
            }

            Swal.fire({
                title: 'Từ chối kết quả OCR?',
                html: '<div class="text-left" style="font-size:13px;">' +
                      '<label><strong>Lý do từ chối <span class="text-danger">*</span></strong></label>' +
                      '<textarea id="swalRejectReason" class="swal2-input" style="width:100%;height:80px;font-size:13px;margin-top:6px;" placeholder="Nhập lý do từ chối (tối thiểu 10 ký tự)..."></textarea>' +
                      '</div>',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-times mr-1"></i> Từ chối',
                cancelButtonText: 'Hủy',
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#6c757d',
                preConfirm: function () {
                    var reason = document.getElementById('swalRejectReason');
                    if (!reason || !reason.value.trim() || reason.value.trim().length < 10) {
                        Swal.showValidationMessage('Lý do từ chối tối thiểu 10 ký tự.');
                        return false;
                    }
                    return $.ajax({
                        url: '/gxn/ocr-confirm/' + dossierId + '/reject',
                        method: 'POST',
                        contentType: 'application/json',
                        headers: buildHeaders(),
                        data: JSON.stringify({ reason: reason.value.trim() })
                    }).then(null, function () {
                        Swal.showValidationMessage('Lỗi khi gọi API từ chối.');
                    });
                }
            }).then(function (result) {
                if (result.isConfirmed && result.value && result.value.success) {
                    showSuccess('Đã từ chối kết quả OCR.');
                    setTimeout(function () {
                        window.location.href = '/gxn/dossiers/' + dossierId;
                    }, 1200);
                } else if (result.isConfirmed) {
                    showError((result.value && result.value.message) || 'Từ chối thất bại.');
                }
            });
        });
    }

    function initIssueDetailEvents() {
        // === UPLOAD PDF KÝ SỐ từ IssueDetail (mirror GPLD GPLDDetails) ===
        $('#btnUploadSignedPDF').on('click', function () {
            if (!userPermissions.canImport) {
                showWarning('Bạn không có quyền tải lên PDF.');
                return;
            }
            openIssueUploadModal();
        });

        // === THU HỒI từ IssueDetail (mirror GPLD btnHeaderRevoke → modalThuHoi) ===
        $('#btnOpenRevoke').on('click', function () {
            if (!userPermissions.canRevoke) {
                showWarning('Bạn không có quyền thu hồi GXN.');
                return;
            }
            // revokeIssuedId đã được set trong HTML từ @Model.Id
            // Chỉ cần clear form và show modal
            $('#revokeVanBanToiCao, #revokeSoVanBan, #revokeLyDo, #revokeVanBanFileId').val('');
            $('#revokeNgayBanHanh').val('');
            $('#revokeDieuKhoan').val('Dieu32');
            $('#revokeCharCount').text('0 ký tự').removeClass('text-danger');
            $('#modalThuHoi').modal('show');
        });
    }

    function deleteDraft(id, name) {
        if (!userPermissions.canDelete) {
            if (window.toastr) {
                toastr.warning('Bạn không có quyền xóa nháp hồ sơ.');
            }
            return;
        }

        if (!window.confirm(`Bạn có chắc chắn muốn xóa nháp hồ sơ "${name}"?`)) {
            return;
        }

        $.ajax({
            url: `/gxn/dossiers/${id}/delete-draft`,
            type: 'POST',
            headers: buildHeaders(),
            data: {
                __RequestVerificationToken: getAntiForgeryToken()
            },
            success: function (response) {
                if (response && response.success) {
                    if (window.toastr) {
                        toastr.success(response.message || 'Xóa nháp hồ sơ thành công.');
                    }
                    table.ajax.reload(null, false);
                } else {
                    if (window.toastr) {
                        toastr.error((response && response.message) || 'Không thể xóa nháp hồ sơ.');
                    }
                }
            },
            error: function () {
                if (window.toastr) {
                    toastr.error('Có lỗi xảy ra khi xóa nháp hồ sơ.');
                }
            }
        });
    }

    function renderIssueType(data) {
        const typeMap = {
            CapMoi: '<span class="badge-figma badge-figma-primary">Cấp mới</span>',
            GiaHan: '<span class="badge-figma badge-figma-info">Gia hạn</span>',
            CapLai: '<span class="badge-figma badge-figma-warning">Cấp lại</span>'
        };

        return typeMap[data] || `<span class="badge-figma badge-figma-secondary">${escapeHtml(data || '')}</span>`;
    }

    function renderStatus(data) {
        const statusMap = {
            Nhap: '<span class="badge-figma badge-figma-secondary">Nháp</span>',
            ChoThamDinh: '<span class="badge-figma badge-figma-warning">Chờ thẩm định</span>',
            DangXuLy: '<span class="badge-figma badge-figma-info">Đang xử lý</span>',
            ChoKySo: '<span class="badge-figma badge-figma-primary">Chờ ký số</span>',
            DangXuLyOCR: '<span class="badge-figma badge-figma-primary">Đang xử lý OCR</span>',
            CoHieuLuc: '<span class="badge-figma badge-figma-success">Có hiệu lực</span>',
            TuChoi: '<span class="badge-figma badge-figma-danger">Từ chối</span>',
            DaThuHoi: '<span class="badge-figma badge-figma-danger">Đã thu hồi</span>'
        };

        return statusMap[data] || `<span class="badge-figma badge-figma-secondary">${escapeHtml(data || '')}</span>`;
    }

    function renderIssuedStatus(data) {
        const statusMap = {
            CoHieuLuc: '<span class="badge-figma badge-figma-success">Có hiệu lực</span>',
            SapHetHan: '<span class="badge-figma badge-figma-warning">Sắp hết hạn</span>',
            DaHetHan: '<span class="badge-figma badge-figma-danger">Đã hết hạn</span>',
            DaThuHoi: '<span class="badge-figma badge-figma-danger">Đã thu hồi</span>'
        };

        return statusMap[data] || `<span class="badge-figma badge-figma-secondary">${escapeHtml(data || '')}</span>`;
    }

    function renderDate(data) {
        if (!data) {
            return '';
        }

        const date = new Date(data);
        if (Number.isNaN(date.getTime())) {
            return data;
        }

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    function renderActions(data, type, row) {
        let actions = `<a href="/gxn/dossiers/${row.id}" class="btn-action-figma btn-action-edit" title="Xem chi tiết"><i class="fas fa-eye"></i></a>`;

        // Chỉ cho phép sửa khi hồ sơ ở trạng thái Nháp hoặc Chờ thẩm định.
        // Các trạng thái sau (DangXuLy/ChoKySo/DangXuLyOCR/CoHieuLuc/TuChoi/DaThuHoi) đã chốt — không được sửa.
        var canEditStatus = row && (row.trangThai === 'Nhap' || row.trangThai === 'ChoThamDinh');
        if (userPermissions.canUpdate && canEditStatus) {
            actions += `<a href="/gxn/dossiers/${row.id}/edit" class="btn-action-figma btn-action-edit" title="Chỉnh sửa"><i class="fas fa-pen"></i></a>`;
        }

        if (userPermissions.canDelete && row.trangThai === 'Nhap') {
            actions += `<button type="button" class="btn-action-figma btn-action-delete btn-delete-draft" data-id="${row.id}" data-name="${escapeHtml(row.hoTenNld)}" title="Xóa nháp"><i class="fas fa-trash"></i></button>`;
        }

        return `<div class="table-actions-figma" style="justify-content:center;">${actions}</div>`;
    }

    function renderIssuedActions(data, type, row) {
        let actions = `<a href="/gxn/issued/${row.id}" class="btn-action-figma btn-action-edit" title="Xem chi tiết"><i class="fas fa-eye"></i></a>`;

        if (userPermissions.canRevoke && row.trangThai === 'CoHieuLuc') {
            actions += `<button type="button" class="btn-action-figma btn-action-delete btn-revoke-issued"
                data-id="${row.id}"
                data-so-gxn="${escapeHtml(row.soGxn || '')}"
                data-ten-nld="${escapeHtml(row.hoTenNld || '')}"
                data-nsdld="${escapeHtml(row.tenNsdld || '')}"
                data-ngay-het-han="${renderDate(row.ngayHetHan)}"
                title="Thu hồi GXN"><i class="fas fa-ban"></i></button>`;
        }

        return `<div class="table-actions-figma" style="justify-content:center;">${actions}</div>`;
    }

    function ajaxPost(url, payload, onSuccess) {
        $.ajax({
            url: url,
            type: 'POST',
            headers: buildHeaders(),
            data: Object.assign({ __RequestVerificationToken: getAntiForgeryToken() }, payload || {}),
            success: onSuccess,
            error: function (xhr) {
                handleConflict(xhr, 'Có lỗi xảy ra khi xử lý yêu cầu.');
            }
        });
    }

    function handleConflict(xhr, fallbackMessage) {
        const status = xhr ? xhr.status : 0;
        const responseMessage = xhr && xhr.responseJSON && xhr.responseJSON.message
            ? xhr.responseJSON.message
            : '';

        if (status === 409 || /nguoi khac|tai lai/i.test(responseMessage)) {
            showWarning('Dữ liệu vừa thay đổi bởi người khác. Vui lòng tải lại trang.');
            return;
        }

        showError(responseMessage || fallbackMessage);
    }

    function showSuccess(message) {
        if (window.toastr) {
            toastr.success(message);
        }
    }

    function showWarning(message) {
        if (window.toastr) {
            toastr.warning(message);
        }
    }

    function showError(message) {
        if (window.toastr) {
            toastr.error(message);
        }
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }

        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ====== GXN FORM VALIDATION (Create & Edit) ======
    function parseDate(selector) {
        var val = $(selector).val();
        if (!val) return null;
        return new Date(val);
    }

    function formatDateVI(date) {
        if (!date) return '';
        return date.toLocaleDateString('vi-VN');
    }

    function calcHanXuLy() {
        var ngayNhan = parseDate('#NgayNhanHoSo');
        if (!ngayNhan) { $('#hanXuLyDisplay').text('—'); return; }
        var ngayHanXuLy = new Date(ngayNhan);
        ngayHanXuLy.setDate(ngayHanXuLy.getDate() + 5);
        var today = new Date(); today.setHours(0, 0, 0, 0);
        var isQuaHan = ngayHanXuLy < today;
        var str = formatDateVI(ngayHanXuLy) + (isQuaHan ? ' (quá hạn)' : '');
        $('#hanXuLyDisplay').text(str).css('color', isQuaHan ? '#dc2626' : 'var(--primary)');
    }

    function checkBR01() {
        var hanHC = parseDate('#ThoiHanHoChieu');
        var ngayKT = parseDate('#NgayKetThucLv');
        if (!hanHC || !ngayKT) return { pass: true };
        var threshold = new Date(ngayKT);
        threshold.setMonth(threshold.getMonth() + 6);
        return { pass: hanHC > threshold, threshold: threshold, hanHC: hanHC };
    }

    function checkBR02() {
        var ngayBD = parseDate('#NgayBatDauLv');
        var ngayKT = parseDate('#NgayKetThucLv');
        if (!ngayBD || !ngayKT) return { pass: true, days: 0 };
        var days = Math.ceil((ngayKT - ngayBD) / 86400000);
        return { pass: days > 0 && days <= 730, days: days };
    }

    function setVldItem(id, status, desc) {
        var $item = $('#' + id);
        if ($item.length === 0) return;
        var cfg = statusCfg[status] || statusCfg['pending'];
        $item.find('.vld-icon i')
            .attr('class', 'fas ' + cfg.iconClass)
            .css({ color: cfg.color, 'font-size': status === 'pending' || status === 'na' ? '8px' : '12px' });
        $item.find('.vld-desc').text(desc).css('color',
            status === 'pass' ? '#16a34a' : status === 'fail' ? '#dc2626' : status === 'warn' ? '#d97706' : '#6b7280'
        );
    }
    function initGxnFormValidation() {
        let $form = $('#createGxnForm, #editGxnForm').first();
        if ($form.length === 0) return;

        // Uppercase full name on input
        $form.find('#HoTenNld').on('input', function () {
            var pos = this.selectionStart;
            this.value = this.value.toUpperCase();
            this.setSelectionRange(pos, pos);
        });
        //flat valid
        let isValid = false;
        // HanXuLy auto-calc
        $('#NgayNhanHoSo').on('change', calcHanXuLy);
        calcHanXuLy();
        let today = new Date(new Date().toDateString());
        let ngaySinh = parseDate('#NgaySinh');
        if (ngaySinh && ngaySinh >= today) {
            setFieldError('NgaySinh', 'Ngày sinh không thể là ngày hiện tại hoặc tương lai.');
            isValid = false;
        } else {
            let age = (today - ngaySinh) / (365.25 * 24 * 3600 * 1000);
            if (age < 18) {
                setFieldError('NgaySinh', 'Người lao động phải đủ 18 tuổi trở lên.');
                isValid = false;
            } else if (age > 100) {
                setFieldError('NgaySinh', 'Ngày sinh không hợp lệ (trên 100 tuổi).');
                isValid = false;
            }
        }

        // Real-time date cross-validation: NgayBatDauLv vs NgayKetThucLv
        $('#NgayBatDauLv, #NgayKetThucLv').on('change', function () {
            let ngayBD = parseDate('#NgayBatDauLv');
            let ngayKT = parseDate('#NgayKetThucLv');
            if (ngayBD && ngayKT) {
                if (ngayKT <= ngayBD) {
                    setFieldError('NgayKetThucLv', 'Ngày kết thúc làm việc phải sau ngày bắt đầu.');
                } else {
                    var days = Math.ceil((ngayKT - ngayBD) / 86400000);
                    if (days > 730) {
                        setFieldError('NgayKetThucLv', 'Thời hạn ' + days + ' ngày — vượt quá 730 ngày (Điều 17).');
                    }
                }
            }            
            let loaiNv = $('input[name="LoaiNghiepVu"]:checked').val();
            let isCapMoiCapLai = (loaiNv === 'CapMoi' || loaiNv === 'CapLai');

            if (isCapMoiCapLai) {
                if (!ngayBD) {
                    setFieldError('NgayBatDauTuyenDung', 'Ngày bắt đầu tuyển dụng bắt buộc nhập với nghiệp vụ Cấp mới/Cấp lại.');
                    isValid = false;
                }
                if (!ngayKT) {
                    setFieldError('NgayKetThucTuyenDung', 'Ngày kết thúc tuyển dụng bắt buộc nhập với nghiệp vụ Cấp mới/Cấp lại.');
                    isValid = false;
                }
            }
            if (ngayBD && ngayKT && ngayKT <= ngayBD) {
                setFieldError('NgayKetThucTuyenDung', 'Ngày kết thúc tuyển dụng phải sau ngày bắt đầu tuyển dụng.');
                isValid = false;
            }
        });

        // Real-time: ThoiHanHoChieu BR-01
        $('#ThoiHanHoChieu, #NgayKetThucLv').on('change', function () {
            let hanHC = parseDate('#ThoiHanHoChieu');
            let ngayKT = parseDate('#NgayKetThucLv');
            if (hanHC && ngayKT) {
                var threshold = new Date(ngayKT);
                threshold.setMonth(threshold.getMonth() + 6);
                if (hanHC <= threshold) {
                    setFieldError('ThoiHanHoChieu',
                        'Thời hạn HC phải sau ngày kết thúc LV ít nhất 6 tháng (' + formatDateVI(threshold) + ').');
                }
            }
        });

        let thoiHanHC = parseDate('#ThoiHanHoChieu');
        if (thoiHanHC && thoiHanHC <= today) {
            setFieldError('ThoiHanHoChieu', 'Hộ chiếu đã hết hạn.');
            isValid = false;
        }

        if (!isValid) {
            // Scroll đến trường lỗi đầu tiên
            let $firstError = $('.is-invalid').first();
            if ($firstError.length) {
                $('html, body').animate({ scrollTop: $firstError.offset().top - 120 }, 300);
            }
        }
    }

    function updateLoaiNv() {
        let labels = [
            { id: 'lnv-cap-moi', val: 'CapMoi' },
            { id: 'lnv-gia-han', val: 'GiaHan' },
            { id: 'lnv-cap-lai', val: 'CapLai' }
        ];
        let primary = 'var(--primary)';
        let primaryLight = 'var(--primary-light)';
        labels.forEach(function (l) {
            let el = document.getElementById(l.id);
            let radio = el ? el.querySelector('input[type="radio"]') : null;
            if (!el || !radio) return;
            if (radio.checked) {
                el.style.border = '2px solid ' + primary;
                el.style.background = primaryLight;
                el.style.color = primary;
                el.style.fontWeight = '600';
            } else {
                el.style.border = '1.5px solid #e2e8f0';
                el.style.background = '#fff';
                el.style.color = '#64748b';
                el.style.fontWeight = '400';
            }
        });
    }

    //Photo
    function checkAnh() {
        let hasFile = ($('#AnhNLDPath').val() || '') !== '' || ($('#anhFileInput')[0] && $('#anhFileInput')[0].files.length > 0);
        if (hasFile) {
            setVldItem('vld-anh', 'pass', 'Đã có ảnh');
        } else {
            setVldItem('vld-anh', 'warn', 'Chưa upload (không chặn nộp)');
        }
    }
    function initPhotoPreview() {

        $('#anhFileInput').on('change', function () {
            let file = this.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                alert('File ảnh vượt quá 5MB. Vui lòng chọn file nhỏ hơn.');
                this.value = '';
                return;
            }
            let reader = new FileReader();
            reader.onload = function (e) {
                $('#anhPreviewImg').attr('src', e.target.result).show();
                $('#anhPreviewIcon').hide();
                $('#anhPreviewText').hide();
                $('#anhWarningText')
                    .removeClass('text-warning').addClass('text-success')
                    .html('<i class="fas fa-check-circle mr-1"></i>Đã chọn: ' + file.name);
                setVldItem('vld-anh', 'pass', 'Đã upload: ' + file.name);

                // Clear remove flag if a new file is selected
                $('#RemoveExistingFile').val('false');
            };
            reader.readAsDataURL(file);
        });

        $('#anhPreviewBox').on('click', function () {
            $('#anhFileInput').trigger('click');
        });

        $('#btnRemoveAnh').on('click', function (e) {
            e.stopPropagation();
            if (confirm('Bạn có chắc chắn muốn gỡ bỏ ảnh hiện tại?')) {
                $('#RemoveExistingFile').val('true');
                $('#AnhNLDPath').val('');
                $('#AnhNLDFileName').val('');

                // Reset preview UI
                $('#anhPreviewImg').attr('src', '').hide();
                $('#anhPreviewIcon').show();
                $('#anhPreviewText').show();
                $(this).hide();

                $('#anhWarningText')
                    .removeClass('text-success').addClass('text-warning')
                    .html('<i class="fas fa-exclamation-triangle mr-1"></i>Chưa cập nhật ảnh chân dung');

                setVldItem('vld-anh', 'warn', 'Chưa upload (không chặn nộp)');

                // Clear file input too
                $('#anhFileInput').val('');
            }
        });
    }

    $(function () {        
        initEvents();
        // initPhotoPreview() bị disable trên trang Create/Edit (gxn-form.js đã handle).
        // Form page detect: tồn tại dropdown loại nghiệp vụ.
        if ($('#loaiNghiepVuSelect').length === 0) {
            initPhotoPreview();
        }
        initGxnFormValidation();
        updateLoaiNv();
        if ($('#gxnTable').length) {
            initDataTable();            
        }

        if ($('#gxnIssuedTable').length) {
            initIssuedDataTable();
            initIssuedEvents();
            loadIssuedStatistics();
        }

        if (pageType === 'details') {
            initDetailsEvents();
        }

        if (pageType === 'upload-pdf') {
            initUploadPdfEvents();
        }

        if (pageType === 'ocr-confirm') {
            initOcrConfirmEvents();
        }

        if (pageType === 'issue-detail') {
            initIssueDetailEvents();
        }

        // Bind modal Thu Hồi — dùng chung cho cả list và detail (mirror GPLD pattern)
        if ($('#modalThuHoi').length) {
            bindRevokeModal();
        }

        $('#anhFileInput').on('change', function () {
            // Trên trang form, gxn-form.js đã handle. Chỉ chạy checkAnh khi không phải form page.
            if ($('#loaiNghiepVuSelect').length === 0) {
                checkAnh();
            }
        });
    });
})();
