
'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GoogleMap, useJsApiLoader, CircleF } from '@react-google-maps/api';
import { format } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronDown, ChevronRight, SearchIcon, Target, CheckCircle, MapPin, Clock, Users, DollarSign, MessageSquare, Sparkles, Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from 'next-themes';
import { generatePlanWithAIAction, createPlanAction } from '@/app/actions/planActions';
import type { PlanFormValues } from '@/components/plans/PlanForm';
import { PlanForm } from '@/components/plans/PlanForm';
import { PlaceAutocomplete } from '@/components/ui/place-autocomplete';
import { FriendMultiSelectInput } from '@/components/plans/FriendMultiSelectInput';
import { LimitGuard } from '@/components/limits/LimitGuard';
import { type PriceRangeType, type PlanTypeType as PlanTypeHintTypeAlias } from '@/types/user';
import { type Plan } from '@/types/plan';
import { z } from 'zod';

// Plan Generation Form Schema
const PlanGenerationFormSchema = z.object({
  planDateTime: z.date(),
  searchRadius: z.number().nullable(),
  priceRange: z.enum(['$', '$$', '$$$', '$$$$', 'Free']).nullable(),
  planTypeHint: z.enum(['ai-decide', 'single-stop', 'multi-stop']).default('ai-decide'),
  userPrompt: z.string().default(''),
  invitedParticipantUserIds: z.array(z.string()).default([]),
  locationQuery: z.string().default(''),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

type PlanGenerationFormData = z.infer<typeof PlanGenerationFormSchema>;

// Advanced Marker component
const AdvancedMarker = ({ position, map }: { position: { lat: number; lng: number }; map: google.maps.Map | null }) => {
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  useEffect(() => {
    if (!map || !window.google?.maps?.marker?.AdvancedMarkerElement) return;

    if (markerRef.current) {
      markerRef.current.position = position;
    } else {
      markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        position,
        map,
      });
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.map = null;
      }
    };
  }, [position, map]);

  return null;
};

// Options for form fields
const priceRangeOptions = [
  { value: '', label: 'Any Budget' },
  { value: 'Free', label: 'Free Activities' },
  { value: '$', label: 'Budget ($)' },
  { value: '$$', label: 'Moderate ($$)' },
  { value: '$$$', label: 'Upscale ($$$)' },
  { value: '$$$$', label: 'Luxury ($$$$)' },
];

const planTypeHintOptions = [
  { value: 'ai-decide', label: 'AI Decide' },
  { value: 'single-stop', label: 'Single Stop' },
  { value: 'multi-stop', label: 'Multi-Stop' },
];

// Helper functions
const isDateValid = (date: any): date is Date => {
  return date instanceof Date && !isNaN(date.getTime());
};

const getPreferredMapMode = (theme: string | undefined) => {
  return theme === 'dark' ? 'dark' : 'light';
};

// Types
type MapMode = 'light' | 'dark';

