import { NextRequest, NextResponse } from 'next/server';
import { getSearchTrends } from '@/services/searchAnalyticsService.admin';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    // Optional: Restrict access to authenticated users
    // if (!session) {
    //   return NextResponse.json(
    //     { error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid limit. Must be between 1 and 100' },
        { status: 400 }
      );
    }

    const trends = await getSearchTrends(limit);

    return NextResponse.json(trends);
  } catch (error) {
    console.error('[GET /api/analytics/trends] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}