require('dotenv').config();
const admin = require('firebase-admin');

function getServiceAccount() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT environment variable');
  }

  try {
    const serviceAccountJson = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    if (!serviceAccountJson.project_id && !serviceAccountJson.projectId) {
      throw new Error('Service account missing project_id/projectId');
    }
    if (!serviceAccountJson.client_email && !serviceAccountJson.clientEmail) {
      throw new Error('Service account missing client_email/clientEmail');
    }
    if (!serviceAccountJson.private_key && !serviceAccountJson.privateKey) {
      throw new Error('Service account missing private_key/privateKey');
    }

    // Normalize the keys
    return {
      projectId: serviceAccountJson.project_id || serviceAccountJson.projectId,
      clientEmail: serviceAccountJson.client_email || serviceAccountJson.clientEmail,
      privateKey: serviceAccountJson.private_key || serviceAccountJson.privateKey
    };
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT. Ensure it contains valid JSON.');
    }
    throw e;
  }
}

// Initialize Firebase Admin SDK
try {
  const serviceAccount = getServiceAccount();
  console.log(`Initializing Firebase Admin SDK for project: ${serviceAccount.projectId}`);

  if (!admin.apps.length) {
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: `${serviceAccount.projectId}.appspot.com`
    });

    if (!app) throw new Error('Failed to initialize Firebase Admin app');
    console.log('Firebase Admin SDK initialized successfully');
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error.message);
  process.exit(1);
}

const db = admin.firestore();
if (!db) {
  console.error('Failed to get Firestore instance');
  process.exit(1);
}

async function updatePlansWithLowercaseEventType() {
  console.log('Starting migration...');
  const plansRef = db.collection('plans');
  const snapshot = await plansRef.get();
  let updatedCount = 0;
  let totalCount = snapshot.size;

  console.log(`Found ${totalCount} plans to process`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.eventType) {
      const eventTypeLowercase = data.eventType.toLowerCase();
      await doc.ref.update({ eventTypeLowercase });
      updatedCount++;
      console.log(`Updated plan ${doc.id} with eventTypeLowercase: ${eventTypeLowercase} (${updatedCount}/${totalCount})`);
    } else {
      console.log(`Skipping plan ${doc.id} - no eventType field`);
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} out of ${totalCount} plans.`);
}

updatePlansWithLowercaseEventType()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }); 