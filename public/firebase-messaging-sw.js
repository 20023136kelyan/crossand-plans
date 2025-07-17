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

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
}); 