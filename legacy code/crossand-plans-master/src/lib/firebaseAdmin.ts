// src/lib/firebaseAdmin.ts

// Ensure this module is only used on the server
if (typeof window !== 'undefined') {
  throw new Error('This module can only be used on the server side.');
}

import admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';

let adminAppInstance: admin.app.App | null = null;
let firestoreAdminInstance: Firestore | null = null;
let authAdminInstance: admin.auth.Auth | null = null;
let storageAdminInstance: admin.storage.Storage | null = null;
let appInitialized = false;

function initializeFirebaseServices(app: admin.app.App): boolean {
  try {
    if (!app) throw new Error('App instance is null');

    // Initialize Firestore
    const firestore = app.firestore();
    if (!firestore) throw new Error('Failed to initialize Firestore');
    firestoreAdminInstance = firestore;
    console.log('[firebaseAdmin] Firestore initialized successfully');
    
    // Initialize Auth
    const auth = app.auth();
    if (!auth) throw new Error('Failed to initialize Auth');
    authAdminInstance = auth;
    console.log('[firebaseAdmin] Auth initialized successfully');
    
    // Initialize Storage
    const storage = app.storage();
    if (!storage) throw new Error('Failed to initialize Storage');
    storageAdminInstance = storage;
    console.log('[firebaseAdmin] Storage initialized successfully');
    
    return true;
  } catch (error: any) {
    console.error('[firebaseAdmin] Error initializing Firebase services:', error.message);
    return false;
  }
}

function getServiceAccount(): ServiceAccount {
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

    // Normalize the keys to match ServiceAccount interface
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

function initializeAdminApp(): void {
  try {
    // Check if app is already initialized
    const existingApp = admin.apps.find(app => app?.name === 'MACAROOM_ADMIN_APP_INSTANCE');
    if (existingApp) {
      adminAppInstance = existingApp;
      console.log('[firebaseAdmin] Using existing Firebase Admin app instance');
      if (initializeFirebaseServices(existingApp)) {
        appInitialized = true;
        return;
      }
    }

    // Get and validate service account
    const serviceAccountJson = getServiceAccount();
    console.log(`[firebaseAdmin] Successfully loaded service account for project: ${serviceAccountJson.projectId}`);

    // Initialize app with credentials
    const appOptions: admin.AppOptions = {
      credential: admin.credential.cert(serviceAccountJson),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${serviceAccountJson.projectId}.appspot.com`
    };

    // Initialize the app
    const app = admin.initializeApp(appOptions, 'MACAROOM_ADMIN_APP_INSTANCE');
    if (!app) throw new Error('Failed to initialize Firebase Admin app');
    
    adminAppInstance = app;
    console.log(`[firebaseAdmin] Successfully initialized Firebase Admin app for project: ${serviceAccountJson.projectId}`);

    // Initialize services
    if (initializeFirebaseServices(app)) {
      appInitialized = true;
      console.log('[firebaseAdmin] All Firebase services initialized successfully');
    } else {
      throw new Error('Failed to initialize Firebase services');
    }

  } catch (error: any) {
    console.error('[firebaseAdmin] Critical error initializing Firebase Admin:', error.message);
    adminAppInstance = null;
    firestoreAdminInstance = null;
    authAdminInstance = null;
    storageAdminInstance = null;
    appInitialized = false;
    throw error;
  }
}

// Initialize the app with retry logic
let retryCount = 0;
const MAX_RETRIES = 3;

function initializeWithRetry() {
  try {
    if (!appInitialized) {
      console.log('[firebaseAdmin] Attempting to initialize Firebase Admin SDK (attempt ' + (retryCount + 1) + ')');
      initializeAdminApp();
      console.log('[firebaseAdmin] Firebase Admin SDK initialized successfully');
    }
  } catch (error) {
    console.error('[firebaseAdmin] Failed to initialize Firebase Admin SDK:', error);
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`[firebaseAdmin] Retrying initialization (${retryCount}/${MAX_RETRIES})...`);
      initializeWithRetry();
    } else {
      console.error('[firebaseAdmin] Maximum retry attempts reached. Firebase Admin SDK initialization failed.');
    }
  }
}

initializeWithRetry();

// Export instances
export const firestoreAdmin = firestoreAdminInstance;
export const authAdmin = authAdminInstance;
export const storageAdmin = storageAdminInstance;
export { adminAppInstance as firebaseAdminApp };
