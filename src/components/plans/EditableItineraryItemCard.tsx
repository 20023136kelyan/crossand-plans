'use client';

import type { Control, UseFieldArrayRemove, UseFieldArrayMove } from 'react-hook-form';
import { useFormContext, Controller, useWatch } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Trash2, Sparkles, CheckCircle, XCircle, ExternalLink, Clock, Car, Footprints, Bike, TramFront, Loader2, Edit3, Save, Ban, MoveUp, MoveDown } from 'lucide-react';
import type { PlanFormValues, ItineraryItemSchemaValues } from './PlanForm';
import React, { useEffect, useRef, useState, useCallback, memo, useMemo } from 'react'; // Added memo and useMemo
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TransitMode } from '@/types/user';
import { getDirectionsAction } from '@/app/actions/planActions';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

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
  const autocompleteRef = useRef<google.maps.places.Autocomplete & { input?: HTMLInputElement, listener?: google.maps.MapsEventListener } | null>(null);

  const watchedRhfPlaceName = useWatch({ control, name: getFieldPath('placeName') }) || '';
  const [internalPlaceName, setInternalPlaceName] = useState<string>(String(watchedRhfPlaceName));
  const placeNameDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    };
  }, []);

  // Memoize the current item to prevent unnecessary re-renders
  const currentItemMemo = useMemo(() => watch(`itinerary.${index}`), [watch, index]);
  
  const { 
    address, city, description, startTime, endTime,
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
  
  const [isFetchingTransitTime, setIsFetchingTransitTime] = useState(false);
  
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

    // Batch our setValue calls to reduce re-renders
    // placeName is now set directly in the place_changed listener
    const updates: Partial<Record<keyof ItineraryItemSchemaValues, unknown>> = {
      address: place.formatted_address || null,
      city: place.address_components?.find(c => 
        c.types.includes('locality') || 
        c.types.includes('postal_town') || 
        c.types.includes('administrative_area_level_2')
      )?.long_name || null,
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
      if (autocompleteRef.current.listener) {
        window.google.maps.event.removeListener(autocompleteRef.current.listener);
      }
      if (autocompleteRef.current.input) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current.input);
      }
      autocompleteRef.current = null;
    }

    const newAutocomplete = new window.google.maps.places.Autocomplete(
      placeNameInputRef.current,
      { 
        types: ['geocode', 'establishment'], 
        fields: [
          'name', 
          'formatted_address', 
          'address_components', 
          'geometry', 
          'place_id', 
          'photos', 
          'rating', 
          'user_ratings_total', 
          'opening_hours', 
          'international_phone_number', 
          'website', 
          'price_level', 
          'types', 
          'business_status'
        ] 
      }
    ) as google.maps.places.Autocomplete & { input?: HTMLInputElement; listener?: google.maps.MapsEventListener };

    newAutocomplete.input = placeNameInputRef.current;
    const listener = newAutocomplete.addListener('place_changed', () => {
      const place = newAutocomplete.getPlace();
      if (!place) return;

      // Ensure place has a name or formatted_address to proceed
      if (place.name || place.formatted_address) {
        const placeNameValue = place.name || place.formatted_address || ''; // Prioritize place.name
        
        // Immediately update local state for responsive UI
        setInternalPlaceName(placeNameValue); 
  
        // Immediately update React Hook Form state for 'placeName'
        // Assumes `setValue` is from useFormContext() and `getFieldPath` is defined
        setValue(getFieldPath('placeName'), placeNameValue, { 
          shouldValidate: true, 
          shouldDirty: true 
        });
  
        // Clear any debounce timeout that might have been set by typing
        if (placeNameDebounceTimeoutRef.current) { // Ensure placeNameDebounceTimeoutRef is defined
          clearTimeout(placeNameDebounceTimeoutRef.current);
        }
  
        // Defer the call to handlePlaceChanged
        const placeDataForCallback = place; // Ensure 'place' is correctly captured if it might change
        setTimeout(() => {
          handlePlaceChanged(placeDataForCallback);
        }, 0);
      }
    });

    newAutocomplete.listener = listener;
    autocompleteRef.current = newAutocomplete;

    return () => {
      if (listener && window.google?.maps) {
        window.google.maps.event.removeListener(listener);
      }
      if (newAutocomplete?.input && window.google?.maps) {
        window.google.maps.event.clearInstanceListeners(newAutocomplete.input);
      }
    };
  }, [isEditing, isGoogleMapsApiLoaded, handlePlaceChanged]);

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
  }, [index, previousItemLat, previousItemLng, previousItemEndTime, previousItemStartTime, itemLat, itemLng, transitMode, setValue, toast, isFetchingTransitTime]); 

  useEffect(() => {
    // Only call fetchTransitTimeCallback if we're not in edit mode
    if (!isEditing) {
      fetchTransitTimeCallback();
    }
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
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${googlePhotoReference}&key=${staticMapApiKey}`;
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
          // SUMMARY VIEW
          <div className="space-y-2">
            <div className="mt-1 h-32 md:h-40 bg-muted rounded-md flex items-center justify-center text-muted-foreground text-xs overflow-hidden relative">
              {imageError ? (
                <Image 
                  key="placeholderImage" // Static key for the placeholder
                  src={placeholderErrorUrl} 
                  alt={`Image Not Available for ${placeName || 'itinerary stop'}`} 
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  style={{ objectFit: 'cover' }}
                  className="rounded-md"
                  unoptimized // Placeholder is already optimized
                />
              ) : itemPhotoUrl.startsWith('https://') ? (
                <Image 
                  key={itemPhotoUrl}
                  src={itemPhotoUrl} 
                  alt={`Image of ${placeName || 'itinerary stop'}`} 
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  style={{ objectFit: 'cover' }}
                  className="rounded-md"
                  data-ai-hint={types?.[0] || 'activity location'}
                  unoptimized={itemPhotoUrl.includes('maps.googleapis.com')}
                  onError={() => {
                    if (!itemPhotoUrl.includes('placehold.co')) {
                      setImageError(true);
                    }
                  }}
                />
              ) : (
                 <div className="w-full h-full flex items-center justify-center bg-muted text-xs text-muted-foreground p-2 text-center">{placeName || "Location Image"}</div>
              )}
            </div>
            <h4 className="font-semibold text-md text-foreground truncate">{placeName || "Unnamed Place"}</h4>
            {address && <p className="text-xs text-muted-foreground truncate">{address}</p>}
            <p className="text-xs text-muted-foreground truncate">
              <Clock className="inline h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">{formattedStartTime} - {formattedEndTime}</span>
              {currentItem?.durationMinutes != null && <span className="ml-1 whitespace-nowrap">({currentItem.durationMinutes} mins)</span>}
            </p>
            {description && <p className="text-xs text-foreground/80 line-clamp-3 break-words">{description}</p>}

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-1.5 text-muted-foreground">
                {typeof rating === 'number' && <div className="flex items-center truncate"><Sparkles className="w-3 h-3 mr-1 text-amber-400 flex-shrink-0"/> Rating: {rating.toFixed(1)} ({reviewCount || 0})</div>}
                {isOperational !== null && isOperational !== undefined && (
                    <Badge variant={isOperational ? "default" : "destructive"} className="w-fit py-0.5 px-1.5 text-[10px] bg-opacity-70 truncate">
                        {isOperational ? <CheckCircle className="w-3 h-3 mr-1 flex-shrink-0"/> : <XCircle className="w-3 h-3 mr-1 flex-shrink-0"/>}
                        <span className="truncate">{statusText || (isOperational ? "Operational" : "Closed")}</span>
                    </Badge>
                )}
                {priceLevel !== null && priceLevel !== undefined && <div className="truncate">Price: {'$'.repeat(priceLevel) || 'N/A'}</div>}
                {phoneNumber && <div className="truncate" title={phoneNumber}>Phone: {phoneNumber}</div>}
                {website && <a href={website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex items-center text-xs"><span className="truncate">Website</span> <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0"/></a>}
            </div>

            {types && types.length > 0 && (
                <div className="mt-1">
                    <p className="text-xs font-medium text-muted-foreground/80 mb-0.5">Categories:</p>
                    <div className="flex flex-wrap gap-1">
                        {types.slice(0,5).map(type => <Badge key={type} variant="outline" className="text-[10px] px-1 py-0 truncate">{type.replace(/_/g, ' ')}</Badge>)}
                    </div>
                </div>
            )}

            {activitySuggestions && activitySuggestions.length > 0 && (
                <div className="mt-1">
                    <p className="text-xs font-medium text-muted-foreground/80 mb-0.5">AI Suggested Activities:</p>
                    <ul className="list-disc list-inside pl-1 space-y-0.5">
                        {activitySuggestions.map((sugg, i) => <li key={i} className="text-xs text-foreground/80 break-words">{sugg}</li>)}
                    </ul>
                </div>
            )}
             {openingHours && openingHours.length > 0 && (
                <div className="mt-1">
                    <p className="text-xs font-medium text-muted-foreground/80 mb-0.5">Opening Hours:</p>
                    <div className="text-xs text-foreground/80 max-h-16 overflow-y-auto bg-muted/30 p-1 rounded text-[10px] custom-scrollbar-horizontal">
                        {openingHours.map((line, i) => <p key={i} className="break-words">{line}</p>)}
                    </div>
                </div>
            )}
            {index > 0 && transitMode && (
              <div className="text-xs text-muted-foreground flex items-center pt-1 border-t border-border/30 mt-2 truncate">
                {transitModeOptions.find(opt => opt.value === transitMode)?.icon ? React.createElement(transitModeOptions.find(opt => opt.value === transitMode)!.icon, {className: "w-3.5 h-3.5 mr-1.5 flex-shrink-0"}) : <Car className="w-3.5 h-3.5 mr-1.5 flex-shrink-0"/> }
                <span className="truncate">Est. transit from previous:</span>
                {isFetchingTransitTime ? (
                  <Loader2 className="w-3 h-3 ml-1.5 animate-spin" />
                ) : (
                  <span className="ml-1 font-medium text-foreground/90 whitespace-nowrap">
                    {transitTimeFromPreviousMinutes !== null && transitTimeFromPreviousMinutes !== undefined 
                      ? `${transitTimeFromPreviousMinutes} mins` 
                      : 'N/A'}
                  </span>
                )}
              </div>
            )}
            {currentItem?.notes && (
              <div className="mt-1 pt-1 border-t border-border/30">
                <p className="text-xs font-medium text-muted-foreground/80 mb-0.5">Your Notes:</p>
                <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words">{currentItem.notes}</p>
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
