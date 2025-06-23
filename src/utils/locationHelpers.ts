/**
 * Location utility functions for better location handling
 */

// Common city boundaries for quick coordinate-to-city mapping
const CITY_BOUNDARIES = {
  'San Francisco, CA': { lat: [37.7, 37.8], lng: [-122.5, -122.35] },
  'New York, NY': { lat: [40.4, 40.9], lng: [-74.3, -73.7] },
  'Los Angeles, CA': { lat: [33.7, 34.3], lng: [-118.7, -118.1] },
  'Chicago, IL': { lat: [41.6, 42.0], lng: [-87.9, -87.5] },
  'Seattle, WA': { lat: [47.4, 47.8], lng: [-122.5, -122.2] },
  'Boston, MA': { lat: [42.2, 42.4], lng: [-71.2, -70.9] },
  'Miami, FL': { lat: [25.6, 25.9], lng: [-80.4, -80.1] },
  'Austin, TX': { lat: [30.1, 30.5], lng: [-97.9, -97.6] },
  'Portland, OR': { lat: [45.4, 45.7], lng: [-122.8, -122.5] },
  'Denver, CO': { lat: [39.6, 39.8], lng: [-105.1, -104.8] },
};

/**
 * Attempts to identify a city based on coordinates
 */
export function getCityFromCoordinates(lat: number, lng: number): string | null {
  for (const [city, bounds] of Object.entries(CITY_BOUNDARIES)) {
    if (lat >= bounds.lat[0] && lat <= bounds.lat[1] && 
        lng >= bounds.lng[0] && lng <= bounds.lng[1]) {
      return city;
    }
  }
  return null;
}

/**
 * Extracts location information from a location query string
 */
export function parseLocationQuery(locationQuery: string, lat?: number | null, lng?: number | null) {
  // If we have coordinates, try to identify the city
  if (lat && lng) {
    const identifiedCity = getCityFromCoordinates(lat, lng);
    if (identifiedCity) {
      return {
        city: identifiedCity,
        isCoordinateBased: locationQuery.includes('Latitude') || locationQuery.includes('Location'),
        searchQuery: identifiedCity.split(',')[0], // Just the city name for search
        displayName: identifiedCity
      };
    }
  }

  // Check if location query is coordinate-based
  const isCoordinateBased = locationQuery.includes('Latitude') || 
                           locationQuery.includes('Location') ||
                           /^\d+\.\d+,\s*-?\d+\.\d+/.test(locationQuery);

  if (isCoordinateBased) {
    // Extract coordinates if present in string
    const coordMatch = locationQuery.match(/(-?\d+\.\d+)/g);
    if (coordMatch && coordMatch.length >= 2 && lat && lng) {
      const identifiedCity = getCityFromCoordinates(lat, lng);
      return {
        city: identifiedCity || 'Unknown Location',
        isCoordinateBased: true,
        searchQuery: identifiedCity?.split(',')[0] || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        displayName: identifiedCity || `Location ${lat.toFixed(4)}, ${lng.toFixed(4)}`
      };
    }
  }

  // Handle normal address strings
  const parts = locationQuery.split(',');
  const city = parts.length > 1 ? parts[parts.length - 2].trim() : parts[0].trim();
  
  return {
    city: locationQuery,
    isCoordinateBased: false,
    searchQuery: city,
    displayName: locationQuery
  };
}

/**
 * Creates a search-friendly location string for AI queries
 */
export function createSearchLocation(locationQuery: string, lat?: number | null, lng?: number | null): string {
  const parsed = parseLocationQuery(locationQuery, lat, lng);
  
  if (parsed.isCoordinateBased && lat && lng) {
    const identifiedCity = getCityFromCoordinates(lat, lng);
    if (identifiedCity) {
      return identifiedCity.split(',')[0]; // Return just city name
    }
    return `coordinates ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  }
  
  return parsed.searchQuery;
}

/**
 * Improves location display names
 */
export function improveLocationDisplayName(locationQuery: string, lat?: number | null, lng?: number | null): string {
  const parsed = parseLocationQuery(locationQuery, lat, lng);
  return parsed.displayName;
}

/**
 * Creates a radius-appropriate location descriptor for search queries
 */
export function createRadiusAwareLocationDescriptor(
  locationQuery: string, 
  lat: number, 
  lng: number, 
  radiusKm: number
): { descriptor: string; precision: 'coordinates' | 'street' | 'neighborhood' | 'city' | 'region' } {
  
  if (radiusKm <= 2) {
    // Ultra-precise: use coordinates
    return {
      descriptor: `coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      precision: 'coordinates'
    };
  }
  
  if (radiusKm <= 5) {
    // Very local: try to extract street/neighborhood level
    if (locationQuery.includes(',') && locationQuery.length > 15) {
      const parts = locationQuery.split(',').map(s => s.trim());
      if (parts.length >= 2) {
        // Use first two parts (street + neighborhood/district)
        return {
          descriptor: `${parts[0]}, ${parts[1]}`,
          precision: 'street'
        };
      }
    }
    // Fallback to coordinates with less precision
    return {
      descriptor: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
      precision: 'coordinates'
    };
  }
  
  if (radiusKm <= 10) {
    // Neighborhood level
    const identifiedCity = getCityFromCoordinates(lat, lng);
    if (locationQuery.includes(',') && locationQuery.length > 10) {
      const parts = locationQuery.split(',').map(s => s.trim());
      if (parts.length >= 2) {
        return {
          descriptor: `${parts[0]}, ${parts[1]}`,
          precision: 'neighborhood'
        };
      }
    }
    if (identifiedCity) {
      return {
        descriptor: identifiedCity,
        precision: 'city'
      };
    }
    return {
      descriptor: `area around ${lat.toFixed(2)}, ${lng.toFixed(2)}`,
      precision: 'coordinates'
    };
  }
  
  // City/regional level
  const identifiedCity = getCityFromCoordinates(lat, lng);
  if (identifiedCity) {
    return {
      descriptor: identifiedCity.split(',')[0],
      precision: 'city'
    };
  }
  
  return {
    descriptor: `${lat.toFixed(1)}, ${lng.toFixed(1)} region`,
    precision: 'region'
  };
} 