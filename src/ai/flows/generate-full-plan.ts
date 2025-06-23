'use server';
/**
 * @fileOverview AI-powered full plan generator.
 * Defines a Genkit flow for generating complete event plans with itineraries.
 * @exports generateFullPlan
 * @exports GenerateFullPlanInput
 * @exports GenerateFullPlanOutput
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { Plan, ItineraryItem, UserProfile, TransitMode, PriceRangeType, PlanTypeType } from '@/types/user';
import { getUsersProfilesAdmin } from '@/services/userService.server'; // For fetching profiles by Admin SDK

// Schemas for AI Flow
const TransitModeSchema = z.enum(['driving', 'walking', 'bicycling', 'transit']);
const PriceRangeSchema = z.enum(['$', '$$', '$$$', '$$$$', 'Free']);
const PlanTypeSchema = z.enum(['single-stop', 'multi-stop']);
const PlanTypeHintSchema = z.enum(['ai-decide', 'single-stop', 'multi-stop']);

const ItineraryItemSchema = z.object({
  id: z.string().uuid().describe("A unique UUID for this itinerary item. Generate one if not provided."),
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
  priceLevel: z.number().int().min(0).max(4).nullable().describe("The price level (0-4) from Google Places, if available."),
  types: z.array(z.string()).nullable().describe("An array of Google Place types (e.g., 'restaurant', 'museum')."),
  notes: z.string().nullable().describe("User-specific notes for this item, if any were part of the initial prompt for this stop."),
  durationMinutes: z.number().int().min(0).nullable().default(60).describe("Estimated duration for this stop in minutes. Default to 60 minutes if not specified or derivable."),
  transitMode: TransitModeSchema.nullable().default('driving').describe("Preferred mode of transport to this stop. Defaults to 'driving'."),
  transitTimeFromPreviousMinutes: z.number().int().min(0).optional().nullable().describe("Estimated travel time in minutes from the previous stop. Null for the first item."),
});

const PlanOutputSchema = z.object({ // Renamed to PlanOutputSchema to avoid conflict with Plan type
  id: z.string().uuid().describe("A unique UUID for the plan. Generate one if creating anew."),
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
});

// Enhanced profile schema for AI input with detailed user preferences
const AIEnhancedProfileSchema = z.object({
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

const GenerateFullPlanInputSchema = z.object({
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

export type GenerateFullPlanInput = z.infer<typeof GenerateFullPlanInputSchema>;
export type GenerateFullPlanOutput = Plan; // The flow outputs a complete Plan object

// Tool for fetching place details
const FetchPlaceDetailsInputSchema = z.object({
  placeNameOrId: z.string().describe("Name (e.g., 'Eiffel Tower, Paris') or Google Place ID of the location to get details for."),
  locationHint: z.object({ lat: z.number(), lng: z.number() }).optional().nullable().describe("Optional latitude/longitude to help disambiguate the place name, especially if only a name is provided."),
  searchRadiusKm: z.number().optional().nullable().describe("Search radius in kilometers around the locationHint. Used to bias results to nearby places. Defaults to 50km if not provided."),
  fields: z.array(z.string()).optional().default(['place_id', 'name', 'formatted_address', 'address_components', 'geometry', 'photos', 'rating', 'user_ratings_total', 'opening_hours', 'international_phone_number', 'website', 'price_level', 'types', 'business_status']).describe("Specific fields to fetch for the place."),
});

const FetchPlaceDetailsOutputSchema = z.object({
  success: z.boolean(),
  placeId: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  photoReference: z.string().optional().nullable().describe("A direct Google Places Photo URL, if available from the 'fetchPlaceDetails' tool. This is a ready-to-use image URL."),
  rating: z.number().optional().nullable(),
  reviewCount: z.number().optional().nullable(),
  openingHours: z.array(z.string()).optional().nullable().describe("e.g., ['Monday: 9:00 AM – 5:00 PM', ...]"),
  isOperational: z.boolean().optional().nullable().describe("True if business_status is OPERATIONAL."),
  statusText: z.string().optional().nullable().describe("Raw business_status string from Google."),
  types: z.array(z.string()).optional().nullable(),
  website: z.string().url().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  priceLevel: z.number().optional().nullable(),
  error: z.string().optional().nullable(),
});

// Tool for finding places within a radius
const FindPlacesNearbyInputSchema = z.object({
  centerLat: z.number().describe("Latitude of the center point"),
  centerLng: z.number().describe("Longitude of the center point"),
  radiusKm: z.number().describe("Radius in kilometers to search within"),
  placeType: z.string().optional().describe("Optional place type filter (e.g., 'restaurant', 'tourist_attraction', 'park')"),
  keyword: z.string().optional().describe("Optional keyword to filter results (e.g., 'coffee', 'museum', 'outdoor')"),
});

const FindPlacesNearbyOutputSchema = z.object({
  success: z.boolean(),
  places: z.array(z.object({
    name: z.string(),
    placeId: z.string(),
    address: z.string().optional().nullable(),
    lat: z.number(),
    lng: z.number(),
    rating: z.number().optional().nullable(),
    priceLevel: z.number().optional().nullable(),
    types: z.array(z.string()),
    isOpen: z.boolean().optional().nullable(),
  })).describe("Array of places found within the radius"),
  error: z.string().optional().nullable(),
});

const findPlacesNearbyTool = ai.defineTool(
  {
    name: 'findPlacesNearby',
    description: 'Finds places within a specified radius around a center point. Use this to discover venues, restaurants, attractions, and activities within the user\'s search area. More effective than web search for finding actual places.',
    inputSchema: FindPlacesNearbyInputSchema,
    outputSchema: FindPlacesNearbyOutputSchema,
  },
  async (input) => {
    console.log('[findPlacesNearbyTool] Called with input:', JSON.stringify(input, null, 2));
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("[findPlacesNearbyTool] API key NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing.");
      return { success: false, places: [], error: "API key missing" };
    }

    // Convert radius from km to meters
    const radiusMeters = input.radiusKm * 1000;
    
    // Build the nearby search URL
    let nearbySearchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${input.centerLat},${input.centerLng}&radius=${radiusMeters}&key=${apiKey}`;
    
    if (input.placeType) {
      nearbySearchUrl += `&type=${encodeURIComponent(input.placeType)}`;
    }
    
    if (input.keyword) {
      nearbySearchUrl += `&keyword=${encodeURIComponent(input.keyword)}`;
    }
    
    console.log("[findPlacesNearbyTool] Nearby Search URL:", nearbySearchUrl);

    try {
      const response = await fetch(nearbySearchUrl);
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[findPlacesNearbyTool] Nearby search API error ${response.status}: ${errorBody}`);
        return { success: false, places: [], error: `Nearby search API error: ${response.statusText}` };
      }
      
      const data = await response.json();
      
      if (data.status === 'REQUEST_DENIED') {
        console.error(`[findPlacesNearbyTool] API request denied: ${data.error_message || 'Unknown reason'}`);
        return { success: false, places: [], error: `Google Maps API request denied: ${data.error_message || 'Check API key and billing'}` };
      }
      if (data.status === 'OVER_QUERY_LIMIT') {
        console.error(`[findPlacesNearbyTool] API quota exceeded`);
        return { success: false, places: [], error: `Google Maps API quota exceeded. Please try again later.` };
      }

      if (data.results && data.results.length > 0) {
        const places = data.results.slice(0, 10).map((place: any) => ({
          name: place.name,
          placeId: place.place_id,
          address: place.vicinity || place.formatted_address,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          rating: place.rating,
          priceLevel: place.price_level,
          types: place.types || [],
          isOpen: place.opening_hours?.open_now,
        }));
        
        console.log(`[findPlacesNearbyTool] Found ${places.length} places within ${input.radiusKm}km radius`);
        return { success: true, places };
      } else {
        console.log(`[findPlacesNearbyTool] No places found within radius. Status: ${data.status}`);
        return { success: true, places: [], error: `No places found within ${input.radiusKm}km radius. Status: ${data.status}` };
      }
    } catch (e: any) {
      console.error("[findPlacesNearbyTool] API fetch/parse error:", e);
      return { success: false, places: [], error: `Nearby search API fetch error: ${e.message}` };
    }
  }
);

// Web Search Tool for contextual information
const webSearchTool = ai.defineTool(
  {
    name: 'webSearchTool',
    description: 'Performs a location-aware web search to find area-specific information, current events, special activities, dress codes, historical context, or other details not available in Google Places API. Automatically incorporates location and radius into search queries.',
    inputSchema: z.object({ 
      query: z.string().describe('The base search query (e.g., "outdoor activities", "food scene", "events this weekend")'),
      centerLat: z.number().describe('Latitude of the search center point'),
      centerLng: z.number().describe('Longitude of the search center point'),
      radiusKm: z.number().describe('Search radius in kilometers - used to determine location specificity'),
      locationContext: z.string().optional().describe('Optional location context string (e.g., "San Francisco", "downtown Chicago") to enhance search')
    }),
    outputSchema: z.object({ 
      results: z.array(z.string()).describe('Array of relevant search result snippets'),
      searchQuery: z.string().describe('The actual search query that was used')
    }),
  },
  async (input) => {
    console.log(`[webSearchTool] Called with input:`, JSON.stringify(input, null, 2));
    
    // Import the location helper to get city information
    const { getCityFromCoordinates } = await import('@/utils/locationHelpers');
    
    // Construct location-aware search query with precise location targeting
    let enhancedQuery = input.query;
    let locationSpecifier = '';
    
    // Create progressively more specific location targeting based on radius
    if (input.radiusKm <= 2) {
      // Ultra-local: use coordinates for maximum precision
      locationSpecifier = `${input.centerLat.toFixed(4)}, ${input.centerLng.toFixed(4)}`;
      enhancedQuery = `${input.query} near coordinates ${locationSpecifier} ${input.radiusKm}km radius`;
    } else if (input.radiusKm <= 5) {
      // Very local: use detailed location with coordinates as backup
      if (input.locationContext && input.locationContext.length > 10) {
        // Use the full location context if it's detailed enough
        locationSpecifier = input.locationContext;
        enhancedQuery = `${input.query} near "${locationSpecifier}" ${input.radiusKm}km radius`;
      } else {
        // Use coordinates for precision
        locationSpecifier = `${input.centerLat.toFixed(3)}, ${input.centerLng.toFixed(3)}`;
        enhancedQuery = `${input.query} near ${locationSpecifier} within ${input.radiusKm}km`;
      }
    } else if (input.radiusKm <= 10) {
      // Local area: use neighborhood/district level if available
      const identifiedCity = getCityFromCoordinates(input.centerLat, input.centerLng);
      if (input.locationContext && input.locationContext.includes(',')) {
        // Extract neighborhood or district from location context
        const locationParts = input.locationContext.split(',').map(part => part.trim());
        if (locationParts.length >= 2) {
          locationSpecifier = `${locationParts[0]}, ${locationParts[1]}`;
        } else {
          locationSpecifier = locationParts[0];
        }
      } else if (identifiedCity) {
        locationSpecifier = identifiedCity;
      } else {
        locationSpecifier = `area around ${input.centerLat.toFixed(2)}, ${input.centerLng.toFixed(2)}`;
      }
      enhancedQuery = `${input.query} in ${locationSpecifier} ${input.radiusKm}km area`;
    } else {
      // City/regional level: broader search
      const identifiedCity = getCityFromCoordinates(input.centerLat, input.centerLng);
      if (identifiedCity) {
        locationSpecifier = identifiedCity.split(',')[0]; // Just city name for broader searches
        enhancedQuery = `${input.query} ${locationSpecifier} region`;
      } else if (input.locationContext) {
        locationSpecifier = input.locationContext.split(',')[0];
        enhancedQuery = `${input.query} ${locationSpecifier} area`;
      } else {
        locationSpecifier = `${input.centerLat.toFixed(1)}, ${input.centerLng.toFixed(1)}`;
        enhancedQuery = `${input.query} near ${locationSpecifier} region`;
      }
    }
    
    // Add current year for more relevant results
    const currentYear = new Date().getFullYear();
    enhancedQuery += ` ${currentYear}`;
    
    console.log(`[webSearchTool] Location targeting strategy:`, {
      radiusKm: input.radiusKm,
      strategy: input.radiusKm <= 2 ? 'ultra-local-coordinates' : 
               input.radiusKm <= 5 ? 'very-local-detailed' :
               input.radiusKm <= 10 ? 'neighborhood-level' : 'city-regional',
      originalQuery: input.query,
      enhancedQuery,
      locationSpecifier
    });
    
    try {
      const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
      const searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
      
      if (!apiKey || !searchEngineId) {
        console.warn('[webSearchTool] Google Custom Search API credentials not found, using fallback results');
        return { 
          results: [
            `Location-aware search for "${enhancedQuery}" - API credentials not configured`,
            'Please set GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID environment variables'
          ],
          searchQuery: enhancedQuery
        };
      }
      
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(enhancedQuery)}&num=5`;
      
      console.log(`[webSearchTool] Making location-aware search request for: "${enhancedQuery}"`);
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[webSearchTool] Google Custom Search API error ${response.status}: ${errorText}`);
        
        // Handle specific error cases
        if (response.status === 403) {
          return { 
            results: [`Search quota exceeded or API key invalid for: ${enhancedQuery}`],
            searchQuery: enhancedQuery
          };
        }
        if (response.status === 400) {
          return { 
            results: [`Invalid search query: ${enhancedQuery}`],
            searchQuery: enhancedQuery
          };
        }
        
        return { 
          results: [`Search API error for: ${enhancedQuery}`],
          searchQuery: enhancedQuery
        };
      }
      
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const searchResults = data.items.map((item: any) => {
          // Combine title and snippet for more context
          return item.snippet ? `${item.title}: ${item.snippet}` : item.title;
        }).filter(Boolean);
        
        console.log(`[webSearchTool] Found ${searchResults.length} results for location-aware query: "${enhancedQuery}"`);
        return { 
          results: searchResults,
          searchQuery: enhancedQuery
        };
      } else {
        console.log(`[webSearchTool] No results found for: "${enhancedQuery}"`);
        return { 
          results: [`No current information found for: ${enhancedQuery}`],
          searchQuery: enhancedQuery
        };
      }
      
    } catch (error) {
      console.error(`[webSearchTool] Error performing search:`, error);
      return { 
        results: [`Unable to search for current information about: ${enhancedQuery}`],
        searchQuery: enhancedQuery
      };
    }
  }
);

/*
PRODUCTION SEARCH API INTEGRATION EXAMPLES:

// Option 1: Google Custom Search API
async function googleCustomSearch(query: string) {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=5`;
  
  const response = await fetch(url);
  const data = await response.json();
  return data.items?.map((item: any) => item.snippet) || [];
}

// Option 2: Tavily Search API (AI-optimized)
async function tavilySearch(query: string) {
  const apiKey = process.env.TAVILY_API_KEY;
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      query,
      search_depth: 'basic',
      include_answer: true,
      max_results: 5
    })
  });
  
  const data = await response.json();
  return data.results?.map((result: any) => result.content) || [];
}

// Option 3: SerpAPI (Google Search Results)
async function serpApiSearch(query: string) {
  const apiKey = process.env.SERPAPI_API_KEY;
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${apiKey}&num=5`;
  
  const response = await fetch(url);
  const data = await response.json();
  return data.organic_results?.map((result: any) => result.snippet) || [];
}

// To use a real search API, replace the simulatedResults with:
// const searchResults = await googleCustomSearch(input.query);
// return { results: searchResults };
*/

