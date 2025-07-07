/**
 * @fileOverview AI-powered full plan generator with standard place discovery.
 * Completely rewritten with a cleaner architecture based on the deep plan flow.
 * @exports generateFullPlan
 * @exports GenerateFullPlanInput
 */

import { z } from 'zod';
import { ai } from '../genkit';
import { findPlacesNearbyTool, fetchPlaceDetailsTool } from '../tools';
import type { Plan, ItineraryItem, PriceRangeType } from '@/types/user';
import type { UserProfile } from '@/types/user';
import { generateUUID } from '@/lib/utils';
import { processAIGeneratedPlan } from '@/lib/planUtils';
import { formatISO, parseISO, isValid } from 'date-fns';
import { 
  GeneratePlanInputSchema, 
  PlanOutputSchema,
  ItineraryItemSchema
} from '@/ai/schemas/shared';

// Define the input and output types for the plan generation flow
export type GenerateFullPlanInput = z.infer<typeof GeneratePlanInputSchema>;
export type GenerateFullPlanOutput = Plan;

// Export the schemas for external use
export const GenerateFullPlanInput = GeneratePlanInputSchema;
export const GenerateFullPlanOutput = PlanOutputSchema;

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
    
    // Prioritize user-set price range, then fall back to profile budget preferences
    const budget = input.priceRange 
      ? input.priceRange // Use explicitly set price range if available
      : input.hostProfile?.budgetFlexibilityNotes || 'moderate';
    
    // Use transportation preferences or default to walking
    const transportation = (input.hostProfile as any)?.preferredTransitModes?.length 
      ? (input.hostProfile as any).preferredTransitModes[0]
      : 'walking';
      
    // Calculate recommended stops for this plan
    const stopCountReasoning = calculateRecommendedStops(
      duration,
      groupSize,
      activityType,
      timeOfDay,
      budget,
      transportation,
      input.planTypeHint // Pass user-set plan type hint to prioritize it
    );
    
    console.log('[generateFullPlan] Using parameters:', {
      formattedDateTime,
      duration,
      groupSize,
      activityType, 
      timeOfDay,
      budget,
      transportation,
      planTypeHint: input.planTypeHint || 'ai-decide',
      priceRange: input.priceRange,
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

**Activity Suggestions:**
For each itinerary item, include 2-3 activity suggestions in the activitySuggestions array. EACH suggestion MUST begin with a relevant emoji followed by a space, then a brief, creative activity suggestion. For example: "🍷 Sample local wines", "🤳 Take selfies with the skyline view", "🧘‍♀️ Join a meditation session".

**RESPONSE FORMAT:**
You must return ONLY raw JSON without any markdown formatting. DO NOT wrap your response in code block tags.
`
    });

    // Create a custom itinerary item schema that doesn't require UUID validation for the ID field
    const ItineraryItemSchemaWithoutUUIDValidation = ItineraryItemSchema.extend({
      // Override the id field to accept any string, not just UUIDs
      id: z.string().optional(),
      // Override activitySuggestions to explicitly require emoji-prefixed suggestions
      activitySuggestions: z.array(z.string()).nullable().describe("A list of 2-3 specific and creative activities. Each suggestion MUST begin with a relevant emoji.")
    });
    
    // Use the original PlanOutputSchema but replace the itinerary validation
    const CustomPlanOutputSchema = PlanOutputSchema.extend({
      // Replace only the itinerary field with our more permissive version
      itinerary: z.array(ItineraryItemSchemaWithoutUUIDValidation)
    });

    // Execute the AI call with the prepared prompt and tools
    console.log('[generateFullPlan] Executing AI call');
    const result = await generatePlanPrompt(input, {
      tools: [
        findPlacesNearbyTool,
        fetchPlaceDetailsTool
      ],
      output: {
        schema: CustomPlanOutputSchema
      }
    });
    
    // Process the raw plan data from the result
    let planData = result?.output;
    if (!planData) {
      throw new Error('AI returned empty plan data');
    }
    
    console.log('[generateFullPlan] Raw AI plan received, processing...');
    
    // Ensure all required timestamps and fields are present
    if (!planData.eventTime) {
      planData.eventTime = formattedDateTime;
    }
    
    // Ensure the planType matches user's planTypeHint if specified (and not 'ai-decide')
    if (input.planTypeHint && input.planTypeHint !== 'ai-decide') {
      if (input.planTypeHint === 'single-stop' && planData.planType !== 'single-stop') {
        console.log('[generateFullPlan] Overriding AI-selected plan type to match user preference: single-stop');
        planData.planType = 'single-stop';
      } else if (input.planTypeHint === 'multi-stop' && planData.planType !== 'multi-stop') {
        console.log('[generateFullPlan] Overriding AI-selected plan type to match user preference: multi-stop');
        planData.planType = 'multi-stop';
      }
    }
    
    // Ensure all itinerary items have proper UUIDs
    if (planData.itinerary && Array.isArray(planData.itinerary)) {
      planData.itinerary = planData.itinerary.map(item => ({
        ...item,
        id: generateUUID() // Replace any existing ID with a proper UUID
      }));
      
      console.log('[generateFullPlan] Assigned UUIDs to all itinerary items');
    }

    // Prioritize user-set price range if available, otherwise use AI-generated value
    if (input.priceRange) {
      console.log('[generateFullPlan] Using user-specified price range:', input.priceRange);
      planData.priceRange = input.priceRange;
    } 
    // Otherwise, ensure the AI-generated price range is valid
    else if (planData.priceRange && typeof planData.priceRange === 'string') {
      // Ensure it's a valid enum value
      if (['$', '$$', '$$$', '$$$$', 'Free'].includes(planData.priceRange)) {
        planData.priceRange = planData.priceRange as any;
      } else {
        // Default to moderate if invalid
        planData.priceRange = '$$';
      }
    }

    // Create a complete UserProfile object from the hostProfile with all required fields
    const enhancedProfile: UserProfile = {
      uid: input.hostProfile.uid,
      name: input.hostProfile.name || 'Anonymous',
      username: (input.hostProfile as any).username || 'user_' + input.hostProfile.uid.substring(0, 8),
      name_lowercase: (input.hostProfile.name || 'Anonymous').toLowerCase(),
      email: (input.hostProfile as any).email || null,
      bio: (input.hostProfile as any).bio || null,
      countryDialCode: (input.hostProfile as any).countryDialCode || null,
      phoneNumber: (input.hostProfile as any).phoneNumber || null,
      birthDate: (input.hostProfile as any).birthDate || null,
      physicalAddress: (input.hostProfile as any).physicalAddress || null,
      avatarUrl: (input.hostProfile as any).avatarUrl || null,
      
      preferences: input.hostProfile.preferences || [],
      allergies: input.hostProfile.allergies || [],
      dietaryRestrictions: input.hostProfile.dietaryRestrictions || [],
      favoriteCuisines: input.hostProfile.favoriteCuisines || [],
      activityTypePreferences: input.hostProfile.activityTypePreferences || [],
      activityTypeDislikes: input.hostProfile.activityTypeDislikes || [],
      physicalLimitations: input.hostProfile.physicalLimitations || [],
      environmentalSensitivities: input.hostProfile.environmentalSensitivities || [],
      travelTolerance: input.hostProfile.travelTolerance || "",
      budgetFlexibilityNotes: input.hostProfile.budgetFlexibilityNotes || "",
      socialPreferences: input.hostProfile.socialPreferences || {
        preferredGroupSize: null,
        interactionLevel: null
      },
      // Required fields for UserProfile that might be missing
      generalPreferences: input.hostProfile.generalPreferences || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      // Availability
      availabilityNotes: "",
      
      // Gamification elements
      eventAttendanceScore: 0,
      levelTitle: "Newcomer",
      levelStars: 1,
      
      // Status/role
      role: null,
      isVerified: false,
      isAdmin: false,
      
      // Social graph
      followers: [],
      following: [],
      followersCount: 0,
      ratingsCount: 0,
      
      // Saved content
      savedPlans: [],
      
      // Google data
      googleUserData: null
    };

    // Process the raw plan data into a validated Plan object
    try {
      
      // Create a complete plan object with an ID before processing
      const planWithId = {
        ...planData,
        id: generateUUID()
      };
      
      // Process the AI generated plan with the correct arguments
      const processedResult = await processAIGeneratedPlan(planWithId as Plan, input.planDateTime, enhancedProfile, input.userPrompt);
      
      // Log any warnings from the processing
      if (processedResult.warnings.length > 0) {
        console.warn('[generateFullPlan] Plan processing warnings:', processedResult.warnings);
      }
      
      // Log any validation errors from the processing
      if (processedResult.validationErrors.length > 0) {
        console.error('[generateFullPlan] Plan validation errors:', processedResult.validationErrors);
      }
      
      console.log('[generateFullPlan] Generation complete!');
      
      // Return the processed plan object, not the entire ProcessedPlanData
      return processedResult.plan;
    } catch (processingError) {
      console.error('[generateFullPlan] Error processing plan:', processingError);
      throw processingError;
    }
  } catch (error) {
    console.error('[generateFullPlan] Error generating plan:', error);
    throw error;
  }
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
  transportation: string,
  planTypeHint?: 'ai-decide' | 'single-stop' | 'multi-stop' | undefined | null
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
  
  // Explicitly honor user's plan type preference if specified
  if (planTypeHint) {
    if (planTypeHint === 'single-stop') {
      baseStopCount = 1;
      factors.userPreference = 'User explicitly requested a single-stop plan';
    } else if (planTypeHint === 'multi-stop' && baseStopCount < 2) {
      // Force at least 2 stops for multi-stop plans
      baseStopCount = 2;
      factors.userPreference = 'User explicitly requested a multi-stop plan';
    }
  }
  
  // Ensure we don't go below 1 or above 7 stops
  let finalStopCount = Math.max(1, Math.min(7, baseStopCount));
  
  // Create explanation
  const explanation = `Based on a ${duration} plan for ${groupSize} people using ${transportation} for ${activityType} activities during the ${timeOfDay}${planTypeHint && planTypeHint !== 'ai-decide' ? ` with explicit ${planTypeHint} preference` : ''}, I recommend ${finalStopCount} stops. ${Object.values(factors).join('. ')}.`;
  
  return {
    recommendedStops: finalStopCount,
    factors,
    explanation
  };
}
