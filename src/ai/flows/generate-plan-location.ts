
'use server';
/**
 * @fileOverview Generates a plan location suggestion based on other plan details and participant preferences.
 *
 * - generatePlanLocation - A function that generates a plan location.
 * - GeneratePlanLocationInput - The input type for the generatePlanLocation function.
 * - GeneratePlanLocationOutput - The return type for the generatePlanLocation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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
  return generatePlanLocationFlow(input);
}

const generatePlanLocationPrompt = ai.definePrompt({
  name: 'generatePlanLocationPrompt',
  input: {schema: GeneratePlanLocationInputSchema},
  output: {schema: GeneratePlanLocationOutputSchema},
  prompt: `Suggest a specific venue name, area, or type of location within the specified city for an event.
{{#if selectedPoint}}
The event should ideally be within a {{{mapRadiusKm}}} kilometer radius of latitude {{{selectedPoint.lat}}} and longitude {{{selectedPoint.lng}}}. Consider venues within this area.
{{/if}}
{{#if friendPreferences.length}}
Consider the preferences and restrictions of the participants:
{{#each friendPreferences}}- {{{this}}}
{{/each}}
{{/if}}
Context:
{{#if planName}}Event Name: {{{planName}}}{{/if}}
{{#if planDescription}}Description: {{{planDescription}}}{{/if}}
{{#if eventType}}Event Type: {{{eventType}}}{{/if}}
City: {{{city}}}
Time: {{{time}}} (Use 24-hour format like 19:00 for 7 PM if applicable)
Provide a concise location name or type (e.g., "Central Park", "The Tech Hub Auditorium", "A cozy cafe downtown", "Riverside picnic spot"). Do not add any extra text or quotation marks.`,
});

const generatePlanLocationFlow = ai.defineFlow(
  {
    name: 'generatePlanLocationFlow',
    inputSchema: GeneratePlanLocationInputSchema,
    outputSchema: GeneratePlanLocationOutputSchema,
  },
  async input => {
    try {
      const {output} = await generatePlanLocationPrompt(input);
      if (!output) {
        console.error("AI prompt for plan location returned no output for input:", input);
        throw new Error('AI failed to generate plan location output.');
      }
      return output;
    } catch (e) {
      console.error(`Error in generatePlanLocationFlow for input: ${JSON.stringify(input)}:`, e);
      throw new Error(`generatePlanLocationFlow failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

