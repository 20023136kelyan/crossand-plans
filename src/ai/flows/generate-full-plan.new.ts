'use server';
/**
 * @fileOverview AI-powered full plan generator with standard place discovery.
 * Defines a Genkit flow for generating complete event plans with itineraries.
 * @exports generateFullPlan
 * @exports GenerateFullPlanInput
 * @exports GenerateFullPlanOutput
 */

import { ai } from '@/ai/genkit';
import { allTools } from '@/ai/tools';
import type { Plan, PriceRangeType, PlanType, ItineraryItem, UserProfile } from '@/types/user';
import { processAIOutput } from '@/lib/aiFlowUtils';
import { formatISO, parseISO, isValid } from 'date-fns';
import { 
  GeneratePlanInputSchema, 
  PlanOutputSchema, 
  PlanTypeHintSchema,
  PriceRangeSchema,
  AIEnhancedProfileSchema
} from '@/ai/schemas/shared';
import { z } from 'zod';
import { trackSuggestedPlaces, markPlaceAsChosen } from '@/lib/placeDiscovery';
import { processAIGeneratedPlan } from '@/lib/planUtils';
import crypto from 'crypto';
import { analyzeUserIntentWithLLM, generateLLMSearchTerms } from '@/lib/aiFlowUtils';
import type { UserIntent } from '@/lib/aiFlowUtils';

/**
 * Helper function to validate and fix ISO date strings
 * @param dateStr - ISO date string that may or may not have timezone info
 * @returns ISO date string with guaranteed timezone info
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
 * Extract clean JSON from potentially markdown-formatted response
 * @param response - AI response that might contain markdown
 * @returns Cleaned JSON string
 */
function extractJsonFromResponse(response: string): string {
  if (!response) return response;
  
  // Handle markdown code block format (```json {...} ```)
  const markdownMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (markdownMatch && markdownMatch[1]) {
    console.log('[extractJsonFromResponse] Detected markdown code block, extracting JSON');
    return markdownMatch[1];
  }
  
  return response;
}

interface Place {
  id: string;
  name: string;
  description?: string;
  source: string;
  confidence: number;
  contextualInfo?: any;
  url?: string;
  relevance?: number;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  isHidden?: boolean;
  photoReference?: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  placeTypes?: string[];
  userInteractionData?: {
    clicks: number;
    impressions: number;
    ctr: number;
    isSelected: boolean;
  };
}

// Define a fallback plan generation schema
const FallbackPlanSchema = z.object({
  name: z.string(),
  description: z.string(),
  eventTime: z.string(),
  location: z.string(),
  city: z.string(),
  eventType: z.string(),
  eventTypeLowercase: z.string(),
  priceRange: z.string(),
});

// Zod schema for user intent
const IntentSchema = z.object({
  category: z.string(),
  specificItem: z.string().optional(),
  cuisine: z.string().optional(),
  culturalContext: z.string().optional(),
  searchTerms: z.array(z.string()),
  priority: z.enum(['category', 'specific_item', 'cuisine', 'cultural']),
  targetQueries: z.array(z.string()),
  fallbackQueries: z.array(z.string()),
  searchStrategy: z.enum(['exact_match', 'semantic', 'hybrid']),
});

// The input schema for the plan generation
export const GenerateFullPlanInput = GeneratePlanInputSchema;
export const GenerateFullPlanOutput = PlanOutputSchema;

/**
 * Calculate the recommended number of stops for a plan based on various factors
 * @param duration - Duration of the plan
 * @param groupSize - Size of the group
 * @param activityType - Type of activity
 * @param timeOfDay - Time of day
 * @param budget - Budget for the plan
 * @param transportation - Transportation mode
 */
