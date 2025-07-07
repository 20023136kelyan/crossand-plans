import { addMinutes, formatISO, parseISO, isValid } from 'date-fns';
import type { Plan, ItineraryItem, TransitMode, UserProfile } from '@/types/user';

/**
 * Enhanced plan processing utilities
 * These utilities enhance AI-generated plans with proper validation and formatting
 */

export interface ProcessedPlanData {
  plan: Plan;
  validationErrors: string[];
  warnings: string[];
}

/**
 * Calculate distance between two coordinates in kilometers
 */
export function calculateDistance(
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Ensure all date-time strings have proper timezone information
 */
function ensureProperDateTimeFormat(plan: Plan): Plan {
  // Create a deep copy to avoid mutating the input
  const updatedPlan = JSON.parse(JSON.stringify(plan));
  
  // Fix eventTime on plan level
  if (updatedPlan.eventTime && !updatedPlan.eventTime.includes('Z') && 
      !updatedPlan.eventTime.includes('+') && !updatedPlan.eventTime.includes('-', 10)) {
    // If date has no timezone info, add it by parsing and reformatting
    updatedPlan.eventTime = formatISO(new Date(updatedPlan.eventTime));
  }

  // Fix all date-time strings in itinerary items
  if (updatedPlan.itinerary && Array.isArray(updatedPlan.itinerary)) {
    updatedPlan.itinerary = updatedPlan.itinerary.map((item: any) => {
      // Process startTime
      if (item.startTime && typeof item.startTime === 'string' && 
          !item.startTime.includes('Z') && !item.startTime.includes('+') && 
          !item.startTime.includes('-', 10)) {
        item.startTime = formatISO(new Date(item.startTime));
      }
      
      // Process endTime
      if (item.endTime && typeof item.endTime === 'string' && 
          !item.endTime.includes('Z') && !item.endTime.includes('+') && 
          !item.endTime.includes('-', 10)) {
        item.endTime = formatISO(new Date(item.endTime));
      }
      
      return item;
    });
  }
  
  return updatedPlan;
}

/**
 * Process and enhance a plan with proper date/time handling
 */
export function processPlanDateTime(plan: Plan, originalDateTime: string): ProcessedPlanData {
  const errors: string[] = [];
  const warnings: string[] = [];
  const processedPlan = ensureProperDateTimeFormat({ ...plan });

  try {
    let eventTime = parseISO(originalDateTime);
    if (!isValid(eventTime)) {
      errors.push('Invalid plan date/time format. Using current time as fallback.');
      eventTime = new Date(); // Fallback to current time
    }



    processedPlan.eventTime = formatISO(eventTime);

    // Process itinerary items sequentially
    if (processedPlan.itinerary && processedPlan.itinerary.length > 0) {
      let cumulativeTime = eventTime;
      processedPlan.itinerary = processedPlan.itinerary.map((item) => {
        const processedItem = { ...item };
        
        // Set start time based on the end of the previous event.
        processedItem.startTime = formatISO(cumulativeTime);
        
        const duration = processedItem.durationMinutes || 60;
        const endTime = addMinutes(cumulativeTime, duration);
        processedItem.endTime = formatISO(endTime);

        // The next item starts after this one ends, plus any transit time.
        const transitTime = processedItem.transitTimeFromPreviousMinutes || 0;
        cumulativeTime = addMinutes(endTime, transitTime);

        return processedItem;
      });
    }

    return { plan: processedPlan, validationErrors: errors, warnings };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Date/time processing error: ${errorMessage}`);
    return { plan: processedPlan, validationErrors: errors, warnings };
  }
}

/**
 * Validate and enhance location data with geocoding
 */
export function processPlanLocation(plan: Plan): ProcessedPlanData {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Extract city from first itinerary item or location query
    if (plan.itinerary && plan.itinerary.length > 0) {
      const firstItem = plan.itinerary[0];
      if (firstItem.city) {
        plan.city = firstItem.city;
      } else if (firstItem.address) {
        const cityMatch = firstItem.address.match(/, ([^,]+),?$/);
        if (cityMatch) {
          plan.city = cityMatch[1].trim();
        }
      }
    }

    // Set location from first itinerary item
    if (plan.itinerary && plan.itinerary.length > 0) {
      const firstItem = plan.itinerary[0];
      if (firstItem.placeName && !plan.location) {
        plan.location = firstItem.placeName;
      }
    }

    // Validate coordinates and warn on long distances, but do not estimate time.
    if (plan.itinerary && plan.itinerary.length > 1) {
      for (let i = 1; i < plan.itinerary.length; i++) {
        const prevItem = plan.itinerary[i - 1];
        const currentItem = plan.itinerary[i];
        
        if (prevItem.lat && prevItem.lng && currentItem.lat && currentItem.lng) {
          const distance = calculateDistance(
            prevItem.lat, prevItem.lng, 
            currentItem.lat, currentItem.lng
          );
          
          if (distance > 50) { // Warn on very long distances
            warnings.push(`Long distance between stops ${i} and ${i + 1}: ${distance.toFixed(1)}km`);
          }
        }
      }
    }

    // Validate required location fields
    if (!plan.city) {
      warnings.push('City information is missing');
    }
    if (!plan.location) {
      warnings.push('Location information is missing');
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Location processing error: ${errorMessage}`);
  }

  return { plan, validationErrors: errors, warnings };
}

