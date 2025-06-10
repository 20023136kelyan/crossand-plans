import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin } from '@/lib/firebaseAdmin';

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
  
  // Security & Files (public info only)
  sessionTimeout: number; // hours
  maxFileSize: number; // MB
  allowedFileTypes: string[];
  
  // Additional security settings (public info only)
  requireEmailVerification: boolean;
  enableTwoFactorAuth: boolean;
  passwordMinLength: number;
  
  // API and Performance
  apiRateLimit: number;
  enableCaching: boolean;
  cacheTimeout: number; // minutes
}

const defaultSettings: AppSettings = {
  siteName: 'Macaroom',
  siteDescription: 'Sweeten your social planning with Macaroom',
  supportEmail: 'support@macaroom.com',
  maxPlansPerUser: 50,
  maxParticipantsPerPlan: 20,
  defaultPlanVisibility: 'friends',
  enableRegistration: true,
  enableEmailNotifications: true,
  enablePushNotifications: false,
  maintenanceMode: false,
  sessionTimeout: 24,
  maxFileSize: 10,
  allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'pdf'],
  requireEmailVerification: true,
  enableTwoFactorAuth: false,
  passwordMinLength: 8,
  apiRateLimit: 1000,
  enableCaching: true,
  cacheTimeout: 30,
};

export async function GET() {
  try {
    const settingsDoc = await firestoreAdmin!
      .collection('settings')
      .doc('application')
      .get();

    let settings: AppSettings;
    
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      // Merge with defaults to ensure all fields are present
      settings = {
        ...defaultSettings,
        ...data,
      };
    } else {
      settings = defaultSettings;
    }

    // Return only public settings (no sensitive admin-only data)
    const publicSettings: AppSettings = {
      siteName: settings.siteName,
      siteDescription: settings.siteDescription,
      supportEmail: settings.supportEmail,
      maxPlansPerUser: settings.maxPlansPerUser,
      maxParticipantsPerPlan: settings.maxParticipantsPerPlan,
      defaultPlanVisibility: settings.defaultPlanVisibility,
      enableRegistration: settings.enableRegistration,
      enableEmailNotifications: settings.enableEmailNotifications,
      enablePushNotifications: settings.enablePushNotifications,
      maintenanceMode: settings.maintenanceMode,
      sessionTimeout: settings.sessionTimeout,
      maxFileSize: settings.maxFileSize,
      allowedFileTypes: settings.allowedFileTypes,
      requireEmailVerification: settings.requireEmailVerification,
      enableTwoFactorAuth: settings.enableTwoFactorAuth,
      passwordMinLength: settings.passwordMinLength,
      apiRateLimit: settings.apiRateLimit,
      enableCaching: settings.enableCaching,
      cacheTimeout: settings.cacheTimeout,
    };

    return NextResponse.json(publicSettings);
  } catch (error) {
    console.error('Error fetching public settings:', error);
    // Return default settings if there's an error
    return NextResponse.json(defaultSettings);
  }
}