'use server';
/**
 * @fileOverview Generates detailed information for a specific itinerary item.
 */

import {z} from 'zod';
import {GenerateItineraryItemDetailsInputSchema} from '@/lib/schemas';
import {deriveItineraryItemDetails} from '@/ai/local-generators';

export type GenerateItineraryItemDetailsInput = z.infer<typeof GenerateItineraryItemDetailsInputSchema>;

const GenerateItineraryItemDetailsOutputSchema = z.object({
  suggestedDescription: z.string(),
  suggestedISOStartTime: z.string().datetime().nullable(),
  suggestedISOEndTime: z.string().datetime().optional().nullable(),
  suggestedActivitySuggestions: z.array(z.string()),
  isOperational: z.boolean().optional(),
  statusText: z.string().optional(),
});

export type GenerateItineraryItemDetailsOutput = z.infer<typeof GenerateItineraryItemDetailsOutputSchema>;

export async function generateItineraryItemDetails(
  input: GenerateItineraryItemDetailsInput
): Promise<GenerateItineraryItemDetailsOutput> {
  const validatedInput = GenerateItineraryItemDetailsInputSchema.parse(input);
  return GenerateItineraryItemDetailsOutputSchema.parse(
    deriveItineraryItemDetails(validatedInput)
  );
}

