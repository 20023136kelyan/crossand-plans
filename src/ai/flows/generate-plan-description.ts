// This file is machine-generated - DO NOT EDIT.

'use server';

/**
 * @fileOverview AI-powered plan description generator.
 *
 * This file defines a Genkit flow for generating plan descriptions based on plan details.
 * The flow uses the Google Gemini model via Genkit to create engaging and informative descriptions.
 *
 * @exports generatePlanDescription - The main function to generate plan descriptions.
 * @exports GeneratePlanDescriptionInput - The input type for the generatePlanDescription function.
 * @exports GeneratePlanDescriptionOutput - The output type for the generatePlanDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePlanDescriptionInputSchema = z.object({
  planName: z.string().describe('The name of the plan.'),
  eventDateTime: z.string().describe('The date and time of the event.'),
  primaryLocation: z.string().describe('The primary location or venue of the event.'),
  city: z.string().describe('The city where the event is taking place.'),
  eventType: z.string().describe('The type of event (e.g., concert, dinner, meeting).'),
  priceRange: z.string().describe('The price range for the event (e.g., Free, $, $$, $$$).'),
  participants: z.string().describe('The intended participants (e.g., Family, Friends, Colleagues).'),
  dynamicItinerary: z.string().describe('Details about the itinerary of the plan.'),
});

export type GeneratePlanDescriptionInput = z.infer<
  typeof GeneratePlanDescriptionInputSchema
>;

const GeneratePlanDescriptionOutputSchema = z.object({
  description: z
    .string()
    .describe('A captivating and informative description of the plan.'),
});

export type GeneratePlanDescriptionOutput = z.infer<
  typeof GeneratePlanDescriptionOutputSchema
>;

export async function generatePlanDescription(
  input: GeneratePlanDescriptionInput
): Promise<GeneratePlanDescriptionOutput> {
  return generatePlanDescriptionFlow(input);
}

const generatePlanDescriptionPrompt = ai.definePrompt({
  name: 'generatePlanDescriptionPrompt',
  input: {schema: GeneratePlanDescriptionInputSchema},
  output: {schema: GeneratePlanDescriptionOutputSchema},
  prompt: `Create an engaging and informative description for the following plan:

Plan Name: {{{planName}}}
Event Date/Time: {{{eventDateTime}}}
Primary Location: {{{primaryLocation}}}
City: {{{city}}}
Event Type: {{{eventType}}}
Price Range: {{{priceRange}}}
Participants: {{{participants}}}
Itinerary: {{{dynamicItinerary}}}

The description should be concise, highlighting the key aspects of the plan and making it sound appealing to potential participants. Focus on the event's unique selling points and overall experience. The description should be no more than 200 words.
`,
});

const generatePlanDescriptionFlow = ai.defineFlow(
  {
    name: 'generatePlanDescriptionFlow',
    inputSchema: GeneratePlanDescriptionInputSchema,
    outputSchema: GeneratePlanDescriptionOutputSchema,
  },
  async input => {
    const {output} = await generatePlanDescriptionPrompt(input);
    return output!;
  }
);
