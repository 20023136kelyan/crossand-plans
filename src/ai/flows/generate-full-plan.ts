'use server';
/**
 * @fileOverview AI-powered full plan generator with standard place discovery.
 * Completely rewritten with a cleaner architecture based on the deep plan flow.
 * @exports generateFullPlan
 * @exports GenerateFullPlanInput
 */

import { z } from 'zod';
import { ai } from '../genkit';
import { webSearchTool, fetchPlaceDetailsTool } from '../tools';
import type { Plan, ItineraryItem, PriceRangeType } from '@/types/user';
import type { UserProfile } from '@/types/user';
import { generateUUID } from '@/lib/utils';
import { processAIGeneratedPlan } from '@/lib/planUtils';
import { formatISO, parseISO, isValid } from 'date-fns';
import { 
  GeneratePlanInputSchema, 
  PlanOutputSchema
} from '@/ai/schemas/shared';

// Define the input and output types for the plan generation flow
export type GenerateFullPlanInput = z.infer<typeof GeneratePlanInputSchema>;
export type GenerateFullPlanOutput = Plan;

// Note: Schema objects cannot be exported from 'use server' files
// Import GeneratePlanInputSchema and PlanOutputSchema directly from '@/ai/schemas/shared' if needed

/**
 * Helper function to ensure date strings have timezone information
 * @param dateStr The date string to process
 * @returns A properly formatted ISO date string with timezone
 */
function ensureDateHasTimezone(dateStr: string): string {
  if (!dateStr) return dateStr;
  
  // Check if dateStr already has timezone info
  if (dateStr.includes('Z') || dateStr.includes('+') || dateStr.includes('-', 10)) {
    return dateStr;
  }
  
  try {
    // Parse and reformat with timezone
    const date = parseISO(dateStr);
    if (!isValid(date)) {
      throw new Error(`Invalid date: ${dateStr}`);
    }
    return formatISO(date);
  } catch (error) {
    console.error(`[ensureDateHasTimezone] Error formatting date: ${dateStr}`, error);
    return dateStr; // Return original if parsing fails
  }
}

/**
 * Generate a complete plan with itinerary using AI
 * @param input Plan generation input parameters
 * @returns Generated plan with itinerary
 */
