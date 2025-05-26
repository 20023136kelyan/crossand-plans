
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PackageOpen, DollarSign, List, Loader2 } from "lucide-react"; // Added PackageOpen
import React from 'react';
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const WalletPage = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // This should ideally be handled by AppLayout, but as a fallback:
    router.push('/login');
    return null;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center">
      <PackageOpen className="h-24 w-24 text-muted-foreground/30 mb-6" />
      <h1 className="text-3xl font-bold text-foreground/80 opacity-80">Macaroom Wallet</h1>
      <CardDescription className="text-lg text-muted-foreground max-w-md">
        Exciting features for credits, rewards, and more are coming soon to your Macaroom Wallet! Stay tuned.
      </CardDescription>
      {/* 
        Optionally, you could add a button to go back or explore other parts of the app:
        <Button variant="outline" className="mt-6" onClick={() => router.push('/feed')}>
          Back to Feed
        </Button> 
      */}
    </div>
  );
};

export default WalletPage;
