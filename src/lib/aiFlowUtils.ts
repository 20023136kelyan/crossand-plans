import * as crypto from 'crypto';
import type { Plan } from '@/types/user';
import { processAIGeneratedPlan } from '@/lib/planUtils';
import { sanitizeItineraryUUIDs } from '@/lib/utils';
import { formatISO } from 'date-fns';
import { format } from 'date-fns-tz';

// Centralized UUID generation
export const generatePlanId = (): string => crypto.randomUUID();
export const generateItineraryItemId = (): string => crypto.randomUUID();

// Shared plan object creation factory
export const createPlanObject = (planData: any, input: any): Plan => {
  const planId = generatePlanId();
  
  return {
    id: planId,
    name: planData?.name || 'Generated Plan',
    description: planData?.description || '',
    // Preserve user's timezone while ensuring ISO format with timezone
    eventTime: planData?.eventTime ? formatISO(new Date(planData.eventTime)) : 
              input.planDateTime ? formatISO(new Date(input.planDateTime)) : formatISO(new Date()),
    location: planData?.location || input.locationQuery,
    primaryLocation: planData?.primaryLocation || undefined,
    city: planData?.city || 'Unknown City',
    eventType: planData?.eventType || 'Social',
    eventTypeLowercase: (planData?.eventType || 'social').toLowerCase(),
    priceRange: planData?.priceRange || '$',
    hostId: input.hostProfile.uid,
    hostName: input.hostProfile.name || undefined,
    hostAvatarUrl: undefined,
    creatorName: input.hostProfile.name || undefined,
    creatorUsername: undefined,
    creatorAvatarUrl: undefined,
    creatorIsVerified: false,
    invitedParticipantUserIds: input.invitedFriendProfiles.map((friend: any) => friend.uid),
    participantUserIds: [],
    itinerary: planData?.itinerary || [],
    status: planData?.status || 'draft',
    planType: planData?.planType || 'single-stop',
    originalPlanId: null,
    sharedByUid: null,
    averageRating: null,
    reviewCount: planData?.reviewCount || 0,
    photoHighlights: [],
    participantResponses: {},
    participantRSVPDetails: {},
    rsvpSettings: undefined,
    waitlist: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    coordinates: undefined,
    recentSaves: [],
    recentViews: [],
    recentCompletions: [],
    ratings: [],
    featured: false,
    isPremiumOnly: false,
    minimumActivityScore: undefined,
    venues: [],
    participantsCount: 0,
    likesCount: 0,
    sharesCount: 0,
    savesCount: 0,
    type: 'regular',
    isCompleted: false,
    completedAt: undefined,
    completionConfirmedBy: [],
    highlightsEnabled: false,
    isTemplate: false,
    templateOriginalHostId: undefined,
    templateOriginalHostName: undefined,
    waitlistUserIds: [],
    privateNotes: null,
  };
};

