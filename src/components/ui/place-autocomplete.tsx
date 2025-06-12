"use client"

import * as React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { MapPin, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface PlacePrediction {
  place_id: string
  description: string
  structured_formatting: {
    main_text: string
    secondary_text: string
  }
  types: string[]
}

interface PlaceDetails {
  place_id: string
  formatted_address: string
  name: string
  geometry: {
    location: {
      lat: number
      lng: number
    }
  }
  address_components?: {
    long_name: string
    short_name: string
    types: string[]
  }[]
  photos?: {
    photo_reference: string
    height: number
    width: number
  }[]
}

interface PlaceAutocompleteProps {
  value?: string
  onPlaceSelect?: (place: PlaceDetails) => void
  onInputChange?: (value: string) => void
  onFocus?: () => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
  locationBias?: {
    center: { lat: number; lng: number }
    radius: number
  }
  includedPrimaryTypes?: string[]
  requestedRegion?: string
  isGoogleMapsApiLoaded?: boolean
}

export function PlaceAutocomplete({
  value = "",
  onPlaceSelect,
  onInputChange,
  onFocus,
  onBlur,
  placeholder = "Search for places, addresses...",
  className,
  disabled = false,
  locationBias,
  includedPrimaryTypes = ['geocode', 'establishment'],
  requestedRegion = 'US',
  isGoogleMapsApiLoaded = false
}: PlaceAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value || "")
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null)
  const placesService = useRef<google.maps.places.PlacesService | null>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Initialize Google Places services
  useEffect(() => {
    if (isGoogleMapsApiLoaded && typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.places) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService()
      const dummyDiv = document.createElement('div')
      placesService.current = new window.google.maps.places.PlacesService(dummyDiv)
      setIsLoaded(true)
    } else if (!isGoogleMapsApiLoaded) {
      setIsLoaded(false)
    }
  }, [isGoogleMapsApiLoaded])

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value || "")
  }, [value])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchPlaces = useCallback((query: string) => {
    if (!autocompleteService.current || !query.trim()) {
      setPredictions([])
      return
    }

    setLoading(true)
    
    const request: google.maps.places.AutocompletionRequest = {
      input: query,
      types: includedPrimaryTypes,
      componentRestrictions: requestedRegion ? { country: requestedRegion.toLowerCase() } : undefined,
      locationBias: locationBias ? {
        center: new google.maps.LatLng(locationBias.center.lat, locationBias.center.lng),
        radius: locationBias.radius
      } : undefined
    }

    autocompleteService.current.getPlacePredictions(request, (predictions, status) => {
      setLoading(false)
      if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
        setPredictions(predictions)
        setShowSuggestions(true)
      } else {
        setPredictions([])
        setShowSuggestions(false)
      }
    })
  }, [includedPrimaryTypes, requestedRegion, locationBias])

  const debouncedSearch = useCallback((query: string) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = setTimeout(() => {
      searchPlaces(query)
    }, 150)
  }, [searchPlaces])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onInputChange?.(newValue)
    
    if (newValue.trim()) {
      debouncedSearch(newValue)
    } else {
      setPredictions([])
      setShowSuggestions(false)
    }
  }

  const handlePlaceSelect = (prediction: PlacePrediction) => {
    console.log('PlaceAutocomplete handlePlaceSelect called with prediction:', prediction);
    
    if (!placesService.current) {
      console.log('placesService.current is null');
      return;
    }

    const request = {
      placeId: prediction.place_id,
      fields: ['place_id', 'formatted_address', 'name', 'geometry', 'address_components', 'photos']
    }

    console.log('Making getDetails request:', request);
    
    placesService.current.getDetails(request, (place, status) => {
      console.log('=== DETAILED PLACE DETAILS RESPONSE ===');
      console.log('Status:', status);
      console.log('Raw place object:', place);
      
      if (place) {
        console.log('Place ID:', place.place_id);
        console.log('Place Name:', place.name);
        console.log('Formatted Address:', place.formatted_address);
        console.log('Photos field exists:', 'photos' in place);
        console.log('Photos value:', place.photos);
        console.log('Photos type:', typeof place.photos);
        console.log('Photos length:', place.photos?.length);
        
        if (place.photos && place.photos.length > 0) {
          console.log('First photo object:', place.photos[0]);
          console.log('First photo height:', place.photos[0].height);
          console.log('First photo width:', place.photos[0].width);
          // Note: Google Maps API PlacePhoto doesn't have photo_reference property
          // Photo reference is accessed through getUrl() method
          if (typeof place.photos[0].getUrl === 'function') {
            console.log('Photo has getUrl method available');
          }
        } else {
          console.log('No photos found in place object');
        }
        
        // Log all available fields on the place object
        console.log('All place object keys:', Object.keys(place));
      }
      
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        const placeDetails: PlaceDetails = {
          place_id: place.place_id!,
          formatted_address: place.formatted_address!,
          name: place.name!,
          geometry: {
            location: {
              lat: place.geometry!.location!.lat(),
              lng: place.geometry!.location!.lng()
            }
          },
          address_components: place.address_components,
          photos: place.photos?.map(photo => {
            console.log('Mapping photo:', photo);
            // If the photo has a getUrl function, call it to get the URL
            if (typeof photo.getUrl === 'function') {
              try {
                const photoUrl = photo.getUrl({ maxWidth: 400 });
                console.log('Generated photo URL during mapping:', photoUrl);
                return {
                  photo_reference: photoUrl, // Store the URL as photo_reference
                  height: photo.height,
                  width: photo.width
                };
              } catch (error) {
                console.error('Error calling getUrl during mapping:', error);
                // For Google Maps API photos, there's no direct photo_reference property
                // We'll store an empty string as fallback since we couldn't get the URL
                return {
                  photo_reference: '',
                  height: photo.height,
                  width: photo.width
                };
              }
            } else {
              // For REST API or other sources that might have photo_reference
              // Cast to any to access photo_reference if it exists
              const photoAny = photo as any;
              return {
                photo_reference: photoAny.photo_reference || '',
                height: photo.height,
                width: photo.width
              };
            }
          }) || []
        }
        
        console.log('=== FINAL PLACE DETAILS ===');
        console.log('Created placeDetails:', placeDetails);
        console.log('Photos in placeDetails:', placeDetails.photos);
        console.log('Photos count:', placeDetails.photos?.length || 0);
        
        const displayName = place.name || place.formatted_address || prediction.description
        console.log('Setting input value to:', displayName);
        setInputValue(displayName)
        onInputChange?.(displayName)
        
        console.log('Calling onPlaceSelect with placeDetails');
        onPlaceSelect?.(placeDetails)
        
        setShowSuggestions(false)
        setPredictions([])
      } else {
        console.log('getDetails failed with status:', status);
        console.log('Status meanings:');
        console.log('- OK:', google.maps.places.PlacesServiceStatus.OK);
        console.log('- ZERO_RESULTS:', google.maps.places.PlacesServiceStatus.ZERO_RESULTS);
        console.log('- OVER_QUERY_LIMIT:', google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT);
        console.log('- REQUEST_DENIED:', google.maps.places.PlacesServiceStatus.REQUEST_DENIED);
        console.log('- INVALID_REQUEST:', google.maps.places.PlacesServiceStatus.INVALID_REQUEST);
      }
    })
  }

  const handleClear = () => {
    setInputValue("")
    onInputChange?.("")
    setPredictions([])
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const handleInputFocus = () => {
    onFocus?.()
    if (inputValue.trim() && predictions.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Only blur if not clicking on suggestions
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      // Add a small delay to allow click events to fire first
      setTimeout(() => {
        onBlur?.()
        setShowSuggestions(false)
      }, 150)
    }
  }

  if (!isLoaded) {
    return (
      <div className={cn("relative w-full", className)}>
        <div className="relative">
          <input
            type="text"
            placeholder="Loading..."
            disabled
            className="w-full h-full px-3 text-base bg-transparent border-none rounded-lg placeholder:text-gray-400 text-white focus:outline-none focus:ring-0 transition-all duration-200 opacity-50"
          />
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue || ""}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full h-full pl-10 pr-3 text-base bg-transparent border-none rounded-lg placeholder:text-gray-400 text-white focus:outline-none focus:ring-0 transition-all duration-200"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
            }
            if (e.key === 'Escape') {
              setShowSuggestions(false)
              onBlur?.()
            }
          }}
        />
        {inputValue && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0 hover:bg-white/10 rounded-full transition-colors"
            onClick={handleClear}
          >
            <X className="h-3 w-3 text-gray-400" />
          </Button>
        )}
      </div>
      
      {/* Suggestions Dropdown */}
      {showSuggestions && (predictions.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-black/90 backdrop-blur-lg border border-gray-600/50 shadow-2xl rounded-xl overflow-hidden max-h-80">
          {loading && (
            <div className="py-6 text-center text-sm text-gray-400">
              Searching...
            </div>
          )}
          {!loading && predictions.length === 0 && inputValue.trim() && (
            <div className="py-6 text-center text-sm text-gray-400">
              No places found.
            </div>
          )}
          {!loading && predictions.length > 0 && (
            <div className="max-h-72 overflow-y-auto">
              {predictions.map((prediction, index) => (
                <div
                  key={prediction.place_id}
                  className="cursor-pointer px-4 py-3 hover:bg-white/10 transition-colors border-b border-gray-700/50 last:border-b-0 flex items-start gap-3"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    console.log('Suggestion mousedown:', prediction);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Suggestion clicked:', prediction);
                    handlePlaceSelect(prediction);
                  }}
                >
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium text-white truncate">
                      {prediction.structured_formatting.main_text}
                    </span>
                    {prediction.structured_formatting.secondary_text && (
                      <span className="text-sm text-gray-400 truncate">
                        {prediction.structured_formatting.secondary_text}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}