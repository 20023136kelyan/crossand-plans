import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth/adminAuth';
import { getModerationReports, getModerationStats } from '@/services/moderationService.admin';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const startAfter = searchParams.get('startAfter') || undefined;

    // Get moderation reports using the service
    const reports = await getModerationReports(
      { status: status as any, type: type as any, priority: priority as any },
      limit,
      startAfter
    );

    // Get summary statistics
    const stats = await getModerationStats();

    return NextResponse.json({
      reports,
      stats
    });

  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { reportId, action, status, assignedTo } = await request.json();

    if (!reportId || !action) {
      return NextResponse.json({ error: 'Report ID and action are required' }, { status: 400 });
    }

    // Import the moderation service functions
    const { updateModerationReportStatus, assignModerationReport } = await import('@/services/moderationService.admin');

    // Handle different actions
    if (action === 'updateStatus' && status) {
      await updateModerationReportStatus(reportId, status, authResult.user.uid);
    } else if (action === 'assign' && assignedTo) {
      await assignModerationReport(reportId, assignedTo, authResult.user.uid);
    } else {
      return NextResponse.json({ error: 'Invalid action or missing parameters' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Report updated successfully' });
  } catch (error) {
    console.error('Error updating moderation report:', error);
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }
}