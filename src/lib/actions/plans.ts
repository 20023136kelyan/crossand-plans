"use server";

import type { Plan, PlanStatus, Participant, ItineraryItem } from "@/types";
import { MOCK_USER_ID } from "@/types";
import { planSchema } from "@/lib/schemas"; 
import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { participantsDb, userProfilesDb } from "@/lib/mock-data";
import { storePlan, getPlan as getStoredPlan, getAllPlans as getAllStoredPlans } from "@/lib/storage/plans";
import { format, parseISO, isValid, formatISO, addHours } from "date-fns";

// Helper function to generate comprehensive preference list for a user profile
const generateComprehensivePreferencesForParticipant = (userId: string): string[] => {
  const profile = userProfilesDb[userId];
  if (!profile) return [];
  const prefs: string[] = [];
  if (profile.allergies) profile.allergies.forEach(a => prefs.push(`Allergic to ${a}`));
  if (profile.dietaryRestrictions) profile.dietaryRestrictions.forEach(d => prefs.push(d));
  if (profile.preferences) profile.preferences.forEach(p => prefs.push(p)); 
  if (profile.favoriteCuisines) profile.favoriteCuisines.forEach(c => prefs.push(`Loves ${c} cuisine`));
  if (profile.physicalLimitations) profile.physicalLimitations.forEach(l => prefs.push(`Physical limitation: ${l}`));
  if (profile.activityTypePreferences) profile.activityTypePreferences.forEach(a => prefs.push(`Enjoys ${a}`));
  if (profile.activityTypeDislikes) profile.activityTypeDislikes.forEach(a => prefs.push(`Dislikes ${a}`));
  if (profile.environmentalSensitivities) profile.environmentalSensitivities.forEach(s => prefs.push(`Sensitive to ${s}`));
  if (profile.socialPreferences) profile.socialPreferences.forEach(s => prefs.push(`Socially prefers: ${s}`));
  if (profile.travelTolerance) prefs.push(`Travel tolerance: ${profile.travelTolerance}`);
  if (profile.budgetFlexibilityNotes) prefs.push(`Budget notes: ${profile.budgetFlexibilityNotes}`);
  return Array.from(new Set(prefs)); 
};

export async function getPlansByUserId(userId: string): Promise<Plan[]> {
  try {
    const plansObj = getAllStoredPlans();
    // Convert the object of plans to an array and filter by hostId
    return Object.values(plansObj).filter(plan => plan.hostId === userId);
  } catch (error) {
    console.error("[getPlansByUserId] Error fetching plans:", error);
    return []; // Return empty array on error
  }
}

export async function getPlanById(planId: string): Promise<Plan | null> {
  try {
    const plan = getStoredPlan(planId);
    return plan || null;
  } catch (error) {
    console.error(`[getPlanById] Error fetching plan ${planId}:`, error);
    return null;
  }
}

export async function getParticipantsByPlanId(planId: string): Promise<Participant[]> {
  try {
    const planParticipants = participantsDb[planId] || [];
    
    return planParticipants.map(p => {
      const userProfile = userProfilesDb[p.userId];
      return {
        ...p,
        name: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : p.name,
        avatarUrl: userProfile?.avatarUrl || p.avatarUrl,
        preferences: generateComprehensivePreferencesForParticipant(p.userId),
      };
    });
  } catch (error) {
    console.error(`[getParticipantsByPlanId] Error fetching participants for plan ${planId}:`, error);
    return [];
  }
}

