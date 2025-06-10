'use client';

export interface SearchEvent {
  searchTerm: string;
  resultCounts: {
    people: number;
    plans: number;
    collections: number;
  };
  sessionId: string;
  timestamp: string;
}

export interface SearchResultClick {
  searchTerm: string;
  resultType: 'person' | 'plan' | 'collection';
  resultId: string;
  position: number;
  sessionId: string;
  timestamp: string;
}

class SearchAnalyticsClient {
  private sessionId: string;
  private searchHistory: SearchEvent[] = [];
  private clickHistory: SearchResultClick[] = [];
  private pendingEvents: (SearchEvent | SearchResultClick)[] = [];
  private isOnline: boolean = true;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeOfflineSupport();
    this.loadFromLocalStorage();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeOfflineSupport(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushPendingEvents();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });

      this.isOnline = navigator.onLine;
    }
  }

  private loadFromLocalStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('searchAnalytics_pending');
        if (stored) {
          this.pendingEvents = JSON.parse(stored);
        }
      } catch (error) {
        console.warn('[SearchAnalytics] Failed to load pending events from localStorage:', error);
      }
    }
  }

  private saveToLocalStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('searchAnalytics_pending', JSON.stringify(this.pendingEvents));
      } catch (error) {
        console.warn('[SearchAnalytics] Failed to save pending events to localStorage:', error);
      }
    }
  }

  private async sendEvent(endpoint: string, data: any): Promise<boolean> {
    try {
      const response = await fetch(`/api/analytics/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      return response.ok;
    } catch (error) {
      console.warn('[SearchAnalytics] Failed to send event:', error);
      return false;
    }
  }

  private async flushPendingEvents(): Promise<void> {
    if (this.pendingEvents.length === 0 || !this.isOnline) {
      return;
    }

    const eventsToSend = [...this.pendingEvents];
    this.pendingEvents = [];
    this.saveToLocalStorage();

    for (const event of eventsToSend) {
      const isSearchEvent = 'resultCounts' in event;
      const endpoint = isSearchEvent ? 'search' : 'click';
      
      const success = await this.sendEvent(endpoint, event);
      
      if (!success) {
        // Re-add failed events to pending queue
        this.pendingEvents.push(event);
      }
    }

    this.saveToLocalStorage();
  }

  /**
   * Track a search event
   */
  public async trackSearch(
    searchTerm: string,
    resultCounts: { people: number; plans: number; collections: number }
  ): Promise<void> {
    const searchEvent: SearchEvent = {
      searchTerm: searchTerm.trim(),
      resultCounts,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    };

    // Add to local history
    this.searchHistory.push(searchEvent);
    
    // Keep only last 100 searches in memory
    if (this.searchHistory.length > 100) {
      this.searchHistory = this.searchHistory.slice(-100);
    }

    if (this.isOnline) {
      const success = await this.sendEvent('search', searchEvent);
      if (!success) {
        this.pendingEvents.push(searchEvent);
        this.saveToLocalStorage();
      }
    } else {
      this.pendingEvents.push(searchEvent);
      this.saveToLocalStorage();
    }
  }

  /**
   * Track when a user clicks on a search result
   */
  public async trackResultClick(
    searchTerm: string,
    resultType: 'person' | 'plan' | 'collection',
    resultId: string,
    position: number
  ): Promise<void> {
    const clickEvent: SearchResultClick = {
      searchTerm: searchTerm.trim(),
      resultType,
      resultId,
      position,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    };

    // Add to local history
    this.clickHistory.push(clickEvent);
    
    // Keep only last 100 clicks in memory
    if (this.clickHistory.length > 100) {
      this.clickHistory = this.clickHistory.slice(-100);
    }

    if (this.isOnline) {
      const success = await this.sendEvent('click', clickEvent);
      if (!success) {
        this.pendingEvents.push(clickEvent);
        this.saveToLocalStorage();
      }
    } else {
      this.pendingEvents.push(clickEvent);
      this.saveToLocalStorage();
    }
  }

  /**
   * Get recent search terms from local history
   */
  public getRecentSearches(limit: number = 10): string[] {
    return this.searchHistory
      .slice(-limit)
      .map(event => event.searchTerm)
      .filter((term, index, array) => array.indexOf(term) === index) // Remove duplicates
      .reverse(); // Most recent first
  }

  /**
   * Get popular search terms from local history
   */
  public getPopularSearches(limit: number = 10): { term: string; count: number }[] {
    const termCounts: Record<string, number> = {};
    
    this.searchHistory.forEach(event => {
      const term = event.searchTerm.toLowerCase();
      termCounts[term] = (termCounts[term] || 0) + 1;
    });

    return Object.entries(termCounts)
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Clear local search history
   */
  public clearHistory(): void {
    this.searchHistory = [];
    this.clickHistory = [];
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('searchAnalytics_pending');
      } catch (error) {
        console.warn('[SearchAnalytics] Failed to clear localStorage:', error);
      }
    }
  }

  /**
   * Get session statistics
   */
  public getSessionStats(): {
    searchCount: number;
    clickCount: number;
    clickThroughRate: number;
    sessionDuration: number;
  } {
    const searchCount = this.searchHistory.length;
    const clickCount = this.clickHistory.length;
    const clickThroughRate = searchCount > 0 ? (clickCount / searchCount) * 100 : 0;
    
    // Calculate session duration from first search to now
    const firstSearch = this.searchHistory[0];
    const sessionDuration = firstSearch 
      ? Date.now() - new Date(firstSearch.timestamp).getTime()
      : 0;

    return {
      searchCount,
      clickCount,
      clickThroughRate: Math.round(clickThroughRate * 100) / 100,
      sessionDuration: Math.round(sessionDuration / 1000), // in seconds
    };
  }
}

// Create a singleton instance
let searchAnalyticsInstance: SearchAnalyticsClient | null = null;

export function getSearchAnalytics(): SearchAnalyticsClient {
  if (!searchAnalyticsInstance) {
    searchAnalyticsInstance = new SearchAnalyticsClient();
  }
  return searchAnalyticsInstance;
}

// Export convenience functions
export const trackSearch = (searchTerm: string, resultCounts: { people: number; plans: number; collections: number }) => {
  return getSearchAnalytics().trackSearch(searchTerm, resultCounts);
};

export const trackResultClick = (
  searchTerm: string,
  resultType: 'person' | 'plan' | 'collection',
  resultId: string,
  position: number
) => {
  return getSearchAnalytics().trackResultClick(searchTerm, resultType, resultId, position);
};

export const getRecentSearches = (limit?: number) => {
  return getSearchAnalytics().getRecentSearches(limit);
};

export const getPopularSearches = (limit?: number) => {
  return getSearchAnalytics().getPopularSearches(limit);
};

export const clearSearchHistory = () => {
  return getSearchAnalytics().clearHistory();
};

export const getSessionStats = () => {
  return getSearchAnalytics().getSessionStats();
};