// src/lib/firebaseAdmin.ts

// Ensure this module is only used on the server
if (typeof window !== 'undefined') {
  throw new Error('This module can only be used on the server side.');
}

import admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';

let adminAppInstance: admin.app.App | null = null;
let firestoreAdminInstance: admin.firestore.Firestore | null = null;
let authAdminInstance: admin.auth.Auth | null = null;
let storageAdminInstance: admin.storage.Storage | null = null;
let appInitialized = false;

const SERVICE_ACCOUNT_KEY_PATH_FALLBACK = './palplanai-firebase.json'; // Or your specific path

function initializeAdminApp() {
  if (admin.apps.length > 0 && admin.apps.some(app => app?.name === 'MACAROOM_ADMIN_APP_INSTANCE')) {
    adminAppInstance = admin.app('MACAROOM_ADMIN_APP_INSTANCE');
    // console.log("[firebaseAdmin] Using existing Firebase Admin app instance:", adminAppInstance.name);
    appInitialized = true;
  } else {
    // console.log("[firebaseAdmin] Attempting Firebase Admin SDK initialization...");
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
    let serviceAccountJson: ServiceAccount | undefined = undefined;
    let credentialsSource = "None";

    if (serviceAccountString && serviceAccountString.trim() !== "" && serviceAccountString.trim() !== "{}") {
      // console.log("[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT environment variable found.");
      try {
        const parsedJson = JSON.parse(serviceAccountString);
        if (!parsedJson.projectId || !parsedJson.privateKey || !parsedJson.clientEmail) {
          console.error("[firebaseAdmin] CRITICAL: Parsed service account JSON from env var is missing essential fields (projectId, privateKey, clientEmail).");
          serviceAccountJson = undefined;
        } else {
          // console.log("[firebaseAdmin] Successfully parsed FIREBASE_SERVICE_ACCOUNT for project:", parsedJson.projectId);
          serviceAccountJson = {
            projectId: parsedJson.projectId,
            privateKey: parsedJson.privateKey,
            clientEmail: parsedJson.clientEmail
          };
          credentialsSource = "Environment Variable (FIREBASE_SERVICE_ACCOUNT)";
        }
      } catch (e: any) {
        console.error('[firebaseAdmin] CRITICAL: Error parsing FIREBASE_SERVICE_ACCOUNT JSON string:', e.message);
        console.error('[firebaseAdmin] Detail: Ensure the env var is a valid JSON. For multi-line private keys, newlines must be escaped (e.g., \\n). Check for trailing commas.');
        serviceAccountJson = undefined;
      }
    } else {
      // console.warn(`[firebaseAdmin] WARNING: FIREBASE_SERVICE_ACCOUNT environment variable is NOT set or is empty/default.`);
    }

    if (!serviceAccountJson && SERVICE_ACCOUNT_KEY_PATH_FALLBACK) {
      // console.warn(`[firebaseAdmin] Credentials not loaded from env var. Attempting to load from fallback file: ${SERVICE_ACCOUNT_KEY_PATH_FALLBACK}`);
      try {
        const fs = require('fs');
        const path = require('path');
        const absolutePath = path.resolve(SERVICE_ACCOUNT_KEY_PATH_FALLBACK);
        if (fs.existsSync(absolutePath)) {
          const rawFileContent = fs.readFileSync(absolutePath, 'utf8');
          const parsedJson = JSON.parse(rawFileContent);
          if (!parsedJson.projectId || !parsedJson.privateKey || !parsedJson.clientEmail) {
            console.error(`[firebaseAdmin] CRITICAL: Parsed service account JSON from file ${absolutePath} is missing essential fields.`);
            serviceAccountJson = undefined;
          } else {
            // console.log(`[firebaseAdmin] Successfully loaded and parsed service account from file: ${absolutePath}. Project ID: ${parsedJson.projectId}`);
            serviceAccountJson = {
              projectId: parsedJson.projectId,
              privateKey: parsedJson.privateKey,
              clientEmail: parsedJson.clientEmail
            };
            credentialsSource = `File Path (${absolutePath})`;
          }
        } else {
          // console.warn(`[firebaseAdmin] Fallback service account file not found at: ${absolutePath}`);
        }
      } catch (fileError: any) {
        // console.warn(`[firebaseAdmin] Could not load service account from fallback path ${SERVICE_ACCOUNT_KEY_PATH_FALLBACK}. Error: ${fileError.message}`);
        serviceAccountJson = undefined;
      }
    }

    if (!serviceAccountJson && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // console.warn("[firebaseAdmin] No service account JSON loaded, and GOOGLE_APPLICATION_CREDENTIALS not set. Attempting to initialize with Application Default Credentials (ADC)...");
      credentialsSource = "Application Default Credentials (Attempt)";
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !serviceAccountJson) {
      credentialsSource = "GOOGLE_APPLICATION_CREDENTIALS environment variable";
      // console.log("[firebaseAdmin] Using GOOGLE_APPLICATION_CREDENTIALS environment variable.");
    }

    const appOptions: admin.AppOptions = {};
    if (serviceAccountJson) {
      appOptions.credential = admin.credential.cert(serviceAccountJson);
    }

    let effectiveStorageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!effectiveStorageBucket) {
      const inferredProjectId = serviceAccountJson?.projectId || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
      if (inferredProjectId) {
        effectiveStorageBucket = `${inferredProjectId}.appspot.com`;
        // console.log(`[firebaseAdmin] Inferred storage bucket: ${effectiveStorageBucket}`);
      }
    }
    if (effectiveStorageBucket) {
      appOptions.storageBucket = effectiveStorageBucket;
      // console.log(`[firebaseAdmin] Using storage bucket in appOptions: ${effectiveStorageBucket}`);
    } else {
      // console.warn("[firebaseAdmin] WARNING: Could not determine storage bucket for appOptions. Storage operations might rely on default or fail.");
    }

    try {
      adminAppInstance = admin.initializeApp(appOptions, 'MACAROOM_ADMIN_APP_INSTANCE');
      // console.log(`[firebaseAdmin] Initialized new Firebase Admin app instance: MACAROOM_ADMIN_APP_INSTANCE. Credentials via: ${credentialsSource}. Project ID: ${adminAppInstance.options.projectId}`);
      appInitialized = true;
    } catch (error: any) {
      console.error('[firebaseAdmin] CRITICAL: Error during admin.initializeApp():', error.message);
      // console.error('[firebaseAdmin] Credentials source attempted:', credentialsSource);
      // if (credentialsSource.startsWith("Environment Variable") && serviceAccountString) console.error('[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT (partial):', serviceAccountString.substring(0, 250) + "...");
      adminAppInstance = null;
      appInitialized = false;
    }
  }

  if (adminAppInstance && appInitialized) {
    try {
      firestoreAdminInstance = admin.firestore(adminAppInstance);
      // console.log("[firebaseAdmin] Firestore service instance obtained. Has collection method:", typeof firestoreAdminInstance?.collection === 'function');
    } catch (e: any) {
      console.error("[firebaseAdmin] CRITICAL: Failed to obtain Firestore service instance:", e.message);
      firestoreAdminInstance = null;
    }
    try {
      authAdminInstance = admin.auth(adminAppInstance);
      // console.log("[firebaseAdmin] Auth service instance obtained. Has verifyIdToken method:", typeof authAdminInstance?.verifyIdToken === 'function');
    } catch (e: any) {
      console.error("[firebaseAdmin] CRITICAL: Failed to obtain Auth service instance:", e.message);
      authAdminInstance = null;
    }
    try {
      storageAdminInstance = admin.storage(adminAppInstance);
      // console.log("[firebaseAdmin] Storage service instance obtained. Has bucket method:", typeof storageAdminInstance?.bucket === 'function');
    } catch (e: any) {
      console.error("[firebaseAdmin] CRITICAL: Failed to obtain Storage service instance:", e.message);
      storageAdminInstance = null;
    }
  } else if (!adminAppInstance && !appInitialized) {
    // console.error("[firebaseAdmin] CRITICAL: Firebase Admin App instance is null AND appInitialized is false after attempting initialization. Services will NOT be available.");
  }
}

if (!appInitialized) {
  initializeAdminApp();
}

export const firestoreAdmin = firestoreAdminInstance;
export const authAdmin = authAdminInstance;
export const storageAdmin = storageAdminInstance;
export { adminAppInstance as firebaseAdminApp };
