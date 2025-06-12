import { NextRequest } from 'next/server';
import { authAdmin as auth, firestoreAdmin as db } from '@/lib/firebaseAdmin';

interface AuthResult {
  success: boolean;
  userId?: string;
  error?: string;
  status?: number;
}

export async function verifyAdminAuth(request: NextRequest): Promise<AuthResult> {
  try {
    if (!auth || !db) {
      console.error('Firebase Admin services not initialized');
      return {
        success: false,
        error: 'Server configuration error',
        status: 500
      };
    }

    // Get authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Unauthorized - No valid token provided',
        status: 401
      };
    }

    // Extract and verify token
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Check if user exists and is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return {
        success: false,
        error: 'User not found',
        status: 404
      };
    }

    const userData = userDoc.data();
    if (!userData?.isAdmin && userData?.role !== 'admin') {
      return {
        success: false,
        error: 'Admin access required',
        status: 403
      };
    }

    return {
      success: true,
      userId
    };

  } catch (error) {
    console.error('Error verifying admin auth:', error);
    
    // Handle specific Firebase Auth errors
    if (error instanceof Error) {
      if (error.message.includes('auth/id-token-expired')) {
        return {
          success: false,
          error: 'Token expired',
          status: 401
        };
      }
      if (error.message.includes('auth/id-token-revoked')) {
        return {
          success: false,
          error: 'Token revoked',
          status: 401
        };
      }
      if (error.message.includes('auth/invalid-id-token')) {
        return {
          success: false,
          error: 'Invalid token',
          status: 401
        };
      }
    }

    return {
      success: false,
      error: 'Authentication failed',
      status: 401
    };
  }
}

export async function requireAdminAuth(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.success) {
    throw new Error(`${authResult.status}: ${authResult.error}`);
  }
  return authResult.userId!;
}