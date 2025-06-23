'use client';

import Image from 'next/image';
import { useMemo, useEffect, useState } from 'react';
import { getGooglePlacePhotoUrl } from '@/utils/googleMapsHelpers';
import type { FieldArrayWithId } from 'react-hook-form';
import type { NewPlanFormValues } from '../plans/NewPlanForm';

interface ItineraryImageLoaderProps {
  item: Partial<FieldArrayWithId<NewPlanFormValues, "itinerary", "id">>;
  altText?: string;
}

export function ItineraryImageLoader({ item, altText }: ItineraryImageLoaderProps) {
  const [dynamicUrl, setDynamicUrl] = useState<string | null>(null);
  const [hadError, setHadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Reset state when item changes
    setDynamicUrl(null);
    setHadError(false);
    setIsLoading(true);

    console.log('🖼️ [ItineraryImageLoader] useEffect triggered:', {
      itemGoogleMapsImageUrl: item.googleMapsImageUrl,
      hasUrl: !!item.googleMapsImageUrl,
      placeName: item.placeName,
      googlePlaceId: item.googlePlaceId,
      isPhotoUrl: item.googleMapsImageUrl?.includes('photo') || item.googleMapsImageUrl?.includes('googleusercontent'),
      isStaticMap: item.googleMapsImageUrl?.includes('staticmap')
    });

    // If we have a photo URL (not just a static map), validate and use it directly
    if (item.googleMapsImageUrl && 
        (item.googleMapsImageUrl.includes('photo') || 
         item.googleMapsImageUrl.includes('googleusercontent') ||
         !item.googleMapsImageUrl.includes('staticmap'))) {
        
        // Check if it's a valid HTTP URL and not a callback URL
        if ((item.googleMapsImageUrl.startsWith('https://') || item.googleMapsImageUrl.startsWith('http://')) && 
            !item.googleMapsImageUrl.includes('callback=') &&
            !item.googleMapsImageUrl.includes('PhotoService.GetPhoto')) {
            console.log('✅ [ItineraryImageLoader] Using provided photo URL:', item.googleMapsImageUrl);
            setDynamicUrl(item.googleMapsImageUrl);
            setIsLoading(false);
            return;
        } else {
            console.warn('⚠️ [ItineraryImageLoader] Invalid photo URL format, will fetch new one:', item.googleMapsImageUrl);
            // Continue to photo fetching logic
        }
    }

    // If we only have a static map URL, try to get a real photo first
    if (item.googleMapsImageUrl && item.googleMapsImageUrl.includes('staticmap')) {
        console.log('📍 [ItineraryImageLoader] Have static map, attempting to get photo first:', item.googleMapsImageUrl);
        // Continue to photo fetching logic, but keep static map as fallback
    } else if (!item.googleMapsImageUrl) {
        console.log('🔍 [ItineraryImageLoader] No URL provided, attempting to fetch photo');
        // Continue to photo fetching logic
    }

    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
        setIsLoading(false);
        setHadError(true);
        return;
    }

    const ensureScript = (cb: () => void) => {
      if (typeof window === 'undefined') return;
      if (window.google && window.google.maps && window.google.maps.places) {
        cb();
      } else {
        const existing = document.querySelector<HTMLScriptElement>('script[data-gmaps="image-loader"]');
        if (existing) {
          existing.addEventListener('load', cb);
          return;
        }
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.dataset.gmaps = 'image-loader';
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
            const url = place.photos[0].getUrl({ maxWidth: 800 });
            console.log('✅ [ItineraryImageLoader] Successfully fetched photo via API:', url);
            setDynamicUrl(url);
          } catch (error) {
            console.error('❌ [ItineraryImageLoader] Error getting photo URL:', error);
            setHadError(true);
          }
        } else {
          console.log('📍 [ItineraryImageLoader] No photos found via API, will use static map fallback');
          setHadError(true);
        }
        setIsLoading(false);
      };

      if (item.googlePlaceId) {
        service.getDetails({ placeId: item.googlePlaceId, fields: ['photos'] }, detailsCallback);
      } else if (item.placeName) {
        service.findPlaceFromQuery({ query: item.placeName, fields: ['place_id'] }, (results: any, status: any) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]?.place_id) {
            service.getDetails({ placeId: results[0].place_id, fields: ['photos'] }, detailsCallback);
          } else {
            setHadError(true);
            setIsLoading(false);
          }
        });
      } else {
          setHadError(true);
          setIsLoading(false);
      }
    };

    ensureScript(fetchPhoto);
  }, [item.googlePlaceId, item.placeName, item.googleMapsImageUrl]);
  
  const staticMapUrl = useMemo<string | null>(() => {
    // If we already have a static map URL from the form, use that first
    if (item.googleMapsImageUrl && item.googleMapsImageUrl.includes('staticmap')) {
      return item.googleMapsImageUrl;
    }
    
    // Otherwise generate a new static map if we have coordinates
    if (item.lat != null && item.lng != null && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      return `https://maps.googleapis.com/maps/api/staticmap?center=${item.lat},${item.lng}&zoom=15&size=600x400&markers=color:red%7C${item.lat},${item.lng}&maptype=satellite&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
    }
    return null;
  }, [item.lat, item.lng, item.googleMapsImageUrl]);

  const effectiveUrl = dynamicUrl || (hadError ? staticMapUrl : null);
  
  console.log('🖼️ [ItineraryImageLoader] Final URL resolution:', {
    dynamicUrl,
    hadError,
    staticMapUrl,
    effectiveUrl,
    willShowImage: !!effectiveUrl
  });

  return (
    <div className="h-full w-full bg-input rounded-lg relative overflow-hidden">
        {isLoading && (
             <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                <div className="animate-pulse text-muted-foreground">Loading image...</div>
            </div>
        )}
        {effectiveUrl && (
            <Image
              src={effectiveUrl}
              alt={altText || 'Location image'}
              fill
              className="object-cover"
              onError={() => {
                if(dynamicUrl) { // if the dynamic url fails, fallback to static
                    setDynamicUrl(null); 
                    setHadError(true);
                }
              }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
            />
        )}
        {!isLoading && !effectiveUrl && (
             <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                <p className="text-muted-foreground text-sm">No image available</p>
            </div>
        )}
    </div>
  );
} 