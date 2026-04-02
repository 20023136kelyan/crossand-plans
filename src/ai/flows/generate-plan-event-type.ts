'use server';
/**
 * @fileOverview Generates a plan event type based on other plan details.
 *
 * - generatePlanEventType - A function that generates a plan event type.
 * - GeneratePlanEventTypeInput - The input type for the generatePlanEventType function.
 * - GeneratePlanEventTypeOutput - The return type for the generatePlanEventType function.
 */

import {z} from 'zod';
import {deriveEventType} from '@/ai/local-generators';

const ItineraryContextItemSchemaForEventType = z.object({
  placeName: z.string(),
  description: z.string().optional(),
});


const GeneratePlanEventTypeInputSchema = z.object({
  city: z.string().describe('The city where the event will take place.'),
  time: z.string().describe('The time of the event (e.g., "Next Friday at 19:00", "Saturday afternoon around 14:00").'),
  planName: z.string().optional().describe('The current name of the plan, if any.'),
  planDescription: z.string().optional().describe('The current description of the plan, if any.'),
  planType: z.enum(['single-stop', 'multi-stop']).describe('Whether this is a single-stop or multi-stop event.'),
  friendPreferences: z.array(z.string()).optional().describe("A list of invited friends' preferences and dietary restrictions."),
  itinerary: z.array(ItineraryContextItemSchemaForEventType).optional().describe("A list of itinerary stops to consider for the event type. Each item should have a placeName and optional description.")
});

export type GeneratePlanEventTypeInput = z.infer<typeof GeneratePlanEventTypeInputSchema>;

const GeneratePlanEventTypeOutputSchema = z.object({
  suggestedEventType: z.string().describe('The suggested event type for the plan.'),
});

export type GeneratePlanEventTypeOutput = z.infer<typeof GeneratePlanEventTypeOutputSchema>;

export async function generatePlanEventType(
  input: GeneratePlanEventTypeInput
): Promise<GeneratePlanEventTypeOutput> {
  const validatedInput = GeneratePlanEventTypeInputSchema.parse(input);
  return {
    suggestedEventType: deriveEventType(validatedInput),
  };
}
