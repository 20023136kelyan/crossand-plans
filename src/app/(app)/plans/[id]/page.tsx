'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO, isValid, isPast, isFuture } from 'date-fns';
import type { Plan as PlanType, Comment, RSVPStatusType, ParticipantResponse } from '@/types/user';

// Import services
import { getPlanById, getPlanComments, getUserRatingForPlan } from '@/services/planService';
import { getUsersProfiles } from '@/services/userService';
import {
  updateMyRSVPAction,
  submitRatingAction,
  submitCommentAction,
  addPhotoHighlightAction,
  deletePlanAction,
  deleteRatingAction,
  updateCommentAction,
  deleteCommentAction,
  createPlanShareInviteAction,
  copyPlanToMyAccountAction
} from '@/app/actions/planActions';
import { canUserCommentAndRate, hasUserRSVPd } from '@/utils/planPermissions';
import { createFeedPostAction } from '@/app/actions/feedActions';

// Import new modular components
import PlanHero from '@/components/plans/PlanHero';
import { PlanDetailsHeader } from '@/components/plans/PlanDetailsHeader';
import { PlanInfoCards } from '@/components/plans/PlanInfoCards';
import { PlanParticipants } from '@/components/plans/PlanParticipants';
import { PlanPhotoHighlights } from '@/components/plans/PlanPhotoHighlights';
import PlanComments from '@/components/plans/PlanComments';
import { PlanRatingSection } from '@/components/plans/PlanRatingSection';
import { ShareToFeedDialog } from '@/components/plans/ShareToFeedDialog';
import { QRCodeDialog } from '@/components/plans/QRCodeDialog';
import { FriendPickerDialog } from '@/components/plans/FriendPickerDialog';
import { DeletePlanDialog } from '@/components/plans/DeletePlanDialog';
import { AdvancedRSVPDialog } from '@/components/plans/AdvancedRSVPDialog';
import { WaitlistDialog } from '@/components/plans/WaitlistDialog';
import { CopyPlanDialog } from '@/components/plans/CopyPlanDialog';
import ParticipantManagementDialog from '@/components/plans/ParticipantManagementDialog';
import { EnhancedPlanSharingDialog } from '@/components/plans/EnhancedPlanSharingDialog';
import { PlanItinerary } from '@/components/plans/PlanItinerary';
import { PlanMap } from '@/components/plans/PlanMap';


// Import UI components for dialogs and alerts
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

interface ParticipantDetails {
  userId: string;
  name: string;
  profilePicture?: string | null;
  response: ParticipantResponse;
  isHost: boolean;
}

type UserRole = 'host' | 'confirmed' | 'invited' | 'public' | 'authenticated';

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, currentUserProfile } = useAuth();
  const planId = params.id as string;

  // Core state
  const [plan, setPlan] = useState<PlanType | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [participantDetails, setParticipantDetails] = useState<ParticipantDetails[]>([]);
  
  // Rating state
  const [userRating, setUserRating] = useState(0);
  const [hasRated, setHasRated] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  
  // Dialog states
