
"use client";

import type { Participant } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Users, UserPlus, Loader2, Trash2, Crown } from "lucide-react";
import { inviteParticipant, updateParticipantStatus, removeParticipant as removeParticipantAction } from "@/lib/actions/plans";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MOCK_USER_ID } from "@/types";
import { MOCK_INVITABLE_FRIENDS_DATA } from "@/lib/mock-data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


interface ParticipantManagerProps {
  planId: string;
  participants: Participant[];
  hostId: string;
}

export function ParticipantManager({ planId, participants, hostId }: ParticipantManagerProps) {
  const { toast } = useToast();
  const [selectedFriendId, setSelectedFriendId] = useState<string | undefined>();
  const [isInviting, setIsInviting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<Record<string, boolean>>({});
  const [isRemoving, setIsRemoving] = useState<Record<string, boolean>>({});

  const currentIsHost = MOCK_USER_ID === hostId;

  const handleInvite = async () => {
    if (!selectedFriendId) {
      toast({ title: "No Friend Selected", description: "Please select a friend to invite.", variant: "destructive" });
      return;
    }
    setIsInviting(true);
    const friendToInvite = MOCK_INVITABLE_FRIENDS_DATA.find(f => f.id === selectedFriendId);
    if (!friendToInvite) {
        toast({ title: "Error", description: "Selected friend not found.", variant: "destructive" });
        setIsInviting(false);
        return;
    }

    try {
      const result = await inviteParticipant(planId, friendToInvite.userId, friendToInvite.name, friendToInvite.avatarUrl);
      if (result.success) {
        toast({ title: "Invite Sent!", description: result.message });
        setSelectedFriendId(undefined); 
      } else {
        toast({ title: "Invite Failed", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Could not send invite.", variant: "destructive" });
    } finally {
      setIsInviting(false);
    }
  };

  const handleStatusUpdate = async (participantId: string, status: 'confirmed' | 'declined') => {
    setIsUpdatingStatus(prev => ({ ...prev, [participantId]: true }));
    try {
      const result = await updateParticipantStatus(planId, participantId, status);
      if (result.success) {
        toast({ title: "Status Updated", description: result.message });
      } else {
        toast({ title: "Update Failed", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
    } finally {
      setIsUpdatingStatus(prev => ({ ...prev, [participantId]: false }));
    }
  };
  
  const handleRemoveParticipant = async (participantId: string, participantName: string) => {
    setIsRemoving(prev => ({ ...prev, [participantId]: true}));
    try {
        const result = await removeParticipantAction(planId, participantId);
        if (result.success) {
            toast({ title: "Participant Removed", description: `${participantName} has been removed from the plan.`});
        } else {
            toast({ title: "Removal Failed", description: result.message, variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Error", description: "Could not remove participant.", variant: "destructive"});
    } finally {
        setIsRemoving(prev => ({...prev, [participantId]: false}));
    }
  };

  const availableFriendsToInvite = MOCK_INVITABLE_FRIENDS_DATA.filter(
    friend => !participants.some(p => p.userId === friend.userId)
  );

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="text-primary" /> Participants ({participants.length})</CardTitle>
        {currentIsHost && (
        <CardDescription>Manage who is coming to your event. Invite friends and track their responses.</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {currentIsHost && (
            <div className="mb-6 p-4 border rounded-lg bg-secondary/20">
            <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><UserPlus /> Invite Friends</h3>
            <div className="flex items-center gap-2">
              <Select value={selectedFriendId} onValueChange={setSelectedFriendId} disabled={availableFriendsToInvite.length === 0}>
                <SelectTrigger className="flex-grow">
                  <SelectValue placeholder="Select a friend to invite" />
                </SelectTrigger>
                <SelectContent>
                  {availableFriendsToInvite.length > 0 ? (
                    availableFriendsToInvite.map(friend => (
                      <SelectItem key={friend.id} value={friend.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={friend.avatarUrl} alt={friend.name} data-ai-hint="friend avatar" />
                            <AvatarFallback>{friend.name.substring(0,1)}</AvatarFallback>
                          </Avatar>
                          {friend.name}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no_friends_available" disabled>No more friends to invite</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button onClick={handleInvite} disabled={isInviting || !selectedFriendId || availableFriendsToInvite.length === 0}>
                {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Invite
              </Button>
            </div>
            {availableFriendsToInvite.length === 0 && MOCK_INVITABLE_FRIENDS_DATA.length > 0 && (
                 <p className="text-xs text-muted-foreground mt-2">All mock friends have been invited or are already participants.</p>
            )}
            {MOCK_INVITABLE_FRIENDS_DATA.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">You have no mock friends to invite.</p>
            )}
          </div>
        )}

        {participants.length > 0 ? (
          <ul className="space-y-3">
            {participants.map((participant) => (
              <li key={participant.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border bg-card hover:bg-secondary/10 transition-colors">
                <div className="flex items-center gap-3 mb-2 sm:mb-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={participant.avatarUrl || `https://picsum.photos/seed/${participant.userId}/40/40`} alt={participant.name} data-ai-hint="participant avatar"/>
                    <AvatarFallback>{participant.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium flex items-center gap-1">
                        {participant.name}
                        {participant.userId === hostId && <Badge variant="outline" className="ml-1 text-xs py-0.5 px-1.5 border-yellow-500 text-yellow-600"><Crown className="h-3 w-3 mr-1"/>Host</Badge>}
                    </div>
                    <Badge variant={
                        participant.confirmationStatus === "confirmed" ? "default"
                      : participant.confirmationStatus === "declined" ? "destructive"
                      : "secondary"
                    } className="capitalize text-xs">
                      {participant.confirmationStatus}
                    </Badge>
                  </div>
                </div>
                
                {/* Actions for the current user if they are this participant and status is pending */}
                { MOCK_USER_ID === participant.userId && participant.userId !== hostId && participant.confirmationStatus === 'pending' && (
                  <div className="flex gap-2 mt-2 sm:mt-0 self-end sm:self-center">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleStatusUpdate(participant.id, 'confirmed')}
                      disabled={isUpdatingStatus[participant.id]}
                    >
                      {isUpdatingStatus[participant.id] && isUpdatingStatus[participant.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleStatusUpdate(participant.id, 'declined')}
                      disabled={isUpdatingStatus[participant.id]}
                    >
                      {isUpdatingStatus[participant.id] && isUpdatingStatus[participant.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-1 h-4 w-4" />}
                      Decline
                    </Button>
                  </div>
                )}

                {/* Actions for the host to remove other participants */}
                 {currentIsHost && participant.userId !== hostId && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 self-end sm:self-center" disabled={isRemoving[participant.id]}>
                                {isRemoving[participant.id] ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <Trash2 className="mr-1 h-4 w-4"/>}
                                Remove
                                <span className="sr-only">Remove {participant.name}</span>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action will remove {participant.name} from the plan. They will be notified. This cannot be undone.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => handleRemoveParticipant(participant.id, participant.name)}
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                disabled={isRemoving[participant.id]}
                            >
                                {isRemoving[participant.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Confirm Removal
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                 )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-center py-4">
            {currentIsHost ? "No participants yet. Invite some friends!" : "No participants yet."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
