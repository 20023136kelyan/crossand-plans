'use server';
/**
 * @fileOverview Generates a plan description based on other plan details.
 *
 * - generatePlanDescription - A function that generates a plan description.
 * - GeneratePlanDescriptionInput - The input type for the generatePlanDescription function.
 * - GeneratePlanDescriptionOutput - The return type for the generatePlanDescription function.
 */

import {z} from 'zod';
import {deriveDescription} from '@/ai/local-generators';

const ItineraryContextItemSchema = z.object({
  placeName: z.string(),
  description: z.string().optional(),
});

const GeneratePlanDescriptionInputSchema = z.object({
  city: z.string().describe('The city where the event will take place.'),
  time: z.string().describe('The time of the event (e.g., "Next Friday at 19:00", "Saturday afternoon around 14:00").'),
  planName: z.string().optional().describe('The current name of the plan, if any.'),
  eventType: z.string().optional().describe('The type of event, if specified.'),
  location: z.string().optional().describe('The specific location or venue for the event, if specified.'),
  priceRange: z.string().optional().describe('The estimated price range for the event, if specified.'),
  planType: z.enum(['single-stop', 'multi-stop']).describe('Whether this is a single-stop or multi-stop event.'),
  friendPreferences: z.array(z.string()).optional().describe("A list of invited friends' preferences and dietary restrictions."),
  itinerary: z.array(ItineraryContextItemSchema).optional().describe("A list of itinerary stops to consider for the description. Each item should have a placeName and optional description.")
});

export type GeneratePlanDescriptionInput = z.infer<typeof GeneratePlanDescriptionInputSchema>;

const GeneratePlanDescriptionOutputSchema = z.object({
  suggestedDescription: z.string().describe('The suggested description for the plan.'),
});

export type GeneratePlanDescriptionOutput = z.infer<typeof GeneratePlanDescriptionOutputSchema>;

export async function generatePlanDescription(
  input: GeneratePlanDescriptionInput
): Promise<GeneratePlanDescriptionOutput> {
  const validatedInput = GeneratePlanDescriptionInputSchema.parse(input);
  return {
    suggestedDescription: deriveDescription(validatedInput),
  };
}
