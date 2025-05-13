
'use server';
/**
 * @fileOverview Generates detailed information for a specific itinerary item.
 *
 * - generateItineraryItemDetails - A function that generates itinerary item details.
 * - GenerateItineraryItemDetailsInput - The input type for the function.
 * - GenerateItineraryItemDetailsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { formatISO, addHours, parseISO, isValid, addSeconds, getDay, getHours, getMinutes } from 'date-fns';
import { GenerateItineraryItemDetailsInputSchema } from '@/lib/schemas'; 
import { getTravelTime } from '@/ai/tools/travel-time-tool';
import { getPlaceDetails, type GetPlaceDetailsOutput } from '@/ai/tools/place-details-tool'; 

export type GenerateItineraryItemDetailsInput = z.infer<typeof GenerateItineraryItemDetailsInputSchema>;

const GenerateItineraryItemDetailsOutputSchema = z.object({
  suggestedDescription: z.string().describe('A detailed and engaging description for this specific itinerary stop, highlighting what to do or see. If the place is not operational or times conflict with opening hours, this description MUST clearly state the issue and suggest the user find an alternative or adjust the schedule.'),
  suggestedISOStartTime: z.string().datetime().nullable().describe('The suggested start date and time for this itinerary stop in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ, 24-hour cycle). This time MUST be within the place\'s operational hours if known. Should be null if place is not operational.'),
  suggestedISOEndTime: z.string().datetime().optional().nullable().describe('The suggested end date and time for this itinerary stop in ISO 8601 format (24-hour cycle). Can be omitted if duration is variable or hard to determine. This time MUST be within the place\'s operational hours if known. Should be null if place is not operational.'),
  suggestedActivitySuggestions: z.array(z.string()).describe('An array of 2-3 brief, specific suggestions for what participants might enjoy doing or trying at this stop, tailored to their preferences and the nature of the stop. Provide only if the place is operational and open at the suggested times. Should be an empty array if not operational.'),
  isOperational: z.boolean().optional().describe("Whether the place is confirmed to be operational by the getPlaceDetails tool. If the tool wasn't used or failed, this might be absent. This field MUST be populated from the getPlaceDetails tool output."),
  statusText: z.string().optional().describe("Human-readable operational status of the place, (e.g., 'Open', 'Closed temporarily', 'Opening hours: 9 AM - 5 PM') as provided by the place details tool. This field MUST be populated from the getPlaceDetails tool output.")
});

export type GenerateItineraryItemDetailsOutput = z.infer<typeof GenerateItineraryItemDetailsOutputSchema>;

export async function generateItineraryItemDetails(
  input: GenerateItineraryItemDetailsInput
): Promise<GenerateItineraryItemDetailsOutput> {
  const validatedInput = GenerateItineraryItemDetailsInputSchema.safeParse(input);
  if (!validatedInput.success) {
    console.error("[generateItineraryItemDetails FLOW] Invalid input for generateItineraryItemDetails flow:", validatedInput.error.flatten().fieldErrors);
    const errorMessages = Object.entries(validatedInput.error.flatten().fieldErrors)
      .map(([field, errors]) => `${field}: ${errors?.join(', ')}`)
      .join('; ');
    throw new Error(`Invalid input data for AI flow: ${errorMessages}`);
  }
  return generateItineraryItemDetailsFlow(validatedInput.data);
}

const generateItineraryItemDetailsPrompt = ai.definePrompt({
  name: 'generateItineraryItemDetailsPrompt',
  input: {schema: GenerateItineraryItemDetailsInputSchema},
  output: {schema: GenerateItineraryItemDetailsOutputSchema},
  tools: [getTravelTime, getPlaceDetails], 
  prompt: `You are an expert event planner assistant. Your task is to generate specific details for an itinerary stop.

Itinerary Stop Details:
Place Name: {{{placeName}}}
Address: {{{address}}}
City: {{{city}}}

Overall Plan Context:
Main Event Start Time: {{{mainEventISOStartTime}}} (This is in ISO 8601, 24-hour format)
Plan Description: {{{planOverallDescription}}}
{{#if participantPreferences.length}}
Participant Preferences:
{{#each participantPreferences}}
- {{{this}}}
{{/each}}
{{else}}
- No specific participant preferences provided.
{{/if}}

Sequencing Information:
Is this the first item in the itinerary? {{{isFirstItem}}}
{{#if previousItemISOEndTime}}
Previous Item End Time: {{{previousItemISOEndTime}}} (This is in ISO 8601, 24-hour format)
  {{#if previousItemAddress}}
  Previous Item Address: {{{previousItemAddress}}}{{#if previousItemCity}}, {{{previousItemCity}}}{{/if}}
  {{/if}}
{{else}}
{{#unless isFirstItem}}
No specific end time for the previous item was given.
{{/unless}}
{{/if}}

If the Plan Description is very generic (e.g., "A fun event"), focus on the Place Name, Address, City, and any Participant Preferences to make relevant suggestions.

VERY IMPORTANT - Follow these steps strictly:
1.  **Check Operational Status (CRITICAL):**
    *   First, use the 'getPlaceDetails' tool with the placeName, address, and city to check if the place is operational and to get its opening hours.
    *   Populate 'isOperational' and 'statusText' in your output JSON *directly* from the tool's response.
    *   If 'isOperational' is false (e.g., 'Permanently Closed', 'Temporarily Closed'):
        *   The 'suggestedDescription' MUST state this reason clearly (e.g., "This place is reported as permanently closed. Please find an alternative.") and suggest the user find an alternative.
        *   'suggestedISOStartTime' MUST be null.
        *   'suggestedISOEndTime' MUST be null.
        *   'suggestedActivitySuggestions' MUST be an empty array.
        *   Proceed no further with time/activity generation for this item. Return the JSON with these values.

2.  **Determine Start Time ('suggestedISOStartTime' - ISO 8601, 24-hour cycle, MANDATORY if operational):**
    *   If NOT operational (from step 1), this field MUST be null.
    *   If operational:
        *   **First Item ({{{isFirstItem}}} is true):**
            Its start time should be at or reasonably after the 'Main Event Start Time' ({{{mainEventISOStartTime}}}). If 'mainEventISOStartTime' is only a date, pick a sensible time of day (e.g., 12:00 for lunch, 19:00 for dinner) based on '{{{placeName}}}'.
        *   **Subsequent Item ({{{isFirstItem}}} is false):**
            *   **If 'previousItemISOEndTime' AND 'previousItemAddress' are provided:**
                1.  Use 'getTravelTime' tool: Origin Address = "{{{previousItemAddress}}}", Origin City = "{{{previousItemCity}}}", Destination Address = "{{{address}}}", Destination City = "{{{city}}}".
                2.  Calculate: '{{{previousItemISOEndTime}}}' + travel duration (from tool) + buffer (e.g., 15-30 minutes / 900-1800 seconds).
            *   **Else (no previous address or no previous end time):** Assume a default travel/transition time (e.g., 30-60 minutes) from 'mainEventISOStartTime' or implied end of a generic previous activity.
        *   **CRITICAL CHECK AGAINST OPENING HOURS:**
            *   Retrieve the opening hours for the day of the calculated/selected \`suggestedISOStartTime\` from the 'getPlaceDetails' tool output (obtained in step 1).
            *   If the calculated \`suggestedISOStartTime\` is *before* the place opens on that day, adjust \`suggestedISOStartTime\` to be the opening time.
            *   If the calculated \`suggestedISOStartTime\` is *after* the place closes on that day (or if the place is closed the entire day):
                *   The 'suggestedDescription' MUST clearly state this timing conflict (e.g., "This place will be closed at the suggested start time. It opens at X or closes at Y.").
                *   Suggest the user adjust the schedule or find an alternative.
                *   'suggestedISOStartTime' MUST be set to null.
                *   'suggestedISOEndTime' MUST be set to null.
                *   'suggestedActivitySuggestions' MUST be an empty array.
                *   Proceed no further with activity generation for this item. Return the JSON with these values.

3.  **Determine End Time ('suggestedISOEndTime' - ISO 8601, 24-hour cycle, Optional, only if operational and open):**
    *   If operational and open at \`suggestedISOStartTime\` (and not set to null in step 2), estimate an end time appropriate for the activity (e.g., meal 1.5-2 hrs, museum 2-3 hrs). Ensure this \`suggestedISOEndTime\` is also within the place's closing time for that day.
    *   Omit (set to null) if open-ended, or if the place is not operational/closed at the start time, or if \`suggestedISOStartTime\` was set to null.

4.  **Generate Content (only if operational and open at suggested times, and \`suggestedISOStartTime\` is not null):**
    *   **Suggested Description ('suggestedDescription'):** Detailed and engaging (2-3 sentences). What to expect/do? If not operational or times conflict, this was handled in step 1 or 2.
    *   **Activity Suggestions ('suggestedActivitySuggestions'):** If operational and open, 2-3 brief, specific activity ideas tailored to place/preferences. If not, provide an empty array.

Return ONLY the JSON object. Ensure date-time strings are strictly ISO 8601. Prioritize logical and feasible suggestions based on operational status and opening hours.
`,
});

const generateItineraryItemDetailsFlow = ai.defineFlow(
  {
    name: 'generateItineraryItemDetailsFlow',
    inputSchema: GenerateItineraryItemDetailsInputSchema,
    outputSchema: GenerateItineraryItemDetailsOutputSchema,
  },
  async (input: GenerateItineraryItemDetailsInput): Promise<GenerateItineraryItemDetailsOutput> => {
    console.log("[generateItineraryItemDetailsFlow] Itinerary item details input (raw):", input);
    const sanitizedInput = {
      ...input,
      placeName: input.placeName.replace(/[^\p{L}\p{N}\p{P}\p{S}\s'-]/gu, ''),
      address: input.address.replace(/[^\p{L}\p{N}\p{P}\p{S}\s'#&-]/gu, ''),
      city: input.city.replace(/[^\p{L}\p{N}\p{S}\s-]/gu, ''),
      planOverallDescription: input.planOverallDescription.replace(/[^\p{L}\p{N}\p{P}\p{S}\s\-()!?.,;:'"]/gu, ''),
      participantPreferences: input.participantPreferences?.map(p => p.replace(/[^\p{L}\p{N}\p{P}\p{S}\s\-()!?.,;:'"]/gu, '')),
    };
    console.log("[generateItineraryItemDetailsFlow] Itinerary item details input (sanitized for AI):", JSON.stringify(sanitizedInput, null, 2));

    let aiOutput: GenerateItineraryItemDetailsOutput | undefined;
    let history: any[] = [];

    try {
      const result = await generateItineraryItemDetailsPrompt(sanitizedInput);
      aiOutput = result.output;
      history = result.history || [];
      console.log("[generateItineraryItemDetailsFlow] Itinerary item details output from AI:", JSON.stringify(aiOutput, null, 2));
      history.filter(entry => entry.type === 'toolCall' || entry.type === 'toolResponse').forEach(entry => {
        console.log("[generateItineraryItemDetailsFlow] Tool history entry for Itinerary Item Details:", JSON.stringify(entry, null, 2));
      });

      if (!aiOutput) {
          console.error(`[generateItineraryItemDetailsFlow] AI prompt for itinerary item details returned no output for input:`, sanitizedInput);
          throw new Error('AI failed to generate itinerary item details output.');
      }
    } catch (error) {
      console.error("[generateItineraryItemDetailsFlow] Error during prompt call:", error);
      throw new Error(`AI itinerary item generation failed within flow: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    let parsedStartTime = aiOutput.suggestedISOStartTime ? parseISO(aiOutput.suggestedISOStartTime) : null;
    if (!parsedStartTime || !isValid(parsedStartTime)) {
        console.warn(`[generateItineraryItemDetailsFlow] AI returned invalid suggestedISOStartTime ('${aiOutput.suggestedISOStartTime}') for ${input.placeName}. Defaulting based on input sequencing.`);
        let baseDateForDefaultStart: Date;
        const mainEventParsed = parseISO(input.mainEventISOStartTime);
        if (input.isFirstItem) {
            baseDateForDefaultStart = isValid(mainEventParsed) ? mainEventParsed : addHours(new Date(), 1);
        } else {
            const prevEndParsed = input.previousItemISOEndTime ? parseISO(input.previousItemISOEndTime) : null;
            if (prevEndParsed && isValid(prevEndParsed)) {
                baseDateForDefaultStart = addSeconds(prevEndParsed, 1800);
            } else if (isValid(mainEventParsed)) {
                baseDateForDefaultStart = addHours(mainEventParsed, 2); 
            } else {
                baseDateForDefaultStart = addHours(new Date(), 1); 
            }
        }
        parsedStartTime = baseDateForDefaultStart;
    }
    
    let parsedEndTime = aiOutput.suggestedISOEndTime ? parseISO(aiOutput.suggestedISOEndTime) : null;
    if (parsedEndTime && isValid(parsedEndTime)) {
        if (parsedStartTime && parsedEndTime < parsedStartTime) { 
            console.warn(`[generateItineraryItemDetailsFlow] AI returned suggestedISOEndTime ('${aiOutput.suggestedISOEndTime}') before suggestedISOStartTime ('${formatISO(parsedStartTime)}') for ${input.placeName}. Adjusting.`);
            parsedEndTime = addHours(parsedStartTime, 2);
        }
    } else if (parsedStartTime) { 
        parsedEndTime = addHours(parsedStartTime, 2); 
    }
    
    const placeDetailsToolOutput = history.find(
        (event) => event.type === 'toolResponse' && event.toolRequest.name === 'getPlaceDetails'
    )?.toolResponse?.output as GetPlaceDetailsOutput | undefined;

    let finalIsOperational = aiOutput.isOperational;
    let finalStatusText = aiOutput.statusText;

    if (placeDetailsToolOutput) {
        finalIsOperational = placeDetailsToolOutput.isOperational;
        finalStatusText = placeDetailsToolOutput.statusText || (placeDetailsToolOutput.isOperational ? "Open" : "Status unavailable");
        if(!placeDetailsToolOutput.isOperational && (aiOutput.suggestedActivitySuggestions?.length ?? 0) > 0 && aiOutput.suggestedActivitySuggestions?.[0] !== "Place not operational at suggested time.") {
            aiOutput.suggestedActivitySuggestions = [`Place reported as: ${finalStatusText}. No activities suggested.`];
        }
    } else if (finalIsOperational === undefined) { 
        finalStatusText = "Operational status not verified by AI.";
    }
    
    let finalDescription = aiOutput.suggestedDescription || `Details for ${input.placeName}.`;
    if (finalIsOperational === false && !finalDescription.toLowerCase().includes("not operational") && !finalDescription.toLowerCase().includes("closed")) {
        finalDescription = `${input.placeName} is reported as ${finalStatusText?.toLowerCase() || 'not operational'}. Please consider an alternative for this stop. Original AI suggestion: ${aiOutput.suggestedDescription || "N/A"}`;
    }
    
    const finalOutput = {
      suggestedDescription: finalDescription,
      suggestedISOStartTime: parsedStartTime ? formatISO(parsedStartTime) : input.mainEventISOStartTime, 
      suggestedISOEndTime: parsedEndTime ? formatISO(parsedEndTime) : (parsedStartTime ? formatISO(addHours(parsedStartTime, 2)) : null),
      suggestedActivitySuggestions: (finalIsOperational !== false && aiOutput.suggestedActivitySuggestions && aiOutput.suggestedActivitySuggestions.length > 0)
                                    ? aiOutput.suggestedActivitySuggestions
                                    : finalIsOperational === false ? [`Place reported as: ${finalStatusText}. Consider alternatives.`] : [`Explore ${input.placeName}.`, "Take photos."],
      isOperational: finalIsOperational,
      statusText: finalStatusText,
    };
    console.log("[generateItineraryItemDetailsFlow] Processed output after validation:", JSON.stringify(finalOutput, null, 2));
    return finalOutput;
  }
);
