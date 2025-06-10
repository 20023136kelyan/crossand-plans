import { NextRequest, NextResponse } from 'next/server';
import { getBackups, createBackup, deleteBackup, restoreFromBackup } from '@/services/backupService.admin';
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

    const backups = await getBackups();
    return NextResponse.json({ backups });

  } catch (error) {
    console.error('Error fetching backups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    const { action, backupId, name, type, collections } = body;

    if (action === 'create') {
      const backupId = await createBackup(
        name || `Manual Backup - ${new Date().toLocaleString()}`,
        type || 'full',
        collections || ['users', 'plans', 'subscriptions', 'messages'],
        authResult.userId
      );

      return NextResponse.json({ 
        success: true, 
        message: 'Backup started successfully',
        backupId
      });
    }

    if (action === 'restore' && backupId) {
      const restoreId = await restoreFromBackup(backupId, authResult.userId);

      return NextResponse.json({ 
        success: true, 
        message: 'Restore process started successfully',
        restoreId
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error processing backup action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const url = new URL(request.url);
    const backupId = url.searchParams.get('id');

    if (!backupId) {
      return NextResponse.json({ error: 'Backup ID required' }, { status: 400 });
    }
    
    await deleteBackup(backupId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Backup deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting backup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}