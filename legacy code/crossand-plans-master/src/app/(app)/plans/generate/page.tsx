
// src/app/(app)/plans/generate/page.tsx
'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GoogleMap, useJsApiLoader, CircleF, AdvancedMarker as GoogleMapsAdvancedMarker, InfoWindow } from '@react-google-maps/api';
import { PlaceAutocomplete } from '@/components/ui/place-autocomplete';
import { format, parseISO, isValid, addHours } from 'date-fns';
import { CalendarIcon, ChevronLeft, Edit3, Loader2, SearchIcon, Sparkles, ChevronDown, ChevronUp, MapPin, Clock, Users, DollarSign, Target, MessageSquare, CheckCircle, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PlanForm } from '@/components/plans/PlanForm';
import { FriendMultiSelectInput } from '@/components/plans/FriendMultiSelectInput';
import { LimitGuard } from '@/components/limits/LimitGuard';
// Schema is defined in planActions.ts - we'll define it locally for now
const GeneratePlanInputClientSchema = z.object({
  hostUid: z.string(),
  invitedParticipantUserIds: z.array(z.string()).optional().default([]),
  planDateTime: z.string().refine((val) => isValid(parseISO(val)), {
    message: "Plan start date and time is required and must be a valid ISO date string.",
  }),
  locationQuery: z.string().min(3, { message: 'Location query must be at least 3 characters.' }),
  selectedLocationLat: z.number().optional().nullable(),
  selectedLocationLng: z.number().optional().nullable(),
  priceRange: z.enum(['$', '$$', '$$$', '$$$$', 'Free', ''] as const).optional().nullable(),
  userPrompt: z.string().min(10, { message: 'Prompt must be at least 10 characters.' }).max(500),
  searchRadius: z.number().min(0).max(50).optional().nullable(),
  planTypeHint: z.enum(['ai-decide', 'single-stop', 'multi-stop'] as const).optional().default('ai-decide'),
});
import { PlanTypeHintTypeAlias, PriceRangeType } from '@/types/common';
import { generatePlanWithAIAction, createPlanAction } from '@/app/actions/planActions';
import { PlanFormValues } from '@/components/plans/PlanForm';
import { Plan } from '@/types/common';

// AdvancedMarker component using native Google Maps AdvancedMarkerElement
interface AdvancedMarkerProps {
  position: { lat: number; lng: number };
  map: google.maps.Map | null;
}

const AdvancedMarker: React.FC<AdvancedMarkerProps> = ({ position, map }) => {
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.marker && map) {
      // Validate position values
      if (typeof position.lat !== 'number' || typeof position.lng !== 'number' || 
          isNaN(position.lat) || isNaN(position.lng)) {
        console.warn('Invalid position values for AdvancedMarker:', position);
        return;
      }

      // Clean up existing marker
      if (markerRef.current) {
        markerRef.current.map = null;
      }

      // Create new AdvancedMarkerElement with validated position
      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: position.lat, lng: position.lng },
        map: map,
      });
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.map = null;
      }
    };
  }, [position, map]);

  return null; // This component doesn't render anything directly
};

// Helper function to extract general area from full address
const getCompactLocation = (fullAddress: string): string => {
  if (!fullAddress) return '';
  
  // Split by commas and get relevant parts
  const parts = fullAddress.split(',').map(part => part.trim());
  
  if (parts.length <= 2) {
    return fullAddress; // Already short enough
  }
  
  // For most addresses, take the first part (street/place name) and the city
  // Skip detailed parts like street numbers, postal codes, states, countries
  const placeName = parts[0];
  
  // Find the city (usually the second or third part, avoiding postal codes and countries)
  let cityPart = '';
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    // Skip if it looks like a postal code (numbers/letters combo) or common country names
    if (!/^\d+$/.test(part) && 
        !/^[A-Z]{2}\s*\d/.test(part) && 
        !['USA', 'United States', 'US', 'Canada', 'CA', 'UK', 'United Kingdom'].includes(part)) {
      cityPart = part;
      break;
    }
  }
  
  // Return compact format
  if (cityPart && cityPart !== placeName) {
    return `${placeName}, ${cityPart}`;
  }
  
  return placeName;
};

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