// Shared AI output processing
export const processAIOutput = async (output: any, input: any): Promise<Plan> => {
  let finalPlan = output as any;
  
  // Safety check: ensure we have an object, not a string
  if (typeof finalPlan === 'string') {
    console.warn('[processAIOutput] Received string instead of object, creating basic structure');
    try {
      // Try to parse as JSON
      const cleanedResponse = finalPlan.replace(/```json\n?|\n?```/g, '').trim();
      finalPlan = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('[processAIOutput] Failed to parse string as JSON:', parseError);
      // Create a basic plan structure from the string
      finalPlan = {
        name: `Plan for ${input.locationQuery || 'Unknown Location'}`,
        description: finalPlan.substring(0, 200) + (finalPlan.length > 200 ? '...' : ''),
        itinerary: [],
        eventType: input.eventType || 'planned-event',
        priceRange: input.budget || 'moderate',
        planType: 'single-stop',
        status: 'draft',
        isPublic: false
      };
    }
  }
  
  // Ensure we have a valid object
  if (!finalPlan || typeof finalPlan !== 'object') {
    console.error('[processAIOutput] Invalid output structure - AI service failed');
    throw new Error('AI service generated invalid output structure');
  }
  
  // Ensure ID is always set first (required by Plan interface)
  if (!finalPlan.id) {
    finalPlan.id = generatePlanId();
  }
  
  // Set timestamps and derived fields
  finalPlan.createdAt = formatISO(new Date()); // Use formatISO to preserve timezone
  finalPlan.updatedAt = formatISO(new Date());
  
  // Ensure eventTime has timezone information
  if (finalPlan.eventTime) {
    // Use formatISO to preserve user timezone while ensuring proper format
    finalPlan.eventTime = formatISO(new Date(finalPlan.eventTime));
  }
  finalPlan.eventTypeLowercase = finalPlan.eventType?.toLowerCase() || 'planned-event';
  finalPlan.hostId = input.hostProfile.uid;

  // Handle empty itinerary - AI service failed
  if (!finalPlan.itinerary || finalPlan.itinerary.length === 0) {
    console.error('[processAIOutput] AI generated an empty itinerary - AI service failed');
    throw new Error('AI service generated empty itinerary - no places discovered');
  }
  
  // Process itinerary items
  finalPlan.itinerary.forEach((item: any) => {
    if (!item.id) item.id = generateItineraryItemId();
    item.durationMinutes = item.durationMinutes ?? 60;
    item.transitMode = item.transitMode ?? 'driving';
    // Preserve original activity suggestions with emojis
    item.activitySuggestions = Array.isArray(item.activitySuggestions) ? 
      item.activitySuggestions.map((suggestion: string) => suggestion.trim()) : 
      [];
    item.openingHours = item.openingHours ?? [];
    item.types = item.types ?? [];
    item.transitTimeFromPreviousMinutes = item.transitTimeFromPreviousMinutes ?? null;
    item.description = item.description || null;
    item.tagline = item.tagline || null;
    item.noiseLevel = item.noiseLevel || null;

    // Preserve all fields from AI output
    if (item.placeName) item.placeName = item.placeName;
    if (item.address) item.address = item.address;
    if (item.city) item.city = item.city;
    if (item.googlePlaceId) item.googlePlaceId = item.googlePlaceId;
    if (item.googleMapsImageUrl) item.googleMapsImageUrl = item.googleMapsImageUrl;
    if (item.googlePhotoReference) item.googlePhotoReference = item.googlePhotoReference;
    if (item.lat) item.lat = item.lat;
    if (item.lng) item.lng = item.lng;
    if (item.rating) item.rating = item.rating;
    if (item.reviewCount) item.reviewCount = item.reviewCount;
    if (item.priceLevel) item.priceLevel = item.priceLevel;
    if (item.phoneNumber) item.phoneNumber = item.phoneNumber;
    if (item.website) item.website = item.website;
    if (item.isOperational) item.isOperational = item.isOperational;
    if (item.statusText) item.statusText = item.statusText;
    if (item.notes) item.notes = item.notes;

    // Ensure startTime has timezone information if it exists
    if (item.startTime) {
      item.startTime = formatISO(new Date(item.startTime));
    }
    
    // Calculate endTime if we have startTime but no endTime
    if (item.startTime && !item.endTime && typeof item.durationMinutes === 'number') {
      const start = new Date(item.startTime);
      item.endTime = formatISO(new Date(start.getTime() + item.durationMinutes * 60000));
    } 
    // If no startTime but we have planDateTime, use that (with timezone)
    else if (!item.startTime && input.planDateTime) { 
      item.startTime = formatISO(new Date(input.planDateTime)); 
      if (!item.endTime && typeof item.durationMinutes === 'number') {
        const start = new Date(item.startTime);
        item.endTime = formatISO(new Date(start.getTime() + item.durationMinutes * 60000));
      }
    }
  });

  // Sanitize all UUIDs to ensure they are valid
  finalPlan.itinerary = sanitizeItineraryUUIDs(finalPlan.itinerary);

  // Process and enhance the AI-generated plan with utilities
  const processedResult = await processAIGeneratedPlan(
    finalPlan, 
    input.planDateTime, 
    input.hostProfile, 
    input.userPrompt
  );
  
  // Preserve the original AI-generated fields
  finalPlan = {
    ...processedResult.plan,
    name: finalPlan.name || processedResult.plan.name,
    description: finalPlan.description || processedResult.plan.description,
    eventType: finalPlan.eventType || processedResult.plan.eventType,
    eventTypeLowercase: (finalPlan.eventType || processedResult.plan.eventType || 'social').toLowerCase(),
    city: finalPlan.city || processedResult.plan.city,
    itinerary: processedResult.plan.itinerary.map((item: any, index: number) => ({
      ...item,
      description: finalPlan.itinerary[index]?.description || item.description,
      activitySuggestions: finalPlan.itinerary[index]?.activitySuggestions || item.activitySuggestions,
      tagline: finalPlan.itinerary[index]?.tagline || item.tagline,
      noiseLevel: finalPlan.itinerary[index]?.noiseLevel || item.noiseLevel
    }))
  };

  // Ensure ID is always set after processing
  if (!finalPlan.id) {
    finalPlan.id = generatePlanId();
  }

  // Log any validation issues
  if (processedResult.validationErrors.length > 0) {
    console.warn('[processAIOutput] Validation errors:', processedResult.validationErrors);
  }
  if (processedResult.warnings.length > 0) {
    console.warn('[processAIOutput] Warnings:', processedResult.warnings);
  }

  // Set derived fields from first itinerary item
  if (finalPlan.itinerary[0]?.startTime) {
    finalPlan.eventTime = finalPlan.itinerary[0].startTime;
  } else if (input.planDateTime) {
    finalPlan.eventTime = input.planDateTime; 
  }

  if (finalPlan.itinerary[0]?.placeName) {
    finalPlan.location = finalPlan.itinerary[0].placeName;
  } else if (input.locationQuery) {
    finalPlan.location = input.locationQuery; 
  }
  
  if (finalPlan.itinerary[0]?.city) {
    finalPlan.city = finalPlan.itinerary[0].city;
  } else if (input.locationQuery.includes(',')) { 
    finalPlan.city = input.locationQuery.split(',').pop()?.trim() || 'Unknown City';
  } else {
    finalPlan.city = 'Unknown City';
  }
  
  // Set participant IDs
  if (input.invitedFriendProfiles && input.invitedFriendProfiles.length > 0) {
    finalPlan.invitedParticipantUserIds = input.invitedFriendProfiles.map((p: any) => p.uid);
  } else {
    finalPlan.invitedParticipantUserIds = [];
  }

  // Set defaults
  finalPlan.status = finalPlan.status || 'draft';
  finalPlan.planType = finalPlan.planType || (finalPlan.itinerary.length > 1 ? 'multi-stop' : 'single-stop');

  // Create base plan structure with defaults, then merge with AI-generated data
  const basePlan = createPlanObject({}, input);
  
  // Preserve AI-generated data by merging it over the base structure
  const enhancedPlan: Plan = {
    ...basePlan, // Base structure with all required fields
    ...finalPlan, // AI-generated data takes precedence
    id: finalPlan.id || basePlan.id, // Ensure ID is always set
    // Preserve critical fields that should always be set correctly
    hostId: input.hostProfile.uid,
    createdAt: finalPlan.createdAt || basePlan.createdAt,
    updatedAt: finalPlan.updatedAt || basePlan.updatedAt,
  };

  return enhancedPlan;
}; 

// Enhanced fallback strategy for when AI tools fail
export const createFallbackPlan = (input: any): Plan => {
  console.log('[createFallbackPlan] Creating fallback plan for:', input.locationQuery);
  
  const fallbackItinerary = generateFallbackItinerary(input);
  
  const fallbackPlan = {
    id: generatePlanId(),
    name: `${input.eventType || 'Event'} in ${input.locationQuery}`,
    description: `A curated plan for ${input.locationQuery}. This plan was generated using fallback strategies and should be enhanced with local research.`,
    eventTime: input.planDateTime ? formatISO(new Date(input.planDateTime)) : formatISO(new Date()),
    location: input.locationQuery,
    city: extractCityFromLocation(input.locationQuery),
    eventType: input.eventType || 'planned-event',
    eventTypeLowercase: (input.eventType || 'planned-event').toLowerCase(),
    priceRange: input.budget || 'moderate',
    hostId: input.hostProfile.uid,
    itinerary: fallbackItinerary,
    planType: fallbackItinerary.length > 1 ? 'multi-stop' : 'single-stop',
    status: 'draft',
    isPublic: false,
    invitedParticipantUserIds: input.invitedFriendProfiles?.map((p: any) => p.uid) || [],
    participantUserIds: [input.hostProfile.uid], // Add missing required field
    tags: generateFallbackTags(input),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Default values for required fields
    originalPlanId: null,
    sharedByUid: null,
    averageRating: null,
    reviewCount: 0,
    photoHighlights: [],
    participantResponses: {}
  };
  
  return fallbackPlan as Plan;
};

