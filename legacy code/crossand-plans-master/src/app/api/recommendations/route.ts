import { NextRequest, NextResponse } from 'next/server';
import { getPersonalizedRecommendations } from '@/services/recommendationService.admin';
import { getUserPreferencesAction } from '@/app/actions/userActions';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: 'Invalid limit. Must be between 1 and 50' },
        { status: 400 }
      );
    }

    // Get user preferences
    const userPreferences = await getUserPreferencesAction(session.user.id);

    // Get personalized recommendations
    const recommendations = await getPersonalizedRecommendations(
      session.user.id,
      userPreferences,
      limit
    );

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error('[GET /api/recommendations] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}