// Quản lý Báo cáo Đối thoại Định kỳ - IIFE Pattern (Clone of QCDC)
(function () {
    'use strict';

    let dataTable;
    let versionHistoryTable;
    let uploadedFiles = [];

    // Initialize
    $(document).ready(function () {
        const page = window.location.pathname.split('/').pop();

        if (page === 'Index' || page === '' || page === 'BaoCaoDoiThoaiDinhKy') {
            initIndexPage();
        } else if (page === 'Create') {
            initCreatePage();
        } else if (page === 'Details' && typeof baoCaoId !== 'undefined') {
            initDetailsPage();
        }
    });

    // ===== INDEX PAGE =====
    function initIndexPage() {
        initDataTable();
        bindIndexEvents();
        loadKyBaoCaoFilter();
    }

    function initDataTable() {
        dataTable = $('#tblBaoCaoDTDK').DataTable({
            processing: true,
            serverSide: true,
            ajax: {
                url: '/BaoCaoDoiThoaiDinhKy/GetAll',
                type: 'GET',
                dataSrc: 'data',
                data: function (d) {
                    const params = new URLSearchParams();
                    params.set('page', String((d.start / d.length) + 1));
                    params.set('pageSize', String(d.length));
                    const s   = $('#txtSearch').val();
                    const ky  = $('#filterKyBaoCao').val();
                    const loi = $('#filterLoai').val();
                    const tt  = $('#filterTrangThai').val();
                    if (s)   params.set('search', s);
                    if (ky)  params.set('kyBaoCaoId', ky);
                    if (loi) params.set('loai', loi);
                    if (tt)  params.set('trangThai', tt);
                    params.forEach(function (v, k) { d[k] = v; });
                    delete d.start; delete d.length;
                }
            },
            columns: [
                {
                    data: null,
                    width: '5%',
                    orderable: false,
                    render: function (data, type, row, meta) {
                        return meta.row + meta.settings._iDisplayStart + 1;
                    }
                },
                {
                    data: 'enterpriseName',
                    width: '22%',
                    render: function (data) { return escapeHtml(data || ''); }
                },
                {
                    data: 'kcnName',
                    width: '13%',
                    render: function (data) { return escapeHtml(data || ''); }
                },
                {
                    data: 'loaiDoiThoai',
                    width: '10%',
                    render: function (data) {
                        return data === 'DotXuat'
                            ? '<span class="badge badge-dotxuat">Đột xuất</span>'
                            : '<span class="badge badge-dinhky">Định kỳ</span>';
                    }
                },
                {
                    data: 'kyBaoCaoName',
                    width: '12%',
                    render: function (data) { return escapeHtml(data || ''); }
                },
                {
                    data: 'ngayNop',
                    width: '10%',
                    render: function (data) {
                        if (!data) return '<em class="text-muted">Chưa nộp</em>';
                        return data.substring(0, 10).split('-').reverse().join('/');
                    }
                },
                {
                    data: 'hanNop',
                    width: '10%',
                    render: function (data) {
                        if (!data) return '';
                        const d = new Date(data);
                        const today = new Date();
                        const overdue = d < today;
                        const formatted = data.substring(0, 10).split('-').reverse().join('/');
                        return overdue
                            ? '<span style="color:#991b1b;">' + formatted + '</span>'
                            : formatted;
                    }
                },
                {
                    data: 'trangThai',
                    width: '10%',
                    render: function (data) {
                        const badges = {
                            'Nhap': '<span class="badge badge-nhap">Nháp</span>',
                            'ChoXN': '<span class="badge badge-choxn">Chờ XN</span>',
                            'DaXN': '<span class="badge badge-daxn">Đã XN</span>',
                            'YeuCauBoSung': '<span class="badge badge-ycbs">Yêu cầu BS</span>',
                            'TuChoi': '<span class="badge badge-tuchoi">Từ chối</span>'
                        };
                        return badges[data] || '<span class="badge" style="background:#e2e8f0;color:#475569;">' + escapeHtml(data || '') + '</span>';
                    }
                },
                {
                    data: null,
                    width: '8%',
                    orderable: false,
                    render: function (data, type, row) {
                        let actions = '<a href="/BaoCaoDoiThoaiDinhKy/Details/' + row.id + '" class="btn-figma btn-figma-outline" style="padding:3px 8px;font-size:12px;" title="Chi tiết"><i class="fas fa-eye"></i></a> ';
                        if ((row.trangThai === 'Nhap' || row.trangThai === 0) && window.userPermissions && window.userPermissions.canDelete) {
                            actions += '<button type="button" class="btn-figma" style="background:#fee2e2;color:#991b1b;border:none;border-radius:6px;padding:3px 8px;font-size:12px;cursor:pointer;" class="btn-delete" data-id="' + row.id + '" title="Xóa"><i class="fas fa-trash"></i></button>';
                        }
                        return actions;
                    }
                }
            ],
            language: { url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/vi.json' },
            order: [[4, 'desc']]
        });
    }

    function bindIndexEvents() {
        let searchTimer;
        $('#txtSearch').on('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () { dataTable.ajax.reload(); }, 400);
        });

        $('#btnFilter').on('click', function () {
            dataTable.ajax.reload();
        });

        $('#btnReset').on('click', function () {
            $('#txtSearch').val('');
            $('#filterKyBaoCao').val('');
            $('#filterLoai').val('');
            $('#filterTrangThai').val('');
            dataTable.ajax.reload();
        });

        $(document).on('click', '.btn-delete', function () {
            const id = $(this).data('id');
            if (confirm('Bạn có chắc muốn xóa báo cáo này?')) {
                deleteBaoCao(id);
            }
        });

        $('#btnExport').on('click', function () {
            const kyBaoCaoId = $('#filterKyBaoCao').val();
            window.location.href = '/BaoCaoDoiThoaiDinhKy/Export?kyBaoCaoId=' + (kyBaoCaoId || '');
        });
    }
        });

        $(document).on('click', '.btn-delete', function () {
            const id = $(this).data('id');
            if (confirm('Bạn có chắc muốn xóa báo cáo này?')) {
                deleteBaoCao(id);
            }
        });

        $('#btnExport').on('click', function () {
            const kyBaoCaoId = $('#filterKyBaoCao').val();
            window.location.href = `/BaoCaoDoiThoaiDinhKy/Export?kyBaoCaoId=${kyBaoCaoId || ''}`;
        });
    }

    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : '';
    }

    function escapeHtml(str) {        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function loadKyBaoCaoFilter() {
        $.ajax({
            url: '/KyBaoCaoQCDCVaDT/GetAll?page=1&pageSize=100',
            type: 'GET',
            success: function (response) {
                if (response.success && response.data) {
                    const select = $('#filterKyBaoCao');
                    const items = response.data.items || response.data;
                    (Array.isArray(items) ? items : []).forEach(function (item) {
                        select.append('<option value="' + item.id + '">' + escapeHtml(item.tenKy) + ' - ' + item.nam + '</option>');
                    });
                }
            }
        });
    }

    function deleteBaoCao(id) {
        $.ajax({
            url: '/BaoCaoDoiThoaiDinhKy/Delete/' + id,
            type: 'POST',
            headers: {
                'X-XSRF-TOKEN': getCookie('XSRF-TOKEN')
            },
            success: function (response) {
                if (response.success) {
                    toastr.success('Xóa báo cáo thành công');
                    dataTable.ajax.reload();
                } else {
                    toastr.error(response.message || 'Có lỗi xảy ra');
                }
            },
            error: function () {
                toastr.error('Có lỗi xảy ra khi xóa báo cáo');
            }
        });
    }

    // ===== CREATE PAGE =====
    function initCreatePage() {
        initSelect2();
        initFileUpload();
        bindCreateEvents();
        loadKyBaoCaoOptions();
        loadEnterpriseOptions();
    }

    function initSelect2() {
        $('.select2').select2({
            theme: 'bootstrap4',
            width: '100%'
        });
    }

    function initFileUpload() {
        const uploadArea = $('#fileUploadArea');
        const fileInput = $('#fileInput');

        uploadArea.on('click', function () {
            fileInput.click();
        });

        uploadArea.on('dragover', function (e) {
            e.preventDefault();
            $(this).css('border-color', 'var(--primary)');
        });

        uploadArea.on('dragleave', function () {
            $(this).css('border-color', '#cbd5e1');
        });

        uploadArea.on('drop', function (e) {
            e.preventDefault();
            $(this).css('border-color', '#cbd5e1');
            handleFiles(e.originalEvent.dataTransfer.files);
        });

        fileInput.on('change', function () {
            handleFiles(this.files);
        });
    }

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            if (file.size > 10 * 1024 * 1024) {
                toastr.warning(`File "${file.name}" vượt quá 10MB`);
                return;
            }
            uploadedFiles.push(file);
            renderFileList();
        });
    }

    function renderFileList() {
        const fileList = $('#fileList');
        fileList.empty();
        uploadedFiles.forEach((file, index) => {
            const item = $(`
                <div class="file-item">
                    <span><i class="fas fa-paperclip mr-2"></i>${file.name} (${formatFileSize(file.size)})</span>
                    <button type="button" class="btn btn-sm btn-danger btn-remove-file" data-index="${index}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `);
            fileList.append(item);
        });

        $('.btn-remove-file').on('click', function () {
            const index = $(this).data('index');
            uploadedFiles.splice(index, 1);
            renderFileList();
        });
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function bindCreateEvents() {
        $('#btnSaveDraft').on('click', function () {
            submitBaoCao(0);
        });

        $('#btnSubmit').on('click', function () {
            submitBaoCao(1);
        });
    }

    function loadKyBaoCaoOptions() {
        $.ajax({
            url: '/KyBaoCaoQCDCVaDT/GetAll?page=1&pageSize=100&trangThai=0',
            type: 'GET',
            success: function (response) {
                if (response.success && response.data) {
                    const select = $('#kyBaoCaoId');
                    response.data.items.forEach(item => {
                        select.append(`<option value="${item.id}">${item.tenKy} - ${item.nam}</option>`);
                    });
                }
            }
        });
    }

    function loadEnterpriseOptions() {
        $.ajax({
            url: '/Enterprise/GetAll?page=1&pageSize=1000',
            type: 'GET',
            success: function (response) {
                if (response.success && response.data) {
                    const select = $('#enterpriseId');
                    response.data.items.forEach(item => {
                        select.append(`<option value="${item.id}">${item.tenDoanhnghiep}</option>`);
                    });
                }
            }
        });
    }

    function submitBaoCao(trangThai) {
        const formData = new FormData();
        formData.append('kyBaoCaoId', $('#kyBaoCaoId').val());
        formData.append('enterpriseId', $('#enterpriseId').val());
        formData.append('tongSoCuocDoiThoai', $('#tongSoCuocDoiThoai').val());
        formData.append('soNguoiThamGia', $('#soNguoiThamGia').val());
        formData.append('soVanDeTraoDoi', $('#soVanDeTraoDoi').val());
        formData.append('soVanDeGiaiQuyet', $('#soVanDeGiaiQuyet').val());
        formData.append('noiDungTomTat', $('#noiDungTomTat').val());
        formData.append('kienNghiDeXuat', $('#kienNghiDeXuat').val() || '');
        formData.append('ghiChu', $('#ghiChu').val() || '');
        formData.append('trangThai', trangThai);

        uploadedFiles.forEach(file => {
            formData.append('files', file);
        });

        $.ajax({
            url: '/BaoCaoDoiThoaiDinhKy/Create',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
            },
            success: function (response) {
                if (response.success) {
                    toastr.success(trangThai === 0 ? 'Lưu nháp thành công' : 'Nộp báo cáo thành công');
                    window.location.href = '/BaoCaoDoiThoaiDinhKy';
                } else {
                    toastr.error(response.message || 'Có lỗi xảy ra');
                }
            },
            error: function () {
                toastr.error('Có lỗi xảy ra khi lưu báo cáo');
            }
        });
    }

    // ===== DETAILS PAGE =====
    function initDetailsPage() {
        initVersionHistoryTable();
        initTabNav();
        loadFileList();
        bindDetailsEvents();
    }

    function initTabNav() {
        $(document).on('click', '.tab-btn', function () {
            const tab = $(this).data('tab');
            $('.tab-btn').removeClass('active');
            $(this).addClass('active');
            $('.tab-pane').removeClass('active');
            $('#tab-' + tab).addClass('active');
            if (tab === 'lichsu' && versionHistoryTable) {
                versionHistoryTable.columns.adjust();
            }
        });
    }

    function loadFileList() {
        if (!window.baoCaoId && typeof baoCaoId === 'undefined') return;
        const id = window.baoCaoId || baoCaoId;
        $.ajax({
            url: '/BaoCaoDoiThoaiDinhKy/GetFiles/' + id,
            type: 'GET',
            success: function (response) {
                const container = $('#fileListContainer');
                container.empty();
                const files = (response.data || response) || [];
                if (!files.length) {
                    container.html('<div class="text-center text-muted p-4" style="font-size:13px;"><i class="fas fa-inbox mr-2"></i>Chưa có file đính kèm</div>');
                    return;
                }
                files.forEach(function (f) {
                    container.append(
                        '<div class="file-item-row">' +
                        '<i class="fas fa-file mr-2" style="color:#64748b;"></i>' +
                        '<span style="flex:1;">' + escapeHtml(f.tenFile || f.fileName || 'File') + '</span>' +
                        '<a href="/BaoCaoDoiThoaiDinhKy/DownloadFile/' + f.id + '" class="btn-figma btn-figma-outline" style="height:28px;padding:0 10px;font-size:12px;" download>' +
                        '<i class="fas fa-download mr-1"></i>Tải về</a>' +
                        '</div>'
                    );
                });
            },
            error: function () {
                $('#fileListContainer').html('<div class="text-center text-muted p-4" style="font-size:13px;"><i class="fas fa-exclamation-circle mr-2"></i>Không thể tải danh sách file</div>');
            }
        });
    }

    function initVersionHistoryTable() {
        const id = window.baoCaoId || (typeof baoCaoId !== 'undefined' ? baoCaoId : null);
        if (!id) return;
        versionHistoryTable = $('#tblVersionHistory').DataTable({
            processing: true,
            serverSide: false,
            ajax: {
                url: '/BaoCaoDoiThoaiDinhKy/GetVersionHistory/' + id,
                type: 'GET',
                dataSrc: 'data'
            },
            columns: [
                { data: 'phienBan', title: 'Phiên bản', width: '10%' },
                {
                    data: 'ngayTao',
                    title: 'Ngày thay đổi',
                    width: '20%',
                    render: function (data) {
                        if (!data) return '';
                        return data.substring(0, 10).split('-').reverse().join('/') + ' ' + data.substring(11, 16);
                    }
                },
                { data: 'nguoiTao', title: 'Người TH', width: '20%' },
                { data: 'hanhDong', title: 'Hành động', width: '20%' },
                { data: 'ghiChu', title: 'Ghi chú', width: '30%' }
            ],
            language: { url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/vi.json' },
            order: [[0, 'desc']]
        });
    }

    function bindDetailsEvents() {
        const id = window.baoCaoId || (typeof baoCaoId !== 'undefined' ? baoCaoId : null);

        // Submit báo cáo
        $('#btnSubmitBC').on('click', function () {
            if (confirm('Xác nhận nộp báo cáo này?')) {
                performWorkflow('Nop', id, null);
            }
        });

        // Approve
        $('#btnApprove').on('click', function () {
            if (confirm('Xác nhận phê duyệt báo cáo này?')) {
                performWorkflow('XacNhan', id, null);
            }
        });

        // YCBS
        $('#btnYCBS').on('click', function () {
            $('#ycbsLyDo').val('');
            $('#charYCBS').text('0');
            $('#modalYCBS').addClass('show');
        });
        $('#btnCancelYCBS').on('click', function () { $('#modalYCBS').removeClass('show'); });
        $('#ycbsLyDo').on('input', function () { $('#charYCBS').text($(this).val().length); });
        $('#btnConfirmYCBS').on('click', function () {
            const lyDo = $('#ycbsLyDo').val().trim();
            if (!lyDo) { toastr.warning('Vui lòng nhập lý do.'); return; }
            $('#modalYCBS').removeClass('show');
            performWorkflow('YeuCauBoSung', id, lyDo);
        });

        // Từ chối
        $('#btnTuChoi').on('click', function () {
            $('#tcLyDo').val('');
            $('#charTC').text('0');
            $('#modalTuChoi').addClass('show');
        });
        $('#btnCancelTC').on('click', function () { $('#modalTuChoi').removeClass('show'); });
        $('#tcLyDo').on('input', function () { $('#charTC').text($(this).val().length); });
        $('#btnConfirmTC').on('click', function () {
            const lyDo = $('#tcLyDo').val().trim();
            if (!lyDo) { toastr.warning('Vui lòng nhập lý do từ chối.'); return; }
            $('#modalTuChoi').removeClass('show');
            performWorkflow('TuChoi', id, lyDo);
        });

        // Nộp lại
        $('#btnNopLai').on('click', function () { $('#modalNopLai').addClass('show'); });
        $('#btnCancelNopLai').on('click', function () { $('#modalNopLai').removeClass('show'); });
        $('#btnConfirmNopLai').on('click', function () {
            $('#modalNopLai').removeClass('show');
            performWorkflow('NopLai', id, null);
        });
    }

    function performWorkflow(action, id, lyDo) {
        $.ajax({
            url: '/BaoCaoDoiThoaiDinhKy/' + action + '/' + id,
            type: 'POST',
            contentType: 'application/json',
            headers: { 'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') },
            data: lyDo ? JSON.stringify({ lyDo: lyDo }) : '{}',
            success: function (response) {
                if (response.success) {
                    toastr.success(response.message || 'Thao tác thành công');
                    setTimeout(function () { location.reload(); }, 800);
                } else {
                    toastr.error(response.message || 'Có lỗi xảy ra');
                }
            },
            error: function () {
                toastr.error('Có lỗi xảy ra khi thực hiện thao tác');
            }
        });
    }

    function viewFile(fileId) {
        $.ajax({
            url: `/BaoCaoDoiThoaiDinhKy/GetFilePreviewUrl/${fileId}`,
            type: 'GET',
            success: function (response) {
                if (response.success && response.data) {
                    window.open(response.data, '_blank');
                } else {
                    toastr.error('Không thể tải file');
                }
            },
            error: function () {
                toastr.error('Có lỗi xảy ra khi tải file');
            }
        });
    }

})();
