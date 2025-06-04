// src/app/actions/planActions.ts
'use server';

import {
  createPlanAdmin,
  updatePlanAdmin as updatePlanAdminService,
  getPlanByIdAdminService, // Renamed to getPlanByIdAdmin in the instructions, using current name from file
  setRatingAdmin,
  addCommentAdmin,
  deletePlanAdmin as deletePlanAdminService,
  createPlanShareInviteAdmin,
  getPlanShareByIdAdmin,
  updatePlanShareStatusAdmin,
  deleteRatingAdmin as deleteRatingAdminService,
  updateCommentAdmin as updateCommentAdminService,
  deleteCommentAdmin as deleteCommentAdminService
} from '@/services/planService.server';
import {
  getUserProfileAdmin,
  getUsersProfilesAdmin
} from '@/services/userService.server';
import type { PlanFormValues } from '@/components/plans/PlanForm';
import type {
  Plan,
  ItineraryItem,
  RSVPStatusType,
  Comment,
  AISimpleProfile,
  FeedPostVisibility,
  PlanShareStatus,
  UserProfile,
  TransitMode,
  PriceRangeType,
  PlanTypeType as PlanTypeHintTypeAlias,
  UserRoleType
} from '@/types/user';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { generateFullPlan, type GenerateFullPlanInput } from '@/ai/flows/generate-full-plan';
import { authAdmin, firestoreAdmin, storageAdmin } from '@/lib/firebaseAdmin'; 
import { FieldValue } from 'firebase-admin/firestore';
import { parseISO, isValid, addHours, isPast } from 'date-fns'; 
import {
  generateVenuePlanQR,
  recordPlanCompletion,
  getAffinityScore,
  getUserAffinities
} from '@/services/planCompletionService.server';

const PLANS_COLLECTION = 'plans';

// Schema for data coming from the client to the generatePlanWithAIAction
const GenerateFullPlanInputClientSchema = z.object({
  hostUid: z.string(),
  invitedParticipantUserIds: z.array(z.string()).optional().default([]),
  planDateTime: z.string().refine((val) => isValid(parseISO(val)), {
    message: "Plan start date and time is required and must be a valid ISO date string.",
  }),
  locationQuery: z.string().min(3, { message: 'Location query must be at least 3 characters.' }),
  selectedLocationLat: z.number().optional().nullable(),
  selectedLocationLng: z.number().optional().nullable(),
  priceRange: z.enum(['$', '$$', '$$$', '$$$$', 'Free', ''] as const).optional().nullable(),
  userPrompt: z.string().min(10, { message: 'Prompt must be at least 10 characters.' }).max(500),
  searchRadius: z.number().min(0).max(50).optional().nullable(),
  planTypeHint: z.enum(['ai-decide', 'single-stop', 'multi-stop'] as const).optional().default('ai-decide'),
});

const serverItineraryItemSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  placeName: z.string().min(1, { message: "Place name is required." }),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  startTime: z.string().refine(val => isValid(parseISO(val)), { message: "Invalid start time format." }),
  endTime: z.string().optional().nullable().refine(val => val === null || val === undefined || val === '' || isValid(parseISO(val)), { message: "Invalid end time format." }),
  description: z.string().optional().nullable(),
  googlePlaceId: z.string().optional().nullable(),
  googleMapsImageUrl: z.string().url().optional().nullable(),
  googlePhotoReference: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  reviewCount: z.number().int().min(0).optional().nullable(),
  activitySuggestions: z.array(z.string()).optional().nullable().default([]),
  isOperational: z.boolean().optional().nullable(),
  statusText: z.string().optional().nullable(),
  openingHours: z.array(z.string()).optional().nullable().default([]),
  phoneNumber: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  priceLevel: z.number().int().min(0).max(4).optional().nullable(),
  types: z.array(z.string()).optional().nullable().default([]),
  notes: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(0).optional().nullable().default(60),
  transitMode: z.enum(['driving', 'walking', 'bicycling', 'transit'] as const).optional().nullable().default('driving'),
  transitTimeFromPreviousMinutes: z.number().int().min(0).optional().nullable(),
});


export async function generatePlanWithAIAction(
  clientInput: z.infer<typeof GenerateFullPlanInputClientSchema>,
  idToken: string
): Promise<{ success: boolean; plan?: Plan; error?: string }> {
  // // console.log('[generatePlanWithAIAction] Action started. Client input (partial):', { 
  // //   hostUid: clientInput.hostUid, 
  // //   planDateTime: clientInput.planDateTime,
  // //   locationQuery: clientInput.locationQuery,
  // // });

  if (!authAdmin) {
    console.error("[generatePlanWithAIAction] Firebase Admin Auth service not available.");
    return { success: false, error: "Server error: Auth service not available." };
  }

  let decodedToken;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    if (decodedToken.uid !== clientInput.hostUid) {
      console.error(`[generatePlanWithAIAction] ID Token UID (${decodedToken.uid}) does not match hostUid (${clientInput.hostUid}). Authorization denied.`);
      return { success: false, error: "User UID mismatch. Authorization denied." };
    }
    // // console.log(`[generatePlanWithAIAction] User ${decodedToken.uid} verified.`);
  } catch (authError: any) {
    console.error(`[generatePlanWithAIAction] ID Token verification failed for hostUid ${clientInput.hostUid}:`, authError);
    let specificError = 'Authentication failed. Invalid or expired token.';
    if (authError.code === 'auth/id-token-expired') {
      specificError = 'Your session has expired. Please log in again.';
    } else if (authError.code === 'auth/argument-error') {
        specificError = 'Authentication token is malformed. Please try again.';
    }
    return { success: false, error: specificError };
  }
  
  const validationResult = GenerateFullPlanInputClientSchema.safeParse(clientInput);
  if (!validationResult.success) {
    console.error("[generatePlanWithAIAction] Zod validation failed for client input:", validationResult.error.flatten());
    return { success: false, error: "Invalid input: " + JSON.stringify(validationResult.error.flatten().fieldErrors) };
  }
  const validatedClientData = validationResult.data;


  try {
    const hostProfileData = await getUserProfileAdmin(validatedClientData.hostUid);
    if (!hostProfileData) {
      console.error('[generatePlanWithAIAction] Host profile not found for UID:', validatedClientData.hostUid);
      return { success: false, error: 'Host profile not found.' };
    }
    const hostProfileForAI: AISimpleProfile = {
      uid: hostProfileData.uid,
      preferences: hostProfileData.preferences || [],
    };

    let invitedFriendProfilesForAI: AISimpleProfile[] = [];
    if (validatedClientData.invitedParticipantUserIds && validatedClientData.invitedParticipantUserIds.length > 0) {
      const friendProfilesData = await getUsersProfilesAdmin(validatedClientData.invitedParticipantUserIds);
      invitedFriendProfilesForAI = friendProfilesData
        .filter((fp): fp is UserProfile => fp !== null)
        .map(fp => ({
            uid: fp.uid,
            preferences: fp.preferences || [],
        }));
    }
    
    const aiFlowInput: GenerateFullPlanInput = {
      hostProfile: hostProfileForAI,
      invitedFriendProfiles: invitedFriendProfilesForAI,
      planDateTime: validatedClientData.planDateTime, 
      locationQuery: validatedClientData.locationQuery,
      selectedLocationLat: validatedClientData.selectedLocationLat,
      selectedLocationLng: validatedClientData.selectedLocationLng,
      priceRange: validatedClientData.priceRange === '' ? null : validatedClientData.priceRange, 
      userPrompt: validatedClientData.userPrompt,
      searchRadius: validatedClientData.searchRadius,
      planTypeHint: validatedClientData.planTypeHint,
    };
    
    const generatedPlanOutput = await generateFullPlan(aiFlowInput);

    if (generatedPlanOutput) {
      // Augment with host details if AI didn't include them (though it should)
      generatedPlanOutput.hostId = validatedClientData.hostUid; 
      generatedPlanOutput.hostName = hostProfileData.name || null;
      generatedPlanOutput.hostAvatarUrl = hostProfileData.avatarUrl || null;

      // console.log('[generatePlanWithAIAction] Successfully generated plan (partial):', {name: generatedPlanOutput.name, id: generatedPlanOutput.id});
      return { success: true, plan: generatedPlanOutput };
    } else {
      console.error('[generatePlanWithAIAction] AI generateFullPlan flow returned null or undefined.');
      return { success: false, error: 'AI failed to generate a plan response.' };
    }
  } catch (error: any) {
    console.error('[generatePlanWithAIAction] Error during AI plan generation process:', error);
    return { success: false, error: error.message || 'Failed to generate plan with AI.' };
  }
}

