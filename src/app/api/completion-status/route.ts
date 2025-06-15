import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '../../../lib/firebaseAdmin';
import { getCompletionStatus, getBulkCompletionStatus } from '../../../services/planCompletionService.server';

/**
 * GET /api/completion-status
 * Get completion status for one or more plans
 * 
 * Query parameters:
 * - planId: string (for single plan)
 * - planIds: string[] (for multiple plans, comma-separated)
 * - Authorization header with Bearer token required
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);
    
    if (!authAdmin) {
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 500 }
      );
    }
    
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    const planIdsParam = searchParams.get('planIds');

    if (planId) {
      // Single plan request
      const status = await getCompletionStatus(planId, userId);
      if (!status) {
        return NextResponse.json(
          { error: 'Plan not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ status });
    }

    if (planIdsParam) {
      // Multiple plans request
      const planIds = planIdsParam.split(',').filter(id => id.trim());
      if (planIds.length === 0) {
        return NextResponse.json(
          { error: 'No valid plan IDs provided' },
          { status: 400 }
        );
      }

      const statuses = await getBulkCompletionStatus(planIds, userId);
      return NextResponse.json({ statuses });
    }

    return NextResponse.json(
      { error: 'Either planId or planIds parameter required' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[completion-status API] Error:', error);
    
    if (error instanceof Error && error.message.includes('Firebase ID token')) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/completion-status/refresh
 * Force refresh completion status cache for specific plans
 * Useful after completion actions to ensure UI is up-to-date
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);
    
    if (!authAdmin) {
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 500 }
      );
    }
    
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const body = await request.json();
    const { planIds } = body;

    if (!Array.isArray(planIds) || planIds.length === 0) {
      return NextResponse.json(
        { error: 'planIds array required' },
        { status: 400 }
      );
    }

    // Get fresh completion status for all requested plans
    const statuses = await getBulkCompletionStatus(planIds, userId);
    
    return NextResponse.json({ 
      message: 'Completion status refreshed',
      statuses 
    });

  } catch (error) {
    console.error('[completion-status refresh API] Error:', error);
    
    if (error instanceof Error && error.message.includes('Firebase ID token')) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}