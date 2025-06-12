'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Check, X, Clock, Loader2, Users, Crown, MessageCircle, UserPlus, MoreHorizontal, Calendar, MapPin, Settings } from 'lucide-react';
import { Plan } from '@/types/plan';
import { User } from 'firebase/auth';

interface UserProfile {
  name?: string;
  avatarUrl?: string;
}

type ParticipantResponse = 'going' | 'maybe' | 'not-going' | 'pending';

interface PlanParticipantsProps {
  plan: Plan;
  currentUser: User | null;
  isCurrentUserParticipant: boolean;
  isHost: boolean;
  isEventDateValid: boolean;
  currentUserResponse: ParticipantResponse | undefined;
  rsvpSummary: { yes: number; maybe: number; no: number };
  participantDetails: { [uid: string]: UserProfile };
  rsvpLoading: boolean;
  onRSVP: (response: 'yes' | 'no' | 'maybe') => void;
  onAdvancedRSVP?: () => void;
  onManageParticipants?: () => void;
  onJoinWaitlist?: () => void;
}

const rsvpButtonConfig = {
  yes: {
    icon: Check,
    label: 'Going',
    variant: 'default' as const,
  },
  maybe: {
    icon: Clock,
    label: 'Maybe',
    variant: 'outline' as const,
  },
  no: {
    icon: X,
    label: "Can't Go",
    variant: 'outline' as const,
  },
};

const participantResponseConfig = {
  going: {
    icon: Check,
    label: 'Going',
    color: 'text-green-600',
  },
  maybe: {
    icon: Clock,
    label: 'Maybe',
    color: 'text-yellow-600',
  },
  'not-going': {
    icon: X,
    label: "Can't Go",
    color: 'text-red-600',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    color: 'text-gray-600',
  },
};

