import {z} from 'genkit';

// Schema definitions
export const ItineraryItemSchema = z.object({
  placeName: z.string().describe('The name of the place or activity.'),
  description: z.string().describe('A description of what to do at this stop.'),
  activitySuggestions: z.array(z.string()).min(3).max(3).describe('Suggested activities or things to do at this stop.'),
  suggestedDuration: z.number().default(60).describe('Suggested duration in minutes (defaults to 60).'),
  suggestedOrder: z.number().describe('Suggested order in the itinerary (0-based).'),
  startTime: z.string().datetime({ offset: true }).optional().describe('The start time for this item.'),
  duration: z.number().default(60).describe('The duration in minutes (fixed at 60).'),
  status: z.string().describe('The operational status of the place.'),
  placeId: z.string().optional().describe('The Google Places API place ID.'),
  address: z.string().optional().describe('The formatted address from Google Places API.'),
  city: z.string().optional().describe('The city where this place is located.'),
  lat: z.number().optional().describe('The latitude from Google Places API.'),
  lng: z.number().optional().describe('The longitude from Google Places API.'),
  googlePlaceId: z.string().optional().describe('The Google Places API place ID.'),
  googleMapsUrl: z.string().optional().describe('The Google Maps URL for this place.'),
  phoneNumber: z.string().optional().describe('The formatted phone number from Google Places API.'),
  website: z.string().optional().describe('The website URL from Google Places API.'),
  rating: z.number().optional().describe('The rating from Google Places API.'),
  userRatingsTotal: z.number().optional().describe('The total number of ratings from Google Places API.'),
  priceLevel: z.number().optional().describe('The price level from Google Places API.'),
  types: z.array(z.string()).optional().describe('The place types from Google Places API.'),
  openingHours: z.object({
    open_now: z.boolean().optional(),
    periods: z.array(z.object({
      open: z.object({
        day: z.number(),
        time: z.string()
      }),
      close: z.object({
        day: z.number(),
        time: z.string()
      })
    })).optional(),
    weekday_text: z.array(z.string()).optional()
  }).optional().describe('Opening hours information from Google Places API.'),
  isOperational: z.boolean().optional().describe('Whether the place is currently operational.'),
  statusText: z.string().optional().describe('Human-readable status text about the operational status.'),
  businessStatus: z.string().optional().describe('The business status from Google Places API (e.g., OPERATIONAL, CLOSED_TEMPORARILY).')
});

export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;

export const GenerateFullPlanDetailsInputSchema = z.object({
  userPrompt: z.string().describe('The user\'s event idea or prompt.'),
  hostId: z.string().describe('The user ID of the plan host.'),
  participantUserIds: z.array(z.string()).optional().describe('List of invited participant user IDs.'),
  participantPreferences: z.array(z.string()).optional().describe('A list of preferences and restrictions for participants.'),
  planType: z.enum(['single-stop', 'multi-stop']).describe('Whether this is a single-stop or multi-stop event.'),
  priceRange: z.string().optional().describe('The estimated price range for the event.'),
  userEnteredCity: z.string().optional().describe('The city entered by the user for context.'),
  userSuggestedEventTime: z.string().datetime({ offset: true }).optional().describe('The event time suggested by the user.'),
  selectedPoint: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional().describe('Optional selected point on map for area-based suggestions.'),
  mapRadiusKm: z.number().optional().describe('Optional radius in km around selected point for area-based suggestions.')
});

export type GenerateFullPlanDetailsInput = z.infer<typeof GenerateFullPlanDetailsInputSchema>;

export const GenerateFullPlanDetailsOutputSchema = z.object({
  name: z.string().describe('Suggested name for the plan.'),
  description: z.string().describe('A detailed description of the plan.'),
  eventType: z.string().describe('The type of event (e.g., "Dinner Party", "Museum Visit").'),
  location: z.string().optional().describe('The name of the main location/venue.'),
  city: z.string().optional().describe('The city where the event will take place.'),
  eventTime: z.string().datetime({ offset: true }).optional().describe('The suggested start time for the event.'),
  priceRange: z.string().optional().describe('The estimated price range for the event.'),
  planType: z.enum(['single-stop', 'multi-stop']).describe('Whether this is a single-stop or multi-stop event.'),
  itinerary: z.array(ItineraryItemSchema).refine(
    (items) => items.length >= 1,
    { message: "At least one itinerary item is required" }
  ).describe('Suggested itinerary items with Google Places data.')
}).refine(
  (data) => {
    if (data.planType === 'single-stop') {
      return data.itinerary.length === 1;
    }
    return data.itinerary.length >= 2;
  },
  {
    message: "Number of itinerary items must match plan type (exactly one for single-stop, two or more for multi-stop)"
  }
);

export type GenerateFullPlanDetailsOutput = z.infer<typeof GenerateFullPlanDetailsOutputSchema>; 