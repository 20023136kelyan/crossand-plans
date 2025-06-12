import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin as db } from '@/lib/firebaseAdmin';
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

    if (!db) {
      console.error('Firestore Admin not initialized');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    // Get security settings from Firestore
    const settingsDoc = await db.collection('settings').doc('security').get();
    
    // Default security settings
    const defaultSettings = {
      enableTwoFactorAuth: false,
      requireStrongPasswords: true,
      maxLoginAttempts: 5,
      lockoutDuration: 30, // minutes
      sessionTimeout: 24, // hours
      enableIpWhitelist: false,
      ipWhitelist: [],
      enableSuspiciousActivityDetection: true,
      enableRealTimeMonitoring: true,
      enableEmailNotifications: true,
      notificationEmail: 'security@crossandplans.com'
    };

    const settings = settingsDoc.exists ? { ...defaultSettings, ...settingsDoc.data() } : defaultSettings;

    return NextResponse.json({ settings });

  } catch (error) {
    console.error('Error fetching security settings:', error);
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

    if (!db) {
      console.error('Firestore Admin not initialized');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json({ error: 'Settings data required' }, { status: 400 });
    }

    // Update security settings in Firestore
    await db.collection('settings').doc('security').set({
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: authResult.userId
    }, { merge: true });

    // Log the security settings change
    await db.collection('securityEvents').add({
      type: 'settings_changed',
      severity: 'medium',
      user: authResult.userId,
      timestamp: new Date().toISOString(),
      description: 'Security settings updated by admin',
      status: 'completed',
      actionBy: authResult.userId
    });

    return NextResponse.json({ success: true, message: 'Security settings updated successfully' });

  } catch (error) {
    console.error('Error updating security settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}