// scripts/clear-recaptcha-cache.js
// This script helps clear reCAPTCHA cache and provides testing instructions

console.log('🧹 reCAPTCHA Cache Clearing Instructions');
console.log('========================================\n');

console.log('The 401 Unauthorized errors suggest cached reCAPTCHA configurations are conflicting.');
console.log('Here are the steps to resolve this:\n');

console.log('1. 🔄 Clear Browser Cache:');
console.log('   - Open Chrome DevTools (F12)');
console.log('   - Right-click the refresh button');
console.log('   - Select "Empty Cache and Hard Reload"');
console.log('   - Or use Ctrl+Shift+R (Cmd+Shift+R on Mac)\n');

console.log('2. 🌐 Test in Incognito Mode:');
console.log('   - Open an incognito/private window');
console.log('   - Navigate to your app');
console.log('   - Try the phone authentication\n');

console.log('3. 🔧 Clear Browser Storage:');
console.log('   - Open DevTools → Application tab');
console.log('   - Go to Storage → Clear storage');
console.log('   - Check "All" and click "Clear site data"\n');

console.log('4. 🚫 Disable Extensions:');
console.log('   - Temporarily disable browser extensions');
console.log('   - Some extensions can interfere with reCAPTCHA\n');

console.log('5. 🔍 Check Network Tab:');
console.log('   - Open DevTools → Network tab');
console.log('   - Look for requests to google.com/recaptcha');
console.log('   - Check if multiple site keys are being used\n');

console.log('6. 📱 Test on Different Device:');
console.log('   - Try on a different device or browser');
console.log('   - This helps isolate if it\'s a local cache issue\n');

console.log('7. 🔄 Restart Development Server:');
console.log('   - Stop the dev server (Ctrl+C)');
console.log('   - Run: npm run dev');
console.log('   - This ensures fresh environment variables\n');

console.log('8. 🎯 Verify Firebase Console Settings:');
console.log('   - Go to Firebase Console → Authentication → Settings');
console.log('   - Check reCAPTCHA configuration');
console.log('   - Ensure localhost is in authorized domains\n');

console.log('\n💡 Quick Test Steps:');
console.log('1. Open incognito window');
console.log('2. Navigate to your app');
console.log('3. Try phone authentication');
console.log('4. Check console for new logs');
console.log('5. Look for "Firebase project ID:" and "reCAPTCHA site key configured:" logs\n');

console.log('⚠️  If the issue persists:');
console.log('- The problem might be in Firebase Console configuration');
console.log('- Check if the reCAPTCHA site key matches your .env.local file');
console.log('- Verify the domain (localhost:3000) is authorized in Firebase Console');
console.log('- Consider regenerating the reCAPTCHA site key in Firebase Console\n');

console.log('🎯 Expected Behavior After Fix:');
console.log('- Only one reCAPTCHA site key should be used');
console.log('- No 401 Unauthorized errors');
console.log('- Successful phone authentication flow');
console.log('- Clear success/error messages in console\n'); 