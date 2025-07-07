import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { verifyAdminAuth } from '@/lib/auth/adminAuth';
import { Firestore } from 'firebase-admin/firestore';

/**
 * Test Stripe API connection
 */
async function testStripeConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
  if (!apiKey) {
    return { success: false, message: 'Stripe API key not configured' };
  }

  try {
    const response = await fetch('https://api.stripe.com/v1/account', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (response.ok) {
      return { success: true, message: 'Stripe connection successful' };
    } else {
      return { success: false, message: 'Invalid Stripe API key' };
    }
  } catch (error) {
    return { success: false, message: 'Failed to connect to Stripe API' };
  }
}

/**
 * Test SendGrid API connection
 */
async function testSendGridConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
  if (!apiKey) {
    return { success: false, message: 'SendGrid API key not configured' };
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/user/account', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      return { success: true, message: 'SendGrid API key valid' };
    } else {
      return { success: false, message: 'Invalid SendGrid API key' };
    }
  } catch (error) {
    return { success: false, message: 'Failed to connect to SendGrid API' };
  }
}

/**
 * Test Twilio API connection
 */
async function testTwilioConnection(accountSid: string, authToken: string): Promise<{ success: boolean; message: string }> {
  if (!accountSid || !authToken) {
    return { success: false, message: 'Twilio credentials not configured' };
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    });

    if (response.ok) {
      return { success: true, message: 'Twilio connection successful' };
    } else {
      return { success: false, message: 'Invalid Twilio credentials' };
    }
  } catch (error) {
    return { success: false, message: 'Failed to connect to Twilio API' };
  }
}

/**
 * Test Google Calendar API connection
 */
async function testGoogleCalendarConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
  if (!apiKey) {
    return { success: false, message: 'Google Calendar API key not configured' };
  }

  try {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary?key=${apiKey}`);
    
    if (response.ok) {
      return { success: true, message: 'Google Calendar API connected' };
    } else {
      return { success: false, message: 'Invalid Google Calendar API key' };
    }
  } catch (error) {
    return { success: false, message: 'Failed to connect to Google Calendar API' };
  }
}

/**
 * Test Google Maps API connection
 */
async function testGoogleMapsConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
  if (!apiKey) {
    return { success: false, message: 'Google Maps API key not configured' };
  }

  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${apiKey}`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        return { success: true, message: 'Google Maps API connected' };
      } else {
        return { success: false, message: `Google Maps API error: ${data.status}` };
      }
    } else {
      return { success: false, message: 'Invalid Google Maps API key' };
    }
  } catch (error) {
    return { success: false, message: 'Failed to connect to Google Maps API' };
  }
}

/**
 * Test Google Analytics connection
 */
async function testGoogleAnalyticsConnection(trackingId: string, measurementId: string): Promise<{ success: boolean; message: string }> {
  if (!trackingId && !measurementId) {
    return { success: false, message: 'Google Analytics credentials not configured' };
  }

  // For Google Analytics, we can't easily test the connection without proper OAuth
  // So we'll just validate the format of the IDs
  const trackingIdValid = !trackingId || /^UA-\d+-\d+$/.test(trackingId);
  const measurementIdValid = !measurementId || /^G-[A-Z0-9]+$/.test(measurementId);

  if (trackingIdValid && measurementIdValid) {
    return { success: true, message: 'Google Analytics configuration appears valid' };
  } else {
    return { success: false, message: 'Invalid Google Analytics ID format' };
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ integrationId: string }> }) {
  const { integrationId } = await params;
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

    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID is required' }, { status: 400 });
    }

    const db = firestoreAdmin as Firestore;

    try {
      // Get integration from Firestore
      const integrationDoc = await db.collection('integrations').doc(integrationId).get();
      
      if (!integrationDoc.exists) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
      }

      const integration = integrationDoc.data();
      
      if (!integration) {
        return NextResponse.json({ error: 'Invalid integration data' }, { status: 500 });
      }

      let testResult: { success: boolean; message: string };

      // Test the specific integration based on its ID
      switch (integrationId) {
        case 'stripe':
          testResult = await testStripeConnection(integration.settings?.secretKey || '');
          break;
        case 'sendgrid':
          testResult = await testSendGridConnection(integration.settings?.apiKey || '');
          break;
        case 'twilio':
          testResult = await testTwilioConnection(
            integration.settings?.accountSid || '',
            integration.settings?.authToken || ''
          );
          break;
        case 'google-calendar':
          testResult = await testGoogleCalendarConnection(integration.settings?.apiKey || '');
          break;
        case 'google-maps':
          testResult = await testGoogleMapsConnection(integration.settings?.apiKey || '');
          break;
        case 'google-analytics':
          testResult = await testGoogleAnalyticsConnection(
            integration.settings?.trackingId || '',
            integration.settings?.measurementId || ''
          );
          break;
        default:
          return NextResponse.json({ error: 'Unsupported integration type' }, { status: 400 });
      }

      // Update integration status based on test result
      const newStatus = testResult.success ? 'active' : 'error';
      const updateData: any = {
        status: newStatus,
        lastTested: new Date(),
        updatedAt: new Date()
      };

      if (!testResult.success) {
        updateData.errorMessage = testResult.message;
      } else {
        // Remove error message if test was successful
        updateData.errorMessage = null;
      }

      await db.collection('integrations').doc(integrationId).update(updateData);

      if (testResult.success) {
        return NextResponse.json({
          success: true,
          message: testResult.message,
          status: newStatus
        });
      } else {
        return NextResponse.json(
          {
            error: testResult.message,
            status: newStatus
          },
          { status: 400 }
        );
      }

    } catch (error) {
      console.error('Error testing integration:', error);
      return NextResponse.json(
        { error: 'Failed to test integration' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Integration test API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}