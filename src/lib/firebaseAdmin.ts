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
let messagingAdminInstance: admin.messaging.Messaging | null = null;
let appInitialized = false;

function initializeFirebaseServices(app: admin.app.App): boolean {
  try {
    if (!app) throw new Error('App instance is null');

    // Initialize Firestore
    const firestore = app.firestore();
    if (!firestore) throw new Error('Failed to initialize Firestore');
    firestoreAdminInstance = firestore;

    
    // Initialize Auth
    const auth = app.auth();
    if (!auth) throw new Error('Failed to initialize Auth');
    authAdminInstance = auth;

    
    // Initialize Storage
    const storage = app.storage();
    if (!storage) throw new Error('Failed to initialize Storage');
    storageAdminInstance = storage;


    // Initialize Messaging
    const messaging = app.messaging();
    if (!messaging) throw new Error('Failed to initialize Messaging');
    messagingAdminInstance = messaging;

    
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
  
      if (initializeFirebaseServices(existingApp)) {
        appInitialized = true;
        return;
      }
    }

    // Get and validate service account
    const serviceAccountJson = getServiceAccount();
    

    // Initialize app with credentials
    const appOptions: admin.AppOptions = {
      credential: admin.credential.cert(serviceAccountJson),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${serviceAccountJson.projectId}.appspot.com`
    };

    // Initialize the app
    const app = admin.initializeApp(appOptions, 'MACAROOM_ADMIN_APP_INSTANCE');
    if (!app) throw new Error('Failed to initialize Firebase Admin app');
    
    adminAppInstance = app;
    

    // Initialize services
    if (initializeFirebaseServices(app)) {
      appInitialized = true;

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
  
      initializeAdminApp();
      
    }
  } catch (error) {
    console.error('[firebaseAdmin] Failed to initialize Firebase Admin SDK:', error);
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      
      setTimeout(() => initializeWithRetry(), 1000); // Add delay between retries
    } else {
      console.error('[firebaseAdmin] Maximum retry attempts reached. Firebase Admin SDK initialization failed.');
      // Set instances to null to ensure proper error handling
      firestoreAdminInstance = null;
      authAdminInstance = null;
      storageAdminInstance = null;
    }
  }
}

initializeWithRetry();

// Export instances with proper typing and safety checks
export const firestoreAdmin = firestoreAdminInstance ? (firestoreAdminInstance as Firestore) : null;
export const authAdmin = authAdminInstance ? (authAdminInstance as admin.auth.Auth) : null;
export const storageAdmin = storageAdminInstance ? (storageAdminInstance as admin.storage.Storage) : null;
export const messagingAdmin = messagingAdminInstance ? (messagingAdminInstance as admin.messaging.Messaging) : null;
export { adminAppInstance as firebaseAdminApp };

// Helper function to ensure Firebase Admin is initialized
export function ensureFirebaseAdminInitialized(): boolean {
  if (!appInitialized || !firestoreAdminInstance || !authAdminInstance) {
    console.error('[firebaseAdmin] Firebase Admin SDK is not properly initialized');

    try {
      initializeWithRetry();
      return appInitialized && !!firestoreAdminInstance && !!authAdminInstance;
    } catch (error) {
      console.error('[firebaseAdmin] Re-initialization failed:', error);
      return false;
    }
  }
  return true;
}

// Log initialization status for debugging

