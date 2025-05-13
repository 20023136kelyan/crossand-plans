'use server';
/**
 * @fileOverview Generates a plan price range suggestion based on other plan details.
 *
 * - generatePlanPriceRange - A function that generates a plan price range.
 * - GeneratePlanPriceRangeInput - The input type for the generatePlanPriceRange function.
 * - GeneratePlanPriceRangeOutput - The return type for the generatePlanPriceRange function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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
  return generatePlanPriceRangeFlow(input);
}

const generatePlanPriceRangePrompt = ai.definePrompt({
  name: 'generatePlanPriceRangePrompt',
  input: {schema: GeneratePlanPriceRangeInputSchema},
  output: {schema: GeneratePlanPriceRangeOutputSchema},
  prompt: `Suggest a typical price range for an event.
{{#if friendPreferences.length}}Consider these participant preferences regarding budget: {{#each friendPreferences}}{{{this}}}; {{/each}}{{/if}}
Context:
{{#if planName}}Event Name: {{{planName}}}{{/if}}
{{#if planDescription}}Description: {{{planDescription}}}{{/if}}
{{#if eventType}}Event Type: {{{eventType}}}{{/if}}
City: {{{city}}}
Time: {{{time}}} (Use 24-hour format like 19:00 for 7 PM if applicable)
{{#if location}}Location: {{{location}}}{{/if}}
Examples of price ranges:
- Free
- Budget (0-15 USD)
- Mid-range (15-40 USD)
- High-end (40-100 USD)
- Luxury (100+ USD)
- Contact for Price
- Varies
Provide only the price range string. Do not add any extra text or quotation marks.`,
});

const generatePlanPriceRangeFlow = ai.defineFlow(
  {
    name: 'generatePlanPriceRangeFlow',
    inputSchema: GeneratePlanPriceRangeInputSchema,
    outputSchema: GeneratePlanPriceRangeOutputSchema,
  },
  async input => {
    try {
      const {output} = await generatePlanPriceRangePrompt(input);
      if (!output) {
        console.error("AI prompt for plan price range returned no output for input:", input);
        throw new Error('AI failed to generate plan price range output.');
      }
      return output;
    } catch (e) {
      console.error(`Error in generatePlanPriceRangeFlow for input: ${JSON.stringify(input)}:`, e);
      throw new Error(`generatePlanPriceRangeFlow failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