// Map styling and default options
const mapStyles = {
  light: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ],
  dark: [
    { elementType: 'geometry', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
    { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
    { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { featureType: 'poi.park', elementType: 'labels.text.stroke', stylers: [{ color: '#1b1b1b' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
    { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
    { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
  ]
};

const defaultMapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  gestureHandling: 'greedy' as const,
};

// Default date/time calculation
const getDefaultDateTime = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);
  return tomorrow;
};

const defaultDateTime = getDefaultDateTime();

// Google Maps libraries
const libraries: ('places' | 'marker' | 'geocoding')[] = ['places', 'geocoding', 'marker'];

export default function GeneratePlanPage() {
  // State variables
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<Plan | null>(null);
  const [isMapCollapsed, setIsMapCollapsed] = useState(false);
  const [isLocationSearchCollapsed, setIsLocationSearchCollapsed] = useState(true);
  const [isSearchRadiusCollapsed, setIsSearchRadiusCollapsed] = useState(true);
  const [isAutocompleteFocused, setIsAutocompleteFocused] = useState(false);
  const [isRadiusFocused, setIsRadiusFocused] = useState(false);
  const [manualMapControl, setManualMapControl] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [mapMode, setMapMode] = useState<MapMode>('light');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isMapPopupOpen, setIsMapPopupOpen] = useState(false);

  // Refs
  const locationInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Hooks
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();

  // Scroll handling logic removed - map control is now only via buttons

  // API key loading
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey || '',
    libraries,
    version: 'beta',
    mapIds: ['crossand-plans-map'],
  });

  // Form setup
  const form = useForm<PlanGenerationFormData>({
    resolver: zodResolver(PlanGenerationFormSchema),
    defaultValues: {
      planDateTime: defaultDateTime,
      searchRadius: 2,
      priceRange: null,
      planTypeHint: 'ai-decide',
      userPrompt: '',
      invitedParticipantUserIds: [],
      locationQuery: '',
      latitude: null,
      longitude: null,
    },
  });

  // Watch form values for map centering and zoom
  const watchedLat = form.watch('latitude');
  const watchedLng = form.watch('longitude');
  const watchedSearchRadius = form.watch('searchRadius');
  const selectedLat = watchedLat;
  const selectedLng = watchedLng;

  // Memoized map center
  const mapCenter = useMemo(() => {
    if (selectedLat != null && selectedLng != null && 
        typeof selectedLat === 'number' && typeof selectedLng === 'number' && 
        !isNaN(selectedLat) && !isNaN(selectedLng)) {
      return { lat: selectedLat, lng: selectedLng };
    }
    return { lat: 40.7128, lng: -74.0060 };
  }, [selectedLat, selectedLng]);

  // Function to calculate zoom based on radius
  const calculateZoomFromRadius = useCallback((radius: number | null) => {
    if (!radius || radius === 0) return 13;
    if (radius <= 2) return 15;
    if (radius <= 5) return 14;
    if (radius <= 10) return 13;
    if (radius <= 20) return 12;
    if (radius <= 50) return 11;
    return 10;
  }, []);

  const mapZoom = useMemo(() => {
    return calculateZoomFromRadius(watchedSearchRadius);
  }, [watchedSearchRadius, calculateZoomFromRadius]);

  // Auto-zoom function to fit radius area
  const fitRadiusInView = useCallback(() => {
    if (!mapRef.current || !selectedLat || !selectedLng || !watchedSearchRadius) {
      return;
    }

    const center = new google.maps.LatLng(selectedLat, selectedLng);
    const radiusInMeters = watchedSearchRadius * 1000;
    
    // Calculate bounds that encompass the circle with more generous padding
    const bounds = new google.maps.LatLngBounds();
    
    // Add points at the cardinal directions of the circle
    const earthRadius = 6371000; // Earth's radius in meters
    const latOffset = (radiusInMeters / earthRadius) * (180 / Math.PI);
    const lngOffset = (radiusInMeters / earthRadius) * (180 / Math.PI) / Math.cos(selectedLat * Math.PI / 180);
    
    bounds.extend(new google.maps.LatLng(selectedLat + latOffset, selectedLng));
    bounds.extend(new google.maps.LatLng(selectedLat - latOffset, selectedLng));
    bounds.extend(new google.maps.LatLng(selectedLat, selectedLng + lngOffset));
    bounds.extend(new google.maps.LatLng(selectedLat, selectedLng - lngOffset));
    
    // Always use fitBounds to ensure the map adjusts to every radius change
    mapRef.current.fitBounds(bounds, {
      top: 100,
      bottom: 100,
      left: 100,
      right: 100
    });
  }, [selectedLat, selectedLng, watchedSearchRadius]);

  // Effect to auto-zoom when radius or location changes with minimal debouncing for responsiveness
  useEffect(() => {
    if (mapRef.current && selectedLat && selectedLng && watchedSearchRadius && watchedSearchRadius !== null) {
      // Minimal debounce for responsive zoom changes
      const timeoutId = setTimeout(() => {
        fitRadiusInView();
      }, 50); // Reduced delay for more responsive interactions
      
      return () => clearTimeout(timeoutId);
    }
  }, [selectedLat, selectedLng, watchedSearchRadius, fitRadiusInView]);

  // Memoized map options
  const mapOptions = useMemo(() => ({
    ...defaultMapOptions,
    mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'crossand-plans-map',
    styles: mapStyles[mapMode],
  }), [mapMode]);

  // Function to detect user location
  const detectUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation not supported',
        description: 'Your browser does not support geolocation.',
        variant: 'destructive',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          const geocoder = new google.maps.Geocoder();
          const result = await geocoder.geocode({
            location: { lat: latitude, lng: longitude }
          });
          
          if (result.results && result.results.length > 0) {
            const address = result.results[0].formatted_address;
            form.setValue('locationQuery', address);
            setSearchValue(address);
          }
          
          form.setValue('latitude', latitude);
          form.setValue('longitude', longitude);
          
          if (mapRef.current) {
            mapRef.current.panTo({ lat: latitude, lng: longitude });
          }
          
          toast({
            title: 'Location detected',
            description: 'Your current location has been set.',
          });
        } catch (error) {
          console.error('Geocoding error:', error);
          form.setValue('latitude', latitude);
          form.setValue('longitude', longitude);
          
          if (mapRef.current) {
            mapRef.current.panTo({ lat: latitude, lng: longitude });
          }
          
          toast({
            title: 'Location detected',
            description: 'Your current location has been set.',
          });
        }
      },
      (error) => {
        let errorMessage = 'Please allow location access or search for a location manually.';
        let errorTitle = 'Location access denied';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorTitle = 'Location access denied';
            errorMessage = 'Please allow location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorTitle = 'Location unavailable';
            errorMessage = 'Your location information is unavailable. Please search for a location manually.';
            break;
          case error.TIMEOUT:
            errorTitle = 'Location timeout';
            errorMessage = 'Location request timed out. Please try again or search manually.';
            break;
          default:
            errorTitle = 'Location error';
            errorMessage = 'Unable to retrieve your location. Please search for a location manually.';
            break;
        }
        
        console.error('Geolocation error:', {
          code: error.code,
          message: error.message
        });
        
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: 'destructive',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }, [form]);

  // Function to handle place selection from autocomplete
  const handlePlaceSelect = useCallback((place: { place_id: string; formatted_address: string; name: string; geometry: { location: { lat: number; lng: number; }; }; }) => {
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat;
      const lng = place.geometry.location.lng;
      
      form.setValue('latitude', lat);
      form.setValue('longitude', lng);
      form.setValue('locationQuery', place.formatted_address || place.name || '');
      form.setValue('searchRadius', 2); // Always set radius to 2km when selecting from autocomplete
      setSearchValue(place.formatted_address || place.name || '');
      
      if (mapRef.current) {
        mapRef.current.panTo({ lat, lng });
      }
    }
  }, [form]);

  // Effect to update map mode based on theme
  useEffect(() => {
    setMapMode(getPreferredMapMode(theme));
  }, [theme]);

  // Map event handlers
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    
    // Auto-zoom to fit radius area when map loads
    if (selectedLat && selectedLng && watchedSearchRadius && watchedSearchRadius > 0) {
      setTimeout(() => {
        fitRadiusInView();
      }, 200);
    }
  }, [selectedLat, selectedLng, watchedSearchRadius, fitRadiusInView]);

  const onMapClick = useCallback(async (event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      
      form.setValue('latitude', lat);
      form.setValue('longitude', lng);
      
      try {
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ location: { lat, lng } });
        
        if (result.results && result.results.length > 0) {
          const address = result.results[0].formatted_address;
          form.setValue('locationQuery', address);
          setSearchValue(address);
        }
      } catch (error) {
        console.error('Reverse geocoding error:', error);
      }
    }
  }, [form]);

  // Form submission handlers
  const handleGeneratePlan = async (data: PlanGenerationFormData) => {
    if (!user?.uid) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to generate a plan.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const authToken = await user.getIdToken();
      const clientInput = {
        hostUid: user.uid,
        planDateTime: data.planDateTime.toISOString(),
        locationQuery: data.locationQuery,
        selectedLocationLat: data.latitude,
        selectedLocationLng: data.longitude,
        searchRadius: data.searchRadius,
        priceRange: data.priceRange,
        planTypeHint: data.planTypeHint,
        userPrompt: data.userPrompt,
        invitedParticipantUserIds: data.invitedParticipantUserIds,
      };
      const result = await generatePlanWithAIAction(clientInput, authToken);
      
      if (result.success && result.plan) {
        setGeneratedPlan(result.plan);
        toast({
          title: 'Plan generated successfully!',
          description: 'Review your AI-generated plan and make any adjustments.',
        });
      } else {
        throw new Error(result.error || 'Failed to generate plan');
      }
    } catch (error) {
      console.error('Error generating plan:', error);
      toast({
        title: 'Failed to generate plan',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveGeneratedPlan = async (planData: PlanFormValues) => {
    if (!user?.uid) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to save the plan.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const authToken = await user.getIdToken();
      const result = await createPlanAction(planData as PlanFormValues, authToken);
      
      if (result.success) {
        toast({
          title: 'Plan saved successfully!',
          description: 'Your plan has been saved and you can view it in your plans.',
        });
        router.push('/plans');
      } else {
        throw new Error(result.error || 'Failed to save plan');
      }
    } catch (error) {
      console.error('Error saving plan:', error);
      toast({
        title: 'Failed to save plan',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Early return for generated plan view
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

  // Main component render
  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between p-4 border-b border-border/20 bg-background/70 backdrop-blur-md z-20">
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
      
      {/* Main Content */}
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
              "relative transition-all duration-500 ease-in-out overflow-hidden border border-border/20 shadow-sm rounded-xl mx-4 md:mx-0",
              isMapCollapsed ? "h-20" : "h-96 md:h-[500px]"
            )}>
              {isMapCollapsed ? (
                /* Collapsed State - Area Info Pills */
                <div className="h-full flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-primary" />
                    <div className="flex items-center gap-2">
                      {/* Location Pill */}
                      <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium border border-primary/20 max-w-[200px] sm:max-w-none truncate">
                        {selectedLat && selectedLng ? (
                          form.watch('locationQuery') || 'Location Selected'
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
                        mapContainerClassName="w-full flex-grow h-full"
                        center={mapCenter}
                        zoom={mapZoom}
                        options={mapOptions}
                        onClick={(e) => {
                          // If any map popup is open, close them but don't interact with the map
                          if (isMapPopupOpen || !isLocationSearchCollapsed || (!isSearchRadiusCollapsed && isRadiusFocused)) {
                            setIsLocationSearchCollapsed(true);
                            setIsSearchRadiusCollapsed(true);
                            setIsAutocompleteFocused(false);
                            setIsRadiusFocused(false);
                            setIsMapPopupOpen(false);
                            return;
                          }
                          
                          // Only allow map interaction when no popups are open
                          onMapClick(e);
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
                  
                  {/* Unified Floating Interface */}
                  <div className="absolute inset-2 z-20 pointer-events-none transition-opacity duration-300">
                    {/* Top Center: All Control Buttons */}
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 pointer-events-auto">
                      {/* Horizontal Button Container - Hide when popup is open */}
                      <div className={cn(
                        "flex items-center gap-3 transition-all duration-500 ease-out transform",
                        isMapPopupOpen ? "opacity-0 pointer-events-none scale-95 -translate-y-2" : "opacity-100 scale-100 translate-y-0"
                      )}>
                        {/* Search Toggle Button */}
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={() => {
                            setIsLocationSearchCollapsed(false);
                            setIsSearchRadiusCollapsed(true);
                            setIsMapPopupOpen(true);
                            setTimeout(() => {
                              const input = document.querySelector('[data-search-element] input') as HTMLInputElement;
                              if (input) {
                                input.focus();
                              }
                            }, 100);
                          }}
                          className={cn(
                            "w-12 h-12 rounded-full shadow-lg border-2 transition-all duration-500 ease-out transform",
                            !isLocationSearchCollapsed 
                              ? "bg-primary text-primary-foreground border-primary scale-110 rotate-180" 
                              : "bg-background border-border hover:border-primary/50 hover:scale-105 hover:rotate-12"
                          )}
                        >
                          <SearchIcon className="w-5 h-5" />
                        </Button>
                        
                        {/* Location Detection Button */}
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={detectUserLocation}
                          disabled={!isLoaded}
                          className={cn(
                            "w-12 h-12 rounded-full shadow-lg border-2 transition-all duration-500 ease-out transform",
                            "bg-background border-border hover:border-primary/50 disabled:opacity-50 hover:scale-105 hover:rotate-12 active:scale-95"
                          )}
                          title="Detect my location"
                        >
                          <Target className="w-5 h-5" />
                        </Button>
                        
                        {/* Radius Button */}
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={() => {
                            setIsSearchRadiusCollapsed(false);
                            setIsLocationSearchCollapsed(true);
                            setIsRadiusFocused(true);
                            setIsMapPopupOpen(true);
                          }}
                          className={cn(
                            "w-12 h-12 rounded-full shadow-lg border-2 transition-all duration-500 ease-out transform text-xs font-bold",
                            !isSearchRadiusCollapsed 
                              ? "bg-primary text-primary-foreground border-primary scale-110 rotate-180" 
                              : "bg-background border-border hover:border-primary/50 hover:scale-105 hover:rotate-12"
                          )}
                        >
                          {form.watch('searchRadius') === null ? 'B' : `${form.watch('searchRadius')}`}
                        </Button>
                      </div>
                      
                      {/* Expandable Search Bar */}
                      {!isLocationSearchCollapsed && (
                        <div
                          className={cn(
                            "absolute top-0 left-1/2 transform -translate-x-1/2",
                            "bg-black/80 backdrop-blur-md border border-gray-600/50 rounded-2xl shadow-2xl",
                            "transition-all duration-500 ease-out flex items-center gap-3 p-3",
                            "w-[28rem] h-12 min-w-0 max-w-[calc(100vw-4rem)]",
                            "animate-in slide-in-from-top-2 fade-in-0"
                          )}
                          onClick={(e) => e.stopPropagation()}
                          data-search-element
                        >
                          <div className="flex-1 min-w-0" data-search-element>
                            <PlaceAutocomplete
                              value={searchValue}
                              onInputChange={setSearchValue}
                              onPlaceSelect={handlePlaceSelect}
                              onFocus={() => {
                                setIsAutocompleteFocused(true);
                              }}
                              onBlur={() => {
                                setIsAutocompleteFocused(false);
                              }}
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
                      
                      {/* Expandable Radius Slider */}
                      {!isSearchRadiusCollapsed && isRadiusFocused && (
                        <div 
                          className={cn(
                            "absolute top-0 left-1/2 transform -translate-x-1/2 w-[28rem] bg-background/90 backdrop-blur-lg rounded-2xl shadow-2xl",
                            "border border-border/50 p-4 z-30 min-w-0 max-w-[calc(100vw-4rem)]",
                            "transition-all duration-500 ease-out animate-in slide-in-from-top-2 fade-in-0"
                          )}
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
                                      value={[field.value ?? 52]} 
                                      onValueChange={(value) => field.onChange(value[0] === 52 ? null : value[0])} 
                                      min={2} max={52} step={2} 
                                      disabled={!selectedLat || !selectedLng} 
                                      className="[&>span:first-child]:h-3 [&>span>span]:h-3 [&>button]:h-8 [&>button]:w-8 [&>button]:border-2 [&>button]:shadow-md [&>button]:touch-manipulation py-2"
                                      data-radius-element
                                      onBlur={(event) => {
                                        setTimeout(() => {
                                          const activeElement = document.activeElement;
                                          const radiusContainer = event.currentTarget?.closest('[data-radius-element]');
                                          
                                          if (!radiusContainer?.contains(activeElement) && !activeElement?.closest('[data-radius-element]')) {
                                            setIsSearchRadiusCollapsed(true);
                                            setIsRadiusFocused(false);
                                            setIsMapPopupOpen(false);
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
                              {form.watch('searchRadius') === null ? 'Broad' : `${form.watch('searchRadius')} km`}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    

                  </div>
                </>
              )}
            </div>

            {/* Validate Area Section - Always visible when map is expanded */}
            {!isMapCollapsed && (
              <div className="mx-4 md:mx-0 mt-6">
                <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-2xl p-6 space-y-4">
                  {/* Progress Indicator */}
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                    <span className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-bold",
                      selectedLat && selectedLng 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground"
                    )}>1</span>
                    <span className={cn(
                      "font-medium",
                      selectedLat && selectedLng ? "text-foreground" : "text-muted-foreground"
                    )}>Pick Your Spot</span>
                    <ChevronRight className="w-4 h-4" />
                    <span className="w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center font-bold">2</span>
                    <span>AI Magic Time</span>
                  </div>
                  
                  {/* Description */}
                  <div className="text-center space-y-2">
                    {selectedLat && selectedLng ? (
                      <>
                        <h3 className="text-lg font-semibold text-foreground">Perfect! Your area is selected</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                          We've identified your location and search radius. Ready to let AI create an amazing plan for this area?
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-lg font-semibold text-foreground">Choose Your Location</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                          Search for a location above, click on the map, or use the location button to detect your current position. Then adjust the radius to set your exploration area.
                        </p>
                      </>
                    )}
                  </div>
                  
                  {/* Validate Button */}
                  <div className="flex justify-center pt-2">
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
                        }
                      }}
                      disabled={!selectedLat || !selectedLng}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-full shadow-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      {selectedLat && selectedLng ? "Validate Area & Continue" : "Select Location First"}
                    </Button>
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
                  
                  {/* Back to Map Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsMapCollapsed(false);
                      setManualMapControl(false);
                    }}
                    className="mt-3 text-xs border-border/50 hover:border-primary/50 hover:bg-primary/5"
                  >
                    <MapPin className="w-3 h-3 mr-1" />
                    Adjust Location
                  </Button>
                </div>

                {/* Form Cards Grid */}
                <div className="space-y-5">
                  {/* Date & Time and Friends Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Date & Time Card */}
                    <div className="group bg-card/60 backdrop-blur-sm border border-border/40 rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
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
                            <Popover onOpenChange={(open) => setIsPopupOpen(open)}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant={'outline'} className={cn('w-full justify-start text-left font-medium h-11 rounded-xl border-border/40 hover:border-primary/40 hover:bg-accent/50 transition-all duration-200', !field.value && 'text-muted-foreground')}>
                                    <CalendarIcon className="mr-3 h-4 w-4 text-primary" />
                                     {field.value && isDateValid(field.value) ? format(field.value, 'MMM d, p') : <span>Pick date & time</span>}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 mx-auto" align="center">
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
                    <div className="group bg-card/60 backdrop-blur-sm border border-border/40 rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
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
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Price Range and Plan Type Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Price Range Card */}
                    <div className="group bg-card/60 backdrop-blur-sm border border-border/40 rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
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
                  <div className="group bg-card/60 backdrop-blur-sm border border-border/40 rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
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

                  {/* Special Requests Card */}
                <div className="group bg-card/60 backdrop-blur-sm border border-border/40 rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
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
