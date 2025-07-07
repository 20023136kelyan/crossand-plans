import { findPlacesNearbyTool, exaSearchTool, webSearchTool, fetchPlaceDetailsTool } from '../ai/tools';
import { UserHistoryService } from '@/services/userHistoryService.server';
import { z } from 'zod';

export interface SocialMediaSource {
  name: string;
  url: string;
  type: 'tiktok' | 'instagram' | 'youtube';
  relevance: number;
  lastUpdated?: string;
  followers?: number;
  engagement: {
    views: number;
    likes: number;
    comments: number;
  };
  sentiment?: number;
  topics?: string[];
  location?: string;
  description: string;
  creator: {
    username: string;
    verified: boolean;
    followerCount: number;
  };
}

export interface ExaSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  relevance?: number;
  locationInsights?: string[];
  socialMedia?: SocialMediaSource[];
  contextualInfo?: ExaContextualInfo;
}

export interface ExaSearchResponse {
  success: boolean;
  results: ExaSearchResult[];
  contextualInfo?: ExaContextualInfo;
  error?: string | null;
}

export interface ExaCrowdInsights {
  peakHours: string[];
  quietHours: string[];
  currentLevel?: 'low' | 'moderate' | 'high';
}

export interface ExaContextualInfo {
  searchQuality: number;
  coverage: {
    geographic: boolean;
    temporal: boolean;
    topical: boolean;
    culturalContext: boolean;
    demographicContext: boolean;
    social: boolean;
  };
  crawlStats?: {
    totalPagesFound: number;
    maxDepthReached: number;
    directoryPages: number;
  };
  noResultsReason?: string;
  locationFeedback?: string[];
  alternativeSuggestions?: string[];
  temporal?: {
    timeOfDay?: string;
    typicalCrowdLevel?: string;
    seasonalConsiderations?: string[];
    openingHours?: string[];
  };
  cultural?: {
    localEvents?: string[];
    culturalSignificance?: string;
    traditions?: string[];
    demographicPreferences?: string[];
  };
  crowdInsights?: {
    peakHours?: string[];
    quietTimes?: string[];
    typicalDemographics?: string[];
  };
  weatherConsiderations?: string[];
  specialNotes?: string[];
  social?: {
    platforms: string[];
    trendingTags: string[];
    popularCreators: Array<{ username: string; platform: string; followerCount?: number }>;
    averageEngagement: {
      avgLikes?: number;
      avgViews?: number;
      avgComments?: number;
    };
  };
}

export interface DiscoveredPlace {
  name: string;
  description?: string;
  source: 'exa' | 'googlePlaces' | 'web';
  confidence: number;
  contextualInfo?: ExaContextualInfo;
  url?: string;
  relevance?: number;
  placeId?: string;
  rating?: number | null;
  reviewCount?: number | null;
  priceLevel?: number | null;
  lat?: number;
  lng?: number;
  types?: string[];
  isOperational?: boolean;
  atmosphere?: string[];
  priceHint?: string;
  analysisReasoning?: string[];
}

export interface ExaTemporalContext {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: string;
  season: string;
  isHoliday: boolean;
  typicalCrowdLevel: 'low' | 'moderate' | 'high';
}

export interface ExaCulturalContext {
  localEvents: string[];
  culturalSignificance: string[];
  demographicFit: string[];
  atmosphereNotes: string[];
}

