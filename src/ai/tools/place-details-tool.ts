
/**
 * @fileOverview A tool to fetch (mocked) details for a place, including operational status and opening hours.
 * - getPlaceDetails: The Genkit tool definition.
 * - GetPlaceDetailsInputSchema: Input schema for the tool.
 * - GetPlaceDetailsOutputSchema: Output schema for the tool.
 */
import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const GetPlaceDetailsInputSchema = z.object({
  placeName: z.string().describe("The name of the place."),
  address: z.string().optional().describe("The full address of the place."),
  city: z.string().optional().describe("The city where the place is located."),
});
export type GetPlaceDetailsInput = z.infer<typeof GetPlaceDetailsInputSchema>;

const OpeningHoursPeriodSchema = z.object({
  open: z.object({ day: z.number().min(0).max(6), time: z.string().regex(/^([01]\d|2[0-3])[0-5]\d$/, "Time must be in HHMM format (e.g., 0900 for 9 AM, 1730 for 5:30 PM).") }),
  close: z.object({ day: z.number().min(0).max(6), time: z.string().regex(/^([01]\d|2[0-3])[0-5]\d$/, "Time must be in HHMM format.") }).optional(), // Close might not be present for 24/7 places
});
export type OpeningHoursPeriod = z.infer<typeof OpeningHoursPeriodSchema>;


export const GetPlaceDetailsOutputSchema = z.object({
  isOperational: z.boolean().describe("Whether the place is currently operational (not permanently or temporarily closed)."),
  openingHours: z.array(OpeningHoursPeriodSchema).optional().describe("An array of opening hours periods. Day is 0 for Sunday, 1 for Monday, ..., 6 for Saturday. Time is in HHMM format (e.g., '0900', '1730')."),
  statusText: z.string().optional().describe("A human-readable status like 'Open 24 hours', 'Closed temporarily', or specific hours for today."),
});
export type GetPlaceDetailsOutput = z.infer<typeof GetPlaceDetailsOutputSchema>;

export const getPlaceDetails = ai.defineTool(
  {
    name: 'getPlaceDetails',
    description: 'Fetches details for a specific place, including its operational status (e.g., OPERATIONAL, CLOSED_TEMPORARILY) and opening hours. Use this to verify a place is open before suggesting it for an itinerary item.',
    inputSchema: GetPlaceDetailsInputSchema,
    outputSchema: GetPlaceDetailsOutputSchema,
  },
  async (input: GetPlaceDetailsInput): Promise<GetPlaceDetailsOutput> => {
    console.warn(`[MOCK] getPlaceDetails called for: ${input.placeName}. Returning mock operational status and hours.`);
    // MOCK IMPLEMENTATION: In a real app, this would call Google Places API or similar.
    // For now, assume most places are operational and have standard hours.
    
    // Simulate a small chance of a place being closed
    if (Math.random() < 0.05) { // 5% chance of being permanently closed
        return {
            isOperational: false,
            statusText: "Permanently Closed",
        };
    }
    if (Math.random() < 0.05) { // Another 5% chance of being temporarily closed
        return {
            isOperational: false,
            statusText: "Temporarily Closed",
        };
    }

    // Mock typical Mon-Fri 9am-5pm, Sat 10am-4pm, Sun closed
    // Day: 0 (Sunday) to 6 (Saturday)
    // Time: HHMM format
    const mockOpeningHours: OpeningHoursPeriod[] = [
      { open: { day: 1, time: "0900" }, close: { day: 1, time: "1700" } }, // Mon
      { open: { day: 2, time: "0900" }, close: { day: 2, time: "1700" } }, // Tue
      { open: { day: 3, time: "0900" }, close: { day: 3, time: "1700" } }, // Wed
      { open: { day: 4, time: "0900" }, close: { day: 4, time: "1700" } }, // Thu
      { open: { day: 5, time: "0900" }, close: { day: 5, time: "1700" } }, // Fri
      { open: { day: 6, time: "1000" }, close: { day: 6, time: "1600" } }, // Sat
    ];
    
    // Simulate some restaurants with evening hours
    if (input.placeName?.toLowerCase().includes('restaurant') || input.placeName?.toLowerCase().includes('diner') || input.placeName?.toLowerCase().includes('cafe')) {
        const restaurantHours : OpeningHoursPeriod[] = [
            { open: { day: 0, time: "1100" }, close: { day: 0, time: "2100" } }, // Sun
            { open: { day: 1, time: "1100" }, close: { day: 1, time: "2200" } }, // Mon
            { open: { day: 2, time: "1100" }, close: { day: 2, time: "2200" } }, // Tue
            { open: { day: 3, time: "1100" }, close: { day: 3, time: "2200" } }, // Wed
            { open: { day: 4, time: "1100" }, close: { day: 4, time: "2200" } }, // Thu
            { open: { day: 5, time: "1100" }, close: { day: 5, time: "2300" } }, // Fri
            { open: { day: 6, time: "1100" }, close: { day: 6, time: "2300" } }, // Sat
        ];
         return {
            isOperational: true,
            openingHours: restaurantHours,
            statusText: "Open", 
        };
    }
     // Simulate some museums
    if (input.placeName?.toLowerCase().includes('museum') || input.placeName?.toLowerCase().includes('gallery')) {
        const museumHours : OpeningHoursPeriod[] = [
            // Closed Mon
            { open: { day: 2, time: "1000" }, close: { day: 2, time: "1800" } }, // Tue
            { open: { day: 3, time: "1000" }, close: { day: 3, time: "1800" } }, // Wed
            { open: { day: 4, time: "1000" }, close: { day: 4, time: "1800" } }, // Thu
            { open: { day: 5, time: "1000" }, close: { day: 5, time: "2000" } }, // Fri (late night)
            { open: { day: 6, time: "1000" }, close: { day: 6, time: "1800" } }, // Sat
            { open: { day: 0, time: "1200" }, close: { day: 0, time: "1700" } }, // Sun
        ];
         return {
            isOperational: true,
            openingHours: museumHours,
            statusText: "Open", 
        };
    }


    return {
      isOperational: true,
      openingHours: mockOpeningHours,
      statusText: "Open", 
    };
  }
);

// The isPlaceOpenAt function has been moved to src/lib/datetime-utils.ts
// to resolve the "use server" export error.
    
