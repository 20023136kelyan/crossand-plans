import { createPublicHandler } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';

export const GET = createPublicHandler(
  async () => {
    return NextResponse.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  },
  { defaultError: 'Health check failed' }
);

export async function HEAD() {
  // For quick health checks
  return new NextResponse(null, { status: 200 });
}