/**
 * Calculate transit details using Google Directions API
 */
export async function calculateTransitDetails(plan: Plan, userProfile?: UserProfile): Promise<ProcessedPlanData> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const processedPlan = { ...plan };

  if (!processedPlan.itinerary || processedPlan.itinerary.length <= 1) {
    return { plan: processedPlan, validationErrors: errors, warnings };
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    warnings.push('Google Maps API key is missing. Real-time transit calculation is disabled.');
    return { plan: processedPlan, validationErrors: errors, warnings };
  }

  for (let i = 1; i < processedPlan.itinerary.length; i++) {
    const originItem = processedPlan.itinerary[i - 1];
    const destinationItem = processedPlan.itinerary[i];

    if (!originItem.lat || !originItem.lng || !destinationItem.lat || !destinationItem.lng) {
      warnings.push(`Missing coordinates for transit between stops ${i} and ${i + 1}.`);
      continue;
    }

    const origin = `${originItem.lat},${originItem.lng}`;
    const destination = `${destinationItem.lat},${destinationItem.lng}`;
    const modes: TransitMode[] = ['walking', 'driving', 'transit'];
    
    try {
      const requests = modes.map(mode =>
        fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${mode}&key=${apiKey}`)
          .then(res => res.json())
      );
      
      const results = await Promise.all(requests);
      const durations: { mode: TransitMode; duration: number }[] = [];

      results.forEach((result, index) => {
        if (result.status === 'OK' && result.routes[0]?.legs[0]?.duration) {
          durations.push({
            mode: modes[index],
            duration: result.routes[0].legs[0].duration.value / 60, // minutes
          });
        }
      });

      if (durations.length === 0) {
        warnings.push(`Could not fetch any transit times between stop ${i} and ${i + 1}.`);
        continue;
      }

      // Smart selection logic
      const walkingDuration = durations.find(d => d.mode === 'walking')?.duration;
      const userPreferredModes = userProfile?.preferredTransitModes || [];

      // 1. Always prefer walking if it's a short distance.
      if (walkingDuration && walkingDuration <= 20) {
        destinationItem.transitMode = 'walking';
        destinationItem.transitTimeFromPreviousMinutes = Math.round(walkingDuration);
        continue;
      }

      // 2. Check if any of the user's preferred modes are available.
      const preferredAvailableDurations = durations.filter(d => userPreferredModes.includes(d.mode));
      if (preferredAvailableDurations.length > 0) {
        const fastestPreferred = preferredAvailableDurations.sort((a, b) => a.duration - b.duration)[0];
        destinationItem.transitMode = fastestPreferred.mode;
        destinationItem.transitTimeFromPreviousMinutes = Math.round(fastestPreferred.duration);
        continue;
      }

      // 3. Fallback: if no preferences are set or available, choose the fastest overall.
      const fastestOverall = durations.sort((a, b) => a.duration - b.duration)[0];
      destinationItem.transitMode = fastestOverall.mode;
      destinationItem.transitTimeFromPreviousMinutes = Math.round(fastestOverall.duration);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      warnings.push(`API error calculating transit for stop ${i + 1}: ${errorMessage}`);
    }
  }

  return { plan: processedPlan, validationErrors: errors, warnings };
}

/**
 * Calculate dynamic, context-aware durations for itinerary items.
 */
export function calculateDynamicDurations(plan: Plan, userPrompt: string): ProcessedPlanData {
  const errors: string[] = [];
  const warnings: string[] = [];
  const processedPlan = { ...plan };

  if (!processedPlan.itinerary) {
    return { plan: processedPlan, validationErrors: errors, warnings };
  }

  const prompt = userPrompt.toLowerCase();
  // Duration modifier keywords
  const quickKeywords = ['quick', 'brief', 'short', 'stop by', 'pit stop'];
  const longKeywords = ['leisurely', 'relax', 'all day', 'full day', 'spend time', 'explore'];

  let durationMultiplier = 1.0;
  if (quickKeywords.some(kw => prompt.includes(kw))) durationMultiplier = 0.6;
  if (longKeywords.some(kw => prompt.includes(kw))) durationMultiplier = 1.5;

  processedPlan.itinerary.forEach(item => {
    // Only override if the AI hasn't provided a duration.
    if (item.durationMinutes === null || item.durationMinutes === undefined) {
      let baseDuration = 90; // Default duration

      const types = item.types || [];
      if (types.includes('museum') || types.includes('tourist_attraction') || types.includes('park')) {
        baseDuration = 120;
      } else if (types.includes('restaurant') || types.includes('bar')) {
        baseDuration = 90;
      } else if (types.includes('cafe') || types.includes('bakery')) {
        baseDuration = 60;
      } else if (types.includes('store') || types.includes('shopping_mall')) {
        baseDuration = 75;
      } else if (types.includes('point_of_interest') || types.includes('establishment')) {
        baseDuration = 45; // Generic fallback
      }

      let finalDuration = baseDuration * durationMultiplier;

      // Clamp duration to a reasonable range (e.g., 30 mins to 6 hours)
      finalDuration = Math.max(30, Math.min(finalDuration, 360));

      item.durationMinutes = Math.round(finalDuration / 15) * 15; // Round to nearest 15 mins
    }
  });

  return { plan: processedPlan, validationErrors: errors, warnings };
}

/**
 * Validate business hours against plan times
 */
export function validateBusinessHours(plan: Plan): ProcessedPlanData {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    if (!plan.itinerary) return { plan, validationErrors: errors, warnings };

    plan.itinerary.forEach((item, index) => {

      // Basic validation of opening hours format
      if (item.openingHours && item.openingHours.length > 0) {
        const hasValidHours = item.openingHours.some(hours => 
          hours && typeof hours === 'string' && hours.length > 0
        );
        
        if (!hasValidHours) {
          warnings.push(`Item ${index + 1} has invalid opening hours format`);
        }
      }
    });

  } catch (error) {
    errors.push(`Business hours validation error: ${error}`);
  }

  return { plan, validationErrors: errors, warnings };
}

/**
 * Process and normalize price ranges
 */
export function processPlanPricing(plan: Plan): ProcessedPlanData {
  const errors: string[] = [];
  const warnings: string[] = [];
  const processedPlan = { ...plan }; // Work on a copy

  try {
    if (processedPlan.itinerary && processedPlan.itinerary.length > 0) {
      const priceLevels = processedPlan.itinerary
        .map(item => item.priceLevel)
        .filter((level): level is number => typeof level === 'number' && level >= 0);

      if (priceLevels.length > 0) {
        const total = priceLevels.reduce((sum, level) => sum + level, 0);
        const avgPriceLevel = total / priceLevels.length;

        if (avgPriceLevel === 0) {
          processedPlan.priceRange = 'Free';
        } else if (avgPriceLevel <= 1.5) {
          processedPlan.priceRange = '$';
        } else if (avgPriceLevel <= 2.5) {
          processedPlan.priceRange = '$$';
        } else if (avgPriceLevel <= 3.5) {
          processedPlan.priceRange = '$$$';
        } else {
          processedPlan.priceRange = '$$$$';
        }
      } else {
        // No price data available for any item, set a sensible default.
        processedPlan.priceRange = '$$';
        warnings.push('Could not determine price range from itinerary; defaulting to Moderate ($$).');
      }
    } else {
      // No itinerary items, default to Free as it's an empty plan.
      processedPlan.priceRange = 'Free';
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Pricing processing error: ${errorMessage}`);
    // Fallback in case of unexpected errors during processing
    processedPlan.priceRange = '$$';
  }

  return { plan: processedPlan, validationErrors: errors, warnings };
}