export async function performExaSearch(
  query: string, 
  locationQuery: string, 
  numResults: number,
  centerLat?: number, 
  centerLng?: number, 
  searchRadiusKm?: number
): Promise<ExaSearchResponse> {
  // Detect if this might be a directory-heavy search
  const isDirectorySearch = query.toLowerCase().includes('list') || 
                          query.toLowerCase().includes('guide') ||
                          query.toLowerCase().includes('directory') ||
                          query.toLowerCase().includes('places');

  // Perform two parallel searches - one for social media and one for regular content
  const [socialResponse, regularResponse] = await Promise.all([
    // Social media search
    exaSearchTool({ 
      query: `${query} ${locationQuery}`,
      numResults: Math.ceil(numResults / 2), // Split results between social and regular
      city: locationQuery,
      filters: {
        domains: ['tiktok.com', 'instagram.com', 'youtube.com'],
        recency: '1y', // Limit to content from the last year
        centerLat,
        centerLng,
        searchRadiusKm,
        // Enable crawling for directory-like queries
        crawlDepth: isDirectorySearch ? 2 : 0,
        followLinks: isDirectorySearch
      }
    }),
    // Regular search (blogs, reviews, local sites, etc.)
    exaSearchTool({
      query: `${query} ${locationQuery}`,
      numResults: Math.ceil(numResults / 2),
      city: locationQuery,
      filters: {
        domains: [
          // Review sites
          'yelp.com', 'tripadvisor.com', 'zagat.com', 'infatuation.com',
          // Local guides
          'timeout.com', 'thrillist.com', 'eater.com',
          // Travel content
          'atlasobscura.com', 'localguides.com',
          // Location-based
          'foursquare.com',
          // News and blogs
          'nytimes.com', 'medium.com', 'wordpress.com'
        ],
        recency: '2y', // Allow slightly older content for established places
        centerLat,
        centerLng,
        searchRadiusKm,
        // Enable deeper crawling for directory-like queries
        crawlDepth: isDirectorySearch ? 3 : 0,
        followLinks: isDirectorySearch
      }
    })
  ]);

  // Process and combine results
  const allResults = [];
  
  // Process regular results first
  for (const result of regularResponse.results) {
    allResults.push({
      ...result,
      // If this result has crawled pages, process them
      crawledContent: result.crawledPages?.map((page: any) => ({
        title: page.title,
        url: page.url,
        snippet: page.text || page.snippet || '',
        depth: page.depth,
        locationInsights: extractLocationInsights(page.raw_content || page.text || '', 'Exa Search')
      }))
    });
  }
  
  // Process social media results
  for (const result of socialResponse.results) {
    const socialMedia: SocialMediaSource[] = [];
    
    if (result.url.includes('tiktok.com')) {
      socialMedia.push({
        name: result.title,
        url: result.url,
        type: 'tiktok',
        relevance: result.relevance || 0.5,
        description: result.snippet,
        engagement: extractSocialMediaEngagement(result.snippet),
        creator: extractSocialMediaCreator(result.snippet)
      });
    } else if (result.url.includes('instagram.com')) {
      socialMedia.push({
        name: result.title,
        url: result.url,
        type: 'instagram',
        relevance: result.relevance || 0.5,
        description: result.snippet,
        engagement: extractSocialMediaEngagement(result.snippet),
        creator: extractSocialMediaCreator(result.snippet)
      });
    } else if (result.url.includes('youtube.com')) {
      socialMedia.push({
        name: result.title,
        url: result.url,
        type: 'youtube',
        relevance: result.relevance || 0.5,
        description: result.snippet,
        engagement: extractSocialMediaEngagement(result.snippet),
        creator: extractSocialMediaCreator(result.snippet)
      });
    }

    allResults.push({
      ...result,
      socialMedia,
      // If this result has crawled pages, process them
      crawledContent: result.crawledPages?.map((page: any) => ({
        title: page.title,
        url: page.url,
        snippet: page.text || page.snippet || '',
        depth: page.depth,
        locationInsights: extractLocationInsights(page.raw_content || page.text || '', 'Exa Search')
      }))
    });
  }

  // Calculate combined search quality and coverage
  const searchQuality = Math.max(
    socialResponse.contextualInfo?.searchQuality || 0,
    regularResponse.contextualInfo?.searchQuality || 0
  );

  const coverage = {
    geographic: socialResponse.contextualInfo?.coverage?.geographic || regularResponse.contextualInfo?.coverage?.geographic || false,
    temporal: socialResponse.contextualInfo?.coverage?.temporal || regularResponse.contextualInfo?.coverage?.temporal || false,
    topical: socialResponse.contextualInfo?.coverage?.topical || regularResponse.contextualInfo?.coverage?.topical || false,
    culturalContext: socialResponse.contextualInfo?.coverage?.culturalContext || regularResponse.contextualInfo?.coverage?.culturalContext || false,
    demographicContext: socialResponse.contextualInfo?.coverage?.demographicContext || regularResponse.contextualInfo?.coverage?.demographicContext || false,
    social: true // Always true since we include social search
  };

  // Add crawl statistics to contextual info
  const crawlStats = {
    totalPagesFound: (socialResponse.contextualInfo?.crawlStats?.totalPagesFound || 0) + 
                    (regularResponse.contextualInfo?.crawlStats?.totalPagesFound || 0),
    maxDepthReached: Math.max(
      socialResponse.contextualInfo?.crawlStats?.depthReached || 0,
      regularResponse.contextualInfo?.crawlStats?.depthReached || 0
    ),
    directoryPages: (socialResponse.contextualInfo?.crawlStats?.directoryPages || 0) +
                   (regularResponse.contextualInfo?.crawlStats?.directoryPages || 0)
  };

  return {
    success: socialResponse.success || regularResponse.success,
    results: allResults,
    contextualInfo: {
      searchQuality,
      coverage,
      crawlStats
    },
    error: socialResponse.error || regularResponse.error
  };
}

export async function performWebSearch(query: string, numResults: number): Promise<DiscoveredPlace[]> {
  const response = await webSearchTool({ query, numResults });
  
  // Transform web results into DiscoveredPlace format
  return response.results.map(result => ({
    name: result.title,
    description: result.snippet,
    source: 'web' as const,
    confidence: 0.6,
    url: result.url,
    contextualInfo: {
      searchQuality: 0.6,
      coverage: {
        geographic: false,
        temporal: false,
        topical: true,
        culturalContext: false,
        demographicContext: false,
        social: false
      },
      temporal: undefined,
      cultural: undefined,
      crowdInsights: undefined,
      weatherConsiderations: [],
      specialNotes: [],
      social: undefined
    }
  }));
}

export async function performGooglePlacesSearch(
  queries: { primary: string[]; secondary: string[] },
  centerLat: number,
  centerLng: number,
  searchRadiusKm: number
): Promise<DiscoveredPlace[]> {
  const results: DiscoveredPlace[] = [];
  
  for (const query of [...queries.primary, ...queries.secondary]) {
    const response = await findPlacesNearbyTool({
      centerLat,
      centerLng,
      radiusKm: searchRadiusKm,
      keyword: query
    });
    
    if (response.success && response.places.length > 0) {
      const places = response.places.map(place => ({
        name: place.name,
        description: place.address || undefined, // Convert null to undefined
        source: 'googlePlaces' as const,
        confidence: 0.8,
        url: `https://maps.google.com/?q=${encodeURIComponent(place.name)}`,
        location: {
          lat: place.lat,
          lng: place.lng
        },
        rating: place.rating,
        priceLevel: place.priceLevel,
        types: place.types,
        isOpen: place.isOpen,
        contextualInfo: {
          searchQuality: 0.8,
          coverage: {
            geographic: true,
            temporal: false,
            topical: true,
            culturalContext: false,
            demographicContext: false,
            social: false
          },
          temporal: place.isOpen ? {
            timeOfDay: 'current',
            typicalCrowdLevel: 'unknown',
            openingHours: []
          } : undefined,
          cultural: undefined,
          crowdInsights: undefined,
          weatherConsiderations: [],
          specialNotes: [],
          social: undefined
        }
      }));
      results.push(...places);
    }
  }
  
  return deduplicateResults(results);
}

