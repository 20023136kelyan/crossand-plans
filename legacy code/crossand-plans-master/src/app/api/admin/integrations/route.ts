import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { verifyAdminAuth } from '@/lib/auth/adminAuth';

/**
 * Test integration connection with actual API calls
 */
async function testIntegrationConnection(integrationId: string): Promise<{ success: boolean; message: string }> {
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  // Get integration settings
  const integrationDoc = await db.collection('integrations').doc(integrationId).get();
  if (!integrationDoc.exists) {
    return { success: false, message: 'Integration not found' };
  }

  const integration = integrationDoc.data();
  if (!integration?.enabled) {
    return { success: false, message: 'Integration is disabled' };
  }

  // Test based on integration type
  switch (integrationId) {
    case 'stripe':
      return await testStripeConnection(integration.apiKey);
    case 'sendgrid':
      return await testSendGridConnection(integration.apiKey);
    case 'twilio':
      return await testTwilioConnection(integration.accountSid, integration.authToken);
    case 'google-calendar':
      return await testGoogleCalendarConnection(integration.apiKey);
    case 'google-maps':
      return await testGoogleMapsConnection(integration.apiKey);
    case 'google-analytics':
      return await testGoogleAnalyticsConnection(integration.trackingId);
    default:
      return { success: false, message: 'Unknown integration type' };
  }
}

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
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
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
        return { success: true, message: 'Google Maps API key valid' };
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
async function testGoogleAnalyticsConnection(trackingId: string): Promise<{ success: boolean; message: string }> {
  if (!trackingId) {
    return { success: false, message: 'Google Analytics tracking ID not configured' };
  }

  // For Google Analytics, we can't easily test the connection without proper OAuth
  // So we'll just validate the tracking ID format
  const gaPattern = /^(G-[A-Z0-9]+|UA-[0-9]+-[0-9]+)$/;
  if (gaPattern.test(trackingId)) {
    return { success: true, message: 'Google Analytics tracking ID format is valid' };
  } else {
    return { success: false, message: 'Invalid Google Analytics tracking ID format' };
  }
}

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
    
    // Get integrations from Firestore
    const integrationsSnapshot = await db.collection('integrations').get();
    
    const integrations = integrationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // If no integrations exist, create default ones
    if (integrations.length === 0) {
      const defaultIntegrations = [
        {
          id: 'stripe',
          name: 'Stripe',
          description: 'Payment processing and subscription management',
          enabled: false,
          status: 'disconnected',
          settings: {
            publishableKey: '',
            secretKey: '',
            webhookSecret: ''
          }
        },
        {
          id: 'sendgrid',
          name: 'SendGrid',
          description: 'Email delivery and marketing automation',
          enabled: false,
          status: 'disconnected',
          settings: {
            apiKey: '',
            fromEmail: '',
            fromName: ''
          }
        },
        {
          id: 'twilio',
          name: 'Twilio',
          description: 'SMS and voice communication services',
          enabled: false,
          status: 'disconnected',
          settings: {
            accountSid: '',
            authToken: '',
            phoneNumber: ''
          }
        },
        {
          id: 'google-calendar',
          name: 'Google Calendar',
          description: 'Calendar integration for plan scheduling',
          enabled: false,
          status: 'disconnected',
          settings: {
            clientId: '',
            clientSecret: '',
            redirectUri: ''
          }
        },
        {
          id: 'google-maps',
          name: 'Google Maps',
          description: 'Location services and mapping',
          enabled: false,
          status: 'disconnected',
          settings: {
            apiKey: ''
          }
        },
        {
          id: 'google-analytics',
          name: 'Google Analytics',
          description: 'Website analytics and user tracking',
          enabled: false,
          status: 'disconnected',
          settings: {
            trackingId: '',
            measurementId: ''
          }
        }
      ];

      // Save default integrations to Firestore
      for (const integration of defaultIntegrations) {
        await db.collection('integrations').doc(integration.id).set(integration);
      }

      return NextResponse.json({ integrations: defaultIntegrations });
    }

    return NextResponse.json({ integrations });

  } catch (error) {
    console.error('Error fetching integrations:', error);
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
    const { integrationId, settings, enabled } = body;

    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID required' }, { status: 400 });
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
      updatedBy: authResult.userId
    };

    if (settings !== undefined) {
      updateData.settings = settings;
    }

    if (enabled !== undefined) {
      updateData.enabled = enabled;
      updateData.status = enabled ? 'connected' : 'disconnected';
    }

    // Update integration in Firestore
    await db.collection('integrations').doc(integrationId).update(updateData);

    return NextResponse.json({ success: true, message: 'Integration updated successfully' });

  } catch (error) {
    console.error('Error updating integration:', error);
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
    const { action, integrationId } = body;

    if (action === 'test' && integrationId) {
      // Test integration connection with actual API calls
      try {
        const result = await testIntegrationConnection(integrationId);
        return NextResponse.json(result);
      } catch (error) {
        console.error(`Integration test failed for ${integrationId}:`, error);
        return NextResponse.json({
          success: false,
          message: error instanceof Error ? error.message : 'Integration test failed'
        });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error testing integration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}