function calculateRecommendedStops(
  duration: string,
  groupSize: string,
  activityType: string,
  timeOfDay: string,
  budget: string,
  transportation: string
): { 
  recommendedStops: number,
  factors: Record<string, string>,
  explanation: string
} {
  let baseStops = 3; // Default baseline
  let factors: Record<string, string> = {};
  
  // Duration impact
  if (duration.includes("1-2")) {
    baseStops = 2;
    factors.duration = "Short duration best for 2 focused activities";
  } else if (duration.includes("3-4")) {
    baseStops = 4;
    factors.duration = "3 hours works well for a quartet of connected activities";
  } else if (duration.includes("5-6")) {
    baseStops = 6;
    factors.duration = "5-6 hour duration allows for a half-day multi-stop adventure";
  } else if (duration.includes("full-day")) {
    baseStops = 8;
    factors.duration = "Full day enables an extensive itinerary with multiple experience types";
  }
  
  // Time of day adjustments
  if (timeOfDay === "morning") {
    factors.timeOfDay = "Morning perfect for active starts and breakfast experiences";
  } else if (timeOfDay === "afternoon") {
    factors.timeOfDay = "Afternoon perfect for combining lunch, activities, and pre-dinner experiences";
  } else if (timeOfDay === "evening") {
    // Slight reduction for evening plans
    baseStops = Math.max(2, baseStops - 1);
    factors.timeOfDay = "Evening plans focus on dinner and post-dinner experiences";
  }
  
  // Transportation impact
  if (transportation === "walking") {
    // Walking limits range
    baseStops = Math.min(baseStops, 5);
    factors.transportation = "Walking limits range, focusing on quality nearby experiences";
  } else if (transportation === "driving") {
    // Driving enables more stops
    baseStops += 1;
    factors.transportation = "Car transportation enables an extensive multi-venue experience";
  }
  
  // Group size considerations
  if (groupSize === "large-group") {
    // Larger groups move slower
    baseStops = Math.max(2, baseStops - 1);
    factors.groupSize = "Large groups move at a more deliberate pace";
  } else if (groupSize === "solo") {
    // Solo can be more efficient
    baseStops += 1;
    factors.groupSize = "Solo experiences can be more efficient and personalized";
  }
  
  // Activity type impact
  if (activityType === "dining") {
    // Dining typically has fewer stops
    baseStops = Math.min(baseStops, 5);
    factors.activityType = "Dining experiences best enjoyed at a deliberate pace";
  } else if (activityType === "adventure") {
    // Adventure may take more time per stop
    baseStops = Math.min(baseStops, 5);
    factors.activityType = "Adventure activities require adequate time at each location";
  }
  
  // Ensure reasonable bounds
  const recommendedStops = Math.min(Math.max(baseStops, 2), 8);
  
  return {
    recommendedStops,
    factors,
    explanation: "AI-optimized stop count based on various factors"
  };
}

/**
 * Generate a complete plan with itinerary using AI
 * @param input - Plan generation input parameters
 * @returns Generated plan with itinerary
 */
