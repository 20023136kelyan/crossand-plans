import { z } from 'zod';

export const ItineraryItemSchema = z.object({
  id: z.string(),
  placeName: z.string().min(1, "Place name is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  description: z.string().optional(),
  startTime: z.union([z.string().datetime({ message: "Invalid start time format" }), z.date()]),
  endTime: z.union([z.string().datetime({ message: "Invalid end time format" }), z.date()]).optional().nullable(),
  googleMapsImageUrl: z.string().url({ message: "Invalid Google Maps Image URL" }).optional().nullable(),
  rating: z.number().optional().nullable(),
  reviewCount: z.number().optional().nullable(),
  activitySuggestions: z.array(z.string()).optional(),
  businessStatus: z.string().optional().nullable(),
  isOperational: z.boolean().optional(),
  statusText: z.string().optional().nullable(),
  openingHours: z.any().optional(), // For simplicity; ideally, define a strict schema for openingHours
  phoneNumber: z.string().optional().nullable(),
  website: z.string().url({ message: "Invalid website URL" }).optional().nullable(),
  priceLevel: z.number().optional().nullable(),
  types: z.array(z.string()).optional(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  googlePlaceId: z.string().optional().nullable(),
  googleMapsUrl: z.string().url({ message: "Invalid Google Maps URL" }).optional().nullable(),
});

export const PlanSchema = z.object({
  hostId: z.string().min(1, "Host ID is required"), // Crucial for the "host ID required" error
  name: z.string().min(1, "Plan name is required"),
  description: z.string().optional(),
  eventTime: z.union([z.string().datetime({ message: "Invalid event time format" }), z.date()]),
  eventType: z.string().optional(),
  priceRange: z.string().optional(),
  invitedParticipantUserIds: z.array(z.string()).optional(),
  status: z.string().optional(),
  itinerary: z.array(ItineraryItemSchema).min(1, "At least one itinerary item is required."), // Ensures itinerary is not empty
  location: z.string().optional(),
  city: z.string().optional(),
});