
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-plan-description.ts';
import '@/ai/flows/suggest-itinerary-items.ts';
import '@/ai/flows/suggest-plan-name.ts';
import '@/ai/flows/generate-plan-image.ts';
import '@/ai/flows/generate-full-plan.ts'; // Added new flow
