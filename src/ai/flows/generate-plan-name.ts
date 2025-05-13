
'use server';
/**
 * @fileOverview Generates a plan name based on other plan details.
 *
 * - generatePlanName - A function that generates a plan name.
 * - GeneratePlanNameInput - The input type for the generatePlanName function.
 * - GeneratePlanNameOutput - The return type for the generatePlanName function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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
  return generatePlanNameFlow(input);
}

const generatePlanNamePrompt = ai.definePrompt({
  name: 'generatePlanNamePrompt',
  input: {schema: GeneratePlanNameInputSchema},
  output: {schema: GeneratePlanNameOutputSchema},
  prompt: `Suggest a short, catchy, and descriptive name for an event.
{{#if friendPreferences.length}}Consider these participant preferences: {{#each friendPreferences}}{{{this}}}; {{/each}}{{/if}}
Context:
City: {{{city}}}
Time: {{{time}}} (Use 24-hour format like 19:00 for 7 PM if applicable)
{{#if planDescription}}Current Description: {{{planDescription}}}{{/if}}
{{#if eventType}}Event Type: {{{eventType}}}{{/if}}
The name should be suitable for an event planning app. Provide only the name. Do not add any extra text or quotation marks.`,
});

const generatePlanNameFlow = ai.defineFlow(
  {
    name: 'generatePlanNameFlow',
    inputSchema: GeneratePlanNameInputSchema,
    outputSchema: GeneratePlanNameOutputSchema,
  },
  async input => {
    try {
      const {output} = await generatePlanNamePrompt(input);
      if (!output) {
        console.error("AI prompt for plan name returned no output for input:", input);
        throw new Error('AI failed to generate plan name output.');
      }
      return output;
    } catch (e) {
      console.error(`Error in generatePlanNameFlow for input: ${JSON.stringify(input)}:`, e);
      throw new Error(`generatePlanNameFlow failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

