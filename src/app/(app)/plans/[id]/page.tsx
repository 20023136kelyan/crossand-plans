'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';
import { motion, useScroll, useTransform } from 'framer-motion';

// Context
import { useAuth } from '@/context/AuthContext';

// Types
import { Plan, RSVPStatusType, ParticipantDetails, Comment, Rating, CreateFeedPostData } from '@/types/user';

// Mock Actions - Replace with actual implementations
const fetchPlanByIdAction = async (planId: string): Promise<{ success: boolean; plan?: Plan; error?: string }> => {
  // Mock implementation
  return {
    success: true,
    plan: {
      id: planId,
      name: `Plan ${planId}`,
      description: 'This is a mock plan description.',
      location: 'Mock Location',
      description: "This is a sample plan",
      eventTime: new Date().toISOString(),
      hostId: "user123",
      participantResponses: {} as Record<string, ParticipantResponse>,
      itinerary: [],
      comments: [],
      shareSettings: { public: true, allowRSVP: true, allowComments: true, allowItineraryContribution: false },
      waitlist: [],
      // Add required fields from the Plan interface
      location: "Sample Location",
      city: "Sample City",
      eventType: "gathering",
      eventTypeLowercase: "gathering",
      startsAt: new Date().toISOString(),
      endsAt: new Date().toISOString(),
      isPast: false,
      photoURL: null,
      photoURLs: [],
      hostName: "Sample Host",
      hostUsername: "samplehost",
      hostPhotoURL: null,
      status: "active",
      isPrivate: false
    },
    error: undefined,
    // For TypeScript, add an empty participantDetails array (should be populated by real implementation)
    participantDetails: []
  };
}

// Helper functions
async function getUsersProfiles(uids: string[]): Promise<Record<string, UserProfile>> {
  console.log('Fetching profiles for:', uids);
  // In a real app, this would fetch from Firestore or your backend
  return Promise.resolve({});
}

async function uploadPhotoAndGetURL(file: File): Promise<string> {
  console.log('Uploading file:', file.name);
  // In a real app, this would use Firebase Storage or another service
  return Promise.resolve(`https://example.com/uploads/${file.name}`);
}

