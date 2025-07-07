/**
 * @fileOverview Centralized AI tools for plan generation flows.
 * Contains all shared tools used by both regular and deep plan generation.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Exa } from 'exa-js';
import { analyzeUserIntentWithLLM, extractSpecificItemWithLLM } from '../lib/aiFlowUtils';

// Deep Planner specific schemas
const DeepPlaceDiscoveryInputSchema = z.object({
  query: z.string().describe("Search query for discovering places, venues, or activities"),
  city: z.string().optional().describe("City name to focus the search"),
  eventType: z.string().optional().describe("Type of event or activity"),
  date: z.string().optional().describe("Date for time-sensitive searches"),
  numResults: z.number().optional().default(5).describe("Number of results to return"),
  centerLat: z.number().optional().describe("Latitude of the search center for geographic filtering"),
  centerLng: z.number().optional().describe("Longitude of the search center for geographic filtering"),
  searchRadiusKm: z.number().optional().default(50).describe("Search radius in kilometers"),
  filters: z.object({
    domains: z.array(z.string()).optional().describe("List of domains to search"),
    recency: z.string().optional().describe("How recent the content should be"),
    dietaryRestrictions: z.array(z.string()).optional().describe("Dietary restrictions"),
    favoriteCuisines: z.array(z.string()).optional().describe("Favorite cuisines"),
    activityTypes: z.array(z.string()).optional().describe("Preferred activity types"),
    accessibilityNeeds: z.array(z.string()).optional().describe("Accessibility needs"),
    culturalPreferences: z.array(z.string()).optional().describe("Cultural preferences"),
    budgetRange: z.string().optional().describe("Budget range"),
    groupSize: z.number().optional().describe("Number of participants"),
    atmospherePreferences: z.array(z.string()).optional().describe("Atmosphere preferences"),
    travelTolerance: z.array(z.string()).optional().describe("Travel preferences"),
    activityTypeDislikes: z.array(z.string()).optional().describe("Activity types to avoid"),
    allergies: z.array(z.string()).optional().describe("Allergies to consider")
  }).optional().describe("Additional filters and preferences")
});

const DeepPlaceDiscoveryOutputSchema = z.object({
  discoveredPlaces: z.array(z.object({
    name: z.string().describe("Name of the discovered place"),
    description: z.string().describe("Description or context about the place"),
    source: z.string().describe("Source where this place was discovered"),
    url: z.string().optional().describe("URL where this place was mentioned"),
    relevance: z.number().describe("Relevance score (0-1)"),
    context: z.string().optional().describe("Additional context about the place")
  })).describe("Array of discovered places"),
  summary: z.string().describe("Summary of the discovery process"),
  suggestions: z.array(z.string()).describe("Suggestions for next steps")
});

// Shared tool definitions
export const findPlacesNearbyTool = ai.defineTool(
  {
    name: 'findPlacesNearby',
    description: 'Finds places within a specified radius around a center point. Use this to discover venues, restaurants, attractions, and activities within the user\'s search area. More effective than web search for finding actual places.',
    inputSchema: z.object({
      centerLat: z.number().describe("Latitude of the center point"),
      centerLng: z.number().describe("Longitude of the center point"),
      radiusKm: z.number().describe("Radius in kilometers to search within"),
      placeType: z.string().optional().describe("Optional place type filter (e.g., 'restaurant', 'tourist_attraction', 'park')"),
      keyword: z.string().optional().describe("Optional keyword to filter results (e.g., 'coffee', 'museum', 'outdoor')"),
      priceRange: z.enum(['$', '$$', '$$$', '$$$$', 'Free']).optional().describe("Optional price range filter to ensure places match user's budget"),
    }),
    outputSchema: z.object({
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
    }),
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
        // Define an interface for Google Places result items
        interface GooglePlaceResult {
          name: string;
          place_id: string;
          vicinity?: string;
          formatted_address?: string;
          geometry: {
            location: {
              lat: number;
              lng: number;
            }
          };
          rating?: number;
          price_level?: number;
          types?: string[];
          opening_hours?: {
            open_now?: boolean;
          };
        }
        
        let places = data.results.slice(0, 20).map((place: GooglePlaceResult) => ({
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
        
        // Filter by price range if specified
        if (input.priceRange) {
          const priceRangeMap: Record<string, number[]> = {
            'Free': [0],
            '$': [1],
            '$$': [1, 2],
            '$$$': [2, 3],
            '$$$$': [3, 4]
          };
          
          const allowedPriceLevels = priceRangeMap[input.priceRange] || [];
          
          // Define an interface for the place objects after mapping
          interface MappedPlace {
            name: string;
            placeId: string;
            address?: string;
            lat: number;
            lng: number;
            rating?: number;
            priceLevel?: number;
            types: string[];
            isOpen?: boolean;
          }
          
          // Special handling for 'Free'
          if (input.priceRange === 'Free') {
            places = places.filter((place: MappedPlace) => place.priceLevel === 0 || place.priceLevel === undefined || place.priceLevel === null);
          } else {
            // Filter by allowed price levels
            const filteredPlaces = places.filter((place: MappedPlace) => 
              place.priceLevel !== undefined && 
              place.priceLevel !== null && 
              allowedPriceLevels.includes(place.priceLevel)
            );
            
            // If we have enough results after filtering, use those; otherwise fall back to original results
            if (filteredPlaces.length >= 3) {
              places = filteredPlaces;
              console.log(`[findPlacesNearbyTool] Filtered to ${places.length} places matching price range ${input.priceRange}`);
            } else {
              console.log(`[findPlacesNearbyTool] Warning: Only ${filteredPlaces.length} places match price range ${input.priceRange}, using unfiltered results`);
            }
          }
        }
        
        // Limit to top 10 places
        places = places.slice(0, 10);
        
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

export const fetchPlaceDetailsTool = ai.defineTool(
  {
    name: 'fetchPlaceDetails',
    description: 'Fetches detailed information about a specific place using Google Places API. Use this to get complete details like address, hours, ratings, photos, and contact information for a venue.',
    inputSchema: z.object({
      placeNameOrId: z.string().describe("Name (e.g., 'Eiffel Tower, Paris') or Google Place ID of the location to get details for."),
      locationHint: z.object({ lat: z.number(), lng: z.number() }).optional().nullable().describe("Optional latitude/longitude to help disambiguate the place name, especially if only a name is provided."),
      searchRadiusKm: z.number().optional().nullable().describe("Search radius in kilometers around the locationHint. Used to bias results to nearby places. Defaults to 50km if not provided."),
      fields: z.array(z.string()).optional().default(['place_id', 'name', 'formatted_address', 'address_components', 'geometry', 'photos', 'rating', 'user_ratings_total', 'opening_hours', 'international_phone_number', 'website', 'price_level', 'types', 'business_status']).describe("Specific fields to fetch for the place."),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      placeId: z.string().optional().nullable(),
      name: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      lat: z.number().optional().nullable(),
      lng: z.number().optional().nullable(),
      googlePhotoReference: z.string().optional().nullable().describe("A direct Google Places Photo URL, if available from the 'fetchPlaceDetails' tool. This is a ready-to-use image URL."),
      googleMapsImageUrl: z.string().optional().nullable().describe("A Google Maps static image URL for this place, if available."),
      rating: z.number().optional().nullable(),
      reviewCount: z.number().optional().nullable(),
      openingHours: z.array(z.string()).optional().nullable().describe("e.g., ['Monday: 9:00 AM – 5:00 PM', ...]"),
      isOperational: z.boolean().optional().nullable().describe("True if business_status is OPERATIONAL."),
      statusText: z.string().optional().nullable().describe("Raw business_status string from Google."),
      types: z.array(z.string()).optional().nullable(),
      website: z.string().url().optional().nullable(),
      phoneNumber: z.string().optional().nullable(),
      priceLevel: z.number().optional().nullable(),
      utcOffsetMinutes: z.number().optional().nullable(),
      photoReference: z.string().optional().nullable(),
      error: z.string().optional().nullable(),
    }),
  },
  async (input) => {
    console.log('[fetchPlaceDetailsTool] Called with input:', JSON.stringify(input, null, 2));
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("[fetchPlaceDetailsTool] API key NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing.");
      return { success: false, error: "API key missing" };
    }

    let placeId = input.placeNameOrId;
    
    // If it's not a Place ID, search for it first
    if (!placeId.startsWith('ChIJ')) {
      try {
        const searchQuery = input.locationHint 
          ? `${input.placeNameOrId} near ${input.locationHint.lat},${input.locationHint.lng}`
          : input.placeNameOrId;
        
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`;
        console.log('[fetchPlaceDetailsTool] Text Search URL:', searchUrl);
        
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) {
          console.error(`[fetchPlaceDetailsTool] Text search API error ${searchResponse.status}: ${searchResponse.statusText}`);
          return { success: false, error: `Text search API error: ${searchResponse.statusText}` };
        }
        
        const searchData = await searchResponse.json();
        
        if (searchData.status === 'REQUEST_DENIED') {
          console.error(`[fetchPlaceDetailsTool] Text search API request denied: ${searchData.error_message || 'Unknown reason'}`);
          return { success: false, error: `Google Maps API request denied: ${searchData.error_message || 'Check API key and billing'}` };
        }
        if (searchData.status === 'OVER_QUERY_LIMIT') {
          console.error(`[fetchPlaceDetailsTool] Text search API quota exceeded`);
          return { success: false, error: `Google Maps API quota exceeded. Please try again later.` };
        }
        
        if (searchData.results && searchData.results.length > 0) {
          placeId = searchData.results[0].place_id;
          console.log(`[fetchPlaceDetailsTool] Found Place ID: ${placeId}`);
        } else {
          console.log(`[fetchPlaceDetailsTool] No place found for query: ${input.placeNameOrId}`);
          return { success: false, error: `No place found for: ${input.placeNameOrId}` };
        }
      } catch (error: any) {
        console.error('[fetchPlaceDetailsTool] Text search error:', error);
        return { success: false, error: `Text search error: ${error.message}` };
      }
    }

    // Now fetch the place details
    try {
      // Apply default fields if not provided by AI model
      const defaultFields = ['place_id', 'name', 'formatted_address', 'address_components', 'geometry', 'photos', 'rating', 'user_ratings_total', 'opening_hours', 'international_phone_number', 'website', 'price_level', 'types', 'business_status'];
      const fields = input.fields || defaultFields;
      const fieldsString = fields.join(',');
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fieldsString}&key=${apiKey}`;
      console.log('[fetchPlaceDetailsTool] Details URL:', detailsUrl);
      
      const detailsResponse = await fetch(detailsUrl);
      if (!detailsResponse.ok) {
        console.error(`[fetchPlaceDetailsTool] Details API error ${detailsResponse.status}: ${detailsResponse.statusText}`);
        return { success: false, error: `Details API error: ${detailsResponse.statusText}` };
      }
      
      const detailsData = await detailsResponse.json();
      
      if (detailsData.status === 'REQUEST_DENIED') {
        console.error(`[fetchPlaceDetailsTool] Details API request denied: ${detailsData.error_message || 'Unknown reason'}`);
        return { success: false, error: `Google Maps API request denied: ${detailsData.error_message || 'Check API key and billing'}` };
      }
      if (detailsData.status === 'OVER_QUERY_LIMIT') {
        console.error(`[fetchPlaceDetailsTool] Details API quota exceeded`);
        return { success: false, error: `Google Maps API quota exceeded. Please try again later.` };
      }
      
      if (detailsData.result) {
        const place = detailsData.result;
        const result = {
          success: true,
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address,
          city: place.address_components?.find((comp: any) => comp.types.includes('locality'))?.long_name || null,
          lat: place.geometry?.location?.lat || null,
          lng: place.geometry?.location?.lng || null,
          rating: place.rating || null,
          reviewCount: place.user_ratings_total || null,
          openingHours: place.opening_hours?.weekday_text || null,
          isOperational: place.business_status === 'OPERATIONAL',
          statusText: place.business_status || null,
          types: place.types || null,
          website: place.website || null,
          phoneNumber: place.international_phone_number || null,
          priceLevel: place.price_level || null,
          utcOffsetMinutes: place.utc_offset || null,
          photoReference: place.photos?.[0]?.photo_reference || null,
          googlePhotoReference: place.photos?.[0]?.photo_reference ? 
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${apiKey}` : null,
          googleMapsImageUrl: place.geometry?.location ? 
            `https://maps.googleapis.com/maps/api/staticmap?center=${place.geometry.location.lat},${place.geometry.location.lng}&zoom=15&size=400x300&markers=color:red%7C${place.geometry.location.lat},${place.geometry.location.lng}&key=${apiKey}` : null,
        };
        
        console.log(`[fetchPlaceDetailsTool] Successfully fetched details for: ${place.name}`);
        return result;
      } else {
        console.error(`[fetchPlaceDetailsTool] Details API call failed for Place ID: ${placeId}. Status: ${detailsData.status}, Error: ${detailsData.error_message || 'No error message provided.'}`);
        return { success: false, error: `Failed to fetch details from Google Places. Status: ${detailsData.status}.` };
      }
    } catch (error: any) {
      console.error('[fetchPlaceDetailsTool] Details fetch error:', error);
      return { success: false, error: `Details fetch error: ${error.message}` };
    }
  }
);

export const fetchDirectionsTool = ai.defineTool(
  {
    name: 'fetchDirections',
    description: 'Fetches directions between two points using Google Maps Directions API. Use this to calculate travel time and distance for multi-stop plans.',
    inputSchema: z.object({
      originLat: z.number().describe("Latitude of the origin point"),
      originLng: z.number().describe("Longitude of the origin point"),
      destinationLat: z.number().describe("Latitude of the destination point"),
      destinationLng: z.number().describe("Longitude of the destination point"),
      mode: z.enum(['driving', 'walking', 'bicycling', 'transit']).describe("Travel mode"),
      departureTime: z.string().optional().describe("Optional departure time in ISO format"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      durationMinutes: z.number().optional().nullable(),
      distanceText: z.string().optional().nullable(),
      error: z.string().optional().nullable(),
    }),
  },
  async (input) => {
    console.log('[fetchDirectionsTool] Called with input:', JSON.stringify(input, null, 2));
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("[fetchDirectionsTool] API key NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing.");
      return { success: false, error: "API key missing" };
    }

    try {
      const origin = `${input.originLat},${input.originLng}`;
      const destination = `${input.destinationLat},${input.destinationLng}`;
      let directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${input.mode}&key=${apiKey}`;
      
      if (input.departureTime) {
        directionsUrl += `&departure_time=${input.departureTime}`;
      }
      
      console.log('[fetchDirectionsTool] Directions URL:', directionsUrl);
      
      const response = await fetch(directionsUrl);
      if (!response.ok) {
        console.error(`[fetchDirectionsTool] Directions API error ${response.status}: ${response.statusText}`);
        return { success: false, error: `Directions API error: ${response.statusText}` };
      }
      
      const data = await response.json();
      
      if (data.status === 'REQUEST_DENIED') {
        console.error(`[fetchDirectionsTool] API request denied: ${data.error_message || 'Unknown reason'}`);
        return { success: false, error: `Google Maps API request denied: ${data.error_message || 'Check API key and billing'}` };
      }
      if (data.status === 'OVER_QUERY_LIMIT') {
        console.error(`[fetchDirectionsTool] API quota exceeded`);
        return { success: false, error: `Google Maps API quota exceeded. Please try again later.` };
      }
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        const result = {
          success: true,
          durationMinutes: Math.round(leg.duration.value / 60),
          distanceText: leg.distance.text,
        };
        
        console.log(`[fetchDirectionsTool] Route found: ${leg.distance.text} in ${result.durationMinutes} minutes`);
        return result;
      } else {
        console.log(`[fetchDirectionsTool] No route found between points`);
        return { success: false, error: `No route found between the specified points` };
      }
    } catch (error: any) {
      console.error('[fetchDirectionsTool] Directions fetch error:', error);
      return { success: false, error: `Directions fetch error: ${error.message}` };
    }
  }
);

export const webSearchTool = ai.defineTool(
  {
    name: 'webSearch',
    description: 'Web search for discovering places and experiences',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
      numResults: z.number().describe('Number of results to return'),
      city: z.string().optional().describe('City to focus the search on')
    }),
    outputSchema: z.object({
      success: z.boolean(),
      results: z.array(z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
        source: z.string()
      })),
      error: z.string().nullable()
    }),
  },
  async (input) => {
    console.log('[webSearchTool] Starting search with:', input);

    try {
      // Try Bing Search if configured
      const bingApiKey = process.env.BING_API_KEY;
      if (bingApiKey) {
        try {
          const bingUrl = new URL('https://api.bing.microsoft.com/v7.0/search');
          const searchQuery = input.city ? `${input.query} ${input.city}` : input.query;
          
          bingUrl.searchParams.append('q', searchQuery);
          bingUrl.searchParams.append('count', input.numResults.toString());
          bingUrl.searchParams.append('responseFilter', 'Webpages');
          bingUrl.searchParams.append('freshness', 'Month');
          
          const response = await fetch(bingUrl.toString(), {
            method: 'GET',
            headers: {
              'Ocp-Apim-Subscription-Key': bingApiKey,
            }
          });
          
          const data = await response.json();
          
          if (data.webPages?.value) {
            return {
              success: true,
              results: data.webPages.value.map((item: any) => ({
              title: item.name,
              url: item.url,
                snippet: item.snippet,
                source: 'Bing Search'
              })),
              error: null
            };
          }
        } catch (error) {
          console.warn('[webSearchTool] Bing Search API error:', error);
        }
      }
      
      // If Bing search failed or not configured, return empty results
      return {
        success: false,
        results: [],
        error: 'Web search not available'
      };
      
    } catch (error: any) {
      console.error('[webSearchTool] Web search error:', error);
      return { success: false, results: [], error: `Web search error: ${error.message}` };
    }
  }
);

export const exaSearchTool =
  ai.defineTool(
    {
      name: 'exaSearch',
      description: 'Semantic search using the Exa API',
      inputSchema: z.object({
        query: z.string(),
        numResults: z.number().optional().default(10),
        city: z.string().optional(),
        filters: z.object({
          domains: z.array(z.string()).optional(),
          recency: z.string().optional(),
          centerLat: z.number().optional(),
          centerLng: z.number().optional(),
          searchRadiusKm: z.number().optional(),
          district: z.string().optional(),
          crawlDepth: z.number().optional().describe('How many levels deep to crawl directory pages. Default is 0 (no crawl)'),
          followLinks: z.boolean().optional().describe('Whether to follow links on directory pages. Default is false')
        }).optional()
      }),
      outputSchema: z.object({
        success: z.boolean(),
        results: z.array(z.any()),
        contextualInfo: z.any(),
        error: z.string().nullable()
      })
    },
    async (input) => {
      console.log('[exaSearchTool] Starting search with:', input);

      try {
        const apiKey = process.env.EXA_API_KEY;
        if (!apiKey) {
          console.error('[exaSearchTool] No API key available');
          return {
            success: false,
            results: [],
            contextualInfo: {
              searchQuality: 0,
              coverage: {
                geographic: false,
                temporal: false,
                topical: false,
                culturalContext: false,
                demographicContext: false
              }
            },
            error: 'No API key available'
          };
        }

        // Add geographic filters if coordinates are provided
        const geoFilter = input.filters?.centerLat && input.filters?.centerLng && input.filters?.searchRadiusKm ? {
          location: {
            lat: input.filters.centerLat,
            lng: input.filters.centerLng,
            radiusKm: input.filters.searchRadiusKm
          }
        } : {};

        // Add crawling configuration
        const crawlConfig = {
          crawlDepth: input.filters?.crawlDepth || 0,
          followLinks: input.filters?.followLinks || false
        };

        const response = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query: input.query,
            numResults: input.numResults,
            city: input.city,
            filters: {
              ...input.filters,
              ...geoFilter
            },
            crawl: crawlConfig.crawlDepth > 0 ? {
              depth: crawlConfig.crawlDepth,
              follow_links: crawlConfig.followLinks,
              max_pages: crawlConfig.crawlDepth * 5 // Limit pages per depth level
            } : undefined
          }),
        });

        if (!response.ok) {
          console.error(`[exaSearchTool] Exa API error: ${response.statusText}`);
          return {
            success: false,
            results: [],
            contextualInfo: {
              searchQuality: 0,
              coverage: {
                geographic: false,
                temporal: false,
                topical: false,
                culturalContext: false,
                demographicContext: false
              }
            },
            error: `Exa API error: ${response.statusText}`
          };
        }
        
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          const results = data.results.map((item: any) => ({
            title: item.title,
            url: item.url,
            snippet: item.text || item.snippet || '',
            source: 'Exa Search',
            relevance: item.score || 0.8,
            locationInsights: extractLocationInsights(item.raw_content || item.text || '', 'Exa Search'),
            crawledPages: item.crawled_pages || [], // Store any crawled pages
            crawlDepth: item.depth || 0 // Store the depth at which this result was found
          }));
          
          return { 
            success: true, 
            results, 
            contextualInfo: {
              searchQuality: 0.8,
              coverage: {
                geographic: true,
                temporal: true,
                topical: true,
                culturalContext: true,
                demographicContext: true
              },
              crawlStats: {
                totalPagesFound: data.crawl_stats?.total_pages || 0,
                depthReached: data.crawl_stats?.max_depth || 0,
                directoryPages: data.crawl_stats?.directory_pages || 0
              }
            },
            error: null 
          };
        }
        
        return {
          success: true,
          results: [],
          contextualInfo: {
            searchQuality: 0.5,
            coverage: {
              geographic: true,
              temporal: true,
              topical: true,
              culturalContext: true,
              demographicContext: true
            }
          },
          error: null
        };
        
      } catch (error: any) {
        console.error('[exaSearchTool] Error:', error);
        return {
          success: false,
          results: [],
          contextualInfo: {
            searchQuality: 0,
            coverage: {
              geographic: false,
              temporal: false,
              topical: false,
              culturalContext: false,
              demographicContext: false
            }
          },
          error: error.message
        };
      }
    }
  );

// Types for Exa search
interface ExaSearchResult {
  title: string;
  url: string;
  text?: string;
  snippet?: string;
  raw_content?: string;
  score?: number;
}

interface ExaContextualInfo {
  searchQuality: number;
  coverage: {
    geographic: boolean;
    temporal: boolean;
    topical: boolean;
    culturalContext: boolean;
    demographicContext: boolean;
  };
}

interface ExaSearchResponse {
  success: boolean;
  results: ExaSearchResult[];
  contextualInfo?: ExaContextualInfo;
  error: string | null;
}

// Helper functions
function determineWebSearchStrategy(contextualInfo: ExaContextualInfo | undefined, exaResults: ExaSearchResult[]): boolean {
  // If Exa search quality is low or coverage is poor, use web search
  if (!contextualInfo || contextualInfo.searchQuality < 0.5) {
    return true;
  }

  // If we have few results, try web search
  if (!exaResults || exaResults.length < 3) {
    return true;
  }

  // If geographic coverage is poor, try web search
  if (!contextualInfo.coverage?.geographic) {
    return true;
  }

  return false;
}

function extractLocationInsights(text: string, source: string): string[] {
  const insights: string[] = [];
  
  // Extract location-related information from text
  const locationPatterns = [
    /located (in|at|near) ([^,.]+)/i,
    /situated (in|at|near) ([^,.]+)/i,
    /found (in|at|near) ([^,.]+)/i,
    /based (in|at|near) ([^,.]+)/i
  ];

  locationPatterns.forEach(pattern => {
    const match = text.match(pattern);
    if (match && match[2]) {
      insights.push(`Location: ${match[2].trim()}`);
    }
  });

  // Extract descriptive phrases
  const descriptivePatterns = [
    /known for ([^,.]+)/i,
    /famous for ([^,.]+)/i,
    /popular for ([^,.]+)/i,
    /features ([^,.]+)/i
  ];

  descriptivePatterns.forEach(pattern => {
    const match = text.match(pattern);
    if (match && match[1]) {
      insights.push(`Feature: ${match[1].trim()}`);
    }
  });

  // Extract atmosphere/ambiance
  const atmospherePatterns = [
    /atmosphere is ([^,.]+)/i,
    /ambiance is ([^,.]+)/i,
    /setting is ([^,.]+)/i,
    /environment is ([^,.]+)/i
  ];

  atmospherePatterns.forEach(pattern => {
    const match = text.match(pattern);
    if (match && match[1]) {
      insights.push(`Atmosphere: ${match[1].trim()}`);
    }
  });

  // Add source-specific insights
  if (source === 'Exa Search') {
    insights.push('Source: Semantic search result');
  }

  return insights;
}

export const deepPlaceDiscoveryTool = ai.defineTool(
  {
        name: 'deepPlace-discovery',
    description: 'Advanced place discovery tool that combines semantic search, web search, and Google Places to find highly relevant locations.',
    inputSchema: DeepPlaceDiscoveryInputSchema,
    outputSchema: DeepPlaceDiscoveryOutputSchema,
  },
  async (input) => {
    console.log('[deepPlaceDiscovery] Starting with:', input);

    try {
      // Phase 1: Semantic Search with Exa
      const exaResults = await performExaSearch(
        input.query,
        input.city || '',
        input.numResults || 5,
        input.centerLat,
        input.centerLng,
        input.searchRadiusKm
      );

      // Phase 2: Web Search (if needed)
      let webResults: any[] = [];
      if (determineWebSearchStrategy(exaResults.contextualInfo, exaResults.results)) {
        webResults = await performWebSearch(input.query, 5);
      }

      // Combine and deduplicate results
      let allResults = [
        ...exaResults.results.map((r: any) => ({ ...r, source: 'exa' })),
        ...webResults.map((r: any) => ({ ...r, source: 'web' }))
      ];

      // Deduplicate
      allResults = deduplicateResults(allResults);

      // Enrich with Google Places details if we have coordinates
      if (input.centerLat && input.centerLng) {
        allResults = await enrichPlacesWithGoogleDetails(allResults, input.centerLat, input.centerLng);
      }

      // Rank by preferences if provided
      if (input.filters) {
        allResults = await rankPlacesByPreferences(allResults, input.filters);
      }

      // Format results according to output schema
      const discoveredPlaces = allResults.map((result: any) => ({
        name: result.name || result.title || extractPlaceNameFromResult(result),
        description: result.snippet || result.description || '',
        source: result.source,
        url: result.url,
        relevance: result.relevance || 0.5,
        context: result.locationInsights?.join('. ') || ''
      }));

      return {
        discoveredPlaces,
        summary: `Found ${discoveredPlaces.length} places matching "${input.query}" in ${input.city || 'specified area'}`,
        suggestions: [
          'Consider filtering by price range',
          'Try searching with more specific keywords',
          'Look for places with good reviews'
        ]
      };

    } catch (error: any) {
      console.error('[deepPlaceDiscovery] Error:', error);
      return {
        discoveredPlaces: [],
        summary: `Error during discovery: ${error.message}`,
        suggestions: [
          'Try a different search query',
          'Check if the location is correct',
          'Consider broadening your search'
        ]
      };
    }
  }
);

// Helper function to generate cohesive place combinations
async function generatePlaceCombinations(
  places: any[],
  userPrompt: string,
  locationQuery: string,
  participantPreferences: any,
  numStops: number
): Promise<any[]> {
  try {
    // Import the AI instance for LLM analysis
    const { ai } = await import('@/ai/genkit');
    
    const combinationsPrompt = ai.definePrompt({
      name: 'placeCombinationsPrompt',
      input: {
        schema: z.object({
          places: z.array(z.object({
            title: z.string(),
            url: z.string(),
            snippet: z.string(),
            source: z.string(),
            relevance: z.number(),
            placeId: z.string().optional(),
            rating: z.number().optional(),
            reviewCount: z.number().optional(),
            isOperational: z.boolean().optional(),
            types: z.array(z.string()).optional(),
            priceLevel: z.number().optional(),
            lat: z.number().optional(),
            lng: z.number().optional(),
          })),
          userPrompt: z.string(),
          locationQuery: z.string(),
          participantPreferences: z.object({
            dietaryRestrictions: z.array(z.string()).optional(),
            favoriteCuisines: z.array(z.string()).optional(),
            activityTypes: z.array(z.string()).optional(),
            accessibilityNeeds: z.array(z.array(z.string())).optional(),
            culturalPreferences: z.array(z.string()).optional(),
            budgetRange: z.string().optional(),
            groupSize: z.number().optional(),
            atmospherePreferences: z.array(z.string()).optional(),
            travelTolerance: z.array(z.string()).optional(),
          }).optional(),
          numStops: z.number(),
        }),
      },
      output: {
        schema: z.object({
          combinations: z.array(z.object({
            places: z.array(z.object({
              title: z.string(),
              url: z.string(),
              snippet: z.string(),
              source: z.string(),
              relevance: z.number(),
              placeId: z.string().optional(),
              rating: z.number().optional(),
              reviewCount: z.number().optional(),
              isOperational: z.boolean().optional(),
              types: z.array(z.string()).optional(),
              priceLevel: z.number().optional(),
              lat: z.number().optional(),
              lng: z.number().optional(),
            })),
            combinationScore: z.number(),
            reasoning: z.string(),
            suggestedOrder: z.array(z.number()),
            transitModes: z.array(z.string()),
            estimatedDurations: z.array(z.number()),
          })),
          analysis: z.string(),
        }),
      },
      prompt: `You are an expert AI planner analyzing discovered places to create cohesive multi-stop plans.

**USER REQUEST:** "${userPrompt}"
**LOCATION:** ${locationQuery}
**PARTICIPANT PREFERENCES:** ${participantPreferences ? JSON.stringify(participantPreferences, null, 2) : 'None specified'}
**NUMBER OF STOPS:** ${numStops}

**DISCOVERED PLACES:** ${JSON.stringify(places, null, 2)}

**YOUR TASK:**
1. Analyze the discovered places and create ${Math.min(3, places.length / numStops)} different combinations of ${numStops} places each
2. Each combination should:
   - Work well together as a cohesive experience
   - Consider travel time and distance between places
   - Match the user's specific request
   - Respect participant preferences
   - Have a logical flow/order
3. For each combination provide:
   - Suggested visit order
   - Transit modes between stops
   - Estimated duration at each stop
   - Overall combination score
   - Reasoning for why these places work well together

**EVALUATION CRITERIA:**
- How well the places complement each other
- Geographic proximity and travel time
- Logical progression (e.g., drinks after dinner)
- Match with user's request
- Consideration of participant preferences
- Variety and balance
- Time management

**OUTPUT FORMAT:**
Return a JSON object with:
- combinations: Array of place combinations with scores and details
- analysis: Overall analysis of the combinations

**IMPORTANT:**
- Focus on creating cohesive experiences
- Consider travel time between places
- Respect participant preferences
- Ensure logical flow between stops
- Prioritize quality over quantity`,
    });

    const result = await combinationsPrompt({
      places,
      userPrompt,
      locationQuery,
      participantPreferences,
      numStops,
    });

    if (result.text) {
      try {
        const analysis = JSON.parse(result.text);
        console.log('[generatePlaceCombinations] LLM analysis completed');
        return analysis.combinations || [];
      } catch (parseError) {
        console.error('[generatePlaceCombinations] Failed to parse LLM response:', parseError);
    return [];
  }
    }
    
    return [];
    
  } catch (error) {
    console.error('[generatePlaceCombinations] Error:', error);
    return [];
  }
}

// Helper function to analyze and curate places with LLM
async function analyzeAndCuratePlacesWithLLM(
  discoveredPlaces: any[], 
  userPrompt: string, 
  locationQuery: string, 
  participantPreferences?: any,
  planType?: string,
  numStops?: number
): Promise<any[]> {
  try {
    // Import the AI instance for LLM analysis
    const { ai } = await import('@/ai/genkit');
    
    const analysisPrompt = ai.definePrompt({
      name: 'placeCurationPrompt',
      input: {
        schema: z.object({
          discoveredPlaces: z.array(z.object({
            title: z.string(),
            url: z.string(),
            snippet: z.string(),
            source: z.string(),
            relevance: z.number().optional(),
            placeId: z.string().optional(),
            rating: z.number().optional(),
            reviewCount: z.number().optional(),
            isOperational: z.boolean().optional(),
            types: z.array(z.string()).optional(),
            priceLevel: z.number().optional(),
          })),
          userPrompt: z.string(),
          locationQuery: z.string(),
          participantPreferences: z.object({
            dietaryRestrictions: z.array(z.string()).optional(),
            favoriteCuisines: z.array(z.string()).optional(),
            activityTypes: z.array(z.string()).optional(),
            accessibilityNeeds: z.array(z.array(z.string())).optional(),
            culturalPreferences: z.array(z.string()).optional(),
            budgetRange: z.string().optional(),
            groupSize: z.number().optional(),
            atmospherePreferences: z.array(z.string()).optional(),
          }).optional(),
        }),
      },
      output: {
        schema: z.object({
          curatedPlaces: z.array(z.object({
            title: z.string(),
            url: z.string(),
            snippet: z.string(),
            source: z.string(),
            relevance: z.number(),
            placeId: z.string().optional(),
            rating: z.number().optional(),
            reviewCount: z.number().optional(),
            isOperational: z.boolean().optional(),
            types: z.array(z.string()).optional(),
            priceLevel: z.number().optional(),
            reasoning: z.string(),
            suitabilityScore: z.number(),
          })),
          analysis: z.string(),
          recommendations: z.array(z.string()),
        }),
      },
      prompt: `You are an expert AI planner analyzing discovered places for a user's specific request.

**USER REQUEST:** "${userPrompt}"
**LOCATION:** ${locationQuery}
**PARTICIPANT PREFERENCES:** ${participantPreferences ? JSON.stringify(participantPreferences, null, 2) : 'None specified'}
**PLAN TYPE:** ${planType || 'Single Stop'}
**NUMBER OF STOPS:** ${numStops || 1}

**DISCOVERED PLACES:** ${JSON.stringify(discoveredPlaces, null, 2)}

**YOUR TASK:**
1. Analyze each discovered place for relevance to the user's request
2. Consider participant preferences (dietary restrictions, budget, accessibility, etc.)
3. Evaluate the quality and reliability of each place
4. Curate the best places that would work well together in an itinerary
5. Provide reasoning for each selection
6. Suggest how these places could be combined into a cohesive plan

**EVALUATION CRITERIA:**
- Relevance to user's specific request
- Match with participant preferences
- Quality indicators (ratings, reviews, operational status)
- Cultural appropriateness and local authenticity
- Budget compatibility
- Accessibility considerations
- Potential for creating a cohesive experience

**OUTPUT FORMAT:**
Return a JSON object with:
- curatedPlaces: Array of the best places with reasoning and suitability scores
- analysis: Overall analysis of the discovered places
- recommendations: Suggestions for how to use these places in an itinerary

**IMPORTANT:**
- Focus on places that truly match the user's specific request
- Consider how places could work together in a plan
- Prioritize quality and relevance over quantity
- Provide specific reasoning for each selection`,
    });

    const result = await analysisPrompt({
      discoveredPlaces,
      userPrompt,
      locationQuery,
      participantPreferences,
    });

    if (result.text) {
      try {
        const analysis = JSON.parse(result.text);
        console.log('[analyzeAndCuratePlacesWithLLM] LLM analysis completed');
        return analysis.curatedPlaces || discoveredPlaces;
      } catch (parseError) {
        console.error('[analyzeAndCuratePlacesWithLLM] Failed to parse LLM response:', parseError);
        return discoveredPlaces;
      }
    }
    
    return discoveredPlaces;
    
  } catch (error) {
    console.error('[analyzeAndCuratePlacesWithLLM] Error:', error);
    return discoveredPlaces;
  }
};

// Enhanced multi-phase discovery with geographic filtering and contextual awareness
async function performMultiPhaseDiscovery(
  queries: any, 
  locationQuery: string, 
  centerLat?: number, 
  centerLng?: number, 
  searchRadiusKm?: number,
  preferences?: any
): Promise<any[]> {
  console.log('[performMultiPhaseDiscovery] Starting with:', { queries, locationQuery, centerLat, centerLng, searchRadiusKm });
  
  const exaResults: any[] = [];
  const webResults: any[] = [];
  let contextualInfo: any = null;
  
  try {
    // Phase 1: Exa search for semantic understanding
    if (queries.primaryQueries && queries.primaryQueries.length > 0) {
      console.log('[performMultiPhaseDiscovery] Phase 1: Exa search');
      for (const query of queries.primaryQueries.slice(0, 3)) {
        try {
          const exaResponse = await performExaSearch(query, locationQuery, 5);
          if (exaResponse.results) {
            exaResults.push(...exaResponse.results);
          }
          // Capture contextual information from first successful Exa search
          if (!contextualInfo && exaResponse.contextualInfo) {
            contextualInfo = exaResponse.contextualInfo;
            console.log('[performMultiPhaseDiscovery] Captured Exa contextual info:', contextualInfo);
      }
    } catch (error) {
          console.error('[performMultiPhaseDiscovery] Exa search failed for query:', query, error);
        }
      }
    }
    
    // Use contextual information to decide on next steps
    const shouldTryWebSearch = determineWebSearchStrategy(contextualInfo, exaResults);
    
    if (shouldTryWebSearch) {
      // Phase 2: Web search for current information
      if (queries.secondaryQueries && queries.secondaryQueries.length > 0) {
        console.log('[performMultiPhaseDiscovery] Phase 2: Web search');
        for (const query of queries.secondaryQueries.slice(0, 2)) {
          try {
            const results = await performWebSearch(query, 5);
            webResults.push(...results);
          } catch (error) {
            console.error('[performMultiPhaseDiscovery] Web search failed for query:', query, error);
          }
        }
      }
      
      // Phase 3: Additional web search only if still insufficient results
      if ((exaResults.length + webResults.length) < 5 && queries.secondaryQueries && queries.secondaryQueries.length > 0) {
        console.log('[performMultiPhaseDiscovery] Phase 3: Additional web search for coverage');
        for (const query of queries.secondaryQueries.slice(2, 4)) {
          try {
            const results = await performWebSearch(query, 3);
            webResults.push(...results);
    } catch (error) {
            console.error('[performMultiPhaseDiscovery] Additional web search failed for query:', query, error);
          }
        }
      }
    }
    
    // Combine results with priority to Exa
    let combinedResults = [...exaResults];
    
    // Only add web results that don't duplicate Exa results and consider contextual info
    const exaTitles = new Set(exaResults.map(r => r.title.toLowerCase()));
    const uniqueWebResults = webResults.filter(r => !exaTitles.has(r.title.toLowerCase()));
    
    // Add web results with relevance adjustment based on contextual info
    const webRelevanceAdjustment = calculateWebRelevanceAdjustment(contextualInfo);
    combinedResults.push(...uniqueWebResults.map(r => ({
      ...r,
      relevance: Math.min(r.relevance * webRelevanceAdjustment, 0.89)
    })));
    
    // Sort by relevance and deduplicate
    combinedResults = deduplicateResults(combinedResults)
      .sort((a, b) => b.relevance - a.relevance);
    
    console.log('[performMultiPhaseDiscovery] Results breakdown:', {
      exaResults: exaResults.length,
      webResults: webResults.length,
      uniqueWebResults: uniqueWebResults.length,
      finalResults: combinedResults.length,
      contextualInfo: contextualInfo
    });
    
    return combinedResults;
    
  } catch (error) {
    console.error('[performMultiPhaseDiscovery] Error:', error);
    return [];
  }
}

// Helper function to calculate web result relevance adjustment based on contextual info
function calculateWebRelevanceAdjustment(contextualInfo: ExaContextualInfo | undefined): number {
  if (!contextualInfo) {
    return 0.7; // Default adjustment
  }

  // If Exa indicates high-quality results, reduce web relevance
  if (contextualInfo.searchQuality > 0.8 && contextualInfo.coverage.geographic) {
    return 0.5;
  }

  // If Exa indicates poor coverage, increase web relevance
  if (!contextualInfo.coverage.geographic || contextualInfo.searchQuality < 0.5) {
    return 0.9;
  }

  return 0.7; // Default adjustment
}

async function performExaSearch(
  query: string, 
  locationQuery: string, 
  numResults: number,
  centerLat?: number, 
  centerLng?: number, 
  searchRadiusKm?: number
): Promise<ExaSearchResponse> {
  // Perform two parallel searches - one for social media and one for regular content
  const [socialResponse, regularResponse] = await Promise.all([
    // Social media search
    exaSearchTool({ 
      query: `${query} ${locationQuery}`,
      numResults: Math.ceil(numResults / 2), // Split results between social and regular
      city: locationQuery,
      filters: {
        domains: ['tiktok.com', 'instagram.com', 'youtube.com'],
        recency: '1y', // Limit to content from the last year
        centerLat,
        centerLng,
        searchRadiusKm
      }
    }),
    // Regular search (blogs, reviews, local sites, etc.)
    exaSearchTool({
      query: `${query} ${locationQuery}`,
      numResults: Math.ceil(numResults / 2),
      city: locationQuery,
      filters: {
        domains: [
          // Review sites
          'yelp.com', 'tripadvisor.com', 'zagat.com', 'infatuation.com',
          // Local guides
          'timeout.com', 'thrillist.com', 'eater.com',
          // Travel content
          'atlasobscura.com', 'localguides.com',
          // Location-based
          'foursquare.com',
          // News and blogs
          'nytimes.com', 'medium.com', 'wordpress.com'
        ],
        recency: '2y', // Allow slightly older content for established places
        centerLat,
        centerLng,
        searchRadiusKm
      }
    })
  ]);

  // Combine and deduplicate results
  const allResults = [
    ...socialResponse.results,
    ...regularResponse.results
  ];

  // Calculate combined search quality
  const searchQuality = Math.max(
    socialResponse.contextualInfo?.searchQuality || 0,
    regularResponse.contextualInfo?.searchQuality || 0
  );

  // Combine coverage information
  const coverage = {
    geographic: socialResponse.contextualInfo?.coverage?.geographic || regularResponse.contextualInfo?.coverage?.geographic || false,
    temporal: socialResponse.contextualInfo?.coverage?.temporal || regularResponse.contextualInfo?.coverage?.temporal || false,
    topical: socialResponse.contextualInfo?.coverage?.topical || regularResponse.contextualInfo?.coverage?.topical || false,
    culturalContext: socialResponse.contextualInfo?.coverage?.culturalContext || regularResponse.contextualInfo?.coverage?.culturalContext || false,
    demographicContext: socialResponse.contextualInfo?.coverage?.demographicContext || regularResponse.contextualInfo?.coverage?.demographicContext || false
  };

  return {
    success: socialResponse.success || regularResponse.success,
    results: allResults,
    contextualInfo: {
      searchQuality,
      coverage
    },
    error: socialResponse.error || regularResponse.error
  };
}

// Helper function to perform web search
async function performWebSearch(query: string, numResults: number): Promise<any[]> {
  try {
    const { webSearchTool } = await import('./tools');
    
    // Clean the query to avoid location duplication
    const cleanQuery = query.replace(/\s+/g, ' ').trim();
    
    const result = await webSearchTool({
      query: cleanQuery,
      numResults: numResults
    });
    
    if (result.success && result.results) {
      return result.results.map((item: any) => ({
        ...item,
        source: 'web',
        relevance: calculateRelevanceScore(item, { primaryQueries: [query] }, 'web')
      }));
    }
    
    return [];
    } catch (error) {
    console.error('[performWebSearch] Error:', error);
    return [];
  }
}

// Helper function to enrich places with Google Places API details
async function enrichPlacesWithGoogleDetails(places: any[], centerLat: number, centerLng: number): Promise<any[]> {
  try {
    const { fetchPlaceDetailsTool } = await import('./tools');
    const enrichedPlaces: any[] = [];
    
    for (const place of places) {
      try {
        // Extract place name from the result
        const placeName = extractPlaceNameFromResult(place);
        if (!placeName) {
          enrichedPlaces.push(place);
          continue;
        }
        
        // Try to fetch details directly using the place name
        const detailsResult = await fetchPlaceDetailsTool({
          placeNameOrId: placeName,
          locationHint: { lat: centerLat, lng: centerLng },
          searchRadiusKm: 50,
          fields: ['place_id', 'name', 'formatted_address', 'address_components', 'geometry', 'photos', 'rating', 'user_ratings_total', 'opening_hours', 'international_phone_number', 'website', 'price_level', 'types', 'business_status']
        });
        
        if (detailsResult.success) {
          // Successfully found and enriched the place
          
          if (detailsResult.success) {
            // Merge the original place data with Google Places details
            enrichedPlaces.push({
              ...place,
              googlePlaceId: detailsResult.placeId,
              lat: detailsResult.lat,
              lng: detailsResult.lng,
              address: detailsResult.address,
              rating: detailsResult.rating,
              reviewCount: detailsResult.reviewCount,
              isOperational: detailsResult.isOperational,
              types: detailsResult.types,
              priceLevel: detailsResult.priceLevel,
              phoneNumber: detailsResult.phoneNumber,
              website: detailsResult.website,
              openingHours: detailsResult.openingHours,
              businessStatus: detailsResult.statusText,
              enriched: true
            });
          } else {
            // If details fetch failed, keep the original place without enrichment
            enrichedPlaces.push(place);
          }
        } else {
          // If no Google Places match found, keep the original place
          enrichedPlaces.push(place);
      }
    } catch (error) {
        console.error('[enrichPlacesWithGoogleDetails] Error enriching place:', place.title, error);
        enrichedPlaces.push(place);
      }
    }
    
    return enrichedPlaces;
  } catch (error) {
    console.error('[enrichPlacesWithGoogleDetails] Error:', error);
    return places;
  }
}

// Helper function to perform Google Places search (kept for reference but not used in discovery)
async function performGooglePlacesSearch(queries: any, centerLat: number, centerLng: number, searchRadiusKm: number): Promise<any[]> {
  try {
    const { findPlacesNearbyTool } = await import('./tools');
    const results: any[] = [];
    
    // Search for different place types based on queries
    const placeTypes = ['restaurant', 'tourist_attraction', 'establishment'];
    
    for (const placeType of placeTypes) {
      try {
        const result = await findPlacesNearbyTool({
          centerLat: centerLat,
          centerLng: centerLng,
          radiusKm: searchRadiusKm,
          placeType: placeType
        });
        
        if (result.success && result.places) {
          results.push(...result.places.map((place: any) => ({
            title: place.name,
            url: `https://maps.google.com/?q=${place.lat},${place.lng}`,
            snippet: `Located at ${place.address || 'Unknown address'}`,
            source: 'google_places',
            placeId: place.placeId,
            rating: place.rating,
            reviewCount: null,
            isOperational: place.isOpen,
            types: place.types,
            priceLevel: place.priceLevel,
            relevance: calculateRelevanceScore({ title: place.name }, queries, 'google_places')
          })));
        }
      } catch (error) {
        console.error('[performGooglePlacesSearch] Error for place type:', placeType, error);
    }
  }
  
  return results;
  } catch (error) {
    console.error('[performGooglePlacesSearch] Error:', error);
    return [];
  }
}

// Helper function to generate LLM-powered search terms
async function generateLLMSearchTerms(userPrompt: string, locationQuery: string): Promise<{ primaryQueries: string[], secondaryQueries: string[] }> {
  try {
    // Import the proper LLM-powered function from aiFlowUtils
    const { generateLLMSearchTerms: llmGenerateSearchTerms } = await import('@/lib/aiFlowUtils');
    const result = await llmGenerateSearchTerms(userPrompt, locationQuery);
    return {
      primaryQueries: result.primaryQueries,
      secondaryQueries: result.secondaryQueries
    };
  } catch (error: any) {
    console.error('[generateLLMSearchTerms] Error using LLM:', error);
    throw new Error(`LLM search term generation failed: ${error.message}`);
  }
}

// Helper function to rank places by preferences
async function rankPlacesByPreferences(places: any[], preferences?: any): Promise<any[]> {
  if (!preferences) return places;
  
  return places.map(place => ({
    ...place,
    preferenceScore: calculatePreferenceMatch(place, preferences).overallPreferenceScore
  })).sort((a, b) => (b.preferenceScore || 0) - (a.preferenceScore || 0));
}

// Helper function to generate preference-enhanced queries with LLM integration
async function generatePreferenceEnhancedQueries(
  searchTerms: any, 
  preferences: any, 
  location: string
): Promise<{ primaryQueries: string[], secondaryQueries: string[] }> {
  const enhancedQueries = {
    primaryQueries: [...searchTerms.primaryQueries],
    secondaryQueries: [...searchTerms.secondaryQueries]
  };
  
  if (!preferences) {
    return enhancedQueries;
  }
  
  try {
    // Try LLM-powered preference enhancement first
    const llmEnhancedQueries = await generatePreferenceEnhancedQueriesWithLLM(searchTerms, preferences, location);
    if (llmEnhancedQueries && llmEnhancedQueries.primaryQueries.length > 0) {
      console.log('[generatePreferenceEnhancedQueries] LLM enhancement successful');
      return llmEnhancedQueries;
    }
  } catch (error) {
    console.error('[generatePreferenceEnhancedQueries] LLM enhancement failed, using rule-based fallback:', error);
  }
  
  // Fallback to rule-based enhancement
  return generatePreferenceEnhancedQueriesFallback(searchTerms, preferences, location);
}

// LLM-powered preference enhancement
async function generatePreferenceEnhancedQueriesWithLLM(
  searchTerms: any, 
  preferences: any, 
  location: string
): Promise<{ primaryQueries: string[], secondaryQueries: string[] }> {
  try {
    const { ai } = await import('@/ai/genkit');
    
    const cityName = extractCityFromLocation(location) || location;
    
    const prompt = `You are an expert at generating intelligent search queries enhanced with user preferences. Given base search terms, user preferences, and location, generate highly targeted search queries that will find exactly what the user wants.

BASE SEARCH TERMS: ${JSON.stringify(searchTerms, null, 2)}
LOCATION: "${location}"
CITY: "${cityName}"

USER PREFERENCES: ${JSON.stringify(preferences, null, 2)}

Your task is to generate intelligent search queries that:
1. Combine the base search terms with user preferences intelligently
2. Create highly specific queries that match user preferences
3. Consider cultural context, dietary needs, accessibility, budget, and atmosphere
4. Generate queries that will find places that truly match the user's needs
5. Prioritize primary queries for exact matches and secondary queries for broader discovery

Generate queries that consider:
- Dietary restrictions and accessibility needs (critical)
- Cuisine preferences and cultural context
- Budget considerations and price ranges
- Activity types and atmosphere preferences
- Group size and venue capacity
- Local variations and authentic experiences

Return as JSON:
{
  "primaryQueries": [
    "Most specific, preference-matched search terms (5-8 queries)"
  ],
  "secondaryQueries": [
    "Broader but still preference-aware search terms (5-8 queries)"
  ],
  "reasoning": "Why these queries will effectively find preference-matched places"
}

EXAMPLES:

For preferences with Italian cuisine + vegetarian + budget $$:
Primary: ["authentic Italian vegetarian restaurant", "Italian restaurant vegetarian options", "vegetarian Italian cuisine"]
Secondary: ["moderate Italian dining", "vegetarian friendly Italian", "Italian restaurant with plant-based options"]

For preferences with accessibility needs + group dining:
Primary: ["wheelchair accessible restaurant", "accessible dining large group", "restaurant wheelchair ramp"]
Secondary: ["group dining accessible", "large party accessible venue", "restaurant with elevator"]

Now generate intelligent preference-enhanced queries:`;

    const result = await ai.generate({
      model: 'googleai/gemini-2.5-pro',
      prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 1000,
      },
    });

    if (result.text) {
      const cleaned = result.text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      if (parsed.primaryQueries && Array.isArray(parsed.primaryQueries) && parsed.primaryQueries.length > 0) {
        console.log('[generatePreferenceEnhancedQueriesWithLLM] Generated LLM-enhanced queries:', parsed);
        return {
          primaryQueries: parsed.primaryQueries.slice(0, 8),
          secondaryQueries: parsed.secondaryQueries?.slice(0, 8) || []
        };
      }
    }
  } catch (error) {
    console.error('[generatePreferenceEnhancedQueriesWithLLM] Error:', error);
  }
  
  return { primaryQueries: [], secondaryQueries: [] };
}

// Rule-based fallback for preference enhancement
function generatePreferenceEnhancedQueriesFallback(
  searchTerms: any, 
  preferences: any, 
  location: string
): Promise<{ primaryQueries: string[], secondaryQueries: string[] }> {
  const enhancedQueries = {
    primaryQueries: [...searchTerms.primaryQueries],
    secondaryQueries: [...searchTerms.secondaryQueries]
  };
  
  // Extract city name for more targeted queries
  const cityName = extractCityFromLocation(location) || location;
  
  // 1. CUISINE PREFERENCES - High priority for primary queries
    if (preferences.favoriteCuisines?.length > 0) {
    for (const cuisine of preferences.favoriteCuisines.slice(0, 3)) {
      enhancedQueries.primaryQueries.push(`${cuisine} restaurant ${cityName}`);
      enhancedQueries.primaryQueries.push(`authentic ${cuisine} food ${cityName}`);
      enhancedQueries.secondaryQueries.push(`${cuisine} cuisine ${cityName}`);
    }
  }
  
  // 2. DIETARY RESTRICTIONS - Critical for accessibility
  if (preferences.dietaryRestrictions?.length > 0) {
    for (const restriction of preferences.dietaryRestrictions.slice(0, 3)) {
      enhancedQueries.primaryQueries.push(`${restriction} friendly restaurant ${cityName}`);
      enhancedQueries.secondaryQueries.push(`${restriction} options ${cityName}`);
      enhancedQueries.secondaryQueries.push(`${restriction} dining ${cityName}`);
    }
  }
  
  // 3. ACTIVITY TYPES - For non-food activities
  if (preferences.activityTypes?.length > 0) {
    for (const activity of preferences.activityTypes.slice(0, 2)) {
      enhancedQueries.primaryQueries.push(`${activity} ${cityName}`);
      enhancedQueries.secondaryQueries.push(`${activity} activities ${cityName}`);
    }
  }
  
  // 4. ACCESSIBILITY NEEDS - Important for inclusive planning
    if (preferences.accessibilityNeeds?.length > 0) {
    for (const need of preferences.accessibilityNeeds.slice(0, 2)) {
      enhancedQueries.secondaryQueries.push(`wheelchair accessible ${cityName}`);
      enhancedQueries.secondaryQueries.push(`accessible ${cityName}`);
    }
  }
  
  // 5. CULTURAL PREFERENCES - For authentic/local experiences
  if (preferences.culturalPreferences?.length > 0) {
    for (const preference of preferences.culturalPreferences.slice(0, 2)) {
      if (preference.toLowerCase().includes('authentic') || preference.toLowerCase().includes('local')) {
        enhancedQueries.primaryQueries.push(`local authentic ${cityName}`);
        enhancedQueries.secondaryQueries.push(`hidden gems ${cityName}`);
      }
      if (preference.toLowerCase().includes('traditional')) {
        enhancedQueries.primaryQueries.push(`traditional ${cityName}`);
      }
    }
  }
  
  // 6. BUDGET CONSIDERATIONS - For price-appropriate options
  if (preferences.budgetRange) {
    const budgetKeywords: Record<string, string[]> = {
      '$': ['cheap', 'budget', 'affordable', 'inexpensive'],
      '$$': ['moderate', 'mid-range', 'reasonable'],
      '$$$': ['upscale', 'fine dining', 'premium'],
      '$$$$': ['luxury', 'high-end', 'exclusive']
    };
    
    const keywords = budgetKeywords[preferences.budgetRange] || [];
    for (const keyword of keywords.slice(0, 2)) {
      enhancedQueries.secondaryQueries.push(`${keyword} ${cityName}`);
    }
  }
  
  // 7. ATMOSPHERE PREFERENCES - For ambiance matching
  if (preferences.atmospherePreferences?.length > 0) {
    for (const atmosphere of preferences.atmospherePreferences.slice(0, 2)) {
      enhancedQueries.secondaryQueries.push(`${atmosphere} atmosphere ${cityName}`);
      enhancedQueries.secondaryQueries.push(`${atmosphere} restaurant ${cityName}`);
    }
  }
  
  // 8. GROUP SIZE CONSIDERATIONS - For appropriate venue sizing
  if (preferences.groupSize && preferences.groupSize > 4) {
    enhancedQueries.secondaryQueries.push(`group dining ${cityName}`);
    enhancedQueries.secondaryQueries.push(`large party restaurant ${cityName}`);
  }
  
  // 9. COMBINATION QUERIES - Mix preferences for better results
  if (preferences.favoriteCuisines?.length > 0 && preferences.dietaryRestrictions?.length > 0) {
    const cuisine = preferences.favoriteCuisines[0];
    const restriction = preferences.dietaryRestrictions[0];
    enhancedQueries.primaryQueries.push(`${cuisine} ${restriction} restaurant ${cityName}`);
  }
  
  // 10. FALLBACK QUERIES - Ensure we have basic coverage
  enhancedQueries.secondaryQueries.push(`best restaurants ${cityName}`);
  enhancedQueries.secondaryQueries.push(`popular places ${cityName}`);
  
  // Limit results to prevent overwhelming the search
  enhancedQueries.primaryQueries = enhancedQueries.primaryQueries.slice(0, 8);
  enhancedQueries.secondaryQueries = enhancedQueries.secondaryQueries.slice(0, 8);
  
  return Promise.resolve(enhancedQueries);
}

function calculatePreferenceMatch(result: any, preferences: any): any {
  if (!preferences) return { overallPreferenceScore: 0.5 };
  
  const scores = {
    dietaryCompliance: 1.0,
    cuisineMatch: 0.5,
    activityMatch: 0.5,
    budgetMatch: 0.5,
    accessibilityMatch: 1.0,
    atmosphereMatch: 0.5,
  };
  
  // Handle both web search results and Google Places API results
  const text = `${result.title || result.name || ''} ${result.snippet || ''}`.toLowerCase();
  
  // Dietary compliance scoring
  if (preferences.dietaryRestrictions?.length > 0) {
    const dietaryKeywords: Record<string, string[]> = {
      'vegetarian': ['vegetarian', 'vegan', 'plant-based'],
      'vegan': ['vegan', 'plant-based', 'dairy-free'],
      'gluten-free': ['gluten-free', 'celiac', 'wheat-free'],
      'dairy-free': ['dairy-free', 'lactose-free'],
    };
    
    let dietaryScore = 1.0;
    preferences.dietaryRestrictions.forEach((restriction: string) => {
      const keywords = dietaryKeywords[restriction.toLowerCase()] || [restriction.toLowerCase()];
      const hasDietaryOption = keywords.some((keyword: string) => text.includes(keyword));
      if (!hasDietaryOption) dietaryScore *= 0.7; // Penalize if no dietary option found
    });
    scores.dietaryCompliance = dietaryScore;
  }
  
  // Cuisine matching
  if (preferences.favoriteCuisines?.length > 0) {
    const cuisineMatch = preferences.favoriteCuisines.some((cuisine: string) => 
      text.includes(cuisine.toLowerCase())
    );
    scores.cuisineMatch = cuisineMatch ? 0.9 : 0.3;
  }
  
  // Activity type matching
  if (preferences.activityTypes?.length > 0) {
    const activityMatch = preferences.activityTypes.some((activity: string) => 
      text.includes(activity.toLowerCase())
    );
    scores.activityMatch = activityMatch ? 0.9 : 0.3;
  }
  
  // Budget matching (enhanced with Google Places price level)
  if (preferences.budgetRange) {
    // If we have Google Places price level data, use it directly
    if (result.priceLevel !== undefined && result.priceLevel !== null) {
      const priceMatch: Record<string, number[]> = {
        '$': [1, 2],
        '$$': [2, 3],
        '$$$': [3, 4],
        '$$$$': [4, 5]
      };
      const expectedLevels = priceMatch[preferences.budgetRange] || [2, 3];
      const isBudgetMatch = expectedLevels.includes(result.priceLevel);
      scores.budgetMatch = isBudgetMatch ? 0.9 : 0.3;
    } else {
      // Fallback to keyword matching for web search results
    const budgetKeywords: Record<string, string[]> = {
      '$': ['cheap', 'budget', 'affordable', 'inexpensive'],
      '$$': ['moderate', 'mid-range', 'reasonable'],
      '$$$': ['upscale', 'fine dining', 'premium'],
      '$$$$': ['luxury', 'high-end', 'exclusive']
    };
    const keywords = budgetKeywords[preferences.budgetRange] || [];
    const budgetMatch = keywords.some((keyword: string) => text.includes(keyword));
    scores.budgetMatch = budgetMatch ? 0.8 : 0.5;
    }
  }
  
  // Accessibility matching
  if (preferences.accessibilityNeeds?.length > 0) {
    const accessibilityKeywords: Record<string, string[]> = {
      'wheelchair': ['wheelchair accessible', 'ramp', 'elevator'],
      'hearing': ['hearing loop', 'sign language', 'caption'],
      'visual': ['braille', 'large print', 'audio description']
    };
    
    let accessibilityScore = 1.0;
    preferences.accessibilityNeeds.forEach((need: string) => {
      const keywords = accessibilityKeywords[need.toLowerCase()] || [need.toLowerCase()];
      const hasAccessibility = keywords.some((keyword: string) => text.includes(keyword));
      if (!hasAccessibility) accessibilityScore *= 0.8;
    });
    scores.accessibilityMatch = accessibilityScore;
  }
  
  // Atmosphere matching
  if (preferences.atmospherePreferences?.length > 0) {
    const atmosphereMatch = preferences.atmospherePreferences.some((atmosphere: string) => 
      text.includes(atmosphere.toLowerCase())
    );
    scores.atmosphereMatch = atmosphereMatch ? 0.9 : 0.4;
  }
  
  // Calculate overall preference score
  const overallScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;
  
  return {
    ...scores,
    overallPreferenceScore: overallScore
  };
}

function calculateEnhancedPreferenceMatch(googlePlace: any, preferences: any): any {
  const baseMatch = calculatePreferenceMatch(googlePlace, preferences);
  
  // Enhance with Google Places data
  if (googlePlace.priceLevel && preferences.budgetRange) {
    const priceMatch: Record<string, number[]> = {
      '$': [1, 2],
      '$$': [2, 3],
      '$$$': [3, 4],
      '$$$$': [4, 5]
    };
    const expectedLevels = priceMatch[preferences.budgetRange] || [2, 3];
    const isBudgetMatch = expectedLevels.includes(googlePlace.priceLevel);
    baseMatch.budgetMatch = isBudgetMatch ? 0.9 : 0.3;
  }
  
  // Recalculate overall score
  const scores = Object.values(baseMatch).filter(score => typeof score === 'number' && score !== baseMatch.overallPreferenceScore) as number[];
  baseMatch.overallPreferenceScore = scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length;
  
  return baseMatch;
}

function generatePersonalizedNotes(result: any, preferences: any): string[] {
  const notes: string[] = [];
  
  if (!preferences) return notes;
  
  const text = `${result.title} ${result.snippet}`.toLowerCase();
  
  // Dietary notes
  if (preferences.dietaryRestrictions?.length > 0) {
    const dietaryKeywords: Record<string, string> = {
      'vegetarian': 'vegetarian',
      'vegan': 'vegan',
      'gluten-free': 'gluten-free',
      'dairy-free': 'dairy-free'
    };
    
    preferences.dietaryRestrictions.forEach((restriction: string) => {
      const keyword = dietaryKeywords[restriction.toLowerCase()];
      if (keyword && text.includes(keyword)) {
        notes.push(`✅ Offers ${restriction} options`);
      } else {
        notes.push(`⚠️ Check ${restriction} options before visiting`);
      }
    });
  }
  
  // Cuisine notes
  if (preferences.favoriteCuisines?.length > 0) {
    const matchingCuisine = preferences.favoriteCuisines.find((cuisine: string) => 
      text.includes(cuisine.toLowerCase())
    );
    if (matchingCuisine) {
      notes.push(`🍽️ Features your preferred ${matchingCuisine} cuisine`);
    }
  }
  
  // Budget notes
  if (preferences.budgetRange) {
    const budgetText: Record<string, string> = {
      '$': 'budget-friendly',
      '$$': 'moderately priced',
      '$$$': 'upscale dining',
      '$$$$': 'luxury experience'
    };
    notes.push(`💰 ${budgetText[preferences.budgetRange] || 'various price points'}`);
  }
  
  // Accessibility notes
  if (preferences.accessibilityNeeds?.length > 0) {
    const accessibilityKeywords: Record<string, string> = {
      'wheelchair': 'wheelchair accessible',
      'hearing': 'hearing assistance available',
      'visual': 'visual assistance available'
    };
    
    preferences.accessibilityNeeds.forEach((need: string) => {
      const keyword = accessibilityKeywords[need.toLowerCase()];
      if (keyword && text.includes(keyword.toLowerCase())) {
        notes.push(`♿ ${keyword}`);
      } else {
        notes.push(`⚠️ Contact about ${need} accessibility`);
      }
    });
  }
  
  return notes.slice(0, 3); // Limit to 3 most relevant notes
}

function generatePreferenceFallbackQuery(userPrompt: string, preferences: any, location: string): string {
  let query = userPrompt;
  
  if (preferences) {
    // Add dietary restrictions
    if (preferences.dietaryRestrictions?.length > 0) {
      query += ` ${preferences.dietaryRestrictions.join(' ')}`;
    }
    
    // Add cuisine preferences
    if (preferences.favoriteCuisines?.length > 0) {
      query += ` ${preferences.favoriteCuisines[0]}`;
    }
    
    // Add budget
    if (preferences.budgetRange) {
      query += ` ${preferences.budgetRange}`;
    }
  }
  
  return `${query} ${location}`;
}

// Helper function to calculate relevance score based on LLM analysis
function calculateRelevanceScore(result: any, searchTerms: any, phase: string): number {
  let score = 0.3; // Base score
  
  // Boost score based on search phase
  if (phase === 'exact_match') score += 0.3;
  else if (phase === 'cultural_context') score += 0.2;
  else if (phase === 'fallback') score += 0.1;
  
  // Boost score if cultural context matches
  if (searchTerms.culturalContext && result.culturalContext === searchTerms.culturalContext) {
    score += 0.2;
  }
  
  // Boost score for exact matches in title
  const title = (result.title || '').toLowerCase();
  const specificItem = searchTerms.primaryQueries?.[0]?.toLowerCase();
  if (specificItem && title.includes(specificItem)) {
    score += 0.3;
  }
  
  // Cap score at 1.0
  return Math.min(score, 1.0);
}

// Helper function to deduplicate results
function deduplicateResults(results: any[]): any[] {
  const seen = new Set();
  return results.filter(result => {
    // Use title and snippet for deduplication (from search results)
    const title = result.title || result.name || '';
    const snippet = result.snippet || result.address || '';
    const key = `${title}-${snippet}`;
    
    if (seen.has(key)) {
      console.log('[deduplicateResults] Removing duplicate:', title);
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Helper function to extract place name from search result
function extractPlaceNameFromResult(result: any): string | null {
  const title = result.title || '';
  const snippet = result.snippet || '';
  
  // Try to extract a place name from the title or snippet
  // This is a simple heuristic - could be enhanced with NLP
  const text = `${title} ${snippet}`.toLowerCase();
  
  // Look for common place indicators
  const placeIndicators = [
    'restaurant', 'cafe', 'bar', 'shop', 'store', 'market', 'plaza', 'center',
    'hotel', 'museum', 'park', 'theater', 'cinema', 'gallery', 'studio'
  ];
  
  for (const indicator of placeIndicators) {
    if (text.includes(indicator)) {
      // Extract the part before the indicator as the place name
      const parts = title.split(indicator)[0].trim();
      if (parts.length > 2) {
        return parts;
      }
    }
  }
  
  // If no indicator found, try to extract from title
  const titleWords = title.split(' ');
  if (titleWords.length >= 2) {
    // Take first 2-3 words as potential place name
    return titleWords.slice(0, Math.min(3, titleWords.length)).join(' ');
  }
  
  return null;
}

// Helper function to extract city from location query
function extractCityFromLocation(locationQuery: string): string | undefined {
  if (!locationQuery) return undefined;
  
  // Try to extract city from location query
  const parts = locationQuery.split(',').map(part => part.trim());
  if (parts.length > 1) {
    return parts[parts.length - 1]; // Last part is usually the city
  }
  
  return locationQuery; // Return the whole query if no comma found
}

export const validateAndEnrichPlaceTool = ai.defineTool(
  {
    name: 'validateAndEnrichPlace',
    description: 'Validates discovered places using Google Places API and enriches them with additional data.',
    inputSchema: z.object({
      placeName: z.string().describe("Name of the place to validate"),
      city: z.string().optional().describe("City where the place is located"),
      discoveredSource: z.string().optional().describe("Source where this place was discovered"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      isValid: z.boolean(),
      placeDetails: z.object({
        name: z.string(),
        placeId: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        rating: z.number().optional().nullable(),
        reviewCount: z.number().optional().nullable(),
        isOperational: z.boolean().optional().nullable(),
        types: z.array(z.string()).optional().nullable(),
        priceLevel: z.number().optional().nullable(),
        lat: z.number().optional().nullable(),
        lng: z.number().optional().nullable(),
        website: z.string().url().optional().nullable(),
        phoneNumber: z.string().optional().nullable(),
        openingHours: z.array(z.string()).optional().nullable(),
        utcOffsetMinutes: z.number().optional().nullable(),
        photoReference: z.string().optional().nullable(),
      }).optional().nullable(),
      error: z.string().optional().nullable(),
    }),
  },
  async (input) => {
    console.log('[validateAndEnrichPlaceTool] Called with input:', JSON.stringify(input, null, 2));
    
    try {
      // Use the fetchPlaceDetails tool to validate the place
      const detailsResult = await fetchPlaceDetailsTool({
        placeNameOrId: input.city ? `${input.placeName}, ${input.city}` : input.placeName,
        locationHint: null,
        searchRadiusKm: 50,
        fields: ['place_id', 'name', 'formatted_address', 'rating', 'user_ratings_total', 'business_status', 'types', 'price_level', 'geometry', 'website', 'international_phone_number', 'opening_hours', 'utc_offset', 'photos']
      });
      
      if (detailsResult.success && detailsResult.placeId) {
        console.log(`[validateAndEnrichPlaceTool] Successfully validated: ${detailsResult.name}`);
        
        return {
          success: true,
          isValid: true,
          placeDetails: {
            name: detailsResult.name || input.placeName,
            placeId: detailsResult.placeId,
            address: detailsResult.address,
            rating: detailsResult.rating,
            reviewCount: detailsResult.reviewCount,
            isOperational: detailsResult.isOperational,
            types: detailsResult.types,
            priceLevel: detailsResult.priceLevel,
            lat: detailsResult.lat,
            lng: detailsResult.lng,
            website: detailsResult.website,
            phoneNumber: detailsResult.phoneNumber,
            openingHours: detailsResult.openingHours,
            utcOffsetMinutes: detailsResult.utcOffsetMinutes,
            photoReference: detailsResult.photoReference,
          }
        };
      } else {
        console.log(`[validateAndEnrichPlaceTool] Place not found in Google Places: ${input.placeName}`);
        
        return {
          success: true,
          isValid: false,
          placeDetails: null,
          error: `Place "${input.placeName}" not found in Google Places database.`
        };
      }
      
    } catch (error: any) {
      console.error('[validateAndEnrichPlaceTool] Validation error:', error);
      return {
        success: false,
        isValid: false,
        placeDetails: null,
        error: `Validation error: ${error.message}`
      };
    }
  }
);

// Export all tools as an array for easy use in AI flows
export const allTools = [
  findPlacesNearbyTool,
  fetchPlaceDetailsTool,
  fetchDirectionsTool,
  webSearchTool,
  exaSearchTool,
  deepPlaceDiscoveryTool,
  validateAndEnrichPlaceTool,
]; 