/**
 * Sanitize and format text content
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s\-.,!?()]/g, '') // Remove special characters except basic punctuation
    .substring(0, 1000); // Limit length
}

/**
 * Sanitize activity suggestions while preserving emojis
 */
export function sanitizeActivitySuggestion(text: string): string {
  if (!text) return '';
  
  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s\-.,!?()\p{Emoji}]/gu, '') // Remove special characters but preserve emojis
    .substring(0, 200); // Limit length for suggestions
}

/**
 * Validate and enhance image URLs
 */
export function validateImageUrls(plan: Plan): ProcessedPlanData {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    if (!plan.itinerary) return { plan, validationErrors: errors, warnings };

    plan.itinerary.forEach((item, index) => {
      // Validate Google Maps image URL
      if (item.googleMapsImageUrl) {
        if (!item.googleMapsImageUrl.startsWith('https://maps.googleapis.com/')) {
          warnings.push(`Item ${index + 1} has invalid Google Maps image URL`);
        }
      }
      
      // Validate photo reference
      if (item.googlePhotoReference) {
        if (typeof item.googlePhotoReference !== 'string' || item.googlePhotoReference.length < 10) {
          warnings.push(`Item ${index + 1} has invalid photo reference`);
        }
      }
      
      // Ensure at least one image source is available
      if (!item.googleMapsImageUrl && !item.googlePhotoReference) {
        warnings.push(`Item ${index + 1} has no image sources`);
      }
    });

  } catch (error) {
    errors.push(`Image URL validation error: ${error}`);
  }

  return { plan, validationErrors: errors, warnings };
}

