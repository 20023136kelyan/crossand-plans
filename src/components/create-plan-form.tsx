// @ts-nocheck
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, FormProvider } from "react-hook-form";
import type { Control } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { createPlan, updatePlan } from "@/lib/actions/plans";
import { 
  getAIPlanDescription, 
  getAIPlanEventType, 
  getAIItineraryItemDetails
} from "@/lib/actions/ai";

import type { GenerateItineraryItemDetailsInput as AIGenerateItineraryItemDetailsInput, GeneratePlanDescriptionInput, GeneratePlanEventTypeInput } from "@/ai/flows/generate-full-plan-details"; 
import { planSchema, itineraryItemSchema, ZodAIItineraryInputSchema } from "@/lib/schemas";
import { MOCK_USER_ID, type PlanStatus, type Plan as PlanType, type ItineraryItem as PlanItineraryItemType } from "@/types"; 
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FriendMultiSelectInput } from "./friend-multi-select-input";
import { PriceRangeInput } from "./price-range-input";
import { userProfilesDb, MOCK_INVITABLE_FRIENDS_DATA } from "@/lib/mock-data";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isValid as isValidDate, addHours, addMinutes, formatISO, isBefore } from 'date-fns';
import { cn } from "@/lib/utils";
import Image from "next/image";
import { 
    Loader2, 
    Users, 
    Feather, 
    MapPin, 
    CalendarIcon, 
    DollarSign, 
    ListOrdered, 
    PlusCircle, 
    Trash2,
    Edit,
    Save,
    X,
    Clock,
    Info,
    GripVertical,
    RefreshCw,
    Map as MapIcon, 
    ArrowUp,
    ArrowDown,
    Sparkles,
    Check,
    Lightbulb
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from "react";
import { Slider } from "@/components/ui/slider"; 
import debounce from 'lodash.debounce';
import { PlaceStatusBadges } from "@/components/place-status-badges";
import { COMMON_PRICE_RANGES } from "@/lib/constants";


type PlanFormValues = z.infer<typeof planSchema>;
type ItineraryItemFormValues = z.infer<typeof itineraryItemSchema>;


const generateComprehensivePreferencesForParticipant = (userId: string): string[] => {
  const profile = userProfilesDb[userId];
  if (!profile) return [];
  const prefs: string[] = [];
  if (profile.allergies) profile.allergies.forEach(a => prefs.push(`Allergic to ${a}`));
  if (profile.dietaryRestrictions) profile.dietaryRestrictions.forEach(d => prefs.push(`Dietary restriction: ${d}`));
  if (profile.preferences) profile.preferences.forEach(p => prefs.push(p.toString())); 
  if (profile.favoriteCuisines) profile.favoriteCuisines.forEach(c => prefs.push(`Loves ${c} cuisine`));
  if (profile.physicalLimitations) profile.physicalLimitations.forEach(l => prefs.push(`Physical limitation: ${l}`));
  if (profile.activityTypePreferences) profile.activityTypePreferences.forEach(a => prefs.push(`Enjoys ${a}`));
  if (profile.activityTypeDislikes) profile.activityTypeDislikes.forEach(a => prefs.push(`Dislikes ${a}`));
  if (profile.environmentalSensitivities) profile.environmentalSensitivities.forEach(s => prefs.push(`Sensitive to ${s}`));
  if (profile.socialPreferences) profile.socialPreferences.forEach(s => prefs.push(`Socially prefers: ${s}`));
  if (profile.travelTolerance) prefs.push(`Travel tolerance: ${profile.travelTolerance}`);
  if (profile.budgetFlexibilityNotes) prefs.push(`Budget notes: ${profile.budgetFlexibilityNotes}`);
  return Array.from(new Set(prefs));
};


declare global {
  interface Window {
    google?: typeof google;
    initMapCreateForm?: () => void; 
  }
}

const GOOGLE_MAPS_SCRIPT_ID_CREATE_FORM = 'google-maps-script-create-form';
const GOOGLE_MAPS_CALLBACK_CREATE_FORM = 'initMapCreateForm';


interface CreatePlanFormProps {
  initialFormValues: Partial<PlanFormValues>;
  formMode: 'create' | 'edit';
  planIdForEdit?: string;
  onFormSubmitSuccess?: (planId: string) => void;
}

// Helper function to search place details using Google Maps Places API
async function searchPlaceDetails(placeName: string, city?: string): Promise<GooglePlaceDetails | null> {
  try {
    const searchQuery = city ? `${placeName} ${city}` : placeName;
    const response = await fetch(
      `/api/places/search?query=${encodeURIComponent(searchQuery)}`
    );
    
    const placeDetails = await response.json();
    
    if (!response.ok) {
      console.error('Error from places API:', placeDetails);
      return {
        placeId: `unknown_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        formattedAddress: `${placeName}, ${city || ''}`,
        location: { lat: 0, lng: 0 },
        businessStatus: 'UNKNOWN',
        status: 'UNKNOWN',
        city: city || '',
        isOperational: false,
        statusText: 'Status unknown - Place details not found'
      };
    }

    // If we got an error response but with status 200 (fallback data)
    if (placeDetails.error) {
      return {
        placeId: `unknown_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        formattedAddress: placeDetails.formattedAddress || `${placeName}, ${city || ''}`,
        location: { lat: 0, lng: 0 },
        businessStatus: placeDetails.businessStatus || 'UNKNOWN',
        status: placeDetails.status || 'UNKNOWN',
        city: placeDetails.city || city || '',
        isOperational: false,
        statusText: 'Status unknown - Place details not found'
      };
    }

    // Ensure we have valid business status
    const businessStatus = placeDetails.businessStatus || 'UNKNOWN';
    const isOperational = businessStatus === 'OPERATIONAL';
    const statusText = businessStatus === 'OPERATIONAL' ? 'Open for business' :
                      businessStatus === 'CLOSED_TEMPORARILY' ? 'Temporarily closed' :
                      businessStatus === 'CLOSED_PERMANENTLY' ? 'Permanently closed' :
                      'Status unknown';

    return {
      placeId: placeDetails.placeId,
      formattedAddress: placeDetails.formattedAddress,
      location: placeDetails.location,
      formattedPhoneNumber: placeDetails.formattedPhoneNumber,
      website: placeDetails.website,
      rating: placeDetails.rating,
      userRatingsTotal: placeDetails.userRatingsTotal,
      priceLevel: placeDetails.priceLevel,
      types: placeDetails.types || [],
      openingHours: placeDetails.openingHours,
      businessStatus: businessStatus,
      url: placeDetails.url,
      city: placeDetails.city || city || '',
      status: businessStatus,
      isOperational: isOperational,
      statusText: statusText
    };
  } catch (error) {
    console.error('Error fetching place details:', error);
    return {
      placeId: `unknown_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      formattedAddress: `${placeName}, ${city || ''}`,
      location: { lat: 0, lng: 0 },
      businessStatus: 'UNKNOWN',
      status: 'UNKNOWN',
      city: city || '',
      isOperational: false,
      statusText: 'Status unknown - Error fetching place details'
    };
  }
}

// Types for Google Maps API responses
interface GooglePlaceDetails {
  placeId: string;
  formattedAddress: string;
  location: {
    lat: number;
    lng: number;
  };
  formattedPhoneNumber?: string;
  website?: string;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  types?: string[];
  openingHours?: {
    open_now?: boolean;
    periods?: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
    weekday_text?: string[];
  };
  businessStatus?: string;
  url?: string;
  city: string;
  status: string;
  isOperational: boolean;
  statusText: string;
}

export function CreatePlanForm({ initialFormValues, formMode, planIdForEdit, onFormSubmitSuccess }: CreatePlanFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [editingItineraryIndex, setEditingItineraryIndex] = useState<number | null>(null);
  const [newItineraryItemName, setNewItineraryItemName] = useState("");
  const [newItineraryItemAddress, setNewItineraryItemAddress] = useState(""); 
  const [newItineraryItemCity, setNewItineraryItemCity] = useState(""); 
  const [isAddingItineraryItem, setIsAddingItineraryItem] = useState(false);
  const [mapApiKeyMissing, setMapApiKeyMissing] = useState(false);
  const [isMapApiLoaded, setIsMapApiLoaded] = useState(false);
  
  const newItineraryItemInputRef = useRef<HTMLInputElement>(null); 
  const mainLocationAutocompleteInputRef = useRef<HTMLInputElement | null>(null); 
  const editingItineraryItemInputRef = useRef<HTMLInputElement | null>(null);
  
  const newItineraryAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mainLocationAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const editingItineraryAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isAutocompleteUpdateInProgress, setIsAutocompleteUpdateInProgress] = useState(false);


  const [watchedMapRadiusKm, setWatchedMapRadiusKm] = useState(initialFormValues.mapRadiusKm ?? 5);


  const [isGeneratingField, setIsGeneratingField] = useState<Record<string, boolean>>({});
  
  const defaultEventTime = formatISO(addHours(new Date(), 24));
  
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: initialFormValues.name || "",
      description: initialFormValues.description || "",
      eventTime: (() => {
        if (!initialFormValues.eventTime) return defaultEventTime;
        try {
          const parsedTime = parseISO(initialFormValues.eventTime);
          return isValidDate(parsedTime) ? formatISO(parsedTime) : defaultEventTime;
        } catch (e) {
          console.warn("Error parsing initial event time, using default:", e);
          return defaultEventTime;
        }
      })(),
      location: initialFormValues.location || "", 
      city: initialFormValues.city || "",     
      eventType: initialFormValues.eventType || "",
      priceRange: initialFormValues.priceRange || "",
      status: initialFormValues.status || "draft",
      planType: initialFormValues.planType || "multi-stop",
      invitedParticipantUserIds: initialFormValues.invitedParticipantUserIds || [],
      itinerary: initialFormValues.itinerary || [],
      selectedPoint: initialFormValues.selectedPoint || null,
      mapRadiusKm: initialFormValues.mapRadiusKm || 5,
      userEnteredCityForStep2: initialFormValues.userEnteredCityForStep2 || null,
    },
    mode: "onSubmit",
  });
  
  const { fields: itineraryFields, append: appendItineraryItem, remove: removeItineraryItem, update: updateItineraryItem, move: moveItineraryItem } = useFieldArray({
    control: form.control,
    name: "itinerary",
    keyName: "fieldId" 
  });

  useEffect(() => {
    setIsClient(true);
     if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      setMapApiKeyMissing(true);
      console.warn("Google Maps API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) is missing. Autocomplete features will be limited.");
    }
  }, []);

  useEffect(() => {
    const defaults = {
      ...initialFormValues,
      eventTime: initialFormValues.eventTime && isValidDate(parseISO(initialFormValues.eventTime)) 
                 ? initialFormValues.eventTime 
                 : new Date(Date.now() + 3600 * 1000 * 24).toISOString(),
    };
    form.reset(defaults, { shouldDirty: true });

    // Fetch business status for all itinerary items
    const fetchBusinessStatus = async () => {
      if (defaults.itinerary?.length) {
        const updatedItinerary = await Promise.all(defaults.itinerary.map(async (item) => {
          if (!item.businessStatus || !item.city) {
            const placeDetails = await searchPlaceDetails(item.placeName, item.city);
            if (placeDetails) {
              return {
                ...item,
                businessStatus: placeDetails.businessStatus || 'UNKNOWN',
                city: placeDetails.city || item.city || '',
                isOperational: placeDetails.isOperational,
                statusText: placeDetails.statusText
              };
            }
          }
          return item;
        }));
        form.setValue('itinerary', updatedItinerary);
      }
    };
    fetchBusinessStatus();
  }, [initialFormValues, form]);
  
  const watchedEventTime = form.watch("eventTime");
  const watchedLocation = form.watch("location");
  const watchedCity = form.watch("city");
  const watchedItinerary = form.watch("itinerary");
  const watchedInvitedParticipantUserIds = form.watch("invitedParticipantUserIds");


  const currentParticipantPreferences = useCallback(() => {
    const preferences: string[] = [];
    const hostProfile = userProfilesDb[MOCK_USER_ID];
    const invitedIds = watchedInvitedParticipantUserIds || [];

    if (hostProfile) {
      generateComprehensivePreferencesForParticipant(MOCK_USER_ID).forEach(pref => {
        preferences.push(`${hostProfile.firstName} ${hostProfile.lastName} (Host): ${pref}`);
      });
    }
    invitedIds.forEach(friendId => {
      const friendProfile = userProfilesDb[friendId];
      if (friendProfile) {
        generateComprehensivePreferencesForParticipant(friendId).forEach(pref => {
          preferences.push(`${friendProfile.firstName} ${friendProfile.lastName}: ${pref}`);
        });
      }
    });
    return preferences;
  }, [watchedInvitedParticipantUserIds]);


  const debouncedGenerateAIDescriptionAndType = useCallback(
    debounce(() => {
      const currentValues = form.getValues();
      const currentItineraryForAI = currentValues.itinerary || [];
      if (!currentValues.city || !currentValues.eventTime || (currentItineraryForAI.length === 0 && !currentValues.location) ) {
        console.log("Skipping AI description/type generation: missing core plan info (city, eventTime, or itinerary/location).");
        return;
      }
      
      if (isGeneratingField.description || isGeneratingField.eventType) {
        console.log("Skipping AI description/type generation: already in progress for description or eventType.");
        return;
      }

      let formattedTime = "Not specified";
      if (currentValues.eventTime) {
          try {
              const parsedDate = parseISO(currentValues.eventTime);
              if (isValidDate(parsedDate)) {
                  formattedTime = format(parsedDate, "eee, MMM d, yyyy 'at' HH:mm");
              } else {
                console.warn("Could not parse eventTime for AI description generation (invalid date):", currentValues.eventTime);
              }
          } catch (e) {
              console.warn("Could not parse eventTime for AI description generation (error):", currentValues.eventTime, e);
          }
      }

      const commonInputBase = {
        city: currentValues.city || "Not specified",
        time: formattedTime,
        friendPreferences: currentParticipantPreferences(),
        itinerary: currentItineraryForAI.map(item => ({ placeName: item.placeName, description: item.description || ""})),
        planType: currentValues.planType || 'single-stop'
      };
      
      console.log("Triggering AI generation for description and event type with input:", commonInputBase);
      setIsGeneratingField(prev => ({ ...prev, description: true, eventType: true }));
      Promise.all([
        getAIPlanDescription({ 
            ...commonInputBase,
            planName: currentValues.name || undefined,
            eventType: currentValues.eventType || undefined,
            location: currentValues.location || undefined,
            priceRange: currentValues.priceRange || undefined,
        } as GeneratePlanDescriptionInput),
        getAIPlanEventType({
            ...commonInputBase,
            planName: currentValues.name || undefined,
            planDescription: currentValues.description || undefined, 
        } as GeneratePlanEventTypeInput)
      ]).then(([descResult, eventTypeResult]) => {
        let changed = false;
        if (descResult.success && descResult.data?.suggestedDescription && descResult.data.suggestedDescription !== form.getValues("description")) {
          form.setValue("description", descResult.data.suggestedDescription, { shouldValidate: false, shouldDirty: true });
          changed = true;
          console.log("AI updated description:", descResult.data.suggestedDescription);
        }
        if (eventTypeResult.success && eventTypeResult.data?.suggestedEventType && eventTypeResult.data.suggestedEventType !== form.getValues("eventType")) {
          form.setValue("eventType", eventTypeResult.data.suggestedEventType, { shouldValidate: false, shouldDirty: true });
          changed = true;
          console.log("AI updated eventType:", eventTypeResult.data.suggestedEventType);
        }
        if (changed) {
          form.trigger(["description", "eventType"]);
        }
      }).catch(e => {
        console.error("Error auto-generating description/type", e);
        toast({title: "AI Update Failed", description: "Could not automatically update description or event type.", variant: "default"});
      }).finally(() => {
        setIsGeneratingField(prev => ({ ...prev, description: false, eventType: false }));
      });
    }, 2500), 
  [form, currentParticipantPreferences, toast, isGeneratingField]
);

  const previousItineraryStringRef = useRef<string | undefined>(JSON.stringify(form.getValues("itinerary") || []));

  const ensureChronologicalItinerary = useCallback(() => {
    const currentItinerary = form.getValues("itinerary") || [];
    const planStartTimeString = form.getValues("eventTime");

    if (!currentItinerary.length || !planStartTimeString) { 
        return;
    }
    
    let planStartTime: Date;
    try {
        const parsedPlanStartTime = parseISO(planStartTimeString);
        if (!isValidDate(parsedPlanStartTime)) {
            console.warn("Invalid planStartTimeString in ensureChronologicalItinerary, defaulting:", planStartTimeString);
            planStartTime = addHours(new Date(), 1); 
            // Update the form's event time with the default value
            form.setValue("eventTime", formatISO(planStartTime));
        } else {
            planStartTime = parsedPlanStartTime;
        }
    } catch (e) {
        console.warn("Error parsing planStartTimeString in ensureChronologicalItinerary, defaulting:", planStartTimeString, e);
        planStartTime = addHours(new Date(), 1);
        // Update the form's event time with the default value
        form.setValue("eventTime", formatISO(planStartTime));
    }

    let newItinerary = [...currentItinerary]; 
    let firstItem = { ...newItinerary[0] }; 
    
    const firstItemParsedStartTime = firstItem.startTime ? parseISO(firstItem.startTime) : null;
    if (!firstItemParsedStartTime || !isValidDate(firstItemParsedStartTime) || firstItemParsedStartTime.toISOString() !== planStartTime.toISOString()) {
        firstItem.startTime = formatISO(planStartTime);
        // Also update the form's event time to match the first item's start time
        form.setValue("eventTime", firstItem.startTime);
    } else if (firstItemParsedStartTime.toISOString() !== planStartTime.toISOString()) {
        // If first item has a valid time different from plan time, update plan time to match
        form.setValue("eventTime", formatISO(firstItemParsedStartTime));
        planStartTime = firstItemParsedStartTime;
    }
    
    let firstItemEndTime: Date | null = null;
    try {
        if (firstItem.endTime && isValidDate(parseISO(firstItem.endTime))) firstItemEndTime = parseISO(firstItem.endTime);
    } catch (e) { /* ignore parsing error initially */ }

    if (!firstItemEndTime || !isValidDate(firstItemEndTime) || isBefore(firstItemEndTime, planStartTime)) {
        firstItem.endTime = formatISO(addHours(planStartTime, 2)); 
    }
    newItinerary[0] = firstItem; 

    for (let i = 1; i < newItinerary.length; i++) {
        const prevItem = { ...newItinerary[i-1] }; 
        const currentItem = { ...newItinerary[i] }; 

        let prevActualEndTime: Date;
        const prevItemEndTimeParsed = prevItem.endTime && isValidDate(parseISO(prevItem.endTime)) ? parseISO(prevItem.endTime) : null;
        const prevItemStartTimeParsed = prevItem.startTime && isValidDate(parseISO(prevItem.startTime)) ? parseISO(prevItem.startTime) : null;

        if (prevItemEndTimeParsed && isValidDate(prevItemEndTimeParsed)) {
            prevActualEndTime = prevItemEndTimeParsed;
        } else if (prevItemStartTimeParsed && isValidDate(prevItemStartTimeParsed)) {
            prevActualEndTime = addHours(prevItemStartTimeParsed, 2); 
        } else {
            console.warn(`Previous item (index ${i-1}) times are invalid. Defaulting for current item (index ${i}).`);
            prevActualEndTime = addHours(new Date(), (i-1)*3); 
        }
        
        let suggestedStartTimeForCurrent = addMinutes(prevActualEndTime, 30); // Default 30 min gap

        const currentItemStartTimeParsed = currentItem.startTime && isValidDate(parseISO(currentItem.startTime)) ? parseISO(currentItem.startTime) : null;
        if (currentItemStartTimeParsed && isValidDate(currentItemStartTimeParsed) && !isBefore(currentItemStartTimeParsed, prevActualEndTime)) {
            suggestedStartTimeForCurrent = currentItemStartTimeParsed;
        }
        currentItem.startTime = formatISO(suggestedStartTimeForCurrent);
        
        const currentItemEndTimeParsed = currentItem.endTime && isValidDate(parseISO(currentItem.endTime)) ? parseISO(currentItem.endTime) : null;
        if (!currentItemEndTimeParsed || !isValidDate(currentItemEndTimeParsed) || isBefore(currentItemEndTimeParsed, parseISO(currentItem.startTime))) {
            currentItem.endTime = formatISO(addHours(parseISO(currentItem.startTime), 2)); 
        }
        newItinerary[i] = currentItem; 
    }
    form.setValue("itinerary", newItinerary, { shouldValidate: true, shouldDirty: true });
  }, [form]);

  const syncMainFormFromFirstItineraryItem = useCallback((firstItem: ItineraryItemFormValues | undefined) => {
    if (!firstItem) return;
    const currentMainLocation = form.getValues("location");
    const currentMainCity = form.getValues("city");
    const currentMainEventTime = form.getValues("eventTime");

    let changed = false;
    if (firstItem.placeName !== currentMainLocation) {
      form.setValue("location", firstItem.placeName, { shouldValidate: true, shouldDirty: true });
      changed = true;
    }
    if ((firstItem.city || "") !== currentMainCity) {
      form.setValue("city", firstItem.city || "", { shouldValidate: true, shouldDirty: true });
      changed = true;
    }

    const firstItemStartTimeParsed = firstItem.startTime ? parseISO(firstItem.startTime) : null;
    if (firstItemStartTimeParsed && isValidDate(firstItemStartTimeParsed)) {
        const formattedFirstItemStartTime = formatISO(firstItemStartTimeParsed);
        if (formattedFirstItemStartTime !== currentMainEventTime) {
            form.setValue("eventTime", formattedFirstItemStartTime, { shouldValidate: true, shouldDirty: true });
            changed = true;
        }
    } else if (firstItem.startTime && currentMainEventTime !== firstItem.startTime) {
        console.warn(`First itinerary item has an invalid or unparsable start time: ${firstItem.startTime}. Using as is for eventTime update.`);
        form.setValue("eventTime", firstItem.startTime, { shouldValidate: true, shouldDirty: true });
        changed = true;
    }
    
    if(changed) {
      form.trigger(["location", "city", "eventTime"]);
      console.log("Main form synced from first itinerary item, triggering AI desc/type update.");
      debouncedGenerateAIDescriptionAndType();
    }
  }, [form, debouncedGenerateAIDescriptionAndType]);

  useEffect(() => {
    const currentItineraryString = JSON.stringify(watchedItinerary || []);
    if (currentItineraryString !== previousItineraryStringRef.current) {
      console.log("Itinerary changed, triggering AI description/type update.");
      debouncedGenerateAIDescriptionAndType();
      previousItineraryStringRef.current = currentItineraryString;
    }
    return () => debouncedGenerateAIDescriptionAndType.cancel();
  }, [watchedItinerary, debouncedGenerateAIDescriptionAndType]);


  const handleRefreshItineraryItem = useCallback(async (index: number) => {
    const itemData = form.getValues(`itinerary.${index}`) as ItineraryItemFormValues;
    if(!itemData.placeName || !itemData.address || !itemData.city) {
        toast({title: "Missing Info", description: "Place name, address, and city are needed to refresh details.", variant: "default"});
        return;
    }
    setIsGeneratingField(prev => ({ ...prev, [`itinerary_${index}`]: true }));
    
    const eventTimeValue = form.getValues("eventTime");
    let mainEventTime: Date;
    try {
        const parsedMainEventTime = parseISO(eventTimeValue);
        if (!isValidDate(parsedMainEventTime)) throw new Error("Invalid main event time for AI itinerary refresh");
        mainEventTime = parsedMainEventTime;
    } catch (e) {
        console.warn("Invalid main event time, defaulting for AI itinerary refresh:", e);
        mainEventTime = addHours(new Date(), 1); 
    }

    let previousItemEndTimeForAI: string | null = null;
    let previousItemAddressForTravel: string | null = null;
    let previousItemCityForTravel: string | null = null;

    const currentItinerary = form.getValues("itinerary") || [];
    if (index > 0 && currentItinerary[index-1]) {
        const prevItem = currentItinerary[index-1];
        previousItemAddressForTravel = prevItem.address;
        previousItemCityForTravel = prevItem.city;

        if (prevItem.endTime && isValidDate(parseISO(prevItem.endTime))) {
            try {
                previousItemEndTimeForAI = formatISO(parseISO(prevItem.endTime));
            } catch (e) {
                console.warn(`Previous item endTime ('${prevItem.endTime}') is invalid. Passing null to AI for sequencing.`, e);
            }
        } else {
            console.warn(`Previous item endTime ('${prevItem.endTime}') is invalid or missing. Passing null to AI for sequencing.`);
        }
    }

    const aiInputForItineraryUpdate: AIGenerateItineraryItemDetailsInput = {
        placeName: itemData.placeName,
        address: itemData.address,
        city: itemData.city,
        mainEventISOStartTime: mainEventTime.toISOString(),
        planOverallDescription: form.getValues("description") || "A planned event.",
        participantPreferences: currentParticipantPreferences(),
        previousItemAddress: previousItemAddressForTravel,
        previousItemCity: previousItemCityForTravel,
        previousItemISOEndTime: previousItemEndTimeForAI,
        isFirstItem: index === 0,
    };
    try {
        const validatedAIInput = ZodAIItineraryInputSchema.parse(aiInputForItineraryUpdate);
        console.log("AI input for itinerary item details refresh:", JSON.stringify(validatedAIInput, null, 2));
        const result = await getAIItineraryItemDetails(validatedAIInput);
        console.log("AI output for itinerary item details refresh:", JSON.stringify(result, null, 2));
        if (result.success && result.data) {
                let updatedStartTime: Date;
                 try {
                    updatedStartTime = result.data.suggestedISOStartTime ? parseISO(result.data.suggestedISOStartTime) : (itemData.startTime && isValidDate(parseISO(itemData.startTime)) ? parseISO(itemData.startTime) : addHours(mainEventTime, index*3));
                    if (!isValidDate(updatedStartTime)) throw new Error("Invalid AI suggested start time on refresh");
                } catch(e) {
                    console.warn(`AI suggested start time invalid on refresh for ${itemData.placeName}: ${(e as Error).message}. Keeping original or defaulting.`);
                    updatedStartTime = itemData.startTime && isValidDate(parseISO(itemData.startTime)) ? parseISO(itemData.startTime) : addHours(mainEventTime, index*3);
                }

                let updatedEndTime: Date | null = null;
                try {
                    if (result.data.suggestedISOEndTime) {
                        updatedEndTime = parseISO(result.data.suggestedISOEndTime);
                        if(!isValidDate(updatedEndTime) || isBefore(updatedEndTime, updatedStartTime)) throw new Error("Invalid or illogical AI suggested end time on refresh");
                    } else if (itemData.endTime && isValidDate(parseISO(itemData.endTime))) { 
                         updatedEndTime = parseISO(itemData.endTime);
                    } else {
                        updatedEndTime = addHours(updatedStartTime, 2);
                    }
                } catch(e) {
                    console.warn(`AI suggested end time invalid or illogical on refresh for ${itemData.placeName}: ${(e as Error).message}. Defaulting.`);
                     updatedEndTime = addHours(updatedStartTime, 2);
                }

                const updatedItemData = {
                ...itemData,
                description: result.data.suggestedDescription || itemData.description || "Details to be confirmed.",
                startTime: formatISO(updatedStartTime),
                endTime: updatedEndTime ? formatISO(updatedEndTime) : null,
                activitySuggestions: result.data.suggestedActivitySuggestions || itemData.activitySuggestions || [],
                googleMapsImageUrl: `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(itemData.address + ", " + itemData.city)}&zoom=15&size=400x225&maptype=roadmap&markers=color:red%7C${encodeURIComponent(itemData.address + ", " + itemData.city)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}`,
                isOperational: result.data.isOperational,
                statusText: result.data.statusText,
            };
            updateItineraryItem(index, updatedItemData);
            if (index === 0) {
              syncMainFormFromFirstItineraryItem(updatedItemData);
            }
            ensureChronologicalItinerary();
            // debouncedGenerateAIDescriptionAndType(); // Already handled by useEffect watching itinerary
            toast({ title: "Stop Details Refreshed", description: `AI successfully updated details for ${itemData.placeName}.`});
        } else {
            toast({ title: `AI Refresh Failed for ${itemData.placeName}`, description: result.message || "Could not update details.", variant: "default" });
        }
    } catch (error: any) {
        console.error("Error during AI itinerary item update or validation:", error);
        const message = error.errors && Array.isArray(error.errors)
                    ? error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ')
                    : error.message || "An unexpected error occurred.";
        toast({ title: "Error Refreshing Stop", description: message, variant: "destructive" });
    } finally {
        setIsGeneratingField(prev => ({ ...prev, [`itinerary_${index}`]: false }));
    }
  }, [form, currentParticipantPreferences, toast, updateItineraryItem, syncMainFormFromFirstItineraryItem, ensureChronologicalItinerary]);


  useEffect(() => {
    const currentItinerary = form.getValues("itinerary");
    if (currentItinerary && currentItinerary.length > 0) {
      const firstItem = currentItinerary[0];
      if (
        form.getValues("eventTime") && firstItem.startTime && 
        isValidDate(parseISO(form.getValues("eventTime"))) && 
        isValidDate(parseISO(firstItem.startTime)) && 
        parseISO(form.getValues("eventTime")).toISOString() !== parseISO(firstItem.startTime).toISOString()
      ) {
        syncMainFormFromFirstItineraryItem(firstItem);
      }
    }
  }, [watchedItinerary, form, syncMainFormFromFirstItineraryItem]);
  
  const updateFirstItineraryItemFromMainLocation = useCallback((locationName: string, address: string, city: string) => {
    const currentItinerary = form.getValues("itinerary") || [];
    let firstItem = currentItinerary.length > 0 ? { ...currentItinerary[0] } : null;
    const mainEventTimeString = form.getValues("eventTime");
    let baseStartTime: Date;
    try {
        baseStartTime = mainEventTimeString && isValidDate(parseISO(mainEventTimeString)) ? parseISO(mainEventTimeString) : new Date(Date.now() + 3600 * 1000 * 24);
    } catch { baseStartTime = new Date(Date.now() + 3600 * 1000 * 24); }
    
    const newItemData = {
        placeName: locationName,
        address: address,
        city: city,
        startTime: firstItem?.startTime || formatISO(baseStartTime), 
        endTime: firstItem?.endTime || formatISO(addHours(baseStartTime, 2)), 
        description: firstItem?.description || "Main event starting point. AI will generate details.",
        googleMapsImageUrl: firstItem?.googleMapsImageUrl || "",
        rating: firstItem?.rating || null,
        reviewCount: firstItem?.reviewCount || null,
        activitySuggestions: firstItem?.activitySuggestions || [],
    };

    if (firstItem) {
        if (firstItem.placeName !== newItemData.placeName || firstItem.address !== newItemData.address || firstItem.city !== newItemData.city) {
            updateItineraryItem(0, { ...firstItem, ...newItemData });
            handleRefreshItineraryItem(0); 
        }
    } else {
        appendItineraryItem({ id: `main_loc_itin_${planIdForEdit || 'create'}_${Date.now()}`, ...newItemData }, { shouldFocus: false });
        handleRefreshItineraryItem(0); 
    }
  }, [form, updateItineraryItem, appendItineraryItem, planIdForEdit, handleRefreshItineraryItem]);
  
  useEffect(() => {
    if (!isClient || mapApiKeyMissing || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      return;
    }
    
    const scriptId = GOOGLE_MAPS_SCRIPT_ID_CREATE_FORM;
    const callbackName = GOOGLE_MAPS_CALLBACK_CREATE_FORM;

    if (window.google && window.google.maps && window.google.maps.places) {
      if (!isMapApiLoaded) setIsMapApiLoaded(true); 
    } else if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&callback=${callbackName}`;
        script.async = true;
        script.defer = true;
        
        window[callbackName] = () => {
          setIsMapApiLoaded(true);
          console.log("Google Maps API loaded via callback:", callbackName);
        };
        document.head.appendChild(script);
        
        return () => {
            delete window[callbackName];
        };
    } else { 
        const checkInterval = setInterval(() => {
            if (window.google && window.google.maps && window.google.maps.places) {
                setIsMapApiLoaded(true);
                clearInterval(checkInterval);
            }
        }, 100);
        return () => clearInterval(checkInterval);
    }
  }, [isClient, mapApiKeyMissing, isMapApiLoaded]);

  const initAutocompleteInstance = useCallback((inputRefTarget: HTMLInputElement | null, type: 'newItinerary' | 'mainLocation' | `itinerary_${number}`) => {
    if (!inputRefTarget || !window.google || !window.google.maps || !window.google.maps.places) {
       console.warn(`Autocomplete init skipped for type ${type}: inputRefTarget or Google Maps API not ready. Target:`, inputRefTarget);
      return null;
    }
    
    const autocompleteInstance = new window.google.maps.places.Autocomplete(
      inputRefTarget,
      { types: ["geocode", "establishment"], fields: ["name", "formatted_address", "address_components", "geometry"] }
    );
    
    autocompleteInstance.addListener("place_changed", () => {
      setIsAutocompleteUpdateInProgress(true); 
      const place = autocompleteInstance.getPlace();
      console.log("Place changed for type:", type, "Place data:", place);

      if (place && place.name && place.formatted_address && place.geometry?.location) {
          const cityComponent = place.address_components?.find(c => c.types.includes("locality"));
          const placeCity = cityComponent?.long_name || "";

          if (type === 'newItinerary' && newItineraryItemInputRef.current) {
              console.log("Setting new itinerary item states:", place.name, place.formatted_address, placeCity);
              setNewItineraryItemName(place.name); 
              setNewItineraryItemAddress(place.formatted_address);
              setNewItineraryItemCity(placeCity);
              // Focus the "Add Itinerary Stop" button or trigger add directly for better UX
              const addButton = document.getElementById('add-itinerary-stop-button');
              if (addButton) addButton.focus();
          } else if (type === 'mainLocation' && mainLocationAutocompleteInputRef.current) {
              console.log("Updating main location form fields:", place.name, placeCity);
              form.setValue("location", place.name, { shouldValidate: true, shouldDirty: true });
              form.setValue("city", placeCity, { shouldValidate: true, shouldDirty: true });
              updateFirstItineraryItemFromMainLocation(place.name, place.formatted_address, placeCity);
              console.log("Triggering AI desc/type update from main location change.");
              debouncedGenerateAIDescriptionAndType();
          } else if (type.startsWith('itinerary_')) {
              const index = parseInt(type.split('_')[1]);
              if (!isNaN(index)) {
                  console.log("Updating itinerary item fields:", index, place.name, place.formatted_address, placeCity);
                  form.setValue(`itinerary.${index}.placeName`, place.name, { shouldValidate: true, shouldDirty: true });
                  form.setValue(`itinerary.${index}.address`, place.formatted_address, { shouldValidate: true, shouldDirty: true });
                  form.setValue(`itinerary.${index}.city`, placeCity, { shouldValidate: true, shouldDirty: true });
              }
          }
      } else {
        console.warn("Place changed event fired but no valid place data received for type:", type, "Place:", place);
      }
      setTimeout(() => setIsAutocompleteUpdateInProgress(false), 200); 
    });
    return autocompleteInstance;
  }, [form, updateFirstItineraryItemFromMainLocation, debouncedGenerateAIDescriptionAndType]); 


  useEffect(() => {
    if (!isClient || mapApiKeyMissing || !isMapApiLoaded) {
        console.log("Autocomplete setup skipped: client/map API not ready or key missing.");
        return;
    }
    
    if (newItineraryItemInputRef.current) {
        if (!newItineraryAutocompleteRef.current) {
            newItineraryAutocompleteRef.current = initAutocompleteInstance(newItineraryItemInputRef.current, 'newItinerary');
             if (newItineraryAutocompleteRef.current) console.log("New Itinerary Autocomplete initialized for input:", newItineraryItemInputRef.current);
             else console.error("New Itinerary Autocomplete FAILED to initialize.");
        }
    } else {
      console.log("New Itinerary input ref not yet available for autocomplete init.");
    }

    if (mainLocationAutocompleteInputRef.current) {
      if (!mainLocationAutocompleteRef.current) {
        mainLocationAutocompleteRef.current = initAutocompleteInstance(mainLocationAutocompleteInputRef.current, 'mainLocation');
        if (mainLocationAutocompleteRef.current) console.log("Main Location Autocomplete initialized for input:", mainLocationAutocompleteInputRef.current);
        else console.error("Main Location Autocomplete FAILED to initialize.");
      }
    } else {
      console.log("Main Location input ref not yet available for autocomplete init.");
    }

    if (editingItineraryItemInputRef.current && editingItineraryIndex !== null) {
      if (!editingItineraryAutocompleteRef.current) {
        editingItineraryAutocompleteRef.current = initAutocompleteInstance(editingItineraryItemInputRef.current, `itinerary_${editingItineraryIndex}`);
        if (editingItineraryAutocompleteRef.current) console.log("Editing Itinerary Autocomplete initialized for input:", editingItineraryItemInputRef.current);
        else console.error("Editing Itinerary Autocomplete FAILED to initialize.");
      }
    }

     return () => { 
      if (newItineraryAutocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(newItineraryAutocompleteRef.current);
        console.log("Cleared listeners for New Itinerary Autocomplete.");
      }
      if (mainLocationAutocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(mainLocationAutocompleteRef.current);
        console.log("Cleared listeners for Main Location Autocomplete.");
      }
      if (editingItineraryAutocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(editingItineraryAutocompleteRef.current);
        console.log("Cleared listeners for Editing Itinerary Autocomplete.");
        editingItineraryAutocompleteRef.current = null;
      }
    };
  }, [isClient, mapApiKeyMissing, isMapApiLoaded, initAutocompleteInstance, editingItineraryIndex]);
  

  useEffect(() => {
    const currentItinerary = form.getValues("itinerary");
    const mainLocation = form.getValues("location");
    const mainCity = form.getValues("city");
    const mainEventTime = form.getValues("eventTime");

    if (currentItinerary && currentItinerary.length === 0 && mainLocation && mainEventTime && isValidDate(parseISO(mainEventTime))) {
        let baseStartTime: Date;
        try {
            baseStartTime = parseISO(mainEventTime);
            if (!isValidDate(baseStartTime)) throw new Error("Invalid main event time.");
        } catch {
            return; 
        }

        const newItem: ItineraryItemFormValues = {
            id: `initial_main_loc_${planIdForEdit || 'create'}_${Date.now()}`,
            placeName: mainLocation,
            address: mainLocation, 
            city: mainCity || "",
            startTime: formatISO(baseStartTime),
            endTime: formatISO(addHours(baseStartTime, 2)),
            description: "Main event starting point. AI will generate details.",
            googleMapsImageUrl: "",
            rating: null, reviewCount: null, activitySuggestions: [],
        };
        appendItineraryItem(newItem, { shouldFocus: false });
        handleRefreshItineraryItem(0); 
    }
  }, [watchedEventTime, watchedLocation, watchedCity, form, appendItineraryItem, planIdForEdit, handleRefreshItineraryItem]);


  const handleAddNewItineraryItem = async () => {
    const planType = form.getValues("planType");
    const currentItinerary = form.getValues("itinerary") || [];
    
    if (planType === 'single-stop' && currentItinerary.length >= 1) {
        toast({ title: "Cannot Add Stop", description: "This is a single-stop plan. Only one location is allowed.", variant: "destructive" });
        return;
    }

    if (!newItineraryItemName.trim() || !newItineraryItemAddress.trim()) {
        toast({ title: "Missing Information", description: "Please provide at least place name and address for the new stop (select from Autocomplete if possible).", variant: "destructive" });
        return;
    }
    setIsAddingItineraryItem(true);

    try {
        // Fetch Google Maps place details first
        const placeDetails = await searchPlaceDetails(newItineraryItemName, newItineraryItemCity);

    const eventTimeValue = form.getValues("eventTime");
    let mainEventTime: Date;
    try {
        const parsedMainEventTime = parseISO(eventTimeValue);
        if (!isValidDate(parsedMainEventTime)) throw new Error("Invalid main event time for AI itinerary");
        mainEventTime = parsedMainEventTime;
    } catch (e) {
        console.warn("Invalid main event time, defaulting for AI itinerary:", e);
        mainEventTime = addHours(new Date(), 1); 
    }

    let previousItemEndTimeForAI: string | null = null;
    let previousItemAddressForTravel: string | null = null;
    let previousItemCityForTravel: string | null = null;
    
    if (currentItinerary.length > 0) {
        const lastItem = currentItinerary[currentItinerary.length - 1];
        previousItemAddressForTravel = lastItem.address;
        previousItemCityForTravel = lastItem.city;
        if (lastItem.endTime && isValidDate(parseISO(lastItem.endTime))) {
             try {
                previousItemEndTimeForAI = formatISO(parseISO(lastItem.endTime));
             } catch (e) {
                    console.warn(`Previous item endTime ('${lastItem.endTime}') is invalid. Passing null for sequencing.`, e);
                }
            }
        }

        const validatedAIInput = {
        placeName: newItineraryItemName,
        address: newItineraryItemAddress,
            city: placeDetails?.city || newItineraryItemCity || "",
        mainEventISOStartTime: mainEventTime.toISOString(),
        planOverallDescription: form.getValues("description") || "A planned event.",
        participantPreferences: currentParticipantPreferences(),
        previousItemAddress: previousItemAddressForTravel,
        previousItemCity: previousItemCityForTravel,
        previousItemISOEndTime: previousItemEndTimeForAI,
        isFirstItem: currentItinerary.length === 0,
    };

            let newItemStartTime: Date;
            let newItemEndTime: Date | null = null;

        try {
            newItemStartTime = previousItemEndTimeForAI && isValidDate(parseISO(previousItemEndTimeForAI)) 
                ? addHours(parseISO(previousItemEndTimeForAI), 1) 
                : addHours(mainEventTime, currentItinerary.length * 3 + 1);
                  newItemEndTime = addHours(newItemStartTime, 2); 
        } catch (e) {
            console.warn("Error calculating times for new item:", e);
            newItemStartTime = addHours(mainEventTime, currentItinerary.length * 3 + 1);
                newItemEndTime = addHours(newItemStartTime, 2);
            }
            
            const newItem: ItineraryItemFormValues = {
                id: `new_itin_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
                placeName: newItineraryItemName,
            address: placeDetails?.formattedAddress || newItineraryItemAddress,
            city: placeDetails?.city || newItineraryItemCity || validatedAIInput.city,
            description: "Details to be confirmed.",
                startTime: formatISO(newItemStartTime),
            endTime: formatISO(newItemEndTime),
            googleMapsImageUrl: `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(newItineraryItemAddress + ", " + (placeDetails?.city || newItineraryItemCity || validatedAIInput.city))}&zoom=15&size=400x225&maptype=roadmap&markers=color:red%7C${encodeURIComponent(newItineraryItemAddress + ", " + (placeDetails?.city || newItineraryItemCity || validatedAIInput.city))}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}`,
            rating: placeDetails?.rating || null,
            reviewCount: placeDetails?.userRatingsTotal || null,
            activitySuggestions: [
                `Visit and explore ${newItineraryItemName}`,
                `Take photos and enjoy the views`,
                `Experience the local atmosphere`,
                placeDetails?.types?.includes('restaurant') ? 'Try the signature dishes' :
                placeDetails?.types?.includes('park') ? 'Have a relaxing walk' :
                placeDetails?.types?.includes('museum') ? 'Check out the exhibits' :
                placeDetails?.types?.includes('shopping_mall') ? 'Browse the shops' :
                'Enjoy the experience'
            ].filter(Boolean),
            isOperational: placeDetails?.businessStatus === "OPERATIONAL",
            statusText: placeDetails?.businessStatus || "Status unknown",
            openingHours: placeDetails?.openingHours || undefined,
            phoneNumber: placeDetails?.formattedPhoneNumber,
            website: placeDetails?.website,
            priceLevel: placeDetails?.priceLevel,
            types: placeDetails?.types,
            lat: placeDetails?.location?.lat,
            lng: placeDetails?.location?.lng,
            googlePlaceId: placeDetails?.placeId,
            googleMapsUrl: placeDetails?.url
        };

            appendItineraryItem(newItem);
            ensureChronologicalItinerary(); 
            setNewItineraryItemName("");
            setNewItineraryItemAddress("");
            setNewItineraryItemCity("");
            if(newItineraryItemInputRef.current) newItineraryItemInputRef.current.value = ""; 

        toast({ title: "Stop Added", description: `${newItem.placeName} has been added to your itinerary.` });
    } catch (error) {
        console.error("Error adding new itinerary item:", error);
        const message = error.errors && Array.isArray(error.errors) 
                      ? error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ')
                      : error.message || "An unexpected error occurred.";
        toast({ title: "Error Adding Stop", description: message, variant: "destructive" });
    } finally {
        setIsAddingItineraryItem(false);
    }
  };

  const handleEditItineraryItem = async (index: number) => {
    const itemData = form.getValues(`itinerary.${index}`) as ItineraryItemFormValues;
    
    // Fetch Google Maps data if not already present
    if (!itemData.openingHours || !itemData.businessStatus) {
      try {
        const placeDetails = await searchPlaceDetails(itemData.placeName, itemData.city);
        if (placeDetails) {
          const updatedItemData = {
            ...itemData,
            address: placeDetails.formattedAddress || itemData.address,
            city: placeDetails.city || itemData.city,
            isOperational: placeDetails.isOperational,
            statusText: placeDetails.statusText,
            openingHours: placeDetails.openingHours || undefined,
            phoneNumber: placeDetails.formattedPhoneNumber,
            website: placeDetails.website,
            priceLevel: placeDetails.priceLevel,
            types: placeDetails.types,
            lat: placeDetails.location?.lat,
            lng: placeDetails.location?.lng,
            googlePlaceId: placeDetails.placeId,
            googleMapsUrl: placeDetails.url,
            rating: placeDetails.rating,
            reviewCount: placeDetails.userRatingsTotal,
            googleMapsImageUrl: `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(placeDetails.formattedAddress || itemData.address)}&zoom=15&size=400x225&maptype=roadmap&markers=color:red%7C${encodeURIComponent(placeDetails.formattedAddress || itemData.address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}`
          };
          form.setValue(`itinerary.${index}`, updatedItemData);
        }
      } catch (error) {
        console.error('Error fetching place details during edit:', error);
      }
    }
    
    setEditingItineraryIndex(index);
  };

  const handleSaveItineraryItem = async (index: number) => {
    const itemData = form.getValues(`itinerary.${index}`) as ItineraryItemFormValues;
    
    if(!itemData.placeName || !itemData.address || !itemData.city || !itemData.startTime || !itemData.description) {
        toast({ title: "Missing Information", description: "Place name, address, city, start time, and description are required to save.", variant: "destructive" });
        return;
    }
    try {
        const parsedStartTime = parseISO(itemData.startTime);
        if (!isValidDate(parsedStartTime)) {
            toast({ title: "Invalid Start Time", description: "Please provide a valid start time (YYYY-MM-DDTHH:mm format).", variant: "destructive"});
            return;
        }
        itemData.startTime = formatISO(parsedStartTime); 

        // If this is the first item, sync the event time with its start time
        if (index === 0) {
            const currentEventTime = form.getValues("eventTime");
            const parsedEventTime = parseISO(currentEventTime);
            
            if (!isValidDate(parsedEventTime) || parsedEventTime.toISOString() !== parsedStartTime.toISOString()) {
                form.setValue("eventTime", itemData.startTime);
            }
        }

        if(itemData.endTime && itemData.endTime.trim() !== "") {
            const parsedEndTime = parseISO(itemData.endTime);
            if (!isValidDate(parsedEndTime)) {
                toast({ title: "Invalid End Time", description: "Please provide a valid end time (YYYY-MM-DDTHH:mm format) or leave it empty.", variant: "destructive"});
                return;
            }
            if (isBefore(parsedEndTime, parsedStartTime)) {
                 toast({ title: "Invalid End Time", description: "End time cannot be before start time.", variant: "destructive"});
                return;
            }
            itemData.endTime = formatISO(parsedEndTime); 
        } else {
            itemData.endTime = null; 
        }

        // Fetch latest Google Places data before saving
        const placeDetails = await searchPlaceDetails(itemData.placeName, itemData.city);
        if (placeDetails) {
            itemData.address = placeDetails.formattedAddress || itemData.address;
            itemData.city = placeDetails.city || itemData.city;
            itemData.isOperational = placeDetails.isOperational;
            itemData.statusText = placeDetails.statusText;
            itemData.openingHours = placeDetails.openingHours || undefined;
            itemData.phoneNumber = placeDetails.formattedPhoneNumber;
            itemData.website = placeDetails.website;
            itemData.priceLevel = placeDetails.priceLevel;
            itemData.types = placeDetails.types;
            itemData.lat = placeDetails.location?.lat;
            itemData.lng = placeDetails.location?.lng;
            itemData.googlePlaceId = placeDetails.placeId;
            itemData.googleMapsUrl = placeDetails.url;
            itemData.rating = placeDetails.rating;
            itemData.reviewCount = placeDetails.userRatingsTotal;
            itemData.googleMapsImageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(placeDetails.formattedAddress || itemData.address)}&zoom=15&size=400x225&maptype=roadmap&markers=color:red%7C${encodeURIComponent(placeDetails.formattedAddress || itemData.address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}`;
        }

    } catch (e) {
        toast({title: "Invalid Date Input", description: "One of the date/time fields has an invalid format.", variant: "destructive"});
        return;
    }

    updateItineraryItem(index, itemData);
    setEditingItineraryIndex(null);
    if (index === 0) {
      syncMainFormFromFirstItineraryItem(itemData);
    }
    ensureChronologicalItinerary(); 
    toast({ title: "Stop Saved", description: `${itemData.placeName} details updated locally.`});
  };
  

  const handleRemoveItineraryItem = (index: number) => {
    const planType = form.getValues("planType") || initialFormValues.planType;
    if (index === 0) {
        toast({ title: "Cannot Remove", description: "The first itinerary item cannot be removed as it defines the main event location and time. Edit it or change the main plan details instead.", variant: "destructive"});
        return;
    }
    removeItineraryItem(index);
    const currentItinerary = form.getValues("itinerary");
    if (index === 0 && currentItinerary && currentItinerary.length > 0) { 
        syncMainFormFromFirstItineraryItem(currentItinerary[0]);
    }
    ensureChronologicalItinerary();
  };

  const handleMoveItem = (currentIndex: number, newIndex: number) => {
    if (newIndex < 0 || newIndex >= itineraryFields.length) return;
    
    const currentItinerary = form.getValues("itinerary");
    const timeWindows = currentItinerary.map(item => ({
      startTime: item.startTime,
      endTime: item.endTime
    }));

    // Create new item copies without time information
    const currentItem = { ...currentItinerary[currentIndex] };
    const targetItem = { ...currentItinerary[newIndex] };
    delete currentItem.startTime;
    delete currentItem.endTime;
    delete targetItem.startTime;
    delete targetItem.endTime;

    // Create updated itinerary with swapped items but fixed time windows
    const updatedItinerary = [...currentItinerary];
    updatedItinerary[currentIndex] = {
      ...targetItem,
      startTime: timeWindows[currentIndex].startTime,
      endTime: timeWindows[currentIndex].endTime
    };
    updatedItinerary[newIndex] = {
      ...currentItem,
      startTime: timeWindows[newIndex].startTime,
      endTime: timeWindows[newIndex].endTime
    };

    // If we're moving to or from the first position, ensure event time sync
    if (newIndex === 0 || currentIndex === 0) {
      const firstTimeWindow = timeWindows[0];
      if (firstTimeWindow.startTime && isValidDate(parseISO(firstTimeWindow.startTime))) {
        const currentEventTime = form.getValues("eventTime");
        const parsedEventTime = parseISO(currentEventTime);
        
        if (!isValidDate(parsedEventTime) || parsedEventTime.toISOString() !== parseISO(firstTimeWindow.startTime).toISOString()) {
          form.setValue("eventTime", firstTimeWindow.startTime);
        }
      }
    }

    // Update the form with the new arrangement
    form.setValue("itinerary", updatedItinerary);
  };

 const onSubmit = async (data: PlanFormValues) => {
    try {
      console.log('========== Form submission started with data:', JSON.stringify(data, null, 2));
      setIsSubmitting(true);
      
      // Handle missing itinerary - create a default one if needed
      if (!data.itinerary || data.itinerary.length === 0) {
        console.log('Creating default itinerary item in onSubmit because itinerary is empty or undefined');
        const eventTime = data.eventTime || formatISO(addHours(new Date(), 24));
        
        if (data.location && data.city) {
          const defaultItem = {
            id: `default_item_${Date.now()}`,
            placeName: data.location,
            address: data.location,
            city: data.city,
            description: `Visit ${data.location}`,
            startTime: eventTime,
            endTime: formatISO(addHours(parseISO(eventTime), 2)),
            activitySuggestions: ['Enjoy the event'],
          };
          
          data.itinerary = [defaultItem];
          console.log('Created default itinerary item:', defaultItem);
      } else {
          console.error('Cannot create default itinerary item: location or city missing');
        toast({
            title: "Missing Information",
            description: "Location and city are required to create a plan.",
            variant: "destructive"
        });
        setIsSubmitting(false);
        return;
        }
      }

      // Get location and city from first itinerary item if not set
      const firstItem = data.itinerary[0];
      if (!data.location) data.location = firstItem.placeName;
      if (!data.city) data.city = firstItem.city;

      // Add required fields
      const planData: PlanFormValues & { hostId: string; createdBy: string } = {
        ...data,
        id: planIdForEdit,
        hostId: MOCK_USER_ID, // Add hostId which is required
        createdBy: MOCK_USER_ID, // Required to identify the host
        status: data.status || "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log('Making API request with data:', JSON.stringify(planData, null, 2));

      // Make the API call
      try {
        // Fixed URL to ensure it goes to the API endpoint
        const apiUrl = formMode === 'create' ? '/api/plans' : `/api/plans/${planIdForEdit}`;
        console.log(`Submitting to API URL: ${apiUrl}`);
        
        // CRITICAL: Ensure all required fields exist
        if (!planData.hostId) {
          console.warn("hostId missing, adding default MOCK_USER_ID");
          planData.hostId = MOCK_USER_ID;
        }
        
        if (!planData.createdBy) {
          console.warn("createdBy missing, adding default MOCK_USER_ID");
          planData.createdBy = MOCK_USER_ID;
        }
        
        if (!planData.itinerary || !Array.isArray(planData.itinerary) || planData.itinerary.length === 0) {
          console.warn("itinerary missing, adding default item from location and city");
          if (planData.location && planData.city) {
            const mainEventTime = planData.eventTime || new Date().toISOString();
            planData.itinerary = [{
              id: `itin_default_${Date.now()}`,
              placeName: planData.location,
              address: planData.location,
              city: planData.city,
              description: `Visit ${planData.location}`,
              startTime: mainEventTime,
              endTime: null,
              googleMapsImageUrl: null,
              rating: null,
              reviewCount: null,
              activitySuggestions: []
            }];
          }
        }
        
        if (!planData.planType) {
          planData.planType = "single-stop";
        }
        
        if (!planData.invitedParticipantUserIds) {
          planData.invitedParticipantUserIds = [];
        }
        
        if (!planData.priceRange) {
          planData.priceRange = "Budget (0-15 USD)";
        }
        
        // Double-check all itinerary items have all required fields
        if (planData.itinerary) {
          planData.itinerary = planData.itinerary.map(item => ({
            id: item.id || `itin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            placeName: item.placeName || "",
            address: item.address || item.placeName || "",
            city: item.city || planData.city || "",
            description: item.description || `Visit ${item.placeName}`,
            startTime: item.startTime || planData.eventTime,
            endTime: item.endTime,
            googleMapsImageUrl: item.googleMapsImageUrl || null,
            rating: item.rating || null,
            reviewCount: item.reviewCount || null,
            activitySuggestions: item.activitySuggestions || []
          }));
        }
        
        // Convert data to proper format before sending to API
        const formDataToSend = {
          hostId: planData.hostId,
          name: planData.name || 'Untitled Plan',
          description: planData.description || `Plan created on ${new Date().toLocaleDateString()}`,
          eventTime: planData.eventTime || new Date().toISOString(),
          location: planData.location || 'Unknown Location',
          city: planData.city || 'Unknown City',
          eventType: planData.eventType || 'Casual Meeting',
          priceRange: planData.priceRange || 'Budget (0-15 USD)',
          status: planData.status || 'draft',
          planType: planData.planType || 'single-stop',
          invitedParticipantUserIds: Array.isArray(planData.invitedParticipantUserIds) ? 
                                    planData.invitedParticipantUserIds : 
                                    (planData.invitedParticipantUserIds ? [planData.invitedParticipantUserIds] : []),
          selectedPoint: planData.selectedPoint || null,
          mapRadiusKm: planData.mapRadiusKm || 5,
          userEnteredCityForStep2: planData.userEnteredCityForStep2 || null,
          itinerary: Array.isArray(planData.itinerary) ? 
                      planData.itinerary.map(item => ({
                        // Spread original item properties first
                        ...item,
                        // Then apply defaults/overrides
                        id: item.id || `itin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                        placeName: item.placeName || planData.location || 'Unknown Location',
                        address: item.address || item.placeName || planData.location || 'Unknown Address',
                        city: item.city || planData.city || 'Unknown City',
                        description: item.description || `Visit ${item.placeName || planData.location || 'this location'}`,
                        startTime: item.startTime || planData.eventTime || new Date().toISOString(),
                        endTime: item.endTime || null,
                        activitySuggestions: Array.isArray(item.activitySuggestions) ? item.activitySuggestions : [],
                        
                        // Apply sanitized values, ensuring they override any from ...item
                        googleMapsImageUrl: item.googleMapsImageUrl?.trim().replace(/^`|`$/g, '') || null,
                        website: item.website?.trim().replace(/^`|`$/g, '') || null,
                        googleMapsUrl: item.googleMapsUrl?.trim().replace(/^`|`$/g, '') || null,
                      })) : 
                      [{
                        id: `itin_default_${Date.now()}`,
                        placeName: planData.location || 'Unknown Location',
                        address: planData.location || 'Unknown Address',
                        city: planData.city || 'Unknown City',
                        description: `Visit ${planData.location || 'this location'}`,
                        startTime: planData.eventTime || new Date().toISOString(),
                        endTime: null,
                        activitySuggestions: [],
                        googleMapsImageUrl: null, // Add for schema consistency
                        website: null,
                        googleMapsUrl: null
                      }]
        };
        
        console.log('Final sanitized API request data:', JSON.stringify(formDataToSend, null, 2));
        
        const response = await fetch(apiUrl, {
          method: formMode === 'create' ? 'POST' : 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formDataToSend),
        });

        console.log('API response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            console.error('Failed to parse error response as JSON:', errorText);
            errorData = { message: 'Error response was not valid JSON' };
          }
          
          console.error('API Error Response:', {
            status: response.status,
            statusText: response.statusText,
            errorData,
            errorText
          });
          throw new Error(errorData.message || `Failed to save plan: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('API success response:', JSON.stringify(result, null, 2));
        
        if (!result.id) {
          throw new Error('No plan ID returned from server');
        }

        toast({
          title: `Plan ${formMode === 'create' ? 'Created' : 'Updated'}`,
          description: `Your plan has been ${formMode === 'create' ? 'created' : 'updated'} successfully.`,
        });

        if (onFormSubmitSuccess) {
          onFormSubmitSuccess(result.id);
        } else {
          // If no success callback provided, redirect to the plan view page
          router.push(`/plans/${result.id}`);
        }
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        // Try to diagnose network issues
        if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
          console.error('Network error - could be CORS, server unreachable, or a syntax error in the request');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('Error saving plan:', error);
      
      // Provide more detailed error message based on error type
      let errorMessage = "Failed to save plan. Please try again.";
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error instanceof Error) {
        // If it's a validation error, format it nicely
        if (error.message.includes('Validation failed') && error.message.includes('errors')) {
          errorMessage = `Validation error: ${error.message}`;
        } else {
          errorMessage = error.message || errorMessage;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  console.log("About to render CreatePlanForm JSX. Form state:", form.formState.isDirty, form.getValues());
  
  // Watch for changes to itinerary to update business status
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name?.startsWith('itinerary.') && name?.endsWith('.placeName')) {
        const index = parseInt(name.split('.')[1]);
        const itemData = form.getValues(`itinerary.${index}`);
        if (itemData && (!itemData.businessStatus || itemData.businessStatus === 'UNKNOWN')) {
          handleEditItineraryItem(index);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);
  
  useEffect(() => {
    const currentItinerary = form.getValues("itinerary");
    if (currentItinerary && currentItinerary.length > 0 && watchedEventTime) {
      try {
        const parsedEventTime = parseISO(watchedEventTime);
        if (isValidDate(parsedEventTime)) {
          const firstItem = currentItinerary[0];
          const firstItemStartTime = firstItem.startTime ? parseISO(firstItem.startTime) : null;
          
          if (!firstItemStartTime || !isValidDate(firstItemStartTime) || 
              firstItemStartTime.toISOString() !== parsedEventTime.toISOString()) {
            // Update first item's start time to match event time
            const updatedItem = {
              ...firstItem,
              startTime: formatISO(parsedEventTime),
              endTime: formatISO(addHours(parsedEventTime, 2))
            };
            form.setValue(`itinerary.0`, updatedItem);
            
            // Trigger chronological update for the rest of the itinerary
            ensureChronologicalItinerary();
          }
        }
      } catch (e) {
        console.warn("Error syncing event time with first itinerary item:", e);
      }
    }
  }, [watchedEventTime, form, ensureChronologicalItinerary]);
  
  // Watch for event time changes
  useEffect(() => {
    if (!watchedEventTime) return;

    const currentItinerary = form.getValues("itinerary");
    if (!currentItinerary || currentItinerary.length === 0) return;

    try {
      const parsedEventTime = parseISO(watchedEventTime);
      if (!isValidDate(parsedEventTime)) return;

      const firstItem = currentItinerary[0];
      if (!firstItem.startTime || !isValidDate(parseISO(firstItem.startTime)) || 
          parseISO(firstItem.startTime).toISOString() !== parsedEventTime.toISOString()) {
        
        // Update first item's start time to match event time
        const updatedFirstItem = {
          ...firstItem,
          startTime: watchedEventTime,
        };
        
        // Calculate end time based on duration
        if (firstItem.duration) {
          updatedFirstItem.endTime = formatISO(addMinutes(parsedEventTime, firstItem.duration));
        }

        const updatedItinerary = [...currentItinerary];
        updatedItinerary[0] = updatedFirstItem;
        form.setValue("itinerary", updatedItinerary);
      }
    } catch (error) {
      console.error("Error synchronizing event time:", error);
    }
  }, [watchedEventTime, form]);

  // Watch for first item time changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (!name?.startsWith('itinerary.0.')) return;
      
      const currentItinerary = form.getValues("itinerary");
      if (!currentItinerary || currentItinerary.length === 0) return;

      const firstItem = currentItinerary[0];
      if (!firstItem.startTime) return;

      try {
        const parsedStartTime = parseISO(firstItem.startTime);
        if (!isValidDate(parsedStartTime)) return;

        const currentEventTime = form.getValues("eventTime");
        const parsedEventTime = parseISO(currentEventTime);

        if (!isValidDate(parsedEventTime) || 
            parsedEventTime.toISOString() !== parsedStartTime.toISOString()) {
          form.setValue("eventTime", firstItem.startTime);
        }
      } catch (error) {
        console.error("Error synchronizing first item time:", error);
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);
  
  // Add form state logging for debugging
  useEffect(() => {
    const subscription = form.watch((value) => {
      console.log("Form values changed:", value);
      console.log("Form state:", form.formState);
    });
    return () => subscription.unsubscribe();
  }, [form]);
  
  return (
    <FormProvider {...form}>
      <form 
        onSubmit={(e) => {
          e.preventDefault(); // Prevent traditional form submission
          form.handleSubmit(onSubmit)(e);
        }} 
        className="space-y-8"
      >
        
        {initialFormValues.selectedPoint && formMode === 'create' && ( 
          <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-700">
            <MapIcon className="h-5 w-5 !text-blue-700" />
            <AlertTitle>AI Plan Generation Context</AlertTitle>
            <AlertDescription>
              This plan draft was generated considering an area around {' '}
              <span className="font-semibold">
                Lat: {initialFormValues.selectedPoint.lat.toFixed(4)}, Lng: {initialFormValues.selectedPoint.lng.toFixed(4)}
              </span>{' '}
              with a radius of <span className="font-semibold">{initialFormValues.mapRadiusKm || 5} km</span>.
              {initialFormValues.userEnteredCityForStep2 && (
                <> The AI also considered locations within <span className="font-semibold">{initialFormValues.userEnteredCityForStep2}</span>.</>
              )}
              You can adjust the final location and itinerary details below.
            </AlertDescription>
          </Alert>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Feather className="h-5 w-5 text-primary"/> Core Plan Information</CardTitle>
            <CardDescription>Provide the essential details for your event. All fields are required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">Plan Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Birthday Bash, Weekend Getaway" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe your event, what's the occasion, vibe, etc." {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="eventTime"
                  render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center gap-1"><CalendarIcon className="h-4 w-4 text-muted-foreground" /> Event Time</FormLabel>
                      <FormControl>
                        <Input 
                        type="datetime-local"
                           {...field} 
                        value={field.value ? format(parseISO(field.value), "yyyy-MM-dd'T'HH:mm") : ''}
                           onChange={(e) => {
                          try {
                            const selectedDate = parseISO(e.target.value);
                            if (isValidDate(selectedDate)) {
                              field.onChange(formatISO(selectedDate));
                            }
                          } catch (error) {
                            console.error("Error parsing date:", error);
                          }
                        }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                control={form.control}
                name="eventType"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center gap-1">Event Type</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Dinner Party, Museum Visit" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <FormField
              control={form.control}
              name="priceRange"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><DollarSign className="h-4 w-4 text-muted-foreground" /> Price Range</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    defaultValue={field.value || ""}
                  >
                      <SelectTrigger>
                      <SelectValue placeholder="Select a price range" />
                      </SelectTrigger>
                    <SelectContent>
                      {COMMON_PRICE_RANGES.map((range) => (
                        <SelectItem key={range} value={range}>{range}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary"/> Participants</CardTitle>
            <CardDescription>Select friends to invite to this plan. Their preferences will be considered by AI suggestions.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="invitedParticipantUserIds"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <FriendMultiSelectInput
                        availableFriends={MOCK_INVITABLE_FRIENDS_DATA.filter(f => f.userId !== MOCK_USER_ID)}
                        selectedFriendIds={field.value || []}
                        onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListOrdered className="h-5 w-5 text-primary"/> Event Itinerary</CardTitle>
            <CardDescription>
              Outline the sequence of activities or stops for your event. The first item should match your "Start Location/Venue".
              Times are in 24-hour format.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             {itineraryFields.map((field, index) => (
              <Card key={field.fieldId} className="bg-secondary/30 p-0 relative">
                <CardHeader className="py-3 px-4">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg flex items-center gap-2">
                            Stop {index + 1}: {editingItineraryIndex === index ? "Editing..." : form.getValues(`itinerary.${index}.placeName`)}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {editingItineraryIndex !== index && (
                                <>
                                    <div className="text-sm text-muted-foreground">
                                        {form.getValues(`itinerary.${index}.startTime`) && isValidDate(parseISO(form.getValues(`itinerary.${index}.startTime`))) ? 
                                            format(parseISO(form.getValues(`itinerary.${index}.startTime`)), "h:mm a") : "Time not set"}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {index !== 0 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleMoveItem(index, index - 1)}
                                            >
                                                <ArrowUp className="h-4 w-4" />
                                                <span className="sr-only">Move Up</span>
                                </Button>
                                        )}
                                        {index !== itineraryFields.length - 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleMoveItem(index, index + 1)}
                                            >
                                                <ArrowDown className="h-4 w-4" />
                                                <span className="sr-only">Move Down</span>
                                </Button>
                            )}
                             <Button
                                type="button"
                                variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditItineraryItem(index)}
                                        >
                                            <Edit className="h-4 w-4" />
                                            <span className="sr-only">Edit</span>
                            </Button>
                             <Button 
                                type="button" 
                                variant="ghost" 
                                            size="sm"
                                            onClick={() => handleRemoveItineraryItem(index)}
                             >
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Delete</span>
                            </Button>
                                    </div>
                                </>
                            )}
                            {editingItineraryIndex === index && (
                                <>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                        size="sm"
                                        onClick={() => handleSaveItineraryItem(index)}
                            >
                                        <Check className="h-4 w-4" />
                                        <span className="sr-only">Save</span>
                            </Button>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                        size="sm"
                                        onClick={() => setEditingItineraryIndex(null)}
                                    >
                                        <X className="h-4 w-4" />
                                        <span className="sr-only">Cancel</span>
                            </Button>
                                </>
                            )}
                        </div>
                    </div>
                </CardHeader>
                 {editingItineraryIndex === index ? (
                    <CardContent className="space-y-3 pt-2 pb-4 px-4">
                        <FormField
                            control={form.control}
                            name={`itinerary.${index}.placeName`}
                            render={({ field: itemField }) => (
                                <FormItem>
                                <FormLabel>Place Name</FormLabel>
                                <FormControl>
                                    <Input 
                                        {...itemField} 
                                        placeholder="Name of the venue or activity"
                                        ref={(el) => {
                                            if (editingItineraryIndex === index) {
                                                editingItineraryItemInputRef.current = el;
                                            }
                                        }}
                                    />
                                </FormControl>
                                <FormDescription>
                                    {isClient && !mapApiKeyMissing && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 
                                        ? "Start typing for place suggestions." 
                                        : "Enter place name manually. Autocomplete disabled (API key may be missing)."}
                                </FormDescription>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`itinerary.${index}.address`}
                            render={({ field: itemField }) => (
                                <FormItem>
                                <FormLabel>Address</FormLabel>
                                <FormControl><Input {...itemField} placeholder="Full street address"/></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`itinerary.${index}.city`}
                            render={({ field: itemField }) => (
                                <FormItem>
                                <FormLabel>City</FormLabel>
                                <FormControl><Input {...itemField} placeholder="City of the stop"/></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`itinerary.${index}.startTime`}
                            render={({ field: itemField }) => {
                                const itemStartTimeValue = itemField.value;
                                let formattedStartTime = "";
                                if (itemStartTimeValue && isClient && isValidDate(parseISO(itemStartTimeValue))) {
                                    try {
                                        formattedStartTime = format(parseISO(itemStartTimeValue), "yyyy-MM-dd'T'HH:mm");
                                    } catch (e) { console.warn("Error formatting itinerary startTime for input: ", itemStartTimeValue); }
                                }
                                return (<FormItem>
                                <FormLabel>Start Time</FormLabel>
                                <div className="flex items-center gap-2">
                                    <FormControl>
                                        <Input type="datetime-local" 
                                            value={formattedStartTime}
                                            onChange={(e) => {
                                                try {
                                                    itemField.onChange(e.target.value ? parseISO(e.target.value).toISOString() : "")
                                                } catch (err) {
                                                    console.warn("Invalid datetime-local input for startTime", e.target.value);
                                                    itemField.onChange(e.target.value); 
                                                }
                                            }}
                                            className="bg-background"
                                        />
                                    </FormControl>
                                </div>
                                <FormMessage />
                                </FormItem>
                            )}}
                        />
                         <FormField
                            control={form.control}
                            name={`itinerary.${index}.endTime`}
                            render={({ field: itemField }) => {
                                const itemEndTimeValue = itemField.value;
                                let formattedEndTime = "";
                                 if (itemEndTimeValue && isClient && isValidDate(parseISO(itemEndTimeValue))) {
                                    try {
                                        formattedEndTime = format(parseISO(itemEndTimeValue), "yyyy-MM-dd'T'HH:mm");
                                    } catch (e) { console.warn("Error formatting itinerary endTime for input: ", itemEndTimeValue); }
                                }
                                return (
                                    <FormItem>
                                <FormLabel>End Time (Optional)</FormLabel>
                                <div className="flex items-center gap-2">
                                    <FormControl>
                                        <Input type="datetime-local" 
                                            value={formattedEndTime}
                                            onChange={(e) => {
                                                try {
                                                    itemField.onChange(e.target.value ? parseISO(e.target.value).toISOString() : null)
                                                } catch (err) {
                                                    console.warn("Invalid datetime-local input for endTime", e.target.value);
                                                     itemField.onChange(e.target.value); 
                                                }
                                            }}
                                            className="bg-background"
                                        />
                                    </FormControl>
                                </div>
                                <FormMessage />
                                </FormItem>
                                );
                            }}
                        />
                        <FormField
                            control={form.control}
                            name={`itinerary.${index}.description`}
                            render={({ field: itemField }) => (
                                <FormItem>
                                <FormLabel>Notes/Description</FormLabel>
                                <FormControl>
                                    <Textarea {...itemField} placeholder="Add notes or description for this stop"/>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name={`itinerary.${index}.activitySuggestions`}
                            render={({ field: itemField }) => (
                                <FormItem>
                                <FormLabel>Activity Suggestions</FormLabel>
                                <FormControl>
                                    <Textarea 
                                        value={itemField.value?.join('\n') || ''}
                                        onChange={(e) => {
                                            const suggestions = e.target.value.split('\n').filter(s => s.trim() !== '');
                                            itemField.onChange(suggestions);
                                        }}
                                        placeholder="Enter activity suggestions (one per line)"
                                    />
                                </FormControl>
                                <FormDescription>Enter each activity suggestion on a new line</FormDescription>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`itinerary.${index}.businessStatus`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Business Status</FormLabel>
                                    <FormControl>
                                        <PlaceStatusBadges 
                                            businessStatus={field.value || form.getValues(`itinerary.${index}.status`)}
                                            city={form.getValues(`itinerary.${index}.city`)}
                                        />
                                    </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                 ) : (
                     <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start pt-2 pb-4 px-4">
                        <div className="md:col-span-2 space-y-1">
                            <h4 className="text-md font-semibold">{form.getValues(`itinerary.${index}.placeName`)}</h4>
                            <PlaceStatusBadges 
                                businessStatus={form.getValues(`itinerary.${index}.businessStatus`) || form.getValues(`itinerary.${index}.status`)}
                                city={form.getValues(`itinerary.${index}.city`)}
                            />
                            <p className="text-xs text-muted-foreground">
                                {form.getValues(`itinerary.${index}.address`)}
                            </p>
                            <p className="text-sm mt-2">{form.getValues(`itinerary.${index}.description`)}</p>
                            {form.getValues(`itinerary.${index}.activitySuggestions`)?.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-border/50">
                                    <h5 className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                                        <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                                        Suggestions for this stop:
                                    </h5>
                                    <ul className="list-disc list-inside pl-1 space-y-0.5">
                                        {form.getValues(`itinerary.${index}.activitySuggestions`).map((suggestion: string, sIndex: number) => (
                                            <li key={sIndex} className="text-xs text-muted-foreground/90">{suggestion}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div className="md:col-span-1 relative aspect-video w-full rounded-md overflow-hidden bg-muted border">
                             <Image
                                src={form.getValues(`itinerary.${index}.googleMapsImageUrl`) || `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(form.getValues(`itinerary.${index}.address`) + ", " + form.getValues(`itinerary.${index}.city`))}&zoom=15&size=400x225&maptype=roadmap&markers=color:red%7C${encodeURIComponent(form.getValues(`itinerary.${index}.address`) + ", " + form.getValues(`itinerary.${index}.city`))}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}`}
                                alt={form.getValues(`itinerary.${index}.placeName`) || `Itinerary item ${index+1}`}
                                fill={true}
                                style={{objectFit: "cover"}}
                                data-ai-hint={`${form.getValues(`itinerary.${index}.placeName`)} map location`}
                            />
                        </div>
                    </CardContent>
                 )}
              </Card>
            ))}
            <CardFooter className="flex flex-col items-start gap-4 p-4 border-t bg-secondary/20 rounded-b-lg">
                <div className="w-full space-y-2">
                     <Label htmlFor="new-itinerary-item-input">Add New Stop</Label>
                    <Input 
                        id="new-itinerary-item-input"
                        ref={newItineraryItemInputRef} 
                        placeholder="Type new stop name or address (Google Maps Autocomplete)" 
                        onChange={(e) => setNewItineraryItemName(e.target.value)}
                        onBlur={(e) => { 
                            if (!isAutocompleteUpdateInProgress && newItineraryItemName.trim() && !newItineraryItemAddress.trim()) {
                                setNewItineraryItemAddress(newItineraryItemName); 
                            }
                        }}
                        className="bg-background"
                        disabled={mapApiKeyMissing && !isClient}
                    />
                     {mapApiKeyMissing && isClient && (
                        <p className="text-xs text-destructive">Google Maps Autocomplete disabled for new stops (API key missing).</p>
                      )}
                </div>
                <Button id="add-itinerary-stop-button" type="button" onClick={handleAddNewItineraryItem} disabled={isAddingItineraryItem || !newItineraryItemName.trim()} className="w-full sm:w-auto">
                    {isAddingItineraryItem && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Itinerary Stop
                </Button>
            </CardFooter>
          </CardContent>
        </Card>
        
        <div className="flex flex-col sm:flex-row-reverse gap-3 pt-6">
            <Button 
              type="button" 
              onClick={async (e) => {
                e.preventDefault();
                console.log('====== CREATE PLAN BUTTON CLICKED! ======');
                
                // Get form data first for logging
                const formData = form.getValues();
                console.log('Form data before validation:', JSON.stringify(formData, null, 2));
                
                // Pre-process and fix common issues before validation
                if (formData.itinerary && formData.itinerary.length > 0) {
                  // Fix missing address fields in itinerary items
                  const fixedItinerary = formData.itinerary.map((item, index) => {
                    const fixedItem = { ...item };
                    
                    // If address is missing but placeName exists, use placeName as address
                    if ((!fixedItem.address || fixedItem.address.trim() === '') && fixedItem.placeName) {
                      console.log(`Fixing missing address for item ${index} using placeName: ${fixedItem.placeName}`);
                      fixedItem.address = fixedItem.placeName;
                      
                      // If city is also missing, add it from the main form
                      if ((!fixedItem.city || fixedItem.city.trim() === '') && formData.city) {
                        fixedItem.city = formData.city;
                      }
                    }
                    
                    // Fix date formatting issues
                    try {
                      // Fix startTime format if it exists but isn't valid ISO
                      if (fixedItem.startTime) {
                        const startDate = parseISO(fixedItem.startTime);
                        if (isValidDate(startDate)) {
                          fixedItem.startTime = formatISO(startDate);
                        } else {
                          console.log(`Invalid startTime format for item ${index}: ${fixedItem.startTime}`);
                        }
                      }
                      
                      // Fix endTime format if it exists but isn't valid ISO
                      if (fixedItem.endTime) {
                        const endDate = parseISO(fixedItem.endTime);
                        if (isValidDate(endDate)) {
                          fixedItem.endTime = formatISO(endDate);
                        } else {
                          console.log(`Invalid endTime format for item ${index}: ${fixedItem.endTime}`);
                        }
                      }
                    } catch (error) {
                      console.error(`Error fixing date formats for item ${index}:`, error);
                    }
                    
                    // Update the form with the fixed item
                    form.setValue(`itinerary.${index}`, fixedItem);
                    
                    return fixedItem;
                  });
                  
                  // Update the entire itinerary if fixes were made
                  form.setValue('itinerary', fixedItinerary);
                } else {
                  // Create a default itinerary item if missing
                  console.log('Creating default itinerary item because itinerary is empty or undefined');
                  const mainEventTime = formData.eventTime || formatISO(addHours(new Date(), 24));
                  
                  if (formData.location && formData.city) {
                    const defaultItem = {
                      id: `default_item_${Date.now()}`,
                      placeName: formData.location,
                      address: formData.location,
                      city: formData.city,
                      description: `Visit ${formData.location}`,
                      startTime: mainEventTime,
                      endTime: formatISO(addHours(parseISO(mainEventTime), 2)),
                      activitySuggestions: ['Enjoy the event'],
                    };
                    
                    form.setValue('itinerary', [defaultItem]);
                  } else {
                    console.error('Cannot create default itinerary item: location or city missing');
                    toast({
                      title: "Missing Information",
                      description: "Location and city are required to create a plan.",
                      variant: "destructive"
                    });
                    return;
                  }
                }
                
                // Fix main event time if needed
                try {
                  if (formData.eventTime) {
                    const eventDate = parseISO(formData.eventTime);
                    if (isValidDate(eventDate)) {
                      const formattedEventTime = formatISO(eventDate);
                      if (formattedEventTime !== formData.eventTime) {
                        console.log(`Fixing main eventTime format: ${formData.eventTime} -> ${formattedEventTime}`);
                        form.setValue('eventTime', formattedEventTime);
                      }
                    } else {
                      console.log(`Invalid main eventTime format: ${formData.eventTime}`);
                    }
                  }
                } catch (error) {
                  console.error('Error fixing main eventTime format:', error);
                }
                
                // Fix missing location and city from first itinerary item if available
                if (formData.itinerary && formData.itinerary.length > 0) {
                  const firstItem = formData.itinerary[0];
                  
                  // If location is missing, use placeName from first item
                  if ((!formData.location || formData.location.trim() === '') && firstItem.placeName) {
                    console.log(`Setting missing location from first itinerary item: ${firstItem.placeName}`);
                    form.setValue('location', firstItem.placeName);
                  }
                  
                  // If city is missing, use city from first item
                  if ((!formData.city || formData.city.trim() === '') && firstItem.city) {
                    console.log(`Setting missing city from first itinerary item: ${firstItem.city}`);
                    form.setValue('city', firstItem.city);
                  }
                }
                
                // Check form state before validation
                console.log('Form state before validation:', {
                  isDirty: form.formState.isDirty,
                  isValid: form.formState.isValid,
                  errors: form.formState.errors
                });
                
                // If form is not marked as dirty but has values, mark it as dirty
                if (!form.formState.isDirty && formData.name && formData.itinerary && formData.itinerary.length > 0) {
                  console.log('Form has values but is not marked as dirty, forcing dirtyFields');
                  
                  // Touch all fields to mark them as dirty
                  const allFields = [
                    "name", "description", "eventTime", "location", "city", 
                    "eventType", "priceRange", "status", "itinerary"
                  ];
                  
                  allFields.forEach(field => {
                    if (formData[field]) {
                      form.setValue(field, formData[field], { 
                        shouldDirty: true, 
                        shouldTouch: true 
                      });
                    }
                  });
                }
                
                // Validate form field by field to identify specific issues
                const nameValid = await form.trigger("name");
                const descriptionValid = await form.trigger("description");
                const eventTimeValid = await form.trigger("eventTime");
                const locationValid = await form.trigger("location");
                const cityValid = await form.trigger("city");
                const eventTypeValid = await form.trigger("eventType");
                const priceRangeValid = await form.trigger("priceRange");
                const itineraryValid = await form.trigger("itinerary");
                
                console.log('Field-by-field validation results:', {
                  nameValid,
                  descriptionValid,
                  eventTimeValid,
                  locationValid,
                  cityValid,
                  eventTypeValid,
                  priceRangeValid,
                  itineraryValid
                });
                
                // Check itinerary fields specifically
                if (!itineraryValid) {
                  const itinerary = formData.itinerary || [];
                  console.log('Itinerary validation details:');
                  itinerary.forEach((item, index) => {
                    console.log(`Item ${index}:`, {
                      id: item.id,
                      placeName: item.placeName,
                      address: item.address,
                      city: item.city,
                      description: item.description,
                      startTime: item.startTime,
                      endTime: item.endTime
                    });
                  });
                  
                  // Validate each itinerary item individually to find the issue
                  itinerary.forEach(async (item, index) => {
                    await form.trigger(`itinerary.${index}`);
                    const itemErrors = form.formState.errors.itinerary?.[index];
                    if (itemErrors) {
                      console.log(`Validation errors for itinerary item ${index}:`, itemErrors);
                    }
                  });
                }
                
                // Now validate everything
                const isValid = await form.trigger();
                
                console.log('Form errors after trigger:', form.formState.errors);
                
                if (!isValid) {
                  console.log('Form validation failed');
                  // Show detailed error message
                  const errorMessages = Object.entries(form.formState.errors)
                    .map(([field, error]) => `${field}: ${error.message}`)
                    .join(', ');
                  
                  toast({
                    title: "Validation Error",
                    description: `Please check the form for errors: ${errorMessages}`,
                    variant: "destructive"
                  });
                  return;
                }
                
                // Call onSubmit directly
                onSubmit(formData);
              }}
              disabled={isSubmitting || !isClient} 
              className="w-full sm:w-auto" 
              size="lg"
            >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {formMode === 'create' ? 'Create Plan' : 'Save Changes'}
            </Button>
            {formMode === 'edit' && planIdForEdit && (
                 <Button 
                   type="button" 
                   variant="outline" 
                   onClick={() => router.push(`/plans/${planIdForEdit}`)} 
                   disabled={isSubmitting} 
                   className="w-full sm:w-auto"
                 >
                    Cancel
                </Button>
            )}
             {formMode === 'create' && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => router.push(`/plans/create/initiate`)} 
                  disabled={isSubmitting} 
                  className="w-full sm:w-auto"
                >
                    Back to Step 1
                </Button>
            )}
        </div>
      </form>
    </FormProvider>
  );
}
