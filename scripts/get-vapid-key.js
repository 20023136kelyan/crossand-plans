// Script to get VAPID key from Firebase
// Run this in your Firebase project directory or with Firebase CLI

const admin = require('firebase-admin');

// Initialize Firebase Admin (you'll need to set up service account)
// const serviceAccount = require('./path-to-your-service-account.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

console.log('To get your VAPID key:');
console.log('');
console.log('1. Go to Firebase Console > Project Settings > Cloud Messaging');
console.log('2. Scroll down to "Web configuration" section');
console.log('3. Click "Generate key pair" if you don\'t have one');
console.log('4. Copy the "Key pair" value (this is your VAPID key)');
console.log('');
console.log('5. Add it to your .env.local file:');
console.log('   NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key_here');
console.log('');
console.log('Alternatively, you can get it programmatically:');
console.log('const vapidKey = await admin.messaging().getVapidKey();');
console.log('console.log(\'VAPID Key:\', vapidKey);'); 