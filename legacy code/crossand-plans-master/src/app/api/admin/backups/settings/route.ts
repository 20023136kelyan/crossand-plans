import { NextRequest, NextResponse } from 'next/server';
import { getBackupSettings, updateBackupSettings } from '@/services/backupService.admin';
import { verifyAdminAuth } from '@/lib/auth/adminAuth';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const settings = await getBackupSettings();
    return NextResponse.json({ settings });

  } catch (error) {
    console.error('Error fetching backup settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }
    
    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json({ error: 'Settings data required' }, { status: 400 });
    }

    await updateBackupSettings(settings, authResult.userId);
    return NextResponse.json({ success: true, message: 'Backup settings updated successfully' });

  } catch (error) {
    console.error('Error updating backup settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}