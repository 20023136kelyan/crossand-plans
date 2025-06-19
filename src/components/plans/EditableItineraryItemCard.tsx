"use client";

import type { Control, UseFieldArrayRemove, UseFieldArrayMove } from 'react-hook-form';
import { useFormContext, Controller, useWatch } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Trash2, Sparkles, CheckCircle, XCircle, ExternalLink, Clock, Car, Footprints, Bike, TramFront, Loader2, Edit3, Save, Ban, MoveUp, MoveDown, CalendarClock, Star, Info, ChevronDown, MapPin } from 'lucide-react';
import type { PlanFormValues, ItineraryItemSchemaValues } from './PlanForm';
import React, { useEffect, useRef, useState, useCallback, memo, useMemo } from 'react';
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
import { PlaceAutocomplete } from '@/components/ui/place-autocomplete';

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

// Helper function to abbreviate large numbers
const abbreviateNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
};

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
  const { setValue, watch, getValues, trigger, formState: { errors } } = useFormContext<PlanFormValues>();
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
  const [placeInfo, setPlaceInfo] = useState<{
    rating?: number;
    reviewCount?: number;
    types?: string[];
    isOperational?: boolean;
    priceLevel?: number;
  } | null>(null);
  const [loadingPlaceInfo, setLoadingPlaceInfo] = useState(false);
  
  const placeNameInputRef = useRef<HTMLInputElement>(null);
  const placeNameDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Watch fields for transit time calculation
  const startTime = watch(getFieldPath('startTime'));
  const endTime = watch(getFieldPath('endTime'));
  const transitMode = watch(getFieldPath('transitMode'));
  const lat = watch(getFieldPath('lat'));
  const lng = watch(getFieldPath('lng'));
  
  // State for transit time calculation
  const [isCalculatingTransit, setIsCalculatingTransit] = useState(false);
  const [transitTimeDebounceTimeout, setTransitTimeDebounceTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // State to control showing advanced fields
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showTimeEditor, setShowTimeEditor] = useState(false);
  const [showPlaceEditor, setShowPlaceEditor] = useState(false);
  
  // Watch address and city to auto-show advanced fields if they have values
  const address = watch(getFieldPath('address'));
  const city = watch(getFieldPath('city'));
  const description = watch(getFieldPath('description'));
  
  // Auto-show advanced fields if they have values
  useEffect(() => {
    if ((address && String(address).trim()) || (city && String(city).trim())) {
      setShowAdvancedFields(true);
    }
  }, [address, city]);
  
  // Auto-show description if it has content
  useEffect(() => {
    if (description && String(description).trim()) {
      setShowDescription(true);
    }
  }, [description]);
  
  // Handle place selection from autocomplete
  const handlePlaceSelect = useCallback((place: any) => {
    console.log('=== EDITABLE ITINERARY ITEM CARD - PLACE SELECT ===');
    console.log('handlePlaceSelect called with place:', place);
    console.log('Place object keys:', Object.keys(place));
    console.log('Place photos field:', place.photos);
    console.log('Place photos type:', typeof place.photos);
    console.log('Place photos length:', place.photos?.length);
    
    // Extract city from address components
    let city = '';
    if (place.address_components) {
      const cityComponent = place.address_components.find((component: any) => 
        component.types.includes('locality') || 
        component.types.includes('administrative_area_level_1') ||
        component.types.includes('administrative_area_level_2')
      );
      if (cityComponent) {
        city = cityComponent.long_name;
      }
    }
    
    // Extract photo reference from place photos
    let photoReference = null;
    console.log('=== PHOTO REFERENCE EXTRACTION ===');
    console.log('Checking place.photos:', place.photos);
    console.log('place.photos exists:', !!place.photos);
    console.log('place.photos is array:', Array.isArray(place.photos));
    
    if (place.photos && place.photos.length > 0) {
      console.log('Photos array has', place.photos.length, 'items');
      console.log('First photo object:', place.photos[0]);
      console.log('First photo keys:', Object.keys(place.photos[0]));
      
      // Extract photo reference - copy the exact pipeline from place-autocomplete.tsx
      const firstPhoto = place.photos[0];
      
      // First try to call getUrl if available (primary method, same as automatic version)
      if (typeof firstPhoto.getUrl === 'function') {
        try {
          photoReference = firstPhoto.getUrl({ maxWidth: 400 });
          console.log('Generated photo URL using getUrl() (primary method):', photoReference);
        } catch (error) {
          console.error('Error calling getUrl (primary method):', error);
          // Fallback to photo_reference if getUrl fails
          photoReference = firstPhoto.photo_reference || null;
          console.log('Using photo_reference as fallback:', photoReference);
        }
      } else {
        // If no getUrl function, use photo_reference (for REST API or other sources)
        photoReference = firstPhoto.photo_reference || null;
        console.log('No getUrl function, using photo_reference:', photoReference);
      }
      
      console.log('Photo reference type:', typeof photoReference);
      
      console.log('Final extracted photo reference:', photoReference);
      console.log('Photo reference type:', typeof photoReference);
    } else {
      console.log('No photos available - place.photos is:', place.photos);
    }
    
    // Update form fields with place details
    setValue(getFieldPath('placeName'), place.name || place.formatted_address, { 
      shouldValidate: true, 
      shouldDirty: true 
    });
    setValue(getFieldPath('address'), place.formatted_address, { 
      shouldValidate: true, 
      shouldDirty: true 
    });
    setValue(getFieldPath('city'), city, { 
      shouldValidate: true, 
      shouldDirty: true 
    });
    setValue(getFieldPath('lat'), place.geometry.location.lat, { 
      shouldValidate: true, 
      shouldDirty: true 
    });
    setValue(getFieldPath('lng'), place.geometry.location.lng, { 
      shouldValidate: true, 
      shouldDirty: true 
    });
    // Save the Google Place ID to prevent invalid Place ID errors
    setValue(getFieldPath('googlePlaceId'), place.place_id, { 
      shouldValidate: true, 
      shouldDirty: true 
    });
    // Set the photo reference if available
    console.log('=== SETTING PHOTO REFERENCE IN FORM ===');
    console.log('About to set googlePhotoReference to:', photoReference);
    setValue(getFieldPath('googlePhotoReference'), photoReference, { 
      shouldValidate: true, 
      shouldDirty: true 
    });
    
    // Verify the value was set correctly
    const setPhotoRef = getValues(getFieldPath('googlePhotoReference'));
    console.log('Photo reference set in form:', setPhotoRef);
    console.log('Photo reference matches what we set:', setPhotoRef === photoReference);
    
    console.log('Updated form fields with place details, city:', city, 'googlePlaceId:', place.place_id, 'photoReference:', photoReference);
    setShowPlaceEditor(false);
  }, [setValue, getFieldPath]);
  
  // Calculate transit time when relevant fields change
  useEffect(() => {
    // Clear existing timeout
    if (transitTimeDebounceTimeout) {
      clearTimeout(transitTimeDebounceTimeout);
    }
    
    // Only calculate if we have the necessary data
    if (!previousItemLat || !previousItemLng || !lat || !lng || !transitMode) {
      return;
    }
    
    // Debounce the calculation
    const timeout = setTimeout(async () => {
      setIsCalculatingTransit(true);
      
      try {
        const result = await getDirectionsAction({
          originLat: previousItemLat,
          originLng: previousItemLng,
          destinationLat: Number(lat),
          destinationLng: Number(lng),
          mode: (transitMode as 'driving' | 'walking' | 'bicycling' | 'transit') || 'driving',
        });
        
        if (result.success && result.durationMinutes) {
          setValue(getFieldPath('transitTimeFromPreviousMinutes'), result.durationMinutes, { 
            shouldValidate: true, 
            shouldDirty: true 
          });
        }
      } catch (error) {
        console.error('Error calculating transit time:', error);
      } finally {
        setIsCalculatingTransit(false);
      }
    }, 500); // 500ms debounce
    
    setTransitTimeDebounceTimeout(timeout);
    
    // Cleanup on unmount
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [previousItemLat, previousItemLng, lat, lng, transitMode, setValue, getFieldPath]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (transitTimeDebounceTimeout) {
        clearTimeout(transitTimeDebounceTimeout);
      }
    };
  }, [transitTimeDebounceTimeout]);

  // Fetch basic place info using Places API
  const fetchPlaceInfo = useCallback(() => {
    if (!currentItem?.googlePlaceId || loadingPlaceInfo) return;
    
    setLoadingPlaceInfo(true);
    
    // Check if Google Maps is loaded
    if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.places) {
      const dummyDiv = document.createElement('div');
      const placesService = new window.google.maps.places.PlacesService(dummyDiv);
      
      const request = {
        placeId: currentItem.googlePlaceId,
        fields: ['rating', 'user_ratings_total', 'types', 'business_status', 'price_level']
      };
      
      placesService.getDetails(request, (place: google.maps.places.PlaceResult | null, status: google.maps.places.PlacesServiceStatus) => {
        setLoadingPlaceInfo(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          setPlaceInfo({
            rating: place.rating,
            reviewCount: place.user_ratings_total,
            types: place.types,
            isOperational: place.business_status === 'OPERATIONAL',
            priceLevel: place.price_level
          });
        } else if (status === window.google.maps.places.PlacesServiceStatus.INVALID_REQUEST) {
          // Handle invalid Place ID - attempt to refresh it
          console.warn('Invalid Place ID detected, attempting to refresh:', currentItem.googlePlaceId);
          refreshPlaceId(currentItem.placeName);
        } else {
          // Handle other error statuses silently
          console.warn('Place details request failed with status:', status);
          setPlaceInfo(null);
        }
      });
    } else {
      setLoadingPlaceInfo(false);
    }
  }, [currentItem?.googlePlaceId, loadingPlaceInfo]);

    // Function to refresh Place ID when it becomes invalid
    const refreshPlaceId = useCallback((placeName: string) => {
      if (!placeName || !window.google?.maps?.places) {
        console.warn('Cannot refresh Place ID: missing place name or Google Maps not loaded');
        setValue(getFieldPath('googlePlaceId'), null, { shouldValidate: false });
        setPlaceInfo(null);
        return;
      }

      const service = new window.google.maps.places.PlacesService(document.createElement('div'));
      const request = {
        query: placeName,
        fields: ['place_id', 'name', 'formatted_address', 'geometry']
      };

      service.textSearch(request, (results: google.maps.places.PlaceResult[] | null, status: google.maps.places.PlacesServiceStatus) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
          const newPlace = results[0];
          console.log('Successfully refreshed Place ID:', newPlace.place_id);
          
          // Update the form with the new Place ID
          setValue(getFieldPath('googlePlaceId'), newPlace.place_id, { shouldValidate: false });
          
          // Fetch place info with the new Place ID
          const detailsRequest = {
            placeId: newPlace.place_id!,
            fields: ['name', 'formatted_address', 'rating', 'user_ratings_total', 'types', 'business_status', 'price_level']
          };
          
          service.getDetails(detailsRequest, (place: google.maps.places.PlaceResult | null, detailsStatus: google.maps.places.PlacesServiceStatus) => {
            if (detailsStatus === window.google.maps.places.PlacesServiceStatus.OK && place) {
              setPlaceInfo({
                rating: place.rating,
                reviewCount: place.user_ratings_total,
                types: place.types,
                isOperational: place.business_status === 'OPERATIONAL',
                priceLevel: place.price_level
              });
            } else {
              console.warn('Failed to fetch details for refreshed Place ID:', detailsStatus);
              setPlaceInfo(null);
            }
          });
        } else {
          console.warn('Failed to refresh Place ID for place:', placeName, 'Status:', status);
          setValue(getFieldPath('googlePlaceId'), null, { shouldValidate: false });
          setPlaceInfo(null);
        }
      });
    }, [setValue, getFieldPath]);
  
  // Fetch place info on component load if googlePlaceId exists
  useEffect(() => {
    if (currentItem?.googlePlaceId && !isEditing) {
      fetchPlaceInfo();
    }
  }, [currentItem?.googlePlaceId, isEditing, fetchPlaceInfo]);

  // Auto-refresh missing images for items generated without photos
  useEffect(() => {
    // Only run for items that have place data but no image
    if (
      currentItem?.googlePlaceId && 
      currentItem?.placeName && 
      !currentItem?.googlePhotoReference && 
      !currentItem?.googleMapsImageUrl &&
      !isEditing &&
      isGoogleMapsApiLoaded &&
      window.google?.maps?.places
    ) {
      console.log('[EditableItineraryItemCard] Auto-refreshing missing image for:', currentItem.placeName);
      
      const service = new window.google.maps.places.PlacesService(document.createElement('div'));
      const request = {
        placeId: currentItem.googlePlaceId,
        fields: ['photos']
      };
      
      service.getDetails(request, (place: google.maps.places.PlaceResult | null, status: google.maps.places.PlacesServiceStatus) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.photos && place.photos.length > 0) {
          const firstPhoto = place.photos[0];
          
          // ONLY use getUrl() method to avoid 400 errors from expired photo references
          if (typeof firstPhoto.getUrl === 'function') {
            try {
              const photoUrl = firstPhoto.getUrl({ maxWidth: 400 });
              console.log('[EditableItineraryItemCard] Auto-generated photo URL using getUrl():', photoUrl);
              
              // Verify the URL is valid before setting it
              if (photoUrl && (photoUrl.startsWith('http://') || photoUrl.startsWith('https://'))) {
                setValue(getFieldPath('googlePhotoReference'), photoUrl, { shouldValidate: false });
                console.log('[EditableItineraryItemCard] Successfully set direct photo URL');
              } else {
                console.warn('[EditableItineraryItemCard] getUrl() returned invalid URL:', photoUrl);
              }
            } catch (error) {
              console.error('[EditableItineraryItemCard] Error calling getUrl() during auto-refresh:', error);
              // Do NOT fallback to photo_reference to avoid 400 errors
              console.log('[EditableItineraryItemCard] Skipping photo_reference fallback to prevent 400 errors');
            }
          } else {
            console.log('[EditableItineraryItemCard] No getUrl function available, skipping photo refresh to avoid 400 errors');
          }
        } else {
          console.log('[EditableItineraryItemCard] No photos available for auto-refresh:', currentItem.placeName);
        }
      });
    }
  }, [currentItem?.googlePlaceId, currentItem?.placeName, currentItem?.googlePhotoReference, currentItem?.googleMapsImageUrl, isEditing, isGoogleMapsApiLoaded, setValue, getFieldPath]);
  
  const handleSave = useCallback(async () => {
    // Clear any pending debounced timeouts to ensure immediate form update
    if (placeNameDebounceTimeoutRef.current) {
      clearTimeout(placeNameDebounceTimeoutRef.current);
      placeNameDebounceTimeoutRef.current = null;
    }
    
    // Trigger form validation
    const isValid = await trigger([
      getFieldPath('placeName'),
      getFieldPath('startTime')
    ]);
    
    if (isValid) {
      setIsEditing(false);
      // Fetch place info after successful save
      await fetchPlaceInfo();
    } else {
      // Form has validation errors, keep editing mode
      console.log('Form validation failed, staying in edit mode');
    }
  }, [trigger, getFieldPath, fetchPlaceInfo]);
  
  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);
  
  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);
  
  const handleRemove = useCallback(() => {
    remove(index);
  }, [remove, index]);
  
  // Get static map API key from environment
  const staticMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  // Watch for Google photo reference
  const googlePhotoReference = watch(getFieldPath('googlePhotoReference'));
  
  // Memoize the photo URL calculation
  const itemPhotoUrl = useMemo(() => {
  const placeNameStr = typeof placeName === 'string' ? placeName : '';
  
  console.log('[EditableItineraryItemCard] Photo URL generation:', {
    placeName: placeNameStr,
    hasGooglePhotoReference: !!googlePhotoReference,
    googlePhotoReference,
    hasGoogleMapsImageUrl: !!currentItem?.googleMapsImageUrl,
    hasCoordinates: !!(lat && lng),
    hasStaticMapApiKey: !!staticMapApiKey
  });
  
  // Priority 1: Google photo reference
  if (googlePhotoReference && staticMapApiKey) {
          // Check if it's already a direct URL (from place-autocomplete)
          const googlePhotoRefStr = String(googlePhotoReference);
          const photoUrl = (googlePhotoRefStr.startsWith('http://') || googlePhotoRefStr.startsWith('https://')) 
            ? googlePhotoRefStr 
            : getGooglePlacePhotoUrl(googlePhotoRefStr, 600, 300, staticMapApiKey || '');
    console.log('[EditableItineraryItemCard] Using Google photo reference:', photoUrl);
    return photoUrl;
  }
  
  // Priority 2: Existing Google Maps image URL
  if (currentItem?.googleMapsImageUrl) {
    console.log('[EditableItineraryItemCard] Using existing Google Maps image:', currentItem.googleMapsImageUrl);
    return currentItem.googleMapsImageUrl;
  }
  
  // Priority 3: Static map based on coordinates
  if (lat && lng && staticMapApiKey) {
    const zoom = 15;
    const size = '600x300';
    const mapType = 'roadmap';
    const marker = `color:red|${lat},${lng}`;
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&maptype=${mapType}&markers=${marker}&key=${staticMapApiKey}`;
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

  // Helper function to convert ISO string to datetime-local format
  const formatForDatetimeLocal = (isoString: string | null | undefined): string => {
    if (!isoString || !isValid(parseISO(isoString))) return '';
    const date = parseISO(isoString);
    return format(date, "yyyy-MM-dd'T'HH:mm");
  };

  // Helper function for human-friendly datetime display
  const formatHumanDateTime = (isoString: string | null | undefined): string => {
    if (!isoString || !isValid(parseISO(isoString))) return '';
    const date = parseISO(isoString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    let dateStr = '';
    if (dateOnly.getTime() === today.getTime()) {
      dateStr = 'Today';
    } else if (dateOnly.getTime() === tomorrow.getTime()) {
      dateStr = 'Tomorrow';
    } else {
      // Use short format: Jan 15
      dateStr = format(date, 'MMM d');
    }
    
    // Format time as 2:30 PM
    const timeStr = format(date, 'h:mm a');
    return `${dateStr} ${timeStr}`;
  };

  // Format times for display
  const formattedStartTime = startTime && isValid(parseISO(String(startTime))) ? format(parseISO(String(startTime)), 'p') : 'N/A';
  const formattedEndTime = endTime && isValid(parseISO(String(endTime))) ? format(parseISO(String(endTime)), 'p') : 'N/A';

  // Additional pretty date + timezone strings for read-only view
  const parsedStart = startTime && isValid(parseISO(String(startTime))) ? parseISO(String(startTime)) : null;
  const formattedDateLine = parsedStart ? format(parsedStart, 'eeee, MMMM d') : '';
  const tzAbbr = parsedStart ? new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
    .format(parsedStart)
    .split(' ') // last element is the TZ abbrev
    .pop() : '';

  // Dynamically adjust card layout: full-screen when editing, normal card otherwise
  const cardClasses = cn(
    "border border-border bg-card shadow-lg", // base
    isEditing
      ? "fixed inset-0 z-50 w-screen h-screen overflow-y-auto rounded-none mb-0 p-0"
      : "mb-6 rounded-2xl overflow-hidden hover:shadow-xl transition-shadow duration-300"
  );

  const placeEditorRef = useRef<HTMLDivElement | null>(null);

  // Close place editor when clicking outside
  useEffect(() => {
    if (!showPlaceEditor) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (placeEditorRef.current && !placeEditorRef.current.contains(e.target as Node)) {
        setShowPlaceEditor(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPlaceEditor]);

  const timeEditorRef = useRef<HTMLDivElement | null>(null);

  // Close time editor when clicking outside
  useEffect(() => {
    if (!showTimeEditor) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (timeEditorRef.current && !timeEditorRef.current.contains(e.target as Node)) {
        setShowTimeEditor(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTimeEditor]);

  return (
    <Card className={cardClasses}>
      <CardHeader className="p-0">
        {/* Header with image background */}
        <div
          className={cn(
            "relative w-full rounded-t-lg overflow-hidden",
            isEditing ? "" : "h-32 sm:h-40"
          )}
          style={isEditing ? {height:'50vh'} : undefined}
        >
          {!imageError ? (
            <Image
              src={String(itemPhotoUrl || '')}
              alt={typeof placeName === 'string' ? placeName : 'Location'}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/50 text-muted-foreground">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-muted flex items-center justify-center">
                  <ExternalLink className="h-6 w-6 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">No image available</span>
              </div>
            </div>
          )}
          
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          {/* Schedule pill overlay */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {/* Read-only collapsed view */}
            {!isEditing && (
              <div className="bg-black/80 backdrop-blur-sm rounded-full px-3 py-2 flex items-center gap-2 shadow-lg text-white">
                <CalendarClock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {formattedStartTime} - {formattedEndTime}
                </span>
              </div>
            )}
          </div>
          
          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center gap-3">
              {/* Position number indicator */}
              <div className="flex-shrink-0 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30">
                <span className="text-white font-bold text-sm">{index + 1}</span>
              </div>
              <h3 className="text-white font-semibold text-lg sm:text-xl leading-tight drop-shadow-lg flex-1">
                {typeof placeName === 'string' && placeName ? placeName : `Stop ${index + 1}`}
              </h3>
            </div>
          </div>
          
          {/* Basic place info pill - bottom right */}
          {placeInfo && (
            <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg max-w-48">
              <div className="flex items-center gap-2 text-white">
                <Info className="h-4 w-4 flex-shrink-0" />
                <div className="text-xs space-y-1">
                  {placeInfo.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{placeInfo.rating.toFixed(1)}</span>
                      {placeInfo.reviewCount && (
                        <span className="text-white/70">({abbreviateNumber(placeInfo.reviewCount)})</span>
                      )}
                    </div>
                  )}
                  {placeInfo.types && placeInfo.types.length > 0 && (
                    <div className="text-white/90 capitalize">
                      {placeInfo.types[0].replace(/_/g, ' ')}
                    </div>
                  )}
                  {placeInfo.isOperational !== undefined && (
                    <div className={`text-xs ${
                      placeInfo.isOperational ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {placeInfo.isOperational ? 'Open' : 'Closed'}
                    </div>
                  )}
                  {placeInfo.priceLevel !== undefined && placeInfo.priceLevel > 0 && (
                    <div className="text-white/90">
                      {'$'.repeat(placeInfo.priceLevel)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons overlay - only for collapsed (view) mode */}
          {!isEditing && (
            <div className="absolute top-3 right-3 flex items-center gap-1">
              {/* Move buttons */}
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => move(index, index - 1)}
                disabled={isFirst}
                className="h-8 w-8 bg-card/90 hover:bg-card text-card-foreground shadow-sm backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed border border-border/50"
              >
                <MoveUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => move(index, index + 1)}
                disabled={isLast}
                className="h-8 w-8 bg-card/90 hover:bg-card text-card-foreground shadow-sm backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed border border-border/50"
              >
                <MoveDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={handleEdit}
                className="h-8 w-8 bg-secondary/90 hover:bg-secondary text-secondary-foreground shadow-sm backdrop-blur-sm"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
              {!isOnlyItem && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleRemove}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Transit Information - Only show in editing mode */}
        {isEditing && index > 0 && (
          <div className="bg-gradient-to-r from-accent/10 to-accent/5 rounded-xl p-4 border border-accent/20">
            <div className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/20 rounded-lg">
                  {transitModeOptions.find(option => option.value === transitMode)?.icon && (
                    React.createElement(transitModeOptions.find(option => option.value === transitMode)!.icon, {
                      className: "h-5 w-5 text-accent"
                    })
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground capitalize">{transitMode || 'driving'}</p>
                  {isCalculatingTransit ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Calculating route...</span>
                    </div>
                  ) : (
                    currentItem?.transitTimeFromPreviousMinutes && (
                      <p className="text-xs text-muted-foreground">{currentItem.transitTimeFromPreviousMinutes} minutes</p>
                    )
                  )}
                </div>
              </div>
              
              <FormField
                control={control}
                name={getFieldPath('transitMode')}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">🚗 Travel Mode</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={String(field.value || 'driving')}>
                      <FormControl>
                        <SelectTrigger className="w-[120px] h-8 bg-background border-border">
                          <SelectValue placeholder="Travel mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {transitModeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <option.icon className="h-4 w-4" />
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}
        
        {/* Form Fields */}
        {isEditing ? (
          <div className="space-y-4">
            {/* Essential Fields Section */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {/* Place Name Field or collapsed button */}
              <div className="md:col-span-2 space-y-1">
                {showPlaceEditor ? (
                  <div ref={placeEditorRef}>
                  <FormField
                    control={control}
                    name={getFieldPath('placeName')}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">📍 Place</FormLabel>
                        <FormControl>
                          <PlaceAutocomplete
                            value={String(field.value || '')}
                            onPlaceSelect={handlePlaceSelect}
                            onInputChange={(value) => {
                              setValue(getFieldPath('placeName'), value, { shouldValidate: false, shouldDirty: true });
                              if (placeNameDebounceTimeoutRef.current) clearTimeout(placeNameDebounceTimeoutRef.current);
                              placeNameDebounceTimeoutRef.current = setTimeout(() => trigger(getFieldPath('placeName')), 300);
                            }}
                            placeholder="Place Name *"
                            className="h-11 text-sm"
                            isGoogleMapsApiLoaded={isGoogleMapsApiLoaded}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPlaceEditor(true)}
                    className="w-full bg-muted/20 hover:bg-muted/30 rounded-lg px-4 py-3 text-left transition-colors flex items-center gap-3"
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      {typeof placeName === 'string' && placeName.trim() ? (
                        <p className="text-sm font-medium leading-none">{placeName}</p>
                      ) : (
                        <p className="text-sm font-medium leading-none text-muted-foreground">Add place</p>
                      )}
                    </div>
                  </button>
                )}
              </div>

              {/* Date / Time Display (tap to edit) */}
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowTimeEditor((prev) => !prev)}
                  className="w-full bg-muted/20 hover:bg-muted/30 rounded-lg px-4 py-3 text-left transition-colors"
                >
                  <p className="text-sm font-medium leading-none">{formattedDateLine}</p>
                  <p className="text-xs mt-0.5 text-muted-foreground">{formattedStartTime} — {formattedEndTime} {tzAbbr}</p>
                </button>
              </div>

              {/* Time & Duration Fields */}
              {showTimeEditor && (
              <div ref={timeEditorRef} className="grid grid-cols-[1fr_110px] gap-4 pr-2 md:col-span-2">
                <FormField
                  control={control}
                  name={getFieldPath('startTime')}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">🗓️ Start</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={formatForDatetimeLocal(String(field.value || ''))}
                          onChange={(e) => {
                            const datetimeLocalValue = e.target.value;
                            if (datetimeLocalValue) {
                              const startTime = new Date(datetimeLocalValue);
                              field.onChange(startTime.toISOString());
                              
                              // Auto-calculate end time based on duration
                              const currentEndTime = watch(getFieldPath('endTime'));
                              if (!currentEndTime) {
                                // Default to 1 hour duration if no end time is set
                                const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
                                setValue(getFieldPath('endTime'), endTime.toISOString(), { shouldValidate: true });
                              }
                            } else {
                              field.onChange('');
                            }
                          }}
                          type="datetime-local"
                          className="h-11 text-sm"
                          placeholder="When?"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={control}
                  name={getFieldPath('endTime')}
                  render={({ field }) => {
                    const startTimeValue = watch(getFieldPath('startTime'));
                    const startTime = startTimeValue ? new Date(String(startTimeValue)) : null;
                    const endTime = field.value ? new Date(String(field.value)) : null;
                    
                    // Calculate duration in minutes
                    const durationMinutes = startTime && endTime ? 
                      Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)) : 60;
                    
                    const hours = Math.floor(durationMinutes / 60);
                    const minutes = durationMinutes % 60;
                    
                    return (
                      <FormItem>
                        <FormLabel className="text-sm">⏱️ Duration</FormLabel>
                        <FormControl>
                          <Select
                            value={`${hours}:${minutes.toString().padStart(2, '0')}`}
                            onValueChange={(duration) => {
                              if (startTime) {
                                const [h, m] = duration.split(':').map(Number);
                                const totalMinutes = h * 60 + m;
                                const newEndTime = new Date(startTime.getTime() + totalMinutes * 60 * 1000);
                                field.onChange(newEndTime.toISOString());
                              }
                            }}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Duration" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0:30">30min</SelectItem>
                              <SelectItem value="1:00">1h</SelectItem>
                              <SelectItem value="1:30">1.5h</SelectItem>
                              <SelectItem value="2:00">2h</SelectItem>
                              <SelectItem value="2:30">2.5h</SelectItem>
                              <SelectItem value="3:00">3h</SelectItem>
                              <SelectItem value="4:00">4h</SelectItem>
                              <SelectItem value="6:00">6h</SelectItem>
                              <SelectItem value="8:00">8h</SelectItem>
                              <SelectItem value="10:00">10h</SelectItem>
                              <SelectItem value="12:00">12h</SelectItem>
                              <SelectItem value="24:00">1 day</SelectItem>
                              <SelectItem value="48:00">2 days</SelectItem>
                              <SelectItem value="72:00">3 days</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
            )}
            </div>

            {/* Advanced Fields Toggle */}
            {!showAdvancedFields && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvancedFields(true)}
                className="w-full h-8 text-muted-foreground hover:text-foreground text-xs justify-start px-3"
              >
                <ChevronDown className="h-3 w-3 mr-2" />
                Advanced details
                {((address && String(address).trim()) || (city && String(city).trim())) && (
                  <span className="ml-1 text-xs text-primary opacity-80">(auto-filled)</span>
                )}
              </Button>
            )}

            {/* Advanced Fields Section */}
            {showAdvancedFields && (
              <div className="space-y-3 pt-2 border-t border-border/40">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Advanced Details</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedFields(false)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown className="h-3 w-3 rotate-180" />
                  </Button>
                </div>
                
                {/* Address and City in a grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    control={control}
                    name={getFieldPath('address')}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">📫 Address</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={String(field.value || '')}
                            placeholder="Address (auto-filled)"
                            className="h-9 bg-muted/20 text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={control}
                    name={getFieldPath('city')}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">🌆 City</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={String(field.value || '')}
                            placeholder="City (auto-filled)"
                            className="h-9 bg-muted/20 text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Transit Mode for non-first items */}
                {index > 0 && (
                  <div className="bg-muted/20 rounded-lg p-4 border border-border/40">
                    <div className="flex flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent/20 rounded-lg">
                          {transitModeOptions.find(option => option.value === transitMode)?.icon && (
                            React.createElement(transitModeOptions.find(option => option.value === transitMode)!.icon, {
                              className: "h-4 w-4 text-accent"
                            })
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Travel Method</p>
                          {isCalculatingTransit ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Calculating route...</span>
                            </div>
                          ) : (
                            currentItem?.transitTimeFromPreviousMinutes && (
                              <p className="text-xs text-muted-foreground">{currentItem.transitTimeFromPreviousMinutes} minutes</p>
                            )
                          )}
                        </div>
                      </div>
                      
                      <FormField
                        control={control}
                        name={getFieldPath('transitMode')}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm">🚗 Travel Mode</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={String(field.value || 'driving')}>
                              <FormControl>
                                <SelectTrigger className="w-[120px] h-8 bg-background border-border">
                                  <SelectValue placeholder="Travel mode" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {transitModeOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <div className="flex items-center gap-2">
                                      <option.icon className="h-4 w-4" />
                                      {option.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Activity Suggestions Display */}
            {currentItem?.activitySuggestions && currentItem.activitySuggestions.length > 0 && (
              <div className="bg-muted/30 rounded-xl p-4 border border-border">
                <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Activity Suggestions
                </h4>
                <div className="space-y-2">
                  {currentItem.activitySuggestions.map((suggestion, suggestionIndex) => (
                    <div key={suggestionIndex} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground leading-relaxed">{suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description Field - Collapsible */}
            <div className="md:col-span-2">
              {!showDescription ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDescription(true)}
                  className="w-full h-8 text-muted-foreground hover:text-foreground text-xs justify-start px-3"
                >
                  <ChevronDown className="h-3 w-3 mr-2" />
                  Add description <span className="opacity-60">(optional)</span>
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDescription(false)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown className="h-3 w-3 rotate-180" />
                    </Button>
                  </div>
                  <FormField
                    control={control}
                    name={getFieldPath('description')}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">📝 Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={String(field.value || '')}
                            placeholder="What will you do here? Any special notes..."
                            className="min-h-[60px] resize-none text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Read-only view with modern cards */
          <div className="space-y-4">
            {/* Location Details */}
            <div className="bg-muted/30 rounded-xl p-4 space-y-3 border border-border">
              {(placeName || currentItem?.address) && (
                <div className="space-y-2">
                  {currentItem?.address && (
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 mt-0.5 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <ExternalLink className="h-3 w-3 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Address</p>
                        <p className="text-sm text-muted-foreground">{currentItem.address}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Description */}
            {currentItem?.description && (
              <div className="bg-muted/30 rounded-xl p-4 border border-border">
                <h4 className="text-sm font-medium text-foreground mb-2">Description</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{currentItem.description}</p>
              </div>
            )}
            
            {/* Activity Suggestions */}
            {currentItem?.activitySuggestions && currentItem.activitySuggestions.length > 0 && (
              <div className="bg-muted/30 rounded-xl p-4 border border-border">
                <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Activity Suggestions
                </h4>
                <div className="space-y-2">
                  {currentItem.activitySuggestions.map((suggestion, suggestionIndex) => (
                    <div key={suggestionIndex} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground leading-relaxed">{suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {isEditing && (
        <CardFooter className="justify-end flex-wrap gap-2">
          {!isOnlyItem && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
          >
            <Ban className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSave}
            className="bg-gradient-primary/90 hover:bg-gradient-primary-hover text-primary-foreground"
          >
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

// Export the memoized component
export const EditableItineraryItemCard = memo(EditableItineraryItemCardImpl);
