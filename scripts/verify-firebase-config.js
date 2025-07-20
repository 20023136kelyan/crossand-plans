// scripts/verify-firebase-config.js
// This script verifies Firebase configuration matches reCAPTCHA settings

const fs = require('fs');
const path = require('path');

console.log('🔍 Firebase Configuration Verification');
console.log('=====================================\n');

const envPath = path.join(process.cwd(), '.env.local');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env.local file not found');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');

// Extract Firebase configuration
const firebaseConfig = {
  apiKey: envContent.match(/NEXT_PUBLIC_FIREBASE_API_KEY=(.+)/)?.[1],
  projectId: envContent.match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.+)/)?.[1],
  authDomain: envContent.match(/NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=(.+)/)?.[1],
  storageBucket: envContent.match(/NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=(.+)/)?.[1],
  messagingSenderId: envContent.match(/NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=(.+)/)?.[1],
  appId: envContent.match(/NEXT_PUBLIC_FIREBASE_APP_ID=(.+)/)?.[1],
  recaptchaSiteKey: envContent.match(/NEXT_PUBLIC_RECAPTCHA_SITE_KEY=(.+)/)?.[1],
};

console.log('📋 Current Configuration:');
Object.entries(firebaseConfig).forEach(([key, value]) => {
  if (value) {
    console.log(`✅ ${key}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`❌ ${key}: Missing`);
  }
});

console.log('\n🔧 Analysis:');
console.log('The auth/argument-error suggests Firebase is having trouble with the reCAPTCHA configuration.');
console.log('This usually happens when:');
console.log('1. The reCAPTCHA site key doesn\'t match the Firebase project');
console.log('2. The domain (localhost) is not authorized in Firebase Console');
console.log('3. There are multiple reCAPTCHA configurations conflicting');

console.log('\n📝 Next Steps:');
console.log('1. Go to Firebase Console → Authentication → Settings → reCAPTCHA');
console.log('2. Verify the Web site key matches: 6LdM-IUrAAAAAO6aKq4DhsefU4_5AkhopmpqyFE-');
console.log('3. Check that localhost is in the authorized domains');
console.log('4. Ensure you\'re using the correct Firebase project');

console.log('\n🔍 To verify in Firebase Console:');
console.log('1. Go to https://console.firebase.google.com/');
console.log('2. Select your project: ' + (firebaseConfig.projectId || 'UNKNOWN'));
console.log('3. Go to Authentication → Settings → reCAPTCHA');
console.log('4. Check the Web site key matches your .env.local file');
console.log('5. Go to Authentication → Settings → Authorized domains');
console.log('6. Ensure localhost is listed there');

console.log('\n⚠️  If the site key doesn\'t match:');
console.log('1. Copy the correct site key from Firebase Console');
console.log('2. Update your .env.local file');
console.log('3. Restart the development server');
console.log('4. Clear browser cache and try again');

console.log('\n🚀 Quick Test:');
console.log('1. Try the phone auth in an incognito window');
console.log('2. Check browser console for the new logs');
console.log('3. Look for "Firebase project ID:" and "reCAPTCHA site key configured:" logs'); 