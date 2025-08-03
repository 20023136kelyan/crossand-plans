'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminAnalytics } from '@/components/admin/analytics/AdminAnalytics';
import { AdminModeration } from '@/components/admin/moderation/AdminModeration';
import { AdminUserManagement } from '@/components/admin/users/AdminUserManagement';
import { AdminSystemStatus } from '@/components/admin/system/AdminSystemStatus';
import { AdminSettings } from '@/components/admin/settings/AdminSettings';
import { AdminSecurity } from '@/components/admin/security/AdminSecurity';
import { AdminIntegrations } from '@/components/admin/integrations/AdminIntegrations';
import { AdminBackups } from '@/components/admin/backups/AdminBackups';
import { AdminContentCuration } from '@/components/admin/content/AdminContentCuration';
import { ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function AdminManagement() {
  const { user } = useAuth();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is on mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Verify admin status
  useEffect(() => {
    const verifyAdmin = async () => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/verify', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Not authorized');
        }

        const data = await response.json();
        setIsAdmin(data.isAdmin);
      } catch (error) {
        console.error('Admin verification failed:', error);
        router.push('/');
      }
    };

    verifyAdmin();
  }, [user, router]);

  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <ExclamationTriangleIcon className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-center mb-2">Desktop Access Only</h1>
        <p className="text-center text-muted-foreground">
          Admin management functions are only available on desktop devices for security reasons.
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center p-8">
          <ShieldCheckIcon className="w-16 h-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground mt-2">
            You don't have permission to access this area.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <ShieldCheckIcon className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Admin Management Console</h1>
        </div>

        <Tabs defaultValue="analytics" className="space-y-4">
          <TabsList className="grid grid-cols-3 lg:grid-cols-9 gap-2">
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="moderation">Moderation</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="backups">Backups</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="border rounded-lg p-4">
            <AdminAnalytics />
          </TabsContent>

          <TabsContent value="content" className="border rounded-lg p-4">
            <AdminContentCuration />
          </TabsContent>

          <TabsContent value="moderation" className="border rounded-lg p-4">
            <AdminModeration />
          </TabsContent>

          <TabsContent value="users" className="border rounded-lg p-4">
            <AdminUserManagement />
          </TabsContent>

          <TabsContent value="system" className="border rounded-lg p-4">
            <AdminSystemStatus />
          </TabsContent>

          <TabsContent value="settings" className="border rounded-lg p-4">
            <AdminSettings />
          </TabsContent>

          <TabsContent value="security" className="border rounded-lg p-4">
            <AdminSecurity />
          </TabsContent>

          <TabsContent value="integrations" className="border rounded-lg p-4">
            <AdminIntegrations />
          </TabsContent>

          <TabsContent value="backups" className="border rounded-lg p-4">
            <AdminBackups />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}