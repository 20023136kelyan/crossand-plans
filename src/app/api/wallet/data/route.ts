import { createAuthenticatedHandler } from '@/lib/api/middleware';
import { getUserWalletData } from '@/services/walletService';
import { NextResponse } from 'next/server';

export const GET = createAuthenticatedHandler(
  async ({ authResult }) => {
    const walletData = await getUserWalletData(authResult.userId);
    return NextResponse.json(walletData);
  },
  { defaultError: 'Failed to fetch wallet data' }
);