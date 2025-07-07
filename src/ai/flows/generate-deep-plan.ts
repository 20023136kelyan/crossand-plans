'use server';
/**
 * @fileOverview AI-powered deep plan generator with an agentic, research-first approach.
 * This flow mimics a human researcher by first discovering a venue, then conducting
 * targeted web research on it, and only then generating specific, informed activity suggestions.
 * @exports generateDeepPlan
 */

import { z } from 'zod';
import { ai } from '../genkit';
import { deepPlaceDiscoveryTool, validateAndEnrichPlaceTool, exaSearchTool } from '../tools';
import type { Plan, ItineraryItem, PriceRangeType } from '@/types/plan';
import type { UserProfile } from '@/types/user';
import { generateUUID } from '@/lib/utils';
import { processAIGeneratedPlan } from '@/lib/planUtils';

// Define the structured inputs and outputs for the AI flow

const GenerateDeepPlanInputSchema = z.object({
  userProfile: z.custom<UserProfile>(),
  invitedFriendProfiles: z.array(z.custom<UserProfile>()).optional(),
  locationQuery: z.string(),
  planDateTime: z.string(),
  userPrompt: z.string(),
  priceRange: z.custom<PriceRangeType>().optional(),
  planTypeHint: z.enum(['ai-decide', 'single-stop', 'multi-stop']),
  timezone: z.string().optional(),
});

export type GenerateDeepPlanInput = z.infer<typeof GenerateDeepPlanInputSchema>;
export type GenerateDeepPlanOutput = Plan;

// Define the schemas for the AI agent's internal thought process

const ItineraryItemSketchSchema = z.object({
  placeName: z.string().describe('The official name of the venue.'),
  city: z.string().describe('The city where the venue is located.'),
  reasoning: z.string().describe('A compelling, one-sentence explanation of why this venue was chosen for the user.'),
  placeSearchQuery: z.string().describe("A precise Google Places search query to find this exact place (e.g., 'Van Gogh Museum, Amsterdam, Netherlands')."),
  activitySuggestions: z.array(z.string()).describe('A list of 2-3 specific, creative, and actionable activity suggestions based on online research.'),
  reservationRecommended: z.boolean().optional().describe('Set to true if research indicates reservations are needed or recommended.'),
  bookingLink: z.string().url().nullable().optional().describe('A direct booking or reservation link, if found.'),
});

const DeepPlanSketchSchema = z.object({
  planName: z.string().describe('A creative and fitting name for the plan.'),
  planDescription: z.string().describe('A brief, one-sentence description of the plan.'),
  itinerary: z.array(
    z.object({
      placeName: z.string().describe("The name of the venue or point of interest."),
      city: z.string().describe("The city where the place is located, extracted from the user's location query."),
      reasoning: z.string().describe("A compelling, narrative-driven reason for why this specific place was chosen, connecting it to the user's preferences."),
      placeSearchQuery: z.string().describe("A precise Google Places search query to find this exact place (e.g., 'Van Gogh Museum, Amsterdam, Netherlands')."),
      activitySuggestions: z.array(z.string()).describe("A list of 3 specific and creative activities. Each suggestion MUST begin with a relevant emoji."),
      reservationRecommended: z.boolean().optional().describe('Set to true if web research indicates reservations are recommended or required.'),
      bookingLink: z.string().url().nullable().optional().describe('The direct URL for reservations or ticket booking, if found.'),
    })
  ).describe('A sequence of 2 to 5 cohesive and non-repetitive itinerary stops that create a compelling narrative or experience.'),
});

/**
 * The main entry point for the deep plan generation flow.
 * This function orchestrates the agentic process of discovery, research, validation, and assembly.
 */
