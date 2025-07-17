"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export default function NotificationsPage() {
  const { user, currentUserProfile } = useAuth();
  const [isPrivate, setIsPrivate] = useState(false);
  // Update the type for pendingFollowRequests
  interface PendingFollowRequest {
    id: string;
    fromUserId: string;
    createdAt?: any; // Firestore Timestamp, string, or Date
    requesterName?: string;
    requesterAvatarUrl?: string | null;
    requesterUsername?: string | null;
  }
  const [pendingFollowRequests, setPendingFollowRequests] = useState<PendingFollowRequest[]>([]);
  const [isLoadingPendingRequests, setIsLoadingPendingRequests] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (currentUserProfile && typeof currentUserProfile.isPrivate === 'boolean') {
      setIsPrivate(currentUserProfile.isPrivate);
    }
  }, [currentUserProfile]);

  useEffect(() => {
    const fetchPendingRequests = async () => {
      if (!user || !isPrivate) return;
      setIsLoadingPendingRequests(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/users/pending-follow-requests', {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (response.ok) {
          const data = await response.json();
          setPendingFollowRequests(data.pendingFollowRequests || []);
        }
      } catch (error) {
        // Optionally show error
      } finally {
        setIsLoadingPendingRequests(false);
      }
    };
    fetchPendingRequests();
  }, [user, isPrivate]);

  // Approve/Deny handlers
  const handleApproveRequest = async (requesterId: string) => {
    if (!user) return;
    const idToken = await user.getIdToken();
    await fetch('/api/users/approve-follow-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ requesterId })
    });
    setPendingFollowRequests((prev) => prev.filter((req) => req.fromUserId !== requesterId));
  };
  const handleDenyRequest = async (requesterId: string) => {
    if (!user) return;
    const idToken = await user.getIdToken();
    await fetch('/api/users/deny-follow-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ requesterId })
    });
    setPendingFollowRequests((prev) => prev.filter((req) => req.fromUserId !== requesterId));
  };

  return (
    <div className={`fixed inset-0 z-50 bg-background transition-all ${fullscreen ? 'w-full h-full' : 'max-w-lg mx-auto my-8 rounded-xl shadow-lg border'}`}>
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <Button size="sm" variant="outline" onClick={() => setFullscreen(f => !f)}>
          {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </Button>
      </div>
      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-12">
          <TabsTrigger value="requests">Pending Requests</TabsTrigger>
          <TabsTrigger value="other">Other</TabsTrigger>
        </TabsList>
        <TabsContent value="requests">
          <Card className="m-4">
            <CardHeader>
              <CardTitle>Pending Follow Requests</CardTitle>
              <CardDescription>Approve or deny users who want to follow you.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPendingRequests ? (
                <div className="text-muted-foreground text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
              ) : pendingFollowRequests.length === 0 ? (
                <div className="text-muted-foreground text-sm">No pending requests.</div>
              ) : (
                <ul className="space-y-2">
                  {pendingFollowRequests.map((request) => (
                    <li key={request.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {request.requesterAvatarUrl ? (
                          <img
                            src={request.requesterAvatarUrl}
                            alt={request.requesterName || request.requesterUsername || request.fromUserId}
                            className="w-8 h-8 rounded-full object-cover border"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border">
                            {request.requesterName?.[0]?.toUpperCase() || request.requesterUsername?.[0]?.toUpperCase() || request.fromUserId[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-medium">{request.requesterName || request.requesterUsername || request.fromUserId}</span>
                          {request.createdAt && (
                            <span className="text-xs text-muted-foreground" title={format(
                              toDateSafe(request.createdAt),
                              'PPpp')
                            }>
                              {formatDistanceToNow(toDateSafe(request.createdAt), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleApproveRequest(request.fromUserId)}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => handleDenyRequest(request.fromUserId)}>Deny</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="other">
          <div className="p-4 text-muted-foreground">Other notifications will appear here.</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function toDateSafe(ts: any): Date {
  if (!ts) return new Date('Invalid');
  if (typeof ts === 'string' || ts instanceof Date) return new Date(ts);
  if (typeof ts.toDate === 'function') return ts.toDate(); // Firestore Timestamp
  if (ts._seconds) return new Date(ts._seconds * 1000); // plain object from Firestore
  return new Date('Invalid');
} 