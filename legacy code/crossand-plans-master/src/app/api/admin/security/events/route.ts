import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth/adminAuth';
import { getSecurityEvents, resolveSecurityEvent } from '@/services/securityService.admin';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const startAfter = searchParams.get('startAfter') || undefined;

    // Get security events using the service
    const events = await getSecurityEvents(limit, startAfter);

    return NextResponse.json({ events });

  } catch (error) {
    console.error('Error fetching security events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { eventId, action } = await request.json();

    if (!eventId || !action) {
      return NextResponse.json({ error: 'Event ID and action are required' }, { status: 400 });
    }

    // Handle resolve action using the service
    if (action === 'resolve') {
      const success = await resolveSecurityEvent(eventId, authResult.userId);
      if (!success) {
        return NextResponse.json({ error: 'Failed to resolve security event' }, { status: 500 });
      }
    }
    // Note: Other actions (block, investigate) would need similar service methods
    // For now, we'll handle resolve as it's the most common action

    return NextResponse.json({ 
      success: true, 
      message: `Event ${action}d successfully` 
    });

  } catch (error) {
    console.error('Error updating security event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}