export async function generateDeepPlan(input: GenerateDeepPlanInput): Promise<GenerateDeepPlanOutput> {
  console.log('[Deep Plan Agent] Starting generation for prompt:', input.userPrompt);

  // Consolidate all user preferences for the AI context.
  const allProfiles = [input.userProfile, ...(input.invitedFriendProfiles || [])];
  const preferencesSummary = allProfiles.map(p => `
- Name: ${p.name}
- Preferences: ${p.preferences?.join(', ') || 'Not specified'}
- Allergies: ${p.allergies?.join(', ') || 'None'}
- Dietary Restrictions: ${p.dietaryRestrictions?.join(', ') || 'None'}
- Favorite Cuisines: ${p.favoriteCuisines?.join(', ') || 'None'}
- Activity Dislikes: ${p.activityTypeDislikes?.join(', ') || 'None'}
- Physical Limitations: ${p.physicalLimitations?.join(', ') || 'None'}
- Environmental Sensitivities: ${p.environmentalSensitivities?.join(', ') || 'None'}
`).join('\n');

  // Phase 1 & 2: Discovery, Research, and Itinerary Sketch
  // The AI uses tools to find places, research them, and then sketch a plan.
  const discoveryFlow = await ai.generate({
    model: 'googleai/gemini-2.5-pro',
    tools: [deepPlaceDiscoveryTool, exaSearchTool],
    prompt: `
      You are an expert local guide and creative event planner.

      **Primary Goal**: Your primary goal is to design a cohesive, compelling, and non-repetitive itinerary that tells a story and creates a memorable experience based on the user's request.

      **CRITICAL RESEARCH TASK:** For each venue you select, you MUST use the \`exaSearchTool\` to find its official website. Search that website for information about reservations or tickets. If reservations are recommended or required, you MUST set \`reservationRecommended\` to true. If you find a direct link for booking, you MUST provide it in the \`bookingLink\` field.

      Your process for each itinerary stop is critical:
      1.  **Discover a Venue**: Use the \`deepPlace-discovery\` to find a potential venue that fits the user's request and profile.
      2.  **Conduct Research**: CRITICAL STEP. Once you have a venue name, use the \`exaSearchTool\` with a precise query (e.g., "Blue Bottle Coffee menu NYC" or "special exhibits at MoMA") to find specific, real-world details about it. Look for signature dishes, current events, unique features, or what makes it special.
      3.  **Generate Suggestions**: Based on your research from the search tool, create 2-3 specific, creative, and actionable \`suggestedActivities\`. DO NOT use generic suggestions. Your suggestions must be directly informed by the information you found online.
      4.  **Assemble the Stop**: Combine the venue name, your reasoning, the search query you used, and your research-backed suggestions into a single itinerary item.
      5.  **Repeat**: Repeat this process for 2 to 5 stops to build a full, cohesive plan.

      **USER & PLAN DETAILS:**
      - **User Prompt**: "${input.userPrompt}"
      - **Location**: "${input.locationQuery}"
      - **Date/Time**: "${input.planDateTime}" (Timezone: ${input.timezone || 'Not specified'}). This is a strict requirement. The plan MUST start at this time. All activities and the plan's name must be appropriate for this time.
      - **Price Preference**: "${input.priceRange || 'Not specified'}"
      - **Plan Structure**: "${input.planTypeHint}"
      - **Participant Profiles**:
        ${preferencesSummary}
      `,
    output: {
      schema: DeepPlanSketchSchema,
    },
    toolChoice: 'auto',
  });

  const discoveredItinerary = discoveryFlow.output;
  if (!discoveredItinerary) {
    throw new Error('Deep discovery phase failed to produce a plan sketch.');
  }
  console.log('[Deep Plan Agent] Generated plan sketch:', JSON.stringify(discoveredItinerary, null, 2));


  // Phase 3: Validation, Enrichment, and Self-Correction
  // The agent validates each stop and attempts to find replacements for non-operational venues.
  const enrichedItineraryItems: ItineraryItem[] = [];
  const MAX_RETRIES_PER_ITEM = 2;

  for (const initialItem of discoveredItinerary.itinerary) {
    let currentItem = initialItem;
    let successful = false;

    for (let attempt = 0; attempt < MAX_RETRIES_PER_ITEM; attempt++) {
      try {
        const validationResult = await validateAndEnrichPlaceTool({
          placeName: currentItem.placeName,
          city: currentItem.city,
        });

        if (validationResult.success && validationResult.isValid && validationResult.placeDetails && validationResult.placeDetails.isOperational !== false) {
          const { placeDetails } = validationResult;
          enrichedItineraryItems.push({
            id: generateUUID(),
            placeName: placeDetails.name || currentItem.placeName,
            description: currentItem.reasoning,
            address: placeDetails.address,
            googlePlaceId: placeDetails.placeId,
            city: currentItem.city,
            rating: placeDetails.rating,
            reviewCount: placeDetails.reviewCount,
            priceLevel: placeDetails.priceLevel,
            types: placeDetails.types,
            activitySuggestions: currentItem.activitySuggestions,
            googlePhotoReference: placeDetails.photoReference,
            reservationRecommended: currentItem.reservationRecommended,
            bookingLink: currentItem.bookingLink,
            isOperational: placeDetails.isOperational,
            openingHours: placeDetails.openingHours,
            lat: placeDetails.lat,
            lng: placeDetails.lng,
            // Set remaining required fields to null or default values
            googleMapsImageUrl: null,
            tagline: null,
            startTime: null,
            endTime: null,
            durationMinutes: null,
            transitMode: null,
            notes: null,
            statusText: null,
            website: placeDetails.website,
            phoneNumber: placeDetails.phoneNumber,
            utcOffsetMinutes: placeDetails.utcOffsetMinutes,
          } as ItineraryItem);
          successful = true;
          break; // Success, break from retry loop
        } else {
          const reason = validationResult.placeDetails?.isOperational === false ? 'it is not operational' : `validation failed (${validationResult.error || 'unknown reason'})`;
          console.warn(`[Deep Plan Agent] Venue "${currentItem.placeName}" is invalid because ${reason}. Attempt ${attempt + 1} of ${MAX_RETRIES_PER_ITEM}.`);

          if (attempt < MAX_RETRIES_PER_ITEM - 1) {
            console.log(`[Deep Plan Agent] Requesting a replacement...`);
            const replacementFlow = await ai.generate({
              model: 'googleai/gemini-2.5-pro',
              tools: [deepPlaceDiscoveryTool, exaSearchTool], // Provide research tools
              prompt: `The previous venue suggestion, "${currentItem.placeName}", is not suitable. Please find a different venue in "${currentItem.city}" that matches the original user request: "${input.userPrompt}". Do not suggest "${currentItem.placeName}" again. You must use your tools to research and suggest a valid, operational venue.`,
              output: { schema: ItineraryItemSketchSchema },
            });
            const newSuggestion = replacementFlow.output;
            if (newSuggestion) {
              currentItem = newSuggestion;
            } else {
              console.error(`[Deep Plan Agent] AI failed to generate a replacement suggestion for "${initialItem.placeName}".`);
              // Break the inner loop to stop trying for this item
              break;
            }
          } else {
            console.error(`[Deep Plan Agent] Failed to find a valid replacement for "${initialItem.placeName}" after ${MAX_RETRIES_PER_ITEM} attempts.`);
          }
        }
      } catch (error) {
        console.error(`[Deep Plan Agent] An unexpected error occurred during validation for "${currentItem.placeName}":`, error);
        break; // Stop retrying for this item on unexpected errors
      }
    }
  }

  if (enrichedItineraryItems.length === 0) {
    throw new Error("Failed to validate and enrich any itinerary stops. The plan could not be created.");
  }


  // Phase 4: Final Assembly
  // Assemble the final plan object.
  const finalPlan: Plan = {
    id: generateUUID(),
    name: discoveredItinerary.planName,
    description: discoveredItinerary.planDescription,
    eventTime: new Date(input.planDateTime).toISOString(),
    hostId: input.userProfile.uid,
    participantUserIds: input.invitedFriendProfiles?.map(p => p.uid) || [],
    location: input.locationQuery,
    city: input.locationQuery.split(',')[0].trim(),
    itinerary: enrichedItineraryItems,
    priceRange: input.priceRange || 'Free',
    planType: enrichedItineraryItems.length > 1 ? 'multi-stop' : 'single-stop',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    eventType: 'custom',
    eventTypeLowercase: 'custom',
    averageRating: 0,
    reviewCount: 0,
    isTemplate: false,
    sharedByUid: null,
    originalPlanId: null,
    photoHighlights: [],
    invitedParticipantUserIds: [],
    participantResponses: {},
    stopCountReasoning: null,
    coordinates: undefined,
  };

  // Process the plan to ensure data consistency
  const { plan: processedPlan, validationErrors, warnings } = await processAIGeneratedPlan(finalPlan, input.planDateTime, input.userProfile, input.userPrompt);

  if (validationErrors.length > 0) {
    console.error('[Deep Plan Agent] Validation errors during processing:', validationErrors);
    // For now, we'll throw an error to halt execution on validation failure.
    throw new Error(`Plan validation failed: ${validationErrors.join(', ')}`);
  }
  if (warnings.length > 0) {
    console.warn('[Deep Plan Agent] Warnings during processing:', warnings);
  }

  console.log('[Deep Plan Agent] Generation complete. Final plan:', JSON.stringify(processedPlan, null, 2));
  return processedPlan;
}