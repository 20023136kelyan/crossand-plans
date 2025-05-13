/**
 * @fileOverview Defines the flow for generating a full plan draft based on a user's text prompt and participant information.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {
  GenerateFullPlanDetailsInputSchema,
  GenerateFullPlanDetailsInput,
  GenerateFullPlanDetailsOutputSchema,
  GenerateFullPlanDetailsOutput,
  ItineraryItem
} from './plan-types';

// Types for Google Maps API responses
interface GooglePlaceDetails {
  placeId: string;
  formattedAddress: string;
  location: {
    lat: number;
    lng: number;
  };
  formattedPhoneNumber?: string;
  website?: string;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  types?: string[];
  openingHours?: {
    open_now?: boolean;
    periods?: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
    weekday_text?: string[];
  };
  businessStatus?: string;
  url?: string;
}

// Update the AI prompt return type to match our schema
interface GenerateFullPlanDetailsPromptResponse {
  output: GenerateFullPlanDetailsOutput;
}

// Update the AI prompt to match our new schema
const fullPlanDetailsPrompt = ai.definePrompt({
  name: 'fullPlanDetailsPrompt',
  input: {schema: GenerateFullPlanDetailsInputSchema},
  output: {schema: GenerateFullPlanDetailsOutputSchema},
  prompt: "Create a plan based on: \"" + "{{{userPrompt}}}" + "\" in " + "{{{userEnteredCity}}}" + ".\n\n" +
"IMPORTANT: You MUST return a complete JSON object with ALL of the following fields. Missing fields will cause an error.\n\n" +
"PLAN TYPE REQUIREMENTS:\n" +
"- Current plan type is: {{{planType}}}\n" +
"- For single-stop plans: EXACTLY ONE itinerary item is required\n" +
"- For multi-stop plans: TWO OR MORE itinerary items are required\n" +
"- The output planType MUST match the input planType ({{{planType}}})\n\n" +
"REQUIRED FIELDS:\n" +
"1. name (string)\n" +
"2. description (string)\n" +
"3. eventType (string)\n" +
"4. planType (string, must be '{{{planType}}}')\n" +
"5. itinerary (array with items based on plan type)\n\n" +
"Each itinerary item MUST have:\n" +
"- placeName (string)\n" +
"- description (string)\n" +
"- activitySuggestions (array of 3 strings)\n" +
"- suggestedOrder (number)\n" +
"- suggestedDuration (number, always 60)\n\n" +
"CRITICAL REQUIREMENTS:\n" +
"1. Return ONLY a JSON object with ALL fields shown above\n" +
"2. For single-stop plans (current plan type: {{{planType}}}), return EXACTLY ONE itinerary item\n" +
"3. For multi-stop plans (current plan type: {{{planType}}}), return TWO OR MORE itinerary items\n" +
"4. DO NOT add any explanations before or after the JSON\n" +
"5. Use REAL venue names that exist in " + "{{{userEnteredCity}}}" + "\n" +
"6. Each venue MUST have exactly 3 activity suggestions\n" +
"7. All durations MUST be exactly 60 minutes\n" +
"8. Make sure descriptions are detailed but concise\n" +
"9. Ensure the JSON is properly formatted and can be parsed\n\n" +
"VALIDATION EXAMPLES:\n" +
"❌ INVALID (Missing fields):\n" +
"{\n" +
"  \"name\": \"Fun Night Out\",\n" +
"  \"priceRange\": \"$$\"\n" +
"}\n\n" +
"✓ VALID (Complete response for single-stop):\n" +
"{\n" +
"  \"name\": \"Elegant Dining at Mourad\",\n" +
"  \"description\": \"Experience upscale Moroccan cuisine in an elegant setting with modern takes on traditional dishes.\",\n" +
"  \"eventType\": \"Fine Dining\",\n" +
"  \"planType\": \"single-stop\",\n" +
"  \"itinerary\": [\n" +
"    {\n" +
"      \"placeName\": \"Mourad Restaurant\",\n" +
"      \"description\": \"Enjoy upscale Moroccan cuisine in an elegant setting with modern takes on traditional dishes.\",\n" +
"      \"activitySuggestions\": [\"Try the lamb shoulder\", \"Order craft cocktails\", \"Share mezze appetizers\"],\n" +
"      \"suggestedOrder\": 0,\n" +
"      \"suggestedDuration\": 60\n" +
"    }\n" +
"  ]\n" +
"}\n\n" +
"✓ VALID (Complete response for multi-stop):\n" +
"{\n" +
"  \"name\": \"San Francisco Art & Dining Tour\",\n" +
"  \"description\": \"Explore contemporary art at SFMOMA followed by upscale dining at Mourad, combining cultural enrichment with culinary excellence.\",\n" +
"  \"eventType\": \"Museum Visit & Fine Dining\",\n" +
"  \"planType\": \"multi-stop\",\n" +
"  \"itinerary\": [\n" +
"    {\n" +
"      \"placeName\": \"San Francisco Museum of Modern Art\",\n" +
"      \"description\": \"Explore contemporary and modern art exhibits featuring renowned artists from around the world.\",\n" +
"      \"activitySuggestions\": [\"Visit the photography exhibition\", \"Check out the rooftop sculpture garden\", \"Browse the museum store\"],\n" +
"      \"suggestedOrder\": 0,\n" +
"      \"suggestedDuration\": 60\n" +
"    },\n" +
"    {\n" +
"      \"placeName\": \"Mourad Restaurant\",\n" +
"      \"description\": \"Enjoy upscale Moroccan cuisine in an elegant setting with modern takes on traditional dishes.\",\n" +
"      \"activitySuggestions\": [\"Try the lamb shoulder\", \"Order craft cocktails\", \"Share mezze appetizers\"],\n" +
"      \"suggestedOrder\": 1,\n" +
"      \"suggestedDuration\": 60\n" +
"    }\n" +
"  ]\n" +
"}\n"
});

async function generateFullPlanDetailsPrompt(input: GenerateFullPlanDetailsInput): Promise<GenerateFullPlanDetailsPromptResponse> {
  try {
    console.log('Calling AI service with input:', JSON.stringify(input, null, 2));
    const { output } = await fullPlanDetailsPrompt(input);
    console.log('AI service response:', JSON.stringify(output, null, 2));
    
    if (!output) {
      const errorMsg = 'AI failed to generate full plan details output.';
      console.error('AI prompt for full plan details returned no output for input:', input);
      throw new Error(errorMsg);
    }

    // Ensure all required fields are present and have valid values
    const requiredFields = ['name', 'description', 'eventType', 'itinerary'];
    const missingFields = requiredFields.filter(field => {
      const value = output[field as keyof typeof output];
      return value === undefined || value === null || value === '';
    });

    if (missingFields.length > 0) {
      const errorMsg = 'AI response missing required fields: ' + missingFields.join(', ');
      console.error('AI response missing required fields:', missingFields);
      console.error('Current output:', JSON.stringify(output, null, 2));
      throw new Error(errorMsg);
    }

    // Validate itinerary items based on plan type
    if (!Array.isArray(output.itinerary)) {
      throw new Error('AI response must include an itinerary array');
    }

    // Validate plan type matches input
    if (output.planType !== input.planType) {
      throw new Error(`Plan type mismatch: expected ${input.planType}, got ${output.planType}`);
    }

    // Validate itinerary length based on plan type
    if (input.planType === 'single-stop' && output.itinerary.length !== 1) {
      throw new Error('Single-stop plans must have exactly one itinerary item');
    } else if (input.planType === 'multi-stop' && output.itinerary.length < 2) {
      throw new Error('Multi-stop plans must have at least two itinerary items');
    }

    // Validate each itinerary item
    const requiredItineraryFields = ['placeName', 'description', 'activitySuggestions', 'suggestedOrder', 'suggestedDuration'];
    for (const [index, item] of output.itinerary.entries()) {
      const missingItemFields = requiredItineraryFields.filter(field => {
        const value = item[field as keyof typeof item];
        return value === undefined || value === null || value === '';
      });
      if (missingItemFields.length > 0) {
        const errorMsg = 'Itinerary item ' + index + ' missing required fields: ' + missingItemFields.join(', ');
        throw new Error(errorMsg);
      }
    }

    // Enrich the output with derived fields
    const enrichedOutput = {
      ...output,
      city: input.userEnteredCity,
      eventTime: input.userSuggestedEventTime,
      priceRange: input.priceRange,
      location: output.itinerary[0]?.placeName || '',
      planType: input.planType
    } as GenerateFullPlanDetailsOutput;

    return { output: enrichedOutput };
  } catch (e) {
    const errorMsg = 'generateFullPlanDetailsPrompt failed: ' + (e instanceof Error ? e.message : String(e));
    console.error('Error in generateFullPlanDetailsPrompt for input:', JSON.stringify(input), e);
    throw new Error(errorMsg);
  }
}

// Helper function to calculate start times based on fixed durations
function calculateStartTime(baseTime: string | undefined, order: number): string {
  if (!baseTime) {
    // If no base time provided, use current time + 1 day
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0); // Default to noon
    baseTime = tomorrow.toISOString();
  }

  const startTime = new Date(baseTime);
  startTime.setMinutes(startTime.getMinutes() + (order * 60)); // Add 60 minutes for each item
  return startTime.toISOString();
}

// Helper function to search place details using Google Maps Places API
async function searchPlaceDetails(placeName: string, city?: string): Promise<GooglePlaceDetails | null> {
  try {
    const searchQuery = city ? placeName + " " + city : placeName;
    const response = await fetch(
      `/api/places/search?query=${encodeURIComponent(searchQuery)}`
    );
    
    if (!response.ok) {
      console.error('Error from places API:', await response.json());
      return null;
    }

    const placeDetails = await response.json();
    return {
      placeId: placeDetails.placeId,
      formattedAddress: placeDetails.formattedAddress,
      location: placeDetails.location,
      formattedPhoneNumber: placeDetails.formattedPhoneNumber,
      website: placeDetails.website,
      rating: placeDetails.rating,
      userRatingsTotal: placeDetails.userRatingsTotal,
      priceLevel: placeDetails.priceLevel,
      types: placeDetails.types,
      openingHours: placeDetails.openingHours,
      businessStatus: placeDetails.businessStatus || 'UNKNOWN',
      url: placeDetails.url
    };
  } catch (error) {
    console.error('Error fetching place details:', error);
    return null;
  }
}

// Helper function to extract city from formatted address
function extractCityFromAddress(formattedAddress: string): string | null {
  if (!formattedAddress) return null;
  
  // Split address into components
  const components = formattedAddress.split(',').map(c => c.trim());
  
  // For US addresses, city is typically the second-to-last component before state+zip
  // For international addresses, it's often the last or second-to-last component
  if (components.length >= 2) {
    // Check if last component is a country
    const lastComponent = components[components.length - 1];
    if (lastComponent === 'USA' || lastComponent === 'United States') {
      // US address: city should be before state+zip
      const stateZipComponent = components[components.length - 2];
      if (stateZipComponent && stateZipComponent.includes(' ')) {
        return components[components.length - 3] || null;
      }
    }
    // For other formats, return second to last component
    return components[components.length - 2] || null;
  }
  return null;
}

// Make the function internal by removing the export
async function generateFullPlanDetails(input: GenerateFullPlanDetailsInput): Promise<GenerateFullPlanDetailsOutput> {
  // Validate input
  const validatedInput = GenerateFullPlanDetailsInputSchema.parse(input);

  // 1. Generate initial plan structure using AI
  const { output: aiPlan } = await generateFullPlanDetailsPrompt(validatedInput);

  // 2. For each itinerary item, fetch place details from Google Maps
  const enrichedItinerary = await Promise.all(
    (aiPlan.itinerary || []).map(async (item) => {
      // Search for the place using Google Maps Places API
      const placeDetails = await searchPlaceDetails(item.placeName, validatedInput.userEnteredCity);
      
      if (!placeDetails) {
        return {
          ...item,
          startTime: calculateStartTime(validatedInput.userSuggestedEventTime, item.suggestedOrder ?? 0),
          duration: 60, // Fixed 1-hour duration
          status: 'UNKNOWN',
          city: validatedInput.userEnteredCity || '', // Set city from user input when place details not found
          address: `${item.placeName}, ${validatedInput.userEnteredCity || ''}`, // Create a basic address
          isOperational: false,
          statusText: 'Status unknown - Place details not found',
          businessStatus: 'UNKNOWN',
          lat: 0,
          lng: 0,
          placeId: `unknown_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          googlePlaceId: `unknown_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          googleMapsUrl: '',
          phoneNumber: '',
          website: '',
          rating: undefined,
          userRatingsTotal: undefined,
          priceLevel: undefined,
          types: [],
          openingHours: undefined,
          activitySuggestions: item.activitySuggestions || []
        } as ItineraryItem;
      }

      // Map Google Places data to our schema
      const enrichedItem: ItineraryItem = {
        placeName: item.placeName,
        description: item.description ?? '',
        suggestedDuration: item.suggestedDuration ?? 60,
        suggestedOrder: item.suggestedOrder ?? 0,
        duration: 60, // Fixed 1-hour duration
        status: placeDetails.businessStatus || 'UNKNOWN',
        startTime: calculateStartTime(validatedInput.userSuggestedEventTime, item.suggestedOrder ?? 0),
        placeId: placeDetails.placeId,
        address: placeDetails.formattedAddress,
        city: extractCityFromAddress(placeDetails.formattedAddress) || validatedInput.userEnteredCity || '',
        lat: placeDetails.location.lat,
        lng: placeDetails.location.lng,
        googlePlaceId: placeDetails.placeId,
        googleMapsUrl: placeDetails.url,
        phoneNumber: placeDetails.formattedPhoneNumber,
        website: placeDetails.website,
        rating: placeDetails.rating,
        userRatingsTotal: placeDetails.userRatingsTotal,
        priceLevel: placeDetails.priceLevel,
        types: placeDetails.types,
        openingHours: placeDetails.openingHours,
        activitySuggestions: item.activitySuggestions,
        isOperational: placeDetails.businessStatus === 'OPERATIONAL',
        statusText: placeDetails.businessStatus === 'OPERATIONAL' ? 'Open for business' : 
                   placeDetails.businessStatus === 'CLOSED_TEMPORARILY' ? 'Temporarily closed' :
                   placeDetails.businessStatus === 'CLOSED_PERMANENTLY' ? 'Permanently closed' :
                   'Status unknown',
        businessStatus: placeDetails.businessStatus || 'UNKNOWN'
      };

      return enrichedItem;
    })
  );

  // 3. Return the enriched plan
  return {
    ...aiPlan,
    itinerary: enrichedItinerary
  };
}

// Define the flow
const generateFullPlanDetailsFlow = ai.defineFlow(
  {
    name: 'generateFullPlanDetailsFlow',
    inputSchema: GenerateFullPlanDetailsInputSchema,
    outputSchema: GenerateFullPlanDetailsOutputSchema,
  },
  async (input: GenerateFullPlanDetailsInput): Promise<GenerateFullPlanDetailsOutput> => {
    // Generate the plan using our internal function
    const plan = await generateFullPlanDetails(input);

    // Log the generated plan
    console.log("Generated plan:", JSON.stringify(plan, null, 2));

    return plan;
  }
);

// Export only the flow
export { generateFullPlanDetailsFlow };
