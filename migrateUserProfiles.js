// migrateUserProfiles.js
// WARNING: ALWAYS BACKUP YOUR FIRESTORE DATA BEFORE RUNNING MIGRATION SCRIPTS.
// This script updates existing user profiles to include new fields with default values,
// and synchronizes 'friends' status in friendships with mutual follows.

require('dotenv').config(); 
const admin = require('firebase-admin');

// ---- CONFIGURATION ----
const SERVICE_ACCOUNT_KEY_PATH = './palplanai-firebase.json'; // Example path
const USER_COLLECTION = 'users';
const FRIENDSHIPS_SUBCOLLECTION = 'friendships';
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
    if (SERVICE_ACCOUNT_KEY_PATH) {
        try {
            serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);
            console.log(`Successfully loaded service account from file: ${SERVICE_ACCOUNT_KEY_PATH}.`);
        } catch (fileError) {
            console.error(`Error loading service account from file ${SERVICE_ACCOUNT_KEY_PATH} after failing to parse environment variable.`, fileError);
            process.exit(1);
        }
    } else {
        console.error('FIREBASE_SERVICE_ACCOUNT env var failed, and no SERVICE_ACCOUNT_KEY_PATH. Cannot init Admin SDK.');
        process.exit(1);
    }
  }
} else if (SERVICE_ACCOUNT_KEY_PATH) {
  try {
    console.log(`FIREBASE_SERVICE_ACCOUNT not found. Loading from file: ${SERVICE_ACCOUNT_KEY_PATH}...`);
    serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);
    console.log(`Successfully loaded service account from file: ${SERVICE_ACCOUNT_KEY_PATH}.`);
  } catch (e) {
    console.error(`Error loading service account from file ${SERVICE_ACCOUNT_KEY_PATH}.`, e);
    process.exit(1);
  }
} else {
    console.error('Neither FIREBASE_SERVICE_ACCOUNT env var nor SERVICE_ACCOUNT_KEY_PATH is defined. Cannot init Admin SDK.');
    process.exit(1);
}

let firestoreAdmin;
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  firestoreAdmin = admin.firestore();
  console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK.', error);
  process.exit(1);
}

const db = firestoreAdmin;
const usersCollectionRef = db.collection(USER_COLLECTION);

