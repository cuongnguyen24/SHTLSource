/**
 * complaint-reports.js
 * SCR-NV-BC-001 — Xuất báo cáo thống kê đơn thư khiếu nại
 * Pattern: IIFE + jQuery AJAX
 */
(function () {
    'use strict';

    // ── State ────────────────────────────────────────────────────────
    var previewReady = false;   // BR-44: track whether preview has loaded

    // ── Helper: get antiforgery token from cookie ────────────────────
    function getCookie(name) {
        var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : '';
    }

    // ── Kỳ báo cáo toggle logic ──────────────────────────────────────
    function onKyChange() {
        var ky = $('#kyBaoCao').val();

        // Hide all period sub-selectors first
        $('#thangSelect').hide();
        $('#quySelect').hide();
        $('#dateRangeSection').css('display', 'none');
        $('#namSelect').show();

        if (ky === 'THANG') {
            $('#thangSelect').show();
        } else if (ky === 'QUY') {
            $('#quySelect').show();
        } else if (ky === 'NAM') {
            // Only year shown — already visible
        } else if (ky === 'TUY_CHON') {
            $('#namSelect').hide();
            $('#thangSelect').hide();
            $('#quySelect').hide();
            $('#dateRangeSection').css('display', 'grid');

            // BR-45: default bcDateTo to today if empty
            if (!$('#bcDateTo').val()) {
                var today = new Date();
                var yyyy = today.getFullYear();
                var mm = String(today.getMonth() + 1).padStart(2, '0');
                var dd = String(today.getDate()).padStart(2, '0');
                $('#bcDateTo').val(yyyy + '-' + mm + '-' + dd);
            }
        }

        // Reset download buttons when period changes (BR-44)
        resetDownloadButtons();
    }

    // ── Collect all form params ───────────────────────────────────────
    function buildReportParams() {
        var params = {
            loaiBaoCao: $('#loaiBaoCao').val(),
            ky: $('#kyBaoCao').val()
        };

        var ky = params.ky;
        if (ky === 'THANG') {
            params.thang = $('#thang').val();
            params.nam = $('#namBaoCao').val();
        } else if (ky === 'QUY') {
            params.quy = $('#quy').val();
            params.nam = $('#namBaoCao').val();
        } else if (ky === 'NAM') {
            params.nam = $('#namBaoCao').val();
        } else if (ky === 'TUY_CHON') {
            params.dateFrom = $('#bcDateFrom').val();
            params.dateTo = $('#bcDateTo').val();
        }

        var phong = $('#phongBanBC').val();
        if (phong) {
            params.phongId = phong;
        }

        return params;
    }

    // ── Validation ───────────────────────────────────────────────────
    function validate() {
        var ok = true;
        var loai = $('#loaiBaoCao').val();
        if (!loai) {
            $('#loaiBCError').show();
            ok = false;
        } else {
            $('#loaiBCError').hide();
        }

        var ky = $('#kyBaoCao').val();
        if (ky === 'TUY_CHON') {
            var dateFrom = $('#bcDateFrom').val();
            if (!dateFrom) {
                $('#bcDateFromError').show();
                ok = false;
            } else {
                $('#bcDateFromError').hide();
            }
        }

        return ok;
    }

    // ── Render preview table ─────────────────────────────────────────
    function renderPreviewTable(data) {
        if (!data || (!data.headers && !data.rows)) {
            return '<p style="text-align:center;color:#94a3b8;padding:24px;">Không có dữ liệu để hiển thị.</p>';
        }

        var html = '<table id="previewTable">';

        // Header
        if (data.headers && data.headers.length > 0) {
            html += '<thead><tr>';
            $.each(data.headers, function (i, h) {
                html += '<th>' + $('<div>').text(h).html() + '</th>';
            });
            html += '</tr></thead>';
        }

        // Body
        html += '<tbody>';
        if (data.rows && data.rows.length > 0) {
            $.each(data.rows, function (i, row) {
                html += '<tr>';
                $.each(row, function (j, cell) {
                    html += '<td>' + $('<div>').text(cell).html() + '</td>';
                });
                html += '</tr>';
            });
        } else {
            var cols = (data.headers && data.headers.length) ? data.headers.length : 1;
            html += '<tr><td colspan="' + cols + '" style="text-align:center;color:#94a3b8;padding:20px;">Không có dữ liệu.</td></tr>';
        }
        html += '</tbody>';

        // Totals footer
        if (data.totals && data.totals.length > 0) {
            html += '<tfoot><tr>';
            $.each(data.totals, function (i, t) {
                html += '<td>' + $('<div>').text(t).html() + '</td>';
            });
            html += '</tr></tfoot>';
        }

        html += '</table>';
        return html;
    }

    // ── Disable download buttons (BR-44) ─────────────────────────────
    function resetDownloadButtons() {
        previewReady = false;
        $('#btnExcelBC').prop('disabled', true);
        $('#btnPdfBC').prop('disabled', true);
    }

    // ── Enable download buttons after preview succeeds (BR-44) ───────
    function enableDownloadButtons() {
        previewReady = true;
        if (window.userPermissions && window.userPermissions.canExport) {
            $('#btnExcelBC').prop('disabled', false);
            $('#btnPdfBC').prop('disabled', false);
        }
    }

    // ── Preview report ────────────────────────────────────────────────
    function previewReport() {
        if (!validate()) return;

        var params = buildReportParams();

        // Show preview card with loading state
        $('#reportPreviewCard').show();
        $('#reportPreviewTitle').text('');
        $('#reportPreviewContent').html(
            '<div style="padding:40px;text-align:center;color:#94a3b8;">' +
            '<i class="fas fa-spinner fa-spin fa-2x"></i>' +
            '<p style="margin-top:12px;font-size:14px;">Đang tải dữ liệu...</p>' +
            '</div>'
        );

        // Scroll to preview
        $('html, body').animate({ scrollTop: $('#reportPreviewCard').offset().top - 20 }, 300);

        $.ajax({
            url: '/Complaint/ReportPreview',
            type: 'GET',
            data: params,
            success: function (result) {
                if (result && result.success) {
                    var data = result.data;
                    if (data && data.title) {
                        $('#reportPreviewTitle').text('— ' + data.title);
                    }
                    $('#reportPreviewContent').html(renderPreviewTable(data));
                    enableDownloadButtons();  // BR-44
                } else {
                    var msg = (result && result.message) ? result.message : 'Không thể tải dữ liệu báo cáo.';
                    $('#reportPreviewContent').html(
                        '<div style="padding:32px;text-align:center;color:var(--error,#ef4444);">' +
                        '<i class="fas fa-exclamation-triangle fa-2x"></i>' +
                        '<p style="margin-top:8px;">' + $('<div>').text(msg).html() + '</p>' +
                        '</div>'
                    );
                    resetDownloadButtons();
                }
            },
            error: function (xhr) {
                var msg = 'Không thể kết nối đến máy chủ.';
                if (xhr.status === 400) {
                    try {
                        var err = JSON.parse(xhr.responseText);
                        msg = err.message || msg;
                    } catch (e) { }
                }
                $('#reportPreviewContent').html(
                    '<div style="padding:32px;text-align:center;color:var(--error,#ef4444);">' +
                    '<i class="fas fa-times-circle fa-2x"></i>' +
                    '<p style="margin-top:8px;">' + $('<div>').text(msg).html() + '</p>' +
                    '</div>'
                );
                resetDownloadButtons();
            }
        });
    }

    // ── Download report ───────────────────────────────────────────────
    function downloadReport(format) {
        if (!previewReady) {
            // BR-44: should never reach here via UI, but guard anyway
            toastr.warning('Vui lòng xem trước báo cáo trước khi tải về.');
            return;
        }

        if (!validate()) return;

        var params = buildReportParams();
        params.format = format;

        // Build query string manually
        var qs = Object.keys(params)
            .filter(function (k) { return params[k] !== '' && params[k] != null; })
            .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
            .join('&');

        // Trigger browser download
        window.location.href = '/Complaint/ReportDownload?' + qs;
    }

    // ── Load departments ─────────────────────────────────────────────
    function loadDepartments() {
        $.ajax({
            url: '/MasterData/GetAllDepartments',
            type: 'GET',
            success: function (result) {
                if (result && result.success && result.data) {
                    var $sel = $('#phongBanBC');
                    $.each(result.data, function (i, item) {
                        $sel.append(
                            $('<option>')
                                .val(item.id)
                                .text(item.name)
                        );
                    });
                }
            },
            error: function () {
                // Departments are optional — fail silently
            }
        });
    }

    // ── Bind events ──────────────────────────────────────────────────
    function bindEvents() {
        // Period toggle
        $('#kyBaoCao').on('change', onKyChange);

        // Loại báo cáo change → reset preview
        $('#loaiBaoCao').on('change', function () {
            $('#loaiBCError').hide();
            resetDownloadButtons();
            $('#reportPreviewCard').hide();
        });

        // Xem trước
        $('#btnPreview').on('click', previewReport);

        // Tải Excel
        $('#btnExcelBC').on('click', function () {
            downloadReport('excel');
        });

        // In PDF
        $('#btnPdfBC').on('click', function () {
            downloadReport('pdf');
        });

        // Close preview
        $('#btnClosePreview').on('click', function () {
            $('#reportPreviewCard').hide();
            resetDownloadButtons();
        });

        // Date inputs → reset download
        $('#bcDateFrom, #bcDateTo').on('change', resetDownloadButtons);

        // Any filter change except loaiBaoCao → reset download
        $('#kyBaoCao, #thang, #quy, #namBaoCao, #phongBanBC').on('change', function () {
            resetDownloadButtons();
        });
    }

    // ── Init ─────────────────────────────────────────────────────────
    $(document).ready(function () {
        onKyChange();       // set initial period visibility
        loadDepartments();  // async-load department select
        bindEvents();
    });

})();
