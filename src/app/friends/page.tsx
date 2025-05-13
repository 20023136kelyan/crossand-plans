import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Hourglass } from "lucide-react";
import Image from "next/image";

export default function FriendsPage() {
  // Mock data - replace with actual data fetching
  const friends = [
    { id: '1', name: 'Alice Wonderland', avatarUrl: 'https://picsum.photos/seed/alice/80/80', status: 'accepted' },
    { id: '2', name: 'Bob The Builder', avatarUrl: 'https://picsum.photos/seed/bob/80/80', status: 'accepted' },
  ];
  const pendingRequests = [
    { id: '3', name: 'Charlie Brown', avatarUrl: 'https://picsum.photos/seed/charlie/80/80', type: 'incoming' },
    { id: '4', name: 'Diana Prince', avatarUrl: 'https://picsum.photos/seed/diana/80/80', type: 'outgoing' },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Friends</h1>
        <p className="text-muted-foreground">
          Manage your connections and invite new friends to PlanPal.
        </p>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="text-primary" /> Add New Friend</CardTitle>
          <CardDescription>Expand your PlanPal circle.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <input type="text" placeholder="Enter friend's email or username" className="flex-grow p-2 border rounded-md focus:ring-primary focus:border-primary" />
            <Button>Send Request</Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            This feature is currently under development. Soon you&apos;ll be able to connect with friends!
          </p>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="text-primary" /> Your Friends</CardTitle>
          </CardHeader>
          <CardContent>
            {friends.length > 0 ? (
              <ul className="space-y-3">
                {friends.map(friend => (
                  <li key={friend.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Image src={friend.avatarUrl} alt={friend.name} width={40} height={40} className="rounded-full" data-ai-hint="user avatar" />
                      <span>{friend.name}</span>
                    </div>
                    <Button variant="outline" size="sm">Manage</Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">You haven&apos;t added any friends yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Hourglass className="text-primary" /> Pending Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingRequests.length > 0 ? (
              <ul className="space-y-3">
                {pendingRequests.map(req => (
                  <li key={req.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Image src={req.avatarUrl} alt={req.name} width={40} height={40} className="rounded-full" data-ai-hint="user avatar" />
                      <span>{req.name}</span>
                    </div>
                    {req.type === 'incoming' ? (
                      <div className="space-x-2">
                        <Button variant="default" size="sm">Accept</Button>
                        <Button variant="destructive" size="sm">Decline</Button>
                      </div>
                    ) : (
                      <Badge variant="outline">Sent</Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No pending requests.</p>
            )}
          </CardContent>
        </Card>
      </div>
       <div className="text-center p-6 bg-secondary/50 rounded-lg">
          <Users className="mx-auto h-12 w-12 text-primary mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Friend Management Coming Soon!</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            We&apos;re working hard to bring you a full-featured friend system. Stay tuned for updates!
          </p>
        </div>
    </div>
  );
}
