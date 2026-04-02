'use server';
/**
 * @fileOverview Generates a plan price range suggestion based on other plan details.
 *
 * - generatePlanPriceRange - A function that generates a plan price range.
 * - GeneratePlanPriceRangeInput - The input type for the generatePlanPriceRange function.
 * - GeneratePlanPriceRangeOutput - The return type for the generatePlanPriceRange function.
 */

import {z} from 'zod';
import {derivePriceRange} from '@/ai/local-generators';

const GeneratePlanPriceRangeInputSchema = z.object({
  city: z.string().describe('The city where the event will take place.'),
  time: z.string().describe('The time of the event (e.g., "Next Friday at 19:00", "Saturday afternoon around 14:00").'),
  planName: z.string().optional().describe('The current name of the plan, if any.'),
  planDescription: z.string().optional().describe('The current description of the plan, if any.'),
  eventType: z.string().optional().describe('The type of event, if specified.'),
  location: z.string().optional().describe('The suggested location for the event, if any.'),
  friendPreferences: z.array(z.string()).optional().describe("A list of invited friends' preferences, especially regarding budget."),
});

export type GeneratePlanPriceRangeInput = z.infer<typeof GeneratePlanPriceRangeInputSchema>;

const GeneratePlanPriceRangeOutputSchema = z.object({
  suggestedPriceRange: z.string().describe('The suggested price range for the plan.'),
});

export type GeneratePlanPriceRangeOutput = z.infer<typeof GeneratePlanPriceRangeOutputSchema>;

export async function generatePlanPriceRange(
  input: GeneratePlanPriceRangeInput
): Promise<GeneratePlanPriceRangeOutput> {
  const validatedInput = GeneratePlanPriceRangeInputSchema.parse(input);
  return {
    suggestedPriceRange: derivePriceRange(validatedInput),
  };
}
