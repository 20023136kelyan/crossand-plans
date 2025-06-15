import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin, authAdmin } from '@/lib/firebaseAdmin';
import { getUserProfileAdmin } from '@/services/userService.server';

export async function GET(request: NextRequest) {
  try {
    console.log('[Following API] Request received');
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Following API] No authorization header found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!authAdmin) {
      console.log('[Following API] Auth admin not available');
      return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 500 });
    }
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const currentUserId = decodedToken.uid;
    console.log('[Following API] Current user ID:', currentUserId);

    // Get the target user ID from query params
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    console.log('[Following API] Target user ID:', targetUserId);
    
    if (!targetUserId) {
      console.log('[Following API] No target user ID provided');
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get the target user's profile to access following array
    const targetUserProfile = await getUserProfileAdmin(targetUserId);
    if (!targetUserProfile) {
      console.log('[Following API] Target user profile not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('[Following API] Target user profile found, following array length:', targetUserProfile.following?.length || 0);

    // Check privacy settings (we'll implement this later)
    // For now, allow viewing if user is viewing their own profile or if following list is public
    const isOwnProfile = currentUserId === targetUserId;
    
    // Get following UIDs
    const followingUids = targetUserProfile.following || [];
    console.log('[Following API] Following UIDs:', followingUids);
    
    if (followingUids.length === 0) {
      console.log('[Following API] No following found, returning empty array');
      return NextResponse.json({ following: [] });
    }

    // Fetch following profiles
    console.log('[Following API] Starting to fetch following profiles');
    const following = [];
    for (const followingUid of followingUids) {
      try {
        console.log('[Following API] Fetching profile for UID:', followingUid);
        const followingProfile = await getUserProfileAdmin(followingUid);
        if (followingProfile) {
          console.log('[Following API] Profile found for UID:', followingUid, 'Name:', followingProfile.name);
          following.push({
            uid: followingProfile.uid,
            name: followingProfile.name,
            username: followingProfile.username,
            avatarUrl: followingProfile.avatarUrl,
            isVerified: followingProfile.isVerified,
            role: followingProfile.role
          });
        } else {
          console.log('[Following API] No profile found for UID:', followingUid);
        }
      } catch (error) {
        console.error(`[Following API] Error fetching following profile ${followingUid}:`, error);
        // Continue with other following
      }
    }

    console.log('[Following API] Returning following array with length:', following.length);
    return NextResponse.json({ following });
  } catch (error) {
    console.error('Error fetching following:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}