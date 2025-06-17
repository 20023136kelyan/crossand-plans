"use client";

import Image from "next/image";
import { useMemo, useEffect, useState } from "react";
// Icons replaced with emojis for a more playful look
import { cn } from '@/lib/utils';
import { getGooglePlacePhotoUrl } from '@/utils/googleMapsHelpers';
import type { ItineraryItem } from '@/types/plan';

/**
 * A lightweight, read-only card for displaying an itinerary item in the AI plan preview.
 * It loads the correct image (either a cached URL or one generated from a Google
 * photo reference) and shows basic details such as the place name, time window,
 * rating, and description.  All editing controls and heavy form logic have been
 * stripped out to keep the component fast and self-contained.
 */
interface ItineraryItemPreviewCardProps {
  item: ItineraryItem;
  /** Optional index (zero-based). Useful when you want to prepend an order badge. */
  index?: number;
  /** Render slightly denser (smaller paddings) variant */
  compact?: boolean;
  /** Show full description & suggestions when true */
  expanded?: boolean;
  /** Whether this card is currently active/visible */
  isActive?: boolean;
}

export function ItineraryItemPreviewCard({ 
  item, 
  index, 
  compact = false, 
  expanded = false,
  isActive = true 
}: ItineraryItemPreviewCardProps) {
  const [dynamicUrl, setDynamicUrl] = useState<string | null>(null);
  const [hadError, setHadError] = useState(false);

  // Lazily load the Google Maps JS API (places library) if we need to attempt photo fetching.
  useEffect(() => {
    if (dynamicUrl && !hadError) return; // already resolved
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;

    const ensureScript = (cb: () => void) => {
      if (typeof window === 'undefined') return;
      if (window.google && window.google.maps && window.google.maps.places) {
        cb();
      } else {
        const existing = document.querySelector<HTMLScriptElement>('script[data-gmaps="preview"]');
        if (existing) {
          existing.addEventListener('load', cb);
          return;
        }
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.dataset.gmaps = 'preview';
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
            setDynamicUrl(url);
          } catch (_) {
            /* ignore */
          }
        } else {
          // Unable to get photos; set error so we stop trying.
          setHadError(true);
        }
      };

      if (item.googlePlaceId) {
        service.getDetails({ placeId: item.googlePlaceId, fields: ['photos'] }, detailsCallback);
      } else if (item.placeName) {
        // First, get place id via findPlaceFromQuery
        service.findPlaceFromQuery({ query: item.placeName, fields: ['place_id'] }, (results: any, status: any) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]?.place_id) {
            service.getDetails({ placeId: results[0].place_id, fields: ['photos'] }, detailsCallback);
          } else {
            setHadError(true);
          }
        });
      }
    };

    ensureScript(fetchPhoto);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.googlePlaceId, item.placeName, dynamicUrl, hadError]);

  const basePhotoUrl = useMemo<string | null>(() => {
    if (item.googleMapsImageUrl) return item.googleMapsImageUrl;
    if (item.googlePhotoReference) return getGooglePlacePhotoUrl(item.googlePhotoReference, 800);
    if (item.lat !== null && item.lng !== null && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      return `https://maps.googleapis.com/maps/api/staticmap?center=${item.lat},${item.lng}&zoom=15&size=600x400&markers=color:red%7C${item.lat},${item.lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
    }
    return null;
  }, [item.googleMapsImageUrl, item.googlePhotoReference, hadError]);

  const effectiveUrl = dynamicUrl || basePhotoUrl;

  // Format start/end times gracefully.
  const start = item.startTime
    ? new Date(item.startTime).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;
  const end = item.endTime
    ? new Date(item.endTime).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  // Prepare collapsed text: prefer AI-generated tagline, otherwise truncated description.
  const truncatedDescription = item.description
    ? item.description.length > 60
      ? item.description.substring(0, 60).trim() + '…'
      : item.description
    : null;
  const collapsedText = item.tagline ?? truncatedDescription;

  return (
    <div className={cn(
      "flex flex-col rounded-xl overflow-hidden w-full transition-all duration-300",
      !isActive && "opacity-70 scale-95"
    )}>
      {/* Image Section - Full width rectangular container with rounded bottom corners */}
      <div className="relative w-full aspect-video overflow-hidden rounded-b-xl">
        {effectiveUrl && !hadError ? (
          <>
            <Image
              src={effectiveUrl}
              alt={item.placeName ?? 'Itinerary place image'}
              fill
              className="object-cover"
              onError={() => setHadError(true)}
              sizes="(max-width: 640px) 100vw, 100%"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/70 via-gray-800/40 to-transparent" />
            
            {/* Stop number badge */}
            {typeof index === 'number' && (
              <span className="absolute top-2 left-2 flex items-center rounded-full bg-background/90 backdrop-blur-sm px-2 py-1 text-xs font-semibold shadow-md">
                Stop {index + 1}
              </span>
            )}
            
            {/* Stop name overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 pt-8 bg-gradient-to-t from-black/70 via-black/40 to-transparent">
              <div className="flex justify-between items-start">
                <div>
                  {/* Stop name */}
                  {item.placeName && (
                    <h3 className="text-lg font-bold text-white">
                      {item.placeName}
                    </h3>
                  )}
                  {/* Location and Time */}
                  <div className="flex items-center gap-3 mt-1">
                    {item.address && (
                      <div className="flex items-center text-xs text-white/90">
                        <span className="mr-1">📍</span>
                        <span className="truncate max-w-[120px]" title={item.address}>
                          {item.address.split(',')[0]}
                        </span>
                      </div>
                    )}
                    
                    {start && (
                      <div className="flex items-center text-xs text-white/90">
                        <span className="mr-1">🕒</span>
                        {start}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Rating badge */}
                {typeof item.rating === 'number' && (
                  <div className="flex-shrink-0 bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-amber-500/20">
                    <span>⭐</span>
                    <span className="font-medium">{item.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted text-lg font-semibold text-muted-foreground">
            {typeof index === 'number' ? `Stop ${index + 1}` : 'Image'}
          </div>
        )}
      </div>

      {/* Text content container with background */}
      <div className="bg-muted/10 dark:bg-muted/20 px-4 pt-3 pb-3">
        {/* Description */}
        <div className="space-y-3 mt-2">
          {(collapsedText || (expanded && item.description)) && (
            <p className="text-sm text-foreground/80 leading-relaxed">
              {expanded ? (item.description ?? collapsedText) : collapsedText}
            </p>
          )}

          {/* Activity Suggestions */}
          {item.activitySuggestions && item.activitySuggestions.length > 0 && (
            <div className="mt-3 bg-muted/20 dark:bg-muted/40 p-3 rounded-lg">
              <div className="flex items-center text-sm font-semibold text-foreground/90 mb-2.5">
                <span className="mr-1.5">🎯</span>
                Suggested activities
              </div>
              <ul className="space-y-1.5">
                {item.activitySuggestions.map((activity, idx) => {
                  // Extract the first emoji from the activity text
                  const emojiMatch = activity.match(/^([\p{Emoji}\p{Emoji_Modifier_Base}\p{Emoji_Component}]+)/u);
                  const emoji = emojiMatch ? emojiMatch[0] : '•';
                  const text = emojiMatch ? activity.slice(emojiMatch[0].length).trim() : activity;
                  
                  return (
                    <li 
                      key={idx}
                      className="flex items-start group"
                    >
                      <span className="mr-2 mt-0.5 flex-shrink-0">{emoji}</span>
                      <span className="text-sm text-foreground/90 leading-tight">
                        {text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        
        {/* View on Maps CTA */}
        <div className="mt-3 pt-2 border-t border-border/40">
          <button 
            onClick={() => {
              if (item.lat && item.lng) {
                // Universal URL that works on both iOS and Android
                const url = `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
                window.open(url, '_blank');
              }
            }}
            disabled={!item.lat || !item.lng}
            className="w-full flex items-center justify-between text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>View on Maps</span>
            <span className="text-base">📍</span>
          </button>
        </div>
      </div>
    </div>
  );
}
