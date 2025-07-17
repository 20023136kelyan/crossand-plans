// src/app/actions/planActions.ts
'use server';

import {
  createPlanAdmin,
  updatePlanAdmin as updatePlanAdminService,
  getPlanByIdAdminService,
  setRatingAdmin,
  addCommentAdmin,
  deletePlanAdmin as deletePlanAdminService,
  createPlanShareInviteAdmin,
  getPlanShareByIdAdmin,
  updatePlanShareStatusAdmin,
  deleteRatingAdmin as deleteRatingAdminService,
  updateCommentAdmin as updateCommentAdminService,
  deleteCommentAdmin as deleteCommentAdminService,
  copyCommentsFromTemplate
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
  FeedPostVisibility,
  PlanShareStatus,
  UserProfile,
  TransitMode,
  PriceRangeType,
  PlanTypeType as PlanTypeHintTypeAlias,
  UserRoleType,
  UserAffinity
} from '@/types/user';
import { revalidatePath } from 'next/cache';
import { validateImageFile } from '@/lib/imageProcessing';
import { uploadPostHighlight } from '@/lib/postingSystem';
import { z } from 'zod';
import { generateFullPlan, type GenerateFullPlanInput } from '@/ai/flows/generate-full-plan';
import { generateDeepPlan, type GenerateDeepPlanInput } from '@/ai/flows/generate-deep-plan';
import { authAdmin, firestoreAdmin, storageAdmin } from '@/lib/firebaseAdmin'; 
import { FieldValue, GeoPoint } from 'firebase-admin/firestore';
import { parseISO, isValid, addHours, isPast } from 'date-fns'; 
import {
  generateVenuePlanQR,
  recordPlanCompletion,
  getAffinityScore,
  getUserAffinities
} from '@/services/planCompletionService.server';
import { getDefaultTemplateFields } from '@/lib/templateUtils';
import { sanitizeItineraryUUIDs } from '@/lib/utils';
import { processAIGeneratedPlan } from '@/lib/planUtils';

import {
  AIEnhancedProfileSchema,
  GeneratePlanInputSchema,
  PriceRangeSchema
} from '@/ai/schemas/shared';
import { createNotification } from '@/services/notificationService.server';

// Type for the enhanced profile from schema
export type AIEnhancedProfileType = z.infer<typeof AIEnhancedProfileSchema>;

// Type for the generate plan input from schema
export type GeneratePlanInputType = z.infer<typeof GeneratePlanInputSchema>;

// Helper functions for Place ID validation and refresh (server-side)
async function validatePlaceId(placeId: string): Promise<boolean> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('[validatePlaceId] Google Maps API key not found');
      return false;
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=place_id&key=${apiKey}`
    );

    if (!response.ok) {
      console.error(`[validatePlaceId] API error ${response.status}: ${response.statusText}`);
      if (response.status === 403) {
        console.error('[validatePlaceId] Google Maps API access denied (403). Check API key permissions, billing, and quota limits.');
      }
      return false;
    }

    const data = await response.json();
    
    // Check for API-specific error statuses
    if (data.status === 'REQUEST_DENIED') {
      console.error(`[validatePlaceId] API request denied: ${data.error_message || 'Unknown reason'}`);
      return false;
    }
    if (data.status === 'OVER_QUERY_LIMIT') {
      console.error(`[validatePlaceId] API quota exceeded`);
      return false;
    }
    
    return data.status === 'OK';
  } catch (error) {
    console.error('[validatePlaceId] Error validating Place ID:', error);
    return false;
  }
}

async function refreshPlaceId(placeName: string, city?: string): Promise<string | null> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('[refreshPlaceId] Google Maps API key not found');
      return null;
    }

    const searchQuery = city ? `${placeName}, ${city}` : placeName;
    const encodedQuery = encodeURIComponent(searchQuery);

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodedQuery}&key=${apiKey}`
    );

    if (!response.ok) {
      console.error(`[refreshPlaceId] API error ${response.status}: ${response.statusText}`);
      if (response.status === 403) {
        console.error('[refreshPlaceId] Google Maps API access denied (403). Check API key permissions, billing, and quota limits.');
      }
      return null;
    }

    const data = await response.json();
    
    // Check for API-specific error statuses
    if (data.status === 'REQUEST_DENIED') {
      console.error(`[refreshPlaceId] API request denied: ${data.error_message || 'Unknown reason'}`);
      return null;
    }
    if (data.status === 'OVER_QUERY_LIMIT') {
      console.error(`[refreshPlaceId] API quota exceeded`);
      return null;
    }
    
    if (data.status === 'OK' && data.results && data.results[0]) {
      return data.results[0].place_id || null;
    }
    
    return null;
  } catch (error) {
    console.error('[refreshPlaceId] Error refreshing Place ID:', error);
    return null;
  }
}

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
  priceRange: z.enum(['$', '$$', '$$$', '$$$$', 'Free'] as const).optional().nullable(),
  userPrompt: z.string().min(10, { message: 'Prompt must be at least 10 characters.' }).max(500),
  searchRadius: z.number().min(0).max(50).optional().nullable(),
  planTypeHint: z.enum(['ai-decide', 'single-stop', 'multi-stop'] as const).optional().default('ai-decide'),
  useDeepPlanner: z.boolean().optional().default(false),
  timezone: z.string().optional(), // Timezone from client
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

