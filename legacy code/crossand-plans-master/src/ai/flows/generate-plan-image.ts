'use server';
/**
 * @fileOverview AI-powered plan image generator.
 * Defines a Genkit flow for generating cover images for plans.
 * @exports generatePlanImage
 * @exports GeneratePlanImageInput
 * @exports GeneratePlanImageOutput
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePlanImageInputSchema = z.object({
  planName: z.string().describe('The name of the plan.'),
  eventType: z.string().optional().describe('The type of event (e.g., concert, dinner, hike).'),
  city: z.string().optional().describe('The city where the event is taking place.'),
  description: z.string().optional().describe('A brief description of the plan for context.'),
});
export type GeneratePlanImageInput = z.infer<typeof GeneratePlanImageInputSchema>;

const GeneratePlanImageOutputSchema = z.object({
  imageDataUri: z.string().describe("The generated image as a data URI. Expected format: 'data:image/png;base64,<encoded_data>'."),
});
export type GeneratePlanImageOutput = z.infer<typeof GeneratePlanImageOutputSchema>;

export async function generatePlanImage(input: GeneratePlanImageInput): Promise<GeneratePlanImageOutput> {
  return generatePlanImageFlow(input);
}

const generatePlanImageFlow = ai.defineFlow(
  {
    name: 'generatePlanImageFlow',
    inputSchema: GeneratePlanImageInputSchema,
    outputSchema: GeneratePlanImageOutputSchema,
  },
  async (input) => {
    const promptParts = [
      `Generate a visually appealing, vibrant, modern, illustrative style cover image suitable for a social plan. The image should be safe for work and general audiences. Avoid any text in the image. Focus on conveying the mood or theme of the plan.`,
      `Plan Name: ${input.planName}`,
    ];
    if (input.eventType) promptParts.push(`Event Type: ${input.eventType}`);
    if (input.city) promptParts.push(`Location Hint: ${input.city}`);
    if (input.description) promptParts.push(`Details: ${input.description}`);

    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp', 
      prompt: promptParts.join('\n'),
      config: {
        responseModalities: ['IMAGE', 'TEXT'], // Important: Must include IMAGE and TEXT for this model
         safetySettings: [ // Add safety settings to reduce chances of restricted content
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      },
    });

    if (!media || !media.url) {
      console.error('Image generation failed or returned no media URL.', media);
      throw new Error('Image generation failed to produce an image URL.');
    }
    
    // Ensure the URL is a data URI as expected by the output schema
    if (!media.url.startsWith('data:image/')) {
        console.error('Generated media URL is not a data URI:', media.url);
        throw new Error('Image generation returned an invalid image format. Expected a data URI.');
    }

    return {imageDataUri: media.url};
  }
);
