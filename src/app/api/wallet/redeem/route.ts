import { createAuthenticatedHandler, parseRequestBody } from '@/lib/api/middleware';
import { redeemReward } from '@/services/walletService';
import { NextResponse } from 'next/server';

export const POST = createAuthenticatedHandler(
  async ({ request, authResult }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { rewardId, cost } = body;

    if (!rewardId) {
      return NextResponse.json({ error: 'Reward ID is required' }, { status: 400 });
    }

    const pointsCost = cost || 0;
    if (!pointsCost || pointsCost <= 0) {
      return NextResponse.json({ error: 'Invalid reward cost' }, { status: 400 });
    }

    const result = await redeemReward(authResult.userId, rewardId, pointsCost);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: result.message
    });
  },
  { defaultError: 'Failed to redeem reward' }
);