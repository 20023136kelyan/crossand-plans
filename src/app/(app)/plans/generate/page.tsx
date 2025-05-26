
// src/app/(app)/plans/generate/page.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// Removed unused Label import
import { Slider } from "@/components/ui/slider";
import { 
  CalendarIcon, Loader2, Sparkles, Search as SearchIcon, ChevronLeft, X as XIcon, Users as UsersIcon, Circle as CircleIcon, Edit3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid as isDateValid, addHours } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useRef, useMemo, useCallback }  from 'react';
import type { Plan, UserProfile, PriceRangeType, PlanTypeType as PlanTypeHintTypeAlias, AISimpleProfile } from '@/types/user';
import { generatePlanWithAIAction, createPlanAction } from '@/app/actions/planActions';
import { PlanForm, type PlanFormValues } from '@/components/plans/PlanForm';
import { FriendMultiSelectInput } from '@/components/plans/FriendMultiSelectInput';
import { GoogleMap, useJsApiLoader, MarkerF, CircleF } from '@react-google-maps/api';

const priceRangeOptions: Array<{ value: PriceRangeType | '', label: string }> = [
    { value: '', label: 'Any' },
    { value: 'Free', label: 'Free' },
    { value: '$', label: '$ (Cheap)' },
    { value: '$$', label: '$$ (Moderate)' },
    { value: '$$$', label: '$$$ (Pricey)' },
    { value: '$$$$', label: '$$$$ (Very Pricey)' },
];
const planTypeHintOptions: Array<{value: 'ai-decide' | PlanTypeHintTypeAlias, label: string}> = [
    { value: 'ai-decide', label: 'AI Decide' },
    { value: 'single-stop', label: 'Single Stop' },
    { value: 'multi-stop', label: 'Multi-Stop' },
];

const GeneratePlanInputClientSchema = z.object({
  hostUid: z.string(),
  invitedParticipantUserIds: z.array(z.string()).optional().default([]),
  planDateTime: z.string().refine((val) => isDateValid(parseISO(val)), { message: "Plan start date and time is required."}),
  locationQuery: z.string().min(3, { message: 'Location query must be at least 3 characters.' }),
  selectedLocationLat: z.number().optional().nullable(),
  selectedLocationLng: z.number().optional().nullable(),
  priceRange: z.enum(['$', '$$', '$$$', '$$$$', 'Free', ''] as const).optional().nullable(),
  userPrompt: z.string().min(10, { message: 'Prompt must be at least 10 characters.' }).max(500),
  searchRadius: z.number().min(0).max(50).optional().nullable(),
  planTypeHint: z.enum(['ai-decide', 'single-stop', 'multi-stop'] as const).optional().default('ai-decide'),
});


type GeneratePlanInputFormValues = Omit<z.infer<typeof GeneratePlanInputClientSchema>, 'hostUid' | 'planDateTime'> & { planDateTime: Date };


const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultMapCenter = { lat: 48.8566, lng: 2.3522 }; // Default to Paris

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

const defaultDateTime = (() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0); 
    return tomorrow;
})();

