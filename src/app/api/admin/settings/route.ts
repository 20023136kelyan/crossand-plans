import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin as db } from '@/lib/firebaseAdmin';
import { verifyAdminAuth } from '@/lib/auth/adminAuth';

interface AppSettings {
  // General Settings
  siteName: string;
  siteDescription: string;
  supportEmail: string;
  
  // User Limits
  maxPlansPerUser: number;
  maxParticipantsPerPlan: number;
  defaultPlanVisibility: 'public' | 'private' | 'friends';
  
  // Feature Controls
  enableRegistration: boolean;
  enableEmailNotifications: boolean;
  enablePushNotifications: boolean;
  maintenanceMode: boolean;
  
  // Security & Files
  sessionTimeout: number;
  maxFileSize: number;
  allowedFileTypes: string[];
  
  // Additional security settings
  requireEmailVerification: boolean;
  enableTwoFactorAuth: boolean;
  passwordMinLength: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  
  // Rate limiting
  apiRateLimit: number;
  uploadRateLimit: number;
  
  // Content moderation
  enableAutoModeration: boolean;
  profanityFilter: boolean;
  requirePlanApproval: boolean;
  
  // API and Performance
  enableCaching: boolean;
  cacheTimeout: number;
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
    
    // Get application settings from Firestore
    const settingsDoc = await db.collection('settings').doc('application').get();
    
    // Default settings if none exist
    const defaultSettings: AppSettings = {
      // General Settings
      siteName: 'Crossand Plans',
      siteDescription: 'Plan and coordinate activities with friends',
      supportEmail: 'support@crossandplans.com',
      
      // User Limits
      maxPlansPerUser: 50,
      maxParticipantsPerPlan: 20,
      defaultPlanVisibility: 'friends',
      
      // Feature Controls
      enableRegistration: true,
      enableEmailNotifications: true,
      enablePushNotifications: false,
      maintenanceMode: false,
      
      // Security & Files
      sessionTimeout: 24, // hours
      maxFileSize: 10, // MB
      allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'pdf'],
      
      // Additional security settings
      requireEmailVerification: true,
      enableTwoFactorAuth: false,
      passwordMinLength: 8,
      maxLoginAttempts: 5,
      lockoutDuration: 30, // minutes
      
      // Rate limiting
      apiRateLimit: 1000, // requests per hour
      uploadRateLimit: 50, // uploads per hour
      
      // Content moderation
      enableAutoModeration: true,
      profanityFilter: true,
      requirePlanApproval: false,
      
      // API and Performance
      enableCaching: true,
      cacheTimeout: 30
    };

    const settings = settingsDoc.exists ? { ...defaultSettings, ...settingsDoc.data() } : defaultSettings;

    return NextResponse.json({ settings });

  } catch (error) {
    console.error('Error fetching settings:', error);
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
    const settings = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Settings data required' }, { status: 400 });
    }

    // Validate settings
    const validationErrors = validateSettings(settings);
    if (validationErrors.length > 0) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: validationErrors 
      }, { status: 400 });
    }

    // Sanitize and prepare settings for storage
    const sanitizedSettings = sanitizeSettings(settings);

    // Update settings in Firestore
    await db.collection('settings').doc('application').set({
      ...sanitizedSettings,
      updatedAt: new Date().toISOString(),
      updatedBy: authResult.userId
    }, { merge: true });

    // Apply settings that require immediate action
    await applySettingsChanges(sanitizedSettings);

    return NextResponse.json({ success: true, message: 'Settings updated successfully' });

  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Validation function
