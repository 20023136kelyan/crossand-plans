// use server'

/**
 * @fileOverview Generates tailored event suggestions based on plan details and participant preferences.
 *
 * - generateEventSuggestions - A function that generates event suggestions.
 * - GenerateEventSuggestionsInput - The input type for the generateEventSuggestions function.
 * - GenerateEventSuggestionsOutput - The return type for the generateEventSuggestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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
  return generateEventSuggestionsFlow(input);
}

const generateEventSuggestionsPrompt = ai.definePrompt({
  name: 'generateEventSuggestionsPrompt',
  input: {schema: GenerateEventSuggestionsInputSchema},
  output: {schema: GenerateEventSuggestionsOutputSchema},
  prompt: `You are an AI assistant that suggests events based on the plan's details and the participants' preferences and dietary restrictions.

  Plan Description: {{{planDescription}}}
  City: {{{city}}}
  Time: {{{time}}}
  Friend Preferences and Restrictions: {{#each friendPreferences}}{{{this}}}, {{/each}}

  Please provide a list of event suggestions that would be suitable for this group.
  Format the output as a numbered list of suggestions.
  `,
});

const generateEventSuggestionsFlow = ai.defineFlow(
  {
    name: 'generateEventSuggestionsFlow',
    inputSchema: GenerateEventSuggestionsInputSchema,
    outputSchema: GenerateEventSuggestionsOutputSchema,
  },
  async input => {
    try {
      const {output} = await generateEventSuggestionsPrompt(input);
      if (!output) {
        console.error("AI prompt for event suggestions returned no output for input:", input);
        throw new Error('AI failed to generate event suggestions output.');
      }
      return output;
    } catch (e) {
      console.error(`Error in generateEventSuggestionsFlow for input: ${JSON.stringify(input)}:`, e);
      throw new Error(`generateEventSuggestionsFlow failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

