import {addHours, addMinutes, formatISO, isValid, parseISO} from 'date-fns';

type StopDraft = {
  placeName: string;
  description: string;
  activities: string[];
};

type FullPlanContext = {
  userPrompt: string;
  userEnteredCity?: string;
  planType: 'single-stop' | 'multi-stop';
  priceRange?: string;
  participantPreferences?: string[];
  userSuggestedEventTime?: string;
};

type TripPlanContext = {
  userPrompt: string;
  city: string;
  priceRange: string;
  eventTime?: string;
  preferences?: string[];
};

type ItineraryItemContext = {
  placeName: string;
  address: string;
  city: string;
  mainEventISOStartTime: string;
  planOverallDescription: string;
  participantPreferences?: string[];
  previousItemAddress?: string | null;
  previousItemCity?: string | null;
  previousItemISOEndTime?: string | null;
  isFirstItem: boolean;
};

const THEME_RULES = [
  {
    keywords: ['museum', 'gallery', 'art', 'exhibit', 'culture'],
    eventType: 'Cultural Outing',
    location: 'arts district',
    stops: ['museum', 'gallery', 'cafe'],
    activities: ['Browse the featured exhibits', 'Discuss favorite pieces', 'Visit the gift shop'],
  },
  {
    keywords: ['dinner', 'restaurant', 'food', 'dining', 'cafe', 'brunch', 'lunch'],
    eventType: 'Dining Experience',
    location: 'a well-reviewed local restaurant',
    stops: ['restaurant', 'dessert spot', 'cocktail bar'],
    activities: ['Order a signature dish', 'Share small plates', 'Try a house special'],
  },
  {
    keywords: ['hike', 'trail', 'outdoor', 'park', 'walk', 'nature', 'picnic'],
    eventType: 'Outdoor Adventure',
    location: 'a scenic park or trail',
    stops: ['park', 'scenic overlook', 'casual cafe'],
    activities: ['Take a relaxed walk', 'Enjoy the view', 'Stop for refreshments'],
  },
  {
    keywords: ['music', 'concert', 'live', 'show', 'performance'],
    eventType: 'Live Music Night',
    location: 'a live music venue',
    stops: ['music venue', 'bar', 'late-night bite'],
    activities: ['Catch the opening set', 'Enjoy the main performance', 'Grab a post-show drink'],
  },
  {
    keywords: ['shopping', 'market', 'boutique', 'retail'],
    eventType: 'Shopping Trip',
    location: 'a lively shopping district',
    stops: ['market', 'boutique', 'coffee shop'],
    activities: ['Browse the shops', 'Compare local finds', 'Take a coffee break'],
  },
  {
    keywords: ['wellness', 'spa', 'relax', 'self-care', 'yoga'],
    eventType: 'Wellness Day',
    location: 'a calm wellness studio or spa',
    stops: ['spa', 'tea house', 'quiet lounge'],
    activities: ['Unwind and recharge', 'Try a calming treatment', 'End with a quiet drink'],
  },
];

function normalize(value: string | undefined | null): string {
  return (value || '').trim();
}

