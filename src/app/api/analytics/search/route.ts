import { NextRequest, NextResponse } from 'next/server';
import { logSearchEvent } from '@/services/searchAnalyticsService.admin';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    
    const {
      searchTerm,
      resultCounts,
      sessionId,
      timestamp
    } = body;

    // Validate required fields
    if (!searchTerm || !resultCounts || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: searchTerm, resultCounts, sessionId' },
        { status: 400 }
      );
    }

    // Validate result counts structure
    if (
      typeof resultCounts.people !== 'number' ||
      typeof resultCounts.plans !== 'number' ||
      typeof resultCounts.collections !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Invalid resultCounts structure' },
        { status: 400 }
      );
    }

    // Get user agent and basic location info from headers
    const userAgent = request.headers.get('user-agent') || undefined;
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const clientIp = forwardedFor?.split(',')[0] || realIp || 'unknown';
    
    // Get basic location info (you might want to use a geolocation service here)
    const acceptLanguage = request.headers.get('accept-language');
    const location = acceptLanguage ? {
      city: 'Unknown',
      country: acceptLanguage.split(',')[0]?.split('-')[1] || 'Unknown'
    } : undefined;

    // Log the search event
    const success = await logSearchEvent(
      searchTerm,
      resultCounts,
      session?.user?.id,
      sessionId,
      userAgent,
      location
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to log search event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/analytics/search] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}