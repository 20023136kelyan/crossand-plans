import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { CollectionReference, DocumentData } from 'firebase-admin/firestore';
import type { Plan, ItineraryItem } from '@/types/plan';

interface VisitedPlace {
  placeId: string;
  placeName: string;
  visitCount: number;
  lastVisitDate: string;
  categories: string[];
}

interface SuggestedPlace {
  placeId: string;
  placeName: string;
  suggestedCount: number;
  lastSuggestedDate: string;
  categories: string[];
  wasChosen: boolean;  // Whether the user actually chose this place
}

interface UserPlanningHistory {
  userId: string;
  visitedPlaces: VisitedPlace[];
  suggestedPlaces: SuggestedPlace[];  // Add suggested places tracking
  frequentCategories: { [category: string]: number };
  recentPlans: Array<{
    planId: string;
    date: string;
    places: string[]; // placeIds
  }>;
  lastUpdateTime: string;
  suggestionCooldowns: { [placeId: string]: string }; // Cooldown end dates
}

export class UserHistoryService {
  private static COLLECTION = 'userPlanningHistory';
  private static RECENT_PLANS_LIMIT = 20;
  private static HISTORY_WINDOW_DAYS = 90; // Consider last 90 days
  private static SUGGESTION_COOLDOWN_DAYS = 14; // Don't suggest again for 2 weeks
  private static MAX_SUGGESTIONS_BEFORE_COOLDOWN = 3; // Suggest max 3 times before cooling down

  private static getCollection() {
    if (!firestoreAdmin) throw new Error('Firestore Admin not initialized');
    return firestoreAdmin.collection(this.COLLECTION);
  }

  static async getUserHistory(userId: string): Promise<UserPlanningHistory | null> {
    try {
      const docRef = this.getCollection().doc(userId);
      const docSnap = await docRef.get();
      return docSnap.exists ? (docSnap.data() as UserPlanningHistory) : null;
    } catch (error) {
      console.error('[UserHistoryService] Failed to get user history:', error);
      return null;
    }
  }

