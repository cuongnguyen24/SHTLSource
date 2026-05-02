/**
 * Handsontable: loading / empty / read-only grid (đồng bộ style Figma).
 * CDN: handsontable.full.min.js + CSS (load từ view qua section Scripts).
 */
(function (window) {
    'use strict';

    window.ShtlHot = window.ShtlHot || {};

    /**
     * @param {string} containerId - div chứa Handsontable
     * @param {HTMLElement|null} loadingEl
     * @param {HTMLElement|null} emptyEl
     * @param {object[]} columns - Handsontable column settings
     * @param {object[]} data - rows
     * @param {object} [opts] - readOnly, height, stretchH
     */
    window.ShtlHot.initReadOnly = function (containerId, loadingEl, emptyEl, columns, data, opts) {
        opts = opts || {};
        var el = document.getElementById(containerId);
        if (!el || typeof Handsontable === 'undefined') {
            if (loadingEl) loadingEl.classList.add('d-none');
            return null;
        }
        if (loadingEl) loadingEl.classList.add('d-none');

        if (!data || data.length === 0) {
            if (emptyEl) emptyEl.classList.remove('d-none');
            el.classList.add('d-none');
            return null;
        }
        if (emptyEl) emptyEl.classList.add('d-none');
        el.classList.remove('d-none');

        return new Handsontable(el, {
            data: data,
            columns: columns,
            colHeaders: columns.map(function (c) { return c.title || c.data || ''; }),
            rowHeaders: true,
            readOnly: opts.readOnly !== false,
            licenseKey: 'non-commercial-and-evaluation',
            height: opts.height || 420,
            stretchH: opts.stretchH || 'all',
            manualColumnResize: true,
            wordWrap: false,
            className: 'htFigma',
            afterGetColHeader: function (col, TH) {
                TH.style.fontWeight = '600';
                TH.style.fontSize = '12px';
            }
        });
    };
})(window);