export async function createPlan(
  hostId: string,
  data: z.infer<typeof planSchema> 
): Promise<{ success: boolean; message?: string; data?: any }> {
  console.log("[createPlan] Action started with data:", JSON.stringify(data, null, 2));
  try {
    const validationResult = planSchema.safeParse(data);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      console.error("[createPlan] Input validation failed:", errorMessages);
      return { success: false, message: `Invalid plan data: ${errorMessages}` };
    }
    
    let planDataForCreation = { ...validationResult.data };

    const newPlanId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    let finalItinerary: ItineraryItem[] | undefined = undefined;
    if (planDataForCreation.itinerary && planDataForCreation.itinerary.length > 0) {
      finalItinerary = planDataForCreation.itinerary.map((item, index) => ({
        ...item,
        id: item.id || `itin_${newPlanId}_${index}_${Date.now()}`, 
        startTime: item.startTime && isValid(parseISO(item.startTime)) ? formatISO(parseISO(item.startTime)) : null,
        endTime: item.endTime && isValid(parseISO(item.endTime)) ? formatISO(parseISO(item.endTime)) : null,
        googleMapsImageUrl: item.googleMapsImageUrl || `https://picsum.photos/seed/${encodeURIComponent(item.placeName || `itinerary_${index}` )}/400/225`, 
        rating: item.rating !== undefined && item.rating !== null ? item.rating : undefined,
        reviewCount: item.reviewCount !== undefined && item.reviewCount !== null ? item.reviewCount : undefined,
        activitySuggestions: item.activitySuggestions || [],
      }));
    } else if (planDataForCreation.location) {
        const mainEventTime = planDataForCreation.eventTime && isValid(parseISO(planDataForCreation.eventTime)) ? parseISO(planDataForCreation.eventTime) : addHours(new Date(), 1);
        finalItinerary = [{
            id: `itin_${newPlanId}_0_${Date.now()}`,
            placeName: planDataForCreation.location,
            address: planDataForCreation.location, 
            city: planDataForCreation.city,
            description: "Main event location.",
            startTime: formatISO(mainEventTime),
            endTime: formatISO(addHours(mainEventTime, 2)),
            googleMapsImageUrl: `https://picsum.photos/seed/${encodeURIComponent(planDataForCreation.location)}/600/450`,
            rating: null,
            reviewCount: null,
            activitySuggestions: []
        }];
    }

    const eventTimeDate = planDataForCreation.eventTime && isValid(parseISO(planDataForCreation.eventTime))
                        ? parseISO(planDataForCreation.eventTime)
                        : new Date();

    const newPlan: Plan = {
      id: newPlanId,
      hostId,
      name: planDataForCreation.name, 
      description: planDataForCreation.description, 
      eventTime: formatISO(eventTimeDate),
      location: planDataForCreation.location || "", 
      city: planDataForCreation.city,
      eventType: planDataForCreation.eventType || undefined, 
      priceRange: planDataForCreation.priceRange || "",
      status: planDataForCreation.status,
      itinerary: finalItinerary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      invitedParticipantUserIds: planDataForCreation.invitedParticipantUserIds || [],
      planType: planDataForCreation.planType || "single-stop",
    };
    console.log("[createPlan] Final newPlan object before storage save:", JSON.stringify(newPlan, null, 2));

    // Store the plan using the shared storage
    const storedPlan = storePlan(newPlanId, {
      ...newPlan,
      eventTime: newPlan.eventTime,
      createdAt: newPlan.createdAt,
      updatedAt: newPlan.updatedAt,
    });
    
    if (!participantsDb[newPlanId]) {
      participantsDb[newPlanId] = [];
    }

    const hostProfile = userProfilesDb[hostId];
    if (hostProfile) {
      participantsDb[newPlanId].push({
        id: `part_${newPlanId}_host_${Date.now()}`,
        planId: newPlanId,
        userId: hostId,
        name: `${hostProfile.firstName} ${hostProfile.lastName}`, 
        confirmationStatus: "confirmed",
        avatarUrl: hostProfile.avatarUrl || `https://picsum.photos/seed/${hostId}/40/40`,
        preferences: generateComprehensivePreferencesForParticipant(hostId),
      });
    }

    if (planDataForCreation.invitedParticipantUserIds && planDataForCreation.invitedParticipantUserIds.length > 0) {
      planDataForCreation.invitedParticipantUserIds.forEach(userIdToInvite => {
        if (userIdToInvite === hostId) return; 

        const invitedUserProfile = userProfilesDb[userIdToInvite];
        if (invitedUserProfile) {
          participantsDb[newPlanId].push({
            id: `part_${newPlanId}_${userIdToInvite}_${Date.now()}`,
            planId: newPlanId,
            userId: userIdToInvite,
            name: `${invitedUserProfile.firstName} ${invitedUserProfile.lastName}`,
            confirmationStatus: "pending",
            avatarUrl: invitedUserProfile.avatarUrl || `https://picsum.photos/seed/${userIdToInvite}/40/40`,
            preferences: generateComprehensivePreferencesForParticipant(userIdToInvite),
          });
        }
      });
    }
    console.log("[createPlan] Plan creation successful, revalidating paths.");

    revalidatePath("/plans");
    revalidatePath(`/plans/${newPlanId}`);
    revalidatePath("/"); 
    return { success: true, data: storedPlan, message: "Plan created successfully!" };

  } catch (error) {
    console.error("[createPlan] UNHANDLED CRITICAL ERROR in createPlan:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error during plan creation.";
    return { success: false, message: `Server error: ${errorMessage}. Check server logs for details.` };
  }
}

