'use server';
/**
 * @fileOverview Generates a plan description based on other plan details.
 *
 * - generatePlanDescription - A function that generates a plan description.
 * - GeneratePlanDescriptionInput - The input type for the generatePlanDescription function.
 * - GeneratePlanDescriptionOutput - The return type for the generatePlanDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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
  return generatePlanDescriptionFlow(input);
}

const generatePlanDescriptionPrompt = ai.definePrompt({
  name: 'generatePlanDescriptionPrompt',
  input: {schema: GeneratePlanDescriptionInputSchema},
  output: {schema: GeneratePlanDescriptionOutputSchema},
  prompt: `Write a brief, engaging event description (1-2 sentences).
{{#if friendPreferences.length}}Consider these participant preferences: {{#each friendPreferences}}{{{this}}}; {{/each}}{{/if}}
Context:
{{#if planName}}Event Name: {{{planName}}}{{/if}}
City: {{{city}}}
Time: {{{time}}} (Use 24-hour format like 19:00 for 7 PM if applicable)
{{#if eventType}}Event Type: {{{eventType}}}{{/if}}
{{#if location}}Start Location: {{{location}}}{{/if}}
{{#if priceRange}}Price Range: {{{priceRange}}}{{/if}}
Plan Type: {{{planType}}} (single-stop means one location only, multi-stop means multiple locations)

{{#if itinerary.length}}
Event Itinerary Overview:
{{#each itinerary}}
- Stop: {{{placeName}}}{{#if description}} ({{{description}}}){{/if}}
{{/each}}
Based on this itinerary and plan type ({{{planType}}}), generate an engaging overall event description.
{{else}}
Consider the general plan details and plan type ({{{planType}}}) to generate the description.
{{/if}}

The description should be suitable for an event planning app. Provide only the description. Do not add any extra text or quotation marks.`,
});

const generatePlanDescriptionFlow = ai.defineFlow(
  {
    name: 'generatePlanDescriptionFlow',
    inputSchema: GeneratePlanDescriptionInputSchema,
    outputSchema: GeneratePlanDescriptionOutputSchema,
  },
  async input => {
    try {
      const {output} = await generatePlanDescriptionPrompt(input);
      if (!output) {
        console.error("AI prompt for plan description returned no output for input:", input);
        throw new Error('AI failed to generate plan description output.');
      }
      return output;
    } catch (e) {
      console.error(`Error in generatePlanDescriptionFlow for input: ${JSON.stringify(input)}:`, e);
      throw new Error(`generatePlanDescriptionFlow failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

