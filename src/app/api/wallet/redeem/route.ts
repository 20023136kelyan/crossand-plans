import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthWithUserData } from '@/lib/auth/authHelpers';
import { redeemReward } from '@/services/walletService';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await verifyAuthWithUserData(request);

    const { rewardId, cost } = await request.json();

    if (!rewardId) {
      return NextResponse.json({ error: 'Reward ID is required' }, { status: 400 });
    }

    // Get reward details from request body
    const pointsCost = cost || 0;

    if (!pointsCost || pointsCost <= 0) {
      return NextResponse.json({ error: 'Invalid reward cost' }, { status: 400 });
    }

    // Use the wallet service to redeem the reward
    const result = await redeemReward(userId, rewardId, pointsCost);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: result.message
    });

  } catch (error) {
    console.error('Error redeeming reward:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}