const fetchPlaceDetailsTool = ai.defineTool(
  {
    name: 'fetchPlaceDetails',
    description: 'Fetches detailed information about a specific place (restaurant, park, landmark, etc.) using its name or Google Place ID. Use this for each potential itinerary stop to get address, coordinates, photo reference, rating, opening hours, operational status, and other useful details. This is critical for planning.',
    inputSchema: FetchPlaceDetailsInputSchema,
    outputSchema: FetchPlaceDetailsOutputSchema,
  },
  async (input) => {
    console.log('[fetchPlaceDetailsTool] Called with input:', JSON.stringify(input, null, 2));
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("[fetchPlaceDetailsTool] API key NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing.");
      return { success: false, error: "API key missing" };
    }

    let placeId = input.placeNameOrId;

    // If not a Place ID (usually starts with "ChIJ"), try Text Search first
    if (!input.placeNameOrId.startsWith("ChIJ")) {
      let textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(input.placeNameOrId)}&key=${apiKey}`;
      if (input.locationHint?.lat && input.locationHint?.lng) {
        // Using locationbias=circle:radius@lat,lng for better biasing
        const radiusMeters = (input.searchRadiusKm || 50) * 1000; // Convert km to meters, default to 50km
        textSearchUrl += `&locationbias=circle:${radiusMeters}@${input.locationHint.lat},${input.locationHint.lng}`;
        console.log(`[fetchPlaceDetailsTool] Using search radius: ${input.searchRadiusKm || 50}km (${radiusMeters}m)`);
      }
      console.log("[fetchPlaceDetailsTool] Text Search URL:", textSearchUrl);
      try {
        const searchRes = await fetch(textSearchUrl);
        if (!searchRes.ok) {
          const errorBody = await searchRes.text();
          console.error(`[fetchPlaceDetailsTool] Text search API error ${searchRes.status}: ${errorBody}`);
          
          // Handle specific error codes
          if (searchRes.status === 403) {
            return { success: false, error: `Google Maps API access denied (403). Check API key permissions, billing, and quota limits.` };
          }
          return { success: false, error: `Text search API error: ${searchRes.statusText} - ${errorBody}` };
        }
        const searchData = await searchRes.json();
        
        // Check for API-specific error statuses
        if (searchData.status === 'REQUEST_DENIED') {
          console.error(`[fetchPlaceDetailsTool] API request denied: ${searchData.error_message || 'Unknown reason'}`);
          return { success: false, error: `Google Maps API request denied: ${searchData.error_message || 'Check API key and billing'}` };
        }
        if (searchData.status === 'OVER_QUERY_LIMIT') {
          console.error(`[fetchPlaceDetailsTool] API quota exceeded`);
          return { success: false, error: `Google Maps API quota exceeded. Please try again later.` };
        }
        
        if (searchData.results && searchData.results.length > 0) {
          placeId = searchData.results[0].place_id;
          console.log(`[fetchPlaceDetailsTool] Text Search successful. Place ID for "${input.placeNameOrId}": ${placeId}`);
        } else {
          console.warn(`[fetchPlaceDetailsTool] No place found via Text Search for name: ${input.placeNameOrId}. Status: ${searchData.status}`);
          return { success: false, error: `No place found via Text Search for name: ${input.placeNameOrId}. Status: ${searchData.status}` };
        }
      } catch (e: any) {
        console.error("[fetchPlaceDetailsTool] Text search API fetch error:", e);
        return { success: false, error: `Text search API fetch error: ${e.message}` };
      }
    }
    
    if (!placeId) { // If still no placeId after Text Search
      return { success: false, error: `Could not determine Place ID for: ${input.placeNameOrId}`};
    }

    const fieldsToFetch = input.fields?.join(',') || 'place_id,name,formatted_address,address_components,geometry,photos,rating,user_ratings_total,opening_hours,business_status,types,website,international_phone_number,price_level';
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fieldsToFetch}&key=${apiKey}&language=en`;
    console.log("[fetchPlaceDetailsTool] Place Details URL:", detailsUrl);

    try {
      const detailsRes = await fetch(detailsUrl);
      if (!detailsRes.ok) {
        const errorBody = await detailsRes.text();
        console.error(`[fetchPlaceDetailsTool] Place details API error ${detailsRes.status}: ${errorBody}`);
        
        // Handle specific error codes
        if (detailsRes.status === 403) {
          return { success: false, error: `Google Maps API access denied (403). Check API key permissions, billing, and quota limits.` };
        }
        return { success: false, error: `Place details API error: ${detailsRes.statusText} - ${errorBody}` };
      }
      const detailsData = await detailsRes.json();
      
      // Check for API-specific error statuses
      if (detailsData.status === 'REQUEST_DENIED') {
        console.error(`[fetchPlaceDetailsTool] Place details request denied: ${detailsData.error_message || 'Unknown reason'}`);
        return { success: false, error: `Google Maps API request denied: ${detailsData.error_message || 'Check API key and billing'}` };
      }
      if (detailsData.status === 'OVER_QUERY_LIMIT') {
        console.error(`[fetchPlaceDetailsTool] Place details quota exceeded`);
        return { success: false, error: `Google Maps API quota exceeded. Please try again later.` };
      }

      if (detailsData.result) {
        const place = detailsData.result;
        const cityComponent = place.address_components?.find((c: any) => c.types.includes('locality') || c.types.includes('postal_town'));
        const city = cityComponent ? cityComponent.long_name : place.address_components?.find((c: any) => c.types.includes('administrative_area_level_2'))?.long_name || null;
        
        // Generate photo URL if photo reference is available
        let photoUrl = null;
        if (place.photos?.[0]?.photo_reference) {
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          if (apiKey) {
            photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${encodeURIComponent(place.photos[0].photo_reference)}&key=${apiKey}`;
            console.log('[fetchPlaceDetailsTool] Generated photo URL for:', place.name);
          }
        }

        const output: z.infer<typeof FetchPlaceDetailsOutputSchema> = {
          success: true,
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address,
          city,
          lat: place.geometry?.location?.lat,
          lng: place.geometry?.location?.lng,
          photoReference: photoUrl, // Now stores the direct URL
          rating: place.rating,
          reviewCount: place.user_ratings_total,
          openingHours: place.opening_hours?.weekday_text,
          isOperational: place.business_status === "OPERATIONAL",
          statusText: place.business_status,
          types: place.types,
          website: place.website,
          phoneNumber: place.international_phone_number,
          priceLevel: place.price_level,
        };
        console.log('[fetchPlaceDetailsTool] Successfully fetched details for:', place.name);
        return output;
      } else {
        console.warn(`[fetchPlaceDetailsTool] Place details not found for ID: ${placeId}. Status: ${detailsData.status}, Error: ${detailsData.error_message}`);
        return { success: false, error: `Place details not found for ID: ${placeId}. Status: ${detailsData.status}. ${detailsData.error_message || ''}`.trim() };
      }
    } catch (e: any) {
      console.error("[fetchPlaceDetailsTool] Place details API fetch/parse error:", e);
      return { success: false, error: `Place details API fetch error: ${e.message}` };
    }
  }
);

// Tool for fetching directions
const FetchDirectionsInputSchema = z.object({
  originLat: z.number(),
  originLng: z.number(),
  destinationLat: z.number(),
  destinationLng: z.number(),
  mode: TransitModeSchema.default("driving").describe("Preferred mode of transport."),
  departureTime: z.string().datetime().optional().describe("Optional departure time in ISO format (UTC recommended) to get more accurate transit estimates, especially for public transport."),
});

const FetchDirectionsOutputSchema = z.object({
  success: z.boolean(),
  durationMinutes: z.number().optional().nullable().describe("Estimated travel time in minutes."),
  distanceText: z.string().optional().nullable().describe("Human-readable distance (e.g., '5.2 km')."),
  error: z.string().optional().nullable(),
});

const fetchDirectionsTool = ai.defineTool(
  {
    name: 'fetchDirections',
    description: 'Calculates the estimated travel time in minutes and distance between two geographic locations using a specified mode of transport (driving, walking, bicycling, transit). Use this to estimate travel time between itinerary stops.',
    inputSchema: FetchDirectionsInputSchema,
    outputSchema: FetchDirectionsOutputSchema,
  },
  async (input) => {
    console.log('[fetchDirectionsTool] Called with input:', JSON.stringify(input, null, 2));
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("[fetchDirectionsTool] API key NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing.");
      return { success: false, error: "API key missing" };
    }

    let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${input.originLat},${input.originLng}&destination=${input.destinationLat},${input.destinationLng}&mode=${input.mode}&key=${apiKey}`;
    if (input.departureTime && input.mode === 'transit') {
        try {
            const departureTimestamp = Math.floor(new Date(input.departureTime).getTime() / 1000);
            url += `&departure_time=${departureTimestamp}`;
            console.log(`[fetchDirectionsTool] Added departure_time: ${departureTimestamp} for transit.`);
        } catch (e) {
            console.warn("[fetchDirectionsTool] Could not parse departureTime for transit, proceeding without it:", input.departureTime, e);
        }
    }
    console.log("[fetchDirectionsTool] Directions API URL:", url);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const errorBody = await res.text();
        console.error(`[fetchDirectionsTool] Directions API error ${res.status}: ${errorBody}`);
        
        // Handle specific error codes
        if (res.status === 403) {
          return { success: false, error: `Google Maps API access denied (403). Check API key permissions, billing, and quota limits.` };
        }
        return { success: false, error: `Directions API error: ${res.statusText} - ${errorBody}` };
      }
      const data = await res.json();
      
      // Check for API-specific error statuses
      if (data.status === 'REQUEST_DENIED') {
        console.error(`[fetchDirectionsTool] Directions request denied: ${data.error_message || 'Unknown reason'}`);
        return { success: false, error: `Google Maps API request denied: ${data.error_message || 'Check API key and billing'}` };
      }
      if (data.status === 'OVER_QUERY_LIMIT') {
        console.error(`[fetchDirectionsTool] Directions quota exceeded`);
        return { success: false, error: `Google Maps API quota exceeded. Please try again later.` };
      }

      if (data.routes && data.routes.length > 0) {
        const leg = data.routes[0].legs[0];
        const durationMinutes = leg.duration ? Math.round(leg.duration.value / 60) : null;
        const distanceText = leg.distance ? leg.distance.text : null;
        console.log(`[fetchDirectionsTool] Directions found: ${durationMinutes} mins, ${distanceText}`);
        return { success: true, durationMinutes, distanceText };
      } else {
        console.warn(`[fetchDirectionsTool] Directions not found. Status: ${data.status}, Error: ${data.error_message}`);
        return { success: false, error: `Directions not found. Status: ${data.status}. ${data.error_message || ''}`.trim() };
      }
    } catch (e: any) {
      console.error("[fetchDirectionsTool] Directions API fetch/parse error:", e);
      return { success: false, error: `Directions API fetch error: ${e.message}` };
    }
  }
);


export async function generateFullPlan(input: GenerateFullPlanInput): Promise<GenerateFullPlanOutput> {
  return generateFullPlanFlow(input);
}

const generateFullPlanPrompt = ai.definePrompt({
  name: 'generateFullPlanPrompt',
  model: 'googleai/gemini-2.5-pro',
  input: { schema: GenerateFullPlanInputSchema },
  output: { schema: PlanOutputSchema },
  tools: [findPlacesNearbyTool, fetchPlaceDetailsTool, fetchDirectionsTool, webSearchTool],
  prompt: `You are an expert event planner AI. Your task is to generate a detailed event plan based on the user's request.

**IMPORTANT: UUID FORMAT REQUIREMENT**
All UUIDs must use valid hexadecimal characters (0-9, a-f) only. Format: 8-4-4-4-12 characters.
✅ CORRECT: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
❌ INCORRECT: "c1d3e4f5-g6h7-i8j9-k0l1-m2n3o4p5q6r7" (contains invalid characters g,h,i,j,k)

User's Initial Request:
- Plan Start Date/Time: {{{planDateTime}}}
- Desired Location/Area: {{{locationQuery}}} (Coordinates if provided by user: Lat: {{selectedLocationLat}}, Lng: {{selectedLocationLng}})
- Price Range: {{{priceRange}}}
- Search Radius around primary location (if provided): {{#if searchRadius}} {{{searchRadius}}} km {{else}} Not specified {{/if}}
- User's Preferred Plan Type: {{{planTypeHint}}}
- Specific Instructions/Wishes: {{{userPrompt}}}

Participant Information:
- Host {{#if hostProfile.name}}({{{hostProfile.name}}}){{/if}} (UID: {{{hostProfile.uid}}}):
  - General Preferences: {{#if hostProfile.preferences.length}}{{#each hostProfile.preferences}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None specified{{/if}}
  {{#if hostProfile.generalPreferences}}- Personal Notes: {{{hostProfile.generalPreferences}}}{{/if}}
  - Favorite Cuisines: {{#if hostProfile.favoriteCuisines.length}}{{#each hostProfile.favoriteCuisines}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None specified{{/if}}
  - Activity Preferences: {{#if hostProfile.activityTypePreferences.length}}{{#each hostProfile.activityTypePreferences}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None specified{{/if}}
  - Activity Dislikes: {{#if hostProfile.activityTypeDislikes.length}}{{#each hostProfile.activityTypeDislikes}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None specified{{/if}}
  - Dietary Restrictions: {{#if hostProfile.dietaryRestrictions.length}}{{#each hostProfile.dietaryRestrictions}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None{{/if}}
  - Allergies: {{#if hostProfile.allergies.length}}{{#each hostProfile.allergies}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None{{/if}}
  - Physical Considerations: {{#if hostProfile.physicalLimitations.length}}{{#each hostProfile.physicalLimitations}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None{{/if}}
  {{#if hostProfile.travelTolerance}}- Travel Tolerance: {{{hostProfile.travelTolerance}}}{{/if}}
  {{#if hostProfile.budgetFlexibilityNotes}}- Budget Notes: {{{hostProfile.budgetFlexibilityNotes}}}{{/if}}
  {{#if hostProfile.socialPreferences}}- Social Style: {{#if hostProfile.socialPreferences.preferredGroupSize}}Group Size: {{{hostProfile.socialPreferences.preferredGroupSize}}}{{/if}}{{#if hostProfile.socialPreferences.interactionLevel}}, Interaction: {{{hostProfile.socialPreferences.interactionLevel}}}{{/if}}{{/if}}
  {{#if hostProfile.availabilityNotes}}- Availability Notes: {{{hostProfile.availabilityNotes}}}{{/if}}

{{#if invitedFriendProfiles.length}}
- Invited Friends:
  {{#each invitedFriendProfiles}}
  - Friend{{#if this.name}} ({{{this.name}}}){{/if}} (UID: {{this.uid}}):
    - General Preferences: {{#if this.preferences.length}}{{#each this.preferences}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None specified{{/if}}
    {{#if this.generalPreferences}}- Personal Notes: {{{this.generalPreferences}}}{{/if}}
    - Favorite Cuisines: {{#if this.favoriteCuisines.length}}{{#each this.favoriteCuisines}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None specified{{/if}}
    - Activity Preferences: {{#if this.activityTypePreferences.length}}{{#each this.activityTypePreferences}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None specified{{/if}}
    - Activity Dislikes: {{#if this.activityTypeDislikes.length}}{{#each this.activityTypeDislikes}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None specified{{/if}}
    - Dietary Restrictions: {{#if this.dietaryRestrictions.length}}{{#each this.dietaryRestrictions}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None{{/if}}
    - Allergies: {{#if this.allergies.length}}{{#each this.allergies}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None{{/if}}
    - Physical Considerations: {{#if this.physicalLimitations.length}}{{#each this.physicalLimitations}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None{{/if}}
    {{#if this.travelTolerance}}- Travel Tolerance: {{{this.travelTolerance}}}{{/if}}
    {{#if this.socialPreferences}}- Social Style: {{#if this.socialPreferences.preferredGroupSize}}Group Size: {{{this.socialPreferences.preferredGroupSize}}}{{/if}}{{#if this.socialPreferences.interactionLevel}}, Interaction: {{{this.socialPreferences.interactionLevel}}}{{/if}}{{/if}}
  {{/each}}
{{else}}
- No friends invited for this plan.
{{/if}}

Your Goal:
Create a complete plan object. The plan should include a catchy title, a compelling description, and a detailed itinerary. 
Decide if the plan should be 'single-stop' or 'multi-stop' based on the user's 'planTypeHint'. If 'ai-decide', then decide based on the user's 'userPrompt' and what makes sense for the request. 
If the user prompt implies a single activity (e.g., "dinner at X"), prefer a single-stop plan. If it's more general (e.g., "day trip to Paris") and 'planTypeHint' is not 'single-stop', a multi-stop plan might be appropriate. If 'searchRadius' is provided, consider places within that radius of the 'locationQuery' or its coordinates.

Itinerary Instructions:
1.  **RADIUS-BASED PLACE DISCOVERY**: 
    - **PRIMARY**: Use 'findPlacesNearby' to discover places within the user's specified radius ({{{searchRadius}}} km) around their location ({{{selectedLocationLat}}}, {{{selectedLocationLng}}})
    - Use appropriate keywords/place types based on user's request and participants' interests:
      - Food: keyword="restaurant", "cafe", "food" or placeType="restaurant", "meal_takeaway"
      - Nature: keyword="park", "hiking", "nature" or placeType="park", "tourist_attraction"
      - Culture: keyword="museum", "art", "gallery" or placeType="museum", "tourist_attraction"
      - Entertainment: keyword="entertainment", "music" or placeType="amusement_park", "night_club"
    - **SECONDARY**: Use 'webSearchTool' only for context/background information about the area or specific venues found
      - ALWAYS pass centerLat: {{{selectedLocationLat}}}, centerLng: {{{selectedLocationLng}}}, radiusKm: {{{searchRadius}}} to webSearchTool
      - Use locationContext from locationQuery if available: {{{locationQuery}}}
    
    **SEARCH RADIUS USAGE**: 
    - ALWAYS use the user's searchRadius ({{{searchRadius}}} km) when calling 'findPlacesNearby'
    - When calling 'fetchPlaceDetails', pass searchRadiusKm: {{{searchRadius}}} to bias results within the user's preferred area
    - If searchRadius is null, default to 8km for findPlacesNearby and fetchPlaceDetails
    
    **LOCATION QUERY HANDLING**: 
    - Center all searches around selectedLocationLat: {{{selectedLocationLat}}}, selectedLocationLng: {{{selectedLocationLng}}}
    - Use these coordinates as the center point for the radius search, regardless of how locationQuery is formatted
    - The locationQuery string is just for display - always use the precise coordinates for actual searching

2.  For each itinerary stop:
    a.  Use 'fetchPlaceDetails' with the place names/IDs from 'findPlacesNearby' to get complete details (address, hours, ratings, etc.)
    b.  **ALWAYS pass searchRadiusKm: {{{searchRadius}}}** to 'fetchPlaceDetails' to ensure results stay within the user's preferred area
    c.  **LIMIT ADDITIONAL SEARCHES**: Only use 'webSearchTool' for background context about venues or area-specific information
    d.  Crucially, CHECK THE OPENING HOURS from the 'fetchPlaceDetails' tool's output against the planned 'startTime' and 'endTime' for the stop. Ensure the place is open. If not, pick an alternative or adjust times. If a place is not operational ('isOperational': false), do not include it.
    e.  Set a default DURATION of 60 minutes ('durationMinutes': 60) for each stop unless the user's prompt or place type clearly suggests otherwise (e.g., a quick coffee vs. a museum visit).
    f.  Calculate 'endTime' based on 'startTime' and 'durationMinutes'. Ensure 'endTime' is always after 'startTime'. Times should be in ISO 8601 format.
    g.  Populate all relevant fields in the ItineraryItem schema using data from the 'fetchPlaceDetails' tool: 'placeName', 'address', 'city', 'lat', 'lng', 'googlePlaceId', 'rating', 'reviewCount', 'openingHours', 'isOperational', 'statusText', 'types', 'website', 'phoneNumber', 'priceLevel'. IMPORTANT: Do NOT set 'googlePhotoReference' - leave it null to allow the frontend auto-refresh logic to handle photos using the reliable getUrl() method and avoid 400 errors from expired photo references.
    h.  First, create a concise 'tagline' (no more than 80 characters) that captures the essence of this stop in the context of the full itinerary (e.g., 'Kick-off with artisanal coffee'). Then generate 2–3 concise 'activitySuggestions' tailored to the participants' combined preferences and the place type. **CRITICAL: Use the detailed participant profile information to make highly personalized suggestions:**
        - **Dietary Considerations**: If participants have specific dietary restrictions or allergies, mention suitable options (e.g., "🌱 Ask about their excellent vegan options" for vegetarian/vegan participants)
        - **Activity Preferences**: Match suggestions to stated activity preferences (e.g., "📸 Perfect spot for photography" if someone likes photography)
        - **Social Style**: Consider group dynamics and interaction preferences (e.g., quiet spots for introverted participants, interactive experiences for social ones)
        - **Physical Limitations**: Suggest accessibility-friendly activities if participants have mobility concerns
        - **Cuisine Preferences**: For food venues, highlight specific cuisines that match participants' favorites
        - **Budget Consciousness**: Consider budget flexibility notes when suggesting premium vs. budget-friendly options
        Each suggestion should start with a relevant emoji and be highly specific to both the venue AND the participants' needs.
    i.  For multi-stop plans, after the first stop, use the 'fetchDirections' tool to estimate 'transitTimeFromPreviousMinutes' from the previous stop's location to the current stop's location. Pick a sensible default 'transitMode' (usually 'driving' or 'walking' if close by, e.g. under 2km). Adjust the 'startTime' of the current stop accordingly (it should be previous stop's endTime + transitTime). Also set the 'transitMode' field for the current itinerary item.
3.  **IMPORTANT**: If the user provided a specific venue in 'locationQuery' (e.g., "dinner at Le Bernardin"), use that as your primary stop and search around it. If it's a general location (e.g., "Paris", "downtown Chicago"), use that as the area for your place discovery searches.

4.  The itinerary must be CHRONOLOGICAL. Ensure 'startTime' and 'endTime' for each stop are in valid ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DDTHH:mm).
5.  The first itinerary item's 'startTime' should generally match the user's requested 'planDateTime'. Its 'placeName', 'address', and 'city' should be based on the 'locationQuery' and details from 'fetchPlaceDetailsTool'. Its 'transitTimeFromPreviousMinutes' should be null.
6.  Generate a unique UUID for each itinerary item's 'id' field. UUIDs must be valid format: 8-4-4-4-12 hexadecimal characters (0-9, a-f only). Example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890".

Main Plan Object Fields:
-   'id': Generate a new unique UUID for this plan. Must be valid format: 8-4-4-4-12 hexadecimal characters (0-9, a-f only).
-   'name': A catchy and relevant title for the plan (e.g., "Parisian Adventure Day", "SoHo Culinary Exploration").
-   'description': An engaging summary of the overall plan and what participants can expect. **Use information from the 'webSearchTool' to enrich this description with interesting facts, current events, or special details that make the plan more appealing.**
-   'eventTime': Should be the 'startTime' of the first itinerary item.
-   'location': Should be the 'placeName' of the first itinerary item.
-   'city': Should be the 'city' of the first itinerary item.
-   'eventType': A suitable category for the plan (e.g., "Weekend Getaway", "Birthday Dinner", "City Tour").
-   'priceRange': As specified by the user, or estimate if not provided.
-   'hostId': {{{hostProfile.uid}}}
-   'invitedParticipantUserIds': [{{#if invitedFriendProfiles.length}}{{#each invitedFriendProfiles}}"{{this.uid}}"{{#unless @last}}, {{/unless}}{{/each}}{{/if}}].
-   'itinerary': The array of itinerary item objects you constructed. Must contain at least one item. **The 'description' and 'activitySuggestions' for each item should be enhanced with details discovered using the 'webSearchTool'.**
-   'status': Set to 'published'.
-   'planType': Determine if it's 'single-stop' or 'multi-stop' based on the itinerary you generate and user's 'planTypeHint' if it's not 'ai-decide'.

**CRITICAL: TOOL USAGE LIMIT**
You have a maximum of 6 total tool calls. Use them efficiently:
- 1 findPlacesNearby call for radius-based place discovery
- 1-2 fetchPlaceDetails calls for venue information (remember to pass searchRadiusKm)
- 1 fetchDirections call (if multi-stop plan)
- 1 webSearchTool call (only if needed for context)
- Save remaining calls for critical needs only

**PREFERENCE-DRIVEN SEARCH STRATEGY:**
Use participant profiles to inform your search approach:

1. **Cuisine-Based Searches**: If participants have favorite cuisines, use specific keywords:
   - Italian lovers: keyword="italian restaurant", "pizza", "pasta"
   - Asian cuisine: keyword="sushi", "ramen", "thai restaurant"
   - Vegetarian/Vegan: keyword="vegetarian restaurant", "vegan food"

2. **Activity-Based Searches**: Match to stated activity preferences:
   - Photography enthusiasts: keyword="scenic viewpoints", "instagram spots"
   - Fitness/Active: keyword="hiking", "bike rental", "outdoor sports"
   - Arts/Culture: placeType="museum", keyword="art gallery", "theater"
   - Music lovers: keyword="live music", "record store", "concert venue"

3. **Social Style Considerations**:
   - Large group preferred: Look for spacious venues, group-friendly activities
   - Intimate settings: Focus on cozy cafes, small galleries, quiet parks
   - High interaction: Interactive experiences, cooking classes, group activities
   - Low interaction: Museums, scenic walks, observation experiences

4. **Accessibility & Physical Considerations**:
   - Physical limitations: Prioritize accessible venues, shorter walking distances
   - Environmental sensitivities: Avoid loud/crowded places if mentioned

5. **Budget-Conscious Searches**:
   - Budget flexible: Include premium options (priceLevel 3-4)
   - Budget conscious: Focus on free/low-cost activities, priceLevel 0-2

**STANDARD SEARCH CATEGORIES:**
- **Food/Dining**: findPlacesNearby(keyword="restaurant"), webSearchTool("food scene", "hidden gems cuisine")
- **Culture/Arts**: findPlacesNearby(placeType="museum"), webSearchTool("art galleries", "cultural events")
- **Music/Nightlife**: findPlacesNearby(keyword="music"), webSearchTool("live music venues", "nightlife")
- **Adventure/Outdoor**: findPlacesNearby(placeType="park"), webSearchTool("hiking trails", "outdoor activities")
- **Shopping**: findPlacesNearby(keyword="shopping"), webSearchTool("local boutiques", "markets")

Adhere strictly to the output schema. Ensure all required fields are present. Make the plan exciting and well-suited to the users!
If the user's location query is very general (e.g., "Paris"), use web search to discover interesting starting points before using 'fetchPlaceDetailsTool'.
**CRITICALLY IMPORTANT**: Prioritize venues discovered through web search that match user preferences (host and friends) over generic Google Places results.
If the user asks for a specific number of stops, try to adhere to it. If not specified, 1-3 stops for a multi-stop plan is reasonable unless 'planTypeHint' is 'single-stop'.
For each itinerary item, use the 'name' from 'fetchPlaceDetailsTool' for the 'placeName' field of the itinerary item.
The 'lat' and 'lng' for each itinerary item should come from the 'fetchPlaceDetailsTool'.
`,
});

const generateFullPlanFlow = ai.defineFlow(
  {
    name: 'generateFullPlanFlow',
    inputSchema: GenerateFullPlanInputSchema,
    outputSchema: PlanOutputSchema, // Use the renamed output schema
  },
  async (input) => {
    console.log('[generateFullPlanFlow] Input received:', JSON.stringify(input, null, 2));
    
    try {
      const result = await generateFullPlanPrompt(input);
      const { output } = result;
      const history = (result as any).history;

      if (history) {
        history.forEach((event: any, index: number) => {
          console.log(`[generateFullPlanFlow] History Event ${index}:`, event.type);
          if(event.type === 'toolRequest') console.log(`Tool Request: ${event.data.toolRequest.name} with input ${JSON.stringify(event.data.toolRequest.input)}`);
          if(event.type === 'toolResponse') console.log(`Tool Response: ${event.data.toolResponse.name} with output ${JSON.stringify(event.data.toolResponse.output)}`);
        });
      }

      if (!output) {
        console.error('[generateFullPlanFlow] AI failed to generate a plan structure.');
        throw new Error('AI failed to generate a plan structure.');
      }
      console.log('[generateFullPlanFlow] AI Output (raw):', JSON.stringify(output, null, 2));
      
      // Cast and perform minor cleanups/defaults
      const finalPlan = output as Plan;
      
      // Set timestamps and derived fields
      finalPlan.createdAt = new Date().toISOString();
      finalPlan.updatedAt = new Date().toISOString();
      finalPlan.eventTypeLowercase = finalPlan.eventType?.toLowerCase() || 'general';
      finalPlan.hostId = input.hostProfile.uid; 

      if (!finalPlan.id) {
        finalPlan.id = crypto.randomUUID();
      }

      if (!finalPlan.itinerary || finalPlan.itinerary.length === 0) {
        console.warn('[generateFullPlanFlow] AI generated an empty itinerary. Attempting fallback with locationQuery.');
        if (input.locationQuery) {
            finalPlan.itinerary = [{
                id: crypto.randomUUID(),
                placeName: input.locationQuery,
                startTime: input.planDateTime,
                durationMinutes: 60,
                endTime: new Date(new Date(input.planDateTime).getTime() + 60 * 60000).toISOString(),
                description: "Default stop based on user query. AI failed to elaborate.",
                activitySuggestions: ["Explore the area", "Grab a coffee"],
                address: null, city: null, googlePlaceId: null,
                lat: input.selectedLocationLat, lng: input.selectedLocationLng,
                googlePhotoReference: null, googleMapsImageUrl: null,
                rating: null, reviewCount: null, isOperational: null, statusText: null, openingHours: [],
                phoneNumber: null, website: null, priceLevel: null, types: [], notes: null, transitTimeFromPreviousMinutes: null, transitMode: 'driving'
            } as ItineraryItem];
            finalPlan.planType = 'single-stop'; 
        } else {
            throw new Error('AI generated an empty itinerary and no location query was provided for fallback.');
        }
      }
      
      finalPlan.itinerary.forEach(item => {
        if (!item.id) item.id = crypto.randomUUID();
        item.durationMinutes = item.durationMinutes ?? 60;
        item.transitMode = item.transitMode ?? 'driving';
        item.activitySuggestions = item.activitySuggestions ?? [];
        item.openingHours = item.openingHours ?? [];
        item.types = item.types ?? [];

        if (item.startTime && !item.endTime && typeof item.durationMinutes === 'number') {
            const start = new Date(item.startTime);
            item.endTime = new Date(start.getTime() + item.durationMinutes * 60000).toISOString();
        } else if (!item.startTime && input.planDateTime) { 
            item.startTime = input.planDateTime; 
            if (!item.endTime && typeof item.durationMinutes === 'number') {
                const start = new Date(item.startTime);
                item.endTime = new Date(start.getTime() + item.durationMinutes * 60000).toISOString();
            }
        }
      });

      if (finalPlan.itinerary[0]?.startTime) {
        finalPlan.eventTime = finalPlan.itinerary[0].startTime;
      } else if (input.planDateTime) {
        finalPlan.eventTime = input.planDateTime; 
      }

      if (finalPlan.itinerary[0]?.placeName) {
          finalPlan.location = finalPlan.itinerary[0].placeName;
      } else if (input.locationQuery) {
          finalPlan.location = input.locationQuery; 
      }
      if (finalPlan.itinerary[0]?.city) {
          finalPlan.city = finalPlan.itinerary[0].city;
      } else if (input.locationQuery.includes(',')) { 
          finalPlan.city = input.locationQuery.split(',').pop()?.trim() || 'Unknown City';
      } else {
          finalPlan.city = 'Unknown City'; // Fallback if no comma and no city from first item
      }
      
      if (input.invitedFriendProfiles && input.invitedFriendProfiles.length > 0) {
          finalPlan.invitedParticipantUserIds = input.invitedFriendProfiles.map(p => p.uid);
      } else {
          finalPlan.invitedParticipantUserIds = [];
      }

      finalPlan.status = finalPlan.status || 'draft';
      finalPlan.planType = finalPlan.planType || (finalPlan.itinerary.length > 1 ? 'multi-stop' : 'single-stop');


      console.log('[generateFullPlanFlow] AI Output (processed):', JSON.stringify(finalPlan, null, 2));
      return finalPlan;
    } catch (error) {
      console.error('[generateFullPlanFlow] Error during flow execution:', error);
      throw error; 
    }
  }
);