/**
 * Validate and fix photo references in itinerary items
 */
export function validatePhotoReferences(plan: Plan): ProcessedPlanData {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    if (!plan.itinerary) return { plan, validationErrors: errors, warnings };

    plan.itinerary.forEach((item, index) => {
      // Validate Google photo reference format
      if (item.googlePhotoReference) {
        // Check if it's a full URL instead of just a reference
        if (item.googlePhotoReference.includes('maps.googleapis.com/maps/api/place/photo')) {
          try {
            const url = new URL(item.googlePhotoReference);
            const extractedReference = url.searchParams.get('photoreference');
            if (extractedReference) {
              item.googlePhotoReference = extractedReference;
              console.log(`[validatePhotoReferences] Fixed photo reference for item ${index + 1}`);
            } else {
              warnings.push(`Item ${index + 1} has malformed photo reference URL`);
              item.googlePhotoReference = null;
            }
          } catch (e) {
            warnings.push(`Item ${index + 1} has invalid photo reference URL`);
            item.googlePhotoReference = null;
          }
        }
        
        // Check if reference is too short (likely invalid)
        if (item.googlePhotoReference && item.googlePhotoReference.length < 10) {
          warnings.push(`Item ${index + 1} has suspiciously short photo reference`);
          item.googlePhotoReference = null;
        }
      }
      
      // Validate Google Maps image URL
      if (item.googleMapsImageUrl) {
        if (!item.googleMapsImageUrl.startsWith('https://maps.googleapis.com/maps/api/staticmap')) {
          warnings.push(`Item ${index + 1} has invalid Google Maps image URL format`);
          item.googleMapsImageUrl = null;
        }
      }
    });

  } catch (error) {
    errors.push(`Photo reference validation error: ${error}`);
  }

  return { plan, validationErrors: errors, warnings };
}