// Generate fallback itinerary based on common patterns
function generateFallbackItinerary(input: any): any[] {
  const items = [];
  const startTime = new Date(input.planDateTime);
  
  // Analyze the location and event type to create intelligent fallbacks
  const locationLower = input.locationQuery.toLowerCase();
  const eventTypeLower = (input.eventType || '').toLowerCase();
  
  // Determine the primary activity type
  let primaryType = 'general';
  if (eventTypeLower.includes('food') || eventTypeLower.includes('dining')) {
    primaryType = 'dining';
  } else if (eventTypeLower.includes('drink') || eventTypeLower.includes('bar')) {
    primaryType = 'nightlife';
  } else if (eventTypeLower.includes('outdoor') || eventTypeLower.includes('nature')) {
    primaryType = 'outdoor';
  } else if (eventTypeLower.includes('cultural') || eventTypeLower.includes('art')) {
    primaryType = 'cultural';
  } else if (eventTypeLower.includes('shopping')) {
    primaryType = 'shopping';
  }
  
  // Generate 2-4 stops based on duration and type
  const duration = input.duration || 'half-day';
  const numStops = duration === 'full-day' ? 4 : duration === 'half-day' ? 3 : 2;
  
  for (let i = 0; i < numStops; i++) {
    const itemStartTime = new Date(startTime.getTime() + (i * 2 * 60 * 60 * 1000)); // 2 hours apart
    const itemEndTime = new Date(itemStartTime.getTime() + (90 * 60 * 1000)); // 1.5 hours each
    
    const item = {
      id: generateItineraryItemId(),
      placeName: generateFallbackPlaceName(input.locationQuery, primaryType, i),
      startTime: formatISO(itemStartTime),
      endTime: formatISO(itemEndTime),
      durationMinutes: 90,
      description: generateFallbackDescription(primaryType, i),
      activitySuggestions: generateFallbackActivities(primaryType, i),
      address: null,
      city: extractCityFromLocation(input.locationQuery),
      googlePlaceId: null,
      lat: input.selectedLocationLat || null,
      lng: input.selectedLocationLng || null,
      googlePhotoReference: null,
      googleMapsImageUrl: null,
      rating: null,
      reviewCount: null,
      isOperational: null,
      statusText: null,
      openingHours: [],
      phoneNumber: null,
      website: null,
      priceLevel: null,
      types: [primaryType],
      notes: `This is a fallback suggestion. Please research and verify details before visiting.`,
      transitTimeFromPreviousMinutes: i > 0 ? 15 : null,
      transitMode: 'driving'
    };
    
    items.push(item);
  }
  
  return items;
}

// Generate fallback place names based on location and type
function generateFallbackPlaceName(location: string, type: string, index: number): string {
  const city = extractCityFromLocation(location);
  
  const templates = {
    dining: [
      `Local Dining in ${city}`,
      `${city} Restaurant District`,
      `Popular Eatery in ${city}`,
      `${city} Food Scene`
    ],
    nightlife: [
      `${city} Nightlife District`,
      `Popular Bar in ${city}`,
      `${city} Entertainment Area`,
      `Local Hangout in ${city}`
    ],
    outdoor: [
      `${city} Outdoor Area`,
      `Nature Spot near ${city}`,
      `${city} Recreation Area`,
      `Scenic Location in ${city}`
    ],
    cultural: [
      `${city} Cultural District`,
      `Arts Area in ${city}`,
      `${city} Historic District`,
      `Cultural Venue in ${city}`
    ],
    shopping: [
      `${city} Shopping District`,
      `Local Market in ${city}`,
      `${city} Retail Area`,
      `Shopping Center in ${city}`
    ],
    general: [
      `Popular Spot in ${city}`,
      `Local Attraction in ${city}`,
      `${city} Landmark`,
      `Community Hub in ${city}`
    ]
  };
  
  const typeTemplates = templates[type as keyof typeof templates] || templates.general;
  return typeTemplates[index % typeTemplates.length];
}

// Generate fallback descriptions
function generateFallbackDescription(type: string, index: number): string {
  const descriptions = {
    dining: [
      'Explore local dining options and discover authentic flavors.',
      'Experience the local food scene with diverse culinary offerings.',
      'Enjoy a meal at a popular local establishment.',
      'Discover hidden gems in the local dining landscape.'
    ],
    nightlife: [
      'Experience the local nightlife and social scene.',
      'Enjoy drinks and entertainment at a popular venue.',
      'Discover the local bar and lounge culture.',
      'Experience evening entertainment and social activities.'
    ],
    outdoor: [
      'Enjoy outdoor activities and natural beauty.',
      'Explore scenic locations and recreational opportunities.',
      'Experience nature and outdoor recreation.',
      'Discover local parks and outdoor attractions.'
    ],
    cultural: [
      'Explore local culture and artistic expressions.',
      'Experience the cultural heritage of the area.',
      'Discover local arts and cultural venues.',
      'Immerse yourself in the local cultural scene.'
    ],
    shopping: [
      'Explore local shopping and retail experiences.',
      'Discover unique shops and local businesses.',
      'Experience the local shopping culture.',
      'Find local products and specialty items.'
    ],
    general: [
      'Explore this popular local destination.',
      'Experience what makes this area special.',
      'Discover local attractions and activities.',
      'Enjoy the local atmosphere and community.'
    ]
  };
  
  const typeDescriptions = descriptions[type as keyof typeof descriptions] || descriptions.general;
  return typeDescriptions[index % typeDescriptions.length];
}

// Generate fallback activities
function generateFallbackActivities(type: string, index: number): string[] {
  const activities = {
    dining: [
      'Try local specialties',
      'Ask for recommendations',
      'Explore the menu',
      'Take photos of dishes'
    ],
    nightlife: [
      'Enjoy signature drinks',
      'Meet locals',
      'Listen to live music',
      'Experience the atmosphere'
    ],
    outdoor: [
      'Take scenic photos',
      'Enjoy fresh air',
      'Explore walking paths',
      'Connect with nature'
    ],
    cultural: [
      'Learn about local history',
      'Appreciate local art',
      'Take guided tours',
      'Engage with exhibits'
    ],
    shopping: [
      'Browse local products',
      'Support local businesses',
      'Find unique souvenirs',
      'Compare prices'
    ],
    general: [
      'Explore the area',
      'Take photos',
      'Learn about local culture',
      'Enjoy the experience'
    ]
  };
  
  return activities[type as keyof typeof activities] || activities.general;
}

