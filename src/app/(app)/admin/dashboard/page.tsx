
// src/app/(app)/admin/dashboard/page.tsx
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  ShieldCheckIcon,
  UserGroupIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ChevronLeftIcon 
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { currentUserProfile, loading } = useAuth();

  useEffect(() => {
    if (!loading && currentUserProfile?.role !== 'admin') {
      // Redirect non-admins away if they somehow land here
      router.replace('/feed'); 
    }
  }, [currentUserProfile, loading, router]);

  if (loading || currentUserProfile?.role !== 'admin') {
    // Show loading or nothing if not admin (will be redirected)
    return (
        <div className="flex h-screen items-center justify-center">
            <ShieldCheckIcon className="h-12 w-12 animate-pulse text-primary" />
        </div>
    );
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 md:p-8">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
            <UserGroupIcon className="h-8 w-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground/80 opacity-80">Admin Dashboard</h1>
        </div>
        <Button variant="outline" onClick={() => router.back()} size="sm">
            <ChevronLeftIcon className="h-4 w-4 mr-2" /> Back
        </Button>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-foreground/90">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="bg-card/70 border-border/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><UserGroupIcon className="h-5 w-5" />User Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">View users, manage roles, and verify accounts.</p>
              <Link href="/admin/users">
                <Button variant="link" className="p-0 h-auto text-primary text-sm mt-2">Go to User Management</Button>
              </Link>
            </CardContent>
          </Card>
          <Card className="bg-card/70 border-border/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><DocumentTextIcon className="h-5 w-5" />Content Moderation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Review reported plans, posts, and comments.</p>
              <Link href="/admin/moderation">
                <Button variant="link" className="p-0 h-auto text-primary text-sm mt-2">Go to Content Moderation</Button>
              </Link>
            </CardContent>
          </Card>
          <Card className="bg-card/70 border-border/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><ChartBarIcon className="h-5 w-5" />App Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">View key metrics and application usage statistics.</p>
              <Link href="/admin/analytics">
                <Button variant="link" className="p-0 h-auto text-primary text-sm mt-2">View Analytics</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-foreground/90">Settings & Configuration</h2>
         <Card className="bg-card/70 border-border/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Cog6ToothIcon className="h-5 w-5" />Application Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Manage global application settings and features.</p>
              <Button variant="link" className="p-0 h-auto text-primary text-sm mt-2" asChild>
                <Link href="/admin/management?tab=settings">Configure Settings</Link>
              </Button>
            </CardContent>
          </Card>
      </section>

       <div className="text-center text-xs text-muted-foreground mt-12">
        More admin features will be added here.
      </div>
    </div>
  );
}