export async function getPlanForEditingAction(
  planId: string,
  idToken: string
): Promise<{ success: boolean; plan?: Plan; error?: string; notFound?: boolean; unauthorized?: boolean; }> {
  if (!authAdmin) {
    console.error("[getPlanForEditingAction] Firebase Admin Auth service not available.");
    return { success: false, error: "Server error: Auth service not available." };
  }
  if (!planId) {
    return { success: false, error: "Plan ID is missing." };
  }

  let decodedToken;
  let userId: string;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (authError: any) {
    console.error(`[getPlanForEditingAction] ID Token verification failed for plan ${planId}:`, authError);
    let specificError = "Authentication failed.";
    if (authError.code === 'auth/id-token-expired') {
      specificError = 'Your session has expired. Please log in again.';
    } else if (authError.code === 'auth/argument-error') {
        specificError = 'Authentication token is malformed. Please try again.';
    }
    return { success: false, error: specificError };
  }

  try {
    const plan = await getPlanByIdAdminService(planId);

    if (!plan) {
      return { success: false, notFound: true, error: "Plan not found." };
    }

    if (plan.hostId !== userId) {
      return { success: false, unauthorized: true, error: "User not authorized to edit this plan." };
    }

    return { success: true, plan: plan };

  } catch (error: any) {
    console.error(`[getPlanForEditingAction] Error retrieving plan ${planId} for editing:`, error);
    // Check if the error indicates a "not found" scenario that getPlanByIdAdminService might throw differently
    if (error.message?.toLowerCase().includes('not found') || error.code === 'firestore/not-found') { // Example error check
        return { success: false, notFound: true, error: "Plan not found." };
    }
    return { success: false, error: "Could not retrieve plan for editing." };
  }
}

export async function createPlanAction(
  planFormData: PlanFormValues,
  idToken: string 
): Promise<{ success: boolean; planId?: string; error?: string }> {
  if (!authAdmin) {
    return { success: false, error: "Server error: Authentication service not available." };
  }
  let decodedToken;
  let hostId: string;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    hostId = decodedToken.uid;
  } catch (error: any) {
    let e = 'Authentication failed. Invalid or expired token.'; if (error.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }

  try {
    let finalItinerary: ItineraryItem[] = [];
    const eventStartTimeISO = planFormData.eventDateTime.toISOString();

    if (planFormData.planType === 'single-stop') {
      const singleItemFromForm = planFormData.itinerary?.[0];
      const itemDuration = singleItemFromForm?.durationMinutes ?? 60;
      const eventStartTimeDate = parseISO(eventStartTimeISO);
      const eventEndTime = new Date(eventStartTimeDate.getTime() + itemDuration * 60000);
      
      finalItinerary.push({
        id: singleItemFromForm?.id || crypto.randomUUID(),
        placeName: planFormData.primaryLocation,
        address: singleItemFromForm?.address || planFormData.primaryLocation,
        city: singleItemFromForm?.city || planFormData.city,
        startTime: eventStartTimeISO,
        endTime: eventEndTime.toISOString(),
        description: singleItemFromForm?.description || planFormData.description || null, // Use item's desc, then plan's, then null
        googlePlaceId: singleItemFromForm?.googlePlaceId || null,
        googleMapsImageUrl: singleItemFromForm?.googleMapsImageUrl || null,
        googlePhotoReference: singleItemFromForm?.googlePhotoReference || null,
        lat: singleItemFromForm?.lat || null,
        lng: singleItemFromForm?.lng || null,
        rating: singleItemFromForm?.rating ?? null,
        reviewCount: singleItemFromForm?.reviewCount ?? null,
        activitySuggestions: singleItemFromForm?.activitySuggestions || [],
        isOperational: singleItemFromForm?.isOperational === undefined ? null : singleItemFromForm?.isOperational,
        statusText: singleItemFromForm?.statusText || null,
        openingHours: singleItemFromForm?.openingHours || [],
        phoneNumber: singleItemFromForm?.phoneNumber || null,
        website: singleItemFromForm?.website || null,
        priceLevel: singleItemFromForm?.priceLevel ?? null,
        types: singleItemFromForm?.types || [],
        notes: singleItemFromForm?.notes || null,
        durationMinutes: itemDuration,
        transitMode: singleItemFromForm?.transitMode || 'driving',
        transitTimeFromPreviousMinutes: null,
      });
    } else if (planFormData.planType === 'multi-stop' && planFormData.itinerary) {
       const validatedItinerary = z.array(serverItineraryItemSchema).safeParse(planFormData.itinerary);
       if (!validatedItinerary.success) {
         console.error("[createPlanAction] Invalid itinerary items for multi-stop:", validatedItinerary.error.flatten().fieldErrors);
         return { success: false, error: "Invalid itinerary items: " + JSON.stringify(validatedItinerary.error.flatten().fieldErrors).substring(0, 200) };
       }
       finalItinerary = validatedItinerary.data.map(item => {
        const itemStartTimeDate = parseISO(item.startTime);
        return {
          ...item,
          id: item.id || crypto.randomUUID(),
          startTime: item.startTime, 
          endTime: item.endTime || (item.startTime && typeof item.durationMinutes === 'number' ? new Date(itemStartTimeDate.getTime() + item.durationMinutes * 60000).toISOString() : undefined),
          durationMinutes: item.durationMinutes ?? 60,
          transitMode: item.transitMode ?? 'driving',
        };
       });
    }

    const planDataForService: Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'hostName' | 'hostAvatarUrl'> = {
      name: planFormData.name,
      description: planFormData.description || null,
      eventTime: eventStartTimeISO,
      location: planFormData.primaryLocation,
      city: planFormData.city,
      eventType: planFormData.eventType || null,
      eventTypeLowercase: (planFormData.eventType || '').toLowerCase(),
      priceRange: planFormData.priceRange || 'Free',
      hostId: hostId, 
      invitedParticipantUserIds: planFormData.invitedParticipantUserIds || [],
      itinerary: finalItinerary,
      status: planFormData.status,
      planType: planFormData.planType,
      originalPlanId: null, 
      sharedByUid: null,    
      averageRating: null,
      reviewCount: 0,
      photoHighlights: [],
      participantResponses: {}, 
    };

    const planId = await createPlanAdmin(planDataForService, hostId);
    revalidatePath('/plans');
    if (planId) revalidatePath(`/plans/${planId}`);
    return { success: true, planId };
  } catch (error: any) {
    console.error('[createPlanAction] Error:', error);
    return { success: false, error: error.message || 'Failed to create plan.' };
  }
}

