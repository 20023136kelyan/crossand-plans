
'use server';
/**
 * @fileOverview Generates a plan name based on other plan details.
 *
 * - generatePlanName - A function that generates a plan name.
 * - GeneratePlanNameInput - The input type for the generatePlanName function.
 * - GeneratePlanNameOutput - The return type for the generatePlanName function.
 */

import {z} from 'zod';
import {derivePlanName} from '@/ai/local-generators';

const GeneratePlanNameInputSchema = z.object({
  city: z.string().describe('The city where the event will take place.'),
  time: z.string().describe('The time of the event (e.g., "Next Friday at 19:00", "Saturday afternoon around 14:00").'),
  planDescription: z.string().optional().describe('The current description of the plan, if any.'),
  eventType: z.string().optional().describe('The type of event, if specified.'),
  friendPreferences: z.array(z.string()).optional().describe("A list of invited friends' preferences and dietary restrictions."),
});

export type GeneratePlanNameInput = z.infer<typeof GeneratePlanNameInputSchema>;

const GeneratePlanNameOutputSchema = z.object({
  suggestedName: z.string().describe('The suggested name for the plan.'),
});

export type GeneratePlanNameOutput = z.infer<typeof GeneratePlanNameOutputSchema>;

export async function generatePlanName(
  input: GeneratePlanNameInput
): Promise<GeneratePlanNameOutput> {
  const validatedInput = GeneratePlanNameInputSchema.parse(input);
  return {
    suggestedName: derivePlanName(validatedInput),
  };
}
