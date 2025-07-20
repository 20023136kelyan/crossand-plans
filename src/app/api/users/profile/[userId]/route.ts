import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebaseAdmin';
import { getUserProfileAdmin } from '@/services/userService.server';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId?: string } }
) {
  try {
    // Get the session cookie from the request
    const sessionCookie = request.cookies.get('session')?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "No session cookie found" }, { status: 401 });
    }

    // Verify the session cookie with Firebase Admin
    if (!authAdmin) {
      console.error('[/api/users/profile/[userId]] Firebase Admin SDK not initialized');
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    let decodedClaims;
    try {
      decodedClaims = await (authAdmin as any).verifySessionCookie(sessionCookie, true);
    } catch (error) {
      console.error('[/api/users/profile/[userId]] Invalid session cookie:', error);
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const currentUserId = decodedClaims.uid;
    // Await params before accessing userId
    const { userId: requestedUserId } = await params;

    // Check if userId is provided
    if (!requestedUserId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Get the requested user profile
    const userProfile = await getUserProfileAdmin(requestedUserId);
    
    if (!userProfile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // Return a sanitized version of the profile (remove sensitive data)
    const sanitizedProfile = {
      uid: userProfile.uid,
      name: userProfile.name,
      username: userProfile.username,
      avatarUrl: userProfile.avatarUrl,
      bio: userProfile.bio,
      role: userProfile.role,
      isVerified: userProfile.isVerified,
      createdAt: userProfile.createdAt,
      // Only include followers/following counts, not the full arrays
      followersCount: userProfile.followers?.length || 0,
      followingCount: userProfile.following?.length || 0,
      // Include basic location info if available
      physicalAddress: userProfile.physicalAddress ? {
        city: userProfile.physicalAddress.city,
        state: userProfile.physicalAddress.state,
        country: userProfile.physicalAddress.country
      } : null
    };

    return NextResponse.json({ profile: sanitizedProfile });
  } catch (error) {
    console.error('[/api/users/profile/[userId]] Error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 