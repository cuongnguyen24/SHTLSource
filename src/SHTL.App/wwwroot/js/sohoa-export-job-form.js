(function () {
    function readInitialFolders() {
        var el = document.getElementById('exportJobFolderInitial');
        if (!el || !el.textContent) return [];
        try { return JSON.parse(el.textContent) || []; } catch (_) { return []; }
    }

    function filterSyncByDocType() {
        var docSel = document.getElementById('docTypeSelect');
        var syncSel = document.getElementById('syncTypeSelect');
        if (!docSel || !syncSel) return;
        var dt = parseInt(docSel.value || '0', 10) || 0;
        syncSel.querySelectorAll('option').forEach(function (opt) {
            if (!opt.value) return;
            var od = parseInt(opt.getAttribute('data-doc-type') || '0', 10) || 0;
            opt.hidden = dt > 0 && od > 0 && od !== dt;
        });
    }

    function escapeAttr(s) {
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '');
    }

    function renderFolderFields(fields, initials) {
        var box = document.getElementById('folderFieldsContainer');
        if (!box) return;
        box.innerHTML = '';
        if (!fields || !fields.length) return;
        fields.forEach(function (f, idx) {
            var val = (initials && initials[idx]) ? initials[idx] : '';
            var wrap = document.createElement('div');
            wrap.className = 'form-group';
            var lab = document.createElement('label');
            var t = f.title || ('Cấp ' + (idx + 1));
            lab.textContent = f.field ? (t + ' → ' + f.field) : t;
            lab.title = f.field
                ? ('Lọc theo giá trị (AXE fieldFolders' + (idx + 1) + '); cột gom nhóm: ' + f.field)
                : '';
            var inp = document.createElement('input');
            inp.type = 'text';
            inp.className = 'form-control input-figma';
            inp.name = 'FolderFields[' + idx + ']';
            inp.value = val;
            wrap.appendChild(lab);
            wrap.appendChild(inp);
            box.appendChild(wrap);
        });
    }

    function loadFolderFields(syncTypeId, initials) {
        var form = document.getElementById('exportJobForm');
        if (!form || !syncTypeId) {
            renderFolderFields([], []);
            return;
        }
        var base = form.getAttribute('data-sync-api');
        var url = base + '?id=' + encodeURIComponent(syncTypeId);
        fetch(url, { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.success && data.fields) renderFolderFields(data.fields, initials || []);
                else renderFolderFields([], []);
            })
            .catch(function () { renderFolderFields([], []); });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var syncSel = document.getElementById('syncTypeSelect');
        var docSel = document.getElementById('docTypeSelect');
        var initials = readInitialFolders();
        var first = true;

        function onSyncChange() {
            var id = syncSel && syncSel.value ? syncSel.value : '';
            loadFolderFields(id, first ? initials : []);
            first = false;
        }

        if (docSel) docSel.addEventListener('change', function () { filterSyncByDocType(); });
        filterSyncByDocType();
        if (syncSel) syncSel.addEventListener('change', onSyncChange);
        onSyncChange();
    });
})();
