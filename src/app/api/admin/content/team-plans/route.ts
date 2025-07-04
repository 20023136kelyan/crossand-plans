import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/lib/firebaseAdmin';

// POST /api/admin/content/team-plans - Create new team plan
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin!.verifyIdToken(token);
    
    if (!decodedToken.admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      eventType,
      city,
      location,
      priceRange,
      itinerary
    } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Plan name is required' },
        { status: 400 }
      );
    }

    if (!city?.trim()) {
      return NextResponse.json(
        { error: 'City is required' },
        { status: 400 }
      );
    }

    if (!eventType?.trim()) {
      return NextResponse.json(
        { error: 'Event type is required' },
        { status: 400 }
      );
    }

    // Validate itinerary structure
    if (itinerary && Array.isArray(itinerary)) {
      for (const item of itinerary) {
        if (!item.time || !item.activity || !item.location) {
          return NextResponse.json(
            { error: 'Each itinerary item must have time, activity, and location' },
            { status: 400 }
          );
        }
      }
    }

    const now = new Date();
    // ✅ Templates don't need event times - they are reusable patterns, not scheduled events
    
    const planData = {
      name: name.trim(),
      description: description?.trim() || '',
      eventTime: null, // ✅ Templates have no specific date/time
      eventType: eventType.trim(),
      eventTypeLowercase: eventType.trim().toLowerCase(),
      city: city.trim(),
      location: location?.trim() || '',
      priceRange: priceRange?.trim() || '',
      itinerary: itinerary || [],
      
      // Team plan specific fields
      hostId: 'crossand-team',
      hostName: 'Crossand Team',
      creatorName: 'Crossand Team',
      creatorAvatarUrl: null, // ✅ Crossand Team doesn't need avatar (can be handled in UI)
      creatorIsVerified: true, // ✅ Crossand Team is always verified
      isTeamPlan: true,
      isTemplate: true, // Mark as template plan
      
      // Required fields for Plan type
      invitedParticipantUserIds: [],
      participantResponses: {},
      planType: itinerary && itinerary.length > 1 ? 'multi-stop' : 'single-stop',
      originalPlanId: null,
      sharedByUid: null,
      
      // Default values
      status: 'published',
      averageRating: null,
      reviewCount: 0,
      photoHighlights: [],
      
      // Timestamps
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      
      // Admin tracking
      createdBy: decodedToken.uid,
      
      // SEO and discovery
      searchKeywords: [
        name.toLowerCase(),
        city.toLowerCase(),
        eventType.toLowerCase(),
        'crossand team',
        'curated'
      ].filter(Boolean)
    };

    const docRef = await firestoreAdmin!.collection('plans').add(planData);

    // Also add to a special team plans collection for easier management
    await firestoreAdmin!.collection('teamPlans').doc(docRef.id).set({
      planId: docRef.id,
      createdAt: now,
      createdBy: decodedToken.uid
    });

    return NextResponse.json({
      success: true,
      planId: docRef.id,
      message: 'Team plan created successfully'
    });
  } catch (error) {
    console.error('Error creating team plan:', error);
    return NextResponse.json(
      { error: 'Failed to create team plan' },
      { status: 500 }
    );
  }
}