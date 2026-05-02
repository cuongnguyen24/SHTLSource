var Utils = {

    isEmpty: function (val) {

        if (typeof val == "object")
            return false;
        if (typeof val == "function")
            return false;

        return val === undefined || jQuery.trim(val).length === 0;
    },

    isInteger: function (val) {

        return !isNaN(val) && !Utils.isEmpty(val);
    },

    parseFlatpickrToISO: function (selector) {
        var el = document.querySelector(selector);
        if (!el) return '';

        if (el._flatpickr && el._flatpickr.selectedDates.length > 0) {
            var d = el._flatpickr.selectedDates[0];
            var year = d.getFullYear();
            var month = ('0' + (d.getMonth() + 1)).slice(-2);
            var day = ('0' + d.getDate()).slice(-2);
            return year + '-' + month + '-' + day;
        }

        // Fallback: parse dd/MM/yyyy thủ công
        var val = (el.value || '').trim();
        var parts = val.split('/');
        if (parts.length === 3) return parts[2] + '-' + parts[1] + '-' + parts[0];

        return val;
    },

    openModal: function (md) {
        let cmodals = jQuery(".modal:visible:not('#" + md.attr("id") + "')");
        if (cmodals.length > 0) {
            // Tạm ẩn các modal đang mở khác
            cmodals.addClass("hide-modal").hide();
        }

        // Khởi tạo và hiển thị modal
        md.modal({
            backdrop: 'static', // Ngăn click ra ngoài để đóng
            keyboard: false,    // (Tùy chọn) Chặn phím Esc nếu không muốn user vô tình tắt
            show: true
        });

        // QUAN TRỌNG: Dùng .off() trước khi .on() 
        // Để tránh việc mỗi lần click mở modal lại đẻ thêm 1 sự kiện hidden mới
        md.off('hidden.bs.modal').on('hidden.bs.modal', function () {
            // Tìm modal đã bị ẩn gần nhất (ưu tiên mở lại theo thứ tự LIFO)
            let hideModal = jQuery(".modal.hide-modal:hidden:last");
            if (hideModal.length > 0) {
                hideModal.removeClass("hide-modal").show();
                // Fix lỗi Bootstrap: Bật lại class modal-open cho body để có thể cuộn chuột
                jQuery('body').addClass('modal-open');
            }
        });

        // Khởi tạo draggable (Yêu cầu phải có thư viện jQuery UI)
        // Lưu ý: Nên target vào .modal-content hoặc .modal-dialog để kéo mượt hơn
        if (typeof jQuery.ui !== 'undefined') {
            md.find('.modal-content').draggable({ handle: '.modal-header' });
        }
    },

    confirmAjaxAction: function (title, text, confirmText, cancelText, onSuccessCallback) {
        Swal.fire({
            title: title || 'Bạn có chắc chắn?',
            text: text || 'Hành động này không thể hoàn tác!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: '<i class="fas fa-trash"></i>' + (confirmText || 'Xóa'),
            cancelButtonText: cancelText || 'Hủy bỏ',
            showLoaderOnConfirm: true,
            preConfirm: () => {
                return $.ajax({
                    url: url,
                    type: 'POST',
                    data: postData,
                    // Nếu dùng .NET Anti-forgery token, bỏ comment bên dưới:
                    headers: { "RequestVerificationToken": $('input[name="__RequestVerificationToken"]').val() }
                }).catch(error => {
                    Swal.showValidationMessage(`Lỗi kết nối máy chủ: ${error.status} - ${error.statusText}`);
                });
            },
            allowOutsideClick: () => !Swal.isLoading()
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                let response = result.value;
                if (response.success) {
                    AppCommon.notify(response.message || 'Xử lý thành công!');
                    // Gọi callback nếu có truyền vào
                    if (onSuccessCallback && typeof onSuccessCallback === 'function') {
                        onSuccessCallback(response);
                    }
                } else {
                    Swal.fire('Thất bại!', response.message || 'Đã có lỗi xảy ra từ máy chủ.', 'error');
                }
            }
        });
    },

    confirmAction: function (title, text, confirmText, cancelText, callbackFunc, isDangerAction = true) {
        // Nếu là hành động nguy hiểm (Xóa/Hủy) -> Nút đỏ, icon thùng rác
        // Nếu là hành động bình thường (Duyệt/Lưu) -> Nút xanh, icon check
        let confirmBtnClass = isDangerAction ? 'btn-figma btn-figma-destructive m-1' : 'btn-figma btn-figma-outline m-1';
        let confirmIcon = isDangerAction ? 'fa-trash' : 'fa-check';
        let color = isDangerAction ? '#FF0000' : '#1B4F8A';

        let bodyHtml = `
            <div>${title}<b>${text}</b></div>
            <div class="text-danger mt-3">
                <i class="fas fa-info-circle"></i> Hành động này không thể hoàn tác!
            </div>
        `;

        Swal.fire({
            title: `<div style="color:${color} !important"><i class="fas fa-exclamation-triangle mr-2"></i> Xác nhận</div>`,
            html: bodyHtml,
            showCancelButton: true,
            buttonsStyling: false,
            reverseButtons: true,
            focusConfirm: !isDangerAction, // Focus confirm nếu an toàn, bỏ focus nếu nguy hiểm
            focusCancel: isDangerAction,
            showCloseButton: true,
            confirmButtonText: `<i class="fas ${confirmIcon}"></i> ` + (confirmText || 'Xác nhận'),
            cancelButtonText: `<i class="fas fa-times"></i> ` + (cancelText || 'Đóng'),
            customClass: {
                confirmButton: confirmBtnClass,
                cancelButton: 'btn-figma btn-figma-outline m-1',
                popup: 'modal-draggable' // Mở comment nếu bạn đã setup jQuery UI draggable
            }
        }).then((res) => {
            // Sử dụng isConfirmed thay cho value
            if (res.isConfirmed) {
                if (typeof callbackFunc === "function") {
                    callbackFunc();
                }
            }
        });
    },

    initSelect2: function (selector) {
        if (selector == undefined)
            selector = jQuery(document);

        selector.find('select.select2').each(function () {
            var $this = $(this);
            $this.select2({
                theme: 'bootstrap4',
                width: '100%',
                placeholder: $this.data('placeholder') || '-- Chọn giá trị --',
                allowClear: true,
                language: {
                    noResults: function () { return "Không tìm thấy kết quả"; }
                }
            });
        });
    },

    formBuilderQString: function (form, fdata) {
        let data = {};
        form.find("input, select, textarea, button").each(function () {
            let el = jQuery(this);
            let name = el.prop("name");
            if (!Utils.isEmpty(name)) {
                let tagName = el.prop("tagName").toLowerCase();
                if (tagName == "input") {
                    let type = el.prop("type").toLowerCase();
                    if (type == "text" || type == "password" || type == "hidden" || type == "number") {
                        if (!data.hasOwnProperty(name)) {
                            data[name] = [];
                        }
                        if (!Utils.isEmpty(el.val()))
                            el.val(el.val().trim());
                        data[name].push(el.val());
                    } else if (type == "checkbox") {
                        if (!data.hasOwnProperty(name)) {
                            data[name] = [];
                        }
                        if (el.prop("checked")) {
                            data[name].push(el.val());
                        }
                        else {
                            data[name].push(0);
                        }
                    } else if (type == "radio") {
                        if (!data.hasOwnProperty(name)) {
                            data[name] = [];
                        }
                        if (el.prop("checked")) {
                            data[name].push(el.val());
                        }
                    }
                }
                else if (tagName == "select") {
                    if (!Utils.isEmpty(el.val())) {
                        if (parseInt(el.val()) > -1 || el.val().indexOf(",") > -1) {
                            data[name] = [];
                            data[name].push(el.val());
                        } else {
                            if (!data.hasOwnProperty(name)) {
                                data[name] = [];
                            }
                            data[name].push(el.val());
                        }
                    }
                }
                else if (tagName != "button") {
                    if (!data.hasOwnProperty(name)) {
                        data[name] = [];
                    }
                    data[name].push(el.val());
                }
            }
        });
        for (let k in data) {
            let vals = data[k];
            if (vals.length == 1) {
                data[k] = vals.join(",");
            } else {
                data[k] = JSON.stringify(vals);
            }
        }
        if (fdata != undefined) {
            //add paging params
            if (fdata["pageNumber"])
                data["pageNumber"] = fdata["pageNumber"];
            if (fdata["pageSize"])
                data["pageSize"] = fdata["pageSize"];
        }

        let queries = [];
        for (let i in data) {
            if (i == "__RequestVerificationToken")
                continue;
            if (!Utils.isEmpty(data[i])) {
                queries.push(i + "=" + data[i]);
            }
        }
        return ("?" + queries.join("&"));
    },

    getSerialize: function (form) {
        let keys = {};

        // 1. Tối ưu selector: Chỉ lấy các thẻ có thuộc tính name
        form.find("input[name], select[name], textarea[name]").each(function () {
            let el = jQuery(this);
            let name = el.prop("name");

            // Bỏ qua các field bị disabled (Chuẩn HTML form)
            if (el.is(':disabled')) return;

            let tagName = el.prop("tagName").toLowerCase();
            let type = el.prop("type") ? el.prop("type").toLowerCase() : "";
            let value = el.val();

            if (!keys[name]) {
                keys[name] = [];
            }

            if (tagName === "input") {
                const textTypes = ["text", "password", "hidden", "number", "search", "email"];

                if (textTypes.includes(type)) {
                    // Trim value nếu là chuỗi hợp lệ
                    value = (typeof value === "string" && value.trim() !== "") ? value.trim() : value;
                    keys[name].push(value);
                }
                else if (type === "checkbox") {
                    // Sửa lỗi chính: Chỉ push dữ liệu khi checkbox được check
                    if (el.prop("checked")) {
                        keys[name].push(value === 'on' ? 1 : value);
                    }
                }
                else if (type === "radio") {
                    if (el.prop("checked")) {
                        keys[name].push(value);
                    }
                }
            } else {
                // Xử lý cho select và textarea
                keys[name].push(value);
            }
        });

        // 2. Xử lý format lại object trả về
        let result = {};
        for (let k in keys) {
            let vals = keys[k];

            // Nếu mảng rỗng (ví dụ checkbox không check và không có hidden field đi kèm), thì bỏ qua
            if (vals.length === 0) continue;

            // Xử lý xung đột thẻ Hidden và Checkbox:
            // Nếu vừa có hidden value là "false", vừa có checkbox được check (true/1) 
            // -> Ta lọc bỏ "false" đi để tránh bị mảng ["false", "1"]
            if (vals.length > 1 && vals.includes("false")) {
                vals = vals.filter(v => v !== "false");
            }

            if (vals.length === 1) {
                result[k] = vals[0]; // Trả về chuỗi trực tiếp thay vì join(",") để tránh sai lệch dữ liệu
            } else {
                result[k] = JSON.stringify(vals);
            }
        }

        return result;
    },

    CustAjaxCall: function (data, method, url, datatype, ssCallBack, errCallback, contentType = "application/x-www-form-urlencoded") {

        let requestMethod = (method || 'POST').toUpperCase();
        let isGetMethod = requestMethod === 'GET';

        const ajaxConfig = {
            async: true,
            data: data,
            type: method,
            url: url,
            contentType: isGetMethod ? false : contentType,
            headers: { "RequestVerificationToken": $('input[name="__RequestVerificationToken"]').val() },
            beforeSend: function () {
                Utils.toggleLoading(true);
            }
        };

        if (datatype) {
            ajaxConfig.dataType = datatype;
        }

        $.ajax(ajaxConfig).done(function (data) {
            if (typeof ssCallBack === "function") {
                ssCallBack(data);
            }
        }).fail(function (jqXHR, textStatus, errorThrown) {
            console.error('AJAX Error:', textStatus, errorThrown);

            // Thay thế alert() bằng SweetAlert2 hoặc Toast
            if (typeof Swal !== 'undefined') {
                Swal.fire('Lỗi máy chủ', 'Không thể kết nối đến hệ thống. Vui lòng thử lại sau!', 'error');
            }

            if (typeof errCallback === "function") {
                errCallback(jqXHR, textStatus, errorThrown); // Truyền thêm param để log lỗi chi tiết nếu cần
            }
        }).always(function () {
            Utils.toggleLoading(false);
        });
    },

    renderSelect2Ajax: function (container) {
        var select2s = container.find(".select2-ajax");
        if (select2s.length > 0) {
            select2s.each(function () {
                var self = jQuery(this);
                if (!self.hasClass("select2-hidden-accessible")) {
                    Utils.initSelect2Ajax(self);
                }
            });
        }
    },

    initSelect2Ajax: function (select2) {
        let self = select2;
        let url = self.attr("data-url");
        let selectedValue = self.attr("data-selected-value");
        let placeholderText = self.attr("data-placeholder");
        let isMultiple = self.attr("multiple");

        // Bắt buộc phải có URL mới khởi tạo
        if (!url) {
            return;
        }

        var config = {
            //delay: 150,
            url: url,
            method: 'GET',
            dataType: 'json',
            data: function (params) {
                // 1. Khởi tạo các tham số cơ bản gửi lên API
                var query = {};
                if (params.term) {
                    query.keyword = params.term
                }

                return query;
            },
            processResults: function (data) {
                var sources = [];

                // Kiểm tra xem API có trả về dữ liệu chuẩn không
                if (data && data.categories) {
                    sources = data.categories;

                    // Thêm tùy chọn rỗng (Placeholder) lên đầu nếu là ô chọn 1
                    if (!isMultiple && !sources.some(n => n.ID == 0 || n.id == 0)) {
                        let fieldTitle = self.attr('title') || self.attr('data-placeholder');
                        //if (fieldTitle) {
                        //    sources.unshift({ ID: ' ', Name: `${fieldTitle}` });
                        //}
                    }

                    // Chuẩn hóa dữ liệu sang định dạng {id, text} của Select2
                    if (sources.length > 0) {
                        sources = sources.map(s => {
                            var res = {
                                id: s.ID !== undefined ? s.ID : s.id,
                                text: s.Name || s.name || s.text
                            };

                            // Trích xuất thêm các thuộc tính phụ (nếu có cấu hình optionMapperValues)
                            // Hỗ trợ cả PascalCase (s.Attribute) và camelCase (s.attribute) từ JSON response
                            var sAttr = s.Attribute || s.attribute;
                            if (sAttr && typeof optionMapperValues !== 'undefined' && optionMapperValues.length > 0) {
                                let attrLower = {};
                                // Đưa key của Attribute về chữ thường để dễ so sánh
                                for (let key in sAttr) {
                                    attrLower[key.toLowerCase()] = sAttr[key];
                                }

                                optionMapperValues.forEach(t => {
                                    let keyLower = t.toLowerCase();
                                    res[keyLower] = attrLower[keyLower] || "";
                                });
                            }
                            return res;
                        });
                    }
                }

                return {
                    results: sources,
                    pagination: {
                        more: false // Báo cho Select2 biết là không còn trang nào nữa để dừng hẳn trạng thái loading
                    }
                };
            }
        };

        var configS = {
            theme: 'bootstrap4',
            ajax: config,
            placeholder: placeholderText,
            language: 'vi',
            closeOnSelect: !isMultiple,
            allowClear: true,
            templateResult: function (dataRow) {
                if (dataRow.loading) return dataRow.text;

                // Render thẻ option kèm các attribute tùy chỉnh (đã bọc thêm dấu ngoặc kép cho HTML chuẩn)
                const textFormat = Object.entries(dataRow)
                    .filter(([key]) => key !== 'id' && key !== 'text') // Bỏ qua id và text để thẻ HTML gọn hơn
                    .map(([key, value]) => `${key}="${value}"`)
                    .join(' ');

                return dataRow.text;
            }
        };

        // Khởi chạy Select2
        self.select2(configS);

        // Load giá trị mặc định khi có data-selected-value
        if (selectedValue && selectedValue !== "") {
            if (self.find("option[value='" + selectedValue + "']").length === 0) {

                jQuery.ajax({
                    type: "GET",
                    url: url,
                    data: { id: selectedValue },
                    dataType: "json"
                }).then(function (data) {
                    if (data && data.category) {
                        let item = data.category;
                        let displayText = item.text || item.name || item.title;
                        if (displayText) {
                            self.empty();
                            let realOption = new Option(displayText, selectedValue, true, true);
                            self.append(realOption).trigger('change');
                        }
                    }
                });
            } else {
                self.val(selectedValue).trigger('change');
            }
        }
    },

    initDatetimePicker: function (container) {
        // Đảm bảo thư viện đã được load
        if (typeof $.datetimepicker === 'undefined') {
            console.warn('jQuery datetimepicker is not loaded.');
            return;
        }

        $.datetimepicker.setLocale('vi');

        // Thêm tham số 'index' để tạo ID duy nhất
        container.find(".date").each(function (index) {
            var $el = jQuery(this); // Cache lại jQuery object để tăng hiệu năng
            var id = $el.attr("id");

            $el.attr("autocomplete", "off");

            if (Utils.isEmpty(id)) {
                // Nối thêm index để đảm bảo ID không bao giờ bị trùng
                id = "IDate_" + (new Date()).getTime() + "_" + index;
                $el.attr("id", id);
            }

            var config = {
                timepicker: false,
                enableOnReadonly: false,
                format: "d-m-Y",
                lang: "vi",
                scrollInput: false
            };

            // Xử lý minDate / maxDate
            if ($el.hasClass("nowToFuture")) {
                config.minDate = Utils.addDays(Date.now(), 1);
            } else if ($el.hasClass("todayToFuture")) {
                config.minDate = Utils.addDays(Date.now(), 0);
            }

            // Đảm bảo data-min và data-max trên HTML phải là định dạng chuẩn (ví dụ: YYYY/MM/DD)
            var dataMin = $el.attr("data-min");
            if (dataMin) {
                config.minDate = new Date(dataMin);
            }

            var dataMax = $el.attr("data-max");
            if (dataMax) {
                config.maxDate = new Date(dataMax);
            }

            try {
                $el.datetimepicker('destroy');
            } catch (e) {
            }

            // Khởi tạo datetimepicker
            $el.datetimepicker(config);
        });
    },

    initDatePickerFlat: function (container) {
        // 1. Kiểm tra xem thư viện đã load chưa
        if (typeof flatpickr === 'undefined') {
            console.warn('Thư viện Flatpickr chưa được tải!');
            return;
        }

        // 2. Xác định ngôn ngữ tiếng Việt
        const locale = (flatpickr.l10ns && flatpickr.l10ns.vn) ? flatpickr.l10ns.vn : 'default';

        // 3. Xử lý đầu vào container thông minh (Hỗ trợ DOM thuần, jQuery Object hoặc String)
        container = container || document;
        let rootElement;

        if (typeof container === 'string') {
            rootElement = document.querySelector(container);
        } else if (window.jQuery && container instanceof jQuery) {
            rootElement = container[0]; // Rút phần tử DOM thuần từ jQuery object
        } else {
            rootElement = container;
        }

        // Thoát nếu không tìm thấy vùng chứa
        if (!rootElement) return;

        // 4. Tìm tất cả thẻ input cần gắn lịch
        const elements = rootElement.querySelectorAll('.date, input[type="date"]');

        // 5. Khởi tạo Flatpickr
        elements.forEach(function (el) {
            // 🔴 QUAN TRỌNG: Hủy instance cũ trước khi tạo mới để chống rò rỉ bộ nhớ (Modal/Ajax)
            if (el._flatpickr) {
                el._flatpickr.destroy();
            }

            // Cấu hình mặc định
            let config = {
                locale: locale,
                dateFormat: 'Y-m-d',
                allowInput: true,
                altInput: true,
                altFormat: "d/m/Y",
                disableMobile: true
            };

            // Kế thừa logic giới hạn ngày (min/max date)
            if (el.classList.contains("nowToFuture")) {
                let tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                config.minDate = tomorrow;
            } else if (el.classList.contains("todayToFuture")) {
                config.minDate = "today";
            }

            const dataMin = el.getAttribute("data-min");
            if (dataMin) config.minDate = dataMin;

            const dataMax = el.getAttribute("data-max");
            if (dataMax) config.maxDate = dataMax;

            // Kích hoạt Flatpickr
            flatpickr(el, config);
        });
    },

    toggleLoading: function (show, $container) {
        var overlayClass = 'utils-loading-overlay';

        if (!show) {
            // Hide: remove overlay from container or body
            if ($container && $container.length) {
                $container.find('.' + overlayClass).remove();
                $container.css('position', '');
            } else {
                jQuery('body > .' + overlayClass).remove();
            }
            return;
        }

        // Show: build overlay HTML
        var html = '<div class="' + overlayClass + '" style="'
            + 'position:absolute; top:0; left:0; right:0; bottom:0;'
            + 'background:rgba(255,255,255,0.7); z-index:1050;'
            + 'display:flex; align-items:center; justify-content:center;'
            + '">'
            + '<div style="text-align:center;">'
            + '<i class="fas fa-spinner fa-spin" style="font-size:28px; color:#3b82f6;"></i>'
            + '<div style="font-size:13px; color:#64748b; margin-top:8px;">Đang tải dữ liệu...</div>'
            + '</div></div>';

        if ($container && $container.length) {
            // Remove existing overlay in this container first
            $container.find('.' + overlayClass).remove();
            // Ensure container has relative/absolute positioning for overlay
            if ($container.css('position') === 'static') {
                $container.css('position', 'relative');
            }
            $container.append(html);
        } else {
            // Full-screen: append to body with fixed positioning
            jQuery('body > .' + overlayClass).remove();
            var $overlay = jQuery(html).css('position', 'fixed');
            jQuery('body').append($overlay);
        }
    }
};