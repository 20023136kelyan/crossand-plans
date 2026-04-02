"use server";

import { generateEventSuggestions, type GenerateEventSuggestionsInput, type GenerateEventSuggestionsOutput } from "@/ai/flows/generate-event-suggestions";
import { 
  suggestionRequestSchema, 
  type SuggestionRequestValues,
  GenerateItineraryItemDetailsInputSchema 
} from "@/lib/schemas";

import { generatePlanName, type GeneratePlanNameInput, type GeneratePlanNameOutput } from "@/ai/flows/generate-plan-name";
import { generatePlanDescription, type GeneratePlanDescriptionInput, type GeneratePlanDescriptionOutput } from "@/ai/flows/generate-plan-description";
import { generatePlanEventType, type GeneratePlanEventTypeInput, type GeneratePlanEventTypeOutput } from "@/ai/flows/generate-plan-event-type";
import { generatePlanLocation, type GeneratePlanLocationInput, type GeneratePlanLocationOutput } from "@/ai/flows/generate-plan-location";
import { generatePlanPriceRange, type GeneratePlanPriceRangeInput, type GeneratePlanPriceRangeOutput } from "@/ai/flows/generate-plan-price-range";
import { generateFullPlanDetailsFlow } from "@/ai/flows/generate-full-plan-details";
import type { GenerateFullPlanDetailsInput, GenerateFullPlanDetailsOutput } from "@/ai/flows/plan-types";
import { generateItineraryItemDetails, type GenerateItineraryItemDetailsInput, type GenerateItineraryItemDetailsOutput } from "@/ai/flows/generate-itinerary-item-details";