export default function GeneratePlanPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user, currentUserProfile, loading: authLoading } = useAuth();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<Plan | null>(null);

  const locationQueryInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete & { input?: HTMLInputElement; listener?: google.maps.MapsEventListener } | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const libraries = useMemo<("places" | "geocoding")[]>(() => ['places', 'geocoding'], []);
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey || "",
    libraries: libraries,
  });

  const form = useForm<GeneratePlanInputFormValues>({
    resolver: zodResolver(GeneratePlanInputClientSchema.omit({ hostUid: true }).extend({ planDateTime: z.date() })), // Client uses Date object
    defaultValues: {
      invitedParticipantUserIds: [],
      planDateTime: defaultDateTime,
      locationQuery: '',
      selectedLocationLat: null,
      selectedLocationLng: null,
      priceRange: '', 
      userPrompt: '',
      searchRadius: 5, 
      planTypeHint: 'ai-decide',
    },
  });
  
  const selectedLat = form.watch('selectedLocationLat');
  const selectedLng = form.watch('selectedLocationLng');
  const watchedSearchRadius = form.watch('searchRadius');

  const mapCenter = useMemo(() => {
    if (selectedLat != null && selectedLng != null) return { lat: selectedLat, lng: selectedLng };
    return defaultMapCenter;
  }, [selectedLat, selectedLng]);

 useEffect(() => {
    if (isLoaded && form.getValues('locationQuery') === '' && !form.formState.isDirty && navigator.geolocation && (!selectedLat && !selectedLng)) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (form.getValues('locationQuery') === '') { 
            const { latitude, longitude } = position.coords;
            form.setValue('selectedLocationLat', latitude, { shouldValidate: true });
            form.setValue('selectedLocationLng', longitude, { shouldValidate: true });
            if (mapRef.current) mapRef.current.panTo({ lat: latitude, lng: longitude });

            if (window.google && window.google.maps && window.google.maps.Geocoder) {
              const geocoder = new window.google.maps.Geocoder();
              geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
                if (status === 'OK' && results && results[0] && form.getValues('locationQuery') === '') {
                  form.setValue('locationQuery', results[0].formatted_address, { shouldValidate: true });
                } else if (form.getValues('locationQuery') === '') {
                   form.setValue('locationQuery', `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, { shouldValidate: true });
                }
              });
            }
          }
        },
        (error) => {
          toast({ title: "Location Access Denied", description: "Using default. Enter location or grant permission.", variant: "default", duration: 5000 });
          console.warn("Geolocation error:", error.message);
        },
        { timeout: 7000, enableHighAccuracy: false }
      );
    }
  }, [isLoaded, form, toast, selectedLat, selectedLng]);

  useEffect(() => {
    if (!isLoaded || !locationQueryInputRef.current || typeof window === 'undefined' || !window.google || !window.google.maps.places) return;
    if (autocompleteRef.current && autocompleteRef.current.input === locationQueryInputRef.current) return;
    
    if (autocompleteRef.current && autocompleteRef.current.listener) {
      window.google.maps.event.removeListener(autocompleteRef.current.listener);
      if (autocompleteRef.current.input) window.google.maps.event.clearInstanceListeners(autocompleteRef.current.input);
    }

    const newAutocomplete = new window.google.maps.places.Autocomplete(locationQueryInputRef.current, { types: ['geocode', 'establishment'], fields: ['name', 'formatted_address', 'address_components', 'geometry', 'place_id'] });
    newAutocomplete.input = locationQueryInputRef.current;
    
    const listener = newAutocomplete.addListener('place_changed', () => {
      const place = newAutocomplete.getPlace();
      if (place.geometry?.location) {
        form.setValue('locationQuery', place.name || place.formatted_address || '', { shouldValidate: true });
        form.setValue('selectedLocationLat', place.geometry.location.lat() ?? null, { shouldValidate: true });
        form.setValue('selectedLocationLng', place.geometry.location.lng() ?? null, { shouldValidate: true });
        if (mapRef.current) mapRef.current.panTo(place.geometry.location);
      } else if (place.name && window.google && window.google.maps.Geocoder) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ address: place.name }, (results, status) => {
            if (status === 'OK' && results && results[0]?.geometry.location) {
              form.setValue('locationQuery', results[0].formatted_address || place.name || '', { shouldValidate: true });
              form.setValue('selectedLocationLat', results[0].geometry.location.lat() ?? null, { shouldValidate: true });
              form.setValue('selectedLocationLng', results[0].geometry.location.lng() ?? null, { shouldValidate: true });
               if (mapRef.current) mapRef.current.panTo(results[0].geometry.location);
            }
          });
      }
    });
    newAutocomplete.listener = listener;
    autocompleteRef.current = newAutocomplete;

    return () => { 
      if (listener && window.google && window.google.maps) window.google.maps.event.removeListener(listener);
      if (newAutocomplete.input && typeof window.google !== 'undefined' && window.google.maps) {
          window.google.maps.event.clearInstanceListeners(newAutocomplete.input);
      }
    };
  }, [isLoaded, form, locationQueryInputRef.current]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng && isLoaded && window.google && window.google.maps.Geocoder) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      form.setValue('selectedLocationLat', lat, { shouldValidate: true });
      form.setValue('selectedLocationLng', lng, { shouldValidate: true });
      if (mapRef.current) mapRef.current.panTo({ lat, lng });
      
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          form.setValue('locationQuery', results[0].formatted_address, { shouldValidate: true });
        } else {
          form.setValue('locationQuery', `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, { shouldValidate: true });
        }
      });
    }
  }, [form, isLoaded]);

  const handleGeneratePlan = async (data: GeneratePlanInputFormValues) => {
    if (!user || !currentUserProfile) {
      toast({ title: "Authentication Error", description: "Please log in to generate a plan.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    setGeneratedPlan(null);
    let idToken: string | null = null;
    try {
      await user.getIdToken(true); 
      idToken = await user.getIdToken();
      if (!idToken) {
        throw new Error("Failed to retrieve authentication token.");
      }
    } catch (tokenError: any) {
      toast({ title: "Authentication Error", description: tokenError.message || "Could not get auth token. Please try signing out and in.", variant: "destructive"});
      setIsGenerating(false);
      return;
    }
    
    try {
      const clientInputForAction = {
        ...data,
        hostUid: currentUserProfile.uid,
        planDateTime: data.planDateTime.toISOString(),
        priceRange: data.priceRange === '' ? null : data.priceRange,
      };

      const result = await generatePlanWithAIAction(clientInputForAction, idToken);
      if (result.success && result.plan) {
        toast({ title: "Plan Generated!", description: "Review and edit your new plan below.", duration: 5000 });
        setGeneratedPlan(result.plan);
      } else {
        toast({ title: "AI Generation Failed", description: result.error || "Could not generate plan. Adjust prompt or location.", variant: "destructive", duration: 7000 });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Unexpected error during AI plan generation.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleSaveGeneratedPlan = async (planDataFromForm: PlanFormValues) => {
    if (!user || !generatedPlan || !currentUserProfile) {
      toast({ title: "Error", description: "No plan to save or user not authenticated.", variant: "destructive" }); return;
    }
    setIsGenerating(true); 
    let idToken: string | null = null;
    try {
        await user.getIdToken(true);
        idToken = await user.getIdToken();
        if (!idToken) throw new Error("Failed to get ID token for saving plan.");
    } catch (tokenError: any) {
        toast({ title: "Authentication Error", description: tokenError.message || "Could not save plan.", variant: "destructive" });
        setIsGenerating(false);
        return;
    }

    try {
      const result = await createPlanAction(planDataFromForm, idToken);
      if (result.success && result.planId) {
        toast({ title: "Plan Saved!", description: `Your plan "${planDataFromForm.name}" has been saved.` });
        router.push(`/plans/${result.planId}`);
      } else {
        toast({ title: "Failed to Save Plan", description: result.error || "Could not save the plan.", variant: "destructive" });
      }
    } catch (error:any) {
      toast({ title: "Save Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading || (!currentUserProfile && user)) return <div className="flex justify-center items-center h-screen bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user || !currentUserProfile) {
     router.push('/login'); 
     return null; 
  }

  if (generatedPlan) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="shrink-0 flex items-center justify-between p-3 border-b border-muted-foreground/50 bg-background/80 backdrop-blur-sm z-20 shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => setGeneratedPlan(null)} disabled={isGenerating} aria-label="Edit Generation Criteria">
            <Edit3 className="h-5 w-5" />
          </Button>
          <h1 className="text-md font-semibold text-foreground/90">Review & Edit Your AI Plan</h1>
          <div className="w-9 h-9"></div> {}
        </header>
        <div className="flex-1 overflow-y-auto">
          <PlanForm 
            initialData={generatedPlan} 
            onSubmit={handleSaveGeneratedPlan} 
            isSubmitting={isGenerating} 
            formMode="create"
            formTitle="Review & Edit Your AI Plan" 
            onBackToAICriteria={() => setGeneratedPlan(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="shrink-0 flex items-center justify-between p-3 border-b border-muted-foreground/50 bg-background/80 backdrop-blur-sm z-20 shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-md font-semibold text-foreground/90">Create Plan</h1>
        <div className="w-9 h-9"></div> {}
      </header>
      
      <div className="p-3 text-center">
        <div className="inline-flex items-center p-0.5 bg-muted rounded-full">
          <Button variant="secondary" size="sm" className="rounded-full px-6 py-1.5 text-xs h-auto shadow-md bg-primary/30 text-primary">AI Generated</Button>
          <Button variant="ghost" size="sm" className="rounded-full px-6 py-1.5 text-xs h-auto text-muted-foreground" onClick={() => router.push('/plans/create')}>Manual</Button>
        </div>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleGeneratePlan)} className="flex flex-col flex-1 overflow-hidden">
          
          <div className="relative h-1/3 min-h-[200px] md:h-2/5 rounded-t-lg overflow-hidden">
            <div className="absolute top-3 left-3 right-3 z-10">
              <FormField
                control={form.control}
                name="locationQuery"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormControl>
                      <div className="relative">
                        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input 
                          placeholder="Search location or click on map..." 
                          {...field} 
                          ref={locationQueryInputRef} 
                          disabled={!isLoaded && !!googleMapsApiKey && !loadError} 
                          className="text-sm h-9 pl-9 bg-card shadow-md rounded-lg border-transparent focus:border-primary focus:ring-primary"
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs px-1 pt-0.5 bg-destructive/20 text-destructive rounded-b-md" />
                  </FormItem>
                )}
              />
            </div>
            <div className="w-full h-full bg-muted">
              {isLoaded ? (
                <GoogleMap mapContainerStyle={mapContainerStyle} center={mapCenter} zoom={selectedLat != null && selectedLng != null ? 12 : 5} options={mapThemeOptions} onClick={onMapClick} onLoad={onMapLoad}>
                  {selectedLat != null && selectedLng != null && (
                    <>
                      <MarkerF position={{ lat: selectedLat, lng: selectedLng }} />
                      {watchedSearchRadius != null && watchedSearchRadius > 0 && (
                        <CircleF center={{ lat: selectedLat, lng: selectedLng }} radius={watchedSearchRadius * 1000} options={{ strokeColor: 'hsl(var(--primary))', strokeOpacity: 0.6, strokeWeight: 1, fillColor: 'hsl(var(--primary))', fillOpacity: 0.15 }}/>
                      )}
                    </>
                  )}
                </GoogleMap>
              ) : loadError ? ( <div style={mapContainerStyle} className="flex items-center justify-center text-destructive text-xs p-2 text-center">Could not load map. Check API key & console.</div>
              ) : ( <div style={mapContainerStyle} className="flex items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div> )}
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 w-11/12 max-w-sm bg-card/80 backdrop-blur-sm p-2 sm:p-3 rounded-lg shadow-md">
                <FormField
                  control={form.control}
                  name="searchRadius"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <FormLabel className="text-xs font-medium text-foreground/90">Search Radius</FormLabel>
                        <span className="text-xs text-foreground/80">{(field.value ?? 0) === 0 ? 'Broad' : `${field.value} km`}</span>
                      </div>
                      <FormControl><Slider 
                        value={[field.value ?? 5]} 
                        onValueChange={(value) => field.onChange(value[0] === 0 ? null : value[0])} 
                        min={0} max={50} step={1} 
                        disabled={!selectedLat || !selectedLng} 
                        className="[&>span:first-child]:h-1.5 [&>span>span]:h-1.5 [&>button]:h-4 [&>button]:w-4 [&>button]:border-2"
                      /></FormControl>
                       <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar-vertical">
            <FormField
              control={form.control}
              name="planDateTime"
              render={({ field }) => (
                <FormItem className="flex flex-col space-y-1">
                  <FormLabel className="text-xs">Plan Start Date & Time</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={'outline'} className={cn('w-full justify-start text-left font-normal text-sm h-9', !field.value && 'text-muted-foreground')}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                           {field.value && isDateValid(field.value) ? format(field.value, 'MMM d, p') : <span>Pick date & time</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar 
                        mode="single" 
                        selected={field.value} 
                        onSelect={(date) => { 
                            const currentValDate = field.value && isDateValid(field.value) ? field.value : defaultDateTime;
                            const newDate = date || currentValDate; 
                            if (isDateValid(newDate)) {
                                newDate.setHours(currentValDate.getHours(), currentValDate.getMinutes()); 
                                field.onChange(newDate);
                            } else {
                                field.onChange(currentValDate);
                            }
                        }} 
                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} initialFocus />
                      <div className="p-2 border-t border-border/30">
                        <Input type="time" 
                          defaultValue={field.value && isDateValid(field.value) ? format(field.value, 'HH:mm') : format(defaultDateTime, 'HH:mm')} 
                          onChange={(e) => { 
                              const [hours, minutes] = e.target.value.split(':').map(Number); 
                              const newDate = new Date(field.value && isDateValid(field.value) ? field.value : defaultDateTime); 
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
            <FriendMultiSelectInput control={form.control} name="invitedParticipantUserIds" label="Invite Friends (Optional)" description="AI will consider their preferences!" />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
               <FormField
                  control={form.control}
                  name="priceRange"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-medium text-foreground/90">Price Range</FormLabel>
                      <RadioGroup 
                        onValueChange={(value) => field.onChange(value === '' ? null : value as PriceRangeType)} 
                        value={field.value === null ? '' : field.value} 
                        defaultValue="" 
                        className="flex flex-wrap gap-1.5 items-center"
                      >
                        {priceRangeOptions.map((option) => (
                          <FormItem key={option.value} className="flex items-center space-x-0 space-y-0">
                            <FormControl>
                              <RadioGroupItem value={option.value} id={`price-${option.value}-gen`} className="sr-only peer" />
                            </FormControl>
                            <FormLabel htmlFor={`price-${option.value}-gen`} className="cursor-pointer rounded-md border-2 border-muted bg-popover px-2 py-1 text-[11px] h-7 flex items-center justify-center peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/20 peer-data-[state=unchecked]:hover:bg-accent peer-data-[state=unchecked]:hover:text-accent-foreground transition-colors">{option.label}</FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="planTypeHint"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-medium text-foreground/90">Preferred Plan Type</FormLabel>
                      <RadioGroup 
                        onValueChange={(value) => field.onChange(value as 'ai-decide' | PlanTypeHintTypeAlias)} 
                        value={field.value}
                        defaultValue="ai-decide" 
                        className="flex flex-wrap gap-1.5 items-center"
                      >
                        {planTypeHintOptions.map((option) => (
                          <FormItem key={option.value} className="flex items-center space-x-0 space-y-0">
                            <FormControl>
                              <RadioGroupItem value={option.value} id={`type-${option.value}-gen`} className="sr-only peer" />
                            </FormControl>
                            <FormLabel htmlFor={`type-${option.value}-gen`} className="cursor-pointer rounded-md border-2 border-muted bg-popover px-2 py-1 text-[11px] h-7 flex items-center justify-center peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/20 peer-data-[state=unchecked]:hover:bg-accent peer-data-[state=unchecked]:hover:text-accent-foreground transition-colors">{option.label}</FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
            </div>

            <FormField
              control={form.control}
              name="userPrompt"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs font-medium text-foreground/90">What's the vibe? Tell AI your wishes!</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., A relaxed weekend exploring historical sites, must include a great pizza place. Max 3 stops." {...field} className="text-sm bg-muted border-border/30 focus:border-primary placeholder:text-muted-foreground/70 min-h-[60px]" rows={3} />
                  </FormControl>
                  <FormDescription className="text-xs">More details help the AI create a better plan.</FormDescription>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>

          <div className="p-4 border-t border-border/30">
            <Button 
              type="submit" 
              variant="outline"
              className="w-full h-11 transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 active:shadow-sm" 
              disabled={isGenerating || (!isLoaded && !!googleMapsApiKey && !loadError) || (!form.formState.isValid && form.formState.isSubmitted) }
            >
              {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
              Generate Plan with AI
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