// Mock component imports
// In a real project, these would be imported from their respective files
const PlanHero = ({ plan, isHost }: { plan: PlanType; isHost: boolean }) => <div>Plan Hero Component</div>;
const PlanDetailsHeader = ({ plan }: { plan: PlanType }) => <div>Plan Details Header Component</div>;
const PlanInfoCards = ({ plan }: { plan: PlanType }) => <div>Plan Info Cards Component</div>;
const PlanItinerary = ({ plan, isHost }: { plan: PlanType; isHost: boolean }) => <div>Plan Itinerary Component</div>;
const PlanMap = ({ plan }: { plan: PlanType }) => <div>Plan Map Component</div>;
const PlanParticipants = ({ plan, participants }: { plan: PlanType; participants: ParticipantDetails[] }) => <div>Plan Participants Component</div>;
const PlanPhotoHighlights = ({ plan }: { plan: PlanType }) => <div>Plan Photo Highlights Component</div>;
const PlanChat = ({ plan }: { plan: PlanType }) => <div>Plan Chat Component</div>;
const PlanRatingSection = ({ plan, onSubmitRating }: { plan: PlanType; onSubmitRating: (rating: number) => Promise<void> }) => <div>Plan Rating Section Component</div>;
const PlanComments = ({ plan }: { plan: PlanType }) => <div>Plan Comments Component</div>;
const ShareToFeedDialog = ({ isOpen, onClose, plan }: { isOpen: boolean; onClose: () => void; plan: PlanType }) => <div>Share To Feed Dialog</div>;
const QRCodeDialog = ({ isOpen, onClose, plan }: { isOpen: boolean; onClose: () => void; plan: PlanType }) => <div>QR Code Dialog</div>;
const FriendPickerDialog = ({ isOpen, onClose, plan }: { isOpen: boolean; onClose: () => void; plan: PlanType }) => <div>Friend Picker Dialog</div>;
const DeletePlanDialog = ({ isOpen, onClose, onDelete }: { isOpen: boolean; onClose: () => void; onDelete: () => Promise<void> }) => <div>Delete Plan Dialog</div>;
const AdvancedRSVPDialog = ({ isOpen, onClose, plan }: { isOpen: boolean; onClose: () => void; plan: PlanType }) => <div>Advanced RSVP Dialog</div>;
const WaitlistDialog = ({ isOpen, onClose, plan, currentUser, participantDetails, isOnWaitlist, onJoinWaitlist }: { isOpen: boolean; onClose: () => void; plan: PlanType; currentUser: any; participantDetails: Record<string, ParticipantDetails>; isOnWaitlist: boolean; onJoinWaitlist: (notes?: string) => Promise<void> }) => <div>Waitlist Dialog</div>;
const CopyPlanDialog = ({ isOpen, onClose, onCopy }: { isOpen: boolean; onClose: () => void; onCopy: () => Promise<void> }) => <div>Copy Plan Dialog</div>;
const ParticipantManagementDialog = ({ isOpen, onClose, plan, participants }: { isOpen: boolean; onClose: () => void; plan: PlanType; participants: ParticipantDetails[] }) => <div>Participant Management Dialog</div>;
const EnhancedPlanSharingDialog = ({ isOpen, onClose, plan }: { isOpen: boolean; onClose: () => void; plan: PlanType }) => <div>Enhanced Plan Sharing Dialog</div>;

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, currentUserProfile } = useAuth();
  const planId = params.id as string;

  const [plan, setPlan] = useState<PlanType | null>(null);
  const [participantDetails, setParticipantDetails] = useState<ParticipantDetails[]>([]);
  const [userRole, setUserRole] = useState<UserRole>('public');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({
    rsvp: false,
    rating: false,
    comment: false,
    photoUpload: false,
    delete: false,
    copy: false,
    shareToFeed: false
  });
  const [idToken, setIdToken] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState<DialogsState>({
    shareToFeed: false,
    qrCode: false,
    friendPicker: false,
    delete: false,
    advancedRSVP: false,
    waitlist: false,
    copy: false,
    participantManagement: false,
    enhancedSharing: false,
  });

  // Function to fetch plan data from server
  const fetchPlanData = useCallback(async () => {
    if (!planId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get new ID token
      const token = user ? await user.getIdToken() : null;
      setIdToken(token);
      
      // Get plan data
      if (token) { // Only proceed if we have a token
        const result = await getPlanForViewingAction(token, planId);
        
        if (result.error) {
          setError(result.error);
          setPlan(null);
        } else if (result.plan) {
          setPlan(result.plan);
          
          // If the API returns participant details, use them directly
          if (result.participantDetails && result.participantDetails.length > 0) {
            setParticipantDetails(result.participantDetails);
          } 
          // Otherwise, build them from the plan data
          else if (result.plan.participantResponses) {
            const participants: ParticipantDetails[] = [];
            
            // Add host as participant
            participants.push({
              userId: result.plan.hostId,
              name: 'Host',  // Placeholder - replace with actual user data
              username: null,
              profilePicture: undefined,
              response: 'yes', 
              isHost: true
            });
            
            // Add other participants
            Object.entries(result.plan.participantResponses).forEach(([userId, response]) => {
              participants.push({
                userId,
                name: 'User ' + userId.substring(0, 5),  // Placeholder - replace with actual user data
                username: null,
                profilePicture: undefined,
                response: response as RSVPStatusType, 
                isHost: userId === result.plan.hostId
              });
            });
            setParticipantDetails(participants);
          }
        }
        
        // Determine user role
        if (user && result.plan.hostId === user.uid) {
          setUserRole('host');
        } else if (user && result.plan.participantResponses && 
                  result.plan.participantResponses[user.uid]) {
          setUserRole('confirmed');
        } else if (user) {
          setUserRole('authenticated');
        } else {
          setUserRole('public');
        }
      }
    }
  } catch (err) {
    console.error('Error fetching plan:', err);
    setError('Failed to load plan. Please try again later.');
  } finally {
    setLoading(false);
  }
}, [planId, user]);