export async function updatePlanAction(
    planId: string,
    planFormData: PlanFormValues,
    idToken: string
): Promise<{ success: boolean; planId?: string; error?: string }> {
    if (!authAdmin) return { success: false, error: "Server error: Authentication service not available." };
    
    let decodedToken;
    try {
        decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch (error: any) {
        let e = 'Authentication failed. Invalid or expired token.'; if (error.code === 'auth/id-token-expired') e = 'Session expired.';
        return { success: false, error: e };
    }
    const currentUserId = decodedToken.uid;

    if (!planId) return { success: false, error: 'Plan ID missing.' };
    
    try {
        const currentPlanData = await getPlanByIdAdminService(planId); // Fetch with admin service
        if (!currentPlanData) return { success: false, error: 'Plan not found to update.' };
        if (currentPlanData.hostId !== currentUserId) return { success: false, error: 'User not authorized to update this plan.' };
        
        let finalItinerary: ItineraryItem[] = [];
        const eventStartTimeISO = planFormData.eventDateTime.toISOString();

        if (planFormData.planType === 'single-stop') {
            const singleItemFromForm = planFormData.itinerary?.[0];
            const itemDuration = singleItemFromForm?.durationMinutes ?? currentPlanData.itinerary?.[0]?.durationMinutes ?? 60;
            const eventStartTimeDate = parseISO(eventStartTimeISO);
            const eventEndTime = new Date(eventStartTimeDate.getTime() + itemDuration * 60000);
            
            finalItinerary.push({
                id: singleItemFromForm?.id || currentPlanData.itinerary?.[0]?.id || crypto.randomUUID(),
                placeName: planFormData.primaryLocation,
                address: singleItemFromForm?.address || planFormData.primaryLocation,
                city: singleItemFromForm?.city || planFormData.city,
                startTime: eventStartTimeISO,
                endTime: eventEndTime.toISOString(),
                description: singleItemFromForm?.description || planFormData.description || null,
                googlePlaceId: singleItemFromForm?.googlePlaceId || currentPlanData.itinerary?.[0]?.googlePlaceId || null,
                googleMapsImageUrl: singleItemFromForm?.googleMapsImageUrl || currentPlanData.itinerary?.[0]?.googleMapsImageUrl || null,
                googlePhotoReference: singleItemFromForm?.googlePhotoReference || currentPlanData.itinerary?.[0]?.googlePhotoReference || null,
                lat: singleItemFromForm?.lat || currentPlanData.itinerary?.[0]?.lat || null,
                lng: singleItemFromForm?.lng || currentPlanData.itinerary?.[0]?.lng || null,
                rating: singleItemFromForm?.rating ?? currentPlanData.itinerary?.[0]?.rating ?? null,
                reviewCount: singleItemFromForm?.reviewCount ?? currentPlanData.itinerary?.[0]?.reviewCount ?? null,
                activitySuggestions: singleItemFromForm?.activitySuggestions || currentPlanData.itinerary?.[0]?.activitySuggestions || [],
                isOperational: singleItemFromForm?.isOperational === undefined ? (currentPlanData.itinerary?.[0]?.isOperational === undefined ? null : currentPlanData.itinerary?.[0]?.isOperational) : singleItemFromForm?.isOperational,
                statusText: singleItemFromForm?.statusText || currentPlanData.itinerary?.[0]?.statusText || null,
                openingHours: singleItemFromForm?.openingHours || currentPlanData.itinerary?.[0]?.openingHours || [],
                phoneNumber: singleItemFromForm?.phoneNumber || currentPlanData.itinerary?.[0]?.phoneNumber || null,
                website: singleItemFromForm?.website || currentPlanData.itinerary?.[0]?.website || null,
                priceLevel: singleItemFromForm?.priceLevel ?? currentPlanData.itinerary?.[0]?.priceLevel ?? null,
                types: singleItemFromForm?.types || currentPlanData.itinerary?.[0]?.types || [],
                notes: singleItemFromForm?.notes || currentPlanData.itinerary?.[0]?.notes || null,
                durationMinutes: itemDuration,
                transitMode: singleItemFromForm?.transitMode || currentPlanData.itinerary?.[0]?.transitMode || 'driving',
                transitTimeFromPreviousMinutes: null,
            });
        } else if (planFormData.planType === 'multi-stop' && planFormData.itinerary) {
            const validatedItinerary = z.array(serverItineraryItemSchema).safeParse(planFormData.itinerary);
            if (!validatedItinerary.success) {
                console.error("[updatePlanAction] Invalid itinerary items for multi-stop update:", validatedItinerary.error.flatten().fieldErrors);
                return { success: false, error: "Invalid itinerary items for update: " + JSON.stringify(validatedItinerary.error.flatten().fieldErrors).substring(0,200) };
            }
            finalItinerary = validatedItinerary.data.map(item => {
              const itemStartTimeDate = parseISO(item.startTime);
              return {
                ...item,
                id: item.id || crypto.randomUUID(),
                startTime: item.startTime, 
                endTime: item.endTime || (item.startTime && typeof item.durationMinutes === 'number' ? new Date(itemStartTimeDate.getTime() + item.durationMinutes * 60000).toISOString() : undefined),
                durationMinutes: item.durationMinutes ?? 60,
                transitMode: item.transitMode ?? 'driving',
              };
            });
        }
        
        const planDataToUpdate: Partial<Omit<Plan, 'id' | 'createdAt' | 'hostId' | 'hostName' | 'hostAvatarUrl' | 'updatedAt'>> = {
            name: planFormData.name,
            description: planFormData.description || null,
            eventTime: eventStartTimeISO,
            location: planFormData.primaryLocation,
            city: planFormData.city,
            eventType: planFormData.eventType || null,
            eventTypeLowercase: (planFormData.eventType || '').toLowerCase(),
            priceRange: planFormData.priceRange || 'Free',
            invitedParticipantUserIds: planFormData.invitedParticipantUserIds || [],
            itinerary: finalItinerary,
            status: planFormData.status,
            planType: planFormData.planType,
            photoHighlights: currentPlanData.photoHighlights || [], 
            averageRating: currentPlanData.averageRating,
            reviewCount: currentPlanData.reviewCount,
            originalPlanId: currentPlanData.originalPlanId,
            sharedByUid: currentPlanData.sharedByUid,
        };
        
        await updatePlanAdminService(planId, planDataToUpdate, currentPlanData);
        revalidatePath('/plans');
        revalidatePath(`/plans/${planId}`);
        return { success: true, planId: planId };
    } catch (error: any) {
        console.error('[updatePlanAction] Error:', error);
        return { success: false, error: error.message || 'Failed to update plan.' };
    }
}

export async function copyPlanToMyAccountAction(
  originalPlanId: string,
  idToken: string 
): Promise<{ success: boolean; newPlanId?: string; error?: string }> {
  if (!authAdmin || !firestoreAdmin) {
    return { success: false, error: "Server error: Core services not available." };
  }
  if (!idToken) return { success: false, error: 'Authentication token missing.' };
  if (!originalPlanId) return { success: false, error: 'Original plan ID is missing.' };

  let decodedToken;
  let newHostId: string;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    newHostId = decodedToken.uid;
  } catch (error: any) {
    let e = 'Authentication failed. Invalid or expired token.'; if (error.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }

  try {
    const originalPlan = await getPlanByIdAdminService(originalPlanId);
    if (!originalPlan) return { success: false, error: 'Original plan not found.' };
    
    if (originalPlan.status !== 'published') {
      return { success: false, error: 'This plan is not available for copying.' };
    }

    const newPlanDataForService: Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'hostName' | 'hostAvatarUrl'> = {
      name: `Copy of ${originalPlan.name}`,
      description: originalPlan.description,
      eventTime: originalPlan.eventTime,
      location: originalPlan.location,
      city: originalPlan.city,
      eventType: originalPlan.eventType,
      priceRange: originalPlan.priceRange,
      hostId: newHostId,
      invitedParticipantUserIds: [],
      participantResponses: {},
      itinerary: originalPlan.itinerary.map(item => ({ ...item, id: crypto.randomUUID() })),
      status: 'draft',
      planType: originalPlan.planType,
      originalPlanId: originalPlan.id,
      sharedByUid: originalPlan.hostId,
      averageRating: null,
      reviewCount: 0,
      photoHighlights: [],
    };
    
    const newPlanId = await createPlanAdmin(newPlanDataForService, newHostId);
    revalidatePath('/plans');
    if (newPlanId) revalidatePath(`/plans/${newPlanId}`);
    return { success: true, newPlanId };
  } catch (error: any) {
    console.error('[copyPlanToMyAccountAction] Error:', error);
    return { success: false, error: error.message || 'Failed to copy plan.' };
  }
}

export async function updateMyRSVPAction(
  planId: string,
  idToken: string,
  newStatus: RSVPStatusType
): Promise<{ success: boolean; error?: string }> {
  if (!authAdmin) return { success: false, error: "Server error: Authentication service not available." };
  let decodedToken;
  let userId: string;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (error: any) {
    let e = 'Authentication failed. Invalid or expired token.'; if (error.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }

  if (!planId || !newStatus) return { success: false, error: 'Plan ID or new RSVP status missing.' };

  try {
    const currentPlan = await getPlanByIdAdminService(planId); 
    if (!currentPlan) return { success: false, error: 'Plan not found.' };
    
    const isHost = currentPlan.hostId === userId;
    const isInvited = (currentPlan.invitedParticipantUserIds || []).includes(userId);

    if (!isHost && !isInvited) return { success: false, error: 'User not part of this plan.' };

    const updatedResponses = { ...(currentPlan.participantResponses || {}) };
    updatedResponses[userId] = newStatus;

    await updatePlanAdminService(planId, { participantResponses: updatedResponses }, currentPlan);
    revalidatePath(`/plans/${planId}`);
    revalidatePath('/plans');
    return { success: true };
  } catch (error: any) {
    console.error('[updateMyRSVPAction] Error:', error);
    return { success: false, error: error.message || 'Failed to update RSVP.' };
  }
}

export async function submitRatingAction(
  planId: string,
  idToken: string,
  ratingValue: number
): Promise<{ success: boolean; error?: string; newAverageRating?: number | null; newReviewCount?: number }> {
  if (!authAdmin || !firestoreAdmin) {
    return { success: false, error: "Server error: Auth or Firestore service not available." };
  }
  let decodedToken;
  let userId: string;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (error: any) {
    let e = 'Authentication failed. Invalid or expired token.'; if (error.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }

  if (!planId) return { success: false, error: "Plan ID missing." };
  if (ratingValue < 1 || ratingValue > 5) return { success: false, error: "Invalid rating value."};
  
  try {
    const currentPlan = await getPlanByIdAdminService(planId); 
    if (!currentPlan) return { success: false, error: "Plan not found to submit rating." };
    
    const isParticipant = currentPlan.hostId === userId || (currentPlan.invitedParticipantUserIds || []).includes(userId);
    if (!isParticipant) {
        return { success: false, error: "User was not a participant of this plan." };
    }
    
    let planEventDate;
    try {
        planEventDate = parseISO(currentPlan.eventTime);
    } catch (e) {
        console.error(`[submitRatingAction] Invalid eventTime format for plan ${planId}: ${currentPlan.eventTime}`);
        return { success: false, error: "Plan event time is invalid." };
    }

    if (!isValid(planEventDate) || !isPast(planEventDate)) {
      return { success: false, error: "Ratings can only be submitted for past plans." };
    }

    const result = await setRatingAdmin(planId, userId, ratingValue, currentPlan);
    if (result.success) {
      revalidatePath(`/plans/${planId}`);
      revalidatePath('/plans'); 
    }
    return result;
  } catch (error: any) {
    console.error("[submitRatingAction] Error:", error);
    return { success: false, error: error.message || "Failed to submit rating." };
  }
}

export async function deleteRatingAction(
  planId: string, 
  idToken: string
): Promise<{ success: boolean; newAverageRating?: number | null; newReviewCount?: number; error?: string }> {
  if (!authAdmin) return { success: false, error: "Server error: Auth service not available." };
  let decodedToken;
  let userId: string;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (error: any) {
    let e = 'Authentication failed. Invalid or expired token.'; if (error.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }

  if (!planId) return { success: false, error: "Plan ID missing." };

  try {
    const currentPlan = await getPlanByIdAdminService(planId);
    if (!currentPlan) return { success: false, error: "Plan not found to delete rating." };
    
    const isParticipant = currentPlan.hostId === userId || (currentPlan.invitedParticipantUserIds || []).includes(userId);
    if (!isParticipant) return { success: false, error: "User was not a participant of this plan." };
    
    let planEventDate;
    try { planEventDate = parseISO(currentPlan.eventTime); }
    catch (e) { return { success: false, error: "Plan event time is invalid." }; }
    
    if (!isValid(planEventDate) || !isPast(planEventDate)) {
      return { success: false, error: "Ratings can only be cleared for past plans." };
    }

    const result = await deleteRatingAdminService(planId, userId, currentPlan);
    if (result.success) {
      revalidatePath(`/plans/${planId}`);
    }
    return result;
  } catch (error: any) {
    console.error("[deleteRatingAction] Error:", error);
    return { success: false, error: error.message || "Failed to delete rating." };
  }
}


export async function submitCommentAction(
  planId: string,
  idToken: string,
  text: string,
): Promise<{ success: boolean; comment?: Comment; error?: string }> { // Removed userName and userAvatarUrl from client input
  if (!authAdmin || !firestoreAdmin) {
    return { success: false, error: "Server error: Core services not available." };
  }
  let decodedToken;
  let userId: string;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (error: any) {
    let e = 'Authentication failed. Invalid or expired token.'; if (error.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }

  if (!planId) return { success: false, error: "Plan ID missing." };
  if (!text.trim()) return { success: false, error: "Comment text cannot be empty."};
  
  try {
    const userProfile = await getUserProfileAdmin(userId); 
    if (!userProfile) {
      return { success: false, error: "User profile not found to post comment." };
    }
    
    const currentPlan = await getPlanByIdAdminService(planId);
    if (!currentPlan) return { success: false, error: "Plan not found to submit comment." };

    const isParticipant = currentPlan.hostId === userId || (currentPlan.invitedParticipantUserIds || []).includes(userId);
    if (!isParticipant) return { success: false, error: "User not participant of this plan, cannot comment." };
    
    let planEventDate;
    try { planEventDate = parseISO(currentPlan.eventTime); }
    catch(e) { return { success: false, error: "Plan event time is invalid."}; }

    if (!isValid(planEventDate) || !isPast(planEventDate)) {
      return { success: false, error: "Comments can only be submitted for past plans." };
    }

    const commentDataForService: Omit<Comment, 'id' | 'createdAt' | 'planId' | 'updatedAt'> = {
      userId, 
      userName: userProfile.name || `User (${userId.substring(0,5)})`, 
      username: userProfile.username || null,
      userAvatarUrl: userProfile.avatarUrl || null, 
      role: userProfile.role || 'user',
      isVerified: userProfile.isVerified || false,
      text: text.trim(),
    };
    const result = await addCommentAdmin(planId, commentDataForService);
    if (result.success) {
        revalidatePath(`/plans/${planId}`);
        return { success: true, comment: result.createdComment }; // Pass back the full comment
    }
    return { success: false, error: result.error };
  } catch (error: any) {
    console.error("[submitCommentAction] Error:", error);
    return { success: false, error: error.message || "Failed to submit comment." };
  }
}

export async function updateCommentAction(
  planId: string,
  commentId: string,
  newText: string,
  idToken: string
): Promise<{ success: boolean; updatedComment?: Comment; error?: string }> {
  if (!authAdmin) return { success: false, error: "Server error: Auth service not available." };
  let decodedToken;
  let userId: string;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (error: any) {
    let e = 'Authentication failed. Invalid or expired token.'; if (error.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }

  if (!planId || !commentId || !newText.trim()) {
    return { success: false, error: "Missing required data (planId, commentId, or text)." };
  }

  try {
    const result = await updateCommentAdminService(planId, commentId, newText.trim(), userId);
    if (result.success) {
      revalidatePath(`/plans/${planId}`);
    }
    return result;
  } catch (error: any) {
    console.error("[updateCommentAction] Error:", error);
    return { success: false, error: error.message || "Failed to update comment." };
  }
}

export async function deleteCommentAction(
  planId: string,
  commentId: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  if (!authAdmin) return { success: false, error: "Server error: Auth service not available." };
  let decodedToken;
  let userId: string;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (error: any) {
    let e = 'Authentication failed. Invalid or expired token.'; if (error.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }
  if (!planId || !commentId) return { success: false, error: "Missing planId or commentId."};

  try {
    await deleteCommentAdminService(planId, commentId, userId);
    revalidatePath(`/plans/${planId}`);
    return { success: true };
  } catch (error: any) {
    console.error("[deleteCommentAction] Error:", error);
    return { success: false, error: error.message || "Failed to delete comment." };
  }
}


export async function addPhotoHighlightAction(
  planId: string,
  formData: FormData,
  idToken: string 
): Promise<{ success: boolean; updatedPlan?: Plan; error?: string }> {
  // console.log("[addPhotoHighlightAction] Action started for plan:", planId);

  if (!authAdmin || !storageAdmin || !firestoreAdmin) {
    const missingServices = [
        !authAdmin && "Auth",
        !storageAdmin && "Storage",
        !firestoreAdmin && "Firestore"
    ].filter(Boolean).join(', ');
    console.error(`[addPhotoHighlightAction] CRITICAL: Admin SDK services not available: ${missingServices}. Check firebaseAdmin.ts initialization and environment variables.`);
    return { success: false, error: `Server error: Core services (${missingServices}) not available.` };
  }
  
  let decodedToken;
  let userId: string;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    userId = decodedToken.uid;
    // console.log(`[addPhotoHighlightAction] User ${userId} verified for plan ${planId}.`);
  } catch (authError: any) {
    console.error(`[addPhotoHighlightAction] ID Token verification error for plan ${planId}:`, authError);
    let e = 'Authentication failed. Invalid or expired token.'; if (authError.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }

  const file = formData.get('highlightImage') as File | null;
  if (!file) {
    console.error("[addPhotoHighlightAction] No image file provided in formData for plan:", planId);
    return { success: false, error: 'No image file provided.' };
  }
  
  // console.log(`[addPhotoHighlightAction] Received file: ${file.name}, Client-side Type: ${file.type}, Size: ${file.size} for plan ${planId}`);

  const getMimeTypeFromServer = (fileName: string): string | null => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) return null;
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
      'webp': 'image/webp', 'bmp': 'image/bmp', 'svg': 'image/svg+xml', 'avif': 'image/avif', 'tiff': 'image/tiff',
    };
    return mimeTypes[extension] || null;
  };

  let determinedContentType = file.type;
  if (!determinedContentType || !determinedContentType.startsWith('image/')) {
    console.warn(`[addPhotoHighlightAction] Client-side type '${file.type}' for ${file.name} is invalid/missing. Inferring from extension.`);
    determinedContentType = getMimeTypeFromServer(file.name);
  }

  if (!determinedContentType || !determinedContentType.startsWith('image/')) {
    const errorMsg = `Invalid file type for ${file.name}. Detected: ${file.type}, Inferred: ${determinedContentType}. Please use JPG, PNG, GIF, WEBP.`;
    console.error(`[addPhotoHighlightAction] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
  // console.log(`[addPhotoHighlightAction] Using Content-Type: '${determinedContentType}' for ${file.name} for upload.`);

  if (file.size > 5 * 1024 * 1024) { 
    return { success: false, error: "Image size should not exceed 5MB." };
  }

  try {
    const currentPlan = await getPlanByIdAdminService(planId);
    if (!currentPlan) {
        return { success: false, error: "Plan not found to add highlight." };
    }
    
    const isParticipant = currentPlan.hostId === userId || (currentPlan.invitedParticipantUserIds || []).includes(userId);
    if (!isParticipant) {
        return { success: false, error: "User is not a participant of this plan." };
    }
    
    let planEventDate;
    try { planEventDate = parseISO(currentPlan.eventTime); }
    catch(e) { return { success: false, error: "Plan event time is invalid."}; }

    if (!isValid(planEventDate) || !isPast(planEventDate)) {
      return { success: false, error: "Photo highlights can only be added to past plans." };
    }
    
    // console.log(`[addPhotoHighlightAction] Type of storageAdmin: ${typeof storageAdmin}`);
    if (typeof storageAdmin?.bucket !== 'function') {
        console.error("[addPhotoHighlightAction] storageAdmin.bucket is NOT a function. Storage Admin SDK might not be initialized correctly.");
        throw new Error("Server error: Storage service misconfiguration.");
    }
    
    const bucketNameForAction = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const bucket = bucketNameForAction ? storageAdmin.bucket(bucketNameForAction) : storageAdmin.bucket();
    
    if (!bucket) {
      console.error("[addPhotoHighlightAction] Could not access Firebase Storage bucket.");
      return { success: false, error: 'Server error: Storage bucket not accessible.' };
    }
    const bucketName = bucket.name;
    // console.log(`[addPhotoHighlightAction] Using bucket: ${bucketName}`);
    
    const originalName = file.name;
    const extension = originalName.split('.').pop()?.toLowerCase() || '';
    const baseName = extension ? originalName.substring(0, originalName.lastIndexOf(`.${extension}`)) : originalName;
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_'); 
    const sanitizedFileName = extension ? `${sanitizedBaseName}.${extension}` : sanitizedBaseName;
    
    const filePath = `plans/${planId}/highlights/${userId}/${Date.now()}-${sanitizedFileName}`;
    const blob = bucket.file(filePath);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    // console.log(`[addPhotoHighlightAction] Uploading ${filePath} with Content-Type: ${determinedContentType}`);
    await blob.save(buffer, {
      metadata: { contentType: determinedContentType, cacheControl: 'public, max-age=31536000', customMetadata: { uploaderUid: userId }},
      public: true, 
    });
    
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${filePath.replace(/\s/g, '%20')}`;
    // console.log(`[addPhotoHighlightAction] Image uploaded. Public URL: ${publicUrl}`);


    const planDocRef = firestoreAdmin.collection(PLANS_COLLECTION).doc(planId);
    await planDocRef.update({
      photoHighlights: FieldValue.arrayUnion(publicUrl),
      updatedAt: FieldValue.serverTimestamp(),
    });
    // console.log(`[addPhotoHighlightAction] Firestore updated for plan ${planId} with new highlight URL.`);

    const updatedPlanData = await getPlanByIdAdminService(planId);
    if (!updatedPlanData) {
      console.error(`[addPhotoHighlightAction] Highlight uploaded, but failed to refetch plan details for plan ${planId}.`);
      return { success: false, error: "Highlight uploaded, but failed to refetch plan details." };
    }

    revalidatePath(`/plans/${planId}`);
    revalidatePath('/feed');
    // console.log(`[addPhotoHighlightAction] Action completed successfully for plan ${planId}.`);
    return { success: true, updatedPlan: updatedPlanData };

  } catch (error: any) {
    console.error('[addPhotoHighlightAction] Error processing highlight:', error);
    return { success: false, error: `Could not upload photo: ${error.message || 'Unknown server error'}` };
  }
}

// The first definition of getPublicPlanByIdAction (with return type Promise<{success: boolean, ...}>) has been removed.
// The definition at the end of the file (with return type Promise<{plan: Plan | null, ...}>) is kept.

export async function deletePlanAction(planId: string, idToken: string): Promise<{ success: boolean; error?: string }> {
  if (!authAdmin || !firestoreAdmin) {
    return { success: false, error: "Server error: Core services not available." };
  }
  let decodedToken;
  let userId: string;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (error: any) {
    let e = 'Authentication failed. Invalid or expired token.'; if (error.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }

  if (!planId) return { success: false, error: 'Plan ID is missing.' };

  try {
    await deletePlanAdminService(planId, userId);
    revalidatePath('/plans');
    revalidatePath(`/plans/${planId}`); 
    return { success: true };
  } catch (error: any) {
    console.error(`[deletePlanAction] Error deleting plan ${planId}:`, error);
    return { success: false, error: error.message || 'Failed to delete plan.' };
  }
}

export async function createPlanShareInviteAction(
  originalPlanId: string,
  originalPlanName: string,
  friendUid: string,
  idToken: string
): Promise<{ success: boolean; error?: string; shareId?: string }> {
  if (!authAdmin || !firestoreAdmin) {
    return { success: false, error: "Core services not available." };
  }
  if (!idToken) return { success: false, error: "Authentication token missing." };

  let decodedToken;
  let sharerUid: string;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    sharerUid = decodedToken.uid;
  } catch (error: any) {
    let e = 'Authentication failed. Invalid or expired token.'; if (error.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }

  if (sharerUid === friendUid) {
    return { success: false, error: "You cannot share a plan with yourself." };
  }

  try {
    const sharerProfile = await getUserProfileAdmin(sharerUid);
    if (!sharerProfile) {
      return { success: false, error: "Sharer profile not found." };
    }

    const shareId = await createPlanShareInviteAdmin(
      originalPlanId,
      originalPlanName,
      sharerUid,
      sharerProfile.name || `User (${sharerUid.substring(0,5)})`,
      sharerProfile.avatarUrl,
      friendUid
    );
    revalidatePath('/plans'); 
    return { success: true, shareId };
  } catch (error: any) {
    console.error("[createPlanShareInviteAction] Error:", error);
    return { success: false, error: error.message || "Failed to share plan." };
  }
}

export async function acceptPlanShareAction(
  planShareId: string,
  idToken: string
): Promise<{ success: boolean; error?: string; newPlanId?: string }> {
  if (!authAdmin || !firestoreAdmin) {
    return { success: false, error: "Core services not available." };
  }
  if (!idToken) return { success: false, error: "Authentication token missing." };

  let decodedToken;
  let accepterUid: string;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    accepterUid = decodedToken.uid;
  } catch (error: any) {
    let e = 'Authentication failed. Invalid or expired token.'; if (error.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }

  try {
    const planShare = await getPlanShareByIdAdmin(planShareId);
    if (!planShare) {
      return { success: false, error: "Plan share invitation not found." };
    }
    if (planShare.sharedWithUid !== accepterUid) {
      return { success: false, error: "This share invitation is not for you." };
    }
    if (planShare.status !== 'pending') {
      return { success: false, error: `This share invitation has already been ${planShare.status}.` };
    }

    const copyResult = await copyPlanToMyAccountAction(planShare.originalPlanId, idToken); // Pass idToken for new host verification
                                                                                        
    if (copyResult.success && copyResult.newPlanId) {
      await updatePlanShareStatusAdmin(planShareId, 'accepted');
      revalidatePath('/plans'); 
      return { success: true, newPlanId: copyResult.newPlanId };
    } else {
      return { success: false, error: copyResult.error || "Failed to copy shared plan." };
    }
  } catch (error: any) {
    console.error("[acceptPlanShareAction] Error:", error);
    return { success: false, error: error.message || "Failed to accept plan share." };
  }
}

export async function declinePlanShareAction(
  planShareId: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  if (!authAdmin || !firestoreAdmin) {
    return { success: false, error: "Core services not available." };
  }
  if (!idToken) return { success: false, error: "Authentication token missing." };

  let decodedToken;
  let userId: string;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (error: any) {
    let e = 'Authentication failed. Invalid or expired token.'; if (error.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }

  try {
    const planShare = await getPlanShareByIdAdmin(planShareId);
    if (!planShare) {
      return { success: false, error: "Plan share invitation not found." };
    }
    if (planShare.sharedWithUid !== userId) { 
        return { success: false, error: "Not authorized to decline this share."};
    }
    if (planShare.status !== 'pending') {
      return { success: false, error: `This share invitation has already been ${planShare.status}.` };
    }

    await updatePlanShareStatusAdmin(planShareId, 'declined');
    revalidatePath('/plans'); 
    return { success: true };
  } catch (error: any) {
    console.error("[declinePlanShareAction] Error:", error);
    return { success: false, error: error.message || "Failed to decline plan share." };
  }
}

// --- GET DIRECTIONS (Example of a utility action that might call external API) ---
interface GetDirectionsActionInput {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  mode: TransitMode; 
  departureTime?: string; 
}

export async function getDirectionsAction(
  input: GetDirectionsActionInput
): Promise<{ success: boolean; durationMinutes?: number | null; distanceText?: string | null; error?: string }> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("[getDirectionsAction] Google Maps API key is missing.");
    return { success: false, error: "API key missing" };
  }

  let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${input.originLat},${input.originLng}&destination=${input.destinationLat},${input.destinationLng}&mode=${input.mode}&key=${apiKey}`;

  if (input.departureTime && input.mode === 'transit') {
    try {
      const parsedDepartureTime = parseISO(input.departureTime);
      if (isValid(parsedDepartureTime)) {
        const departureTimestamp = Math.floor(parsedDepartureTime.getTime() / 1000);
        url += `&departure_time=${departureTimestamp}`;
      } else {
        console.warn("[getDirectionsAction] Invalid departureTime format provided:", input.departureTime);
      }
    } catch (e) {
      console.warn("[getDirectionsAction] Error parsing departureTime:", input.departureTime, e);
    }
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[getDirectionsAction] Directions API error ${res.status}: ${errorBody}`);
      return { success: false, error: `Directions API error: ${res.statusText} - ${errorBody}` };
    }
    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
      const leg = data.routes[0].legs[0];
      const durationMinutes = leg.duration ? Math.round(leg.duration.value / 60) : null;
      const distanceText = leg.distance ? leg.distance.text : null;
      return { success: true, durationMinutes, distanceText };
    } else {
      return { success: false, error: `Directions not found. Status: ${data.status}. ${data.error_message || ''}`.trim() };
    }
  } catch (e: any) {
    console.error("[getDirectionsAction] Directions API fetch/parse error:", e);
    return { success: false, error: `Directions API fetch error: ${e.message}` };
  }
}

// Helper to ensure server-only services are initialized before use
// This is a conceptual check; actual initialization happens in firebaseAdmin.ts
const ensureAdminServices = () => {
    if (!authAdmin || !firestoreAdmin || !storageAdmin) {
        const missing = [
            !authAdmin && "Auth",
            !firestoreAdmin && "Firestore",
            !storageAdmin && "Storage"
        ].filter(Boolean).join(', ');
        console.error(`[PlanActions] CRITICAL: Admin SDK services not available: ${missing}. Check firebaseAdmin.ts initialization and environment variables.`);
        throw new Error(`Server error: Core services (${missing}) not available.`);
    }
};

// Call this at the beginning of any action that relies on admin services
// ensureAdminServices(); 
// Actually, it's better to check within each action just before use
// to ensure the console log points to the specific action if there's an issue.
// For now, individual checks within actions like addPhotoHighlightAction are preferred.

export async function getPublicPlanByIdAction(planId: string): Promise<{ plan: Plan | null; error?: string; notFound?: boolean; notPublic?: boolean; }> {
  try {
    const plan = await getPlanByIdAdminService(planId); // Using getPlanByIdAdminService as per file content

    if (!plan) {
      return { plan: null, notFound: true, error: "Plan not found." };
    }

    if (plan.status !== 'published') {
      return { plan: null, notPublic: true, error: "This plan is not public." };
    }
    
    return { plan: plan, error: undefined };

  } catch (error: any) {
    console.error(`[getPublicPlanByIdAction] Error fetching plan ${planId}:`, error);
    return { plan: null, error: error.message || "Failed to fetch plan details." };
  }
}

export async function getPublishedPlansByCityAction(cityName: string): Promise<{ success: boolean; plans?: Plan[]; error?: string }> {
  try {
    const plansRef = firestoreAdmin.collection('plans');
    const snapshot = await plansRef
      .where('status', '==', 'published')
      .where('city', '==', cityName)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const plans = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString() || new Date().toISOString(),
        eventTime: data.eventTime?.toDate().toISOString() || new Date().toISOString(),
      } as Plan;
    });

    return { success: true, plans };
  } catch (error) {
    console.error('Error fetching plans by city:', error);
    return { success: false, error: 'Failed to fetch plans' };
  }
}

