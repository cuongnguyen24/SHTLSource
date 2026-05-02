// SHTL - Site JS

// Anti-forgery token helper
function getToken() {
    return document.querySelector('input[name="__RequestVerificationToken"]')?.value
        || document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
}

// Toast notifications (uses Bootstrap toast if available, else alert)
function showToast(type, message) {
    // Simple implementation - extend with Bootstrap toasts as needed
    const alertClass = type === 'success' ? 'alert-success'
        : type === 'error' ? 'alert-danger'
        : type === 'warning' ? 'alert-warning'
        : 'alert-info';

    const container = document.getElementById('toast-container') || createToastContainer();
    const div = document.createElement('div');
    div.className = `alert ${alertClass} alert-dismissible fade show`;
    div.innerHTML = `${message}<button type="button" class="close" data-dismiss="alert" aria-label="Đóng"><span aria-hidden="true">&times;</span></button>`;
    container.appendChild(div);

    setTimeout(() => div.remove(), 5000);
}

function createToastContainer() {
    const div = document.createElement('div');
    div.id = 'toast-container';
    div.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999;min-width:280px;';
    document.body.appendChild(div);
    return div;
}

// Confirm delete helper
function confirmAction(message, callback) {
    if (confirm(message)) callback();
}

// POST JSON helper
async function postJson(url, data) {
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'RequestVerificationToken': getToken()
        },
        body: JSON.stringify(data)
    });
    return await resp.json();
}

// Format date
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
