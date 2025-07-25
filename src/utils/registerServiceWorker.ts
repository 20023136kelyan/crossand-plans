export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      // Check if a service worker is already registered
      const registrations = await navigator.serviceWorker.getRegistrations();
      const existingRegistration = registrations.find(
        registration => registration.active && registration.active.scriptURL.includes('firebase-messaging-sw.js')
      );

      if (existingRegistration) {
        console.log('Found existing Firebase Messaging service worker');
        return existingRegistration;
      }

      // Register the service worker
      console.log('Registering Firebase Messaging service worker');
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/firebase-cloud-messaging-push-scope'
      });
      
      console.log('Service Worker registered with scope:', registration.scope);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }
  throw new Error('Service workers are not supported in this browser');
}
