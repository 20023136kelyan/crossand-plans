'use client';

import Image from 'next/image';
import { useMemo, useEffect, useState } from 'react';
import { getGooglePlacePhotoUrl } from '@/utils/googleMapsHelpers';
import type { Plan } from '@/types/user';

interface PlanImageLoaderProps {
  plan: Plan;
  width?: number;
  height?: number;
  className?: string;
  altText?: string;
  priority?: boolean;
}

export function PlanImageLoader({ 
  plan, 
  width = 160, 
  height, 
  className = "", 
  altText,
  priority = false 
}: PlanImageLoaderProps) {
  const [dynamicPhotoUrl, setDynamicPhotoUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Extract image data from plan
  const imageData = useMemo(() => {
    // Debug logging for plans without image data
    if (!(plan.photoHighlights && plan.photoHighlights.length > 0) && plan.itinerary?.length) {
      console.log('[PlanImageLoader] Plan lacks image data:', plan.name, {
        hasItinerary: true,
        itineraryLength: plan.itinerary.length,
        allItems: plan.itinerary.map(item => ({
          placeName: item.placeName,
          hasPhotoRef: !!item.googlePhotoReference,
          hasImageUrl: !!item.googleMapsImageUrl
        }))
      });
    }

    // Priority 1: Photo highlights (uploaded by users)
    if (plan.photoHighlights && plan.photoHighlights.length > 0 && plan.photoHighlights[0]) {
      console.log('[PlanImageLoader] Found photo highlights for:', plan.name);
      return {
        type: 'highlight',
        url: plan.photoHighlights[0],
        hint: 'plan highlight'
      };
    }

    // Priority 2: Itinerary item with image
    const firstItemWithImage = plan.itinerary?.find(item => 
      item.googlePhotoReference || item.googleMapsImageUrl
    );

    // Only log if we actually found an item with images
    if (firstItemWithImage) {
      console.log('[PlanImageLoader] Found item with image:', {
        planName: plan.name,
        placeName: firstItemWithImage.placeName,
        hasPhotoRef: !!firstItemWithImage.googlePhotoReference,
        hasImageUrl: !!firstItemWithImage.googleMapsImageUrl
      });
    }

    if (firstItemWithImage) {
      if (firstItemWithImage.googlePhotoReference) {
        console.log('[PlanImageLoader] Using photo reference:', firstItemWithImage.googlePhotoReference);
        return {
          type: 'photo_reference',
          url: firstItemWithImage.googlePhotoReference,
          hint: firstItemWithImage.types?.[0] || 'location',
          placeName: firstItemWithImage.placeName,
          googlePlaceId: firstItemWithImage.googlePlaceId
        };
      } else if (firstItemWithImage.googleMapsImageUrl) {
        console.log('[PlanImageLoader] Using maps image URL:', firstItemWithImage.googleMapsImageUrl);
        return {
          type: 'maps_image',
          url: firstItemWithImage.googleMapsImageUrl,
          hint: 'map location'
        };
      }
    }

    console.log('[PlanImageLoader] No image data found for plan:', plan.name);
    return null;
  }, [plan.photoHighlights, plan.itinerary, plan.name]);

  // Generate static map fallback
  const staticMapUrl = useMemo(() => {
    const firstItem = plan.itinerary?.[0];
    const hasCoordinates = firstItem?.lat && firstItem?.lng;
    const hasApiKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (hasCoordinates && hasApiKey) {
      const url = `https://maps.googleapis.com/maps/api/staticmap?center=${firstItem.lat},${firstItem.lng}&zoom=15&size=${width}x${height || width}&markers=color:red%7C${firstItem.lat},${firstItem.lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
      console.log('[PlanImageLoader] Generated static map for:', plan.name);
      return url;
    } else {
      console.log('[PlanImageLoader] Cannot generate static map for:', plan.name, { hasCoordinates, hasApiKey });
    }
    return null;
  }, [plan.itinerary, width, height, plan.name]);

  // Dynamic photo fetching effect
  useEffect(() => {
    setDynamicPhotoUrl(null);
    setImageError(false);
    setIsLoading(true);

    // Log only when we have interesting image data or are fetching fresh images
    if (imageData) {
      console.log('[PlanImageLoader] Loading image for:', plan.name, { type: imageData.type });
    }

    if (!imageData) {
      console.log('[PlanImageLoader] No image data found, attempting to fetch fresh images');
      
      // Try to fetch images based on plan location/itinerary
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (apiKey && plan.itinerary && plan.itinerary.length > 0) {
        const firstItem = plan.itinerary[0];
        if (firstItem.placeName) {
          console.log('[PlanImageLoader] Attempting to fetch image for:', firstItem.placeName);
          
          const ensureScript = (cb: () => void) => {
            if (typeof window === 'undefined') return;
            if (window.google && window.google.maps && window.google.maps.places) {
              cb();
            } else {
              const existing = document.querySelector<HTMLScriptElement>('script[data-gmaps="plan-image-loader"]');
              if (existing) {
                existing.addEventListener('load', cb);
                return;
              }
              const script = document.createElement('script');
              script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
              script.async = true;
              script.defer = true;
              script.dataset.gmaps = 'plan-image-loader';
              script.addEventListener('load', cb);
              document.head.appendChild(script);
            }
          };

          const fetchPhoto = () => {
            if (!(window.google && window.google.maps && window.google.maps.places)) return;
            const service = new window.google.maps.places.PlacesService(document.createElement('div'));

            const detailsCallback = (place: any, status: any) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.photos?.length) {
                try {
                  const url = place.photos[0].getUrl({ maxWidth: width, maxHeight: height });
                  console.log('[PlanImageLoader] Successfully fetched fresh photo for plan without image data:', url);
                  setDynamicPhotoUrl(url);
                } catch (error) {
                  console.error('[PlanImageLoader] Error getting photo URL:', error);
                  setImageError(true);
                }
              } else {
                console.log('[PlanImageLoader] No photos found for plan location, will use static map fallback');
                setImageError(true);
              }
              setIsLoading(false);
            };

            // Search for the place by name
            service.findPlaceFromQuery({ 
              query: `${firstItem.placeName} ${plan.city || ''}`, 
              fields: ['place_id'] 
            }, (results: any, status: any) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]?.place_id) {
                service.getDetails({ placeId: results[0].place_id, fields: ['photos'] }, detailsCallback);
              } else {
                console.log('[PlanImageLoader] Could not find place, will use static map fallback');
                setImageError(true);
                setIsLoading(false);
              }
            });
          };

          ensureScript(fetchPhoto);
          return;
        }
      }
      
      console.log('[PlanImageLoader] No way to fetch images, will use static map fallback');
      setImageError(true); // This will trigger static map fallback
      setIsLoading(false);
      return;
    }

    // If we have a photo highlight or maps image URL, validate and use it
    if (imageData.type === 'highlight' || imageData.type === 'maps_image') {
      console.log('[PlanImageLoader] Using photo highlight or maps image:', {
        type: imageData.type,
        url: imageData.url,
        isValidUrl: imageData.url.startsWith('http://') || imageData.url.startsWith('https://')
      });
      
      // Quick validation for URL format
      if (imageData.url.startsWith('http://') || imageData.url.startsWith('https://')) {
        setDynamicPhotoUrl(imageData.url);
        setIsLoading(false);
        return;
      } else {
        console.warn('[PlanImageLoader] Invalid URL format for highlight/maps image:', imageData.url);
        setImageError(true);
        setIsLoading(false);
        return;
      }
    }

    // If we have a photo reference, try to generate URL
    if (imageData.type === 'photo_reference') {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        console.warn('[PlanImageLoader] No Google Maps API key available');
        setImageError(true);
        setIsLoading(false);
        return;
      }

      // Check if it's already a direct URL
      if (imageData.url.startsWith('http://') || imageData.url.startsWith('https://')) {
        setDynamicPhotoUrl(imageData.url);
        setIsLoading(false);
        return;
      }

      // Try to generate URL from photo reference
      const generatedUrl = getGooglePlacePhotoUrl(imageData.url, width, height, apiKey);
      console.log('[PlanImageLoader] Generated URL from photo reference:', {
        photoReference: imageData.url,
        generatedUrl,
        success: !!generatedUrl
      });
      
      if (generatedUrl) {
        setDynamicPhotoUrl(generatedUrl);
        setIsLoading(false);
        return;
      } else {
        console.warn('[PlanImageLoader] Failed to generate photo URL from reference:', imageData.url);
        // If photo reference generation fails, try dynamic fetching as fallback
        if (imageData.placeName || imageData.googlePlaceId) {
          console.log('[PlanImageLoader] Attempting dynamic photo fetch as fallback');
        } else {
          console.warn('[PlanImageLoader] No fallback options available for photo reference');
          setImageError(true);
          setIsLoading(false);
          return;
        }
      }

      // If photo reference fails, try dynamic fetching as fallback
      if (imageData.placeName || imageData.googlePlaceId) {
        const ensureScript = (cb: () => void) => {
          if (typeof window === 'undefined') return;
          if (window.google && window.google.maps && window.google.maps.places) {
            cb();
          } else {
            const existing = document.querySelector<HTMLScriptElement>('script[data-gmaps="plan-image-loader"]');
            if (existing) {
              existing.addEventListener('load', cb);
              return;
            }
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
            script.async = true;
            script.defer = true;
            script.dataset.gmaps = 'plan-image-loader';
            script.addEventListener('load', cb);
            document.head.appendChild(script);
          }
        };

        const fetchPhoto = () => {
          if (!(window.google && window.google.maps && window.google.maps.places)) return;
          const service = new window.google.maps.places.PlacesService(document.createElement('div'));

          const detailsCallback = (place: any, status: any) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.photos?.length) {
              try {
                const url = place.photos[0].getUrl({ maxWidth: width, maxHeight: height });
                console.log('[PlanImageLoader] Successfully fetched fresh photo:', url);
                setDynamicPhotoUrl(url);
              } catch (error) {
                console.error('[PlanImageLoader] Error getting photo URL:', error);
                setImageError(true);
              }
            } else {
              console.log('[PlanImageLoader] No photos found, will use fallback');
              setImageError(true);
            }
            setIsLoading(false);
          };

          if (imageData.googlePlaceId) {
            service.getDetails({ placeId: imageData.googlePlaceId, fields: ['photos'] }, detailsCallback);
          } else if (imageData.placeName) {
            service.findPlaceFromQuery({ query: imageData.placeName, fields: ['place_id'] }, (results: any, status: any) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]?.place_id) {
                service.getDetails({ placeId: results[0].place_id, fields: ['photos'] }, detailsCallback);
              } else {
                setImageError(true);
                setIsLoading(false);
              }
            });
          } else {
            setImageError(true);
            setIsLoading(false);
          }
        };

        ensureScript(fetchPhoto);
        return;
      }
    }

    setImageError(true);
    setIsLoading(false);
  }, [imageData, width, height]);

  // Determine final image URL
  const finalImageUrl = dynamicPhotoUrl || (imageError ? staticMapUrl : null);
  
  // Enhanced placeholder based on plan details
  const getPlaceholderUrl = () => {
    const eventType = plan.eventType || 'event';
    const city = plan.city || 'location';
    const eventEmoji = 
      eventType.toLowerCase().includes('food') || eventType.toLowerCase().includes('dining') ? '🍽️' :
      eventType.toLowerCase().includes('art') || eventType.toLowerCase().includes('culture') ? '🎨' :
      eventType.toLowerCase().includes('explore') || eventType.toLowerCase().includes('tour') ? '🗺️' :
      eventType.toLowerCase().includes('outdoor') || eventType.toLowerCase().includes('nature') ? '🌲' :
      eventType.toLowerCase().includes('music') || eventType.toLowerCase().includes('entertainment') ? '🎵' : 
      '📍';
    
    const placeholderText = `${eventEmoji} ${city}`;
    return `https://placehold.co/${width}x${height || width}/e2e8f0/64748b.png?text=${encodeURIComponent(placeholderText)}&font=Montserrat`;
  };
  
  const placeholderUrl = getPlaceholderUrl();

  // Only log final decision if interesting
  if (!finalImageUrl || finalImageUrl.includes('maps.googleapis.com')) {
    console.log('[PlanImageLoader] Final render for:', plan.name, {
      result: !finalImageUrl ? 'placeholder' : finalImageUrl.includes('maps.googleapis.com') ? 'static_map' : 'image',
      willShowPlaceholder: !finalImageUrl
    });
  }

  if (isLoading) {
    return (
      <div 
        className={`bg-muted animate-pulse ${className}`} 
        style={className.includes('w-full') && className.includes('h-full') ? { 
          width: '100%', 
          height: '100%' 
        } : { 
          width, 
          height: height || width 
        }}
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-muted-foreground text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  // Handle static map images with eager loading to avoid browser intervention
  if (finalImageUrl && finalImageUrl.includes('maps.googleapis.com')) {
    return (
      <img
        src={finalImageUrl}
        alt={altText || plan.name || 'Plan image'}
        className={className}
        data-ai-hint={imageData?.hint || 'static map'}
        onError={(e) => {
          console.error('[PlanImageLoader] Static map load error for:', finalImageUrl);
          console.error('[PlanImageLoader] Error event:', e);
          // Try to load the image again after a short delay
          setTimeout(() => {
            if (e.target instanceof HTMLImageElement) {
              e.target.src = finalImageUrl + '&retry=' + Date.now();
            }
          }, 1000);
        }}
        loading="eager"
        onLoad={() => {
          console.log('[PlanImageLoader] Static map loaded successfully for:', plan.name);
        }}
        style={className.includes('w-full') && className.includes('h-full') ? { 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover' 
        } : { 
          width, 
          height: height || width 
        }}
      />
    );
  }

  return finalImageUrl ? (
    className.includes('w-full') && className.includes('h-full') ? (
      <Image
        src={finalImageUrl}
        alt={altText || plan.name || 'Plan image'}
        fill
        className={className}
        data-ai-hint={imageData?.hint || 'plan image'}
        unoptimized={false}
        priority={priority}
        onError={() => {
          console.error('[PlanImageLoader] Image load error for:', finalImageUrl);
          if (!imageError && finalImageUrl !== staticMapUrl) {
            setImageError(true);
          }
        }}
      />
    ) : (
      <Image
        src={finalImageUrl}
        alt={altText || plan.name || 'Plan image'}
        width={width}
        height={height || width}
        className={className}
        data-ai-hint={imageData?.hint || 'plan image'}
        unoptimized={false}
        priority={priority}
        onError={() => {
          console.error('[PlanImageLoader] Image load error for:', finalImageUrl);
          if (!imageError && finalImageUrl !== staticMapUrl) {
            setImageError(true);
          }
        }}
      />
    )
  ) : (
    <img
      src={placeholderUrl}
      alt={altText || plan.name || 'Plan placeholder'}
      className={className}
      data-ai-hint="placeholder fallback"
      loading="lazy"
      style={className.includes('w-full') && className.includes('h-full') ? { 
        width: '100%', 
        height: '100%', 
        objectFit: 'cover' 
      } : { 
        width, 
        height: height || width 
      }}
    />
  );
} 