import { z } from 'zod';

// Common schema enums
export const TransitModeSchema = z.enum(['driving', 'walking', 'bicycling', 'transit']);
export const PriceRangeSchema = z.enum(['$', '$$', '$$$', '$$$$', 'Free']);
export const PlanTypeSchema = z.enum(['single-stop', 'multi-stop']);
export const PlanTypeHintSchema = z.enum(['ai-decide', 'single-stop', 'multi-stop']);

// Shared itinerary item schema
export const ItineraryItemSchema = z.object({
  id: z.string().uuid().optional().describe("A unique UUID for this itinerary item. DO NOT generate this - the system will automatically generate a valid UUID."),
  placeName: z.string().describe("The name of the place or activity for this stop."),
  address: z.string().nullable().describe("The full street address of the place."),
  city: z.string().nullable().describe("The city of the place."),
  startTime: z.string().datetime().nullable().describe("The start date and time for this stop in ISO 8601 format."),
  endTime: z.string().datetime().nullable().describe("The end date and time for this stop in ISO 8601 format. If not specified, calculate based on startTime and durationMinutes (default 60 mins)."),
  description: z.string().nullable().describe("A brief description of this stop or activity."),
  tagline: z.string().optional().nullable().describe("A short AI-generated summary tagline highlighting the role of this stop in the overall plan (e.g., 'Romantic sunset dinner')."),
  googlePlaceId: z.string().nullable().describe("The Google Place ID, if available from the 'fetchPlaceDetails' tool."),
  lat: z.number().nullable().describe("Latitude of the place."),
  lng: z.number().nullable().describe("Longitude of the place."),
  googlePhotoReference: z.string().nullable().describe("A direct Google Places Photo URL, if available from the 'fetchPlaceDetails' tool. This is a ready-to-use image URL."),
  googleMapsImageUrl: z.string().nullable().describe("A Google Maps static image URL for this place, if available."),
  rating: z.number().min(0).max(5).nullable().describe("The place's rating (0-5), if available."),
  reviewCount: z.number().int().min(0).nullable().describe("The number of reviews, if available."),
  activitySuggestions: z.array(z.string()).nullable().describe("A list of 2-3 concise activity suggestions for this stop, tailored to participants."),
  isOperational: z.boolean().nullable().describe("Whether the place is currently operational, from 'fetchPlaceDetails' tool."),
  statusText: z.string().nullable().describe("Business status text like 'OPERATIONAL', 'CLOSED_TEMPORARILY', from 'fetchPlaceDetails' tool."),
  openingHours: z.array(z.string()).nullable().describe("Weekly opening hours as an array of strings, from 'fetchPlaceDetails' tool."),
  phoneNumber: z.string().nullable().describe("The place's phone number."),
  website: z.string().url().nullable().describe("The place's website URL."),
  priceLevel: z.number().int().min(0).max(4).optional().nullable().describe("The price level (0-4) from Google Places, if available."),
  types: z.array(z.string()).nullable().describe("An array of Google Place types (e.g., 'restaurant', 'museum')."),
  notes: z.string().nullable().describe("User-specific notes for this item, if any were part of the initial prompt for this stop."),
  durationMinutes: z.number().int().min(0).nullable().default(60).describe("Estimated duration for this stop in minutes. Default to 60 minutes if not specified or derivable."),
  transitMode: TransitModeSchema.nullable().default('driving').describe("Preferred mode of transport to this stop. Defaults to 'driving'."),
  transitTimeFromPreviousMinutes: z.number().int().min(0).optional().nullable().describe("Estimated travel time in minutes from the previous stop. Null for the first item."),
  noiseLevel: z.enum(['low', 'moderate', 'high']).nullable().describe("Expected noise level at the venue based on venue type, reviews, and other factors.")
});

