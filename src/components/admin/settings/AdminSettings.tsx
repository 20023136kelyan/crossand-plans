'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Settings,
  Save,
  RefreshCcw,
  Globe,
  Mail,
  Shield,
  Database,
} from 'lucide-react';

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
}

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
  sessionTimeout: 24,
  maxFileSize: 10,
  allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'pdf'],
  
  // Additional security settings
  requireEmailVerification: true,
  enableTwoFactorAuth: false,
  passwordMinLength: 8,
  maxLoginAttempts: 5,
  lockoutDuration: 30,
  
  // Rate limiting
  apiRateLimit: 1000,
  uploadRateLimit: 50,
  
  // Content moderation
  enableAutoModeration: true,
  profanityFilter: true,
  requirePlanApproval: false
};

export function AdminSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      if (!user) {
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch('/api/admin/settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // The API returns { settings: {...} }
        const settingsData = data.settings || data;
        setSettings({ ...defaultSettings, ...settingsData });
      } else {
        throw new Error('Failed to fetch settings');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load settings. Using default values.',
        variant: 'destructive'
      });
      // Use default settings if loading fails
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to save settings.',
          variant: 'destructive'
        });
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Settings saved successfully'
        });
        // Reload settings to ensure we have the latest data
        await loadSettings();
      } else {
        // Handle validation errors
        if (data.details && Array.isArray(data.details)) {
          toast({
            title: 'Validation Error',
            description: data.details.join(', '),
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Error',
            description: data.error || 'Failed to save settings',
            variant: 'destructive'
          });
        }
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: 'Error',
        description: 'Network error. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Application Settings</h2>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription>
              Basic application configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="siteName">Site Name</Label>
              <Input
                id="siteName"
                value={settings.siteName}
                onChange={(e) => updateSetting('siteName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteDescription">Site Description</Label>
              <Textarea
                id="siteDescription"
                value={settings.siteDescription}
                onChange={(e) => updateSetting('siteDescription', e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input
                id="supportEmail"
                type="email"
                value={settings.supportEmail}
                onChange={(e) => updateSetting('supportEmail', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* User Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              User Limits
            </CardTitle>
            <CardDescription>
              Configure user and plan limitations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maxPlansPerUser">Max Plans per User</Label>
              <Input
                id="maxPlansPerUser"
                type="number"
                value={settings.maxPlansPerUser}
                onChange={(e) => updateSetting('maxPlansPerUser', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxParticipantsPerPlan">Max Participants per Plan</Label>
              <Input
                id="maxParticipantsPerPlan"
                type="number"
                value={settings.maxParticipantsPerPlan}
                onChange={(e) => updateSetting('maxParticipantsPerPlan', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultPlanVisibility">Default Plan Visibility</Label>
              <Select
                value={settings.defaultPlanVisibility}
                onValueChange={(value) => updateSetting('defaultPlanVisibility', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="friends">Friends Only</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Feature Toggles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Feature Controls
            </CardTitle>
            <CardDescription>
              Enable or disable application features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="enableRegistration">Enable User Registration</Label>
              <Switch
                id="enableRegistration"
                checked={settings.enableRegistration}
                onCheckedChange={(checked) => updateSetting('enableRegistration', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enableEmailNotifications">Email Notifications</Label>
              <Switch
                id="enableEmailNotifications"
                checked={settings.enableEmailNotifications}
                onCheckedChange={(checked) => updateSetting('enableEmailNotifications', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enablePushNotifications">Push Notifications</Label>
              <Switch
                id="enablePushNotifications"
                checked={settings.enablePushNotifications}
                onCheckedChange={(checked) => updateSetting('enablePushNotifications', checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="maintenanceMode">Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">Disable access for non-admin users</p>
              </div>
              <Switch
                id="maintenanceMode"
                checked={settings.maintenanceMode}
                onCheckedChange={(checked) => updateSetting('maintenanceMode', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Security & Files
            </CardTitle>
            <CardDescription>
              Security and file upload settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout (hours)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                value={settings.sessionTimeout}
                onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxFileSize">Max File Size (MB)</Label>
              <Input
                id="maxFileSize"
                type="number"
                value={settings.maxFileSize}
                onChange={(e) => updateSetting('maxFileSize', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="allowedFileTypes">Allowed File Types</Label>
              <Input
                id="allowedFileTypes"
                value={settings.allowedFileTypes.join(', ')}
                onChange={(e) => updateSetting('allowedFileTypes', e.target.value.split(',').map(s => s.trim()))}
                placeholder="jpg, png, pdf, etc."
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="requireEmailVerification">Require Email Verification</Label>
              <Switch
                id="requireEmailVerification"
                checked={settings.requireEmailVerification}
                onCheckedChange={(checked) => updateSetting('requireEmailVerification', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enableTwoFactorAuth">Enable Two-Factor Authentication</Label>
              <Switch
                id="enableTwoFactorAuth"
                checked={settings.enableTwoFactorAuth}
                onCheckedChange={(checked) => updateSetting('enableTwoFactorAuth', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Advanced Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Advanced Security
            </CardTitle>
            <CardDescription>
              Password and authentication policies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passwordMinLength">Minimum Password Length</Label>
              <Input
                id="passwordMinLength"
                type="number"
                min="6"
                max="50"
                value={settings.passwordMinLength}
                onChange={(e) => updateSetting('passwordMinLength', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
              <Input
                id="maxLoginAttempts"
                type="number"
                min="3"
                max="20"
                value={settings.maxLoginAttempts}
                onChange={(e) => updateSetting('maxLoginAttempts', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lockoutDuration">Lockout Duration (minutes)</Label>
              <Input
                id="lockoutDuration"
                type="number"
                min="5"
                max="1440"
                value={settings.lockoutDuration}
                onChange={(e) => updateSetting('lockoutDuration', parseInt(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Rate Limiting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Rate Limiting
            </CardTitle>
            <CardDescription>
              API and upload rate limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiRateLimit">API Rate Limit (requests/hour)</Label>
              <Input
                id="apiRateLimit"
                type="number"
                min="100"
                max="10000"
                value={settings.apiRateLimit}
                onChange={(e) => updateSetting('apiRateLimit', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uploadRateLimit">Upload Rate Limit (uploads/hour)</Label>
              <Input
                id="uploadRateLimit"
                type="number"
                min="10"
                max="500"
                value={settings.uploadRateLimit}
                onChange={(e) => updateSetting('uploadRateLimit', parseInt(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Content Moderation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Content Moderation
            </CardTitle>
            <CardDescription>
              Automated content filtering and approval
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="enableAutoModeration">Enable Auto Moderation</Label>
              <Switch
                id="enableAutoModeration"
                checked={settings.enableAutoModeration}
                onCheckedChange={(checked) => updateSetting('enableAutoModeration', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="profanityFilter">Profanity Filter</Label>
              <Switch
                id="profanityFilter"
                checked={settings.profanityFilter}
                onCheckedChange={(checked) => updateSetting('profanityFilter', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="requirePlanApproval">Require Plan Approval</Label>
              <Switch
                id="requirePlanApproval"
                checked={settings.requirePlanApproval}
                onCheckedChange={(checked) => updateSetting('requirePlanApproval', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}