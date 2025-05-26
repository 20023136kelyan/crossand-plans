// migrateFeedPosts.js
// WARNING: ALWAYS BACKUP YOUR FIRESTORE DATA BEFORE RUNNING MIGRATION SCRIPTS.
// This script updates existing feedPost documents to include userRole and userIsVerified
// by fetching the author's profile.

require('dotenv').config(); // To load .env or .env.local
const admin = require('firebase-admin');

// ---- CONFIGURATION ----
// Used if FIREBASE_SERVICE_ACCOUNT environment variable is NOT set or fails to parse.
const SERVICE_ACCOUNT_KEY_PATH = './palplanai-firebase.json'; // Example: './your-service-account-key.json'
// ---------------------

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    console.log('Found FIREBASE_SERVICE_ACCOUNT environment variable. Attempting to parse...');
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('Successfully parsed FIREBASE_SERVICE_ACCOUNT.');
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT. Ensure it is valid JSON.', e);
    console.log(`Falling back to SERVICE_ACCOUNT_KEY_PATH: ${SERVICE_ACCOUNT_KEY_PATH}`);
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
    console.log(`FIREBASE_SERVICE_ACCOUNT not found. Attempting to load from ${SERVICE_ACCOUNT_KEY_PATH}...`);
    serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);
    console.log(`Successfully loaded service account from ${SERVICE_ACCOUNT_KEY_PATH}.`);
  } catch (e) {
    console.error(`Error loading service account key from ${SERVICE_ACCOUNT_KEY_PATH}. Ensure the file exists or set FIREBASE_SERVICE_ACCOUNT.`, e);
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
const FEED_POSTS_COLLECTION = 'feedPosts';
const USERS_COLLECTION = 'users';

// Cache for user profiles to avoid re-fetching for the same user
const userProfileCache = new Map();

async function getUserProfileAdminLite(uid) {
  if (!uid) return null;
  if (userProfileCache.has(uid)) {
    return userProfileCache.get(uid);
  }
  try {
    const userDoc = await db.collection(USERS_COLLECTION).doc(uid).get();
    if (userDoc.exists) {
      const userDocData = userDoc.data();
      const profileData = { 
        uid, 
        ...userDocData,
        // Ensure defaults for role and isVerified if missing on the profile itself
        role: userDocData.role || 'user', 
        isVerified: userDocData.isVerified === undefined ? false : userDocData.isVerified,
      };
      userProfileCache.set(uid, profileData);
      return profileData;
    }
    console.warn(`User profile not found for UID ${uid} in cache or DB.`);
    userProfileCache.set(uid, null); // Cache that profile was not found
    return null;
  } catch (error) {
    console.error(`Error fetching profile for UID ${uid}:`, error);
    userProfileCache.set(uid, null);
    return null;
  }
}

async function migrateFeedPosts() {
  console.log('Starting feed posts migration...');
  let processedCount = 0;
  let updatedCount = 0;
  const batchSize = 200;
  let batch = db.batch();
  let operationsInBatch = 0;

  try {
    const snapshot = await db.collection(FEED_POSTS_COLLECTION).get();

    if (snapshot.empty) {
      console.log('No posts found in the "feedPosts" collection. Nothing to migrate.');
      return;
    }

    console.log(`Found ${snapshot.docs.length} feed posts to process.`);

    for (const doc of snapshot.docs) {
      processedCount++;
      const postId = doc.id;
      const postData = doc.data();
      const updatePayload = {};
      let needsUpdate = false;

      if (!postData.userId) {
        console.warn(`Post ${postId} is missing userId. Skipping.`);
        continue;
      }

      const userProfile = await getUserProfileAdminLite(postData.userId);

      // Determine what the role & verified status *should* be, based on profile or defaults
      const targetUserRole = userProfile ? userProfile.role : 'user'; // Default if profile missing
      const targetUserIsVerified = userProfile ? userProfile.isVerified : false; // Default if profile missing

      if (postData.userRole === undefined || postData.userRole !== targetUserRole) {
        updatePayload.userRole = targetUserRole;
        needsUpdate = true;
      }
      if (postData.userIsVerified === undefined || postData.userIsVerified !== targetUserIsVerified) {
        updatePayload.userIsVerified = targetUserIsVerified;
        needsUpdate = true;
      }
      
      // Also ensure userName and userAvatarUrl are present on the post, taking from profile if post is missing them
      // and profile exists
      if (userProfile) {
        if (postData.userName === undefined && userProfile.name !== undefined) {
          updatePayload.userName = userProfile.name || `User (${postData.userId.substring(0,5)})`;
          needsUpdate = true;
        }
        if (postData.userAvatarUrl === undefined && userProfile.avatarUrl !== undefined) {
          updatePayload.userAvatarUrl = userProfile.avatarUrl || null;
          needsUpdate = true;
        }
      } else {
        // If user profile doesn't exist, ensure post has some defaults if these are missing
        if (postData.userName === undefined) {
           updatePayload.userName = `User (${postData.userId.substring(0,5)})`;
           needsUpdate = true;
        }
        if (postData.userAvatarUrl === undefined) {
           updatePayload.userAvatarUrl = null;
           needsUpdate = true;
        }
      }


      if (needsUpdate) {
        console.log(`Post ${postId}: Queuing update with:`, JSON.stringify(updatePayload));
        batch.update(doc.ref, updatePayload); // Only update the specific fields
        operationsInBatch++;
        updatedCount++;

        if (operationsInBatch >= batchSize) {
          console.log(`Committing batch of ${operationsInBatch} updates...`);
          await batch.commit();
          batch = db.batch();
          operationsInBatch = 0;
          console.log('Batch committed.');
        }
      } else {
        console.log(`Post ${postId}: No migration needed for userRole/userIsVerified/userName/userAvatarUrl.`);
      }
    }

    if (operationsInBatch > 0) {
      console.log(`Committing final batch of ${operationsInBatch} updates...`);
      await batch.commit();
      console.log('Final batch committed.');
    }

    console.log(`\nFeed post migration finished. Processed ${processedCount} posts.`);
    console.log(`Updated ${updatedCount} posts.`);

  } catch (error) {
    console.error('Error during feed post migration:', error);
  }
}

migrateFeedPosts()
  .then(() => {
    console.log('Feed post migration script completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Unhandled error running feed post migration script:', err);
    process.exit(1);
  });