// Generate fallback tags
function generateFallbackTags(input: any): string[] {
  const tags = ['fallback-generated'];
  
  if (input.eventType) {
    tags.push(input.eventType.toLowerCase());
  }
  
  if (input.budget) {
    tags.push(input.budget);
  }
  
  if (input.duration) {
    tags.push(input.duration);
  }
  
  const city = extractCityFromLocation(input.locationQuery);
  if (city) {
    tags.push(city.toLowerCase().replace(/\s+/g, '-'));
  }
  
  return tags;
}

// Extract city from location query
function extractCityFromLocation(locationQuery: string): string {
  if (locationQuery.includes(',')) {
    return locationQuery.split(',').pop()?.trim() || 'Unknown City';
  }
  return locationQuery;
} 

// Intelligent user intent analysis for targeted discovery
export interface UserIntent {
  category: 'food' | 'drinks' | 'activities' | 'shopping' | 'cultural' | 'entertainment' | 'general';
  specificItem?: string;
  cuisine?: string;
  culturalContext?: string;
  searchTerms: string[];
  priority: 'specific_item' | 'category_exploration' | 'general_discovery';
  targetQueries: string[];
  fallbackQueries: string[];
  searchStrategy: 'exact_match' | 'cultural_exploration' | 'category_discovery' | 'local_variation';
}

export const analyzeUserIntent = async (userPrompt: string, locationQuery: string): Promise<UserIntent> => {
  console.log('[analyzeUserIntent] Analyzing prompt:', userPrompt);
  
  const prompt = userPrompt.toLowerCase();
  const location = locationQuery.toLowerCase();
  
  // Extract specific items in quotes
  const quotedItems = userPrompt.match(/"([^"]+)"/g)?.map(item => item.replace(/"/g, '')) || [];
  
  // Detect food/drink items
  const foodKeywords = ['restaurant', 'food', 'eat', 'dining', 'cuisine', 'dish', 'meal', 'snack'];
  const drinkKeywords = ['drink', 'beverage', 'cocktail', 'bar', 'coffee', 'tea', 'juice', 'water', 'beer', 'wine'];
  const culturalKeywords = ['mexican', 'italian', 'chinese', 'japanese', 'thai', 'indian', 'french', 'spanish', 'korean', 'vietnamese'];
  
  let intent: UserIntent = {
    category: 'general',
    searchTerms: [],
    priority: 'general_discovery',
    targetQueries: [],
    fallbackQueries: [],
    searchStrategy: 'category_discovery'
  };
  
  // Analyze specific quoted items (highest priority)
  if (quotedItems.length > 0) {
    const specificItem = quotedItems[0];
    intent.specificItem = specificItem;
    intent.priority = 'specific_item';
    intent.searchStrategy = 'exact_match';
    
    // Determine category based on context
    if (drinkKeywords.some(keyword => prompt.includes(keyword)) || 
        ['coco', 'agua', 'horchata', 'jamaica', 'tamarindo'].some(drink => specificItem.toLowerCase().includes(drink))) {
      intent.category = 'drinks';
    } else if (foodKeywords.some(keyword => prompt.includes(keyword))) {
      intent.category = 'food';
    }
    
    // Detect cultural context
    const detectedCulture = culturalKeywords.find(culture => prompt.includes(culture));
    if (detectedCulture) {
      intent.cuisine = detectedCulture;
      intent.culturalContext = detectedCulture;
      intent.searchStrategy = 'cultural_exploration';
    }
    
    // Generate targeted search queries using LLM-powered approach
    try {
      intent.targetQueries = await generateTargetedQueriesWithLLM(specificItem, intent.cuisine, location);
      intent.fallbackQueries = await generateFallbackQueriesWithLLM(intent.category, intent.cuisine, location);
    } catch (error) {
      console.error('[analyzeUserIntent] LLM query generation failed, using fallback:', error);
      intent.targetQueries = generateTargetedQueriesFallback(specificItem, intent.cuisine, location);
      intent.fallbackQueries = generateFallbackQueriesFallback(intent.category, intent.cuisine, location);
    }
  }
  // Analyze cuisine/cultural requests
  else if (culturalKeywords.some(culture => prompt.includes(culture))) {
    const culture = culturalKeywords.find(culture => prompt.includes(culture))!;
    intent.cuisine = culture;
    intent.culturalContext = culture;
    intent.category = foodKeywords.some(keyword => prompt.includes(keyword)) ? 'food' : 'general';
    intent.priority = 'category_exploration';
    intent.searchStrategy = 'cultural_exploration';
    
    // Generate cultural queries using LLM-powered approach
    try {
      intent.targetQueries = await generateCulturalQueriesWithLLM(culture, location);
      intent.fallbackQueries = await generateFallbackQueriesWithLLM(intent.category, culture, location);
    } catch (error) {
      console.error('[analyzeUserIntent] LLM cultural query generation failed, using fallback:', error);
      intent.targetQueries = generateCulturalQueriesFallback(culture, location);
      intent.fallbackQueries = generateFallbackQueriesFallback(intent.category, culture, location);
    }
  }
  // General category detection
  else {
    if (foodKeywords.some(keyword => prompt.includes(keyword))) {
      intent.category = 'food';
    } else if (drinkKeywords.some(keyword => prompt.includes(keyword))) {
      intent.category = 'drinks';
    }
    
    // Generate category queries using LLM-powered approach
    try {
      intent.targetQueries = await generateCategoryQueriesWithLLM(intent.category, location);
      intent.fallbackQueries = await generateFallbackQueriesWithLLM(intent.category, undefined, location);
    } catch (error) {
      console.error('[analyzeUserIntent] LLM category query generation failed, using fallback:', error);
      intent.targetQueries = generateCategoryQueriesFallback(intent.category, location);
      intent.fallbackQueries = generateFallbackQueriesFallback(intent.category, undefined, location);
    }
  }
  
  console.log('[analyzeUserIntent] Generated intent:', intent);
  return intent;
};

// Generate targeted search queries for specific items using LLM-powered analysis
async function generateTargetedQueriesWithLLM(specificItem: string, cuisine?: string, location?: string): Promise<string[]> {
  try {
    const { ai, modelConfigs } = await import('../ai/genkit');
    
    const prompt = `You are an expert at generating targeted search queries. Given a specific item, cuisine context, and location, generate the most effective search queries to find exactly what the user wants.

SPECIFIC ITEM: "${specificItem}"
CUISINE CONTEXT: "${cuisine || 'none'}"
LOCATION: "${location || 'unknown'}"

Generate 5-8 highly targeted search queries that will find this specific item. Consider:
1. Exact matches with quotes
2. Cultural variations and alternative names
3. Local terminology and slang
4. Related terms that might help discovery
5. Vendor/shop variations

Return as JSON array: ["query1", "query2", ...]`;

    const result = await ai.generate({
      model: 'googleai/gemini-2.5-pro',
      prompt,
      config: modelConfigs.generation
    });

    if (result.text) {
      const cleaned = result.text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 8);
      }
    }
  } catch (error) {
    console.error('[generateTargetedQueriesWithLLM] Error:', error);
  }
  
  // Fallback to rule-based approach
  return generateTargetedQueriesFallback(specificItem, cuisine, location);
}

