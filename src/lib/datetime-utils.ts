
import type { GetPlaceDetailsOutput, OpeningHoursPeriod } from '@/ai/tools/place-details-tool';

/**
 * Helper function to check if a given ISO datetime string falls within a place's opening hours.
 * This is a simplified mock and doesn't handle all edge cases or timezones perfectly.
 * In a real scenario, use a robust date/time library and timezone data.
 */
export function isPlaceOpenAt(isoDateTime: string, placeDetails: GetPlaceDetailsOutput): boolean {
  if (!placeDetails.isOperational) return false;
  if (!placeDetails.openingHours || placeDetails.openingHours.length === 0) {
    // If no hours provided but operational, assume it's open (e.g., a park or public space) or needs manual verification
    return true; 
  }

  try {
    const date = new Date(isoDateTime);
    if (isNaN(date.getTime())) return false; // Invalid date

    const dayOfWeek = date.getUTCDay(); // 0 for Sunday, 1 for Monday, etc.
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const currentTimeInHHMM = `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`;

    for (const period of placeDetails.openingHours) {
      if (period.open.day === dayOfWeek) {
        if (currentTimeInHHMM >= period.open.time) {
          if (period.close) { // If there's a closing time
            if (period.close.day === dayOfWeek && currentTimeInHHMM < period.close.time) {
              return true; // Open and closes same day
            } else if (period.close.day !== dayOfWeek) {
              // Potentially open overnight, complex case not fully handled by this mock
              // For simplicity, if it opened today and closes another day, assume open for now.
              return true; 
            }
          } else {
            return true; // Open 24 hours starting this period
          }
        }
      }
    }
    return false; // No matching open period found
  } catch (e) {
    console.error("Error in isPlaceOpenAt:", e);
    return false; // Default to closed on error
  }
}
