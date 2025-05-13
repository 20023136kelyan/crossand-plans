import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  GenerateFullPlanDetailsInputSchema,
  GenerateFullPlanDetailsInput,
  GenerateFullPlanDetailsOutputSchema,
  GenerateFullPlanDetailsOutput,
  ItineraryItem
} from './plan-types';
import { addHours, parseISO } from 'date-fns';

// Types for Google Maps API responses
interface GooglePlaceDetails {
  placeId: string;
  formattedAddress: string;
  location: {
    lat: number;
    lng: number;
  };
  formattedPhoneNumber?: string;
  website?: string;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  types?: string[];
  openingHours?: {
    open_now?: boolean;
    periods?: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
    weekday_text?: string[];
  };
  businessStatus?: string;
  url?: string;
}

// Types for the AI plan itinerary item before enrichment
interface AIItineraryItem {
  placeName: string;
  description?: string;
  activitySuggestions: string[];
  suggestedDuration?: number;
  suggestedOrder?: number;
}

// Helper function to calculate start time for itinerary items
function calculateStartTime(baseTime: string | undefined | null, orderIndex: number): string {
  const startDate = baseTime && parseISO(baseTime);
  if (!startDate || isNaN(startDate.getTime())) {
    const now = new Date();
    return addHours(now, orderIndex + 1).toISOString();
  }
  return addHours(startDate, orderIndex).toISOString();
}

// Helper function to search place details using Google Maps Places API
async function searchPlaceDetails(placeName: string, city?: string): Promise<GooglePlaceDetails | null> {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key is missing. Place details will not be fetched.');
    return null;
  }

  try {
    const searchQuery = city ? `${placeName} ${city}` : placeName;
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    
    const data = await response.json();
    
    if (!data.results?.[0]) {
      return null;
    }

    const place = data.results[0];
    
    // Get detailed place information
    const detailsResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_address,geometry,formatted_phone_number,website,rating,user_ratings_total,price_level,types,opening_hours,business_status,url&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    
    const detailsData = await detailsResponse.json();
    const details = detailsData.result;

    return {
      placeId: place.place_id,
      formattedAddress: details.formatted_address,
      location: {
        lat: details.geometry.location.lat,
        lng: details.geometry.location.lng
      },
      formattedPhoneNumber: details.formatted_phone_number,
      website: details.website,
      rating: details.rating,
      userRatingsTotal: details.user_ratings_total,
      priceLevel: details.price_level,
      types: details.types,
      openingHours: details.opening_hours,
      businessStatus: details.business_status,
      url: details.url
    };
  } catch (error) {
    console.error('Error fetching place details:', error);
    return null;
  }
}

// Define the prompt for generating full plan details
const generateFullPlanDetailsPrompt = ai.definePrompt({
  name: 'generateFullPlanDetailsPrompt',
  input: { schema: GenerateFullPlanDetailsInputSchema },
  output: { schema: GenerateFullPlanDetailsOutputSchema },
  prompt: `You are an expert event planner assistant. Your task is to generate a detailed plan based on the user's input and preferences.

User's Prompt: {{{userPrompt}}}

{{#if participantPreferences.length}}
Participant Preferences:
{{#each participantPreferences}}
- {{{this}}}
{{/each}}
{{/if}}

Plan Type: {{{planType}}}
{{#if priceRange}}Price Range: {{{priceRange}}}{{/if}}
{{#if userEnteredCity}}City: {{{userEnteredCity}}}{{/if}}
{{#if userSuggestedEventTime}}Suggested Time: {{{userSuggestedEventTime}}}{{/if}}

Please generate a detailed plan that includes:
1. A descriptive name for the plan
2. A brief description of the overall plan
3. The type of event
4. Location details
5. An itinerary with at least 2 stops, including:
   - Place names
   - Descriptions
   - Suggested activities
   - Suggested duration and order

Consider:
- The user's prompt and any specific requests
- Participant preferences and restrictions
- The specified plan type (single-stop or multi-stop)
- Price range if specified
- Location/city if specified
- Suggested time if specified

Return a structured plan following the schema.`
});

// Make the function internal by removing the export
async function generateFullPlanDetails(input: GenerateFullPlanDetailsInput): Promise<GenerateFullPlanDetailsOutput> {
  // Validate input
  const validatedInput = GenerateFullPlanDetailsInputSchema.parse(input);

  // 1. Generate initial plan structure using AI
  const result = await generateFullPlanDetailsPrompt(validatedInput);
  if (!result?.output) {
    throw new Error('Failed to generate plan details');
  }
  const aiPlan = result.output;

  // 2. For each itinerary item, fetch place details from Google Maps
  const enrichedItinerary = await Promise.all(
    (aiPlan.itinerary || []).map(async (item: AIItineraryItem) => {
      // Search for the place using Google Maps Places API
      const placeDetails = await searchPlaceDetails(item.placeName, validatedInput.userEnteredCity);
      
      if (!placeDetails) {
        return {
          ...item,
          startTime: calculateStartTime(validatedInput.userSuggestedEventTime, item.suggestedOrder ?? 0),
          duration: 60, // Fixed 1-hour duration
          status: 'UNKNOWN'
        } as ItineraryItem;
      }

      // Map Google Places data to our schema
      const enrichedItem: ItineraryItem = {
        placeName: item.placeName,
        description: item.description ?? '',
        suggestedDuration: item.suggestedDuration ?? 60,
        suggestedOrder: item.suggestedOrder ?? 0,
        duration: 60, // Fixed 1-hour duration
        status: placeDetails.businessStatus || 'UNKNOWN',
        startTime: calculateStartTime(validatedInput.userSuggestedEventTime, item.suggestedOrder ?? 0),
        placeId: placeDetails.placeId,
        address: placeDetails.formattedAddress,
        city: extractCityFromAddress(placeDetails.formattedAddress) || validatedInput.userEnteredCity || '',
        lat: placeDetails.location.lat,
        lng: placeDetails.location.lng,
        googlePlaceId: placeDetails.placeId,
        googleMapsUrl: placeDetails.url,
        phoneNumber: placeDetails.formattedPhoneNumber,
        website: placeDetails.website,
        rating: placeDetails.rating,
        userRatingsTotal: placeDetails.userRatingsTotal,
        priceLevel: placeDetails.priceLevel,
        types: placeDetails.types,
        openingHours: placeDetails.openingHours,
        activitySuggestions: item.activitySuggestions
      };

      return enrichedItem;
    })
  );

  // 3. Return the enriched plan with required fields
  return {
    name: aiPlan.name || 'Untitled Plan',
    description: aiPlan.description || 'No description provided',
    eventType: aiPlan.eventType || 'General Event',
    location: aiPlan.location,
    city: aiPlan.city,
    eventTime: aiPlan.eventTime,
    priceRange: aiPlan.priceRange,
    itinerary: enrichedItinerary
  };
}

// Helper function to extract city from formatted address
function extractCityFromAddress(formattedAddress: string): string | null {
  // Common format: "Street Address, City, State ZIP, Country"
  const parts = formattedAddress.split(',').map(part => part.trim());
  if (parts.length >= 2) {
    // Try to find the city part (usually before state/zip)
    const cityPart = parts[parts.length - 3] || parts[parts.length - 2];
    return cityPart || null;
  }
  return null;
}

// Export the flow
export const generateFullPlanDetailsFlow = ai.defineFlow(
  {
    name: 'generateFullPlanDetailsFlow',
    inputSchema: GenerateFullPlanDetailsInputSchema,
    outputSchema: GenerateFullPlanDetailsOutputSchema,
  },
  generateFullPlanDetails
); 