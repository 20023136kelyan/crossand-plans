const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
try {
  // Read environment variables from .env.local
  const envPath = path.join(__dirname, '.env.local');
  let serviceAccountJson;
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const serviceAccountMatch = envContent.match(/FIREBASE_SERVICE_ACCOUNT='(.+)'/s);
    if (serviceAccountMatch) {
      serviceAccountJson = serviceAccountMatch[1];
    }
  }
  
  if (!serviceAccountJson && !process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('FIREBASE_SERVICE_ACCOUNT not found in .env.local or environment variables');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(serviceAccountJson || process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();

  async function checkUsers() {
    try {
      console.log('Fetching all users from the database...');
      const usersSnapshot = await db.collection('users').limit(20).get();
      
      console.log(`Found ${usersSnapshot.size} users in the database:`);
      console.log('=' .repeat(50));
      
      usersSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`User ${index + 1}:`);
        console.log(`  ID: ${doc.id}`);
        console.log(`  Name: ${data.name || 'N/A'}`);
        console.log(`  Username: ${data.username || 'N/A'}`);
        console.log(`  Email: ${data.email || 'N/A'}`);
        console.log(`  Phone: ${data.phoneNumber || 'N/A'}`);
        console.log(`  Verified: ${data.isVerified || false}`);
        console.log(`  Role: ${data.role || 'N/A'}`);
        console.log(`  Created: ${data.createdAt ? new Date(data.createdAt.seconds * 1000).toISOString() : 'N/A'}`);
        console.log('-'.repeat(30));
      });
      
      // Test search for 'kelyan'
      console.log('\nTesting search for "kelyan"...');
      const searchResults = [];
      
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        const name = data.name || '';
        const username = data.username || '';
        const email = data.email || '';
        
        if (name.toLowerCase().includes('kelyan') || 
            username.toLowerCase().includes('kelyan') || 
            email.toLowerCase().includes('kelyan')) {
          searchResults.push({
            id: doc.id,
            name: data.name,
            username: data.username,
            email: data.email
          });
        }
      });
      
      console.log(`Found ${searchResults.length} users matching "kelyan":`);
      searchResults.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.name} (@${user.username}) - ${user.email}`);
      });
      
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }

  checkUsers().then(() => {
    console.log('\nUser check completed');
    process.exit(0);
  });

} catch (error) {
  console.error('Error initializing Firebase:', error);
  process.exit(1);
}