async function migrateUserProfilesCoreFields() {
  console.log('Starting user profile core field migration...');
  let processedCount = 0;
  let updatedCount = 0;
  const batchSize = 200; 
  let batch = db.batch();
  let operationsInBatch = 0;

  try {
    const snapshot = await usersCollectionRef.get();
    if (snapshot.empty) {
      console.log('No user profiles found. Nothing to migrate for core fields.');
      return;
    }
    console.log(`Found ${snapshot.docs.length} user profiles for core field check.`);

    for (const doc of snapshot.docs) {
      processedCount++;
      const userId = doc.id;
      const userData = doc.data();
      const updatePayload = {};
      let needsUpdate = false;

      // Initialize core new fields if they are missing
      if (userData.role === undefined) { updatePayload.role = 'user'; needsUpdate = true; }
      if (userData.isVerified === undefined) { updatePayload.isVerified = false; needsUpdate = true; }
      if (userData.bio === undefined) { updatePayload.bio = ''; needsUpdate = true; } // Added bio
      
      const preferenceArrays = ['allergies', 'dietaryRestrictions', 'favoriteCuisines','physicalLimitations', 'activityTypePreferences', 'activityTypeDislikes','environmentalSensitivities', 'preferences'];
      preferenceArrays.forEach(field => {
        if (!Array.isArray(userData[field])) { updatePayload[field] = []; needsUpdate = true;}
      });

      // Ensure followers and following arrays exist (for the new Follow system)
      if (!Array.isArray(userData.followers)) { updatePayload.followers = []; needsUpdate = true;}
      if (!Array.isArray(userData.following)) { updatePayload.following = []; needsUpdate = true;}
      
      // Remove old top-level 'friends' array as it's deprecated
      if (userData.friends !== undefined) { 
        updatePayload.friends = admin.firestore.FieldValue.delete(); 
        needsUpdate = true; 
      }

      if (typeof userData.eventAttendanceScore !== 'number') { updatePayload.eventAttendanceScore = 0; needsUpdate = true; }
      if (typeof userData.levelTitle !== 'string' || !userData.levelTitle) { updatePayload.levelTitle = 'Newbie Planner'; needsUpdate = true; }
      if (typeof userData.levelStars !== 'number') { updatePayload.levelStars = 1; needsUpdate = true; }

      const optionalFieldsToDefaultNull = ['countryDialCode', 'phoneNumber', 'birthDate', 'physicalAddress', 'socialPreferences'];
      optionalFieldsToDefaultNull.forEach(field => { if (userData[field] === undefined) {updatePayload[field] = null; needsUpdate = true;} });
      
      const optionalFieldsToDefaultEmptyString = ['generalPreferences', 'travelTolerance', 'budgetFlexibilityNotes', 'availabilityNotes'];
      optionalFieldsToDefaultEmptyString.forEach(field => { if (userData[field] === undefined) {updatePayload[field] = ''; needsUpdate = true;} });

      // Ensure name_lowercase is populated
      if (userData.name && typeof userData.name === 'string' && (userData.name_lowercase === undefined || userData.name_lowercase !== userData.name.toLowerCase())) {
        updatePayload.name_lowercase = userData.name.toLowerCase(); needsUpdate = true;
      } else if (userData.name && typeof userData.name === 'string' && userData.name_lowercase === undefined) {
        updatePayload.name_lowercase = userData.name.toLowerCase(); needsUpdate = true;
      } else if (!userData.name && userData.name_lowercase !== undefined) { // If name became null, name_lowercase should be null
        updatePayload.name_lowercase = null; needsUpdate = true;
      }

      // Timestamps
      if (!userData.createdAt || !(userData.createdAt instanceof admin.firestore.Timestamp)) {
        updatePayload.createdAt = admin.firestore.FieldValue.serverTimestamp(); needsUpdate = true;
      }
      if (needsUpdate || !userData.updatedAt || !(userData.updatedAt instanceof admin.firestore.Timestamp)) {
        updatePayload.updatedAt = admin.firestore.FieldValue.serverTimestamp(); needsUpdate = true; 
      }

      if (needsUpdate) {
        console.log(`User ${userId}: Queuing core update with:`, JSON.stringify(updatePayload).substring(0, 200) + "...");
        batch.update(doc.ref, updatePayload);
        operationsInBatch++;
        updatedCount++;
        if (operationsInBatch >= batchSize) {
          console.log(`Committing batch of ${operationsInBatch} core updates...`);
          await batch.commit();
          batch = db.batch(); 
          operationsInBatch = 0;
          console.log('Core update batch committed.');
        }
      }
    }
    if (operationsInBatch > 0) {
      console.log(`Committing final batch of ${operationsInBatch} core updates...`);
      await batch.commit();
      console.log('Final core update batch committed.');
    }
    console.log(`\nUser profile core field migration finished. Processed ${processedCount}. Updated ${updatedCount}.`);
  } catch (error) {
    console.error('Error during user profile core field migration:', error);
  }
}

