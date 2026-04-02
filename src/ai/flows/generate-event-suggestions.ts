'use server';

/**
 * @fileOverview Generates tailored event suggestions based on plan details and participant preferences.
 *
 * - generateEventSuggestions - A function that generates event suggestions.
 * - GenerateEventSuggestionsInput - The input type for the generateEventSuggestions function.
 * - GenerateEventSuggestionsOutput - The return type for the generateEventSuggestions function.
 */

import {z} from 'zod';
import {deriveEventSuggestions} from '@/ai/local-generators';

const GenerateEventSuggestionsInputSchema = z.object({
  city: z.string().describe('The city where the event will take place.'),
  time: z.string().describe('The time of the event.'),
  friendPreferences: z
    .array(z.string())
    .describe("A list of friends' preferences and dietary restrictions."),
  planDescription: z.string().describe('The description of the plan.'),
});

export type GenerateEventSuggestionsInput = z.infer<
  typeof GenerateEventSuggestionsInputSchema
>;

const GenerateEventSuggestionsOutputSchema = z.object({
  suggestions: z
    .array(z.string())
    .describe('A list of event suggestions tailored to the group.'),
});

export type GenerateEventSuggestionsOutput = z.infer<
  typeof GenerateEventSuggestionsOutputSchema
>;

export async function generateEventSuggestions(
  input: GenerateEventSuggestionsInput
): Promise<GenerateEventSuggestionsOutput> {
  const validatedInput = GenerateEventSuggestionsInputSchema.parse(input);
  return {
    suggestions: deriveEventSuggestions(validatedInput),
  };
}
