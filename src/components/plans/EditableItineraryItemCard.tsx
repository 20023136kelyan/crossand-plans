'use client';

import type { Control, UseFieldArrayRemove, UseFieldArrayMove } from 'react-hook-form';
import { useFormContext, Controller, useWatch } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Trash2, Sparkles, CheckCircle, XCircle, ExternalLink, Clock, Car, Footprints, Bike, TramFront, Loader2, Edit3, Save, Ban, MoveUp, MoveDown, CalendarClock } from 'lucide-react';
import type { PlanFormValues, ItineraryItemSchemaValues } from './PlanForm';
import React, { useEffect, useRef, useState, useCallback, memo, useMemo } from 'react'; // Added memo and useMemo
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { TransitMode } from '@/types/user';
import { getDirectionsAction } from '@/app/actions/planActions';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { getGooglePlacePhotoUrl } from '@/utils/googleMapsHelpers';

interface EditableItineraryItemCardProps {
  control: Control<PlanFormValues>;
  index: number;
  remove: UseFieldArrayRemove;
  move: UseFieldArrayMove; // Add move prop
  isGoogleMapsApiLoaded: boolean;
  // previousItem: ItineraryItemSchemaValues | null; // Removed
  previousItemLat?: number | null;
  previousItemLng?: number | null;
  previousItemStartTime?: string | null;
  previousItemEndTime?: string | null;
  isFirst: boolean; // To disable "Move Up"
  isLast: boolean;  // To disable "Move Down"
  isOnlyItem?: boolean; // To disable remove if it's the only item in a single-stop plan
}

const transitModeOptions: { value: TransitMode; label: string; icon: React.ElementType }[] = [
  { value: 'driving', label: 'Driving', icon: Car },
  { value: 'walking', label: 'Walking', icon: Footprints },
  { value: 'bicycling', label: 'Bicycling', icon: Bike },
  { value: 'transit', label: 'Transit', icon: TramFront },
];

