/**
 * @fileOverview A tool to estimate travel time between two locations.
 * - getTravelTime: The Genkit tool definition.
 * - GetTravelTimeInputSchema: Input schema for the tool.
 * - GetTravelTimeOutputSchema: Output schema for the tool.
 */
import {z} from 'zod';
import {estimateTravelMinutes} from '@/ai/local-generators';

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

export async function getTravelTime(input: GetTravelTimeInput): Promise<GetTravelTimeOutput> {
  const minutes = estimateTravelMinutes(
    input.originAddress,
    input.originCity,
    input.destinationAddress,
    input.destinationCity
  );

  return {
    durationSeconds: minutes * 60,
  };
}
