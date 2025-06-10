import { NextRequest, NextResponse } from 'next/server';
import { logSearchResultClick } from '@/services/searchAnalyticsService.admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      searchTerm,
      resultType,
      resultId,
      position,
      sessionId,
      timestamp
    } = body;

    // Validate required fields
    if (!searchTerm || !resultType || !resultId || typeof position !== 'number' || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: searchTerm, resultType, resultId, position, sessionId' },
        { status: 400 }
      );
    }

    // Validate result type
    if (!['person', 'plan', 'collection'].includes(resultType)) {
      return NextResponse.json(
        { error: 'Invalid resultType. Must be person, plan, or collection' },
        { status: 400 }
      );
    }

    // Validate position
    if (position < 0) {
      return NextResponse.json(
        { error: 'Position must be a non-negative number' },
        { status: 400 }
      );
    }

    // Log the search result click
    const success = await logSearchResultClick(
      searchTerm,
      resultType,
      resultId,
      position,
      sessionId
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to log search result click' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/analytics/click] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}