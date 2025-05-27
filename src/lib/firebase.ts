// src/lib/firebase.ts (CLIENT SDK INITIALIZATION)
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore, Timestamp as ClientTimestamp, serverTimestamp as firestoreClientServerTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let firebaseInitialized = false;

// Initialize Firebase
const initFirebase = () => {
  let firebaseApp: FirebaseApp;

  if (typeof window !== 'undefined') {
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      try {
        if (!getApps().length) {
          firebaseApp = initializeApp(firebaseConfig);
        } else {
          firebaseApp = getApp();
        }
        firebaseInitialized = true;

        // Initialize services
        try {
          auth = getAuth(firebaseApp);
        } catch (e: any) {
          console.warn("[firebase.ts client] WARNING: Error getting Firebase Auth instance. Auth features might be unavailable.", e.message);
          auth = null;
        }

        try {
          db = getFirestore(firebaseApp);
        } catch (e: any) {
          console.warn("[firebase.ts client] WARNING: Error getting Firestore instance. Database features might be unavailable.", e.message);
          db = null;
        }

        try {
          googleProvider = new GoogleAuthProvider();
        } catch (e: any) {
          console.warn("[firebase.ts client] WARNING: Error creating GoogleAuthProvider instance.", e.message);
          googleProvider = null;
        }

        return firebaseApp;
      } catch (e: any) {
        console.warn("[firebase.ts client] WARNING: Error initializing Firebase app. Firebase features might be unavailable.", e.message);
        firebaseInitialized = false;
        return null;
      }
    } else {
      console.warn(
        "[firebase.ts client] CRITICAL: Firebase API Key or Project ID is missing for client-side initialization. " +
        "Ensure NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variables are correctly set and accessible via process.env. Firebase features will be unavailable."
      );
      if (!firebaseConfig.apiKey) console.warn("[firebase.ts client] NEXT_PUBLIC_FIREBASE_API_KEY is missing or undefined.");
      if (!firebaseConfig.projectId) console.warn("[firebase.ts client] NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing or undefined.");
      return null;
    }
  }
  return null;
};

export const app = initFirebase();
export const serverTimestamp = firestoreClientServerTimestamp;
export { auth, googleProvider, db, ClientTimestamp, firebaseInitialized };