  static async updatePlanHistory(userId: string, plan: Plan): Promise<void> {
    try {
      const now = new Date().toISOString();
      const historyRef = this.getCollection().doc(userId);
      
      const currentHistory = await this.getUserHistory(userId) || {
        userId,
        visitedPlaces: [],
        suggestedPlaces: [],
        frequentCategories: {},
        recentPlans: [],
        lastUpdateTime: now,
        suggestionCooldowns: {}
      };

      // Extract valid places from plan
      const newPlaces = plan.itinerary
        .filter((stop): stop is ItineraryItem & { googlePlaceId: string } => 
          Boolean(stop.googlePlaceId))
        .map(stop => ({
          placeId: stop.googlePlaceId,
          placeName: stop.placeName,
          categories: stop.types || [],
          visitDate: now
        }));

      // Update visited places
      newPlaces.forEach(newPlace => {
        const existingPlace = currentHistory.visitedPlaces.find(p => p.placeId === newPlace.placeId);
        if (existingPlace) {
          existingPlace.visitCount++;
          existingPlace.lastVisitDate = now;
        } else {
          currentHistory.visitedPlaces.push({
            placeId: newPlace.placeId,
            placeName: newPlace.placeName,
            visitCount: 1,
            lastVisitDate: now,
            categories: newPlace.categories
          } as VisitedPlace);
        }

        // Update category frequencies
        const freqCategories = currentHistory.frequentCategories as { [category: string]: number };
        newPlace.categories.forEach(category => {
          freqCategories[category] = (freqCategories[category] || 0) + 1;
        });
        currentHistory.frequentCategories = freqCategories;
      });

      // Add to recent plans
      currentHistory.recentPlans.unshift({
        planId: plan.id,
        date: now,
        places: newPlaces.map(p => p.placeId)
      } as { planId: string; date: string; places: string[] });

      // Trim recent plans to limit
      currentHistory.recentPlans = currentHistory.recentPlans
        .slice(0, this.RECENT_PLANS_LIMIT);

      // Clean up old history
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.HISTORY_WINDOW_DAYS);
      currentHistory.visitedPlaces = currentHistory.visitedPlaces.filter(
        place => new Date(place.lastVisitDate) > cutoffDate
      );

      // Update database
      await historyRef.set(currentHistory, { merge: true });
      
    } catch (error) {
      console.error('[UserHistoryService] Failed to update plan history:', error);
    }
  }

  static async trackSuggestedPlaces(userId: string, suggestedPlaces: Array<{
    placeId: string;
    placeName: string;
    categories: string[];
  }>): Promise<void> {
    try {
      const now = new Date().toISOString();
      const historyRef = this.getCollection().doc(userId);
      
      const currentHistory = await this.getUserHistory(userId) || {
        userId,
        visitedPlaces: [],
        suggestedPlaces: [],
        frequentCategories: {},
        recentPlans: [],
        lastUpdateTime: now,
        suggestionCooldowns: {}
      };

      // Update suggestion history
      suggestedPlaces.forEach(place => {
        const existingSuggestion = currentHistory.suggestedPlaces.find(
          p => p.placeId === place.placeId
        );

        if (existingSuggestion) {
          existingSuggestion.suggestedCount++;
          existingSuggestion.lastSuggestedDate = now;
          
          // Apply cooldown if suggested too many times
          if (existingSuggestion.suggestedCount >= this.MAX_SUGGESTIONS_BEFORE_COOLDOWN) {
            const cooldownEnd = new Date();
            cooldownEnd.setDate(cooldownEnd.getDate() + this.SUGGESTION_COOLDOWN_DAYS);
            currentHistory.suggestionCooldowns[place.placeId] = cooldownEnd.toISOString();
          }
        } else {
          currentHistory.suggestedPlaces.push({
            placeId: place.placeId,
            placeName: place.placeName,
            suggestedCount: 1,
            lastSuggestedDate: now,
            categories: place.categories,
            wasChosen: false
          } as SuggestedPlace);
        }
      });

      // Clean up old suggestions
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.HISTORY_WINDOW_DAYS);
      currentHistory.suggestedPlaces = currentHistory.suggestedPlaces.filter(
        place => new Date(place.lastSuggestedDate) > cutoffDate
      );

      // Clean up expired cooldowns
      const now_date = new Date();
      currentHistory.suggestionCooldowns = Object.fromEntries(
        Object.entries(currentHistory.suggestionCooldowns)
          .filter(([_, endDate]) => new Date(endDate) > now_date)
      );

      await historyRef.set(currentHistory, { merge: true });
    } catch (error) {
      console.error('[UserHistoryService] Failed to track suggested places:', error);
    }
  }

  static async markPlaceAsChosen(userId: string, placeId: string): Promise<void> {
    try {
      const historyRef = this.getCollection().doc(userId);
      const history = await this.getUserHistory(userId);
      if (!history) return;

      const suggestedPlace = history.suggestedPlaces.find(p => p.placeId === placeId);
      if (suggestedPlace) {
        suggestedPlace.wasChosen = true;
      }

      await historyRef.set(history, { merge: true });
    } catch (error) {
      console.error('[UserHistoryService] Failed to mark place as chosen:', error);
    }
  }

  static async getSuggestionFatigueScore(userId: string, placeId: string): Promise<number> {
    try {
      const history = await this.getUserHistory(userId);
      if (!history) return 1.0; // No fatigue if no history

      // Check if place is in cooldown
      if (history.suggestionCooldowns[placeId]) {
        const cooldownEnd = new Date(history.suggestionCooldowns[placeId]);
        if (cooldownEnd > new Date()) {
          return 0.0; // Complete fatigue during cooldown
        }
      }

      const suggestedPlace = history.suggestedPlaces.find(p => p.placeId === placeId);
      if (!suggestedPlace) return 1.0; // No fatigue if never suggested

      // Calculate days since last suggestion
      const daysSinceLastSuggestion = Math.floor(
        (new Date().getTime() - new Date(suggestedPlace.lastSuggestedDate).getTime()) / 
        (1000 * 60 * 60 * 24)
      );

      // Calculate fatigue based on suggestion count and recency
      const recencyFactor = Math.min(daysSinceLastSuggestion / 30, 1); // Recover over 30 days
      const countFactor = Math.max(0, 1 - (suggestedPlace.suggestedCount / this.MAX_SUGGESTIONS_BEFORE_COOLDOWN));
      
      // If user chose this place before, reduce fatigue slightly
      const chosenBonus = suggestedPlace.wasChosen ? 0.2 : 0;

      return Math.min(1, (recencyFactor * 0.6) + (countFactor * 0.4) + chosenBonus);
    } catch (error) {
      console.error('[UserHistoryService] Failed to calculate suggestion fatigue:', error);
      return 1.0; // Default to no fatigue on error
    }
  }

  static async getPlaceDiversityScore(userId: string, placeId: string): Promise<number> {
    try {
      const history = await this.getUserHistory(userId);
      if (!history) return 1.0; // No history means maximum diversity

      const visitedPlace = history.visitedPlaces.find(p => p.placeId === placeId);
      if (!visitedPlace) return 1.0; // Never visited = maximum diversity

      // Calculate recency penalty
      const daysSinceLastVisit = Math.floor(
        (new Date().getTime() - new Date(visitedPlace.lastVisitDate).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      const recencyScore = Math.min(daysSinceLastVisit / this.HISTORY_WINDOW_DAYS, 1);

      // Calculate frequency penalty
      const frequencyScore = Math.max(0, 1 - (visitedPlace.visitCount / 10));

      // Combine scores (weighted average)
      return (recencyScore * 0.7) + (frequencyScore * 0.3);
    } catch (error) {
      console.error('[UserHistoryService] Failed to calculate diversity score:', error);
      return 1.0; // Default to maximum diversity on error
    }
  }

  static async getCategoryDiversityScore(userId: string, categories: string[]): Promise<number> {
    try {
      const history = await this.getUserHistory(userId);
      if (!history || !categories.length) return 1.0;

      // Calculate average frequency of these categories
      const totalFreq = categories.reduce((sum, cat) => 
        sum + (history.frequentCategories[cat] || 0), 0);
      const avgFreq = totalFreq / categories.length;

      // Convert to diversity score (inverse of frequency)
      return Math.max(0, 1 - (avgFreq / 20)); // Cap at 20 visits
    } catch (error) {
      console.error('[UserHistoryService] Failed to calculate category diversity:', error);
      return 1.0;
    }
  }
} 