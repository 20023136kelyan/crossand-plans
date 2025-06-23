'use client';

import React from 'react';
import { useJsApiLoader, type Libraries } from '@react-google-maps/api';

const GOOGLE_MAPS_LIBRARIES: Libraries = ['places', 'geocoding', 'marker'];

interface GoogleMapsContextType {
  isLoaded: boolean;
}

const GoogleMapsContext = React.createContext<GoogleMapsContextType>({
  isLoaded: false,
});

export const useGoogleMaps = () => React.useContext(GoogleMapsContext);

export const GoogleMapsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: GOOGLE_MAPS_LIBRARIES,
    version: 'beta',
    mapIds: ['crossand-plans-map'],
  });

  return (
    <GoogleMapsContext.Provider value={{ isLoaded }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}; 