// Helper function for date validation
function isDateValid(date: Date): boolean {
  return isValid(date) && date > new Date();
}

// Helper function to get the preferred color scheme
const getPreferredMapMode = () => {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // It's important to ensure google.maps is loaded before accessing its properties.
    // This might require careful handling depending on when this function is called
    // relative to the API script load.
    // Assuming 'google' is available globally when this is used in mapOptions.
    // @ts-ignore google.maps.rendering might not be in standard types yet
    if (window.google && window.google.maps && window.google.maps.rendering && window.google.maps.rendering.resources && window.google.maps.rendering.resources.MapMode) {
        // @ts-ignore
        return google.maps.rendering.resources.MapMode.DARK;
    }
  }
  // @ts-ignore
  if (window.google && window.google.maps && window.google.maps.rendering && window.google.maps.rendering.resources && window.google.maps.rendering.resources.MapMode) {
      // @ts-ignore
      return google.maps.rendering.resources.MapMode.LIGHT;
  }
  return undefined; // Or a sensible default if google.maps is not ready
};


type GeneratePlanInputFormValues = Omit<z.infer<typeof GeneratePlanInputClientSchema>, 'hostUid' | 'planDateTime'> & { planDateTime: Date };


const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultMapCenter = { lat: 48.8566, lng: 2.3522 }; // Default to Paris

