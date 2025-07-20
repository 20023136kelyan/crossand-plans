// scripts/debug-firebase-config.js
// This script helps debug Firebase configuration issues

const fs = require('fs');
const path = require('path');

console.log('🔍 Firebase Configuration Debug');
console.log('================================\n');

// Check environment variables
const envFiles = ['.env.local', '.env', '.env.development'];
let envContent = '';

for (const envFile of envFiles) {
  const envPath = path.join(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    console.log(`✅ Found ${envFile}`);
    envContent = fs.readFileSync(envPath, 'utf8');
    break;
  }
}

if (envContent) {
  console.log('\n📋 Environment Variables:');
  
  const firebaseVars = {
    apiKey: envContent.match(/NEXT_PUBLIC_FIREBASE_API_KEY=(.+)/)?.[1],
    projectId: envContent.match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.+)/)?.[1],
    authDomain: envContent.match(/NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=(.+)/)?.[1],
    storageBucket: envContent.match(/NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=(.+)/)?.[1],
    messagingSenderId: envContent.match(/NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=(.+)/)?.[1],
    appId: envContent.match(/NEXT_PUBLIC_FIREBASE_APP_ID=(.+)/)?.[1],
  };
  
  Object.entries(firebaseVars).forEach(([key, value]) => {
    if (value) {
      console.log(`✅ ${key}: ${value.substring(0, 10)}...`);
    } else {
      console.log(`❌ ${key}: Missing`);
    }
  });
  
  console.log('\n🔧 reCAPTCHA Issue Analysis:');
  console.log('Based on the logs, the issue is:');
  console.log('1. Firebase is using site key: 6LcMZR0UAAAAALgPMcgHwga7gY5p8QMg1Hj-bmUv');
  console.log('2. This key is getting 401 Unauthorized errors');
  console.log('3. This suggests the key is invalid or not configured for your domain');
  
  console.log('\n📝 Next Steps:');
  console.log('1. Go to Firebase Console → Authentication → Settings → reCAPTCHA');
  console.log('2. Copy the correct Web site key from your Firebase Console');
  console.log('3. Ensure localhost is in your authorized domains');
  console.log('4. Check if you have multiple reCAPTCHA configurations that might be conflicting');
  
  console.log('\n🔍 To verify the correct site key:');
  console.log('1. Open Firebase Console in your browser');
  console.log('2. Go to Authentication → Settings → reCAPTCHA');
  console.log('3. Look for the Web site key (should be different from the one in logs)');
  console.log('4. Make sure localhost is listed in authorized domains');
  
  console.log('\n⚠️  Common Issues:');
  console.log('- Multiple reCAPTCHA configurations in the same project');
  console.log('- Site key not configured for localhost domain');
  console.log('- Using an old/expired site key');
  console.log('- CSP blocking reCAPTCHA scripts (browser extension or security settings)');
  
} else {
  console.log('❌ No environment file found');
  console.log('Create a .env.local file with your Firebase configuration');
}

console.log('\n🚀 Quick Fix Attempt:');
console.log('1. Clear browser cache and cookies');
console.log('2. Try in incognito mode');
console.log('3. Disable browser extensions temporarily');
console.log('4. Check if you have multiple Firebase projects configured'); 