export async function generateFullPlan(input: z.infer<typeof GeneratePlanInputSchema>): Promise<Plan> {
  try {
    // Generate stop count reasoning
    const stopCountReasoning = calculateRecommendedStops(
      input.duration,
      input.groupSize,
      input.activityType,
      input.timeOfDay,
      input.budget,
      input.transportation
    );
    console.log('[generateFullPlan] Stop count reasoning:', stopCountReasoning);

    // Generate user intent analysis using LLM
    let userIntent: UserIntent;
    try {
      userIntent = await analyzeUserIntentWithLLM(input.userPrompt, input.locationQuery);
      console.log('[generateFullPlan] User intent analysis:', userIntent);
    } catch (error) {
      console.error('[generateFullPlan] Error analyzing user intent:', error);
      // Fallback to a basic intent structure
      userIntent = {
        category: 'general',
        searchTerms: [input.userPrompt],
        priority: 'category',
        targetQueries: [input.userPrompt],
        fallbackQueries: [],
        searchStrategy: 'exact_match'
      };
    }

    // Generate enhanced search terms
    let enhancedSearchTerms;
    try {
      enhancedSearchTerms = await generateLLMSearchTerms(
        input.userPrompt,
        input.locationQuery
      );
      console.log('[generateFullPlan] Enhanced search terms:', enhancedSearchTerms);
    } catch (error) {
      console.error('[generateFullPlan] Error generating search terms:', error);
      enhancedSearchTerms = {
        primaryQueries: userIntent.searchTerms,
        secondaryQueries: [],
        culturalContext: null,
        searchStrategy: 'exact_match',
        itemType: 'general',
        confidence: 0.5
      };
    }

    // Format the date with timezone to ensure consistency
    const formattedDateTime = formatISO(new Date(input.planDateTime));

    // Create the AI prompt for plan generation
    console.log('[generateFullPlan] Calling AI prompt with input');
    
    // Define the prompt template
    const generatePlanPrompt = ai.createPrompt({
      name: "generatePlanPrompt",
      description: "Generate a comprehensive plan based on user input",
      input: GeneratePlanInputSchema,
      output: PlanOutputSchema,
      template: `
You are creating a personalized plan for the user based on their input. This plan will include:
1. A detailed itinerary with carefully curated activities/venues
2. Timing and logistics for each stop
3. Creative suggestions tailored to the user's preferences

**USER PROFILE:**
Name: ${input.hostProfile.name || 'User'}
Preferences: ${JSON.stringify(input.hostProfile.preferences || [])}
Allergies: ${JSON.stringify(input.hostProfile.allergies || [])}
Dietary Restrictions: ${JSON.stringify(input.hostProfile.dietaryRestrictions || [])}
Favorite Cuisines: ${JSON.stringify(input.hostProfile.favoriteCuisines || [])}
Activity Preferences: ${JSON.stringify(input.hostProfile.activityTypePreferences || [])}
Activity Dislikes: ${JSON.stringify(input.hostProfile.activityTypeDislikes || [])}
Physical Limitations: ${JSON.stringify(input.hostProfile.physicalLimitations || [])}
Environmental Sensitivities: ${JSON.stringify(input.hostProfile.environmentalSensitivities || [])}

**REQUEST DETAILS:**
- User's Request: "${input.userPrompt}"
- Location: ${input.locationQuery}
- Date/Time: ${formattedDateTime}
- Duration: ${input.duration}
- Group Size: ${input.groupSize}
- Activity Type: ${input.activityType}
- Time of Day: ${input.timeOfDay}
- Budget: ${input.budget}
- Transportation: ${input.transportation}
- Recommended Number of Stops: ${stopCountReasoning.recommendedStops}

**CRITICAL: You MUST return a complete Plan object with all required fields. DO NOT return null or empty responses.**

**IMPORTANT DATE-TIME FORMATTING:**
All date and time fields MUST use ISO 8601 format WITH timezone information. Example: "2025-07-07T15:30:00-07:00" not "2025-07-07T15:30:00".
This applies to eventTime, startTime, endTime, createdAt, and updatedAt fields.

**RESPONSE FORMAT:**
You must return ONLY raw JSON without any markdown formatting. DO NOT wrap your response in code block tags.

**STEP 1: ANALYZE THE REQUEST**
I've analyzed the user's intent:
- Category: ${userIntent.category}
- Priority: ${userIntent.priority}
- Specific Item: ${userIntent.specificItem || 'None specified'}
- Key Search Terms: ${JSON.stringify(userIntent.targetQueries)}

**STEP 2: SEARCH FOR PLACES**
First, I'll search for places that match the user's criteria.

**STEP 3: CURATE AND CREATE PLAN**
I'll select the best options and create a cohesive plan with:
- A compelling title and description
- A logical flow between activities
- Appropriate timing for each activity
- Creative activity suggestions for each stop

**STEP 4: FINALIZE THE ITINERARY**
I'll finalize the itinerary with:
- Detailed venue information
- Practical logistics (travel times, durations)
- Activity suggestions tailored to each venue
- A stop count of ${stopCountReasoning.recommendedStops} activities

**STEP 5: RETURN THE COMPLETE PLAN**
I'll now create and return a complete plan JSON object that includes all required fields.
`,
    });
    
    // Generate the plan using AI
    const result = await generatePlanPrompt(input, {
      tools: allTools,
    });
    
    // Process the raw plan data
    const planData = result?.plan;
    if (!planData) {
      throw new Error('AI returned empty plan data');
    }
    
    console.log('[generateFullPlan] AI returned plan data:', planData);
    
    // Parse the JSON data first - separate this from the formatting logic
    let parsedData;
    let finalPlan;
    try {
      // Check if the string is wrapped in markdown code block and extract just the JSON
      if (typeof planData === 'string') {
        const jsonString = extractJsonFromResponse(planData);
        
        // Try to parse the extracted or original string
        parsedData = JSON.parse(jsonString);
      } else {
        parsedData = planData;
      }
    } catch (error) {
      console.error('[generateFullPlan] Error parsing AI output:', error);
      throw new Error('Failed to parse AI output as JSON');
    }
    
    // Now safely format the date-time strings using our helper function
    console.log('[generateFullPlan] Adding timezone information to date fields');
    
    // Fix eventTime at the plan level
    try {
      if (parsedData.eventTime && typeof parsedData.eventTime === 'string') {
        console.log(`[generateFullPlan] Checking eventTime: ${parsedData.eventTime}`);
        parsedData.eventTime = ensureDateHasTimezone(parsedData.eventTime);
        console.log(`[generateFullPlan] After check eventTime: ${parsedData.eventTime}`);
      }
    } catch (error) {
      console.error('[generateFullPlan] Error formatting eventTime:', error);
    }
    
    // Fix all date-time strings in itinerary items
    if (parsedData.itinerary && Array.isArray(parsedData.itinerary)) {
      parsedData.itinerary = parsedData.itinerary.map((item: any) => {
        // Process startTime
        try {
          if (item.startTime && typeof item.startTime === 'string') {
            console.log(`[generateFullPlan] Checking startTime: ${item.startTime}`);
            item.startTime = ensureDateHasTimezone(item.startTime);
            console.log(`[generateFullPlan] After check startTime: ${item.startTime}`);
          }
        } catch (error) {
          console.error('[generateFullPlan] Error formatting startTime:', error);
        }
        
        // Process endTime
        try {
          if (item.endTime && typeof item.endTime === 'string') {
            console.log(`[generateFullPlan] Checking endTime: ${item.endTime}`);
            item.endTime = ensureDateHasTimezone(item.endTime);
            console.log(`[generateFullPlan] After check endTime: ${item.endTime}`);
          }
        } catch (error) {
          console.error('[generateFullPlan] Error formatting endTime:', error);
        }
        
        return item;
      });
    }
    
    // Process createdAt and updatedAt
    try {
      parsedData.createdAt = formatISO(new Date());
      parsedData.updatedAt = formatISO(new Date());
    } catch (error) {
      console.error('[generateFullPlan] Error formatting createdAt/updatedAt:', error);
    }
    
    // Generate a unique plan ID if not provided
    if (!parsedData.id) {
      parsedData.id = `plan_${crypto.randomUUID()}`;
    }
    
    // Set host ID from input
    parsedData.hostId = input.hostProfile.uid;
    
    // Initialize empty arrays for required fields if not present
    if (!parsedData.invitedParticipantUserIds) parsedData.invitedParticipantUserIds = [];
    if (!parsedData.participantUserIds) parsedData.participantUserIds = [];
    if (!parsedData.photoHighlights) parsedData.photoHighlights = [];
    
    // Set default values for other required fields
    parsedData.status = parsedData.status || 'draft';
    parsedData.planType = parsedData.planType || 'multi-stop';
    parsedData.reviewCount = parsedData.reviewCount || 0;
    parsedData.participantResponses = parsedData.participantResponses || {};
    
    // Pass the partially processed data to processAIOutput for final formatting and validation
    try {
      finalPlan = await processAIOutput(parsedData, input);
    } catch (error) {
      console.error('[generateFullPlan] Error in processAIOutput:', error);
      throw error;
    }
    
    // Process the AI-generated plan data
    try {
      const processedPlanData = await processAIGeneratedPlan(
        finalPlan,
        input.planDateTime,
        input.hostProfile,
        input.userPrompt
      );
      
      // Log validation errors but don't fail
      if (processedPlanData.validationErrors.length > 0) {
        console.warn('[generateFullPlan] Plan validation errors:', processedPlanData.validationErrors);
      }
      
      if (processedPlanData.warnings.length > 0) {
        console.warn('[generateFullPlan] Plan warnings:', processedPlanData.warnings);
      }
      
      return processedPlanData.plan;
    } catch (error) {
      console.error('[generateFullPlan] Error in processAIGeneratedPlan:', error);
      throw error;
    }
  } catch (error) {
    console.error('[generateFullPlan] Error:', error);
    throw error;
  }
}
