// src/app/(app)/plans/[id]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import NextImage from 'next/image'; // Aliased to avoid conflict with native Image if ever used
import Link from 'next/link';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDescriptionComponent, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  CalendarDays, MapPin, Users, Edit3, Trash2, Share2, QrCode,
  MessageSquare, Send, CheckCircle, XCircle, ChevronLeft, Grid2X2, Star as StarIconLucide, 
  Loader2, Clock, ExternalLink, ThumbsUp, UserCheck, UserX, ThumbsDown, HelpCircle, CopyPlus,
  Camera, UploadCloud, Lock, Globe, Link as LinkIcon, MoreVertical, EyeOff, FileText, DollarSign, ListChecks, ShieldCheck as AdminShieldIcon, CheckCircle as VerifiedIcon, UserCircle as UserCircleIcon
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Plan as PlanType, ItineraryItem, PlanStatusType as FirestorePlanStatus, RSVPStatusType, Comment, UserRoleType, FeedPostVisibility, PlanShareStatus, FriendEntry, UserProfile, Rating, AppTimestamp } from '@/types/user';
import { getPlanById, getPlanComments, getUserRatingForPlan } from '@/services/planService'; 
import { getUsersProfiles } from '@/services/userService'; 
import { format, parseISO, isValid, isPast, isFuture, formatDistanceToNowStrict } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { 
  updateMyRSVPAction, 
  copyPlanToMyAccountAction, 
  submitRatingAction, 
  submitCommentAction, 
  addPhotoHighlightAction, 
  deletePlanAction, 
  createPlanShareInviteAction,
  deleteRatingAction,
  updateCommentAction,
  deleteCommentAction
} from '@/app/actions/planActions'; 
import { cn, commonImageExtensions } from '@/lib/utils';
import { FriendPickerDialog } from '@/components/messages/FriendPickerDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { QRCodeSVG } from 'qrcode.react';

const firestoreStatusDisplayConfig: Record<FirestorePlanStatus, { label: string; icon: React.ElementType; badgeVariant: "default" | "secondary" | "destructive" | "outline" | string }> = {
  draft: { label: 'Draft', icon: Edit3, badgeVariant: 'outline' },
  published: { label: 'Published', icon: CheckCircle, badgeVariant: 'default' },
  cancelled: { label: 'Cancelled', icon: XCircle, badgeVariant: 'destructive' },
};

const rsvpButtonConfig: { status: RSVPStatusType; label: string; icon: React.ElementType; variant: "default" | "secondary" | "outline" | "ghost" }[] = [
    { status: 'going', label: 'Going', icon: ThumbsUp, variant: 'default'},
    { status: 'maybe', label: 'Maybe', icon: HelpCircle, variant: 'secondary'},
    { status: 'declined', label: 'Not Going', icon: ThumbsDown, variant: 'outline'},
];

const VerificationBadge = ({ role, isVerified }: { role: UserRoleType | null, isVerified: boolean }) => {
  if (!role && !isVerified) return null;
  if (role === 'admin') {
    return <AdminShieldIcon className="ml-1.5 h-4 w-4 text-amber-400 fill-amber-500 shrink-0" aria-label="Admin" />;
  }
  if (isVerified) {
    return <VerifiedIcon className="ml-1.5 h-4 w-4 text-blue-500 fill-blue-200 shrink-0" aria-label="Verified" />;
  }
  return null;
};


