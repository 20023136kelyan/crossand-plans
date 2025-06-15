import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin, authAdmin } from '@/lib/firebaseAdmin';
import { getUserProfileAdmin } from '@/services/userService.server';

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!authAdmin) {
      return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 500 });
    }
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const currentUserId = decodedToken.uid;

    // Get the target user ID from query params
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get the target user's profile to access followers array
    const targetUserProfile = await getUserProfileAdmin(targetUserId);
    if (!targetUserProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check privacy settings (we'll implement this later)
    // For now, allow viewing if user is viewing their own profile or if followers list is public
    const isOwnProfile = currentUserId === targetUserId;
    
    // Get followers UIDs
    const followerUids = targetUserProfile.followers || [];
    
    if (followerUids.length === 0) {
      return NextResponse.json({ followers: [] });
    }

    // Fetch follower profiles
    const followers = [];
    for (const followerUid of followerUids) {
      try {
        const followerProfile = await getUserProfileAdmin(followerUid);
        if (followerProfile) {
          followers.push({
            uid: followerProfile.uid,
            name: followerProfile.name,
            username: followerProfile.username,
            avatarUrl: followerProfile.avatarUrl,
            isVerified: followerProfile.isVerified,
            role: followerProfile.role
          });
        }
      } catch (error) {
        console.error(`Error fetching follower profile ${followerUid}:`, error);
        // Continue with other followers
      }
    }

    return NextResponse.json({ followers });
  } catch (error) {
    console.error('Error fetching followers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}