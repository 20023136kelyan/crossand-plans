/**
 * @fileOverview Builds a full plan draft and enriches itinerary items with Google Maps data when available.
 */

import {addHours, parseISO} from 'date-fns';
import {
  GenerateFullPlanDetailsInputSchema,
  GenerateFullPlanDetailsInput,
  GenerateFullPlanDetailsOutputSchema,
  GenerateFullPlanDetailsOutput,
  ItineraryItem,
} from './plan-types';
import {deriveFullPlanDraft} from '@/ai/local-generators';

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
      open: {day: number; time: string};
      close: {day: number; time: string};
    }>;
    weekday_text?: string[];
  };
  businessStatus?: string;
  url?: string;
}

function calculateStartTime(baseTime: string | undefined | null, orderIndex: number): string {
  const startDate = baseTime ? parseISO(baseTime) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) {
    return addHours(new Date(), orderIndex + 1).toISOString();
  }
  return addHours(startDate, orderIndex).toISOString();
}

async function searchPlaceDetails(placeName: string, city?: string): Promise<GooglePlaceDetails | null> {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
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
    const detailsResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_address,geometry,formatted_phone_number,website,rating,user_ratings_total,price_level,types,opening_hours,business_status,url&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const detailsData = await detailsResponse.json();
    const details = detailsData.result;

    return {
      placeId: place.place_id,
      formattedAddress: details.formatted_address || place.formatted_address || searchQuery,
      location: {
        lat: details.geometry?.location?.lat || place.geometry?.location?.lat || 0,
        lng: details.geometry?.location?.lng || place.geometry?.location?.lng || 0,
      },
      formattedPhoneNumber: details.formatted_phone_number,
      website: details.website,
      rating: details.rating,
      userRatingsTotal: details.user_ratings_total,
      priceLevel: details.price_level,
      types: details.types,
      openingHours: details.opening_hours,
      businessStatus: details.business_status,
      url: details.url,
    };
  } catch (error) {
    console.error('Error fetching place details:', error);
    return null;
  }
}

function extractCityFromAddress(formattedAddress: string): string | null {
  const parts = formattedAddress.split(',').map(part => part.trim());
  if (parts.length >= 2) {
    return parts[parts.length - 2] || parts[parts.length - 1] || null;
  }
  return null;
}

export async function generateFullPlanDetails(
  input: GenerateFullPlanDetailsInput
): Promise<GenerateFullPlanDetailsOutput> {
  const validatedInput = GenerateFullPlanDetailsInputSchema.parse(input);
  const draft = deriveFullPlanDraft({
    userPrompt: validatedInput.userPrompt,
    userEnteredCity: validatedInput.userEnteredCity,
    planType: validatedInput.planType,
    priceRange: validatedInput.priceRange,
    participantPreferences: validatedInput.participantPreferences,
    userSuggestedEventTime: validatedInput.userSuggestedEventTime,
  });

  const enrichedItinerary = await Promise.all(
    draft.itinerary.map(async (item, index) => {
      const placeDetails = await searchPlaceDetails(item.placeName, draft.city);
      const startTime = calculateStartTime(draft.eventTime, index);

      if (!placeDetails) {
        return {
          ...item,
          startTime,
          duration: 60,
          address: draft.location,
          city: draft.city,
          status: item.status || 'UNKNOWN',
        } as ItineraryItem;
      }

      return {
        placeName: item.placeName,
        description: item.description,
        activitySuggestions: item.activitySuggestions,
        suggestedDuration: item.suggestedDuration,
        suggestedOrder: item.suggestedOrder,
        duration: 60,
        status: placeDetails.businessStatus || 'UNKNOWN',
        startTime,
        placeId: placeDetails.placeId,
        address: placeDetails.formattedAddress,
        city: extractCityFromAddress(placeDetails.formattedAddress) || draft.city || '',
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
        businessStatus: placeDetails.businessStatus,
      } satisfies ItineraryItem;
    })
  );

  return GenerateFullPlanDetailsOutputSchema.parse({
    ...draft,
    itinerary: enrichedItinerary,
  });
}

export const generateFullPlanDetailsFlow = generateFullPlanDetails;

