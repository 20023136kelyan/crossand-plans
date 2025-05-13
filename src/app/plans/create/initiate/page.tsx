"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FriendMultiSelectInput } from "@/components/friend-multi-select-input";
import { MOCK_INVITABLE_FRIENDS_DATA, userProfilesDb } from "@/lib/mock-data";
import { MOCK_USER_ID } from "@/types";
import { getAIFullPlanDetails } from "@/lib/actions/ai";
import type { GenerateFullPlanDetailsInput } from "@/ai/flows/plan-types";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Feather, MapPin, LocateFixed, CalendarDays, Route, Map, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format, parseISO, set, isValid as isValidDate } from 'date-fns';
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { PriceRangeInput } from "@/components/price-range-input";
import { generateComprehensivePreferencesForParticipant } from '@/lib/actions/plans';

// Simple type declarations for Google Maps
declare global {
  interface Window {
    google: {
      maps: {
        Map: any;
        Geocoder: any;
        Marker: any;
        Circle: any;
      };
    };
    initMapForInitiatePlan?: () => void;
  }
}

// Helper function since it's not exported from plans
const generateComprehensivePreferencesForParticipant = (userId: string): string[] => {
  const profile = userProfilesDb[userId];
  if (!profile) return [];
  const prefs: string[] = [];
  if (profile.allergies) profile.allergies.forEach(a => prefs.push(`Allergic to ${a}`));
  if (profile.dietaryRestrictions) profile.dietaryRestrictions.forEach(d => prefs.push(`Dietary restriction: ${d}`));
  if (profile.preferences) profile.preferences.forEach(p => prefs.push(p)); 
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

export default function InitiatePlanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [userSuggestedEventTime, setUserSuggestedEventTime] = useState<string | null>(null);
  const [planType, setPlanType] = useState<'single-stop' | 'multi-stop'>('single-stop');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string | undefined>(undefined);


  const [cityForMap, setCityForMap] = useState<string>("");
  const [isMapApiLoaded, setIsMapApiLoaded] = useState(false);
  const [mapApiKeyMissing, setMapApiKeyMissing] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 34.0522, lng: -118.2437 }); 
  const [selectedPointForAI, setSelectedPointForAI] = useState<{ lat: number; lng: number } | null>(null);
  const [mapRadiusKmForAI, setMapRadiusKmForAI] = useState<number>(5);
  const [selectedAddressName, setSelectedAddressName] = useState<string | null>(null);
  const [initialGeolocationAttempted, setInitialGeolocationAttempted] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [manualCitySet, setManualCitySet] = useState(false);


  useEffect(() => {
    setIsClient(true);
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      setMapApiKeyMissing(true);
      console.warn("Google Maps API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) is missing. Map features will be limited.");
    }
  }, []);

  useEffect(() => {
    if (!isClient || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || mapApiKeyMissing) return;

    if (window.google && window.google.maps && window.google.maps.Geocoder) {
      setIsMapApiLoaded(true);
      return;
    }

    if (!document.getElementById('google-maps-script-initiate-plan')) {
      const script = document.createElement('script');
      script.id = 'google-maps-script-initiate-plan';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=maps,places,geocoding&callback=initMapForInitiatePlan`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      window.initMapForInitiatePlan = () => {
        setIsMapApiLoaded(true);
      };
    }
    return () => {
      if (window.initMapForInitiatePlan) {
        delete window.initMapForInitiatePlan;
      }
    };
  }, [isClient, mapApiKeyMissing]);

  useEffect(() => {
    if (isMapApiLoaded && mapRef.current && !mapInstanceRef.current && !mapApiKeyMissing) {
      geocoderRef.current = new window.google.maps.Geocoder();
      const map = new window.google.maps.Map(mapRef.current, {
        center: mapCenter,
        zoom: 10,
        streetViewControl: false,
        mapTypeControl: false,
      });
      mapInstanceRef.current = map;

      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          const newPoint = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          setSelectedPointForAI(newPoint);
           if (geocoderRef.current) {
            geocoderRef.current.geocode({ location: newPoint }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                const cityComponent = results[0].address_components.find(c => c.types.includes("locality"));
                if (cityComponent && !manualCitySet) { 
                  setCityForMap(cityComponent.long_name);
                }
              }
            });
          }
        }
      });
    }
  }, [isMapApiLoaded, mapCenter, manualCitySet, mapApiKeyMissing]);

  useEffect(() => {
    if (mapInstanceRef.current && selectedPointForAI && !mapApiKeyMissing) {
      if (!markerRef.current) {
        markerRef.current = new window.google.maps.Marker({
          position: selectedPointForAI,
          map: mapInstanceRef.current,
          draggable: true,
        });
        markerRef.current.addListener('dragend', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
             const newPoint = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            setSelectedPointForAI(newPoint);
             if (geocoderRef.current) {
                geocoderRef.current.geocode({ location: newPoint }, (results, status) => {
                  if (status === 'OK' && results && results[0]) {
                    const cityComponent = results[0].address_components.find(c => c.types.includes("locality"));
                    if (cityComponent && !manualCitySet) { 
                      setCityForMap(cityComponent.long_name);
                    }
                  }
                });
              }
          }
        });
      } else {
        markerRef.current.setPosition(selectedPointForAI);
      }

      if (geocoderRef.current) {
        geocoderRef.current.geocode({ location: selectedPointForAI }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            setSelectedAddressName(results[0].formatted_address);
          } else {
            setSelectedAddressName(`Lat: ${selectedPointForAI.lat.toFixed(4)}, Lng: ${selectedPointForAI.lng.toFixed(4)}`);
          }
        });
      } else {
        setSelectedAddressName(`Lat: ${selectedPointForAI.lat.toFixed(4)}, Lng: ${selectedPointForAI.lng.toFixed(4)}`);
      }

      if (circleRef.current) {
        circleRef.current.setCenter(selectedPointForAI);
      } else {
        circleRef.current = new window.google.maps.Circle({
          strokeColor: "#42a5f5", // Calm Blue
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#42a5f5", // Calm Blue
          fillOpacity: 0.25,
          map: mapInstanceRef.current,
          center: selectedPointForAI,
          radius: mapRadiusKmForAI * 1000,
        });
      }
    }
  }, [selectedPointForAI, mapRadiusKmForAI, manualCitySet, mapApiKeyMissing]);

  useEffect(() => {
    if (circleRef.current && !mapApiKeyMissing) {
      circleRef.current.setRadius(mapRadiusKmForAI * 1000);
    }
  }, [mapRadiusKmForAI, mapApiKeyMissing]);

  const geocodeCityAndSetMap = useCallback((cityToGeocode: string, shouldSetSelectedPoint: boolean = false) => {
    if (!cityToGeocode || !geocoderRef.current || !mapInstanceRef.current || mapApiKeyMissing) return;
    setIsGeolocating(true); 
    geocoderRef.current.geocode({ address: cityToGeocode }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        const newCenter = { lat: location.lat(), lng: location.lng() };
        mapInstanceRef.current?.setCenter(newCenter);
        mapInstanceRef.current?.setZoom(12); 
        if (shouldSetSelectedPoint) { 
            setSelectedPointForAI(newCenter);
        }
      } else {
        toast({ title: "Could Not Find City", description: `Could not find "${cityToGeocode}" on the map. Try a broader area or check spelling.`, variant: "default" });
      }
      setIsGeolocating(false); 
    });
  }, [toast, mapApiKeyMissing]);


  const handleCityInputChange = (newCityValue: string) => {
    setCityForMap(newCityValue);
    setManualCitySet(true); 
  };

  useEffect(() => {
    if (isMapApiLoaded && cityForMap && manualCitySet && !mapApiKeyMissing) { 
      const timer = setTimeout(() => { 
        geocodeCityAndSetMap(cityForMap, true); 
      }, 1000); 
      return () => clearTimeout(timer);
    }
  }, [cityForMap, isMapApiLoaded, geocodeCityAndSetMap, manualCitySet, mapApiKeyMissing]);


  const fetchUserLocationAndSetMap = useCallback(async (setCityAndPoint = true) => {
    if (!navigator.geolocation || mapApiKeyMissing) {
      if (setCityAndPoint && !cityForMap) { 
        setCityForMap("New York"); 
        geocodeCityAndSetMap("New York", true);
      }
      return;
    }

    // Check if we're on HTTPS
    const isSecure = window.location.protocol === 'https:';
    if (!isSecure) {
      console.warn('Geolocation is being requested over insecure HTTP. This may not work in all browsers.');
    }

    const options = {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 300000
    };

    setIsGeolocating(true);
    setManualCitySet(false); 

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          (error) => {
            console.warn('Geolocation error:', error);
            // If permission denied and we're not on HTTPS, suggest switching to HTTPS
            if (error.code === error.PERMISSION_DENIED && !isSecure) {
              reject(new Error('Geolocation permission denied. Try accessing the site over HTTPS.'));
            } else {
              reject(error);
            }
          },
          options
        );
      });

      const { latitude, longitude } = position.coords;
      const currentPos = { lat: latitude, lng: longitude };
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter(currentPos);
        mapInstanceRef.current.setZoom(12);
      }
      
      if (setCityAndPoint) {
        setMapCenter(currentPos); 
        setSelectedPointForAI(currentPos); 
        if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && geocoderRef.current) { 
          try {
            // @ts-ignore
            const results = await new Promise((resolve, reject) => {
              geocoderRef.current!.geocode({ location: currentPos }, (results: any, status: string) => {
                if (status === 'OK' && results) {
                  resolve(results);
                } else {
                  reject(new Error(`Geocoding failed with status: ${status}`));
                }
              });
            });

            if (results[0]) {
              const cityComponent = results[0].address_components.find((c: any) => c.types.includes("locality"));
              const stateComponent = results[0].address_components.find((c: any) => c.types.includes("administrative_area_level_1"));
              const countryComponent = results[0].address_components.find((c: any) => c.types.includes("country"));
              
              if (cityComponent) {
                setCityForMap(cityComponent.long_name);
              } else if (stateComponent) {
                setCityForMap(stateComponent.long_name);
              } else if (countryComponent) {
                setCityForMap(countryComponent.long_name);
              } else {
                setCityForMap("Current Location (City N/A)");
              }
            }
          } catch (error) {
            console.error("Error during reverse geocoding:", error);
            setCityForMap("Current Location");
          }
        }
      }
    } catch (error) {
      console.warn("Geolocation error:", error);
      if (setCityAndPoint && !cityForMap) {
        setCityForMap("New York"); 
        geocodeCityAndSetMap("New York", true);
      }
      toast({ 
        title: "Location Access Failed", 
        description: isSecure 
          ? "Could not access your location. Using default location instead."
          : "Location access requires HTTPS. Using default location instead.", 
        variant: "default" 
      });
    } finally {
      setIsGeolocating(false);
    }
  }, [mapApiKeyMissing, cityForMap, toast, geocodeCityAndSetMap]);


  useEffect(() => {
    if (isClient && !initialGeolocationAttempted && !mapApiKeyMissing && !isGeolocating && !cityForMap) {
      setInitialGeolocationAttempted(true);
      fetchUserLocationAndSetMap(true); 
    } else if (isClient && !initialGeolocationAttempted && mapApiKeyMissing && !cityForMap) {
      setInitialGeolocationAttempted(true);
      setCityForMap("New York"); 
    }
  }, [isClient, initialGeolocationAttempted, mapApiKeyMissing, fetchUserLocationAndSetMap, cityForMap, isGeolocating]);


  const handleGeneratePlan = async () => {
    if (!userPrompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please describe the event you want to plan.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);

    const participantPreferences: string[] = [];
    const hostProfile = userProfilesDb[MOCK_USER_ID];
    if (hostProfile) {
        generateComprehensivePreferencesForParticipant(MOCK_USER_ID).forEach(pref => {
            participantPreferences.push(`${hostProfile.firstName} ${hostProfile.lastName} (Host): ${pref}`);
        });
    }

    selectedFriendIds.forEach(friendId => {
      const friendProfile = userProfilesDb[friendId];
      if (friendProfile) {
        generateComprehensivePreferencesForParticipant(friendId).forEach(pref => {
            participantPreferences.push(`${friendProfile.firstName} ${friendProfile.lastName}: ${pref}`);
        });
      }
    });

    try {
      const aiInput: GenerateFullPlanDetailsInput = {
        userPrompt,
        hostId: MOCK_USER_ID,
        participantUserIds: selectedFriendIds,
        participantPreferences,
        planType,
        priceRange: selectedPriceRange,
        userEnteredCity: cityForMap || undefined, 
      };

      if (userSuggestedEventTime) {
        try {
            const date = parseISO(userSuggestedEventTime);
             if (!isValidDate(date)) { 
                throw new Error("Invalid date format for userSuggestedEventTime");
            }
            aiInput.userSuggestedEventTime = date.toISOString();
        } catch (e) {
            toast({ title: "Invalid Date", description: "The suggested event time is not valid. AI will suggest a time.", variant: "default"});
        }
      }


      if (selectedPointForAI) {
        aiInput.selectedPoint = selectedPointForAI;
        aiInput.mapRadiusKm = mapRadiusKmForAI;
      }


      const result = await getAIFullPlanDetails(aiInput);

      if (result.success && result.data) {
        const queryParams = new URLSearchParams();
        Object.entries(result.data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            if (key === 'eventTime' && typeof value === 'string') {
                try {
                    const date = parseISO(value);
                     if (!isValidDate(date)) { 
                        console.warn("AI returned an invalid date format for eventTime:", value);
                        queryParams.append(key, value); 
                    } else {
                        queryParams.append(key, date.toISOString());
                    }
                } catch (e) {
                    console.warn("Error parsing eventTime from AI, appending as is:", value, e);
                    queryParams.append(key, value);
                }
            } else if (key === 'itinerary' && Array.isArray(value)) {
                queryParams.append(key, JSON.stringify(value));
            }
             else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                 queryParams.append(key, String(value));
            }
          }
        });
        selectedFriendIds.forEach(id => queryParams.append('invitedParticipantUserIds', id));
        if (selectedPointForAI) {
            queryParams.append('selectedPointLat', selectedPointForAI.lat.toString());
            queryParams.append('selectedPointLng', selectedPointForAI.lng.toString());
            queryParams.append('mapRadiusKm', mapRadiusKmForAI.toString());
        }
        queryParams.append('planType', planType);
        if (cityForMap) { // Pass the city used in Step 1 to Step 2 for consistent fallback
            queryParams.append('userEnteredCityForStep2', cityForMap);
        }
        
        router.push(`/plans/create?${queryParams.toString()}`);
      } else {
        toast({
          title: "AI Draft Failed",
          description: result.message || "Could not generate plan draft from your prompt. Please try again or be more specific.",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({
        title: "Error Generating Plan",
        description: errorMessage,
        variant: "destructive",
      });
      console.error("Error in handleGeneratePlan:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  let currentEventDateObject: Date | null = null;
  if (isClient && userSuggestedEventTime) {
      try {
          currentEventDateObject = parseISO(userSuggestedEventTime);
          if (!isValidDate(currentEventDateObject)) { 
              currentEventDateObject = null; 
          }
      } catch (e) {
          currentEventDateObject = null; 
      }
  }


  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Create a New Plan - Step 1</h1>
        <p className="text-muted-foreground">
          Start by selecting participants, plan type, optionally defining an event area, suggesting a time, and describing your event idea.
        </p>
      </header>

      <Card className="w-full max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="text-primary" /> Select Participants</CardTitle>
          <CardDescription>Choose friends to include in this plan. Their preferences will help the AI.</CardDescription>
        </CardHeader>
        <CardContent>
          <FriendMultiSelectInput
            availableFriends={MOCK_INVITABLE_FRIENDS_DATA.filter(f => f.userId !== MOCK_USER_ID)}
            selectedFriendIds={selectedFriendIds}
            onChange={setSelectedFriendIds}
          />
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl mx-auto shadow-lg">
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Route className="text-primary"/> Plan Type</CardTitle>
            <CardDescription>
                Is this a single location event or a plan with multiple stops?
            </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center space-x-2">
            <Label htmlFor="plan-type-switch" className={cn(planType === 'single-stop' ? "text-foreground font-medium" : "text-muted-foreground")}>
                Single Stop
            </Label>
            <Switch
                id="plan-type-switch"
                checked={planType === 'multi-stop'}
                onCheckedChange={(checked) => setPlanType(checked ? 'multi-stop' : 'single-stop')}
                aria-label="Toggle plan type between single stop and multi-stop"
            />
            <Label htmlFor="plan-type-switch" className={cn(planType === 'multi-stop' ? "text-foreground font-medium" : "text-muted-foreground")}>
                Multi-Stop
            </Label>
        </CardContent>
      </Card>
      
      <Card className="w-full max-w-2xl mx-auto shadow-lg">
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarDays className="text-primary"/> Suggest Event Date & Time (Optional)</CardTitle>
            <CardDescription>
                Provide a preferred start date and time. If left empty, the AI will suggest one.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                            "w-full justify-start text-left font-normal",
                            !currentEventDateObject && "text-muted-foreground"
                        )}
                        disabled={!isClient}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {currentEventDateObject && isValidDate(currentEventDateObject) ? (
                            format(currentEventDateObject, "PPP HH:mm") 
                        ) : (
                            <span>{isClient ? "Pick a date and time" : "Loading..."}</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={currentEventDateObject && isValidDate(currentEventDateObject) ? currentEventDateObject : undefined}
                        onSelect={(selectedDay) => {
                            if (!selectedDay) {
                                setUserSuggestedEventTime(null);
                                return;
                            }
                            const hours = currentEventDateObject && isValidDate(currentEventDateObject) ? currentEventDateObject.getHours() : new Date().getHours();
                            const minutes = currentEventDateObject && isValidDate(currentEventDateObject) ? currentEventDateObject.getMinutes() : new Date().getMinutes();
                            const newEventDateTime = set(selectedDay, { hours, minutes, seconds: 0, milliseconds: 0});
                            setUserSuggestedEventTime(newEventDateTime.toISOString());
                        }}
                        disabled={!isClient}
                        initialFocus={isClient}
                    />
                    <div className="p-2 border-t">
                        <Label htmlFor="event-time-step1" className="sr-only">Event time (HH:mm)</Label>
                        <Input
                            id="event-time-step1"
                            type="time"
                            value={currentEventDateObject && isValidDate(currentEventDateObject) ? format(currentEventDateObject, "HH:mm") : ""}
                            onChange={(e) => {
                                const newTimeValue = e.target.value;
                                const [hoursStr, minutesStr] = newTimeValue.split(':');
                                const hours = parseInt(hoursStr, 10);
                                const minutes = parseInt(minutesStr, 10);
                                if (isNaN(hours) || isNaN(minutes)) return;
                                
                                const baseDate = currentEventDateObject && isValidDate(currentEventDateObject) ? currentEventDateObject : new Date();
                                const newEventDateTime = set(baseDate, { hours, minutes, seconds: 0, milliseconds: 0 });
                                setUserSuggestedEventTime(newEventDateTime.toISOString());
                            }}
                            disabled={!isClient || !(currentEventDateObject && isValidDate(currentEventDateObject))}
                        />
                    </div>
                </PopoverContent>
            </Popover>
             {userSuggestedEventTime === null && isClient && (
                <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => {
                    const now = new Date();
                    now.setHours(now.getHours() + 1, 0, 0, 0); 
                    setUserSuggestedEventTime(now.toISOString());
                }}>
                    Set a default time
                </Button>
            )}
        </CardContent>
      </Card>


      {!mapApiKeyMissing ? (
        isMapApiLoaded ? (
          <Card className="w-full max-w-2xl mx-auto shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Map className="text-primary"/> Define Event Area (Optional)</CardTitle>
              <CardDescription>
                Optionally, pick a city and then click on the map to set a central point and adjust the radius for your event area. 
                This helps the AI if no specific venue is detailed in your prompt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-2">
                <div className="flex-grow">
                  <Label htmlFor="city-for-map">City for Map View</Label>
                  <Input
                    id="city-for-map"
                    placeholder="e.g., San Francisco"
                    value={cityForMap}
                    onChange={(e) => handleCityInputChange(e.target.value)}
                    className="mt-1"
                    disabled={isGeolocating}
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => fetchUserLocationAndSetMap(true)} 
                  disabled={isGeolocating || !navigator.geolocation || mapApiKeyMissing}
                  title="Use my current location"
                  aria-label="Use my current location"
                >
                  {isGeolocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                </Button>
              </div>
              <div ref={mapRef} className="h-[250px] w-full rounded-md border bg-muted overflow-hidden" />
              <div className="space-y-2">
                <Label htmlFor="radius-slider">Radius: {mapRadiusKmForAI} km</Label>
                <Slider
                  id="radius-slider"
                  min={1}
                  max={50}
                  step={1}
                  value={[mapRadiusKmForAI]}
                  onValueChange={(value) => setMapRadiusKmForAI(value[0])}
                />
              </div>
              {selectedPointForAI && (
                <p className="text-xs text-muted-foreground">
                  Selected center: {selectedAddressName || `Lat: ${selectedPointForAI.lat.toFixed(4)}, Lng: ${selectedPointForAI.lng.toFixed(4)}`}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-2xl mx-auto shadow-lg">
            <CardContent className="flex items-center justify-center h-[250px] border rounded-md bg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading map...</p>
            </CardContent>
          </Card>
        )
      ) : (
        <Alert variant="default" className="w-full max-w-2xl mx-auto bg-amber-50 border-amber-200 text-amber-700">
            <MapPin className="h-4 w-4 !text-amber-700" />
            <AlertTitle>Map Feature Disabled</AlertTitle>
            <AlertDescription>
            The interactive map is unavailable because the Google Maps API key is missing.
            </AlertDescription>
        </Alert>
      )}
      
      <Card className="w-full max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><DollarSign className="text-primary"/> Suggest Price Range (Optional)</CardTitle>
          <CardDescription>
            Provide a preferred price range for the event. If left empty, the AI will consider participant preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PriceRangeInput
            value={selectedPriceRange || ""}
            onChange={setSelectedPriceRange}
          />
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Feather className="text-primary"/> Describe Your Event</CardTitle>
          <CardDescription>
            Tell us what you have in mind. The more details you provide, the better the AI can assist. 
            Mention things like desired activity, general date/time, city, and other key elements. Max 200 characters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="user-prompt" className="text-base">Your Event Idea:</Label>
            <Textarea
              id="user-prompt"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value.substring(0, 200))}
              placeholder="e.g., A casual birthday dinner for about 5 people next Friday evening in downtown. We like Italian food and a place with a good atmosphere, not too expensive. Maybe a walk afterwards?"
              rows={5}
              className="mt-1"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground text-right mt-1">{userPrompt.length}/200</p>
          </div>
          <Button onClick={handleGeneratePlan} disabled={isLoading || !isClient} className="w-full" size="lg">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating Plan Draft...
              </>
            ) : (
              "Generate Plan Draft & Proceed to Review"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
