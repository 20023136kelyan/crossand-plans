'use client';

import { useEffect, useState } from 'react';
import { SubscriptionManager } from "@/components/plans/SubscriptionManager";
import { ActivityScoreCard } from "@/components/plans/ActivityScoreCard";
import { Toaster } from "@/components/ui/toaster";
import { Skeleton } from "@/components/ui/skeleton";

interface UserData {
  subscription: any;
  userStats: any;
  userProfile: any;
  activityScore: number;
}

export default function SubscriptionPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/subscriptions/user-data');
        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }
        const data = await response.json();
        setUserData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  if (error) {
    return (
      <div className="container py-10">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-red-600">Error</h2>
          <p className="mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Activity Score Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Your Activity</h2>
          {isLoading ? (
            <Skeleton className="w-full h-[300px] rounded-lg" />
          ) : (
            <ActivityScoreCard
              activityScore={userData?.activityScore || 0}
              plansCreated={userData?.userStats?.plansCreatedCount || 0}
              plansShared={userData?.userStats?.plansSharedOrExperiencedCount || 0}
              eventAttendance={userData?.userProfile?.eventAttendanceScore || 0}
              levelTitle={userData?.userProfile?.levelTitle || "Newbie Planner"}
              levelStars={userData?.userProfile?.levelStars || 1}
            />
          )}
        </section>

        {/* Subscription Plans Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Subscription Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isLoading ? (
              <>
                <Skeleton className="w-full h-[400px] rounded-lg" />
                <Skeleton className="w-full h-[400px] rounded-lg" />
                <Skeleton className="w-full h-[400px] rounded-lg" />
              </>
            ) : (
              <>
                <div className="w-full max-w-sm">
                  <SubscriptionManager
                    plan="basic"
                    currentSubscription={userData?.subscription}
                  />
                </div>
                <div className="w-full max-w-sm">
                  <SubscriptionManager
                    plan="premium"
                    currentSubscription={userData?.subscription}
                  />
                </div>
                <div className="w-full max-w-sm">
                  <SubscriptionManager
                    plan="enterprise"
                    currentSubscription={userData?.subscription}
                  />
                </div>
              </>
            )}
          </div>
        </section>

        {/* Current Subscription Details */}
        {userData?.subscription && (
          <section>
            <h2 className="text-2xl font-bold mb-6">Current Subscription</h2>
            {isLoading ? (
              <Skeleton className="w-full h-[200px] rounded-lg" />
            ) : (
              <div className="bg-card rounded-lg p-6 border">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-lg font-semibold capitalize">{userData.subscription.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <p className="text-lg font-semibold capitalize">{userData.subscription.plan}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Next Billing</p>
                    <p className="text-lg font-semibold">
                      {userData.subscription.nextBillingDate
                        ? new Date(userData.subscription.nextBillingDate.seconds * 1000).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="text-lg font-semibold">
                      ${userData.subscription.amount} {userData.subscription.currency}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
      <Toaster />
    </div>
  );
} 