export async function getPublishedPlansByCategoryAction(categoryName: string): Promise<{ success: boolean; plans?: Plan[]; error?: string }> {
  try {
    if (!firestoreAdmin) {
      throw new Error('Firestore Admin not initialized');
    }

    console.log(`[getPublishedPlansByCategoryAction] Searching for category: ${categoryName}`);

    // First try exact match on eventType
    const exactMatchQuery = await firestoreAdmin.collection('plans')
      .where('status', '==', 'published')
      .where('eventType', '==', categoryName)
      .get();

    // Then try lowercase match
    const lowercaseQuery = await firestoreAdmin.collection('plans')
      .where('status', '==', 'published')
      .where('eventTypeLowercase', '==', categoryName.toLowerCase())
      .get();

    // Combine results, removing duplicates
    const seenIds = new Set<string>();
    const plans: Plan[] = [];

    const convertTimestamp = (timestamp: any): string => {
      if (!timestamp) return new Date().toISOString();
      // Handle Firestore Timestamp
      if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
      }
      // Handle ISO string
      if (typeof timestamp === 'string') {
        return new Date(timestamp).toISOString();
      }
      // Handle seconds timestamp
      if (typeof timestamp === 'number') {
        return new Date(timestamp * 1000).toISOString();
      }
      // Default fallback
      return new Date().toISOString();
    };

    [exactMatchQuery, lowercaseQuery].forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          const data = doc.data();
          plans.push({
            id: doc.id,
            ...data,
            createdAt: convertTimestamp(data.createdAt),
            updatedAt: convertTimestamp(data.updatedAt),
            eventTime: convertTimestamp(data.eventTime),
          } as Plan);
        }
      });
    });

    console.log(`[getPublishedPlansByCategoryAction] Found ${plans.length} plans for category: ${categoryName}`);
    return { success: true, plans };
  } catch (error) {
    console.error('[getPublishedPlansByCategoryAction] Error:', error);
    return { success: false, error: 'Failed to fetch plans' };
  }
}

