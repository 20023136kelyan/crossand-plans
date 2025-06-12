/**
 * Utility functions for working with Google Maps APIs
 */

/**
 * Creates a CORS-friendly URL for Google Maps Place photos
 * This function handles the photo reference properly to avoid CORS issues
 * 
 * @param photoReference - The Google Maps photo reference
 * @param maxWidth - Optional maximum width for the image
 * @param maxHeight - Optional maximum height for the image
 * @param apiKey - Google Maps API key
 * @returns A properly formatted URL for the photo
 */
export function getGooglePlacePhotoUrl(
  photoReference: string | null | undefined,
  maxWidth: number = 600,
  maxHeight?: number,
  apiKey?: string
): string {
  console.log('=== GOOGLE PLACE PHOTO URL GENERATION ===');
  console.log('[getGooglePlacePhotoUrl] Input parameters:', {
    photoReference,
    photoReferenceType: typeof photoReference,
    photoReferenceLength: photoReference?.length,
    maxWidth,
    maxHeight,
    hasApiKey: !!apiKey,
    apiKeyType: typeof apiKey,
    apiKeyLength: apiKey?.length,
    envApiKey: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    envApiKeyLength: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.length
  });

  if (!photoReference) {
    console.log('[getGooglePlacePhotoUrl] No photo reference provided, returning empty string');
    console.log('Photo reference is:', photoReference);
    return '';
  }

  // Use the API key provided or from environment variable
  const key = apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  console.log('[getGooglePlacePhotoUrl] API Key details:', {
    providedApiKey: (apiKey && typeof apiKey === 'string') ? `${apiKey.substring(0, 10)}...` : `type: ${typeof apiKey}`,
    envApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? `${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.substring(0, 10)}...` : 'none',
    finalKey: (key && typeof key === 'string') ? `${key.substring(0, 10)}...` : `type: ${typeof key}`,
    finalKeyLength: key?.length
  });
  
  if (!key) {
    console.warn('[getGooglePlacePhotoUrl] No Google Maps API key available');
    return '';
  }

  // Check if photoReference is already a complete URL (from JavaScript API getUrl())
  if (photoReference.startsWith('http://') || photoReference.startsWith('https://')) {
    console.log('[getGooglePlacePhotoUrl] Photo reference is already a complete URL, returning as-is:', photoReference.substring(0, 100) + '...');
    return photoReference;
  }
  
  // Make sure we're using a clean photo reference
  // The error suggests the photo reference might contain a full URL instead of just the reference
  let cleanPhotoReference = photoReference;
  
  // If the photoReference contains a URL, extract just the reference part
  if (photoReference.includes('photoreference=')) {
    console.log('[getGooglePlacePhotoUrl] Photo reference contains URL, extracting reference');
    try {
      const url = new URL(photoReference);
      cleanPhotoReference = url.searchParams.get('photoreference') || photoReference;
      console.log('[getGooglePlacePhotoUrl] Extracted reference from URL:', cleanPhotoReference);
    } catch (e) {
      // If it's not a valid URL but contains the parameter, try to extract it
      const match = photoReference.match(/photoreference=([^&]+)/);
      if (match && match[1]) {
        cleanPhotoReference = match[1];
        console.log('[getGooglePlacePhotoUrl] Extracted reference via regex:', cleanPhotoReference);
      }
    }
  }

  // Return a properly formatted Google Maps Place Photo URL
  console.log('[getGooglePlacePhotoUrl] Final URL generation:', {
    cleanPhotoReference,
    cleanPhotoReferenceLength: cleanPhotoReference.length,
    encodedPhotoReference: encodeURIComponent(cleanPhotoReference),
    maxWidth,
    maxHeight,
    keyUsed: (key && typeof key === 'string') ? `${key.substring(0, 10)}...` : `type: ${typeof key}`,
    keyLength: key?.length
  });
  
  // Build URL with optional maxHeight parameter
  let finalUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}`;
  if (maxHeight) {
    finalUrl += `&maxheight=${maxHeight}`;
  }
  finalUrl += `&photoreference=${encodeURIComponent(cleanPhotoReference)}&key=${key}`;
  
  console.log('[getGooglePlacePhotoUrl] Generated URL (first 100 chars):', finalUrl.substring(0, 100) + '...');
  console.log('[getGooglePlacePhotoUrl] Full URL length:', finalUrl.length);
  
  return finalUrl;
}
