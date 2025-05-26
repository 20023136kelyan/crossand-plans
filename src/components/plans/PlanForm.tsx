'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller, useFieldArray, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2, PlusCircle, ListChecks, MapPin as MapPinIcon, ArrowLeft, ArrowRight, Users as UsersIcon, Save, Sparkles, Edit3 as EditIcon } from 'lucide-react'; // Renamed Edit3 to EditIcon
import { cn } from '@/lib/utils';
import { format, addHours, parseISO, isValid as isDateValid, set } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Plan, ItineraryItem as ItineraryItemType, TransitMode, PlanStatusType, PlanTypeType, PriceRangeType } from '@/types/user';
import { EditableItineraryItemCard } from './EditableItineraryItemCard';
import { FriendMultiSelectInput } from './FriendMultiSelectInput';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, type Libraries } from '@react-google-maps/api'; // Added Libraries type
import { Separator } from '../ui/separator';

const GOOGLE_MAPS_LIBRARIES: Libraries = ['places', 'geocoding'];

const planStatusOptions = ['published', 'draft', 'cancelled'] as const;
const planTypeOptions = ['single-stop', 'multi-stop'] as const;
const priceRangeOptions = ['Free', '$', '$$', '$$$', '$$$$'] as const;
const transitModeValues = ['driving', 'walking', 'bicycling', 'transit'] as const;

export const itineraryItemSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  placeName: z.string().min(1, { message: "Place name is required." }),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  startTime: z.string().refine(val => isDateValid(parseISO(val)), { message: "Start time is required and must be a valid date." }),
  endTime: z.string().optional().nullable().refine(val => val === null || val === undefined || val === '' || isDateValid(parseISO(val)), { message: "Invalid end time format." }),
  description: z.string().optional().nullable(),
  googlePlaceId: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  googlePhotoReference: z.string().optional().nullable(), 
  googleMapsImageUrl: z.string().url().optional().nullable(), 
  rating: z.number().min(0).max(5).optional().nullable(),
  reviewCount: z.number().int().min(0).optional().nullable(),
  activitySuggestions: z.array(z.string()).optional().nullable().default([]),
  isOperational: z.boolean().optional().nullable(),
  statusText: z.string().optional().nullable(),
  openingHours: z.array(z.string()).optional().nullable().default([]),
  phoneNumber: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  priceLevel: z.number().int().min(0).max(4).optional().nullable(),
  types: z.array(z.string()).optional().nullable().default([]),
  notes: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(0).optional().nullable().default(60),
  transitMode: z.enum(transitModeValues).optional().nullable().default('driving'),
  transitTimeFromPreviousMinutes: z.number().int().min(0).optional().nullable(),
}).refine(data => {
  if (data.endTime && data.startTime && data.endTime !== '' && data.startTime !== '') {
    try {
      return parseISO(data.startTime) < parseISO(data.endTime);
    } catch (e) { return false; }
  }
  return true;
}, {
  message: "End time must be after start time.",
  path: ["endTime"],
});

export type ItineraryItemSchemaValues = z.infer<typeof itineraryItemSchema>;

const planFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, { message: 'Plan name must be at least 3 characters.' }).max(100),
  description: z.string().max(5000).optional().nullable(),
  eventDateTime: z.date({ required_error: 'Event date and time is required.' }),
  primaryLocation: z.string().min(2, { message: 'Primary location is required.' }).max(150),
  city: z.string().min(2, { message: 'City is required.' }).max(100),
  eventType: z.string().max(100).optional().nullable(),
  priceRange: z.enum(priceRangeOptions).optional().nullable(),
  invitedParticipantUserIds: z.array(z.string()).optional().default([]),
  status: z.enum(planStatusOptions),
  planType: z.enum(planTypeOptions),
  itinerary: z.array(itineraryItemSchema).min(1, "At least one itinerary item is required.").optional().default([]),
});

export type PlanFormValues = z.infer<typeof planFormSchema>;

interface PlanFormProps {
  initialData?: Plan | null;
  onSubmit: (data: PlanFormValues) => Promise<void>;
  isSubmitting?: boolean;
  formMode?: 'create' | 'edit';
  formTitle?: string;
  onBackToAICriteria?: () => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '15rem', 
  borderRadius: '0.375rem', // md
};

const defaultMapCenter = { lat: 40.7128, lng: -74.0060 }; 

