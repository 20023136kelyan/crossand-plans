
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-event-suggestions.ts';
import '@/ai/flows/generate-plan-name.ts';
import '@/ai/flows/generate-plan-description.ts';
import '@/ai/flows/generate-plan-event-type.ts';
import '@/ai/flows/generate-plan-location.ts';
import '@/ai/flows/generate-plan-price-range.ts';
import '@/ai/flows/generate-full-plan-details.ts';
import '@/ai/flows/generate-itinerary-item-details.ts'; 
// Tools are usually part of flow definitions and don't need separate top-level imports here
// unless they are also defined as standalone flows, which is not typical for pure tools.
// import '@/ai/tools/travel-time-tool.ts'; // Example if it were a flow
// import '@/ai/tools/place-details-tool.ts'; // Example if it were a flow

    