/**
 * Classify activities based on venue types and descriptions
 */
export function classifyActivities(plan: Plan): ProcessedPlanData {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    if (!plan.itinerary) return { plan, validationErrors: errors, warnings };

    const activityCategories = {
      food: ['restaurant', 'cafe', 'bar', 'food', 'meal'],
      culture: ['museum', 'gallery', 'theater', 'library', 'cultural'],
      outdoor: ['park', 'hiking', 'beach', 'nature', 'outdoor'],
      entertainment: ['cinema', 'amusement', 'sports', 'music', 'nightlife'],
      shopping: ['store', 'market', 'mall', 'boutique', 'shopping'],
      wellness: ['spa', 'gym', 'yoga', 'wellness', 'health']
    };

    // Keywords that indicate potentially noisy venues
    const noisyVenueKeywords = [
      'arcade', 'game', 'karaoke', 'sports bar', 'nightclub', 'live music',
      'bowling', 'party', 'playground', 'gaming', 'entertainment center'
    ];

    // Keywords that indicate typically quiet venues
    const quietVenueKeywords = [
      'library', 'museum', 'gallery', 'garden', 'spa', 'tea house',
      'bookstore', 'meditation', 'yoga', 'art space', 'botanical'
    ];

    plan.itinerary.forEach((item, index) => {
      const venueName = (item.placeName || '').toLowerCase();
      const description = (item.description || '').toLowerCase();
      const types = (item.types || []).map(t => t.toLowerCase());
      
      // Check for noise level concerns
      const isLikelyNoisy = noisyVenueKeywords.some(keyword => 
        venueName.includes(keyword) || 
        description.includes(keyword) || 
        types.some(type => type.includes(keyword))
      );

      const isLikelyQuiet = quietVenueKeywords.some(keyword => 
        venueName.includes(keyword) || 
        description.includes(keyword) || 
        types.some(type => type.includes(keyword))
      );

      // Add noise level warning if needed
      if (isLikelyNoisy) {
        warnings.push(`Warning: ${item.placeName} may be a noisy venue. Consider checking noise levels before visiting.`);
      }
      
      // Determine primary activity category
      let primaryCategory = 'general';
      let maxScore = 0;
      
      for (const [category, keywords] of Object.entries(activityCategories)) {
        let score = 0;
        
        // Check venue name
        keywords.forEach(keyword => {
          if (venueName.includes(keyword)) score += 2;
        });
        
        // Check description
        keywords.forEach(keyword => {
          if (description.includes(keyword)) score += 1;
        });
        
        // Check types
        keywords.forEach(keyword => {
          if (types.some(type => type.includes(keyword))) score += 3;
        });

        // Adjust score based on noise preferences if specified in the plan
        if (plan.noisePreference === 'quiet') {
          if (isLikelyNoisy) score *= 0.3; // Significantly reduce score for noisy venues
          if (isLikelyQuiet) score *= 1.5; // Boost score for quiet venues
        }
        
        if (score > maxScore) {
          maxScore = score;
          primaryCategory = category;
        }
      }
      
      // Only add default activity suggestions if none exist
      if (!item.activitySuggestions || item.activitySuggestions.length === 0) {
        const categorySuggestions = {
          food: ['🍽️ Enjoy the local cuisine', '🥂 Try their signature dishes'],
          culture: ['🎨 Explore the exhibits', '📚 Learn about the history'],
          outdoor: ['🌳 Take in the natural beauty', '📸 Capture scenic views'],
          entertainment: ['🎭 Enjoy the show', '🎵 Experience the atmosphere'],
          shopping: ['🛍️ Browse the selection', '💎 Find unique items'],
          wellness: ['🧘 Relax and unwind', '💪 Stay active']
        };
        
        item.activitySuggestions = categorySuggestions[primaryCategory as keyof typeof categorySuggestions] || 
          ['✨ Explore this venue', '📸 Take some photos'];

        // Add quiet-specific suggestions if it's a quiet venue
        if (isLikelyQuiet) {
          item.activitySuggestions.push('🤫 Enjoy the peaceful atmosphere');
        }
      }

      // Add noise level indicator to the item if not already set
      if (!item.noiseLevel) {
        item.noiseLevel = isLikelyNoisy ? 'high' : isLikelyQuiet ? 'low' : 'moderate';
      }
    });

  } catch (error) {
    errors.push(`Activity classification error: ${error}`);
  }

  return { plan, validationErrors: errors, warnings };
}

