/**
 * Migration script to standardize plan completion tracking
 * Converts isCompleted boolean field to status field
 * 
 * Run with: node scripts/migrate-completion-status.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function migrateCompletionStatus() {
  console.log('Starting plan completion status migration...');
  
  try {
    // Get all plans with isCompleted field
    const plansSnapshot = await db.collection('plans')
      .where('isCompleted', '==', true)
      .get();
    
    console.log(`Found ${plansSnapshot.size} plans with isCompleted=true`);
    
    const batch = db.batch();
    let updateCount = 0;
    
    plansSnapshot.forEach(doc => {
      const planData = doc.data();
      
      // Only update if status is not already 'completed'
      if (planData.status !== 'completed') {
        const planRef = db.collection('plans').doc(doc.id);
        batch.update(planRef, {
          status: 'completed',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        updateCount++;
        console.log(`Queued update for plan ${doc.id}: ${planData.name}`);
      }
    });
    
    if (updateCount > 0) {
      await batch.commit();
      console.log(`Successfully updated ${updateCount} plans to use status='completed'`);
    } else {
      console.log('No plans needed updating - all already have correct status');
    }
    
    // Verify migration
    const verifySnapshot = await db.collection('plans')
      .where('status', '==', 'completed')
      .get();
    
    console.log(`Verification: ${verifySnapshot.size} plans now have status='completed'`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateCompletionStatus()
  .then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });