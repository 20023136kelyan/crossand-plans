'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UsersIcon, ClockIcon, ExclamationTriangleIcon, UserPlusIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { Plan } from '@/types/plan';
import { User } from 'firebase/auth';

interface WaitlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan;
  currentUser: User;
  participantDetails: { [uid: string]: { name?: string; avatarUrl?: string } };
  onJoinWaitlist: (notes?: string) => Promise<void>;
  onLeaveWaitlist: () => Promise<void>;
  isOnWaitlist: boolean;
}

export function WaitlistDialog({
  open,
  onOpenChange,
  plan,
  currentUser,
  participantDetails,
  onJoinWaitlist,
  onLeaveWaitlist,
  isOnWaitlist
}: WaitlistDialogProps) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const waitlist = plan.waitlist || [];
  const waitlistPosition = waitlist.indexOf(currentUser.uid) + 1;
  const maxParticipants = plan.rsvpSettings?.maxParticipants;
  const currentParticipants = Object.values(plan.participantResponses || {}).filter(r => r === 'going').length;
  const spotsAvailable = maxParticipants ? maxParticipants - currentParticipants : 0;

  const handleJoinWaitlist = async () => {
    setIsSubmitting(true);
    try {
      await onJoinWaitlist(notes.trim() || undefined);
      onOpenChange(false);
      setNotes('');
    } catch (error) {
      console.error('Error joining waitlist:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeaveWaitlist = async () => {
    setIsSubmitting(true);
    try {
      await onLeaveWaitlist();
      onOpenChange(false);
    } catch (error) {
      console.error('Error leaving waitlist:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Event Waitlist
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Event Status */}
          <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <ExclamationTriangleIcon className="h-4 w-4 text-orange-600" />
              <span className="font-medium text-orange-800">Event at Capacity</span>
            </div>
            <p className="text-sm text-orange-700">
              This event is currently full ({currentParticipants}/{maxParticipants} participants). 
              Join the waitlist to be notified if spots become available.
            </p>
          </div>

          {/* Current Waitlist Status */}
          {isOnWaitlist ? (
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <ClockIcon className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">You're on the waitlist</span>
              </div>
              <p className="text-sm text-blue-700">
                Position #{waitlistPosition} of {waitlist.length}
              </p>
              {waitlistPosition <= spotsAvailable && (
                <p className="text-sm text-green-600 mt-1">
                  You're likely to get a spot if someone cancels!
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Label htmlFor="waitlist-notes" className="text-base font-medium">
                Why would you like to join this event? (Optional)
              </Label>
              <Textarea
                id="waitlist-notes"
                placeholder="Tell the host why you're interested in joining..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Waitlist Members */}
          {waitlist.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Current Waitlist</h4>
                <Badge variant="outline">{waitlist.length} waiting</Badge>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {waitlist.slice(0, 5).map((uid, index) => {
                  const participant = participantDetails[uid];
                  const isCurrentUser = uid === currentUser.uid;
                  return (
                    <div key={uid} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs font-mono text-gray-500 w-6">#{index + 1}</span>
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={participant?.avatarUrl} />
                          <AvatarFallback className="text-xs">
                            {participant?.name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {isCurrentUser ? 'You' : participant?.name || 'Unknown'}
                        </span>
                      </div>
                      {isCurrentUser && (
                        <Badge variant="secondary" className="text-xs">You</Badge>
                      )}
                    </div>
                  );
                })}
                {waitlist.length > 5 && (
                  <p className="text-xs text-gray-500 text-center py-1">
                    +{waitlist.length - 5} more waiting
                  </p>
                )}
              </div>
            </div>
          )}

          {/* How Waitlist Works */}
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-sm mb-2">How the waitlist works:</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• You'll be notified if a spot opens up</li>
              <li>• Spots are offered in waitlist order</li>
              <li>• You have 24 hours to accept an offered spot</li>
              <li>• You can leave the waitlist anytime</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          {isOnWaitlist ? (
            <Button 
              variant="destructive" 
              onClick={handleLeaveWaitlist} 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Leaving...' : 'Leave Waitlist'}
            </Button>
          ) : (
            <Button onClick={handleJoinWaitlist} disabled={isSubmitting}>
              {isSubmitting ? 'Joining...' : 'Join Waitlist'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}