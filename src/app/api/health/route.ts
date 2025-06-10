import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    // Basic health check
    return NextResponse.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Health check failed' },
      { status: 500 }
    );
  }
}

export async function HEAD() {
  // For quick health checks
  return new NextResponse(null, { status: 200 });
}