export async function getAISuggestions(
  input: SuggestionRequestValues
): Promise<{ success: boolean; message?: string; data?: GenerateEventSuggestionsOutput }> {
  console.log("[getAISuggestions] Action started with input:", JSON.stringify(input, null, 2));
  try {
    const aiInput: GenerateEventSuggestionsInput = {
      city: input.city,
      time: input.time,
      planDescription: input.planDescription,
      friendPreferences: input.friendPreferences || [],
    };
    
    const suggestions = await generateEventSuggestions(aiInput);
    console.log("[getAISuggestions] AI suggestions result:", JSON.stringify(suggestions, null, 2));

    if (suggestions && suggestions.suggestions && suggestions.suggestions.length > 0) {
      return { success: true, data: suggestions };
    } else {
      return { success: false, message: "AI couldn't generate suggestions for this plan. Try refining your inputs." };
    }
  } catch (error) {
    console.error("[getAISuggestions] Error getting AI suggestions:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred while generating suggestions.";
    return { success: false, message: `Server error: ${errorMessage}. Check server logs.` };
  }
}

export async function getAIPlanName(
  input: GeneratePlanNameInput
): Promise<{ success: boolean; message?: string; data?: GeneratePlanNameOutput }> {
  console.log("[getAIPlanName] Action started with input:", JSON.stringify(input, null, 2));
  try {
    const result = await generatePlanName(input);
    console.log("[getAIPlanName] AI plan name result:", JSON.stringify(result, null, 2));
    return { success: true, data: result };
  } catch (error) {
    console.error("[getAIPlanName] Error generating AI plan name:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate plan name.";
    return { success: false, message: `Server error: ${errorMessage}. Check server logs.` };
  }
}

export async function getAIPlanDescription(
  input: GeneratePlanDescriptionInput 
): Promise<{ success: boolean; message?: string; data?: GeneratePlanDescriptionOutput }> {
  console.log("[getAIPlanDescription] Action started with input:", JSON.stringify(input, null, 2));
  try {
    const result = await generatePlanDescription(input);
    console.log("[getAIPlanDescription] AI plan description result:", JSON.stringify(result, null, 2));
    return { success: true, data: result };
  } catch (error) {
    console.error("[getAIPlanDescription] Error generating AI plan description:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate plan description.";
    return { success: false, message: `Server error: ${errorMessage}. Check server logs.` };
  }
}

export async function getAIPlanEventType(
  input: GeneratePlanEventTypeInput
): Promise<{ success: boolean; message?: string; data?: GeneratePlanEventTypeOutput }> {
  console.log("[getAIPlanEventType] Action started with input:", JSON.stringify(input, null, 2));
  try {
    const result = await generatePlanEventType(input);
    console.log("[getAIPlanEventType] AI plan event type result:", JSON.stringify(result, null, 2));
    return { success: true, data: result };
  } catch (error) {
    console.error("[getAIPlanEventType] Error generating AI plan event type:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate plan event type.";
    return { success: false, message: `Server error: ${errorMessage}. Check server logs.` };
  }
}

export async function getAIPlanLocation(
  input: GeneratePlanLocationInput
): Promise<{ success: boolean; message?: string; data?: GeneratePlanLocationOutput }> {
  console.log("[getAIPlanLocation] Action started with input:", JSON.stringify(input, null, 2));
  try {
    const result = await generatePlanLocation(input);
    console.log("[getAIPlanLocation] AI plan location result:", JSON.stringify(result, null, 2));
    return { success: true, data: result };
  } catch (error) {
    console.error("[getAIPlanLocation] Error generating AI plan location:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate plan location.";
    return { success: false, message: `Server error: ${errorMessage}. Check server logs.` };
  }
}

export async function getAIPlanPriceRange(
  input: GeneratePlanPriceRangeInput
): Promise<{ success: boolean; message?: string; data?: GeneratePlanPriceRangeOutput }> {
  console.log("[getAIPlanPriceRange] Action started with input:", JSON.stringify(input, null, 2));
  try {
    const result = await generatePlanPriceRange(input);
    console.log("[getAIPlanPriceRange] AI plan price range result:", JSON.stringify(result, null, 2));
    return { success: true, data: result };
  } catch (error) {
    console.error("[getAIPlanPriceRange] Error generating AI plan price range:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate plan price range.";
    return { success: false, message: `Server error: ${errorMessage}. Check server logs.` };
  }
}

export async function getAIFullPlanDetails(
  input: GenerateFullPlanDetailsInput 
): Promise<{ success: boolean; message?: string; data?: GenerateFullPlanDetailsOutput }> {
  console.log("[getAIFullPlanDetails] Action started with input:", JSON.stringify(input, null, 2));
  try {
    const inputWithPlanType: GenerateFullPlanDetailsInput = {
      ...input,
      planType: input.planType || 'single-stop',
    };
    const result = await generateFullPlanDetailsFlow(inputWithPlanType);
    console.log("[getAIFullPlanDetails] AI full plan details result:", JSON.stringify(result, null, 2));
    return { success: true, data: result };
  } catch (error) {
    console.error("[getAIFullPlanDetails] Error generating full AI plan details:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate full plan details.";
    return { success: false, message: `AI plan generation failed: ${errorMessage}` };
  }
}

export async function getAIItineraryItemDetails(
  input: GenerateItineraryItemDetailsInput
): Promise<{ success: boolean; message?: string; data?: GenerateItineraryItemDetailsOutput }> {
  console.log("[getAIItineraryItemDetails] Action started with input:", JSON.stringify(input, null, 2));
  const validatedInput = GenerateItineraryItemDetailsInputSchema.safeParse(input);
  if(!validatedInput.success) {
    const errorMessages = Object.entries(validatedInput.error.flatten().fieldErrors)
      .map(([field, errors]) => `${field}: ${errors?.join(', ')}`)
      .join('; ');
    console.error("[getAIItineraryItemDetails] Invalid input:", errorMessages);
    return { success: false, message: `Invalid input for generating itinerary item details: ${errorMessages}`};
  }
  try {
    const result = await generateItineraryItemDetails(validatedInput.data);
    console.log("[getAIItineraryItemDetails] AI itinerary item details result:", JSON.stringify(result, null, 2));
    return { success: true, data: result };
  } catch (error) {
    console.error("[getAIItineraryItemDetails] Error generating AI itinerary item details:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate itinerary item details.";
    return { success: false, message: `Server error: ${errorMessage}. Check server logs.` };
  }
}

export async function generatePlan(input: GenerateFullPlanDetailsInput) {
  try {
    if (!input.userEnteredCity) {
      throw new Error('City is required');
    }
    if (!input.priceRange) {
      throw new Error('Price range is required');
    }

    const plan = await generateFullPlanDetailsFlow(input);

    return {
      name: plan.name,
      description: plan.description,
      eventType: plan.eventType,
      itinerary: plan.venues.map(venue => ({
        placeName: venue.placeName,
        description: venue.description,
        activitySuggestions: venue.activitySuggestions,
        suggestedOrder: venue.suggestedOrder,
        suggestedDuration: venue.suggestedDuration,
        status: venue.status,
      })),
      city: plan.city,
      eventTime: input.userSuggestedEventTime,
      priceRange: plan.priceRange,
      location: plan.location || plan.itinerary[0]?.placeName || '',
    };
  } catch (error) {
    console.error('Error generating plan:', error);
    throw error;
  }
}
