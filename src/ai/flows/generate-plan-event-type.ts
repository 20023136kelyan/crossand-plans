'use server';
/**
 * @fileOverview Generates a plan event type based on other plan details.
 *
 * - generatePlanEventType - A function that generates a plan event type.
 * - GeneratePlanEventTypeInput - The input type for the generatePlanEventType function.
 * - GeneratePlanEventTypeOutput - The return type for the generatePlanEventType function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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
  return generatePlanEventTypeFlow(input);
}

const generatePlanEventTypePrompt = ai.definePrompt({
  name: 'generatePlanEventTypePrompt',
  input: {schema: GeneratePlanEventTypeInputSchema},
  output: {schema: GeneratePlanEventTypeOutputSchema},
  prompt: `Suggest a concise event type (e.g., 'Birthday Party', 'Weekend Hike', 'Tech Meetup', 'Book Club').
{{#if friendPreferences.length}}Consider these participant preferences: {{#each friendPreferences}}{{{this}}}; {{/each}}{{/if}}
Context:
{{#if planName}}Event Name: {{{planName}}}{{/if}}
{{#if planDescription}}Description: {{{planDescription}}}{{/if}}
City: {{{city}}}
Time: {{{time}}} (Use 24-hour format like 19:00 for 7 PM if applicable)
Plan Type: {{{planType}}} (single-stop means one location only, multi-stop means multiple locations)

{{#if itinerary.length}}
Event Itinerary Overview:
{{#each itinerary}}
- Stop: {{{placeName}}}{{#if description}} ({{{description}}}){{/if}}
{{/each}}
Based on this itinerary and plan type ({{{planType}}}), suggest a concise event type.
{{else}}
Consider the general plan details and plan type ({{{planType}}}) to suggest the event type.
{{/if}}

Provide only the event type. Do not add any extra text or quotation marks.`,
});

const generatePlanEventTypeFlow = ai.defineFlow(
  {
    name: 'generatePlanEventTypeFlow',
    inputSchema: GeneratePlanEventTypeInputSchema,
    outputSchema: GeneratePlanEventTypeOutputSchema,
  },
  async input => {
    try {
      const {output} = await generatePlanEventTypePrompt(input);
      if (!output) {
        console.error("AI prompt for plan event type returned no output for input:", input);
        throw new Error('AI failed to generate plan event type output.');
      }
      return output;
    } catch (e) {
      console.error(`Error in generatePlanEventTypeFlow for input: ${JSON.stringify(input)}:`, e);
      throw new Error(`generatePlanEventTypeFlow failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

