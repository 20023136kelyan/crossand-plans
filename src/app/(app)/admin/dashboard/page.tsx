
// src/app/(app)/admin/dashboard/page.tsx
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Users, FileText, Settings, BarChart3, ChevronLeft } from "lucide-react";
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
            <Shield className="h-12 w-12 animate-pulse text-primary" />
        </div>
    );
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 md:p-8">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground/80 opacity-80">Admin Dashboard</h1>
        </div>
        <Button variant="outline" onClick={() => router.back()} size="sm">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-foreground/90">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="bg-card/70 border-border/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Users className="text-primary"/>User Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">View users, manage roles, and verify accounts.</p>
              <Button variant="link" className="p-0 h-auto text-primary text-sm mt-2">Go to User Management (coming soon)</Button>
            </CardContent>
          </Card>
          <Card className="bg-card/70 border-border/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><FileText className="text-primary"/>Content Moderation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Review reported plans, posts, and comments.</p>
              <Button variant="link" className="p-0 h-auto text-primary text-sm mt-2">Go to Content Moderation (coming soon)</Button>
            </CardContent>
          </Card>
          <Card className="bg-card/70 border-border/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="text-primary"/>App Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">View key metrics and application usage statistics.</p>
              <Button variant="link" className="p-0 h-auto text-primary text-sm mt-2">View Analytics (coming soon)</Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-foreground/90">Settings & Configuration</h2>
         <Card className="bg-card/70 border-border/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Settings className="text-primary"/>Application Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Manage global application settings and features.</p>
              <Button variant="link" className="p-0 h-auto text-primary text-sm mt-2">Configure Settings (coming soon)</Button>
            </CardContent>
          </Card>
      </section>

       <div className="text-center text-xs text-muted-foreground mt-12">
        More admin features will be added here.
      </div>
    </div>
  );
}