function words(value: string | undefined | null): string[] {
  return normalize(value)
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pick<T>(items: T[], seed: string): T {
  return items[hashString(seed) % items.length];
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function detectTheme(text: string): (typeof THEME_RULES)[number] {
  const haystack = words(text);
  return (
    THEME_RULES.find(rule => rule.keywords.some(keyword => haystack.includes(keyword))) ||
    THEME_RULES[0]
  );
}

function summarizePreferences(preferences?: string[]): string {
  if (!preferences || preferences.length === 0) {
    return '';
  }

  const firstThree = preferences.slice(0, 3).join(', ');
  return firstThree.length > 120 ? `${firstThree.slice(0, 117)}...` : firstThree;
}

function buildContextBlob(parts: Array<string | undefined | null>): string {
  return parts.map(normalize).filter(Boolean).join(' ');
}

export function deriveEventType(input: {
  city?: string;
  planName?: string;
  planDescription?: string;
  location?: string;
  userPrompt?: string;
  itinerary?: Array<{placeName: string; description?: string}>;
  friendPreferences?: string[];
}): string {
  const blob = buildContextBlob([
    input.city,
    input.planName,
    input.planDescription,
    input.location,
    input.userPrompt,
    input.itinerary?.map(item => `${item.placeName} ${item.description || ''}`).join(' '),
    input.friendPreferences?.join(' '),
  ]);

  const matchedThemes = THEME_RULES.filter(rule => rule.keywords.some(keyword => words(blob).includes(keyword)));
  if (matchedThemes.length === 0) {
    return 'Social Gathering';
  }

  if (matchedThemes.length === 1) {
    return matchedThemes[0].eventType;
  }

  return `${matchedThemes[0].eventType} & ${matchedThemes[1].eventType}`;
}

export function deriveLocation(input: {
  city?: string;
  eventType?: string;
  userPrompt?: string;
  planDescription?: string;
  planName?: string;
  selectedPoint?: {lat: number; lng: number} | null;
  mapRadiusKm?: number | null;
}): string {
  const city = normalize(input.city) || 'the city';
  const theme = detectTheme(buildContextBlob([input.eventType, input.userPrompt, input.planDescription, input.planName]));

  if (input.selectedPoint) {
    const radius = input.mapRadiusKm ? `${input.mapRadiusKm} km` : 'a short radius';
    return `Within ${radius} of the selected area in ${city}`;
  }

  return `${theme.location} in ${city}`;
}

export function derivePriceRange(input: {
  priceRange?: string;
  eventType?: string;
  location?: string;
  userPrompt?: string;
  friendPreferences?: string[];
}): string {
  if (normalize(input.priceRange)) {
    return input.priceRange!.trim();
  }

  const blob = buildContextBlob([input.eventType, input.location, input.userPrompt, input.friendPreferences?.join(' ')]);
  const theme = detectTheme(blob);

  if (theme.eventType === 'Outdoor Adventure') return 'Free';
  if (theme.eventType === 'Shopping Trip') return 'Budget (0-15 USD)';
  if (theme.eventType === 'Wellness Day') return 'Mid-range (15-40 USD)';
  if (theme.eventType === 'Dining Experience') return 'Mid-range (15-40 USD)';
  return 'Budget (0-15 USD)';
}

export function derivePlanName(input: {
  city?: string;
  eventType?: string;
  planDescription?: string;
  location?: string;
  userPrompt?: string;
  friendPreferences?: string[];
}): string {
  const city = normalize(input.city);
  const theme = deriveEventType(input);
  const lead = city ? `${city} ` : '';

  if (/&/.test(theme)) {
    return `${lead}${theme.replace(/ & /g, ' + ')} Plan`;
  }

  const variation = pick(['Outing', 'Plan', 'Experience', 'Night Out', 'Get-Together'], buildContextBlob([
    input.city,
    input.planDescription,
    input.location,
    input.userPrompt,
    input.friendPreferences?.join(' '),
  ]));
  return `${lead}${theme} ${variation}`.trim();
}

export function deriveDescription(input: {
  city?: string;
  time?: string;
  planName?: string;
  eventType?: string;
  location?: string;
  priceRange?: string;
  planType?: 'single-stop' | 'multi-stop';
  friendPreferences?: string[];
  itinerary?: Array<{placeName: string; description?: string}>;
}): string {
  const city = normalize(input.city) || 'the city';
  const theme = input.eventType || deriveEventType(input);
  const preferences = summarizePreferences(input.friendPreferences);
  const time = normalize(input.time);
  const location = normalize(input.location);
  const priceRange = normalize(input.priceRange);
  const itineraryText = input.itinerary?.length
    ? ` It follows ${input.itinerary.map(item => item.placeName).join(' and ')}.`
    : '';

  const firstSentence = `A ${priceRange ? `${priceRange.toLowerCase()} ` : ''}${theme.toLowerCase()} in ${city}${location ? ` centered on ${location}` : ''}.`;
  const secondSentence = [
    preferences ? `It reflects ${preferences}.` : '',
    time ? `Scheduled around ${time}.` : '',
    input.planType ? `Built as a ${input.planType} plan.` : '',
  ].filter(Boolean).join(' ');

  return `${firstSentence} ${secondSentence}${itineraryText}`.trim();
}

export function deriveEventSuggestions(input: {
  city?: string;
  time?: string;
  friendPreferences?: string[];
  planDescription?: string;
}): string[] {
  const city = normalize(input.city) || 'the area';
  const theme = deriveEventType(input);
  const preferences = summarizePreferences(input.friendPreferences);
  const baseSuggestions = [
    `Start with a ${theme.toLowerCase()} in ${city}.`,
    preferences ? `Lean into the group's preferences: ${preferences}.` : `Keep the pacing relaxed and flexible.`,
    input.time ? `Aim to begin around ${input.time}.` : `Use a start time that keeps the plan easy to follow.`,
  ];

  return baseSuggestions;
}

function venueLabel(theme: string, index: number): string {
  const labels = {
    'Cultural Outing': ['museum', 'gallery', 'cafe'],
    'Dining Experience': ['restaurant', 'dessert stop', 'cocktail bar'],
    'Outdoor Adventure': ['park', 'scenic overlook', 'cafe'],
    'Live Music Night': ['music venue', 'bar', 'late-night bite'],
    'Shopping Trip': ['market', 'boutique', 'coffee shop'],
    'Wellness Day': ['spa', 'tea house', 'quiet lounge'],
    'Social Gathering': ['local venue', 'hangout spot', 'after-dinner stop'],
  } as const;

  const key = (theme as keyof typeof labels) in labels ? (theme as keyof typeof labels) : 'Social Gathering';
  return labels[key][index % labels[key].length];
}

function buildStopName(city: string, theme: string, index: number): string {
  const suffix = venueLabel(theme, index);
  const lead = city ? `${city} ` : '';
  return titleCase(`${lead}${suffix}`);
}

export function deriveTripPlanDraft(input: TripPlanContext): {
  name: string;
  description: string;
  type: string;
  venues: StopDraft[];
} {
  const theme = deriveEventType({
    city: input.city,
    userPrompt: input.userPrompt,
    planDescription: input.preferences?.join(' '),
    friendPreferences: input.preferences,
  });
  const stopCount = theme === 'Social Gathering' ? 2 : 2;
  const venues = Array.from({length: stopCount}, (_, index) => {
    const placeName = buildStopName(input.city, theme, index);
    const activities = [
      `Enjoy the ${venueLabel(theme, index)}`,
      `Share a few highlights with the group`,
      `Capture a couple of memorable moments`,
    ];

    return {
      placeName,
      description: `${titleCase(theme)} stop ${index + 1} in ${input.city}.`,
      activities,
    };
  });

  return {
    name: derivePlanName({city: input.city, userPrompt: input.userPrompt, eventType: theme}),
    description: deriveDescription({
      city: input.city,
      time: input.eventTime,
      eventType: theme,
      priceRange: input.priceRange,
      planType: 'multi-stop',
      friendPreferences: input.preferences,
      itinerary: venues.map(venue => ({placeName: venue.placeName, description: venue.description})),
    }),
    type: theme,
    venues,
  };
}

export function deriveFullPlanDraft(input: FullPlanContext): {
  name: string;
  description: string;
  eventType: string;
  location: string;
  city?: string;
  eventTime?: string;
  priceRange?: string;
  planType: 'single-stop' | 'multi-stop';
  itinerary: Array<{
    placeName: string;
    description: string;
    activitySuggestions: string[];
    suggestedDuration: number;
    suggestedOrder: number;
    status: string;
  }>;
} {
  const city = normalize(input.userEnteredCity) || 'the city';
  const eventType = deriveEventType({
    city: input.userEnteredCity,
    userPrompt: input.userPrompt,
    friendPreferences: input.participantPreferences,
  });
  const planType = input.planType;
  const priceRange = derivePriceRange({
    priceRange: input.priceRange,
    eventType,
    userPrompt: input.userPrompt,
    friendPreferences: input.participantPreferences,
  });
  const name = derivePlanName({
    city: input.userEnteredCity,
    userPrompt: input.userPrompt,
    eventType,
  });
  const location = deriveLocation({
    city: input.userEnteredCity,
    eventType,
    userPrompt: input.userPrompt,
  });
  const stopCount = planType === 'single-stop' ? 1 : 2;
  const theme = detectTheme(buildContextBlob([eventType, input.userPrompt]));
  const itinerary = Array.from({length: stopCount}, (_, index) => {
    const placeName = titleCase(`${city} ${venueLabel(theme.eventType, index)}`);
    return {
      placeName,
      description: `${titleCase(theme.eventType)} stop ${index + 1} designed around ${city}.`,
      activitySuggestions: [
        theme.activities[0],
        theme.activities[1],
        theme.activities[2],
      ],
      suggestedDuration: 60,
      suggestedOrder: index,
      status: 'OPERATIONAL',
    };
  });

  return {
    name,
    description: deriveDescription({
      city: input.userEnteredCity,
      time: input.userSuggestedEventTime,
      eventType,
      location,
      priceRange,
      planType,
      friendPreferences: input.participantPreferences,
      itinerary: itinerary.map(item => ({placeName: item.placeName, description: item.description})),
    }),
    eventType,
    location,
    city: input.userEnteredCity,
    eventTime: input.userSuggestedEventTime,
    priceRange,
    planType,
    itinerary,
  };
}

export function deriveItineraryItemDetails(input: ItineraryItemContext): {
  suggestedDescription: string;
  suggestedISOStartTime: string | null;
  suggestedISOEndTime: string | null;
  suggestedActivitySuggestions: string[];
  isOperational: boolean;
  statusText?: string;
} {
  const placeText = buildContextBlob([input.placeName, input.address, input.city]);
  const lowerPlaceText = placeText.toLowerCase();
  const isClosed = lowerPlaceText.includes('closed') || lowerPlaceText.includes('permanently closed');
  const isTemporarilyClosed = lowerPlaceText.includes('temporarily closed');
  const isOperational = !isClosed && !isTemporarilyClosed;

  const baseStart = parseISO(input.mainEventISOStartTime);
  const fallbackStart = isValid(baseStart) ? baseStart : addHours(new Date(), 1);
  let startTime = fallbackStart;

  if (!input.isFirstItem && input.previousItemISOEndTime) {
    const previousEnd = parseISO(input.previousItemISOEndTime);
    if (isValid(previousEnd)) {
      startTime = addMinutes(previousEnd, estimateTravelMinutes(input.previousItemAddress, input.previousItemCity, input.address, input.city) + 15);
    }
  }

  const endTime = addHours(startTime, 2);
  const theme = detectTheme(placeText);

  return {
    suggestedDescription: isOperational
      ? `Spend time at ${input.placeName} in ${input.city}. ${input.planOverallDescription.slice(0, 140)}`
      : `${input.placeName} is reported as unavailable. Please choose an alternative stop.`,
    suggestedISOStartTime: isOperational ? formatISO(startTime) : null,
    suggestedISOEndTime: isOperational ? formatISO(endTime) : null,
    suggestedActivitySuggestions: isOperational
      ? [
          theme.activities[0],
          theme.activities[1],
          theme.activities[2],
        ]
      : [],
    isOperational,
    statusText: isOperational ? 'Open' : isTemporarilyClosed ? 'Temporarily Closed' : 'Permanently Closed',
  };
}

export function estimateTravelMinutes(
  originAddress?: string | null,
  originCity?: string | null,
  destinationAddress?: string | null,
  destinationCity?: string | null
): number {
  const seed = buildContextBlob([originAddress, originCity, destinationAddress, destinationCity]);
  const buckets = [12, 15, 18, 20, 22, 25, 28, 30];
  return pick(buckets, seed);
}