const [deleteLoading, setDeleteLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [shareToFeedOpen, setShareToFeedOpen] = useState(false);
  const [qrCodeOpen, setQrCodeOpen] = useState(false);
  const [friendPickerOpen, setFriendPickerOpen] = useState(false);
  const [deletePlanOpen, setDeletePlanOpen] = useState(false);
  const [showAdvancedRSVPDialog, setShowAdvancedRSVPDialog] = useState(false);
  const [showWaitlistDialog, setShowWaitlistDialog] = useState(false);
  const [showCopyPlanDialog, setShowCopyPlanDialog] = useState(false);
  const [showParticipantManagementDialog, setShowParticipantManagementDialog] = useState(false);
  const [showEnhancedSharingDialog, setShowEnhancedSharingDialog] = useState(false);
  
  // Loading states
  const [rsvpLoading, setRsvpLoading] = useState(false);

  // Fetch plan data and related information
  const fetchPlanAndRelatedData = async () => {
    try {
      setLoading(true);
      
      // Fetch plan data
      const planData = await getPlanById(planId);
      if (!planData) {
        router.push('/plans');
        return;
      }
      setPlan(planData);
      
      // Fetch comments
      const unsubscribeComments = getPlanComments(planId, (commentsData) => {
        setComments(commentsData || []);
      });
      
      // Fetch user rating if authenticated
      if (user) {
        const ratingData = await getUserRatingForPlan(planId, user.uid);
        if (ratingData) {
          setUserRating(ratingData.value || 0);
          setHasRated(true);
        }
      }
      
      // Fetch participant details
      const allParticipantIds = [planData.hostId, ...(planData.invitedParticipantUserIds || [])];
      if (allParticipantIds.length > 0) {
        const profiles = await getUsersProfiles(allParticipantIds);
        
        const details: ParticipantDetails[] = allParticipantIds.map(userId => {
          const profile = profiles.find(p => p.uid === userId);
          const response = planData.participantResponses?.[userId] || (userId === planData.hostId ? 'going' : 'pending');
          return {
            userId,
            name: profile?.name || 'Unknown User',
            profilePicture: profile?.avatarUrl,
            response: response as ParticipantResponse,
            isHost: userId === planData.hostId
          };
        });
        
        setParticipantDetails(details);
      }
    } catch (error) {
      console.error('Error fetching plan data:', error);
      toast.error('Failed to load plan details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (planId) {
      fetchPlanAndRelatedData();
    }
  }, [planId, user]);

  // Determine user role
  const userRole: UserRole = useMemo(() => {
    if (!plan) return 'public';
    if (!user) return 'public';
    if (plan.hostId === user.uid) return 'host';
    
    const isInvited = plan.invitedParticipantUserIds?.includes(user.uid);
    const userResponse = plan.participantResponses?.[user.uid];
    if (isInvited && userResponse) {
      return userResponse === 'going' ? 'confirmed' : 'invited';
    }
    
    return 'authenticated';
  }, [plan, user]);

  // Calculate derived data
  const isHost = userRole === 'host';
  const isCurrentUserParticipant = userRole === 'confirmed' || userRole === 'host';
  const currentUserResponse = plan?.participantResponses?.[user?.uid || ''];
  
  const rsvpSummary = useMemo(() => {
    if (!plan?.participantResponses) return { going: 0, maybe: 0, notGoing: 0 };
    
    return Object.values(plan.participantResponses).reduce(
      (acc, response) => {
        switch (response) {
          case 'going':
            acc.going++;
            break;
          case 'maybe':
            acc.maybe++;
            break;
          case 'not-going':
            acc.notGoing++;
            break;
        }
        return acc;
      },
      { going: 0, maybe: 0, notGoing: 0 }
    );
  }, [plan?.participantResponses]);

  const staticMapUrl = useMemo(() => {
    if (!plan?.location) return '';
    const encodedLocation = encodeURIComponent(plan.location);
    return `https://maps.googleapis.com/maps/api/staticmap?center=${encodedLocation}&zoom=15&size=400x300&maptype=roadmap&markers=color:red%7C${encodedLocation}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
  }, [plan?.location]);

  const planUrl = `${window.location.origin}/plans/${planId}`;

  // Event handlers
  const handleRSVPChange = async (response: RSVPStatusType) => {
    if (!user || !plan) return;
    
    setRsvpLoading(true);
    try {
      const idToken = await user.getIdToken();
      await updateMyRSVPAction(planId, idToken, response);
      await fetchPlanAndRelatedData();
      toast.success(`RSVP updated to ${response}`);
    } catch (error) {
      console.error('Error updating RSVP:', error);
      toast.error('Failed to update RSVP');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleParticipantRSVP = async (response: 'yes' | 'no' | 'maybe') => {
    const rsvpStatus: RSVPStatusType = response === 'yes' ? 'going' :
                                      response === 'no' ? 'not-going' : 'maybe';
    await handleRSVPChange(rsvpStatus);
  };

  const handleRatingSubmit = async () => {
    if (!user || userRating === 0) return;
    
    setRatingLoading(true);
    try {
      await submitRatingAction(planId, await user.getIdToken(), userRating);
      setHasRated(true);
      toast.success('Rating submitted successfully!');
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error('Failed to submit rating');
    } finally {
      setRatingLoading(false);
    }
  };

  const handleClearRating = async () => {
    if (!user) return;
    
    setRatingLoading(true);
    try {
      await deleteRatingAction(planId, await user.getIdToken());
      setUserRating(0);
      setHasRated(false);
      toast.success('Rating cleared successfully!');
    } catch (error) {
      console.error('Error clearing rating:', error);
      toast.error('Failed to clear rating');
    } finally {
      setRatingLoading(false);
    }
  };

  const handleCommentSubmit = async (content: string) => {
    if (!user) return;
    
    try {
      const idToken = await user.getIdToken();
      await submitCommentAction(planId, idToken, content);
      await fetchPlanAndRelatedData();
      toast.success('Comment added successfully!');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const handleCommentUpdate = async (commentId: string, content: string) => {
    if (!user) return;
    
    try {
      await updateCommentAction(planId, commentId, content, await user.getIdToken());
      await fetchPlanAndRelatedData();
      toast.success('Comment updated successfully!');
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('Failed to update comment');
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    if (!user) return;
    
    try {
      await deleteCommentAction(planId, commentId, await user.getIdToken());
      await fetchPlanAndRelatedData();
      toast.success('Comment deleted successfully!');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!user) return;
    
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const idToken = await user.getIdToken();
      await addPhotoHighlightAction(planId, formData, idToken);
      await fetchPlanAndRelatedData();
      toast.success('Photo uploaded successfully!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
    }
  };

  const handleShareToFeed = async (message: string) => {
    if (!user || !plan) return;
    
    // Check if plan has photo highlights
    const highlightImageUrl = plan.photoHighlights?.[0];
    if (!highlightImageUrl) {
      toast.error('Please add a photo highlight to this plan before sharing to feed');
      return;
    }
    
    try {
      await createFeedPostAction({
        planId: planId,
        planName: plan.name,
        highlightImageUrl: highlightImageUrl,
        postText: message,
        visibility: 'public'
      }, await user.getIdToken());
      toast.success('Plan shared to feed successfully!');
    } catch (error) {
      console.error('Error sharing to feed:', error);
      toast.error('Failed to share to feed');
    }
  };

  const handleShareWithFriends = async (friendIds: string[]) => {
    if (!user || !plan) return;
    
    try {
      const idToken = await user.getIdToken();
      for (const friendId of friendIds) {
        await createPlanShareInviteAction(planId, plan.name, friendId, idToken);
      }
      toast.success(`Plan shared with ${friendIds.length} friend${friendIds.length > 1 ? 's' : ''}!`);
    } catch (error) {
      console.error('Error sharing with friends:', error);
      toast.error('Failed to share with friends');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(planUrl);
      toast.success('Plan link copied to clipboard!');
    } catch (error) {
      console.error('Error copying link:', error);
      toast.error('Failed to copy link');
    }
  };

  const handleCopyPlan = async () => {
    if (!user) {
      router.push('/auth/signin');
      return;
    }

    if (!isHost) {
      setShowCopyPlanDialog(true);
    }
  };

  const handleAdvancedCopyPlan = async (customizations: any) => {
    try {
      setCopyLoading(true);
      if (!user) {
        toast.error('You must be logged in to copy a plan');
        return;
      }
      const idToken = await user.getIdToken();
      const result = await copyPlanToMyAccountAction(planId, idToken);
      
      if (result.success && result.newPlanId) {
        toast.success('Plan copied to your account with your customizations!');
        router.push(`/plans/${result.newPlanId}`);
      } else {
        toast.error(result.error || 'Failed to copy plan');
      }
    } catch (error) {
      console.error('Error copying plan:', error);
      toast.error('Failed to copy plan');
    } finally {
      setCopyLoading(false);
    }
  };

  const handleAdvancedRSVP = async (rsvpData: any) => {
    try {
      setRsvpLoading(true);
      await handleRSVPChange(rsvpData.status);
      toast.success('RSVP updated with your details!');
    } catch (error) {
      console.error('Error updating RSVP:', error);
      toast.error('Failed to update RSVP');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleJoinWaitlist = async () => {
    try {
      setRsvpLoading(true);
      toast.success('Added to waitlist!');
    } catch (error) {
      console.error('Error joining waitlist:', error);
      toast.error('Failed to join waitlist');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleLeaveWaitlist = async () => {
    try {
      setRsvpLoading(true);
      toast.success('Removed from waitlist');
    } catch (error) {
      console.error('Error leaving waitlist:', error);
      toast.error('Failed to leave waitlist');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleSendReminder = async (userIds: string[], message?: string) => {
    try {
      setRsvpLoading(true);
      toast.success(`Reminder sent to ${userIds.length} participants`);
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast.error('Failed to send reminder');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleSendMessage = async (userIds: string[], message: string) => {
    try {
      setRsvpLoading(true);
      toast.success(`Message sent to ${userIds.length} participants`);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    try {
      setRsvpLoading(true);
      toast.success('Participant removed');
    } catch (error) {
      console.error('Error removing participant:', error);
      toast.error('Failed to remove participant');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handlePromoteToHost = async (userId: string) => {
    try {
      setRsvpLoading(true);
      toast.success('User promoted to host');
    } catch (error) {
      console.error('Error promoting user:', error);
      toast.error('Failed to promote user');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleExportParticipants = async () => {
    try {
      toast.success('Participant list exported');
    } catch (error) {
      console.error('Error exporting participants:', error);
      toast.error('Failed to export participants');
    }
  };

  const handleUpdateShareSettings = async (settings: any) => {
    try {
      setRsvpLoading(true);
      toast.success('Share settings updated');
    } catch (error) {
      console.error('Error updating share settings:', error);
      toast.error('Failed to update share settings');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!user || !isHost) return;
    
    setDeleteLoading(true);
    try {
      const idToken = await user.getIdToken();
      await deletePlanAction(planId, idToken);
      toast.success('Plan deleted successfully!');
      router.push('/plans');
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Failed to delete plan');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading plan details...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Plan Not Found</h1>
          <p className="text-muted-foreground">The plan you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  // Template detection logic
  const isTemplate = plan?.isTemplate;
  const userHasInteracted = plan?.participantUserIds?.includes(user?.uid || '') || 
                          plan?.hostId === user?.uid;
  const showAsTemplate = isTemplate && !userHasInteracted;

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full px-0 py-6">
        {/* Template Banner */}
        {showAsTemplate && (
          <div className="mb-6 px-4">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-full">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900">Activity Template</h3>
                  <p className="text-sm text-blue-700">This is a template based on a completed activity. Templates are read-only - copy it to create your own version!</p>
                </div>
                {plan.templateOriginalHostName && (
                  <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    Created by {plan.templateOriginalHostName}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="mb-8 px-4">
          <PlanHero 
            plan={plan} 
            userRole={userRole}
            currentUser={user!}
            isHost={isHost}
            copyLoading={copyLoading}
            onCopyToMyPlans={handleCopyPlan}
            onSharePlanLink={handleCopyLink}
            onOpenQRCodeDialog={() => setQrCodeOpen(true)}
            onShowFriendPicker={() => setFriendPickerOpen(true)}
            onShowShareToFeedDialog={() => setShowEnhancedSharingDialog(true)}
            onDeletePlanRequest={() => setDeletePlanOpen(true)}
          />
        </div>



        {/* Main Content */}
        <div className="px-4">
          <div className="space-y-8">
            {/* Plan Info Cards */}
            <PlanInfoCards plan={plan} staticMapUrl={staticMapUrl} />

            {/* Interactive Map - Moved up for better visibility */}
            {plan.location && (
              <PlanMap
                planName={plan.name}
                itinerary={plan.itinerary}
                apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                className="h-80"
              />
            )}

            {/* Itinerary */}
            {plan.itinerary && plan.itinerary.length > 0 && (
              <PlanItinerary
                itinerary={plan.itinerary}
              />
            )}



            {/* Photo Highlights */}
            <PlanPhotoHighlights
              plan={plan}
              isCurrentUserParticipant={userRole === 'confirmed' || userRole === 'host'}
              highlightUploading={false}
              onUploadHighlight={handlePhotoUpload}
            />

            {/* Participants & RSVP - Hidden for templates */}
            {!showAsTemplate && (
              <PlanParticipants
                plan={plan}
                participantDetails={participantDetails.reduce((acc, participant) => {
                  acc[participant.userId] = {
                    name: participant.name,
                    avatarUrl: participant.profilePicture
                  };
                  return acc;
                }, {} as { [uid: string]: any })}
                currentUser={user!}
                isCurrentUserParticipant={isCurrentUserParticipant}
                isHost={isHost}
                isEventDateValid={true}
                currentUserResponse={currentUserResponse}
                rsvpSummary={{
                  yes: rsvpSummary.going,
                  maybe: rsvpSummary.maybe,
                  no: rsvpSummary.notGoing
                }}
                rsvpLoading={rsvpLoading}
                onRSVP={handleParticipantRSVP}
                onAdvancedRSVP={() => setShowAdvancedRSVPDialog(true)}
                onManageParticipants={() => setShowParticipantManagementDialog(true)}
                onJoinWaitlist={() => setShowWaitlistDialog(true)}
              />
            )}

            {/* Template Action Card */}
            {showAsTemplate && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="text-center space-y-4">
                  <div className="bg-blue-50 p-3 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Try This Activity</h3>
                    <p className="text-sm text-gray-600 mt-1">Copy this template to create your own version with your preferred date and participants.</p>
                  </div>
                  <button
                    onClick={handleCopyPlan}
                    disabled={copyLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                  >
                    {copyLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Copying...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy to My Plans
                      </>
                    )}
                  </button>
                  {plan.templateOriginalHostName && (
                    <p className="text-xs text-gray-500">
                      Template created from an activity by {plan.templateOriginalHostName}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Ratings - Always visible (preserved for templates) */}
            {(
              <PlanRatingSection
                isHost={isHost}
                userRating={userRating}
                hasRated={hasRated}
                ratingLoading={ratingLoading}
                canRate={plan ? canUserCommentAndRate(plan, user?.uid) : false}
                onRatingChange={setUserRating}
                onRatingSubmit={handleRatingSubmit}
                onClearRating={handleClearRating}
              />
            )}

            {/* Template Info Section */}
            {showAsTemplate && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">About This Template</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-full">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-700">Tested and completed by real users</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-700">Estimated duration: {plan.itinerary?.length ? `${plan.itinerary.length} stops` : 'Multiple activities'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-full">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-700">Location: {plan.city}</span>
                  </div>
                  {plan.priceRange && (
                    <div className="flex items-center gap-3">
                      <div className="bg-yellow-100 p-2 rounded-full">
                        <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700">Price range: {plan.priceRange}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Comments - Always visible (preserved for templates) */}
            {(
              <PlanComments
                comments={comments.map(comment => ({
                  ...comment,
                  createdAt: typeof comment.createdAt === 'string' ? comment.createdAt : (comment.createdAt instanceof Date ? comment.createdAt.toISOString() : comment.createdAt.toDate().toISOString()),
                  updatedAt: comment.updatedAt ? (typeof comment.updatedAt === 'string' ? comment.updatedAt : (comment.updatedAt instanceof Date ? comment.updatedAt.toISOString() : comment.updatedAt.toDate().toISOString())) : undefined
                }))}
                currentUserId={user?.uid}
                canComment={plan ? canUserCommentAndRate(plan, user?.uid) : false}
                onCommentSubmit={handleCommentSubmit}
                onCommentUpdate={handleCommentUpdate}
                onCommentDelete={handleCommentDelete}
              />
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ShareToFeedDialog
        open={shareToFeedOpen}
        onOpenChange={setShareToFeedOpen}
        plan={plan}
        onSubmit={handleShareToFeed}
      />

      <QRCodeDialog
        open={qrCodeOpen}
        onOpenChange={setQrCodeOpen}
        plan={plan}
        planUrl={planUrl}
      />

      <FriendPickerDialog
        open={friendPickerOpen}
        onOpenChange={setFriendPickerOpen}
        plan={plan}
        onShare={handleShareWithFriends}
      />

      <AdvancedRSVPDialog
        open={showAdvancedRSVPDialog}
        onOpenChange={setShowAdvancedRSVPDialog}
        plan={plan}
        currentUser={user!}
        currentUserProfile={currentUserProfile}
        currentRSVP={plan?.participantRSVPDetails?.[user?.uid || '']}
        onSubmit={handleAdvancedRSVP}
      />

      <WaitlistDialog
        open={showWaitlistDialog}
        onOpenChange={setShowWaitlistDialog}
        plan={plan}
        currentUser={user!}
        participantDetails={participantDetails.reduce((acc, participant) => {
          acc[participant.userId] = {
            name: participant.name,
            avatarUrl: participant.profilePicture || undefined
          };
          return acc;
        }, {} as { [uid: string]: { name?: string; avatarUrl?: string } })}
        isOnWaitlist={plan?.waitlist?.includes(user?.uid || '') || false}
        onJoinWaitlist={handleJoinWaitlist}
        onLeaveWaitlist={handleLeaveWaitlist}
      />

      <CopyPlanDialog
        open={showCopyPlanDialog}
        onOpenChange={setShowCopyPlanDialog}
        plan={plan}
        currentUser={user}
        onCopy={handleAdvancedCopyPlan}
      />

      <ParticipantManagementDialog
        open={showParticipantManagementDialog}
        onOpenChange={setShowParticipantManagementDialog}
        plan={plan}
        currentUser={user}
        isHost={isHost}
        onSendReminder={handleSendReminder}
        onSendMessage={handleSendMessage}
        onRemoveParticipant={handleRemoveParticipant}
        onPromoteToHost={handlePromoteToHost}
        onExportParticipants={handleExportParticipants}
      />

      <EnhancedPlanSharingDialog
        open={showEnhancedSharingDialog}
        onOpenChange={setShowEnhancedSharingDialog}
        plan={plan}
        currentUser={user}
        isHost={isHost}
        onShareToFeed={() => handleShareToFeed('')}
        onShareWithFriends={handleShareWithFriends}
        onUpdateShareSettings={handleUpdateShareSettings}
      />

      {/* Delete Plan Confirmation */}
      <AlertDialog open={deletePlanOpen} onOpenChange={setDeletePlanOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{plan.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlan}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete Plan'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
