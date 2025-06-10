import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/authHelpers';
import { getUserWalletData } from '@/services/walletService';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const userId = await verifyAuth(request);

    // Get user's wallet data using the service
    const walletData = await getUserWalletData(userId);

    return NextResponse.json(walletData);

  } catch (error) {
    console.error('Error fetching wallet data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}