// Renamed to EditableItineraryItemCardImpl and changed to a const
const EditableItineraryItemCardImpl = ({
  control,
  index,
  remove,
  move, // Destructure move
  isGoogleMapsApiLoaded,
  // previousItem, // Removed (already correct)
  previousItemLat,
  previousItemLng,
  previousItemStartTime,
  previousItemEndTime,
  isFirst,
  isLast,
  isOnlyItem,
}: EditableItineraryItemCardProps) => {
  const { setValue, watch, getValues, formState: { errors } } = useFormContext<PlanFormValues>();
  const { toast } = useToast();
  const [imageError, setImageError] = useState(false);
  
  // Type-safe field paths
  const getFieldPath = useCallback((field: keyof ItineraryItemSchemaValues) => 
    `itinerary.${index}.${field}` as const, [index]);
  
  // Watch specific fields with proper typing
  const currentItem = watch(`itinerary.${index}`) as ItineraryItemSchemaValues;
  const placeName = watch(getFieldPath('placeName'));
  const itemId = watch(getFieldPath('id'));
  
  const [isEditing, setIsEditing] = useState(
    !placeName && (!itemId || !String(itemId).startsWith('initial-'))
  );
  
  const [itemDataBeforeEdit, setItemDataBeforeEdit] = useState<Partial<ItineraryItemSchemaValues> | null>(null);
  
  const placeNameInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);

  const watchedRhfPlaceName = useWatch({ control, name: getFieldPath('placeName') }) || '';
  const [internalPlaceName, setInternalPlaceName] = useState<string>(String(watchedRhfPlaceName));
  const placeNameDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [autocompleteSetupTrigger, setAutocompleteSetupTrigger] = useState(0);

  useEffect(() => {
    if (watchedRhfPlaceName !== internalPlaceName) {
      setInternalPlaceName(String(watchedRhfPlaceName));
    }
  }, [watchedRhfPlaceName]); // Removed internalPlaceName from deps

  useEffect(() => {
    return () => {
      if (placeNameDebounceTimeoutRef.current) {
        clearTimeout(placeNameDebounceTimeoutRef.current);
      }
      if (transitTimeDebounceRef.current) {
        clearTimeout(transitTimeDebounceRef.current);
      }
    };
  }, []);

  // Memoize the current item to prevent unnecessary re-renders
  const currentItemMemo = useMemo(() => watch(`itinerary.${index}`), [watch, index]);
  
  // Function to clean up existing addresses that might have full formatted address
  const cleanAddress = useCallback((rawAddress: string | null | undefined): string => {
    if (!rawAddress) return '';
    
    // If address contains state/country info, clean it up
    const parts = rawAddress.split(',').map(part => part.trim());
    
    // Remove parts that look like state codes, zip codes, or countries
    const cleanedParts = parts.filter((part, index) => {
      // Skip if it's a 2-letter state code (like "CA", "NY")
      if (part.length === 2 && /^[A-Z]{2}$/.test(part)) return false;
      
      // Skip if it's a zip code (5 digits or 5+4 format)
      if (/^\d{5}(-\d{4})?$/.test(part)) return false;
      
      // Skip if it's "USA", "United States", or other common country names
      if (['USA', 'United States', 'US'].includes(part)) return false;
      
      // Keep first 2 parts (usually street + city)
      return index < 2;
    });
    
    return cleanedParts.join(', ');
  }, []);
  
  const { 
    address: rawAddress, city, description, startTime, endTime,
    lat: itemLat, 
    lng: itemLng, 
    googlePhotoReference, 
    rating, 
    reviewCount, 
    isOperational, 
    statusText, 
    activitySuggestions, 
    openingHours, 
    phoneNumber, 
    website, 
    types, 
    priceLevel,
    transitMode,
    transitTimeFromPreviousMinutes 
  } = currentItem || {} as ItineraryItemSchemaValues;
  
  // Clean the address for display
  const address = cleanAddress(rawAddress);
  
  const [isFetchingTransitTime, setIsFetchingTransitTime] = useState(false);
  const transitTimeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // console.log(`Rendering EditableItineraryItemCard for index: ${index}, placeName: ${placeName}`);

  const toggleEditMode = () => {
    if (!isEditing) {
      setItemDataBeforeEdit(JSON.parse(JSON.stringify(getValues(`itinerary.${index}`))));
    }
    setIsEditing(prev => !prev);
  };

  const handleSaveItem = () => {
    // Trigger validation for the current item if needed, though react-hook-form handles it on submit
    setIsEditing(false);
    // Recalculate transit time if location changed, potentially needed here if coords changed
    fetchTransitTimeCallback(); 
  };

  const handleCancelEdit = () => {
    if (itemDataBeforeEdit) {
      Object.keys(itemDataBeforeEdit).forEach(key => {
        const fieldKey = key as keyof ItineraryItemSchemaValues;
        setValue(`itinerary.${index}.${fieldKey}`, itemDataBeforeEdit[fieldKey]);
      });
    }
    setIsEditing(false);
  };

  const handlePlaceChanged = useCallback((place: google.maps.places.PlaceResult) => {
    if (!place) return;

    // Extract address components for a clean, minimal display
    const addressComponents = place.address_components || [];
    const streetNumber = addressComponents.find(c => c.types.includes('street_number'))?.long_name || '';
    const streetName = addressComponents.find(c => c.types.includes('route'))?.long_name || '';
    const city = addressComponents.find(c => 
      c.types.includes('locality') || 
      c.types.includes('postal_town') || 
      c.types.includes('administrative_area_level_2')
    )?.long_name || '';
    
    // Create a minimal address display (only street number + street name + city)
    // Explicitly exclude state, zip code, and country for cleaner visual presentation
    let conciseAddress = '';
    if (streetNumber && streetName && city) {
      conciseAddress = `${streetNumber} ${streetName}, ${city}`;
    } else if (streetName && city) {
      conciseAddress = `${streetName}, ${city}`;
    } else if (city) {
      conciseAddress = city;
    } else {
      // If no components available, extract only essential parts from formatted address
      const formatted = place.formatted_address || '';
      // Try to extract just the first part before any state/country info
      const parts = formatted.split(',');
      if (parts.length >= 2) {
        // Take first two parts (usually street + city) and exclude the rest
        conciseAddress = parts.slice(0, 2).join(',').trim();
      } else {
        conciseAddress = formatted;
      }
    }

    // Batch our setValue calls to reduce re-renders
    // placeName is now set directly in the place_changed listener
    const updates: Partial<Record<keyof ItineraryItemSchemaValues, unknown>> = {
      address: conciseAddress,
      city: city || null,
      lat: place.geometry?.location?.lat() ?? null,
      lng: place.geometry?.location?.lng() ?? null,
      googlePlaceId: place.place_id || null,
      googlePhotoReference: place.photos?.[0]?.getUrl?.() || null,
      rating: place.rating ?? null,
      reviewCount: place.user_ratings_total ?? null,
      openingHours: place.opening_hours?.weekday_text || [],
      phoneNumber: place.international_phone_number || null,
      website: place.website || null,
      priceLevel: place.price_level ?? null,
      types: place.types || [],
      isOperational: place.business_status === 'OPERATIONAL',
      statusText: place.business_status || null
      // transitMode: (place.types?.includes('transit_station') ? 'transit' : 'driving') as TransitMode, // Keep original transitMode unless explicitly changed by place type
    };

    // Update all fields at once with type-safe paths
    (Object.entries(updates) as [keyof ItineraryItemSchemaValues, unknown][]).forEach(([key, value]) => {
      setValue(getFieldPath(key), value as any, { shouldValidate: false });
    });
  }, [setValue, getFieldPath]);

  useEffect(() => {
    if (!isEditing || !isGoogleMapsApiLoaded || !placeNameInputRef.current || typeof window === 'undefined' || !window.google || !window.google.maps || !window.google.maps.places) {
      return;
    }

    // Only create a new autocomplete instance if we don't have one or if the input has changed
    if (autocompleteRef.current?.input === placeNameInputRef.current) {
      return;
    }

    // Clean up any existing autocomplete
    if (autocompleteRef.current) {
      autocompleteRef.current.remove();
      autocompleteRef.current = null;
    }

    // @ts-ignore - PlaceAutocompleteElement is available in the new Places API
    const newAutocomplete = new window.google.maps.places.PlaceAutocompleteElement({
      includedPrimaryTypes: ['geocode', 'establishment']
    });

    // Replace the input element with the new autocomplete element
    if (placeNameInputRef.current && placeNameInputRef.current.parentNode) {
      placeNameInputRef.current.parentNode.replaceChild(newAutocomplete, placeNameInputRef.current);
      // Update the ref to point to the new element
      placeNameInputRef.current = newAutocomplete as any;
    }

    // @ts-ignore - gmp-select event is available in the new Places API
    newAutocomplete.addEventListener('gmp-select', async (event: any) => {
      const { placePrediction } = event;
      if (!placePrediction) return;

      const place = placePrediction.toPlace();
      await place.fetchFields({
        fields: [
          'displayName', 
          'formattedAddress', 
          'addressComponents', 
          'location', 
          'id', 
          'photos', 
          'rating', 
          'userRatingCount', 
          'regularOpeningHours', 
          'internationalPhoneNumber', 
          'websiteURI', 
          'priceLevel', 
          'types', 
          'businessStatus'
        ]
      });

      // Convert new API fields to legacy format for compatibility
      const legacyPlace = {
        name: place.displayName,
        formatted_address: place.formattedAddress,
        address_components: place.addressComponents,
        geometry: place.location ? {
          location: {
            lat: () => place.location.lat,
            lng: () => place.location.lng
          }
        } : undefined,
        place_id: place.id,
        photos: place.photos,
        rating: place.rating,
        user_ratings_total: place.userRatingCount,
        opening_hours: place.regularOpeningHours,
        international_phone_number: place.internationalPhoneNumber,
        website: place.websiteURI,
        price_level: place.priceLevel,
        types: place.types,
        business_status: place.businessStatus
      };

      // Ensure place has a name or formatted_address to proceed
      if (legacyPlace.name || legacyPlace.formatted_address) {
        const placeNameValue = legacyPlace.name || ''; // Only use place.name for the place name field
        
        // Immediately update local state for responsive UI
        setInternalPlaceName(placeNameValue); 
  
        // Immediately update React Hook Form state for 'placeName'
        setValue(getFieldPath('placeName'), placeNameValue, { 
          shouldValidate: true, 
          shouldDirty: true 
        });
  
        // Clear any debounce timeout that might have been set by typing
        if (placeNameDebounceTimeoutRef.current) {
          clearTimeout(placeNameDebounceTimeoutRef.current);
        }
  
        // Call handlePlaceChanged with the legacy-formatted place object
        handlePlaceChanged(legacyPlace);
      }
    });

    autocompleteRef.current = newAutocomplete;

    return () => {
      if (autocompleteRef.current) {
        autocompleteRef.current.remove();
        autocompleteRef.current = null;
      }
    };
  }, [isEditing, isGoogleMapsApiLoaded, handlePlaceChanged, autocompleteSetupTrigger]);

  // Additional useEffect to handle autocomplete setup on mount for items that start in editing mode
  useEffect(() => {
    // Small delay to ensure the input ref is properly set
    const timer = setTimeout(() => {
      if (isEditing && isGoogleMapsApiLoaded && placeNameInputRef.current && !autocompleteRef.current) {
        // Trigger the autocomplete setup by incrementing the trigger
        setAutocompleteSetupTrigger(prev => prev + 1);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []); // Only run on mount

  const fetchTransitTimeCallback = useCallback(async () => {
    // Only fetch if we have all required data and something has changed
    if (index > 0 && 
        previousItemLat && 
        previousItemLng && 
        itemLat && 
        itemLng && 
        transitMode &&
        !isFetchingTransitTime) { // Add check to prevent concurrent fetches
      setIsFetchingTransitTime(true);
      try {
        const departureTimeForAction = previousItemEndTime || previousItemStartTime;
        if (!departureTimeForAction || !isValid(parseISO(departureTimeForAction))) {
            console.warn(`[EditableItineraryItemCard] Invalid or missing departure time for transit calculation from previous item. Prev End: ${previousItemEndTime}, Prev Start: ${previousItemStartTime}`);
            setValue(`itinerary.${index}.transitTimeFromPreviousMinutes`, null, { shouldValidate: false });
            setIsFetchingTransitTime(false);
            return;
        }
        const result = await getDirectionsAction({
          originLat: previousItemLat,
          originLng: previousItemLng,
          destinationLat: itemLat,
          destinationLng: itemLng,
          mode: transitMode,
          departureTime: departureTimeForAction,
        });
        if (result.success) {
          setValue(`itinerary.${index}.transitTimeFromPreviousMinutes`, result.durationMinutes, { shouldValidate: false });
        } else {
          console.warn(`Directions Error for stop ${index}: ${result.error}`);
          setValue(`itinerary.${index}.transitTimeFromPreviousMinutes`, null, { shouldValidate: false });
          toast({ title: "Transit Info", description: `Could not fetch directions: ${result.error}`, variant: "default"});
        }
      } catch (error: any) {
        console.error("Error fetching directions:", error);
        setValue(`itinerary.${index}.transitTimeFromPreviousMinutes`, null, { shouldValidate: false });
        toast({ title: "Transit Error", description: error.message || "Failed to fetch directions.", variant: "destructive"});
      } finally {
        setIsFetchingTransitTime(false);
      }
    } else if (index > 0 && (!previousItemLat || !previousItemLng || !itemLat || !itemLng)) {
       setValue(`itinerary.${index}.transitTimeFromPreviousMinutes`, null, { shouldValidate: false });
    }
  }, [index, previousItemLat, previousItemLng, previousItemEndTime, previousItemStartTime, itemLat, itemLng, transitMode, setValue, toast]); 

  useEffect(() => {
    // Clear any existing timeout
    if (transitTimeDebounceRef.current) {
      clearTimeout(transitTimeDebounceRef.current);
    }
    
    // Only call fetchTransitTimeCallback if we're not in edit mode
    if (!isEditing) {
      // Debounce the transit time calculation to prevent excessive API calls
      transitTimeDebounceRef.current = setTimeout(() => {
        fetchTransitTimeCallback();
      }, 500); // 500ms debounce
    }
    
    // Cleanup function
    return () => {
      if (transitTimeDebounceRef.current) {
        clearTimeout(transitTimeDebounceRef.current);
      }
    };
  }, [fetchTransitTimeCallback, isEditing]);

  const staticMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const placeholderErrorUrl = `https://placehold.co/600x300.png?text=Image+Not+Available`;
  
  // Memoize the image URL to prevent unnecessary re-renders
  const itemPhotoUrl = useMemo(() => {
  // placeName is from: const placeName = watch(getFieldPath('placeName'));
  // googlePhotoReference is from: const { ..., googlePhotoReference, ... } = currentItem || {}
  // staticMapApiKey is from: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  // currentItem is from: const currentItem = watch(`itinerary.${index}`)

  const placeNameStr = typeof placeName === 'string' ? placeName.trim() : '';

  // Primary image sources
  if (googlePhotoReference && staticMapApiKey) {
    return getGooglePlacePhotoUrl(googlePhotoReference, 600, staticMapApiKey);
  }
  // Check currentItem.googleMapsImageUrl before warning about API key for googlePhotoReference
  if (currentItem?.googleMapsImageUrl) {
    return currentItem.googleMapsImageUrl;
  }
  
  // If googlePhotoReference exists but API key is missing for it, show a specific placeholder
  if (googlePhotoReference && !staticMapApiKey) {
    const warningText = encodeURIComponent(placeNameStr ? `${placeNameStr} - API Key Missing` : 'API Key Missing');
    // console.warn is a side effect, should ideally not be in useMemo's main execution path if it can be avoided,
    // but for a warning it's sometimes tolerated. For this task, keep it if it was there.
    // Consider if this console.warn should be moved to an effect if it causes issues.
    // Original code had: console.warn(`[EditableItineraryItemCard] Google Maps API key is missing for photo. Plan: ${watch('name')}, Item: ${placeNameStr}`);
    // The watch('name') call here is problematic for useMemo. Let's simplify the warning or remove it from useMemo.
    // For now, let's focus on the URL stability. The console.warn can be addressed separately if it's an issue.
    // Simplified warning for this context:
    // console.warn(`[EditableItineraryItemCard] Google Maps API key is missing for photo for item with photo reference. Place name: ${placeNameStr}`);
    return `https://placehold.co/600x300.png?text=${warningText}`;
  }

  // Fallback placeholder if no primary sources are available
  const fallbackText = encodeURIComponent(placeNameStr || "Location Image"); 
  return `https://placehold.co/600x300.png?text=${fallbackText}`;

}, [
  placeName, 
  googlePhotoReference, 
  staticMapApiKey, 
  currentItem?.googleMapsImageUrl 
  // Removed `watch` from dependencies. `currentItem` itself is watched outside, 
  // so `currentItem.googleMapsImageUrl` is the correct dependency.
  // `placeName` is also watched outside.
]);

  // Reset imageError state when itemPhotoUrl changes
  useEffect(() => {
    setImageError(false);
  }, [itemPhotoUrl]);

  const formattedStartTime = startTime && isValid(parseISO(startTime)) ? format(parseISO(startTime), 'p') : 'N/A';
  const formattedEndTime = endTime && isValid(parseISO(endTime)) ? format(parseISO(endTime), 'p') : 'N/A';

  return (
    <Card className="mb-4 border-border/50 shadow-sm bg-card/90">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b">
        <CardTitle className="text-base font-medium text-primary/80 truncate pr-2">Stop {index + 1}: {isEditing ? 'Editing...' : (placeName || 'New Stop')}</CardTitle>
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          {!isFirst && <Button type="button" variant="ghost" size="icon" onClick={() => move(index, index - 1)} className="h-7 w-7 text-muted-foreground hover:text-primary"><MoveUp className="h-4 w-4" /></Button>}
          {!isLast && <Button type="button" variant="ghost" size="icon" onClick={() => move(index, index + 1)} className="h-7 w-7 text-muted-foreground hover:text-primary"><MoveDown className="h-4 w-4" /></Button>}
          
          <Button type="button" variant="ghost" size="icon" onClick={isEditing ? handleSaveItem : toggleEditMode} className="h-7 w-7 text-muted-foreground hover:text-primary">
            {isEditing ? <Save className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
          </Button>
          {isEditing && <Button type="button" variant="ghost" size="icon" onClick={handleCancelEdit} className="h-7 w-7 text-muted-foreground hover:text-destructive"><Ban className="h-4 w-4" /></Button>}
          
          {!(isOnlyItem && isFirst) && ( // Don't allow removal if it's the only item (e.g. single-stop plan)
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-7 w-7 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" /><span className="sr-only">Remove Stop</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {!isEditing ? (
          // SUMMARY VIEW - Sleek and modern layout
          <div className="space-y-3">
            <div className="flex gap-4">
              {/* Left side - Image */}
              <div className="h-28 w-28 flex-shrink-0 bg-muted rounded-lg overflow-hidden relative shadow-sm">
                {imageError ? (
                  <Image 
                    key="placeholderImage"
                    src={placeholderErrorUrl} 
                    alt={`Image Not Available for ${placeName || 'itinerary stop'}`} 
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    style={{ objectFit: 'cover' }}
                    className="rounded-lg"
                    unoptimized
                  />
                ) : itemPhotoUrl.startsWith('https://') ? (
                  <Image 
                    key={itemPhotoUrl}
                    src={itemPhotoUrl} 
                    alt={`Image of ${placeName || 'itinerary stop'}`} 
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    style={{ objectFit: 'cover' }}
                    className="rounded-lg"
                    data-ai-hint={types?.[0] || 'activity location'}
                    unoptimized={itemPhotoUrl.includes('maps.googleapis.com')}
                    onError={() => {
                      if (!itemPhotoUrl.includes('placehold.co')) {
                        setImageError(true);
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted text-sm text-muted-foreground p-2 text-center font-medium">{placeName || "Location"}</div>
                )}
              </div>
              
              {/* Right side - Essential info */}
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <h4 className="font-semibold text-base text-foreground truncate leading-tight">{placeName || "Unnamed Place"}</h4>
                  {address && <p className="text-sm text-muted-foreground truncate mt-0.5">{address}</p>}
                </div>
                
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="inline h-4 w-4 mr-1.5 flex-shrink-0" />
                  <span className="truncate font-medium">{formattedStartTime} - {formattedEndTime}</span>
                  {currentItem?.durationMinutes != null && <span className="ml-2 whitespace-nowrap text-xs bg-muted px-2 py-0.5 rounded-full">({currentItem.durationMinutes} mins)</span>}
                </div>
                
                {/* Key details in modern row */}
                <div className="flex flex-wrap gap-2 text-sm">
                  {typeof rating === 'number' && (
                    <div className="flex items-center bg-amber-50 text-amber-700 px-2 py-1 rounded-full">
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500 flex-shrink-0"/> 
                      <span className="font-medium">{rating.toFixed(1)}</span>
                    </div>
                  )}
                  {priceLevel !== null && priceLevel !== undefined && (
                    <div className="bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium">
                      {'$'.repeat(priceLevel) || 'N/A'}
                    </div>
                  )}
                  {isOperational !== null && isOperational !== undefined && (
                    <Badge variant={isOperational ? "default" : "destructive"} className="h-6 px-2 text-xs font-medium">
                      {isOperational ? <CheckCircle className="w-3 h-3 mr-1 flex-shrink-0"/> : <XCircle className="w-3 h-3 mr-1 flex-shrink-0"/>}
                      <span>{isOperational ? "Open" : "Closed"}</span>
                    </Badge>
                  )}
                  {openingHours && openingHours.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-6 px-2 text-xs font-medium hover:bg-primary/5 border-primary/20">
                          <CalendarClock className="w-3 h-3 mr-1" />
                          Hours
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0 bg-background/95 backdrop-blur-sm border border-border/50 shadow-lg" align="start">
                        <div className="p-4">
                          <h4 className="font-semibold text-base mb-3 text-foreground">{placeName || "Location"} - Opening Hours</h4>
                          <div className="space-y-1">
                            <table className="w-full text-sm">
                              <tbody>
                                {openingHours.map((line, i) => {
                                  const parts = line.split(': ');
                                  const day = parts[0];
                                  const hours = parts[1] || '';
                                  return (
                                    <tr key={i} className="border-b border-border/30 last:border-b-0">
                                      <td className="py-2 pr-3 font-medium text-muted-foreground">{day}</td>
                                      <td className="py-2 text-foreground">{hours}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                  {website && (
                    <a href={website} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 flex items-center bg-primary/5 px-2 py-1 rounded-full transition-colors">
                      <ExternalLink className="w-3 h-3 flex-shrink-0"/>
                    </a>
                  )}
                </div>
              </div>
            </div>
            
            {/* Description */}
            {description && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm text-foreground/90 line-clamp-2 break-words leading-relaxed">{description}</p>
              </div>
            )}
            
            {/* Categories as modern badges */}
            {types && types.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {types.slice(0,3).map(type => (
                  <Badge key={type} variant="secondary" className="text-xs px-2 py-1 h-auto font-medium bg-secondary/60">
                    {type.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            )}
            
            {/* Activities section */}
            {activitySuggestions?.length > 0 && (
              <details className="text-sm group">
                <summary className="cursor-pointer text-primary hover:text-primary/80 font-medium flex items-center transition-colors">
                  <span className="group-open:rotate-90 transition-transform mr-1">▶</span>
                  Suggested Activities
                </summary>
                <div className="pt-2 pl-4">
                  <ul className="space-y-1">
                    {activitySuggestions.map((sugg, i) => (
                      <li key={i} className="text-foreground/80 break-words flex items-start">
                        <span className="w-1.5 h-1.5 bg-primary/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                        {sugg}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            )}
            
            {/* Transit info - Modern styling */}
            {index > 0 && transitMode && (
              <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
                <div className="text-sm text-muted-foreground flex items-center">
                  {transitModeOptions.find(opt => opt.value === transitMode)?.icon ? React.createElement(transitModeOptions.find(opt => opt.value === transitMode)!.icon, {className: "w-4 h-4 mr-2 flex-shrink-0 text-primary"}) : <Car className="w-4 h-4 mr-2 flex-shrink-0 text-primary"/> }
                  <span className="font-medium">From previous stop:</span>
                  {isFetchingTransitTime ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin text-primary" />
                  ) : (
                    <span className="ml-2 font-semibold text-foreground bg-primary/10 px-2 py-0.5 rounded-full text-xs">
                      {transitTimeFromPreviousMinutes !== null && transitTimeFromPreviousMinutes !== undefined 
                        ? `${transitTimeFromPreviousMinutes} mins` 
                        : 'N/A'}
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* Notes section */}
            {currentItem?.notes && (
              <div className="bg-blue-50/50 border border-blue-200/50 rounded-lg p-3">
                <p className="text-sm font-semibold text-blue-900/80 mb-1">Your Notes:</p>
                <p className="text-sm text-blue-800/90 whitespace-pre-wrap break-words leading-relaxed">{currentItem.notes}</p>
              </div>
            )}
          </div>
        ) : (
          // EDIT VIEW
          <>
            <FormField
              control={control}
              name={`itinerary.${index}.placeName`}
              render={({ field }) => ( // field provides field.onChange (for RHF), field.onBlur, field.value (RHF value)
                <FormItem>
                  <FormLabel className="text-xs">Place Name / Search</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Eiffel Tower"
                      ref={placeNameInputRef} // Keep original ref for Google Places Autocomplete
                      value={internalPlaceName || ''}
                      onChange={(e) => {
                        const typedValue = e.target.value;
                        setInternalPlaceName(typedValue);
                        if (placeNameDebounceTimeoutRef.current) {
                          clearTimeout(placeNameDebounceTimeoutRef.current);
                        }
                        placeNameDebounceTimeoutRef.current = setTimeout(() => {
                          field.onChange(typedValue);
                        }, 300);
                      }}
                      onBlur={() => {
                        if (placeNameDebounceTimeoutRef.current) {
                          clearTimeout(placeNameDebounceTimeoutRef.current);
                        }
                        if (field.value !== internalPlaceName) { // Check against field.value from RHF
                            field.onChange(internalPlaceName);
                        }
                        if (typeof field.onBlur === 'function') { // Call original RHF onBlur
                            field.onBlur();
                        }
                      }}
                      disabled={!isGoogleMapsApiLoaded} 
                      className="text-sm h-9" 
                    />
                  </FormControl>
                  {!isGoogleMapsApiLoaded && <FormDescription className="text-xs text-muted-foreground">Maps API loading...</FormDescription>}
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField control={control} name={`itinerary.${index}.address`}
                render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Address</FormLabel><FormControl><Input placeholder="Auto-filled from search" {...field} value={field.value ?? ''} className="text-sm h-9" readOnly /></FormControl><FormMessage className="text-xs" /></FormItem>
                )}
              />
              <FormField control={control} name={`itinerary.${index}.city`}
                render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">City</FormLabel><FormControl><Input placeholder="Auto-filled from search" {...field} value={field.value ?? ''} className="text-sm h-9" readOnly /></FormControl><FormMessage className="text-xs" /></FormItem>
                )}
              />
            </div>
            <FormField control={control} name={`itinerary.${index}.description`}
              render={({ field }) => (
                <FormItem><FormLabel className="text-xs">Description / Activity</FormLabel><FormControl><Textarea placeholder="e.g., Sightseeing, lunch" {...field} value={field.value ?? ''} className="text-sm min-h-[60px]" /></FormControl><FormMessage className="text-xs" /></FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField control={control} name={`itinerary.${index}.startTime`}
                render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Start Time</FormLabel>
                    <FormControl>
                      <Input 
                        type="datetime-local" 
                        {...field} 
                        value={field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "yyyy-MM-dd'T'HH:mm") : ''} 
                        onChange={(e) => {
                          const newDate = e.target.value ? new Date(e.target.value).toISOString() : '';
                          field.onChange(newDate);
                        }}
                        className="text-sm h-9" 
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <FormField control={control} name={`itinerary.${index}.endTime`}
                render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">End Time</FormLabel>
                    <FormControl>
                      <Input 
                        type="datetime-local" 
                        {...field} 
                        value={field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "yyyy-MM-dd'T'HH:mm") : ''} 
                        onChange={(e) => {
                          const newDate = e.target.value ? new Date(e.target.value).toISOString() : '';
                          field.onChange(newDate);
                        }}
                        className="text-sm h-9" 
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
            <FormField control={control} name={`itinerary.${index}.durationMinutes`}
              render={({ field }) => (
                <FormItem className="mt-1">
                  <FormLabel className="text-xs">Estimated Duration (minutes)</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g., 60" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || null)} value={field.value ?? ''} className="text-sm h-9" /></FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            {index > 0 && (
              <div className="mt-3 space-y-1">
                <Controller
                  control={control}
                  name={`itinerary.${index}.transitMode`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Mode of Transit to this Stop</FormLabel>
                      <Select 
                        value={field.value || 'driving'} 
                        onValueChange={field.onChange}
                        disabled={!isEditing}
                      >
                        <FormControl>
                          <SelectTrigger className="text-sm h-9">
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {transitModeOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className="text-sm">
                              <div className="flex items-center">
                                <opt.icon className="w-4 h-4 mr-2" />
                                {opt.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <div className="text-xs text-muted-foreground flex items-center">
                  <Clock className="w-3 h-3 mr-1.5" />
                  Est. transit from previous:
                  {isFetchingTransitTime ? (
                    <Loader2 className="w-3 h-3 ml-1.5 animate-spin" />
                  ) : (
                    <span className="ml-1 font-medium text-foreground/90">
                      {transitTimeFromPreviousMinutes !== null && transitTimeFromPreviousMinutes !== undefined 
                        ? `${transitTimeFromPreviousMinutes} mins` 
                        : 'N/A'}
                    </span>
                  )}
                </div>
              </div>
            )}
            <FormField control={control} name={`itinerary.${index}.notes`}
              render={({ field }) => (
                <FormItem className="mt-1"><FormLabel className="text-xs">Your Notes (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., Book tickets in advance" {...field} value={field.value ?? ''} className="text-sm min-h-[40px]" /></FormControl><FormMessage className="text-xs" /></FormItem>
              )}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const EditableItineraryItemCard = memo(EditableItineraryItemCardImpl, (prevProps, nextProps) => {
  // Deep compare important props
  const arePropsEqual = 
    prevProps.index === nextProps.index &&
    prevProps.isFirst === nextProps.isFirst &&
    prevProps.isLast === nextProps.isLast &&
    prevProps.isOnlyItem === nextProps.isOnlyItem &&
    prevProps.isGoogleMapsApiLoaded === nextProps.isGoogleMapsApiLoaded &&
    prevProps.previousItemLat === nextProps.previousItemLat &&
    prevProps.previousItemLng === nextProps.previousItemLng &&
    prevProps.previousItemStartTime === nextProps.previousItemStartTime &&
    prevProps.previousItemEndTime === nextProps.previousItemEndTime &&
    // Compare control reference - if it's the same form control instance
    prevProps.control === nextProps.control &&
    // Compare remove and move functions - they should be stable references
    prevProps.remove === nextProps.remove &&
    prevProps.move === nextProps.move;

  return arePropsEqual;
});

EditableItineraryItemCard.displayName = 'EditableItineraryItemCard';
