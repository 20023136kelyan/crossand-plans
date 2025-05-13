import { z } from "zod";
import { isValid, parseISO } from "date-fns";
import { COMMON_PRICE_RANGES } from "@/lib/constants";

// Helper function for transforming comma-separated string to array of strings
const stringToArrayTransformer = (val: string | undefined | null): string[] => {
  if (typeof val !== 'string' || val.trim() === '') {
    return [];
  }
  return val.split(',').map(s => s.trim()).filter(s => s.length > 0);
};

export const itineraryItemSchema = z.object({
  id: z.string().optional(), // Will be assigned by react-hook-form for new items, or from DB for existing
  placeName: z.string().min(1, "Place name is required."),
  address: z.string().min(1, "Address is required."),
  city: z.string().min(1, "City for this stop is required."),
  description: z.string().min(1, "Notes/description for this stop is required."),
  startTime: z.string().datetime({ message: "Invalid start date and time format." })
    .refine(val => val && val.trim() !== "" && isValid(parseISO(val)), { message: "Start time is required and must be a valid ISO 8601 date-time string."}),
  endTime: z.string().datetime({ message: "Invalid end date and time format." }).optional().nullable()
    .refine(val => val === null || val === undefined || val === "" || isValid(parseISO(val)), { message: "End time must be a valid ISO 8601 date-time string or empty."}),
  googleMapsImageUrl: z.string().url({message: "Invalid URL for map image."}).optional().nullable().or(z.literal("")), // Allow empty string for initial state
  rating: z.number().min(0).max(5).optional().nullable(),
  reviewCount: z.number().int().min(0).optional().nullable(),
  activitySuggestions: z.array(z.string()).optional().nullable().default([]),
  isOperational: z.boolean().optional(),
  statusText: z.string().optional().nullable(),
  businessStatus: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
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
  }).optional().nullable(),
});

export const planSchema = z.object({
  name: z.string().min(1, { message: "Plan name is required." }),
  description: z.string().min(1, { message: "Description is required." }),
  eventTime: z.string().datetime({ offset: true, message: "Invalid date and time format. Expected ISO 8601 format." })
    .refine(val => isValid(parseISO(val)), { message: "Event start time & date must be a valid ISO 8601 date-time string." }),
  location: z.string(),
  city: z.string(),
  eventType: z.string().min(1, { message: "Event type is required." }),
  priceRange: z.enum(COMMON_PRICE_RANGES as [string, ...string[]], {
    errorMap: () => ({ message: "Please select a valid price range." })
  }),
  status: z.enum(["draft", "active", "confirmed", "completed", "cancelled"]),
  invitedParticipantUserIds: z.array(z.string()).default([]),
  selectedPoint: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional().nullable(),
  mapRadiusKm: z.number().optional().nullable(),
  itinerary: z.array(itineraryItemSchema).min(1, { message: "At least one itinerary item is required." }).default([]),
  planType: z.enum(['single-stop', 'multi-stop']).default('single-stop'),
  userEnteredCityForStep2: z.string().optional().nullable(),
  createdAt: z.string().datetime({ offset: true }).optional(),
  updatedAt: z.string().datetime({ offset: true }).optional(),
  hostId: z.string().min(1, { message: "Host ID is required." }),
  id: z.string().optional(),
});


export const profileSchema = z.object({
  id: z.string().min(1, {message: "User ID cannot be empty."}),
  firstName: z.string().min(2, { message: "First name must be at least 2 characters." }),
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phoneNumber: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    return /^[+]?[\d\s()-]+$/.test(val);
  }, { message: "Invalid phone number format." }),
  birthDate: z.string().datetime({ message: "Invalid date format. Expected ISO 8601 format." }).optional().nullable()
    .refine(val => val === null || val === undefined || val === "" || isValid(parseISO(val)), { message: "Birth date must be a valid ISO 8601 date-time string or empty." }),
  address: z.object({
    street: z.string().min(1, { message: "Street address cannot be empty." }),
    city: z.string().min(1, { message: "City cannot be empty." }),
    state: z.string().optional().nullable(),
    zipCode: z.string().optional().nullable(),
    country: z.string().min(1, { message: "Country cannot be empty." }),
  }),
  avatarUrl: z.string().url({ message: "Invalid URL format for avatar." }).optional().nullable(),
  allergies: z.array(z.string()).default([]),
  dietaryRestrictions: z.array(z.string()).default([]),
  preferences: z.preprocess(
    (val) => {
      if (Array.isArray(val)) {
        // If it's already an array (e.g., from direct state update), join it.
        return val.map(String).join(',');
      }
      // If it's a string (from form input), pass it through.
      // If it's null/undefined, convert to empty string for split.
      if (typeof val === 'string') return val;
      return String(val ?? '');
    },
    z.string() // Expect a string after preprocessing (or an empty string)
  ).transform(stringToArrayTransformer), // Then transform to array
  favoriteCuisines: z.array(z.string()).default([]),

  physicalLimitations: z.array(z.string()).default([]),
  activityTypePreferences: z.array(z.string()).default([]),
  activityTypeDislikes: z.array(z.string()).default([]),
  environmentalSensitivities: z.array(z.string()).default([]),
  travelTolerance: z.string().optional().nullable(),
  budgetFlexibilityNotes: z.string().optional().nullable(),
  socialPreferences: z.array(z.string()).default([]),

  availability: z.string().optional().nullable(),
});

export type ProfileSchemaInput = z.input<typeof profileSchema>;
export type ProfileSchemaOutput = z.infer<typeof profileSchema>;


export const suggestionRequestSchema = z.object({
  city: z.string().min(1, "City is required."),
  time: z.string().min(1, "Time is required."),
  planDescription: z.string().min(1, "Plan description is required."),
  friendPreferences: z.array(z.string()).optional().default([]),
});

export type SuggestionRequestValues = z.infer<typeof suggestionRequestSchema>;

export const GenerateItineraryItemDetailsInputSchema = z.object({
  placeName: z.string().describe('The name of the place or activity for this itinerary stop.'),
  address: z.string().describe('The full street address for this stop.'),
  city: z.string().min(1, "City is required for itinerary item AI assistance.").describe('The city for this stop.'),
  mainEventISOStartTime: z.string().datetime({ offset: true }).describe('The main event start time in ISO 8601 format. Use this as a reference for the first item.'),
  planOverallDescription: z.string().describe('The overall description of the event plan for context. May be truncated if very long.'),
  participantPreferences: z.array(z.string()).optional().describe('A list of preferences and restrictions for participants.'),
  previousItemAddress: z.string().optional().nullable().describe("The address of the previous itinerary item, if applicable. This is used with previousItemCity to calculate travel time."),
  previousItemCity: z.string().optional().nullable().describe("The city of the previous itinerary item, if applicable. This is used with previousItemAddress to calculate travel time."),
  previousItemISOEndTime: z.string().datetime({ offset: true }).optional().nullable().describe('The ISO 8601 end time of the previous itinerary item, if this is not the first item. Use this to sequence the current item.'),
  isFirstItem: z.boolean().describe('Whether this is the first item in the itinerary.'),
});

// Exporting the schema with the alias used in create-plan-form.tsx
export const ZodAIItineraryInputSchema = GenerateItineraryItemDetailsInputSchema;
