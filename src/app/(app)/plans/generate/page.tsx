'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GoogleMap, useJsApiLoader, CircleF } from '@react-google-maps/api';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronDown, ChevronUp, ChevronRight, SearchIcon, Target, Check, CheckCircle, MapPin, Clock, Users, DollarSign, MessageSquare, ArrowLeft, Sparkles, Loader2, X, Edit, Pencil, RefreshCw, Plus, Settings2, UserPlus, Navigation } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from 'next-themes';
import { generatePlanWithAIAction, generateDeepPlanWithAIAction, createPlanAction } from '@/app/actions/planActions';
import type { PlanFormValues } from '@/components/plans/PlanForm';
import { PlanForm } from '@/components/plans/PlanForm';
import { ItineraryItemPreviewCard } from '@/components/plans/ItineraryItemPreviewCard';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { PlaceAutocomplete } from '@/components/ui/place-autocomplete';
import { FriendMultiSelectInput } from '@/components/plans/FriendMultiSelectInput';
import { LimitGuard } from '@/components/limits/LimitGuard';
import { type PriceRangeType, type PlanTypeType as PlanTypeHintTypeAlias } from '@/types/user';
import { type Plan } from '@/types/plan';
import type { UserProfile } from '@/types/user';
import { getUsersProfiles } from '@/services/clientServices';
import { z } from 'zod';

