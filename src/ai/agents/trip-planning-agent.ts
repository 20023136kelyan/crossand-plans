import {z} from 'zod';
import {deriveTripPlanDraft} from '@/ai/local-generators';

const TripPlanningInputSchema = z.object({
  userPrompt: z.string(),
  city: z.string(),
  priceRange: z.string(),
  eventTime: z.string().optional(),
  preferences: z.array(z.string()).optional(),
});

const VenueSchema = z.object({
  name: z.string(),
  description: z.string(),
  activities: z.array(z.string()),
  duration: z.number(),
  order: z.number(),
});

const TripPlanSchema = z.object({
  name: z.string(),
  description: z.string(),
  type: z.string(),
  venues: z.array(VenueSchema),
});

type TripPlanningInput = z.infer<typeof TripPlanningInputSchema>;
type TripPlan = z.infer<typeof TripPlanSchema>;

export class TripPlanningAgent {
  async generatePlan(input: TripPlanningInput): Promise<TripPlan> {
    const validatedInput = TripPlanningInputSchema.parse(input);
    const draft = deriveTripPlanDraft({
      userPrompt: validatedInput.userPrompt,
      city: validatedInput.city,
      priceRange: validatedInput.priceRange,
      eventTime: validatedInput.eventTime,
      preferences: validatedInput.preferences,
    });

    return TripPlanSchema.parse({
      name: draft.name,
      description: draft.description,
      type: draft.type,
      venues: draft.venues.map((venue, index) => ({
        name: venue.placeName,
        description: venue.description,
        activities: venue.activities,
        duration: 60,
        order: index,
      })),
    });
  }

  async validateVenues(plan: TripPlan, city: string): Promise<boolean> {
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return true;
      }

      for (const venue of plan.venues) {
        const searchQuery = encodeURIComponent(`${venue.name} ${city}`);
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&key=${apiKey}`
        );
        const data = await response.json();
        if (!data.results?.[0]) {
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

