import { createAuthenticatedHandler, getQueryParams } from '@/lib/api/middleware';
import { getPersonalizedRecommendations } from '@/services/recommendationService.admin';
import { getUserPreferencesAction } from '@/app/actions/userActions';
import { NextResponse } from 'next/server';

export const GET = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    const { params, error } = getQueryParams(request, {
      limit: { required: false, defaultValue: '20' }
    });
    if (error) return error;

    const limit = parseInt(params.limit!) || 20;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: 'Invalid limit. Must be between 1 and 50' },
        { status: 400 }
      );
    }

    // Get user preferences
    const userPreferences = await getUserPreferencesAction(authResult.userId);

    // Get personalized recommendations
    const recommendations = await getPersonalizedRecommendations(
      authResult.userId,
      userPreferences || undefined,
      limit
    );

    return NextResponse.json(recommendations);
  },
  { defaultError: 'Failed to get recommendations' }
);