const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('FIREBASE_SERVICE_ACCOUNT environment variable is required');
    process.exit(1);
  }
  
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function createTestUser() {
  try {
    const testUser = {
      uid: 'test-kelyan-123',
      name: 'Kelyan Test',
      username: 'kelyan',
      email: 'kelyan@test.com',
      role: 'user',
      isVerified: false,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      avatarUrl: null,
      phoneNumber: null,
      physicalAddress: {
        country: 'United States',
        state: 'California',
        city: 'San Francisco'
      }
    };
    
    await db.collection('users').doc('test-kelyan-123').set(testUser);
    console.log('Test user "kelyan" created successfully');
    
    // Create another test user
    const testUser2 = {
      uid: 'test-john-456',
      name: 'John Doe',
      username: 'johndoe',
      email: 'john@test.com',
      role: 'user',
      isVerified: true,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      avatarUrl: null,
      phoneNumber: null,
      physicalAddress: {
        country: 'United States',
        state: 'New York',
        city: 'New York'
      }
    };
    
    await db.collection('users').doc('test-john-456').set(testUser2);
    console.log('Test user "johndoe" created successfully');
    
  } catch (error) {
    console.error('Error creating test users:', error);
  }
}

createTestUser().then(() => {
  console.log('Test users creation completed');
  process.exit(0);
});