// ...

// Action Handlers
const handleRSVP = async (response: 'maybe' | 'yes' | 'no' | 'going' | 'not-going') => {
  if (!user || !plan || actionLoading.rsvp) return;
  
  // Map friendly values to backend values
  const rsvpMapping: Record<string, RSVPStatusType> = {
    'maybe': 'maybe',
    'yes': 'yes',
    'no': 'no',
    'going': 'yes',
    'not-going': 'no'
  };
  
  setActionLoading((prev) => ({ ...prev, rsvp: true }));
  
  try {
    const token = await user.getIdToken();
    const result = await updateMyRSVPAction(plan.id, token, rsvpMapping[response]);
    
    if (result.success) {
      // Optimistically update UI
      // In a real app, we'd refetch the plan data or use a more sophisticated state management
      toast.success(`You are ${response} to this plan.`);
      fetchPlanData();
    } else {
      toast.error('Failed to update your RSVP. Please try again.');

  if (loading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  
  setActionLoading((prev) => ({ ...prev, rating: true }));
  
  try {
    const token = await user.getIdToken();
    const result = await submitRatingAction(token, plan.id, newRating);
    
    if (result.success) {
      toast.success('Rating submitted!');
      fetchPlanData(); // Refetch to get updated data
    } else {
      toast.error(result.error || 'Failed to submit rating');
    }
  } catch (error) {
    console.error('Error submitting rating:', error);
    toast.error('An error occurred while submitting your rating');
  } finally {
    setActionLoading((prev) => ({ ...prev, rating: false }));
  }
};
        onCopyToMyPlans={() => setDialogOpen((prev: DialogsState) => ({ ...prev, copy: true }))}
        onSharePlanLink={onSharePlanLink}
        onOpenQRCodeDialog={() => setDialogOpen((prev: DialogsState) => ({ ...prev, qrCode: true }))}
        onShowFriendPicker={() => setDialogOpen((prev: DialogsState) => ({ ...prev, friendPicker: true }))}
        onShowShareToFeedDialog={() => setDialogOpen((prev: DialogsState) => ({ ...prev, shareToFeed: true }))}
        onDeletePlanRequest={() => setDialogOpen((prev: DialogsState) => ({ ...prev, delete: true }))}
      />

      <motion.div ref={drawerRef} style={{ y: drawerY }} className="relative z-10 -mt-16 rounded-t-2xl bg-background p-4 pb-24 shadow-2xl">
        <div className="mx-auto max-w-4xl">
          <PlanHero
            plan={plan}
            userRole={userRole}
            currentUser={user}
            isHost={isHost}
            onDeletePlanRequest={() => setDialogOpen((prev: DialogsState) => ({ ...prev, delete: true }))}
            onCopyToMyPlans={() => setDialogOpen((prev: DialogsState) => ({ ...prev, copy: true }))}
            onSharePlanLink={onSharePlanLink}
            onShowShareToFeedDialog={() => setDialogOpen((prev: DialogsState) => ({ ...prev, shareToFeed: true }))}
            onShowFriendPicker={() => setDialogOpen((prev: DialogsState) => ({ ...prev, friendPicker: true }))}
            onOpenQRCodeDialog={() => setDialogOpen((prev: DialogsState) => ({ ...prev, qrCode: true }))}
            copyLoading={actionLoading.copy}
          />
          <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="md:col-span-2 space-y-8">
              <PlanInfoCards plan={plan} />
              <PlanItinerary itinerary={plan.itinerary || []} />
              <PlanMap 
                itinerary={plan.itinerary || []} 
                planName={plan.name} 
                apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
              />
              <PlanParticipants
                plan={plan}
                currentUser={user}
                isCurrentUserParticipant={isParticipant}
                isHost={isHost}
                isEventDateValid={isFuture(new Date(plan.eventTime))}
                currentUserResponse={plan.participantResponses?.[user?.uid || '']}
                rsvpSummary={{
                  yes: Object.values(plan.participantResponses || {}).filter(r => r === 'going').length,
                  maybe: Object.values(plan.participantResponses || {}).filter(r => r === 'maybe').length,
                  no: Object.values(plan.participantResponses || {}).filter(r => r === 'not-going').length,
                }}
                participantDetails={participantDetailsMap}
                rsvpLoading={actionLoading.rsvp}
                onRSVP={(response) => handleRSVP(rsvpStatusMap[response])}
                onAdvancedRSVP={() => setDialogOpen((prev: DialogsState) => ({ ...prev, advancedRSVP: true }))}
                onManageParticipants={() => setDialogOpen((prev: DialogsState) => ({ ...prev, participantManagement: true }))}
                onJoinWaitlist={() => setDialogOpen((prev: DialogsState) => ({ ...prev, waitlist: true }))}
              />
              <PlanPhotoHighlights
                plan={plan}
                isCurrentUserParticipant={isParticipant}
                highlightUploading={actionLoading.photoUpload}
                onUploadHighlight={handlePhotoUpload}
              />
              <PlanChat plan={plan} planId={plan.id} currentUser={user} isParticipant={isParticipant || isHost} />
              {canUserCommentAndRate && (
                <PlanRatingSection
                  isHost={isHost}
                  userRating={userRating || 0}
                  hasRated={!!userRating}
                  ratingLoading={actionLoading.rating}
                  canRate={canUserCommentAndRate}
                  onRatingChange={(newRating) => {
                    // This is a temporary state update for the UI
                    // The actual submission happens on button click
                    // We can enhance this by creating a state for the rating
                  }}
                  onRatingSubmit={() => userRating && handleRatingSubmit(userRating)}
                  onClearRating={() => handleRatingSubmit(0)} // Or a dedicated clear action
                />
              )}
              <PlanComments
                comments={plan.comments as any[]}
                currentUserId={user?.uid}
                canComment={canUserCommentAndRate}
                onCommentSubmit={handleCommentSubmit}
                onCommentUpdate={handleCommentUpdate}
                onCommentDelete={handleCommentDelete}
              />
            </div>
            <div className="space-y-4 md:col-span-1">
              <h3 className="font-semibold">Actions</h3>
              {isUpcoming && !isHost && (
                <div className="flex space-x-2">
                  <button onClick={() => handleRSVP('going')} disabled={actionLoading.rsvp} className="flex-1 rounded-md bg-green-500 px-4 py-2 text-white disabled:opacity-50">
                    Going
                  </button>
                  <button onClick={() => handleRSVP('not-going')} disabled={actionLoading.rsvp} className="flex-1 rounded-md bg-red-500 px-4 py-2 text-white disabled:opacity-50">
                    Not Going
                  </button>
                </div>
              )}
              {isUpcoming && !isHost && (
                <button
                  onClick={() => setDialogOpen((prev: DialogsState) => ({ ...prev, advancedRSVP: true }))}
                  className="w-full rounded-md border bg-card px-4 py-2 text-sm font-medium shadow hover:bg-muted"
                >
                  Advanced RSVP
                </button>
              )}
              <button
                onClick={() => setDialogOpen((prev: DialogsState) => ({ ...prev, copy: true }))}
                disabled={actionLoading.copy}
                className="flex w-full items-center justify-center rounded-md border bg-card px-4 py-2 text-sm font-medium shadow hover:bg-muted"
              >
                {actionLoading.copy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Copy Plan
              </button>
              <button
                onClick={() => setDialogOpen((prev: DialogsState) => ({ ...prev, enhancedSharing: true }))}
                className="flex w-full items-center justify-center rounded-md border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow"
              >
                <Share2 className="mr-2 h-4 w-4" /> Share Plan
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Dialogs */}
      {plan && (
        <ShareToFeedDialog
          open={dialogOpen.shareToFeed}
          onOpenChange={(isOpen: boolean) => setDialogOpen((prev: DialogsState) => ({ ...prev, shareToFeed: isOpen }))}
          plan={plan}
          onSubmit={handleShareToFeed}
        />
      )}
      {plan && (
        <QRCodeDialog
          open={dialogOpen.qrCode}
          onOpenChange={(isOpen) => setDialogOpen((prev: DialogsState) => ({ ...prev, qrCode: isOpen }))}
          plan={plan}
          planUrl={`${window.location.origin}/plans/${plan.id}`}
        />
      )}
      {plan && (
        <FriendPickerDialog
          open={dialogOpen.friendPicker}
          onOpenChange={(isOpen) => setDialogOpen((prev: DialogsState) => ({ ...prev, friendPicker: isOpen }))}
          plan={plan}
          onShare={async (friendIds: string[]) => {
            console.log('Selected friends:', friendIds);
            toast.info('Friend sharing not implemented yet.');
          }}
        />
      )}
      <DeletePlanDialog
        open={dialogOpen.delete}
        onOpenChange={(isOpen) => setDialogOpen((prev: DialogsState) => ({ ...prev, delete: isOpen }))}
        onConfirm={handleDeletePlan}
        loading={actionLoading.delete || false}
      />
      {user && plan && (
        <AdvancedRSVPDialog
          open={dialogOpen.advancedRSVP}
          onOpenChange={(isOpen) => setDialogOpen((prev: DialogsState) => ({ ...prev, advancedRSVP: isOpen }))}
          plan={plan}
          currentUser={user}
          onSubmit={async (details: any) => {
            console.log('Advanced RSVP details:', details);
            toast.info('Advanced RSVP not implemented yet.');
          }}
        />
      )}
      {user && plan && (
        <WaitlistDialog
          open={dialogOpen.waitlist}
          onOpenChange={(isOpen) => setDialogOpen((prev: DialogsState) => ({ ...prev, waitlist: isOpen }))}
          plan={plan}
          currentUser={user}
          participantDetails={participantDetailsMap}
          isOnWaitlist={!!plan.waitlist?.includes(user.uid)}
          onJoinWaitlist={async (notes?: string | undefined) => {
            console.log('Joining waitlist with notes:', notes);
            toast.info('Waitlist functionality not implemented yet.');
          }}
          onLeaveWaitlist={async () => {
            console.log('Leaving waitlist');
            toast.info('Waitlist functionality not implemented yet.');
          }}
        />
      )}
      {plan && user && (
        <CopyPlanDialog
          open={dialogOpen.copy}
          onOpenChange={(isOpen) => setDialogOpen((prev: DialogsState) => ({ ...prev, copy: isOpen }))}
          plan={plan}
          currentUser={user}
          onCopy={async (customizations: any) => {
            console.log('Copying plan with customizations:', customizations);
            await handleCopyPlan();
          }}
        />
      )}
      {user && plan && (
        <ParticipantManagementDialog
          open={dialogOpen.participantManagement}
          onOpenChange={(isOpen) => setDialogOpen((prev: DialogsState) => ({ ...prev, participantManagement: isOpen }))}
          plan={plan}
          currentUser={user}
          isHost={isHost}
          onSendReminder={async () => { toast.info('Reminder functionality not implemented.'); }}
          onSendMessage={async () => { toast.info('Send message functionality not implemented.'); }}
          onRemoveParticipant={async () => { toast.info('Remove participant functionality not implemented.'); }}
          onPromoteToHost={async () => { toast.info('Promote to host functionality not implemented.'); }}
          onExportParticipants={async () => { toast.info('Export functionality not implemented.'); }}
        />
      )}
      {user && plan && (
        <EnhancedPlanSharingDialog
          open={dialogOpen.enhancedSharing}
          onOpenChange={(isOpen) => setDialogOpen((prev: DialogsState) => ({ ...prev, enhancedSharing: isOpen }))}
          plan={plan}
          currentUser={user}
          isHost={isHost}
          onShareToFeed={async () => setDialogOpen((prev: DialogsState) => ({ ...prev, shareToFeed: true, enhancedSharing: false }))}
          onShareWithFriends={async () => setDialogOpen((prev: DialogsState) => ({ ...prev, friendPicker: true, enhancedSharing: false }))}
          onUpdateShareSettings={async (settings: any) => {
            console.log('Update share settings:', settings);
            toast.info('Updating share settings not implemented yet.');
          }}
        />
      )}
    </div>
  );
}