// Generate cultural exploration queries using LLM-powered analysis
async function generateCulturalQueriesWithLLM(cuisine: string, location?: string): Promise<string[]> {
  try {
    const { ai, modelConfigs } = await import('../ai/genkit');
    
    const prompt = `You are an expert at generating cultural exploration search queries. Given a cuisine and location, generate search queries that will help discover authentic cultural experiences.

CUISINE: "${cuisine}"
LOCATION: "${location || 'unknown'}"

Generate 5-8 search queries that will help discover:
1. Authentic restaurants and eateries
2. Cultural centers and markets
3. Traditional dishes and specialties
4. Local cultural experiences
5. Community gathering places

Return as JSON array: ["query1", "query2", ...]`;

    const result = await ai.generate({
      model: 'googleai/gemini-2.5-pro',
      prompt,
      config: modelConfigs.creative
    });

    if (result.text) {
      const cleaned = result.text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 8);
      }
    }
  } catch (error) {
    console.error('[generateCulturalQueriesWithLLM] Error:', error);
  }
  
  // Fallback to rule-based approach
  return generateCulturalQueriesFallback(cuisine, location);
}

// Generate category-based queries using LLM-powered analysis
async function generateCategoryQueriesWithLLM(category: string, location?: string): Promise<string[]> {
  try {
    const { ai, modelConfigs } = await import('../ai/genkit');
    
    const prompt = `You are an expert at generating category-based search queries. Given a category and location, generate search queries that will help discover relevant places and experiences.

CATEGORY: "${category}"
LOCATION: "${location || 'unknown'}"

Generate 5-8 search queries that will help discover:
1. The best places in this category
2. Local favorites and hidden gems
3. Popular and trending spots
4. Specialized venues and experiences
5. Community recommendations

Return as JSON array: ["query1", "query2", ...]`;

    const result = await ai.generate({
      model: 'googleai/gemini-2.5-pro',
      prompt,
      config: modelConfigs.generation
    });

    if (result.text) {
      const cleaned = result.text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 8);
      }
    }
  } catch (error) {
    console.error('[generateCategoryQueriesWithLLM] Error:', error);
  }
  
  // Fallback to rule-based approach
  return generateCategoryQueriesFallback(category, location);
}

// Generate fallback queries using LLM-powered analysis
async function generateFallbackQueriesWithLLM(category: string, cuisine?: string, location?: string): Promise<string[]> {
  try {
    const { ai, modelConfigs } = await import('../ai/genkit');
    
    const prompt = `You are an expert at generating fallback search queries when primary searches fail. Given a category, cuisine context, and location, generate broader but still relevant search queries.

CATEGORY: "${category}"
CUISINE: "${cuisine || 'none'}"
LOCATION: "${location || 'unknown'}"

Generate 5-8 fallback search queries that are:
1. Broader but still relevant
2. Alternative approaches to finding what the user wants
3. Related categories and experiences
4. General discovery queries
5. Popular and well-known options

Return as JSON array: ["query1", "query2", ...]`;

    const result = await ai.generate({
      model: 'googleai/gemini-2.5-pro',
      prompt,
      config: modelConfigs.generation
    });

    if (result.text) {
      const cleaned = result.text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 8);
      }
    }
  } catch (error) {
    console.error('[generateFallbackQueriesWithLLM] Error:', error);
  }
  
  // Fallback to rule-based approach
  return generateFallbackQueriesFallback(category, cuisine, location);
}

// Fallback rule-based functions (kept for reliability)
function generateTargetedQueriesFallback(specificItem: string, cuisine?: string, location?: string): string[] {
  const queries = [];
  const cityName = extractCityFromLocation(location || '');
  
  // Exact match queries
  queries.push(`"${specificItem}" ${cityName}`);
  queries.push(`${specificItem} ${cityName}`);
  
  if (cuisine) {
    queries.push(`"${specificItem}" ${cuisine} ${cityName}`);
    queries.push(`${cuisine} ${specificItem} where to find ${cityName}`);
    queries.push(`authentic ${cuisine} ${specificItem} ${cityName}`);
  }
  
  // Context-specific queries
  if (specificItem.toLowerCase().includes('coco')) {
    queries.push(`coconut water ${cuisine || ''} ${cityName}`.trim());
    queries.push(`fresh coconut drinks ${cityName}`);
    queries.push(`agua de coco ${cityName}`);
  }
  
  // Local variation queries
  queries.push(`where to buy ${specificItem} ${cityName}`);
  queries.push(`${specificItem} vendors ${cityName}`);
  queries.push(`${specificItem} specialty shops ${cityName}`);
  
  return queries.slice(0, 8); // Limit to 8 queries
}

function generateCulturalQueriesFallback(cuisine: string, location?: string): string[] {
  const queries = [];
  const cityName = extractCityFromLocation(location || '');
  
  queries.push(`authentic ${cuisine} restaurants ${cityName}`);
  queries.push(`best ${cuisine} food ${cityName}`);
  queries.push(`${cuisine} neighborhood ${cityName}`);
  queries.push(`${cuisine} grocery stores ${cityName}`);
  queries.push(`${cuisine} cultural center ${cityName}`);
  queries.push(`traditional ${cuisine} dishes ${cityName}`);
  
  return queries;
}

function generateCategoryQueriesFallback(category: string, location?: string): string[] {
  const queries = [];
  const cityName = extractCityFromLocation(location || '');
  
  switch (category) {
    case 'food':
      queries.push(`local restaurants ${cityName}`);
      queries.push(`food scene ${cityName}`);
      break;
    case 'drinks':
      queries.push(`specialty drinks ${cityName}`);
      queries.push(`local beverages ${cityName}`);
      break;
    default:
      queries.push(`local attractions ${cityName}`);
      queries.push(`things to do ${cityName}`);
  }
  
  return queries;
}

