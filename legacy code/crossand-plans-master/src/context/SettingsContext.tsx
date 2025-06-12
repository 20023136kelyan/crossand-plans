'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  sessionTimeout: number; // hours
  maxFileSize: number; // MB
  allowedFileTypes: string[];
  
  // Additional security settings
  requireEmailVerification: boolean;
  enableTwoFactorAuth: boolean;
  passwordMinLength: number;
  
  // API and Performance
  apiRateLimit: number;
  enableCaching: boolean;
  cacheTimeout: number; // minutes
}

interface SettingsContextType {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
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

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to fetch from public API endpoint
      const response = await fetch('/api/settings/public', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        // Fallback to default settings if API fails
        console.warn('Failed to fetch settings, using defaults');
        setSettings(defaultSettings);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('Failed to load application settings');
      // Use default settings as fallback
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  const refreshSettings = async () => {
    await fetchSettings();
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, error, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export type { AppSettings };