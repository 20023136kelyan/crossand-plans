import { canonicalCategories, Category } from '../src/data/canonicalCategories';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Prefer .env.local if it exists, otherwise use .env
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  console.log('Loaded environment variables from .env.local');
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('Loaded environment variables from .env');
} else {
  dotenv.config(); // fallback
  console.warn('No .env or .env.local found, using process.env only');
}

// Initialize Firebase Admin SDK using either a single JSON string or individual env variables
if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Parse the JSON string
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Initialized Firebase Admin with FIREBASE_SERVICE_ACCOUNT JSON string.');
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Initialized Firebase Admin with individual env variables.');
  } else {
    throw new Error('Missing Firebase credentials in environment variables.');
  }
}

const db = admin.firestore();
const COLLECTION = 'categories';

async function wipeCollection(collectionPath: string) {
  const snapshot = await db.collection(collectionPath).get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`[WIPED] All documents deleted from '${collectionPath}' collection.`);
}

function flattenCategories(categories: Category[], parentId?: string): any[] {
  let flat: any[] = [];
  for (const cat of categories) {
    const { subcategories, ...catData } = cat;
    flat.push({ ...catData, parentId: parentId || null });
    if (subcategories && subcategories.length > 0) {
      flat = flat.concat(flattenCategories(subcategories, cat.id));
    }
  }
  return flat;
}

async function populateCategories() {
  console.log('Starting category population...');
  await wipeCollection(COLLECTION);

  const flatCategories = flattenCategories(canonicalCategories);
  const batch = db.batch();

  for (const cat of flatCategories) {
    const docRef = db.collection(COLLECTION).doc(cat.id);
    batch.set(docRef, cat);
  }

  await batch.commit();
  console.log(`[DONE] Populated '${COLLECTION}' collection with ${flatCategories.length} categories.`);
}

populateCategories()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error populating categories:', err);
    process.exit(1);
  }); 