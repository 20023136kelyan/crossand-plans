import { z } from 'zod';

// Define the input schema for the trip planning agent
const TripPlanningInputSchema = z.object({
  userPrompt: z.string(),
  city: z.string(),
  priceRange: z.string(),
  eventTime: z.string().optional(),
  preferences: z.array(z.string()).optional(),
});

// Define the output schema for a venue
const VenueSchema = z.object({
  name: z.string(),
  description: z.string(),
  activities: z.array(z.string()),
  duration: z.number(),
  order: z.number(),
});

// Define the output schema for the trip plan
const TripPlanSchema = z.object({
  name: z.string(),
  description: z.string(),
  type: z.string(),
  venues: z.array(VenueSchema),
});

type TripPlanningInput = z.infer<typeof TripPlanningInputSchema>;
type TripPlan = z.infer<typeof TripPlanSchema>;

const GEMINI_SYSTEM_PROMPT = `You are a trip planning assistant. Your task is to create detailed plans for activities and venues based on user preferences.

IMPORTANT RULES:
1. Only suggest real, existing venues in the specified city
2. Each venue should have exactly 1 hour duration
3. Include 2-3 venues per plan
4. Provide specific activity suggestions for each venue
5. Focus on practical, actionable plans
6. Consider the price range in venue selection
7. Return only JSON, no other text

EXAMPLE OUTPUT:
{
  "name": "San Francisco Art & Dining Tour",
  "description": "Experience contemporary art at SFMOMA followed by upscale dining at Mourad",
  "type": "Cultural & Dining",
  "venues": [
    {
      "name": "San Francisco Museum of Modern Art",
      "description": "Explore contemporary and modern art exhibits featuring renowned artists",
      "activities": [
        "Visit the photography exhibition",
        "Check out the rooftop sculpture garden",
        "Browse the museum store"
      ],
      "duration": 60,
      "order": 0
    },
    {
      "name": "Mourad",
      "description": "Upscale Moroccan cuisine in an elegant setting",
      "activities": [
        "Try the lamb shoulder",
        "Order craft cocktails",
        "Share mezze appetizers"
      ],
      "duration": 60,
      "order": 1
    }
  ]
}`;

export class TripPlanningAgent {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async callGemini(prompt: string): Promise<any> {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw error;
    }
  }

  async generatePlan(input: TripPlanningInput): Promise<TripPlan> {
    try {
      // Validate input
      const validatedInput = TripPlanningInputSchema.parse(input);

      // Construct the prompt
      const prompt = `${GEMINI_SYSTEM_PROMPT}

USER REQUEST:
City: ${validatedInput.city}
Price Range: ${validatedInput.priceRange}
${validatedInput.preferences ? 'Preferences: ' + validatedInput.preferences.join(', ') : ''}
Request: ${validatedInput.userPrompt}`;

      // Call Gemini API
      const response = await this.callGemini(prompt);

      // Parse and validate the response
      const parsedResponse = JSON.parse(response);
      const validatedResponse = TripPlanSchema.parse(parsedResponse);

      return validatedResponse;
    } catch (error) {
      console.error('Error generating trip plan:', error);
      throw error;
    }
  }

  // Helper method to validate venue existence using Google Places API
  async validateVenues(plan: TripPlan, city: string): Promise<boolean> {
    try {
      for (const venue of plan.venues) {
        const searchQuery = encodeURIComponent(venue.name + " " + city);
        const response = await fetch(
          "https://maps.googleapis.com/maps/api/place/textsearch/json?query=" + searchQuery + "&key=" + process.env.GOOGLE_MAPS_API_KEY
        );
        
        const data = await response.json();
        if (!data.results?.[0]) {
          console.error(`Venue not found: ${venue.name}`);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Error validating venues:', error);
      return false;
    }
  }
}

// Example usage:
/*
const agent = new TripPlanningAgent(process.env.GEMINI_API_KEY!);
const plan = await agent.generatePlan({
  userPrompt: "Plan a fun afternoon with museum visit and dinner",
  city: "San Francisco",
  priceRange: "$$",
  preferences: ["Cultural activities", "Fine dining"]
});
*/ 