const mapThemeOptions: google.maps.MapOptions = { /* ... same as before ... */
  styles: [ 
    { elementType: "geometry", stylers: [{ color: "hsl(var(--card))" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "hsl(var(--background))" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "hsl(var(--muted-foreground))" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "hsl(var(--primary))" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "hsl(var(--primary))" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "hsl(var(--card) / 0.7)" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "hsl(var(--accent-foreground))" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "hsl(var(--muted))" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "hsl(var(--border))" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "hsl(var(--muted-foreground))" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "hsl(var(--primary) / 0.5)" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "hsl(var(--border))" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "hsl(var(--foreground))" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "hsl(var(--muted) / 0.5)" }] },
    { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "hsl(var(--primary))" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "hsl(var(--secondary))" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "hsl(var(--secondary-foreground))" }] },
    { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "hsl(var(--background))" }] },
  ],
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
};


export function PlanForm({ initialData, onSubmit, isSubmitting: propIsSubmitting, formMode: propFormMode, formTitle, onBackToAICriteria }: PlanFormProps) {
  const { toast } = useToast();
  const [isSubmittingForm, setIsSubmittingForm] = useState(propIsSubmitting || false);
  const formMode = propFormMode || (initialData?.id ? 'edit' : 'create');

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey || "",
    libraries: GOOGLE_MAPS_LIBRARIES, // Use the constant here
  });

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      id: initialData?.id,
      name: initialData?.name || '',
      description: initialData?.description || '',
      eventDateTime: initialData?.eventTime && isDateValid(parseISO(initialData.eventTime)) ? parseISO(initialData.eventTime) : new Date(),
      primaryLocation: initialData?.location || initialData?.itinerary?.[0]?.placeName || '',
      city: initialData?.city || initialData?.itinerary?.[0]?.city || '',
      eventType: initialData?.eventType || '',
      priceRange: initialData?.priceRange || 'Free',
      invitedParticipantUserIds: initialData?.invitedParticipantUserIds || [],
      status: initialData?.status || 'published',
      planType: initialData?.planType || 'single-stop',
      itinerary: initialData?.itinerary?.map(item => ({
        ...item,
        id: item.id || crypto.randomUUID(),
        startTime: item.startTime && isDateValid(parseISO(item.startTime)) ? item.startTime : new Date().toISOString(),
        endTime: item.endTime && isDateValid(parseISO(item.endTime)) ? item.endTime : undefined,
        activitySuggestions: item.activitySuggestions || [],
        openingHours: item.openingHours || [],
        types: item.types || [],
        durationMinutes: item.durationMinutes ?? 60,
        transitMode: item.transitMode ?? 'driving',
        transitTimeFromPreviousMinutes: item.transitTimeFromPreviousMinutes ?? null,
      })) || [],
    },
  });
  
  useEffect(() => {
    if (initialData) {
      const timeoutId = setTimeout(() => {
        const defaultItinerary = initialData.itinerary?.map(item => ({
          ...item,
          id: item.id || crypto.randomUUID(),
          startTime: item.startTime && isDateValid(parseISO(item.startTime)) ? item.startTime : new Date().toISOString(),
          endTime: item.endTime && isDateValid(parseISO(item.endTime)) ? item.endTime : undefined,
          activitySuggestions: item.activitySuggestions || [],
          openingHours: item.openingHours || [],
          types: item.types || [],
          durationMinutes: item.durationMinutes ?? 60,
          transitMode: item.transitMode ?? 'driving',
          transitTimeFromPreviousMinutes: item.transitTimeFromPreviousMinutes ?? null,
        })) || [];

        let finalItineraryForForm = defaultItinerary;
        if (initialData.planType === 'single-stop') {
          if (defaultItinerary.length > 0) {
            finalItineraryForForm = [{ 
              ...defaultItinerary[0], 
              placeName: initialData.location || defaultItinerary[0].placeName,
              city: initialData.city || defaultItinerary[0].city,
              startTime: initialData.eventTime && isDateValid(parseISO(initialData.eventTime)) ? initialData.eventTime : defaultItinerary[0].startTime,
              description: defaultItinerary[0].description || initialData.description || '', // Prioritize item desc, then plan desc
            }];
          } else { 
            const eventTimeForNew = initialData.eventTime && isDateValid(parseISO(initialData.eventTime)) ? parseISO(initialData.eventTime) : new Date();
            finalItineraryForForm = [{
              id: crypto.randomUUID(),
              placeName: initialData.location || '',
              address: initialData.location || null,
              city: initialData.city || null,
              startTime: eventTimeForNew.toISOString(),
              endTime: addHours(eventTimeForNew, 1).toISOString(),
              description: initialData.description || '',
              durationMinutes: 60,
              transitMode: 'driving',
              activitySuggestions: [], googlePhotoReference: null, googlePlaceId: null, isOperational: null, lat: null, lng: null, notes: null, openingHours: [], phoneNumber: null, priceLevel: null, rating: null, reviewCount: null, statusText: null, transitTimeFromPreviousMinutes: null, types: [], website: null, googleMapsImageUrl: null,
            }];
          }
        }

        form.reset({
          id: initialData.id,
          name: initialData.name || '',
          description: initialData.description || '',
          eventDateTime: initialData.eventTime && isDateValid(parseISO(initialData.eventTime)) ? parseISO(initialData.eventTime) : new Date(),
          primaryLocation: initialData.location || finalItineraryForForm[0]?.placeName || '',
          city: initialData.city || finalItineraryForForm[0]?.city || '',
          eventType: initialData.eventType || '',
          priceRange: initialData.priceRange || 'Free',
          invitedParticipantUserIds: initialData.invitedParticipantUserIds || [],
          status: initialData.status || 'published',
          planType: initialData.planType || 'single-stop',
          itinerary: finalItineraryForForm.length > 0 ? finalItineraryForForm : [], // Ensure itinerary is never undefined if not single-stop
        });
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [initialData, form.reset]);


  const { fields, append, remove, move, update } = useFieldArray({
    control: form.control,
    name: "itinerary",
  });

  const primaryLocationInputRef = useRef<HTMLInputElement>(null);
  const autocompletePrimaryRef = useRef<google.maps.places.Autocomplete & { input?: HTMLInputElement; listener?: google.maps.MapsEventListener } | null>(null);
  
  const mapRef = useRef<google.maps.Map | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const singleStopSyncDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Consolidate watched values into a single useWatch call for better performance
  const watchedValues = useWatch({
    control: form.control,
    name: ['itinerary', 'planType', 'eventDateTime', 'primaryLocation', 'city', 'description']
  });

  const [watchedItinerary, watchedPlanType, watchedEventDateTime, watchedPrimaryLocation, watchedCity, watchedMainDescription] = watchedValues;

  // Memoize the itinerary items to prevent unnecessary re-renders
  const memoizedItineraryItems = useMemo(() => {
    return fields.map((field, index) => {
      const previousItem = index > 0 ? watchedItinerary?.[index - 1] : null;
      return (
        <EditableItineraryItemCard
          key={field.id}
          control={form.control}
          index={index}
          remove={remove}
          move={move}
          isGoogleMapsApiLoaded={isLoaded}
          previousItemLat={previousItem?.lat}
          previousItemLng={previousItem?.lng}
          previousItemStartTime={previousItem?.startTime}
          previousItemEndTime={previousItem?.endTime}
          isFirst={index === 0}
          isLast={index === fields.length - 1}
          isOnlyItem={fields.length === 1 && watchedPlanType === 'single-stop'}
        />
      );
    });
  }, [fields, watchedItinerary, watchedPlanType, isLoaded, form.control, remove, move]);

  const mapCenter = useMemo(() => {
    if (watchedItinerary && watchedItinerary.length > 0) {
      const firstValidItem = watchedItinerary.find(item => item.lat != null && item.lng != null);
      if (firstValidItem) {
        return { lat: firstValidItem.lat!, lng: firstValidItem.lng! };
      }
    }
    if (initialData?.itinerary?.[0]?.lat != null && initialData?.itinerary?.[0]?.lng != null) {
      return { lat: initialData.itinerary[0].lat, lng: initialData.itinerary[0].lng };
    }
    return defaultMapCenter;
  }, [watchedItinerary, initialData]);

  // Google Places Autocomplete for primaryLocation
  useEffect(() => {
    if (!isLoaded || !primaryLocationInputRef.current || typeof window === 'undefined' || !window.google || !window.google.maps.places) return;
    if (autocompletePrimaryRef.current && autocompletePrimaryRef.current.input === primaryLocationInputRef.current) return;
    
    if (autocompletePrimaryRef.current && autocompletePrimaryRef.current.listener) {
      window.google.maps.event.removeListener(autocompletePrimaryRef.current.listener);
      if(autocompletePrimaryRef.current.input) window.google.maps.event.clearInstanceListeners(autocompletePrimaryRef.current.input);
      autocompletePrimaryRef.current = null;
    }

    const newAutocomplete = new window.google.maps.places.Autocomplete(
      primaryLocationInputRef.current,
      { types: ['geocode', 'establishment'], fields: ['name', 'formatted_address', 'address_components', 'geometry', 'place_id', 'photos', 'rating', 'user_ratings_total', 'opening_hours', 'business_status', 'types', 'website', 'international_phone_number', 'price_level'] }
    ) as google.maps.places.Autocomplete & { input?: HTMLInputElement; listener?: google.maps.MapsEventListener };
    newAutocomplete.input = primaryLocationInputRef.current;

    const listener = newAutocomplete.addListener('place_changed', () => {
      const place = newAutocomplete.getPlace();
      if (place.geometry && place.address_components) {
        const placeNameForForm = place.name || place.formatted_address || '';
        form.setValue('primaryLocation', placeNameForForm, { shouldValidate: true });
        
        let city = '';
        const cityComponent = place.address_components.find(c => c.types.includes('locality') || c.types.includes('postal_town'));
        if (cityComponent) city = cityComponent.long_name;
        else {
          const adminLevel2 = place.address_components.find(c => c.types.includes('administrative_area_level_2'));
          if (adminLevel2) city = adminLevel2.long_name;
        }
        form.setValue('city', city, { shouldValidate: true });
        
        if (form.getValues('planType') === 'single-stop') {
            const currentItinerary = form.getValues('itinerary') || [];
            const defaultStartTime = form.getValues('eventDateTime').toISOString();
            const duration = currentItinerary[0]?.durationMinutes || 60;
            const endTime = new Date(parseISO(defaultStartTime).getTime() + duration * 60000).toISOString();

            const singleItem: ItineraryItemSchemaValues = {
                id: currentItinerary[0]?.id || crypto.randomUUID(),
                placeName: placeNameForForm,
                address: place.formatted_address || null,
                city: city || null,
                startTime: defaultStartTime,
                endTime: endTime,
                description: currentItinerary[0]?.description || form.getValues('description') || '', // Use item's description if it exists
                googlePlaceId: place.place_id || null,
                lat: place.geometry.location?.lat() ?? null,
                lng: place.geometry.location?.lng() ?? null,
                googlePhotoReference: place.photos?.[0]?.photo_reference || null,
                rating: place.rating ?? null,
                reviewCount: place.user_ratings_total ?? null,
                activitySuggestions: currentItinerary[0]?.activitySuggestions || [],
                isOperational: place.business_status === 'OPERATIONAL',
                statusText: place.business_status || null,
                openingHours: place.opening_hours?.weekday_text || [],
                phoneNumber: place.international_phone_number || null,
                website: place.website || null,
                priceLevel: place.price_level ?? null,
                types: place.types || [],
                notes: currentItinerary[0]?.notes || null,
                durationMinutes: duration,
                transitMode: currentItinerary[0]?.transitMode || 'driving',
                transitTimeFromPreviousMinutes: null,
            };
            if (currentItinerary.length > 0) {
                form.setValue('itinerary.0', singleItem, { shouldValidate: true });
            } else {
                append(singleItem, { shouldFocus: false });
            }
        }
      }
    });
    newAutocomplete.listener = listener; 
    autocompletePrimaryRef.current = newAutocomplete;
    return () => {
      if (listener && window.google && window.google.maps) window.google.maps.event.removeListener(listener);
      if (newAutocomplete.input && typeof window.google !== 'undefined' && window.google.maps) {
        window.google.maps.event.clearInstanceListeners(newAutocomplete.input);
      }
    };
  }, [isLoaded, form, append]);

  // Sync first itinerary item for single-stop plans when form fields change
  useEffect(() => {
    if (singleStopSyncDebounceTimeoutRef.current) {
      clearTimeout(singleStopSyncDebounceTimeoutRef.current);
    }

    singleStopSyncDebounceTimeoutRef.current = setTimeout(() => {
      if (watchedPlanType === 'single-stop') {
        const currentItinerary = form.getValues('itinerary') || [];
        const eventDT = form.getValues('eventDateTime');
        const pLoc = form.getValues('primaryLocation');
        const cty = form.getValues('city');
        // For single-stop, the item description might come from initialData.description or a dedicated field if we had one.
        // For now, if AI generated a plan, its itinerary[0].description should be used.
        // If manually creating, the user will edit the description in the EditableItineraryItemCard.
        const itemDescription = currentItinerary[0]?.description || ''; // Maintain existing item description if present

        const itemToUpdate: ItineraryItemSchemaValues = {
          id: currentItinerary[0]?.id || crypto.randomUUID(),
          placeName: pLoc,
          address: pLoc, // Simplified: primaryLocation is often just name, not full address.
          city: cty,
          startTime: (eventDT && typeof eventDT.toISOString === 'function') 
                       ? eventDT.toISOString() 
                       : new Date().toISOString(), // Fallback if eventDT is not a valid Date
          endTime: (eventDT && typeof eventDT.toISOString === 'function') 
                     ? addHours(eventDT, currentItinerary[0]?.durationMinutes || 1).toISOString() 
                     : addHours(new Date(), 1).toISOString(), // Fallback
          description: itemDescription, // Use existing or default
          durationMinutes: currentItinerary[0]?.durationMinutes || 60, // Default to 60 if not set
          transitMode: currentItinerary[0]?.transitMode || 'driving',
          lat: currentItinerary[0]?.lat || null, // Keep existing geo if any
          lng: currentItinerary[0]?.lng || null,
          googlePlaceId: currentItinerary[0]?.googlePlaceId || null,
          googlePhotoReference: currentItinerary[0]?.googlePhotoReference || null,
          rating: currentItinerary[0]?.rating || null,
          reviewCount: currentItinerary[0]?.reviewCount || null,
          activitySuggestions: currentItinerary[0]?.activitySuggestions || [],
          isOperational: currentItinerary[0]?.isOperational === undefined ? null : currentItinerary[0]?.isOperational,
          statusText: currentItinerary[0]?.statusText || null,
          openingHours: currentItinerary[0]?.openingHours || [],
          phoneNumber: currentItinerary[0]?.phoneNumber || null,
          website: currentItinerary[0]?.website || null,
          priceLevel: currentItinerary[0]?.priceLevel || null,
          types: currentItinerary[0]?.types || [],
          notes: currentItinerary[0]?.notes || null,
          transitTimeFromPreviousMinutes: null,
          googleMapsImageUrl: currentItinerary[0]?.googleMapsImageUrl || null,
        };
        const existingItem = currentItinerary.length > 0 ? currentItinerary[0] : null;

        if (!existingItem && pLoc) { // If no items and primary location is set, add the first item
          append(itemToUpdate, { shouldFocus: false });
        } else if (existingItem) { 
          // Determine if the core properties of itinerary[0] that are derived from the watched dependencies have actually changed.
          const needsUpdate = 
            existingItem.placeName !== itemToUpdate.placeName ||
            existingItem.address !== itemToUpdate.address || // itemToUpdate.address is pLoc
            existingItem.city !== itemToUpdate.city ||       // itemToUpdate.city is cty
            existingItem.startTime !== itemToUpdate.startTime || 
            existingItem.endTime !== itemToUpdate.endTime;

          if (needsUpdate) {
            form.setValue('itinerary.0', itemToUpdate, { shouldValidate: true });
          }

          // If planType is 'single-stop', ensure the 'itinerary' array contains exactly one item.
          // This item should be `itemToUpdate` if an update occurred, otherwise `existingItem`.
          if (currentItinerary.length > 1) { // Only call form.setValue for the whole array if we are trimming multiple items
            form.setValue('itinerary', [needsUpdate ? itemToUpdate : existingItem], { shouldValidate: true });
          }
          // The case where `needsUpdate` is true and `currentItinerary.length === 1` is already
          // handled by the `form.setValue('itinerary.0', itemToUpdate, ...)` call.
          // Setting the whole array again with `form.setValue('itinerary', [itemToUpdate], ...)` is redundant
          // and potentially destabilizing for the `EditableItineraryItemCard`'s `isEditing` state.
        }
      } else if (watchedPlanType === 'multi-stop' && (form.getValues('itinerary') || []).length === 0 && initialData?.itinerary && initialData.itinerary.length > 0) {
          // If switching to multi-stop and itinerary is empty, but initialData had multi-stop itinerary, restore it.
          form.setValue('itinerary', initialData.itinerary.map(item => ({
              ...item, 
              id: item.id || crypto.randomUUID(),
              startTime: item.startTime && isDateValid(parseISO(item.startTime)) ? item.startTime : new Date().toISOString(),
              endTime: item.endTime && isDateValid(parseISO(item.endTime)) ? item.endTime : undefined,
          })));
      } else if (watchedPlanType === 'multi-stop' && (form.getValues('itinerary') || []).length === 0 && !initialData?.itinerary) {
          // If multi-stop and no initial data and no items, add a default first item based on main plan details
          const eventDT = form.getValues('eventDateTime');
          const pLoc = form.getValues('primaryLocation');
          const cty = form.getValues('city');
          if(pLoc && cty && eventDT && typeof eventDT.toISOString === 'function') { // Only add if essential info is there and eventDT is valid
              append({
                  id: crypto.randomUUID(),
                  placeName: pLoc, address: pLoc, city: cty,
                  startTime: eventDT.toISOString(), endTime: addHours(eventDT, 1).toISOString(),
                  description: null, durationMinutes: 60, transitMode: 'driving',
                  activitySuggestions: [], googlePhotoReference: null, googlePlaceId: null, isOperational: null, lat: null, lng: null, notes: null, openingHours: [], phoneNumber: null, priceLevel: null, rating: null, reviewCount: null, statusText: null, transitTimeFromPreviousMinutes: null, types: [], website: null, googleMapsImageUrl: null,
              }, {shouldFocus: false});
          }
      }
    }, 300); // 300ms delay

    return () => {
      if (singleStopSyncDebounceTimeoutRef.current) {
        clearTimeout(singleStopSyncDebounceTimeoutRef.current);
      }
    };
  }, [
    watchedPlanType, 
    watchedEventDateTime, 
    watchedPrimaryLocation, 
    watchedCity, 
    form, 
    append, 
    initialData
  ]);


  // Sync main plan details from the first itinerary item (if it changes from within the card)
  useEffect(() => {
    const firstItem = form.getValues('itinerary.0');
    if (firstItem) {
      const currentPrimaryLocation = form.getValues('primaryLocation');
      const currentCity = form.getValues('city');
      const currentEventDateTime = form.getValues('eventDateTime');

      if (currentPrimaryLocation !== firstItem.placeName && firstItem.placeName) {
        const placeNameValue = firstItem.placeName;
        form.setValue('primaryLocation', placeNameValue, { shouldValidate: true });
      }
      if (currentCity !== (firstItem.city || '') && firstItem.city) {
        const cityValue = firstItem.city || '';
        form.setValue('city', cityValue, { shouldValidate: true });
      }
      if (firstItem.startTime && 
          isDateValid(parseISO(firstItem.startTime)) && 
          currentEventDateTime.toISOString() !== firstItem.startTime) {
        try {
            const newEventDateTime = parseISO(firstItem.startTime);
            form.setValue('eventDateTime', newEventDateTime, { shouldValidate: true });
        } catch (e) { console.error("Error parsing firstItem.startTime for eventDateTime sync:", e); }
      }
    }
  }, [form.watch('itinerary.0.placeName'), form.watch('itinerary.0.city'), form.watch('itinerary.0.startTime'), form.setValue]);


  useEffect(() => {
    if (mapRef.current && watchedItinerary && watchedItinerary.length > 0 && isLoaded && window.google && window.google.maps) {
      const bounds = new window.google.maps.LatLngBounds();
      let hasValidMarkers = false;
      watchedItinerary.forEach(item => {
        if (item.lat != null && item.lng != null) {
          try {
            bounds.extend(new window.google.maps.LatLng(item.lat, item.lng));
            hasValidMarkers = true;
          } catch (e) { console.error("Error extending bounds with lat/lng:", item.lat, item.lng, e); }
        }
      });
      if (hasValidMarkers && mapRef.current && bounds && !bounds.isEmpty()) {
        mapRef.current.fitBounds(bounds);
        const validMarkersCount = watchedItinerary.filter(item => item.lat != null && item.lng != null).length;
        if (validMarkersCount === 1 && mapRef.current.getZoom() && mapRef.current.getZoom()! > 14) {
          mapRef.current.setZoom(14);
        }
      }
    }
  }, [watchedItinerary, isLoaded, mapRef.current]);


  const handleAddItineraryStop = () => {
    const lastItem = fields.length > 0 ? form.getValues(`itinerary.${fields.length - 1}`) : null;
    let newStartTime = new Date();
    if (lastItem?.endTime && lastItem.endTime !== '' && isDateValid(parseISO(lastItem.endTime))) {
        try { newStartTime = addHours(parseISO(lastItem.endTime), 1); } 
        catch (e) { newStartTime = addHours(new Date(), 1); }
    } else if (lastItem?.startTime && lastItem.startTime !== '' && isDateValid(parseISO(lastItem.startTime))) {
        try { newStartTime = addHours(parseISO(lastItem.startTime), ((lastItem.durationMinutes || 60) / 60) + 1); } 
        catch (e) { newStartTime = addHours(new Date(), 2); }
    } else {
        const planEventDateTime = form.getValues('eventDateTime');
        newStartTime = planEventDateTime ? new Date(planEventDateTime) : addHours(new Date(), 1);
        if (fields.length > 0) newStartTime = addHours(newStartTime, fields.length);
    }

    append({
      id: crypto.randomUUID(),
      placeName: '', address: null, city: form.getValues('city') || null,
      startTime: newStartTime.toISOString(), endTime: addHours(newStartTime, 1).toISOString(),
      description: null, googlePlaceId: null, lat: null, lng: null, googlePhotoReference: null,
      googleMapsImageUrl: null, rating: null, reviewCount: null, activitySuggestions: [], isOperational: null, statusText: null,
      openingHours: [], phoneNumber: null, website: null, priceLevel: null, types: [], notes: null,
      durationMinutes: 60, transitMode: 'driving', transitTimeFromPreviousMinutes: null,
    }, { shouldFocus: true }); // Focus on new item
  };

  const processAndSubmit = async (data: PlanFormValues) => {
      setIsSubmittingForm(true);
      try {
          await onSubmit(data);
      } catch (error) {
          console.error("Error during form submission wrapper:", error);
          toast({ title: "Submission Error", description: "An unexpected error occurred.", variant: "destructive" });
      } finally {
          setIsSubmittingForm(false);
      }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(processAndSubmit)} className="space-y-0 flex flex-col h-full"> {/* Make form flex col and take height */}
        {/* Form Header Area */}
        <div className="p-4 border-b border-border/30">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-foreground/90">{formTitle || (formMode === 'edit' ? 'Edit Plan' : 'Create Plan')}</h2>
            {onBackToAICriteria && (
              <Button type="button" variant="ghost" onClick={onBackToAICriteria} disabled={isSubmittingForm} className="text-sm h-8">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to AI Inputs
              </Button>
            )}
          </div>
        </div>

        {/* Main Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar-vertical">
          {/* Section: Core Details */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-foreground/80 flex items-center"><MapPinIcon className="mr-2 h-4 w-4 text-primary/70"/>Plan Location & Time</h3>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem><FormLabel className="text-xs">Plan Name</FormLabel><FormControl><Input placeholder="e.g., Awesome Weekend Getaway" {...field} className="text-sm h-9" /></FormControl><FormMessage className="text-xs" /></FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eventDateTime"
              render={({ field }) => (
                <FormItem className="flex flex-col space-y-1">
                  <FormLabel className="text-xs">Primary Event Date & Time</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={'outline'} className={cn('w-full justify-start text-left font-normal text-sm h-9', !field.value && 'text-muted-foreground')}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value && isDateValid(field.value) ? format(field.value, 'MMM d, yyyy p') : <span>Pick a date and time</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} initialFocus />
                      <div className="p-2 border-t"><Input type="time" defaultValue={field.value && isDateValid(field.value) ? format(field.value, 'HH:mm') : '12:00'}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':').map(Number);
                          const newDate = new Date(field.value || new Date());
                          if (isDateValid(newDate)) {
                            newDate.setHours(hours, minutes);
                            field.onChange(newDate);
                          }
                        }} className="text-sm h-9" />
                      </div>
                    </PopoverContent>
                  </Popover>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="primaryLocation"
              render={({ field }) => (
                <FormItem><FormLabel className="text-xs">Primary Location / Venue</FormLabel><FormControl><Input placeholder="e.g., Central Park or search" {...field} ref={primaryLocationInputRef} disabled={!isLoaded && !!googleMapsApiKey && !loadError} className="text-sm h-9" /></FormControl>
                {!isLoaded && !!googleMapsApiKey && !loadError && <FormDescription className="text-xs text-muted-foreground">Maps API loading...</FormDescription>}
                {loadError && <FormDescription className="text-xs text-destructive">Error loading Maps API.</FormDescription>}
                <FormMessage className="text-xs" /></FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem><FormLabel className="text-xs">City</FormLabel><FormControl><Input placeholder="Auto-filled from location" {...field} value={field.value ?? ''} readOnly={!!autocompletePrimaryRef.current && isLoaded} className="text-sm h-9" /></FormControl><FormMessage className="text-xs" /></FormItem>
              )}
            />
          </div>
          <Separator className="my-5 bg-border/30" />

          {/* Section: Define Your Plan */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-foreground/80">Plan Details</h3>
             <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem><FormLabel className="text-xs">Overall Plan Description</FormLabel><FormControl><Textarea placeholder="Describe the overall plan, vibe, etc." {...field} value={field.value ?? ''} className="text-sm min-h-[80px]" /></FormControl><FormMessage className="text-xs" /></FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="eventType"
                render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Event Type</FormLabel><FormControl><Input placeholder="e.g., Birthday Party" {...field} value={field.value ?? ''} className="text-sm h-9" /></FormControl><FormMessage className="text-xs" /></FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priceRange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Price Range</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined} >
                      <FormControl ref={field.ref}><SelectTrigger className="text-sm h-9"><SelectValue placeholder="Select price" /></SelectTrigger></FormControl>
                      <SelectContent>{priceRangeOptions.map(opt => <SelectItem key={opt} value={opt} className="text-sm">{opt}</SelectItem>)}</SelectContent>
                    </Select><FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <Separator className="my-5 bg-border/30" />

          {/* Section: Event Itinerary */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-md font-medium text-foreground/80 flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary/70"/>Event Itinerary</h3>
                <FormField
                  control={form.control}
                  name="planType"
                  render={({ field }) => (
                    <FormItem className="w-40"> {}
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl ref={field.ref}><SelectTrigger className="text-xs h-8"><SelectValue placeholder="Plan type" /></SelectTrigger></FormControl>
                        <SelectContent>{planTypeOptions.map(opt => <SelectItem key={opt} value={opt} className="text-xs">{opt === 'single-stop' ? 'Single Stop' : 'Multi-Stop'}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
            </div>

            {isLoaded && watchedPlanType === 'multi-stop' && watchedItinerary && watchedItinerary.length > 0 && (
              <div className="mt-2 mb-4 h-48 rounded-md overflow-hidden border border-border/30">
                <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={mapCenter} zoom={watchedItinerary.filter(i => i.lat && i.lng).length > 1 ? 5 : 12} options={mapThemeOptions} onLoad={map => { mapRef.current = map; }}>
                {watchedItinerary.map((item, idx) => 
                    item.lat != null && item.lng != null ? (
                    <MarkerF 
                        key={item.id || idx} 
                        position={{ lat: item.lat, lng: item.lng }} 
                        label={{ text: `${idx + 1}`, color: "white", fontWeight: "bold" }}
                        onClick={() => setActiveMarker(item.id)}
                    />
                    ) : null
                )}
                {activeMarker && watchedItinerary?.find(item => item.id === activeMarker && item.lat != null && item.lng != null) && (
                    <InfoWindowF
                    position={{ 
                        lat: watchedItinerary.find(item => item.id === activeMarker)!.lat!, 
                        lng: watchedItinerary.find(item => item.id === activeMarker)!.lng! 
                    }}
                    onCloseClick={() => setActiveMarker(null)}
                    options={{ pixelOffset: new window.google.maps.Size(0, -30) }}
                    >
                    <div className="p-1 text-xs font-medium text-foreground bg-background/80 rounded-md shadow">
                        {watchedItinerary.find(item => item.id === activeMarker)?.placeName}
                    </div>
                    </InfoWindowF>
                )}
                </GoogleMap>
              </div>
            )}
            
            {memoizedItineraryItems}
            {watchedPlanType === 'multi-stop' && (
              <Button type="button" variant="outline" onClick={handleAddItineraryStop} className="w-full text-sm h-9" disabled={isSubmittingForm || (!isLoaded && !!googleMapsApiKey && !loadError) }>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Itinerary Stop
              </Button>
            )}
          </div>
          <Separator className="my-5 bg-border/30" />
          
          {/* Section: Invite Participants */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-foreground/80 flex items-center"><UsersIcon className="mr-2 h-5 w-5 text-primary/70"/>Invite Participants</h3>
            <FriendMultiSelectInput
              control={form.control}
              name="invitedParticipantUserIds"
              label="Select friends to invite"
              description="They will be able to see this plan if it's published."
            />
          </div>
          <Separator className="my-5 bg-border/30" />

          {/* Section: Finalize & Publish */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-foreground/80">Finalize</h3>
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Plan Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl ref={field.ref}><SelectTrigger className="text-sm h-9"><SelectValue placeholder="Set status" /></SelectTrigger></FormControl>
                    <SelectContent>{planStatusOptions.map(opt => <SelectItem key={opt} value={opt} className="text-sm">{opt.charAt(0).toUpperCase() + opt.slice(1)}</SelectItem>)}</SelectContent>
                  </Select><FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Sticky Footer for Actions */}
        <div className="sticky bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-sm border-t border-border/30 z-10 flex justify-end items-center gap-3">
          {onBackToAICriteria && (
            <Button type="button" variant="ghost" onClick={onBackToAICriteria} disabled={isSubmittingForm} className="h-10 text-sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to AI Inputs
            </Button>
          )}
          <Button type="submit" disabled={isSubmittingForm || (!isLoaded && !!googleMapsApiKey && !loadError && formMode === 'create')} className="h-10 text-sm">
            {(isSubmittingForm || (!isLoaded && !!googleMapsApiKey && !loadError && formMode === 'create')) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {formMode === 'create' ? (initialData?.id ? 'Save Generated Plan' : 'Create Plan') : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

