import { Plan } from '@/types/user';

// Constants for ranking weights
const WEIGHTS = {
  LOCATION: 0.4,    // 40% weight for location relevance
  POPULARITY: 0.25, // 25% weight for popularity (saves, completions, views)
  RATING: 0.2,      // 20% weight for ratings
  RECENCY: 0.15     // 15% weight for recency
};

// Calculate location relevance score (0-1)
const calculateLocationScore = (planLocation: string, userLocation?: { city: string; country: string }): number => {
  if (!userLocation) return 0.5; // Default score if no user location
  
  const planCity = planLocation.toLowerCase();
  const userCity = userLocation.city.toLowerCase();
  
  if (planCity === userCity) return 1;
  
  // Distance-based scoring if coordinates are available
  if (userLocation.coordinates && plan.coordinates) {
    const distance = calculateDistance(
      userLocation.coordinates.lat,
      userLocation.coordinates.lng,
      plan.coordinates.lat,
      plan.coordinates.lng
    );
    
    // Score based on distance (closer = higher score)
    // 0-10km: 0.9, 10-50km: 0.7, 50-100km: 0.5, 100-200km: 0.3, >200km: 0.1
    if (distance <= 10) return 0.9;
    if (distance <= 50) return 0.7;
    if (distance <= 100) return 0.5;
    if (distance <= 200) return 0.3;
    return 0.1;
  }
  
  return 0.3; // Default score for non-local plans without coordinates
};

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Calculate popularity score (0-1)
const calculatePopularityScore = (plan: Plan): number => {
  const saves = plan.savesCount || 0;
  const completions = plan.completedCount || 0;
  const views = plan.viewCount || 0;
  
  // Calculate velocity (recent increase in engagement)
  const now = new Date();
  const recentDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
  const recentSaves = (plan.recentSaves || [])
    .filter((save: string) => new Date(save) >= recentDate).length;
  const recentCompletions = (plan.recentCompletions || [])
    .filter((completion: string) => new Date(completion) >= recentDate).length;
  
  // Normalize scores
  const MAX_SAVES = 1000;
  const MAX_COMPLETIONS = 500;
  const MAX_VIEWS = 5000;
  const MAX_RECENT = 100;
  
  const savesScore = Math.min(1, saves / MAX_SAVES);
  const completionsScore = Math.min(1, completions / MAX_COMPLETIONS);
  const viewsScore = Math.min(1, views / MAX_VIEWS);
  const velocityScore = Math.min(1, (recentSaves + recentCompletions) / MAX_RECENT);
  
  return (savesScore * 0.3) + (completionsScore * 0.3) + (viewsScore * 0.2) + (velocityScore * 0.2);
};

// Calculate rating score with Bayesian average (0-1)
const calculateRatingScore = (plan: Plan): number => {
  const MINIMUM_RATINGS = 5; // Minimum number of ratings for full weight
  const PRIOR_RATINGS = 3; // Prior count for Bayesian average
  const PRIOR_MEAN = 3.5; // Prior mean rating (out of 5)
  
  const ratings = plan.ratings || [];
  const ratingCount = ratings.length;
  
  if (ratingCount === 0) return PRIOR_MEAN / 5;
  
  const actualMean = ratings.reduce((sum: number, rating: { value: number }) => sum + rating.value, 0) / ratingCount;
  const bayesianAverage = (
    (PRIOR_RATINGS * PRIOR_MEAN + ratingCount * actualMean) /
    (PRIOR_RATINGS + ratingCount)
  );
  
  // Apply a weight based on number of ratings
  const ratingWeight = Math.min(1, ratingCount / MINIMUM_RATINGS);
  
  return (bayesianAverage / 5) * ratingWeight;
};

// Calculate recency score (0-1)
const calculateRecencyScore = (date: Date): number => {
  const now = new Date();
  const ageInDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  
  // Exponential decay over time
  const HALF_LIFE_DAYS = 30; // Score halves every 30 days
  return Math.exp(-Math.log(2) * ageInDays / HALF_LIFE_DAYS);
};

// Calculate the plan's overall rank score
export const calculatePlanScore = (
  plan: Plan,
  userLocation?: { city: string; country: string }
): number => {
  const locationScore = calculateLocationScore(plan.city || '', userLocation);
  const popularityScore = calculatePopularityScore(plan);
  const ratingScore = calculateRatingScore(plan);
  const recencyScore = calculateRecencyScore(new Date(plan.updatedAt || plan.createdAt));

  return (
    (locationScore * WEIGHTS.LOCATION) +
    (popularityScore * WEIGHTS.POPULARITY) +
    (ratingScore * WEIGHTS.RATING) +
    (recencyScore * WEIGHTS.RECENCY)
  );
};

// Calculate group affinity score (0-1)
export const calculateGroupAffinityScore = (
  groupParticipationCount: number,
  totalGroupPlans: number,
  averageRating: number,
  recentParticipationCount: number
): number => {
  const participationRate = groupParticipationCount / Math.max(1, totalGroupPlans);
  const ratingFactor = averageRating / 5; // Normalize rating to 0-1
  const recentActivityFactor = Math.min(1, recentParticipationCount / 10); // Last 10 activities

  return (participationRate * 0.5) + (ratingFactor * 0.3) + (recentActivityFactor * 0.2);
};

// Calculate discount multiplier based on affinity score and premium status
export const calculateDiscountMultiplier = (
  baseDiscount: number,
  affinityScore: number,
  isPremium: boolean,
  premiumTier: number = 1 // 1-3, representing different premium tiers
): number => {
  if (!isPremium) return baseDiscount;
  
  // Premium users get additional multiplier based on affinity score and tier
  const tierMultiplier = 1 + ((premiumTier - 1) * 0.1); // Up to 1.2x for highest tier
  const affinityMultiplier = 1 + (affinityScore * 0.5); // Up to 1.5x for perfect affinity
  
  return baseDiscount * tierMultiplier * affinityMultiplier;
};