// Shared plan output schema (without id field since we handle UUID generation)
export const PlanOutputSchema = z.object({
  name: z.string().describe("A catchy and descriptive name for the plan."),
  description: z.string().nullable().describe("A detailed description of the overall plan."),
  eventTime: z.string().datetime().describe("The overall start date and time of the plan in ISO format. Should match the first itinerary item's start time."),
  location: z.string().describe("The primary location or venue name for the plan, derived from the first itinerary item."),
  city: z.string().describe("The primary city for the plan, derived from the first itinerary item."),
  eventType: z.string().nullable().describe("The type of event (e.g., 'Road Trip', 'Dinner Party')."),
  eventTypeLowercase: z.string().describe("Lowercase version of eventType for filtering."),
  priceRange: PriceRangeSchema.describe("The estimated price range."),
  hostId: z.string().describe("The UID of the user creating the plan."),
  invitedParticipantUserIds: z.array(z.string()).default([]).describe("Array of UIDs of invited friends. This should match the UIDs from invitedFriendProfiles if provided."),
  participantUserIds: z.array(z.string()).default([]).describe("Array of UIDs of users who have joined the plan."),
  itinerary: z.array(ItineraryItemSchema).min(1).describe("An array of itinerary items. Must have at least one item."),
  status: z.enum(['draft', 'published', 'cancelled', 'archived', 'completed']).default('draft').describe("The status of the plan."),
  planType: PlanTypeSchema.describe("Whether the plan is a single stop or multi-stop."),
  originalPlanId: z.string().nullable().describe("ID of the original plan if this is a copy."),
  sharedByUid: z.string().nullable().describe("UID of the user who shared this plan."),
  averageRating: z.number().nullable().describe("Average rating of the plan."),
  reviewCount: z.number().default(0).describe("Number of reviews for the plan."),
  photoHighlights: z.array(z.string()).default([]).describe("Array of photo URLs for plan highlights."),
  participantResponses: z.record(z.enum(['going', 'maybe', 'not-going', 'pending'])).default({}).describe("Record of participant responses keyed by user ID."),
  createdAt: z.string().describe("Creation timestamp in ISO format."),
  updatedAt: z.string().describe("Last update timestamp in ISO format."),
  stopCountReasoning: z.object({
    chosenCount: z.number(),
    reasons: z.array(z.string()),
    comparisonAnalysis: z.array(z.object({
      alternativeCount: z.number(),
      whyNotChosen: z.string()
    })),
    timeConsiderations: z.string(),
    groupFactors: z.string(),
    qualityImpact: z.string()
  }).describe('Reasoning for the number of stops chosen'),
});

// Enhanced profile schema for AI input with detailed user preferences
export const AIEnhancedProfileSchema = z.object({
  uid: z.string(),
  
  // Basic info
  name: z.string().nullable().optional(),
  
  // Enhanced preferences
  preferences: z.array(z.string()).optional().default([]),
  generalPreferences: z.string().optional().nullable().describe("General likes/dislikes text from user"),
  
  // Food & Dining
  allergies: z.array(z.string()).optional().default([]),
  dietaryRestrictions: z.array(z.string()).optional().default([]),
  favoriteCuisines: z.array(z.string()).optional().default([]),
  
  // Activity & Physical
  activityTypePreferences: z.array(z.string()).optional().default([]),
  activityTypeDislikes: z.array(z.string()).optional().default([]),
  physicalLimitations: z.array(z.string()).optional().default([]),
  environmentalSensitivities: z.array(z.string()).optional().default([]),
  
  // Social & Travel
  travelTolerance: z.string().optional().nullable().describe("Travel tolerance like 'Up to 1 hour' or 'Any distance'"),
  budgetFlexibilityNotes: z.string().optional().nullable().describe("Budget preferences and flexibility"),
  socialPreferences: z.object({
    preferredGroupSize: z.string().nullable(),
    interactionLevel: z.string().nullable(),
  }).optional().nullable(),
  
  // Availability context
  availabilityNotes: z.string().optional().nullable(),
});

// Shared input schema for plan generation
export const GeneratePlanInputSchema = z.object({
  hostProfile: AIEnhancedProfileSchema.describe("The host user's detailed profile including preferences, dietary needs, activity preferences, and social style."),
  invitedFriendProfiles: z.array(AIEnhancedProfileSchema).optional().default([]).describe("Invited friends' detailed profiles including preferences, dietary needs, activity preferences, and social styles."),
  planDateTime: z.string().datetime().describe("Desired start date and time for the plan (ISO format)."),
  locationQuery: z.string().describe("User's query for the main location (e.g., 'Eiffel Tower' or 'Restaurants near Central Park')."),
  selectedLocationLat: z.number().optional().nullable().describe("Latitude of the user-selected primary location, if available."),
  selectedLocationLng: z.number().optional().nullable().describe("Longitude of the user-selected primary location, if available."),
  priceRange: PriceRangeSchema.optional().nullable().describe("Desired price range."),
  userPrompt: z.string().describe("User's specific instructions or wishes for the plan (e.g., vibe, specific activities, must-haves)."),
  searchRadius: z.number().positive().optional().nullable().describe("Optional search radius in kilometers around the primary location for finding activities/places."),
  planTypeHint: PlanTypeHintSchema.optional().default('ai-decide').describe("User's preference for a single-stop, multi-stop plan, or to let AI decide."),
}); 