/**
 * SuKienQHLD Management - Client JS (IIFE Pattern)
 * Module: M0131
 * Screen: SCR-NV-DS-001 — Danh sách sự kiện QHLĐ
 *
 * ARCHITECTURE: JavaScript -> MVC Controller -> ApiService -> Backend API
 */
(function () {
    'use strict';

    let table;
    let searchTimer;

    const API = {
        getAll: '/SuKienQHLD/GetAll',
        delete: '/SuKienQHLD/Delete/',
        details: '/SuKienQHLD/Details/',
        edit: '/SuKienQHLD/Edit/'
    };

    const sourceBadgeClasses = {
        'PA-A': 'badge-source-pa-a',
        'PA-B': 'badge-source-pa-b',
        'VPDD': 'badge-source-vpdd'
    };

    const mucDoBadgeClasses = {
        'Nhe': 'badge-mucdo-nhe',
        'TrungBinh': 'badge-mucdo-trungbinh',
        'NghiemTrong': 'badge-mucdo-nghiemtrong'
    };

    const loaiSuKienLabels = {
        'DinhCong': 'Đình công',
        'LanCong': 'Lãn công',
        'TCLDTapThe': 'TCLĐ tập thể',
        'TCLDCaNhan': 'TCLĐ cá nhân'
    };

    const mucDoLabels = {
        'Nhe': 'Nhẹ',
        'TrungBinh': 'Trung bình',
        'NghiemTrong': 'Nghiêm trọng'
    };

    const trangThaiLabels = {
        'Nhap': 'Nháp',
        'ChoXacNhan': 'Chờ XN VPĐD',
        'YeuCauBoSung': 'Yêu cầu bổ sung',
        'DaXacNhan': 'Đã xác nhận',
        'DangXuLy': 'Đang xử lý',
        'DaKetThuc': 'Đã kết thúc',
        'TuChoi': 'Từ chối',
        'LeoThang': 'Leo thang'
    };

    function escapeHtml(text) {
        if (text === null || text === undefined) {
            return '';
        }

        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text)));
        return div.innerHTML;
    }

    function formatDate(value) {
        if (!value) {
            return '—';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '—';
        }

        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    function formatDateTime(value) {
        if (!value) {
            return '—';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '—';
        }

        return date.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatSoNguoi(value) {
        if (value === null || value === undefined || value === '') {
            return '—';
        }

        const n = Number(value);
        const formatted = new Intl.NumberFormat('vi-VN').format(n);
        if (n > 200) {
            return '<span style="font-weight:700;color:#dc2626;">' + formatted + '</span>';
        }

        return formatted;
    }

    function formatNumber(value) {
        if (value === null || value === undefined || value === '') {
            return '—';
        }

        return new Intl.NumberFormat('vi-VN').format(value);
    }

    function formatPercent(value) {
        if (value === null || value === undefined || value === '') {
            return '—';
        }

        const numericValue = Number(value);
        if (Number.isNaN(numericValue)) {
            return '—';
        }

        const cssClass = numericValue >= 50 ? 'tyle-nld-high' : '';
        return '<span class="' + cssClass + '">' + escapeHtml(numericValue.toFixed(1)) + '%</span>';
    }

    function getTrangThaiBadgeClass(trangThai) {
        switch (trangThai) {
            case 'DangXuLy':
            case 'DaXacNhan':
                return 'badge-trangthai-processing';
            case 'YeuCauBoSung':
            case 'ChoXacNhan':
            case 'LeoThang':
                return 'badge-trangthai-warning';
            case 'DaKetThuc':
            case 'TuChoi':
                return 'badge-trangthai-closed';
            default:
                return 'badge-trangthai-default';
        }
    }

    function renderBadge(text, cssClass) {
        if (!text) {
            return '<span class="text-muted">—</span>';
        }

        return '<span class="badge-figma-soft ' + cssClass + '">' + escapeHtml(text) + '</span>';
    }

    const loaiSKBadgeClasses = {
        'DinhCong': 'badge-mucdo-nghiemtrong',
        'LanCong': 'badge-mucdo-trungbinh',
        'TCLDTapThe': 'badge-trangthai-default',
        'TCLDCaNhan': 'badge-trangthai-default'
    };

    function renderLoaiSK(row) {
        const text = row.loaiSuKienDisplay || loaiSuKienLabels[row.loaiSuKien] || row.loaiSuKien || '—';
        return renderBadge(text, loaiSKBadgeClasses[row.loaiSuKien] || 'badge-trangthai-default');
    }

    function renderNguon(row) {
        const source = row.nguonDuLieu || '—';
        return renderBadge(source, sourceBadgeClasses[source] || 'badge-trangthai-default');
    }

    function renderMucDo(row) {
        const mucDoText = row.mucDoDisplay || mucDoLabels[row.mucDo] || row.mucDo || '—';
        return renderBadge(mucDoText, mucDoBadgeClasses[row.mucDo] || 'badge-mucdo-nhe');
    }

    function renderTrangThai(row) {
        const trangThaiText = row.trangThaiDisplay || trangThaiLabels[row.trangThai] || row.trangThai || '—';
        return renderBadge(trangThaiText, getTrangThaiBadgeClass(row.trangThai));
    }

    function renderVpddStatus(row) {
        const value = row.vpddXacNhanTrangThai || row.vpddTrangThaiDisplay;
        if (!value) {
            return '<span class="text-muted">—</span>';
        }

        return renderBadge(value, 'badge-trangthai-default');
    }

    function renderSpecialFlag(row) {
        if (row.coQTDacBiet === true || row.coQuanTamDacBiet === true) {
            return '<span class="flag-special" title="Quan tâm đặc biệt"><i class="fas fa-flag"></i></span>';
        }

        return '<span class="text-muted">—</span>';
    }

    function getDaysSince(dateValue) {
        if (!dateValue) {
            return Number.POSITIVE_INFINITY;
        }

        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) {
            return Number.POSITIVE_INFINITY;
        }

        return Math.floor((Date.now() - date.getTime()) / 86400000);
    }

    function buildFilterParams(d) {
        const params = new URLSearchParams();
        const pageSize = d.length || 20;
        const page = Math.floor((d.start || 0) / pageSize) + 1;

        params.append('draw', d.draw || 1);
        params.append('page', page);
        params.append('pageSize', pageSize);

        const keyword = document.getElementById('searchInput')?.value?.trim();
        if (keyword) {
            params.append('keyword', keyword);
        }

        const kncId = document.getElementById('filterKcnId')?.value;
        if (kncId) {
            params.append('kncId', kncId);
        }

        const loaiSuKien = document.getElementById('filterLoaiSuKien')?.value;
        if (loaiSuKien) {
            params.append('loaiSuKien', loaiSuKien);
        }

        const trangThai = document.getElementById('filterTrangThai')?.value;
        if (trangThai) {
            params.append('trangThai', trangThai);
        }

        const mucDo = document.getElementById('filterMucDo')?.value;
        if (mucDo) {
            params.append('mucDo', mucDo);
        }

        const fromDate = document.getElementById('filterFromDate')?.value;
        if (fromDate) {
            params.append('fromDate', fromDate);
        }

        const toDate = document.getElementById('filterToDate')?.value;
        if (toDate) {
            params.append('toDate', toDate);
        }

        const nguonDuLieu = document.getElementById('filterNguonDuLieu')?.value;
        if (nguonDuLieu) {
            params.append('nguonDuLieu', nguonDuLieu);
        }

        return params.toString();
    }

    function initDataTable() {
        table = $('#sukienTable').dataTableFigma({
            serverSide: true,
            processing: true,
            ajax: {
                url: API.getAll,
                type: 'GET',
                data: function (d) {
                    return buildFilterParams(d);
                },
                dataSrc: function (json) {
                    if (json && json.error) {
                        toastr.error(json.error);
                    }

                    updateDangerBanner(json && Array.isArray(json.data) ? json.data : []);
                    return json && Array.isArray(json.data) ? json.data : [];
                },
                error: function () {
                    toastr.error('Không thể tải danh sách sự kiện QHLĐ.');
                }
            },
            dom: 'rt<"pagination-figma-container"<"pagination-left"i><"pagination-right"lp>>',
            autoWidth: false,
            scrollX: false,
            searching: false,
            pageLength: 20,
            lengthMenu: [[10, 20, 50], [10, 20, 50]],
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/vi.json',
                processing: '<i class="fas fa-spinner fa-spin fa-2x"></i><br>Đang tải...'
            },
            columns: [
                {
                    data: 'maSK',
                    render: function (data, type, row) {
                        return '<a class="table-link-primary" href="' + API.details + row.id + '">' + escapeHtml(data || '—') + '</a>';
                    }
                },
                {
                    data: 'enterpriseName',
                    render: function (data) {
                        return escapeHtml(data || '—');
                    }
                },
                {
                    data: 'kcnName',
                    render: function (data) {
                        return escapeHtml(data || '—');
                    }
                },
                {
                    data: null,
                    render: function (data, type, row) {
                        return renderLoaiSK(row);
                    }
                },
                {
                    data: 'ngayPhatSinh',
                    className: 'text-center',
                    render: function (data) {
                        return formatDate(data);
                    }
                },
                {
                    data: 'soNguoi',
                    className: 'text-right',
                    render: function (data) {
                        return formatSoNguoi(data);
                    }
                },
                {
                    data: null,
                    className: 'text-center',
                    render: function (data, type, row) {
                        return renderMucDo(row);
                    }
                },
                {
                    data: null,
                    className: 'text-center',
                    render: function (data, type, row) {
                        return renderTrangThai(row);
                    }
                },
                {
                    data: null,
                    className: 'text-center',
                    render: function (data, type, row) {
                        return renderNguon(row);
                    }
                },
                {
                    data: null,
                    orderable: false,
                    searchable: false,
                    className: 'text-center',
                    render: function (data, type, row) {
                        let html = '<div class="table-action-group">';
                        html += '<a href="' + API.details + row.id + '" class="btn-figma btn-figma-outline" style="height: 28px; width: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" title="Chi tiết">';
                        html += '<i class="fas fa-eye"></i></a>';

                        if (window.userPermissions?.canUpdate && (row.trangThai === 'Nhap' || row.trangThai === 'YeuCauBoSung')) {
                            html += '<a href="' + API.edit + row.id + '" class="btn-figma btn-figma-outline" style="height: 28px; width: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" title="Chỉnh sửa">';
                            html += '<i class="fas fa-edit"></i></a>';
                        }

                        if (window.userPermissions?.canDelete && row.trangThai === 'Nhap') {
                            html += '<button type="button" class="btn-figma btn-figma-outline btn-delete" data-id="' + row.id + '" style="height: 28px; width: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" title="Xóa">';
                            html += '<i class="fas fa-trash text-danger"></i></button>';
                        }

                        html += '</div>';
                        return html;
                    }
                }
            ],
            createdRow: function (row, data) {
                const daysSince = getDaysSince(data.ngayPhatSinh);
                if (data.trangThai !== 'DaKetThuc' && daysSince <= 2) {
                    row.classList.add('row-danger-soft');
                } else if (data.trangThai !== 'DaKetThuc' && daysSince <= 5) {
                    row.classList.add('row-warning-soft');
                }

                row.addEventListener('click', function (event) {
                    if (event.target.closest('a, button')) {
                        return;
                    }

                    window.location.href = API.details + data.id;
                });
            },
            drawCallback: function () {
                // Call default figma DrawCallback
                if (window.FigmaDataTables && FigmaDataTables.defaultConfig) {
                    FigmaDataTables.defaultConfig.drawCallback(settings);
                }

                // Ensure pagination is in #paginationFrame
                const $container = $('.pagination-figma-container');
                if ($container.length && $('#paginationFrame').length) {
                    $container.appendTo('#paginationFrame');
                }

                // Other custom rendering after each draw
                // renderEmptyState();
            }
        });
    }

    function updateDangerBanner(rows) {
        const banner = document.getElementById('dangerBanner');
        const text = document.getElementById('dangerBannerText');
        if (!banner || !text) {
            return;
        }

        const dangerCount = rows.filter(function (row) {
            return row.mucDo === 'NghiemTrong' && row.trangThai !== 'DaKetThuc';
        }).length;

        if (dangerCount > 0) {
            text.textContent = 'Có ' + dangerCount + ' sự kiện mức Nghiêm trọng đang mở. Cần xử lý ngay!';
            banner.classList.add('show');
            return;
        }

        banner.classList.remove('show');
    }

    function renderEmptyState() {
        const dataTable = $('#sukienTable').DataTable();
        const tbody = document.querySelector('#sukienTable tbody');
        if (!tbody) {
            return;
        }

        if (dataTable.rows({ page: 'current' }).data().length > 0) {
            return;
        }

        tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state-figma"><i class="fas fa-inbox"></i><strong>Không tìm thấy sự kiện QHLĐ nào phù hợp điều kiện tìm kiếm.</strong><span>Điều chỉnh bộ lọc hoặc làm mới dữ liệu để tiếp tục.</span></div></td></tr>';
    }

    function resetFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('filterLoaiSuKien').value = '';
        document.getElementById('filterMucDo').value = '';
        document.getElementById('filterTrangThai').value = '';
        document.getElementById('filterFromDate').value = '';
        document.getElementById('filterToDate').value = '';
        document.getElementById('filterNguonDuLieu').value = '';

        if (window.jQuery && $.fn.select2) {
            $('#filterKcnId, #filterLoaiSuKien, #filterMucDo, #filterTrangThai, #filterNguonDuLieu').val(null).trigger('change');
        }
    }

    function closeAdvancedFilter() {
        document.getElementById('advancedFilterArea')?.classList.remove('show');
        document.getElementById('toggleFilter')?.classList.remove('active');
    }

    function validateDateRange() {
        const fromDate = document.getElementById('filterFromDate')?.value;
        const toDate = document.getElementById('filterToDate')?.value;
        if (fromDate && toDate && fromDate > toDate) {
            toastr.warning('Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.');
            return false;
        }

        return true;
    }

    function initFilters() {
        if (window.jQuery && $.fn.select2) {
            // KCN filter with AJAX
            $('#filterKcnId').select2({
                theme: 'bootstrap4',
                width: '100%',
                allowClear: true,
                placeholder: 'Tất cả KCN',
                ajax: {
                    url: '/IndustrialZones/GetForSelect2',
                    dataType: 'json',
                    delay: 250,
                    data: function(params) {
                        return { keyword: params.term, pageIndex: params.page || 1, pageSize: 20 };
                    },
                    processResults: function(data, params) {
                        return {
                            results: data.categories || [],
                            pagination: data.pagination || { more: false }
                        };
                    }
                }
            });

            // Other select2 filters
            $('#filterLoaiSuKien, #filterMucDo, #filterTrangThai, #filterNguonDuLieu').select2({
                theme: 'bootstrap4',
                width: '100%',
                allowClear: true,
                language: {
                    noResults: function () { return "Không tìm thấy kết quả"; }
                }
            });
        }

        $('#toggleFilter').on('click', function () {
            $(this).toggleClass('active');
            $('#advancedFilterArea').toggleClass('show');
        });

        $('#btnSearch').on('click', function () {
            if (!validateDateRange()) {
                return;
            }

            if (table) {
                table.ajax.reload();
            }
            closeAdvancedFilter();
        });

        $('#btnApplyFilter').on('click', function () {
            if (!validateDateRange()) {
                return;
            }

            if (table) {
                table.ajax.reload();
            }
            closeAdvancedFilter();
        });

        $('#btnRefreshTable').on('click', function () {
            resetFilters();
            closeAdvancedFilter();
            if (table) {
                table.ajax.reload();
            }
        });

        $('#btnResetFilter,#btnRefreshTable').on('click', function () {
            resetFilters();
            if (table) {
                table.ajax.reload();
            }
        });

        $('#searchInput').on('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                if (table) {
                    table.ajax.reload();
                }
            }, 400);
        });
    }

    function getAntiForgeryToken() {
        return document.querySelector('input[name="__RequestVerificationToken"]')?.value || '';
    }

    function initEvents() {
        $(document).on('click', '.btn-delete', function () {
            const id = $(this).data('id');
            if (!id) {
                return;
            }

            if (!window.confirm('Bạn có chắc chắn muốn xóa sự kiện này?')) {
                return;
            }

            fetch(API.delete + id, {
                method: 'POST',
                headers: {
                    'X-XSRF-TOKEN': getAntiForgeryToken()
                }
            })
                .then(function (response) {
                    return response.json();
                })
                .then(function (json) {
                    if (json.success) {
                        toastr.success(json.message || 'Đã xóa sự kiện.');
                        if (table) {
                            table.ajax.reload(null, false);
                        }
                        return;
                    }

                    toastr.error(json.message || 'Không thể xóa sự kiện.');
                })
                .catch(function () {
                    toastr.error('Lỗi kết nối khi xóa sự kiện.');
                });
        });

        $('#btnExportExcel').on('click', function () {
            toastr.info('Chức năng xuất Excel của màn hình danh sách đang được kết nối backend.');
        });
    }

    $(document).ready(function () {
        initDataTable();
        initFilters();
        initEvents();
    });
}());
