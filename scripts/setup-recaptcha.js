// scripts/setup-recaptcha.js
// This script helps set up the reCAPTCHA site key

const fs = require('fs');
const path = require('path');

console.log('🔧 reCAPTCHA Site Key Setup');
console.log('============================\n');

const envPath = path.join(process.cwd(), '.env.local');

// Check if .env.local exists
if (!fs.existsSync(envPath)) {
  console.log('❌ .env.local file not found');
  console.log('Please create a .env.local file with your Firebase configuration first');
  process.exit(1);
}

// Read current .env.local
let envContent = fs.readFileSync(envPath, 'utf8');

// Check if NEXT_PUBLIC_RECAPTCHA_SITE_KEY already exists
if (envContent.includes('NEXT_PUBLIC_RECAPTCHA_SITE_KEY=')) {
  console.log('✅ NEXT_PUBLIC_RECAPTCHA_SITE_KEY already exists in .env.local');
  const match = envContent.match(/NEXT_PUBLIC_RECAPTCHA_SITE_KEY=(.+)/);
  if (match) {
    console.log('Current site key:', match[1].substring(0, 10) + '...');
  }
} else {
  console.log('❌ NEXT_PUBLIC_RECAPTCHA_SITE_KEY not found in .env.local');
  console.log('\n📝 To add your reCAPTCHA site key:');
  console.log('1. Go to Firebase Console → Authentication → Settings → reCAPTCHA');
  console.log('2. Copy the Web site key (the one with "Copy key" button)');
  console.log('3. Add this line to your .env.local file:');
  console.log('   NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_site_key_here');
  console.log('\nExample:');
  console.log('NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6LdM-IUrAAAAAO6aKq4DhsefU4_5AkhopmpqyFE-');
}

console.log('\n🔍 Current Firebase Configuration:');
const firebaseVars = {
  apiKey: envContent.match(/NEXT_PUBLIC_FIREBASE_API_KEY=(.+)/)?.[1],
  projectId: envContent.match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.+)/)?.[1],
  authDomain: envContent.match(/NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=(.+)/)?.[1],
};

Object.entries(firebaseVars).forEach(([key, value]) => {
  if (value) {
    console.log(`✅ ${key}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`❌ ${key}: Missing`);
  }
});

console.log('\n🚀 Next Steps:');
console.log('1. Add your reCAPTCHA site key to .env.local');
console.log('2. Restart your development server');
console.log('3. Try the phone authentication again');
console.log('4. Check the browser console for the new site key logs');

console.log('\n⚠️  Important Notes:');
console.log('- The site key from your Firebase Console screenshot should be used');
console.log('- Make sure localhost is in your authorized domains in Firebase Console');
console.log('- Clear browser cache if you still see the old site key');
console.log('- Try in incognito mode to avoid cached reCAPTCHA instances'); 