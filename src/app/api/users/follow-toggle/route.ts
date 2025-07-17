import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebaseAdmin';
import { followUserAdmin, unfollowUserAdmin, approveFollowRequestAdmin, denyFollowRequestAdmin, getUserProfileAdmin } from '@/services/userService.server';

export async function POST(request: NextRequest) {
  try {
    const { targetUserId, action } = await request.json();
    
    if (!targetUserId || !action) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters: targetUserId and action' 
      }, { status: 400 });
    }

    if (action !== 'follow' && action !== 'unfollow') {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid action. Must be "follow orunfollow"' 
      }, { status: 400 });
    }

    // Get the current user from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing or invalid authorization header' 
      }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    if (!authAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Server configuration error: Auth service not available'
      }, { status: 500 });
    }
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const currentUserId = decodedToken.uid;

    if (currentUserId === targetUserId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot follow/unfollow yourself' 
      }, { status: 400 });
    }

    // Perform the follow/unfollow action
    if (action === 'follow') {
      await followUserAdmin(currentUserId, targetUserId);
    } else {
      await unfollowUserAdmin(currentUserId, targetUserId);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully ${action}ed user` 
    });

  } catch (error) {
    console.error('Follow toggle error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
} 