/**
 * Validate and sanitize plan data
 */
export function validatePlanData(plan: Plan): ProcessedPlanData {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Required fields validation
    if (!plan.name || plan.name.trim().length < 3) {
      errors.push('Plan name must be at least 3 characters');
    }

    if (!plan.itinerary || plan.itinerary.length === 0) {
      errors.push('Plan must have at least one itinerary item');
    } else {
      // Always override AI-provided planType with the ground truth.
      plan.planType = plan.itinerary.length > 1 ? 'multi-stop' : 'single-stop';
    }

    // Validate itinerary items
    if (plan.itinerary) {
      plan.itinerary.forEach((item, index) => {
        if (!item.placeName || item.placeName.trim().length === 0) {
          errors.push(`Itinerary item ${index + 1} must have a place name`);
        }

        if (item.durationMinutes && (item.durationMinutes < 15 || item.durationMinutes > 480)) {
          warnings.push(`Item ${index + 1} duration seems unusual (${item.durationMinutes} minutes)`);
        }
        
        // Sanitize text fields
        if (item.description) {
          item.description = sanitizeText(item.description);
        }
        
        if (item.placeName) {
          item.placeName = sanitizeText(item.placeName);
        }
        
        if (item.activitySuggestions) {
          item.activitySuggestions = item.activitySuggestions.map(suggestion => 
            sanitizeActivitySuggestion(suggestion)
          ).filter(suggestion => suggestion.length > 0);
        }
      });
    }

    // Validate event type
    if (!plan.eventType) {
      warnings.push('Event type is not specified');
    }
    
    // Sanitize plan-level text fields
    if (plan.name) {
      plan.name = sanitizeText(plan.name);
    }
    
    if (plan.description) {
      plan.description = sanitizeText(plan.description);
    }

  } catch (error) {
    errors.push(`Validation error: ${error}`);
  }

  return { plan, validationErrors: errors, warnings };
}

/**
 * Main function to process and enhance an AI-generated plan
 */
