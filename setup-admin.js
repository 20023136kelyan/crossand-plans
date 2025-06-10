const admin = require('firebase-admin');
const readline = require('readline');
require('dotenv').config();

console.log('Starting admin setup script...');
console.log('Checking environment variables...');

// Initialize Firebase Admin SDK
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('Error: FIREBASE_SERVICE_ACCOUNT environment variable is required');
  console.log('Available env vars:', Object.keys(process.env).filter(key => key.includes('FIREBASE')));
  process.exit(1);
}

console.log('FIREBASE_SERVICE_ACCOUNT found, length:', process.env.FIREBASE_SERVICE_ACCOUNT.length);

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: `${serviceAccount.project_id}.appspot.com`
    });
  }
  
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error.message);
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function setupAdmin() {
  try {
    rl.question('Enter the email of the user you want to make admin: ', async (email) => {
      try {
        // Get user by email
        const userRecord = await admin.auth().getUserByEmail(email);
        
        // Set admin custom claims
        await admin.auth().setCustomUserClaims(userRecord.uid, {
          admin: true,
          moderator: true,
          creator: true,
          verified: true
        });
        
        // Update user profile in Firestore
        await admin.firestore().collection('users').doc(userRecord.uid).set({
          role: 'admin',
          isVerified: true,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system'
        }, { merge: true });
        
        console.log(`\nSuccess! User ${email} has been granted admin privileges.`);
        console.log('The user will need to sign out and sign back in for the changes to take effect.');
        
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          console.error(`\nError: No user found with email ${email}`);
          console.log('Please make sure the user has already signed up for the application.');
        } else {
          console.error('\nError setting admin privileges:', error.message);
        }
      }
      
      rl.close();
    });
  } catch (error) {
    console.error('Error in setup process:', error.message);
    rl.close();
  }
}

console.log('=== Admin User Setup ===');
console.log('This script will grant admin privileges to an existing user.');
console.log('Make sure the user has already signed up for the application.\n');

setupAdmin();