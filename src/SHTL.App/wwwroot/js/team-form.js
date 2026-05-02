// Team Form JavaScript
// Handles Select2 initialization and form submission with Figma styling

$(document).ready(function () {
    // Initialize Select2 for user selection
    $('#userSelect').select2({
        theme: 'bootstrap',
        placeholder: 'Chọn thành viên...',
        allowClear: true,
        width: '100%'
    });

    // Initialize Select2 for role selection
    $('#roleSelect').select2({
        theme: 'bootstrap',
        placeholder: 'Chọn vai trò...',
        allowClear: true,
        width: '100%'
    });

    // Update hidden fields when user selection changes
    $('#userSelect').on('change', function () {
        const selectedValues = $(this).val() || [];
        $('#selectedUsersContainer').empty();
        selectedValues.forEach(function (userId) {
            $('#selectedUsersContainer').append(
                '<input type="hidden" name="SelectedUserIds" value="' + userId + '" />'
            );
        });
    });

    // Update hidden fields when role selection changes
    $('#roleSelect').on('change', function () {
        const selectedValues = $(this).val() || [];
        $('#selectedRolesContainer').empty();
        selectedValues.forEach(function (roleId) {
            $('#selectedRolesContainer').append(
                '<input type="hidden" name="SelectedRoleIds" value="' + roleId + '" />'
            );
        });
    });

    // Form validation and submission
    const $form = $('form[data-has-custom-submit="true"]');
    const $submitBtn = $('#btnSubmit');

    $form.on('submit', function (e) {
        if (!$form.valid()) {
            return false;
        }

        $submitBtn.prop('disabled', true);
        const originalHtml = $submitBtn.html();
        $submitBtn.html('<i class="fas fa-spinner fa-spin mr-1"></i> Đang xử lý...');

        // Re-enable in case of AJAX fail (if handled via AJAX) 
        // Note: For regular form submisson, this isn't strictly necessary as the page will redirect,
        // but it's good for UI consistency if something goes wrong.
        setTimeout(function () {
            if ($submitBtn.prop('disabled')) {
                $submitBtn.prop('disabled', false).html(originalHtml);
            }
        }, 5000);
    });

    // Custom validation and auto-format for Code
    const $codeInput = $('#Code');
    if ($codeInput.length) {
        $codeInput.on('input', function () {
            const cursorPos = this.selectionStart;
            const value = $(this).val().toUpperCase().replace(/[^A-Z0-9_]/g, '');
            $(this).val(value);
            this.setSelectionRange(cursorPos, cursorPos);
        });

        $codeInput.on('blur', function () {
            const value = $(this).val().trim();
            if (value && value.length < 3) {
                $(this).addClass('is-invalid');
            } else {
                $(this).removeClass('is-invalid');
            }
        });
    }

    // Character counter for description
    const $descriptionTextarea = $('#Description');
    if ($descriptionTextarea.length) {
        const maxLength = 1000;
        $descriptionTextarea.after(
            '<div class="mt-1 text-right" style="font-size: 11px; color: #94a3b8;" id="descriptionCounter">0 / ' + maxLength + ' ký tự</div>'
        );

        $descriptionTextarea.on('input', function () {
            const length = $(this).val().length;
            $('#descriptionCounter').text(length + ' / ' + maxLength + ' ký tự');
            if (length > maxLength) {
                $('#descriptionCounter').css('color', '#dc2626');
            } else {
                $('#descriptionCounter').css('color', '#94a3b8');
            }
        });
        $descriptionTextarea.trigger('input');
    }

    // Enhanced validation UI
    if ($.validator) {
        $.validator.setDefaults({
            highlight: function (element) {
                $(element).addClass('is-invalid');
            },
            unhighlight: function (element) {
                $(element).removeClass('is-invalid');
            },
            errorElement: 'span',
            errorClass: 'text-danger',
            errorPlacement: function (error, element) {
                error.css('font-size', '11px');
                if (element.parent('.input-group').length || element.hasClass('select2-hidden-accessible')) {
                    error.insertAfter(element.parent());
                } else {
                    error.insertAfter(element);
                }
            }
        });
    }
});
