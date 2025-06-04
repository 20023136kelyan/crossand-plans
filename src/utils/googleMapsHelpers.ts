/**
 * Utility functions for working with Google Maps APIs
 */

/**
 * Creates a CORS-friendly URL for Google Maps Place photos
 * This function handles the photo reference properly to avoid CORS issues
 * 
 * @param photoReference - The Google Maps photo reference
 * @param maxWidth - Optional maximum width for the image
 * @param apiKey - Google Maps API key
 * @returns A properly formatted URL for the photo
 */
export function getGooglePlacePhotoUrl(
  photoReference: string | null | undefined,
  maxWidth: number = 600,
  apiKey?: string
): string {
  if (!photoReference) {
    return '';
  }

  // Use the API key provided or from environment variable
  const key = apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (!key) {
    console.warn('[getGooglePlacePhotoUrl] No Google Maps API key available');
    return '';
  }

  // Make sure we're using a clean photo reference
  // The error suggests the photo reference might contain a full URL instead of just the reference
  let cleanPhotoReference = photoReference;
  
  // If the photoReference contains a URL, extract just the reference part
  if (photoReference.includes('photoreference=')) {
    try {
      const url = new URL(photoReference);
      cleanPhotoReference = url.searchParams.get('photoreference') || photoReference;
    } catch (e) {
      // If it's not a valid URL but contains the parameter, try to extract it
      const match = photoReference.match(/photoreference=([^&]+)/);
      if (match && match[1]) {
        cleanPhotoReference = match[1];
      }
    }
  }

  // Return a properly formatted Google Maps Place Photo URL
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${encodeURIComponent(cleanPhotoReference)}&key=${key}`;
}
