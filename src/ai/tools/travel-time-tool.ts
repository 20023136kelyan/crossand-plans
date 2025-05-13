/**
 * @fileOverview A tool to estimate travel time between two locations.
 * - getTravelTime: The Genkit tool definition.
 * - GetTravelTimeInputSchema: Input schema for the tool.
 * - GetTravelTimeOutputSchema: Output schema for the tool.
 */
import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const GetTravelTimeInputSchema = z.object({
  originAddress: z.string().describe("The full starting address, e.g., '1600 Amphitheatre Parkway'."),
  originCity: z.string().describe("The starting city, e.g., 'Mountain View'."),
  destinationAddress: z.string().describe("The full destination address, e.g., '1 Infinite Loop'."),
  destinationCity: z.string().describe("The destination city, e.g., 'Cupertino'."),
  // travelMode: z.enum(["driving", "walking", "transit"]).default("driving").describe("The mode of travel."), // Optional for now
});
export type GetTravelTimeInput = z.infer<typeof GetTravelTimeInputSchema>;

export const GetTravelTimeOutputSchema = z.object({
  durationSeconds: z.number().int().min(0).describe("Estimated travel time in seconds."),
  // distanceMeters: z.number().int().min(0).optional().describe("Estimated travel distance in meters."), // Optional
});
export type GetTravelTimeOutput = z.infer<typeof GetTravelTimeOutputSchema>;

export const getTravelTime = ai.defineTool(
  {
    name: 'getTravelTime',
    description: 'Estimates the travel time in seconds between two specified locations (origin and destination). Useful for planning sequential events and allowing for travel between them. Provide full addresses and cities for best results.',
    inputSchema: GetTravelTimeInputSchema,
    outputSchema: GetTravelTimeOutputSchema,
  },
  async (input) => {
    console.warn(`[MOCK] getTravelTime called for: ${input.originAddress}, ${input.originCity} to ${input.destinationAddress}, ${input.destinationCity}. Returning mock travel time.`);
    // MOCK IMPLEMENTATION: In a real app, this would call Google Maps Directions API or similar.
    // For now, return a mock duration (e.g., 15 minutes for short distances, 30 for longer, or random)
    // For simplicity, let's return a fixed 1200 seconds (20 minutes) + a small random factor.
    const baseDuration = 1200; // 20 minutes
    const randomFactor = Math.floor(Math.random() * 600); // 0 to 10 minutes
    return {
      durationSeconds: baseDuration + randomFactor,
    };
  }
);