export async function processAIGeneratedPlan(
  rawPlan: Plan,
  originalDateTime: string,
  userProfile: UserProfile,
  userPrompt: string
): Promise<ProcessedPlanData> {
  let processedPlan = JSON.parse(JSON.stringify(rawPlan));
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Define synchronous and asynchronous processors.
  const syncProcessorsWithPrompt = [calculateDynamicDurations];
  const syncProcessors = [
    processPlanLocation,
    processPlanPricing,
    validateBusinessHours,
    validatePhotoReferences,
    validateImageUrls,
    classifyActivities,
    validatePlanData,
  ];

  // 1. Apply processors that require the user prompt.
  for (const processor of syncProcessorsWithPrompt) {
    const result = processor(processedPlan, userPrompt);
    processedPlan = result.plan;
    allErrors.push(...result.validationErrors);
    allWarnings.push(...result.warnings);
  }

  // 2. Apply all other synchronous processors.
  for (const processor of syncProcessors) {
    const result = processor(processedPlan);
    processedPlan = result.plan;
    allErrors.push(...result.validationErrors);
    allWarnings.push(...result.warnings);
  }

  // 3. Apply the asynchronous transit calculation, passing the user's profile.
  const transitResult = await calculateTransitDetails(processedPlan, userProfile);
  processedPlan = transitResult.plan;
  allErrors.push(...transitResult.validationErrors);
  allWarnings.push(...transitResult.warnings);

  // 4. Ensure all date fields have proper timezone format before validation
  processedPlan = ensureProperDateTimeFormat(processedPlan);
  
  // Run validation last after all enhancements are done
  const validatedPlan = await validatePlanData(processedPlan);
  processedPlan = validatedPlan.plan;
  allErrors.push(...validatedPlan.validationErrors);
  allWarnings.push(...validatedPlan.warnings);

  // 5. Apply date/time processing LAST, after transit times are known.
  const dateTimeResult = processPlanDateTime(processedPlan, originalDateTime);
  processedPlan = dateTimeResult.plan;
  allErrors.push(...dateTimeResult.validationErrors);
  allWarnings.push(...dateTimeResult.warnings);

  // Final merge to ensure AI creative text is preserved and invalid fields are removed.
  if (processedPlan.itinerary && rawPlan.itinerary) {
        processedPlan.itinerary = processedPlan.itinerary.map((validatedItem: ItineraryItem, index: number) => {
      const originalItem = rawPlan.itinerary[index];
      if (!originalItem) return validatedItem;

      const mergedItem = {
        ...validatedItem,
        // Restore creative fields from the original AI-generated plan
        placeName: originalItem.placeName || validatedItem.placeName,
        description: originalItem.description || validatedItem.description,
        tagline: originalItem.tagline || validatedItem.tagline,
        notes: originalItem.notes || validatedItem.notes,
        activitySuggestions: originalItem.activitySuggestions, // Always use AI's suggestions
      };

      // Clean up the old, incorrect field if it somehow still exists.
      if ('suggestedActivities' in mergedItem) {
        delete (mergedItem as any).suggestedActivities;
      }

      return mergedItem;
    });
  }

  // Restore top-level creative text and metadata from the raw plan
  processedPlan = {
    ...processedPlan,
    name: rawPlan.name || processedPlan.name,
    description: rawPlan.description || processedPlan.description,
    stopCountReasoning: rawPlan.stopCountReasoning,
    venues: rawPlan.venues,
    participantsCount: rawPlan.participantsCount,
    likesCount: rawPlan.likesCount,
    sharesCount: rawPlan.sharesCount,
    savesCount: rawPlan.savesCount,
    type: rawPlan.type,
    isCompleted: rawPlan.isCompleted,
    highlightsEnabled: rawPlan.highlightsEnabled,
    recentSaves: rawPlan.recentSaves,
    recentViews: rawPlan.recentViews,
    recentCompletions: rawPlan.recentCompletions,
    ratings: rawPlan.ratings,
    featured: rawPlan.featured,
    isPremiumOnly: rawPlan.isPremiumOnly,
    participantRSVPDetails: rawPlan.participantRSVPDetails,
    waitlist: rawPlan.waitlist,
  };

  // Ensure ID is never lost
  if (!processedPlan.id) {
    processedPlan.id = rawPlan.id;
  }

  return {
    plan: processedPlan,
    validationErrors: allErrors,
    warnings: allWarnings,
  };
} 