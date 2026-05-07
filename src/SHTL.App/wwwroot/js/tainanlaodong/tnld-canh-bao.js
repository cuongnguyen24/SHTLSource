/**
 * TNLD Cảnh báo JavaScript (M0144 - KPI + DN table + batch send)
 * Pattern: IIFE + DataTables + batch checkbox selection + AJAX
 */
(function () {
    'use strict';

    const permissions = window.userPermissions || {};
    let table;
    let selectedDNIds = [];
    let historyPage = 1;

    $(document).ready(function () {
        loadKPICards();
        initDataTable();
        initFilterBar();
        initBatchActions();
        initHistoryAccordion();
    });

    function loadKPICards() {
        $.ajax({
            url: '/TaiNanLaoDongCanhBao/GetKPI',
            type: 'GET',
            success: function (data) {
                $('#kpiDNChuaNop').text(data.soDoanhNghiepChuaNop || 0);
                $('#kpiQuaHan').text(data.soDoanhNghiepQuaHan || 0);
                $('#kpiDaGuiCanhBao').text(data.soCanhBaoDaGuiTrongThang || 0);
            },
            error: function () {
                toastr.error('Lỗi khi tải KPI');
            }
        });
    }

    function initDataTable() {
        table = $('#dnChuaNopTable').DataTable({
            serverSide: true,
            processing: true,
            ajax: {
                url: '/TaiNanLaoDongCanhBao/GetDNChuaNop',
                type: 'GET',
                data: function (d) {
                    d.page = Math.floor(d.start / d.length) + 1;
                    d.pageSize = d.length;
                    d.kyBaoCaoId = $('#filterKyBaoCao').val();
                    d.mucCanhBao = $('#filterMucCanhBao').val();
                    
                    delete d.start;
                    delete d.length;
                    delete d.columns;
                    delete d.order;
                },
                dataSrc: function (json) {
                    json.recordsTotal = json.totalCount || 0;
                    json.recordsFiltered = json.totalCount || 0;
                    return json.items || [];
                },
                error: function () {
                    toastr.error('Lỗi khi tải danh sách');
                }
            },
            columns: [
                {
                    data: null,
                    orderable: false,
                    render: function (data, type, row) {
                        return `<input type="checkbox" class="dn-checkbox" value="${row.enterpriseId}" data-email="${row.email}">`;
                    },
                    width: '40px'
                },
                {
                    data: null,
                    render: function (data, type, row, meta) {
                        return meta.row + meta.settings._iDisplayStart + 1;
                    },
                    orderable: false,
                    width: '50px'
                },
                { data: 'enterpriseName', render: $.fn.dataTable.render.text() },
                { data: 'industrialZoneName' },
                { data: 'email' },
                { data: 'phoneNumber' },
                { data: 'kyBaoCaoTen' },
                {
                    data: 'hanNop',
                    render: function (data) {
                        return new Date(data).toLocaleDateString('vi-VN');
                    }
                },
                {
                    data: 'soNgayConLai',
                    render: function (data) {
                        if (data < 0) {
                            return `<span class="text-danger">Quá hạn ${Math.abs(data)} ngày</span>`;
                        }
                        return `${data} ngày`;
                    },
                    className: 'text-center'
                },
                {
                    data: 'mucCanhBao',
                    render: function (data) {
                        const badges = {
                            'Thap': '<span class="badge badge-info">Thấp</span>',
                            'Trung': '<span class="badge badge-warning">Trung</span>',
                            'Cao': '<span class="badge badge-danger">Cao</span>'
                        };
                        return badges[data] || data;
                    },
                    className: 'text-center'
                },
                { data: 'soLanDaGui', className: 'text-center' },
                {
                    data: null,
                    orderable: false,
                    render: function (data, type, row) {
                        if (permissions.canSend) {
                            return `<button onclick="guiCanhBaoDon('${row.enterpriseId}', '${row.kyBaoCaoId}')" class="btn btn-sm btn-warning">
                                <i class="fas fa-bell"></i> Gửi
                            </button>`;
                        }
                        return '<span class="text-muted">-</span>';
                    }
                }
            ],
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/vi.json'
            }
        });
    }

    function initFilterBar() {
        $.get('/TaiNanLaoDong/GetKyBaoCao', function (data) {
            const $select = $('#filterKyBaoCao');
            data.items.forEach(ky => {
                if (ky.status === 'DangMo') {
                    $select.append(`<option value="${ky.id}" selected>${ky.tenKy}</option>`);
                } else {
                    $select.append(`<option value="${ky.id}">${ky.tenKy}</option>`);
                }
            });
            table.ajax.reload();
        });

        $('#btnSearch').on('click', () => {
            loadKPICards();
            table.ajax.reload();
        });
        
        $('#btnReset').on('click', function () {
            $('#filterKyBaoCao').val('');
            $('#filterMucCanhBao').val('');
            loadKPICards();
            table.ajax.reload();
        });
    }

    function initBatchActions() {
        $('#checkboxAll').on('change', function () {
            const isChecked = $(this).is(':checked');
            $('.dn-checkbox').prop('checked', isChecked);
            updateSelectedList();
        });

        $('#dnChuaNopTable tbody').on('change', '.dn-checkbox', function () {
            updateSelectedList();
        });

        $('#btnGuiCanhBaoHangLoat').on('click', function () {
            if (selectedDNIds.length === 0) {
                toastr.warning('Vui lòng chọn ít nhất một doanh nghiệp');
                return;
            }
            
            if (!confirm(`Gửi cảnh báo cho ${selectedDNIds.length} doanh nghiệp?`)) return;
            
            const kyBaoCaoId = $('#filterKyBaoCao').val();
            if (!kyBaoCaoId) {
                toastr.error('Vui lòng chọn kỳ báo cáo');
                return;
            }

            $.ajax({
                url: '/TaiNanLaoDongCanhBao/GuiCanhBaoHangLoat',
                type: 'POST',
                data: JSON.stringify({ enterpriseIds: selectedDNIds, kyBaoCaoId: kyBaoCaoId }),
                contentType: 'application/json',
                headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
                success: function (response) {
                    if (response.success) {
                        toastr.success(response.message || `Đã gửi cảnh báo cho ${selectedDNIds.length} doanh nghiệp`);
                        selectedDNIds = [];
                        $('#checkboxAll').prop('checked', false);
                        $('#btnGuiCanhBaoHangLoat').prop('disabled', true);
                        loadKPICards();
                        table.ajax.reload();
                    } else {
                        toastr.error(response.message || 'Đã có lỗi');
                    }
                },
                error: function () {
                    toastr.error('Không thể kết nối đến máy chủ');
                }
            });
        });
    }

    function updateSelectedList() {
        selectedDNIds = [];
        $('.dn-checkbox:checked').each(function () {
            selectedDNIds.push($(this).val());
        });
        $('#btnGuiCanhBaoHangLoat').prop('disabled', selectedDNIds.length === 0);
    }

    window.guiCanhBaoDon = function (enterpriseId, kyBaoCaoId) {
        if (!confirm('Gửi cảnh báo cho doanh nghiệp này?')) return;
        
        $.ajax({
            url: '/TaiNanLaoDongCanhBao/GuiCanhBao',
            type: 'POST',
            data: JSON.stringify({ enterpriseId: enterpriseId, kyBaoCaoId: kyBaoCaoId }),
            contentType: 'application/json',
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (response) {
                if (response.success) {
                    toastr.success('Đã gửi cảnh báo');
                    loadKPICards();
                    table.ajax.reload(null, false);
                } else {
                    toastr.error(response.message || 'Đã có lỗi');
                }
            },
            error: function () {
                toastr.error('Không thể kết nối đến máy chủ');
            }
        });
    };

    function initHistoryAccordion() {
        $('#collapseLichSu').on('show.bs.collapse', function () {
            loadHistory();
        });

        $('#btnLoadMoreHistory').on('click', function () {
            historyPage++;
            loadHistory(true);
        });
    }

    function loadHistory(append = false) {
        $.ajax({
            url: '/TaiNanLaoDongCanhBao/GetLichSuCanhBao',
            type: 'GET',
            data: { page: historyPage, pageSize: 20 },
            success: function (data) {
                const $tbody = $('#lichSuTable tbody');
                if (!append) $tbody.empty();
                
                data.items.forEach(item => {
                    const row = `
                        <tr>
                            <td>${new Date(item.thoiGianGui).toLocaleString('vi-VN')}</td>
                            <td>${item.enterpriseName}</td>
                            <td>${item.kyBaoCaoTen}</td>
                            <td>${item.mucCanhBao}</td>
                            <td>${item.kenhGui}</td>
                            <td>${item.trangThai}</td>
                            <td>${item.nguoiGui}</td>
                        </tr>
                    `;
                    $tbody.append(row);
                });

                if (data.items.length < 20) {
                    $('#btnLoadMoreHistory').hide();
                }
            },
            error: function () {
                toastr.error('Lỗi khi tải lịch sử');
            }
        });
    }

})();
