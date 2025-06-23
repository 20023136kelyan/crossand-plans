'use client';

import { useFormContext, Controller, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { format, addHours } from 'date-fns';
import { Clock, FileText, Trash2, MapPin, Plus, Lightbulb, Settings, ChevronDown, ArrowUpDown } from 'lucide-react';
import type { NewPlanFormValues } from './NewPlanForm';
import { PlaceAutocomplete } from '../ui/place-autocomplete';
import { Textarea } from '../ui/textarea';
import { cn } from '@/lib/utils';
import React from 'react';
import { ItineraryImageLoader } from './ItineraryImageLoader';
import { Input } from '../ui/input';

const PriceLevel = ({ level }: { level: number }) => {
    if (level === 0) return <span className="text-xs">Free</span>;
    return <span className="text-xs">{''.padStart(level, '$')}</span>;
};

const Rating = ({ value }: { value: number }) => (
    <div className="flex items-center gap-1 text-xs">
        <span>⭐</span>
        <span>{value.toFixed(1)}</span>
    </div>
);

const TypePill = ({ types }: { types: string[] }) => {
    const primaryType = types?.[0]?.replace(/_/g, ' ') ?? 'Place';
    return <span className="text-xs capitalize">{primaryType}</span>;
}

const StatusPill = ({ isOperational, statusText }: { isOperational: boolean | null | undefined, statusText?: string | null }) => {
    if (isOperational == null) return null;
    
    // Enhanced status text that considers time-based information
    let displayText = '';
    if (isOperational) {
      if (statusText?.includes('Open during visit')) {
        displayText = 'Open';
      } else if (statusText?.includes('OPERATIONAL')) {
        displayText = 'Open';
      } else {
        displayText = 'Open';
      }
    } else {
      if (statusText?.includes('Closed at')) {
        displayText = 'Closed';
      } else if (statusText?.includes('closes before')) {
        displayText = 'Closes Early';
      } else if (statusText?.includes('Closed during')) {
        displayText = 'Closed';
      } else {
        displayText = statusText ? statusText.replace(/_/g, ' ') : 'Closed';
      }
    }
    
    const color = isOperational ? 'text-green-400' : 'text-red-400';
    return <span className={cn("text-xs capitalize", color)} title={statusText || undefined}>{displayText}</span>;
};

// Enhanced function to calculate operational status at planned visit time
const calculateOperationalStatusAtPlannedTime = (
  place: any, 
  startTime: Date | null, 
  endTime: Date | null
): { isOperational: boolean | null; statusText: string | null } => {
  
  // If no planned times, fall back to current/general status
  if (!startTime) {
    if (place.business_status) {
      return {
        isOperational: place.business_status === 'OPERATIONAL',
        statusText: place.business_status
      };
    }
    // Note: open_now is deprecated, so we don't use it anymore
    return { isOperational: null, statusText: null };
  }

  // If we have opening hours, check against planned time
  if (place.opening_hours?.weekday_text && place.opening_hours.weekday_text.length > 0) {
    const openingHours = place.opening_hours.weekday_text;
    
    // Check if open during start time
    const isOpenAtStart = isPlaceOpenAtTime(openingHours, startTime);
    
    // If we have an end time, also check if open during end time
    let isOpenAtEnd: boolean | null = true; // Default to true if no end time
    if (endTime) {
      isOpenAtEnd = isPlaceOpenAtTime(openingHours, endTime);
    }
    
    // Place must be open for the entire duration
    const isOpenDuringVisit = (isOpenAtStart === true) && (isOpenAtEnd === true);
    
    if (isOpenAtStart === null) {
      // Could not determine from opening hours, fall back to business status
      return {
        isOperational: place.business_status === 'OPERATIONAL' ? true : null,
        statusText: 'Hours information incomplete'
      };
    }
    
    // Generate appropriate status text
    let statusText = '';
    if (!isOpenAtStart) {
      statusText = `Closed at ${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else if (endTime && !isOpenAtEnd) {
      statusText = `Open at start, closes before ${endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else if (isOpenDuringVisit) {
      statusText = `Open during visit (${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })})`;
    } else {
      statusText = 'Closed during planned visit';
    }
    
    return {
      isOperational: isOpenDuringVisit,
      statusText: statusText
    };
  }

  // Fallback to general business status if no specific hours
  if (place.business_status) {
    return {
      isOperational: place.business_status === 'OPERATIONAL',
      statusText: place.business_status
    };
  }

  // Note: open_now is deprecated, so we don't use it anymore
  // If we have opening hours but no planned time, we can't determine current status
  // without using the deprecated open_now or making additional API calls
  return { isOperational: null, statusText: null };
};

// Helper function to check if a place is open at a specific time
const isPlaceOpenAtTime = (weekdayText: string[], checkTime: Date): boolean | null => {
  try {
    const dayOfWeek = checkTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayHours = weekdayText[dayOfWeek];
    
    if (!dayHours) return null;
    
    // Handle "Closed" days
    if (dayHours.toLowerCase().includes('closed')) {
      return false;
    }
    
    // Handle "Open 24 hours" or "24 hours"
    if (dayHours.toLowerCase().includes('24 hours') || dayHours.toLowerCase().includes('open 24')) {
      return true;
    }
    
    // Parse opening hours format: "Monday: 9:00 AM – 5:00 PM"
    const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i;
    const match = dayHours.match(timeRegex);
    
    if (!match) {
      // Could not parse, return null (unknown)
      console.warn('Could not parse opening hours:', dayHours);
      return null;
    }
    
    const [, openHour, openMin, openPeriod, closeHour, closeMin, closePeriod] = match;
    
    // Convert to 24-hour format
    let openTime24 = parseInt(openHour);
    if (openPeriod.toUpperCase() === 'PM' && openTime24 !== 12) openTime24 += 12;
    if (openPeriod.toUpperCase() === 'AM' && openTime24 === 12) openTime24 = 0;
    
    let closeTime24 = parseInt(closeHour);
    if (closePeriod.toUpperCase() === 'PM' && closeTime24 !== 12) closeTime24 += 12;
    if (closePeriod.toUpperCase() === 'AM' && closeTime24 === 12) closeTime24 = 0;
    
    // Handle overnight hours (e.g., 10 PM - 2 AM)
    if (closeTime24 < openTime24) {
      closeTime24 += 24;
    }
    
    // Convert check time to minutes since midnight
    const checkHour = checkTime.getHours();
    const checkMin = checkTime.getMinutes();
    const checkTimeMinutes = checkHour * 60 + checkMin;
    
    const openTimeMinutes = openTime24 * 60 + parseInt(openMin);
    let closeTimeMinutes = closeTime24 * 60 + parseInt(closeMin);
    
    // Handle overnight case
    if (closeTime24 >= 24) {
      // Place closes after midnight
      return checkTimeMinutes >= openTimeMinutes || checkTimeMinutes <= (closeTimeMinutes - 24 * 60);
}
    
    // Normal case - same day
    return checkTimeMinutes >= openTimeMinutes && checkTimeMinutes <= closeTimeMinutes;
    
  } catch (error) {
    console.error('Error parsing opening hours:', error);
    return null;
  }
};

interface ItineraryItemProps {
  index: number;
  isGoogleMapsApiLoaded: boolean;
  onRemove: () => void;
  isActive?: boolean;
  animationDirection?: 'left' | 'right' | 'none';
  onEnterReorderMode?: () => void;
  totalItems?: number;
}

export function ItineraryItem({ index, isGoogleMapsApiLoaded, onRemove, isActive, animationDirection, onEnterReorderMode, totalItems = 1 }: ItineraryItemProps) {
  const { control, setValue, watch } = useFormContext<NewPlanFormValues>();
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [startTime, endTime, placeName, lat, lng, googlePlaceId, googleMapsImageUrl, rating, priceLevel, types, isOperational, statusText, placeDetails] = watch([
    `itinerary.${index}.startTime`, 
    `itinerary.${index}.endTime`,
    `itinerary.${index}.placeName`,
    `itinerary.${index}.lat`,
    `itinerary.${index}.lng`,
    `itinerary.${index}.googlePlaceId`,
    `itinerary.${index}.googleMapsImageUrl`,
    `itinerary.${index}.rating`,
    `itinerary.${index}.priceLevel`,
    `itinerary.${index}.types`,
    `itinerary.${index}.isOperational`,
    `itinerary.${index}.statusText`,
    `itinerary.${index}.placeDetails`,
  ]);

  const { fields, append, remove: removeSuggestion } = useFieldArray({
      control,
      name: `itinerary.${index}.activitySuggestions`
  });

  // Re-calculate operational status when times change
  React.useEffect(() => {
    if (placeDetails && (startTime || endTime)) {
      const operationalStatus = calculateOperationalStatusAtPlannedTime(placeDetails, startTime || null, endTime || null);
      setValue(`itinerary.${index}.isOperational`, operationalStatus.isOperational);
      setValue(`itinerary.${index}.statusText`, operationalStatus.statusText);
      
      console.log('🔄 [ItineraryItem] Operational status updated due to time change:', {
        timestamp: new Date().toISOString(),
        index: index,
        newStartTime: startTime?.toISOString(),
        newEndTime: endTime?.toISOString(),
        updatedStatus: operationalStatus
      });
    }
  }, [startTime, endTime, placeDetails, index, setValue]);

  // Debug image URL changes
  React.useEffect(() => {
    console.log(`🖼️ [ItineraryItem] Image URL changed for index ${index}:`, {
      placeName,
      googleMapsImageUrl,
      hasUrl: !!googleMapsImageUrl,
      urlType: googleMapsImageUrl?.includes('photo') ? 'photo' : 
               googleMapsImageUrl?.includes('staticmap') ? 'static' : 'unknown'
    });
  }, [googleMapsImageUrl, placeName, index]);

  const handlePlaceSelect = (place: any) => {
    // 🔍 DETAILED LOGGING - Place Selection
    console.log('🎯 [ItineraryItem] handlePlaceSelect called:', {
      timestamp: new Date().toISOString(),
      index: index,
      placeName: place.name,
      placeId: place.place_id,
      rating: place.rating,
      reviewCount: place.user_ratings_total,
      priceLevel: place.price_level,
      businessStatus: place.business_status,
      photos: place.photos?.length || 0,
      fullPlace: place
    });

    // Basic place information
    setValue(`itinerary.${index}.placeName`, place.name || '');
    setValue(`itinerary.${index}.address`, place.formatted_address ?? null);
    setValue(`itinerary.${index}.googlePlaceId`, place.place_id ?? null);
    
    // Coordinates - handle both function and property formats
    const lat = typeof place.geometry?.location?.lat === 'function' 
      ? place.geometry.location.lat() 
      : place.geometry?.location?.lat;
    const lng = typeof place.geometry?.location?.lng === 'function' 
      ? place.geometry.location.lng() 
      : place.geometry?.location?.lng;
    setValue(`itinerary.${index}.lat`, lat ?? null);
    setValue(`itinerary.${index}.lng`, lng ?? null);
    
    // Ratings and reviews
    setValue(`itinerary.${index}.rating`, place.rating ?? null);
    setValue(`itinerary.${index}.reviewCount`, place.user_ratings_total ?? null);
    
    // Price and business info
    setValue(`itinerary.${index}.priceLevel`, place.price_level !== undefined ? place.price_level : null);
    setValue(`itinerary.${index}.types`, place.types ?? []);
    
    // Contact information
    setValue(`itinerary.${index}.phoneNumber`, place.formatted_phone_number ?? place.international_phone_number ?? null);
    setValue(`itinerary.${index}.website`, place.website ?? null);
    
    // Opening hours - handle both formats
    const openingHours = place.opening_hours?.weekday_text ?? [];
    setValue(`itinerary.${index}.openingHours`, openingHours);
    
    // Enhanced operational status calculation based on planned visit time
    const plannedStartTime = startTime || null;
    const plannedEndTime = endTime || null;
    const operationalStatus = calculateOperationalStatusAtPlannedTime(place, plannedStartTime, plannedEndTime);
    
    setValue(`itinerary.${index}.isOperational`, operationalStatus.isOperational);
    setValue(`itinerary.${index}.statusText`, operationalStatus.statusText);
    
    // Handle photos with static map fallback
    console.log('🖼️ [ItineraryItem] Photo handling:', {
      hasPhotos: !!(place.photos && place.photos.length > 0),
      photoCount: place.photos?.length || 0,
      firstPhoto: place.photos?.[0],
      hasGetUrl: typeof place.photos?.[0]?.getUrl === 'function',
      photoReference: place.photos?.[0]?.photo_reference,
      apiKeyAvailable: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    });

    if (place.photos && place.photos.length > 0) {
      const photo = place.photos[0];
      let photoUrl = null;
      
      // PRIORITY 1: Use photo reference to construct proper URL (most reliable)
      if (photo.photo_reference) {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (apiKey) {
          photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${encodeURIComponent(photo.photo_reference)}&key=${apiKey}`;
          console.log('✅ [ItineraryItem] Photo URL generated via photo reference:', photoUrl);
        } else {
          console.warn('⚠️ [ItineraryItem] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not available');
        }
      }
      
      // PRIORITY 2: Fallback to getUrl() method only if photo reference fails
      if (!photoUrl && typeof photo.getUrl === 'function') {
        try {
          const getUrlResult = photo.getUrl({ maxWidth: 800, maxHeight: 400 });
          // Check if the result is a proper HTTP URL, not a callback URL
          if (getUrlResult && (getUrlResult.startsWith('https://') || getUrlResult.startsWith('http://')) && !getUrlResult.includes('callback=')) {
            photoUrl = getUrlResult;
            console.log('✅ [ItineraryItem] Photo URL generated via getUrl():', photoUrl);
          } else {
            console.warn('⚠️ [ItineraryItem] getUrl() returned invalid URL format:', getUrlResult);
          }
        } catch (error) {
          console.error('❌ [ItineraryItem] Error calling getUrl():', error);
        }
      }
      
      // PRIORITY 3: Direct URL if available
      if (!photoUrl && photo.url) {
        photoUrl = photo.url;
        console.log('✅ [ItineraryItem] Using direct photo URL:', photoUrl);
      }
      
      // If we got a photo URL, use it; otherwise fall back to static map
      if (photoUrl) {
        setValue(`itinerary.${index}.googleMapsImageUrl`, photoUrl);
        setValue(`itinerary.${index}.googlePhotoReference`, photo.photo_reference ?? null);
        console.log('🖼️ [ItineraryItem] Photo URL successfully set:', photoUrl);
      } else {
        console.warn('⚠️ [ItineraryItem] Could not generate photo URL, falling back to static map');
        setValue(`itinerary.${index}.googlePhotoReference`, null);
        
        // Fallback to static map
        if (lat && lng) {
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          if (apiKey) {
            const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=800x400&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
            setValue(`itinerary.${index}.googleMapsImageUrl`, staticMapUrl);
            console.log('📍 [ItineraryItem] Static map URL set as photo fallback:', staticMapUrl);
          } else {
            setValue(`itinerary.${index}.googleMapsImageUrl`, null);
          }
        } else {
          setValue(`itinerary.${index}.googleMapsImageUrl`, null);
        }
      }
    } else {
      console.log('📍 [ItineraryItem] No photos available, using static map fallback');
      setValue(`itinerary.${index}.googlePhotoReference`, null);
      
      // Fallback to Google Static Map when no photos are available
      if (lat && lng) {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (apiKey) {
          const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=800x400&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
          setValue(`itinerary.${index}.googleMapsImageUrl`, staticMapUrl);
          console.log('📍 [ItineraryItem] Static map URL set (no photos):', staticMapUrl);
        } else {
          setValue(`itinerary.${index}.googleMapsImageUrl`, null);
          console.warn('⚠️ [ItineraryItem] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not available for static map');
        }
      } else {
        setValue(`itinerary.${index}.googleMapsImageUrl`, null);
        console.log('📍 [ItineraryItem] No coordinates available for static map');
      }
    }

    // Extract city from address components with better fallback
    let city = '';
    if (place.address_components) {
      // Try different locality types in order of preference
      const cityTypes = [
        'locality',                          // City
        'sublocality_level_1',              // Neighborhood  
        'administrative_area_level_2',       // County
        'administrative_area_level_1'        // State/Province
      ];
      
      for (const cityType of cityTypes) {
      const cityComponent = place.address_components.find((component: any) =>
          component.types.includes(cityType)
      );
      if (cityComponent) {
        city = cityComponent.long_name;
          break;
        }
      }
    }
    setValue(`itinerary.${index}.city`, city || null);
    
    // Store the complete place details for future reference
    setValue(`itinerary.${index}.placeDetails`, place);

    // 🔍 DETAILED LOGGING - Final Form Values Set
    console.log('✅ [ItineraryItem] All form values set:', {
      timestamp: new Date().toISOString(),
      index: index,
      plannedTimes: {
        startTime: plannedStartTime?.toISOString(),
        endTime: plannedEndTime?.toISOString(),
      },
      operationalStatus: operationalStatus,
      formValues: {
        placeName: place.name || '',
        address: place.formatted_address ?? null,
        googlePlaceId: place.place_id ?? null,
        rating: place.rating ?? null,
        reviewCount: place.user_ratings_total ?? null,
        priceLevel: place.price_level ?? null,
        lat: lat ?? null,
        lng: lng ?? null,
        city: city || null,
        isOperational: operationalStatus.isOperational,
        statusText: operationalStatus.statusText,
        phoneNumber: place.formatted_phone_number || place.international_phone_number || null,
        website: place.website ?? null,
        types: place.types ?? [],
        openingHours: place.opening_hours?.weekday_text || [],
        googleMapsImageUrl: googleMapsImageUrl,
        photoUrl: place.photos?.[0] ? 'Generated from getUrl()' : null,
      }
    });
  };

  const animationClass = isActive 
    ? (animationDirection === 'right' ? 'animate-slide-in-from-right' : 'animate-slide-in-from-left')
    : 'opacity-0';

  const timeZone = new Date().toLocaleTimeString('en-us',{timeZoneName:'short'}).split(' ')[2]

  return (
    <div className={cn("bg-transparent w-full h-full perspective-1000")}>
        <div 
            className={cn("relative w-full h-full transition-transform duration-700 transform-style-preserve-3d", isFlipped && "rotate-y-180")}
        >
            {/* Front of the card */}
            <div className="absolute w-full h-full backface-hidden">
                <div className={cn(
                  "bg-card border border-border/60 rounded-xl transition-all duration-500 w-full h-full flex flex-col overflow-hidden",
                  !isActive && "scale-95 opacity-60"
                )}>
                    <div className={cn('p-4 space-y-4 transition-opacity duration-300', animationClass)}>
                        <div className="h-48 w-full bg-input rounded-lg relative overflow-hidden">
                            <ItineraryImageLoader 
                                item={{ placeName, lat, lng, googlePlaceId, googleMapsImageUrl }}
                                altText={placeName || `Itinerary stop ${index + 1}`}
                            />
                            {(rating != null || priceLevel != null || (types && types.length > 0) || isOperational != null) && (
                                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {rating != null && (
                                          <div className="bg-background/80 backdrop-blur-sm text-foreground rounded-full px-3 py-1 font-medium">
                                              <Rating value={rating} />
                                          </div>
                                      )}
                                      {priceLevel != null && (
                                          <div className="bg-background/80 backdrop-blur-sm text-foreground rounded-full px-3 py-1 font-medium">
                                              <PriceLevel level={priceLevel} />
                                          </div>
                                      )}
                                      {types && types.length > 0 && (
                                          <div className="bg-background/80 backdrop-blur-sm text-foreground rounded-full px-3 py-1 font-medium">
                                              <TypePill types={types} />
                                          </div>
                                      )}
                                      {isOperational !== null && (
                                          <div className="bg-background/80 backdrop-blur-sm text-foreground rounded-full px-3 py-1 font-medium">
                                              <StatusPill isOperational={isOperational} statusText={statusText} />
                                          </div>
                                      )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Location Search Section */}
                        <div className="flex items-center gap-3 py-2.5 px-4 bg-input rounded-lg">
                            <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <PlaceAutocomplete
                                onPlaceSelect={handlePlaceSelect}
                                placeholder="Search for a place or address"
                                isGoogleMapsApiLoaded={isGoogleMapsApiLoaded}
                                className="bg-transparent border-none w-full focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground text-base"
                            />
                        </div>
                        
                        <Controller
                            name={`itinerary.${index}.startTime`}
                            control={control}
                            render={({ field }) => {
                                // Convert Date to datetime-local string format
                                const formatDateTimeLocal = (date: Date | null) => {
                                    if (!date) return '';
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(2, '0');
                                    const hours = String(date.getHours()).padStart(2, '0');
                                    const minutes = String(date.getMinutes()).padStart(2, '0');
                                    return `${year}-${month}-${day}T${hours}:${minutes}`;
                                };

                                return (
                                    <div className="relative flex items-center gap-4 rounded-lg bg-input p-4 cursor-pointer hover:bg-input/80 transition-colors">
                                    <Clock className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                                        <div className="flex-grow pointer-events-none">
                                            <p className="font-semibold text-foreground text-base">
                                                {startTime ? format(startTime, 'eeee, MMMM d') : "Select a date"}
                                            </p>
                                        <p className="text-sm text-muted-foreground">
                                            {startTime ? format(startTime, 'p') : "Start time"}
                                            {' — '}
                                            {endTime ? format(endTime, 'p') : "End time"}
                                            {` ${timeZone}`}
                                        </p>
                                    </div>
                                        <div className="text-muted-foreground pointer-events-none">
                                            <ChevronDown className="h-4 w-4" />
                                    </div>
                                    <input
                                        type="datetime-local"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            value={formatDateTimeLocal(startTime || null)}
                                        onChange={(e) => {
                                                if (e.target.value) {
                                            const newDate = new Date(e.target.value);
                                            field.onChange(newDate);
                                            setValue(`itinerary.${index}.endTime`, addHours(newDate, 1));
                                                }
                                        }}
                                    />
                                </div>
                                );
                            }}
                        />

                        {/* Description Section */}
                        <div className="flex items-start gap-4 py-3 px-4 bg-input rounded-lg">
                            <FileText className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                            <Controller
                                control={control}
                                name={`itinerary.${index}.description`}
                                render={({ field }) => (
                                    <Textarea placeholder="Add Description" {...field} value={field.value ?? ''} className="bg-transparent border-none min-h-[50px] p-0 focus-visible:ring-0 shadow-none text-base resize-none" />
                                )}
                            />
                        </div>
                    </div>
                    <div className="py-1.5 px-4 border-t border-border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={onEnterReorderMode}
                                    disabled={totalItems <= 1}
                                    className="h-8 w-8 text-muted-foreground hover:text-primary disabled:opacity-50"
                                    title="Reorder items"
                                >
                                    <ArrowUpDown className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={onRemove}
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    title="Delete item"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={() => setIsFlipped(true)} 
                                className="gap-2 text-muted-foreground text-sm"
                            >
                                <Settings className="h-4 w-4" />
                                <span>Advanced Settings</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Back of the card */}
            <div className="absolute w-full h-full backface-hidden rotate-y-180">
                <div className="bg-card border border-border/60 rounded-xl w-full h-full flex flex-col overflow-hidden">
                    <div className="flex-grow space-y-3 p-4">
                        <div className="flex items-center gap-4">
                            <Lightbulb className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <h4 className="text-base font-semibold text-foreground">Suggested Activities</h4>
                        </div>
                        <div className="space-y-2">
                            {fields.map((field, s_index) => (
                                <div key={field.id} className="flex items-center gap-2">
                                    <Controller
                                        control={control}
                                        name={`itinerary.${index}.activitySuggestions.${s_index}`}
                                        render={({ field: suggestionField }) => (
                                            <Input 
                                                {...suggestionField}
                                                value={suggestionField.value || ''}
                                                placeholder={`Suggestion ${s_index + 1}...`}
                                                className="bg-input rounded-md h-9 text-sm"
                                            />
                                        )}
                                    />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeSuggestion(s_index)} className="h-9 w-9 flex-shrink-0">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            {fields.length < 3 && (
                                <Button type="button" variant="ghost" onClick={() => append('')} className="w-full justify-start gap-2 text-muted-foreground">
                                    <Plus className="h-4 w-4" />
                                    Add Suggestion
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="pt-2 border-t border-border">
                        <Button type="button" variant="ghost" onClick={() => setIsFlipped(false)} className="w-full justify-center gap-2 text-muted-foreground">
                            Done
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
} 