export async function generateFullPlan(input: GenerateFullPlanInput): Promise<Plan> {
  console.log('[generateFullPlan] Starting generation for prompt:', input.userPrompt);
  
  try {
    // Format input datetime for AI prompt
    let formattedDateTime = input.planDateTime;
    try {
      formattedDateTime = ensureDateHasTimezone(input.planDateTime);
    } catch (error) {
      console.warn('[generateFullPlan] Error formatting date, using original:', error);
    }

    // Prepare additional context parameters from user input
    const duration = input.userPrompt?.includes('hour') ? 
      '2-3 hours' : input.userPrompt?.includes('day') ? 
      'Full day' : '2-3 hours';
      
    const groupSize = String(
      input.invitedFriendProfiles?.length 
      ? input.invitedFriendProfiles.length + 1
      : 1
    );
    
    // Extract activity preferences from user profile
    const activityType = input.hostProfile?.activityTypePreferences?.length 
      ? input.hostProfile.activityTypePreferences[0] 
      : 'any';
      
    // Derive time of day from the plan datetime
    const planDate = new Date(formattedDateTime);
    const hour = planDate.getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    
    // Use budget information from profile or default to moderate
    const budget = input.hostProfile?.budgetFlexibilityNotes || 'moderate';
    
    // Use transportation preferences or default to walking
    const transportation = 'walking'; // Default to walking since preferredTransitModes doesn't exist in the schema
      
    // Calculate recommended stops for this plan
    const stopCountReasoning = calculateRecommendedStops(
      duration,
      groupSize,
      activityType,
      timeOfDay,
      budget,
      transportation
    );
    
    console.log('[generateFullPlan] Using parameters:', {
      formattedDateTime,
      duration,
      groupSize,
      activityType, 
      timeOfDay,
      budget,
      transportation,
      recommendedStops: stopCountReasoning.recommendedStops
    });

    // Create the AI prompt for plan generation
    console.log('[generateFullPlan] Calling AI prompt with input');
    
    // Define the prompt template 
      const generatePlanPrompt = ai.definePrompt({
      name: "generatePlanPrompt",
      description: "Generate a comprehensive plan based on user input",
        input: {
        schema: GeneratePlanInputSchema
        },
        output: {
        schema: PlanOutputSchema
      },
      prompt: `
You are creating a personalized plan for the user based on their input. This plan will include:
1. A detailed itinerary with carefully curated activities/venues
2. Timing and logistics for each stop
3. A compelling narrative that connects each activity

**GUIDELINES:**
- Create a plan that reflects the user's preferences and constraints.
- Include specific, actionable activities for each venue.
- Ensure geographic coherence - places should be close to each other.
- Provide sufficient detail for each stop (what to do, see, or eat).
- Include realistic timing that accounts for travel between places.
- Design the plan to fit within the specified duration, budget, and group size.
- **ACTIVITY SUGGESTIONS**: For each itinerary item's activitySuggestions, include relevant emojis to make them more engaging and visually appealing. Examples: "🍽️ Try their signature dishes", "📸 Take photos of the view", "🎭 Enjoy the live performance".

**USER PROFILE:**
${JSON.stringify(input.hostProfile, null, 2)}

${input.invitedFriendProfiles?.length ? `**INVITED FRIENDS:**
${JSON.stringify(input.invitedFriendProfiles, null, 2)}` : ''}

**REQUEST DETAILS:**
- User's Request: "${input.userPrompt}"
- Location: ${input.locationQuery}
- Date/Time: ${formattedDateTime}
- Duration: ${duration}
- Group Size: ${groupSize}
- Activity Type: ${activityType}
- Time of Day: ${timeOfDay}
- Budget: ${budget}
- Transportation: ${transportation}
- Recommended Number of Stops: ${stopCountReasoning.recommendedStops}

**CRITICAL: You MUST return a complete Plan object with all required fields. DO NOT return null or empty responses.**

**IMPORTANT DATE-TIME FORMATTING:**
All date and time fields MUST use ISO 8601 format WITH timezone information. Example: "2025-07-07T15:30:00-07:00" not "2025-07-07T15:30:00".
This applies to eventTime, startTime, endTime, createdAt, and updatedAt fields.

**CRITICAL ID FIELD HANDLING:**
DO NOT generate or include "id" fields in itinerary items. The system will automatically generate proper UUIDs for each itinerary item. Your itinerary items should NOT have an "id" field.

**IMPORTANT PLACE ID HANDLING:**
- Only include googlePlaceId if you obtained it from the fetchPlaceDetailsTool
- Do NOT make up or guess Place IDs
- If you don't have a valid Place ID from the tool, set googlePlaceId to null
- Place IDs must start with "ChIJ" to be valid

**RESPONSE FORMAT:**
You must return ONLY raw JSON without any markdown formatting. DO NOT wrap your response in code block tags.
`
    });

    // Execute the AI call with the prepared prompt and tools
    console.log('[generateFullPlan] Executing AI call');
    let result;
    let planData;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        result = await generatePlanPrompt(input, {
          model: 'googleai/gemini-2.5-pro',
          tools: [webSearchTool, fetchPlaceDetailsTool],
        });
        
        planData = result?.output;
        if (planData) {
          break; // Success, exit the retry loop
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`[generateFullPlan] AI returned null, retrying in 5 seconds... (attempt ${attempts + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        }
      } catch (error) {
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`[generateFullPlan] AI call failed, retrying in 5 seconds... (attempt ${attempts + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        } else {
          throw error;
        }
      }
    }
    
    if (!planData) {
      throw new Error('AI returned empty plan data after multiple attempts. Please try again.');
    }
    
    console.log('[generateFullPlan] Raw AI plan received, processing...');
    console.log('[generateFullPlan] Plan data type:', typeof planData);
    console.log('[generateFullPlan] Plan data:', planData);

    // Validate that planData is an object
    if (typeof planData !== 'object' || planData === null) {
      console.error('[generateFullPlan] Invalid plan data type:', typeof planData);
      throw new Error('AI returned invalid plan data format. Please try again.');
    }

    // Create a complete UserProfile object from the hostProfile with all required fields
    const userProfile: UserProfile = {
      uid: input.hostProfile.uid,
      name: input.hostProfile.name || null,
      username: null, // Not available in hostProfile schema
      name_lowercase: input.hostProfile.name ? input.hostProfile.name.toLowerCase() : null,
      email: null, // Not available in hostProfile schema
      bio: null,
      countryDialCode: null,
      phoneNumber: null,
      birthDate: null,
      physicalAddress: null,
      avatarUrl: null, // Not available in hostProfile schema
      allergies: input.hostProfile.allergies || [],
      dietaryRestrictions: input.hostProfile.dietaryRestrictions || [],
      generalPreferences: input.hostProfile.generalPreferences || '',
      favoriteCuisines: input.hostProfile.favoriteCuisines || [],
      physicalLimitations: input.hostProfile.physicalLimitations || [],
      activityTypePreferences: input.hostProfile.activityTypePreferences || [],
      activityTypeDislikes: input.hostProfile.activityTypeDislikes || [],
      environmentalSensitivities: input.hostProfile.environmentalSensitivities || [],
      preferredTransitModes: undefined, // Not available in hostProfile schema
      travelTolerance: input.hostProfile.travelTolerance || '',
      budgetFlexibilityNotes: input.hostProfile.budgetFlexibilityNotes || '',
      socialPreferences: input.hostProfile.socialPreferences || null,
      availabilityNotes: input.hostProfile.availabilityNotes || '',
      eventAttendanceScore: 0,
      levelTitle: 'Beginner',
      levelStars: 1,
      role: null,
      isVerified: false,
      followers: [],
      following: [],
      savedPlans: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preferences: input.hostProfile.preferences || []
    };

    // Validate required fields exist
    if (!planData.name || !planData.itinerary || !Array.isArray(planData.itinerary) || planData.itinerary.length === 0) {
      console.error('[generateFullPlan] Missing required fields in plan data:', {
        hasName: !!planData.name,
        hasItinerary: !!planData.itinerary,
        itineraryType: typeof planData.itinerary,
        itineraryLength: planData.itinerary?.length
      });
      throw new Error('AI returned incomplete plan data. Please try again.');
    }

    // Create the final plan object with all required fields
    const finalPlan: Plan = {
      id: generateUUID(), // Add required id field
      name: planData.name,
      status: planData.status || 'draft',
      priceRange: planData.priceRange,
      description: planData.description,
      eventTime: planData.eventTime,
      location: planData.location,
      city: planData.city,
      eventType: planData.eventType,
      eventTypeLowercase: planData.eventTypeLowercase,
      hostId: planData.hostId,
      invitedParticipantUserIds: planData.invitedParticipantUserIds || [],
      participantUserIds: planData.participantUserIds || [],
      itinerary: planData.itinerary.map((item, index) => {
        // Validate Google Place ID
        let validPlaceId = null;
        if (item.googlePlaceId) {
          if (typeof item.googlePlaceId === 'string' && item.googlePlaceId.startsWith('ChIJ')) {
            validPlaceId = item.googlePlaceId;
          } else {
            console.warn(`[generateFullPlan] Invalid Place ID detected for ${item.placeName}: ${item.googlePlaceId}`);
          }
        }

        return {
          ...item,
          id: generateUUID(), // Always generate a fresh UUID, ignoring any AI-generated id
          priceLevel: item.priceLevel ?? null, // Convert undefined to null for TypeScript compatibility
          googlePlaceId: validPlaceId // Only use validated Place IDs
        };
      }),
      planType: planData.planType,
      originalPlanId: planData.originalPlanId,
      sharedByUid: planData.sharedByUid,
      averageRating: planData.averageRating,
      reviewCount: planData.reviewCount,
      photoHighlights: planData.photoHighlights,
      images: [], // Add required images field
      comments: [], // Add required comments field
      participantResponses: planData.participantResponses,
      createdAt: planData.createdAt,
      updatedAt: planData.updatedAt,
      stopCountReasoning: planData.stopCountReasoning
    };

    // Additional validation and cleanup for Place IDs
    await validateAndCleanPlaceIds(finalPlan);

    // Process the plan with our post-processing utilities
    const processedPlanData = await processAIGeneratedPlan(
      finalPlan,
      input.planDateTime,
      userProfile,
      input.userPrompt
    );
    
    // Log any validation issues but don't fail
    if (processedPlanData.validationErrors.length > 0) {
      console.warn('[generateFullPlan] Plan validation warnings:', processedPlanData.validationErrors);
    }
    
    if (processedPlanData.warnings.length > 0) {
      console.info('[generateFullPlan] Plan minor warnings:', processedPlanData.warnings);
    }
    
    console.log('[generateFullPlan] Generation complete!');
    return processedPlanData.plan;
  } catch (error) {
    console.error('[generateFullPlan] Error generating plan:', error);
    throw error;
  }
}