// Helper function to derive additional plan input fields
function deriveAdditionalPlanFields(clientInput: z.infer<typeof GenerateFullPlanInputClientSchema>) {
  // Derive duration based on plan type hint
  const duration = clientInput.planTypeHint === 'single-stop' ? '2 hours' : 
                  clientInput.planTypeHint === 'multi-stop' ? '4-6 hours' : '3-4 hours';
  
  // Derive group size from invited participants
  const groupSize = clientInput.invitedParticipantUserIds?.length 
    ? `${clientInput.invitedParticipantUserIds.length + 1} people`
    : 'solo';

  // Derive activity type from user prompt and location
  const activityType = clientInput.userPrompt.toLowerCase().includes('dinner') ? 'dining' :
                      clientInput.userPrompt.toLowerCase().includes('lunch') ? 'dining' :
                      clientInput.userPrompt.toLowerCase().includes('coffee') ? 'cafe' :
                      clientInput.userPrompt.toLowerCase().includes('drinks') ? 'nightlife' :
                      'general';

  // Derive time of day from plan date time
  const planHour = new Date(clientInput.planDateTime).getHours();
  const timeOfDay = planHour >= 5 && planHour < 12 ? 'morning' :
                   planHour >= 12 && planHour < 17 ? 'afternoon' :
                   planHour >= 17 && planHour < 22 ? 'evening' :
                   'night';

  // Derive budget from price range
  const budget = clientInput.priceRange === 'Free' ? 'no-cost' :
                clientInput.priceRange === '$' ? 'budget' :
                clientInput.priceRange === '$$' ? 'moderate' :
                clientInput.priceRange === '$$$' ? 'upscale' :
                clientInput.priceRange === '$$$$' ? 'luxury' :
                'flexible';

  // Default to driving if not specified
  const transportation = 'driving';

  return {
    duration,
    groupSize,
    activityType,
    timeOfDay,
    budget,
    transportation
  };
}

