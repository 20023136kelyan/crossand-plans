
// migrateUserProfiles.js
// WARNING: ALWAYS BACKUP YOUR FIRESTORE DATA BEFORE RUNNING MIGRATION SCRIPTS.
// This script updates existing user profiles to include new fields with default values.

// Load environment variables from .env file if present (especially .env.local)
require('dotenv').config(); 

const admin = require('firebase-admin');

// ---- CONFIGURATION ----
// Option 1: Define the path to your service account key JSON file.
// This is used if FIREBASE_SERVICE_ACCOUNT environment variable is NOT set.
const SERVICE_ACCOUNT_KEY_PATH = './palplanai-firebase.json'; // Example path
// ---------------------

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    console.log('Found FIREBASE_SERVICE_ACCOUNT environment variable. Attempting to parse...');
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('Successfully parsed FIREBASE_SERVICE_ACCOUNT.');
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable. Ensure it is a valid JSON string.', e);
    console.log('Falling back to SERVICE_ACCOUNT_KEY_PATH if defined.');
    // Fallback to file path if parsing env var fails and path is defined
    try {
        serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);
        console.log(`Successfully loaded service account from ${SERVICE_ACCOUNT_KEY_PATH}.`);
    } catch (fileError) {
        console.error(`Error loading service account from file ${SERVICE_ACCOUNT_KEY_PATH} after failing to parse environment variable.`, fileError);
        process.exit(1);
    }
  }
} else {
  try {
    console.log(`FIREBASE_SERVICE_ACCOUNT environment variable not found. Attempting to load from ${SERVICE_ACCOUNT_KEY_PATH}...`);
    serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);
    console.log(`Successfully loaded service account from ${SERVICE_ACCOUNT_KEY_PATH}.`);
  } catch (e) {
    console.error(`Error loading service account key from ${SERVICE_ACCOUNT_KEY_PATH}. Ensure the file exists and the path is correct, or set the FIREBASE_SERVICE_ACCOUNT environment variable.`, e);
    process.exit(1);
  }
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK.', error);
  process.exit(1);
}

const db = admin.firestore();
const usersCollectionRef = db.collection('users');

async function migrateUserProfiles() {
  console.log('Starting user profile migration...');
  let processedCount = 0;
  let updatedCount = 0;
  const batchSize = 200; // Firestore batch writes are limited (e.g., 500 operations per batch)
  let batch = db.batch();
  let operationsInBatch = 0;

  try {
    const snapshot = await usersCollectionRef.get();

    if (snapshot.empty) {
      console.log('No user profiles found in the "users" collection. Nothing to migrate.');
      return;
    }

    console.log(`Found ${snapshot.docs.length} user profiles to process.`);

    for (const doc of snapshot.docs) {
      processedCount++;
      const userId = doc.id;
      const userData = doc.data();
      const updatePayload = {};
      let needsUpdate = false;

      // --- Apply Defaults for Missing Fields ---

      // 1. Role and Verification
      if (userData.role === undefined || userData.role === null) {
        updatePayload.role = 'user'; // Default role
        needsUpdate = true;
      }
      if (userData.isVerified === undefined || userData.isVerified === null) {
        updatePayload.isVerified = false; // Default verification status
        needsUpdate = true;
      }

      // 2. Preference Arrays (ensure they exist, even if empty)
      const preferenceArrays = [
        'allergies', 'dietaryRestrictions', 'favoriteCuisines',
        'physicalLimitations', 'activityTypePreferences', 'activityTypeDislikes',
        'environmentalSensitivities', 'preferences' // 'preferences' is the combined one
      ];
      preferenceArrays.forEach(field => {
        if (!Array.isArray(userData[field])) {
          updatePayload[field] = [];
          needsUpdate = true;
        }
      });

      // 3. Friends array (on main doc, as per UserProfile type)
      if (!Array.isArray(userData.friends)) {
        updatePayload.friends = [];
        needsUpdate = true;
      }

      // 4. Gamification Elements
      if (typeof userData.eventAttendanceScore !== 'number') {
        updatePayload.eventAttendanceScore = 0;
        needsUpdate = true;
      }
      if (typeof userData.levelTitle !== 'string' || !userData.levelTitle) {
        updatePayload.levelTitle = 'Newbie Planner';
        needsUpdate = true;
      }
      if (typeof userData.levelStars !== 'number') {
        updatePayload.levelStars = 1;
        needsUpdate = true;
      }
      
      // 5. Other optional fields (set to null or empty string if undefined to maintain schema consistency)
      const optionalFieldsToDefaultNull = [
        'countryDialCode', 'phoneNumber', 'birthDate', 'physicalAddress', 
        'socialPreferences'
      ];
      optionalFieldsToDefaultNull.forEach(field => {
        if (userData[field] === undefined) {
          updatePayload[field] = null;
          needsUpdate = true;
        }
      });
      
      const optionalFieldsToDefaultEmptyString = [
         'generalPreferences', 'travelTolerance', 'budgetFlexibilityNotes', 'availabilityNotes'
      ];
       optionalFieldsToDefaultEmptyString.forEach(field => {
        if (userData[field] === undefined) {
          updatePayload[field] = '';
          needsUpdate = true;
        }
      });


      // 6. Timestamps: Ensure they are Firestore Timestamps
      if (!userData.createdAt || !(userData.createdAt instanceof admin.firestore.Timestamp)) {
        updatePayload.createdAt = admin.firestore.FieldValue.serverTimestamp();
        needsUpdate = true;
      }

      if (needsUpdate || !userData.updatedAt || !(userData.updatedAt instanceof admin.firestore.Timestamp)) {
        updatePayload.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        needsUpdate = true;
      }


      if (needsUpdate) {
        console.log(`User ${userId}: Queuing update with:`, JSON.stringify(updatePayload));
        batch.update(doc.ref, updatePayload);
        operationsInBatch++;
        updatedCount++;

        if (operationsInBatch >= batchSize) {
          console.log(`Committing batch of ${operationsInBatch} updates...`);
          await batch.commit();
          batch = db.batch(); // Re-initialize batch
          operationsInBatch = 0;
          console.log('Batch committed.');
        }
      } else {
        console.log(`User ${userId}: No migration needed.`);
      }
    }

    // Commit any remaining operations in the last batch
    if (operationsInBatch > 0) {
      console.log(`Committing final batch of ${operationsInBatch} updates...`);
      await batch.commit();
      console.log('Final batch committed.');
    }

    console.log(`\nMigration finished. Processed ${processedCount} user profiles.`);
    console.log(`Updated ${updatedCount} user profiles.`);

  } catch (error) {
    console.error('Error during user profile migration:', error);
  }
}

migrateUserProfiles()
  .then(() => {
    console.log('Migration script completed.');
    process.exit(0); // Exit successfully
  })
  .catch((err) => {
    console.error('Unhandled error running migration script:', err);
    process.exit(1); // Exit with error
  });

    