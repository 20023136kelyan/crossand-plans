import { z } from 'zod';
import { planSchema } from '@/lib/schemas';
import type { Plan, PlanStatus, ItineraryItem } from '@/types';

// Define the type for a stored plan based on the schema
type StoredPlan = Plan;

// Determine if we're in the browser
const isBrowser = typeof window !== 'undefined';

// In-memory storage for plans (used on server-side)
const serverPlans: Record<string, StoredPlan> = {};

// Helper to get all plans
function getPlansFromStorage(): Record<string, StoredPlan> {
  if (isBrowser) {
    const stored = localStorage.getItem('plans');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed;
    }
    return {};
  }
  return serverPlans;
}

// Helper to save plans to storage
function savePlansToStorage(plans: Record<string, StoredPlan>) {
  if (isBrowser) {
    localStorage.setItem('plans', JSON.stringify(plans));
  } else {
    Object.assign(serverPlans, plans);
  }
}

// Helper to ensure all required fields are present in an itinerary item
export function ensureRequiredItineraryFields(item: Partial<ItineraryItem>): ItineraryItem {
  return {
    id: item.id || `itin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    placeName: item.placeName || "",
    address: item.address || "",
    city: item.city || null,
    description: item.description || null,
    startTime: item.startTime || null,
    endTime: item.endTime || null,
    googleMapsImageUrl: item.googleMapsImageUrl || null,
    rating: item.rating || null,
    reviewCount: item.reviewCount || null,
    activitySuggestions: item.activitySuggestions || null,
  };
}

export function storePlan(id: string, plan: StoredPlan | null): StoredPlan | null {
  // Get current plans
  const plans = getPlansFromStorage();
  
  if (plan === null) {
    // Handle deletion
    const deletedPlan = plans[id];
    delete plans[id];
    savePlansToStorage(plans);
    return deletedPlan || null;
  }

  // Validate the plan data against the schema
  const validatedPlan = planSchema.parse({
    ...plan,
    // Ensure required fields are present
    id,
    hostId: plan.hostId,
    location: plan.location,
    city: plan.city,
    priceRange: plan.priceRange,
    status: plan.status,
    eventType: plan.eventType || "",
    invitedParticipantUserIds: plan.invitedParticipantUserIds,
    planType: plan.planType,
    // Ensure itinerary items have all required fields
    itinerary: (plan.itinerary || []).map(ensureRequiredItineraryFields),
  });
  
  // Store with the provided ID
  const storedPlan: StoredPlan = {
    ...plan,
    ...validatedPlan,
    id,
    hostId: plan.hostId,
    location: validatedPlan.location,
    city: validatedPlan.city,
    priceRange: validatedPlan.priceRange,
    status: validatedPlan.status as PlanStatus,
    eventType: validatedPlan.eventType,
    invitedParticipantUserIds: validatedPlan.invitedParticipantUserIds,
    planType: validatedPlan.planType,
    selectedPoint: validatedPlan.selectedPoint,
    mapRadiusKm: validatedPlan.mapRadiusKm,
    userEnteredCityForStep2: validatedPlan.userEnteredCityForStep2,
    itinerary: validatedPlan.itinerary.map(ensureRequiredItineraryFields),
  };
  
  plans[id] = storedPlan;
  savePlansToStorage(plans);
  return storedPlan;
}

export function getPlan(id: string): StoredPlan | undefined {
  const plans = getPlansFromStorage();
  return plans[id];
}

export function getAllPlans(): Record<string, StoredPlan> {
  return getPlansFromStorage();
}

// Helper to update specific fields of a plan
export function updatePlan(id: string, updates: Partial<StoredPlan>): StoredPlan | undefined {
  const plans = getPlansFromStorage();
  const existingPlan = plans[id];
  
  if (!existingPlan) {
    return undefined;
  }

  const updatedPlan = {
    ...existingPlan,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Validate the updated plan
  const validatedPlan = planSchema.parse({
    ...updatedPlan,
    // Ensure required fields are present
    id,
    hostId: updatedPlan.hostId,
    location: updatedPlan.location,
    city: updatedPlan.city,
    priceRange: updatedPlan.priceRange,
    status: updatedPlan.status,
    eventType: updatedPlan.eventType || "",
    invitedParticipantUserIds: updatedPlan.invitedParticipantUserIds,
    planType: updatedPlan.planType,
    // Ensure itinerary items have all required fields
    itinerary: (updatedPlan.itinerary || []).map(ensureRequiredItineraryFields),
  });

  const storedPlan: StoredPlan = {
    ...updatedPlan,
    ...validatedPlan,
    id,
    hostId: updatedPlan.hostId,
    location: validatedPlan.location,
    city: validatedPlan.city,
    priceRange: validatedPlan.priceRange,
    status: validatedPlan.status as PlanStatus,
    eventType: validatedPlan.eventType,
    invitedParticipantUserIds: validatedPlan.invitedParticipantUserIds,
    planType: validatedPlan.planType,
    selectedPoint: validatedPlan.selectedPoint,
    mapRadiusKm: validatedPlan.mapRadiusKm,
    userEnteredCityForStep2: validatedPlan.userEnteredCityForStep2,
    itinerary: validatedPlan.itinerary.map(ensureRequiredItineraryFields),
  };
  
  plans[id] = storedPlan;
  savePlansToStorage(plans);
  return storedPlan;
} 