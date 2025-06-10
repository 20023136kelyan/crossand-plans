import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth/adminAuth';
import { generateAnalyticsExport, convertToCSV } from '@/services/analyticsService.admin';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    const interval = searchParams.get('interval') || 'daily';

    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    // Validate interval
    if (!['hourly', 'daily', 'weekly', 'monthly'].includes(interval)) {
      return NextResponse.json({ error: 'Invalid interval' }, { status: 400 });
    }

    // Generate analytics data
    const analyticsData = await generateAnalyticsExport({
      from,
      to,
      interval: interval as 'hourly' | 'daily' | 'weekly' | 'monthly'
    });

    // Convert to CSV
    const csvContent = convertToCSV(analyticsData);

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="analytics-export-${from.toISOString().split('T')[0]}-to-${to.toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    console.error('Error exporting analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}