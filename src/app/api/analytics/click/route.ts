import { createPublicHandler, parseRequestBody } from '@/lib/api/middleware';
import { logSearchResultClick } from '@/services/searchAnalyticsService.admin';
import { NextResponse } from 'next/server';

export const POST = createPublicHandler(
  async ({ request }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;
    
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
  },
  { defaultError: 'Failed to log analytics event' }
);