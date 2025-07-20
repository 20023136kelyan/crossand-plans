// scripts/verify-recaptcha.js
// This script helps verify reCAPTCHA configuration

const fs = require('fs');
const path = require('path');

console.log('🔍 reCAPTCHA Configuration Verification');
console.log('=====================================\n');

// Check for .env files
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

if (!envContent) {
  console.log('❌ No .env file found');
  console.log('\n📝 Create a .env.local file with your Firebase configuration:');
  console.log('NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key');
  console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id');
  console.log('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com');
  console.log('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com');
  console.log('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id');
  console.log('NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id');
} else {
  console.log('✅ Environment file found');
  
  // Check for Firebase config
  const firebaseConfig = {
    apiKey: envContent.match(/NEXT_PUBLIC_FIREBASE_API_KEY=(.+)/)?.[1],
    projectId: envContent.match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.+)/)?.[1],
    authDomain: envContent.match(/NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=(.+)/)?.[1],
  };
  
  console.log('\n📋 Firebase Configuration:');
  console.log(`API Key: ${firebaseConfig.apiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`Project ID: ${firebaseConfig.projectId ? '✅ Set' : '❌ Missing'}`);
  console.log(`Auth Domain: ${firebaseConfig.authDomain ? '✅ Set' : '❌ Missing'}`);
}

console.log('\n🔧 Next Steps:');
console.log('1. Copy the Web site key from your Firebase Console');
console.log('2. Ensure localhost is in your authorized domains');
console.log('3. Wait a few minutes for rate limits to reset');
console.log('4. Try the phone authentication again');

console.log('\n📱 To test the phone auth:');
console.log('1. Go to http://localhost:3000/auth/phone');
console.log('2. Enter a valid phone number');
console.log('3. Check the browser console for detailed error messages'); 