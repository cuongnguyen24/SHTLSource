/**
 * BaoCaoTHSDLD — Create/Edit form module
 * M0086 — Dynamic rows, BR-01/BR-02/BR-03 validation, KhongSuDungLDNN toggle
 */
(function ($) {
    'use strict';

    var rowIndex = 0;

    var LoaiCVOptions = [
        { value: 'QuanLy', label: 'Nhà quản lý' },
        { value: 'ChuyenGia', label: 'Chuyên gia' },
        { value: 'KyThuat', label: 'Lao động kỹ thuật' },
        { value: 'PhoBinh', label: 'Lao động phổ thông' }
    ];

    var Module = {

        init: function () {
            this.initLDNNToggle();
            this.initBRValidation();
            this.initDynamicRows();
            this.initFileUpload();
        },

        // ─── LĐNN Toggle ────────────────────────────────────────────────────

        initLDNNToggle: function () {
            var $check = $('#khongSuDungLDNN');
            var $section = $('#ldnnSection');

            function toggle(isChecked) {
                if (isChecked) {
                    $section.removeClass('visible');
                    // Reset LĐNN values
                    $('#tongLDNN').val(0);
                    $('[name="LDNNNu"], [name="LDNNCoGPLD"], [name="LDNNKhongDienCap"]').val(0);
                    $('#tblQuocTichBody, #tblLoaiCVBody').empty();
                } else {
                    $section.addClass('visible');
                }
            }

            $check.on('change', function () { toggle(this.checked); });
            // Initial state — only show if not already checked
            toggle($check.is(':checked'));
        },

        // ─── BR Validation ───────────────────────────────────────────────────

        initBRValidation: function () {
            var self = this;

            // BR-01: LDNam + LDNu = TongLDTrongNuoc
            function checkBR01() {
                var tong = parseInt($('#tongLDTrongNuoc').val()) || 0;
                var nam = parseInt($('#ldNam').val()) || 0;
                var nu = parseInt($('#ldNu').val()) || 0;
                var $warning = $('#brBalance');
                if (nam + nu !== tong && (nam > 0 || nu > 0)) {
                    $('#brBalanceMsg').text('Lao động nam (' + nam + ') + Lao động nữ (' + nu + ') ≠ Tổng LĐ trong nước (' + tong + ')');
                    $warning.addClass('visible');
                } else {
                    $warning.removeClass('visible');
                }
            }

            // BR-02: LDNNCoGPLD + LDNNKhongDienCap = TongLDNN
            function checkBR02() {
                var tong = parseInt($('#tongLDNN').val()) || 0;
                var gpld = parseInt($('#ldnnCoGPLD').val()) || 0;
                var khongCap = parseInt($('#ldnnKhongDienCap').val()) || 0;
                var $warning = $('#brGPLDBR02');
                if (tong > 0 && gpld + khongCap !== tong) {
                    $warning.addClass('visible');
                } else {
                    $warning.removeClass('visible');
                }
            }

            // BR-03: sum of QuocTich rows = TongLDNN
            Module.checkBR03QuocTich = function () {
                var tong = parseInt($('#tongLDNN').val()) || 0;
                var sum = 0;
                $('#tblQuocTichBody .row-soluong').each(function () {
                    sum += parseInt($(this).val()) || 0;
                });
                var $warning = $('#brQuocTich03');
                if (sum > 0 && tong > 0 && sum !== tong) {
                    $warning.addClass('visible');
                } else {
                    $warning.removeClass('visible');
                }
            };

            // BR-03: sum of LoaiCV rows = TongLDNN
            Module.checkBR03LoaiCV = function () {
                var tong = parseInt($('#tongLDNN').val()) || 0;
                var sum = 0;
                $('#tblLoaiCVBody .row-soluong').each(function () {
                    sum += parseInt($(this).val()) || 0;
                });
                var $warning = $('#brLoaiCV03');
                if (sum > 0 && tong > 0 && sum !== tong) {
                    $warning.addClass('visible');
                } else {
                    $warning.removeClass('visible');
                }
            };

            $('#tongLDTrongNuoc, #ldNam, #ldNu').on('input', checkBR01);
            $('#tongLDNN, #ldnnCoGPLD, #ldnnKhongDienCap').on('input', function () {
                checkBR02();
                Module.checkBR03QuocTich();
                Module.checkBR03LoaiCV();
            });
        },

        // ─── Dynamic Rows ────────────────────────────────────────────────────

        initDynamicRows: function () {
            var self = this;

            // Add QuocTich row
            $('#btnAddQuocTich').on('click', function () {
                self.addQuocTichRow('', 0);
            });

            // Add LoaiCV row
            $('#btnAddLoaiCV').on('click', function () {
                self.addLoaiCVRow('', 0);
            });

            // Delete row (delegated)
            $(document).on('click', '.btn-remove-row', function () {
                $(this).closest('tr').remove();
                if (typeof Module.checkBR03QuocTich === 'function') Module.checkBR03QuocTich();
                if (typeof Module.checkBR03LoaiCV === 'function') Module.checkBR03LoaiCV();
            });
        },

        addQuocTichRow: function (quocTich, soLuong) {
            var idx = rowIndex++;
            var row = '<tr>' +
                '<td><input type="text" name="LDNNQuocTichs[' + idx + '].QuocTich" class="form-control form-control-sm" value="' + quocTich + '" placeholder="VD: Trung Quốc, Nhật Bản..." required /></td>' +
                '<td class="text-center"><input type="number" name="LDNNQuocTichs[' + idx + '].SoLuong" class="form-control form-control-sm number-input row-soluong text-center" min="0" value="' + soLuong + '" /></td>' +
                '<td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger btn-remove-row" style="width:26px;height:26px;padding:0;"><i class="fas fa-times" style="font-size:10px;"></i></button></td>' +
                '</tr>';
            $('#tblQuocTichBody').append(row);
            $('#tblQuocTichBody .row-soluong').last().on('input', function () {
                Module.checkBR03QuocTich();
            });
        },

        addLoaiCVRow: function (loai, soLuong) {
            var idx = rowIndex++;
            var options = LoaiCVOptions.map(function (o) {
                return '<option value="' + o.value + '"' + (o.value === loai ? ' selected' : '') + '>' + o.label + '</option>';
            }).join('');

            var row = '<tr>' +
                '<td><select name="LDNNLoaiCongViecs[' + idx + '].NhomCongViec" class="form-control form-control-sm"><option value="">-- Chọn --</option>' + options + '</select></td>' +
                '<td class="text-center"><input type="number" name="LDNNLoaiCongViecs[' + idx + '].SoLuong" class="form-control form-control-sm number-input row-soluong text-center" min="0" value="' + soLuong + '" /></td>' +
                '<td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger btn-remove-row" style="width:26px;height:26px;padding:0;"><i class="fas fa-times" style="font-size:10px;"></i></button></td>' +
                '</tr>';
            $('#tblLoaiCVBody').append(row);
            $('#tblLoaiCVBody .row-soluong').last().on('input', function () {
                Module.checkBR03LoaiCV();
            });
        },

        // ─── File Upload Preview ──────────────────────────────────────────────

        initFileUpload: function () {
            Module.setupFileZone(
                '#scanVanBanGocFileInput',
                '#scanVanBanGocFileQueue',
                '#scanVanBanGocUploadZone',
                '#scanVanBanGocError',
                10 * 1024 * 1024
            );
            Module.setupFileZone(
                '#fileBaoCaoDinhKemInput',
                '#fileBaoCaoDinhKemQueue',
                '#fileBaoCaoDinhKemUploadZone',
                null,
                10 * 1024 * 1024
            );
        },

        setupFileZone: function (inputSel, queueSel, zoneSel, errorSel, maxBytes) {
            var $input = $(inputSel);
            var $queue = $(queueSel);
            var $zone = $(zoneSel);

            if (!$input.length) return;

            // Drag-and-drop highlight
            $zone.on('dragover', function (e) {
                e.preventDefault();
                $zone.css('background', '#f0f7ff');
            }).on('dragleave drop', function (e) {
                e.preventDefault();
                $zone.css('background', '#fff');
            }).on('drop', function (e) {
                var dt = e.originalEvent.dataTransfer;
                if (dt && dt.files.length) {
                    Module.renderFileQueue($input[0], $queue, maxBytes, errorSel, dt.files);
                }
            });

            $input.on('change', function () {
                Module.renderFileQueue(this, $queue, maxBytes, errorSel, this.files);
            });
        },

        renderFileQueue: function (inputEl, $queue, maxBytes, errorSel, fileList) {
            $queue.empty();
            if (errorSel) $(errorSel).hide();

            if (!fileList || fileList.length === 0) return;

            var $list = $('<ul class="list-unstyled mb-0 mt-2"></ul>');
            var overLimit = false;

            for (var i = 0; i < fileList.length; i++) {
                var f = fileList[i];
                var sizeKb = (f.size / 1024).toFixed(0);
                var icon = f.type === 'application/pdf' ? 'fa-file-pdf text-danger' : 'fa-file-alt text-primary';
                var over = maxBytes && f.size > maxBytes;
                if (over) overLimit = true;

                var $item = $(
                    '<li class="d-flex align-items-center py-1" style="font-size:12px;gap:8px;border-bottom:1px solid #f1f5f9;">' +
                    '<i class="fas ' + icon + '" style="font-size:14px;flex-shrink:0;"></i>' +
                    '<span class="text-truncate flex-grow-1">' + $('<span>').text(f.name).html() + '</span>' +
                    '<span class="text-muted ml-2" style="white-space:nowrap;">' + sizeKb + ' KB</span>' +
                    (over ? '<span class="badge badge-danger ml-2">Quá dung lượng</span>' : '') +
                    '</li>'
                );
                $list.append($item);
            }

            $queue.append($list);

            if (overLimit && errorSel) {
                $(errorSel).text('Một hoặc nhiều tệp vượt quá 10 MB.').show();
            }
        }
    };

    // Pre-populate existing rows on Edit page (data injected by Razor)
        Module.loadExistingRows = function () {
            if (typeof existingQuocTichs !== 'undefined' && Array.isArray(existingQuocTichs)) {
                existingQuocTichs.forEach(function (item) {
                    Module.addQuocTichRow(item.quocTich || item.QuocTich || '', item.soLuong || item.SoLuong || 0);
                });
            }
            if (typeof existingLoaiCVs !== 'undefined' && Array.isArray(existingLoaiCVs)) {
                existingLoaiCVs.forEach(function (item) {
                    Module.addLoaiCVRow(item.nhomCongViec || item.NhomCongViec || '', item.soLuong || item.SoLuong || 0);
                });
            }
        };

        $(document).ready(function () {
            Module.init();
            Module.loadExistingRows();
        });

})(jQuery);
