// src/lib/firebase.ts (CLIENT SDK INITIALIZATION)
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, RecaptchaVerifier, type Auth } from "firebase/auth";
import { getFirestore, type Firestore, Timestamp as ClientTimestamp, serverTimestamp as firestoreClientServerTimestamp } from "firebase/firestore";
import { getMessaging } from 'firebase/messaging';

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
let recaptchaVerifier: RecaptchaVerifier | null = null;
let firebaseInitialized = false;
let recaptchaInitializing = false;
let recaptchaInitialized = false;
let recaptchaContainerId = 0;

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

// Create a unique reCAPTCHA container
const createRecaptchaContainer = (): string => {
  recaptchaContainerId++;
  const containerId = `recaptcha-container-${recaptchaContainerId}`;
  
  // Remove any existing container with this ID
  const existingContainer = document.getElementById(containerId);
  if (existingContainer) {
    existingContainer.remove();
  }
  
  // Create new container
  const container = document.createElement('div');
  container.id = containerId;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);
  
  return containerId;
};

// Initialize reCAPTCHA verifier for phone auth
const initRecaptchaVerifier = async (): Promise<RecaptchaVerifier | null> => {
  if (typeof window === 'undefined' || !auth) {
    console.warn("[firebase.ts client] Cannot initialize reCAPTCHA: window or auth not available");
    return null;
  }

  // Clear any existing verifier
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (e) {
      console.warn("Error clearing existing reCAPTCHA verifier:", e);
    }
    recaptchaVerifier = null;
  }

  recaptchaInitialized = false;
  recaptchaInitializing = true;

  try {
    // Create a unique container for this reCAPTCHA instance
    const containerId = createRecaptchaContainer();
    
    console.log('[firebase.ts] Initializing reCAPTCHA verifier...');
    
    // Create a simple invisible reCAPTCHA verifier
    // Firebase will automatically use the correct site key from your project
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      'size': 'invisible'
    });
    
    console.log('[firebase.ts] Rendering reCAPTCHA...');
    recaptchaVerifier.render().then(() => {
      console.log('reCAPTCHA rendered successfully');
      recaptchaInitialized = true;
      recaptchaInitializing = false;
    }).catch((error) => {
      console.error('[firebase.ts] Failed to render reCAPTCHA:', error);
      recaptchaVerifier = null;
      recaptchaInitialized = false;
      recaptchaInitializing = false;
    });
    
    return recaptchaVerifier;

  } catch (e: any) {
    console.error("[firebase.ts client] ERROR: Failed to create RecaptchaVerifier instance:", e);
    console.error("[firebase.ts client] This might be due to domain authorization or Firebase configuration");
    recaptchaVerifier = null;
    recaptchaInitialized = false;
    recaptchaInitializing = false;
    return null;
  }
};

// Clear reCAPTCHA verifier
const clearRecaptchaVerifier = () => {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (e) {
      console.warn("Error clearing reCAPTCHA verifier:", e);
    }
    recaptchaVerifier = null;
  }
  recaptchaInitialized = false;
  recaptchaInitializing = false;
  
  // Clean up any recaptcha containers
  const containers = document.querySelectorAll('[id^="recaptcha-container-"]');
  containers.forEach(container => {
    try {
      container.remove();
    } catch (e) {
      console.warn("Error removing reCAPTCHA container:", e);
    }
  });
};

export function forceClearAllRecaptcha() {
  console.log('[firebase.ts] Force clearing all reCAPTCHA instances...');
  
  // Clear any existing verifier
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (error) {
      console.log('[firebase.ts] Error clearing existing verifier:', error);
    }
    recaptchaVerifier = null;
  }
  
  recaptchaInitialized = false;
  recaptchaInitializing = false;
  
  // Clear all reCAPTCHA instances from the DOM
  const recaptchaElements = document.querySelectorAll('.grecaptcha-badge, .g-recaptcha, iframe[src*="recaptcha"]');
  recaptchaElements.forEach(element => {
    try {
      element.remove();
    } catch (error) {
      console.log('[firebase.ts] Error removing reCAPTCHA element:', error);
    }
  });
  
  // Clear any global reCAPTCHA objects
  if (typeof window !== 'undefined') {
    // Clear grecaptcha object
    if ((window as any).grecaptcha) {
      try {
        (window as any).grecaptcha.reset();
      } catch (error) {
        console.log('[firebase.ts] Error resetting grecaptcha:', error);
      }
    }
    
    // Clear any cached reCAPTCHA data
    if ((window as any).___grecaptcha_cfg) {
      delete (window as any).___grecaptcha_cfg;
    }
    
    // Clear any other reCAPTCHA related objects
    Object.keys(window).forEach(key => {
      if (key.toLowerCase().includes('recaptcha')) {
        try {
          delete (window as any)[key];
        } catch (error) {
          console.log('[firebase.ts] Error clearing reCAPTCHA key:', key, error);
        }
      }
    });
  }
  
  // Force garbage collection hint
  if (typeof window !== 'undefined' && (window as any).gc) {
    try {
      (window as any).gc();
    } catch (error) {
      // Ignore errors
    }
  }
  
  console.log('[firebase.ts] All reCAPTCHA instances cleared');
}

export const app = initFirebase();
export const messaging = typeof window !== 'undefined' && app ? getMessaging(app) : null;
export const serverTimestamp = firestoreClientServerTimestamp;
export { auth, googleProvider, db, ClientTimestamp, firebaseInitialized, recaptchaVerifier, initRecaptchaVerifier, clearRecaptchaVerifier };