export async function generatePlanQRAction(planId: string, idToken: string): Promise<{ success: boolean; qrData?: string; error?: string }> {
  try {
    const decodedToken = await authAdmin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Get the plan to verify ownership/permissions
    const plan = await getPlanByIdAdminService(planId);
    if (!plan) {
      return { success: false, error: 'Plan not found' };
    }

    // Only allow host or admin to generate QR code
    const userRole = decodedToken.role as UserRoleType | undefined;
    if (plan.hostId !== userId && userRole !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    const qrData = await generateVenuePlanQR(planId);
    if (!qrData) {
      return { success: false, error: 'Failed to generate QR code' };
    }

    return { success: true, qrData };
  } catch (error: any) {
    console.error('Error in generatePlanQRAction:', error);
    return { success: false, error: error.message || 'Failed to generate QR code' };
  }
}

export async function completePlanAction(
  planId: string,
  verificationMethod: 'qr_code' | 'manual' | 'auto',
  qrCodeData: string | undefined,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const decodedToken = await authAdmin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const completion = await recordPlanCompletion(planId, userId, verificationMethod, qrCodeData);
    if (!completion) {
      return { success: false, error: 'Failed to record plan completion' };
    }

    // Update plan status to completed
    await updatePlanAdminService(planId, { status: 'completed' as const });

    return { success: true };
  } catch (error: any) {
    console.error('Error in completePlanAction:', error);
    return { success: false, error: error.message || 'Failed to complete plan' };
  }
}