async function migrateFriendshipsToFollows() {
  console.log('\nStarting migration of friendships to mutual follows & vice-versa...');
  if (!firestoreAdmin) {
    console.error("Firestore Admin SDK not initialized for friendship/follow migration.");
    return;
  }
  let usersProcessed = 0;
  const usersSnapshot = await usersCollectionRef.get();

  for (const userDoc of usersSnapshot.docs) {
    usersProcessed++;
    const userId = userDoc.id;
    const userData = userDoc.data();
    const batch = db.batch();
    let userProfileUpdates = {};
    let madeChangesThisUser = false;

    // Ensure 'followers' and 'following' arrays exist on userData for safe access
    const currentUserFollowers = Array.isArray(userData.followers) ? userData.followers : [];
    const currentUserFollowing = Array.isArray(userData.following) ? userData.following : [];

    // Step 1: Ensure 'friends' in friendships subcollection are mutual follows
    const friendshipsRef = userDoc.ref.collection(FRIENDSHIPS_SUBCOLLECTION);
    const friendsSnapshot = await friendshipsRef.where('status', '==', 'friends').get();
    
    for (const friendDoc of friendsSnapshot.docs) {
      const friendId = friendDoc.id;
      if (!currentUserFollowing.includes(friendId)) {
        // Current user should be following this friend
        userProfileUpdates.following = admin.firestore.FieldValue.arrayUnion(friendId);
        madeChangesThisUser = true;
      }
      if (!currentUserFollowers.includes(friendId)) {
        // This friend should be following the current user
        userProfileUpdates.followers = admin.firestore.FieldValue.arrayUnion(friendId);
        madeChangesThisUser = true;
      }
      // Ensure the friend also follows back and has current user as follower
      const friendRef = usersCollectionRef.doc(friendId);
      batch.update(friendRef, {
          following: admin.firestore.FieldValue.arrayUnion(userId),
          followers: admin.firestore.FieldValue.arrayUnion(userId),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Step 2: Ensure mutual follows are marked as 'friends' in friendships subcollection
    for (const followedId of currentUserFollowing) {
      const followedUserDoc = await usersCollectionRef.doc(followedId).get();
      if (followedUserDoc.exists) {
        const followedUserData = followedUserDoc.data();
        const followedUserIsFollowingBack = (Array.isArray(followedUserData.following) ? followedUserData.following : []).includes(userId);

        if (followedUserIsFollowingBack) { // Mutual follow
          const friendshipEntryRef = friendshipsRef.doc(followedId);
          const friendFriendshipEntryRef = usersCollectionRef.doc(followedId).collection(FRIENDSHIPS_SUBCOLLECTION).doc(userId);
          
          const currentFriendshipDoc = await friendshipEntryRef.get();
          if (!currentFriendshipDoc.exists || currentFriendshipDoc.data().status !== 'friends') {
            batch.set(friendshipEntryRef, {
              status: 'friends',
              name: followedUserData.name || null,
              avatarUrl: followedUserData.avatarUrl || null,
              role: followedUserData.role || 'user',
              isVerified: followedUserData.isVerified || false,
              friendsSince: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            madeChangesThisUser = true; 
          }
          const otherFriendshipDoc = await friendFriendshipEntryRef.get();
           if (!otherFriendshipDoc.exists || otherFriendshipDoc.data().status !== 'friends') {
             batch.set(friendFriendshipEntryRef, { 
              status: 'friends',
              name: userData.name || null,
              avatarUrl: userData.avatarUrl || null,
              role: userData.role || 'user',
              isVerified: userData.isVerified || false,
              friendsSince: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }
        }
      }
    }
    
    if (madeChangesThisUser && Object.keys(userProfileUpdates).length > 0) {
      userProfileUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      batch.update(userDoc.ref, userProfileUpdates);
    }
    
    try {
      await batch.commit();
      if (madeChangesThisUser || friendsSnapshot.docs.length > 0 || currentUserFollowing.length > 0) { // Commit if any operations were queued
         console.log(`Batch committed for user ${userId} friendship/follow sync.`);
      }
    } catch (batchError) {
      console.error(`Error committing batch for user ${userId} friendship/follow sync:`, batchError);
    }
  }
  console.log(`Friendship/Follow sync: Processed ${usersProcessed} users.`);
}


async function main() {
  await migrateUserProfilesCoreFields();
  await migrateFriendshipsToFollows();
  console.log('All migration scripts completed.');
  process.exit(0); 
}

main().catch((err) => {
  console.error('Unhandled error running migration scripts:', err);
  process.exit(1); 
});

    
