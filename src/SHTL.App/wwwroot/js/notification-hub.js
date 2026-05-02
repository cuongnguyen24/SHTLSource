// SignalR Notification Hub Client for AXDD Admin

(function () {
    'use strict';

    // Get the notification hub URL from config
    const hubUrl = window.AXDD_CONFIG?.notificationHubUrl || 'http://localhost:7005/hubs/notifications';

    // Create connection
    const connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
            accessTokenFactory: () => getCookie('AuthToken'),
            skipNegotiation: true,
            transport: signalR.HttpTransportType.WebSockets
        })
        .withAutomaticReconnect({
            nextRetryDelayInMilliseconds: retryContext => {
                // Retry after 0, 2, 10, and 30 seconds
                if (retryContext.previousRetryCount === 0) return 0;
                if (retryContext.previousRetryCount === 1) return 2000;
                if (retryContext.previousRetryCount === 2) return 10000;
                return 30000;
            }
        })
        .configureLogging(signalR.LogLevel.Information)
        .build();

    // Connection event handlers
    connection.onreconnecting(error => {
        console.warn('SignalR reconnecting...', error);
        updateConnectionStatus('reconnecting');
    });

    connection.onreconnected(connectionId => {
        updateConnectionStatus('connected');
        loadNotificationCount();
    });

    connection.onclose(error => {
        updateConnectionStatus('disconnected');
    });

    // Notification handlers
    connection.on('ReceiveNotification', notification => {
        handleNewNotification(notification);
    });

    connection.on('NotificationRead', notificationId => {
        updateNotificationBadge(-1);
    });

    connection.on('AllNotificationsRead', () => {
        updateNotificationBadge(0, true);
    });

    // Start connection
    function startConnection() {
        connection.start()
            .then(() => {
                updateConnectionStatus('connected');
                loadNotificationCount();
            })
            .catch(err => {
                console.error('SignalR connection error:', err);
                updateConnectionStatus('disconnected');
                // Retry after 5 seconds
                setTimeout(startConnection, 5000);
            });
    }

    // Handle new notification
    function handleNewNotification(notification) {
        // Update badge
        updateNotificationBadge(1);

        // Show toast notification
        showNotificationToast(notification);

        // Add to notification dropdown if it's open
        addNotificationToDropdown(notification);

        // Play notification sound (optional)
        playNotificationSound();
    }

    // Update notification badge
    function updateNotificationBadge(change, reset = false) {
        const badge = $('#notification-badge');
        const sidebarBadge = $('#sidebar-notification-badge');

        if (reset) {
            badge.text('0').removeClass('pulse');
            sidebarBadge.text('0');
            return;
        }

        let currentCount = parseInt(badge.text()) || 0;
        let newCount = Math.max(0, currentCount + change);

        badge.text(newCount);
        sidebarBadge.text(newCount);

        if (newCount > 0) {
            badge.addClass('pulse');
        } else {
            badge.removeClass('pulse');
        }
    }

    // Load notification count from API
    function loadNotificationCount() {
        $.ajax({
            url: '/Notification/GetUnreadCount',
            method: 'GET',
            success: function (response) {
                if (response.success) {
                    updateNotificationBadge(response.count, true);
                    updateNotificationBadge(response.count);
                }
            },
            error: function (error) {
                console.error('Failed to load notification count:', error);
            }
        });
    }

    // Show notification toast
    function showNotificationToast(notification) {
        const typeMap = {
            'Info': 'info',
            'Success': 'success',
            'Warning': 'warning',
            'Error': 'error'
        };

        const type = typeMap[notification.type] || 'info';
        const message = `<strong>${notification.title}</strong><br>${notification.message}`;

        if (window.showToast) {
            window.showToast(message, type);
        } else {
        }
    }

    // Add notification to dropdown
    function addNotificationToDropdown(notification) {
        const dropdown = $('#notification-list');
        if (dropdown.length === 0) return;

        const iconMap = {
            'Info': 'fa-info-circle text-info',
            'Success': 'fa-check-circle text-success',
            'Warning': 'fa-exclamation-triangle text-warning',
            'Error': 'fa-times-circle text-danger'
        };

        const icon = iconMap[notification.type] || 'fa-bell text-secondary';
        const timeAgo = 'just now';

        const notificationHtml = `
            <a href="${notification.actionUrl || '#'}" class="dropdown-item">
                <i class="fas ${icon} mr-2"></i> ${notification.title}
                <span class="float-right text-muted text-sm">${timeAgo}</span>
            </a>
            <div class="dropdown-divider"></div>
        `;

        dropdown.prepend(notificationHtml);

        // Update header
        const header = $('#notification-header');
        const currentCount = parseInt(header.text()) || 0;
        header.text(`${currentCount + 1} Notifications`);

        // Limit to 5 notifications in dropdown
        dropdown.find('a.dropdown-item').slice(5).remove();
    }

    // Play notification sound
    function playNotificationSound() {
        try {
            const audio = new Audio('/sounds/notification.mp3');
            audio.volume = 0.3;
            audio.play().catch(err => {
                // Ignore autoplay errors
            });
        } catch (err) {
        }
    }

    // Update connection status indicator
    function updateConnectionStatus(status) {
        const indicator = $('#connection-status');
        if (indicator.length === 0) return;

        const statusConfig = {
            connected: { color: 'success', text: 'Connected' },
            reconnecting: { color: 'warning', text: 'Reconnecting...' },
            disconnected: { color: 'danger', text: 'Disconnected' }
        };

        const config = statusConfig[status] || statusConfig.disconnected;
        indicator
            .removeClass('badge-success badge-warning badge-danger')
            .addClass(`badge-${config.color}`)
            .text(config.text);
    }

    // Get cookie value
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            return parts.pop().split(';').shift();
        }
        return null;
    }

    // Initialize on page load
    $(document).ready(function () {
        // Only start connection if user is authenticated
        const authToken = getCookie('AuthToken');
        if (authToken) {
            startConnection();
        } else {
        }

        // Load initial notification count
        loadNotificationCount();

        // Refresh notification count every 5 minutes (300 seconds)
        // SignalR handles real-time updates; polling is just a fallback.
        setInterval(loadNotificationCount, 300000);
    });

    // Expose connection to global scope for debugging
    window.notificationHub = {
        connection: connection,
        start: startConnection,
        stop: () => connection.stop(),
        loadCount: loadNotificationCount
    };

})();