function generateFallbackQueriesFallback(category: string, cuisine?: string, location?: string): string[] {
  const queries = [];
  const cityName = extractCityFromLocation(location || '');
  
  if (cuisine) {
    queries.push(`${cuisine} restaurants ${cityName}`);
    queries.push(`${cuisine} food ${cityName}`);
  }
  
  switch (category) {
    case 'food':
      queries.push(`restaurants ${cityName}`);
      queries.push(`dining ${cityName}`);
      break;
    case 'drinks':
      queries.push(`bars ${cityName}`);
      queries.push(`cafes ${cityName}`);
      break;
    default:
      queries.push(`popular places ${cityName}`);
  }
  
  return queries;
} 

// LLM-powered search term builder for maximum accuracy
export const generateLLMSearchTerms = async (userPrompt: string, location: string): Promise<{
  primaryQueries: string[];
  secondaryQueries: string[];
  culturalContext: string | null;
  searchStrategy: string;
  itemType: string | null;
  confidence: number;
}> => {
  console.log('[generateLLMSearchTerms] Analyzing prompt:', userPrompt, 'Location:', location);
  
  try {
    const { ai, modelConfigs } = await import('../ai/genkit');
    
    // Use AI to analyze the user's request and generate precise search terms
    const searchAnalysisPrompt = `Analyze this request: "${userPrompt}" in ${location}.

Generate intelligent search queries that will find exactly what the user wants. Consider:

**CONTEXT ANALYSIS:**
- Specific items mentioned (food, drinks, activities, places)
- Cultural context and cuisine preferences
- Atmosphere preferences (quiet, romantic, casual, upscale)
- Time constraints (late night, breakfast, lunch, dinner)
- Accessibility needs and dietary restrictions
- Group size and venue capacity

**SEARCH STRATEGIES:**
- Exact match: For specific items like "tacos", "coffee", "museum"
- Cultural exploration: For cuisine preferences like "Mexican", "Italian"
- Category discovery: For general preferences like "quiet", "romantic"
- Local variation: For authentic/local experiences

**EXAMPLES:**
- "quiet coffee shop" → ["quiet coffee shop", "peaceful cafe", "study cafe"]
- "authentic Mexican tacos" → ["authentic Mexican tacos", "Mexican restaurant tacos", "taco shop"]
- "romantic date night" → ["romantic restaurant", "date night spots", "intimate dining"]

Return JSON:
{
  "primaryQueries": ["specific search terms (3-5 queries)"],
  "secondaryQueries": ["broader related terms (3-5 queries)"],
  "culturalContext": "mexican/italian/chinese/etc" or null,
  "searchStrategy": "exact_match" or "cultural_exploration" or "category_discovery",
  "itemType": "food" or "drink" or "activity" or "place" or null,
  "confidence": 0.75
}`;

    console.log('[generateLLMSearchTerms] Attempting LLM analysis...');
    const result = await ai.generate({
      model: 'googleai/gemini-2.5-pro',
      prompt: searchAnalysisPrompt,
      config: modelConfigs.analysis
    });
    
    if (result.text) {
      const cleaned = result.text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.primaryQueries && parsed.primaryQueries.length > 0) {
        console.log('[generateLLMSearchTerms] ✅ LLM analysis successful:', parsed.primaryQueries.length, 'primary queries');
        return parsed;
      }
    }
    
    console.error('[generateLLMSearchTerms] ❌ LLM analysis failed - no valid response');
    throw new Error('LLM search term generation failed - no valid response');
    
  } catch (error: any) {
    console.error('[generateLLMSearchTerms] ❌ Error in LLM analysis:', error);
    throw new Error(`LLM search term generation failed: ${error.message}`);
  }
};

// AI analysis function - direct and simple
async function analyzeWithAI(prompt: string): Promise<any> {
  try {
    // Import AI service
    const { ai, modelConfigs } = await import('../ai/genkit');
    
    console.log('[analyzeWithAI] Starting LLM analysis...');
    console.log('[analyzeWithAI] Environment check:', {
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? 'Present' : 'Missing',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Present' : 'Missing',
      NODE_ENV: process.env.NODE_ENV
    });
    
    // Generate search terms using Gemini with structured output
    const result = await ai.enhancedGenerate({
      model: 'googleai/gemini-2.5-pro',
      prompt: prompt,
      config: {
        ...modelConfigs.analysis,
        maxOutputTokens: 8000 // Ensure enough tokens for complex analysis
      }
    });
    
    console.log('[analyzeWithAI] AI response received:', result ? 'Yes' : 'No');
    if (result?.message?.content) {
      console.log('[analyzeWithAI] Response content:', result.message.content);
      
      try {
      // Parse the JSON response
        let cleanedResponse = result.message.content.replace(/```json\n?|\n?```/g, '').trim();
        cleanedResponse = cleanedResponse.replace(/^[^{]*/, ''); // Remove any text before {
        cleanedResponse = cleanedResponse.replace(/[^}]*$/, ''); // Remove any text after }
        
      const parsedResult = JSON.parse(cleanedResponse);
      
      // Validate the response structure
        if (parsedResult.primaryQueries && Array.isArray(parsedResult.primaryQueries) && parsedResult.primaryQueries.length > 0) {
          console.log('[analyzeWithAI] ✅ Successfully generated LLM search terms:', parsedResult.primaryQueries.length, 'primary queries');
        return parsedResult;
      } else {
          console.warn('[analyzeWithAI] ❌ Invalid response structure - missing primaryQueries:', parsedResult);
        return null;
      }
      } catch (parseError) {
        console.error('[analyzeWithAI] ❌ JSON parsing failed:', parseError);
        console.error('[analyzeWithAI] Raw response that failed to parse:', result.message.content);
        return null;
    }
    } else {
      console.warn('[analyzeWithAI] ❌ No content in AI response');
      console.warn('[analyzeWithAI] Result object:', result);
    return null;
    }
  } catch (error: any) {
    console.error('[analyzeWithAI] ❌ AI service error:', error);
    console.error('[analyzeWithAI] Error details:', error.message, error.stack);
    return null;
  }
}

