import type { Plan, UserPreferences, GeoPoint } from '@/types/user';

// Constants for ranking weights
const WEIGHTS = {
  LOCATION: 0.35,      // 35% weight for location relevance
  POPULARITY: 0.20,    // 20% weight for popularity
  RATING: 0.15,        // 15% weight for ratings
  RECENCY: 0.15,       // 15% weight for recency
  PERSONALIZED: 0.15   // 15% weight for personalization
};

// Calculate distance between two points using Haversine formula
function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Enhanced location scoring with distance-based calculation
export function calculateEnhancedLocationScore(
  planLocation: GeoPoint | null,
  userLocation: GeoPoint | null,
  radius: number = 50 // Default radius in kilometers
): number {
  if (!planLocation || !userLocation) return 0.5;

  const distance = calculateDistance(planLocation, userLocation);
  
  // Exponential decay with distance
  const distanceScore = Math.exp(-distance / radius);
  
  // Boost score for very close locations (within 5km)
  const proximityBoost = distance <= 5 ? 0.2 : 0;
  
  return Math.min(1, distanceScore + proximityBoost);
}

// Calculate trending score based on recent engagement
export function calculateTrendingScore(
  plan: Plan,
  timeWindow: number = 7 // days
): number {
  const now = new Date();
  const windowStart = new Date(now.getTime() - timeWindow * 24 * 60 * 60 * 1000);

  // Count recent engagements
  const recentSaves = (plan.recentSaves || [])
    .filter(date => new Date(date) >= windowStart).length;
  const recentViews = (plan.recentViews || [])
    .filter(date => new Date(date) >= windowStart).length;
  const recentCompletions = (plan.recentCompletions || [])
    .filter(date => new Date(date) >= windowStart).length;

  // Calculate velocity scores
  const saveVelocity = recentSaves / timeWindow;
  const viewVelocity = recentViews / timeWindow;
  const completionVelocity = recentCompletions / timeWindow;

  // Weighted combination of velocities
  return (
    (saveVelocity * 0.4) +
    (viewVelocity * 0.3) +
    (completionVelocity * 0.3)
  ) / 10; // Normalize to 0-1 range
}

// Calculate personalized score based on user preferences and history
export function calculatePersonalizedScore(
  plan: Plan,
  userPreferences: UserPreferences,
  userHistory: {
    categories: Record<string, number>;
    locations: Record<string, number>;
    completedPlanIds: string[];
  }
): number {
  let score = 0;

  // Category preference matching
  if (plan.eventType && userPreferences.preferredCategories) {
    const categoryPreferenceScore = userPreferences.preferredCategories.includes(plan.eventType) ? 0.4 : 0;
    score += categoryPreferenceScore;
  }

  // Location preference matching
  if (plan.city && userPreferences.preferredLocations) {
    const locationPreferenceScore = userPreferences.preferredLocations.includes(plan.city) ? 0.3 : 0;
    score += locationPreferenceScore;
  }

  // Historical engagement
  if (plan.eventType && userHistory.categories[plan.eventType]) {
    const categoryEngagementScore = Math.min(userHistory.categories[plan.eventType] / 10, 0.2);
    score += categoryEngagementScore;
  }

  // Price range preference matching
  if (plan.priceRange && userPreferences.preferredPriceRange) {
    const pricePreferenceScore = plan.priceRange === userPreferences.preferredPriceRange ? 0.1 : 0;
    score += pricePreferenceScore;
  }

  return score;
}

// Enhanced Bayesian rating calculation
export function calculateEnhancedRatingScore(plan: Plan): number {
  const MINIMUM_RATINGS = 5;
  const PRIOR_RATINGS = 3;
  const PRIOR_MEAN = 3.5;
  
  const ratings = plan.ratings || [];
  const verifiedRatings = ratings.filter(r => r.isVerified);
  const regularRatings = ratings.filter(r => !r.isVerified);
  
  // Weight verified ratings more heavily
  const effectiveRatingCount = verifiedRatings.length * 1.5 + regularRatings.length;
  
  if (effectiveRatingCount === 0) return PRIOR_MEAN / 5;
  
  const weightedSum = 
    verifiedRatings.reduce((sum, r) => sum + (r.value * 1.5), 0) +
    regularRatings.reduce((sum, r) => sum + r.value, 0);
  
  const bayesianAverage = (
    (PRIOR_RATINGS * PRIOR_MEAN + weightedSum) /
    (PRIOR_RATINGS + effectiveRatingCount)
  );
  
  // Apply a weight based on number of ratings
  const ratingWeight = Math.min(1, effectiveRatingCount / MINIMUM_RATINGS);
  
  return (bayesianAverage / 5) * ratingWeight;
}

// Calculate recency score based on when the plan was created/completed
function calculateRecencyScore(plan: Plan): number {
  const now = new Date();
  // Use completedAt if available (for completed plans), otherwise use createdAt
  const relevantDate = plan.completedAt ? new Date(plan.completedAt) : new Date(plan.createdAt);
  const ageInDays = (now.getTime() - relevantDate.getTime()) / (1000 * 60 * 60 * 24);
  
  // Exponential decay over time - templates stay relevant longer than events
  const HALF_LIFE_DAYS = 60; // Score halves every 60 days for activity templates
  return Math.exp(-Math.log(2) * ageInDays / HALF_LIFE_DAYS);
}

// Main enhanced ranking function
export function calculateEnhancedPlanScore(
  plan: Plan,
  userLocation: GeoPoint | null,
  userPreferences?: UserPreferences,
  userHistory?: {
    categories: Record<string, number>;
    locations: Record<string, number>;
    completedPlanIds: string[];
  }
): number {
  // Base score for featured plans
  let score = plan.featured ? 1000 : 0;

  // Location score
  const locationScore = calculateEnhancedLocationScore(
    plan.coordinates || null,
    userLocation
  );

  // Trending score (based on recent engagement)
  const trendingScore = calculateTrendingScore(plan);

  // Enhanced rating score
  const ratingScore = calculateEnhancedRatingScore(plan);

  // Recency score (based on when template was created/completed)
  const recencyScore = calculateRecencyScore(plan);

  // Personalization score (if user data available)
  const personalizationScore = userPreferences && userHistory
    ? calculatePersonalizedScore(plan, userPreferences, userHistory)
    : 0.5;

  // Combine all scores with weights
  score += (
    (locationScore * WEIGHTS.LOCATION) +
    (trendingScore * WEIGHTS.POPULARITY) +
    (ratingScore * WEIGHTS.RATING) +
    (recencyScore * WEIGHTS.RECENCY) +
    (personalizationScore * WEIGHTS.PERSONALIZED)
  ) * 100; // Scale up for better differentiation

  return score;
}