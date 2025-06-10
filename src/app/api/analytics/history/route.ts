import { NextRequest, NextResponse } from 'next/server';
import { getUserSearchHistory, clearUserSearchHistory } from '@/services/searchAnalyticsService.admin';
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
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 200) {
      return NextResponse.json(
        { error: 'Invalid limit. Must be between 1 and 200' },
        { status: 400 }
      );
    }

    const searchHistory = await getUserSearchHistory(session.user.id, limit);

    return NextResponse.json({ searchHistory });
  } catch (error) {
    console.error('[GET /api/analytics/history] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const success = await clearUserSearchHistory(session.user.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to clear search history' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/analytics/history] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}