export async function generatePlanWithAIAction(
  clientInput: z.infer<typeof GenerateFullPlanInputClientSchema>,
  idToken: string
): Promise<{ success: boolean; plan?: Plan; error?: string }> {
  try {
    // Get user profile for host
    const hostProfile = await getUserProfileAdmin(clientInput.hostUid);
    if (!hostProfile) {
      return { success: false, error: 'Host profile not found' };
    }

    // Get profiles for invited friends
    const invitedFriendProfiles = clientInput.invitedParticipantUserIds?.length
      ? await getUsersProfilesAdmin(clientInput.invitedParticipantUserIds)
      : [];

    // Convert user profile to AI-enhanced profile format
    const hostProfileForAI = {
      uid: hostProfile.uid,
      name: hostProfile.name || undefined,
      preferences: hostProfile.preferences || [],
      allergies: hostProfile.allergies || [],
      dietaryRestrictions: hostProfile.dietaryRestrictions || [],
      favoriteCuisines: hostProfile.favoriteCuisines || [],
      activityTypePreferences: hostProfile.activityTypePreferences || [],
      activityTypeDislikes: hostProfile.activityTypeDislikes || [],
      physicalLimitations: hostProfile.physicalLimitations || [],
      environmentalSensitivities: hostProfile.environmentalSensitivities || [],
      availabilityNotes: hostProfile.availabilityNotes
    };

    // Convert invited friend profiles to AI format
    const invitedFriendProfilesForAI = invitedFriendProfiles.map(profile => ({
      uid: profile.uid,
      name: profile.name || undefined,
      preferences: profile.preferences || [],
      allergies: profile.allergies || [],
      dietaryRestrictions: profile.dietaryRestrictions || [],
      favoriteCuisines: profile.favoriteCuisines || [],
      activityTypePreferences: profile.activityTypePreferences || [],
      activityTypeDislikes: profile.activityTypeDislikes || [],
      physicalLimitations: profile.physicalLimitations || [],
      environmentalSensitivities: profile.environmentalSensitivities || [],
      availabilityNotes: profile.availabilityNotes
    }));

    // Derive additional fields required by the AI
    const additionalFields = deriveAdditionalPlanFields(clientInput);

    // Prepare AI input
    const aiFlowInput = {
      hostProfile: hostProfileForAI,
      invitedFriendProfiles: invitedFriendProfilesForAI,
      planDateTime: clientInput.planDateTime,
      locationQuery: clientInput.locationQuery,
      selectedLocationLat: clientInput.selectedLocationLat || 0,
      selectedLocationLng: clientInput.selectedLocationLng || 0,
      priceRange: clientInput.priceRange || undefined,
      userPrompt: clientInput.userPrompt,
      searchRadius: clientInput.searchRadius || undefined,
      planTypeHint: clientInput.planTypeHint || 'ai-decide',
      ...additionalFields
    };
    
    // Generate plan using AI
    const generatedPlan = await generateFullPlan(aiFlowInput);

    // Get user profile for processing
    const userProfileForProcessing = await getUserProfileAdmin(clientInput.hostUid);
    if (!userProfileForProcessing) {
      console.error(`[generatePlanWithAIAction] User profile not found for hostUid: ${clientInput.hostUid}`);
      return { success: false, error: 'User profile not found.' };
    }

    // Process and return the generated plan
    const { plan: processedPlan, validationErrors, warnings } = await processAIGeneratedPlan(
      generatedPlan,
      clientInput.planDateTime,
      userProfileForProcessing,
      clientInput.userPrompt
    );
    
    // Log any validation issues
    if (validationErrors.length > 0) {
      console.warn('[generatePlanWithAIAction] Validation errors:', validationErrors);
    }
    if (warnings.length > 0) {
      console.warn('[generatePlanWithAIAction] Warnings:', warnings);
    }
    
    return { success: true, plan: processedPlan };

            } catch (error) {
    console.error('[generatePlanWithAIAction] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

export async function generateDeepPlanWithAIAction(
  clientInput: z.infer<typeof GenerateFullPlanInputClientSchema>,
  idToken: string
): Promise<{ success: boolean; plan?: Plan; error?: string }> {
  try {
    // Get user profile for host
    const hostProfile = await getUserProfileAdmin(clientInput.hostUid);
    if (!hostProfile) {
      return { success: false, error: 'Host profile not found' };
    }

    // Get profiles for invited friends
    const invitedFriendProfiles = clientInput.invitedParticipantUserIds?.length
      ? await getUsersProfilesAdmin(clientInput.invitedParticipantUserIds)
      : [];

    // Filter out any potentially undefined profiles from friends list for robustness
    const validInvitedFriendProfiles = invitedFriendProfiles.filter((p): p is UserProfile => !!p);

    // Derive additional fields required by the AI
    const additionalFields = deriveAdditionalPlanFields(clientInput);

    // Prepare AI input
    const aiFlowInput: GenerateDeepPlanInput = {
      userProfile: hostProfile,
      invitedFriendProfiles: validInvitedFriendProfiles,
      planDateTime: clientInput.planDateTime,
      locationQuery: clientInput.locationQuery,
      priceRange: clientInput.priceRange || undefined,
      userPrompt: clientInput.userPrompt,
      planTypeHint: clientInput.planTypeHint || 'ai-decide',
      timezone: clientInput.timezone,
    };

    // Generate plan using AI
    const generatedPlan = await generateDeepPlan(aiFlowInput);
    
    // Process and return the generated plan
    const { plan: processedPlan, validationErrors, warnings } = await processAIGeneratedPlan(
      generatedPlan,
      clientInput.planDateTime,
      hostProfile,
      clientInput.userPrompt
    );

    // Log any validation issues
    if (validationErrors.length > 0) {
      console.warn('[generateDeepPlanWithAIAction] Validation errors:', validationErrors);
    }
    if (warnings.length > 0) {
      console.warn('[generateDeepPlanWithAIAction] Warnings:', warnings);
    }
    
    return { success: true, plan: processedPlan };

            } catch (error) {
    console.error('[generateDeepPlanWithAIAction] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

// Shared base function for plan access with authentication
async function getPlanWithAuth(
  planId: string,
  idToken: string,
  actionName: string
): Promise<{ success: boolean; plan?: Plan; error?: string; notFound?: boolean; unauthorized?: boolean; userId?: string }> {
  if (!authAdmin) {
    console.error(`[${actionName}] Firebase Admin Auth service not available.`);
    return { success: false, error: "Server error: Auth service not available." };
  }
  if (!planId) {
    return { success: false, error: "Plan ID is missing." };
  }

  let decodedToken;
  let userId: string;
  try {
    decodedToken = await authAdmin!.verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (authError: any) {
    console.error(`[${actionName}] ID Token verification failed for plan ${planId}:`, authError);
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

    return { success: true, plan: plan, userId };

  } catch (error: any) {
    console.error(`[${actionName}] Error retrieving plan ${planId}:`, error);
    // Check if the error indicates a "not found" scenario that getPlanByIdAdminService might throw differently
    if (error.message?.toLowerCase().includes('not found') || error.code === 'firestore/not-found') { // Example error check
        return { success: false, notFound: true, error: "Plan not found." };
    }
    return { success: false, error: `Could not retrieve plan for ${actionName.toLowerCase()}.` };
  }
}

export async function getPlanForEditingAction(
  planId: string,
  idToken: string
): Promise<{ success: boolean; plan?: Plan; error?: string; notFound?: boolean; unauthorized?: boolean; }> {
  const result = await getPlanWithAuth(planId, idToken, "getPlanForEditingAction");
  
  if (!result.success) {
    return result;
  }

  // Check if user is the host (only hosts can edit)
  if (result.plan!.hostId !== result.userId) {
    return { success: false, unauthorized: true, error: "User not authorized to edit this plan." };
  }

  return { success: true, plan: result.plan };
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
    decodedToken = await authAdmin!.verifyIdToken(idToken);
    hostId = decodedToken.uid;
  } catch (error: any) {
    let e = 'Authentication failed. Invalid or expired token.'; if (error.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }

  // 🔍 DETAILED SERVER-SIDE LOGGING - Input Data
  console.log('🚀 [createPlanAction] Received plan data:', {
    timestamp: new Date().toISOString(),
    hostId: hostId,
    planName: planFormData.name,
    planType: planFormData.planType,
    status: planFormData.status,
    itineraryCount: planFormData.itinerary?.length || 0,
    inputData: {
      ...planFormData,
      itinerary: planFormData.itinerary?.map((item, idx) => ({
        index: idx,
        placeName: item.placeName,
        address: item.address,
        city: item.city,
        rating: item.rating,
        reviewCount: item.reviewCount,
        priceLevel: item.priceLevel,
        lat: item.lat,
        lng: item.lng,
        googlePlaceId: item.googlePlaceId,
        isOperational: item.isOperational,
        statusText: item.statusText,
        phoneNumber: item.phoneNumber,
        website: item.website,
        types: item.types,
        openingHours: item.openingHours,
        googleMapsImageUrl: item.googleMapsImageUrl,
        googlePhotoReference: item.googlePhotoReference,
        activitySuggestions: item.activitySuggestions,
        startTime: item.startTime,
        endTime: item.endTime,
        durationMinutes: item.durationMinutes,
        transitMode: item.transitMode,
      })) || []
    }
  });

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
          endTime: item.endTime || (item.startTime && typeof item.durationMinutes === 'number' ? new Date(itemStartTimeDate.getTime() + item.durationMinutes * 60000).toISOString() : null),
          durationMinutes: item.durationMinutes ?? 60,
          transitMode: item.transitMode ?? 'driving',
          description: item.description ?? null,
          address: item.address ?? null,
          city: item.city ?? null,
          googlePlaceId: item.googlePlaceId ?? null,
          googlePhotoReference: item.googlePhotoReference ?? null,
          googleMapsImageUrl: item.googleMapsImageUrl ?? null,
          lat: item.lat ?? null,
          lng: item.lng ?? null,
          rating: item.rating ?? null,
          reviewCount: item.reviewCount ?? null,
          activitySuggestions: item.activitySuggestions ?? [],
          isOperational: item.isOperational ?? null,
          statusText: item.statusText ?? null,
          openingHours: item.openingHours ?? [],
          phoneNumber: item.phoneNumber ?? null,
          website: item.website ?? null,
          priceLevel: item.priceLevel ?? null,
          types: item.types ?? [],
          notes: item.notes ?? null,
          transitTimeFromPreviousMinutes: item.transitTimeFromPreviousMinutes ?? null,
        };
       });
    }

    // Sanitize all itinerary UUIDs to ensure they are valid
    finalItinerary = sanitizeItineraryUUIDs(finalItinerary);

    // Extract coordinates from first itinerary item for weather and location services
    const firstItineraryItem = finalItinerary[0];
    const planCoordinates = (firstItineraryItem?.lat && firstItineraryItem?.lng) ? {
      latitude: firstItineraryItem.lat,
      longitude: firstItineraryItem.lng
    } : undefined;

    // Sanitize all itinerary UUIDs to ensure they are valid
    finalItinerary = sanitizeItineraryUUIDs(finalItinerary);

    const planDataForService: any = {
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
      participantUserIds: [],
      itinerary: finalItinerary,
      status: planFormData.status,
      planType: planFormData.planType,
      originalPlanId: null, 
      sharedByUid: null,    
      averageRating: null,
      reviewCount: 0,
      photoHighlights: [],
      participantResponses: {},
      coordinates: planCoordinates ? new GeoPoint(planCoordinates.latitude, planCoordinates.longitude) : undefined,
    };

    // 🔍 DETAILED SERVER-SIDE LOGGING - Final Data to Database
    console.log('💾 [createPlanAction] Final plan data for database:', {
      timestamp: new Date().toISOString(),
      planData: {
        ...planDataForService,
        itinerary: finalItinerary.map((item, idx) => ({
          index: idx,
          id: item.id,
          placeName: item.placeName,
          address: item.address,
          city: item.city,
          rating: item.rating,
          reviewCount: item.reviewCount,
          priceLevel: item.priceLevel,
          lat: item.lat,
          lng: item.lng,
          googlePlaceId: item.googlePlaceId,
          isOperational: item.isOperational,
          statusText: item.statusText,
          phoneNumber: item.phoneNumber,
          website: item.website,
          types: item.types,
          openingHours: item.openingHours,
          googleMapsImageUrl: item.googleMapsImageUrl,
          googlePhotoReference: item.googlePhotoReference,
          activitySuggestions: item.activitySuggestions,
          startTime: item.startTime,
          endTime: item.endTime,
          durationMinutes: item.durationMinutes,
          transitMode: item.transitMode,
          transitTimeFromPreviousMinutes: item.transitTimeFromPreviousMinutes,
          notes: item.notes,
        }))
      },
      coordinates: planCoordinates ? new GeoPoint(planCoordinates.latitude, planCoordinates.longitude) : undefined,
      itineraryCount: finalItinerary.length,
    });

    const planId = await createPlanAdmin(planDataForService, hostId);
    revalidatePath('/plans');
    if (planId) revalidatePath(`/plans/${planId}`);
    
    // 🔍 SUCCESS LOGGING
    console.log('✅ [createPlanAction] Plan created successfully:', {
      timestamp: new Date().toISOString(),
      planId: planId,
      planName: planFormData.name,
      status: planFormData.status,
      itineraryCount: finalItinerary.length,
    });
    
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
        
        // Prevent editing of templates (only admins can modify templates)
        if (currentPlanData.isTemplate) {
          // Check if user is admin (you may need to implement admin role checking)
          // For now, templates are read-only for all users
          return { success: false, error: 'Templates cannot be modified. Please copy this template to create your own version.' };
        }
        
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
                description: item.description ?? null,
                address: item.address ?? null,
                city: item.city ?? null,
                googlePlaceId: item.googlePlaceId ?? null,
                googlePhotoReference: item.googlePhotoReference ?? null,
                googleMapsImageUrl: item.googleMapsImageUrl ?? null,
                startTime: item.startTime, 
                endTime: item.endTime || (item.startTime && typeof item.durationMinutes === 'number' ? new Date(itemStartTimeDate.getTime() + item.durationMinutes * 60000).toISOString() : null),
                durationMinutes: item.durationMinutes ?? 60,
                transitMode: item.transitMode ?? 'driving',
                lat: item.lat ?? null,
                lng: item.lng ?? null,
                rating: item.rating ?? null,
                reviewCount: item.reviewCount ?? null,
                activitySuggestions: item.activitySuggestions ?? [],
                isOperational: item.isOperational ?? null,
                statusText: item.statusText ?? null,
                openingHours: item.openingHours ?? [],
                phoneNumber: item.phoneNumber ?? null,
                website: item.website ?? null,
                priceLevel: item.priceLevel ?? null,
                types: item.types ?? [],
                notes: item.notes ?? null,
                transitTimeFromPreviousMinutes: item.transitTimeFromPreviousMinutes ?? null,
              };
            });
        }
        
        // Sanitize all itinerary UUIDs to ensure they are valid
        finalItinerary = sanitizeItineraryUUIDs(finalItinerary);
        
        // Extract coordinates from first itinerary item for weather and location services
        const firstItineraryItem = finalItinerary[0];
        const planCoordinates = (firstItineraryItem?.lat && firstItineraryItem?.lng) ? {
          latitude: firstItineraryItem.lat,
          longitude: firstItineraryItem.lng
        } : undefined;

        const planDataToUpdate: any = {
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
            updatedAt: FieldValue.serverTimestamp(),
            photoHighlights: currentPlanData.photoHighlights || [], 
            averageRating: currentPlanData.averageRating,
            reviewCount: currentPlanData.reviewCount,
            originalPlanId: currentPlanData.originalPlanId,
            sharedByUid: currentPlanData.sharedByUid,
            // Update coordinates from first itinerary item
            coordinates: planCoordinates ? new GeoPoint(planCoordinates.latitude, planCoordinates.longitude) : undefined,
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

    // Create a new plan from template with activity-focused naming
    const templateName = originalPlan.name.startsWith('Copy of ') ? originalPlan.name : originalPlan.name;
    const newPlanName = templateName.includes(' in ') ? templateName : `${templateName} in ${originalPlan.city}`;
    
    const sanitizedItinerary = sanitizeItineraryUUIDs(originalPlan.itinerary);
    
    const newPlanDataForService: Plan = {
      ...originalPlan,
      id: crypto.randomUUID(),
      name: newPlanName,
      description: originalPlan.description,
      eventTime: new Date().toISOString(), // Set to current time as placeholder - user will update
      location: originalPlan.location,
      city: originalPlan.city,
      eventType: originalPlan.eventType,
      eventTypeLowercase: (originalPlan.eventType || '').toLowerCase(),
      priceRange: originalPlan.priceRange,
      hostId: newHostId,
      invitedParticipantUserIds: [],
      participantUserIds: [],
      participantResponses: {},
      waitlistUserIds: [],
      privateNotes: '',
      itinerary: sanitizedItinerary,
      status: 'draft',
      planType: originalPlan.planType,
      originalPlanId: originalPlan.id,
      sharedByUid: originalPlan.hostId,
      // Preserve ratings for templates, reset for regular plans
      averageRating: originalPlan.isTemplate ? originalPlan.averageRating : null,
      reviewCount: originalPlan.isTemplate ? (originalPlan.reviewCount || 0) : 0,
      photoHighlights: originalPlan.photoHighlights || [], // Preserve template photos
      isTemplate: false, // New plan is not a template until completed
      isCompleted: false,
      completionConfirmedBy: [],
      highlightsEnabled: false,
      // Don't copy template-specific fields - this is a new plan
      ...getDefaultTemplateFields(),
    };
    
    const newPlanId = await createPlanAdmin(newPlanDataForService, newHostId);
    
    // Copy comments from template if this is a template
    if (newPlanId && originalPlan.isTemplate) {
      try {
        await copyCommentsFromTemplate(originalPlanId, newPlanId);
      } catch (error) {
        console.warn('[copyPlanToMyAccountAction] Failed to copy comments from template:', error);
        // Don't fail the entire operation if comment copying fails
      }
    }
    
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
    const wasGoing = updatedResponses[userId] === 'going';
    updatedResponses[userId] = newStatus;

    await updatePlanAdminService(planId, { participantResponses: updatedResponses }, currentPlan);
    revalidatePath(`/plans/${planId}`);
    revalidatePath('/plans');

    // --- Notification logic ---
    if (newStatus === 'going' && !wasGoing) {
      // Get joining user's profile
      const joiningUser = await getUserProfileAdmin(userId);
      if (joiningUser) {
        // Prepare notification data
        const planImageUrl = currentPlan.images && currentPlan.images.length > 0 ? currentPlan.images[0].url : undefined;
        const notificationData = {
          type: 'plan_join',
          avatarUrl: joiningUser.avatarUrl || undefined,
          userName: joiningUser.username || joiningUser.name || 'Someone',
          timestamp: new Date(),
          planImageUrl,
        };
        // Notify host (if not joining user)
        if (currentPlan.hostId && currentPlan.hostId !== userId) {
          await createNotification(currentPlan.hostId, {
            ...notificationData,
            title: 'Someone joined your plan',
            description: `${notificationData.userName} joined your plan`,
            actionUrl: `/plans/${planId}`,
            type: 'plan_join',
            avatarUrl: joiningUser.avatarUrl || undefined,
            planImageUrl,
          });
        }
        // Notify all other confirmed participants (except joining user)
        const confirmedParticipants = Object.entries(updatedResponses)
          .filter(([uid, resp]) => uid !== userId && resp === 'going')
          .map(([uid]) => uid);
        for (const participantId of confirmedParticipants) {
          await createNotification(participantId, {
            ...notificationData,
            title: 'Someone joined your plan',
            description: `${notificationData.userName} joined the plan you're attending`,
            actionUrl: `/plans/${planId}`,
            type: 'plan_join',
            avatarUrl: joiningUser.avatarUrl || undefined,
            planImageUrl,
          });
        }
      }
    }
    // --- End notification logic ---

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

  // Use centralized upload and processing system
  const uploadResult = await uploadPostHighlight(file, userId, idToken, planId);
  if (!uploadResult.success) {
    console.error(`[addPhotoHighlightAction] Upload failed for plan ${planId}:`, uploadResult.error);
    return { success: false, error: uploadResult.error || "Failed to upload image." };
  }
  
  const uploadedImageUrl = uploadResult.data?.url;
  if (!uploadedImageUrl) {
    console.error(`[addPhotoHighlightAction] No URL returned from upload for plan ${planId}`);
    return { success: false, error: "Failed to get uploaded image URL." };
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
    
    // Image has already been uploaded using centralized posting system
    // console.log(`[addPhotoHighlightAction] Using uploaded image URL: ${uploadedImageUrl}`);


    const planDocRef = firestoreAdmin.collection(PLANS_COLLECTION).doc(planId);
    await planDocRef.update({
      photoHighlights: FieldValue.arrayUnion(uploadedImageUrl),
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
      
      // Handle specific error codes
      if (res.status === 403) {
        return { success: false, error: "Google Maps API access denied (403). Check API key permissions, billing, and quota limits." };
      }
      return { success: false, error: `Directions API error: ${res.statusText} - ${errorBody}` };
    }
    const data = await res.json();
    
    // Check for API-specific error statuses
    if (data.status === 'REQUEST_DENIED') {
      console.error(`[getDirectionsAction] API request denied: ${data.error_message || 'Unknown reason'}`);
      return { success: false, error: `Google Maps API request denied: ${data.error_message || 'Check API key and billing'}` };
    }
    if (data.status === 'OVER_QUERY_LIMIT') {
      console.error(`[getDirectionsAction] API quota exceeded`);
      return { success: false, error: `Google Maps API quota exceeded. Please try again later.` };
    }

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
    if (!firestoreAdmin) {
      return { success: false, error: 'Database service not available' };
    }
    const plansRef = firestoreAdmin.collection('plans');
    const snapshot = await plansRef
      .where('status', '==', 'published')
      .where('isTemplate', '==', true)
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
      .where('isTemplate', '==', true)
      .where('eventType', '==', categoryName)
      .get();

    // Then try lowercase match
    const lowercaseQuery = await firestoreAdmin.collection('plans')
      .where('status', '==', 'published')
      .where('isTemplate', '==', true)
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
    if (!authAdmin) {
      return { success: false, error: 'Authentication service not available' };
    }
    const decodedToken = await authAdmin.verifyIdToken(idToken);
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
    if (!authAdmin) {
      return { success: false, error: 'Authentication service not available' };
    }
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const completion = await recordPlanCompletion(planId, userId, [userId], verificationMethod, qrCodeData);
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
    if (!authAdmin) {
      return { success: false, error: 'Authentication service not available' };
    }
    const decodedToken = await authAdmin.verifyIdToken(idToken);
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
    if (!authAdmin) {
      return { success: false, error: 'Authentication service not available' };
    }
    const decodedToken = await authAdmin.verifyIdToken(idToken);
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

export async function getPlanForViewingAction(
  planId: string,
  idToken: string
): Promise<{ success: boolean; plan?: Plan; error?: string; notFound?: boolean; unauthorized?: boolean; }> {
  const result = await getPlanWithAuth(planId, idToken, "getPlanForViewingAction");
  
  if (!result.success) {
    return result;
  }

  // Check if user has access to this plan (host or participant)
  const isHost = result.plan!.hostId === result.userId;
  const isParticipant = result.plan!.invitedParticipantUserIds?.includes(result.userId!) || result.plan!.participantUserIds?.includes(result.userId!);
  
  if (!isHost && !isParticipant) {
    return { success: false, unauthorized: true, error: "You don't have access to view this plan." };
  }

  return { success: true, plan: result.plan };
}