export function deduplicateResults(results: any[]): any[] {
  const seen = new Set();
  return results.filter(result => {
    const key = result.name?.toLowerCase() || result.title?.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function rankPlacesByPreferences(places: any[], preferences?: any): Promise<any[]> {
  if (!preferences) return places;

  return places.sort((a, b) => {
    const scoreA = calculatePreferenceMatch(a, preferences);
    const scoreB = calculatePreferenceMatch(b, preferences);
    return scoreB - scoreA;
  });
}

function calculatePreferenceMatch(place: any, preferences: any): number {
  if (!preferences) return 50; // Default neutral score
  
  let score = 50; // Start with neutral score
  
  // Dietary restrictions match
  if (preferences.dietaryRestrictions && Array.isArray(preferences.dietaryRestrictions)) {
    for (const restriction of preferences.dietaryRestrictions) {
      if (place.description?.toLowerCase().includes(restriction.toLowerCase())) {
        score += 15;
        break; // Only add the score once even if multiple restrictions match
      }
    }
  }
  
  // Budget match
  if (preferences.budgetRanges && matchesBudget(place, preferences.budgetRanges)) {
    score += 10;
  }
  
  // Atmosphere match
  if (preferences.atmospherePreferences && 
      matchesAtmosphere(place, preferences.atmospherePreferences)) {
    score += 10;
  }
  
  // Accessibility match
  if (preferences.accessibilityNeeds && 
      place.description?.toLowerCase().includes('accessible')) {
    score += 15;
  }
  
  return Math.min(100, score); // Cap at 100
}

function matchesBudget(place: any, budgetRanges: string[]): boolean {
  if (!place.priceLevel || !budgetRanges) return false;
  
  const priceLevelMap: { [key: string]: string[] } = {
    'FREE': ['free'],
    '$': ['budget', 'cheap', 'inexpensive'],
    '$$': ['moderate', 'mid-range'],
    '$$$': ['expensive', 'high-end'],
    '$$$$': ['luxury', 'premium']
  };
  
  const placePriceLevel = place.priceLevel.toString().toUpperCase();
  return budgetRanges.some(range => 
    priceLevelMap[placePriceLevel]?.some(term => 
      range.toLowerCase().includes(term)
    )
  );
}

function matchesAtmosphere(place: any, atmospherePreferences: string[]): boolean {
  if (!place.description || !atmospherePreferences) return false;
  
  const description = place.description.toLowerCase();
  return atmospherePreferences.some(pref => 
    description.includes(pref.toLowerCase())
  );
} 

// Helper functions for social media metadata extraction
function extractDateFromUrl(url: string): string | null {
  // Implementation to extract date from URL patterns
  return null;
}

function extractSocialMediaEngagement(snippet: string): Required<NonNullable<SocialMediaSource['engagement']>> {
  const engagement: Required<NonNullable<SocialMediaSource['engagement']>> = {
    views: 0,
    likes: 0,
    comments: 0
  };
  
  // Extract views
  const viewsMatch = snippet.match(/(\d+(?:,\d+)*)\s*views?/i);
  if (viewsMatch) {
    engagement.views = parseInt(viewsMatch[1].replace(/,/g, ''), 10);
  }

  // Extract likes
  const likesMatch = snippet.match(/(\d+(?:,\d+)*)\s*likes?/i);
  if (likesMatch) {
    engagement.likes = parseInt(likesMatch[1].replace(/,/g, ''), 10);
  }

  // Extract comments
  const commentsMatch = snippet.match(/(\d+(?:,\d+)*)\s*comments?/i);
  if (commentsMatch) {
    engagement.comments = parseInt(commentsMatch[1].replace(/,/g, ''), 10);
  }

  return engagement;
}

function extractSocialMediaCreator(snippet: string): Required<NonNullable<SocialMediaSource['creator']>> {
  const creator: Required<NonNullable<SocialMediaSource['creator']>> = {
    username: 'unknown',
    verified: false,
    followerCount: 0
  };

  // Extract username
  const usernameMatch = snippet.match(/@([a-zA-Z0-9._]+)/);
  if (usernameMatch) {
    creator.username = usernameMatch[1];
  }

  // Extract verification status
  creator.verified = snippet.includes('✓') || snippet.includes('verified');

  // Extract follower count
  const followerMatch = snippet.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*followers?/i);
  if (followerMatch) {
    const followerStr = followerMatch[1];
    let multiplier = 1;
    if (followerStr.endsWith('K')) multiplier = 1000;
    if (followerStr.endsWith('M')) multiplier = 1000000;
    if (followerStr.endsWith('B')) multiplier = 1000000000;
    creator.followerCount = parseFloat(followerStr.replace(/[KMB]/g, '')) * multiplier;
  }

  return creator;
}

function processSocialMediaResult(result: any, type: SocialMediaSource['type']): SocialMediaSource {
  const engagement = extractSocialMediaEngagement(result.snippet || '');
  const creator = extractSocialMediaCreator(result.snippet || '');
  
  return {
    name: result.title || 'Unknown',
    url: result.url,
    type,
    relevance: result.relevance || 0.5,
    description: result.snippet || '',
    engagement,
    creator,
    lastUpdated: extractDateFromUrl(result.url) || undefined
  };
}

// Update the social media extraction
function extractSocialMediaSources(results: any[]): SocialMediaSource[] {
  const socialMedia: SocialMediaSource[] = [];

  for (const result of results) {
    if (!result.url) continue;

    if (result.url.includes('tiktok.com')) {
      socialMedia.push(processSocialMediaResult(result, 'tiktok'));
    } else if (result.url.includes('instagram.com')) {
      socialMedia.push(processSocialMediaResult(result, 'instagram'));
    } else if (result.url.includes('youtube.com')) {
      socialMedia.push(processSocialMediaResult(result, 'youtube'));
    }
  }

  return socialMedia;
}

function calculateSocialScore(result: ExaSearchResult): number {
  if (!result.socialMedia?.[0]) return 0;
  
  const source = result.socialMedia[0];
  const engagement = source.engagement;
  
  let score = result.relevance || 0.5;
  
  // Boost score based on engagement
  if (engagement.views) score += Math.min(engagement.views / 1000000, 0.2); // Max 0.2 boost for 1M+ views
  if (engagement.likes) score += Math.min(engagement.likes / 100000, 0.15); // Max 0.15 boost for 100K+ likes
  if (engagement.comments) score += Math.min(engagement.comments / 10000, 0.1); // Max 0.1 boost for 10K+ comments
  
  // Boost for verified creators
  if (source.creator.verified) score += 0.1;
  
  // Boost for large follower base
  if (source.creator.followerCount) {
    score += Math.min(source.creator.followerCount / 1000000, 0.15); // Max 0.15 boost for 1M+ followers
  }
  
  return Math.min(score, 1.0); // Cap at 1.0
}

function extractTrendingTags(results: ExaSearchResult[]): string[] {
  const tagCounts = new Map<string, number>();
  
  results.forEach(result => {
    const tags = result.snippet.match(/#[\w]+/g) || [];
    tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  
  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);
}

function extractPopularCreators(results: ExaSearchResult[]): Array<{ username: string; platform: string; followerCount?: number }> {
  const creators = results
    .flatMap(result => result.socialMedia || [])
    .map(source => ({
      username: source.creator.username,
      platform: source.type, // Use type instead of platform
      followerCount: source.creator.followerCount
    }));
  
  return [...new Map(creators.map(item => [item.username, item])).values()];
}

// Add prompt generator functions
function generateSearchTermsPrompt({ userPrompt, locationQuery }: { userPrompt: string, locationQuery: string }) {
  const { ai } = require('@/ai/genkit');
  
  return ai.definePrompt({
    name: 'generateSearchTerms',
    input: {
      schema: z.object({
        userPrompt: z.string(),
        locationQuery: z.string(),
      }),
    },
    output: {
      schema: z.object({
        primaryQueries: z.array(z.string()),
        secondaryQueries: z.array(z.string()),
      }),
    },
    prompt: `Generate search terms for discovering places based on user request.
Input: "${userPrompt}" in ${locationQuery}
Output: Primary and secondary search terms for discovering relevant places.`,
  });
}

function enhanceQueriesWithPreferencesPrompt({ location, searchTerms, preferences }: { 
  location: string, 
  searchTerms: { primaryQueries: string[], secondaryQueries: string[] }, 
  preferences: any 
}) {
  const { ai } = require('@/ai/genkit');
  
  return ai.definePrompt({
    name: 'enhanceQueries',
    input: {
      schema: z.object({
        searchTerms: z.object({
          primaryQueries: z.array(z.string()),
          secondaryQueries: z.array(z.string()),
        }),
        preferences: z.any(),
        location: z.string(),
      }),
    },
    output: {
      schema: z.object({
        primaryQueries: z.array(z.string()),
        secondaryQueries: z.array(z.string()),
      }),
    },
    prompt: `Enhance search queries with user preferences.
Search Terms: ${JSON.stringify(searchTerms)}
Preferences: ${JSON.stringify(preferences)}
Location: ${location}
Output: Enhanced primary and secondary queries incorporating preferences.`,
  });
}

function generatePlaceCombinationsPrompt({ places, userPrompt, locationQuery, numStops, participantPreferences }: {
  places: DiscoveredPlace[],
  userPrompt: string,
  locationQuery: string,
  numStops: number,
  participantPreferences: any
}) {
  const { ai } = require('@/ai/genkit');
  
  return ai.definePrompt({
    name: 'generateCombinations',
    input: {
      schema: z.object({
        places: z.array(z.any()),
        userPrompt: z.string(),
        locationQuery: z.string(),
        participantPreferences: z.any(),
        numStops: z.number(),
      }),
    },
    output: {
      schema: z.object({
        combinations: z.array(z.object({
          places: z.array(z.any()),
          combinationScore: z.number(),
          reasoning: z.string(),
          suggestedOrder: z.array(z.number()),
          transitModes: z.array(z.string()),
          estimatedDurations: z.array(z.number()),
        })),
      }),
    },
    prompt: `Generate optimal combinations of places for a multi-stop plan.
Places: ${JSON.stringify(places)}
User Request: "${userPrompt}"
Location: ${locationQuery}
Preferences: ${JSON.stringify(participantPreferences)}
Number of Stops: ${numStops}
Output: Combinations of places with scores and details.`,
  });
}

function calculateAverageEngagement(results: ExaSearchResult[]): { 
  avgLikes?: number; 
  avgViews?: number; 
  avgComments?: number 
} {
  const totals = results.reduce((acc, r) => {
    const engagement = r.socialMedia?.[0]?.engagement;
    if (engagement) {
      if (engagement.likes) acc.likes.push(engagement.likes);
      if (engagement.views) acc.views.push(engagement.views);
      if (engagement.comments) acc.comments.push(engagement.comments);
    }
    return acc;
  }, { likes: [] as number[], views: [] as number[], comments: [] as number[] });
  
  return {
    avgLikes: totals.likes.length ? Math.round(totals.likes.reduce((a, b) => a + b, 0) / totals.likes.length) : undefined,
    avgViews: totals.views.length ? Math.round(totals.views.reduce((a, b) => a + b, 0) / totals.views.length) : undefined,
    avgComments: totals.comments.length ? Math.round(totals.comments.reduce((a, b) => a + b, 0) / totals.comments.length) : undefined
  };
} 

interface PlaceDiscoveryReasoning {
  placeName: string;
  reasons: string[];
  matchScore: number;
  preferenceMatches: {
    category: string;
    match: string;
    weight: number;
  }[];
  concerns: string[];
  diversityScore?: number; // Add diversity score field
}

interface PlaceDiscoveryOptions {
  userId?: string;
  enforceUniqueness?: boolean;
  diversityWeight?: number; // 0-1, how much to prioritize new experiences
}

export async function performMultiPhaseDiscovery(
  queries: { primary: string[]; secondary: string[] }, 
  locationQuery: string, 
  centerLat?: number, 
  centerLng?: number, 
  searchRadiusKm?: number,
  preferences?: any,
  options: PlaceDiscoveryOptions = {}
): Promise<{
  places: DiscoveredPlace[];
  reasoning: PlaceDiscoveryReasoning[];
}> {
  const {
    userId,
    enforceUniqueness = true,
    diversityWeight = 0.3 // 30% weight for diversity by default
  } = options;

  console.log('[performMultiPhaseDiscovery] Starting discovery with:', {
    queries,
    locationQuery,
    centerLat,
    centerLng,
    searchRadiusKm,
    userId,
    enforceUniqueness,
    diversityWeight
  });

  const allPlaces: DiscoveredPlace[] = [];
  const allReasonings: PlaceDiscoveryReasoning[] = [];

  // Phase 1: Exa Search
  const exaResults = await performExaSearch(
    queries.primary.join(' OR '), 
    locationQuery, 
    10,
    centerLat,
    centerLng,
    searchRadiusKm
  );

  // Phase 2: Google Places Search (if needed)
  let googleResults: any[] = [];
  if (centerLat && centerLng && searchRadiusKm) {
    googleResults = await performGooglePlacesSearch(
      queries,
      centerLat,
      centerLng,
      searchRadiusKm
    );
  }

  // Phase 3: Web Search (if needed)
  let webResults: any[] = [];
  if (determineWebSearchStrategy(exaResults.contextualInfo, exaResults.results)) {
    webResults = await performWebSearch(queries.primary.join(' OR '), 5);
  }

  // Combine and deduplicate results
  let allResults = [
    ...exaResults.results.map(r => ({ ...r, source: 'exa' })),
    ...googleResults.map(r => ({ ...r, source: 'googlePlaces' })),
    ...webResults.map(r => ({ ...r, source: 'web' }))
  ];

  // Deduplicate
  allResults = deduplicateResults(allResults);

  // Enrich with Google Places details if we have coordinates
  if (centerLat && centerLng) {
    allResults = await enrichPlacesWithGoogleDetails(allResults, centerLat, centerLng);
  }

  // Rank by preferences if provided
  if (preferences) {
    allResults = await rankPlacesByPreferences(allResults, preferences);
  }

  // Add reasoning for each place
  allResults.forEach(place => {
    const reasoning: PlaceDiscoveryReasoning = {
      placeName: place.name,
      reasons: [],
      matchScore: calculatePreferenceMatch(place, preferences),
      preferenceMatches: [],
      concerns: []
    };

    if (preferences?.dietaryRestrictions && Array.isArray(preferences.dietaryRestrictions)) {
      for (const restriction of preferences.dietaryRestrictions) {
        if (place.description?.toLowerCase().includes(restriction.toLowerCase())) {
          reasoning.reasons.push('Matched dietary restriction preference.');
          reasoning.preferenceMatches.push({ category: 'dietaryRestrictions', match: place.description, weight: 0.2 });
          break;
        }
      }
    }
    if (place.description?.toLowerCase().includes('accessible')) {
      reasoning.reasons.push('Matched accessibility preference.');
      reasoning.preferenceMatches.push({ category: 'accessibility', match: place.description, weight: 0.2 });
    }
    if (preferences?.budgetRanges && matchesBudget(place, preferences.budgetRanges)) {
      reasoning.reasons.push('Matched budget preference.');
      reasoning.preferenceMatches.push({ category: 'budgetRanges', match: place.priceLevel, weight: 0.15 });
    }
    if (preferences?.atmospherePreferences && matchesAtmosphere(place, preferences.atmospherePreferences)) {
      reasoning.reasons.push('Matched atmosphere preference.');
      reasoning.preferenceMatches.push({ category: 'atmospherePreferences', match: place.description, weight: 0.15 });
    }

    if (place.relevance === 0) {
      reasoning.concerns.push('Low relevance score.');
    }
    if (!place.description) {
      reasoning.concerns.push('No description available.');
    }
    if (!place.location) {
      reasoning.concerns.push('No location information.');
    }

    allReasonings.push(reasoning);
  });

  // After gathering results but before returning:
  if (userId && enforceUniqueness) {
    console.log('[performMultiPhaseDiscovery] Applying diversity scoring for user:', userId);
    
    // Get diversity scores for each place
    const diversityScores = await Promise.all(
      allResults.map(async place => {
        const placeDiversity = await UserHistoryService.getPlaceDiversityScore(
          userId,
          place.googlePlaceId
        );
        const categoryDiversity = await UserHistoryService.getCategoryDiversityScore(
          userId,
          place.types || []
        );
        
        // Combine scores (60% place-specific, 40% category)
        return (placeDiversity * 0.6) + (categoryDiversity * 0.4);
      })
    );

    // Adjust relevance scores with diversity
    allResults = allResults.map((place, index) => ({
      ...place,
      relevance: place.relevance * (1 - diversityWeight) + 
                 (diversityScores[index] * diversityWeight)
    }));

    // Sort by adjusted scores
    allResults.sort((a, b) => b.relevance - a.relevance);

    // Update reasoning with diversity information
    allResults.forEach((place, index) => {
      allReasonings[index].diversityScore = diversityScores[index];
      allReasonings[index].reasons.push(
        `Diversity score: ${(diversityScores[index] * 100).toFixed(1)}% - ${
          diversityScores[index] > 0.8 ? 'Fresh experience for this user' :
          diversityScores[index] > 0.5 ? 'Moderately familiar to user' :
          'Frequently visited by user'
        }`
      );
    });
  }

  console.log('[performMultiPhaseDiscovery] Discovery complete. Found places:', allResults.length);
  if (userId) {
    console.log('[performMultiPhaseDiscovery] Applied diversity scoring:', 
      allResults.map(p => ({
        name: p.name,
        relevance: p.relevance,
        types: p.types
      }))
    );
  }

  return {
    places: allResults,
    reasoning: allReasonings
  };
} 

// Helper functions
function determineWebSearchStrategy(contextualInfo: any, exaResults: any[]): boolean {
  // If Exa search quality is low or coverage is poor, use web search
  if (!contextualInfo || contextualInfo.searchQuality < 0.5) {
    return true;
  }

  // If we have few results, try web search
  if (!exaResults || exaResults.length < 3) {
    return true;
  }

  // If geographic coverage is poor, try web search
  if (!contextualInfo.coverage?.geographic) {
    return true;
  }

  return false;
}

function extractPlaceNameFromResult(result: any): string | null {
  // Try to extract place name from various result formats
  if (result.name) return result.name;
  if (result.title) return result.title;
  
  // Try to extract from snippet or text
  const text = result.snippet || result.text || '';
  const nameMatch = text.match(/^([^,.:]+)/);
  if (nameMatch) return nameMatch[1].trim();
  
  return null;
}

async function enrichPlacesWithGoogleDetails(places: any[], centerLat: number, centerLng: number): Promise<any[]> {
  const enrichedPlaces = [];
  
  for (const place of places) {
    try {
      // Extract place name
      const placeName = place.name || place.title || extractPlaceNameFromResult(place);
      if (!placeName) continue;

      // Get details using the fetchPlaceDetails tool
      const details = await fetchPlaceDetailsTool({
        placeNameOrId: placeName,
        locationHint: { lat: centerLat, lng: centerLng },
        searchRadiusKm: 50, // Default to 50km radius
        fields: [
          'place_id',
          'name',
          'formatted_address',
          'address_components',
          'geometry',
          'photos',
          'rating',
          'user_ratings_total',
          'opening_hours',
          'international_phone_number',
          'website',
          'price_level',
          'types',
          'business_status'
        ]
      });

      if (details.success) {
        enrichedPlaces.push({
          ...place,
          ...details,
          // Preserve original source and relevance
          source: place.source,
          relevance: place.relevance
        });
      } else {
        enrichedPlaces.push(place);
      }
    } catch (error) {
      console.error(`[enrichPlacesWithGoogleDetails] Error enriching place ${place.name}:`, error);
      enrichedPlaces.push(place);
    }
  }

  return enrichedPlaces;
} 

function isValidPlaceResult(result: ExaSearchResult): boolean {
  // Basic validation - just ensure we have some content to work with
  return (
    result !== null &&
    typeof result === 'object' &&
    (
      (typeof result.title === 'string' && result.title.length > 0) ||
      (typeof result.snippet === 'string' && result.snippet.length > 0)
    )
  );
}

async function analyzePlaceFromExaResult(result: ExaSearchResult): Promise<{
  name: string | null;
  confidence: number;
  description?: string;
  type?: string[];
  priceHint?: string;
  atmosphere?: string[];
  operationalStatus?: boolean;
  reasoning: string[];
  places?: Array<{
    name: string;
    description?: string;
    url?: string;
    confidence: number;
  }>;
}> {
  const { ai, modelConfigs } = require('@/ai/genkit');

  // Analyze as a potential place
  const placePrompt = `Analyze this search result and identify if it contains information about any places.

SEARCH RESULT:
Title: "${result.title}"
Content: "${result.snippet}"
URL: ${result.url}
${result.locationInsights ? `Location Context: ${result.locationInsights.join(', ')}` : ''}

INSTRUCTIONS:
1. You have complete freedom to identify places in any way you see fit
2. Use your knowledge and internet access to validate and enrich place information
3. Consider both explicit and implicit place references
4. Look for contextual clues that indicate real locations
5. You can identify multiple places if they are meaningfully connected
6. Consider historical, cultural, and local context
7. Use your judgment to assess if something is a real place

Return as JSON:
{
  "name": "Identified place name or null if not a place",
  "confidence": 0.0-1.0,
  "description": "Brief, clean description",
  "type": ["primary type", "secondary type"],
  "priceHint": "budget/moderate/expensive",
  "atmosphere": ["descriptive words"],
  "operationalStatus": true/false,
  "reasoning": [
    "Why you believe this is a real place",
    "What confirms the name",
    "Any additional context or insights"
  ],
  "places": [
    {
      "name": "Related place name",
      "description": "Brief description",
      "url": "Direct URL if available",
      "confidence": 0.0-1.0
    }
  ]
}`;

  try {
    const analysis = await ai.generate({
      model: 'googleai/gemini-2.5-pro',
      prompt: placePrompt,
      config: {
        ...modelConfigs.analysis,
        temperature: 0.3
      }
    });

    if (!analysis.text) {
      throw new Error('No analysis generated');
    }

    const cleaned = analysis.text.replace(/```json\\n?|\\n?```/g, '');
    const parsed = JSON.parse(cleaned);

    return parsed;
  } catch (error) {
    console.error('[analyzePlaceFromExaResult] Error analyzing result:', error);
    return {
      name: null,
      confidence: 0.1,
      reasoning: ['Failed to perform analysis']
    };
  }
}

async function enrichPlacesWithLLMAnalysis(results: ExaSearchResult[]): Promise<DiscoveredPlace[]> {
  const enrichedPlaces: DiscoveredPlace[] = [];
  
  for (const result of results) {
    try {
      const analysis = await analyzePlaceFromExaResult(result);
      
      // Handle both single places and multiple places from the analysis
      if (analysis.name && typeof analysis.name === 'string') {
        enrichedPlaces.push({
          name: analysis.name,
          description: analysis.description || '',
          source: 'exa',
          confidence: analysis.confidence,
          contextualInfo: result.contextualInfo,
          url: result.url,
          relevance: result.relevance,
          types: analysis.type || [],
          isOperational: analysis.operationalStatus,
          atmosphere: analysis.atmosphere,
          priceHint: analysis.priceHint,
          analysisReasoning: analysis.reasoning
        });
      }
      
      // Add any additional places found in the analysis
      if (analysis.places && Array.isArray(analysis.places)) {
        for (const place of analysis.places) {
          if (place.name && typeof place.name === 'string') {
            enrichedPlaces.push({
              name: place.name,
              description: place.description || '',
              source: 'exa',
              confidence: place.confidence || analysis.confidence,
              contextualInfo: result.contextualInfo,
              url: place.url || result.url,
              relevance: result.relevance,
              analysisReasoning: ['Additional place identified through analysis']
            });
          }
        }
      }
    } catch (error) {
      console.error('[enrichPlacesWithLLMAnalysis] Error enriching result:', error);
    }
  }
  
  return enrichedPlaces;
}

interface Place {
  id: string;
  name: string;
  description?: string;
  source: string;
  confidence: number;
  contextualInfo?: ExaContextualInfo;
  url?: string;
  relevance?: number;
  [key: string]: any;
}

interface RankedPlace extends Place {
  score: number;
  scores: {
    relevance: number;
    diversity: number;
    freshness: number;
  };
}

interface PlaceRankingContext {
  preferences?: any;
  userId?: string;
  enforceUniqueness?: boolean;
  diversityWeight?: number;
}

export async function rankPlacesForUser(
  userId: string,
  places: Place[],
  context: PlaceRankingContext
): Promise<RankedPlace[]> {
  try {
    const rankedPlaces = await Promise.all(places.map(async place => {
      // Get base relevance score
      const relevanceScore = calculateRelevanceScore(place, context);
      
      // Get diversity score to avoid repeating categories
      const diversityScore = await UserHistoryService.getPlaceDiversityScore(userId, place.id);
      
      // Get suggestion fatigue score
      const fatigueScore = await UserHistoryService.getSuggestionFatigueScore(userId, place.id);

      // Combine scores with weights
      const finalScore = (
        relevanceScore * 0.5 +     // 50% base relevance
        diversityScore * 0.3 +     // 30% diversity
        fatigueScore * 0.2         // 20% freshness (inverse of fatigue)
      );

      return {
        ...place,
        score: finalScore,
        scores: {
          relevance: relevanceScore,
          diversity: diversityScore,
          freshness: fatigueScore
        }
      };
    }));

    // Sort by final score
    return rankedPlaces.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error('[rankPlacesForUser] Error ranking places:', error);
    return places.map(p => ({ ...p, score: 0, scores: { relevance: 0, diversity: 0, freshness: 0 } }));
  }
}

function calculateRelevanceScore(place: Place, context: PlaceRankingContext): number {
  let score = 0;

  // Base relevance from place data
  if (place.relevance) {
    score += place.relevance * 0.5; // 50% weight from direct relevance
  }

  // Rating contribution
  if (place.rating) {
    score += (place.rating / 5) * 0.2; // 20% weight from rating
  }

  // Review count contribution (normalized to 0-1)
  if (place.reviewCount) {
    const normalizedReviews = Math.min(place.reviewCount / 1000, 1);
    score += normalizedReviews * 0.1; // 10% weight from review count
  }

  // Preference matching
  if (context.preferences && Object.keys(context.preferences).length > 0) {
    const preferenceScore = calculatePreferenceMatch(place, context.preferences);
    score += preferenceScore * 0.2; // 20% weight from preferences
  }

  return score;
}

// Track that we suggested these places to the user
export async function trackSuggestedPlaces(userId: string, places: Place[]): Promise<void> {
  try {
    await UserHistoryService.trackSuggestedPlaces(userId, places.map(place => ({
      placeId: place.id,
      placeName: place.name,
      categories: place.types || []
    })));
  } catch (error) {
    console.error('[trackSuggestedPlaces] Failed to track suggested places:', error);
  }
}

// Mark a place as chosen by the user
export async function markPlaceAsChosen(userId: string, placeId: string): Promise<void> {
  try {
    await UserHistoryService.markPlaceAsChosen(userId, placeId);
  } catch (error) {
    console.error('[markPlaceAsChosen] Failed to mark place as chosen:', error);
  }
} 

export async function generateLLMSearchTerms(userPrompt: string, locationQuery: string): Promise<{ primaryQueries: string[], secondaryQueries: string[] }> {
  const { ai, modelConfigs } = require('@/ai/genkit');
  
  const prompt = `Generate search terms for discovering places based on user request.
Input: "${userPrompt}" in ${locationQuery}
Output: Primary and secondary search terms for discovering relevant places.

Return as JSON object:
{
  "primaryQueries": ["query1", "query2", ...],
  "secondaryQueries": ["query1", "query2", ...]
}`;

  const result = await ai.generate({
    model: 'googleai/gemini-2.5-pro',
    prompt,
    config: modelConfigs.analysis
  });

  if (result.text) {
    const cleaned = result.text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  }
  return { primaryQueries: [], secondaryQueries: [] };
}

export async function generatePreferenceEnhancedQueriesWithLLM(
  searchTerms: { primaryQueries: string[], secondaryQueries: string[] },
  preferences: any,
  location: string
): Promise<{ primaryQueries: string[], secondaryQueries: string[] }> {
  const { ai, modelConfigs } = require('@/ai/genkit');
  
  const prompt = `Enhance search queries with user preferences.
Search Terms: ${JSON.stringify(searchTerms)}
Preferences: ${JSON.stringify(preferences)}
Location: ${location}

Return as JSON object:
{
  "primaryQueries": ["query1", "query2", ...],
  "secondaryQueries": ["query1", "query2", ...]
}`;

  const result = await ai.generate({
    model: 'googleai/gemini-2.5-pro',
    prompt,
    config: modelConfigs.analysis
  });

  if (result.text) {
    const cleaned = result.text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  }
  return { primaryQueries: [], secondaryQueries: [] };
}

export async function generatePlaceCombinations(
  places: DiscoveredPlace[],
  userPrompt: string,
  locationQuery: string,
  participantPreferences: any,
  numStops: number
): Promise<PlaceCombination[]> {
  const { ai, modelConfigs } = require('@/ai/genkit');
  
  const prompt = `Generate optimal combinations of places for a multi-stop plan.
Places: ${JSON.stringify(places)}
User Request: "${userPrompt}"
Location: ${locationQuery}
Preferences: ${JSON.stringify(participantPreferences)}
Number of Stops: ${numStops}

Return as JSON object:
{
  "combinations": [
    {
      "places": [...],
      "combinationScore": number,
      "reasoning": "string",
      "suggestedOrder": [numbers],
      "transitModes": ["string"],
      "estimatedDurations": [numbers]
    }
  ]
}`;

  const result = await ai.generate({
    model: 'googleai/gemini-2.5-pro',
    prompt,
    config: modelConfigs.analysis
  });

  if (result.text) {
    const cleaned = result.text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed.combinations || [];
  }
  return [];
}

export interface PlaceCombination {
  places: DiscoveredPlace[];
  combinationScore: number;
  reasoning: string;
  suggestedOrder: number[];
  transitModes: string[];
  estimatedDurations: number[];
} 

function calculateSocialMediaScore(source: SocialMediaSource): number {
  const score = {
    engagement: (source.engagement.views + source.engagement.likes * 2 + source.engagement.comments * 3) / 1000,
    creator: source.creator.followerCount > 10000 ? 0.3 : 0.1,
    verified: source.creator.verified ? 0.2 : 0,
    recency: source.lastUpdated ? calculateRecencyScore(source.lastUpdated) : 0
  };

  return Math.min(1, score.engagement + score.creator + score.verified + score.recency);
}

function calculateRecencyScore(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysDiff < 7) return 0.5;
  if (daysDiff < 30) return 0.3;
  if (daysDiff < 90) return 0.2;
  return 0.1;
} 

function extractLocationInsights(text: string, source: string): string[] {
  const insights: string[] = [];
  
  // Extract location-related information from text
  const locationPatterns = [
    /located (in|at|near) ([^,.]+)/i,
    /situated (in|at|near) ([^,.]+)/i,
    /found (in|at|near) ([^,.]+)/i,
    /based (in|at|near) ([^,.]+)/i
  ];

  locationPatterns.forEach(pattern => {
    const match = text.match(pattern);
    if (match && match[2]) {
      insights.push(`Location: ${match[2].trim()}`);
    }
  });

  return insights;
} 