function validateSettings(settings: any): string[] {
  const errors: string[] = [];

  // General Settings validation
  if (settings.siteName && (typeof settings.siteName !== 'string' || settings.siteName.length < 1 || settings.siteName.length > 100)) {
    errors.push('Site name must be between 1 and 100 characters');
  }
  if (settings.siteDescription && (typeof settings.siteDescription !== 'string' || settings.siteDescription.length > 500)) {
    errors.push('Site description must be less than 500 characters');
  }
  if (settings.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.supportEmail)) {
    errors.push('Support email must be a valid email address');
  }

  // User Limits validation
  if (settings.maxPlansPerUser && (!Number.isInteger(settings.maxPlansPerUser) || settings.maxPlansPerUser < 1 || settings.maxPlansPerUser > 1000)) {
    errors.push('Max plans per user must be between 1 and 1000');
  }
  if (settings.maxParticipantsPerPlan && (!Number.isInteger(settings.maxParticipantsPerPlan) || settings.maxParticipantsPerPlan < 1 || settings.maxParticipantsPerPlan > 500)) {
    errors.push('Max participants per plan must be between 1 and 500');
  }
  if (settings.defaultPlanVisibility && !['public', 'friends', 'private'].includes(settings.defaultPlanVisibility)) {
    errors.push('Default plan visibility must be public, friends, or private');
  }

  // Security & Files validation
  if (settings.sessionTimeout && (!Number.isInteger(settings.sessionTimeout) || settings.sessionTimeout < 1 || settings.sessionTimeout > 168)) {
    errors.push('Session timeout must be between 1 and 168 hours');
  }
  if (settings.maxFileSize && (!Number.isInteger(settings.maxFileSize) || settings.maxFileSize < 1 || settings.maxFileSize > 100)) {
    errors.push('Max file size must be between 1 and 100 MB');
  }
  if (settings.allowedFileTypes && (!Array.isArray(settings.allowedFileTypes) || settings.allowedFileTypes.length === 0)) {
    errors.push('Allowed file types must be a non-empty array');
  }
  if (settings.passwordMinLength && (!Number.isInteger(settings.passwordMinLength) || settings.passwordMinLength < 6 || settings.passwordMinLength > 50)) {
    errors.push('Password minimum length must be between 6 and 50 characters');
  }
  if (settings.maxLoginAttempts && (!Number.isInteger(settings.maxLoginAttempts) || settings.maxLoginAttempts < 3 || settings.maxLoginAttempts > 20)) {
    errors.push('Max login attempts must be between 3 and 20');
  }
  if (settings.lockoutDuration && (!Number.isInteger(settings.lockoutDuration) || settings.lockoutDuration < 5 || settings.lockoutDuration > 1440)) {
    errors.push('Lockout duration must be between 5 and 1440 minutes');
  }
  if (settings.apiRateLimit && (!Number.isInteger(settings.apiRateLimit) || settings.apiRateLimit < 100 || settings.apiRateLimit > 10000)) {
    errors.push('API rate limit must be between 100 and 10000 requests per hour');
  }
  if (settings.uploadRateLimit && (!Number.isInteger(settings.uploadRateLimit) || settings.uploadRateLimit < 10 || settings.uploadRateLimit > 500)) {
    errors.push('Upload rate limit must be between 10 and 500 uploads per hour');
  }

  return errors;
}

// Sanitization function
function sanitizeSettings(settings: any): any {
  const sanitized: any = {};

  // Only include known settings fields
  const allowedFields = [
    'siteName', 'siteDescription', 'supportEmail',
    'maxPlansPerUser', 'maxParticipantsPerPlan', 'defaultPlanVisibility',
    'enableRegistration', 'enableEmailNotifications', 'enablePushNotifications', 'maintenanceMode',
    'sessionTimeout', 'maxFileSize', 'allowedFileTypes',
    'requireEmailVerification', 'enableTwoFactorAuth', 'passwordMinLength',
    'maxLoginAttempts', 'lockoutDuration', 'apiRateLimit', 'uploadRateLimit',
    'enableAutoModeration', 'profanityFilter', 'requirePlanApproval'
  ];

  for (const field of allowedFields) {
    if (settings.hasOwnProperty(field)) {
      sanitized[field] = settings[field];
    }
  }

  // Sanitize string fields
  if (sanitized.siteName) sanitized.siteName = sanitized.siteName.trim();
  if (sanitized.siteDescription) sanitized.siteDescription = sanitized.siteDescription.trim();
  if (sanitized.supportEmail) sanitized.supportEmail = sanitized.supportEmail.trim().toLowerCase();

  // Ensure file types are lowercase
  if (sanitized.allowedFileTypes && Array.isArray(sanitized.allowedFileTypes)) {
    sanitized.allowedFileTypes = sanitized.allowedFileTypes.map((type: string) => type.toLowerCase().trim());
  }

  return sanitized;
}

// Apply settings changes that require immediate action
async function applySettingsChanges(settings: any): Promise<void> {
  try {
    // If maintenance mode is enabled, we could notify all active users
    if (settings.maintenanceMode) {
      console.log('Maintenance mode enabled - consider notifying active users');
    }

    // If registration is disabled, we could update any public registration forms
    if (settings.enableRegistration === false) {
      console.log('Registration disabled - public registration forms should be updated');
    }

    // If file size limits changed, we could clean up oversized files
    if (settings.maxFileSize) {
      console.log(`File size limit updated to ${settings.maxFileSize}MB`);
    }

    // Update any cached settings in Redis or other cache systems
    // This would be implemented based on your caching strategy
    
  } catch (error) {
    console.error('Error applying settings changes:', error);
    // Don't throw error as settings were already saved successfully
  }
}