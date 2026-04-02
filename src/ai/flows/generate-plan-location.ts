
'use server';
/**
 * @fileOverview Generates a plan location suggestion based on other plan details and participant preferences.
 *
 * - generatePlanLocation - A function that generates a plan location.
 * - GeneratePlanLocationInput - The input type for the generatePlanLocation function.
 * - GeneratePlanLocationOutput - The return type for the generatePlanLocation function.
 */

import {z} from 'zod';
import {deriveLocation} from '@/ai/local-generators';

const GeneratePlanLocationInputSchema = z.object({
  city: z.string().describe('The city where the event will take place.'),
  time: z.string().describe('The time of the event (e.g., "Next Friday at 19:00", "Saturday afternoon around 14:00").'),
  planName: z.string().optional().describe('The current name of the plan, if any.'),
  planDescription: z.string().optional().describe('The current description of the plan, if any.'),
  eventType: z.string().optional().describe('The type of event, if specified.'),
  friendPreferences: z.array(z.string()).optional().describe("A list of invited friends' preferences, dietary restrictions, and accessibility needs."),
  selectedPoint: z.object({ 
    lat: z.number(), 
    lng: z.number() 
  }).optional().nullable().describe('The geographical center point (latitude, longitude) for the search area, if specified by the user on a map when no specific venue is entered.'),
  mapRadiusKm: z.number().optional().nullable().describe('The radius in kilometers around the selectedPoint for the search area, if specified by the user on a map when no specific venue is entered.'),
});

export type GeneratePlanLocationInput = z.infer<typeof GeneratePlanLocationInputSchema>;

const GeneratePlanLocationOutputSchema = z.object({
  suggestedLocation: z.string().describe('The suggested location or venue name for the plan.'),
});

export type GeneratePlanLocationOutput = z.infer<typeof GeneratePlanLocationOutputSchema>;

export async function generatePlanLocation(
  input: GeneratePlanLocationInput
): Promise<GeneratePlanLocationOutput> {
  const validatedInput = GeneratePlanLocationInputSchema.parse(input);
  return {
    suggestedLocation: deriveLocation(validatedInput),
  };
}