const mapThemeOptions: google.maps.MapOptions = {
  // Note: styles property removed because it conflicts with mapId
  // When using mapId, styles must be controlled via Google Cloud Console
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

// Static libraries array to prevent recreation on each render
const GOOGLE_MAPS_LIBRARIES: ("places" | "marker" | "geocoding")[] = ['places', 'geocoding', 'marker'];

export default function GeneratePlanPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user, currentUserProfile, loading: authLoading } = useAuth();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<Plan | null>(null);

  const locationQueryInputRef = useRef<HTMLInputElement>(null);
  const [searchValue, setSearchValue] = useState("");
  const mapRef = useRef<google.maps.Map | null>(null);
  
  // Collapsible states
  const [isMapCollapsed, setIsMapCollapsed] = useState(false);
  const [isSearchRadiusCollapsed, setIsSearchRadiusCollapsed] = useState(true);
  const [isLocationSearchCollapsed, setIsLocationSearchCollapsed] = useState(true);
  const [isAutocompleteFocused, setIsAutocompleteFocused] = useState(false);
  const [isRadiusFocused, setIsRadiusFocused] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [manualMapControl, setManualMapControl] = useState(false);
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollY = useRef(0);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
    version: "beta", // Added beta channel for mapMode and PlaceAutocompleteElement styling
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
    if (selectedLat != null && selectedLng != null && 
        typeof selectedLat === 'number' && typeof selectedLng === 'number' && 
        !isNaN(selectedLat) && !isNaN(selectedLng)) {
      return { lat: selectedLat, lng: selectedLng };
    }
    return defaultMapCenter;
  }, [selectedLat, selectedLng]);

  // Calculate zoom level based on radius to ensure entire circle is visible
  const calculateZoomForRadius = useCallback((radiusKm: number) => {
    if (!radiusKm || radiusKm === 0) return 12;
    
    // Approximate zoom levels for different radius sizes
    // These values ensure the entire circle fits in the viewport
    if (radiusKm <= 1) return 14;
    if (radiusKm <= 2) return 13;
    if (radiusKm <= 5) return 12;
    if (radiusKm <= 10) return 11;
    if (radiusKm <= 20) return 10;
    if (radiusKm <= 30) return 9;
    if (radiusKm <= 50) return 8;
    return 7; // For very large radius
  }, []);

  const mapZoom = useMemo(() => {
    if (selectedLat != null && selectedLng != null && watchedSearchRadius) {
      return calculateZoomForRadius(watchedSearchRadius);
    }
    return selectedLat != null && selectedLng != null ? 12 : 5;
  }, [selectedLat, selectedLng, watchedSearchRadius, calculateZoomForRadius]);

  const mapOptions = useMemo(() => ({
    ...mapThemeOptions, // Spread existing theme options
    mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID',
    clickableIcons: true, // New option from plan
    scrollwheel: true,    // New option from plan
    // Dynamically set mapMode
    // @ts-ignore mapMode might not be in standard MapOptions type yet
    mapMode: isLoaded ? getPreferredMapMode() : undefined, // Call only if API is loaded
  }), [isLoaded]); // Recompute if isLoaded changes

 // Function to detect user location when requested
  const detectUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation Not Supported", description: "Your browser doesn't support location detection.", variant: "destructive", duration: 5000 });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        form.setValue('selectedLocationLat', latitude, { shouldValidate: true });
        form.setValue('selectedLocationLng', longitude, { shouldValidate: true });
        if (mapRef.current) mapRef.current.panTo({ lat: latitude, lng: longitude });

        if (window.google && window.google.maps && window.google.maps.Geocoder) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
              form.setValue('locationQuery', results[0].formatted_address, { shouldValidate: true });
              toast({ title: "Location Detected", description: "Your current location has been set.", variant: "default", duration: 3000 });
            } else {
              form.setValue('locationQuery', `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, { shouldValidate: true });
              toast({ title: "Location Detected", description: "Your coordinates have been set.", variant: "default", duration: 3000 });
            }
          });
        } else {
          form.setValue('locationQuery', `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, { shouldValidate: true });
          toast({ title: "Location Detected", description: "Your coordinates have been set.", variant: "default", duration: 3000 });
        }
      },
      (error) => {
        toast({ title: "Location Access Denied", description: "Please grant location permission or enter location manually.", variant: "destructive", duration: 5000 });
        console.warn("Geolocation error:", error.message);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }, [form, toast]);

  // Handle scroll events to collapse/expand map with debouncing
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollPosition = scrollContainerRef.current.scrollTop;
        setScrollY(scrollPosition);
        
        // Detect scroll direction
        const scrollingUp = scrollPosition < lastScrollY.current;
        setIsScrollingUp(scrollingUp);
        lastScrollY.current = scrollPosition;
        
        // Only auto-collapse if user hasn't manually controlled the map
        if (!manualMapControl) {
          // Clear any existing timeout to implement debouncing
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
          }
          
          // Set a new timeout to collapse/expand after scrolling stops
          scrollTimeoutRef.current = setTimeout(() => {
            // Auto-collapse map when scrolling down past threshold
            // But don't expand when scrolling up to prevent unwanted rendering
            if (scrollPosition > 50 && !isMapCollapsed) {
              setIsMapCollapsed(true);
            } else if (scrollPosition <= 50 && isMapCollapsed && !scrollingUp) {
              setIsMapCollapsed(false);
            }
          }, 150); // 150ms debounce delay
        }
      }
    };
    
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
        // Clear timeout on cleanup
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, [isMapCollapsed, manualMapControl]);

  // Handle place selection from autocomplete
  const handlePlaceSelect = (place: any) => {
    console.log('handlePlaceSelect called with:', place);
    
    const lat = typeof place.geometry.location.lat === 'function' 
      ? place.geometry.location.lat() 
      : place.geometry.location.lat;
    const lng = typeof place.geometry.location.lng === 'function' 
      ? place.geometry.location.lng() 
      : place.geometry.location.lng;
    
    console.log('Extracted coordinates:', { lat, lng });
    
    // Update form values
    form.setValue('locationQuery', place.name || place.formatted_address || '', { shouldValidate: true });
    form.setValue('selectedLocationLat', lat, { shouldValidate: true });
    form.setValue('selectedLocationLng', lng, { shouldValidate: true });
    
    console.log('Form values updated');
    
    // Pan map to location
    if (mapRef.current) {
      console.log('Panning map to:', { lat, lng });
      mapRef.current.panTo({ lat, lng });
      mapRef.current.setZoom(15);
    } else {
      console.log('mapRef.current is null');
    }
    
    // Auto-collapse the search after selection and show area selector
    console.log('Collapsing search interface');
    setIsLocationSearchCollapsed(true);
    setIsAutocompleteFocused(false);
    
    // Automatically open the search radius selector
    setTimeout(() => {
      setIsSearchRadiusCollapsed(false);
      setIsRadiusFocused(true);
    }, 300); // Small delay to allow search interface to close first
  };

  // Effect to update mapMode when system theme changes
  useEffect(() => {
    if (!isLoaded || !mapRef.current || typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (mapRef.current) {
        const newMode = getPreferredMapMode();
        if (newMode !== undefined) { // Ensure mode is valid before setting
            // @ts-ignore mapMode might not be in standard MapOptions type yet
            mapRef.current.setOptions({ mapMode: newMode });
        }
      }
    };

    handleChange(); // Set initial mode based on current preference
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [isLoaded]);

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
        <div className="flex-1 overflow-y-auto">
          <LimitGuard 
            type="plan-creation"
            onLimitReached={() => {
              toast({
                title: 'Plan Limit Reached',
                description: 'You have reached your maximum number of plans. Please delete some existing plans or upgrade your account.',
                variant: 'destructive',
              });
            }}
          >
            <PlanForm 
              initialData={generatedPlan} 
              onSubmit={handleSaveGeneratedPlan} 
              isSubmitting={isGenerating} 
              formMode="create"
              formTitle="Review & Edit Your AI Plan" 
              onBackToAICriteria={() => setGeneratedPlan(null)}
            />
          </LimitGuard>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="shrink-0 flex items-center justify-between p-4 border-b border-border/20 bg-background/95 backdrop-blur-md z-20">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back" className="hover:bg-accent/50">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center justify-center">
          <div className="flex items-center">
            <div
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors relative cursor-pointer",
                "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-full"
              )}
            >
              <Sparkles className="w-4 h-4 mr-2 inline" />
              AI Generated
            </div>
            <div
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors relative cursor-pointer",
                "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => router.push('/plans/create')}
            >
              Manual
            </div>
          </div>
        </div>
        
        <div className="w-10 h-10"></div>
      </header>
      
      <LimitGuard 
        type="plan-creation"
        onLimitReached={() => {
          toast({
            title: 'Plan Limit Reached',
            description: 'You have reached your maximum number of plans. Please delete some existing plans or upgrade your account.',
            variant: 'destructive',
          });
        }}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleGeneratePlan)} className="flex flex-col flex-1 overflow-hidden">
          
          {/* Area Selector Section */}
          <div className={cn(
            "relative transition-all duration-500 ease-in-out overflow-hidden border border-border/20 shadow-sm rounded-xl",
            isMapCollapsed ? "h-20" : "h-96 md:h-[500px]"
          )}>
            {isMapCollapsed ? (
              /* Collapsed State - Area Info Pills */
              <div className="h-full flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <div className="flex items-center gap-2">
                    {/* Location Pill */}
                    <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium border border-primary/20">
                      {selectedLat && selectedLng ? (
                        getCompactLocation(form.watch('locationQuery')) || 'Location Selected'
                      ) : (
                        'No Location'
                      )}
                    </div>
                    {/* Radius Pill */}
                    <div className="bg-secondary/50 text-secondary-foreground px-3 py-1.5 rounded-full text-sm font-medium border border-border/30">
                      {(form.watch('searchRadius') ?? 0) === 0 ? 'Broad' : `${form.watch('searchRadius')} km`}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsMapCollapsed(false);
                    setManualMapControl(true);
                    setTimeout(() => setManualMapControl(false), 5000);
                  }}
                  className="h-8 px-2"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              /* Expanded State - Full Map with Floating Controls */
              <>
                {/* Map Container */}
                <div className="w-full h-full bg-muted">
                  {isLoaded ? (
                    <GoogleMap 
                      mapContainerClassName="w-full flex-grow h-full" // Changed from mapContainerStyle as per plan
                      center={mapCenter} // Kept original mapCenter
                      zoom={mapZoom} // Dynamic zoom based on radius
                      options={mapOptions} // Use new mapOptions from useMemo
                      onClick={(e) => {
                        // Check if radius selector is open and prevent accidental pin drops
                        if (!isSearchRadiusCollapsed && isRadiusFocused) {
                          // Only collapse the radius selector, don't drop a pin
                          setIsSearchRadiusCollapsed(true);
                          setIsRadiusFocused(false);
                          return;
                        }
                        
                        onMapClick(e);
                        // Collapse floating buttons when clicking on map
                        setIsLocationSearchCollapsed(true);
                        setIsSearchRadiusCollapsed(true);
                        setIsAutocompleteFocused(false);
                        setIsRadiusFocused(false);
                      }} 
                      onLoad={onMapLoad}
                    >
                      {selectedLat != null && selectedLng != null && 
                         typeof selectedLat === 'number' && typeof selectedLng === 'number' && 
                         !isNaN(selectedLat) && !isNaN(selectedLng) && (
                        <>
                          <AdvancedMarker position={{ lat: selectedLat, lng: selectedLng }} map={mapRef.current} />
                          {watchedSearchRadius != null && watchedSearchRadius > 0 && 
                           typeof selectedLat === 'number' && typeof selectedLng === 'number' && 
                           !isNaN(selectedLat) && !isNaN(selectedLng) && (
                            <CircleF 
                              center={{ lat: selectedLat, lng: selectedLng }} 
                              radius={watchedSearchRadius * 1000} 
                              options={{ 
                                strokeColor: 'hsl(var(--primary))', 
                                strokeOpacity: 0.6, 
                                strokeWeight: 1, 
                                fillColor: 'hsl(var(--primary))', 
                                fillOpacity: 0.15 
                              }}
                            />
                          )}
                        </>
                      )}
                    </GoogleMap>
                  ) : loadError ? (
                    <div className="flex items-center justify-center h-full text-destructive text-xs p-2 text-center">
                      Could not load map. Check API key & console.
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  )}
                </div>
                
                {/* Floating Search and Location Buttons */}
                <div className="absolute top-4 left-4 z-20 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => {
                      setIsLocationSearchCollapsed(!isLocationSearchCollapsed);
                      // Auto-focus the input when opening the search
                      if (isLocationSearchCollapsed) {
                        setTimeout(() => {
                          const input = document.querySelector('[data-search-element] input') as HTMLInputElement;
                          if (input) {
                            input.focus();
                          }
                        }, 100);
                      }
                    }}
                    className={cn(
                      "w-12 h-12 rounded-full shadow-lg border-2 transition-all duration-300",
                      !isLocationSearchCollapsed ? "bg-primary text-primary-foreground border-primary scale-110" : "bg-background border-border hover:border-primary/50 hover:scale-105",
                      (isAutocompleteFocused || isRadiusFocused) && "opacity-0 pointer-events-none scale-95"
                    )}
                  >
                    <SearchIcon className="w-5 h-5" />
                  </Button>
                  
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={detectUserLocation}
                    disabled={!isLoaded}
                    className={cn(
                      "w-12 h-12 rounded-full shadow-lg border-2 transition-all duration-300 bg-background border-border hover:border-primary/50 disabled:opacity-50",
                      (isAutocompleteFocused || isRadiusFocused) && "opacity-0 pointer-events-none"
                    )}
                    title="Detect my location"
                  >
                    <Target className="w-5 h-5" />
                  </Button>
                  
                  {/* Expandable Search Bar */}
                      {!isLocationSearchCollapsed && (
                        <div
                          className={cn(
                            "absolute top-0 left-0 bg-black/80 backdrop-blur-md border border-gray-600/50 rounded-2xl shadow-2xl transition-all duration-300 flex items-center gap-3 p-3",
                            "w-96 min-w-96 h-16" // Fixed width to prevent squishing
                          )} 
                          onClick={(e) => e.stopPropagation()}
                          data-search-element
                        >
                          {/* Search Icon */}
                          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-800/60 flex-shrink-0">
                            <SearchIcon className="w-5 h-5 text-gray-300" />
                          </div>
                          
                          {/* Search Input Container */}
                          <div className="flex-1 flex items-center" data-search-element>
                            <PlaceAutocomplete
                              value={searchValue}
                              onInputChange={setSearchValue}
                              onPlaceSelect={handlePlaceSelect}
                              onFocus={() => setIsAutocompleteFocused(true)}
                              onBlur={() => setIsAutocompleteFocused(false)}
                              placeholder="Search for places, addresses..."
                              className="w-full"
                              locationBias={selectedLat && selectedLng ? {
                                center: { lat: selectedLat, lng: selectedLng },
                                radius: 50000
                              } : undefined}
                              requestedRegion="US"
                              isGoogleMapsApiLoaded={isLoaded}
                            />
                          </div>
                          

                        </div>
                      )}
                </div>
                
                {/* Floating Radius Button */}
                <div className="absolute top-4 right-4 z-20" onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => {
                      setIsSearchRadiusCollapsed(!isSearchRadiusCollapsed);
                      // Set focus state to hide other buttons when opening
                      if (isSearchRadiusCollapsed) {
                        setIsRadiusFocused(true);
                      }
                    }}
                    className={cn(
                      "w-12 h-12 rounded-full shadow-lg border-2 transition-all duration-300 text-xs font-bold",
                      !isSearchRadiusCollapsed ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50",
                      (isAutocompleteFocused || isRadiusFocused) && "opacity-0 pointer-events-none"
                    )}
                  >
                    {(form.watch('searchRadius') ?? 0) === 0 ? 'B' : `${form.watch('searchRadius')}`}
                  </Button>
                  
                  {/* Expandable Radius Slider */}
                  {!isSearchRadiusCollapsed && isRadiusFocused && (
                    <div 
                      className="fixed top-24 md:top-52 left-1/2 -translate-x-1/2 w-96 bg-background/80 backdrop-blur-lg rounded-full shadow-2xl drop-shadow-xl border border-border/30 p-4 z-30" 
                      onClick={(e) => e.stopPropagation()}
                      data-radius-element
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium whitespace-nowrap">Radius:</span>
                        <FormField
                          control={form.control}
                          name="searchRadius"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Slider 
                                  value={[field.value ?? 0]} 
                                  onValueChange={(value) => field.onChange(value[0] === 0 ? null : value[0])} 
                                  min={0} max={50} step={2} 
                                  disabled={!selectedLat || !selectedLng} 
                                  className="[&>span:first-child]:h-3 [&>span>span]:h-3 [&>button]:h-8 [&>button]:w-8 [&>button]:border-2 [&>button]:shadow-md [&>button]:touch-manipulation py-2"
                                  data-radius-element
                                  onBlur={(event) => {
                                    // Use setTimeout to allow for potential interaction with close button
                                    setTimeout(() => {
                                      const activeElement = document.activeElement;
                                      const radiusContainer = event.currentTarget?.closest('[data-radius-element]');
                                      
                                      if (!radiusContainer?.contains(activeElement) && !activeElement?.closest('[data-radius-element]')) {
                                        setIsSearchRadiusCollapsed(true);
                                        setIsRadiusFocused(false);
                                      }
                                    }, 150);
                                  }}
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        <span className="text-sm font-semibold text-primary whitespace-nowrap">
                          {(form.watch('searchRadius') ?? 0) === 0 ? 'Broad' : `${form.watch('searchRadius')} km`}
                        </span>

                      </div>
                    </div>
                  )}
                </div>
                
                {/* Validate Button */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                  <Button
                    type="button"
                    onClick={() => {
                      if (selectedLat && selectedLng) {
                        setIsMapCollapsed(true);
                        setIsLocationSearchCollapsed(true);
                        setIsSearchRadiusCollapsed(true);
                        setIsAutocompleteFocused(false);
                        setIsRadiusFocused(false);
                        setManualMapControl(true);
                        setTimeout(() => setManualMapControl(false), 5000);
                      }
                    }}
                    disabled={!selectedLat || !selectedLng}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-full shadow-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Validate Area
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Step Explanation when Map is Expanded */}
          {!isMapCollapsed && (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <MapPin className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Where's the next adventure</h3>
                 <p className="text-sm text-muted-foreground leading-relaxed">
                   Pick your playground! Search or tap anywhere on the map, set how far you're willing to explore, then let our AI work its magic with everyone's preferences to craft the perfect plan.
                 </p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                   <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">1</span>
                   <span>Pick Your Spot</span>
                   <ChevronRight className="w-4 h-4" />
                   <span className="w-6 h-6 bg-muted text-muted-foreground rounded-full flex items-center justify-center font-bold">2</span>
                   <span>AI Magic Time</span>
                 </div>
              </div>
            </div>
          )}

          {/* Form Fields - Only visible when map is collapsed */}
          {isMapCollapsed && (
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar-vertical">
              {/* Header Section */}
              <div className="text-center space-y-3 pb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground mb-1">Customize Your Plan</h2>
                  <p className="text-sm text-muted-foreground">Tell us your preferences and let AI create the perfect experience</p>
                </div>
              </div>

              {/* Form Cards Grid */}
              <div className="space-y-5">
                {/* Date & Time and Friends Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Date & Time Card */}
                  <div className="group bg-card/80 backdrop-blur-sm border border-border/40 rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                    <FormField
                      control={form.control}
                      name="planDateTime"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-sm font-semibold text-foreground flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                              <Clock className="w-4 h-4 text-primary" />
                            </div>
                            Date & Time
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant={'outline'} className={cn('w-full justify-start text-left font-medium h-11 rounded-xl border-border/40 hover:border-primary/40 hover:bg-accent/50 transition-all duration-200', !field.value && 'text-muted-foreground')}>
                                  <CalendarIcon className="mr-3 h-4 w-4 text-primary" />
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
                              <div className="p-3 border-t border-border/30">
                                <Input type="time" 
                                  defaultValue={field.value && isDateValid(field.value) ? format(field.value, 'HH:mm') : format(defaultDateTime, 'HH:mm')} 
                                  onChange={(e) => { 
                                      const [hours, minutes] = e.target.value.split(':').map(Number); 
                                      const newDate = new Date(field.value && isDateValid(field.value) ? field.value : defaultDateTime); 
                                      if (isDateValid(newDate)) { 
                                          newDate.setHours(hours, minutes); 
                                          field.onChange(newDate); 
                                      } 
                                  }} className="h-9 rounded-lg" />
                              </div>
                            </PopoverContent>
                          </Popover>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Friends Card */}
                  <div className="group bg-card/80 backdrop-blur-sm border border-border/40 rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                          <Users className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-sm font-semibold text-foreground">Friends</span>
                      </div>
                      <FriendMultiSelectInput 
                        control={form.control} 
                        name="invitedParticipantUserIds" 
                        label="" 
                        description="AI will consider their preferences!" 
                        compact={true}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Price Range and Plan Type Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Price Range Card */}
                  <div className="group bg-card/80 backdrop-blur-sm border border-border/40 rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                    <FormField
                      control={form.control}
                      name="priceRange"
                      render={({ field }) => {
                        const priceIndex = priceRangeOptions.findIndex(option => option.value === field.value);
                        const currentIndex = priceIndex === -1 ? 0 : priceIndex;
                        
                        return (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-sm font-semibold text-foreground flex items-center gap-2.5">
                              <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                                <DollarSign className="w-4 h-4 text-primary" />
                              </div>
                              Price Range
                            </FormLabel>
                            <div className="space-y-3">
                              <FormControl>
                                <Slider
                                  value={[currentIndex]}
                                  onValueChange={(value) => {
                                    const selectedOption = priceRangeOptions[value[0]];
                                    field.onChange(selectedOption.value === '' ? null : selectedOption.value as PriceRangeType);
                                  }}
                                  min={0}
                                  max={priceRangeOptions.length - 1}
                                  step={1}
                                  className="[&>span:first-child]:h-3 [&>span>span]:h-3 [&>button]:h-8 [&>button]:w-8 [&>button]:border-2 [&>button]:shadow-md [&>button]:bg-primary [&>button]:border-primary [&>button]:touch-manipulation py-3"
                                />
                              </FormControl>
                              {/* Notch Labels */}
                              <div className="flex justify-between text-xs text-muted-foreground px-1">
                                {priceRangeOptions.map((option, index) => {
                                  // Show simplified labels: Any, Free, then just dollar signs
                                  let displayLabel = option.label;
                                  if (option.value === '$') displayLabel = '$';
                                  else if (option.value === '$$') displayLabel = '$$';
                                  else if (option.value === '$$$') displayLabel = '$$$';
                                  else if (option.value === '$$$$') displayLabel = '$$$$';
                                  
                                  return (
                                    <span 
                                      key={option.value} 
                                      className={cn(
                                        "transition-colors duration-200 text-center flex-1",
                                        index === currentIndex ? "text-primary font-medium" : "hover:text-foreground"
                                      )}
                                    >
                                      {displayLabel}
                                    </span>
                                  );
                                })}
                              </div>
                              {/* Current Selection Display */}
                              <div className="text-center">
                                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20">
                                  {priceRangeOptions[currentIndex].label}
                                </span>
                              </div>
                            </div>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                  
                  {/* Plan Type Card */}
                  <div className="group bg-card/80 backdrop-blur-sm border border-border/40 rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                    <FormField
                      control={form.control}
                      name="planTypeHint"
                      render={({ field }) => {
                        const typeIndex = planTypeHintOptions.findIndex(option => option.value === field.value);
                        const currentIndex = typeIndex === -1 ? 0 : typeIndex;
                        
                        return (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-sm font-semibold text-foreground flex items-center gap-2.5">
                              <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                                <Target className="w-4 h-4 text-primary" />
                              </div>
                              Plan Type
                            </FormLabel>
                            <div className="space-y-3">
                              <FormControl>
                                <Slider
                                  value={[currentIndex]}
                                  onValueChange={(value) => {
                                    const selectedOption = planTypeHintOptions[value[0]];
                                    field.onChange(selectedOption.value as 'ai-decide' | PlanTypeHintTypeAlias);
                                  }}
                                  min={0}
                                  max={planTypeHintOptions.length - 1}
                                  step={1}
                                  className="[&>span:first-child]:h-3 [&>span>span]:h-3 [&>button]:h-8 [&>button]:w-8 [&>button]:border-2 [&>button]:shadow-md [&>button]:bg-primary [&>button]:border-primary [&>button]:touch-manipulation py-3"
                                />
                              </FormControl>
                              {/* Notch Labels */}
                              <div className="flex justify-between text-xs text-muted-foreground px-1">
                                {planTypeHintOptions.map((option, index) => (
                                  <span 
                                    key={option.value} 
                                    className={cn(
                                      "transition-colors duration-200 text-center flex-1",
                                      index === currentIndex ? "text-primary font-medium" : "hover:text-foreground"
                                    )}
                                  >
                                    {option.label}
                                  </span>
                                ))}
                              </div>
                              {/* Current Selection Display */}
                              <div className="text-center">
                                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20">
                                  {planTypeHintOptions[currentIndex].label}
                                </span>
                              </div>
                            </div>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                </div>

                {/* User Prompt Card */}
                <div className="group bg-card/80 backdrop-blur-sm border border-border/40 rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                  <FormField
                    control={form.control}
                    name="userPrompt"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-sm font-semibold text-foreground flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                            <MessageSquare className="w-4 h-4 text-primary" />
                          </div>
                          Tell AI what you want to do (Optional)
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., I want to explore local coffee shops and art galleries, then have dinner at a romantic restaurant..."
                            className="min-h-[100px] resize-none bg-background/40 border-border/40 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 rounded-xl transition-all text-sm leading-relaxed"
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs text-muted-foreground leading-relaxed">
                          Describe your ideal plan and AI will create something amazing!
                        </FormDescription>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit Button - Only visible when map is collapsed */}
          {isMapCollapsed && (
            <div className="p-6 border-t border-border/20 bg-gradient-to-t from-background/80 to-transparent">
              <div className="space-y-4">
                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <div className="w-6 h-6 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold">
                    <CheckCircle className="w-3 h-3" />
                  </div>
                  <span>Area Selected</span>
                  <ChevronRight className="w-3 h-3" />
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <span className="font-medium text-foreground">Ready to Generate</span>
                </div>
                
                <Button 
                  type="submit" 
                  disabled={isGenerating || (!isLoaded && !!googleMapsApiKey && !loadError) || (!form.formState.isValid && form.formState.isSubmitted)} 
                  className="w-full h-14 text-base font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 hover:from-amber-300 hover:via-orange-400 hover:to-pink-400 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl text-white border-0 relative overflow-hidden group transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-300/30 via-orange-300/30 to-pink-300/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    {isGenerating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Creating your perfect plan...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                          <Sparkles className="w-5 h-5 animate-pulse" />
                        </div>
                        <span>Generate Plan with AI</span>
                      </>
                    )}
                  </div>
                </Button>
                
                {/* Helper text */}
                <p className="text-xs text-center text-muted-foreground leading-relaxed">
                  Our AI will analyze your preferences, location, and friends' interests to create the perfect plan
                </p>
              </div>
            </div>
          )}
          </form>
        </Form>
      </LimitGuard>
    </div>
  );
}

