import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebaseAdmin';
import { denyFollowRequestAdmin } from '@/services/userService.server';

export async function POST(request: NextRequest) {
  try {
    const { requesterId } = await request.json();
    
    if (!requesterId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameter: requesterId' 
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

    if (currentUserId === requesterId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot deny your own follow request' 
      }, { status: 400 });
    }

    // Deny the follow request
    await denyFollowRequestAdmin(currentUserId, requesterId);

    return NextResponse.json({ 
      success: true, 
      message: 'Follow request denied' 
    });

  } catch (error) {
    console.error('Deny follow request error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
} 