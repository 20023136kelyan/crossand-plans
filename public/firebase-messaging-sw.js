importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyANM4USgcJhvMYp3lDgrXAhKOmslOtwGDs",
  authDomain: "palplanai.firebaseapp.com",
  projectId: "palplanai",
  storageBucket: "palplanai.firebasestorage.app",
  messagingSenderId: "74355937539",
  appId: "1:74355937539:web:515c5a5bfb9cf569b69936"
});

const messaging = firebase.messaging();

// Helper function to get notification icon based on type
function getNotificationIcon(type, interactionType) {
  switch (type) {
    case 'post_interaction':
      return interactionType === 'like' ? '❤️' : '💬';
    case 'chat_message':
      return '💬';
    case 'friend_request':
    case 'follow_request':
      return '👥';
    case 'plan_share':
      return '📝';
    case 'plan_invitation':
      return '📅';
    case 'plan_completion':
      return '🎉';
    default:
      return '🔔';
  }
}

// Helper function to get notification color based on type
function getNotificationColor(type, interactionType) {
  switch (type) {
    case 'post_interaction':
      return interactionType === 'like' ? '#ef4444' : '#3b82f6'; // Red for likes, blue for comments
    case 'chat_message':
      return '#3b82f6'; // Blue for messages
    case 'friend_request':
    case 'follow_request':
      return '#8b5cf6'; // Purple for requests
    case 'plan_share':
      return '#10b981'; // Green for shares
    case 'plan_invitation':
      return '#f59e0b'; // Amber for invitations
    case 'plan_completion':
      return '#06b6d4'; // Cyan for completions
    default:
      return '#6b7280'; // Gray for others
  }
}

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  try {
    const notificationTitle = payload.notification.title;
    const notificationBody = payload.notification.body;
    const data = payload.data || {};
    
    // Extract notification type and interaction type from data
    const notificationType = data.type || 'system';
    const interactionType = data.interactionType || 'general';
    
    // Get appropriate icon and color
    const icon = getNotificationIcon(notificationType, interactionType);
    const color = getNotificationColor(notificationType, interactionType);
    
    // Create enhanced notification options
    const notificationOptions = {
      body: notificationBody,
      icon: '/crossand-logo.svg', // Use your app logo
      badge: '/crossand-logo.svg', // Badge for mobile
      image: data.imageUrl, // Show plan/post image if available
      tag: `notification-${notificationType}`, // Group similar notifications
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200], // Vibration pattern
      actions: [
        {
          action: 'view',
          title: 'View',
          icon: '/crossand-logo.svg'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      // Custom styling for better appearance
      renotify: true,
      // Add all data in a single data object
      data: {
        url: data.actionUrl || '/users/notifications', // Default to notifications page
        type: notificationType,
        interactionType: interactionType,
        customStyle: {
          backgroundColor: '#ffffff',
          color: '#1f2937',
          borderRadius: '12px',
          border: `2px solid ${color}`,
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          icon: icon,
          iconColor: color
        },
        ...data
      }
    };

    // Show the enhanced notification
    self.registration.showNotification(notificationTitle, notificationOptions);
  } catch (error) {
    console.error('[firebase-messaging-sw.js] Error showing notification:', error);
    // Fallback to basic notification if enhanced one fails
    try {
      self.registration.showNotification(
        payload.notification.title || 'New Notification',
        {
          body: payload.notification.body || 'You have a new notification',
          icon: '/crossand-logo.svg'
        }
      );
    } catch (fallbackError) {
      console.error('[firebase-messaging-sw.js] Fallback notification also failed:', fallbackError);
    }
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  
  try {
    event.notification.close();
    
    const data = event.notification.data || {};
    const url = data.url || '/users/notifications';
    
    // Handle different actions
    if (event.action === 'view') {
      // Open the notification in a new window/tab
      event.waitUntil(
        clients.openWindow(url)
      );
    } else if (event.action === 'dismiss') {
      // Just close the notification
      event.notification.close();
    } else {
      // Default click behavior - open the app
      event.waitUntil(
        clients.matchAll({ type: 'window' }).then(function(clientList) {
          // Check if there's already a window open
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            if (client.url.includes(window.location.origin) && 'focus' in client) {
              return client.focus();
            }
          }
          // If no window is open, open a new one
          if (clients.openWindow) {
            return clients.openWindow(url);
          }
        }).catch(function(error) {
          console.error('[firebase-messaging-sw.js] Error handling notification click:', error);
          // Fallback: try to open the URL anyway
          if (clients.openWindow) {
            return clients.openWindow(url);
          }
        })
      );
    }
  } catch (error) {
    console.error('[firebase-messaging-sw.js] Error in notification click handler:', error);
  }
}); 