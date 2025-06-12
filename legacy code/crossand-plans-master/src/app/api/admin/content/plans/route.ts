import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/lib/firebaseAdmin';
import { Plan } from '@/types/user';

// GET /api/admin/content/plans - Get all published plans for content curation
export async function GET(request: NextRequest) {
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

    // Get published plans only
    const plansSnapshot = await firestoreAdmin!
      .collection('plans')
      .where('status', '==', 'published')
      .orderBy('createdAt', 'desc')
      .limit(500) // Limit to prevent overwhelming the UI
      .get();

    const plans: Plan[] = [];
    plansSnapshot.forEach(doc => {
      const data = doc.data();
      plans.push({
        id: doc.id,
        name: data.name,
        description: data.description,
        eventType: data.eventType,
        city: data.city,
        location: data.location,
        priceRange: data.priceRange,
        status: data.status,
        creatorId: data.creatorId,
        creatorName: data.creatorName,
        averageRating: data.averageRating,
        totalRatings: data.totalRatings,
        photoHighlights: data.photoHighlights || [],
        itinerary: data.itinerary || [],
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      });
    });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}