export async function updatePlan(
  planId: string,
  data: Partial<z.infer<typeof planSchema>>
): Promise<{ success: boolean; message?: string; data?: any }> {
  console.log(`[updatePlan] Action started for planId ${planId} with data:`, JSON.stringify(data, null, 2));
  try {
    const plan = getStoredPlan(planId);
    if (!plan) {
      console.error(`[updatePlan] Plan not found: ${planId}`);
      return { success: false, message: "Plan not found." };
    }

    const validationResult = planSchema.partial().safeParse(data);
    if (!validationResult.success) {
        const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        console.error(`[updatePlan] Input validation failed for planId ${planId}:`, errorMessages);
        return { success: false, message: `Invalid plan data: ${errorMessages}` };
    }
    const validatedData = validationResult.data;

    const updatedPlanData: Plan = { 
      ...plan, 
      updatedAt: new Date().toISOString() 
    };

    if (validatedData.name !== undefined) updatedPlanData.name = validatedData.name;
    if (validatedData.description !== undefined) updatedPlanData.description = validatedData.description;
    if (validatedData.eventTime && isValid(parseISO(validatedData.eventTime))) {
      updatedPlanData.eventTime = validatedData.eventTime;
    } else if (validatedData.eventTime) {
        console.warn(`[updatePlan] Invalid eventTime format received: ${validatedData.eventTime}. Retaining original.`);
    }
    
    if (validatedData.eventType !== undefined) updatedPlanData.eventType = validatedData.eventType || undefined;
    if (validatedData.priceRange !== undefined) updatedPlanData.priceRange = validatedData.priceRange || "";
    if (validatedData.status !== undefined) updatedPlanData.status = validatedData.status;
    
    if (validatedData.itinerary && validatedData.itinerary.length > 0) {
        updatedPlanData.location = validatedData.itinerary[0].placeName;
        updatedPlanData.city = validatedData.itinerary[0].city || validatedData.city || "";
    } else { 
        if (validatedData.location !== undefined) updatedPlanData.location = validatedData.location || "";
        if (validatedData.city !== undefined) updatedPlanData.city = validatedData.city || "";
    }
    
    if (validatedData.itinerary !== undefined) {
      updatedPlanData.itinerary = validatedData.itinerary.map((item, index) => ({
        ...item,
        id: item.id || `itin_${planId}_${index}_${Date.now()}`, 
        startTime: item.startTime && isValid(parseISO(item.startTime)) ? formatISO(parseISO(item.startTime)) : null, 
        endTime: item.endTime && isValid(parseISO(item.endTime)) ? formatISO(parseISO(item.endTime)) : null,     
        googleMapsImageUrl: item.googleMapsImageUrl || `https://picsum.photos/seed/${encodeURIComponent(item.placeName || `itinerary_update_${index}`)}/400/225`,
        rating: item.rating !== undefined && item.rating !== null ? item.rating : undefined,
        reviewCount: item.reviewCount !== undefined && item.reviewCount !== null ? item.reviewCount : undefined,
        activitySuggestions: item.activitySuggestions || [],
      }));
    }
    console.log("[updatePlan] Final updatedPlanData object before storage save:", JSON.stringify(updatedPlanData, null, 2));

    // Store the updated plan using shared storage
    const storedPlan = storePlan(planId, updatedPlanData);
    console.log(`[updatePlan] Plan ${planId} updated successfully, revalidating paths.`);

    revalidatePath("/plans");
    revalidatePath(`/plans/${planId}`);
    return { success: true, data: storedPlan, message: "Plan updated successfully!" };

  } catch (error) {
    console.error(`[updatePlan] UNHANDLED CRITICAL ERROR for planId ${planId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error during plan update.";
    return { success: false, message: `Server error: ${errorMessage}. Check server logs for details.` };
  }
}

export async function deletePlan(
  planId: string
): Promise<{ success: boolean; message?: string }> {
  console.log(`[deletePlan] Action started for planId: ${planId}`);
  try {
    if (!getStoredPlan(planId)) {
      console.warn(`[deletePlan] Plan not found: ${planId}`);
      return { success: false, message: "Plan not found." };
    }

    // Remove the plan from storage
    storePlan(planId, null);

    if (participantsDb[planId]) {
      delete participantsDb[planId];
    }
    console.log(`[deletePlan] Plan ${planId} deleted successfully, revalidating paths.`);
    revalidatePath("/plans");
    revalidatePath("/"); 
    return { success: true, message: "Plan deleted successfully." };
  } catch (error) {
    console.error(`[deletePlan] UNHANDLED CRITICAL ERROR for planId ${planId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error during plan deletion.";
    return { success: false, message: `Server error: ${errorMessage}. Check server logs for details.` };
  }
}

export async function inviteParticipant(
  planId: string,
  userIdToInvite: string, 
  userName: string, 
  userAvatar?: string 
): Promise<{ success: boolean; message?: string; data?: Participant }> {
  console.log(`[inviteParticipant] Action started for planId ${planId}, userIdToInvite: ${userIdToInvite}`);
  try {
    if (!getStoredPlan(planId)) {
      console.warn(`[inviteParticipant] Plan not found: ${planId}`);
      return { success: false, message: "Plan not found." };
    }
    if (!participantsDb[planId]) {
      participantsDb[planId] = [];
    }

    const existingParticipant = participantsDb[planId].find(p => p.userId === userIdToInvite);
    if (existingParticipant) {
      console.warn(`[inviteParticipant] User ${userName} (${userIdToInvite}) is already a participant in plan ${planId}.`);
      return { success: false, message: `${userName} is already a participant.` };
    }

    const invitedUserProfile = userProfilesDb[userIdToInvite];
    if (!invitedUserProfile) {
        console.warn(`[inviteParticipant] User profile for ${userName} (${userIdToInvite}) not found.`);
        return { success: false, message: `User profile for ${userName} not found.` };
    }

    const newParticipant: Participant = {
      id: `part_${planId}_${userIdToInvite}_${Date.now()}`,
      planId,
      userId: userIdToInvite,
      name: `${invitedUserProfile.firstName} ${invitedUserProfile.lastName}`,
      confirmationStatus: "pending",
      avatarUrl: invitedUserProfile.avatarUrl || `https://picsum.photos/seed/${userIdToInvite}/40/40`,
      preferences: generateComprehensivePreferencesForParticipant(userIdToInvite)
    };
    participantsDb[planId].push(newParticipant);
    console.log(`[inviteParticipant] User ${newParticipant.name} invited successfully to plan ${planId}. Revalidating path.`);
    revalidatePath(`/plans/${planId}`);
    return { success: true, data: newParticipant, message: `${newParticipant.name} invited successfully!` };
  } catch (error) {
    console.error(`[inviteParticipant] UNHANDLED CRITICAL ERROR for planId ${planId}, userIdToInvite ${userIdToInvite}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error during invitation.";
    return { success: false, message: `Server error: ${errorMessage}. Check server logs for details.` };
  }
}

export async function updateParticipantStatus(
  planId: string,
  participantId: string, 
  status: 'confirmed' | 'declined'
): Promise<{ success: boolean; message?: string }> {
  console.log(`[updateParticipantStatus] Action started for planId ${planId}, participantId ${participantId}, status: ${status}`);
  try {
    if (!participantsDb[planId]) {
      console.warn(`[updateParticipantStatus] Plan or participants not found for planId: ${planId}`);
      return { success: false, message: "Plan or participants not found." };
    }
    const participantIndex = participantsDb[planId].findIndex(p => p.id === participantId);
    if (participantIndex === -1) {
      console.warn(`[updateParticipantStatus] Participant not found: ${participantId} in plan ${planId}`);
      return { success: false, message: "Participant not found." };
    }
    participantsDb[planId][participantIndex].confirmationStatus = status;
    console.log(`[updateParticipantStatus] Status for participant ${participantId} in plan ${planId} updated to ${status}. Revalidating path.`);
    revalidatePath(`/plans/${planId}`); 
    return { success: true, message: "Participant status updated." };
  } catch (error) {
    console.error(`[updateParticipantStatus] UNHANDLED CRITICAL ERROR for planId ${planId}, participantId ${participantId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error during status update.";
    return { success: false, message: `Server error: ${errorMessage}. Check server logs for details.` };
  }
}

export async function removeParticipant(
    planId: string,
    participantId: string 
): Promise<{ success: boolean; message?: string }> {
    console.log(`[removeParticipant] Action started for planId ${planId}, participantId ${participantId}`);
    try {
        if (!participantsDb[planId]) {
            console.warn(`[removeParticipant] Plan not found for planId: ${planId}`);
            return { success: false, message: "Plan not found." };
        }
        const initialLength = participantsDb[planId].length;
        participantsDb[planId] = participantsDb[planId].filter(p => p.id !== participantId);

        if (participantsDb[planId].length < initialLength) {
            console.log(`[removeParticipant] Participant ${participantId} removed from plan ${planId}. Revalidating path.`);
            revalidatePath(`/plans/${planId}`);
            return { success: true, message: "Participant removed." };
        } else {
            console.warn(`[removeParticipant] Participant not found to remove: ${participantId} in plan ${planId}`);
            return { success: false, message: "Participant not found to remove." };
        }
    } catch (error) {
        console.error(`[removeParticipant] UNHANDLED CRITICAL ERROR for planId ${planId}, participantId ${participantId}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error during participant removal.";
        return { success: false, message: `Server error: ${errorMessage}. Check server logs for details.` };
    }
}