export async function getAffinityScoreAction(
  userId1: string,
  userId2: string,
  idToken: string
): Promise<{ success: boolean; score?: number; error?: string }> {
  try {
    const decodedToken = await authAdmin.auth().verifyIdToken(idToken);
    const userRole = decodedToken.role as UserRoleType | undefined;
    
    // Only allow users to get their own affinity scores or admins to get any
    if (decodedToken.uid !== userId1 && decodedToken.uid !== userId2 && userRole !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    const score = await getAffinityScore(userId1, userId2);
    return { success: true, score };
  } catch (error: any) {
    console.error('Error in getAffinityScoreAction:', error);
    return { success: false, error: error.message || 'Failed to get affinity score' };
  }
}

export async function getUserAffinitiesAction(
  userId: string,
  idToken: string
): Promise<{ success: boolean; affinities?: UserAffinity[]; error?: string }> {
  try {
    const decodedToken = await authAdmin.auth().verifyIdToken(idToken);
    const userRole = decodedToken.role as UserRoleType | undefined;
    
    // Only allow users to get their own affinities or admins to get any
    if (decodedToken.uid !== userId && userRole !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    const affinities = await getUserAffinities(userId);
    return { success: true, affinities };
  } catch (error: any) {
    console.error('Error in getUserAffinitiesAction:', error);
    return { success: false, error: error.message || 'Failed to get user affinities' };
  }
}