// Enhanced rule-based fallback (improved version of current logic)
function generateEnhancedRuleBasedSearchTerms(userPrompt: string, location: string): {
  primaryQueries: string[];
  secondaryQueries: string[];
  culturalContext: string | null;
  searchStrategy: string;
  itemType: string | null;
  confidence: number;
} {
  // Clean the user prompt - remove metadata and extract the actual request
  const cleanPrompt = userPrompt.replace(/\(Generated at.*?\)/g, '').replace(/Session:.*?Preferences:.*?Diversity:.*?\)/g, '').trim();
  const prompt = cleanPrompt.toLowerCase();
  const cityName = extractCityFromLocation(location);
  
  console.log('[generateEnhancedRuleBasedSearchTerms] Clean prompt:', cleanPrompt);
  console.log('[generateEnhancedRuleBasedSearchTerms] City:', cityName);
  
  // Extract quoted items
  const quotedItems = cleanPrompt.match(/"([^"]+)"/g)?.map((item: string) => item.replace(/"/g, '')) || [];
  
  // Extract specific items without quotes (improved extraction)
  const specificItems = extractSpecificItemsFromPrompt(cleanPrompt);
  
  // Cultural detection
  const culturalKeywords = {
    'mexican': ['mexican', 'mexico', 'latina', 'latino', 'hispanic', 'taco', 'burrito', 'enchilada'],
    'italian': ['italian', 'italy', 'italiano', 'pizza', 'pasta', 'espresso'],
    'chinese': ['chinese', 'china', 'cantonese', 'mandarin', 'dim sum', 'dumpling'],
    'japanese': ['japanese', 'japan', 'sushi', 'ramen', 'tempura', 'bento'],
    'thai': ['thai', 'thailand', 'pad thai', 'curry'],
    'indian': ['indian', 'india', 'curry', 'naan', 'tandoori'],
    'korean': ['korean', 'korea', 'kimchi', 'bibimbap', 'bulgogi'],
    'french': ['french', 'france', 'bistro', 'croissant', 'baguette']
  };
  
  let culturalContext = null;
  for (const [culture, keywords] of Object.entries(culturalKeywords)) {
    if (keywords.some(keyword => prompt.includes(keyword))) {
      culturalContext = culture;
      break;
    }
  }
  
  // Item type detection
  let itemType = null;
  if (['drink', 'beverage', 'agua', 'juice', 'water', 'cocktail', 'coffee', 'tea', 'smoothie'].some(word => prompt.includes(word))) {
    itemType = 'drink';
  } else if (['food', 'restaurant', 'eat', 'dish', 'meal', 'dinner', 'lunch', 'breakfast'].some(word => prompt.includes(word))) {
    itemType = 'food';
  } else if (['activity', 'tour', 'museum', 'park', 'attraction', 'experience'].some(word => prompt.includes(word))) {
    itemType = 'activity';
  }
  
  let primaryQueries: string[] = [];
  let secondaryQueries: string[] = [];
  let searchStrategy = 'category_discovery';
  
  // Use specific items if available
  const targetItems = [...quotedItems, ...specificItems];
  
  // Generate intelligent search queries based on the cleaned prompt
  if (targetItems.length > 0) {
    // Use specific items found in the prompt
    for (const item of targetItems.slice(0, 3)) {
      primaryQueries.push(`${item} ${cityName}`);
      primaryQueries.push(`best ${item} ${cityName}`);
      secondaryQueries.push(`${item} restaurant ${cityName}`);
      secondaryQueries.push(`${item} near me ${cityName}`);
    }
  } else {
    // Analyze the prompt for intent and generate appropriate queries
    const isDateRelated = prompt.includes('date') || prompt.includes('romantic') || prompt.includes('couple');
    const isFunRelated = prompt.includes('fun') || prompt.includes('entertainment') || prompt.includes('activity');
    const isUniqueRelated = prompt.includes('unique') || prompt.includes('different') || prompt.includes('special');
    const isFoodRelated = prompt.includes('food') || prompt.includes('restaurant') || prompt.includes('dining');
    const isDrinkRelated = prompt.includes('drink') || prompt.includes('cocktail') || prompt.includes('bar');
    
    if (isDateRelated && isFunRelated) {
      primaryQueries.push(`fun date night ${cityName}`);
      primaryQueries.push(`romantic date spots ${cityName}`);
      primaryQueries.push(`unique date ideas ${cityName}`);
      secondaryQueries.push(`date night activities ${cityName}`);
      secondaryQueries.push(`couple activities ${cityName}`);
      secondaryQueries.push(`romantic restaurants ${cityName}`);
    } else if (isFoodRelated) {
      primaryQueries.push(`best restaurants ${cityName}`);
      primaryQueries.push(`popular dining ${cityName}`);
      primaryQueries.push(`local food ${cityName}`);
      secondaryQueries.push(`restaurant recommendations ${cityName}`);
      secondaryQueries.push(`food scene ${cityName}`);
    } else if (isDrinkRelated) {
      primaryQueries.push(`cocktail bars ${cityName}`);
      primaryQueries.push(`best bars ${cityName}`);
      primaryQueries.push(`craft cocktails ${cityName}`);
      secondaryQueries.push(`nightlife ${cityName}`);
      secondaryQueries.push(`drinks ${cityName}`);
    } else if (isFunRelated) {
      primaryQueries.push(`fun activities ${cityName}`);
      primaryQueries.push(`entertainment ${cityName}`);
      primaryQueries.push(`things to do ${cityName}`);
      secondaryQueries.push(`activities ${cityName}`);
      secondaryQueries.push(`attractions ${cityName}`);
    } else {
      // Generic fallback
      primaryQueries.push(`best places ${cityName}`);
      primaryQueries.push(`popular spots ${cityName}`);
      primaryQueries.push(`local favorites ${cityName}`);
      secondaryQueries.push(`recommendations ${cityName}`);
      secondaryQueries.push(`things to do ${cityName}`);
    }
  }
  
  if (targetItems.length > 0) {
    const specificItem = targetItems[0];
    searchStrategy = 'exact_match';
    
    // Generate primary queries for specific item
    primaryQueries = [
      `"${specificItem}" ${cityName}`,
      `${specificItem} ${cityName}`,
      `${specificItem} restaurant ${cityName}`,
      `${specificItem} ${culturalContext || ''} ${cityName}`.trim(),
    ];
    
    if (culturalContext) {
      primaryQueries.push(
        `"${specificItem}" ${culturalContext} ${cityName}`,
        `authentic ${culturalContext} ${specificItem} ${cityName}`,
        `${culturalContext} restaurant ${specificItem} ${cityName}`
      );
    }
    
    // Generate secondary queries
    secondaryQueries = [
      `${culturalContext || ''} grocery store ${cityName}`.trim(),
      `${culturalContext || ''} market ${cityName}`.trim(),
      `specialty ${itemType || 'food'} store ${cityName}`,
      `international market ${cityName}`,
      `${specificItem} near me ${cityName}`,
      `best ${specificItem} ${cityName}`
    ];
  } else {
    // Generate queries based on cultural context and item type
    if (culturalContext) {
      primaryQueries = [
        `${culturalContext} restaurant ${cityName}`,
        `authentic ${culturalContext} food ${cityName}`,
        `${culturalContext} cuisine ${cityName}`,
        `best ${culturalContext} restaurant ${cityName}`
      ];
      
      secondaryQueries = [
        `${culturalContext} grocery store ${cityName}`,
        `${culturalContext} market ${cityName}`,
        `international food ${cityName}`,
        `ethnic restaurant ${cityName}`
      ];
    } else if (itemType) {
      primaryQueries = [
        `${itemType} ${cityName}`,
        `best ${itemType} ${cityName}`,
        `${itemType} restaurant ${cityName}`,
        `${itemType} near me ${cityName}`
      ];
      
      secondaryQueries = [
        `restaurant ${cityName}`,
        `food ${cityName}`,
        `dining ${cityName}`,
        `local ${itemType} ${cityName}`
      ];
    } else {
      // Generic fallback - use the actual user prompt intelligently
      const cleanUserPrompt = userPrompt.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      
      primaryQueries = [
        `${cleanUserPrompt} ${cityName}`,
        `best ${cleanUserPrompt} ${cityName}`,
        `${cleanUserPrompt} restaurant ${cityName}`,
        `${cleanUserPrompt} near me ${cityName}`,
        `${cleanUserPrompt} ${cityName} recommendations`
      ];
      
      secondaryQueries = [
        `restaurant ${cityName}`,
        `food ${cityName}`,
        `activities ${cityName}`,
        `attractions ${cityName}`,
        `best places ${cityName}`,
        `local favorites ${cityName}`
      ];
    }
  }
  
  return {
    primaryQueries: primaryQueries.slice(0, 5),
    secondaryQueries: secondaryQueries.slice(0, 5),
    culturalContext,
    searchStrategy,
    itemType,
    confidence: targetItems.length > 0 ? 0.75 : 0.60
  };
}

