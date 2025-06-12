'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Clock, Users, Plus, Minus, AlertCircle, Calendar, UserPlus, Info, Loader2 } from 'lucide-react';
import { Plan, ParticipantResponse } from '@/types/plan';
import { RSVPDetails } from '@/types/user';
import { User } from 'firebase/auth';
import { UserProfile } from '@/types/user';
import { toast } from 'sonner';

interface AdvancedRSVPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan;
  currentUser: User;
  currentUserProfile?: UserProfile | null;
  currentRSVP?: RSVPDetails;
  onSubmit: (rsvpDetails: RSVPDetails) => Promise<void>;
}

const responseOptions = [
  { value: 'going', label: 'Going', icon: Check, color: 'text-green-600', bgColor: 'bg-green-50' },
  { value: 'maybe', label: 'Maybe', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  { value: 'not-going', label: "Can't Go", icon: X, color: 'text-red-600', bgColor: 'bg-red-50' }
];



export function AdvancedRSVPDialog({
  open,
  onOpenChange,
  plan,
  currentUser,
  currentUserProfile,
  currentRSVP,
  onSubmit
}: AdvancedRSVPDialogProps) {
  const [response, setResponse] = useState<ParticipantResponse>(currentRSVP?.response || 'pending');
  const [guestCount, setGuestCount] = useState(currentRSVP?.guestCount || 0);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>(currentRSVP?.dietaryRestrictions || []);
  const [specialRequests, setSpecialRequests] = useState(currentRSVP?.specialRequests || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPrePopulated, setHasPrePopulated] = useState(false);

  const rsvpSettings = plan.rsvpSettings;
  const maxGuests = rsvpSettings?.maxGuestsPerParticipant || 0;
  const allowGuestPlusOnes = rsvpSettings?.allowGuestPlusOnes || false;
  const requireDietaryInfo = rsvpSettings?.requireDietaryInfo || false;
  const requireSpecialRequests = rsvpSettings?.requireSpecialRequests || false;
  const rsvpDeadline = rsvpSettings?.rsvpDeadline;

  // Check if RSVP deadline has passed
  const isDeadlinePassed = !!(rsvpDeadline && new Date() > new Date(rsvpDeadline));

  // Check if plan is at capacity
  const currentParticipants = Object.values(plan.participantResponses || {}).filter(r => r === 'going').length;
  const totalGuests = Object.values(plan.participantRSVPDetails || {}).reduce((sum, details) => sum + (details.guestCount || 0), 0);
  const totalAttendees = currentParticipants + totalGuests;
  const maxParticipants = rsvpSettings?.maxParticipants;
  const isAtCapacity = maxParticipants && totalAttendees >= maxParticipants;

  // Determine user role for contextual experience
  const isHost = currentUser?.uid === plan.hostId;
  const isInvited = plan.invitedParticipantUserIds?.includes(currentUser?.uid || '');
  const hasExistingRSVP = !!currentRSVP;

  // Check if profile has relevant data
  const profileHasDietaryRestrictions = currentUserProfile?.dietaryRestrictions && currentUserProfile.dietaryRestrictions.length > 0;
  const profileHasAllergies = currentUserProfile?.allergies && currentUserProfile.allergies.length > 0;
  const profileHasPhysicalLimitations = currentUserProfile?.physicalLimitations && currentUserProfile.physicalLimitations.length > 0;
  
  // Always use profile data - no manual input fields needed
  const shouldShowDietaryInput = false;
  const shouldShowSpecialRequestsInput = false;

  // Smart pre-population based on user profile and context
  useEffect(() => {
    if (currentRSVP) {
      // If user has existing RSVP, use that data
      setResponse(currentRSVP.response);
      setGuestCount(currentRSVP.guestCount || 0);
      setDietaryRestrictions(currentRSVP.dietaryRestrictions || []);
      setSpecialRequests(currentRSVP.specialRequests || '');
      setHasPrePopulated(true);
    } else if (currentUserProfile && !hasPrePopulated && open) {
      // Pre-populate from user profile for new RSVPs
      const profileDietaryRestrictions = currentUserProfile.dietaryRestrictions || [];
      
      // Auto-populate dietary restrictions if available
      if (profileDietaryRestrictions.length > 0) {
        setDietaryRestrictions(profileDietaryRestrictions);
      }
      
      // Auto-populate special requests from profile data
      const autoSpecialRequests = [];
      if (currentUserProfile.allergies && currentUserProfile.allergies.length > 0) {
        autoSpecialRequests.push(`Allergies: ${currentUserProfile.allergies.join(', ')}`);
      }
      if (currentUserProfile.physicalLimitations && currentUserProfile.physicalLimitations.length > 0) {
        autoSpecialRequests.push(`Physical Limitations: ${currentUserProfile.physicalLimitations.join(', ')}`);
      }
      if (autoSpecialRequests.length > 0) {
        setSpecialRequests(autoSpecialRequests.join('\n'));
      }
      
      // Smart default response based on user role and context
      if (isHost) {
        setResponse('going'); // Host is always going
      } else if (isInvited) {
        setResponse('pending'); // Invited users start as pending
      } else {
        setResponse('pending'); // Public users start as pending
      }
      
      setHasPrePopulated(true);
    }
  }, [currentRSVP, currentUserProfile, hasPrePopulated, open, isHost, isInvited]);

  // Reset pre-population flag when dialog closes
  useEffect(() => {
    if (!open) {
      setHasPrePopulated(false);
    }
  }, [open]);





  const handleSubmit = async () => {
    if (requireDietaryInfo && dietaryRestrictions.length === 0) {
      toast.error('Please specify any dietary restrictions or select "None"');
      return;
    }

    if (requireSpecialRequests && !specialRequests.trim()) {
      toast.error('Please provide any special requests or indicate "None"');
      return;
    }

    if (response === 'going' && isAtCapacity && !currentRSVP) {
      toast.error('This event is at capacity. You can join the waitlist instead.');
      return;
    }

    setIsSubmitting(true);
    try {
      const rsvpDetails: RSVPDetails = {
        response,
        guestCount,
        dietaryRestrictions,
        specialRequests,
        respondedAt: new Date().toISOString()
      };

      await onSubmit(rsvpDetails);
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting RSVP:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {hasExistingRSVP ? 'Update RSVP' : 'RSVP'} to {plan.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">


          {/* Profile Data Display */}
          {profileHasDietaryRestrictions && (
            <div className="p-3 rounded-lg border bg-green-50 border-green-200">
              <p className="text-sm font-medium text-green-800">Dietary Restrictions (from profile)</p>
              <p className="text-sm text-green-700">{currentUserProfile?.dietaryRestrictions?.join(', ')}</p>
            </div>
          )}

          {(profileHasAllergies || profileHasPhysicalLimitations) && (
            <div className="p-3 rounded-lg border bg-green-50 border-green-200">
              <p className="text-sm font-medium text-green-800">Special Requirements (from profile)</p>
              <div className="text-sm text-green-700 space-y-1">
                {profileHasAllergies && (
                  <p>Allergies: {currentUserProfile?.allergies?.join(', ')}</p>
                )}
                {profileHasPhysicalLimitations && (
                  <p>Physical Limitations: {currentUserProfile?.physicalLimitations?.join(', ')}</p>
                )}
              </div>
            </div>
          )}

          {/* Role-based context message */}
          {isHost && (
            <div className="p-3 rounded-lg border bg-green-50 border-green-200">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Host RSVP</span>
              </div>
              <p className="text-sm text-green-700 mt-1">
                As the host, your response helps set expectations for your guests.
              </p>
            </div>
          )}

          {/* Deadline Warning */}
          {rsvpDeadline && (
            <div className={`p-3 rounded-lg border ${isDeadlinePassed ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-center gap-2">
                <AlertCircle className={`h-4 w-4 ${isDeadlinePassed ? 'text-red-600' : 'text-blue-600'}`} />
                <span className={`text-sm font-medium ${isDeadlinePassed ? 'text-red-800' : 'text-blue-800'}`}>
                  {isDeadlinePassed ? 'RSVP Deadline Passed' : 'RSVP Deadline'}
                </span>
              </div>
              <p className={`text-sm mt-1 ${isDeadlinePassed ? 'text-red-700' : 'text-blue-700'}`}>
                {isDeadlinePassed 
                  ? `The RSVP deadline was ${new Date(rsvpDeadline).toLocaleDateString()}`
                  : `Please respond by ${new Date(rsvpDeadline).toLocaleDateString()}`
                }
              </p>
            </div>
          )}

          {/* Capacity Warning */}
          {isAtCapacity && response === 'going' && !currentRSVP && (
            <div className="p-3 rounded-lg border bg-orange-50 border-orange-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">Event at Capacity</span>
              </div>
              <p className="text-sm text-orange-700 mt-1">
                This event is currently full ({totalAttendees}/{maxParticipants} attendees). You can join the waitlist.
              </p>
            </div>
          )}

          {/* Response Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Your Response *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {responseOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = response === option.value;
                const isDisabled = isDeadlinePassed && !hasExistingRSVP;
                
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setResponse(option.value as ParticipantResponse)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? `${option.bgColor} border-current ${option.color}`
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Icon className={`h-5 w-5 ${isSelected ? option.color : 'text-gray-400'}`} />
                      <span className={`font-medium ${isSelected ? option.color : 'text-gray-600'}`}>
                        {option.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guest Count - Only show if allowed and user is going */}
          {allowGuestPlusOnes && response === 'going' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Additional Guests</Label>
                <span className="text-sm text-gray-500">Max: {maxGuests}</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGuestCount(Math.max(0, guestCount - 1))}
                  disabled={guestCount <= 0}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-lg font-medium w-8 text-center">{guestCount}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGuestCount(Math.min(maxGuests, guestCount + 1))}
                  disabled={guestCount >= maxGuests}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {guestCount > 0 && (
                <p className="text-sm text-gray-600">
                  You're bringing {guestCount} additional guest{guestCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}






        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || response === 'pending'}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {hasExistingRSVP ? 'Updating...' : 'Submitting...'}
              </>
            ) : (
              hasExistingRSVP ? 'Update RSVP' : 'Submit RSVP'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}