import { createAuthenticatedHandler, parseRequestBody, getQueryParams } from '@/lib/api/middleware';
import { getCompletionStatus, getBulkCompletionStatus } from '../../../services/planCompletionService.server';
import { NextResponse } from 'next/server';

/**
 * GET /api/completion-status
 * Get completion status for one or more plans
 * 
 * Query parameters:
 * - planId: string (for single plan)
 * - planIds: string[] (for multiple plans, comma-separated)
 * - Authorization header with Bearer token required
 */
export const GET = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    const { params, error } = getQueryParams(request, {
      planId: { required: false },
      planIds: { required: false }
    });
    if (error) return error;

    const { planId, planIds } = params;

    if (planId) {
      // Single plan request
      const status = await getCompletionStatus(planId, authResult.userId);
      if (!status) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }
      return NextResponse.json({ status });
    }

    if (planIds) {
      // Multiple plans request
      const planIdArray = planIds.split(',').filter((id: string) => id.trim());
      if (planIdArray.length === 0) {
        return NextResponse.json({ error: 'No valid plan IDs provided' }, { status: 400 });
      }

      const statuses = await getBulkCompletionStatus(planIdArray, authResult.userId);
      return NextResponse.json({ statuses });
    }

    return NextResponse.json(
      { error: 'Either planId or planIds parameter required' },
      { status: 400 }
    );
  },
  { defaultError: 'Failed to get completion status' }
);

/**
 * POST /api/completion-status/refresh
 * Force refresh completion status cache for specific plans
 * Useful after completion actions to ensure UI is up-to-date
 */
export const POST = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { planIds } = body;

    if (!Array.isArray(planIds) || planIds.length === 0) {
      return NextResponse.json({ error: 'planIds array required' }, { status: 400 });
    }

    // Get fresh completion status for all requested plans
    const statuses = await getBulkCompletionStatus(planIds, authResult.userId);
    
    return NextResponse.json({ 
      message: 'Completion status refreshed',
      statuses 
    });
  },
  { defaultError: 'Failed to refresh completion status' }
);