const RatingInput = ({ currentRating, maxRating = 5, onRatingChange, disabled, onClearRating, hasRated }: { 
  currentRating: number, 
  maxRating?: number, 
  onRatingChange: (rating: number) => void, 
  disabled?: boolean,
  onClearRating?: () => void,
  hasRated?: boolean       
}) => {
  const [hoverRating, setHoverRating] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[...Array(maxRating)].map((_, index) => {
        const ratingValue = index + 1;
        return (
          <button
            type="button"
            key={ratingValue}
            className={`p-1 rounded-full transition-colors ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-accent'}`}
            onClick={() => !disabled && onRatingChange(ratingValue)}
            onMouseEnter={() => !disabled && setHoverRating(ratingValue)}
            onMouseLeave={() => !disabled && setHoverRating(0)}
            disabled={disabled}
            aria-label={`Rate ${ratingValue} out of ${maxRating}`}
          >
            <StarIconLucide
              className={`h-6 w-6 
                ${(hoverRating || currentRating) >= ratingValue ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/50'}`}
            />
          </button>
        );
      })}
      {hasRated && onClearRating && !disabled && (
        <Button variant="ghost" size="icon" onClick={onClearRating} className="h-7 w-7 ml-1 text-muted-foreground hover:text-destructive" aria-label="Clear rating">
          <XCircle className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};


export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser, currentUserProfile, loading: authLoading } = useAuth();
  const planId = params.id as string;

  const [plan, setPlan] = useState<PlanType | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [clientFormattedEventDateTime, setClientFormattedEventDateTime] = useState<string | null>(null);
  const [isUpdatingRSVP, setIsUpdatingRSVP] = useState<RSVPStatusType | null>(null);
  const [isCopyingPlan, setIsCopyingPlan] = useState(false);

  const [userRating, setUserRating] = useState<number>(0);
  const [hasRated, setHasRated] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const commentsUnsubscribeRef = useRef<(() => void) | null>(null);


  const [selectedHighlightFile, setSelectedHighlightFile] = useState<File | null>(null);
  const [highlightPreviewUrl, setHighlightPreviewUrl] = useState<string | null>(null);
  const [isUploadingHighlight, setIsUploadingHighlight] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showShareToFeedDialog, setShowShareToFeedDialog] = useState(false);
  const [feedPostData, setFeedPostData] = useState<{ planId: string; planName: string; highlightImageUrl: string; } | null>(null);
  const [feedPostCaption, setFeedPostCaption] = useState('');
  const [postVisibility, setPostVisibility] = useState<FeedPostVisibility>('public');
  const [isSubmittingFeedPost, setIsSubmittingFeedPost] = useState(false);
  
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [isFriendPickerOpen, setIsFriendPickerOpen] = useState(false);
  const [isSharingWithFriend, setIsSharingWithFriend] = useState(false);
  
  const [participantDetails, setParticipantDetails] = useState<{ [uid: string]: UserProfile }>({});
  const [loadingParticipantDetails, setLoadingParticipantDetails] = useState(false);

  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);
  
  const [commentToEdit, setCommentToEdit] = useState<Comment | null>(null);
  const [editedCommentText, setEditedCommentText] = useState('');
  const [isEditCommentDialogOpen, setIsEditCommentDialogOpen] = useState(false);
  const [isSubmittingEditedComment, setIsSubmittingEditedComment] = useState(false);

  const [showQRCodeDialog, setShowQRCodeDialog] = useState(false);
  const [planPublicUrl, setPlanPublicUrl] = useState('');

  const staticMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const fetchPlanAndRelatedData = useCallback(async () => {
    if (!planId) {
      setPlan(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // console.log(`[PlanDetailPage] Fetching plan: ${planId}`);
    try {
      const fetchedPlan = await getPlanById(planId); 
      setPlan(fetchedPlan);
      // console.log('[PlanDetailPage] Plan data fetched:', fetchedPlan ? fetchedPlan.name : 'Not found');

      if (fetchedPlan && currentUser?.uid) {
        // console.log('[PlanDetailPage] Fetching user rating...');
        const existingRating = await getUserRatingForPlan(fetchedPlan.id, currentUser.uid);
        if (existingRating) {
          setUserRating(existingRating.value);
          setHasRated(true);
          // console.log('[PlanDetailPage] User rating found:', existingRating.value);
        } else {
          setUserRating(0);
          setHasRated(false);
          // console.log('[PlanDetailPage] No existing rating for user.');
        }
      }
      if (!fetchedPlan) {
        toast({ title: "Plan Not Found", description: "The requested plan could not be loaded or you don't have access.", variant: "destructive" });
      } else {
        const participantUidsSet = new Set<string>([fetchedPlan.hostId]);
        Object.keys(fetchedPlan.participantResponses || {}).forEach(uid => participantUidsSet.add(uid));
        if (fetchedPlan.invitedParticipantUserIds) {
          fetchedPlan.invitedParticipantUserIds.forEach(uid => participantUidsSet.add(uid));
        }
        const participantUids = Array.from(participantUidsSet).filter(Boolean); // Filter out any null/undefined UIDs

        if (participantUids.length > 0) {
          // console.log('[PlanDetailPage] Fetching participant profiles for UIDs:', participantUids);
          setLoadingParticipantDetails(true);
          const profiles = await getUsersProfiles(participantUids); // Uses client SDK
          const detailsMap: typeof participantDetails = {};
          profiles.forEach(p => {
            if (p) detailsMap[p.uid] = p;
          });
          setParticipantDetails(detailsMap);
          setLoadingParticipantDetails(false);
          // console.log('[PlanDetailPage] Participant profiles fetched:', Object.keys(detailsMap).length);
        } else {
           // console.log('[PlanDetailPage] No participants to fetch profiles for.');
           setParticipantDetails({});
           setLoadingParticipantDetails(false);
        }
      }
    } catch (error) {
      console.error("[PlanDetailPage] Error fetching plan:", error);
      toast({ title: "Error", description: "Failed to load plan details.", variant: "destructive" });
      setPlan(null);
    } finally {
      setLoading(false);
      // console.log('[PlanDetailPage] Finished fetching plan data. Loading set to false.');
    }
  }, [planId, toast, currentUser?.uid]);

  useEffect(() => {
    fetchPlanAndRelatedData();
  }, [fetchPlanAndRelatedData]);

  useEffect(() => {
    if (plan?.eventTime) { 
      try {
        const dateObj = parseISO(plan.eventTime); 
        if (isValid(dateObj)) {
          setClientFormattedEventDateTime(format(dateObj, 'PPPp'));
        } else {
          console.warn(`[PlanDetailPage] Invalid eventTime format on plan: ${plan.eventTime}`);
          setClientFormattedEventDateTime("Date not set");
        }
      } catch (e) {
        console.warn("[PlanDetailPage] Error formatting plan event time:", e, plan.eventTime);
        setClientFormattedEventDateTime("Date not set");
      }
    } else if (plan === null) { 
       setClientFormattedEventDateTime("Date not set");
    } else if (plan) { 
       setClientFormattedEventDateTime("Date not set");
    }
  }, [plan]);

  useEffect(() => {
    if (planId && currentUser?.uid) { // Ensure user is available for comments too
      const unsubscribe = getPlanComments(planId, (fetchedComments) => {
        setComments(fetchedComments.sort((a, b) => {
            const timeA = a.createdAt && isValid(parseISO(a.createdAt as string)) ? parseISO(a.createdAt as string).getTime() : 0;
            const timeB = b.createdAt && isValid(parseISO(b.createdAt as string)) ? parseISO(b.createdAt as string).getTime() : 0;
            return timeA - timeB;
        }));
      });
      commentsUnsubscribeRef.current = unsubscribe;
      return () => {
        if (commentsUnsubscribeRef.current) {
          commentsUnsubscribeRef.current();
          commentsUnsubscribeRef.current = null;
        }
      };
    }
  }, [planId, currentUser?.uid]);

  const handleRSVP = async (newStatus: RSVPStatusType) => {
    if (!currentUser || !plan || !currentUserProfile) return;
    if (!plan.id) {
      toast({ title: "Error", description: "Plan ID is missing.", variant: "destructive" });
      return;
    }
    setIsUpdatingRSVP(newStatus);
    try {
      const idToken = await currentUser.getIdToken(true);
      const result = await updateMyRSVPAction(plan.id, idToken, newStatus); 
      if (result.success) {
        toast({ title: "RSVP Updated!", description: `Your response is now "${newStatus}".` });
        setPlan(prevPlan => prevPlan ? { ...prevPlan, participantResponses: { ...(prevPlan.participantResponses || {}), [currentUser.uid]: newStatus } } : null);
      } else {
        toast({ title: "RSVP Error", description: result.error || "Could not update your RSVP.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An unexpected error occurred while updating RSVP.", variant: "destructive" });
    } finally {
      setIsUpdatingRSVP(null);
    }
  };

  const handleCopyToMyPlans = async () => {
    if (!plan) return;
    if (!currentUser) {
      toast({ title: "Login Required", description: "Please log in to add this plan.", variant: "default" });
      router.push(`/login?redirect=/plans/${plan.id}&action=copy&planIdToCopy=${plan.id}`);
      return;
    }
    if (plan.hostId === currentUser.uid) {
      toast({ title: "This is Your Plan", description: "You are already the host of this plan.", variant: "default" });
      router.push(`/plans/${plan.id}`);
      return;
    }
    setIsCopyingPlan(true);
    try {
      await currentUser.getIdToken(true);
      const idToken = await currentUser.getIdToken();
      if (!idToken) throw new Error("Authentication token not available.");
      const result = await copyPlanToMyAccountAction(plan.id, idToken);
      if (result.success && result.newPlanId) {
        toast({ title: "Activity Template Created!", description: `"${plan.name}" is now ready for you to customize and plan.` });
        router.push(`/plans/${result.newPlanId}`); 
      } else {
        toast({ title: "Copy Error", description: result.error || "Could not copy the plan.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An unexpected error occurred while copying.", variant: "destructive" });
    } finally {
      setIsCopyingPlan(false);
    }
  };

  const handleRatingSubmit = async (newRatingValue: number) => {
    if (!currentUser || !plan || !currentUserProfile) return;
    setIsSubmittingRating(true);
    const oldRating = userRating; 
    setUserRating(newRatingValue); 
    try {
      const idToken = await currentUser.getIdToken(true);
      if (!idToken) throw new Error("Authentication token not available.");
      const result = await submitRatingAction(plan.id, idToken, newRatingValue); 
      if (result.success) {
        toast({ title: "Rating Submitted!", description: `You rated this plan ${newRatingValue} stars.` });
        setHasRated(true);
        if (result.newAverageRating !== undefined && result.newReviewCount !== undefined) {
          setPlan(prevPlan => prevPlan ? { ...prevPlan, averageRating: result.newAverageRating, reviewCount: result.newReviewCount } : null);
        }
      } else {
        toast({ title: "Rating Error", description: result.error || "Could not submit your rating.", variant: "destructive" });
        setUserRating(oldRating); 
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
      setUserRating(oldRating); 
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleClearRating = async () => {
    if (!currentUser || !plan || !hasRated) return;
    setIsSubmittingRating(true);
    try {
      const idToken = await currentUser.getIdToken(true);
      if (!idToken) throw new Error("Authentication token not available.");
      const result = await deleteRatingAction(plan.id, idToken);
      if (result.success) {
        toast({ title: "Rating Cleared!" });
        setUserRating(0);
        setHasRated(false);
        if (result.newAverageRating !== undefined && result.newReviewCount !== undefined) {
          setPlan(prevPlan => prevPlan ? { ...prevPlan, averageRating: result.newAverageRating, reviewCount: result.newReviewCount } : null);
        }
      } else {
        toast({ title: "Error Clearing Rating", description: result.error || "Could not clear your rating.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to clear rating.", variant: "destructive" });
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUserProfile || !plan || !newComment.trim()) return;
    setIsSubmittingComment(true);
    try {
      const idToken = await currentUser.getIdToken(true);
      if (!idToken) throw new Error("Authentication token not available.");
      const result = await submitCommentAction(plan.id, idToken, newComment);
      if (result.success && result.comment) {
        toast({ title: "Comment Posted!"});
        setNewComment('');
        // Comments state will be updated by the listener
      } else {
        toast({ title: "Comment Error", description: result.error || "Could not post your comment.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsSubmittingComment(false);
    }
  };
  
  const handleEditCommentRequest = (comment: Comment) => {
    setCommentToEdit(comment);
    setEditedCommentText(comment.text);
    setIsEditCommentDialogOpen(true);
  };

  const confirmEditComment = async () => {
    if (!commentToEdit || !currentUser || !editedCommentText.trim()) return;
    setIsSubmittingEditedComment(true);
    try {
      const idToken = await currentUser.getIdToken(true);
      if (!idToken) throw new Error("Authentication token not available.");
      const result = await updateCommentAction(commentToEdit.planId, commentToEdit.id, editedCommentText.trim(), idToken);
      if (result.success && result.updatedComment) {
        toast({ title: "Comment Updated!" });
        // Comments state will be updated by the listener
        setIsEditCommentDialogOpen(false);
        setCommentToEdit(null);
      } else {
        toast({ title: "Update Error", description: result.error || "Could not update comment.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update comment.", variant: "destructive" });
    } finally {
      setIsSubmittingEditedComment(false);
    }
  };

  const handleDeleteCommentRequest = (comment: Comment) => {
    setCommentToDelete(comment);
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete || !currentUser) return;
    setIsDeletingComment(true);
    try {
      const idToken = await currentUser.getIdToken(true);
      if (!idToken) throw new Error("Authentication token not available.");
      const result = await deleteCommentAction(commentToDelete.planId, commentToDelete.id, idToken);
      if (result.success) {
        toast({ title: "Comment Deleted" });
        // Comments state will be updated by the listener
      } else {
        toast({ title: "Delete Error", description: result.error || "Could not delete comment.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete comment.", variant: "destructive" });
    } finally {
      setIsDeletingComment(false);
      setCommentToDelete(null);
    }
  };

  const handleSharePlanLink = async () => {
    if (!plan || typeof window === 'undefined') return;
    const publicUrl = `${window.location.origin}/p/${plan.id}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: "Link Copied!", description: "Plan link copied to clipboard." });
    } catch (err) {
      toast({ title: "Copy Failed", description: "Could not copy link.", variant: "destructive" });
    }
  };

  const handleOpenQRCodeDialog = () => {
    if (plan && typeof window !== 'undefined') {
      setPlanPublicUrl(`${window.location.origin}/p/${plan.id}`);
      setShowQRCodeDialog(true);
    }
  };

  const handleShareWithFriend = async (selectedFriend: FriendEntry) => {
    if (!plan || !currentUser || !currentUserProfile) {
      toast({ title: "Error", description: "Cannot share plan. User or plan data missing.", variant: "destructive" });
      return;
    }
    setIsSharingWithFriend(true);
    try {
      const idToken = await currentUser.getIdToken(true);
      if (!idToken) throw new Error("Authentication token not available.");
      const result = await createPlanShareInviteAction(plan.id, plan.name, selectedFriend.friendUid, idToken);
      if (result.success) {
        toast({ title: "Plan Shared!", description: `Invitation sent to ${selectedFriend.name || 'your friend'}.` });
      } else {
        toast({ title: "Share Failed", description: result.error || "Could not share plan.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to share plan.", variant: "destructive" });
    } finally {
      setIsSharingWithFriend(false);
      setIsFriendPickerOpen(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { 
        toast({ title: "File too large", description: "Image size should not exceed 5MB.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSelectedHighlightFile(null);
        if (highlightPreviewUrl) URL.revokeObjectURL(highlightPreviewUrl);
        setHighlightPreviewUrl(null);
        return;
      }
      
      let isValidImage = false;
      const clientMimeType = file.type;
      const fileName = file.name;
      const fileExtension = fileName.split('.').pop()?.toLowerCase();

      if (clientMimeType && clientMimeType.startsWith('image/')) {
          isValidImage = true;
      } else if (fileExtension && commonImageExtensions.includes(fileExtension)) {
          isValidImage = true;
      }

      if (!isValidImage) {
         toast({ title: "Invalid file type", description: `Please select an image. Detected: ${clientMimeType || 'unknown'}. File: ${fileName}`, variant: "destructive" });
         if (fileInputRef.current) fileInputRef.current.value = ""; 
         setSelectedHighlightFile(null);
         if (highlightPreviewUrl) URL.revokeObjectURL(highlightPreviewUrl);
         setHighlightPreviewUrl(null);
         return;
      }

      setSelectedHighlightFile(file);
      if (highlightPreviewUrl) URL.revokeObjectURL(highlightPreviewUrl); 
      setHighlightPreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedHighlightFile(null);
      if (highlightPreviewUrl) URL.revokeObjectURL(highlightPreviewUrl);
      setHighlightPreviewUrl(null);
    }
  };

  const handleUploadHighlight = async () => {
    if (!selectedHighlightFile || !plan || !currentUser || !currentUserProfile) {
      toast({ title: "Upload Error", description: "No file selected or missing plan/user data.", variant: "destructive" });
      return;
    }
    setIsUploadingHighlight(true);
    const formData = new FormData();
    formData.append('highlightImage', selectedHighlightFile);

    try {
      const idToken = await currentUser.getIdToken(true); 
      if (!idToken) throw new Error("Authentication token not available.");
      const result = await addPhotoHighlightAction(plan.id, formData, idToken); 
      if (result.success && result.updatedPlan) {
        toast({ title: "Highlight Uploaded!", description: "Your photo has been added to the plan." });
        setPlan(result.updatedPlan); 
        setFeedPostData({ 
          planId: plan.id, 
          planName: plan.name, 
          highlightImageUrl: result.updatedPlan.photoHighlights?.slice(-1)[0] || '' 
        });
        setShowShareToFeedDialog(true); 
        setSelectedHighlightFile(null);
        if (highlightPreviewUrl) URL.revokeObjectURL(highlightPreviewUrl);
        setHighlightPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = ""; 
      } else {
        toast({ title: "Upload Failed", description: result.error || "Could not upload photo.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Upload Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsUploadingHighlight(false);
    }
  };

  const handleShareToFeedSubmit = async () => {
    if (!feedPostData || !feedPostCaption.trim() || !currentUser || !currentUserProfile || !postVisibility) {
        toast({title: "Cannot Share", description: "Missing data, caption, or visibility for feed post.", variant: "destructive"});
        return;
    }
    setIsSubmittingFeedPost(true);
    try {
        const idToken = await currentUser.getIdToken(true);
        if (!idToken) throw new Error("Authentication token not available.");
        const result = await createFeedPostAction({
            planId: feedPostData.planId,
            planName: feedPostData.planName,
            highlightImageUrl: feedPostData.highlightImageUrl,
            postText: feedPostCaption,
            visibility: postVisibility,
        }, idToken);

        if (result.success) {
            toast({title: "Shared to Feed!", description: "Your experience has been shared."});
            setShowShareToFeedDialog(false);
            setFeedPostCaption('');
            setPostVisibility('public');
            setFeedPostData(null);
        } else {
            toast({title: "Feed Share Error", description: result.error || "Could not share to feed.", variant: "destructive"});
        }
    } catch (error: any) {
        toast({ title: "Error", description: error.message || "An unexpected error occurred while sharing.", variant: "destructive" });
    } finally {
        setIsSubmittingFeedPost(false);
    }
  };

  const handleDeletePlanRequest = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeletePlan = async () => {
    if (!plan || !currentUser) return;
    setIsDeletingPlan(true);
    try {
      const idToken = await currentUser.getIdToken(true);
      if (!idToken) throw new Error("Authentication token not available.");
      const result = await deletePlanAction(plan.id, idToken);
      if (result.success) {
        toast({ title: "Plan Deleted", description: `"${plan.name}" has been removed.` });
        router.push('/plans'); 
      } else {
        toast({ title: "Error Deleting Plan", description: result.error || "Could not delete the plan.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsDeletingPlan(false);
      setShowDeleteConfirm(false);
    }
  };

  const planEventDateIsValid = plan?.eventTime && isValid(parseISO(plan.eventTime));
  const isPlanPastEvent = planEventDateIsValid ? isPast(parseISO(plan.eventTime!)) : false;
  const isPlanUpcoming = planEventDateIsValid ? isFuture(parseISO(plan.eventTime!)) : false;
  
  const isCurrentUserParticipant = useMemo(() => {
    if (!plan || !currentUser) return false;
    return plan.hostId === currentUser.uid || (plan.invitedParticipantUserIds || []).includes(currentUser.uid);
  }, [plan, currentUser]);
  
  const isCurrentUserInvitedNonHost = plan && currentUser && (plan.invitedParticipantUserIds || []).includes(currentUser.uid) && plan.hostId !== currentUser.uid;

  const canCurrentUserInteract = plan && currentUser && isPlanPastEvent && isCurrentUserParticipant;
  const currentUserRSVP = plan && currentUser ? plan.participantResponses?.[currentUser.uid] : undefined;
  
  const getRSVPSummary = useCallback(() => {
    if (!plan?.participantResponses) return { going: 0, maybe: 0, declined: 0, pending: 0, totalInvited: 0 };
    const counts: Record<RSVPStatusType | 'pending_total', number> = { going: 0, maybe: 0, declined: 0, pending: 0, pending_total: 0 };
    const allRelevantUids = Array.from(new Set<string>([plan.hostId, ...(plan.invitedParticipantUserIds || [])]));
    
    allRelevantUids.forEach(uid => {
      const response = plan.participantResponses![uid];
      if (response === 'going') counts.going++;
      else if (response === 'maybe') counts.maybe++;
      else if (response === 'declined') counts.declined++;
      else counts.pending_total++; 
    });
    return { 
        going: counts.going, 
        maybe: counts.maybe, 
        declined: counts.declined, 
        pending: counts.pending_total,
        totalInvited: allRelevantUids.length
    };
  }, [plan]);
  const rsvpSummary = getRSVPSummary();

  if (loading || authLoading && !plan) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-semibold text-foreground/80 opacity-60">Plan not found</h1>
        <p className="text-muted-foreground">The plan you're looking for doesn't exist, has been moved, or you don't have permission to view it here.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/plans">Go back to plans</Link>
        </Button>
      </div>
    );
  }

  const PlanStatusIcon = firestoreStatusDisplayConfig[plan.status]?.icon || CircleHelp;
  const planStatusLabel = firestoreStatusDisplayConfig[plan.status]?.label || "Status Unknown";
  const planStatusBadgeVariant = firestoreStatusDisplayConfig[plan.status]?.badgeVariant || "secondary";

  let mainPlanImage = `https://placehold.co/800x400.png?text=${encodeURIComponent(plan.name)}`;
  if (plan.photoHighlights?.[0]) {
      mainPlanImage = plan.photoHighlights[0];
  } else {
      const firstItineraryItemWithImage = plan.itinerary?.find(item => item.googlePhotoReference || item.googleMapsImageUrl);
      if (firstItineraryItemWithImage?.googlePhotoReference && staticMapApiKey) {
          if (!staticMapApiKey) console.warn("[PlanDetailPage] Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for Google Place Photo.");
          mainPlanImage = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${firstItineraryItemWithImage.googlePhotoReference}&key=${staticMapApiKey}`;
      } else if (firstItineraryItemWithImage?.googleMapsImageUrl) {
          mainPlanImage = firstItineraryItemWithImage.googleMapsImageUrl;
      }
  }
  const mainPlanImageHint = plan.itinerary?.[0]?.types?.[0] || plan.eventType || 'event scenery';
    
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
       <header className="sticky top-0 z-30 flex items-center justify-between p-3 bg-background/80 backdrop-blur-sm border-b border-border/30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" onClick={() => router.push('/plans')} className="text-muted-foreground hover:text-foreground" aria-label="Go back to plans list">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-md font-semibold text-foreground/90 truncate mx-2 flex-1 text-center">{plan.name}</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0" aria-label="More options">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {currentUser?.uid === plan.hostId && (
              <DropdownMenuItem asChild className="cursor-pointer text-sm">
                <Link href={`/plans/create?editId=${plan.id}`}>
                  <Edit3 className="mr-2 h-4 w-4" /> Edit Plan
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={handleSharePlanLink} className="cursor-pointer text-sm">
              <LinkIcon className="mr-2 h-4 w-4" /> Share Link
            </DropdownMenuItem>
             <DropdownMenuItem onSelect={handleOpenQRCodeDialog} className="cursor-pointer text-sm">
              <QrCode className="mr-2 h-4 w-4" /> Share QR Code
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setIsFriendPickerOpen(true)} disabled={isSharingWithFriend} className="cursor-pointer text-sm">
                {isSharingWithFriend ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Share2 className="mr-2 h-4 w-4" />}
                Share with Friend
            </DropdownMenuItem>
            {plan.status === 'published' && currentUser?.uid !== plan.hostId && (
              <DropdownMenuItem onSelect={handleCopyToMyPlans} disabled={isCopyingPlan} className="cursor-pointer text-sm">
                {isCopyingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CopyPlus className="mr-2 h-4 w-4" />}
                Use as Activity Template
              </DropdownMenuItem>
            )}
            {currentUser?.uid === plan.hostId && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleDeletePlanRequest} disabled={isDeletingPlan} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer text-sm">
                  {isDeletingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} 
                  Delete Plan
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <Card className="overflow-hidden shadow-xl bg-card/90 border-border/50 rounded-b-xl mt-0!"> {}
        <div className="relative w-full h-56 md:h-72 lg:h-80">
          <NextImage
            src={mainPlanImage}
            alt={plan.name}
            fill
            style={{ objectFit: 'cover' }}
            data-ai-hint={mainPlanImageHint}
            priority
            unoptimized={mainPlanImage.includes('maps.googleapis.com')}
          />
          <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
            {plan.eventType && (
                <Badge variant="secondary" className="text-xs sm:text-sm px-2.5 py-1 shadow-md">
                  {plan.eventType}
                </Badge>
            )}
            <Badge
              variant={planStatusBadgeVariant as any}
              className="text-xs sm:text-sm px-2.5 py-1 shadow-md flex items-center"
            >
              <PlanStatusIcon className="h-3.5 w-3.5 mr-1.5" />
              {planStatusLabel}
            </Badge>
          </div>
        </div>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-2xl md:text-3xl font-bold text-gradient-primary opacity-80">{plan.name}</CardTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground mt-1 text-xs sm:text-sm items-center">
            <div className="flex items-center"><CalendarDays className="h-4 w-4 mr-1.5" /><span>{clientFormattedEventDateTime || "Loading date..."}</span></div>
            <div className="flex items-center"><MapPin className="h-4 w-4 mr-1.5" /><span>{plan.location}, {plan.city}</span></div>
            {(plan.averageRating !== null && typeof plan.averageRating === 'number' ) && (
                <div className="flex items-center"><StarIconLucide className="h-4 w-4 mr-1.5 text-amber-400 fill-amber-400" /><span>{plan.averageRating.toFixed(1)} ({plan.reviewCount || 0} reviews)</span></div>
            )}
          </div>
           {plan.hostId && participantDetails[plan.hostId] && (
            <div className="flex items-center mt-2 text-xs text-muted-foreground">
                <Avatar className="h-5 w-5 mr-1.5">
                    <AvatarImage src={participantDetails[plan.hostId]?.avatarUrl || undefined} alt={participantDetails[plan.hostId]?.name || 'Host'} data-ai-hint="person avatar"/>
                    <AvatarFallback className="text-[10px]">{participantDetails[plan.hostId]?.name ? participantDetails[plan.hostId]!.name!.charAt(0).toUpperCase() : <UserCircleIcon className="h-3 w-3"/>}</AvatarFallback>
                </Avatar>
                Hosted by <span className="font-medium text-foreground/80 ml-1">{participantDetails[plan.hostId]?.name || 'Host'}</span>
                 <VerificationBadge role={participantDetails[plan.hostId]?.role} isVerified={participantDetails[plan.hostId]?.isVerified} />
            </div>
          )}
        </CardHeader>

        <CardContent className="p-4 sm:p-6 pt-0 space-y-5">
          {plan.description && (
            <div>
              <h3 className="font-semibold text-md mb-1.5 flex items-center"><FileText className="h-4 w-4 mr-2 text-primary/70"/>Description</h3>
              <p className="text-sm text-foreground/80 whitespace-pre-line">{plan.description}</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {plan.priceRange && (
                <div className="flex items-start">
                  <DollarSign className="h-4 w-4 mr-2 mt-0.5 text-primary/70 shrink-0" />
                  <div><span className="font-medium text-muted-foreground">Price Range: </span><span className="text-foreground/90">{plan.priceRange}</span></div>
                </div>
              )}
              <div className="flex items-start">
                  <Grid2X2 className="h-4 w-4 mr-2 mt-0.5 text-primary/70 shrink-0" />
                  <div><span className="font-medium text-muted-foreground">Plan Type: </span><span className="text-foreground/90">{plan.planType === 'single-stop' ? 'Single Stop' : 'Multi-Stop'}</span></div>
              </div>
          </div>
          
          {((plan.invitedParticipantUserIds && plan.invitedParticipantUserIds.length > 0) || plan.hostId) && (
            <div>
                <h3 className="font-semibold text-md mb-1.5 flex items-center"><Users className="h-4 w-4 mr-2 text-primary/70"/>Participants ({rsvpSummary.totalInvited})</h3>
                <div className="text-xs text-muted-foreground mb-2">
                  Going: {rsvpSummary.going}, Maybe: {rsvpSummary.maybe}, Declined: {rsvpSummary.declined}, Pending: {rsvpSummary.pending}
                </div>
                {loadingParticipantDetails ? <Loader2 className="h-5 w-5 animate-spin text-primary/70" /> :
                  Object.keys(participantDetails).length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground/80">Attending:</p>
                        <div className="flex flex-wrap gap-2">
                        {Object.entries(plan.participantResponses || {})
                            .filter(([uid, status]) => status === 'going')
                            .map(([uid]) => {
                            const detail = participantDetails[uid];
                            if (!detail) return null;
                            return (
                                <Link href={`/users/${uid}`} key={uid} className="flex items-center gap-1.5 bg-secondary/30 hover:bg-secondary/50 px-2 py-1 rounded-md" title={`${detail?.name || 'User'} - Going`}>
                                <Avatar className="h-5 w-5">
                                    <AvatarImage src={detail?.avatarUrl || undefined} alt={detail?.name || 'User'} data-ai-hint="person avatar"/>
                                    <AvatarFallback className="text-[10px]">{detail?.name ? detail.name.charAt(0).toUpperCase() : <UserCircleIcon className="h-3 w-3"/>}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-foreground/80 truncate max-w-[100px]">{detail?.name || 'User'}</span>
                                <VerificationBadge role={detail.role} isVerified={detail.isVerified} />
                                </Link>
                            );
                        })}
                        {rsvpSummary.going === 0 && <p className="text-xs text-muted-foreground">No one confirmed going yet.</p>}
                        </div>
                    </div>
                  )
                }
            </div>
          )}


          {plan.itinerary.length > 0 && <Separator className="bg-border/40 my-4"/>}
          {plan.itinerary.length > 0 && (
            <div>
              <h3 className="font-semibold text-md mb-3 flex items-center"><ListChecks className="h-4 w-4 mr-2 text-primary/70" />Itinerary ({plan.itinerary.length} stop{plan.itinerary.length !== 1 ? 's' : ''})</h3>
              <div className="space-y-4">
                {plan.itinerary.map((item, index) => {
                  let itemPhotoUrl = `https://placehold.co/400x200.png?text=${encodeURIComponent(item.placeName)}`;
                  if (item.googlePhotoReference && staticMapApiKey) {
                     itemPhotoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${item.googlePhotoReference}&key=${staticMapApiKey}`;
                  } else if (item.googleMapsImageUrl) { 
                    itemPhotoUrl = item.googleMapsImageUrl;
                  }
                  const itemPhotoHint = item.types?.[0] || 'activity location';
                  let itemStartTimeDisplay = 'N/A';
                  let itemEndTimeDisplay = 'N/A';
                  if (item.startTime && isValid(parseISO(item.startTime))) itemStartTimeDisplay = format(parseISO(item.startTime), 'p');
                  if (item.endTime && isValid(parseISO(item.endTime))) itemEndTimeDisplay = format(parseISO(item.endTime), 'p');

                  return (
                    <Card key={item.id || index} className="overflow-hidden bg-background/30 border-border/40 shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-3">
                        <div className="md:col-span-1 relative min-h-[120px] h-full w-full">
                          {(item.googlePhotoReference || item.googleMapsImageUrl) && itemPhotoUrl.startsWith('https://') ? (
                            <NextImage
                              src={itemPhotoUrl}
                              alt={item.placeName}
                              fill
                              style={{ objectFit: 'cover' }}
                              data-ai-hint={itemPhotoHint}
                              unoptimized={itemPhotoUrl.includes('maps.googleapis.com')}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted text-xs text-muted-foreground p-2 text-center" data-ai-hint={itemPhotoHint}>
                              {item.placeName || "Location Image"}
                            </div>
                          )}
                        </div>
                        <div className="md:col-span-2 p-3">
                          <h4 className="text-sm font-semibold text-primary/90">{index + 1}. {item.placeName}</h4>
                          {item.address && <p className="text-xs text-muted-foreground mt-0.5 mb-1">{item.address}</p>}
                          <p className="text-xs text-muted-foreground mb-1.5">
                            <Clock className="inline h-3 w-3 mr-1" />
                            {itemStartTimeDisplay} - {itemEndTimeDisplay} {item.durationMinutes != null && `(${item.durationMinutes} mins)`}
                          </p>
                          {item.description && <p className="text-xs text-foreground/80 mb-2 line-clamp-3">{item.description}</p>}
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] mt-1.5 text-muted-foreground">
                            {typeof item.rating === 'number' && <div className="flex items-center"><StarIconLucide className="w-3 h-3 mr-1 text-amber-400 fill-amber-400"/> {item.rating.toFixed(1)} ({item.reviewCount || 0})</div>}
                            {item.isOperational !== null && item.isOperational !== undefined && (
                                <Badge variant={item.isOperational ? "default" : "destructive"} className="w-fit py-0.5 px-1.5 text-[10px] bg-opacity-70">
                                    {item.isOperational ? <CheckCircle className="w-2.5 h-2.5 mr-1"/> : <XCircle className="w-2.5 h-2.5 mr-1"/>}
                                    {item.statusText || (item.isOperational ? "Operational" : "Closed")}
                                </Badge>
                            )}
                            {typeof item.priceLevel === 'number' && <div>Price: {'$'.repeat(item.priceLevel) || 'N/A'}</div>}
                            {item.phoneNumber && <div className="truncate" title={item.phoneNumber}>Phone: {item.phoneNumber}</div>}
                          </div>
                          {item.website && <a href={item.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex items-center text-xs mt-1.5">Website <ExternalLink className="w-3 h-3 ml-1"/></a>}
                          {item.activitySuggestions && item.activitySuggestions.length > 0 && (
                            <div className="mt-1.5">
                                <p className="text-[11px] font-medium text-muted-foreground/80 mb-0.5">Suggestions:</p>
                                <ul className="list-disc list-inside pl-1 space-y-0.5">
                                    {item.activitySuggestions.map((sugg, i) => <li key={i} className="text-xs text-foreground/80">{sugg}</li>)}
                                </ul>
                            </div>
                          )}
                           {item.notes && (
                              <div className="mt-1.5 pt-1 border-t border-border/30">
                                <p className="text-xs font-medium text-muted-foreground/80 mb-0.5">Your Notes:</p>
                                <p className="text-xs text-foreground/80 whitespace-pre-wrap">{item.notes}</p>
                              </div>
                            )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {isCurrentUserInvitedNonHost && isPlanUpcoming && plan.status === 'published' && (
            <Card className="print:hidden bg-card/90 border-border/50 shadow-md rounded-xl">
              <CardHeader>
                <CardTitle className="text-lg">Are you going?</CardTitle>
                {currentUserRSVP && <CardDescription>Your current response: <Badge variant="secondary" className="capitalize text-xs">{currentUserRSVP}</Badge></CardDescription>}
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {rsvpButtonConfig.map(btn => (
                    <Button
                        key={btn.status}
                        variant={currentUserRSVP === btn.status ? 'default' : (currentUserRSVP && btn.status === 'going' ? 'secondary' : btn.variant)} 
                        onClick={() => handleRSVP(btn.status)}
                        disabled={isUpdatingRSVP === btn.status || !!isUpdatingRSVP}
                        size="sm"
                        className="min-w-[90px] text-xs"
                        aria-label={`RSVP ${btn.label}`}
                    >
                        {isUpdatingRSVP === btn.status ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <btn.icon className="mr-1.5 h-3.5 w-3.5"/>}
                        {btn.label}
                    </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {canCurrentUserInteract && (
            <Card className="print:hidden bg-card/90 border-border/50 shadow-md rounded-xl">
              <CardHeader>
                <CardTitle className="text-xl">Add Photo Highlight</CardTitle>
                <CardDescription>Share a photo from this plan. Uploaded highlights can then be shared to your feed!</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input 
                  type="file" 
                  accept="image/png, image/jpeg, image/gif, image/webp, image/*" 
                  onChange={handleFileChange} 
                  ref={fileInputRef}
                  className="text-sm h-10 file:mr-2 file:text-xs file:font-semibold file:rounded-md file:border-0 file:bg-primary/20 file:text-primary hover:file:bg-primary/30 bg-muted border-border/30 focus:border-primary"
                  disabled={isUploadingHighlight}
                />
                {selectedHighlightFile && (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground flex-1 truncate">Selected: {selectedHighlightFile.name}</p>
                    {highlightPreviewUrl && (
                       <div className="relative h-10 w-10 rounded border overflow-hidden">
                         <NextImage src={highlightPreviewUrl} alt="Preview" fill style={{objectFit: 'cover'}} data-ai-hint="upload preview"/>
                       </div>
                    )}
                  </div>
                )}
                <Button onClick={handleUploadHighlight} disabled={!selectedHighlightFile || isUploadingHighlight} size="sm" className="text-xs">
                  {isUploadingHighlight ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  Upload Photo
                </Button>
              </CardContent>
            </Card>
          )}
          
          {canCurrentUserInteract && (
            <Card className="print:hidden bg-card/90 border-border/50 shadow-md rounded-xl">
              <CardHeader>
                <CardTitle className="text-lg">Rate & Comment</CardTitle>
                <CardDescription>Share your experience with this plan.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label htmlFor="rating" className="text-sm font-medium block mb-1.5">Your Rating</Label>
                  <RatingInput
                    currentRating={userRating}
                    onRatingChange={handleRatingSubmit}
                    disabled={isSubmittingRating}
                    hasRated={hasRated}
                    onClearRating={handleClearRating}
                  />
                  {hasRated && <p className="text-xs text-muted-foreground mt-1">You can change or clear your rating.</p>}
                </div>
                <form onSubmit={handleCommentSubmit} className="space-y-2">
                  <div>
                    <Label htmlFor="new-comment" className="text-sm font-medium block mb-1">Add a comment</Label>
                    <Textarea 
                      id="new-comment" 
                      placeholder="Write your comment here..." 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="mt-1 min-h-[70px] text-sm bg-muted border-border/30" 
                      disabled={isSubmittingComment}
                    />
                  </div>
                  <Button type="submit" disabled={isSubmittingComment || !newComment.trim()} size="sm" className="text-xs">
                    {isSubmittingComment ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>} 
                    Post Comment
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {comments.length > 0 && (
            <Card className="print:hidden bg-card/90 border-border/50 shadow-md rounded-xl">
              <CardHeader><CardTitle className="text-lg flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-primary/70" />Comments ({comments.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-80 custom-scrollbar-vertical">
                  <div className="space-y-0">
                    {comments.map((comment, idx) => (
                      <div key={comment.id} className={cn("flex items-start gap-3 p-3", idx < comments.length -1 && "border-b border-border/20")}>
                        <Avatar className="h-8 w-8 mt-0.5">
                          <AvatarImage src={comment.userAvatarUrl || undefined} alt={comment.username || comment.userName || 'User'} data-ai-hint="person avatar"/>
                          <AvatarFallback className="text-xs">{comment.username ? comment.username.charAt(0).toUpperCase() : (comment.userName ? comment.userName.charAt(0).toUpperCase() : <UserCircleIcon className="h-4 w-4"/>)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-baseline justify-between text-xs">
                            <div className="flex items-center">
                                <p className="font-semibold text-foreground/90">{comment.username || comment.userName || 'Anonymous'}</p>
                                <VerificationBadge role={comment.role} isVerified={comment.isVerified || false} />
                            </div>
                            <p className="text-muted-foreground/80">{comment.createdAt && isValid(parseISO(comment.createdAt as string)) ? formatDistanceToNowStrict(parseISO(comment.createdAt as string), { addSuffix: true }) : 'some time ago'}</p>
                          </div>
                          <p className="text-sm text-foreground/80 whitespace-pre-line mt-0.5">{comment.text}</p>
                        </div>
                        {currentUser?.uid === comment.userId && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground -mr-1" aria-label="Comment options">
                                        <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-32">
                                    <DropdownMenuItem onSelect={() => handleEditCommentRequest(comment)} className="text-xs cursor-pointer">
                                        <Edit3 className="mr-2 h-3.5 w-3.5"/> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleDeleteCommentRequest(comment)} className="text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                                        <Trash2 className="mr-2 h-3.5 w-3.5"/> Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
          {comments.length === 0 && canCurrentUserInteract && (
             <p className="text-sm text-muted-foreground text-center">No comments yet. Be the first to share your thoughts!</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={showShareToFeedDialog} onOpenChange={(open) => {
        setShowShareToFeedDialog(open);
        if (!open) { 
            setFeedPostCaption('');
            setPostVisibility('public');
            setFeedPostData(null);
        }
      }}>
        <DialogContent className="sm:max-w-sm rounded-xl bg-card shadow-2xl p-6 border-transparent">
          <DialogHeader className="text-left mb-2">
            <DialogTitle className="text-lg font-semibold text-foreground">Share Highlight to Feed?</DialogTitle>
            <DialogDescriptionComponent className="text-sm text-muted-foreground">
              Your photo highlight has been uploaded. Add a caption and choose visibility to share it.
            </DialogDescriptionComponent>
          </DialogHeader>
          {feedPostData?.highlightImageUrl && (
            <div className="my-3 relative aspect-video w-full max-w-xs mx-auto rounded-md overflow-hidden border">
                <NextImage src={feedPostData.highlightImageUrl} alt="Highlight preview" fill style={{objectFit: 'contain'}} data-ai-hint="highlight event" unoptimized={!feedPostData.highlightImageUrl.startsWith('https') || feedPostData.highlightImageUrl.includes('placehold.co')} />
            </div>
          )}
          <Textarea
            placeholder="Write a caption for your feed post..."
            value={feedPostCaption}
            onChange={(e) => setFeedPostCaption(e.target.value)}
            className="min-h-[80px] text-sm bg-muted border-border/30 focus:border-primary placeholder:text-muted-foreground/70"
            disabled={isSubmittingFeedPost}
          />
          <div className="mt-3 mb-2 space-y-1.5">
            <Label htmlFor="post-visibility-plan-detail" className="text-sm font-medium">Visibility</Label>
            <RadioGroup
              id="post-visibility-plan-detail"
              value={postVisibility}
              onValueChange={(value: string) => setPostVisibility(value as FeedPostVisibility)}
              className="flex items-center gap-6 pt-1"
              disabled={isSubmittingFeedPost}
            >
              <div className="flex items-center space-x-2 gap-1.5">
                <RadioGroupItem value="public" id="visibility-public-plan-detail" />
                <Label htmlFor="visibility-public-plan-detail" className="text-sm flex items-center gap-1.5"><Globe className="w-4 h-4"/>Public</Label>
              </div>
              <div className="flex items-center space-x-2 gap-1.5">
                <RadioGroupItem value="private" id="visibility-private-plan-detail" />
                <Label htmlFor="visibility-private-plan-detail" className="text-sm flex items-center gap-1.5"><Lock className="w-4 h-4"/>Private</Label>
              </div>
            </RadioGroup>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end sm:space-x-2 pt-4">
             <Button
              type="button"
              onClick={handleShareToFeedSubmit}
              disabled={isSubmittingFeedPost || !feedPostCaption.trim() || !feedPostData?.highlightImageUrl}
              className="w-full sm:w-auto h-9" 
            >
              {isSubmittingFeedPost ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
              Share to Feed
            </Button>
            <DialogClose asChild>
              <Button 
                type="button" 
                variant="ghost" 
                disabled={isSubmittingFeedPost} 
                className="w-full sm:w-auto h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground" 
              >
                Skip for Now
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Plan?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the plan "{plan?.name}". This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)} disabled={isDeletingPlan} aria-label="Cancel Delete">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeletePlan} disabled={isDeletingPlan} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                    {isDeletingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4"/>} Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <AlertDialog open={!!commentToDelete} onOpenChange={(open) => { if(!open) setCommentToDelete(null); }}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Comment?</AlertDialogTitle>
                <AlertDialogDescription>
                    Are you sure you want to delete this comment? This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setCommentToDelete(null)} disabled={isDeletingComment} aria-label="Cancel">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteComment} disabled={isDeletingComment} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                    {isDeletingComment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4"/>} Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog open={isEditCommentDialogOpen} onOpenChange={(open) => { if(!open) { setIsEditCommentDialogOpen(false); setCommentToEdit(null);}}}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle>Edit Your Comment</DialogTitle>
                  <DialogDescriptionComponent>Make changes to your comment below.</DialogDescriptionComponent>
              </DialogHeader>
              <Textarea
                  value={editedCommentText}
                  onChange={(e) => setEditedCommentText(e.target.value)}
                  className="min-h-[100px] mt-2 text-sm bg-muted"
                  disabled={isSubmittingEditedComment}
              />
              <DialogFooter className="mt-4">
                  <Button variant="ghost" onClick={() => { setIsEditCommentDialogOpen(false); setCommentToEdit(null);}} disabled={isSubmittingEditedComment}>Cancel</Button>
                  <Button onClick={confirmEditComment} disabled={isSubmittingEditedComment || !editedCommentText.trim()}>
                      {isSubmittingEditedComment ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                      Save Changes
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={showQRCodeDialog} onOpenChange={setShowQRCodeDialog}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Share Plan via QR Code</DialogTitle>
            <DialogDescriptionComponent className="text-center text-xs text-muted-foreground">
              Scan this code to view the plan details for "{plan?.name}".
            </DialogDescriptionComponent>
          </DialogHeader>
          <div className="flex justify-center p-4 bg-white rounded-md my-4">
            {planPublicUrl && <QRCodeSVG value={planPublicUrl} size={200} includeMargin={true} />}
          </div>
           <DialogFooter className="justify-center">
             <Button variant="outline" onClick={() => setShowQRCodeDialog(false)} size="sm">Close</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      <FriendPickerDialog
        open={isFriendPickerOpen}
        onOpenChange={setIsFriendPickerOpen}
        onFriendSelect={handleShareWithFriend}
      />
    </div>
  );
}
