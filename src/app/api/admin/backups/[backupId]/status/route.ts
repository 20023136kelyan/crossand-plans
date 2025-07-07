import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { verifyAdminAuth } from '@/lib/auth/adminAuth';
import { Firestore } from 'firebase-admin/firestore';

export async function GET(request: NextRequest, { params }: { params: Promise<{ backupId: string }> }) {
  const { backupId } = await params;
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    if (!firestoreAdmin) {
      return NextResponse.json({ error: 'Firestore not initialized' }, { status: 500 });
    }

    if (!backupId) {
      return NextResponse.json({ error: 'Backup ID is required' }, { status: 400 });
    }

    const db = firestoreAdmin as Firestore;

    try {
      // Get backup record from Firestore
      const backupDoc = await db.collection('backups').doc(backupId).get();
      
      if (!backupDoc.exists) {
        return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
      }

      const backupData = backupDoc.data();
      
      if (!backupData) {
        return NextResponse.json({ error: 'Invalid backup data' }, { status: 500 });
      }

      // Return backup status information
      const status = {
        id: backupId,
        status: backupData.status || 'unknown',
        progress: backupData.progress || 0,
        startedAt: backupData.startedAt?.toDate?.()?.toISOString() || backupData.startedAt,
        completedAt: backupData.completedAt?.toDate?.()?.toISOString() || backupData.completedAt,
        error: backupData.error || null,
        size: backupData.size || 0,
        duration: backupData.duration || 0,
        collectionsProcessed: backupData.collectionsProcessed || 0,
        totalCollections: backupData.totalCollections || 0,
        currentCollection: backupData.currentCollection || null,
        metadata: backupData.metadata || {}
      };

      return NextResponse.json(status);
    } catch (error) {
      console.error('Error fetching backup status:', error);
      return NextResponse.json(
        { error: 'Failed to fetch backup status' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Backup status API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}