// Helper function to extract specific items from prompt
function extractSpecificItemsFromPrompt(userPrompt: string): string[] {
  const items: string[] = [];
  
  // Extract common food/drink items
  const foodItems = ['pizza', 'pasta', 'sushi', 'ramen', 'taco', 'burrito', 'curry', 'pad thai', 'pho', 'dumplings', 'dim sum', 'kebab', 'falafel', 'gyro', 'shawarma'];
  const drinkItems = ['coffee', 'tea', 'smoothie', 'juice', 'cocktail', 'beer', 'wine', 'espresso', 'latte', 'cappuccino'];
  const activityItems = ['museum', 'park', 'theater', 'cinema', 'gallery', 'zoo', 'aquarium', 'botanical garden', 'historic site', 'tour'];
  
  const allItems = [...foodItems, ...drinkItems, ...activityItems];
  
  for (const item of allItems) {
    if (userPrompt.toLowerCase().includes(item)) {
      items.push(item);
    }
  }
  
  return items;
}

// LLM-powered extraction of specific item/activity from user prompt
export const extractSpecificItemWithLLM = async (userPrompt: string): Promise<string | null> => {
  if (!userPrompt) return null;
  try {
    const { ai } = await import('../ai/genkit');
    const prompt = `You are an expert at understanding user intent. Given the following user prompt, extract the main specific item, activity, or experience the user is seeking. If the user is looking for something specific, return it as a string. If the request is general or there is no specific item, return null.

USER PROMPT: "${userPrompt}"

Response format:
{"specificItem": "..."} or {"specificItem": null}`;
    const result = await ai.generate({
      model: 'googleai/gemini-2.5-pro',
      prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 200,
      },
    });
    if (result.text) {
      const cleaned = result.text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (typeof parsed.specificItem === 'string' && parsed.specificItem.length > 0) {
        return parsed.specificItem;
      }
    }
    return null;
  } catch (error) {
    console.error('[extractSpecificItemWithLLM] Error:', error);
    return null;
  }
};

// Enhanced intent analysis using LLM-generated search terms
export const analyzeUserIntentWithLLM = async (userPrompt: string, locationQuery: string): Promise<UserIntent> => {
  console.log('[analyzeUserIntentWithLLM] Analyzing with LLM support:', userPrompt);
  console.log('[analyzeUserIntentWithLLM] userPrompt type:', typeof userPrompt);
  console.log('[analyzeUserIntentWithLLM] userPrompt length:', userPrompt?.length);
  console.log('[analyzeUserIntentWithLLM] locationQuery:', locationQuery);
  
  try {
    // Get LLM-generated search terms
    const llmResult = await generateLLMSearchTerms(userPrompt, locationQuery);
    // Use LLM to extract the specific item/activity
    let specificItem: string | undefined = undefined;
    try {
      specificItem = await extractSpecificItemWithLLM(userPrompt) || undefined;
    } catch (err) {
      console.error('[analyzeUserIntentWithLLM] LLM specific item extraction failed, falling back to rule-based:', err);
      specificItem = extractSpecificItem(userPrompt);
    }
    // Convert to UserIntent format
    const intent: UserIntent = {
      category: mapItemTypeToCategory(llmResult.itemType),
      specificItem,
      cuisine: llmResult.culturalContext || undefined,
      culturalContext: llmResult.culturalContext || undefined,
      searchTerms: [...llmResult.primaryQueries, ...llmResult.secondaryQueries],
      priority: llmResult.searchStrategy === 'exact_match' ? 'specific_item' : 'category_exploration',
      targetQueries: llmResult.primaryQueries,
      fallbackQueries: llmResult.secondaryQueries,
      searchStrategy: llmResult.searchStrategy as any
    };
    console.log('[analyzeUserIntentWithLLM] Generated enhanced intent:', intent);
    return intent;
  } catch (error) {
    console.error('[analyzeUserIntentWithLLM] Error, falling back to rule-based:', error);
    // Fallback to existing rule-based approach
    return await analyzeUserIntent(userPrompt, locationQuery);
  }
};

function mapItemTypeToCategory(itemType: string | null): UserIntent['category'] {
  switch (itemType) {
    case 'drink': return 'drinks';
    case 'food': return 'food';
    case 'activity': return 'activities';
    case 'place': return 'cultural';
    default: return 'general';
  }
}

function extractSpecificItem(userPrompt: string): string | undefined {
  const quotedItems = userPrompt.match(/"([^"]+)"/g)?.map(item => item.replace(/"/g, ''));
  return quotedItems?.[0];
} 