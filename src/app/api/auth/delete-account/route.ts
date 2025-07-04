import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { createAuthenticatedHandler, parseRequestBody } from '@/lib/api/middleware';

export const POST = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { password, confirmText } = body;

    // Verify the confirmation text
    if (confirmText !== 'DELETE MY ACCOUNT') {
      return NextResponse.json(
        { error: 'Please type "DELETE MY ACCOUNT" to confirm' },
        { status: 400 }
      );
    }

    // TODO: Verify password (would need to re-authenticate with Firebase Auth)
    // For now, we'll rely on the fact that they have a valid token

    const userId = authResult.userId;

    try {
      // Start a batch operation for cleanup
      const batch = db!.batch();

      // 1. Delete user's plans
      const userPlansQuery = await db!
        .collection('plans')
        .where('userId', '==', userId)
        .get();

      userPlansQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // 2. Delete user's sessions
      const userSessionsQuery = await db!
        .collection('sessions')
        .where('userId', '==', userId)
        .get();

      userSessionsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // 3. Delete user's reports (as reporter)
      const userReportsQuery = await db!
        .collection('reports')
        .where('reportingUserId', '==', userId)
        .get();

      userReportsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // 4. Delete user's followers and following relationships
      const followersRef = db!.collection('followers').doc(userId);
      const followingRef = db!.collection('following').doc(userId);
      batch.delete(followersRef);
      batch.delete(followingRef);

      // 5. Delete user profile
      const userRef = db!.collection('users').doc(userId);
      batch.delete(userRef);

      // Commit all deletions
      await batch.commit();

      // 6. Delete user from Firebase Auth
      if (authAdmin) {
        await authAdmin.deleteUser(userId);
      }

      return NextResponse.json({
        success: true,
        message: 'Account deleted successfully'
      });

    } catch (cleanupError) {
      console.error('Error during account cleanup:', cleanupError);
      
      // Try to delete from Firebase Auth even if Firestore cleanup failed
      try {
        if (authAdmin) {
          await authAdmin.deleteUser(userId);
        }
      } catch (authError) {
        console.error('Error deleting user from Firebase Auth:', authError);
      }

      return NextResponse.json(
        { 
          error: 'Account deletion completed with some cleanup errors',
          details: 'Your authentication has been removed, but some data cleanup may be incomplete'
        },
        { status: 207 } // Multi-status
      );
    }
  },
  { defaultError: 'Failed to delete account' }
);