export function PlanParticipants({
  plan,
  currentUser,
  isCurrentUserParticipant,
  isHost,
  isEventDateValid,
  currentUserResponse,
  rsvpSummary,
  participantDetails,
  rsvpLoading,
  onRSVP,
  onAdvancedRSVP,
  onManageParticipants,
  onJoinWaitlist
}: PlanParticipantsProps) {
  const [showRSVPDialog, setShowRSVPDialog] = useState(false);
  
  // Calculate participant counts (avoiding double counting of host)
  const participantResponses = plan.participantResponses || {};
  const invitedParticipants = Object.keys(participantResponses).filter(uid => uid !== plan.hostId).length;
  const totalParticipants = 1 + invitedParticipants; // Host + invited participants (excluding host from responses)
  const confirmedCount = 1 + Object.entries(participantResponses)
    .filter(([uid, response]) => uid !== plan.hostId && response === 'going').length; // Host + confirmed participants (excluding host from responses)
  
  return (
    <div className="space-y-4">
      {/* RSVP Section - Compact Button */}
      {isCurrentUserParticipant && !isHost && isEventDateValid && (
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowRSVPDialog(true)}
            variant={currentUserResponse ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-2 h-9 px-4"
          >
            <Calendar className="h-4 w-4" />
            {currentUserResponse ? (
              <>
                <span className="text-sm font-medium">
                  {currentUserResponse === 'going' ? 'Going' : currentUserResponse === 'maybe' ? 'Maybe' : "Can't Go"}
                </span>
                <Badge variant="secondary" className="text-xs ml-1">
                  Change
                </Badge>
              </>
            ) : (
              <span className="text-sm font-medium">RSVP</span>
            )}
          </Button>
        </div>
      )}

      {/* Advanced RSVP Features */}
      {currentUser && (
        <div className="flex gap-2">
          {onAdvancedRSVP && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAdvancedRSVP}
              className="flex-1 text-xs"
            >
              <Settings className="h-3 w-3 mr-1" />
              Advanced RSVP
            </Button>
          )}
          {isHost && onManageParticipants && (
            <Button
              variant="outline"
              size="sm"
              onClick={onManageParticipants}
              className="flex-1 text-xs"
            >
              <Users className="h-3 w-3 mr-1" />
              Manage
            </Button>
          )}
          {!isHost && plan.waitlist && plan.waitlist.length > 0 && onJoinWaitlist && (
            <Button
              variant="outline"
              size="sm"
              onClick={onJoinWaitlist}
              className="flex-1 text-xs"
            >
              <Clock className="h-3 w-3 mr-1" />
              Waitlist
            </Button>
          )}
        </div>
      )}

      {/* Compact Participants Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              Participants
              <Badge variant="outline" className="text-xs">
                {totalParticipants}
              </Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Compact RSVP Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded bg-primary/5">
              <div className="flex items-center justify-center gap-1">
                <Check className="h-3 w-3 text-primary" />
                <span className="text-lg font-bold text-primary">{rsvpSummary.yes}</span>
              </div>
              <p className="text-xs text-primary">Going</p>
            </div>
            <div className="text-center p-2 rounded bg-yellow-500/5">
              <div className="flex items-center justify-center gap-1">
                <Clock className="h-3 w-3 text-yellow-600" />
                <span className="text-lg font-bold text-yellow-600">{rsvpSummary.maybe}</span>
              </div>
              <p className="text-xs text-yellow-600">Maybe</p>
            </div>
            <div className="text-center p-2 rounded bg-red-500/5">
              <div className="flex items-center justify-center gap-1">
                <X className="h-3 w-3 text-red-600" />
                <span className="text-lg font-bold text-red-600">{rsvpSummary.no}</span>
              </div>
              <p className="text-xs text-red-600">Can't Go</p>
            </div>
          </div>

          {/* All Participants - Host + Invited */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium flex items-center gap-1">
                <Users className="h-3 w-3" />
                All Participants ({totalParticipants})
              </h4>
              <span className="text-xs text-muted-foreground">
                {confirmedCount} confirmed
              </span>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {/* Host Avatar - Always First */}
              <div className="flex flex-col items-center gap-1 min-w-0">
                <div className="relative">
                  <Avatar className="h-12 w-12 ring-2 ring-primary/50">
                    <AvatarImage
                      src={participantDetails[plan.hostId]?.avatarUrl || undefined}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {participantDetails[plan.hostId]?.name?.charAt(0) || 'H'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1">
                    <Crown className="h-3 w-3 text-primary bg-background rounded-full p-0.5" />
                  </div>
                  {isHost && (
                    <div className="absolute -top-1 -left-1">
                      <Badge variant="default" className="text-xs h-4 px-1">
                        You
                      </Badge>
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium truncate max-w-16 text-center text-primary">
                  {participantDetails[plan.hostId]?.name || 'Host'}
                </span>
              </div>

              {/* Separator if there are invited participants */}
              {invitedParticipants > 0 && (
                <div className="h-12 w-px bg-border mx-1" />
              )}

              {/* Invited Participants */}
              {Object.entries(plan.participantResponses || {}).map(([uid, response]) => {
                // Skip if this is the host (avoid double counting)
                if (uid === plan.hostId) return null;
                
                const profile = participantDetails[uid];
                const responseConfig = participantResponseConfig[response as ParticipantResponse];
                const isConfirmed = response === 'going';

                return (
                  <div key={uid} className="flex flex-col items-center gap-1 min-w-0">
                    <div className="relative">
                      <Avatar className={`h-12 w-12 ${isConfirmed ? 'ring-2 ring-primary/30' : 'ring-1 ring-border'}`}>
                        <AvatarImage src={profile?.avatarUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {profile?.name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1">
                        <responseConfig.icon className={`h-3 w-3 ${responseConfig.color} bg-background rounded-full p-0.5`} />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground truncate max-w-16 text-center">
                      {profile?.name || 'Unknown'}
                    </span>
                  </div>
                );
              })}

              {/* Invite Button - Always Last Element (Host Only) */}
              {isHost && (
                <div className="flex flex-col items-center gap-1 min-w-0">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-12 w-12 rounded-full p-0 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <UserPlus className="h-6 w-6 text-muted-foreground hover:text-primary" />
                  </Button>
                  <span className="text-xs text-muted-foreground truncate max-w-16 text-center">
                    Invite
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Compact Empty State */}
          {invitedParticipants === 0 && (
            <div className="text-center py-2">
            </div>
          )}
        </CardContent>
      </Card>

      {/* RSVP Dialog */}
      <Dialog open={showRSVPDialog} onOpenChange={setShowRSVPDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              RSVP to {plan.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Please let us know if you'll be attending this event.
            </p>
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(rsvpButtonConfig).map(([response, config]) => {
                const isSelected = currentUserResponse === response;
                return (
                  <Button
                    key={response}
                    variant={isSelected ? 'default' : 'outline'}
                    size="lg"
                    onClick={() => {
                      onRSVP(response as 'yes' | 'no' | 'maybe');
                      setShowRSVPDialog(false);
                    }}
                    disabled={rsvpLoading}
                    className="flex items-center justify-start gap-3 h-12 px-4"
                  >
                    {rsvpLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <config.icon className="h-4 w-4" />
                    )}
                    <div className="text-left">
                      <div className="font-medium">{config.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {response === 'yes' && 'I will definitely attend'}
                        {response === 'maybe' && 'I might be able to attend'}
                        {response === 'no' && 'I cannot attend'}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            {onAdvancedRSVP && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowRSVPDialog(false);
                  onAdvancedRSVP();
                }}
                className="text-xs"
              >
                <Settings className="h-3 w-3 mr-1" />
                Advanced Options
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}