/**
 * Validates and cleans Place IDs in a plan, removing invalid ones to prevent frontend errors
 * @param plan The plan to validate and clean
 */
async function validateAndCleanPlaceIds(plan: Plan): Promise<void> {
  console.log('[validateAndCleanPlaceIds] Validating Place IDs in plan...');
  
  let invalidCount = 0;
  let validCount = 0;
  
  plan.itinerary.forEach((item, index) => {
    if (item.googlePlaceId) {
      // Basic format validation - Google Place IDs should start with ChIJ
      if (typeof item.googlePlaceId === 'string' && item.googlePlaceId.startsWith('ChIJ')) {
        validCount++;
      } else {
        console.warn(`[validateAndCleanPlaceIds] Removing invalid Place ID for ${item.placeName}: ${item.googlePlaceId}`);
        item.googlePlaceId = null;
        invalidCount++;
      }
    }
  });
  
  console.log(`[validateAndCleanPlaceIds] Validation complete: ${validCount} valid, ${invalidCount} invalid Place IDs cleaned`);
}

/**
 * Calculate the recommended number of stops for a plan based on various factors
 * @param duration Duration of the plan
 * @param groupSize Size of the group
 * @param activityType Type of activity
 * @param timeOfDay Time of day
 * @param budget Budget level
 * @param transportation Transportation mode
 * @returns Object with recommended stops and reasoning factors
 */
