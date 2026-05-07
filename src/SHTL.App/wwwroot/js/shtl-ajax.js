/**
 * AJAX helpers: antiforgery header cho POST JSON (MVC ValidateAntiForgeryToken).
 */
(function (window, document) {
    'use strict';

    window.ShtlAjax = window.ShtlAjax || {};

    /** Lấy token từ hidden __RequestVerificationToken (Razor form) hoặc meta. */
    window.ShtlAjax.getRequestVerificationToken = function () {
        var input = document.querySelector('input[name="__RequestVerificationToken"]');
        if (input && input.value) return input.value;
        var meta = document.querySelector('meta[name="__RequestVerificationToken"]');
        return meta ? meta.getAttribute('content') : '';
    };

    /**
     * POST JSON kèm header RequestVerificationToken (cấu hình trong Program.cs).
     */
    window.ShtlAjax.postJson = function (url, body) {
        var token = window.ShtlAjax.getRequestVerificationToken();
        var headers = { 'Content-Type': 'application/json' };
        if (token) headers['RequestVerificationToken'] = token;
        return fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: headers,
            body: JSON.stringify(body || {})
        });
    };
})(window, document);
