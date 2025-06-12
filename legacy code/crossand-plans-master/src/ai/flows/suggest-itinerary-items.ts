// src/ai/flows/suggest-itinerary-items.ts
'use server';
/**
 * @fileOverview AI-powered itinerary item suggestions using plan details and Google Places API.
 *
 * - suggestItineraryItems - A function that suggests itinerary items.
 * - SuggestItineraryItemsInput - The input type for the suggestItineraryItems function.
 * - SuggestItineraryItemsOutput - The return type for the suggestItineraryItems function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestItineraryItemsInputSchema = z.object({
  city: z.string().describe('The city for the itinerary.'),
  eventDate: z.string().describe('The date of the event.'),
  eventType: z.string().describe('The type of the event (e.g., concert, dinner).'),
  priceRange: z.string().describe('The price range for the itinerary items (e.g., $, $$, $$$).'),
  participants: z.string().describe('The number of participants.'),
  interests: z.string().describe('A description of user interests e.g., Italian food, history'),
});
export type SuggestItineraryItemsInput = z.infer<typeof SuggestItineraryItemsInputSchema>;

const SuggestItineraryItemsOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('A list of suggested itinerary items (activities, restaurants, etc.).'),
});
export type SuggestItineraryItemsOutput = z.infer<typeof SuggestItineraryItemsOutputSchema>;

export async function suggestItineraryItems(input: SuggestItineraryItemsInput): Promise<SuggestItineraryItemsOutput> {
  return suggestItineraryItemsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestItineraryItemsPrompt',
  input: {schema: SuggestItineraryItemsInputSchema},
  output: {schema: SuggestItineraryItemsOutputSchema},
  prompt: `Suggest itinerary items (activities, restaurants, etc.) for a plan in {{city}} on {{eventDate}}.

The event type is {{eventType}}, the price range is {{priceRange}}, and there will be {{participants}} participants.
The user is interested in the following: {{interests}}.

Suggestions:`,
});

const suggestItineraryItemsFlow = ai.defineFlow(
  {
    name: 'suggestItineraryItemsFlow',
    inputSchema: SuggestItineraryItemsInputSchema,
    outputSchema: SuggestItineraryItemsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
