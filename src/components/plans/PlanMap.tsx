'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Map,
  Navigation,
  Maximize2,
  Minimize2,
  MapPin,
  Route,
  Loader2
} from 'lucide-react';
import type { Plan as PlanType } from '@/types/user';

interface ItineraryItem {
  id: string;
  placeName: string;
  description: string | null;
  address: string | null;
  googlePlaceId: string | null;
  city: string | null;
  googlePhotoReference: string | null;
  googleMapsImageUrl: string | null;
  lat: number | null;
  lng: number | null;
  types: string[] | null;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  phoneNumber: string | null;
  isOperational: boolean | null;
  statusText: string | null;
  openingHours: string[] | null;
  website: string | null;
  activitySuggestions: string[] | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  transitMode: 'driving' | 'walking' | 'bicycling' | 'transit' | null;
  transitTimeFromPreviousMinutes?: number | null;
  notes: string | null;
}

interface PlanMapProps {
  itinerary: ItineraryItem[];
  planName: string;
  apiKey?: string;
  className?: string;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

export function PlanMap({ itinerary, planName, apiKey, className }: PlanMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey || !itinerary?.length) {
      setIsLoading(false);
      setError('Map cannot be loaded: missing API key or itinerary data');
      return;
    }

    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        initializeMap();
        return;
      }

      // Check if Google Maps script is already being loaded or exists
      const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (existingScript) {
        // Script already exists, wait for it to load
        const checkGoogleMaps = () => {
          if (window.google && window.google.maps) {
            initializeMap();
          } else {
            setTimeout(checkGoogleMaps, 100);
          }
        };
        checkGoogleMaps();
        return;
      }

      // Load Google Maps script only if it doesn't exist
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      script.onerror = () => {
        setError('Failed to load Google Maps');
        setIsLoading(false);
      };
      document.head.appendChild(script);
    };

    const initializeMap = () => {
      if (!mapRef.current || !window.google) {
        setError('Map container or Google Maps not available');
        setIsLoading(false);
        return;
      }

      try {
        // Create map centered on first location
        const firstLocation = itinerary[0];
        const center = {
          lat: firstLocation.lat || 0,
          lng: firstLocation.lng || 0
        };

        const mapInstance = new window.google.maps.Map(mapRef.current, {
          zoom: 13,
          center,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: false,
          zoomControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'on' }]
            }
          ]
        });

        // Add markers for each itinerary item
        const bounds = new window.google.maps.LatLngBounds();
        const markers: any[] = [];

        itinerary.forEach((item, index) => {
          if (item.lat && item.lng) {
            const position = {
              lat: item.lat,
              lng: item.lng
            };

            const marker = new window.google.maps.Marker({
              position,
              map: mapInstance,
              title: item.placeName,
              label: {
                text: (index + 1).toString(),
                color: 'white',
                fontWeight: 'bold'
              },
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 20,
                fillColor: '#ff5722',
                fillOpacity: 1,
                strokeColor: 'white',
                strokeWeight: 2
              }
            });

            // Create info window
            const infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div class="p-2">
                  <h3 class="font-semibold text-sm">${item.placeName}</h3>
                  ${item.address ? `<p class="text-xs text-gray-600 mt-1">${item.address}</p>` : ''}
                  ${typeof item.rating === 'number' ? `<p class="text-xs mt-1">⭐ ${item.rating.toFixed(1)}</p>` : ''}
                </div>
              `
            });

            marker.addListener('click', () => {
              // Close other info windows
              markers.forEach(m => m.infoWindow?.close());
              infoWindow.open(mapInstance, marker);
            });

            markers.push({ marker, infoWindow });
            bounds.extend(position);
          }
        });

        // Fit map to show all markers
        if (markers.length > 1) {
          mapInstance.fitBounds(bounds);
        }

        // Draw route if there are multiple locations
        if (markers.length > 1) {
          const directionsService = new window.google.maps.DirectionsService();
          const directionsRenderer = new window.google.maps.DirectionsRenderer({
            suppressMarkers: true, // We already have custom markers
            polylineOptions: {
              strokeColor: '#ff5722',
              strokeWeight: 3,
              strokeOpacity: 0.8
            }
          });
          directionsRenderer.setMap(mapInstance);

          const waypoints = itinerary.slice(1, -1).map(item => ({
            location: { lat: item.lat!, lng: item.lng! },
            stopover: true
          }));

          const request = {
            origin: { lat: itinerary[0].lat!, lng: itinerary[0].lng! },
            destination: { 
              lat: itinerary[itinerary.length - 1].lat!, 
              lng: itinerary[itinerary.length - 1].lng! 
            },
            waypoints,
            travelMode: window.google.maps.TravelMode.DRIVING
          };

          directionsService.route(request, (result: any, status: any) => {
            if (status === 'OK') {
              directionsRenderer.setDirections(result);
            }
          });
        }

        setMap(mapInstance);
        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Failed to initialize map');
        setIsLoading(false);
      }
    };

    loadGoogleMaps();
  }, [apiKey, itinerary]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const openInGoogleMaps = () => {
    if (!itinerary?.length) return;
    
    const firstLocation = itinerary[0];
    const url = `https://www.google.com/maps/dir/?api=1&destination=${firstLocation.lat},${firstLocation.lng}`;
    window.open(url, '_blank');
  };

  if (!itinerary?.length) {
    return null;
  }

  return (
    <Card className={`bg-background/30 backdrop-blur-sm border border-border/30 ${className || ''} ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
      <CardContent className="p-0">
        <div className={`relative ${isFullscreen ? 'h-full' : 'h-48'} w-full rounded-lg overflow-hidden`}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading map...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="text-center p-4">
                <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openInGoogleMaps}
                  className="mt-2"
                >
                  <Navigation className="h-3 w-3 mr-1" />
                  Open in Google Maps
                </Button>
              </div>
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" />
        </div>
      </CardContent>
    </Card>
  );
}