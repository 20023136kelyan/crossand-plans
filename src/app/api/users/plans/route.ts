import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/lib/firebaseAdmin';
import { getUserProfileAdmin } from '@/services/userService.server';
import { getUserPlansAdmin } from '@/services/planService.server';
import { Plan } from '@/types/plan';

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

    // Get the target user's profile
    const targetUserProfile = await getUserProfileAdmin(targetUserId);
    if (!targetUserProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check privacy settings (we'll implement this later)
    // For now, allow viewing if user is viewing their own profile or if plans list is public
    const isOwnProfile = currentUserId === targetUserId;
    
    try {
      // Get user's plans using the existing admin service
      const userPlans = await getUserPlansAdmin(targetUserId);
      
      // Filter plans based on privacy settings (for now, show all public plans)
      const publicPlans = userPlans.filter((plan: Plan) => {
        // If it's the user's own profile, show all plans
        if (isOwnProfile) return true;
        
        // Otherwise, only show public plans (assuming plans have a visibility field)
        // For now, we'll show all plans since privacy isn't fully implemented yet
        return true;
      });

      // Return basic plan information
      const plansData = publicPlans.map((plan: Plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        eventTime: plan.eventTime,
        location: plan.location,
        eventType: plan.eventType,
        hostId: plan.hostId,
        hostName: plan.hostName,
        hostAvatarUrl: plan.hostAvatarUrl,
        participantCount: plan.participantUserIds?.length || 0,
        maxParticipants: plan.rsvpSettings?.maxParticipants,
        createdAt: plan.createdAt
      }));

      return NextResponse.json({ plans: plansData });
    } catch (error) {
      console.error('Error fetching user plans:', error);
      return NextResponse.json({ plans: [] });
    }
  } catch (error) {
    console.error('Error in user plans API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}