function calculateRecommendedStops(
  duration: string,
  groupSize: string,
  activityType: string,
  timeOfDay: string,
  budget: string,
  transportation: string
): { recommendedStops: number, factors: Record<string, string>, explanation: string } {
  // Initialize base values
  let baseStopCount = 3;
  const factors: Record<string, string> = {};
  
  // Duration factor
  if (duration.toLowerCase().includes('full day')) {
    baseStopCount += 2;
    factors.duration = 'Full day allows for more stops';
  } else if (duration.toLowerCase().includes('half day')) {
    baseStopCount += 0;
    factors.duration = 'Half day is good for standard stop count';
    } else {
    // Assume shorter duration
    baseStopCount -= 1;
    factors.duration = 'Short duration means fewer stops';
  }
  
  // Group size factor
  const numPeople = parseInt(groupSize) || 1;
  if (numPeople >= 5) {
    baseStopCount -= 1;
    factors.groupSize = 'Large groups move slower between venues';
  } else if (numPeople <= 2) {
    baseStopCount += 1;
    factors.groupSize = 'Small groups can move efficiently between venues';
  } else {
    factors.groupSize = 'Medium-sized group has no special impact on stop count';
  }
  
  // Activity type factor
  const activityLower = activityType.toLowerCase();
  if (activityLower.includes('dining') || activityLower.includes('food')) {
    baseStopCount -= 1;
    factors.activityType = 'Dining activities tend to take longer at each stop';
  } else if (activityLower.includes('sightseeing') || activityLower.includes('tour')) {
    baseStopCount += 1;
    factors.activityType = 'Sightseeing can accommodate more quick stops';
    } else {
    factors.activityType = 'Activity type has no special impact on stop count';
  }
  
  // Transportation factor
  if (transportation.toLowerCase().includes('walk')) {
    if (duration.toLowerCase().includes('full day')) {
      // No change for full day
      factors.transportation = 'Walking for a full day allows for several stops in a walkable area';
    } else {
      baseStopCount -= 1;
      factors.transportation = 'Walking limits range for shorter durations';
    }
  } else if (transportation.toLowerCase().includes('car') || transportation.toLowerCase().includes('driving')) {
    baseStopCount += 1;
    factors.transportation = 'Driving allows for more distant venues';
  } else if (transportation.toLowerCase().includes('public')) {
    // No change
    factors.transportation = 'Public transit is moderately efficient for moving between venues';
    } else {
    factors.transportation = 'Transportation mode has no special impact on stop count';
  }
  
  // Ensure we don't go below 1 or above 7 stops
  let finalStopCount = Math.max(1, Math.min(7, baseStopCount));
  
  // Create explanation
  const explanation = `Based on a ${duration} plan for ${groupSize} people using ${transportation} for ${activityType} activities during the ${timeOfDay}, I recommend ${finalStopCount} stops. ${Object.values(factors).join('. ')}.`;

  return {
    recommendedStops: finalStopCount,
    factors,
    explanation
  };
}
