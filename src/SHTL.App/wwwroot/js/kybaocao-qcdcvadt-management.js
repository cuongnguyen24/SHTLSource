// Quản lý Kỳ báo cáo QCDC/ĐTĐK - IIFE Pattern
(function () {
    'use strict';

    let dataTable;
    let currentKyBaoCaoId = null;

    $(document).ready(function () {
        initDataTable();
        bindEvents();
    });

    function toIsoDateInputValue(value) {
        if (!value) return '';
        const raw = String(value).trim();
        if (!raw) return '';
        if (raw.length >= 10 && raw[4] === '-' && raw[7] === '-') return raw.substring(0, 10);

        // .NET JSON date format: /Date(1735603200000)/
        const dotNetMatch = raw.match(/\/Date\((\d+)\)\//);
        if (dotNetMatch && dotNetMatch[1]) {
            const ticks = parseInt(dotNetMatch[1], 10);
            if (!Number.isNaN(ticks)) {
                const d = new Date(ticks);
                if (!Number.isNaN(d.getTime())) return moment(d).format('YYYY-MM-DD');
            }
        }

        const m = moment(
            raw,
            [
                'DD/MM/YYYY HH:mm:ss',
                'D/M/YYYY HH:mm:ss',
                'DD/MM/YYYY H:mm:ss',
                'D/M/YYYY H:mm:ss',
                'DD/MM/YYYY',
                'D/M/YYYY',
                'YYYY-MM-DD HH:mm:ss',
                'YYYY-MM-DDTHH:mm:ss',
                'YYYY-MM-DDTHH:mm:ss.SSSZ',
                'YYYY-MM-DD',
                moment.ISO_8601
            ],
            false
        );
        if (m.isValid()) return m.format('YYYY-MM-DD');

        const nativeDate = new Date(raw);
        return Number.isNaN(nativeDate.getTime()) ? '' : moment(nativeDate).format('YYYY-MM-DD');
    }

    function formatDisplayDate(value) {
        const iso = toIsoDateInputValue(value);
        return iso ? moment(iso, 'YYYY-MM-DD').format('DD/MM/YYYY') : '';
    }

    function initDataTable() {
        dataTable = $('#tblKyBaoCao').DataTable({
            processing: true,
            serverSide: true,
            searching: false,
            lengthChange: false,
            info: false,
            paging: false,
            dom: 'rt',
            ajax: {
                url: '/KyBaoCaoQCDCVaDT/GetAll',
                type: 'GET',
                data: function (d) {
                    const params = new URLSearchParams();
                    const pageSize = Number.isFinite(d.length) && d.length > 0 ? d.length : 20;
                    const start = Number.isFinite(d.start) && d.start >= 0 ? d.start : 0;
                    const page = Math.floor(start / pageSize) + 1;
                    params.set('page', String(page));
                    params.set('pageSize', String(pageSize));
                    params.forEach(function (v, k) { d[k] = v; });
                    delete d.start; delete d.length;
                }
            },
            columns: [
                { data: null, width: '5%', orderable: false, render: function (data, type, row, meta) { return meta.row + meta.settings._iDisplayStart + 1; } },
                { data: 'tenKy', width: '15%' },
                { data: 'nam', width: '10%' },
                {
                    data: 'tuNgay',
                    width: '20%',
                    render: function (data) {
                        return formatDisplayDate(data);
                    }
                },
                {
                    data: 'hanNop',
                    width: '20%',
                    render: function (data) {
                        return formatDisplayDate(data);
                    }
                },
                {
                    data: 'trangThai',
                    width: '10%',
                    render: function (data) {
                        return data === 'Mo'
                            ? '<span class="badge badge-mo">● Mở</span>'
                            : '<span class="badge badge-dong">○ Đóng</span>';
                    }
                },
                {
                    data: null,
                    width: '15%',
                    orderable: false,
                    render: function (data, type, row) {
                        const isOpen = row.trangThai === 'Mo';
                        return `<a href="/KyBaoCaoQCDCVaDT/Edit/${row.id}" class="btn btn-sm btn-info" title="Sửa"><i class="fas fa-edit"></i></a>
                                <button type="button" class="btn btn-sm btn-${isOpen ? 'success' : 'warning'} btn-toggle" data-id="${row.id}" title="${isOpen ? 'Đóng kỳ' : 'Mở kỳ'}"><i class="fas fa-${isOpen ? 'lock' : 'lock-open'}"></i></button>
                                <button type="button" class="btn btn-sm btn-danger btn-delete" data-id="${row.id}" title="Xóa"><i class="fas fa-trash"></i></button>`;
                    }
                }
            ],
            language: { url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/vi.json' },
            order: [[2, 'desc'], [1, 'asc']]
        });
    }

    function bindEvents() {
        $('#btnCreate').on('click', function () {
            currentKyBaoCaoId = null;
            resetForm();
            $('#modalTitle').text('Tạo kỳ báo cáo');
            $('#modalKyBaoCao').modal('show');
        });

        $('#btnSave').on('click', function () { saveKyBaoCao(); });

        $(document).on('click', '.btn-toggle', function () {
            const id = $(this).data('id');
            const isOpen = $(this).hasClass('btn-success');
            if (confirm(`Bạn có chắc muốn ${isOpen ? 'đóng' : 'mở'} kỳ báo cáo này?`)) {
                toggleStatus(id);
            }
        });

        $(document).on('click', '.btn-delete', function () {
            const id = $(this).data('id');
            if (confirm('Bạn có chắc muốn xóa kỳ báo cáo này?')) {
                deleteKyBaoCao(id);
            }
        });
    }

    function mapKyMeta(tenKyValue, nam) {
        const year = parseInt(nam, 10);
        if (!year || !tenKyValue) return null;
        if (tenKyValue === '6T_Dau') return { tenKyText: '6 tháng đầu năm', soKy: 1, denNgay: `${year}-06-30` };
        if (tenKyValue === '6T_Cuoi') return { tenKyText: '6 tháng cuối năm', soKy: 2, denNgay: `${year}-12-31` };
        if (tenKyValue === 'Ca_Nam') return { tenKyText: 'Cả năm', soKy: 3, denNgay: `${year}-12-31` };
        return null;
    }

    function resetForm() {
        currentKyBaoCaoId = null;
        $('#kyBaoCaoId').val('');
        $('#selectTenKy').val('');
        $('#inputNam').val(new Date().getFullYear());
        $('#inputTuNgay').val('');
        $('#inputHanNop').val('');
        if ($('#inputGhiChu').length) $('#inputGhiChu').val('');
    }

    function saveKyBaoCao() {
        const tenKyValue = $('#selectTenKy').val();
        const nam = parseInt($('#inputNam').val(), 10);
        const kyMeta = mapKyMeta(tenKyValue, nam);

        const formData = {
            tenKy: kyMeta ? kyMeta.tenKyText : '',
            nam: nam,
            soKy: kyMeta ? kyMeta.soKy : 0,
            tuNgay: ($('#inputTuNgay').val() || '').trim(),
            denNgay: kyMeta ? kyMeta.denNgay : '',
            hanNop: ($('#inputHanNop').val() || '').trim(),
            ghiChu: $('#inputGhiChu').length ? ($('#inputGhiChu').val() || '').trim() : ''
        };

        const missing = [];
        if (!tenKyValue) missing.push('Tên kỳ');
        if (!formData.nam) missing.push('Năm');
        if (!formData.soKy) missing.push('Số kỳ');
        if (!formData.tuNgay) missing.push('Ngày bắt đầu');
        if (!formData.denNgay) missing.push('Ngày kết thúc');
        if (!formData.hanNop) missing.push('Hạn nộp');
        if (missing.length > 0) { toastr.warning('Vui lòng nhập: ' + missing.join(', ')); return; }

        if (formData.hanNop < formData.tuNgay) {
            toastr.warning('Hạn nộp phải lớn hơn hoặc bằng Ngày bắt đầu.');
            return;
        }

        const url = currentKyBaoCaoId ? `/KyBaoCaoQCDCVaDT/Update/${currentKyBaoCaoId}` : '/KyBaoCaoQCDCVaDT/Create';
        $.ajax({
            url: url,
            type: 'POST',
            contentType: 'application/json',
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            data: JSON.stringify(formData),
            success: function (response) {
                if (response.success) {
                    toastr.success(response.message || 'Lưu thành công');
                    $('#modalKyBaoCao').modal('hide');
                    dataTable.ajax.reload();
                } else {
                    const detailErrors = Array.isArray(response.errors) ? response.errors.filter(Boolean) : [];
                    toastr.error(detailErrors.length > 0 ? detailErrors.join('<br/>') : (response.message || 'Có lỗi xảy ra'));
                }
            },
            error: function (xhr) {
                const response = xhr.responseJSON || {};
                const detailErrors = Array.isArray(response.errors) ? response.errors.filter(Boolean) : [];
                const message = detailErrors.length > 0 ? detailErrors.join('<br/>') : (response.message || 'Có lỗi xảy ra khi lưu dữ liệu');
                toastr.error(message);
            }
        });
    }

    function toggleStatus(id) {
        $.ajax({
            url: `/KyBaoCaoQCDCVaDT/ToggleStatus/${id}`,
            type: 'POST',
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (response) {
                if (response.success) {
                    toastr.success(response.message || 'Cập nhật trạng thái thành công');
                    dataTable.ajax.reload();
                } else {
                    toastr.error(response.message || 'Có lỗi xảy ra');
                }
            },
            error: function () { toastr.error('Có lỗi xảy ra khi cập nhật trạng thái'); }
        });
    }

    function deleteKyBaoCao(id) {
        $.ajax({
            url: `/KyBaoCaoQCDCVaDT/Delete/${id}`,
            type: 'POST',
            headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() },
            success: function (response) {
                if (response.success) {
                    toastr.success(response.message || 'Xóa thành công');
                    dataTable.ajax.reload();
                } else {
                    toastr.error(response.message || 'Có lỗi xảy ra');
                }
            },
            error: function () { toastr.error('Có lỗi xảy ra khi xóa dữ liệu'); }
        });
    }
})();
