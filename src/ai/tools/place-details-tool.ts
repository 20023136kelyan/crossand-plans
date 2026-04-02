
/**
 * @fileOverview A tool to fetch (mocked) details for a place, including operational status and opening hours.
 * - getPlaceDetails: The Genkit tool definition.
 * - GetPlaceDetailsInputSchema: Input schema for the tool.
 * - GetPlaceDetailsOutputSchema: Output schema for the tool.
 */
import {z} from 'zod';

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

export async function getPlaceDetails(input: GetPlaceDetailsInput): Promise<GetPlaceDetailsOutput> {
  const name = input.placeName.toLowerCase();
  if (name.includes('closed') || name.includes('permanently closed')) {
    return {
      isOperational: false,
      statusText: 'Permanently Closed',
    };
  }

  if (name.includes('temporarily closed')) {
    return {
      isOperational: false,
      statusText: 'Temporarily Closed',
    };
  }

  const restaurantHours: OpeningHoursPeriod[] = [
    { open: { day: 0, time: '1100' }, close: { day: 0, time: '2100' } },
    { open: { day: 1, time: '1100' }, close: { day: 1, time: '2200' } },
    { open: { day: 2, time: '1100' }, close: { day: 2, time: '2200' } },
    { open: { day: 3, time: '1100' }, close: { day: 3, time: '2200' } },
    { open: { day: 4, time: '1100' }, close: { day: 4, time: '2200' } },
    { open: { day: 5, time: '1100' }, close: { day: 5, time: '2300' } },
    { open: { day: 6, time: '1100' }, close: { day: 6, time: '2300' } },
  ];

  const museumHours: OpeningHoursPeriod[] = [
    { open: { day: 1, time: '1000' }, close: { day: 1, time: '1800' } },
    { open: { day: 2, time: '1000' }, close: { day: 2, time: '1800' } },
    { open: { day: 3, time: '1000' }, close: { day: 3, time: '1800' } },
    { open: { day: 4, time: '1000' }, close: { day: 4, time: '1800' } },
    { open: { day: 5, time: '1000' }, close: { day: 5, time: '2000' } },
    { open: { day: 6, time: '1000' }, close: { day: 6, time: '1800' } },
    { open: { day: 0, time: '1200' }, close: { day: 0, time: '1700' } },
  ];

  const defaultHours: OpeningHoursPeriod[] = [
    { open: { day: 1, time: '0900' }, close: { day: 1, time: '1700' } },
    { open: { day: 2, time: '0900' }, close: { day: 2, time: '1700' } },
    { open: { day: 3, time: '0900' }, close: { day: 3, time: '1700' } },
    { open: { day: 4, time: '0900' }, close: { day: 4, time: '1700' } },
    { open: { day: 5, time: '0900' }, close: { day: 5, time: '1700' } },
    { open: { day: 6, time: '1000' }, close: { day: 6, time: '1600' } },
  ];

  if (name.includes('restaurant') || name.includes('diner') || name.includes('cafe')) {
    return {
      isOperational: true,
      openingHours: restaurantHours,
      statusText: 'Open',
    };
  }

  if (name.includes('museum') || name.includes('gallery')) {
    return {
      isOperational: true,
      openingHours: museumHours,
      statusText: 'Open',
    };
  }

  return {
    isOperational: true,
    openingHours: defaultHours,
    statusText: 'Open',
  };
}

// The isPlaceOpenAt function has been moved to src/lib/datetime-utils.ts
// to resolve the "use server" export error.
    