// Plan Generation Form Schema
const PlanGenerationFormSchema = z.object({
  planDateTime: z.date(),
  searchRadius: z.number().nullable(),
  priceRange: z.enum(['$', '$$', '$$$', '$$$$', 'Free'] as const).nullable(),
  planTypeHint: z.enum(['ai-decide', 'single-stop', 'multi-stop']).default('ai-decide'),
  userPrompt: z.string().default(''),
  invitedParticipantUserIds: z.array(z.string()).default([]),
  locationQuery: z.string().min(3, { message: 'Location is required' }),
  latitude: z.number().min(-90).max(90),  // Required latitude
  longitude: z.number().min(-180).max(180),  // Required longitude
  useDeepPlanner: z.boolean().default(false),
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
  { value: null, label: 'Any Budget' },
  { value: 'Free', label: 'Free Activities' },
  { value: '$', label: 'Budget ($)' },
  { value: '$$', label: 'Moderate ($$)' },
  { value: '$$$', label: 'Upscale ($$$)' },
  { value: '$$$$', label: 'Luxury ($$$$)' },
] as const;

const planTypeHintOptions = [
  { value: 'ai-decide', label: 'AI Decide', description: 'Let AI choose based on context' },
  { value: 'single-stop', label: 'Single Stop', description: 'One main destination' },
  { value: 'multi-stop', label: 'Multi-Stop', description: 'Multiple destinations' },
] as const;

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

// Generate a random welcome message with emojis
const WELCOME_MESSAGES = [
  "What kind of adventure are we planning today? Share some details and we'll craft something amazing! 🚀",
  "Ready to create some memories? Tell us what you're in the mood for and we'll handle the rest! ✨",
  "Let's plan something special! Share your ideas and we'll make it unforgettable. 💫",
  "What's on your mind? We're all ears and ready to plan your perfect experience! 🎯",
  "Feeling spontaneous? Share a few details and let's create something wonderful together! 🌟"
] as const;

// Get a random welcome message (moved outside component to avoid recreation)
const getRandomWelcomeMessage = () => {
  return WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
};

// Generate greeting based on time of day
const getGreetingForHour = (hour: number, name: string) => {
  const firstName = name?.split(' ')[0] || 'there';
  if (hour < 12) return `Good morning, ${firstName}! 🌞`;
  if (hour < 18) return `Good afternoon, ${firstName}! 🌤️`;
  return `Good evening, ${firstName}! 🌙`;
};

function GeneratePlanPage() {
  // State variables
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<Plan | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const loadingMessages = [
    'Gathering the best spots just for you... 🗺️',
    'Checking the weather for the perfect day out... ☀️',
    'Consulting local experts for hidden gems... 🕵️‍♂️',
    'Finding activities that match your unique style... ✨',
    'Adding a sprinkle of magic to your plan... ✨',
    'Double-checking all the details for you... ✅',
    'Almost there! Just putting the finishing touches... 🎯',
  ];
  const [showFriendSelector, setShowFriendSelector] = useState(false);
  const [showPriceRangeSelector, setShowPriceRangeSelector] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [useDeepPlanner, setUseDeepPlanner] = useState(false);
  const friendSelectorRef = useRef<HTMLDivElement>(null);
  const friendButtonRef = useRef<HTMLButtonElement>(null);
  const priceRangeButtonRef = useRef<HTMLButtonElement>(null);
  const priceRangeSelectorRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  // Handle click outside for popups
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if we're clicking inside the date picker
      const isDatePickerElement = target.closest('.react-datepicker') !== null;
      
      // Handle friend selector
      if (
        showFriendSelector && 
        friendSelectorRef.current && 
        !friendSelectorRef.current.contains(target) &&
        friendButtonRef.current && 
        !friendButtonRef.current.contains(target) &&
        !isDatePickerElement &&
        !(priceRangeButtonRef.current?.contains(target) || priceRangeSelectorRef.current?.contains(target))
      ) {
        setShowFriendSelector(false);
      }

      // Handle price range selector
      if (
        showPriceRangeSelector &&
        priceRangeSelectorRef.current &&
        !priceRangeSelectorRef.current.contains(target) &&
        priceRangeButtonRef.current &&
        !priceRangeButtonRef.current.contains(target) &&
        !isDatePickerElement &&
        !(friendButtonRef.current?.contains(target) || friendSelectorRef.current?.contains(target))
      ) {
        setShowPriceRangeSelector(false);
      }

      // Stops selector has been removed
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      // Ensure we restore body scroll when component unmounts
      document.body.style.overflow = '';
    };
  }, [showFriendSelector, showPriceRangeSelector]);
  
  // State declarations
  const [showAllStops, setShowAllStops] = useState(false);
  const [visibleStopIndex, setVisibleStopIndex] = useState(0);
  const [isFooterVisible, setIsFooterVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [invitedProfiles, setInvitedProfiles] = useState<UserProfile[]>([]);
  
  // Map related state
  const [isMapCollapsed, setIsMapCollapsed] = useState(true); // Set to true to collapse map by default
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isLocationSearchCollapsed, setIsLocationSearchCollapsed] = useState(true);
  const [isSearchRadiusCollapsed, setIsSearchRadiusCollapsed] = useState(true);
  const [isAutocompleteFocused, setIsAutocompleteFocused] = useState(false);
  const [isRadiusFocused, setIsRadiusFocused] = useState(false);
  const [manualMapControl, setManualMapControl] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>('light');
  const [isMapPopupOpen, setIsMapPopupOpen] = useState(false);
  
  // Other UI state
  const [showEditForm, setShowEditForm] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  // Handle body scroll when map is toggled
  useEffect(() => {
    if (isMapCollapsed) {
      document.body.style.overflow = '';
    } else {
      document.body.style.overflow = 'hidden';
    }
  }, [isMapCollapsed]);

  // Fetch invited participant profiles whenever a plan is generated
  useEffect(() => {
    async function fetchProfiles() {
      if (!generatedPlan?.invitedParticipantUserIds?.length) {
        setInvitedProfiles([]);
        return;
      }
      try {
        const profiles = await getUsersProfiles(generatedPlan.invitedParticipantUserIds);
        setInvitedProfiles(profiles);
      } catch (err) {
        console.error('Failed to load invited participant profiles', err);
      }
    }
    fetchProfiles();
  }, [generatedPlan]);

  // Refs
  const locationInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Hooks
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { theme } = useTheme();
  
  // Memoize greeting and welcome message to prevent regeneration on every render
  const { greeting, welcomeMessage } = useMemo(() => {
    const hour = new Date().getHours();
    const firstName = currentUser?.displayName?.split(' ')[0] || 'there';
    
    return {
      greeting: getGreetingForHour(hour, currentUser?.displayName || ''),
      welcomeMessage: getRandomWelcomeMessage()
    };
  }, [currentUser?.displayName]); // Only regenerate when user's display name changes

  useEffect(() => {
    if (!scrollContainerRef.current || !generatedPlan) return;

    // Ensure the refs array is the correct size for the current itinerary
    itemRefs.current = itemRefs.current.slice(0, generatedPlan.itinerary.length);

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const index = itemRefs.current.findIndex(ref => ref === entry.target);
                    if (index !== -1) {
                        setVisibleStopIndex(index);
                        return; // Exit after finding the first visible item from the top
                    }
                }
            }
        },
        {
            root: scrollContainerRef.current,
            rootMargin: '-40% 0px -40% 0px', // Triggers when an item is in the middle 20% of the viewport
            threshold: 0,
        }
    );

    const currentRefs = itemRefs.current.filter(ref => ref);
    currentRefs.forEach((ref) => {
        if (ref) observer.observe(ref);
    });

    return () => {
      currentRefs.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, [generatedPlan, showAllStops]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < 50) {
        setIsFooterVisible(true);
      } else {
        // On scroll up, we let the mouse leave event handle hiding
      }
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => container.removeEventListener('scroll', handleScroll);
  }, [generatedPlan]);

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
      searchRadius: null,
      priceRange: null,
      planTypeHint: 'ai-decide',
      userPrompt: '',
      invitedParticipantUserIds: [],
      locationQuery: '',
      latitude: 0,
      longitude: 0,
      useDeepPlanner: false,
    },
    mode: 'onChange',
  });

  // Watch the useDeepPlanner field and sync it with state
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'useDeepPlanner') {
        setUseDeepPlanner(value.useDeepPlanner || false);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Update form when toggle changes
  useEffect(() => {
    form.setValue('useDeepPlanner', useDeepPlanner, { shouldDirty: true, shouldTouch: true });
  }, [useDeepPlanner, form]);

  // Get user's current location and set it as default
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const geocoder = new google.maps.Geocoder();
            const result = await geocoder.geocode({
              location: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              }
            });

            if (result.results && result.results.length > 0) {
              const address = result.results[0].formatted_address;
              form.reset({
                ...form.getValues(),
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                searchRadius: 2, // Set to 2km
                locationQuery: address,
              });
            } else {
              throw new Error('No address found');
            }
          } catch (error) {
            console.error('Error getting address:', error);
            // Fallback to coordinates if geocoding fails
            form.reset({
              ...form.getValues(),
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              searchRadius: 2,
              locationQuery: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
            });
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          // Set default values if location access is denied
          form.reset({
            ...form.getValues(),
            searchRadius: 2, // Still set to 2km
          });
        }
      );
    } else {
      // Browser doesn't support geolocation
      form.reset({
        ...form.getValues(),
        searchRadius: 2, // Still set to 2km
      });
    }
  }, [form]);

  // Watch form values for map centering and zoom
  const watchedLat = form.watch('latitude');
  const watchedLng = form.watch('longitude');
  const watchedSearchRadius = form.watch('searchRadius');
  const selectedLat = watchedLat;
  const selectedLng = watchedLng;
  const invitedIds = form.watch('invitedParticipantUserIds') || [];
  const totalParticipants = 1 + invitedIds.length;

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

    setIsDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          let locationName = `Location ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          
          try {
            const geocoder = new google.maps.Geocoder();
            const result = await geocoder.geocode({
              location: { lat: latitude, lng: longitude }
            });
            
            if (result.results && result.results.length > 0) {
              // Try to get the best address representation
              const results = result.results;
              
              // Priority: establishment -> street_address -> neighborhood -> locality
              const establishment = results.find(r => r.types.includes('establishment'));
              const streetAddress = results.find(r => r.types.includes('street_address'));
              const neighborhood = results.find(r => r.types.includes('neighborhood'));
              const locality = results.find(r => r.types.includes('locality'));
              
              let bestResult = establishment || streetAddress || neighborhood || locality || results[0];
              locationName = bestResult.formatted_address;
              
              // If we have a very generic result, try to enhance it
              if (!establishment && !streetAddress) {
                // Extract city/neighborhood components for a better fallback
                const cityComponent = bestResult.address_components?.find(c => 
                  c.types.includes('locality') || 
                  c.types.includes('sublocality') ||
                  c.types.includes('neighborhood')
                );
                const stateComponent = bestResult.address_components?.find(c => 
                  c.types.includes('administrative_area_level_1')
                );
                
                if (cityComponent && stateComponent) {
                  locationName = `${cityComponent.long_name}, ${stateComponent.short_name}`;
                } else if (cityComponent) {
                  locationName = cityComponent.long_name;
                }
              }
              
              console.log('🗺️ Reverse geocoded location:', locationName);
            } else {
              console.warn('No geocoding results found, using coordinates');
            }
            
            form.setValue('locationQuery', locationName);
            setSearchValue(locationName);
            
          } catch (error) {
            console.error('Geocoding error:', error);
            // Fallback: create a descriptive location name using coordinates
            locationName = `Latitude ${latitude.toFixed(4)}, Longitude ${longitude.toFixed(4)}`;
            form.setValue('locationQuery', locationName);
            setSearchValue(locationName);
          }
          
          // Always set coordinates
            form.setValue('latitude', latitude);
            form.setValue('longitude', longitude);
            
            if (mapRef.current) {
              mapRef.current.panTo({ lat: latitude, lng: longitude });
            }
            
            toast({
              title: 'Location detected',
            description: `Set to: ${locationName}`,
            });
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        setIsDetectingLocation(false);
        
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
    if (!currentUser?.uid) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to generate a plan.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setLoadingMessage(loadingMessages[0]);
    
    try {
      // Ensure we have valid coordinates
      if (!data.latitude || !data.longitude) {
        throw new Error('Location coordinates are required');
      }

      const result = await (data.useDeepPlanner ? generateDeepPlanWithAIAction : generatePlanWithAIAction)(
        {
          ...data,
          planDateTime: format(data.planDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          hostUid: currentUser.uid,
          selectedLocationLat: data.latitude,
          selectedLocationLng: data.longitude,
        },
        await currentUser.getIdToken()
      );
      
      if (result.success && result.plan) {
        // Ensure all fields are preserved
        const plan = {
          ...result.plan,
          itinerary: result.plan.itinerary.map(item => ({
            ...item,
            description: item.description || null,
            activitySuggestions: item.activitySuggestions || [],
            tagline: item.tagline || null,
            noiseLevel: item.noiseLevel || null,
            transitTimeFromPreviousMinutes: item.transitTimeFromPreviousMinutes || null,
            googlePlaceId: item.googlePlaceId || null,
            googleMapsImageUrl: item.googleMapsImageUrl || null,
            googlePhotoReference: item.googlePhotoReference || null,
            rating: item.rating || null,
            reviewCount: item.reviewCount || null,
            openingHours: item.openingHours || null,
            phoneNumber: item.phoneNumber || null,
            website: item.website || null,
            priceLevel: item.priceLevel || null,
            types: item.types || null,
            transitMode: item.transitMode || 'driving'
          }))
        };
        setGeneratedPlan(plan);
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
      setIsLoading(false);
    }
  };

  const handleSaveGeneratedPlan = async (planData: PlanFormValues) => {
    if (!currentUser?.uid) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to save the plan.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const authToken = await currentUser.getIdToken();
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
    // If showEditForm is true, show the edit form
    if (showEditForm) {
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
                formTitle="Customize Your AI-Generated Plan" 
                onBackToAICriteria={() => setShowEditForm(false)}
              />
            </LimitGuard>
          </div>
        </div>
      );
    }

    // Otherwise show the preview
    return (
      <div className="flex flex-col h-screen bg-background text-foreground">
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto flex flex-col items-stretch">
          <div className="w-full h-full flex flex-col">
            {/* Plan Preview Card */}
            <div
              className="p-6 flex flex-col relative max-w-screen-sm w-full mx-auto"
              onMouseEnter={() => setIsFooterVisible(true)}
              onMouseLeave={() => {
                const container = scrollContainerRef.current;
                if (container) {
                  const { scrollTop, scrollHeight, clientHeight } = container;
                  if (scrollHeight - scrollTop - clientHeight >= 50) {
                    setIsFooterVisible(false);
                  }
                }
              }}
            >
              <div className="mb-2">
                <span className="inline-block bg-primary/10 text-primary px-3 py-1.5 rounded-full text-base font-semibold">AI Plan Preview</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {generatedPlan.name}
              </h2>
              {generatedPlan.description && (
                <div className="mb-6 max-w-prose">
                  <p className="text-muted-foreground text-sm">
                    {isDescriptionExpanded ? (
                      <>{generatedPlan.description} <button onClick={() => setIsDescriptionExpanded(false)} className="text-primary hover:underline font-medium">Read less</button></>
                    ) : (
                      <>
                        {generatedPlan.description.length > 120
                          ? `${generatedPlan.description.substring(0, 120).trim()}... `
                          : generatedPlan.description}
                        {generatedPlan.description.length > 120 && (
                          <button 
                            onClick={() => setIsDescriptionExpanded(true)}
                            className="text-primary hover:underline font-medium"
                          >
                            Read more
                          </button>
                        )}
                      </>
                    )}
                  </p>
                </div>
              )}
               {/* Participants Display */}
               <div className="mb-1">
                 <div className="flex items-center gap-4">
                   <div className="flex -space-x-2">
                     {/* Host Avatar */}
                     <Avatar className="h-10 w-10 ring-2 ring-background">
                       <AvatarImage src={currentUser?.photoURL || undefined} alt={currentUser?.displayName || 'You'} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {currentUser?.displayName?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      {/* Invited participants */}
                      {invitedProfiles.slice(0, 2).map((participant) => (
                        <Avatar key={participant.uid} className="h-10 w-10 ring-2 ring-primary/20">
                          {participant.avatarUrl ? (
                            <AvatarImage src={participant.avatarUrl} alt={participant.name || participant.username || 'User'} />
                          ) : null}
                          <AvatarFallback className="bg-muted text-muted-foreground">
                            {(participant.name || participant.username || 'U').charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {/* Additional count badge */}
                      {invitedProfiles.length > 2 && (
                        <Avatar className="h-10 w-10 ring-2 ring-primary/20 bg-muted">
                          <AvatarFallback className="text-xs font-medium text-muted-foreground">
                            +{invitedProfiles.length - 2}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    <div className="ml-4">
                      <p className="font-semibold leading-none">Participants</p>
                      <p className="text-xs text-muted-foreground">Including you</p>
                      </div>
                    </div>
                 </div>
               </div>
              <div className="mb-4">
                <div className="flex items-center justify-between px-4 mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">Itinerary</h3>
                    <div className="flex items-center gap-1.5">
                      {generatedPlan.itinerary.map((_, idx) => (
                        <div
                          key={`dot-${idx}`}
                          className={cn(
                            'h-2 rounded-full transition-all',
                            visibleStopIndex === idx ? 'w-4 bg-primary' : 'w-2 bg-muted'
                          )}
                        />
                      ))}
                      <div className="flex items-center justify-center bg-muted/50 rounded-full px-2 py-0.5 ml-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          {visibleStopIndex + 1}/{generatedPlan.itinerary.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div 
                  className="relative overflow-x-auto snap-x snap-mandatory scroll-smooth pb-6 hide-scrollbar"
                  style={{ 
                    WebkitOverflowScrolling: 'touch',
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none'
                  }}
                  onScroll={(e) => {
                    const container = e.currentTarget;
                    const scrollPosition = container.scrollLeft;
                    const itemWidth = container.scrollWidth / generatedPlan.itinerary.length;
                    const newIndex = Math.round(scrollPosition / itemWidth);
                    if (newIndex !== visibleStopIndex) {
                      setVisibleStopIndex(newIndex);
                    }
                  }}
                >
                  <div className="flex w-max min-w-full">
                    {generatedPlan.itinerary.map((item, idx) => (
                      <div 
                        key={item.id} 
                        className="w-screen flex-shrink-0 px-4 snap-start"
                        ref={el => {
                          if (el) {
                            itemRefs.current[idx] = el;
                          }
                        }}
                      >
                        <ItineraryItemPreviewCard 
                          item={item} 
                          index={idx} 
                          expanded={true} 
                          isActive={idx === visibleStopIndex}
                        />
                      </div>
                    ))}
                  </div>
                  
                  {/* Validate Playground Button - Bottom Center */}
                  {!isMapCollapsed && (
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50 pointer-events-auto">
                      <Button
                        type="button"
                        onClick={() => {
                          setIsMapCollapsed(true);
                          document.body.style.overflow = '';
                        }}
                        className={cn(
                          "bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-6 rounded-full shadow-lg",
                          "font-medium text-base transition-all duration-300 transform hover:scale-105",
                          "flex items-center gap-2"
                        )}
                      >
                        <CheckCircle className="w-5 h-5" />
                        Validate Playground
                      </Button>
                    </div>
                  )}
                </div>
                {generatedPlan.itinerary.length > 1 && (
                  <p className="text-center text-xs text-muted-foreground mt-2 px-4">
                    Swipe left/right to see other stops
                  </p>
                )}
              </div>

              {/* Overlay for FAB menu */}
              {isExpanded && (
                <div 
                  className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300"
                  onClick={() => setIsExpanded(false)}
                />
              )}

              {/* Floating Action Button */}
              <div className={cn(
                'fixed bottom-6 right-6 flex flex-col items-end space-y-3 transition-all duration-300 z-50',
                isFooterVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
              )}>
                {/* Additional Actions */}
                <div className={cn(
                  'flex flex-col items-end space-y-3 transition-all duration-300 origin-bottom-right',
                  isExpanded 
                    ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
                    : 'opacity-0 scale-95 translate-y-2 pointer-events-none',
                  'transform-gpu'
                )}>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      setShowEditForm(true);
                      setIsExpanded(false);
                    }}
                    className={cn(
                      'h-14 w-20 rounded-full p-0 justify-center transition-all duration-300 bg-background/90 backdrop-blur-sm',
                      'hover:bg-accent/80 hover:scale-105 hover:shadow-lg',
                      'border-2 border-border/40 hover:border-blue-400/50',
                      'group',
                      'min-w-[5rem]' // Ensure minimum width
                    )}
                  >
                    <>
                      <Pencil className="h-4 w-4 text-foreground/80 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                      <span className="text-xs font-medium text-foreground/70 group-hover:text-blue-600 transition-colors">
                        Edit
                      </span>
                    </>
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      const currentValues = form.getValues();
                      setGeneratedPlan(null);
                      setShowEditForm(false);
                      const timeOffset = 1000 * 60 * (5 + Math.floor(Math.random() * 25));
                      form.reset({
                        ...currentValues,
                        // Preserve all user settings for easier re-generation
                        userPrompt: currentValues.userPrompt,
                        planTypeHint: currentValues.planTypeHint,
                        searchRadius: currentValues.searchRadius,
                        priceRange: currentValues.priceRange,
                        invitedParticipantUserIds: currentValues.invitedParticipantUserIds,
                        locationQuery: currentValues.locationQuery,
                        latitude: currentValues.latitude,
                        longitude: currentValues.longitude,
                        useDeepPlanner: currentValues.useDeepPlanner,
                        // Only update the time to avoid conflicts
                        planDateTime: new Date(currentValues.planDateTime.getTime() + timeOffset),
                      });
                      setIsExpanded(false);
                    }}
                    className={cn(
                      'h-14 w-20 rounded-full p-0 justify-center transition-all duration-300 bg-background/90 backdrop-blur-sm',
                      'hover:bg-accent/80 hover:scale-105 hover:shadow-lg',
                      'border-2 border-border/40 hover:border-blue-400/50',
                      'group',
                      'min-w-[5rem]' // Ensure minimum width
                    )}
                  >
                    <>
                      <RefreshCw className="h-4 w-4 text-foreground/80 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                      <span className="text-xs font-medium text-foreground/70 group-hover:text-blue-600 transition-colors">
                        Refresh
                      </span>
                    </>
                  </Button>

                  <Button
                    size="lg"
                    disabled={isGenerating}
                    onClick={async () => {
                      const firstItem = generatedPlan.itinerary[0];
                      const avgPriceLevel = generatedPlan.itinerary.reduce((sum, itm) => sum + (itm.priceLevel ?? 0), 0) / (generatedPlan.itinerary.length || 1);
                      const priceRange = avgPriceLevel >= 3.5 ? '$$$$' : avgPriceLevel >= 2.5 ? '$$$' : avgPriceLevel >= 1.5 ? '$$' : '$';

                      const planData = {
                        ...generatedPlan,
                        status: 'published' as const,
                        planType: (generatedPlan.itinerary.length > 1 ? 'multi-stop' : 'single-stop') as 'single-stop' | 'multi-stop',
                        eventDateTime: firstItem?.startTime ? new Date(firstItem.startTime) : new Date(generatedPlan.eventTime),
                        primaryLocation: generatedPlan.primaryLocation ?? generatedPlan.location ?? firstItem?.address ?? firstItem?.placeName ?? "",
                        city: generatedPlan.city ?? firstItem?.city ?? "",
                        priceRange: generatedPlan.priceRange ?? priceRange,
                        itinerary: generatedPlan.itinerary.map(item => ({
                          ...item,
                          startTime: item.startTime ?? "",
                          googlePlaceId: item.googlePlaceId,
                          googleMapsImageUrl: item.googleMapsImageUrl,
                          googlePhotoReference: item.googlePhotoReference,
                          lat: item.lat,
                          lng: item.lng,
                          rating: item.rating,
                          reviewCount: item.reviewCount,
                          isOperational: item.isOperational,
                          statusText: item.statusText,
                          openingHours: item.openingHours || [],
                          phoneNumber: item.phoneNumber,
                          website: item.website,
                          priceLevel: item.priceLevel,
                          types: item.types || [],
                          photoUrl: (item as any).photoUrl
                        }))
                      };

                      await handleSaveGeneratedPlan(planData);
                      setIsExpanded(false);
                    }}
                    className={cn(
                      'h-12 w-auto px-4 rounded-full transition-all duration-300',
                      'bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
                      'hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20',
                      'group',
                      isGenerating ? 'opacity-70' : '',
                      'min-w-[6rem]', // Ensure minimum width
                      'flex items-center justify-center gap-2' // Center icon and text
                    )}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 text-white group-hover:scale-110 transition-transform flex-shrink-0" />
                        <span className="text-xs font-medium text-white/90 group-hover:text-white">
                          Publish
                        </span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Main FAB */}
                <Button
                  size="lg"
                  variant={isExpanded ? 'destructive' : 'default'}
                  className={cn(
                    'h-14 w-14 rounded-full transition-all duration-300',
                    'shadow-xl hover:shadow-2xl',
                    isHovered || isExpanded ? 'scale-110' : 'scale-100',
                    isExpanded ? 'rotate-180' : 'rotate-0',
                    'group',
                    'flex items-center justify-center',
                    isExpanded ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700' : 'bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                  )}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  onClick={() => {
                    setIsExpanded(!isExpanded);
                    // Ensure hover state is reset on click
                    setIsHovered(false);
                  }}
                >
                  {isExpanded || isHovered ? (
                    <X className="h-6 w-6 text-white transition-transform duration-300" />
                  ) : (
                    <Check className="h-6 w-6 text-white transition-transform duration-300" />
                  )}
                </Button>
              </div>
          </div>
        </div>
      </div>
    );
  }

  // Main component render
  return (
    <div className="flex flex-col h-screen bg-background text-foreground relative">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between p-4 border-b border-border/20 bg-background/70 backdrop-blur-md z-20">
        <Button variant="ghost" size="icon" onClick={() => router.push('/plans')} aria-label="Go to My Plans" className="hover:bg-accent/50">
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
              "relative transition-all duration-500 ease-in-out overflow-hidden border-border/20 shadow-sm",
              isMapCollapsed ? "h-20 mx-4 md:mx-0 border rounded-xl" : "fixed inset-0 z-40 h-screen w-screen"
            )}>
              {/* Close fullscreen button */}
              {!isMapCollapsed && (
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-4">
                  {/* Validate Button */}
                  <Button
                    type="button"
                    onClick={() => {
                      setIsMapCollapsed(true);
                      document.body.style.overflow = '';
                    }}
                    className={cn(
                      "bg-black hover:bg-gray-900 text-white px-6 py-3 rounded-full",
                      "font-semibold text-sm transition-all duration-300 transform hover:scale-105",
                      "flex items-center gap-2 border border-gray-900",
                      "dark:bg-black dark:hover:bg-gray-900 dark:text-white dark:border-gray-800",
                      "backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_6px_25px_rgba(0,0,0,0.4)]"
                    )}
                  >
                    <div className="bg-primary/10 p-1.5 rounded-full">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span>Validate Selection</span>
                  </Button>

                  {/* Close Button - Compact red close button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setIsMapCollapsed(true);
                      document.body.style.overflow = '';
                    }}
                    className={cn(
                      "h-10 w-10 rounded-full bg-red-600 hover:bg-red-700 text-white",
                      "border border-red-700 hover:border-red-800 transition-all duration-300",
                      "flex items-center justify-center hover:scale-105 active:scale-95",
                      "backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_6px_25px_rgba(0,0,0,0.4)]"
                    )}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
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
                      // Prevent body scroll when map is expanded
                      document.body.style.overflow = 'hidden';
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
                  
                  {/* Bottom Fade Effect */}
                  <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                  
                  {/* Unified Floating Interface */}
                  <div className="absolute inset-2 z-20 pointer-events-none transition-opacity duration-300">
                    {/* Top Center: All Control Buttons */}
                    <div className="absolute top-24 left-1/2 transform -translate-x-1/2 pointer-events-auto">
                      {/* Horizontal Button Container - Hide when popup is open */}
                      <div className={cn(
                        "flex items-center gap-3 transition-all duration-500 ease-out transform",
                        isMapPopupOpen ? "opacity-0 pointer-events-none scale-95 -translate-y-10" : "opacity-100 scale-100 translate-y-0"
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
                          disabled={!isLoaded || isDetectingLocation}
                          className={cn(
                            "w-12 h-12 rounded-full shadow-lg border-2 transition-all duration-500 ease-out transform",
                            "bg-background border-border hover:border-primary/50 disabled:opacity-50 hover:scale-105 hover:rotate-12 active:scale-95",
                            isDetectingLocation && "animate-pulse"
                          )}
                          title="Detect my location"
                        >
                          {isDetectingLocation ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Navigation className="w-5 h-5" />
                          )}
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
                            "absolute top-24 left-1/2 transform -translate-x-1/2 -translate-y-2",
                            "bg-black/80 backdrop-blur-md border border-gray-600/50 rounded-2xl shadow-2xl",
                            "transition-all duration-300 ease-out flex items-center gap-3 p-3",
                            "w-[28rem] h-12 min-w-0 max-w-[calc(100vw-4rem)]",
                            "animate-in slide-in-from-top-10 fade-in-0"
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
                            "absolute top-24 left-1/2 transform -translate-x-1/2 -translate-y-2 w-[28rem] bg-background/90 backdrop-blur-lg rounded-2xl shadow-2xl",
                            "border border-border/50 p-4 z-30 min-w-0 max-w-[calc(100vw-4rem)]",
                            "transition-all duration-300 ease-out animate-in slide-in-from-top-10 fade-in-0"
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
                {/* Header Section - Only show when no popups are open */}
                {!showFriendSelector && !showPriceRangeSelector && !isDatePickerOpen && (
                  <>
                    {isGenerating ? (
                      <div className="text-center space-y-4 pt-32 pb-4 px-4">
                        <div className="w-20 h-20 mx-auto rounded-2xl bg-background p-3 flex items-center justify-center border border-border/20 mb-2">
                          <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-primary" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <h2 className="text-xl font-bold text-foreground/90">Creating Your Perfect Plan</h2>
                          <p className="text-foreground/70 text-base">
                            {loadingMessage || 'Getting things ready...'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-4 pt-32 pb-4">
                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 rounded-2xl bg-background p-3 mb-4 flex items-center justify-center border border-border/20">
                            <img 
                              src="/images/crossand-logo.svg" 
                              alt="Crossand Logo" 
                              className="w-10 h-10"
                            />
                          </div>
                          <h1 className="text-3xl font-bold text-foreground/90 mb-1.5">
                            {greeting}
                          </h1>
                          <p className="text-foreground/70 text-base">
                            {welcomeMessage}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Friends Selector */}
                {showFriendSelector && (
                  <div 
                    ref={friendSelectorRef}
                    className="pb-4 transition-all duration-300 ease-in-out"
                  >
                    <FriendMultiSelectInput 
                      selectedUserIds={form.watch('invitedParticipantUserIds') || []}
                      onSelectedUserIdsChange={(ids) => form.setValue('invitedParticipantUserIds', ids)}
                      autoOpen={true}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Fixed Bottom Input Area */}
            <div className="sticky bottom-8 left-0 right-0 bg-background/90 backdrop-blur-sm pt-2 pb-4 px-4">
              <div className="max-w-3xl mx-auto relative">
                {/* Selection Pills */}
                <div className="absolute -top-10 left-0 z-40 flex items-center gap-2">
                  {/* Date Picker */}
                  <div className="relative">
                    {/* Hidden date input */}
                    <input
                      type="datetime-local"
                      ref={dateInputRef}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      min={new Date().toISOString().slice(0, 16)}
                      value={form.watch('planDateTime') ? format(form.watch('planDateTime'), "yyyy-MM-dd'T'HH:mm") : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          form.setValue('planDateTime', new Date(e.target.value));
                        }
                      }}
                    />
                    
                    {/* Custom button */}
                    <button
                      type="button"
                      onClick={() => dateInputRef.current?.showPicker()}
                      className="h-8 rounded-full bg-gray-800/50 text-gray-200 text-xs font-medium px-3 py-1.5 flex items-center gap-1.5 hover:bg-gray-700/50 transition-colors"
                    >
                      <CalendarIcon className="h-3.5 w-3.5" />
                      <span>{format(form.watch('planDateTime'), 'MMM d, h:mm a')}</span>
                    </button>
                  </div>

                  {/* Price Range Pill */}
                  {form.watch('priceRange') && (
                    <div className="h-8 rounded-full bg-gray-800/50 text-gray-200 text-xs font-medium px-3 py-1.5 flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>
                        {form.watch('priceRange') === 'Free' 
                          ? 'Free' 
                          : form.watch('priceRange')}
                      </span>
                    </div>
                  )}

                  {/* Stops Pill */}
                  <div className="h-8 rounded-full bg-gray-800/50 text-gray-200 text-xs font-medium px-3 py-1.5 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>
                      {form.watch('planTypeHint') === 'single-stop' 
                        ? '1 Stop' 
                        : form.watch('planTypeHint') === 'multi-stop' 
                          ? 'Multi-Stop' 
                          : 'AI Decides'}
                    </span>
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="userPrompt"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <FormControl>
                        <div className="relative">
                          <Textarea
                            placeholder="What would you like to do today?"
                            className="min-h-[60px] max-h-[200px] overflow-y-hidden hover:overflow-y-auto textarea-scrollbar bg-input border-2 border-border focus:border-2 focus:border-primary/80 focus:ring-2 focus:ring-primary/40 rounded-xl transition-all text-sm leading-relaxed px-4 pb-16 pt-4 text-foreground placeholder:text-muted-foreground w-full shadow-lg"
                            style={{
                              height: 'auto',
                              minHeight: '60px',
                              maxHeight: '200px',
                              resize: 'none',
                            }}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              const newHeight = Math.min(target.scrollHeight, 200);
                              target.style.height = newHeight + 'px';
                              
                              // Only show scrollbar when at max height
                              if (newHeight >= 200) {
                                target.classList.add('overflow-y-auto');
                                target.classList.remove('overflow-y-hidden');
                              } else {
                                target.classList.remove('overflow-y-auto');
                                target.classList.add('overflow-y-hidden');
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                form.handleSubmit(handleGeneratePlan)();
                              }
                            }}
                            {...field}
                          />
                          <div className="absolute left-2 bottom-3 flex gap-2">
                            <div className="relative">
                              <Button 
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg border border-border"
                                onClick={() => {
                                  dateInputRef.current?.showPicker();
                                  setShowFriendSelector(false);
                                  setShowPriceRangeSelector(false);
                                }}
                              >
                                <CalendarIcon className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="relative">
                              <Button 
                                ref={priceRangeButtonRef}
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg border border-border"
                                onClick={() => {
                                  setShowPriceRangeSelector(!showPriceRangeSelector);
                                  setShowFriendSelector(false);
                                }}
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                              
                              <div 
                                ref={priceRangeSelectorRef}
                                className={`absolute bottom-[calc(100%+9rem)] -left-10 w-96 bg-background border border-border rounded-lg shadow-lg p-4 z-50 transition-all duration-200 ease-out ${
                                  showPriceRangeSelector 
                                    ? 'opacity-100 translate-y-0' 
                                    : 'opacity-0 translate-y-2 pointer-events-none'
                                }`}
                              >
                                  <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm font-medium">Price Range</span>
                                      <button
                                        type="button"
                                        onClick={() => form.setValue('priceRange', null)}
                                        className={cn(
                                          "text-xs px-2 py-1 rounded-md transition-colors",
                                          form.getValues('priceRange') === null
                                            ? "bg-primary/10 text-primary" 
                                            : "text-muted-foreground hover:bg-accent"
                                        )}
                                      >
                                        Let AI decide
                                      </button>
                                    </div>
                                    <div className="px-2 space-y-2">
                                      <div className="relative w-full">
                                        <div className="relative">
                                          {/* Slider with transparent track */}
                                          <Slider
                                            value={[form.watch('priceRange') === null ? -1 : 
                                                   form.watch('priceRange') === 'Free' ? 0 : 
                                                   form.watch('priceRange') === '$' ? 1 :
                                                   form.watch('priceRange') === '$$' ? 2 : 3]}
                                            min={-1}
                                            max={3}
                                            step={1}
                                            onValueChange={(value) => {
                                              const priceMap = {
                                                '-1': null,
                                                '0': 'Free',
                                                '1': '$',
                                                '2': '$$',
                                                '3': '$$$'
                                              } as const;
                                              form.setValue('priceRange', priceMap[value[0].toString() as keyof typeof priceMap], { shouldDirty: true });
                                            }}
                                            className="relative z-10"
                                          />
                                          
                                          {/* Custom track with gradient */}
                                          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 pointer-events-none">
                                            <div className="w-full h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full" />
                                          </div>
                                        </div>
                                        
                                        {/* Tick marks */}
                                        <div className="relative h-5 mt-1">
                                          <div className="absolute inset-0 flex justify-between items-start px-1">
                                            {[-1, 0, 1, 2, 3].map((tick) => (
                                              <div 
                                                key={tick} 
                                                className="w-px h-2 bg-foreground/20"
                                              />
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex justify-between text-xs text-muted-foreground px-1">
                                        <span className={cn("text-center w-16", form.getValues('priceRange') === null && "font-bold text-foreground")}>AI Decides</span>
                                        <span className={cn("text-center w-16", form.getValues('priceRange') === 'Free' && "font-bold text-foreground")}>Free</span>
                                        <span className={cn("text-center w-16", form.getValues('priceRange') === '$' && "font-bold text-foreground")}>$</span>
                                        <span className={cn("text-center w-16", form.getValues('priceRange') === '$$' && "font-bold text-foreground")}>$$</span>
                                        <span className={cn("text-center w-16", form.getValues('priceRange') === '$$$' && "font-bold text-foreground")}>$$$</span>
                                      </div>
                                    </div>
                                    {form.getValues('priceRange') !== null && (
                                      <div className="text-xs text-muted-foreground text-center">
                                        {form.getValues('priceRange') === 'Free' ? "Free activities only" :
                                         form.getValues('priceRange') === '$' ? "Budget-friendly options" :
                                         form.getValues('priceRange') === '$$' ? "Moderate pricing" :
                                         form.getValues('priceRange') === '$$$' ? "Premium experiences" : ''}
                                      </div>
                                    )}
                                  </div>
                              </div>
                            </div>
                            <Button 
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg border border-border",
                                form.watch('planTypeHint') && form.watch('planTypeHint') !== 'ai-decide' && "text-amber-400"
                              )}
                              onClick={() => {
                                const currentType = form.watch('planTypeHint');
                                let newValue;
                                
                                if (!currentType || currentType === 'ai-decide') {
                                  newValue = 'single-stop';
                                } else if (currentType === 'single-stop') {
                                  newValue = 'multi-stop';
                                } else {
                                  newValue = ''; // Empty string for AI decide
                                }
                                
                                form.setValue('planTypeHint', newValue as any);
                                
                                const toastMessage = !newValue 
                                  ? 'AI will decide the number of stops' 
                                  : `Plan type set to ${newValue === 'single-stop' ? 'Single Stop' : 'Multi-Stop'}`;
                                  
                                toast({
                                  title: toastMessage,
                                  variant: 'default',
                                });
                              }}
                              title={form.watch('planTypeHint') === 'single-stop' 
                                ? 'Switch to Multi-Stop' 
                                : form.watch('planTypeHint') === 'multi-stop'
                                  ? 'Let AI decide (clear selection)'
                                  : 'Switch to Single Stop'}
                            >
                              {!form.watch('planTypeHint') || form.watch('planTypeHint') === 'ai-decide' 
                                ? 'AI' 
                                : form.watch('planTypeHint') === 'single-stop' 
                                  ? '1' 
                                  : '2+'}
                            </Button>
                            <Button 
                              ref={friendButtonRef}
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg border border-border",
                                showFriendSelector && "bg-accent text-foreground"
                              )}
                              onClick={() => {
                                const newState = !showFriendSelector;
                                setShowFriendSelector(newState);
                                
                                if (newState) {
                                  // Use setTimeout to ensure the DOM has updated before focusing
                                  setTimeout(() => {
                                    if (friendSelectorRef.current) {
                                      friendSelectorRef.current.scrollIntoView({ 
                                        behavior: 'smooth',
                                        block: 'center'
                                      });
                                    }
                                  }, 100);
                                }
                                
                                setShowPriceRangeSelector(false);
                              }}
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                            <Button 
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg border border-border",
                                form.watch('useDeepPlanner') && "text-primary"
                              )}
                              onClick={() => {
                                const newValue = !form.watch('useDeepPlanner');
                                form.setValue('useDeepPlanner', newValue, { shouldDirty: true, shouldTouch: true });
                                setUseDeepPlanner(newValue);
                                
                                toast({
                                  title: newValue ? 'Deep Planning Mode Enabled' : 'Deep Planning Mode Disabled',
                                  description: newValue 
                                    ? 'Using advanced AI for more detailed suggestions' 
                                    : 'Using standard AI planning mode',
                                  variant: 'default',
                                });
                              }}
                              title={form.watch('useDeepPlanner') ? 'Disable Deep Planning' : 'Enable Deep Planning'}
                            >
                              <Sparkles className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button 
                            type={isGenerating ? 'button' : 'submit'}
                            size="sm"
                            onClick={isGenerating ? () => {
                              setIsGenerating(false);
                              setLoadingMessage('');
                              toast({
                                title: 'Generation stopped',
                                description: 'You can adjust your preferences and try again.',
                              });
                            } : undefined}
                            className={cn(
                              'absolute bottom-2 right-2 h-8 w-8 p-0 rounded-lg flex items-center justify-center transition-all duration-300',
                              isGenerating 
                                ? 'bg-destructive hover:bg-destructive/90' 
                                : 'bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 hover:from-amber-300 hover:via-orange-400 hover:to-pink-400',
                              'text-white'
                            )}
                            title={isGenerating ? 'Stop generation' : 'Generate plan'}
                          >
                            {isGenerating ? (
                              <X className="w-4 h-4" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs px-1" />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </form>
        </Form>
      </LimitGuard>
    </div>
  );
}

export default GeneratePlanPage